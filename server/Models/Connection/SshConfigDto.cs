namespace Antares.Server.Models.Connection;

/// <summary>
/// Typed view of the SSH-tunnel-related fields on ConnectionParamsDto.
/// Built via SshConfigDto.From(ConnectionParamsDto) when params.Ssh is true.
/// SshTunnelService consumes this rather than reaching into raw flat fields.
/// </summary>
public sealed class SshConfigDto
{
    public string Host { get; init; } = string.Empty;
    public int Port { get; init; } = 22;
    public string User { get; init; } = string.Empty;
    public string? Password { get; init; }
    public string? KeyPath { get; init; }
    public string? Passphrase { get; init; }
    public int KeepAliveSeconds { get; init; } = 60;

    public static SshConfigDto? From(ConnectionParamsDto p)
    {
        if (!p.Ssh || string.IsNullOrEmpty(p.SshHost) || string.IsNullOrEmpty(p.SshUser))
            return null;
        return new SshConfigDto
        {
            Host = p.SshHost,
            Port = p.SshPort ?? 22,
            User = p.SshUser,
            Password = p.SshPass,
            KeyPath = p.SshKey,
            Passphrase = p.SshPassphrase,
            KeepAliveSeconds = p.SshKeepAliveInterval ?? 60
        };
    }
}
