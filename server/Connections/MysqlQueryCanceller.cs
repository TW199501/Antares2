namespace Antares.Server.Connections;

/// <summary>
/// MySQL/MariaDB query cancellation: KILL QUERY &lt;process-id&gt;.
/// Phase 6 stub — full implementation lands when ConnectionRegistry has the
/// per-uid process-id tracking (currently abort signal works on the connect/test
/// in-flight path, not arbitrary query cancellation).
/// </summary>
public sealed class MysqlQueryCanceller : IQueryCanceller
{
    public string Client => "mysql";

    private readonly ConnectionRegistry _registry;

    public MysqlQueryCanceller(ConnectionRegistry registry) => _registry = registry;

    public Task CancelAsync(string uid, long processId, CancellationToken cancellationToken)
    {
        var entry = _registry.Require(uid);
        return entry.Db.Ado.ExecuteCommandAsync($"KILL QUERY {processId}", cancellationToken);
    }
}
