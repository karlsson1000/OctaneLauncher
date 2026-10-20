use super::*;
use base64::{engine::general_purpose, Engine as _};

#[tauri::command]
pub async fn get_current_skin(app_handle: tauri::AppHandle) -> Result<Option<CurrentSkin>, String> {
    let config = app_handle.state::<AppConfig>();
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;
    
    let access_token = AccountManager::get_valid_token(&active_account.uuid, &config.microsoft_client_id)
        .await
        .map_err(|e| e.to_string())?;
    
    let client = crate::utils::http::get_client();
    
    let response = client
        .get(MINECRAFT_PROFILE_URL)
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Failed to get profile ({}): {}", status, error_text));
    }
    
    let profile: ProfileResponse = response
        .json()
        .await
        .map_err(|e| e.to_string())?;
    
    let cape_url = get_player_cape(&profile.id).await.ok();
    
    if let Some(active_skin) = profile.skins.iter().find(|s| s.state == "ACTIVE") {
        Ok(Some(CurrentSkin {
            url: active_skin.url.replace("http://", "https://"),
            variant: active_skin.variant.to_lowercase(),
            cape_url,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn get_user_capes(app_handle: tauri::AppHandle) -> Result<UserCapesResponse, String> {
    let config = app_handle.state::<AppConfig>();
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;
    
    let access_token = AccountManager::get_valid_token(&active_account.uuid, &config.microsoft_client_id)
        .await
        .map_err(|e| e.to_string())?;
    
    let client = crate::utils::http::get_client();
    
    let response = client
        .get(MINECRAFT_PROFILE_URL)
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Failed to get profile ({}): {}", status, error_text));
    }
    
    let profile: ProfileResponse = response
        .json()
        .await
        .map_err(|e| e.to_string())?;
    
    let capes = profile.capes.unwrap_or_default().into_iter().map(|c| CapeInfo {
        url: c.url.replace("http://", "https://"),
        ..c
    }).collect();
    
    Ok(UserCapesResponse { capes })
}

async fn get_player_cape(uuid: &str) -> Result<String, String> {
    let client = crate::utils::http::get_client();
    
    let uuid_no_dashes = uuid.replace("-", "");
    let url = format!("{}/{}", MINECRAFT_SESSION_URL, uuid_no_dashes);
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err("Failed to get session profile".to_string());
    }
    
    let session_profile: SessionProfileResponse = response
        .json()
        .await
        .map_err(|e| e.to_string())?;
    
    let textures_property = session_profile
        .properties
        .iter()
        .find(|p| p.name == "textures")
        .ok_or("No textures property found".to_string())?;
    
    let decoded = general_purpose::STANDARD
        .decode(&textures_property.value)
        .map_err(|e| e.to_string())?;
    
    let textures_str = String::from_utf8(decoded)
        .map_err(|e| e.to_string())?;
    
    let textures_data: TexturesData = serde_json::from_str(&textures_str)
        .map_err(|e| e.to_string())?;
    
    textures_data
        .textures
        .cape
        .map(|cape| cape.url.replace("http://", "https://"))
        .ok_or("No cape found".to_string())
}
