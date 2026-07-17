use tauri_plugin_store::StoreExt;

mod sources;

const SETTINGS_STORE_FILE: &str = "settings.json";
const SETTINGS_KEY: &str = "duck.deck-settings";

// Fixed path and key, deliberately not parameters: the WebView is granted no
// store:* permission (see capabilities/default.json), so the only way for the
// frontend to read or write settings is through these two commands, which
// can't be pointed at an arbitrary file.
#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let store = app.store(SETTINGS_STORE_FILE).map_err(|error| error.to_string())?;
    Ok(store.get(SETTINGS_KEY))
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, value: serde_json::Value) -> Result<(), String> {
    let store = app.store(SETTINGS_STORE_FILE).map_err(|error| error.to_string())?;
    store.set(SETTINGS_KEY, value);
    store.save().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Registered for its Rust-side Store API only, used by load_settings/
        // save_settings above.
        .plugin(tauri_plugin_store::Builder::default().build())
        // Persists and restores window size/position automatically.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            sources::list_source_pages,
            sources::activate_source_button
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
