using Antares.Server.Tables;
using Xunit;

namespace Antares.Server.IntegrationTests.Tables;

/// <summary>
/// Pure-function unit tests for `/api/tables/alter` SQL renderer helpers.
///
/// These cover T4-T5 commits (ADD COLUMN / CREATE INDEX / DEFAULT / length-spec).
/// All test targets are `internal static` — accessible via `[InternalsVisibleTo]`
/// declared in server/AssemblyInfo.cs.
///
/// Why pure-function tests instead of full HTTP round-trip:
///   - Faster (no DB / no host).
///   - Cover per-flavor SQL string generation per-flavor without test-DB setup.
///   - The full HTTP round-trip path is covered by e2e/props-tab-crud.spec.ts.
/// </summary>
[Trait("Category", "unit")]
public sealed class TablesDdlRenderTests
{
    // ──────────────────────────────────────────────────────────────────
    // RenderAddColumnClause — per-flavor ADD COLUMN string
    // ──────────────────────────────────────────────────────────────────

    [Fact]
    public void AddColumn_mssql_omits_COLUMN_keyword_and_uses_brackets()
    {
        var f = new FieldDto { Name = "avatar", Type = "NVARCHAR", Length = 500, Nullable = true };
        var sql = TablesWriteService.RenderAddColumnClause("mssql", f);

        Assert.StartsWith("ADD [avatar]", sql);
        Assert.DoesNotContain("ADD COLUMN", sql);
        Assert.Contains("NVARCHAR(500)", sql);
        Assert.Contains(" NULL", sql);
    }

    [Fact]
    public void AddColumn_mssql_emits_IDENTITY_when_autoIncrement()
    {
        var f = new FieldDto { Name = "id", Type = "INT", AutoIncrement = true, Nullable = false };
        var sql = TablesWriteService.RenderAddColumnClause("mssql", f);

        Assert.Contains("IDENTITY(1,1)", sql);
        Assert.Contains(" NOT NULL", sql);
    }

    [Fact]
    public void AddColumn_mysql_uses_backticks_and_AUTO_INCREMENT()
    {
        var f = new FieldDto
        {
            Name = "id", Type = "BIGINT", Unsigned = true,
            AutoIncrement = true, Nullable = false, NumLength = 20
        };
        var sql = TablesWriteService.RenderAddColumnClause("mysql", f);

        Assert.StartsWith("ADD COLUMN `id`", sql);
        Assert.Contains("BIGINT(20)", sql);
        Assert.Contains(" UNSIGNED", sql);
        Assert.Contains(" AUTO_INCREMENT", sql);
        Assert.Contains(" NOT NULL", sql);
    }

    [Fact]
    public void AddColumn_mysql_emits_COMMENT_clause_with_escaped_quotes()
    {
        var f = new FieldDto { Name = "note", Type = "TEXT", Comment = "user's note" };
        var sql = TablesWriteService.RenderAddColumnClause("mysql", f);

        Assert.Contains("COMMENT 'user''s note'", sql);
    }

    [Fact]
    public void AddColumn_pg_uses_double_quotes_and_array_brackets()
    {
        var f = new FieldDto { Name = "tags", Type = "TEXT", IsArray = true, Nullable = false };
        var sql = TablesWriteService.RenderAddColumnClause("pg", f);

        Assert.StartsWith("ADD COLUMN \"tags\"", sql);
        Assert.Contains("TEXT", sql);
        Assert.Contains("[]", sql);
        Assert.Contains(" NOT NULL", sql);
    }

    [Fact]
    public void AddColumn_sqlite_basic_form()
    {
        var f = new FieldDto { Name = "score", Type = "INTEGER", Nullable = false };
        var sql = TablesWriteService.RenderAddColumnClause("sqlite", f);

        Assert.StartsWith("ADD COLUMN \"score\"", sql);
        Assert.Contains("INTEGER", sql);
        Assert.Contains(" NOT NULL", sql);
    }

    // ──────────────────────────────────────────────────────────────────
    // BuildLengthSpec — pick first non-null among numLength/charLength/etc.
    // ──────────────────────────────────────────────────────────────────

    [Fact]
    public void Length_returns_empty_when_all_nulls()
    {
        var f = new FieldDto { Type = "TEXT" };
        Assert.Equal(string.Empty, TablesWriteService.BuildLengthSpec(f));
    }

    [Fact]
    public void Length_picks_charLength_for_VARCHAR()
    {
        var f = new FieldDto { Type = "NVARCHAR", CharLength = 255 };
        Assert.Equal("(255)", TablesWriteService.BuildLengthSpec(f));
    }

    [Fact]
    public void Length_combines_NumLength_and_NumScale_for_DECIMAL()
    {
        var f = new FieldDto { Type = "DECIMAL", NumLength = 10, NumScale = 2 };
        Assert.Equal("(10,2)", TablesWriteService.BuildLengthSpec(f));
    }

    [Fact]
    public void Length_uses_enumValues_for_ENUM()
    {
        var f = new FieldDto { Type = "ENUM", EnumValues = "'a','b','c'" };
        Assert.Equal("('a','b','c')", TablesWriteService.BuildLengthSpec(f));
    }

    // ──────────────────────────────────────────────────────────────────
    // RenderDefault — null vs literal vs expression
    // ──────────────────────────────────────────────────────────────────

    [Fact]
    public void Default_null_emits_nothing()
    {
        var f = new FieldDto { Default = null };
        Assert.Equal(string.Empty, TablesWriteService.RenderDefault(f));
    }

    [Fact]
    public void Default_literal_string_quoted()
    {
        var f = new FieldDto { Default = "draft" };
        Assert.Equal(" DEFAULT 'draft'", TablesWriteService.RenderDefault(f));
    }

    [Fact]
    public void Default_literal_quotes_escaped()
    {
        var f = new FieldDto { Default = "O'Brien" };
        Assert.Equal(" DEFAULT 'O''Brien'", TablesWriteService.RenderDefault(f));
    }

    [Fact]
    public void Default_expression_unquoted()
    {
        var f = new FieldDto { Default = "GETDATE()", DefaultType = "expression" };
        Assert.Equal(" DEFAULT GETDATE()", TablesWriteService.RenderDefault(f));
    }

    // ──────────────────────────────────────────────────────────────────
    // RenderAddIndexSql — PRIMARY / UNIQUE / INDEX per-flavor
    // ──────────────────────────────────────────────────────────────────

    [Fact]
    public void Index_mysql_PRIMARY_uses_ALTER_TABLE_ADD_PRIMARY_KEY()
    {
        var idx = new IndexDto { Name = "PK_users", Type = "PRIMARY", Fields = new() { "id" } };
        var sql = TablesWriteService.RenderAddIndexSql("mysql", "`d`.`users`", idx);

        Assert.Equal("ALTER TABLE `d`.`users` ADD PRIMARY KEY (`id`)", sql);
    }

    [Fact]
    public void Index_mysql_UNIQUE_emits_UNIQUE_INDEX()
    {
        var idx = new IndexDto { Name = "UQ_email", Type = "UNIQUE", Fields = new() { "email" } };
        var sql = TablesWriteService.RenderAddIndexSql("mysql", "`d`.`users`", idx);

        Assert.Equal("ALTER TABLE `d`.`users` ADD UNIQUE INDEX `UQ_email` (`email`)", sql);
    }

    [Fact]
    public void Index_mssql_UNIQUE_emits_CREATE_UNIQUE_INDEX_independent_statement()
    {
        var idx = new IndexDto { Name = "UQ_email", Type = "UNIQUE", Fields = new() { "email" } };
        var sql = TablesWriteService.RenderAddIndexSql("mssql", "[dbo].[users]", idx);

        Assert.Equal("CREATE UNIQUE INDEX [UQ_email] ON [dbo].[users] ([email])", sql);
    }

    [Fact]
    public void Index_mssql_PRIMARY_emits_ADD_CONSTRAINT()
    {
        var idx = new IndexDto { Name = "PK_users", Type = "PRIMARY", Fields = new() { "id" } };
        var sql = TablesWriteService.RenderAddIndexSql("mssql", "[dbo].[users]", idx);

        Assert.Equal("ALTER TABLE [dbo].[users] ADD CONSTRAINT [PK_users] PRIMARY KEY ([id])", sql);
    }

    [Fact]
    public void Index_pg_UNIQUE_uses_double_quoted_identifier()
    {
        var idx = new IndexDto { Name = "uq_email", Type = "UNIQUE", Fields = new() { "email" } };
        var sql = TablesWriteService.RenderAddIndexSql("pg", "\"public\".\"users\"", idx);

        Assert.Equal("CREATE UNIQUE INDEX \"uq_email\" ON \"public\".\"users\" (\"email\")", sql);
    }

    [Fact]
    public void Index_sqlite_no_PRIMARY_falls_back_to_INDEX_form()
    {
        var idx = new IndexDto { Name = "ix_score", Type = "INDEX", Fields = new() { "score" } };
        var sql = TablesWriteService.RenderAddIndexSql("sqlite", "\"users\"", idx);

        Assert.Equal("CREATE INDEX \"ix_score\" ON \"users\" (\"score\")", sql);
    }

    [Fact]
    public void Index_unknown_client_returns_empty()
    {
        var idx = new IndexDto { Name = "x", Type = "INDEX", Fields = new() { "f" } };
        var sql = TablesWriteService.RenderAddIndexSql("oracle", "x", idx);

        Assert.Equal(string.Empty, sql);
    }

    [Fact]
    public void Index_multi_field_comma_separated()
    {
        var idx = new IndexDto { Name = "IX_compound", Type = "INDEX", Fields = new() { "a", "b" } };
        var sql = TablesWriteService.RenderAddIndexSql("mysql", "`d`.`t`", idx);

        Assert.Contains("(`a`,`b`)", sql);
    }
}
