using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Antares.Server.IntegrationTests;

[Trait("Category", "skeleton")]
public sealed class SkeletonHealthTests : IAsyncLifetime
{
    private Process? _process;
    private int _port;
    private string? _token;
    private readonly HttpClient _http = new();

    public async Task InitializeAsync()
    {
        var serverProj = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "..", "server", "AntaresServer.csproj"));

        var psi = new ProcessStartInfo("dotnet", $"run --project \"{serverProj}\" --configuration Debug --no-build --no-launch-profile")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        psi.EnvironmentVariables["ASPNETCORE_ENVIRONMENT"] = "Development";

        var sw = Stopwatch.StartNew();
        _process = Process.Start(psi)!;

        // Drain stderr in background so child doesn't block on a full pipe buffer.
        _ = Task.Run(async () =>
        {
            try
            {
                while (!_process.HasExited)
                {
                    var line = await _process.StandardError.ReadLineAsync();
                    if (line is null) break;
                }
            }
            catch { /* ignore */ }
        });

        var readyLine = await ReadReadyLineAsync(_process, TimeSpan.FromSeconds(20));
        sw.Stop();

        Assert.NotNull(readyLine);
        Assert.True(sw.Elapsed < TimeSpan.FromSeconds(20),
            $"cold start {sw.ElapsedMilliseconds}ms exceeded 20s");

        var parts = readyLine!.Split(':');
        Assert.Equal("READY", parts[0]);
        _port = int.Parse(parts[1]);
        _token = parts[2];
    }

    [Fact]
    public async Task Health_returns_200_without_token()
    {
        var resp = await _http.GetAsync($"http://127.0.0.1:{_port}/health");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = (await resp.Content.ReadAsStringAsync()).Trim('"').Trim();
        Assert.Equal("ok", body);
    }

    [Fact]
    public async Task Echo_without_token_returns_401()
    {
        var resp = await _http.PostAsJsonAsync(
            $"http://127.0.0.1:{_port}/api/echo",
            new Dictionary<string, object?> { ["ping"] = "pong" });
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Echo_with_valid_token_returns_envelope()
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"http://127.0.0.1:{_port}/api/echo")
        {
            Content = JsonContent.Create(new Dictionary<string, object?> { ["ping"] = "pong" })
        };
        req.Headers.Add("X-Sidecar-Token", _token);

        var resp = await _http.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        Assert.Equal("success", doc.RootElement.GetProperty("status").GetString());
        Assert.Equal("pong",
            doc.RootElement.GetProperty("response").GetProperty("ping").GetString());
    }

    public Task DisposeAsync()
    {
        if (_process is { HasExited: false })
        {
            try { _process.Kill(entireProcessTree: true); } catch { /* ignore */ }
        }
        _http.Dispose();
        return Task.CompletedTask;
    }

    private static async Task<string?> ReadReadyLineAsync(Process p, TimeSpan timeout)
    {
        using var cts = new CancellationTokenSource(timeout);
        while (!cts.IsCancellationRequested)
        {
            var line = await p.StandardOutput.ReadLineAsync(cts.Token);
            if (line is null) return null;
            if (line.StartsWith("READY:", StringComparison.Ordinal)) return line;
        }
        return null;
    }
}
