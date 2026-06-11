use crate::commands::validation::{
    sanitize_instance_name, get_java_info, validate_memory_allocation,
};
use crate::models::{DetectedJava, Instance, LauncherSettings};
use crate::services::settings::SettingsManager;
use crate::utils::get_instance_dir;
use std::path::PathBuf;

fn detect_path(base: &str, exe_name: &str) -> Option<String> {
    let path = PathBuf::from(base).join("bin").join(exe_name);
    if path.exists() {
        path.to_str().map(|s| s.to_string())
    } else {
        None
    }
}

fn try_add(java_paths: &mut Vec<String>, path: &str) {
    if !java_paths.contains(&path.to_string()) {
        java_paths.push(path.to_string());
    }
}

fn cache_jres(jres: &[DetectedJava]) {
    let cache_path = crate::utils::get_launcher_dir().join("java_cache.json");
    if let Ok(json) = serde_json::to_string_pretty(jres) {
        let _ = std::fs::write(&cache_path, json);
    }
}

fn load_cached_jres() -> Vec<DetectedJava> {
    let cache_path = crate::utils::get_launcher_dir().join("java_cache.json");
    if let Ok(content) = std::fs::read_to_string(&cache_path) {
        if let Ok(jres) = serde_json::from_str(&content) {
            return jres;
        }
    }
    Vec::new()
}

#[tauri::command]
pub async fn get_settings() -> Result<LauncherSettings, String> {
    SettingsManager::load()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_settings(settings: LauncherSettings) -> Result<(), String> {
    if let Some(ref java_path) = settings.java_path {
        get_java_info(java_path)?;
    }

    validate_memory_allocation(settings.memory_mb as u64)?;

    SettingsManager::save(&settings)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_instance_settings(instance_name: String) -> Result<Option<LauncherSettings>, String> {
    let safe_name = sanitize_instance_name(&instance_name)?;

    let instance_dir = get_instance_dir(&safe_name);
    let instance_json = instance_dir.join("instance.json");

    if !instance_json.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }

    let content = std::fs::read_to_string(&instance_json)
        .map_err(|e| e.to_string())?;

    let instance: Instance = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;

    Ok(instance.settings_override)
}

#[tauri::command]
pub async fn save_instance_settings(
    instance_name: String,
    settings: Option<LauncherSettings>,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;

    if let Some(ref s) = settings {
        if let Some(ref java_path) = s.java_path {
            get_java_info(java_path)?;
        }
        validate_memory_allocation(s.memory_mb as u64)?;
    }

    let instance_dir = get_instance_dir(&safe_name);
    let instance_json = instance_dir.join("instance.json");

    if !instance_json.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }

    let content = std::fs::read_to_string(&instance_json)
        .map_err(|e| e.to_string())?;

    let mut instance: Instance = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;

    instance.settings_override = settings;

    let updated_json = serde_json::to_string_pretty(&instance)
        .map_err(|e| e.to_string())?;

    std::fs::write(&instance_json, updated_json)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn detect_java_installations() -> Result<Vec<String>, String> {
    let mut java_paths: Vec<String> = Vec::new();
    let _detected: Vec<DetectedJava> = load_cached_jres();

    let java_bin = if cfg!(windows) { "javaw.exe" } else { "java" };

    #[cfg(target_os = "windows")]
    {
        let common_paths = vec![
            "C:\\Program Files\\Java",
            "C:\\Program Files (x86)\\Java",
            "C:\\Program Files\\Eclipse Adoptium",
            "C:\\Program Files (x86)\\Eclipse Adoptium",
            "C:\\Program Files\\Microsoft",
            "C:\\Program Files\\Zulu",
            "C:\\Program Files\\Amazon Corretto",
        ];
        for base_path in common_paths {
            if let Ok(entries) = std::fs::read_dir(base_path) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Some(p) = detect_path(&entry.path().to_string_lossy(), java_bin) {
                            if get_java_info(&p).is_ok() {
                                try_add(&mut java_paths, &p);
                            }
                        }
                    }
                }
            }
        }
    }

    if let Ok(path_var) = std::env::var("PATH") {
        let separator = if cfg!(windows) { ";" } else { ":" };
        for path in path_var.split(separator) {
            let exe_path = PathBuf::from(path).join(java_bin);
            if exe_path.exists() {
                if let Some(s) = exe_path.to_str() {
                    if get_java_info(s).is_ok() {
                        try_add(&mut java_paths, s);
                    }
                }
            }
        }
    }

    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        if let Some(p) = detect_path(&java_home, java_bin) {
            if get_java_info(&p).is_ok() {
                try_add(&mut java_paths, &p);
            }
        }
    }

    java_paths.sort();
    java_paths.dedup();

    let mut fresh_detected = Vec::new();
    for p in &java_paths {
        if let Ok(info) = get_java_info(p) {
            fresh_detected.push(info);
        }
    }
    cache_jres(&fresh_detected);

    Ok(java_paths)
}

use base64::{engine::general_purpose, Engine as _};

fn get_bg_path() -> PathBuf {
    crate::utils::get_launcher_dir().join("bg.png")
}

#[tauri::command]
pub async fn set_background(image_data: String) -> Result<(), String> {
    let bg_path = get_bg_path();

    let base64_data = if let Some(comma_pos) = image_data.find(',') {
        &image_data[comma_pos + 1..]
    } else {
        &image_data
    };

    let image_bytes = general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| e.to_string())?;

    std::fs::write(&bg_path, image_bytes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_background() -> Result<Option<String>, String> {
    let bg_path = get_bg_path();

    if !bg_path.exists() {
        return Ok(None);
    }

    let image_bytes = std::fs::read(&bg_path)
        .map_err(|e| e.to_string())?;

    let base64_data = general_purpose::STANDARD.encode(&image_bytes);

    let mime_type = if image_bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "image/png"
    } else if image_bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "image/jpeg"
    } else if image_bytes.starts_with(&[0x47, 0x49, 0x46]) {
        "image/gif"
    } else if image_bytes.starts_with(&[0x42, 0x4D]) {
        "image/bmp"
    } else {
        "image/png"
    };

    Ok(Some(format!("data:{};base64,{}", mime_type, base64_data)))
}

#[tauri::command]
pub async fn remove_background() -> Result<(), String> {
    let bg_path = get_bg_path();

    if bg_path.exists() {
        std::fs::remove_file(&bg_path)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
