use crate::auth::Authenticator;
use crate::services::accounts::AccountManager;
use crate::models::{AuthResponse, AccountInfo};

#[tauri::command]
pub async fn microsoft_login() -> Result<AuthResponse, String> {
    let authenticator = Authenticator::new()
        .map_err(|e| e.to_string())?;
    
    authenticator
        .authenticate()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_accounts() -> Result<Vec<AccountInfo>, String> {
    AccountManager::get_all_accounts()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_active_account() -> Result<Option<AccountInfo>, String> {
    let active = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?;
    
    if let Some(account) = active {
        Ok(Some(AccountInfo {
            uuid: account.uuid,
            username: account.username,
            is_active: true,
            added_at: account.added_at,
            last_used: account.last_used,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn switch_account(uuid: String) -> Result<(), String> {
    if !uuid.chars().all(|c| c.is_alphanumeric() || c == '-') || uuid.len() > 36 {
        return Err("Invalid UUID format".to_string());
    }
    
    AccountManager::set_active_account(&uuid)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_account(uuid: String) -> Result<(), String> {
    if !uuid.chars().all(|c| c.is_alphanumeric() || c == '-') || uuid.len() > 36 {
        return Err("Invalid UUID format".to_string());
    }
    
    AccountManager::remove_account(&uuid)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn microsoft_login_and_store() -> Result<AccountInfo, String> {
    let authenticator = Authenticator::new()
        .map_err(|e| e.to_string())?;
    
    let auth_response = authenticator
        .authenticate()
        .await
        .map_err(|e| e.to_string())?;
    
    let account_exists = AccountManager::account_exists(&auth_response.uuid)
        .map_err(|e| e.to_string())?;
    
    if account_exists {
        AccountManager::update_account_tokens(
            &auth_response.uuid,
            auth_response.access_token.clone(),
            auth_response.refresh_token.clone(),
            auth_response.token_expiry,
        )
        .map_err(|e| e.to_string())?;
        
        AccountManager::set_active_account(&auth_response.uuid)
            .map_err(|e| e.to_string())?;
    } else {
        AccountManager::add_account(
            auth_response.uuid.clone(),
            auth_response.username.clone(),
            auth_response.access_token.clone(),
            auth_response.refresh_token.clone(),
            auth_response.token_expiry,
        )
        .map_err(|e| e.to_string())?;
    }
    
    let accounts = AccountManager::get_all_accounts()
        .map_err(|e| e.to_string())?;
    
    accounts
        .into_iter()
        .find(|acc| acc.uuid == auth_response.uuid)
        .ok_or_else(|| "Account not found".to_string())
}

#[tauri::command]
pub async fn get_launch_token() -> Result<String, String> {
    let active = AccountManager::get_active_account()
        .map_err(|e| e.to_string())?
        .ok_or("No active account")?;
    
    AccountManager::get_valid_token(&active.uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn refresh_account_token(uuid: String) -> Result<(), String> {
    if !uuid.chars().all(|c| c.is_alphanumeric() || c == '-') || uuid.len() > 36 {
        return Err("Invalid UUID format".to_string());
    }
    
    AccountManager::get_valid_token(&uuid)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}