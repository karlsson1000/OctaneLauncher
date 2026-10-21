use super::*;

pub fn curseforge_api_key(app: &tauri::AppHandle) -> Result<String, String> {
    let config = app.state::<crate::CurseforgeConfig>();
    if config.api_key.is_empty() {
        Err("CURSEFORGE_API_KEY not set in .env".to_string())
    } else {
        Ok(config.api_key.to_string())
    }
}

#[tauri::command]
pub async fn search_curseforge_mods(
    app_handle: tauri::AppHandle,
    query: String,
    class_id: u32,
    category_ids: Option<String>,
    game_version: Option<String>,
    mod_loader_types: Option<String>,
    sort_field: Option<u32>,
    sort_order: Option<String>,
    index: Option<u32>,
    page_size: Option<u32>,
) -> Result<CurseforgeSearchResult, String> {
    if query.len() > 200 {
        return Err("Search query too long (max 200 characters)".to_string());
    }

    let api_key = curseforge_api_key(&app_handle)?;
    let client = CurseforgeClient::new(api_key).map_err(|e| e.to_string())?;
    client
        .search_mods(
            &query,
            class_id,
            category_ids.as_deref(),
            game_version.as_deref(),
            mod_loader_types.as_deref(),
            sort_field.unwrap_or(2),
            sort_order.as_deref(),
            index.unwrap_or(0),
            page_size.unwrap_or(20).min(100),
        )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_curseforge_mod_files(
    app_handle: tauri::AppHandle,
    mod_id: u32,
    game_version: Option<String>,
    mod_loader_type: Option<u32>,
    page_size: Option<u32>,
) -> Result<CurseforgeGetModFilesResult, String> {
    let api_key = curseforge_api_key(&app_handle)?;
    let client = CurseforgeClient::new(api_key).map_err(|e| e.to_string())?;
    client
        .get_mod_files(mod_id, game_version.as_deref(), mod_loader_type, page_size)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_curseforge_file_temp(
    download_url: String,
    filename: String,
    expected_sha1: Option<String>,
) -> Result<String, String> {
    let safe_filename = sanitize_filename(&filename)?;
    let _ = validate_download_url(&download_url)?;

    let temp_dir = std::env::temp_dir().join("octane_curseforge");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let destination = temp_dir.join(&safe_filename);
    crate::utils::download::download_file_verified(
        &download_url,
        &destination,
        expected_sha1.as_deref(),
    )
    .await?;

    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn download_curseforge_file(
    instance_name: String,
    download_url: String,
    filename: String,
    target_folder: String,
    expected_sha1: Option<String>,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let safe_filename = match target_folder.as_str() {
        "mods" => sanitize_mod_filename(&filename)?,
        "resourcepacks" => sanitize_resourcepack_filename(&filename)?,
        "shaderpacks" => sanitize_shaderpack_filename(&filename)?,
        _ => return Err("Invalid target folder".to_string()),
    };

    crate::commands::mods::download_into_content_dir(
        &safe_name,
        &target_folder,
        &download_url,
        &safe_filename,
        expected_sha1.as_deref(),
    )
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn get_curseforge_mod_details(
    app_handle: tauri::AppHandle,
    mod_id: u32,
) -> Result<CurseforgeModDetail, String> {
    let api_key = curseforge_api_key(&app_handle)?;
    let client = CurseforgeClient::new(api_key).map_err(|e| e.to_string())?;
    client.get_mod(mod_id).await
}
