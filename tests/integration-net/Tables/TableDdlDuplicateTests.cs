using Antares.Server.Tables;
using Xunit;

namespace Antares.Server.IntegrationTests.Tables;

/// <summary>
/// Characterization tests for TableDdl.RenderDuplicate — per-dialect structure clone
/// + optional data copy, extracted from TablesWriteService.Duplicate. The contract fix
/// (renderer sends only the source table; destination derived as &lt;table&gt;_copy) is
/// exercised at the service level; here we lock the per-dialect SQL given src/dst.
/// </summary>
[Trait("Category", "unit")]
public sealed class TableDdlDuplicateTests
{
    [Theory]
    [InlineData("mysql", "CREATE TABLE `d`.`t_copy` LIKE `d`.`t`")]
    [InlineData("maria", "CREATE TABLE `d`.`t_copy` LIKE `d`.`t`")]
    public void Mysql_create_like(string client, string expectedCreate)
    {
        var stmts = TableDdl.RenderDuplicate(client, "`d`.`t`", "`d`.`t_copy`", copyData: false);
        var s = Assert.Single(stmts);
        Assert.Equal(expectedCreate, s);
    }

    [Fact]
    public void Mssql_select_into_structure_only()
    {
        var stmts = TableDdl.RenderDuplicate("mssql", "[dbo].[t]", "[dbo].[t_copy]", copyData: false);
        Assert.Equal("SELECT * INTO [dbo].[t_copy] FROM [dbo].[t] WHERE 1=0", Assert.Single(stmts));
    }

    [Fact]
    public void Pg_like_including_all()
    {
        var stmts = TableDdl.RenderDuplicate("pg", "\"s\".\"t\"", "\"s\".\"t_copy\"", copyData: false);
        Assert.Equal("CREATE TABLE \"s\".\"t_copy\" (LIKE \"s\".\"t\" INCLUDING ALL)", Assert.Single(stmts));
    }

    [Fact]
    public void Sqlite_create_as_select_empty()
    {
        var stmts = TableDdl.RenderDuplicate("sqlite", "\"t\"", "\"t_copy\"", copyData: false);
        Assert.Equal("CREATE TABLE \"t_copy\" AS SELECT * FROM \"t\" WHERE 1=0", Assert.Single(stmts));
    }

    [Fact]
    public void CopyData_appends_insert_select()
    {
        var stmts = TableDdl.RenderDuplicate("mysql", "`t`", "`t_copy`", copyData: true);
        Assert.Equal(2, stmts.Count);
        Assert.Equal("INSERT INTO `t_copy` SELECT * FROM `t`", stmts[1]);
    }

    [Fact]
    public void CopyData_false_creates_structure_only()
    {
        var stmts = TableDdl.RenderDuplicate("pg", "\"t\"", "\"t_copy\"", copyData: false);
        Assert.Single(stmts);
    }

    [Fact]
    public void Unknown_client_returns_empty()
    {
        Assert.Empty(TableDdl.RenderDuplicate("oracle", "t", "t_copy", copyData: true));
    }
}
