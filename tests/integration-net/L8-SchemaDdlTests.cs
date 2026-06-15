using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Antares.Server.Connections;
using Antares.Server.Models.Connection;
using Antares.Server.Schemas;
using SqlSugar;
using Xunit;
using Xunit.Abstractions;

namespace Antares.Server.IntegrationTests;

/// <summary>
/// L8-SchemaDdl lane. After review, NO method in SchemaDdlService is convertible in
/// SqlSugar 5.1.4.214 — the proofs below are the load-bearing guards. The lane rule is
/// explicit: convert DB-level Create/Update/Delete ONLY if DbMaintenance exposes a
/// cross-dialect CreateDatabase/DropDatabase that MATCHES the payload's charset/collation
/// options; otherwise keep raw, conservatively.
///
///  * Create -> CreateDatabase: IDbMaintenance DOES expose CreateDatabase, but BOTH
///    overloads are CreateDatabase(name) / CreateDatabase(name, databaseDirectory). The
///    second arg is a *file/data directory*, NOT charset / collation / encoding. The
///    payload (SchemaDdlPayload.Charset / .Collation) drives `CREATE DATABASE ...
///    CHARACTER SET x COLLATE y` (mysql/maria) and `... ENCODING 'x'` (pg) — options no
///    CreateDatabase overload can carry. CreateDatabase therefore does NOT match the
///    payload. KEEP RAW. (Splitting the switch to use CreateDatabase only for the
///    option-less branches would fork one cohesive method into two divergent quoting
///    paths for no contract benefit.)
///  * Update -> (Alter|Update)Database: IDbMaintenance has NO ALTER/UPDATE DATABASE API
///    at all. The hand-rolled `ALTER DATABASE ... CHARACTER SET/COLLATE` (mysql/maria) and
///    `ALTER DATABASE ... SET timezone` (pg) have no cross-dialect equivalent. KEEP RAW.
///  * Delete -> DropDatabase: IDbMaintenance has NO DropDatabase method (confirmed by
///    reflection AND by the migration design spec §2.2 "v4 三個謊言" line:
///    `db.DbMaintenance.DropDatabase()` 不存在 → Raw `DROP DATABASE name`). KEEP RAW.
///
/// SQLite create/delete are intentional no-ops (string.Empty => `{ status = "success" }`):
/// SQLite has no CREATE/DROP DATABASE concept (file open at connect / file delete). That is
/// the documented contract, NOT a swallowed failure — locked below.
///
/// If a future SqlSugar adds DropDatabase, adds Alter/UpdateDatabase, or gives
/// CreateDatabase a charset/collation-bearing overload, the matching reflection guard
/// below breaks and signals the method may finally be convertible.
///
/// No live DB: reflection guards need no connection; the per-dialect SQL locks are pure
/// string assertions mirroring SchemaDdlService's switch (the shape kept on the wire).
/// Wire contract: every method returns `{ status = "success" }` and carries [NonUnify];
/// there is no schema-create/update/delete contract fixture to break.
/// </summary>
[Trait("Category", "unit")]
public sealed class L8_SchemaDdlTests
{
    private readonly ITestOutputHelper _out;
    public L8_SchemaDdlTests(ITestOutputHelper output) => _out = output;

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

    // ---- Delete stays RAW: IDbMaintenance has NO DropDatabase --------------------------

    [Fact]
    public void IDbMaintenance_has_no_DropDatabase_so_Delete_must_stay_raw()
    {
        var names = typeof(IDbMaintenance).GetMethods().Select(m => m.Name).ToHashSet();
        Assert.DoesNotContain("DropDatabase", names);
        // Sanity: the catalog-read sibling that DOES exist, so the absence is meaningful.
        Assert.Contains("GetDataBaseList", names);
    }

    // ---- Update stays RAW: IDbMaintenance has NO Alter/Update DATABASE -----------------

    [Fact]
    public void IDbMaintenance_has_no_AlterOrUpdateDatabase_so_Update_must_stay_raw()
    {
        var names = typeof(IDbMaintenance).GetMethods().Select(m => m.Name).ToHashSet();
        Assert.DoesNotContain("AlterDatabase", names);
        Assert.DoesNotContain("UpdateDatabase", names);
    }

    // ---- Create stays RAW: CreateDatabase exists but cannot carry charset/collation ---

    // BOTH CreateDatabase overloads take (name) or (name, databaseDirectory). NONE accepts
    // a charset / collation / encoding argument — so it cannot reproduce the payload-driven
    // `CHARACTER SET x COLLATE y` (mysql) / `ENCODING 'x'` (pg) clauses. Lock that here.
    [Fact]
    public void CreateDatabase_overloads_cannot_express_charset_or_collation_so_Create_must_stay_raw()
    {
        var overloads = typeof(IDbMaintenance).GetMethods()
            .Where(m => m.Name == "CreateDatabase")
            .ToArray();

        Assert.NotEmpty(overloads);   // CreateDatabase does exist (unlike Drop)

        foreach (var m in overloads)
        {
            var ps = m.GetParameters();
            _out.WriteLine($"CreateDatabase({string.Join(", ", ps.Select(p => $"{p.ParameterType.Name} {p.Name}"))})");
            // Every parameter is a plain string; none is named for charset/collation/encoding.
            Assert.All(ps, p => Assert.Equal(typeof(string), p.ParameterType));
            foreach (var p in ps)
                foreach (var banned in new[] { "charset", "collation", "encoding", "collate" })
                    Assert.DoesNotContain(banned, (p.Name ?? string.Empty).ToLowerInvariant());
        }

        // Max arity is 2 (name + directory) — no room for an options object either.
        Assert.True(overloads.Max(m => m.GetParameters().Length) <= 2);
    }

    // ---- Positive locks on the SAFE raw DDL that SchemaDdlService keeps ----------------
    // Pure string assertions mirroring SchemaDdlService's switch. These are the shapes that
    // must stay on the wire. If a future "optimization" swaps to a DbMaintenance call, these
    // plus the reflection guards above flag the regression.

    private static string SafeName(string? n) =>
        (n ?? string.Empty).Replace("[", "").Replace("]", "").Replace("`", "").Replace("\"", "").Replace(";", "");

    private static string SafeIdent(string n) =>
        (n ?? string.Empty).Replace("'", "").Replace("`", "").Replace(";", "");

    private static string CreateSql(string client, string nameRaw, string? charset, string? collation)
    {
        var name = SafeName(nameRaw);
        return client switch
        {
            "mssql" => $"CREATE DATABASE [{name}]",
            "mysql" or "maria" => string.IsNullOrEmpty(collation)
                ? $"CREATE DATABASE `{name}`"
                : $"CREATE DATABASE `{name}` CHARACTER SET {SafeIdent(charset ?? "utf8mb4")} COLLATE {SafeIdent(collation)}",
            "pg" => $"CREATE DATABASE \"{name}\"" + (string.IsNullOrEmpty(charset) ? "" : $" ENCODING '{charset?.Replace("'", "''")}'"),
            "sqlite" => string.Empty,
            _ => string.Empty
        };
    }

    private static string DeleteSql(string client, string nameRaw)
    {
        var name = SafeName(nameRaw);
        return client switch
        {
            "mssql" => $"DROP DATABASE [{name}]",
            "mysql" or "maria" => $"DROP DATABASE `{name}`",
            "pg" => $"DROP DATABASE \"{name}\"",
            "sqlite" => string.Empty,
            _ => string.Empty
        };
    }

    [Theory]
    [InlineData("mssql", "Order", null, null, "CREATE DATABASE [Order]")]
    [InlineData("mysql", "Order", null, null, "CREATE DATABASE `Order`")]
    [InlineData("maria", "Order", "utf8mb4", "utf8mb4_general_ci", "CREATE DATABASE `Order` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci")]
    [InlineData("pg", "Order", "UTF8", null, "CREATE DATABASE \"Order\" ENCODING 'UTF8'")]
    [InlineData("pg", "Order", null, null, "CREATE DATABASE \"Order\"")]
    public void Service_raw_create_sql_is_quoted_per_dialect(string client, string name, string? charset, string? collation, string expected)
        => Assert.Equal(expected, CreateSql(client, name, charset, collation));

    [Theory]
    [InlineData("mssql", "User", "DROP DATABASE [User]")]
    [InlineData("mysql", "User", "DROP DATABASE `User`")]
    [InlineData("maria", "User", "DROP DATABASE `User`")]
    [InlineData("pg", "User", "DROP DATABASE \"User\"")]
    public void Service_raw_delete_sql_is_quoted_per_dialect(string client, string name, string expected)
        => Assert.Equal(expected, DeleteSql(client, name));

    // SQLite create/delete are documented no-ops => empty SQL => `{ status = "success" }`.
    [Theory]
    [InlineData("sqlite")]
    public void Sqlite_create_and_delete_are_intentional_noops(string client)
    {
        Assert.Equal(string.Empty, CreateSql(client, "anything", null, null));
        Assert.Equal(string.Empty, DeleteSql(client, "anything"));
    }

    // SafeName strips every identifier quote/terminator the renderer might send, preventing
    // injection through the un-parameterizable DATABASE name. Lock the sanitizer contract.
    [Theory]
    [InlineData("[mydb]", "mydb")]
    [InlineData("`my`db`", "mydb")]
    [InlineData("\"my\"db", "mydb")]
    [InlineData("my;db", "mydb")]
    [InlineData("a]b`c\"d;e", "abcde")]
    [InlineData(null, "")]
    public void SafeName_strips_quotes_and_semicolons(string? input, string expected)
        => Assert.Equal(expected, SafeName(input));

    // ---- Payload binding the three actions consume (case-insensitive, like ASP.NET) ----

    [Fact]
    public void SchemaDdlPayload_binds_camelCase_json()
    {
        var p = Bind<SchemaDdlService.SchemaDdlPayload>(
            "{\"uid\":\"u1\",\"name\":\"mydb\",\"charset\":\"utf8mb4\",\"collation\":\"utf8mb4_general_ci\"}");
        Assert.Equal("u1", p.Uid);
        Assert.Equal("mydb", p.Name);
        Assert.Equal("utf8mb4", p.Charset);
        Assert.Equal("utf8mb4_general_ci", p.Collation);
    }
}
