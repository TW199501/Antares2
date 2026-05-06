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
        var qualified = QualifyTable(entry.Client, p.Schema, p.Table);
        var infos = await Task.Run(() =>
        {
            try { return entry.Db.DbMaintenance.GetColumnInfosByTableName(qualified, false); }
            catch { return entry.Db.DbMaintenance.GetColumnInfosByTableName(p.Table ?? string.Empty, false); }
        }, ct);
        return infos.Select(c => new TableColumnDto
        {
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
        var fields = new List<RawFieldDto>();
        foreach (DataColumn col in dt.Columns) fields.Add(new RawFieldDto { Name = col.ColumnName, Type = col.DataType.Name });

        var rows = new List<Dictionary<string, object?>>(dt.Rows.Count);
        foreach (DataRow r in dt.Rows)
        {
            var d = new Dictionary<string, object?>(dt.Columns.Count);
            foreach (DataColumn c in dt.Columns) d[c.ColumnName] = r[c] == DBNull.Value ? null : r[c];
            rows.Add(d);
        }
        return new TableDataDto { Rows = rows, Fields = fields, Page = page, PageSize = pageSize };
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
        }
        catch (Exception ex) { _logger.LogDebug(ex, "getOptions per-DB enrich failed"); }
        return opts;
    }

    [HttpPost("/api/tables/getIndexes")]
    public async Task<List<TableIndexDto>> GetIndexes([FromBody] TableTargetPayload p, CancellationToken ct)
    {
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
    public async Task<TableKeyUsageDto> GetKeyUsage([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var inbound = new List<ForeignKeyDto>();
        var outbound = new List<ForeignKeyDto>();
        // Per-DB FK queries are large; place reasonable defaults and let Phase 10 ForeignKeyResolver
        // (separate file) carry the full queries when DB testing surfaces gaps.
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

                var inRows = await Task.Run(() => entry.Db.Ado.SqlQuery<ForeignKeyDto>(@"
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
WHERE sc2.name = @sc AND t2.name = @t", new { sc = p.Schema, t = p.Table }), ct);
                inbound.AddRange(inRows);
            }
        }
        catch (Exception ex) { _logger.LogDebug(ex, "getKeyUsage failed"); }
        return new TableKeyUsageDto { Inbound = inbound, Outbound = outbound };
    }

    [HttpPost("/api/tables/getForeignList")]
    public async Task<List<ForeignKeyDto>> GetForeignList([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var ku = await GetKeyUsage(p, ct);
        return ku.Outbound;
    }

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
}

public sealed class RawFieldDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
}

public sealed class TableColumnDto
{
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

public sealed class TableKeyUsageDto
{
    public List<ForeignKeyDto> Inbound { get; set; } = new();
    public List<ForeignKeyDto> Outbound { get; set; } = new();
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
