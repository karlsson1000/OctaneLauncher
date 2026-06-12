use crate::commands::validation::sanitize_instance_name;
use crate::models::Instance;
use crate::utils::*;
use std::io::Write;
use sha2::{Sha512, Digest};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

#[tauri::command]
pub async fn export_instance(
    instance_name: String,
    output_path: String,
    export_format: String,
    include_worlds: bool,
    include_resource_packs: bool,
    include_shader_packs: bool,
    include_mods: bool,
    include_config: bool,
) -> Result<(), String> {
    let safe_name = sanitize_instance_name(&instance_name)?;
    let instance_dir = get_instance_dir(&safe_name);

    if !instance_dir.exists() {
        return Err(format!("Instance '{}' does not exist", safe_name));
    }

    let output_path_obj = std::path::Path::new(&output_path);
    if let Some(parent) = output_path_obj.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create output directory: {}", e))?;
        }
    }

    let file = std::fs::File::create(&output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;

    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o755);

    if export_format == "mrpack" {
        export_as_mrpack(
            &mut zip,
            &safe_name,
            &instance_dir,
            options,
            include_worlds,
            include_resource_packs,
            include_shader_packs,
            include_mods,
            include_config,
        )?;
    } else {
        export_as_zip(
            &mut zip,
            &instance_dir,
            options,
            include_worlds,
            include_resource_packs,
            include_shader_packs,
            include_mods,
            include_config,
        )?;
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(())
}

fn export_as_zip(
    zip: &mut ZipWriter<std::fs::File>,
    instance_dir: &std::path::Path,
    options: SimpleFileOptions,
    include_worlds: bool,
    include_resource_packs: bool,
    include_shader_packs: bool,
    include_mods: bool,
    include_config: bool,
) -> Result<(), String> {
    let instance_json = instance_dir.join("instance.json");
    if instance_json.exists() {
        add_file_to_zip(zip, &instance_json, "instance.json", options)?;
    }

    let icon_path = instance_dir.join("icon.png");
    if icon_path.exists() {
        add_file_to_zip(zip, &icon_path, "icon.png", options)?;
    }

    if include_worlds {
        let saves_dir = instance_dir.join("saves");
        if saves_dir.exists() {
            add_dir_to_zip(zip, &saves_dir, "saves", options)?;
        }
    }

    if include_resource_packs {
        let resourcepacks_dir = instance_dir.join("resourcepacks");
        if resourcepacks_dir.exists() {
            add_dir_to_zip(zip, &resourcepacks_dir, "resourcepacks", options)?;
        }
    }

    if include_shader_packs {
        let shaderpacks_dir = instance_dir.join("shaderpacks");
        if shaderpacks_dir.exists() {
            add_dir_to_zip(zip, &shaderpacks_dir, "shaderpacks", options)?;
        }
    }

    if include_mods {
        let mods_dir = instance_dir.join("mods");
        if mods_dir.exists() {
            add_dir_to_zip(zip, &mods_dir, "mods", options)?;
        }
    }

    if include_config {
        let config_dir = instance_dir.join("config");
        if config_dir.exists() {
            add_dir_to_zip(zip, &config_dir, "config", options)?;
        }

        let options_txt = instance_dir.join("options.txt");
        if options_txt.exists() {
            add_file_to_zip(zip, &options_txt, "options.txt", options)?;
        }

        let optionsof_txt = instance_dir.join("optionsof.txt");
        if optionsof_txt.exists() {
            add_file_to_zip(zip, &optionsof_txt, "optionsof.txt", options)?;
        }

        let optionsshaders_txt = instance_dir.join("optionsshaders.txt");
        if optionsshaders_txt.exists() {
            add_file_to_zip(zip, &optionsshaders_txt, "optionsshaders.txt", options)?;
        }
    }

    Ok(())
}

fn export_as_mrpack(
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

    let minecraft_version = extract_minecraft_version(&instance.version);
    let loader = instance.loader.clone().unwrap_or_else(|| "vanilla".to_string());
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

    if loader == "fabric" {
        if let Some(fabric_ver) = loader_version {
            manifest["dependencies"]["fabric-loader"] = serde_json::Value::String(fabric_ver);
        }
    }

    let mods_dir = instance_dir.join("mods");
    if include_mods && mods_dir.exists() {
        let mut mod_files = Vec::new();

        if let Ok(entries) = std::fs::read_dir(&mods_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |e| e == "jar") {
                    let file_name = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();

                    if let Ok(file_content) = std::fs::read(&path) {
                        let hash = calculate_sha512(&file_content);

                        mod_files.push(serde_json::json!({
                            "path": format!("mods/{}", file_name),
                            "hashes": {
                                "sha512": hash
                            },
                            "downloads": [],
                            "fileSize": file_content.len()
                        }));

                        let zip_path = format!("overrides/mods/{}", file_name);
                        add_file_to_zip(zip, &path, &zip_path, options)?;
                    }
                }
            }
        }

        manifest["files"] = serde_json::Value::Array(mod_files);
    }

    zip.add_directory("overrides/", options)
        .map_err(|e| format!("Failed to add overrides directory: {}", e))?;

    if include_worlds {
        let saves_dir = instance_dir.join("saves");
        if saves_dir.exists() {
            add_dir_to_zip_with_prefix(zip, &saves_dir, "overrides/saves", options)?;
        }
    }

    if include_resource_packs {
        let resourcepacks_dir = instance_dir.join("resourcepacks");
        if resourcepacks_dir.exists() {
            add_dir_to_zip_with_prefix(zip, &resourcepacks_dir, "overrides/resourcepacks", options)?;
        }
    }

    if include_shader_packs {
        let shaderpacks_dir = instance_dir.join("shaderpacks");
        if shaderpacks_dir.exists() {
            add_dir_to_zip_with_prefix(zip, &shaderpacks_dir, "overrides/shaderpacks", options)?;
        }
    }

    if include_config {
        let config_dir = instance_dir.join("config");
        if config_dir.exists() {
            add_dir_to_zip_with_prefix(zip, &config_dir, "overrides/config", options)?;
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

fn extract_minecraft_version(version_string: &str) -> String {
    if version_string.contains("fabric-loader") {
        let parts: Vec<&str> = version_string.split('-').collect();
        if let Some(mc_version) = parts.last() {
            return mc_version.to_string();
        }
    }
    version_string.to_string()
}

fn calculate_sha512(data: &[u8]) -> String {
    let mut hasher = Sha512::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn add_file_to_zip(
    zip: &mut ZipWriter<std::fs::File>,
    file_path: &std::path::Path,
    zip_path: &str,
    options: SimpleFileOptions,
) -> Result<(), String> {
    let mut file = std::fs::File::open(file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    zip.start_file(zip_path, options)
        .map_err(|e| format!("Failed to start file in zip: {}", e))?;

    std::io::copy(&mut file, zip)
        .map_err(|e| format!("Failed to write file to zip: {}", e))?;

    Ok(())
}

fn add_dir_to_zip(
    zip: &mut ZipWriter<std::fs::File>,
    dir_path: &std::path::Path,
    zip_prefix: &str,
    options: SimpleFileOptions,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        let zip_path = format!("{}/{}", zip_prefix, name_str);

        if path.is_file() {
            add_file_to_zip(zip, &path, &zip_path, options)?;
        } else if path.is_dir() {
            zip.add_directory(&format!("{}/", zip_path), options)
                .map_err(|e| format!("Failed to add directory to zip: {}", e))?;

            add_dir_to_zip(zip, &path, &zip_path, options)?;
        }
    }

    Ok(())
}

fn add_dir_to_zip_with_prefix(
    zip: &mut ZipWriter<std::fs::File>,
    dir_path: &std::path::Path,
    zip_prefix: &str,
    options: SimpleFileOptions,
) -> Result<(), String> {
    add_dir_to_zip(zip, dir_path, zip_prefix, options)
}
