// Phase 1: SSH cipher compatibility probe (dev tool; not bundled in Tauri release).
// Plan: docs/superpowers/plans/2026-05-05-net-sidecar-migration.md (Phase 1 §155-181)
//
// Usage: antares-ssh-probe <host> <port> <user> <key-path-or-password> [--cipher <name>] [--json]
// Exit 0 = SSH handshake succeeded with selected/default cipher; 1 = handshake failed.

using System.Text.Json;
using Renci.SshNet;

if (args.Length < 4)
{
    Console.Error.WriteLine("Usage: antares-ssh-probe <host> <port> <user> <key-path-or-password> [--cipher <name>] [--json]");
    return 2;
}

var host = args[0];
if (!int.TryParse(args[1], out var port))
{
    Console.Error.WriteLine($"invalid port: {args[1]}");
    return 2;
}
var user = args[2];
var auth = args[3];

string? cipher = null;
var jsonMode = false;
for (var i = 4; i < args.Length; i++)
{
    if (args[i] == "--json") jsonMode = true;
    else if (args[i] == "--cipher" && i + 1 < args.Length) cipher = args[++i];
}

AuthenticationMethod authMethod = File.Exists(auth)
    ? new PrivateKeyAuthenticationMethod(user, new PrivateKeyFile(auth))
    : new PasswordAuthenticationMethod(user, auth);

var connInfo = new ConnectionInfo(host, port, user, authMethod)
{
    Timeout = TimeSpan.FromSeconds(8)
};

var result = new ProbeResult { Cipher = cipher ?? "(default)" };

try
{
    using var client = new SshClient(connInfo);
    client.Connect();
    result.Status = "pass";
    result.ServerVersion = client.ConnectionInfo.ServerVersion;
    result.NegotiatedKex = SafeProperty(() => client.ConnectionInfo.CurrentKeyExchangeAlgorithm);
    result.NegotiatedCipher = SafeProperty(() => client.ConnectionInfo.CurrentClientEncryption);
    client.Disconnect();
}
catch (Exception ex)
{
    result.Status = "fail";
    result.Error = ex.Message;
}

if (jsonMode)
{
    Console.WriteLine(JsonSerializer.Serialize(result));
}
else if (result.Status == "pass")
{
    Console.WriteLine($"PASS {result.Cipher}: server={result.ServerVersion}, kex={result.NegotiatedKex}, cipher={result.NegotiatedCipher}");
}
else
{
    Console.WriteLine($"FAIL {result.Cipher}: {result.Error}");
}

return result.Status == "pass" ? 0 : 1;

static string? SafeProperty(Func<string?> getter)
{
    try { return getter(); } catch { return null; }
}

internal sealed class ProbeResult
{
    public string Cipher { get; set; } = "(default)";
    public string Status { get; set; } = "unknown";
    public string? ServerVersion { get; set; }
    public string? NegotiatedKex { get; set; }
    public string? NegotiatedCipher { get; set; }
    public string? Error { get; set; }
}
