use super::*;
use super::common::extract_modpack;
use super::installers::{install_from_curseforge_manifest, install_from_mrpack, install_from_standard_zip};

#[tauri::command]
pub async fn get_modpack_name_from_file(
    file_path: String,
) -> Result<String, String> {
    use std::path::Path;

    let file_path_obj = Path::new(&file_path);
    if !file_path_obj.exists() {
        return Err("Modpack file does not exist".to_string());
    }

    let extension = file_path_obj
        .extension()
        .and_then(|e| e.to_str())
        .ok_or("Invalid file extension")?;

    if extension != "mrpack" && extension != "zip" {
        return Err("Invalid modpack file format. Expected .mrpack or .zip".to_string());
    }

    let temp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let extract_dir = temp_dir.join(format!("modpack_preview_{}", timestamp));

    std::fs::create_dir_all(&extract_dir)
        .map_err(|e| e.to_string())?;

    let extract_result = extract_modpack(file_path_obj, &extract_dir);
    if let Err(e) = extract_result {
        let _ = std::fs::remove_dir_all(&extract_dir);
        return Err(e);
    }

    let manifest_path = extract_dir.join("modrinth.index.json");
    let cf_manifest_path = extract_dir.join("manifest.json");

    let modpack_name = if manifest_path.exists() {
        let manifest_content = std::fs::read_to_string(&manifest_path).map_err(|e| {
            let _ = std::fs::remove_dir_all(&extract_dir);
            e.to_string()
        })?;

        let manifest: serde_json::Value = serde_json::from_str(&manifest_content).map_err(|e| {
            let _ = std::fs::remove_dir_all(&extract_dir);
            e.to_string()
        })?;

        manifest
            .get("name")
            .and_then(|n| n.as_str())
            .unwrap_or("Imported Modpack")
            .to_string()
    } else if cf_manifest_path.exists() {
        let manifest_content = std::fs::read_to_string(&cf_manifest_path).map_err(|e| {
            let _ = std::fs::remove_dir_all(&extract_dir);
            e.to_string()
        })?;

        let manifest: serde_json::Value = serde_json::from_str(&manifest_content).map_err(|e| {
            let _ = std::fs::remove_dir_all(&extract_dir);
            e.to_string()
        })?;

        manifest
            .get("name")
            .and_then(|n| n.as_str())
            .unwrap_or("Imported Modpack")
            .to_string()
    } else {
        let _ = std::fs::remove_dir_all(&extract_dir);
        return Err(
            "Invalid modpack: no modrinth.index.json or manifest.json found".to_string(),
        );
    };

    let _ = std::fs::remove_dir_all(&extract_dir);

    Ok(modpack_name)
}

#[tauri::command]
pub async fn install_modpack_from_file(
    file_path: String,
    instance_name: String,
    preferred_game_version: Option<String>,
    project_id: Option<u32>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    use std::path::Path;

    let safe_name = sanitize_instance_name(&instance_name)?;

    let file_path_obj = Path::new(&file_path);
    if !file_path_obj.exists() {
        return Err("Modpack file does not exist".to_string());
    }

    let extension = file_path_obj
        .extension()
        .and_then(|e| e.to_str())
        .ok_or("Invalid file extension")?;

    if extension != "mrpack" && extension != "zip" {
        return Err("Invalid modpack file format. Expected .mrpack or .zip".to_string());
    }

    if let Some(ref version) = preferred_game_version {
        if !version.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
            return Err("Invalid preferred game version format".to_string());
        }
    }

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 0,
        "stage": "Starting modpack installation..."
    }));

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 5,
        "stage": "Reading modpack file..."
    }));

    let temp_dir = std::env::temp_dir();
    let extract_dir = temp_dir.join(format!("modpack_extract_{}", safe_name));
    if extract_dir.exists() {
        let _ = std::fs::remove_dir_all(&extract_dir);
    }
    std::fs::create_dir_all(&extract_dir)
        .map_err(|e| e.to_string())?;

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 10,
        "stage": "Extracting modpack..."
    }));

    extract_modpack(file_path_obj, &extract_dir)
        .map_err(|e| e.to_string())?;

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 20,
        "stage": "Reading modpack manifest..."
    }));

    let manifest_path = extract_dir.join("modrinth.index.json");
    let is_mrpack = manifest_path.exists();

    let instance_json_path = extract_dir.join("instance.json");
    let is_standard_zip = instance_json_path.exists();

    let curseforge_manifest_path = extract_dir.join("manifest.json");
    let is_curseforge = curseforge_manifest_path.exists();

    if is_mrpack {
        install_from_mrpack(
            extract_dir,
            safe_name,
            preferred_game_version,
            app_handle
        ).await
    } else if is_standard_zip {
        install_from_standard_zip(
            extract_dir,
            safe_name,
            preferred_game_version,
            app_handle
        ).await
    } else if is_curseforge {
        install_from_curseforge_manifest(
            extract_dir,
            safe_name,
            preferred_game_version,
            project_id,
            app_handle
        ).await
    } else {
        Err("Invalid modpack format: missing modrinth.index.json or instance.json or manifest.json".to_string())
    }
}
