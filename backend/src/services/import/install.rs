use super::*;

impl InstanceImporter {
    pub async fn import(
        detected: &ImportableInstance,
        target_name: &str,
        app_handle: &tauri::AppHandle,
    ) -> Result<(), String> {
        let mc_version = detected
            .mc_version
            .clone()
            .ok_or_else(|| format!("Could not determine the Minecraft version of '{}'", detected.name))?;

        let source_dir = PathBuf::from(&detected.path);
        if !source_dir.is_dir() {
            return Err(format!("Source folder no longer exists: {}", detected.path));
        }

        let meta_dir = get_meta_dir();

        let emit = |progress: u32, stage: &str| {
            let _ = app_handle.emit(
                "creation-progress",
                serde_json::json!({
                    "instance": target_name,
                    "progress": progress,
                    "stage": stage
                }),
            );
        };

        emit(0, &format!("Importing '{}'...", detected.name));
        emit(5, &format!("Installing Minecraft {}...", mc_version));

        let installer = MinecraftInstaller::new(meta_dir.clone()).map_err(|e| e.to_string())?;
        installer
            .install_version(&mc_version)
            .await
            .map_err(|e| e.to_string())?;

        let loader = detected.loader.clone().unwrap_or_else(|| "vanilla".to_string());
        let final_version = match loader.as_str() {
            "fabric" => {
                emit(20, "Installing Fabric loader...");
                let fabric_installer =
                    FabricInstaller::new(meta_dir.clone()).map_err(|e| e.to_string())?;
                let fabric_version = match &detected.loader_version {
                    Some(v) => v.clone(),
                    None => {
                        let versions = fabric_installer
                            .get_loader_versions()
                            .await
                            .map_err(|e| e.to_string())?;
                        versions
                            .iter()
                            .find(|v| v.stable)
                            .or_else(|| versions.first())
                            .ok_or("No Fabric versions found")?
                            .version
                            .clone()
                    }
                };
                fabric_installer
                    .install_fabric(&mc_version, &fabric_version)
                    .await
                    .map_err(|e| e.to_string())?
            }
            "forge" => {
                emit(20, "Installing Forge loader...");
                let forge_version = detected
                    .loader_version
                    .clone()
                    .ok_or("Forge version unknown for this instance")?;
                let full_version = format!("{}-{}", mc_version, forge_version);
                let forge_installer =
                    ForgeInstaller::new(meta_dir.clone()).map_err(|e| e.to_string())?;
                forge_installer
                    .install_forge(&full_version)
                    .await
                    .map_err(|e| e.to_string())?
            }
            "neoforge" => {
                emit(20, "Installing NeoForge loader...");
                let neoforge_version = detected
                    .loader_version
                    .clone()
                    .ok_or("NeoForge version unknown for this instance")?;
                let neoforge_installer =
                    NeoForgeInstaller::new(meta_dir.clone()).map_err(|e| e.to_string())?;
                neoforge_installer
                    .install_neoforge(&neoforge_version)
                    .await
                    .map_err(|e| e.to_string())?
            }
            "vanilla" => {
                emit(20, "Preparing vanilla installation...");
                mc_version.clone()
            }
            other => {
                return Err(format!(
                    "Loader '{}' is not supported for import yet",
                    other
                ));
            }
        };

        emit(55, "Creating instance...");

        InstanceManager::create(
            target_name,
            &final_version,
            if loader == "vanilla" { None } else { Some(loader.clone()) },
            detected.loader_version.clone(),
        )
        .map_err(|e| e.to_string())?;

        emit(60, "Copying your files...");

        let content_root = Self::content_root(&detected.source, &source_dir);
        let instance_dir = get_instance_dir(target_name);

        const SKIPPED_ENTRIES: &[&str] = &[
            "instance.json",
            "instance.cfg",
            "mmc-pack.json",
            "profile.json",
            "modrinth.app.json",
            "manifest.json",
            ".ftbapp",
            ".mixin.out",
            ".cache",
            ".backup",
            "natives",
            "versions",
            "logs",
            "crash-reports",
        ];

        let total_bytes = Self::dir_size(&content_root);
        let copied_bytes = std::sync::atomic::AtomicU64::new(0);
        let last_pct = std::sync::atomic::AtomicU32::new(60);

        Self::copy_dir_filtered(
            &content_root,
            &instance_dir,
            SKIPPED_ENTRIES,
            total_bytes,
            &copied_bytes,
            &last_pct,
            app_handle,
            target_name,
        )
        .map_err(|e| e.to_string())?;

        emit(97, "Setting icon...");

        if let Some(icon_source) = &detected.icon_path {
            let _ = Self::apply_imported_icon(target_name, icon_source).await;
        }

        emit(100, "Import complete!");

        Ok(())
    }

    async fn apply_imported_icon(target_name: &str, icon_source: &str) -> Result<(), String> {
        const MAX_ICON_BYTES: usize = 8 * 1024 * 1024;

        let metadata = fs::metadata(icon_source).map_err(|e| e.to_string())?;
        if !metadata.is_file() || metadata.len() as usize > MAX_ICON_BYTES {
            return Err("Icon file missing or too large".to_string());
        }

        use base64::{Engine as _, engine::general_purpose};
        let bytes = fs::read(icon_source).map_err(|e| e.to_string())?;
        let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;

        let mut png_buffer = std::io::Cursor::new(Vec::new());
        img.write_to(&mut png_buffer, image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;

        let _ = crate::commands::set_instance_icon(
            target_name.to_string(),
            general_purpose::STANDARD.encode(png_buffer.into_inner()),
        )
        .await;

        Ok(())
    }

    pub(super) fn dir_size(path: &Path) -> u64 {
        let mut size = 0;

        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.is_dir() {
                    size += Self::dir_size(&entry_path);
                } else if let Ok(metadata) = entry.metadata() {
                    size += metadata.len();
                }
            }
        }

        size
    }

    #[allow(clippy::too_many_arguments)]
    fn copy_dir_filtered(
        src: &Path,
        dst: &Path,
        skipped: &[&str],
        total_bytes: u64,
        copied_bytes: &std::sync::atomic::AtomicU64,
        last_pct: &std::sync::atomic::AtomicU32,
        app_handle: &tauri::AppHandle,
        target_name: &str,
    ) -> std::io::Result<()> {
        use std::sync::atomic::Ordering;

        fs::create_dir_all(dst)?;

        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            let entry_name = entry.file_name();

            if skipped
                .iter()
                .any(|s| s.eq_ignore_ascii_case(&entry_name.to_string_lossy()))
            {
                continue;
            }

            let src_path = entry.path();
            let dst_path = dst.join(entry_name);

            if file_type.is_dir() {
                Self::copy_dir_filtered(
                    &src_path,
                    &dst_path,
                    skipped,
                    total_bytes,
                    copied_bytes,
                    last_pct,
                    app_handle,
                    target_name,
                )?;
            } else if file_type.is_file() {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                fs::copy(&src_path, &dst_path)?;
                let copied = copied_bytes.fetch_add(size, Ordering::Relaxed) + size;

                if total_bytes > 0 {
                    let pct = 60 + (copied.min(total_bytes) * 15 / total_bytes) as u32;
                    if last_pct.swap(pct, Ordering::Relaxed) != pct {
                        let _ = app_handle.emit(
                            "creation-progress",
                            serde_json::json!({
                                "instance": target_name,
                                "progress": pct,
                                "stage": format!("Copying files... {:.1} MB", copied as f64 / 1024.0 / 1024.0)
                            }),
                        );
                    }
                }
            }
        }

        Ok(())
    }
}
