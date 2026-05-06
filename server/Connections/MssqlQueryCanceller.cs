namespace Antares.Server.Connections;

/// <summary>
/// SQL Server query cancellation: KILL &lt;spid&gt;.
/// processId is the SPID returned by getProcesses (Phase 8); KILL requires the
/// connecting login to have ALTER ANY CONNECTION or sysadmin.
/// </summary>
public sealed class MssqlQueryCanceller : IQueryCanceller
{
    public string Client => "mssql";

    private readonly ConnectionRegistry _registry;

    public MssqlQueryCanceller(ConnectionRegistry registry) => _registry = registry;

    public Task CancelAsync(string uid, long processId, CancellationToken cancellationToken)
    {
        var entry = _registry.Require(uid);
        return entry.Db.Ado.ExecuteCommandAsync($"KILL {processId}", cancellationToken);
    }
}
