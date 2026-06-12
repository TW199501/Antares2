using Antares.Server.Infrastructure;
using Furion;

// --probe-mode: boot, ReadyLineHook prints READY:<port>:<token>, then exit ~3s later.
// Used by `pnpm sidecar:build:net` to mechanically verify the published binary.
if (Array.Exists(args, a => a == "--probe-mode"))
{
    _ = Task.Delay(3000).ContinueWith(_ => Environment.Exit(0));
}

// Port selection:
//   • Dev mode (ASPNETCORE_ENVIRONMENT=Development OR DOTNET_ENVIRONMENT=Development,
//     which `dotnet run` sets by default) → fixed PortAllocator.DevPort (5555).
//     The renderer's httpClient.ts:33 falls back to 5555 when running in a plain
//     browser (no Tauri runtime, e.g. Playwright at localhost:5173), so this match
//     is required for `pnpm vite:dev` + `dotnet run` workflows to work without Tauri.
//   • Release mode → random free loopback port. The Tauri Rust shell reads it from
//     ReadyLineHook's `READY:<port>:<token>` line so two installed instances don't
//     collide on a fixed port.
var isDev = string.Equals(
    Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
        ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT"),
    "Development",
    StringComparison.OrdinalIgnoreCase);
var port = PortAllocator.GetPort(development: isDev);
Serve.Run(urls: $"http://127.0.0.1:{port}");
