use super::*;

pub(super) async fn fetch_and_set_cf_pack_icon(
    app_handle: &tauri::AppHandle,
    safe_name: &str,
    project_id: u32,
) {
    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 98,
        "stage": "Fetching modpack icon..."
    }));

    let Ok(api_key) = crate::commands::curseforge_api_key(app_handle) else { return };
    let Ok(client) = CurseforgeClient::new(api_key) else { return };
    let Ok(detail) = client.get_mod(project_id).await else { return };
    let Some(logo) = detail.logo else { return };

    for candidate in [logo.download_url.as_deref(), Some(logo.thumbnail_url.as_str())]
        .into_iter()
        .flatten()
    {
        if validate_download_url(candidate).is_err() {
            continue;
        }

        let ext = candidate.rsplit('.').next().unwrap_or("png");
        let icon_path = std::env::temp_dir().join(format!(
            "cfpack_icon_{}.{}",
            uuid::Uuid::new_v4().simple(),
            ext
        ));

        if crate::utils::download::download_file_verified(candidate, &icon_path, None)
            .await
            .is_ok()
        {
            set_icon_from_file(safe_name, &icon_path).await;
            let _ = std::fs::remove_file(&icon_path);
            return;
        }
    }
}

pub(super) async fn set_icon_from_file(safe_name: &str, icon_path: &std::path::Path) {
    let icon_path = icon_path.to_path_buf();
    if let Ok(icon_bytes) = tokio::task::spawn_blocking(move || std::fs::read(icon_path)).await
        .unwrap_or(Err(std::io::Error::new(std::io::ErrorKind::Other, "join failed")))
    {
        use base64::{Engine as _, engine::general_purpose};
        let icon_base64 = general_purpose::STANDARD.encode(&icon_bytes);
        let _ = crate::commands::set_instance_icon(safe_name.to_string(), icon_base64).await;
    }
}

pub(super) fn copy_dir_recursive(
    src: &std::path::Path,
    dst: &std::path::Path,
) -> std::io::Result<()> {
    use std::fs;

    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if file_type.is_file() {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

pub(super) fn extract_modpack(
    archive_path: &std::path::Path,
    dest_dir: &std::path::Path,
) -> Result<(), String> {
    use zip::ZipArchive;

    let file = std::fs::File::open(archive_path)
        .map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => dest_dir.join(path),
            None => continue,
        };

        if !outpath.starts_with(dest_dir) {
            continue;
        }

        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath)
                .map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    std::fs::create_dir_all(p)
                        .map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = std::fs::File::create(&outpath)
                .map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

pub(super) async fn install_minecraft_and_loader(
    safe_name: &str,
    game_version: &str,
    loader: &str,
    pinned_loader_version: Option<&str>,
    app_handle: &tauri::AppHandle,
) -> Result<String, String> {
    let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
        "instance": safe_name,
        "progress": 30,
        "stage": format!("Installing Minecraft {}...", game_version)
    }));

    let meta_dir = get_meta_dir();
    let installer = MinecraftInstaller::new(meta_dir.clone())
        .map_err(|e| e.to_string())?;
    installer
        .install_version(game_version)
        .await
        .map_err(|e| e.to_string())?;

    let loader_label = match loader {
        "fabric" => Some("Fabric"),
        "forge" => Some("Forge"),
        "neoforge" => Some("NeoForge"),
        _ => None,
    };

    if let Some(label) = loader_label {
        let _ = app_handle.emit("modpack-install-progress", serde_json::json!({
            "instance": safe_name,
            "progress": 40,
            "stage": format!("Installing {} loader...", label)
        }));
    }

    let final_version: String = match loader {
        "fabric" => {
            let fabric_installer =
                FabricInstaller::new(meta_dir).map_err(|e| e.to_string())?;

            let fabric_version = if let Some(pinned) = pinned_loader_version {
                pinned.to_string()
            } else {
                let fabric_versions = fabric_installer
                    .get_loader_versions()
                    .await
                    .map_err(|e| e.to_string())?;
                fabric_versions
                    .iter()
                    .find(|v| v.stable)
                    .or_else(|| fabric_versions.first())
                    .ok_or("No Fabric versions found")?
                    .version
                    .clone()
            };

            fabric_installer
                .install_fabric(game_version, &fabric_version)
                .await
                .map_err(|e| e.to_string())?
        }
        "forge" => {
            let forge_installer = crate::services::forge::ForgeInstaller::new(meta_dir)
                .map_err(|e| e.to_string())?;

            let forge_ver = if let Some(pinned) = pinned_loader_version {
                if pinned.starts_with(&format!("{}-", game_version)) {
                    pinned.to_string()
                } else {
                    format!("{}-{}", game_version, pinned)
                }
            } else {
                forge_installer
                    .get_loader_versions()
                    .await
                    .map_err(|e| e.to_string())?
                    .iter()
                    .find(|v| v.minecraft_version == game_version)
                    .ok_or_else(|| {
                        format!("No Forge version found for Minecraft {}", game_version)
                    })?
                    .full_version
                    .clone()
            };

            forge_installer
                .install_forge(&forge_ver)
                .await
                .map_err(|e| e.to_string())?
        }
        "neoforge" => {
            let neoforge_installer = crate::services::neoforge::NeoForgeInstaller::new(meta_dir)
                .map_err(|e| e.to_string())?;

            let neoforge_version = pinned_loader_version
                .ok_or("Modpack did not specify a NeoForge version")?;

            neoforge_installer
                .install_neoforge(neoforge_version)
                .await
                .map_err(|e| e.to_string())?
        }
        _ => game_version.to_string(),
    };

    Ok(final_version)
}

pub(crate) fn extract_minecraft_version(version_string: &str, loader: Option<&str>) -> String {
    let loader = match loader {
        Some(loader) => loader.to_ascii_lowercase(),
        None if version_string.contains("fabric-loader") => "fabric".to_string(),
        None if version_string.contains("neoforge-") => "neoforge".to_string(),
        None if version_string.contains("-forge-") => "forge".to_string(),
        None => return version_string.to_string(),
    };

    match loader.as_str() {
        "fabric" => version_string
            .rsplit('-')
            .next()
            .unwrap_or(version_string)
            .to_string(),
        "forge" => version_string
            .find("-forge-")
            .map(|pos| version_string[..pos].to_string())
            .unwrap_or_else(|| version_string.to_string()),
        "neoforge" => {
            if let Some(ver) = version_string.strip_prefix("neoforge-") {
                if let Some((mc_ver, _)) = ver.split_once('-') {
                    if mc_ver.starts_with("1.") {
                        return mc_ver.to_string();
                    }
                }
                if let Some(mc_ver) =
                    crate::services::neoforge::NeoForgeInstaller::parse_minecraft_version_from_neoforge(ver)
                {
                    return mc_ver;
                }
            }
            version_string.to_string()
        }
        _ => version_string.to_string(),
    }
}
