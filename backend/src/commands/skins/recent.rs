use super::*;
use std::fs;
use std::path::PathBuf;

fn get_recent_skins_path(account_uuid: &str) -> Result<PathBuf, String> {
    crate::commands::validation::validate_uuid(account_uuid)?;
    let launcher_dir = crate::utils::get_launcher_dir();
    let skins_dir = launcher_dir.join("recent_skins");
    
    if !skins_dir.exists() {
        fs::create_dir_all(&skins_dir)
            .map_err(|e| e.to_string())?;
    }
    
    Ok(skins_dir.join(format!("{}.json", account_uuid)))
}

#[tauri::command]
pub async fn load_recent_skins(account_uuid: String) -> Result<Vec<RecentSkin>, String> {
    let file_path = get_recent_skins_path(&account_uuid)?;
    
    if !file_path.exists() {
        return Ok(Vec::new());
    }
    
    let content = fs::read_to_string(&file_path)
        .map_err(|e| e.to_string())?;
    
    let skins: Vec<RecentSkin> = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;
    
    Ok(skins.into_iter().map(|s| RecentSkin {
        url: s.url.replace("http://", "https://"),
        ..s
    }).collect())
}

#[tauri::command]
pub async fn save_recent_skin(
    account_uuid: String,
    skin_url: String,
    variant: String,
) -> Result<(), String> {
    let file_path = get_recent_skins_path(&account_uuid)?;
    
    let mut skins = if file_path.exists() {
        let content = fs::read_to_string(&file_path)
            .map_err(|e| e.to_string())?;
        
        serde_json::from_str::<Vec<RecentSkin>>(&content)
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    
    skins.retain(|s| s.url != skin_url);
    
    let new_skin = RecentSkin {
        url: skin_url.replace("http://", "https://"),
        variant,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
    };
    
    skins.insert(0, new_skin);
    skins.truncate(3);
    
    let json = serde_json::to_string_pretty(&skins)
        .map_err(|e| e.to_string())?;
    
    fs::write(&file_path, json)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
