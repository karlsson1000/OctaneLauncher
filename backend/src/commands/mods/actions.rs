use super::*;

#[tauri::command]
pub fn delete_content_file(
    safe_name: &str,
    folder: &str,
    cache_kind: &str,
    safe_filename: &str,
    label: &str,
) -> Result<(), String> {
    let instance_dir = get_instance_dir(safe_name);
    let content_dir = instance_dir.join(folder);
    let file_path = content_dir.join(safe_filename);

    let canonical_file_path = file_path
        .canonicalize()
        .map_err(|_| format!("{} '{}' not found", label, safe_filename))?;

    let canonical_content_dir = content_dir
        .canonicalize()
        .map_err(|_| format!("{} directory not found", label))?;

    if !canonical_file_path.starts_with(&canonical_content_dir) {
        return Err(format!("Invalid {} path", label.to_lowercase()));
    }

    if !canonical_file_path.is_file() {
        return Err(format!("{} '{}' not found", label, safe_filename));
    }

    std::fs::remove_file(&canonical_file_path)
        .map_err(|e| e.to_string())?;

    invalidate_content_cache(safe_name, cache_kind);

    Ok(())
}

#[tauri::command]
pub async fn delete_mod(instance_name: String, filename: String) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let safe_filename = if filename.ends_with(".disabled") {
        let base = sanitize_mod_filename(filename.trim_end_matches(".disabled"))?;
        format!("{}.disabled", base)
    } else {
        sanitize_mod_filename(&filename)?
    };

    delete_content_file(&safe_name, "mods", "mod", &safe_filename, "Mod file")
}

#[tauri::command]
pub async fn toggle_mod(instance_name: String, filename: String, disable: bool) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    
    let safe_filename = if filename.ends_with(".disabled") {
        let base = filename.trim_end_matches(".disabled");
        sanitize_mod_filename(base)?
    } else {
        sanitize_mod_filename(&filename)?
    };
    
    let instance_dir = get_instance_dir(&safe_name);
    let mods_dir = instance_dir.join("mods");
    
    let (old_path, new_filename) = if disable {
        let old = mods_dir.join(&safe_filename);
        let new_name = format!("{}.disabled", safe_filename);
        (old, new_name)
    } else {
        let old = mods_dir.join(format!("{}.disabled", safe_filename));
        (old, safe_filename.clone())
    };
    
    let new_path = mods_dir.join(&new_filename);
    
    let canonical_old = old_path.canonicalize()
        .map_err(|_| "Mod file not found".to_string())?;
    
    let canonical_mods_dir = mods_dir.canonicalize()
        .map_err(|_| "Mods directory not found".to_string())?;
    
    if !canonical_old.starts_with(&canonical_mods_dir) {
        return Err("Invalid mod path".to_string());
    }
    
    std::fs::rename(&old_path, &new_path)
        .map_err(|e| e.to_string())?;

    invalidate_mod_cache(&safe_name);

    Ok(())
}

pub async fn download_into_content_dir(
    safe_name: &str,
    folder: &str,
    download_url: &str,
    safe_filename: &str,
    expected_sha1: Option<&str>,
) -> Result<(), String> {
    let _ = validate_download_url(download_url)?;

    let instance_dir = get_instance_dir(safe_name);
    let content_dir = instance_dir.join(folder);

    if !content_dir.exists() {
        std::fs::create_dir_all(&content_dir)
            .map_err(|e| e.to_string())?;
    }

    let destination = content_dir.join(safe_filename);

    if !destination.starts_with(&content_dir) {
        return Err("Invalid destination path".to_string());
    }

    let client = ModrinthClient::new().map_err(|e| e.to_string())?;
    client
        .download_mod_file(download_url, &destination, expected_sha1)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_mod(
    instance_name: String,
    download_url: String,
    filename: String,
    expected_sha1: Option<String>,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let safe_filename = sanitize_mod_filename(&filename)?;

    download_into_content_dir(&safe_name, "mods", &download_url, &safe_filename, expected_sha1.as_deref()).await
}
