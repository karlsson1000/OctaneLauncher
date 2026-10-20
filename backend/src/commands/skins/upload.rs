use super::types::{SessionProfileResponse, TexturesData};
use super::*;
use super::endpoints::{
    MINECRAFT_SESSION_URL, MINECRAFT_SKIN_RESET_URL, MINECRAFT_SKIN_URL,
};
use crate::models::AppConfig;
use crate::services::accounts::AccountManager;
use base64::{engine::general_purpose, Engine as _};
use tauri::Manager;

#[tauri::command]
pub async fn upload_skin(
    skin_data: String,
    variant: String,
    app_handle: tauri::AppHandle,
) -> Result<CurrentSkin, String> {
    if variant != "classic" && variant != "slim" {
        return Err("Invalid skin variant. Must be 'classic' or 'slim'".to_string());
    }
    
    let config = app_handle.state::<AppConfig>();
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;
    
    let access_token = AccountManager::get_valid_token(&active_account.uuid, &config.microsoft_client_id)
        .await
        .map_err(|e| e.to_string())?;
    
    let image_bytes = general_purpose::STANDARD
        .decode(&skin_data)
        .map_err(|e| e.to_string())?;
    
    if image_bytes.len() > 1024 * 1024 {
        return Err("Skin image too large (max 1MB)".to_string());
    }
    
    let format = image::guess_format(&image_bytes)
        .map_err(|e| e.to_string())?;
    
    if format != image::ImageFormat::Png {
        return Err("Skin must be a PNG image".to_string());
    }
    
    let img = image::load_from_memory(&image_bytes)
        .map_err(|e| e.to_string())?;
    
    let (width, height) = (img.width(), img.height());
    if !((width == 64 && height == 64) || (width == 64 && height == 32)) {
        return Err(format!("Invalid skin dimensions ({}x{}). Must be 64x64 or 64x32", width, height));
    }
    
    let client = crate::utils::http::get_client();
    
    let part = reqwest::multipart::Part::bytes(image_bytes)
        .file_name("skin.png")
        .mime_str("image/png")
        .map_err(|e| e.to_string())?;
    
    let form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("variant", variant.clone());
    
    let response = client
        .post(MINECRAFT_SKIN_URL)
        .bearer_auth(&access_token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Skin upload failed ({}): {}", status, error_text));
    }
    
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    let uuid_no_dashes = active_account.uuid.replace("-", "");
    let session_url = format!("{}/{}", MINECRAFT_SESSION_URL, uuid_no_dashes);
    
    let session_response = client
        .get(&session_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if session_response.status().is_success() {
        let session_profile: SessionProfileResponse = session_response
            .json()
            .await
            .map_err(|e| e.to_string())?;
        
        if let Some(textures_property) = session_profile.properties.iter().find(|p| p.name == "textures") {
            let decoded = general_purpose::STANDARD
                .decode(&textures_property.value)
                .map_err(|e| e.to_string())?;
            
            let textures_str = String::from_utf8(decoded)
                .map_err(|e| e.to_string())?;
            
            let textures_data: TexturesData = serde_json::from_str(&textures_str)
                .map_err(|e| e.to_string())?;
            
            if let Some(skin_texture) = textures_data.textures.skin {
                let skin_variant = skin_texture.metadata
                    .and_then(|m| m.model)
                    .unwrap_or_else(|| "classic".to_string());
                
                let cape_url = textures_data.textures.cape.map(|c| c.url);
                
                return Ok(CurrentSkin {
                    url: skin_texture.url.replace("http://", "https://"),
                    variant: skin_variant.to_lowercase(),
                    cape_url: cape_url.map(|u| u.replace("http://", "https://")),
                });
            }
        }
    }

    Ok(CurrentSkin {
        url: String::new(),
        variant: variant.to_lowercase(),
        cape_url: None,
    })
}

#[tauri::command]
pub async fn reset_skin(app_handle: tauri::AppHandle) -> Result<(), String> {
    let config = app_handle.state::<AppConfig>();
    
    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;
    
    let access_token = AccountManager::get_valid_token(&active_account.uuid, &config.microsoft_client_id)
        .await
        .map_err(|e| e.to_string())?;
    
    let client = crate::utils::http::get_client();

    let response = client
        .delete(MINECRAFT_SKIN_RESET_URL)
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Skin reset failed ({}): {}", status, error_text));
    }
    
    Ok(())
}
