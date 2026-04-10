use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

static SIDECAR_PORT: Mutex<u16> = Mutex::new(0);
static SIDECAR_CHILD: Mutex<Option<CommandChild>> = Mutex::new(None);

pub fn get_port() -> u16 {
    *SIDECAR_PORT.lock().unwrap()
}

pub fn spawn_server(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let sidecar = app.shell().sidecar("antares-server")?;
    let (mut rx, child) = sidecar.spawn()?;

    *SIDECAR_CHILD.lock().unwrap() = Some(child);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    if line_str.starts_with("READY:") {
                        if let Ok(port) = line_str.trim_start_matches("READY:").trim().parse::<u16>() {
                            *SIDECAR_PORT.lock().unwrap() = port;
                            let _ = app_handle.emit("sidecar-ready", port);
                        }
                    }
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("sidecar stderr: {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Error(err) => {
                    eprintln!("sidecar error: {}", err);
                }
                CommandEvent::Terminated(status) => {
                    eprintln!("sidecar terminated: {:?}", status);
                }
                _ => {}
            }
        }
    });

    Ok(())
}

pub fn kill_server() {
    if let Some(child) = SIDECAR_CHILD.lock().unwrap().take() {
        let _ = child.kill();
    }
}
