use crate::models::{ChatMessage, StoredAccount};
use crate::services::chat::{ChatService, GiphyGif};
use crate::services::accounts::AccountManager;
use std::collections::HashMap;

fn get_service() -> Result<ChatService, String> {
    ChatService::new().map_err(|e| e.to_string())
}

fn get_active_account() -> Result<StoredAccount, String> {
    AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No active account".to_string())
}

#[tauri::command]
pub async fn send_chat_message(to_uuid: String, content: String) -> Result<(), String> {
    let account = get_active_account()?;
    get_service()?
        .send_message(&account.uuid, &to_uuid, &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_chat_messages(friend_uuid: String) -> Result<Vec<ChatMessage>, String> {
    let account = get_active_account()?;
    get_service()?
        .get_messages(&account.uuid, &friend_uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_unread_message_counts() -> Result<HashMap<String, u32>, String> {
    let account = get_active_account()?;
    get_service()?
        .get_unread_counts(&account.uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mark_messages_as_read(friend_uuid: String) -> Result<(), String> {
    let account = get_active_account()?;
    get_service()?
        .mark_as_read(&account.uuid, &friend_uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cleanup_chat_messages() -> Result<(), String> {
    let account = get_active_account()?;
    get_service()?
        .cleanup_messages_if_both_offline(&account.uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_gifs(query: String, limit: Option<u32>) -> Result<Vec<GiphyGif>, String> {
    get_service()?
        .search_gifs(&query, limit.unwrap_or(25))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_trending_gifs(limit: Option<u32>) -> Result<Vec<GiphyGif>, String> {
    get_service()?
        .get_trending_gifs(limit.unwrap_or(25))
        .await
        .map_err(|e| e.to_string())
}