#[cfg(debug_assertions)]
use std::net::TcpStream;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::process::{Command as StdCommand, Stdio};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Emitter};

static SIDECAR_PORT: Mutex<u16> = Mutex::new(0);
static SIDECAR_TOKEN: Mutex<String> = Mutex::new(String::new());
static SIDECAR_PID: Mutex<Option<u32>> = Mutex::new(None);
static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);

pub fn get_port() -> u16 {
    *SIDECAR_PORT.lock().unwrap()
}

pub fn get_token() -> String {
    SIDECAR_TOKEN.lock().unwrap().clone()
}

pub fn spawn_server(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or("cannot get exe parent dir")?
        .to_path_buf();

    // Dev build: exe is at <project>/src-tauri/target/debug/antares2.exe
    // Vite's sidecarPlugin already starts the server on port 5555 during `tauri dev`.
    // If port 5555 is already in use, reuse it instead of starting a second process.
    #[cfg(debug_assertions)]
    {
        const DEV_PORT: u16 = 5555;
        if TcpStream::connect(format!("127.0.0.1:{}", DEV_PORT)).is_ok() {
            *SIDECAR_PORT.lock().unwrap() = DEV_PORT;
            let _ = app.emit("sidecar-ready", DEV_PORT);
            return Ok(());
        }
    }

    // Dev build: run the TypeScript source directly via tsx to avoid __dirname issues in the .cjs bundle.
    #[cfg(debug_assertions)]
    let (node_bin, server_arg, node_modules) = {
        let project_root = exe_dir
            .parent()          // target/
            .and_then(|p| p.parent())  // src-tauri/
            .and_then(|p| p.parent())  // project root
            .ok_or("cannot find project root from exe path")?
            .to_path_buf();

        let tsx_cli = project_root.join("node_modules").join("tsx").join("dist").join("cli.cjs");
        let server_ts = project_root.join("src").join("main").join("server.ts");
        let node_modules = project_root.join("node_modules");

        if !tsx_cli.exists() {
            return Err(format!("tsx not found at {:?}", tsx_cli).into());
        }
        if !server_ts.exists() {
            return Err(format!("server.ts not found at {:?}", server_ts).into());
        }

        ("node".to_string(), vec![tsx_cli.to_string_lossy().to_string(), server_ts.to_string_lossy().to_string()], node_modules)
    };

    // Release build: spawn the .NET 10 self-contained single-file sidecar binary.
    // Phase 17 cutover (plan v5): replaced `sidecar/antares-server.cjs` + bundled
    // node runtime with a single `antares-server[.exe]` produced by `pnpm sidecar:build:net`.
    // To roll back to the Node sidecar, `git revert` the Phase-17 commit — the Node
    // build script (scripts/build-sidecar.mjs) and bundle remain in the tree until Phase 18.
    #[cfg(not(debug_assertions))]
    let (node_bin, server_arg, node_modules) = {
        #[cfg(windows)]
        let bin_name = "antares-server.exe";
        #[cfg(not(windows))]
        let bin_name = "antares-server";

        let server_bin = exe_dir.join(bin_name);
        if !server_bin.exists() {
            return Err(format!(".NET sidecar binary not found at {:?}", server_bin).into());
        }
        // node_modules is unused in the .NET path; keep the binding for the shared
        // command-build code below (NODE_PATH env var is harmless for the .NET binary).
        let node_modules = exe_dir.clone();
        (server_bin.to_string_lossy().to_string(), Vec::<String>::new(), node_modules)
    };

    #[allow(unused_mut)]
    let mut cmd = StdCommand::new(&node_bin);
    cmd.args(&server_arg)
        .env("NODE_PATH", node_modules.to_string_lossy().to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Hide the console window on Windows (CREATE_NO_WINDOW = 0x08000000)
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    let mut child = cmd.spawn()?;

    let pid = child.id();
    *SIDECAR_PID.lock().unwrap() = Some(pid);

    let stdout = child.stdout.take().expect("Failed to capture stdout");
    let app_handle = app.clone();

    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                if line.starts_with("READY:") {
                    let rest = line.trim_start_matches("READY:").trim();
                    let parts: Vec<&str> = rest.splitn(2, ':').collect();
                    if let Some(port_str) = parts.first() {
                        if let Ok(port) = port_str.parse::<u16>() {
                            *SIDECAR_PORT.lock().unwrap() = port;
                        }
                    }
                    if let Some(token) = parts.get(1) {
                        *SIDECAR_TOKEN.lock().unwrap() = token.to_string();
                    }
                    let port = *SIDECAR_PORT.lock().unwrap();
                    let _ = app_handle.emit("sidecar-ready", port);
                }
            }
        }
    });

    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    eprintln!("sidecar: {}", line);
                }
            }
        });
    }

    let app_handle_restart = app.clone();
    std::thread::spawn(move || {
        let status = child.wait();
        if SHUTTING_DOWN.load(Ordering::Relaxed) { return; }
        let code = status.ok().and_then(|s| s.code()).unwrap_or(-1);
        if code != 0 {
            eprintln!("sidecar: exited with code {} — restarting in 1s", code);
            std::thread::sleep(std::time::Duration::from_secs(1));
            if !SHUTTING_DOWN.load(Ordering::Relaxed) {
                let _ = spawn_server(&app_handle_restart);
            }
        }
    });

    Ok(())
}

pub fn kill_server() {
    SHUTTING_DOWN.store(true, Ordering::Relaxed);
    if let Some(pid) = SIDECAR_PID.lock().unwrap().take() {
        #[cfg(windows)]
        {
            let _ = StdCommand::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F", "/T"])
                .output();
        }
        #[cfg(not(windows))]
        {
            unsafe {
                libc::kill(pid as i32, libc::SIGTERM);
            }
        }
    }
}
