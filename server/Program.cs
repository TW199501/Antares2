using Antares.Server.Infrastructure;
using Furion;

// --probe-mode: boot, ReadyLineHook prints READY:<port>:<token>, then exit ~3s later.
// Used by `pnpm sidecar:build:net` to mechanically verify the published binary.
if (Array.Exists(args, a => a == "--probe-mode"))
{
    _ = Task.Delay(3000).ContinueWith(_ => Environment.Exit(0));
}

// Bind to a random free loopback port. Without this Furion's Serve.Run() defaults
// to ASP.NET Core's `http://localhost:5000`, which means a second sidecar instance
// (e.g. another open Antares2 window, or a CI probe overlapping a dev run) gets
// `address already in use` and the entire build / startup fails. The Tauri Rust
// shell reads the actual port from ReadyLineHook's `READY:<port>:<token>` line,
// so the renderer always learns the real port — no fixed-port assumption.
var port = PortAllocator.GetPort(development: false);
Serve.Run(urls: $"http://127.0.0.1:{port}");
