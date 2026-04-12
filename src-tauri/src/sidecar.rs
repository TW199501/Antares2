use std::net::TcpStream;
use std::sync::Mutex;
use std::process::{Command as StdCommand, Stdio};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Emitter};

static SIDECAR_PORT: Mutex<u16> = Mutex::new(0);
static SIDECAR_PID: Mutex<Option<u32>> = Mutex::new(None);

pub fn get_port() -> u16 {
    *SIDECAR_PORT.lock().unwrap()
}

pub fn spawn_server(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or("cannot get exe parent dir")?
        .to_path_buf();

    // Dev build: exe is at <project>/src-tauri/target/debug/antares-sql.exe
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

    // Release build: use the bundled node.exe and pre-built .cjs bundle.
    #[cfg(not(debug_assertions))]
    let (node_bin, server_arg, node_modules) = {
        let server_js = exe_dir.join("sidecar").join("antares-server.cjs");
        if !server_js.exists() {
            return Err(format!("Server bundle not found at {:?}", server_js).into());
        }

        let node_exe = exe_dir.join("sidecar").join("node.exe");
        let node_bin = if node_exe.exists() {
            node_exe.to_string_lossy().to_string()
        } else {
            "node".to_string()
        };

        let node_modules = exe_dir.join("node_modules");
        (node_bin, vec![server_js.to_string_lossy().to_string()], node_modules)
    };

    let mut child = StdCommand::new(&node_bin)
        .args(&server_arg)
        .env("NODE_PATH", node_modules.to_string_lossy().to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let pid = child.id();
    *SIDECAR_PID.lock().unwrap() = Some(pid);

    let stdout = child.stdout.take().expect("Failed to capture stdout");
    let app_handle = app.clone();

    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                if line.starts_with("READY:") {
                    if let Ok(port) = line.trim_start_matches("READY:").trim().parse::<u16>() {
                        *SIDECAR_PORT.lock().unwrap() = port;
                        let _ = app_handle.emit("sidecar-ready", port);
                    }
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

    std::thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(())
}

pub fn kill_server() {
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
