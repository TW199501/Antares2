using System.Text.Json.Serialization;
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
// NonUnify DDL (create/alter/drop/toggle) hand-shape their own envelope; this
// turns their exception path into 200 + {status:"error"} instead of a raw HTTP
// 500 the renderer can't read (parity with TablesWriteService/SchemaDdlService).
// Harmless for the non-NonUnify GetInformations read: same shape the unify
// provider's OnException already produces.
[Antares.Server.Infrastructure.ExceptionAsEnvelope]
public sealed class TriggersService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    public TriggersService(ConnectionRegistry registry) => _registry = registry;

    // raw: DTO needs Table_ (parent table) + Sql (trigger body); DbMaintenance.GetTriggerNames returns List<string> only and cannot supply either field — converting would lose contract fields the renderer consumes.
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

    // raw: user-authored CREATE TRIGGER SQL — no DbMaintenance API.
    // Renderer sends a FLAT payload ({ uid, schema, ...localTrigger }) — WorkspaceTabNewTrigger.vue:216 —
    // so the flat TriggerDdlPayload binds correctly here.
    [HttpPost("/api/triggers/create"), NonUnify]
    public async Task<object> Create([FromBody] TriggerDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(p.Sql), ct);
        return new { status = "success" };
    }

    // raw: drop-then-recreate from user-authored trigger SQL — no DbMaintenance API.
    // Renderer sends a NESTED payload ({ uid, trigger: { name, sql, schema, oldName, table } }) —
    // Triggers.ts:14 + WorkspaceTabPropsTrigger.vue:256 — so binding to the flat TriggerDdlPayload
    // left Name/Sql null and dropped DROP TRIGGER ""/ExecuteCommand(null). Bind the nested shape and
    // DROP the ORIGINAL name (oldName) so a rename works (matches upstream alterTrigger semantics).
    [HttpPost("/api/triggers/alter"), NonUnify]
    public async Task<object> Alter([FromBody] TriggerAlterPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var t = p.Trigger ?? new TriggerBody();
        var oldName = !string.IsNullOrEmpty(t.OldName) ? t.OldName! : t.Name;
        var drop = $"DROP TRIGGER {(entry.Client == "mssql" ? "" : "IF EXISTS ")}{Quote(entry.Client, oldName)}";
        try { await Task.Run(() => entry.Db.Ado.ExecuteCommand(drop), ct); } catch { /* ignore */ }
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(t.Sql), ct);
        return new { status = "success" };
    }

    // raw: DROP TRIGGER — DbMaintenance has no trigger-drop API.
    // Renderer sends the name under the key `trigger` ({ uid, schema, trigger: name }) —
    // WorkspaceExploreBarMiscContext.vue:181 — so bind via the Trigger alias (falls back to Name).
    [HttpPost("/api/triggers/drop"), NonUnify]
    public async Task<object> Drop([FromBody] TriggerDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP TRIGGER {Quote(entry.Client, p.ResolvedName)}"), ct);
        return new { status = "success" };
    }

    // raw: ENABLE/DISABLE TRIGGER (mssql/pg only) — no DbMaintenance API.
    // Renderer sends the name under the key `trigger` ({ uid, schema, trigger: name, enabled }) —
    // WorkspaceExploreBarMiscContext.vue:361 — bind via the Trigger alias. For PG the trigger name is
    // a `table.name` composite (customizations.triggerTableInName = true), so split out the parent
    // table from it. MSSQL has triggerTableInName = false and the toggle payload carries no `table`
    // field, so ON <table> can only be filled if a Table is supplied (renderer gap noted below).
    [HttpPost("/api/triggers/toggle"), NonUnify]
    public async Task<object> Toggle([FromBody] TriggerToggleDto p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var sql = BuildToggleSql(entry.Client, p);
        if (!string.IsNullOrEmpty(sql)) await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    /// <summary>
    /// Pure builder for the toggle DDL (testable offline). For PG the renderer ships the trigger as a
    /// `table.name` composite (triggerTableInName), so the parent table is parsed from it; an explicit
    /// Table on the DTO wins if present. For MSSQL the table is taken from Table when supplied.
    /// </summary>
    internal static string BuildToggleSql(string client, TriggerToggleDto p)
    {
        var name = p.ResolvedName;
        switch (client)
        {
            case "mssql":
            {
                var table = p.Table ?? string.Empty;
                return p.Enabled
                    ? $"ENABLE TRIGGER [{S(name)}] ON [{S(table)}]"
                    : $"DISABLE TRIGGER [{S(name)}] ON [{S(table)}]";
            }
            case "pg":
            {
                // PG trigger name arrives as `table.name`; split it (Table on the DTO overrides).
                var table = p.Table ?? string.Empty;
                var triggerName = name;
                var dot = name.IndexOf('.');
                if (dot >= 0)
                {
                    if (string.IsNullOrEmpty(table)) table = name.Substring(0, dot);
                    triggerName = name.Substring(dot + 1);
                }
                return $"ALTER TABLE \"{S(p.Schema)}\".\"{S(table)}\" {(p.Enabled ? "ENABLE" : "DISABLE")} TRIGGER \"{S(triggerName)}\"";
            }
            default:
                return string.Empty;
        }
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

    // Used by create (flat) and drop (renderer sends the name under `trigger`, so accept both keys).
    public sealed class TriggerDdlPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string? Schema { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;

        // Renderer's drop payload keys the name as `trigger` (WorkspaceExploreBarMiscContext.vue:184).
        [JsonPropertyName("trigger")]
        public string? Trigger { get; set; }

        [JsonIgnore]
        public string ResolvedName => !string.IsNullOrEmpty(Trigger) ? Trigger! : Name;
    }

    // alter sends { uid, trigger: { name, sql, schema, oldName, table } } (Triggers.ts:14).
    public sealed class TriggerAlterPayload
    {
        public string Uid { get; set; } = string.Empty;
        public TriggerBody? Trigger { get; set; }
    }

    public sealed class TriggerBody
    {
        public string? Schema { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;
        public string? OldName { get; set; }
        public string? Table { get; set; }
    }

    public sealed class TriggerToggleDto
    {
        public string Uid { get; set; } = string.Empty;
        public string? Schema { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Table { get; set; }
        public bool Enabled { get; set; }

        // Renderer's toggle payload keys the name as `trigger` (WorkspaceExploreBarMiscContext.vue:364).
        [JsonPropertyName("trigger")]
        public string? Trigger { get; set; }

        [JsonIgnore]
        public string ResolvedName => !string.IsNullOrEmpty(Trigger) ? Trigger! : Name;
    }
}
