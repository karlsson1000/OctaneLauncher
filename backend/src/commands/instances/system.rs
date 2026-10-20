use super::*;
use sysinfo::System;

#[tauri::command]
pub fn get_launcher_directory() -> String {
    get_launcher_dir().to_string_lossy().to_string()
}

#[tauri::command]
pub fn open_instance_folder(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);

    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }

    open_folder(instance_dir).map_err(|e| e.to_string())
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SystemInfo {
    pub total_memory_mb: u64,
    pub available_memory_mb: u64,
    pub recommended_max_memory_mb: u64,
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_memory();
    
    let total_mb = sys.total_memory() / 1024 / 1024;
    let available_mb = sys.available_memory() / 1024 / 1024;
    let recommended_max_mb = total_mb * 80 / 100;
    
    Ok(SystemInfo {
        total_memory_mb: total_mb,
        available_memory_mb: available_mb,
        recommended_max_memory_mb: recommended_max_mb,
    })
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}
