mod sidecar;

#[tauri::command]
fn get_sidecar_port() -> u16 {
    sidecar::get_port()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![get_sidecar_port])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(e) = sidecar::spawn_server(&handle) {
                eprintln!("Failed to spawn sidecar: {}", e);
            }
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                sidecar::kill_server();
            }
        })
        .run(tauri::generate_context!())
        .expect("error running Antares SQL");
}
