using Antares.Server.Connections;
using Antares.Server.Tables;
using Furion.DynamicApiController;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Routines;

/// <summary>
/// /api/routines/{getInformations, create, alter, drop} — stored procedures.
/// 4 endpoints. SQLite has no stored-procedure model — returns empty / no-op.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class RoutinesService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    public RoutinesService(ConnectionRegistry registry) => _registry = registry;

    [HttpPost("/api/routines/getInformations")]
    public async Task<List<RoutineInfoDto>> GetInformations([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var sql = entry.Client switch
        {
            "mssql" => "SELECT name AS Name, OBJECT_DEFINITION(object_id) AS Sql FROM sys.procedures",
            "mysql" or "maria" => "SELECT ROUTINE_NAME AS Name, ROUTINE_DEFINITION AS Sql FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = @sc AND ROUTINE_TYPE='PROCEDURE'",
            "pg" => "SELECT routine_name AS \"Name\", routine_definition AS \"Sql\" FROM information_schema.routines WHERE routine_schema = @sc AND routine_type = 'PROCEDURE'",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new List<RoutineInfoDto>();
        var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<RoutineInfoDto>(sql, new { sc = p.Schema }), ct);
        return rows.ToList();
    }

    [HttpPost("/api/routines/create")]
    public async Task<object> Create([FromBody] RoutineDdlPayload p, CancellationToken ct)
        => await ExecAsync(p, ct);

    [HttpPost("/api/routines/alter")]
    public async Task<object> Alter([FromBody] RoutineDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        try { await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP PROCEDURE IF EXISTS {Quote(entry.Client, p.Name)}"), ct); } catch { /* ignore */ }
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(p.Sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/routines/drop")]
    public async Task<object> Drop([FromBody] RoutineDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP PROCEDURE {Quote(entry.Client, p.Name)}"), ct);
        return new { status = "success" };
    }

    private async Task<object> ExecAsync(RoutineDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(p.Sql), ct);
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

    public sealed class RoutineInfoDto
    {
        public string Name { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;
    }

    public sealed class RoutineDdlPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string? Schema { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;
    }
}
