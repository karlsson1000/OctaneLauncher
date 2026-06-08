use crate::models::{AppConfig, Friend, FriendRequest, FriendStatus};
use crate::services::friends::FriendsService;
use crate::services::accounts::AccountManager;
use tauri::Manager;

fn get_friends_service(config: &AppConfig) -> Result<FriendsService, String> {
    FriendsService::new(&config.supabase_url, &config.supabase_key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_friend_request(username: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let config = app_handle.state::<AppConfig>();
    let service = get_friends_service(&config)?;
    
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
pub async fn get_friend_requests(app_handle: tauri::AppHandle) -> Result<Vec<FriendRequest>, String> {
    let config = app_handle.state::<AppConfig>();
    let service = get_friends_service(&config)?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.get_friend_requests(&active_account.uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn accept_friend_request(request_id: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let config = app_handle.state::<AppConfig>();
    let service = get_friends_service(&config)?;

    service.accept_friend_request(&request_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reject_friend_request(request_id: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let config = app_handle.state::<AppConfig>();
    let service = get_friends_service(&config)?;

    service.reject_friend_request(&request_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_friends(app_handle: tauri::AppHandle) -> Result<Vec<Friend>, String> {
    let config = app_handle.state::<AppConfig>();
    let service = get_friends_service(&config)?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.get_friends(&active_account.uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_friend(friend_uuid: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let config = app_handle.state::<AppConfig>();
    let service = get_friends_service(&config)?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.remove_friend(&active_account.uuid, &friend_uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_user_status(status: String, current_instance: Option<String>, app_handle: tauri::AppHandle) -> Result<(), String> {
    let config = app_handle.state::<AppConfig>();
    let service = get_friends_service(&config)?;
    
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
pub async fn register_user_in_friends_system(app_handle: tauri::AppHandle) -> Result<(), String> {
    let config = app_handle.state::<AppConfig>();
    let service = get_friends_service(&config)?;
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    service.register_user(&active_account.uuid, &active_account.username)
        .await
        .map_err(|e| e.to_string())
}

pub async fn update_specific_user_status(user_uuid: String, status: String, current_instance: Option<String>, supabase_url: &str, supabase_key: &str) -> Result<(), String> {
    let service = match FriendsService::new(supabase_url, supabase_key) {
        Ok(s) => s,
        Err(e) => return Err(e.to_string()),
    };

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