namespace Antares.Server.Connections;

/// <summary>
/// PostgreSQL query cancellation: SELECT pg_cancel_backend(&lt;pid&gt;).
/// Use pg_terminate_backend for stuck/idle-in-tx connections; cancel is the
/// standard polite signal.
/// </summary>
public sealed class PgQueryCanceller : IQueryCanceller
{
    public string Client => "pg";

    private readonly ConnectionRegistry _registry;

    public PgQueryCanceller(ConnectionRegistry registry) => _registry = registry;

    public Task CancelAsync(string uid, long processId, CancellationToken cancellationToken)
    {
        var entry = _registry.Require(uid);
        return entry.Db.Ado.ExecuteCommandAsync($"SELECT pg_cancel_backend({processId})", cancellationToken);
    }
}
