using Antares.Server.Connections;
using Antares.Server.Tables;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Routines;

/// <summary>
/// /api/routines/{getInformations, create, alter, drop} — stored procedures.
/// 4 endpoints. SQLite has no stored-procedure model — returns empty / no-op.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
// NonUnify DDL exception path -> 200 + {status:"error"} (parity with
// TablesWriteService/SchemaDdlService); harmless for the unified read methods.
[Antares.Server.Infrastructure.ExceptionAsEnvelope]
public sealed class RoutinesService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    public RoutinesService(ConnectionRegistry registry) => _registry = registry;

    [HttpPost("/api/routines/getInformations")]
    public async Task<List<RoutineInfoDto>> GetInformations([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        // raw: DbMaintenance.GetProcList() returns List<DbProcInfo> (names only) — it cannot
        // supply the procedure body, which RoutineInfoDto.Sql carries (OBJECT_DEFINITION /
        // ROUTINE_DEFINITION / routine_definition) and the renderer's RoutineInfos.sql consumes.
        // Converting to GetProcList would drop the Sql field and break the wire contract, so the
        // catalog read stays raw to keep field parity.
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

    [HttpPost("/api/routines/create"), NonUnify]
    public async Task<object> Create([FromBody] RoutineDdlPayload p, CancellationToken ct)
        => await ExecAsync(p, ct);

    [HttpPost("/api/routines/alter"), NonUnify]
    public async Task<object> Alter([FromBody] RoutineDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        try { await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP PROCEDURE IF EXISTS {Quote(entry.Client, p.Name)}"), ct); } catch { /* ignore */ }
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(p.Sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/routines/drop"), NonUnify]
    public async Task<object> Drop([FromBody] RoutineDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        // raw: DbMaintenance.DropProc(name) shares the unquoted-identifier behavior empirically
        // verified for the structurally identical DbMaintenance.DropView in this same SqlSugar
        // version (5.1.4.214) — see ViewsService.Drop, which emits `DROP VIEW dbo.User` (no
        // brackets/backticks/quotes) and therefore deliberately keeps the raw per-dialect quoted
        // DROP. Both are single-identifier DDL-object drops on IDbMaintenance and share the
        // GetColumnInfosByTableName reserved-word caveat called out in CLAUDE.md. Converting to
        // DropProc would break dropping a reserved-word procedure (User/Order/Group/...) that the
        // hand-rolled per-dialect Quote() path drops correctly — a regression, not a conversion.
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
