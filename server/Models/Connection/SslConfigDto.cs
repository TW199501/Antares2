namespace Antares.Server.Models.Connection;

/// <summary>
/// Typed view of the SSL-related fields on ConnectionParamsDto.
/// Built via SslConfigDto.From(ConnectionParamsDto) when params.Ssl is true.
/// ConnectionConfigBuilder consumes this when assembling SqlSugar ConnectionConfig
/// (file paths in cert/key/ca are read with File.ReadAllText at that layer).
/// </summary>
public sealed class SslConfigDto
{
    public string? CertPath { get; init; }
    public string? KeyPath { get; init; }
    public string? CaPath { get; init; }
    public bool TrustServerCertificate { get; init; }
    public string? Ciphers { get; init; }

    public static SslConfigDto? From(ConnectionParamsDto p)
    {
        if (!p.Ssl) return null;
        return new SslConfigDto
        {
            CertPath = p.Cert,
            KeyPath = p.Key,
            CaPath = p.Ca,
            TrustServerCertificate = p.UntrustedConnection,
            Ciphers = p.Ciphers
        };
    }
}
