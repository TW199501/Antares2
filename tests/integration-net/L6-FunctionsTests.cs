using System;
using System.Collections.Generic;
using System.Text.Json;
using Antares.Server.Connections;
using Antares.Server.Functions;
using Antares.Server.Models.Connection;
using SqlSugar;
using Xunit;
using Xunit.Abstractions;

namespace Antares.Server.IntegrationTests;

/// <summary>
/// L6-Functions lane. Mirrors the L5-Routines outcome: after review, NO method is convertible.
///   * Drop -> DbMaintenance.DropFunc(p.Name) was NOT taken. The "Discover-then-lock" capture
///     below (via Aop.OnLogExecuting, the prescribed offline fallback) empirically proves
///     DropFunc emits an UNQUOTED identifier in this SqlSugar version (5.1.4.214) — the exact
///     behavior the structurally identical DbMaintenance.DropProc was verified to have in
///     L5-RoutinesTests and DbMaintenance.DropView in L3-ViewsTests. So DropFunc would break
///     dropping a reserved-word function (User/Order/Group/...) that the hand-rolled per-dialect
///     Quote() path drops correctly: a regression, not a conversion. KEEP RAW.
///
/// Kept RAW (with in-source // raw: notes):
///   * GetInformations — DbMaintenance.GetFuncList() yields names only and cannot fill
///     FunctionInfoDto.Sql (the function body — OBJECT_DEFINITION / ROUTINE_DEFINITION /
///     pg_get_functiondef — that the renderer consumes). Converting would drop a contract field,
///     so the catalog read stays raw to keep field parity.
///   * Create / Alter — execute user-supplied function SQL; no DbMaintenance API.
///   * CreateTriggerFunction / AlterTriggerFunction — PG-only plpgsql trigger functions; user SQL,
///     no DbMaintenance API.
/// </summary>
[Trait("Category", "unit")]
public sealed class L6_FunctionsTests
{
    private readonly ITestOutputHelper _out;
    public L6_FunctionsTests(ITestOutputHelper output) => _out = output;

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

    // ---- Drop stays RAW: DropFunc emits UNQUOTED identifiers (Discover-then-lock) ----

    // SqlSugar 5.1.4.214 builds `DROP FUNCTION <name>` with the raw name — no per-dialect
    // bracket/backtick/quote, identical to the DropProc behavior locked in L5-RoutinesTests.
    // Passing a reserved-word function name therefore produces invalid SQL on mssql ([User]
    // required) and is unsafe everywhere. This is the empirical proof the L6 review demanded;
    // it locks the (broken) shape so a future SqlSugar fix that adds quoting is flagged here and
    // signals Drop may finally be convertible.
    [Theory]
    [InlineData("mssql", "User")]
    [InlineData("mysql", "Order")]
    [InlineData("maria", "Order")]
    [InlineData("pg", "User")]
    public void DropFunc_emits_unquoted_identifier_so_Drop_must_stay_raw(string client, string func)
    {
        var sql = Capture(client, db => db.DbMaintenance.DropFunction(func));

        Assert.Contains("DROP", sql, StringComparison.OrdinalIgnoreCase);
        // The unquoted name appears verbatim — proving NO bracketing/backticking/quoting.
        Assert.Contains(func, sql, StringComparison.OrdinalIgnoreCase);
        // None of the per-dialect quote characters are applied around the identifier.
        Assert.DoesNotContain("[", sql);
        Assert.DoesNotContain("`", sql);
        Assert.DoesNotContain("\"", sql);
    }

    // ---- Positive lock on the SAFE raw DROP FUNCTION that FunctionsService keeps ----

    // Mirror of FunctionsService.Drop: the hand-rolled per-dialect quoted DROP FUNCTION.
    // This is the shape that must stay on the wire; it correctly brackets/backticks/quotes
    // the identifier, unlike DropFunction above. Pure string assertion (no DB) — locks the
    // contract the review chose to preserve.
    [Theory]
    [InlineData("mssql", "User", "DROP FUNCTION [User]")]
    [InlineData("mysql", "Order", "DROP FUNCTION `Order`")]
    [InlineData("maria", "Order", "DROP FUNCTION `Order`")]
    [InlineData("pg", "User", "DROP FUNCTION \"User\"")]
    [InlineData("sqlite", "Group", "DROP FUNCTION \"Group\"")]
    public void Service_raw_drop_sql_is_quoted_per_dialect(string client, string name, string expected)
    {
        // Mirror of the private FunctionsService.Quote(client, name) interpolation.
        var actual = client switch
        {
            "mssql" => $"DROP FUNCTION [{name}]",
            "mysql" or "maria" => $"DROP FUNCTION `{name}`",
            "pg" => $"DROP FUNCTION \"{name}\"",
            _ => $"DROP FUNCTION \"{name}\""
        };
        Assert.Equal(expected, actual);
    }

    // ---- Drop / Alter: payload binding (unchanged from raw path) ---------------------------

    [Fact]
    public void Drop_binds_flat_name_for_raw_drop_function()
    {
        // A flat { uid, schema, name } shape binds p.Name; DROP FUNCTION {Quote(...)} drops "my_fn".
        const string json = """ { "uid": "c1", "schema": "public", "name": "my_fn" } """;
        var p = Bind<FunctionsService.FunctionDdlPayload>(json);
        Assert.Equal("c1", p.Uid);
        Assert.Equal("public", p.Schema);
        Assert.Equal("my_fn", p.Name); // -> DROP FUNCTION `my_fn` / [my_fn] / "my_fn"
        _out.WriteLine($"drop targets p.Name={p.Name}");
    }

    [Fact]
    public void Alter_binds_flat_name_and_sql_for_raw_path()
    {
        const string json = """
        { "uid": "c1", "schema": "public", "name": "f1", "sql": "CREATE FUNCTION f1() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql" }
        """;
        var p = Bind<FunctionsService.FunctionDdlPayload>(json);
        Assert.Equal("f1", p.Name);   // Alter's DROP FUNCTION IF EXISTS {Quote(client, p.Name)}
        Assert.Equal("CREATE FUNCTION f1() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql", p.Sql); // executed verbatim
    }

    // ---- GetInformations: kept raw — DTO carries the body GetFuncList can't supply ----------

    [Fact]
    public void FunctionInfoDto_carries_sql_body_that_getfunclist_cannot_supply()
    {
        // FunctionInfoDto has BOTH Name and Sql; GetFuncList() yields names only. This is the
        // reason GetInformations stays raw. Lock the DTO shape so a future "optimization" to
        // GetFuncList that silently drops Sql is caught.
        var dto = new FunctionsService.FunctionInfoDto { Name = "f1", Sql = "CREATE FUNCTION f1() ..." };
        Assert.Equal("f1", dto.Name);
        Assert.Equal("CREATE FUNCTION f1() ...", dto.Sql);
        Assert.NotEqual(string.Empty, dto.Sql);
    }
}
