using Antares.Server.Connections;
using Antares.Server.Tables;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Views;

/// <summary>
/// /api/views/{getInformations, create, alter, drop} regular views +
/// /api/views/{getMaterializedInformations, createMaterialized, alterMaterialized, dropMaterialized} (PG only).
/// 8 endpoints total. Per plan §649-660 Phase 12.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class ViewsService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    public ViewsService(ConnectionRegistry registry) => _registry = registry;

    [HttpPost("/api/views/getInformations")]
    public async Task<List<ViewInfoDto>> GetInformations([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var sql = entry.Client switch
        {
            "mssql" => "SELECT v.name AS Name, OBJECT_DEFINITION(v.object_id) AS Sql FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id WHERE s.name = @sc",
            "mysql" or "maria" => "SELECT TABLE_NAME AS Name, VIEW_DEFINITION AS Sql FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = @sc",
            "pg" => "SELECT viewname AS \"Name\", definition AS \"Sql\" FROM pg_views WHERE schemaname = @sc",
            "sqlite" => "SELECT name AS Name, sql AS Sql FROM sqlite_master WHERE type='view'",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new List<ViewInfoDto>();
        var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<ViewInfoDto>(sql, new { sc = p.Schema }), ct);
        return rows.ToList();
    }

    [HttpPost("/api/views/create"), NonUnify]
    public async Task<object> Create([FromBody] ViewDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(BuildCreateView(entry.Client, p, materialized: false)), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/views/alter"), NonUnify]
    public async Task<object> Alter([FromBody] ViewDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var dropSql = entry.Client switch
        {
            "pg" => $"DROP VIEW IF EXISTS \"{S(p.Schema)}\".\"{S(p.Name)}\"",
            "mssql" => $"DROP VIEW IF EXISTS [{S(p.Schema)}].[{S(p.Name)}]",
            "mysql" or "maria" => $"DROP VIEW IF EXISTS `{S(p.Schema)}`.`{S(p.Name)}`",
            "sqlite" => $"DROP VIEW IF EXISTS \"{S(p.Name)}\"",
            _ => string.Empty
        };
        if (!string.IsNullOrEmpty(dropSql)) await Task.Run(() => entry.Db.Ado.ExecuteCommand(dropSql), ct);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(BuildCreateView(entry.Client, p, materialized: false)), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/views/drop"), NonUnify]
    public async Task<object> Drop([FromBody] ViewDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var sql = entry.Client switch
        {
            "pg" => $"DROP VIEW \"{S(p.Schema)}\".\"{S(p.Name)}\"",
            "mssql" => $"DROP VIEW [{S(p.Schema)}].[{S(p.Name)}]",
            "mysql" or "maria" => $"DROP VIEW `{S(p.Schema)}`.`{S(p.Name)}`",
            "sqlite" => $"DROP VIEW \"{S(p.Name)}\"",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new { status = "success" };
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/views/getMaterializedInformations")]
    public async Task<List<ViewInfoDto>> GetMaterialized([FromBody] TableTargetPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        if (entry.Client != "pg") return new List<ViewInfoDto>();
        var rows = await Task.Run(() => entry.Db.Ado.SqlQuery<ViewInfoDto>(
            "SELECT matviewname AS \"Name\", definition AS \"Sql\" FROM pg_matviews WHERE schemaname = @sc",
            new { sc = p.Schema }), ct);
        return rows.ToList();
    }

    [HttpPost("/api/views/createMaterialized"), NonUnify]
    public async Task<object> CreateMaterialized([FromBody] ViewDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        if (entry.Client != "pg") throw new NotSupportedException("materialized views require PostgreSQL");
        await Task.Run(() => entry.Db.Ado.ExecuteCommand($"CREATE MATERIALIZED VIEW \"{S(p.Schema)}\".\"{S(p.Name)}\" AS {p.Sql}"), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/views/alterMaterialized"), NonUnify]
    public async Task<object> AlterMaterialized([FromBody] ViewDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        if (entry.Client != "pg") throw new NotSupportedException("materialized views require PostgreSQL");
        await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP MATERIALIZED VIEW IF EXISTS \"{S(p.Schema)}\".\"{S(p.Name)}\""), ct);
        await Task.Run(() => entry.Db.Ado.ExecuteCommand($"CREATE MATERIALIZED VIEW \"{S(p.Schema)}\".\"{S(p.Name)}\" AS {p.Sql}"), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/views/dropMaterialized"), NonUnify]
    public async Task<object> DropMaterialized([FromBody] ViewDdlPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        if (entry.Client != "pg") throw new NotSupportedException("materialized views require PostgreSQL");
        await Task.Run(() => entry.Db.Ado.ExecuteCommand($"DROP MATERIALIZED VIEW \"{S(p.Schema)}\".\"{S(p.Name)}\""), ct);
        return new { status = "success" };
    }

    private static string BuildCreateView(string client, ViewDdlPayload p, bool materialized) => client switch
    {
        "mssql" => $"CREATE VIEW [{S(p.Schema)}].[{S(p.Name)}] AS {p.Sql}",
        "mysql" or "maria" => $"CREATE VIEW `{S(p.Schema)}`.`{S(p.Name)}` AS {p.Sql}",
        "pg" => $"CREATE VIEW \"{S(p.Schema)}\".\"{S(p.Name)}\" AS {p.Sql}",
        "sqlite" => $"CREATE VIEW \"{S(p.Name)}\" AS {p.Sql}",
        _ => string.Empty
    };

    private static string S(string? s) => (s ?? string.Empty).Replace("[", "").Replace("]", "").Replace("`", "").Replace("\"", "").Replace(";", "");

    public sealed class ViewInfoDto
    {
        public string Name { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;
    }

    public sealed class ViewDdlPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string? Schema { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Sql { get; set; } = string.Empty;
    }
}
