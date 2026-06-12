using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

namespace Antares.Server.Infrastructure;

public sealed class ReadyLineHook : IHostedService
{
    private readonly IServer _server;
    private readonly IHostApplicationLifetime _lifetime;
    private readonly ITokenSource _tokenSource;

    public ReadyLineHook(IServer server, IHostApplicationLifetime lifetime, ITokenSource tokenSource)
    {
        _server = server;
        _lifetime = lifetime;
        _tokenSource = tokenSource;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _lifetime.ApplicationStarted.Register(() =>
        {
            var addresses = _server.Features.Get<IServerAddressesFeature>()?.Addresses;
            var port = ParsePort(addresses?.FirstOrDefault());
            Console.WriteLine($"READY:{port}:{_tokenSource.Token}");
            Console.Out.Flush();
        });
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    internal static int ParsePort(string? address)
    {
        if (string.IsNullOrEmpty(address)) return 0;
        var normalized = address.Replace("[::]", "127.0.0.1").Replace("0.0.0.0", "127.0.0.1");
        return new Uri(normalized).Port;
    }
}
