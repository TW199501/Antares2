using Antares.Server.Connections;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Schemas;

/// <summary>
/// Phase 8 endpoints: /api/schema/{getCollation, getCollations, getEngines,
/// getVariables, useSchema, getProcesses, killProcess}.
///
/// Per-DB applicability (matches Node clients):
/// - getCollations: MySQL/MariaDB, PG, MSSQL — SQLite returns []
/// - getEngines: MySQL/MariaDB only — others return []
/// - getProcesses / killProcess: all 4 DBs (SQLite returns [], kill is no-op)
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class SchemaMetadataService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    private readonly IEnumerable<IQueryCanceller> _cancellers;

    public SchemaMetadataService(ConnectionRegistry registry, IEnumerable<IQueryCanceller> cancellers)
    {
        _registry = registry;
        _cancellers = cancellers;
    }

    [HttpPost("/api/schema/getCollation")]
    public async Task<string> GetCollation([FromBody] GetCollationPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        var sql = entry.Client switch
        {
            "mssql" => $"SELECT collation_name FROM sys.databases WHERE name = '{payload.Database?.Replace("'", "''")}'",
            "mysql" or "maria" => $"SELECT DEFAULT_COLLATION_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '{payload.Database?.Replace("'", "''")}'",
            "pg" => "SELECT datcollate FROM pg_database WHERE datname = current_database()",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return string.Empty;
        return await Task.Run(() => entry.Db.Ado.GetString(sql), ct) ?? string.Empty;
    }

    [HttpPost("/api/schema/getCollations")]
    public async Task<List<CollationInfoDto>> GetCollations([FromBody] ConnectionService.UidPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        return entry.Client switch
        {
            "mssql" => (await Task.Run(() => entry.Db.Ado.SqlQuery<CollationInfoDto>(
                "SELECT name AS Name, name AS Charset FROM sys.fn_helpcollations()"), ct)).ToList(),
            "mysql" or "maria" => (await Task.Run(() => entry.Db.Ado.SqlQuery<CollationInfoDto>(
                "SELECT COLLATION_NAME AS Name, CHARACTER_SET_NAME AS Charset FROM INFORMATION_SCHEMA.COLLATIONS"), ct)).ToList(),
            "pg" => (await Task.Run(() => entry.Db.Ado.SqlQuery<CollationInfoDto>(
                "SELECT collname AS \"Name\", collcollate AS \"Charset\" FROM pg_collation"), ct)).ToList(),
            _ => new List<CollationInfoDto>()
        };
    }

    [HttpPost("/api/schema/getEngines")]
    public async Task<List<EngineInfoDto>> GetEngines([FromBody] ConnectionService.UidPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        if (entry.Client is not ("mysql" or "maria")) return new List<EngineInfoDto>();
        var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<EngineInfoDto>(
            "SELECT ENGINE AS Name, SUPPORT AS Support, IFNULL(`COMMENT`,'') AS `Comment`, IFNULL(TRANSACTIONS,'') AS Transactions, IFNULL(XA,'') AS Xa, IFNULL(SAVEPOINTS,'') AS Savepoints FROM INFORMATION_SCHEMA.ENGINES"), ct);
        return rows.ToList();
    }

    [HttpPost("/api/schema/getVariables")]
    public async Task<List<VariableInfoDto>> GetVariables([FromBody] ConnectionService.UidPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        var sql = entry.Client switch
        {
            "mssql" => "SELECT name AS Name, CAST(value_in_use AS NVARCHAR(MAX)) AS Value FROM sys.configurations",
            "mysql" or "maria" => "SHOW GLOBAL VARIABLES",
            "pg" => "SELECT name AS \"Name\", setting AS \"Value\" FROM pg_settings",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new List<VariableInfoDto>();
        // MySQL SHOW returns Variable_name / Value columns — adapt:
        if (entry.Client is "mysql" or "maria")
        {
            var dt = await Task.Run(() => entry.Db.Ado.GetDataTable(sql), ct);
            var list = new List<VariableInfoDto>(dt.Rows.Count);
            foreach (System.Data.DataRow r in dt.Rows)
                list.Add(new VariableInfoDto { Name = r[0]?.ToString() ?? string.Empty, Value = r[1]?.ToString() ?? string.Empty });
            return list;
        }
        return (await Task.Run(() => entry.Db.Ado.SqlQuery<VariableInfoDto>(sql), ct)).ToList();
    }

    [HttpPost("/api/schema/useSchema"), NonUnify]
    public async Task<object> UseSchema([FromBody] UseSchemaPayload payload, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(payload.Schema)) return new { status = "success" };
        var entry = _registry.Require(payload.Uid);
        var schemaSafe = payload.Schema.Replace("\"", "").Replace("'", "''").Replace("[", "").Replace("]", "");
        var sql = entry.Client switch
        {
            "mssql" => $"USE [{schemaSafe}]",
            "mysql" or "maria" => $"USE `{schemaSafe}`",
            "pg" => $"SET search_path TO \"{schemaSafe}\"",
            _ => string.Empty   // SQLite: no-op
        };
        if (!string.IsNullOrEmpty(sql))
            await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/schema/getProcesses")]
    public async Task<List<ProcessInfoDto>> GetProcesses([FromBody] ConnectionService.UidPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        return entry.Client switch
        {
            // [User] bracketed because USER is a MSSQL reserved word — unbracketed
            // alias triggers the same `Incorrect syntax near keyword 'User'` regression
            // documented in CLAUDE.md `### .NET sidecar gotchas`.
            "mssql" => (await Task.Run(() => entry.Db.Ado.SqlQuery<ProcessInfoDto>(
                "SELECT session_id AS Id, login_name AS [User], host_name AS Host, ISNULL(database_id, 0) AS DbId, status AS State, ISNULL(CAST(total_elapsed_time AS NVARCHAR(MAX)),'') AS Time, '' AS Info FROM sys.dm_exec_sessions WHERE is_user_process = 1"), ct)).ToList(),
            "mysql" or "maria" => (await Task.Run(() => entry.Db.Ado.SqlQuery<ProcessInfoDto>(
                "SELECT ID AS Id, IFNULL(USER,'') AS `User`, IFNULL(HOST,'') AS Host, 0 AS DbId, IFNULL(STATE,'') AS State, IFNULL(CAST(`TIME` AS CHAR),'') AS Time, IFNULL(INFO,'') AS Info FROM INFORMATION_SCHEMA.PROCESSLIST"), ct)).ToList(),
            "pg" => (await Task.Run(() => entry.Db.Ado.SqlQuery<ProcessInfoDto>(
                "SELECT pid AS \"Id\", COALESCE(usename,'') AS \"User\", COALESCE(client_hostname,'') AS \"Host\", 0 AS \"DbId\", COALESCE(state,'') AS \"State\", COALESCE(state_change::text,'') AS \"Time\", COALESCE(query,'') AS \"Info\" FROM pg_stat_activity"), ct)).ToList(),
            _ => new List<ProcessInfoDto>()
        };
    }

    [HttpPost("/api/schema/killProcess"), NonUnify]
    public async Task<object> KillProcess([FromBody] KillProcessPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        var canceller = _cancellers.FirstOrDefault(c => c.Client == entry.Client);
        if (canceller is null) return new { status = "success" };
        await canceller.CancelAsync(payload.Uid, payload.Pid, ct);
        return new { status = "success" };
    }

    public sealed class GetCollationPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string? Database { get; set; }
    }
    public sealed class UseSchemaPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string Schema { get; set; } = string.Empty;
    }
    public sealed class KillProcessPayload
    {
        public string Uid { get; set; } = string.Empty;
        public long Pid { get; set; }
    }
    public sealed class CollationInfoDto
    {
        public string Name { get; set; } = string.Empty;
        public string Charset { get; set; } = string.Empty;
    }
    public sealed class EngineInfoDto
    {
        public string Name { get; set; } = string.Empty;
        public string Support { get; set; } = string.Empty;
        public string Comment { get; set; } = string.Empty;
        public string Transactions { get; set; } = string.Empty;
        public string Xa { get; set; } = string.Empty;
        public string Savepoints { get; set; } = string.Empty;
    }
    public sealed class VariableInfoDto
    {
        public string Name { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }
    public sealed class ProcessInfoDto
    {
        public long Id { get; set; }
        public string User { get; set; } = string.Empty;
        public string Host { get; set; } = string.Empty;
        public int DbId { get; set; }
        public string State { get; set; } = string.Empty;
        public string Time { get; set; } = string.Empty;
        public string Info { get; set; } = string.Empty;
    }
}
