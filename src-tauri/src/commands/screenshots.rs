use crate::commands::validation::sanitize_instance_name;
use crate::utils::{get_instances_dir, get_instance_dir};
use std::fs;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screenshot {
    pub path: String,
    pub filename: String,
    pub instance_name: String,
    pub timestamp: i64,
    pub size: u64,
    pub data_url: String,
}

#[tauri::command]
pub async fn get_all_screenshots() -> Result<Vec<Screenshot>, String> {
    let instances_dir = get_instances_dir();
    
    if !instances_dir.exists() {
        return Ok(Vec::new());
    }

    let mut screenshots = Vec::new();

    if let Ok(entries) = fs::read_dir(&instances_dir) {
        for entry in entries.flatten() {
            let instance_path = entry.path();
            
            if !instance_path.is_dir() {
                continue;
            }

            let instance_name = instance_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            let screenshots_dir = instance_path.join("screenshots");
            
            if !screenshots_dir.exists() {
                continue;
            }

            if let Ok(screenshot_entries) = fs::read_dir(&screenshots_dir) {
                for screenshot_entry in screenshot_entries.flatten() {
                    let screenshot_path = screenshot_entry.path();
                    
                    if !screenshot_path.is_file() {
                        continue;
                    }

                    let extension = screenshot_path
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("");

                    if extension != "png" && extension != "jpg" && extension != "jpeg" {
                        continue;
                    }

                    let filename = screenshot_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();

                    if let Ok(metadata) = fs::metadata(&screenshot_path) {
                        let timestamp = metadata
                            .modified()
                            .ok()
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs() as i64)
                            .unwrap_or(0);

                        let size = metadata.len();

                        let data_url = if let Ok(image_bytes) = fs::read(&screenshot_path) {
                            let base64_data = general_purpose::STANDARD.encode(&image_bytes);
                            let mime_type = match extension {
                                "png" => "image/png",
                                "jpg" | "jpeg" => "image/jpeg",
                                _ => "image/png",
                            };
                            format!("data:{};base64,{}", mime_type, base64_data)
                        } else {
                            String::new()
                        };

                        screenshots.push(Screenshot {
                            path: screenshot_path.to_string_lossy().to_string(),
                            filename,
                            instance_name: instance_name.clone(),
                            timestamp,
                            size,
                            data_url,
                        });
                    }
                }
            }
        }
    }

    screenshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(screenshots)
}

#[tauri::command]
pub async fn delete_screenshot(path: String) -> Result<(), String> {
    let screenshot_path = PathBuf::from(&path);

    let instances_dir = get_instances_dir();
    let canonical_screenshot = screenshot_path
        .canonicalize()
        .map_err(|e| format!("Invalid screenshot path: {}", e))?;
    
    let canonical_instances = instances_dir
        .canonicalize()
        .map_err(|_| "Instances directory not found".to_string())?;
    
    if !canonical_screenshot.starts_with(&canonical_instances) {
        return Err("Invalid screenshot path".to_string());
    }

    if !path.contains("screenshots") {
        return Err("Invalid screenshot path".to_string());
    }

    if !screenshot_path.exists() {
        return Err("Screenshot does not exist".to_string());
    }

    fs::remove_file(&screenshot_path)
        .map_err(|e| format!("Failed to delete screenshot: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn open_screenshot(path: String) -> Result<(), String> {
    let screenshot_path = PathBuf::from(&path);

    let instances_dir = get_instances_dir();
    let canonical_screenshot = screenshot_path
        .canonicalize()
        .map_err(|e| format!("Invalid screenshot path: {}", e))?;
    
    let canonical_instances = instances_dir
        .canonicalize()
        .map_err(|_| "Instances directory not found".to_string())?;
    
    if !canonical_screenshot.starts_with(&canonical_instances) {
        return Err("Invalid screenshot path".to_string());
    }

    if !screenshot_path.exists() {
        return Err("Screenshot does not exist".to_string());
    }

    open::that(&screenshot_path)
        .map_err(|e| format!("Failed to open screenshot: {}", e))?;

    Ok(())
}