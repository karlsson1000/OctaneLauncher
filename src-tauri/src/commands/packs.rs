use crate::commands::validation::{sanitize_instance_name, sanitize_resourcepack_filename, sanitize_shaderpack_filename, validate_download_url};
use crate::utils::{get_instance_dir, open_folder};
use crate::utils::modrinth::ModrinthClient;
use serde::{Deserialize, Serialize};

// Resource Packs

#[derive(Serialize, Deserialize)]
pub struct ResourcePackFile {
    pub filename: String,
    pub size: u64,
}

#[tauri::command]
pub async fn get_installed_resourcepacks(instance_name: String) -> Result<Vec<String>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let resourcepacks_dir = instance_dir.join("resourcepacks");
    
    if !resourcepacks_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut packs = Vec::new();
    
    match std::fs::read_dir(&resourcepacks_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                
                if !path.starts_with(&resourcepacks_dir) {
                    continue;
                }
                
                if path.is_file() {
                    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                        // Accept both .zip and .jar files
                        if filename.ends_with(".zip") || filename.ends_with(".jar") {
                            packs.push(filename.to_string());
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Err(e.to_string());
        }
    }
    
    packs.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    
    Ok(packs)
}

#[tauri::command]
pub async fn download_resourcepack(
    instance_name: String,
    download_url: String,
    filename: String,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let safe_filename = sanitize_resourcepack_filename(&filename)?;
    
    let _ = validate_download_url(&download_url)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let resourcepacks_dir = instance_dir.join("resourcepacks");

    if !resourcepacks_dir.exists() {
        std::fs::create_dir_all(&resourcepacks_dir)
            .map_err(|e| e.to_string())?;
    }

    let destination = resourcepacks_dir.join(&safe_filename);
    
    if !destination.starts_with(&resourcepacks_dir) {
        return Err("Invalid destination path".to_string());
    }

    let client = ModrinthClient::new();
    client
        .download_mod_file(&download_url, &destination)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_resourcepack(instance_name: String, filename: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let safe_filename = sanitize_resourcepack_filename(&filename)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let resourcepacks_dir = instance_dir.join("resourcepacks");
    let pack_path = resourcepacks_dir.join(&safe_filename);
    
    let canonical_pack_path = pack_path.canonicalize()
        .map_err(|_| format!("Resource pack '{}' not found", safe_filename))?;
    
    let canonical_resourcepacks_dir = resourcepacks_dir.canonicalize()
        .map_err(|_| "Resource packs directory not found".to_string())?;
    
    if !canonical_pack_path.starts_with(&canonical_resourcepacks_dir) {
        return Err("Invalid resource pack path".to_string());
    }
    
    if !canonical_pack_path.is_file() {
        return Err(format!("Resource pack '{}' not found", safe_filename));
    }
    
    std::fs::remove_file(&canonical_pack_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_resourcepacks_folder(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let resourcepacks_dir = instance_dir.join("resourcepacks");
    
    if !resourcepacks_dir.exists() {
        std::fs::create_dir_all(&resourcepacks_dir)
            .map_err(|e| e.to_string())?;
    }
    
    open_folder(resourcepacks_dir)
        .map_err(|e| e.to_string())
}

// Shader Packs

#[derive(Serialize, Deserialize)]
pub struct ShaderPackFile {
    pub filename: String,
    pub size: u64,
}

#[tauri::command]
pub async fn get_installed_shaderpacks(instance_name: String) -> Result<Vec<String>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let shaderpacks_dir = instance_dir.join("shaderpacks");
    
    if !shaderpacks_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut packs = Vec::new();
    
    match std::fs::read_dir(&shaderpacks_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                
                if !path.starts_with(&shaderpacks_dir) {
                    continue;
                }
                
                if path.is_file() {
                    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                        // Accept both .zip and .jar files
                        if filename.ends_with(".zip") || filename.ends_with(".jar") {
                            packs.push(filename.to_string());
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Err(e.to_string());
        }
    }
    
    packs.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    
    Ok(packs)
}

#[tauri::command]
pub async fn download_shaderpack(
    instance_name: String,
    download_url: String,
    filename: String,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let safe_filename = sanitize_shaderpack_filename(&filename)?;
    
    let _ = validate_download_url(&download_url)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let shaderpacks_dir = instance_dir.join("shaderpacks");

    if !shaderpacks_dir.exists() {
        std::fs::create_dir_all(&shaderpacks_dir)
            .map_err(|e| e.to_string())?;
    }

    let destination = shaderpacks_dir.join(&safe_filename);
    
    if !destination.starts_with(&shaderpacks_dir) {
        return Err("Invalid destination path".to_string());
    }

    let client = ModrinthClient::new();
    client
        .download_mod_file(&download_url, &destination)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_shaderpack(instance_name: String, filename: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let safe_filename = sanitize_shaderpack_filename(&filename)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let shaderpacks_dir = instance_dir.join("shaderpacks");
    let pack_path = shaderpacks_dir.join(&safe_filename);
    
    let canonical_pack_path = pack_path.canonicalize()
        .map_err(|_| format!("Shader pack '{}' not found", safe_filename))?;
    
    let canonical_shaderpacks_dir = shaderpacks_dir.canonicalize()
        .map_err(|_| "Shader packs directory not found".to_string())?;
    
    if !canonical_pack_path.starts_with(&canonical_shaderpacks_dir) {
        return Err("Invalid shader pack path".to_string());
    }
    
    if !canonical_pack_path.is_file() {
        return Err(format!("Shader pack '{}' not found", safe_filename));
    }
    
    std::fs::remove_file(&canonical_pack_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_shaderpacks_folder(instance_name: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let instance_dir = get_instance_dir(&safe_name);
    let shaderpacks_dir = instance_dir.join("shaderpacks");
    
    if !shaderpacks_dir.exists() {
        std::fs::create_dir_all(&shaderpacks_dir)
            .map_err(|e| e.to_string())?;
    }
    
    open_folder(shaderpacks_dir)
        .map_err(|e| e.to_string())
}