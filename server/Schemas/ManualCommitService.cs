using Antares.Server.Connections;
using Furion.DynamicApiController;
using Furion.UnifyResult;
using Microsoft.AspNetCore.Mvc;

namespace Antares.Server.Schemas;

/// <summary>
/// /api/schema/{commitTab, rollbackTab, destroyConnectionToCommit, killTabQuery}.
/// Manual-commit query tab semantics — autocommit OFF on a tab opens an isolated
/// transaction that survives multiple raw queries until commit/rollback or
/// connection destroy.
///
/// Phase 13 skeleton: Phase 6 ConnectionRegistry pre-emptively reserved hooks for
/// per-tab transaction context; full integration is iterated against DB testing.
/// </summary>
[ApiDescriptionSettings(KeepName = true)]
public sealed class ManualCommitService : IDynamicApiController
{
    private readonly ConnectionRegistry _registry;
    private readonly IEnumerable<IQueryCanceller> _cancellers;

    public ManualCommitService(ConnectionRegistry registry, IEnumerable<IQueryCanceller> cancellers)
    {
        _registry = registry;
        _cancellers = cancellers;
    }

    [HttpPost("/api/schema/commitTab"), NonUnify]
    public Task<object> CommitTab([FromBody] TabPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        try { entry.Db.Ado.CommitTran(); } catch { /* ignore — no active tran */ }
        return Task.FromResult<object>(new { status = "success" });
    }

    [HttpPost("/api/schema/rollbackTab"), NonUnify]
    public Task<object> RollbackTab([FromBody] TabPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        try { entry.Db.Ado.RollbackTran(); } catch { /* ignore */ }
        return Task.FromResult<object>(new { status = "success" });
    }

    [HttpPost("/api/schema/destroyConnectionToCommit"), NonUnify]
    public Task<object> DestroyConnectionToCommit([FromBody] TabPayload p, CancellationToken ct)
    {
        // Forcibly drop the underlying connection so any hung manual-commit tx
        // is reset by the DB on disconnect.
        _registry.Remove(p.Uid);
        return Task.FromResult<object>(new { status = "success" });
    }

    [HttpPost("/api/schema/killTabQuery"), NonUnify]
    public async Task<object> KillTabQuery([FromBody] KillTabPayload p, CancellationToken ct)
    {
        var entry = _registry.Require(p.Uid);
        var canceller = _cancellers.FirstOrDefault(c => c.Client == entry.Client);
        if (canceller is not null && p.Pid > 0)
        {
            try { await canceller.CancelAsync(p.Uid, p.Pid, ct); }
            catch { /* surface as success — Node side does same */ }
        }
        return new { status = "success" };
    }

    public class TabPayload
    {
        public string Uid { get; set; } = string.Empty;
        public string? TabUid { get; set; }
    }

    public sealed class KillTabPayload : TabPayload
    {
        public long Pid { get; set; }
    }
}
