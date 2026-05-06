using System.Net;

namespace Antares.Server.Infrastructure;

public sealed class SidecarTokenMiddleware
{
    private readonly RequestDelegate _next;
    private readonly string _expectedToken;

    public SidecarTokenMiddleware(RequestDelegate next, ITokenSource tokenSource)
    {
        _next = next;
        _expectedToken = tokenSource.Token;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        if (path.Equals("/health", StringComparison.OrdinalIgnoreCase))
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
