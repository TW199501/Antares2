using Antares.Server.Connections;
using Furion.DynamicApiController;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Schemas;

/// <summary>
/// /api/databases/{getDatabases, getDatabaseComment}.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class DatabasesService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;

    public DatabasesService(ConnectionRegistry registry) => _registry = registry;

    [HttpPost("/api/databases/getDatabases")]
    public async Task<List<string>> GetDatabases([FromBody] ConnectionService.UidPayload payload, CancellationToken ct)
    {
        var entry = _registry.Require(payload.Uid);

        // mssql / mysql / maria: cross-dialect via DbMaintenance.GetDataBaseList(), which
        // returns a flat List<string> of database/schema names — exactly the contract shape
        // (tests/fixtures/contract/databases.getDatabases.*.json is a flat ["name", ...]).
        // SqlSugar's underlying queries differ in ordering, so we restore the prior
        // ORDER BY only where the new query lost it (see below).
        switch (entry.Client)
        {
            // mssql: GetDataBaseList() runs `SELECT NAME FROM master.dbo.sysdatabases
            // ORDER BY NAME` — same database-name set as the prior `sys.databases` and
            // already `ORDER BY name`. Return as-is to keep ordering byte-identical to before.
            case "mssql":
                return (await Task.Run(() => entry.Db.DbMaintenance.GetDataBaseList(), ct)).ToList();

            // mysql / maria: GetDataBaseList() runs `SHOW DATABASES`, which is UNORDERED —
            // the prior query had `ORDER BY SCHEMA_NAME`. Restore the sort to preserve the
            // contract ordering.
            case "mysql":
            case "maria":
            {
                var list = await Task.Run(() => entry.Db.DbMaintenance.GetDataBaseList(), ct);
                return list.OrderBy(name => name, StringComparer.Ordinal).ToList();
            }

            // raw: SqlSugar's PostgreSQLDbMaintenance.GetDataBaseList() runs
            // `SELECT datname FROM pg_database` with NO `datistemplate = false` filter, so it
            // would surface template0/template1 — changing the visible database list the
            // renderer shows. Keep the hand-written filtered query to preserve the contract.
            case "pg":
                return (await Task.Run(
                    () => entry.Db.Ado.SqlQuery<string>(
                        "SELECT datname AS name FROM pg_database WHERE datistemplate = false ORDER BY datname"),
                    ct)).ToList();

            // raw: sqlite is a single-file DB; SqlSugar's SqliteDbMaintenance.GetDataBaseList()
            // throws (no concept of a database list). Hardcode the single "main" database,
            // matching the prior `SELECT 'main'`.
            case "sqlite":
                return new List<string> { "main" };

            default:
                return new List<string>();
        }
    }

    [HttpPost("/api/databases/getDatabaseComment")]
    public Task<string> GetDatabaseComment([FromBody] ConnectionService.UidPayload payload, CancellationToken ct)
    {
        // Database-level comments aren't standardized across DBs; Node side returns
        // empty string on any failure (web/main/routes/databases.ts L29). We do same.
        return Task.FromResult(string.Empty);
    }
}
