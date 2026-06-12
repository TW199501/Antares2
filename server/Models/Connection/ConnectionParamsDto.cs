using System.Text.Json.Serialization;

namespace Antares.Server.Models.Connection;

/// <summary>
/// Wire DTO matching TypeScript `web/common/interfaces/antares.ts` ConnectionParams (line 37-66).
/// Flat shape — kept identical to the renderer's JSON payload so deserialization is direct.
/// SSH and SSL sub-fields are flat here for wire compat; build typed views via
/// SshConfigDto.From / SslConfigDto.From when consuming.
/// </summary>
public sealed class ConnectionParamsDto
{
    [JsonPropertyName("uid")]
    public string Uid { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    /// <summary>One of: mysql, maria, pg, sqlite, firebird, mssql.</summary>
    [JsonPropertyName("client")]
    public string Client { get; set; } = string.Empty;

    [JsonPropertyName("host")]
    public string Host { get; set; } = string.Empty;

    [JsonPropertyName("database")]
    public string? Database { get; set; }

    [JsonPropertyName("schema")]
    public string? Schema { get; set; }

    [JsonPropertyName("databasePath")]
    public string? DatabasePath { get; set; }

    [JsonPropertyName("port")]
    public int Port { get; set; }

    [JsonPropertyName("user")]
    public string User { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;

    [JsonPropertyName("ask")]
    public bool Ask { get; set; }

    [JsonPropertyName("readonly")]
    public bool Readonly { get; set; }

    [JsonPropertyName("singleConnectionMode")]
    public bool SingleConnectionMode { get; set; }

    [JsonPropertyName("ssl")]
    public bool Ssl { get; set; }

    [JsonPropertyName("cert")]
    public string? Cert { get; set; }

    [JsonPropertyName("key")]
    public string? Key { get; set; }

    [JsonPropertyName("ca")]
    public string? Ca { get; set; }

    [JsonPropertyName("connString")]
    public string? ConnString { get; set; }

    [JsonPropertyName("untrustedConnection")]
    public bool UntrustedConnection { get; set; }

    [JsonPropertyName("ciphers")]
    public string? Ciphers { get; set; }

    [JsonPropertyName("ssh")]
    public bool Ssh { get; set; }

    [JsonPropertyName("sshHost")]
    public string? SshHost { get; set; }

    [JsonPropertyName("sshUser")]
    public string? SshUser { get; set; }

    [JsonPropertyName("sshPass")]
    public string? SshPass { get; set; }

    [JsonPropertyName("sshKey")]
    public string? SshKey { get; set; }

    [JsonPropertyName("sshPort")]
    public int? SshPort { get; set; }

    [JsonPropertyName("sshPassphrase")]
    public string? SshPassphrase { get; set; }

    [JsonPropertyName("sshKeepAliveInterval")]
    public int? SshKeepAliveInterval { get; set; }
}
