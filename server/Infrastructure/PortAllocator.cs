using System.Net;
using System.Net.Sockets;

namespace Antares.Server.Infrastructure;

public static class PortAllocator
{
    public const int DevPort = 5555;

    public static int GetPort(bool development)
    {
        if (development) return DevPort;

        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        try
        {
            return ((IPEndPoint)listener.LocalEndpoint).Port;
        }
        finally
        {
            listener.Stop();
        }
    }
}
