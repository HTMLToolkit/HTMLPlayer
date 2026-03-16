// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use discord_rich_presence::{activity::Activity, DiscordIpc, DiscordIpcClient};

const DISCORD_APP_ID: &str = "1419480226970341476";
const DISCORD_LARGE_IMAGE_KEY: &str = "large_image_key";

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn set_discord_presence(details: String, state: String) -> Result<(), String> {
    let mut client = DiscordIpcClient::new(DISCORD_APP_ID);

    client.connect().map_err(|e| format!("Discord connect failed: {}", e))?;

    let activity = Activity::new()
        .details(details)
        .state(state)
        .assets(
            discord_rich_presence::activity::Assets::new()
                .large_image(DISCORD_LARGE_IMAGE_KEY)
                .large_text("HTMLPlayer"),
        );

    client
        .set_activity(activity)
        .map_err(|e| format!("Failed to set Discord activity: {}", e))
}

#[tauri::command]
fn clear_discord_presence() -> Result<(), String> {
    let mut client = DiscordIpcClient::new(DISCORD_APP_ID);

    client.connect().map_err(|e| format!("Discord connect failed: {}", e))?;
    client
        .clear_activity()
        .map_err(|e| format!("Failed to clear Discord activity: {}", e))
}

#[tauri::command]
fn is_discord_running() -> bool {
    let mut client = DiscordIpcClient::new(DISCORD_APP_ID);
    if client.connect().is_err() {
        return false;
    }

    // Ignore errors when clearing activity; we only care whether the IPC is reachable.
    let _ = client.clear_activity();
    true
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, set_discord_presence, clear_discord_presence, is_discord_running])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
