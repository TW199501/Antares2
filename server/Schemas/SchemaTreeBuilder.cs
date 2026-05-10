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
        var schemaNames = requested.Count > 0
            ? requested.ToList()
            : (await Task.Run(() => db.Ado.SqlQuery<string>("SELECT name FROM sys.schemas WHERE name NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin','db_securityadmin','db_ddladmin','db_backupoperator','db_datareader','db_datawriter','db_denydatareader','db_denydatawriter')"), ct));

        foreach (var schemaName in schemaNames)
        {
            ct.ThrowIfCancellationRequested();
            var info = new SchemaInfoDto { Name = schemaName };
            try
            {
                // LEFT JOIN sys.extended_properties (class=1 = object, minor_id=0 = the
                // table itself) for MS_Description so the renderer's table list shows
                // table-level Chinese descriptions (mirrors the column-level comment fix
                // in TablesReadService.GetData / GetColumnCommentsAsync).
                // sys.objects (type 'U'=table / 'V'=view) covers both, joined by
                // schema_id + name to prevent duplicate matches when the same table
                // name exists in multiple schemas. Drives off sys.objects directly
                // (rather than INFORMATION_SCHEMA.TABLES → sys.tables) so the comment
                // join is one-to-one and view comments are returned alongside table ones.
                var tables = await Task.Run(() => db.Ado.SqlQuery<MssqlTableRow>(@"
SELECT so.name AS [Name],
       CASE so.type WHEN 'V' THEN 'VIEW' ELSE 'BASE TABLE' END AS [Type],
       ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS [Comment]
FROM sys.objects so
JOIN sys.schemas ss ON ss.schema_id = so.schema_id
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
                        Comment = t.Comment
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MSSQL schema {Schema} table enumeration failed", schemaName);
            }
            schemas.Add(info);
        }
        return schemas;
    }

    private async Task<List<SchemaInfoDto>> BuildMySqlAsync(ISqlSugarClient db, ISet<string> requested, CancellationToken ct)
    {
        var schemas = new List<SchemaInfoDto>();
        var schemaNames = requested.Count > 0
            ? requested.ToList()
            : (await Task.Run(() => db.Ado.SqlQuery<string>("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys')"), ct));

        foreach (var schemaName in schemaNames)
        {
            ct.ThrowIfCancellationRequested();
            var info = new SchemaInfoDto { Name = schemaName };
            try
            {
                var tables = await Task.Run(() => db.Ado.SqlQuery<MysqlTableRow>(
                    "SELECT TABLE_NAME AS Name, TABLE_TYPE AS Type, IFNULL(TABLE_COMMENT,'') AS Comment, IFNULL(ENGINE,'') AS Engine FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema",
                    new { schema = schemaName }), ct);
                foreach (var t in tables)
                {
                    info.Tables.Add(new TableSummaryDto
                    {
                        Name = t.Name,
                        Type = t.Type == "VIEW" ? "view" : "table",
                        Comment = t.Comment,
                        Engine = t.Engine
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MySQL schema {Schema} table enumeration failed", schemaName);
            }
            schemas.Add(info);
        }
        return schemas;
    }

    private async Task<List<SchemaInfoDto>> BuildPgAsync(ISqlSugarClient db, ISet<string> requested, CancellationToken ct)
    {
        var schemas = new List<SchemaInfoDto>();
        var schemaNames = requested.Count > 0
            ? requested.ToList()
            : (await Task.Run(() => db.Ado.SqlQuery<string>("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast','pg_temp_1','pg_toast_temp_1')"), ct));

        foreach (var schemaName in schemaNames)
        {
            ct.ThrowIfCancellationRequested();
            var info = new SchemaInfoDto { Name = schemaName };
            try
            {
                // pg_description with objsubid=0 carries the table-level COMMENT.
                // Cast oid via to_regclass for parameterized table-name lookup.
                var tables = await Task.Run(() => db.Ado.SqlQuery<PgTableRow>(@"
SELECT t.table_name AS ""Name"",
       t.table_type AS ""Type"",
       COALESCE(pgd.description, '') AS ""Comment""
FROM information_schema.tables t
LEFT JOIN pg_class      c   ON c.relname  = t.table_name
LEFT JOIN pg_namespace  ns  ON ns.oid     = c.relnamespace AND ns.nspname = t.table_schema
LEFT JOIN pg_description pgd ON pgd.objoid = c.oid AND pgd.objsubid = 0
WHERE t.table_schema = @schema",
                    new { schema = schemaName }), ct);
                foreach (var t in tables)
                {
                    info.Tables.Add(new TableSummaryDto
                    {
                        Name = t.Name,
                        Type = t.Type == "VIEW" ? "view" : "table",
                        Comment = t.Comment
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PG schema {Schema} table enumeration failed", schemaName);
            }
            schemas.Add(info);
        }
        return schemas;
    }

    private async Task<List<SchemaInfoDto>> BuildSqliteAsync(ISqlSugarClient db, CancellationToken ct)
    {
        var info = new SchemaInfoDto { Name = "main" };
        try
        {
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

    private sealed class MssqlTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; public string Comment { get; set; } = ""; }
    private sealed class MysqlTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; public string Comment { get; set; } = ""; public string Engine { get; set; } = ""; }
    private sealed class PgTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; public string Comment { get; set; } = ""; }
    private sealed class SqliteTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; }
}
