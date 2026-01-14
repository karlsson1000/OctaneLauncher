use crate::models::{Friend, FriendRequest, FriendStatus};
use crate::services::friends::FriendsService;
use crate::services::accounts::AccountManager;

#[tauri::command]
pub async fn send_friend_request(username: String) -> Result<(), String> {
    let service = FriendsService::new()
        .map_err(|e| e.to_string())?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.register_user(&active_account.uuid, &active_account.username)
        .await
        .map_err(|e| e.to_string())?;

    service.send_friend_request(&active_account.uuid, &username)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_friend_requests() -> Result<Vec<FriendRequest>, String> {
    let service = FriendsService::new()
        .map_err(|e| e.to_string())?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.get_friend_requests(&active_account.uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn accept_friend_request(request_id: String) -> Result<(), String> {
    let service = FriendsService::new()
        .map_err(|e| e.to_string())?;

    service.accept_friend_request(&request_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reject_friend_request(request_id: String) -> Result<(), String> {
    let service = FriendsService::new()
        .map_err(|e| e.to_string())?;

    service.reject_friend_request(&request_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_friends() -> Result<Vec<Friend>, String> {
    let service = FriendsService::new()
        .map_err(|e| e.to_string())?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.get_friends(&active_account.uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_friend(friend_uuid: String) -> Result<(), String> {
    let service = FriendsService::new()
        .map_err(|e| e.to_string())?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.remove_friend(&active_account.uuid, &friend_uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_user_status(status: String, current_instance: Option<String>) -> Result<(), String> {
    let service = FriendsService::new()
        .map_err(|e| e.to_string())?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    let friend_status = match status.as_str() {
        "online" => FriendStatus::Online,
        "ingame" => FriendStatus::InGame,
        "offline" => FriendStatus::Offline,
        _ => return Err("Invalid status".to_string()),
    };

    service.update_status(&active_account.uuid, friend_status, current_instance)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn register_user_in_friends_system() -> Result<(), String> {
    let service = FriendsService::new()
        .map_err(|e| e.to_string())?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.register_user(&active_account.uuid, &active_account.username)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_specific_user_status(user_uuid: String, status: String, current_instance: Option<String>) -> Result<(), String> {
    let service = FriendsService::new()
        .map_err(|e| e.to_string())?;

    let friend_status = match status.as_str() {
        "online" => FriendStatus::Online,
        "ingame" => FriendStatus::InGame,
        "offline" => FriendStatus::Offline,
        _ => return Err("Invalid status".to_string()),
    };

    service.update_status(&user_uuid, friend_status, current_instance)
        .await
        .map_err(|e| e.to_string())
}