use super::archive::{add_dir_to_zip, add_file_to_zip};
use crate::models::Instance;
use std::io::Write;
use zip::{write::SimpleFileOptions, ZipWriter};

pub(super) async fn export_as_mrpack(
    zip: &mut ZipWriter<std::fs::File>,
    instance_name: &str,
    instance_dir: &std::path::Path,
    options: SimpleFileOptions,
    include_worlds: bool,
    include_resource_packs: bool,
    include_shader_packs: bool,
    include_mods: bool,
    include_config: bool,
) -> Result<(), String> {
    let instance_json_path = instance_dir.join("instance.json");
    let instance_content = std::fs::read_to_string(&instance_json_path)
        .map_err(|e| e.to_string())?;
    let instance: Instance = serde_json::from_str(&instance_content)
        .map_err(|e| e.to_string())?;

    let loader = instance.loader.clone().unwrap_or_else(|| "vanilla".to_string());
    let minecraft_version = crate::commands::modpacks::common::extract_minecraft_version(
        &instance.version,
        Some(loader.as_str()),
    );
    let loader_version = instance.loader_version.clone();

    let mut manifest = serde_json::json!({
        "formatVersion": 1,
        "game": "minecraft",
        "versionId": format!("{}-{}", instance_name, chrono::Utc::now().timestamp()),
        "name": instance_name,
        "summary": format!("Exported from launcher - Minecraft {}", minecraft_version),
        "files": [],
        "dependencies": {
            "minecraft": minecraft_version
        }
    });

    match loader.as_str() {
        "fabric" => {
            if let Some(ver) = loader_version {
                manifest["dependencies"]["fabric-loader"] = serde_json::Value::String(ver);
            }
        }
        "forge" => {
            if let Some(ver) = loader_version {
                manifest["dependencies"]["forge"] = serde_json::Value::String(ver);
            }
        }
        "neoforge" => {
            if let Some(ver) = loader_version {
                manifest["dependencies"]["neoforge"] = serde_json::Value::String(ver);
            }
        }
        _ => {}
    }

    if include_mods {
        let mods_dir = instance_dir.join("mods");
        if mods_dir.exists() {
            let mut resolved_files: Vec<serde_json::Value> = Vec::new();
            let mut override_candidates: Vec<std::path::PathBuf> = Vec::new();

            let mut candidates: Vec<std::path::PathBuf> = Vec::new();
            if let Ok(entries) = std::fs::read_dir(&mods_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if !path.is_file() {
                        continue;
                    }
                    let is_mod_archive = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .map(|e| {
                            e.eq_ignore_ascii_case("jar")
                                || e.eq_ignore_ascii_case("zip")
                                || e.eq_ignore_ascii_case("litemod")
                        })
                        .unwrap_or(false);
                    if is_mod_archive {
                        candidates.push(path);
                    } else {
                        override_candidates.push(path);
                    }
                }
            }

            let client = crate::utils::modrinth::ModrinthClient::new().ok();
            let mut hashes: Vec<String> = Vec::new();
            let mut hashed: Vec<(std::path::PathBuf, String)> = Vec::new();

            for path in &candidates {
                let Ok(bytes) = std::fs::read(path) else {
                    override_candidates.push(path.clone());
                    continue;
                };

                let sha1_hex = crate::utils::hash::sha1_hex(&bytes);

                hashes.push(sha1_hex.clone());
                hashed.push((path.clone(), sha1_hex));
            }

            let mut resolved_map = std::collections::HashMap::new();
            if !hashes.is_empty() {
                if let Some(client) = &client {
                    if let Ok(map) = client.get_version_files_by_hashes(&hashes).await {
                        resolved_map = map;
                    }
                }
            }

            for (path, sha1_hex) in hashed {
                let file_name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                let version_file = resolved_map
                    .get(&sha1_hex)
                    .and_then(|response| response.files.iter().find(|f| f.hashes.sha1 == sha1_hex));

                if let Some(vf) = version_file {
                    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(vf.size);
                    resolved_files.push(serde_json::json!({
                        "path": format!("mods/{}", file_name),
                        "hashes": {
                            "sha1": vf.hashes.sha1,
                            "sha512": vf.hashes.sha512,
                        },
                        "env": {
                            "client": "required",
                            "server": "required"
                        },
                        "downloads": [vf.url],
                        "fileSize": size
                    }));
                } else {
                    override_candidates.push(path);
                }
            }

            manifest["files"] = serde_json::Value::Array(resolved_files);

            for path in override_candidates {
                let file_name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .ok_or("Invalid mod file name")?;
                add_file_to_zip(zip, &path, &format!("overrides/mods/{}", file_name), options)?;
            }
        }
    }

    if include_worlds {
        let saves_dir = instance_dir.join("saves");
        if saves_dir.exists() {
            add_dir_to_zip(zip, &saves_dir, "overrides/saves", options)?;
        }
    }

    if include_resource_packs {
        let resourcepacks_dir = instance_dir.join("resourcepacks");
        if resourcepacks_dir.exists() {
            add_dir_to_zip(zip, &resourcepacks_dir, "overrides/resourcepacks", options)?;
        }
    }

    if include_shader_packs {
        let shaderpacks_dir = instance_dir.join("shaderpacks");
        if shaderpacks_dir.exists() {
            add_dir_to_zip(zip, &shaderpacks_dir, "overrides/shaderpacks", options)?;
        }
    }

    if include_config {
        let config_dir = instance_dir.join("config");
        if config_dir.exists() {
            add_dir_to_zip(zip, &config_dir, "overrides/config", options)?;
        }

        let options_txt = instance_dir.join("options.txt");
        if options_txt.exists() {
            add_file_to_zip(zip, &options_txt, "overrides/options.txt", options)?;
        }

        let optionsof_txt = instance_dir.join("optionsof.txt");
        if optionsof_txt.exists() {
            add_file_to_zip(zip, &optionsof_txt, "overrides/optionsof.txt", options)?;
        }

        let optionsshaders_txt = instance_dir.join("optionsshaders.txt");
        if optionsshaders_txt.exists() {
            add_file_to_zip(zip, &optionsshaders_txt, "overrides/optionsshaders.txt", options)?;
        }
    }

    let icon_path = instance_dir.join("icon.png");
    if icon_path.exists() {
        add_file_to_zip(zip, &icon_path, "icon.png", options)?;
    }

    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    zip.start_file("modrinth.index.json", options)
        .map_err(|e| format!("Failed to create manifest file: {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Failed to write manifest: {}", e))?;

    Ok(())
}
