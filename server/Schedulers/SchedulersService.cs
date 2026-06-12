using Antares.Server.Connections;
using Antares.Server.Tables;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Schedulers;

/// <summary>
/// /api/schedulers/{getInformations, create, alter, drop, toggle} — 5 endpoints.
/// Scheduler model is per-DB:
///   MySQL/MariaDB: SHOW EVENTS / CREATE EVENT (built-in)
///   PostgreSQL:    pg_cron extension (returns [] when not installed)
///   SQL Server:    msdb.dbo.sysjobs via SQL Server Agent (returns [] when Agent not running)
///   SQLite:        no scheduler model — returns []
/// Failures are caught and surface as empty arrays per plan §674.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class SchedulersService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    private readonly ILogger<SchedulersService> _logger;
    public SchedulersService(ConnectionRegistry registry, ILogger<SchedulersService> logger)
    {
        _registry = registry;
        _logger = logger;
    }

    [HttpPost("/api/schedulers/getInformations")]
    public async Task<List<SchedulerInfoDto>> GetInformations([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        try
        {
            return entry.Client switch
            {
                "mysql" or "maria" => (await Task.Run(() => entry.Db.Ado.SqlQuery<SchedulerInfoDto>(
                    "SELECT EVENT_NAME AS Name, EVENT_DEFINITION AS Sql, STATUS AS Status FROM INFORMATION_SCHEMA.EVENTS WHERE EVENT_SCHEMA = @sc",
                    new { sc = p.Schema }), ct)).ToList(),
                "pg" => (await Task.Run(() => entry.Db.Ado.SqlQuery<SchedulerInfoDto>(
                    "SELECT jobname AS \"Name\", command AS \"Sql\", CASE WHEN active THEN 'enabled' ELSE 'disabled' END AS \"Status\" FROM cron.job"), ct)).ToList(),
                "mssql" => (await Task.Run(() => entry.Db.Ado.SqlQuery<SchedulerInfoDto>(
                    "SELECT name AS Name, '' AS Sql, CASE WHEN enabled = 1 THEN 'enabled' ELSE 'disabled' END AS Status FROM msdb.dbo.sysjobs"), ct)).ToList(),
                _ => new List<SchedulerInfoDto>()
            };
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "scheduler enumeration failed (engine likely missing pg_cron / SQL Agent)");
            return new List<SchedulerInfoDto>();
        }
    }

    [HttpPost("/api/schedulers/create"), NonUnify]
    public async Task<object> Create([FromBody] SchedulerDdlPayload p, CancellationToken ct)
        => await Exec(p, ct);

    [HttpPost("/api/schedulers/alter"), NonUnify]
    public async Task<object> Alter([FromBody] SchedulerDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        try { await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP EVENT IF EXISTS `{S(p.Name)}`"), ct); } catch { /* ignore */ }
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(p.Sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/schedulers/drop"), NonUnify]
    public async Task<object> Drop([FromBody] SchedulerDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var sql = entry.Client switch
        {
            "mysql" or "maria" => $"DROP EVENT `{S(p.Name)}`",
            _ => string.Empty
        };
        if (!string.IsNullOrEmpty(sql)) await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/schedulers/toggle"), NonUnify]
    public async Task<object> Toggle([FromBody] SchedulerToggleDto p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var sql = entry.Client switch
        {
            "mysql" or "maria" => $"ALTER EVENT `{S(p.Name)}` {(p.Enabled ? "ENABLE" : "DISABLE")}",
            _ => string.Empty
        };
        if (!string.IsNullOrEmpty(sql)) await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    private async Task<object> Exec(SchedulerDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(p.Sql), ct);
        return new { status = "success" };
    }

    private static string S(string? s) => (s ?? string.Empty).Replace("[", "").Replace("]", "").Replace("`", "").Replace("\"", "").Replace(";", "");

    public sealed class SchedulerInfoDto
    {
        public string Name { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
    }
    public sealed class SchedulerDdlPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string? Schema { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;
    }
    public sealed class SchedulerToggleDto
    {
        public string Uid { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public bool Enabled { get; set; }
    }
}
