using Furion;

// --probe-mode: boot, ReadyLineHook prints READY:<port>:<token>, then exit ~3s later.
// Used by `pnpm sidecar:build:net` to mechanically verify the published binary.
if (Array.Exists(args, a => a == "--probe-mode"))
{
    _ = Task.Delay(3000).ContinueWith(_ => Environment.Exit(0));
}

Serve.Run();
