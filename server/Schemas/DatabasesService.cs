using Antares.Server.Connections;
using Furion.DynamicApiController;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Schemas;

/// <summary>
/// /api/databases/{getDatabases, getDatabaseComment}.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class DatabasesService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;

    public DatabasesService(ConnectionRegistry registry) => _registry = registry;

    [HttpPost("/api/databases/getDatabases")]
    public async Task<List<DatabaseInfoDto>> GetDatabases([FromBody] ConnectionService.UidPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        var sql = entry.Client switch
        {
            "mssql" => "SELECT name FROM sys.databases ORDER BY name",
            "mysql" or "maria" => "SELECT SCHEMA_NAME AS name FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY SCHEMA_NAME",
            "pg" => "SELECT datname AS name FROM pg_database WHERE datistemplate = false ORDER BY datname",
            "sqlite" => "SELECT 'main' AS name",
            _ => "SELECT '' AS name WHERE 1=0"
        };
        var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<string>(sql), ct);
        return rows.Select(n => new DatabaseInfoDto { Database = n }).ToList();
    }

    [HttpPost("/api/databases/getDatabaseComment")]
    public Task<string> GetDatabaseComment([FromBody] ConnectionService.UidPayload payload, CancellationToken ct)
    {
        // Database-level comments aren't standardized across DBs; Node side returns
        // empty string on any failure (web/main/routes/databases.ts L29). We do same.
        return Task.FromResult(string.Empty);
    }

    public sealed class DatabaseInfoDto
    {
        public string Database { get; set; } = string.Empty;
    }
}
