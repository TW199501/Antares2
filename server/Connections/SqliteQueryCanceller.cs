namespace Antares.Server.Connections;

/// <summary>
/// SQLite has no remote process model — no KILL primitive. The Microsoft.Data.Sqlite
/// driver's only cancel path is SqliteCommand.Cancel() on the in-flight command
/// instance. ConnectionRegistry doesn't track per-command handles yet, so this
/// canceller is a no-op contract stub for ConnectionService.abort.
/// </summary>
public sealed class SqliteQueryCanceller : IQueryCanceller
{
    public string Client => "sqlite";

    public Task CancelAsync(string uid, long processId, CancellationToken cancellationToken)
        => Task.CompletedTask;
}
