namespace Antares.Server.Connections;

/// <summary>
/// Per-DB query cancellation.
/// Phase 6 contract: ConnectionService.abort takes (uid, processId), looks up the
/// per-DB IQueryCanceller registered for the connection's client type, and calls
/// CancelAsync(processId, ct) to signal the DB-side query cancellation.
///
/// Implementations live in this namespace as MysqlQueryCanceller / PgQueryCanceller /
/// MssqlQueryCanceller / SqliteQueryCanceller (Phase 6 deliverables, not yet wired).
/// </summary>
public interface IQueryCanceller
{
    /// <summary>
    /// Connection client type this canceller handles ("mysql"|"maria"|"pg"|"mssql"|"sqlite").
    /// Used by ConnectionRegistry to dispatch.
    /// </summary>
    string Client { get; }

    /// <summary>
    /// Cancel the in-flight query identified by processId on the connection registered for uid.
    /// Throws if the connection or process is unknown — callers translate to envelope error.
    /// </summary>
    Task CancelAsync(string uid, long processId, CancellationToken cancellationToken);
}
