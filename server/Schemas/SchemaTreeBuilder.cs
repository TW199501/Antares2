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
                var tables = await Task.Run(() => db.Ado.SqlQuery<MssqlTableRow>(
                    "SELECT TABLE_NAME AS [Name], TABLE_TYPE AS [Type] FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema",
                    new { schema = schemaName }), ct);
                foreach (var t in tables)
                {
                    info.Tables.Add(new TableSummaryDto
                    {
                        Name = t.Name,
                        Type = t.Type == "VIEW" ? "view" : "table"
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
                var tables = await Task.Run(() => db.Ado.SqlQuery<PgTableRow>(
                    "SELECT table_name AS \"Name\", table_type AS \"Type\" FROM information_schema.tables WHERE table_schema = @schema",
                    new { schema = schemaName }), ct);
                foreach (var t in tables)
                {
                    info.Tables.Add(new TableSummaryDto
                    {
                        Name = t.Name,
                        Type = t.Type == "VIEW" ? "view" : "table"
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

    private sealed class MssqlTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; }
    private sealed class MysqlTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; public string Comment { get; set; } = ""; public string Engine { get; set; } = ""; }
    private sealed class PgTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; }
    private sealed class SqliteTableRow { public string Name { get; set; } = ""; public string Type { get; set; } = ""; }
}
