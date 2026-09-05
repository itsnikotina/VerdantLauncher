use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::{Arc, Mutex};
use tauri::State;

pub struct DiscordState {
    pub client: Arc<Mutex<Option<DiscordIpcClient>>>,
}

#[tauri::command]
pub fn set_discord_rpc(
    state: State<'_, DiscordState>,
    details: String,
    state_str: String,
    large_image_key: String,
    large_image_text: String,
    small_image_key: Option<String>,
    small_image_text: Option<String>,
    start_timestamp: Option<i64>,
) -> Result<(), String> {
    let mut client_lock = state.client.lock().unwrap();

    #[cfg(debug_assertions)]
    let final_large_text = format!("{} [Dev Build]", if large_image_text.is_empty() { "Verdant Launcher" } else { &large_image_text });
    #[cfg(not(debug_assertions))]
    let final_large_text = if large_image_text.is_empty() { "Verdant Launcher".to_string() } else { large_image_text.clone() };

    if let Some(client) = client_lock.as_mut() {
        let mut assets = activity::Assets::new();
        
        if !large_image_key.is_empty() {
            assets = assets.large_image(&large_image_key);
        } else {
            assets = assets.large_image("verdantlogo");
        }
        
        assets = assets.large_text(&final_large_text);

        if let Some(small_key) = &small_image_key {
            if !small_key.is_empty() {
                assets = assets.small_image(small_key);
                if let Some(small_text) = &small_image_text {
                    if !small_text.is_empty() {
                        assets = assets.small_text(small_text);
                    }
                }
            }
        }

        let mut payload = activity::Activity::new()
            .details(&details)
            .state(&state_str)
            .assets(assets);

        if let Some(timestamp) = start_timestamp {
            payload = payload.timestamps(activity::Timestamps::new().start(timestamp));
        }

        if let Err(e) = client.set_activity(payload) { 
            eprintln!("[Discord RPC] Falha ao atualizar: {:?}", e); 
            // Tenta reconectar caso o Discord tenha sido fechado ou reiniciado
            let _ = client.reconnect();
        }
    }
    
    Ok(())
}

#[tauri::command]
pub fn clear_discord_rpc(state: State<'_, DiscordState>) -> Result<(), String> {
    let mut client_lock = state.client.lock().unwrap();
    if let Some(client) = client_lock.as_mut() {
        let _ = client.clear_activity();
    }
    Ok(())
}




