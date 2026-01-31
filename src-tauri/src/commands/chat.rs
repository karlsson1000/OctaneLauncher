use crate::models::ChatMessage;
use crate::services::chat::ChatService;
use crate::services::accounts::AccountManager;
use std::collections::HashMap;

#[tauri::command]
pub async fn send_chat_message(to_uuid: String, content: String) -> Result<(), String> {
    let service = ChatService::new()
        .map_err(|e| e.to_string())?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.send_message(&active_account.uuid, &to_uuid, &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_chat_messages(friend_uuid: String) -> Result<Vec<ChatMessage>, String> {
    let service = ChatService::new()
        .map_err(|e| e.to_string())?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.get_messages(&active_account.uuid, &friend_uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_unread_message_counts() -> Result<HashMap<String, u32>, String> {
    let service = ChatService::new()
        .map_err(|e| e.to_string())?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.get_unread_counts(&active_account.uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mark_messages_as_read(friend_uuid: String) -> Result<(), String> {
    let service = ChatService::new()
        .map_err(|e| e.to_string())?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.mark_as_read(&active_account.uuid, &friend_uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cleanup_chat_messages() -> Result<(), String> {
    let service = ChatService::new()
        .map_err(|e| e.to_string())?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.cleanup_messages_if_both_offline(&active_account.uuid)
        .await
        .map_err(|e| e.to_string())
}