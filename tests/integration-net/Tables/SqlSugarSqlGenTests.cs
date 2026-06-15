using System.Collections.Generic;
using Antares.Server.Connections;
using Antares.Server.Models.Connection;
using SqlSugar;
using Xunit;
using Xunit.Abstractions;

namespace Antares.Server.IntegrationTests.Tables;

/// <summary>
/// Gate 1/3: prove SqlSugar's entity-less builders quote identifiers correctly per dialect
/// (reserved-word table "User", schema-qualified names) WITHOUT a live DB — a SqlSugarScope
/// builds SQL lazily from a ConnectionConfig and never opens a connection for .ToSqlString().
/// Discover-then-lock: if an assertion fails, the test output shows the real generated SQL.
/// </summary>
[Trait("Category", "unit")]
public sealed class SqlSugarSqlGenTests
{
    private readonly ITestOutputHelper _out;
    public SqlSugarSqlGenTests(ITestOutputHelper output) => _out = output;

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

    // Locked to SqlSugar 5.1.4.214's actual per-dialect quoting (discovered 2026-06-12):
    //  mssql -> [brackets]; mysql/sqlite -> `backticks`; pg -> "lowercased" (PG default fold).
    //  All four quote the reserved word "User" safely. PG lowercasing is correct for
    //  unquoted-created tables; case-sensitive/quoted PG identifiers are a raw-fallback edge case.
    [Theory]
    [InlineData("mssql", "[User]", "[Name]", "[Id]")]
    [InlineData("mysql", "`User`", "`Name`", "`Id`")]
    [InlineData("pg", "\"user\"", "\"name\"", "\"id\"")]
    [InlineData("sqlite", "`User`", "`Name`", "`Id`")]
    public void Update_quotes_reserved_identifiers(string client, string table, string setCol, string whereCol)
    {
        var db = Client(client);
        var dict = new Dictionary<string, object> { ["Id"] = 1, ["Name"] = "a" };
        var sql = db.Updateable(dict).AS("User").WhereColumns("Id").ToSqlString();
        _out.WriteLine($"[{client}] {sql}");
        Assert.Contains(table, sql);
        Assert.Contains(setCol, sql);
        Assert.Contains(whereCol, sql);
    }

    [Theory]
    [InlineData("mssql", "[User]")]
    [InlineData("mysql", "`User`")]
    [InlineData("pg", "\"user\"")]
    [InlineData("sqlite", "`User`")]
    public void Insert_quotes_reserved_table(string client, string table)
    {
        var db = Client(client);
        var dict = new Dictionary<string, object> { ["Id"] = 1, ["Name"] = "a" };
        var sql = db.Insertable(dict).AS("User").ToSqlString();
        _out.WriteLine($"[{client}] {sql}");
        Assert.Contains(table, sql);
    }

    // Delete path used by TablesWriteService.DeleteRows. The entity-less Deleteable<object>
    // builder needs an explicit list of IConditionalModel (key col = value) so the WHERE
    // targets the row's primary-key columns. Lock the per-dialect quoting of the reserved
    // table "User" and the key column "Id".
    [Theory]
    [InlineData("mssql", "[User]", "[Id]")]
    [InlineData("mysql", "`User`", "`Id`")]
    [InlineData("pg", "\"user\"", "\"id\"")]
    [InlineData("sqlite", "`User`", "`Id`")]
    public void Delete_quotes_reserved_identifiers(string client, string table, string whereCol)
    {
        var db = Client(client);
        var conds = new List<IConditionalModel>
        {
            new ConditionalModel { FieldName = "Id", ConditionalType = ConditionalType.Equal, FieldValue = "1" }
        };
        var sql = db.Deleteable<object>().AS("User").Where(conds).ToSqlString();
        _out.WriteLine($"[{client}] {sql}");
        Assert.Contains(table, sql);
        Assert.Contains(whereCol, sql);
    }
}
