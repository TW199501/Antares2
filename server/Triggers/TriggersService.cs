using Antares.Server.Connections;
using Antares.Server.Tables;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Triggers;

/// <summary>
/// /api/triggers/{getInformations, create, alter, drop, toggle} — 5 endpoints.
/// Per plan §649-660 Phase 12.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class TriggersService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    public TriggersService(ConnectionRegistry registry) => _registry = registry;

    [HttpPost("/api/triggers/getInformations")]
    public async Task<List<TriggerInfoDto>> GetInformations([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var sql = entry.Client switch
        {
            "mssql" => "SELECT t.name AS Name, OBJECT_NAME(t.parent_id) AS Table_, OBJECT_DEFINITION(t.object_id) AS Sql FROM sys.triggers t",
            "mysql" or "maria" => "SELECT TRIGGER_NAME AS Name, EVENT_OBJECT_TABLE AS Table_, ACTION_STATEMENT AS Sql FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA = @sc",
            "pg" => "SELECT trigger_name AS \"Name\", event_object_table AS \"Table_\", action_statement AS \"Sql\" FROM information_schema.triggers WHERE trigger_schema = @sc",
            "sqlite" => "SELECT name AS Name, tbl_name AS Table_, sql AS Sql FROM sqlite_master WHERE type='trigger'",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new List<TriggerInfoDto>();
        var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<TriggerInfoDto>(sql, new { sc = p.Schema }), ct);
        return rows.ToList();
    }

    [HttpPost("/api/triggers/create"), NonUnify]
    public async Task<object> Create([FromBody] TriggerDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(p.Sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/triggers/alter"), NonUnify]
    public async Task<object> Alter([FromBody] TriggerDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var drop = $"DROP TRIGGER {(entry.Client == "mssql" ? "" : "IF EXISTS ")}{Quote(entry.Client, p.Name)}";
        try { await Task.Run(() => entry.Db.Ado.ExecuteCommand(drop), ct); } catch { /* ignore */ }
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(p.Sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/triggers/drop"), NonUnify]
    public async Task<object> Drop([FromBody] TriggerDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP TRIGGER {Quote(entry.Client, p.Name)}"), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/triggers/toggle"), NonUnify]
    public async Task<object> Toggle([FromBody] TriggerToggleDto p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var sql = entry.Client switch
        {
            "mssql" => p.Enabled ? $"ENABLE TRIGGER [{S(p.Name)}] ON [{S(p.Table)}]" : $"DISABLE TRIGGER [{S(p.Name)}] ON [{S(p.Table)}]",
            "pg" => $"ALTER TABLE \"{S(p.Schema)}\".\"{S(p.Table)}\" {(p.Enabled ? "ENABLE" : "DISABLE")} TRIGGER \"{S(p.Name)}\"",
            _ => string.Empty
        };
        if (!string.IsNullOrEmpty(sql)) await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    private static string Quote(string client, string name) => client switch
    {
        "mssql" => $"[{S(name)}]",
        "mysql" or "maria" => $"`{S(name)}`",
        "pg" => $"\"{S(name)}\"",
        _ => $"\"{S(name)}\""
    };
    private static string S(string? s) => (s ?? string.Empty).Replace("[", "").Replace("]", "").Replace("`", "").Replace("\"", "").Replace(";", "");

    public sealed class TriggerInfoDto
    {
        public string Name { get; set; } = string.Empty;
        public string Table_ { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;
    }

    public sealed class TriggerDdlPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string? Schema { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;
    }

    public sealed class TriggerToggleDto
    {
        public string Uid { get; set; } = string.Empty;
        public string? Schema { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Table { get; set; } = string.Empty;
        public bool Enabled { get; set; }
    }
}
