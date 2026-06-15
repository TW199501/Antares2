using Antares.Server.Models.Connection;
using SqlSugar;

namespace Antares.Server.Schemas;

/// <summary>
/// Builds the schema tree for /api/connection/connect and /api/schema/getStructure.
/// Uses SqlSugar DbMaintenance for the cross-DB common parts (tables, views) and
/// per-DB raw SQL for stats (row count, size). Routines/triggers/functions/schedulers
/// are Phase 12 deliverables and currently come back as empty arrays.
/// </summary>
public sealed class SchemaTreeBuilder
{
    private readonly ILogger<SchemaTreeBuilder> _logger;

    public SchemaTreeBuilder(ILogger<SchemaTreeBuilder> logger) => _logger = logger;

    public async Task<List<SchemaInfoDto>> BuildAsync(
        ISqlSugarClient db,
        string client,
        ISet<string> requestedSchemas,
        CancellationToken cancellationToken)
    {
        return client switch
        {
            "mssql" => await BuildMssqlAsync(db, requestedSchemas, cancellationToken),
            "mysql" or "maria" => await BuildMySqlAsync(db, requestedSchemas, cancellationToken),
            "pg" => await BuildPgAsync(db, requestedSchemas, cancellationToken),
            "sqlite" => await BuildSqliteAsync(db, cancellationToken),
            _ => new List<SchemaInfoDto>()
        };
    }

    private async Task<List<SchemaInfoDto>> BuildMssqlAsync(ISqlSugarClient db, ISet<string> requested, CancellationToken ct)
    {
        var schemas = new List<SchemaInfoDto>();
        // raw: schema enumeration with explicit system-schema exclusion list; DbMaintenance.GetDataBaseList lists databases, not user schemas, and offers no system-schema filter.
        var schemaNames = requested.Count > 0
            ? requested.ToList()
            : (await Task.Run(() => db.Ado.SqlQuery<string>("SELECT name FROM sys.schemas WHERE name NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin','db_securityadmin','db_ddladmin','db_backupoperator','db_datareader','db_datawriter','db_denydatareader','db_denydatawriter')"), ct));

        foreach (var schemaName in schemaNames)
        {
            ct.ThrowIfCancellationRequested();
            var info = new SchemaInfoDto { Name = schemaName };
            try
            {
                // raw: CTE-heavy metadata read (partition row counts, allocation-page sizes, MS_Description comments) — DbMaintenance.GetTableInfoList supplies only Name/Description, losing Rows/Size the tree needs.
                // LEFT JOIN sys.extended_properties (class=1 = object, minor_id=0 = the
                // table itself) for MS_Description so the renderer's table list shows
                // table-level Chinese descriptions (mirrors the column-level comment fix
                // in TablesReadService.GetData / GetColumnCommentsAsync).
                // sys.objects (type 'U'=table / 'V'=view) covers both, joined by
                // schema_id + name to prevent duplicate matches. TableMeta CTE
                // aggregates partition rows + allocated pages for the heap or
                // clustered index (index_id IN 0,1) → multiplied by 8KB page size
                // for the byte total. Views naturally LEFT JOIN to NULL → 0.
                var tables = await Task.Run(() => db.Ado.SqlQuery<MssqlTableRow>(@"
WITH TableMeta AS (
    SELECT t.object_id,
           SUM(p.rows)              AS [Rows],
           SUM(a.total_pages) * 8 * 1024 AS [Size]
    FROM sys.tables t
    JOIN sys.indexes      i ON i.object_id = t.object_id AND i.index_id IN (0, 1)
    JOIN sys.partitions   p ON p.object_id = i.object_id AND p.index_id = i.index_id
    JOIN sys.allocation_units a ON a.container_id = p.partition_id
    GROUP BY t.object_id
)
SELECT so.name AS [Name],
       CASE so.type WHEN 'V' THEN 'VIEW' ELSE 'BASE TABLE' END AS [Type],
       ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS [Comment],
       CAST(ISNULL(tm.[Rows], 0) AS BIGINT) AS [Rows],
       CAST(ISNULL(tm.[Size], 0) AS BIGINT) AS [Size]
FROM sys.objects so
JOIN sys.schemas ss ON ss.schema_id = so.schema_id
LEFT JOIN TableMeta tm ON tm.object_id = so.object_id
LEFT JOIN sys.extended_properties ep
       ON ep.major_id = so.object_id
      AND ep.minor_id = 0
      AND ep.class    = 1
      AND ep.name     = 'MS_Description'
WHERE so.type IN ('U','V') AND ss.name = @schema",
                    new { schema = schemaName }), ct);
                foreach (var t in tables)
                {
                    info.Tables.Add(new TableSummaryDto
                    {
                        Name = t.Name,
                        Type = t.Type == "VIEW" ? "view" : "table",
                        Comment = t.Comment,
                        Rows = t.Rows,
                        Size = t.Size
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MSSQL schema {Schema} table enumeration failed", schemaName);
            }
            // Roll up table sizes into the schema/database total so the renderer's
            // db-level pie indicator (WorkspaceExploreBarSchema.vue:32 `v-if="database.size"`) renders.
            info.Size = info.Tables.Sum(t => t.Size);
            schemas.Add(info);
        }
        return schemas;
    }

    private async Task<List<SchemaInfoDto>> BuildMySqlAsync(ISqlSugarClient db, ISet<string> requested, CancellationToken ct)
    {
        var schemas = new List<SchemaInfoDto>();
        // raw: schema enumeration with explicit system-schema exclusion list; DbMaintenance.GetDataBaseList offers no system-schema filter.
        var schemaNames = requested.Count > 0
            ? requested.ToList()
            : (await Task.Run(() => db.Ado.SqlQuery<string>("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys')"), ct));

        foreach (var schemaName in schemaNames)
        {
            ct.ThrowIfCancellationRequested();
            var info = new SchemaInfoDto { Name = schemaName };
            try
            {
                // raw: metadata-heavy read (TABLE_ROWS, DATA_LENGTH+INDEX_LENGTH size, TABLE_COMMENT, ENGINE, TABLE_COLLATION) — DbMaintenance.GetTableInfoList cannot supply these fields.
                // TABLE_ROWS for InnoDB is an estimate (use SHOW TABLE STATUS / ANALYZE
                // to refresh stats). DATA_LENGTH+INDEX_LENGTH gives the on-disk byte
                // total. TABLE_COLLATION is per-table (separate from per-column).
                var tables = await Task.Run(() => db.Ado.SqlQuery<MysqlTableRow>(@"
SELECT TABLE_NAME                        AS Name,
       TABLE_TYPE                        AS Type,
       IFNULL(TABLE_COMMENT, '')         AS Comment,
       IFNULL(ENGINE, '')                AS Engine,
       IFNULL(TABLE_ROWS, 0)             AS `Rows`,
       IFNULL(DATA_LENGTH + INDEX_LENGTH, 0) AS `Size`,
       IFNULL(TABLE_COLLATION, '')       AS Collation
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = @schema",
                    new { schema = schemaName }), ct);
                foreach (var t in tables)
                {
                    info.Tables.Add(new TableSummaryDto
                    {
                        Name = t.Name,
                        Type = t.Type == "VIEW" ? "view" : "table",
                        Comment = t.Comment,
                        Engine = t.Engine,
                        Rows = t.Rows,
                        Size = t.Size,
                        Collation = t.Collation
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MySQL schema {Schema} table enumeration failed", schemaName);
            }
            // Roll up table sizes into the schema/database total so the renderer's
            // db-level pie indicator (WorkspaceExploreBarSchema.vue:32 `v-if="database.size"`) renders.
            info.Size = info.Tables.Sum(t => t.Size);
            schemas.Add(info);
        }
        return schemas;
    }

    private async Task<List<SchemaInfoDto>> BuildPgAsync(ISqlSugarClient db, ISet<string> requested, CancellationToken ct)
    {
        var schemas = new List<SchemaInfoDto>();
        // raw: schema enumeration with explicit system-schema exclusion list; DbMaintenance.GetDataBaseList offers no system-schema filter.
        var schemaNames = requested.Count > 0
            ? requested.ToList()
            : (await Task.Run(() => db.Ado.SqlQuery<string>("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast','pg_temp_1','pg_toast_temp_1')"), ct));

        foreach (var schemaName in schemaNames)
        {
            ct.ThrowIfCancellationRequested();
            var info = new SchemaInfoDto { Name = schemaName };
            try
            {
                // raw: metadata-heavy read (n_live_tup row estimate, pg_total_relation_size bytes, pg_description comments via multi-join) — DbMaintenance.GetTableInfoList cannot supply these fields.
                // pg_stat_user_tables.n_live_tup is the planner's row estimate (cheap,
                // refreshed by ANALYZE). pg_total_relation_size includes table + indexes
                // + TOAST in bytes. Views: LEFT JOINs naturally yield 0/empty.
                var tables = await Task.Run(() => db.Ado.SqlQuery<PgTableRow>(@"
SELECT t.table_name AS ""Name"",
       t.table_type AS ""Type"",
       COALESCE(pgd.description, '') AS ""Comment"",
       COALESCE(s.n_live_tup, 0)::BIGINT AS ""Rows"",
       COALESCE(pg_total_relation_size(c.oid), 0)::BIGINT AS ""Size""
FROM information_schema.tables t
LEFT JOIN pg_class      c   ON c.relname  = t.table_name
LEFT JOIN pg_namespace  ns  ON ns.oid     = c.relnamespace AND ns.nspname = t.table_schema
LEFT JOIN pg_description pgd ON pgd.objoid = c.oid AND pgd.objsubid = 0
LEFT JOIN pg_stat_user_tables s ON s.schemaname = t.table_schema AND s.relname = t.table_name
WHERE t.table_schema = @schema",
                    new { schema = schemaName }), ct);
                foreach (var t in tables)
                {
                    info.Tables.Add(new TableSummaryDto
                    {
                        Name = t.Name,
                        Type = t.Type == "VIEW" ? "view" : "table",
                        Comment = t.Comment,
                        Rows = t.Rows,
                        Size = t.Size
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PG schema {Schema} table enumeration failed", schemaName);
            }
            // Roll up table sizes into the schema/database total so the renderer's
            // db-level pie indicator (WorkspaceExploreBarSchema.vue:32 `v-if="database.size"`) renders.
            info.Size = info.Tables.Sum(t => t.Size);
            schemas.Add(info);
        }
        return schemas;
    }

    private async Task<List<SchemaInfoDto>> BuildSqliteAsync(ISqlSugarClient db, CancellationToken ct)
    {
        var info = new SchemaInfoDto { Name = "main" };
        try
        {
            // raw: single sqlite_master sweep returns tables+views interleaved in catalog
            // order with the literal 'table'/'view' type the DTO needs, and excludes
            // sqlite_% internal objects. Splitting into DbMaintenance.GetTableInfoList +
            // GetViewInfoList would reorder (tables-then-views), drop the type literal
            // (DbObjectType enum needs remapping), and cannot be verified to filter
            // sqlite_% the same way — a contract risk for no metadata gain. Keep raw.
            var tables = await Task.Run(() => db.Ado.SqlQuery<SqliteTableRow>(
                "SELECT name AS Name, type AS Type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'"), ct);
            foreach (var t in tables)
            {
                info.Tables.Add(new TableSummaryDto
                {
                    Name = t.Name,
                    Type = t.Type
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SQLite table enumeration failed");
        }
        return new List<SchemaInfoDto> { info };
    }

    private sealed class MssqlTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; public string Comment { get; set; } = ""; public long Rows { get; set; } public long Size { get; set; } }
    private sealed class MysqlTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; public string Comment { get; set; } = ""; public string Engine { get; set; } = ""; public long Rows { get; set; } public long Size { get; set; } public string Collation { get; set; } = ""; }
    private sealed class PgTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; public string Comment { get; set; } = ""; public long Rows { get; set; } public long Size { get; set; } }
    private sealed class SqliteTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; }
}
