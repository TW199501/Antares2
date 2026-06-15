using System.Data;
using Antares.Server.Connections;
using Furion.DynamicApiController;
using Microsoft.AspNetCore.Mvc;
using SqlSugar;

namespace Antares.Server.Tables;

/// <summary>
/// Phase 10 endpoints: 10 table-read actions under /api/tables/.
/// Each endpoint uses SqlSugar `db.DbMaintenance.*` for cross-DB common bits and
/// per-DB raw SQL where DbMaintenance is incomplete (DDL, FK key-usage, paging shape).
///
/// SQL is built with parameters where the renderer's input is data (filters, search
/// terms); identifier names (schema/table) are guarded with SafeIdent / SafeName
/// for the bracket / backtick / quote variants per dialect (R13 SQL injection
/// hardening, spec §6.5).
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class TablesReadService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    private readonly ILogger<TablesReadService> _logger;

    public TablesReadService(ConnectionRegistry registry, ILogger<TablesReadService> logger)
    {
        _registry = registry;
        _logger = logger;
    }

    [HttpPost("/api/tables/getColumns")]
    public async Task<List<TableColumnDto>> GetColumns([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);

        // MSSQL: bypass SqlSugar.DbMaintenance because it generates unquoted
        // `SELECT ... FROM <table>` internally and breaks on reserved-word
        // table names like User/Order/Group. Direct sys.* catalog query with
        // t.name = @t parameterized, same pattern as GetIndexes / GetChecks.
        if (entry.Client == "mssql")
        {
            // ROW_NUMBER() over column_id keeps Order sequential 1..N even when
            // tables have dropped columns (column_id has gaps in that case but
            // the renderer's 序號 column expects a clean 1-based ordinal).
            const string sql = @"
SELECT
   CAST(ROW_NUMBER() OVER (ORDER BY c.column_id) AS INT) AS [Order],
   c.name                                AS [Name],
   tp.name                               AS [Type],
   CAST(c.max_length AS INT)             AS [Length],
   CAST(c.precision  AS INT)             AS [NumPrecision],
   c.is_nullable                         AS [Nullable],
   ISNULL(dc.definition, '')             AS [Default],
   c.is_identity                         AS [AutoIncrement],
   CAST(CASE WHEN pk.column_id IS NULL THEN 0 ELSE 1 END AS BIT) AS [IsPrimary],
   ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS [Comment]
FROM sys.columns c
JOIN sys.tables  t  ON c.object_id = t.object_id
JOIN sys.schemas s  ON t.schema_id = s.schema_id
JOIN sys.types   tp ON c.user_type_id = tp.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
LEFT JOIN sys.extended_properties ep
       ON ep.major_id = c.object_id
      AND ep.minor_id = c.column_id
      AND ep.class    = 1
      AND ep.name     = 'MS_Description'
LEFT JOIN (
   SELECT ic.object_id, ic.column_id
   FROM sys.indexes i
   JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
   WHERE i.is_primary_key = 1
) pk ON pk.object_id = c.object_id AND pk.column_id = c.column_id
WHERE s.name = @sc AND t.name = @t
ORDER BY c.column_id";
            var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<TableColumnDto>(sql, new { sc = p.Schema, t = p.Table }), ct);
            return rows.ToList();
        }

        // Non-mssql: SqlSugar cross-dialect catalog read. DbColumnInfo supplies every
        // field TableColumnDto needs (DbColumnName/DataType/Length/DecimalDigits/
        // IsNullable/DefaultValue/IsIdentity/IsPrimarykey/ColumnDescription), so the
        // hand-rolled per-flavor information_schema query collapses to one call.
        var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
        var infos = await Task.Run(() =>
        {
            try { return entry.Db.DbMaintenance.GetColumnInfosByTableName(qualified, false); }
            catch { return entry.Db.DbMaintenance.GetColumnInfosByTableName(p.Table ?? string.Empty, false); }
        }, ct);
        return infos.Select((c, idx) => new TableColumnDto
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
    }

    [HttpPost("/api/tables/searchColumns")]
    public async Task<List<SearchColumnHitDto>> SearchColumns([FromBody] SearchColumnsPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var search = (p.Search ?? string.Empty).Trim();
        if (search.Length == 0) return new List<SearchColumnHitDto>();
        var sql = entry.Client switch
        {
            "mssql" => "SELECT TABLE_NAME AS [Table], COLUMN_NAME AS [Column] FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME LIKE @s",
            "mysql" or "maria" => "SELECT TABLE_NAME AS `Table`, COLUMN_NAME AS `Column` FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME LIKE @s AND TABLE_SCHEMA = DATABASE()",
            "pg" => "SELECT table_name AS \"Table\", column_name AS \"Column\" FROM information_schema.columns WHERE column_name ILIKE @s",
            "sqlite" => "SELECT m.name AS [Table], p.name AS [Column] FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type='table' AND p.name LIKE @s",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new List<SearchColumnHitDto>();
        var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<SearchColumnHitDto>(sql, new { s = $"%{search}%" }), ct);
        return rows.ToList();
    }

    [HttpPost("/api/tables/getData")]
    public async Task<TableDataDto> GetData([FromBody] GetTableDataPayload p, CancellationToken ct)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var entry = _registry.Require(p.Uid);
        var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
        var page = Math.Max(1, p.Page);
        var pageSize = Math.Max(1, Math.Min(p.PageSize, 1000));
        var offset = (page - 1) * pageSize;

        var orderBy = string.IsNullOrEmpty(p.SortField)
            ? string.Empty
            : $" ORDER BY {QuoteIdent(entry.Client, p.SortField)} {(string.Equals(p.SortDirection, "desc", StringComparison.OrdinalIgnoreCase) ? "DESC" : "ASC")}";

        var (sql, paramObj) = entry.Client switch
        {
            "mssql" => ($"SELECT * FROM {qualified}{(string.IsNullOrEmpty(orderBy) ? " ORDER BY (SELECT NULL)" : orderBy)} OFFSET @o ROWS FETCH NEXT @n ROWS ONLY", (object)new { o = offset, n = pageSize }),
            "mysql" or "maria" or "pg" => ($"SELECT * FROM {qualified}{orderBy} LIMIT @n OFFSET @o", (object)new { o = offset, n = pageSize }),
            "sqlite" => ($"SELECT * FROM {qualified}{orderBy} LIMIT @n OFFSET @o", (object)new { o = offset, n = pageSize }),
            _ => ("SELECT 1 WHERE 1=0", (object)new { })
        };

        var dt = await Task.Run(() => entry.Db.Ado.GetDataTable(sql, paramObj), ct);

        // Column comments are needed by the renderer's "中" header toggle
        // (WorkspaceTabQueryTable.headerLabel uses field.comment when
        // useCommentHeader=true; see feedback_column_comment_no_fallback memory
        // — empty comments stay empty, no English fallback, intentional).
        // ADO.NET's DataColumn metadata doesn't carry SQL Server extended
        // properties or MySQL/PG column comments, so we fetch them separately
        // and merge into fields.
        var commentMap = await GetColumnCommentsAsync(entry, p.Schema, p.Table, ct);

        var fields = new List<RawFieldDto>();
        foreach (DataColumn col in dt.Columns)
        {
            fields.Add(new RawFieldDto
            {
                Name = col.ColumnName,
                Type = col.DataType.Name,
                Comment = commentMap.TryGetValue(col.ColumnName, out var c) ? c : string.Empty
            });
        }

        var rows = new List<Dictionary<string, object?>>(dt.Rows.Count);
        foreach (DataRow r in dt.Rows)
        {
            var d = new Dictionary<string, object?>(dt.Columns.Count);
            foreach (DataColumn c in dt.Columns) d[c.ColumnName] = r[c] == DBNull.Value ? null : r[c];
            rows.Add(d);
        }
        return new TableDataDto { Rows = rows, Fields = fields, Page = page, PageSize = pageSize, Duration = sw.ElapsedMilliseconds };
    }

    [HttpPost("/api/tables/getCount")]
    public async Task<long> GetCount([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
        return await Task.Run(() => entry.Db.Ado.GetLong($"SELECT COUNT(*) FROM {qualified}"), ct);
    }

    [HttpPost("/api/tables/getOptions")]
    public async Task<TableOptionsDto> GetOptions([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var opts = new TableOptionsDto { Name = p.Table ?? string.Empty };
        try
        {
            if (entry.Client is "mysql" or "maria")
            {
                var dt = await Task.Run(() => entry.Db.Ado.GetDataTable(
                    "SELECT IFNULL(ENGINE,'') AS Engine, IFNULL(TABLE_COLLATION,'') AS Collation, IFNULL(TABLE_COMMENT,'') AS Comment, IFNULL(AUTO_INCREMENT,0) AS AutoIncrement FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @sc AND TABLE_NAME = @t",
                    new { sc = p.Schema, t = p.Table }), ct);
                if (dt.Rows.Count > 0)
                {
                    opts.Engine = dt.Rows[0]["Engine"]?.ToString() ?? string.Empty;
                    opts.Collation = dt.Rows[0]["Collation"]?.ToString() ?? string.Empty;
                    opts.Comment = dt.Rows[0]["Comment"]?.ToString() ?? string.Empty;
                    opts.AutoIncrement = Convert.ToInt64(dt.Rows[0]["AutoIncrement"] ?? 0L);
                }
            }
            else if (entry.Client is "mssql")
            {
                // SQL Server table-level Comment lives in sys.extended_properties
                // with class=1 (object), minor_id=0 (the table itself, not a column).
                // AutoIncrement counter = next IDENTITY value via IDENT_CURRENT (+ seed step);
                // returns NULL if the table has no IDENTITY column, hence the COALESCE+0.
                // Engine/Collation aren't MSSQL concepts — leave them empty.
                var dt = await Task.Run(() => entry.Db.Ado.GetDataTable(@"
SELECT
   ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS Comment,
   ISNULL(CAST(IDENT_CURRENT(QUOTENAME(@sc) + '.' + QUOTENAME(@t)) AS BIGINT), 0) AS AutoIncrement
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
LEFT JOIN sys.extended_properties ep
       ON ep.major_id = t.object_id
      AND ep.minor_id = 0
      AND ep.class    = 1
      AND ep.name     = 'MS_Description'
WHERE s.name = @sc AND t.name = @t",
                    new { sc = p.Schema, t = p.Table }), ct);
                if (dt.Rows.Count > 0)
                {
                    opts.Comment = dt.Rows[0]["Comment"]?.ToString() ?? string.Empty;
                    opts.AutoIncrement = Convert.ToInt64(dt.Rows[0]["AutoIncrement"] ?? 0L);
                }
            }
            else if (entry.Client is "pg")
            {
                // PostgreSQL: comment via obj_description on the regclass.
                var dt = await Task.Run(() => entry.Db.Ado.GetDataTable(@"
SELECT COALESCE(obj_description((quote_ident(@sc) || '.' || quote_ident(@t))::regclass, 'pg_class'), '') AS ""Comment""",
                    new { sc = p.Schema, t = p.Table }), ct);
                if (dt.Rows.Count > 0)
                    opts.Comment = dt.Rows[0]["Comment"]?.ToString() ?? string.Empty;
            }
        }
        catch (Exception ex) { _logger.LogDebug(ex, "getOptions per-DB enrich failed"); }
        return opts;
    }

    [HttpPost("/api/tables/getIndexes")]
    public async Task<List<TableIndexDto>> GetIndexes([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        // raw: SqlSugar DbMaintenance.GetIndexList(table) returns List<string> (index
        // names only) in 5.1.4.214 — it carries no Type, no Unique flag, and no
        // column list, so 3 of TableIndexDto's 4 fields (Type/Unique/Fields) would be
        // lost. The DTO does not map cleanly; keep the per-dialect grouped catalog SQL
        // that aggregates Fields via STRING_AGG/GROUP_CONCAT and reads NON_UNIQUE/type_desc.
        var entry = _registry.Require(p.Uid);
        var sql = entry.Client switch
        {
            "mssql" => "SELECT i.name AS [Name], i.type_desc AS [Type], i.is_unique AS [Unique], STRING_AGG(c.name, ',') AS Fields FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id JOIN sys.tables t ON i.object_id = t.object_id JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = @sc AND t.name = @t GROUP BY i.name, i.type_desc, i.is_unique",
            "mysql" or "maria" => "SELECT INDEX_NAME AS Name, INDEX_TYPE AS Type, IF(NON_UNIQUE=0,1,0) AS `Unique`, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS Fields FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @sc AND TABLE_NAME = @t GROUP BY INDEX_NAME, INDEX_TYPE, NON_UNIQUE",
            "pg" => "SELECT indexname AS \"Name\", 'btree' AS \"Type\", false AS \"Unique\", '' AS \"Fields\" FROM pg_indexes WHERE schemaname = @sc AND tablename = @t",
            "sqlite" => "SELECT name AS Name, 'btree' AS Type, 0 AS [Unique], '' AS Fields FROM sqlite_master WHERE type='index' AND tbl_name = @t",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new List<TableIndexDto>();
        var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<TableIndexDto>(sql, new { sc = p.Schema, t = p.Table }), ct);
        return rows.ToList();
    }

    [HttpPost("/api/tables/getChecks")]
    public async Task<List<TableCheckDto>> GetChecks([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var sql = entry.Client switch
        {
            "mssql" => "SELECT cc.name AS [Name], cc.definition AS [Clause] FROM sys.check_constraints cc JOIN sys.tables t ON cc.parent_object_id = t.object_id JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = @sc AND t.name = @t",
            "pg" => "SELECT con.conname AS \"Name\", pg_get_constraintdef(con.oid) AS \"Clause\" FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace ns ON ns.oid = rel.relnamespace WHERE con.contype = 'c' AND ns.nspname = @sc AND rel.relname = @t",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new List<TableCheckDto>();
        var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<TableCheckDto>(sql, new { sc = p.Schema, t = p.Table }), ct);
        return rows.ToList();
    }

    [HttpPost("/api/tables/getDdl")]
    public async Task<string> GetDdl([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        return entry.Client switch
        {
            "mysql" or "maria" => await Task.Run(() =>
            {
                var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
                var dt = entry.Db.Ado.GetDataTable($"SHOW CREATE TABLE {qualified}");
                return dt.Rows.Count > 0 ? dt.Rows[0][1]?.ToString() ?? string.Empty : string.Empty;
            }, ct),
            "mssql" => await Task.Run(() => entry.Db.Ado.GetString(
                "SELECT OBJECT_DEFINITION(OBJECT_ID(@n))", new { n = $"[{p.Schema}].[{p.Table}]" }), ct) ?? string.Empty,
            "sqlite" => await Task.Run(() => entry.Db.Ado.GetString(
                "SELECT sql FROM sqlite_master WHERE name = @t LIMIT 1", new { t = p.Table }), ct) ?? string.Empty,
            "pg" => await Task.Run(() => $"-- pg_get_tabledef not exposed; reconstruct from information_schema (Phase 10 stub)", ct),
            _ => string.Empty
        };
    }

    [HttpPost("/api/tables/getKeyUsage")]
    public async Task<List<ForeignKeyDto>> GetKeyUsage([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        // Renderer (WorkspaceTabPropsTable.vue) calls response.map() on this —
        // contract is a flat array of outbound foreign keys for the given table,
        // not an { inbound, outbound } envelope.
        var entry = _registry.Require(p.Uid);
        var outbound = new List<ForeignKeyDto>();
        try
        {
            if (entry.Client is "mssql")
            {
                var outRows = await Task.Run(() => entry.Db.Ado.SqlQuery<ForeignKeyDto>(@"
SELECT fk.name AS Name,
       sc1.name AS Schema_, t1.name AS Table_, c1.name AS Column_,
       sc2.name AS RefSchema, t2.name AS RefTable, c2.name AS RefColumn
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.tables t1 ON fkc.parent_object_id = t1.object_id
JOIN sys.schemas sc1 ON t1.schema_id = sc1.schema_id
JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
JOIN sys.tables t2 ON fkc.referenced_object_id = t2.object_id
JOIN sys.schemas sc2 ON t2.schema_id = sc2.schema_id
JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
WHERE sc1.name = @sc AND t1.name = @t", new { sc = p.Schema, t = p.Table }), ct);
                outbound.AddRange(outRows);
            }
        }
        catch (Exception ex) { _logger.LogDebug(ex, "getKeyUsage failed"); }
        return outbound;
    }

    [HttpPost("/api/tables/getForeignList")]
    public async Task<List<ForeignKeyDto>> GetForeignList([FromBody] TableTargetPayload p, CancellationToken ct)
        => await GetKeyUsage(p, ct);

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    private static string QualifyTable(string client, string? schema, string? table)
    {
        var t = (table ?? string.Empty);
        var s = (schema ?? string.Empty);
        return client switch
        {
            "mssql" => string.IsNullOrEmpty(s) ? $"[{Sanitize(t)}]" : $"[{Sanitize(s)}].[{Sanitize(t)}]",
            "mysql" or "maria" => string.IsNullOrEmpty(s) ? $"`{Sanitize(t)}`" : $"`{Sanitize(s)}`.`{Sanitize(t)}`",
            "pg" => string.IsNullOrEmpty(s) ? $"\"{Sanitize(t)}\"" : $"\"{Sanitize(s)}\".\"{Sanitize(t)}\"",
            _ => $"\"{Sanitize(t)}\""
        };
    }

    private static string QuoteIdent(string client, string name) => client switch
    {
        "mssql" => $"[{Sanitize(name)}]",
        "mysql" or "maria" => $"`{Sanitize(name)}`",
        "pg" => $"\"{Sanitize(name)}\"",
        _ => $"\"{Sanitize(name)}\""
    };

    private static string Sanitize(string s) => s.Replace("[", "").Replace("]", "").Replace("`", "").Replace("\"", "").Replace(";", "").Replace("--", "");

    /// <summary>
    /// Build a {columnName -> comment} map for a given table. Used by GetData
    /// so the renderer can render Chinese column-comment headers when the user
    /// flips the "中" toggle. ADO.NET column metadata doesn't carry comments,
    /// so per-flavor catalog query is required.
    /// </summary>
    private static async Task<Dictionary<string, string>> GetColumnCommentsAsync(
        ConnectionRegistry.Entry entry, string? schema, string? table, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(table)) return new Dictionary<string, string>(StringComparer.Ordinal);

        switch (entry.Client)
        {
            case "mssql":
            {
                const string sql = @"
SELECT c.name AS [Name], ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS [Comment]
FROM sys.columns c
JOIN sys.tables  t ON c.object_id = t.object_id
JOIN sys.schemas s ON t.schema_id = s.schema_id
LEFT JOIN sys.extended_properties ep
       ON ep.major_id = c.object_id
      AND ep.minor_id = c.column_id
      AND ep.class    = 1
      AND ep.name     = 'MS_Description'
WHERE s.name = @sc AND t.name = @t";
                var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<NameCommentRow>(sql, new { sc = schema, t = table }), ct);
                return rows.ToDictionary(r => r.Name, r => r.Comment, StringComparer.Ordinal);
            }
            case "mysql":
            case "maria":
            {
                const string sql = @"SELECT COLUMN_NAME AS Name, IFNULL(COLUMN_COMMENT, '') AS Comment
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @sc AND TABLE_NAME = @t";
                var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<NameCommentRow>(sql, new { sc = schema, t = table }), ct);
                return rows.ToDictionary(r => r.Name, r => r.Comment, StringComparer.Ordinal);
            }
            case "pg":
            {
                const string sql = @"SELECT a.attname AS ""Name"", COALESCE(pgd.description, '') AS ""Comment""
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_description pgd ON pgd.objoid = a.attrelid AND pgd.objsubid = a.attnum
WHERE n.nspname = @sc AND c.relname = @t AND a.attnum > 0 AND NOT a.attisdropped";
                var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<NameCommentRow>(sql, new { sc = schema ?? "public", t = table }), ct);
                return rows.ToDictionary(r => r.Name, r => r.Comment, StringComparer.Ordinal);
            }
            default:
                return new Dictionary<string, string>(StringComparer.Ordinal);
        }
    }

    private sealed class NameCommentRow
    {
        public string Name { get; set; } = string.Empty;
        public string Comment { get; set; } = string.Empty;
    }
}

// ----- DTOs -----------------------------------------------------------------

public class TableTargetPayload
{
    public string Uid { get; set; } = string.Empty;
    public string? Schema { get; set; }
    public string? Table { get; set; }
}

public sealed class SearchColumnsPayload
{
    public string Uid { get; set; } = string.Empty;
    public string Search { get; set; } = string.Empty;
}

public sealed class GetTableDataPayload : TableTargetPayload
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
    public string? SortField { get; set; }
    public string? SortDirection { get; set; }
}

public sealed class TableDataDto
{
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public List<RawFieldDto> Fields { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    /// <summary>Server-side query duration in milliseconds (excludes network roundtrip).</summary>
    public long Duration { get; set; }
}

public sealed class RawFieldDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Comment { get; set; } = string.Empty;
}

public sealed class TableColumnDto
{
    public int Order { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int Length { get; set; }
    public int NumPrecision { get; set; }
    public bool Nullable { get; set; }
    public string Default { get; set; } = string.Empty;
    public bool AutoIncrement { get; set; }
    public bool IsPrimary { get; set; }
    public string Comment { get; set; } = string.Empty;
}

public sealed class TableOptionsDto
{
    public string Name { get; set; } = string.Empty;
    public string Engine { get; set; } = string.Empty;
    public string Collation { get; set; } = string.Empty;
    public string Comment { get; set; } = string.Empty;
    public long AutoIncrement { get; set; }
}

public sealed class TableIndexDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool Unique { get; set; }
    public string Fields { get; set; } = string.Empty;
}

public sealed class TableCheckDto
{
    public string Name { get; set; } = string.Empty;
    public string Clause { get; set; } = string.Empty;
}

public sealed class ForeignKeyDto
{
    public string Name { get; set; } = string.Empty;
    public string Schema_ { get; set; } = string.Empty;
    public string Table_ { get; set; } = string.Empty;
    public string Column_ { get; set; } = string.Empty;
    public string RefSchema { get; set; } = string.Empty;
    public string RefTable { get; set; } = string.Empty;
    public string RefColumn { get; set; } = string.Empty;
}

public sealed class SearchColumnHitDto
{
    public string Table { get; set; } = string.Empty;
    public string Column { get; set; } = string.Empty;
}
