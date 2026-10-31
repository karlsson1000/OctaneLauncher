use super::types::ProfileResponse;
use super::*;
use super::endpoints::MINECRAFT_PROFILE_URL;
use crate::models::AppConfig;
use crate::services::accounts::AccountManager;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};
use tauri::Manager;

const PROFILE_CACHE_TTL: Duration = Duration::from_secs(10);

static PROFILE_CACHE: LazyLock<Mutex<HashMap<String, (ProfileResponse, Instant)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub(super) fn clear_profile_cache(uuid: &str) {
    PROFILE_CACHE.lock().unwrap().remove(uuid);
}

async fn fetch_profile(uuid: &str, access_token: &str) -> Result<ProfileResponse, String> {
    if let Some((profile, fetched_at)) = PROFILE_CACHE.lock().unwrap().get(uuid) {
        if fetched_at.elapsed() < PROFILE_CACHE_TTL {
            return Ok(profile.clone());
        }
    }

    let client = crate::utils::http::get_client();

    let response = client
        .get(MINECRAFT_PROFILE_URL)
        .bearer_auth(access_token)
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

    PROFILE_CACHE
        .lock()
        .unwrap()
        .insert(uuid.to_string(), (profile.clone(), Instant::now()));

    Ok(profile)
}

#[tauri::command]
pub async fn get_current_skin(app_handle: tauri::AppHandle) -> Result<Option<CurrentSkin>, String> {
    let config = app_handle.state::<AppConfig>();

    let active_account = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account".to_string())?;

    let access_token = AccountManager::get_valid_token(&active_account.uuid, &config.microsoft_client_id)
        .await
        .map_err(|e| e.to_string())?;

    let profile = fetch_profile(&active_account.uuid, &access_token).await?;

    let cape_url = profile
        .capes
        .as_ref()
        .and_then(|capes| capes.iter().find(|c| c.state == "ACTIVE"))
        .map(|c| c.url.replace("http://", "https://"));

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

    let profile = fetch_profile(&active_account.uuid, &access_token).await?;

    let capes = profile.capes.unwrap_or_default().into_iter().map(|c| CapeInfo {
        url: c.url.replace("http://", "https://"),
        ..c
    }).collect();

    Ok(UserCapesResponse { capes })
}
