using Antares.Server.Connections;
using Furion.DynamicApiController;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Users;

/// <summary>
/// /api/users/getUsers — list DB users / logins. SQLite has no user model.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class UsersService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    public UsersService(ConnectionRegistry registry) => _registry = registry;

    [HttpPost("/api/users/getUsers")]
    public async Task<List<UserInfoDto>> GetUsers([FromBody] ConnectionService.UidPayload payload, CancellationToken ct)
    {
        // raw: SqlSugar's DbMaintenance has NO user/login/role enumeration API (it covers
        // tables/columns/views/indexes/procs/funcs/triggers/primaries/identities/databases only).
        // Each dialect's principal model is also semantically distinct and irreducible to a
        // cross-dialect shape — mssql server_principals (type_desc), mysql user@host (Host), pg
        // pg_roles (rolsuper -> superuser/role) — and the UserInfoDto.Type field is computed
        // per-dialect by these queries. There is nothing DbMaintenance could supply, so the
        // catalog read stays raw to keep field parity. (Same outcome as L5-Routines /
        // L6-Functions GetInformations.) The sqlite/default branch returns an empty list because
        // SQLite has no user model — documented behavior, not a swallowed exception.
        var entry = _registry.Require(payload.Uid);
        return entry.Client switch
        {
            "mssql" => (await Task.Run(() => entry.Db.Ado.SqlQuery<UserInfoDto>(
                "SELECT name AS Name, type_desc AS Type FROM sys.server_principals WHERE type IN ('S','U','G')"), ct)).ToList(),
            "mysql" or "maria" => (await Task.Run(() => entry.Db.Ado.SqlQuery<UserInfoDto>(
                "SELECT User AS Name, Host AS Type FROM mysql.user"), ct)).ToList(),
            "pg" => (await Task.Run(() => entry.Db.Ado.SqlQuery<UserInfoDto>(
                "SELECT rolname AS \"Name\", CASE WHEN rolsuper THEN 'superuser' ELSE 'role' END AS \"Type\" FROM pg_roles"), ct)).ToList(),
            _ => new List<UserInfoDto>()
        };
    }

    public sealed class UserInfoDto
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
    }
}
