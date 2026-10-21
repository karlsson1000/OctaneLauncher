use zip::{write::SimpleFileOptions, ZipWriter};

pub(super) fn export_as_zip(
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

        let servers_dat = instance_dir.join("servers.dat");
        if servers_dat.exists() {
            add_file_to_zip(zip, &servers_dat, "servers.dat", options)?;
        }

        let servers_dat_old = instance_dir.join("servers.dat_old");
        if servers_dat_old.exists() {
            add_file_to_zip(zip, &servers_dat_old, "servers.dat_old", options)?;
        }
    }

    Ok(())
}

pub(super) fn add_file_to_zip(
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

pub(super) fn add_dir_to_zip(
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
