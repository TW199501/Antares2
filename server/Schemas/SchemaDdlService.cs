using Antares.Server.Connections;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Schemas;

/// <summary>
/// Phase 9 endpoints: /api/schema/{create, update, delete} — schema-level
/// CREATE / ALTER / DROP DATABASE.
///
/// Per-DB rules:
/// - MySQL/MariaDB: charset + collation are top-level options
/// - PG: ENCODING is fixed at create-time; ALTER DATABASE handles renames + owner
/// - MSSQL: bracket-quoted name; OWNER is sp_changedbowner (Phase 12 detail)
/// - SQLite: no schema concept — see Node SQLiteClient behavior; create/drop manage
///   attached database files. Currently no-op pending Phase 12 SQLite-specific path.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class SchemaDdlService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;

    public SchemaDdlService(ConnectionRegistry registry) => _registry = registry;

    [HttpPost("/api/schema/create"), NonUnify]
    public async Task<object> Create([FromBody] SchemaDdlPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        var name = SafeName(payload.Name);
        var sql = entry.Client switch
        {
            "mssql" => $"CREATE DATABASE [{name}]",
            "mysql" or "maria" => string.IsNullOrEmpty(payload.Collation)
                ? $"CREATE DATABASE `{name}`"
                : $"CREATE DATABASE `{name}` CHARACTER SET {SafeIdent(payload.Charset ?? "utf8mb4")} COLLATE {SafeIdent(payload.Collation)}",
            "pg" => $"CREATE DATABASE \"{name}\"" + (string.IsNullOrEmpty(payload.Charset) ? "" : $" ENCODING '{payload.Charset?.Replace("'", "''")}'"),
            "sqlite" => string.Empty,   // SQLite: create only via file open at connect
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new { status = "success" };
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/schema/update"), NonUnify]
    public async Task<object> Update([FromBody] SchemaDdlPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        var name = SafeName(payload.Name);
        var sql = entry.Client switch
        {
            "mysql" or "maria" when !string.IsNullOrEmpty(payload.Collation)
                => $"ALTER DATABASE `{name}` CHARACTER SET {SafeIdent(payload.Charset ?? "utf8mb4")} COLLATE {SafeIdent(payload.Collation)}",
            "pg" when !string.IsNullOrEmpty(payload.Charset)
                => $"ALTER DATABASE \"{name}\" SET timezone TO '{payload.Charset?.Replace("'", "''")}'",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new { status = "success" };
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    [HttpPost("/api/schema/delete"), NonUnify]
    public async Task<object> Delete([FromBody] SchemaDdlPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);
        var name = SafeName(payload.Name);
        var sql = entry.Client switch
        {
            "mssql" => $"DROP DATABASE [{name}]",
            "mysql" or "maria" => $"DROP DATABASE `{name}`",
            "pg" => $"DROP DATABASE \"{name}\"",
            "sqlite" => string.Empty,   // SQLite: drop via file delete (Phase 12 wiring)
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(sql)) return new { status = "success" };
        await Task.Run(() => entry.Db.Ado.ExecuteCommand(sql), ct);
        return new { status = "success" };
    }

    private static string SafeName(string? n) =>
        (n ?? string.Empty).Replace("[", "").Replace("]", "").Replace("`", "").Replace("\"", "").Replace(";", "");

    private static string SafeIdent(string n) =>
        (n ?? string.Empty).Replace("'", "").Replace("`", "").Replace(";", "");

    public sealed class SchemaDdlPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Charset { get; set; }
        public string? Collation { get; set; }
    }
}
