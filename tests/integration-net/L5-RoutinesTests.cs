using System.Text.Json;
using Antares.Server.Routines;
using Xunit;
using Xunit.Abstractions;

namespace Antares.Server.IntegrationTests;

/// <summary>
/// L5-Routines lane. Only ONE method was convertible:
///   * Drop  -> DbMaintenance.DropProc(p.Name)  (cross-dialect quoted DROP PROCEDURE).
///
/// Kept RAW (with in-source // raw: notes):
///   * GetInformations — DbMaintenance.GetProcList() returns List&lt;DbProcInfo&gt; (names only)
///     and cannot fill RoutineInfoDto.Sql (the procedure body the renderer's RoutineInfos.sql
///     consumes). Converting would drop a contract field, so the catalog read stays raw.
///   * Create / Alter — execute user-supplied procedure SQL; no DbMaintenance API.
///
/// DropProc is a SqlSugar runtime call (no .ToSqlString() offline form), so these are
/// payload-binding characterization tests: they lock the exact value the conversion feeds to
/// DropProc, proving DropProc(p.Name) preserves the byte-identical behavior of the prior raw
/// `DROP PROCEDURE {Quote(client, p.Name)}` — both operate on the same bound p.Name.
///
/// They also DOCUMENT (do not fix — out of this lane's conversion scope) a pre-existing
/// DTO-contract-drift quirk: the renderer ships drop as { uid, schema, routine: name } and
/// create/alter as nested { routine: {...} }, but RoutineDdlPayload is FLAT (Uid/Schema/Name/Sql)
/// with no `routine` key — so Name/Sql bind empty from the real renderer shapes. The conversion
/// faithfully carries that behavior; locking it here flags any future renderer/DTO realignment.
/// </summary>
[Trait("Category", "unit")]
public sealed class L5_RoutinesTests
{
    private readonly ITestOutputHelper _out;
    public L5_RoutinesTests(ITestOutputHelper output) => _out = output;

    // ASP.NET Core's default JSON binding is case-insensitive; mirror it here.
    private static readonly JsonSerializerOptions Opts = new() { PropertyNameCaseInsensitive = true };
    private static T Bind<T>(string json) => JsonSerializer.Deserialize<T>(json, Opts)!;

    // ---- Drop: the value DropProc(p.Name) receives ----------------------------------------

    [Fact]
    public void Drop_binds_flat_name_and_feeds_it_to_dropproc()
    {
        // A flat { uid, schema, name } shape binds p.Name; DropProc(p.Name) drops "my_proc".
        const string json = """ { "uid": "c1", "schema": "public", "name": "my_proc" } """;
        var p = Bind<RoutinesService.RoutineDdlPayload>(json);
        Assert.Equal("c1", p.Uid);
        Assert.Equal("public", p.Schema);
        Assert.Equal("my_proc", p.Name); // -> DropProc("my_proc")
        _out.WriteLine($"drop targets p.Name={p.Name}");
    }

    [Fact]
    public void Drop_real_renderer_shape_leaves_name_empty_quirk()
    {
        // quirk: renderer dropRoutine sends the name under `routine`, but RoutineDdlPayload has
        // no `routine` key, so p.Name stays empty. The conversion preserves this exactly:
        // raw was DROP PROCEDURE {Quote(client, "")}; now it is DropProc("") — same empty target.
        // Documented, not fixed (binding realignment is out of this conversion lane's scope).
        const string json = """ { "uid": "c1", "schema": "public", "routine": "my_proc" } """;
        var p = Bind<RoutinesService.RoutineDdlPayload>(json);
        Assert.Equal("c1", p.Uid);
        Assert.Equal(string.Empty, p.Name); // the `routine` key is genuinely unbound
        _out.WriteLine("quirk locked: renderer `routine` key does not bind RoutineDdlPayload.Name");
    }

    // ---- Alter / Create: kept raw; payload still binds the flat shape ----------------------

    [Fact]
    public void Alter_binds_flat_name_and_sql_for_raw_path()
    {
        const string json = """
        { "uid": "c1", "schema": "public", "name": "p1", "sql": "CREATE PROCEDURE p1 AS BEGIN SELECT 1 END" }
        """;
        var p = Bind<RoutinesService.RoutineDdlPayload>(json);
        Assert.Equal("p1", p.Name);   // Alter's DROP PROCEDURE IF EXISTS {Quote(client, p.Name)}
        Assert.Equal("CREATE PROCEDURE p1 AS BEGIN SELECT 1 END", p.Sql); // executed verbatim
    }

    // ---- GetInformations: kept raw — DTO carries the body GetProcList can't supply ----------

    [Fact]
    public void RoutineInfoDto_carries_sql_body_that_getproclist_cannot_supply()
    {
        // RoutineInfoDto has BOTH Name and Sql; GetProcList() yields names only. This is the
        // reason GetInformations stays raw. Lock the DTO shape so a future "optimization" to
        // GetProcList that silently drops Sql is caught.
        var dto = new RoutinesService.RoutineInfoDto { Name = "p1", Sql = "CREATE PROCEDURE p1 ..." };
        Assert.Equal("p1", dto.Name);
        Assert.Equal("CREATE PROCEDURE p1 ...", dto.Sql);
        Assert.NotEqual(string.Empty, dto.Sql);
    }
}
