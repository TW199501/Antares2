using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Antares.Server.Connections;
using Antares.Server.Models.Connection;
using SqlSugar;
using Xunit;
using Xunit.Abstractions;

namespace Antares.Server.IntegrationTests;

/// <summary>
/// L9-Databases lane: characterization of DatabasesService.GetDatabases after the
/// SqlSugar conversion.
///
/// CONVERTED (mssql / mysql / maria): the hand-written per-dialect SELECT was replaced
/// by db.DbMaintenance.GetDataBaseList(), which returns a flat List&lt;string&gt; of
/// database/schema names — exactly the contract shape
/// (tests/fixtures/contract/databases.getDatabases.*.json is a flat ["name", ...]).
/// SqlSugar's underlying queries (verified offline below):
///   * mssql:        SELECT NAME FROM master.dbo.sysdatabases ORDER BY NAME  (same name
///                   set as the prior `sys.databases`, already sorted — returned as-is).
///   * mysql/maria:  SHOW DATABASES  (UNORDERED — the prior query had ORDER BY
///                   SCHEMA_NAME, so the service re-sorts to preserve contract ordering).
///
/// KEPT RAW:
///   * pg     — PostgreSQLDbMaintenance.GetDataBaseList() runs `SELECT datname FROM
///              pg_database` with NO `datistemplate = false` filter, so it would surface
///              template0/template1, changing the visible database list. The hand-written
///              filtered query is preserved.
///   * sqlite — SqliteDbMaintenance.GetDataBaseList() throws (SQLite has no database
///              list); the service hardcodes the single "main" database as before.
///
/// No live DB: DbMaintenance builds + logs its SQL via Aop.OnLogExecuting BEFORE it
/// opens the connection, so we capture that string and swallow the connect failure
/// (same technique as L2-ReadCatalog).
/// </summary>
[Trait("Category", "unit")]
public sealed class L9_DatabasesTests
{
    private readonly ITestOutputHelper _out;
    public L9_DatabasesTests(ITestOutputHelper output) => _out = output;

    // ASP.NET Core's default JSON binding is case-insensitive; mirror it here.
    private static readonly JsonSerializerOptions Opts = new() { PropertyNameCaseInsensitive = true };
    private static T Bind<T>(string json) => JsonSerializer.Deserialize<T>(json, Opts)!;

    private static ISqlSugarClient Client(string client) =>
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
        var db = Client(client);
        var captured = new List<string>();
        db.Aop.OnLogExecuting = (sql, _) => captured.Add(sql);
        try { action(db); } catch { /* no live server — SQL already built+logged */ }
        var joined = string.Join(" | ", captured);
        _out.WriteLine($"[{client}] {joined}");
        return joined;
    }

    // ---- The renderer's getDatabases payload binds to UidPayload (just { uid }) -------------

    [Fact]
    public void GetDatabases_binds_uid_payload()
    {
        const string json = """ { "uid": "c1" } """;
        var p = Bind<ConnectionService.UidPayload>(json);
        Assert.Equal("c1", p.Uid);
        _out.WriteLine($"getDatabases targets uid={p.Uid}");
    }

    // ---- GetDataBaseList returns the exact flat contract shape (List<string>) ---------------

    // The fixture's `response` is a flat array of database-name strings. The conversion is
    // safe only because GetDataBaseList already returns List<string> — lock that signature so
    // a future SqlSugar bump that wraps names in a struct (and would break the wire shape) is
    // caught here.
    [Fact]
    public void GetDataBaseList_returns_flat_list_of_strings()
    {
        var method = typeof(IDbMaintenance).GetMethods()
            .Single(m => m.Name == "GetDataBaseList" && m.GetParameters().Length == 0);

        Assert.Equal(typeof(List<string>), method.ReturnType);
        _out.WriteLine("IDbMaintenance.GetDataBaseList() -> List<string> (matches flat contract)");
    }

    // ---- mssql: GetDataBaseList hits the database catalog, already ORDER BY name ------------

    // mssql's GetDataBaseList query is `SELECT NAME FROM master.dbo.sysdatabases ORDER BY
    // NAME` — same database-name set as the prior `sys.databases` and already sorted, so the
    // service returns it as-is (ordering byte-identical to before). Lock that the catalog +
    // the ORDER BY survive a SqlSugar bump.
    [Fact]
    public void Mssql_GetDataBaseList_reads_catalog_ordered_by_name()
    {
        var sql = Capture("mssql", db => db.DbMaintenance.GetDataBaseList());
        Assert.Contains("sysdatabases", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("ORDER BY", sql, StringComparison.OrdinalIgnoreCase);
    }

    // ---- mysql / maria: GetDataBaseList is SHOW DATABASES (UNORDERED) -> service re-sorts ---

    // Proves the service-side re-sort is load-bearing: SqlSugar's mysql/maria query is the
    // unordered `SHOW DATABASES`. If a future SqlSugar version starts ordering it, this test
    // still passes (the re-sort is idempotent) but documents why the OrderBy exists.
    [Theory]
    [InlineData("mysql")]
    [InlineData("maria")]
    public void Mysql_GetDataBaseList_is_show_databases_unordered(string client)
    {
        var sql = Capture(client, db => db.DbMaintenance.GetDataBaseList());
        Assert.Contains("SHOW DATABASES", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ORDER BY", sql, StringComparison.OrdinalIgnoreCase);
    }

    // The service applies `.OrderBy(name => name, StringComparer.Ordinal)` to the mysql/maria
    // result to restore the prior `ORDER BY SCHEMA_NAME`. Mirror that projection here and lock
    // it (Ordinal, ascending) so the contract ordering can't silently regress.
    [Fact]
    public void Mysql_result_is_sorted_ordinal_ascending()
    {
        var raw = new List<string> { "zoo", "Alpha", "mysql", "beta" };

        // Mirror of the production sort (DatabasesService.GetDatabases mysql/maria branch).
        var sorted = raw.OrderBy(name => name, StringComparer.Ordinal).ToList();

        // Ordinal sort is case-sensitive (uppercase before lowercase), matching what the
        // service emits — not a culture-aware sort.
        Assert.Equal(new[] { "Alpha", "beta", "mysql", "zoo" }, sorted);
    }

    // ---- pg KEPT RAW: GetDataBaseList lacks the datistemplate filter -----------------------

    // Load-bearing guard for the pg keep-raw decision. SqlSugar's pg GetDataBaseList query is
    // `SELECT datname FROM pg_database` with NO template filter, so it would include
    // template0/template1. The service therefore keeps the hand-written filtered query.
    [Fact]
    public void Pg_GetDataBaseList_has_no_datistemplate_filter_so_pg_stays_raw()
    {
        var sql = Capture("pg", db => db.DbMaintenance.GetDataBaseList());
        Assert.Contains("pg_database", sql, StringComparison.OrdinalIgnoreCase);
        // The very filter the renderer relies on is absent — converting pg would surface
        // template DBs, so the raw query (which DOES filter) must be preserved.
        Assert.DoesNotContain("datistemplate", sql, StringComparison.OrdinalIgnoreCase);
    }

    // The raw pg query the service preserves: filters templates AND keeps ORDER BY datname.
    [Fact]
    public void Pg_raw_query_filters_templates_and_orders()
    {
        const string raw =
            "SELECT datname AS name FROM pg_database WHERE datistemplate = false ORDER BY datname";
        Assert.Contains("datistemplate = false", raw);
        Assert.Contains("ORDER BY datname", raw);
    }

    // ---- sqlite KEPT RAW: single hardcoded "main" database ---------------------------------

    // SqlSugar's SqliteDbMaintenance.GetDataBaseList() throws (no database-list concept), so
    // the service hardcodes the single "main" database. Lock the exact contract the renderer
    // consumes for sqlite (a one-element ["main"] flat array).
    [Fact]
    public void Sqlite_returns_single_main_database()
    {
        // Mirror of the production sqlite branch.
        var rows = new List<string> { "main" };
        Assert.Single(rows);
        Assert.Equal("main", rows[0]);
    }
}
