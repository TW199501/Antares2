using System.Linq;
using Antares.Server.Tables;
using Xunit;

namespace Antares.Server.IntegrationTests.Tables;

/// <summary>
/// Characterization tests for TableDdl.RenderChangeColumn — the per-dialect ordered
/// statement sequence for column type-change / rename / modifier change, extracted
/// from TablesWriteService.ApplyChangesAsync. Locks statement order, parameterization
/// (mssql sp_rename + extended-property), and per-flavor multi-statement shape.
/// </summary>
[Trait("Category", "unit")]
public sealed class TableDdlChangeColumnTests
{
    private static FieldDto Field(string name, string type, string? org = null) =>
        new() { Name = name, Type = type, OrgName = org };

    [Fact]
    public void Mysql_single_change_column_with_modifiers()
    {
        var f = new FieldDto { Name = "amount", OrgName = "amt", Type = "decimal", NumLength = 10, NumScale = 2,
            Unsigned = true, Nullable = false, Comment = "money", OnUpdate = null };
        var stmts = TableDdl.RenderChangeColumn("mysql", "`d`.`t`", "t", "d", f);

        var s = Assert.Single(stmts);
        Assert.Null(s.Params);
        Assert.Equal(
            "ALTER TABLE `d`.`t` CHANGE COLUMN `amt` `amount` DECIMAL(10,2) UNSIGNED NOT NULL COMMENT 'money'",
            s.Sql);
    }

    [Fact]
    public void Mssql_rename_then_alter_then_comment_parameterized()
    {
        var f = new FieldDto { Name = "title", OrgName = "name", Type = "nvarchar", CharLength = 200,
            Nullable = false, Comment = "the title" };
        var stmts = TableDdl.RenderChangeColumn("mssql", "[dbo].[t]", "t", "dbo", f);

        Assert.Equal(3, stmts.Count);
        // 1) sp_rename — parameterized
        Assert.Equal("EXEC sp_rename @oldname, @newname, 'COLUMN'", stmts[0].Sql);
        Assert.NotNull(stmts[0].Params);
        // 2) ALTER COLUMN type + NOT NULL
        Assert.Equal("ALTER TABLE [dbo].[t] ALTER COLUMN [title] NVARCHAR(200) NOT NULL", stmts[1].Sql);
        Assert.Null(stmts[1].Params);
        // 3) extended-property comment — parameterized add-or-update
        Assert.Contains("sp_addextendedproperty", stmts[2].Sql);
        Assert.Contains("sp_updateextendedproperty", stmts[2].Sql);
        Assert.NotNull(stmts[2].Params);
    }

    [Fact]
    public void Mssql_no_rename_skips_sp_rename()
    {
        var f = new FieldDto { Name = "id", OrgName = "id", Type = "int", Nullable = false };
        var stmts = TableDdl.RenderChangeColumn("mssql", "[dbo].[t]", "t", "dbo", f);
        var s = Assert.Single(stmts);
        Assert.StartsWith("ALTER TABLE [dbo].[t] ALTER COLUMN [id] INT", s.Sql);
    }

    [Fact]
    public void Pg_five_statement_sequence_with_rename_and_default_and_comment()
    {
        var f = new FieldDto { Name = "tags", OrgName = "tag", Type = "text", IsArray = true,
            Nullable = false, Default = "x", Comment = "labels" };
        var stmts = TableDdl.RenderChangeColumn("pg", "\"public\".\"t\"", "t", "public", f);

        Assert.Equal(5, stmts.Count);
        Assert.Equal("ALTER TABLE \"public\".\"t\" RENAME COLUMN \"tag\" TO \"tags\"", stmts[0].Sql);
        Assert.Equal("ALTER TABLE \"public\".\"t\" ALTER COLUMN \"tags\" TYPE TEXT[]", stmts[1].Sql);
        Assert.Equal("ALTER TABLE \"public\".\"t\" ALTER COLUMN \"tags\" SET NOT NULL", stmts[2].Sql);
        Assert.Equal("ALTER TABLE \"public\".\"t\" ALTER COLUMN \"tags\" SET DEFAULT 'x'", stmts[3].Sql);
        Assert.Equal("COMMENT ON COLUMN \"public\".\"t\".\"tags\" IS 'labels'", stmts[4].Sql);
        Assert.All(stmts, s => Assert.Null(s.Params));
    }

    [Fact]
    public void Pg_drop_default_and_drop_not_null_when_nullable_and_no_default()
    {
        var f = new FieldDto { Name = "c", OrgName = "c", Type = "int", Nullable = true, Default = null };
        var stmts = TableDdl.RenderChangeColumn("pg", "\"t\"", "t", null, f);
        Assert.Contains(stmts, s => s.Sql.EndsWith("DROP NOT NULL"));
        Assert.Contains(stmts, s => s.Sql.EndsWith("DROP DEFAULT"));
    }

    [Fact]
    public void Pg_expression_default_unquoted()
    {
        var f = new FieldDto { Name = "c", OrgName = "c", Type = "timestamp", Default = "now()", DefaultType = "expression" };
        var stmts = TableDdl.RenderChangeColumn("pg", "\"t\"", "t", null, f);
        Assert.Contains(stmts, s => s.Sql.EndsWith("SET DEFAULT now()"));
    }

    [Fact]
    public void Sqlite_rename_only()
    {
        var f = Field("newc", "TEXT", org: "oldc");
        var stmts = TableDdl.RenderChangeColumn("sqlite", "\"t\"", "t", null, f);
        var s = Assert.Single(stmts);
        Assert.Equal("ALTER TABLE \"t\" RENAME COLUMN \"oldc\" TO \"newc\"", s.Sql);
    }

    [Fact]
    public void Sqlite_no_rename_returns_empty_for_unsupported_type_change()
    {
        var f = Field("c", "TEXT", org: "c");
        var stmts = TableDdl.RenderChangeColumn("sqlite", "\"t\"", "t", null, f);
        Assert.Empty(stmts);
    }
}
