using System.Collections.Concurrent;
using Antares.Server.Models.Connection;
using Renci.SshNet;
using SshConnectionInfo = Renci.SshNet.ConnectionInfo;

namespace Antares.Server.Connections;

/// <summary>
/// Manages SSH tunnels for connections that bridge through a jump host.
///
/// One tunnel per uid. Tunnel forwards a local ephemeral port to the
/// remote DB host:port; the SqlSugar ConnectionConfig is then built against
/// 127.0.0.1:&lt;localPort&gt;. On disconnect, the tunnel is closed.
/// </summary>
public sealed class SshTunnelService : IDisposable
{
    private readonly ConcurrentDictionary<string, ActiveTunnel> _tunnels = new();
    private readonly ILogger<SshTunnelService> _logger;

    public SshTunnelService(ILogger<SshTunnelService> logger) => _logger = logger;

    private sealed class ActiveTunnel : IDisposable
    {
        public required SshClient Client { get; init; }
        public required ForwardedPortLocal Port { get; init; }
        public required uint LocalPort { get; init; }

        public void Dispose()
        {
            try { Port.Stop(); } catch { /* ignore */ }
            try { Client.Disconnect(); } catch { /* ignore */ }
            try { Client.Dispose(); } catch { /* ignore */ }
        }
    }

    /// <summary>
    /// Open a tunnel for the given uid + ssh config + remote DB endpoint.
    /// Returns the local port the caller should connect to. If no SSH config
    /// is provided, returns null and the caller connects directly.
    /// </summary>
    public uint? Open(string uid, ConnectionParamsDto p)
    {
        var ssh = SshConfigDto.From(p);
        if (ssh is null) return null;

        var auth = !string.IsNullOrEmpty(ssh.KeyPath)
            ? (AuthenticationMethod)new PrivateKeyAuthenticationMethod(
                ssh.User,
                string.IsNullOrEmpty(ssh.Passphrase)
                    ? new PrivateKeyFile(ssh.KeyPath)
                    : new PrivateKeyFile(ssh.KeyPath, ssh.Passphrase))
            : new PasswordAuthenticationMethod(ssh.User, ssh.Password ?? string.Empty);

        var connInfo = new SshConnectionInfo(ssh.Host, ssh.Port, ssh.User, auth)
        {
            Timeout = TimeSpan.FromSeconds(15)
        };
        if (ssh.KeepAliveSeconds > 0)
            connInfo.MaxSessions = 10;

        var client = new SshClient(connInfo);
        client.KeepAliveInterval = TimeSpan.FromSeconds(ssh.KeepAliveSeconds);
        client.Connect();

        var localPort = (uint)PickFreePort();
        var port = new ForwardedPortLocal("127.0.0.1", localPort, p.Host, (uint)p.Port);
        client.AddForwardedPort(port);
        port.Start();

        _tunnels[uid] = new ActiveTunnel { Client = client, Port = port, LocalPort = localPort };
        _logger.LogInformation("SSH tunnel opened: uid={Uid} {Host}:{Port} via {SshHost}:{SshPort} → local 127.0.0.1:{LocalPort}",
            uid, p.Host, p.Port, ssh.Host, ssh.Port, localPort);
        return localPort;
    }

    public void Close(string uid)
    {
        if (_tunnels.TryRemove(uid, out var t)) t.Dispose();
    }

    private static int PickFreePort()
    {
        var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        try { return ((System.Net.IPEndPoint)listener.LocalEndpoint).Port; }
        finally { listener.Stop(); }
    }

    public void Dispose()
    {
        foreach (var kv in _tunnels.ToArray()) Close(kv.Key);
    }
}
