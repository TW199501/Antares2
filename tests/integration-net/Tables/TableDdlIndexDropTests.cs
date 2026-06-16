using System.Collections.Generic;
using Antares.Server.Tables;
using Xunit;

namespace Antares.Server.IntegrationTests.Tables;

/// <summary>
/// Characterization tests for TableDdl.RenderDropIndexSql — per-dialect DROP index,
/// extracted from TablesWriteService.ApplyIndexChangesAsync. (RenderAddIndexSql is
/// covered in TablesDdlRenderTests.) The user-supplied index name round-trips verbatim.
/// </summary>
[Trait("Category", "unit")]
public sealed class TableDdlIndexDropTests
{
    private static IndexDto Idx(string name, string type) =>
        new() { Name = name, Type = type, Fields = new List<string>() };

    [Fact]
    public void Mysql_drop_primary_key()
    {
        var sql = TableDdl.RenderDropIndexSql("mysql", "`d`.`t`", Idx("PRIMARY", "PRIMARY"));
        Assert.Equal("ALTER TABLE `d`.`t` DROP PRIMARY KEY", sql);
    }

    [Fact]
    public void Mysql_drop_named_index()
    {
        var sql = TableDdl.RenderDropIndexSql("mysql", "`d`.`t`", Idx("UQ_email", "UNIQUE"));
        Assert.Equal("ALTER TABLE `d`.`t` DROP INDEX `UQ_email`", sql);
    }

    [Fact]
    public void Mssql_drop_index_on_table()
    {
        var sql = TableDdl.RenderDropIndexSql("mssql", "[dbo].[t]", Idx("IX_a", "INDEX"));
        Assert.Equal("DROP INDEX [IX_a] ON [dbo].[t]", sql);
    }

    [Fact]
    public void Pg_drop_index_if_exists()
    {
        var sql = TableDdl.RenderDropIndexSql("pg", "\"public\".\"t\"", Idx("ix_a", "INDEX"));
        Assert.Equal("DROP INDEX IF EXISTS \"ix_a\"", sql);
    }

    [Fact]
    public void Sqlite_drop_index_if_exists()
    {
        var sql = TableDdl.RenderDropIndexSql("sqlite", "\"t\"", Idx("ix_a", "INDEX"));
        Assert.Equal("DROP INDEX IF EXISTS \"ix_a\"", sql);
    }

    [Fact]
    public void Unknown_client_returns_empty()
    {
        Assert.Equal(string.Empty, TableDdl.RenderDropIndexSql("oracle", "t", Idx("x", "INDEX")));
    }

    [Fact]
    public void Index_name_is_sanitized()
    {
        var sql = TableDdl.RenderDropIndexSql("mysql", "`t`", Idx("ix`; DROP", "INDEX"));
        Assert.DoesNotContain(";", sql);
        Assert.DoesNotContain("DROP INDEX `ix`;", sql);
    }
}
