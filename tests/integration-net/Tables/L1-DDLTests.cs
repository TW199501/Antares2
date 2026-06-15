using System;
using System.Collections.Generic;
using Antares.Server.Connections;
using Antares.Server.Models.Connection;
using SqlSugar;
using Xunit;
using Xunit.Abstractions;

namespace Antares.Server.IntegrationTests.Tables;

/// <summary>
/// L1-DDL lane: characterization of the SqlSugar DbMaintenance SQL that
/// TablesWriteService.Drop / Truncate / ApplyDeletionsAsync now emit instead of
/// the old hand-rolled `entry.Db.Ado.ExecuteCommand(...)`.
///
/// No live DB: DbMaintenance builds the DDL string and fires Aop.OnLogExecuting
/// BEFORE it opens the connection, so we capture that string and swallow the
/// connect failure. This locks (a) the per-dialect quoting of the reserved word
/// "User" + schema-qualified names (Gate-1), and (b) that the generated SQL is
/// shape-equivalent to the SQL the methods produced before the conversion.
/// </summary>
[Trait("Category", "unit")]
public sealed class L1_DDLTests
{
    private readonly ITestOutputHelper _out;
    public L1_DDLTests(ITestOutputHelper output) => _out = output;

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

    /// <summary>Run a DbMaintenance action and return the SQL it logged (connect failure swallowed).</summary>
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

    // ---- Drop -> DbMaintenance.DropTable -----------------------------------

    [Theory]
    [InlineData("mssql", "DROP TABLE [User]")]
    [InlineData("mysql", "DROP TABLE `User`")]
    [InlineData("pg", "DROP TABLE \"user\"")]
    [InlineData("sqlite", "DROP TABLE `User`")]
    public void DropTable_quotes_reserved_table(string client, string expected)
    {
        var sql = Capture(client, db => db.DbMaintenance.DropTable("User"));
        Assert.Contains(expected, sql);
    }

    [Theory]
    [InlineData("mssql", "[dbo].[User]")]
    [InlineData("mysql", "`mydb`.`User`")]
    [InlineData("pg", "\"public\".\"user\"")]
    public void DropTable_qualifies_schema(string client, string expected)
    {
        var schema = client switch { "mssql" => "dbo", "mysql" => "mydb", _ => "public" };
        var sql = Capture(client, db => db.DbMaintenance.DropTable($"{schema}.User"));
        Assert.Contains(expected, sql);
    }

    // ---- Truncate -> DbMaintenance.TruncateTable ---------------------------

    [Theory]
    [InlineData("mssql", "TRUNCATE TABLE [User]")]
    [InlineData("mysql", "TRUNCATE TABLE `User`")]
    [InlineData("pg", "TRUNCATE TABLE \"user\"")]
    public void TruncateTable_emits_truncate_for_non_sqlite(string client, string expected)
    {
        var sql = Capture(client, db => db.DbMaintenance.TruncateTable("User"));
        Assert.Contains(expected, sql);
    }

    // sqlite has no TRUNCATE — SqlSugar falls back to DELETE FROM (+ resets the
    // autoincrement counter). Lock that fallback so the conversion stays correct.
    [Fact]
    public void TruncateTable_falls_back_to_delete_on_sqlite()
    {
        var sql = Capture("sqlite", db => db.DbMaintenance.TruncateTable("User"));
        Assert.Contains("DELETE FROM `User`", sql);
        Assert.DoesNotContain("TRUNCATE", sql);
    }

    // ---- ApplyDeletionsAsync -> DbMaintenance.DropColumn -------------------

    [Theory]
    [InlineData("mysql", "`User`", "`age`")]
    [InlineData("pg", "\"user\"", "\"age\"")]
    [InlineData("sqlite", "`User`", "`age`")]
    public void DropColumn_quotes_reserved_table_and_column(string client, string table, string col)
    {
        var sql = Capture(client, db => db.DbMaintenance.DropColumn("User", "age"));
        Assert.Contains("ALTER TABLE", sql);
        Assert.Contains(table, sql);
        Assert.Contains(col, sql);
    }

    // mssql DropColumn first runs a metadata query to find+drop any DEFAULT
    // constraint on the column (which the old hand-rolled `ALTER TABLE x DROP
    // COLUMN c` did NOT do — so the SqlSugar path is strictly more robust), then
    // builds the ALTER. Offline we can only observe the constraint-discovery
    // prelude because the metadata query fails without a live server before the
    // ALTER is built. Lock the prelude so a future SqlSugar bump that changes the
    // drop-column strategy is flagged here.
    [Fact]
    public void DropColumn_mssql_discovers_default_constraint_first()
    {
        var sql = Capture("mssql", db => db.DbMaintenance.DropColumn("User", "age"));
        Assert.Contains("ConstraintName", sql);
    }
}
