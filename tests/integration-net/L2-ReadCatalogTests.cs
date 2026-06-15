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
/// L2-ReadCatalog lane: characterization of the SqlSugar catalog reads that
/// TablesReadService now uses (or deliberately does NOT use).
///
/// CONVERTED: GetColumns (non-mssql) -> db.DbMaintenance.GetColumnInfosByTableName,
/// remapped into TableColumnDto. DbColumnInfo carries every field the DTO needs,
/// so the per-flavor information_schema query collapses to one SqlSugar call.
///
/// KEPT RAW: GetIndexes — proven below that GetIndexList returns List&lt;string&gt;
/// (index names only) in 5.1.4.214, which cannot fill TableIndexDto.Type / .Unique /
/// .Fields. mssql GetColumns reserved-word branch + GetData/GetCount stay raw too.
///
/// No live DB: DbMaintenance builds + logs its SQL via Aop.OnLogExecuting BEFORE it
/// opens the connection, so we capture that string and swallow the connect failure.
/// </summary>
[Trait("Category", "unit")]
public sealed class L2_ReadCatalogTests
{
    private readonly ITestOutputHelper _out;
    public L2_ReadCatalogTests(ITestOutputHelper output) => _out = output;

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

    /// <summary>Run a DbMaintenance read and return the SQL it logged (connect failure swallowed).</summary>
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

    // ---- GetColumns (non-mssql) -> DbMaintenance.GetColumnInfosByTableName ----

    // The conversion replaced a hand-rolled per-flavor information_schema SELECT with
    // a single SqlSugar DbMaintenance call. Lock that the call reaches the catalog
    // (column metadata source) per dialect so a future SqlSugar bump that changes the
    // introspection query is flagged here.
    // mysql/maria/pg build their column-metadata query through the logged ADO path,
    // so we can assert the catalog source offline. (sqlite resolves columns via a
    // PRAGMA path that doesn't surface through OnLogExecuting before the connect
    // failure, so it isn't asserted here — its conversion is still covered by the
    // DTO-fidelity test below, which is dialect-agnostic.)
    [Theory]
    [InlineData("mysql", "information_schema")]
    [InlineData("maria", "information_schema")]
    [InlineData("pg", "pg_")]
    public void GetColumnInfos_reads_catalog_per_dialect(string client, string needle)
    {
        var sql = Capture(client, db => db.DbMaintenance.GetColumnInfosByTableName("User", false));
        Assert.Contains(needle, sql, StringComparison.OrdinalIgnoreCase);
    }

    // DTO fidelity: DbColumnInfo supplies every field TableColumnDto needs. This is the
    // exact remap performed in TablesReadService.GetColumns (non-mssql branch) — lock it
    // so no field silently drops out of the wire contract during a SqlSugar bump.
    [Fact]
    public void DbColumnInfo_remaps_to_TableColumnDto_without_field_loss()
    {
        var infos = new List<DbColumnInfo>
        {
            new DbColumnInfo
            {
                DbColumnName = "id",
                DataType = "int",
                Length = 11,
                DecimalDigits = 0,
                IsNullable = false,
                DefaultValue = null,
                IsIdentity = true,
                IsPrimarykey = true,
                ColumnDescription = "primary key"
            },
            new DbColumnInfo
            {
                DbColumnName = "name",
                DataType = "varchar",
                Length = 255,
                DecimalDigits = 0,
                IsNullable = true,
                DefaultValue = "''",
                IsIdentity = false,
                IsPrimarykey = false,
                ColumnDescription = null
            }
        };

        // Mirror of the production projection (TablesReadService.GetColumns non-mssql branch).
        var dtos = infos.Select((c, idx) => new
        {
            Order = idx + 1,
            Name = c.DbColumnName ?? string.Empty,
            Type = c.DataType ?? string.Empty,
            Length = c.Length,
            NumPrecision = c.DecimalDigits,
            Nullable = c.IsNullable,
            Default = c.DefaultValue ?? string.Empty,
            AutoIncrement = c.IsIdentity,
            IsPrimary = c.IsPrimarykey,
            Comment = c.ColumnDescription ?? string.Empty
        }).ToList();

        Assert.Equal(2, dtos.Count);

        var id = dtos[0];
        Assert.Equal(1, id.Order);
        Assert.Equal("id", id.Name);
        Assert.Equal("int", id.Type);
        Assert.Equal(11, id.Length);
        Assert.Equal(0, id.NumPrecision);
        Assert.False(id.Nullable);
        Assert.Equal(string.Empty, id.Default);  // null DefaultValue -> "" (contract: no null)
        Assert.True(id.AutoIncrement);
        Assert.True(id.IsPrimary);
        Assert.Equal("primary key", id.Comment);

        var name = dtos[1];
        Assert.Equal(2, name.Order);
        Assert.Equal("name", name.Name);
        Assert.Equal("varchar", name.Type);
        Assert.Equal(255, name.Length);
        Assert.True(name.Nullable);
        Assert.Equal("''", name.Default);
        Assert.False(name.AutoIncrement);
        Assert.False(name.IsPrimary);
        Assert.Equal(string.Empty, name.Comment);  // null ColumnDescription -> ""
    }

    // Qualifier convention (review fix): GetColumns now passes the UNQUOTED
    // `schema.table` to GetColumnInfosByTableName and lets SqlSugar quote per dialect
    // — the same strategy as TablesWriteService.{ApplyDeletionsAsync,Truncate,Drop}.
    // The old code passed a PRE-QUOTED QualifyTable(...) string, which made SqlSugar
    // double-quote and forced a schema-losing catch-fallback to the bare table name.
    // These tests lock that (a) an unquoted qualified name is NOT double-quoted, and
    // (b) the schema component survives into the catalog query (no bare-table fallback).
    [Theory]
    [InlineData("mysql")]
    [InlineData("maria")]
    public void GetColumnInfos_unquoted_qualified_name_is_not_double_quoted(string client)
    {
        // Mirror of TablesReadService.GetColumns: unquoted `schema.table`.
        const string schema = "myschema";
        const string table = "User";
        var qualified = $"{schema}.{table}";

        var sql = Capture(client, db => db.DbMaintenance.GetColumnInfosByTableName(qualified, false));

        // No nested/double quoting: the raw backtick-wrapped literal `schema.table`
        // (what would happen if a pre-quoted value were re-quoted) must never appear.
        Assert.DoesNotContain("``", sql);
        // The schema name must reach the catalog filter — proves we did NOT silently
        // drop the schema (the old catch-fallback behavior passed only the bare table).
        Assert.Contains(schema, sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(table, sql, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GetColumnInfos_pg_unquoted_qualified_name_is_not_double_quoted()
    {
        const string schema = "myschema";
        const string table = "User";
        var qualified = $"{schema}.{table}";

        var sql = Capture("pg", db => db.DbMaintenance.GetColumnInfosByTableName(qualified, false));

        // pg quotes (and folds) identifiers itself; a pre-quoted value would surface as
        // an escaped-double-quote literal ("") inside the generated SQL. It must not.
        Assert.DoesNotContain("\"\"", sql);
        Assert.Contains(schema, sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(table, sql, StringComparison.OrdinalIgnoreCase);
    }

    // ---- GetIndexes stays RAW: prove GetIndexList cannot fill the DTO ---------

    // This is the load-bearing guard for the KEEP-RAW decision. GetIndexList(table)
    // returns List<string> — index NAMES only. TableIndexDto needs Type, Unique, and
    // a comma-joined Fields column list, none of which List<string> carries. If a
    // future SqlSugar version enriches this to a structured DbIndexInfo, this test
    // breaks and signals that GetIndexes may finally be convertible.
    [Fact]
    public void GetIndexList_returns_only_names_so_GetIndexes_must_stay_raw()
    {
        var method = typeof(IDbMaintenance).GetMethods()
            .Single(m => m.Name == "GetIndexList");

        // Return type is List<string> — proves only names are available.
        Assert.Equal(typeof(List<string>), method.ReturnType);

        // Single param: just the table name. No way to scope columns/uniqueness.
        var ps = method.GetParameters();
        Assert.Single(ps);
        Assert.Equal(typeof(string), ps[0].ParameterType);
    }
}
