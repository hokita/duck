#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Backs TauriStoreSettingsStorage (deck settings JSON file).
        .plugin(tauri_plugin_store::Builder::default().build())
        // Persists and restores window size/position automatically.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
