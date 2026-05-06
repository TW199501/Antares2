using Antares.Server.Connections;
using Antares.Server.Models.Connection;
using Furion.DynamicApiController;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Schemas;

/// <summary>
/// Phase 7 endpoints: /api/schema/{getStructure, getVersion, rawQuery}.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class SchemaDiscoveryService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    private readonly SchemaTreeBuilder _structure;
    private readonly RawQueryExecutor _rawQuery;
    private readonly ILogger<SchemaDiscoveryService> _logger;

    public SchemaDiscoveryService(
        ConnectionRegistry registry,
        SchemaTreeBuilder structure,
        RawQueryExecutor rawQuery,
        ILogger<SchemaDiscoveryService> logger)
    {
        _registry = registry;
        _structure = structure;
        _rawQuery = rawQuery;
        _logger = logger;
    }

    [HttpPost("/api/schema/getStructure")]
    public async Task<List<SchemaInfoDto>> GetStructure([FromBody] GetStructurePayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        var schemas = payload.Schemas?.ToHashSet() ?? new HashSet<string>();
        return await _structure.BuildAsync(entry.Db, entry.Client, schemas, ct);
    }

    [HttpPost("/api/schema/getVersion")]
    public async Task<VersionInfoDto> GetVersion([FromBody] ConnectionService.UidPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        var versionSql = entry.Client switch
        {
            "mssql" => "SELECT @@VERSION",
            "mysql" or "maria" => "SELECT VERSION()",
            "pg" => "SELECT VERSION()",
            "sqlite" => "SELECT sqlite_version()",
            _ => "SELECT 'unknown'"
        };
        var raw = await Task.Run(() => entry.Db.Ado.GetString(versionSql), ct);
        return new VersionInfoDto { Number = raw, Name = entry.Client };
    }

    [HttpPost("/api/schema/rawQuery")]
    public async Task<RawQueryResultDto> RawQuery([FromBody] RawQueryPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        return await _rawQuery.ExecuteAsync(entry.Db, payload.Query, ct);
    }

    public sealed class GetStructurePayload
    {
        public string Uid { get; set; } = string.Empty;
        public List<string>? Schemas { get; set; }
    }

    public sealed class RawQueryPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string Query { get; set; } = string.Empty;
        public string? TabUid { get; set; }
    }

    public sealed class VersionInfoDto
    {
        public string Number { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }
}
