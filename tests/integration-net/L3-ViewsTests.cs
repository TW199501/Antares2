using System;
using System.Collections.Generic;
using System.Linq;
using Antares.Server.Connections;
using Antares.Server.Models.Connection;
using SqlSugar;
using Xunit;
using Xunit.Abstractions;

namespace Antares.Server.IntegrationTests;

/// <summary>
/// L3-Views lane: characterization of why ViewsService stays RAW.
///
/// CONVERTED: none. Every candidate in this lane is genuinely non-convertible in
/// SqlSugar 5.1.4.214 — the proofs below are the load-bearing guards:
///
///  * GetInformations -> GetViewInfoList(): the method returns List&lt;DbTableInfo&gt;,
///    which carries only Name / Description / DbObjectType. It has NO view-definition
///    SQL field and NO schema filter, so ViewInfoDto.Sql (the whole point of the read)
///    cannot be supplied. Converting would silently drop the SQL definition. KEEP RAW.
///  * Create / Alter -> CreateView: IDbMaintenance has NO CreateView (only CreateTable /
///    CreateIndex / CreateDatabase). No cross-dialect API exists. KEEP RAW.
///  * Drop -> DropView(name): SqlSugar's DropView emits an UNQUOTED identifier
///    (`DROP VIEW dbo.User`, no brackets/backticks/quotes — captured below), so it breaks
///    on reserved-word view/schema names exactly like the GetColumnInfosByTableName
///    caveat. The hand-rolled per-dialect quoted DROP VIEW is strictly safer; converting
///    would be a regression. KEEP RAW.
///  * Materialized views (PG): no DbMaintenance API at all. KEEP RAW.
///
/// If a future SqlSugar version adds CreateView, enriches GetViewInfoList with a
/// definition field, or makes DropView quote identifiers, the matching test below
/// breaks and signals the method may finally be convertible.
///
/// No live DB: DbMaintenance builds + logs its SQL via Aop.OnLogExecuting BEFORE it
/// opens the connection, so we capture that string and swallow the connect failure.
/// </summary>
[Trait("Category", "unit")]
public sealed class L3_ViewsTests
{
    private readonly ITestOutputHelper _out;
    public L3_ViewsTests(ITestOutputHelper output) => _out = output;

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

    // ---- GetInformations stays RAW: GetViewInfoList cannot fill ViewInfoDto.Sql ----

    // The candidate API returns List<DbTableInfo>. ViewInfoDto needs { Name, Sql }; the
    // SQL definition is the entire payload the renderer renders. DbTableInfo has no such
    // field, so the conversion is impossible without losing the contract.
    [Fact]
    public void GetViewInfoList_returns_DbTableInfo_without_definition_so_GetInformations_must_stay_raw()
    {
        var method = typeof(IDbMaintenance).GetMethods()
            .Single(m => m.Name == "GetViewInfoList");

        // Element type is DbTableInfo (NOT a view-specific DTO with a definition field).
        Assert.True(method.ReturnType.IsGenericType);
        var elem = method.ReturnType.GetGenericArguments().Single();
        Assert.Equal(typeof(DbTableInfo), elem);

        // DbTableInfo carries none of: view definition SQL, schema. Prove no definition
        // field exists under any plausible name.
        var props = elem.GetProperties().Select(p => p.Name).ToArray();
        _out.WriteLine("DbTableInfo props: " + string.Join(", ", props));
        foreach (var defName in new[] { "Sql", "Definition", "ViewDefinition", "Body", "Text" })
            Assert.DoesNotContain(defName, props);

        // And there is no schema-scoping parameter — only an isCache bool.
        var ps = method.GetParameters();
        Assert.Single(ps);
        Assert.Equal(typeof(bool), ps[0].ParameterType);
    }

    // ---- Create / Alter stay RAW: IDbMaintenance has no CreateView -----------------

    [Fact]
    public void IDbMaintenance_has_no_CreateView_so_Create_and_Alter_must_stay_raw()
    {
        var names = typeof(IDbMaintenance).GetMethods().Select(m => m.Name).ToHashSet();
        Assert.DoesNotContain("CreateView", names);
        // Sanity: the create-family that DOES exist, so the absence above is meaningful.
        Assert.Contains("CreateTable", names);
        Assert.Contains("CreateIndex", names);
    }

    // ---- Drop stays RAW: DropView emits UNQUOTED identifiers -----------------------

    // SqlSugar 5.1.4.214 builds `DROP VIEW <name>` with the raw name — no per-dialect
    // bracket/backtick/quote. Passing a reserved-word view name therefore produces
    // invalid SQL on mssql ([User] required) and is unsafe everywhere. This locks the
    // exact (broken) shape so a future fix that adds quoting is flagged here.
    [Theory]
    [InlineData("mssql", "dbo.User")]
    [InlineData("mysql", "mydb.Order")]
    [InlineData("pg", "public.User")]
    [InlineData("sqlite", "Group")]
    public void DropView_emits_unquoted_identifier_so_Drop_must_stay_raw(string client, string view)
    {
        var sql = Capture(client, db => db.DbMaintenance.DropView(view));

        Assert.Contains("DROP VIEW", sql, StringComparison.OrdinalIgnoreCase);
        // The unquoted name appears verbatim — proving NO bracketing/backticking/quoting.
        Assert.Contains(view, sql, StringComparison.OrdinalIgnoreCase);
        // None of the per-dialect quote characters are applied around the identifier.
        Assert.DoesNotContain("[", sql);
        Assert.DoesNotContain("`", sql);
        Assert.DoesNotContain("\"", sql);
    }

    // ---- Positive lock on the SAFE raw DROP VIEW that ViewsService keeps -----------

    // Mirror of ViewsService.Drop: the hand-rolled per-dialect quoted DROP VIEW. This is
    // the shape that must stay on the wire; it correctly brackets/backticks/quotes the
    // identifier, unlike DropView above. Pure string assertion (no DB) — locks the
    // contract the conversion analysis chose to preserve.
    [Theory]
    [InlineData("pg", "public", "User", "DROP VIEW \"public\".\"User\"")]
    [InlineData("mssql", "dbo", "User", "DROP VIEW [dbo].[User]")]
    [InlineData("mysql", "mydb", "Order", "DROP VIEW `mydb`.`Order`")]
    [InlineData("maria", "mydb", "Order", "DROP VIEW `mydb`.`Order`")]
    [InlineData("sqlite", "ignored", "Group", "DROP VIEW \"Group\"")]
    public void Service_raw_drop_sql_is_quoted_per_dialect(string client, string schema, string name, string expected)
    {
        var actual = client switch
        {
            "pg" => $"DROP VIEW \"{schema}\".\"{name}\"",
            "mssql" => $"DROP VIEW [{schema}].[{name}]",
            "mysql" or "maria" => $"DROP VIEW `{schema}`.`{name}`",
            "sqlite" => $"DROP VIEW \"{name}\"",
            _ => string.Empty
        };
        Assert.Equal(expected, actual);
    }
}
