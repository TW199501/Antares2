using System.Net;
using Antares.Server.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Xunit;

namespace Antares.Server.IntegrationTests.Infrastructure;

[Trait("Category", "unit")]
public sealed class SidecarTokenMiddlewareTests
{
    private const string Token = "deadbeef-cafe-1234-5678";

    [Fact]
    public async Task Health_bypasses_token_check_and_calls_next()
    {
        var (ctx, nextCalled) = await Invoke("/health", configure: _ => { });

        Assert.True(nextCalled.Value);
        Assert.NotEqual((int)HttpStatusCode.Unauthorized, ctx.Response.StatusCode);
    }

    [Theory]
    [InlineData("/HEALTH")]
    [InlineData("/Health")]
    public async Task Health_match_is_case_insensitive(string path)
    {
        var (_, nextCalled) = await Invoke(path, configure: _ => { });
        Assert.True(nextCalled.Value);
    }

    [Fact]
    public async Task Missing_token_returns_401_and_does_not_call_next()
    {
        var (ctx, nextCalled) = await Invoke("/api/echo", configure: _ => { });

        Assert.False(nextCalled.Value);
        Assert.Equal((int)HttpStatusCode.Unauthorized, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task Wrong_token_returns_401()
    {
        var (ctx, nextCalled) = await Invoke("/api/echo", c =>
        {
            c.Request.Headers["X-Sidecar-Token"] = "not-the-token";
        });

        Assert.False(nextCalled.Value);
        Assert.Equal((int)HttpStatusCode.Unauthorized, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task Correct_token_via_header_calls_next()
    {
        var (ctx, nextCalled) = await Invoke("/api/echo", c =>
        {
            c.Request.Headers["X-Sidecar-Token"] = Token;
        });

        Assert.True(nextCalled.Value);
        Assert.NotEqual((int)HttpStatusCode.Unauthorized, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task Token_with_different_length_is_rejected()
    {
        // Constant-time compare path: short-circuits on length mismatch but must
        // still 401 — locking the constant-time check's first guard clause.
        var (ctx, nextCalled) = await Invoke("/api/echo", c =>
        {
            c.Request.Headers["X-Sidecar-Token"] = Token + "extra";
        });

        Assert.False(nextCalled.Value);
        Assert.Equal((int)HttpStatusCode.Unauthorized, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task WebSocket_request_reads_token_from_query_string_not_header()
    {
        // Renderer's WS clients can't set custom headers; they pass ?token= instead.
        var (ctx, nextCalled) = await Invoke("/ws/export", c =>
        {
            c.Features.Set<IHttpWebSocketFeature>(new FakeWsFeature());
            c.Request.QueryString = new QueryString("?token=" + Token);
            // Header intentionally NOT set — must succeed via query.
        });

        Assert.True(nextCalled.Value);
        Assert.NotEqual((int)HttpStatusCode.Unauthorized, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task WebSocket_request_with_wrong_query_token_returns_401()
    {
        var (ctx, nextCalled) = await Invoke("/ws/export", c =>
        {
            c.Features.Set<IHttpWebSocketFeature>(new FakeWsFeature());
            c.Request.QueryString = new QueryString("?token=wrong");
        });

        Assert.False(nextCalled.Value);
        Assert.Equal((int)HttpStatusCode.Unauthorized, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task WebSocket_request_ignores_X_Sidecar_Token_header()
    {
        // When the request is a WS upgrade, the middleware should look only at ?token=,
        // not at a header. Document this by setting a valid header but no query — must 401.
        var (ctx, nextCalled) = await Invoke("/ws/export", c =>
        {
            c.Features.Set<IHttpWebSocketFeature>(new FakeWsFeature());
            c.Request.Headers["X-Sidecar-Token"] = Token;
        });

        Assert.False(nextCalled.Value);
        Assert.Equal((int)HttpStatusCode.Unauthorized, ctx.Response.StatusCode);
    }

    private static async Task<(DefaultHttpContext Ctx, MutableBool NextCalled)> Invoke(
        string path,
        Action<DefaultHttpContext> configure)
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = path;
        configure(ctx);

        var nextCalled = new MutableBool();
        RequestDelegate next = _ =>
        {
            nextCalled.Value = true;
            return Task.CompletedTask;
        };

        var mw = new SidecarTokenMiddleware(next, new StaticTokenSource(Token));
        await mw.InvokeAsync(ctx);
        return (ctx, nextCalled);
    }

    private sealed class StaticTokenSource : ITokenSource
    {
        public StaticTokenSource(string token) => Token = token;
        public string Token { get; }
    }

    private sealed class MutableBool { public bool Value { get; set; } }

    private sealed class FakeWsFeature : IHttpWebSocketFeature
    {
        public bool IsWebSocketRequest => true;
        public Task<System.Net.WebSockets.WebSocket> AcceptAsync(WebSocketAcceptContext context)
            => throw new NotImplementedException();
    }
}
