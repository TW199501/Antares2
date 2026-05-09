using Antares.Server.Infrastructure;
using Xunit;

namespace Antares.Server.IntegrationTests.Infrastructure;

/// <summary>
/// ReadyLineHook prints `READY:&lt;port&gt;:&lt;token&gt;` on the stdout pipe — the line
/// that src-tauri/src/sidecar.rs parses to learn where the sidecar bound. The
/// port-extraction is non-trivial because Kestrel reports things like "http://[::]:5555"
/// or "http://0.0.0.0:5555" which Uri can't parse directly.
/// </summary>
[Trait("Category", "unit")]
public sealed class ReadyLineHookTests
{
    [Fact]
    public void ParsePort_returns_zero_for_null_or_empty()
    {
        Assert.Equal(0, ReadyLineHook.ParsePort(null));
        Assert.Equal(0, ReadyLineHook.ParsePort(""));
    }

    [Theory]
    [InlineData("http://127.0.0.1:5555", 5555)]
    [InlineData("http://localhost:54321", 54321)]
    [InlineData("https://127.0.0.1:443", 443)]
    public void ParsePort_handles_loopback_addresses(string address, int expected)
    {
        Assert.Equal(expected, ReadyLineHook.ParsePort(address));
    }

    [Fact]
    public void ParsePort_normalizes_IPv6_any_to_loopback_then_extracts_port()
    {
        // Kestrel default in dev: "http://[::]:5555" — Uri parser can't handle "[::]" alone,
        // so the hook substitutes 127.0.0.1 before constructing the Uri.
        Assert.Equal(5555, ReadyLineHook.ParsePort("http://[::]:5555"));
    }

    [Fact]
    public void ParsePort_normalizes_IPv4_any_to_loopback_then_extracts_port()
    {
        // Kestrel binding to 0.0.0.0 also surfaces here.
        Assert.Equal(8080, ReadyLineHook.ParsePort("http://0.0.0.0:8080"));
    }

    [Fact]
    public void ParsePort_handles_random_ephemeral_port_in_release_pattern()
    {
        // PortAllocator picks an ephemeral port in release; ReadyLineHook must round-trip it.
        var port = PortAllocator.GetPort(development: false);
        var address = $"http://[::]:{port}";
        Assert.Equal(port, ReadyLineHook.ParsePort(address));
    }
}
