using System.Net;

namespace Antares.Server.Infrastructure;

public sealed class SidecarTokenMiddleware
{
    private readonly RequestDelegate _next;
    private readonly string _expectedToken;
    private readonly bool _isDevelopment;

    public SidecarTokenMiddleware(RequestDelegate next, ITokenSource tokenSource, IHostEnvironment env)
    {
        _next = next;
        _expectedToken = tokenSource.Token;
        _isDevelopment = env.IsDevelopment();
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        if (path.Equals("/health", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // Dev mode: when the renderer runs in a plain browser (Playwright at
        // http://localhost:5173, no Tauri runtime), it cannot call the
        // `get_sidecar_token` Tauri command and httpClient.ts:25-26 sends an
        // empty `X-Sidecar-Token` header. Skip enforcement so `pnpm vite:dev`
        // + `dotnet run` works without a Tauri shell.
        if (_isDevelopment)
        {
            await _next(context);
            return;
        }

        string? supplied = context.WebSockets.IsWebSocketRequest
            ? context.Request.Query["token"].ToString()
            : context.Request.Headers["X-Sidecar-Token"].ToString();

        if (string.IsNullOrEmpty(supplied) || !ConstantTimeEquals(supplied, _expectedToken))
        {
            context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
            return;
        }

        await _next(context);
    }

    private static bool ConstantTimeEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var diff = 0;
        for (var i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }
}
