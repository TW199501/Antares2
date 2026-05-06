using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Antares.Server.Workers;

/// <summary>
/// Tracks in-flight long-running tasks (export/import). Each task has:
///   - taskId (Guid string)
///   - cancellation token source
///   - progress channel (writer for the worker, reader for the WS hub)
///
/// Created in Phase 13 as a skeleton; Phase 14 wires ExportTaskService and
/// Phase 15 ImportTaskService to it.
/// </summary>
public sealed class TaskRegistry
{
    public sealed class TaskHandle
    {
        public required string TaskId { get; init; }
        public required CancellationTokenSource Cts { get; init; }
        public required Channel<ProgressMessage> Progress { get; init; }
        public DateTime StartedUtc { get; init; } = DateTime.UtcNow;
        public TaskKind Kind { get; init; }
    }

    public enum TaskKind { Export, Import }

    public sealed class ProgressMessage
    {
        public string Type { get; set; } = string.Empty;
        public object? Data { get; set; }
    }

    private readonly ConcurrentDictionary<string, TaskHandle> _tasks = new();

    public TaskHandle Start(TaskKind kind)
    {
        var handle = new TaskHandle
        {
            TaskId = Guid.NewGuid().ToString("N"),
            Cts = new CancellationTokenSource(),
            Progress = Channel.CreateUnbounded<ProgressMessage>(),
            Kind = kind
        };
        _tasks[handle.TaskId] = handle;
        return handle;
    }

    public TaskHandle? Get(string taskId)
        => _tasks.TryGetValue(taskId, out var h) ? h : null;

    public bool TryFinish(string taskId)
    {
        if (!_tasks.TryRemove(taskId, out var h)) return false;
        h.Progress.Writer.TryComplete();
        try { h.Cts.Dispose(); } catch { /* ignore */ }
        return true;
    }

    public bool Cancel(string taskId)
    {
        if (!_tasks.TryGetValue(taskId, out var h)) return false;
        try { h.Cts.Cancel(); } catch { /* ignore */ }
        return true;
    }
}
