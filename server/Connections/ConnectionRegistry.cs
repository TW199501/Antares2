using System.Collections.Concurrent;
using Antares.Server.Models.Connection;
using SqlSugar;

namespace Antares.Server.Connections;

/// <summary>
/// Per-uid live connection registry. Replaces the Node sidecar's `connections` and
/// `isAborting` Records (web/main/routes/connection.ts L9-L10).
///
/// Lifecycle:
///   - Add via Add(uid, entry) when ConnectionService.connect succeeds
///   - Remove via Remove(uid) on disconnect, or by idle sweep (30 min idle, default
///     pool only — singleConnectionMode entries are never swept)
///   - Abort signal via TriggerAbort(uid) — caller (test/connect) can poll
///     entry.AbortCts.IsCancellationRequested; replaces the Node 50ms polling loop
///   - KeepAliveTimer (10 min) pings each connection so DB-side connection idle
///     timeout doesn't kill long-lived clients
/// </summary>
public sealed class ConnectionRegistry : IDisposable
{
    public sealed class Entry
    {
        public required string Uid { get; init; }
        public required string Client { get; init; }
        public required ISqlSugarClient Db { get; init; }
        public required ConnectionParamsDto Params { get; init; }
        public required bool SingleConnectionMode { get; init; }
        public DateTime LastUsedUtc { get; set; } = DateTime.UtcNow;
        public CancellationTokenSource AbortCts { get; init; } = new();
    }

    private readonly ConcurrentDictionary<string, Entry> _entries = new();
    private readonly Timer _idleSweeper;
    private readonly Timer _keepAliveTimer;
    private readonly ILogger<ConnectionRegistry> _logger;

    private static readonly TimeSpan IdleSweepInterval = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan IdleThreshold = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan KeepAliveInterval = TimeSpan.FromMinutes(10);

    public ConnectionRegistry(ILogger<ConnectionRegistry> logger)
    {
        _logger = logger;
        _idleSweeper = new Timer(_ => SweepIdle(), null, IdleSweepInterval, IdleSweepInterval);
        _keepAliveTimer = new Timer(_ => KeepAlive(), null, KeepAliveInterval, KeepAliveInterval);
    }

    public Entry? Get(string uid) => _entries.TryGetValue(uid, out var e) ? e : null;

    public bool Has(string uid) => _entries.ContainsKey(uid);

    public Entry Require(string uid)
    {
        if (_entries.TryGetValue(uid, out var e))
        {
            e.LastUsedUtc = DateTime.UtcNow;
            return e;
        }
        throw new InvalidOperationException(
            $"No active connection for uid \"{uid}\". The server may have restarted — please reconnect.");
    }

    public void Add(Entry entry) => _entries[entry.Uid] = entry;

    public bool Remove(string uid)
    {
        if (!_entries.TryRemove(uid, out var e)) return false;
        SafelyDispose(e);
        return true;
    }

    /// <summary>
    /// Signal an in-flight connect/test for this uid to abort.
    /// The connect/test action polls AbortCts.IsCancellationRequested.
    /// </summary>
    public void TriggerAbort(string uid)
    {
        if (_entries.TryGetValue(uid, out var e))
        {
            try { e.AbortCts.Cancel(); }
            catch (ObjectDisposedException) { /* race with disconnect: harmless */ }
        }
    }

    public void TouchLastUsed(string uid)
    {
        if (_entries.TryGetValue(uid, out var e)) e.LastUsedUtc = DateTime.UtcNow;
    }

    private void SweepIdle()
    {
        var threshold = DateTime.UtcNow - IdleThreshold;
        foreach (var kv in _entries)
        {
            if (kv.Value.SingleConnectionMode) continue;
            if (kv.Value.LastUsedUtc < threshold)
            {
                _logger.LogInformation("Idle-sweeping connection uid={Uid} client={Client}", kv.Key, kv.Value.Client);
                Remove(kv.Key);
            }
        }
    }

    private void KeepAlive()
    {
        foreach (var kv in _entries)
        {
            try
            {
                _ = kv.Value.Db.Ado.GetInt("SELECT 1");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "KeepAlive ping failed for uid={Uid}, removing", kv.Key);
                Remove(kv.Key);
            }
        }
    }

    private static void SafelyDispose(Entry e)
    {
        try { e.AbortCts.Dispose(); } catch { /* ignore */ }
        try { (e.Db as IDisposable)?.Dispose(); } catch { /* ignore */ }
    }

    public void Dispose()
    {
        _idleSweeper.Dispose();
        _keepAliveTimer.Dispose();
        foreach (var kv in _entries.ToArray()) Remove(kv.Key);
    }
}
