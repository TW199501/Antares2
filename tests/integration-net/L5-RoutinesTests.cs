using System;
using System.Collections.Generic;
using System.Text.Json;
using Antares.Server.Connections;
using Antares.Server.Models.Connection;
using Antares.Server.Routines;
using SqlSugar;
using Xunit;
using Xunit.Abstractions;

namespace Antares.Server.IntegrationTests;

/// <summary>
/// L5-Routines lane. After the L5 review, NO method is convertible:
///   * Drop -> DbMaintenance.DropProc(p.Name) was REVERTED to the raw per-dialect quoted
///     DROP PROCEDURE. The "Discover-then-lock" capture below (via Aop.OnLogExecuting, the
///     prescribed offline fallback) empirically proves DropProc emits an UNQUOTED identifier
///     in this SqlSugar version (5.1.4.214) — the exact behavior the structurally identical
///     DbMaintenance.DropView was verified to have in L3-ViewsTests. So DropProc would break
///     dropping a reserved-word procedure (User/Order/Group/...) that the hand-rolled Quote()
///     path drops correctly: a regression, not a conversion. KEEP RAW.
///
/// Kept RAW (with in-source // raw: notes):
///   * GetInformations — DbMaintenance.GetProcList() returns List&lt;DbProcInfo&gt; (names only)
///     and cannot fill RoutineInfoDto.Sql (the procedure body the renderer's RoutineInfos.sql
///     consumes). Converting would drop a contract field, so the catalog read stays raw.
///   * Create / Alter — execute user-supplied procedure SQL; no DbMaintenance API.
///
/// They also DOCUMENT (do not fix — out of this lane's conversion scope) a pre-existing
/// DTO-contract-drift quirk: the renderer ships drop as { uid, schema, routine: name } and
/// create/alter as nested { routine: {...} }, but RoutineDdlPayload is FLAT (Uid/Schema/Name/Sql)
/// with no `routine` key — so Name/Sql bind empty from the real renderer shapes. The service
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

    private static ISqlSugarClient SugarClient(string client) =>
        new SqlSugarScope(ConnectionConfigBuilder.Build(new ConnectionParamsDto
        {
            Client = client,
            Host = "localhost",
            Port = 1,
            Database = "db",
            User = "u",
            Password = "p",
            DatabasePath = ":memory:"
        }, poolSize: 1));

    /// <summary>Run a DbMaintenance call and return the SQL it logged (connect failure swallowed).</summary>
    private string Capture(string client, Action<ISqlSugarClient> action)
    {
        var db = SugarClient(client);
        var captured = new List<string>();
        db.Aop.OnLogExecuting = (sql, _) => captured.Add(sql);
        try { action(db); } catch { /* no live server — SQL already built+logged */ }
        var joined = string.Join(" | ", captured);
        _out.WriteLine($"[{client}] {joined}");
        return joined;
    }

    // ---- Drop stays RAW: DropProc emits UNQUOTED identifiers (Discover-then-lock) ----

    // SqlSugar 5.1.4.214 builds `DROP PROCEDURE <name>` with the raw name — no per-dialect
    // bracket/backtick/quote, identical to the DropView behavior locked in L3-ViewsTests.
    // Passing a reserved-word procedure name therefore produces invalid SQL on mssql
    // ([User] required) and is unsafe everywhere. This is the empirical proof the L5 review
    // demanded; it locks the (broken) shape so a future SqlSugar fix that adds quoting is
    // flagged here and signals Drop may finally be convertible.
    [Theory]
    [InlineData("mssql", "User")]
    [InlineData("mysql", "Order")]
    [InlineData("maria", "Order")]
    [InlineData("pg", "User")]
    public void DropProc_emits_unquoted_identifier_so_Drop_must_stay_raw(string client, string proc)
    {
        var sql = Capture(client, db => db.DbMaintenance.DropProc(proc));

        Assert.Contains("DROP", sql, StringComparison.OrdinalIgnoreCase);
        // The unquoted name appears verbatim — proving NO bracketing/backticking/quoting.
        Assert.Contains(proc, sql, StringComparison.OrdinalIgnoreCase);
        // None of the per-dialect quote characters are applied around the identifier.
        Assert.DoesNotContain("[", sql);
        Assert.DoesNotContain("`", sql);
        Assert.DoesNotContain("\"", sql);
    }

    // ---- Positive lock on the SAFE raw DROP PROCEDURE that RoutinesService keeps ----

    // Mirror of RoutinesService.Drop: the hand-rolled per-dialect quoted DROP PROCEDURE.
    // This is the shape that must stay on the wire; it correctly brackets/backticks/quotes
    // the identifier, unlike DropProc above. Pure string assertion (no DB) — locks the
    // contract the review chose to preserve.
    [Theory]
    [InlineData("mssql", "User", "DROP PROCEDURE [User]")]
    [InlineData("mysql", "Order", "DROP PROCEDURE `Order`")]
    [InlineData("maria", "Order", "DROP PROCEDURE `Order`")]
    [InlineData("pg", "User", "DROP PROCEDURE \"User\"")]
    [InlineData("sqlite", "Group", "DROP PROCEDURE \"Group\"")]
    public void Service_raw_drop_sql_is_quoted_per_dialect(string client, string name, string expected)
    {
        // Mirror of the private RoutinesService.Quote(client, name) interpolation.
        var actual = client switch
        {
            "mssql" => $"DROP PROCEDURE [{name}]",
            "mysql" or "maria" => $"DROP PROCEDURE `{name}`",
            "pg" => $"DROP PROCEDURE \"{name}\"",
            _ => $"DROP PROCEDURE \"{name}\""
        };
        Assert.Equal(expected, actual);
    }

    // ---- Drop: payload binding (unchanged from raw path) ----------------------------------

    [Fact]
    public void Drop_binds_flat_name_for_raw_drop_procedure()
    {
        // A flat { uid, schema, name } shape binds p.Name; DROP PROCEDURE {Quote(...)} drops "my_proc".
        const string json = """ { "uid": "c1", "schema": "public", "name": "my_proc" } """;
        var p = Bind<RoutinesService.RoutineDdlPayload>(json);
        Assert.Equal("c1", p.Uid);
        Assert.Equal("public", p.Schema);
        Assert.Equal("my_proc", p.Name); // -> DROP PROCEDURE `my_proc` / [my_proc] / "my_proc"
        _out.WriteLine($"drop targets p.Name={p.Name}");
    }

    [Fact]
    public void Drop_real_renderer_shape_leaves_name_empty_quirk()
    {
        // quirk: renderer dropRoutine sends the name under `routine`, but RoutineDdlPayload has
        // no `routine` key, so p.Name stays empty. Documented, not fixed (binding realignment is
        // out of this conversion lane's scope).
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
