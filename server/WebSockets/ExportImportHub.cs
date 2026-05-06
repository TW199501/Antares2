using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Antares.Server.Workers;

namespace Antares.Server.WebSockets;

/// <summary>
/// Phase 14 + 15: /ws/export and /ws/import raw WebSocket handlers.
/// Token check at handshake (handled by SidecarTokenMiddleware via ?token= query).
/// Streams TaskRegistry.ProgressMessage to the client and ack the
/// disconnect / cancel signal back to the worker.
///
/// Per-DB exporter / importer (Phase 14/15 deliverables) push messages onto the
/// task's Progress channel; this hub just relays them. Phase 14/15 lays down
/// the scaffolding; full per-DB SQL dump/restore is iterated against DB testing.
/// </summary>
public sealed class ExportImportHub
{
    private readonly TaskRegistry _tasks;

    public ExportImportHub(TaskRegistry tasks) => _tasks = tasks;

    public async Task HandleAsync(HttpContext context, TaskRegistry.TaskKind kind)
    {
        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync($"WebSocket required for /ws/{kind.ToString().ToLowerInvariant()}");
            return;
        }

        var taskId = context.Request.Query["taskId"].ToString();
        var handle = _tasks.Get(taskId);
        if (handle is null || handle.Kind != kind)
        {
            context.Response.StatusCode = 404;
            return;
        }

        using var ws = await context.WebSockets.AcceptWebSocketAsync();

        // Background reader: relay progress messages to the WS client.
        var relay = Task.Run(async () =>
        {
            try
            {
                await foreach (var msg in handle.Progress.Reader.ReadAllAsync(handle.Cts.Token))
                {
                    if (ws.State != WebSocketState.Open) break;
                    var bytes = JsonSerializer.SerializeToUtf8Bytes(msg);
                    await ws.SendAsync(bytes, WebSocketMessageType.Text, true, handle.Cts.Token);
                }
            }
            catch (OperationCanceledException) { /* expected on cancel */ }
        });

        // Foreground: read client messages (mostly cancel signals); finish on close.
        var buffer = new byte[4096];
        try
        {
            while (ws.State == WebSocketState.Open)
            {
                var result = await ws.ReceiveAsync(buffer, handle.Cts.Token);
                if (result.MessageType == WebSocketMessageType.Close) break;
                var text = Encoding.UTF8.GetString(buffer, 0, result.Count);
                if (text.Contains("\"cancel\"", StringComparison.OrdinalIgnoreCase))
                    _tasks.Cancel(taskId);
            }
        }
        catch (OperationCanceledException) { /* expected */ }
        catch (WebSocketException) { /* client dropped */ }
        finally
        {
            await relay;
            _tasks.TryFinish(taskId);
            try
            {
                if (ws.State == WebSocketState.Open)
                    await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None);
            }
            catch { /* ignore */ }
        }
    }
}
