using Antares.Server.Connections;
using Antares.Server.Tables;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Functions;

/// <summary>
/// /api/functions/{getInformations, create, alter, drop, createTriggerFunction,
/// alterTriggerFunction} — 6 endpoints. TriggerFunction is PG-specific
/// (plpgsql trigger function objects); other DBs use functions only.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class FunctionsService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    public FunctionsService(ConnectionRegistry registry) => _registry = registry;

    [HttpPost("/api/functions/getInformations")]
    public async Task<List<FunctionInfoDto>> GetInformations([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        // raw: DbMaintenance.GetFuncList() yields function names only — it cannot supply the
        // function body, which FunctionInfoDto.Sql carries (OBJECT_DEFINITION / ROUTINE_DEFINITION /
        // pg_get_functiondef) and the renderer consumes. Converting to GetFuncList would drop the
        // Sql field and break the wire contract, so the catalog read stays raw to keep field parity.
        var entry = _registry.Require(p.Uid);
        var sql = entry.Client switch
        {
            "mssql" => "SELECT name AS Name, OBJECT_DEFINITION(object_id) AS Sql FROM sys.objects WHERE type IN ('FN','IF','TF')",
            "mysql" or "maria" => "SELECT ROUTINE_NAME AS Name, ROUTINE_DEFINITION AS Sql FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = @sc AND ROUTINE_TYPE='FUNCTION'",
            "pg" => "SELECT proname AS \"Name\", pg_get_functiondef(p.oid) AS \"Sql\" FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = @sc AND p.prokind = 'f'",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new List<FunctionInfoDto>();
        var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<FunctionInfoDto>(sql, new { sc = p.Schema }), ct);
        return rows.ToList();
    }

    [HttpPost("/api/functions/create"), NonUnify]
    public async Task<object> Create([FromBody] FunctionDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(p.Sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/functions/alter"), NonUnify]
    public async Task<object> Alter([FromBody] FunctionDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        try { await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP FUNCTION IF EXISTS {Quote(entry.Client, p.Name)}"), ct); } catch { /* ignore */ }
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(p.Sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/functions/drop"), NonUnify]
    public async Task<object> Drop([FromBody] FunctionDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        // raw: DbMaintenance.DropFunction(name) emits an UNQUOTED identifier in this SqlSugar
        // version (5.1.4.214) — empirically locked in L6-FunctionsTests, and the same behavior
        // verified for the structurally identical DbMaintenance.DropProc (L5) / DropView (L3).
        // Converting would break dropping a reserved-word function (User/Order/Group/...) that the
        // hand-rolled per-dialect Quote() path drops correctly — a regression, not a conversion.
        await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP FUNCTION {Quote(entry.Client, p.Name)}"), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/functions/createTriggerFunction"), NonUnify]
    public async Task<object> CreateTriggerFunction([FromBody] FunctionDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        if (entry.Client != "pg") throw new NotSupportedException("trigger functions require PostgreSQL");
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(p.Sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/functions/alterTriggerFunction"), NonUnify]
    public async Task<object> AlterTriggerFunction([FromBody] FunctionDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        if (entry.Client != "pg") throw new NotSupportedException("trigger functions require PostgreSQL");
        try { await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP FUNCTION IF EXISTS \"{S(p.Name)}\""), ct); } catch { /* ignore */ }
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

    public sealed class FunctionInfoDto
    {
        public string Name { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;
    }

    public sealed class FunctionDdlPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string? Schema { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;
    }
}
