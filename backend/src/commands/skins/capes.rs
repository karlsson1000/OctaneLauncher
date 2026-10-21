use crate::models::AppConfig;
use crate::services::accounts::AccountManager;
use tauri::Manager;

#[tauri::command]
pub async fn equip_cape(cape_id: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let config = app_handle.state::<AppConfig>();
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;
    
    let access_token = AccountManager::get_valid_token(&active_account.uuid, &config.microsoft_client_id)
        .await
        .map_err(|e| e.to_string())?;
    
    let client = crate::utils::http::get_client();
    
    let url = "https://api.minecraftservices.com/minecraft/profile/capes/active";
    
    let body = serde_json::json!({
        "capeId": cape_id
    });
    
    let response = client
        .put(url)
        .bearer_auth(&access_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Cape equip failed ({}): {}", status, error_text));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn remove_cape(app_handle: tauri::AppHandle) -> Result<(), String> {
    let config = app_handle.state::<AppConfig>();
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;
    
    let access_token = AccountManager::get_valid_token(&active_account.uuid, &config.microsoft_client_id)
        .await
        .map_err(|e| e.to_string())?;
    
    let client = crate::utils::http::get_client();
    
    let url = "https://api.minecraftservices.com/minecraft/profile/capes/active";
    
    let response = client
        .delete(url)
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Cape removal failed ({}): {}", status, error_text));
    }
    
    Ok(())
}
