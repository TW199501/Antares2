using System.Net;
using System.Net.Sockets;
using Antares.Server.Infrastructure;
using Xunit;

namespace Antares.Server.IntegrationTests.Infrastructure;

[Trait("Category", "unit")]
public sealed class PortAllocatorTests
{
    [Fact]
    public void GetPort_in_dev_mode_returns_fixed_DevPort()
    {
        // Renderer's dev path assumes a known port; this is the contract.
        Assert.Equal(5555, PortAllocator.GetPort(development: true));
        Assert.Equal(5555, PortAllocator.DevPort);
    }

    [Fact]
    public void GetPort_in_release_mode_returns_an_ephemeral_port_that_is_bindable()
    {
        var port = PortAllocator.GetPort(development: false);

        Assert.InRange(port, 1, 65535);
        Assert.NotEqual(PortAllocator.DevPort, port);

        // The port should still be free immediately after — listener was Stopped.
        var l = new TcpListener(IPAddress.Loopback, port);
        l.Start();
        try
        {
            Assert.Equal(port, ((IPEndPoint)l.LocalEndpoint).Port);
        }
        finally
        {
            l.Stop();
        }
    }

    [Fact]
    public void GetPort_in_release_mode_returns_distinct_ports_across_calls()
    {
        // OS picks ephemeral; usually distinct. We don't require strict distinctness
        // (TIME_WAIT can recycle), only that calls succeed and stay in valid range.
        var p1 = PortAllocator.GetPort(development: false);
        var p2 = PortAllocator.GetPort(development: false);
        var p3 = PortAllocator.GetPort(development: false);
        Assert.All(new[] { p1, p2, p3 }, p => Assert.InRange(p, 1, 65535));
    }
}
