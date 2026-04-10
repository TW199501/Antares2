use std::sync::Mutex;
use std::process::{Command as StdCommand, Stdio};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Emitter, Manager};

static SIDECAR_PORT: Mutex<u16> = Mutex::new(0);
static SIDECAR_PID: Mutex<Option<u32>> = Mutex::new(None);

pub fn get_port() -> u16 {
    *SIDECAR_PORT.lock().unwrap()
}

pub fn spawn_server(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Use the directory where the exe lives as base
    let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or("cannot get exe parent dir")?
        .to_path_buf();
    let server_js = exe_dir.join("sidecar").join("antares-server.cjs");

    if !server_js.exists() {
        return Err(format!("Server bundle not found at {:?}", server_js).into());
    }

    // Set NODE_PATH so external requires can find modules
    let node_modules = exe_dir.join("node_modules");

    // Use bundled node.exe, not system node
    let node_exe = exe_dir.join("sidecar").join("node.exe");
    let node_bin = if node_exe.exists() {
        node_exe.to_string_lossy().to_string()
    } else {
        "node".to_string() // fallback to system node in dev mode
    };

    let mut child = StdCommand::new(&node_bin)
        .arg(server_js.to_string_lossy().to_string())
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
