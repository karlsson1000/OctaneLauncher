use super::*;
use super::common::{extract_modpack, set_icon_from_file};
use super::installers::install_from_mrpack;

#[tauri::command]
pub async fn install_modpack(
    modpack_slug: String,
    instance_name: String,
    version_id: String,
    preferred_game_version: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;

    if !modpack_slug.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err("Invalid modpack slug format".to_string());
    }

    if !version_id.chars().all(|c| c.is_alphanumeric() || c == '-') {
        return Err("Invalid version ID format".to_string());
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
        "stage": "Fetching modpack information..."
    }));

    let client = ModrinthClient::new().map_err(|e| e.to_string())?;
    let version = client
        .get_version_by_id(&modpack_slug, &version_id)
        .await
        .map_err(|e| e.to_string())?;

    let resolved_game_version = match &preferred_game_version {
        Some(preferred) if version.game_versions.contains(preferred) => preferred.clone(),
        _ => version
            .game_versions
            .first()
            .ok_or("No game version found")?
            .clone(),
    };

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 10,
        "stage": "Downloading modpack..."
    }));

    let primary_file = version.files.iter()
        .find(|f| f.primary)
        .or_else(|| version.files.first())
        .ok_or("No modpack file found")?;

    let temp_dir = std::env::temp_dir();
    let modpack_file = temp_dir.join(&primary_file.filename);

    validate_download_url(&primary_file.url)?;

    client
        .download_mod_file(
            &primary_file.url,
            &modpack_file,
            Some(primary_file.hashes.sha1.as_str()),
        )
        .await
        .map_err(|e| e.to_string())?;

    let extract_dir = temp_dir.join(format!("modpack_extract_{}", safe_name));
    if extract_dir.exists() {
        let _ = std::fs::remove_dir_all(&extract_dir);
    }
    std::fs::create_dir_all(&extract_dir)
        .map_err(|e| e.to_string())?;

    let result: Result<(), String> = async {
        extract_modpack(&modpack_file, &extract_dir)
            .map_err(|e| e.to_string())?;

        install_from_mrpack(
            extract_dir.clone(),
            safe_name.clone(),
            Some(resolved_game_version),
            app_handle.clone(),
        )
        .await?;

        let icon_url = match client.get_project(&modpack_slug).await {
            Ok(project) => project.icon_url,
            Err(_) => None,
        };

        if let Some(icon_url) = icon_url {
            let icon_extension = icon_url.split('.').last().unwrap_or("png");
            let icon_path =
                temp_dir.join(format!("modpack_icon_{}.{}", safe_name, icon_extension));

            if validate_download_url(&icon_url).is_ok()
                && client
                    .download_mod_file(&icon_url, &icon_path, None)
                    .await
                    .is_ok()
            {
                set_icon_from_file(&safe_name, &icon_path).await;
                let _ = std::fs::remove_file(&icon_path);
            }
        }

        Ok(())
    }
    .await;

    let _ = std::fs::remove_file(&modpack_file);
    let _ = std::fs::remove_dir_all(&extract_dir);

    result?;

    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 100,
        "stage": "Installation complete!"
    }));

    Ok(())
}
