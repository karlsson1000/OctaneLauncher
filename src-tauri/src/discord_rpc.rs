use discord_rich_presence::{DiscordIpc, DiscordIpcClient, activity::{Activity, Assets}};
use std::sync::{Arc, Mutex};
use std::thread;

pub struct DiscordRpc {
    client: Arc<Mutex<Option<DiscordIpcClient>>>,
}

impl DiscordRpc {
    pub fn new(client_id: &str) -> Self {
        let mut client = match DiscordIpcClient::new(client_id) {
            Ok(c) => c,
            Err(_) => return Self {
                client: Arc::new(Mutex::new(None)),
            },
        };
        
        let connected = client.connect().is_ok();
        
        Self {
            client: Arc::new(Mutex::new(if connected { Some(client) } else { None })),
        }
    }
    
    pub fn set_activity(&self, details: &str, state: Option<&str>, large_image: &str, large_text: &str) {
        let client = self.client.clone();
        let details = details.to_string();
        let state = state.map(|s| s.to_string());
        let large_image = large_image.to_string();
        let large_text = large_text.to_string();
        
        thread::spawn(move || {
            if let Ok(mut client_guard) = client.lock() {
                if let Some(ref mut c) = *client_guard {
                    let assets = Assets::new()
                        .large_image(&large_image)
                        .large_text(&large_text);
                    
                    let mut activity = Activity::new()
                        .details(&details)
                        .assets(assets);
                    
                    if let Some(ref state_text) = state {
                        activity = activity.state(state_text);
                    }
                    
                    let _ = c.set_activity(activity);
                }
            }
        });
    }
    
    pub fn clear_activity(&self) {
        let client = self.client.clone();
        thread::spawn(move || {
            if let Ok(mut client_guard) = client.lock() {
                if let Some(ref mut c) = *client_guard {
                    let _ = c.clear_activity();
                }
            }
        });
    }
    
    pub fn close(&self) {
        if let Ok(mut client_guard) = self.client.lock() {
            if let Some(ref mut c) = *client_guard {
                let _ = c.close();
            }
        }
    }
}

impl Drop for DiscordRpc {
    fn drop(&mut self) {
        self.close();
    }
}