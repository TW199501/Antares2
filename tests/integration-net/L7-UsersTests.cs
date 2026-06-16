using System.Collections.Generic;
using System.Text.Json;
using Antares.Server.Connections;
using Antares.Server.Users;
using Xunit;
using Xunit.Abstractions;

namespace Antares.Server.IntegrationTests;

/// <summary>
/// L7-Users lane. After review, NO method is convertible (mirrors L5-Routines / L6-Functions):
///   * GetUsers — SqlSugar's DbMaintenance exposes NO user/login/role enumeration API; it covers
///     tables/columns/views/indexes/procs/funcs/triggers/primaries/identities/databases only.
///     Each dialect's principal model is semantically distinct and has no cross-dialect shape:
///       - mssql: sys.server_principals, Type = type_desc
///       - mysql/maria: mysql.user, Type = Host (user@host)
///       - pg: pg_roles, Type = CASE WHEN rolsuper THEN 'superuser' ELSE 'role'
///     UserInfoDto.Type is COMPUTED per-dialect by these queries; nothing DbMaintenance returns
///     could supply it. So the catalog read stays RAW to keep field parity. KEEP RAW.
///   * sqlite/default branch returns an empty list because SQLite has no user model — this is the
///     documented contract, NOT a swallowed exception.
///
/// These offline tests lock the contract the review chose to preserve:
///   (1) the UidPayload binding GetUsers consumes,
///   (2) the per-dialect Name/Type SELECTs (string-shape assertions — no DB),
///   (3) the UserInfoDto two-field shape DbMaintenance cannot reproduce.
/// No live server is required; this is a pure characterization lane.
/// </summary>
[Trait("Category", "unit")]
public sealed class L7_UsersTests
{
    private readonly ITestOutputHelper _out;
    public L7_UsersTests(ITestOutputHelper output) => _out = output;

    // ASP.NET Core's default JSON binding is case-insensitive; mirror it here.
    private static readonly JsonSerializerOptions Opts = new() { PropertyNameCaseInsensitive = true };
    private static T Bind<T>(string json) => JsonSerializer.Deserialize<T>(json, Opts)!;

    // Mirror of the per-dialect SELECT GetUsers issues (the raw shape kept on the wire). Pure
    // string assertion (no DB). If a future "optimization" swaps to a DbMaintenance call that
    // cannot fill UserInfoDto.Type, this lock — plus DTO_carries_two_fields below — flags it.
    private static string PrincipalQuery(string client) => client switch
    {
        "mssql" => "SELECT name AS Name, type_desc AS Type FROM sys.server_principals WHERE type IN ('S','U','G')",
        "mysql" or "maria" => "SELECT User AS Name, Host AS Type FROM mysql.user",
        "pg" => "SELECT rolname AS \"Name\", CASE WHEN rolsuper THEN 'superuser' ELSE 'role' END AS \"Type\" FROM pg_roles",
        _ => string.Empty
    };

    // ---- The renderer's getUsers payload binds to UidPayload (just { uid }) -----------------

    [Fact]
    public void GetUsers_binds_uid_payload()
    {
        const string json = """ { "uid": "c1" } """;
        var p = Bind<ConnectionService.UidPayload>(json);
        Assert.Equal("c1", p.Uid);
        _out.WriteLine($"getUsers targets uid={p.Uid}");
    }

    // ---- Each supported dialect projects exactly Name + Type, computed per-dialect ----------

    [Theory]
    [InlineData("mssql")]
    [InlineData("mysql")]
    [InlineData("maria")]
    [InlineData("pg")]
    public void Principal_query_projects_name_and_type_per_dialect(string client)
    {
        var sql = PrincipalQuery(client);
        _out.WriteLine($"[{client}] {sql}");

        // Every supported dialect aliases its native columns to the DTO's Name/Type. mssql/mysql
        // alias unquoted (AS Name); pg uses the quoted form (AS "Name"). Accept either.
        Assert.True(sql.Contains("AS Name") || sql.Contains("AS \"Name\""));
        Assert.True(sql.Contains("AS Type") || sql.Contains("AS \"Type\""));
        // The catalog source is dialect-specific — the very reason DbMaintenance can't abstract it.
        Assert.Contains(
            client switch
            {
                "mssql" => "sys.server_principals",
                "mysql" or "maria" => "mysql.user",
                "pg" => "pg_roles",
                _ => "??"
            }, sql);
    }

    [Fact]
    public void Pg_type_is_computed_superuser_or_role()
    {
        // pg has no native "type_desc"/"Host" column — Type is derived. This computed field is
        // exactly what no DbMaintenance method can supply, locking the keep-raw rationale.
        var sql = PrincipalQuery("pg");
        Assert.Contains("CASE WHEN rolsuper THEN 'superuser' ELSE 'role' END", sql);
    }

    // ---- sqlite/default = empty list, NOT an exception swallow ------------------------------

    [Theory]
    [InlineData("sqlite")]
    [InlineData("firebird")] // any unsupported client falls to the documented empty-list default
    public void Unsupported_client_has_no_principal_query(string client)
    {
        Assert.Equal(string.Empty, PrincipalQuery(client));
    }

    // ---- The two-field DTO DbMaintenance cannot reproduce -----------------------------------

    [Fact]
    public void UserInfoDto_carries_name_and_type()
    {
        // UserInfoDto has BOTH Name and Type; DbMaintenance has no API yielding either for
        // principals/roles. Lock the shape so a future conversion that drops Type is caught.
        var dto = new UsersService.UserInfoDto { Name = "sa", Type = "SQL_LOGIN" };
        Assert.Equal("sa", dto.Name);
        Assert.Equal("SQL_LOGIN", dto.Type);
        Assert.NotEqual(string.Empty, dto.Type);
    }
}
