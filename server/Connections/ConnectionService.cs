using Antares.Server.Models.Connection;
using Antares.Server.Schemas;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;
using SqlSugar;

namespace Antares.Server.Connections;

/// <summary>
/// /api/connection/{test,connect,disconnect,abort,check} — 5 actions matching
/// web/main/routes/connection.ts behavior 1:1.
///
/// Routes are explicitly named via [HttpPost] to avoid Furion's pure-verb routing
/// (which would map Test() → POST /api/connection without an action segment).
///
/// Class-level [NonUnify]: every action below already returns a hand-shaped
/// `{status, response}` envelope (matching the legacy Node sidecar contract);
/// without this attribute Furion's EnvelopeResultProvider.OnSucceeded would
/// wrap them again, producing `{status: "success", response: {status: "...", response: ...}}`
/// — the renderer would always read outer status="success" even when the inner
/// status is "error", silently swallowing every connect/test failure.
/// </summary>
[ApiDescriptionSettings(KeepName = true), NonUnify]
public sealed class ConnectionService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    private readonly SshTunnelService _ssh;
    private readonly SchemaTreeBuilder _structureBuilder;
    private readonly ILogger<ConnectionService> _logger;

    public ConnectionService(
        ConnectionRegistry registry,
        SshTunnelService ssh,
        SchemaTreeBuilder structureBuilder,
        ILogger<ConnectionService> logger)
    {
        _registry = registry;
        _ssh = ssh;
        _structureBuilder = structureBuilder;
        _logger = logger;
    }

    [HttpPost("/api/connection/test")]
    public async Task<object> Test([FromBody] ConnectionParamsDto p, CancellationToken ct)
    {
        // If there's a pre-existing entry for this uid (from a previous in-flight
        // attempt), use its AbortCts so /api/connection/abort can short-circuit.
        var abortCts = _registry.Get(p.Uid)?.AbortCts ?? new CancellationTokenSource();
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, abortCts.Token);

        uint? sshLocalPort = null;
        ISqlSugarClient? db = null;
        try
        {
            sshLocalPort = _ssh.Open(p.Uid, p);
            var paramsForBuild = sshLocalPort.HasValue ? RewriteForSshLocal(p, sshLocalPort.Value) : p;

            var config = ConnectionConfigBuilder.Build(paramsForBuild, poolSize: 1);
            db = new SqlSugarScope(config);

            // Probe the connection: SELECT 1 round-trip.
            await Task.Run(() => db.Ado.GetInt("SELECT 1"), linked.Token);

            if (linked.IsCancellationRequested)
                return new { status = "abort", response = "Connection aborted" };

            return new { status = "success" };
        }
        catch (OperationCanceledException) when (linked.IsCancellationRequested)
        {
            return new { status = "abort", response = "Connection aborted" };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Connection test failed for uid={Uid} client={Client}", p.Uid, p.Client);
            return new { status = "error", response = ex.Message };
        }
        finally
        {
            try { (db as IDisposable)?.Dispose(); } catch { /* ignore */ }
            if (sshLocalPort.HasValue) _ssh.Close(p.Uid);
        }
    }

    /// <summary>
    /// Ephemeral connect → list databases → disconnect. Used by the Add/Edit
    /// connection panel's database dropdown so users pick from a real list
    /// before saving the connection (and before it lives in the registry).
    /// Same connect/dispose pattern as Test() above.
    /// </summary>
    [HttpPost("/api/connection/listDatabases")]
    public async Task<object> ListDatabases([FromBody] ConnectionParamsDto p, CancellationToken ct)
    {
        uint? sshLocalPort = null;
        ISqlSugarClient? db = null;
        try
        {
            sshLocalPort = _ssh.Open(p.Uid, p);
            var paramsForBuild = sshLocalPort.HasValue ? RewriteForSshLocal(p, sshLocalPort.Value) : p;

            var config = ConnectionConfigBuilder.Build(paramsForBuild, poolSize: 1);
            db = new SqlSugarScope(config);

            var sql = p.Client switch
            {
                "mssql" => "SELECT name FROM sys.databases ORDER BY name",
                "mysql" or "maria" => "SELECT SCHEMA_NAME AS name FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY SCHEMA_NAME",
                "pg" => "SELECT datname AS name FROM pg_database WHERE datistemplate = false ORDER BY datname",
                "sqlite" => "SELECT 'main' AS name",
                _ => null
            };
            if (sql is null)
                return new { status = "error", response = $"Unsupported client: {p.Client}" };

            var rows = await Task.Run(() => db.Ado.SqlQuery<string>(sql), ct);
            return new { status = "success", response = rows };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "List databases failed for client={Client}", p.Client);
            return new { status = "error", response = ex.Message };
        }
        finally
        {
            try { (db as IDisposable)?.Dispose(); } catch { /* ignore */ }
            if (sshLocalPort.HasValue) _ssh.Close(p.Uid);
        }
    }

    [HttpPost("/api/connection/connect")]
    public async Task<object> Connect([FromBody] ConnectionParamsDto p, CancellationToken ct)
    {
        // Fresh AbortCts; old entry (if any) is replaced.
        if (_registry.Has(p.Uid)) _registry.Remove(p.Uid);

        uint? sshLocalPort = null;
        try
        {
            sshLocalPort = _ssh.Open(p.Uid, p);
            var paramsForBuild = sshLocalPort.HasValue ? RewriteForSshLocal(p, sshLocalPort.Value) : p;

            var poolSize = p.SingleConnectionMode ? 1 : 5;
            var config = ConnectionConfigBuilder.Build(paramsForBuild, poolSize);
            ISqlSugarClient db = new SqlSugarScope(config);

            await Task.Run(() => db.Ado.GetInt("SELECT 1"), ct);

            var entry = new ConnectionRegistry.Entry
            {
                Uid = p.Uid,
                Client = p.Client?.ToLowerInvariant() ?? string.Empty,
                Db = db,
                Params = p,
                SingleConnectionMode = p.SingleConnectionMode
            };
            _registry.Add(entry);

            List<SchemaInfoDto> structure;
            try
            {
                var requested = !string.IsNullOrEmpty(p.Schema)
                    ? new HashSet<string> { p.Schema }
                    : new HashSet<string>();
                structure = await _structureBuilder.BuildAsync(db, entry.Client, requested, ct);
            }
            catch (Exception structErr)
            {
                _logger.LogError(structErr, "[connect] getStructure failed for uid={Uid}", p.Uid);
                structure = new List<SchemaInfoDto>();
            }

            return new { status = "success", response = structure };
        }
        catch (OperationCanceledException)
        {
            if (sshLocalPort.HasValue) _ssh.Close(p.Uid);
            return new { status = "abort", response = "Connection aborted" };
        }
        catch (Exception ex)
        {
            if (sshLocalPort.HasValue) _ssh.Close(p.Uid);
            _logger.LogWarning(ex, "Connection failed for uid={Uid} client={Client}", p.Uid, p.Client);
            return new { status = "error", response = ex.Message };
        }
    }

    [HttpPost("/api/connection/disconnect")]
    public object Disconnect([FromBody] UidPayload payload)
    {
        try
        {
            _registry.Remove(payload.Uid);
            _ssh.Close(payload.Uid);
            return new { status = "success" };
        }
        catch (Exception ex)
        {
            return new { status = "error", response = ex.Message };
        }
    }

    [HttpPost("/api/connection/abort")]
    public object Abort([FromBody] UidPayload payload)
    {
        _registry.TriggerAbort(payload.Uid);
        return new { status = "success" };
    }

    [HttpPost("/api/connection/check")]
    public object Check([FromBody] UidPayload payload)
    {
        return new { status = "success", response = _registry.Has(payload.Uid) };
    }

    /// <summary>
    /// When SSH tunneling, the SqlSugar config must point at the local forwarded
    /// port instead of the real DB host:port.
    /// </summary>
    private static ConnectionParamsDto RewriteForSshLocal(ConnectionParamsDto p, uint localPort)
    {
        return new ConnectionParamsDto
        {
            Uid = p.Uid, Name = p.Name, Client = p.Client,
            Host = "127.0.0.1", Port = (int)localPort,
            Database = p.Database, Schema = p.Schema, DatabasePath = p.DatabasePath,
            User = p.User, Password = p.Password,
            Ask = p.Ask, Readonly = p.Readonly, SingleConnectionMode = p.SingleConnectionMode,
            Ssl = p.Ssl, Cert = p.Cert, Key = p.Key, Ca = p.Ca, ConnString = p.ConnString,
            UntrustedConnection = p.UntrustedConnection, Ciphers = p.Ciphers,
            Ssh = false  // tunneling already happened, downstream config builder shouldn't try again
        };
    }

    public sealed class UidPayload
    {
        public string Uid { get; set; } = string.Empty;
    }
}
