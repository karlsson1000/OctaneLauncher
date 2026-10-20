use super::args::process_arguments_args;
use super::*;

impl InstanceManager {
    pub(super) fn step_resolve_profile(
        instance_name: &str,
        version: &str,
        meta_dir: &PathBuf,
        app_handle: &tauri::AppHandle,
    ) -> Result<ResolvedProfile, Box<dyn std::error::Error>> {
        let is_fabric = version.contains("fabric-loader");
        let is_neoforge = version.starts_with("neoforge-");
        let is_forge = version.contains("-forge-");

        let versions_dir = meta_dir.join("versions").join(version);
        let json_path = versions_dir.join(format!("{}.json", version));

        if !json_path.exists() {
            let err_msg = format!("Version {} is not installed!", version);
            Self::emit_error_log(app_handle, instance_name, &err_msg);
            return Err(err_msg.into());
        }

        let json_content = fs::read_to_string(&json_path)
            .map_err(|e| format!("Failed to read version JSON: {}", e))?;

        let current_os = get_current_os();

        if is_fabric {
            Self::resolve_fabric_profile(instance_name, version, &json_content, &current_os, meta_dir, app_handle)
        } else if is_neoforge {
            Self::resolve_neoforge_profile(instance_name, version, &json_content, &current_os, meta_dir, app_handle)
        } else if is_forge {
            Self::resolve_forge_profile(instance_name, version, &json_content, &current_os, meta_dir, app_handle)
        } else {
            Self::resolve_vanilla_profile(instance_name, &json_content, app_handle)
        }
    }

    fn resolve_fabric_profile(
        instance_name: &str,
        _version: &str,
        json_content: &str,
        current_os: &str,
        meta_dir: &PathBuf,
        app_handle: &tauri::AppHandle,
    ) -> Result<ResolvedProfile, Box<dyn std::error::Error>> {
        let fabric_profile: FabricProfileJson = serde_json::from_str(json_content)
            .map_err(|e| format!("Failed to parse Fabric profile: {}", e))?;

        let base_version_dir = meta_dir.join("versions").join(&fabric_profile.inherits_from);
        let base_json_path = base_version_dir.join(format!("{}.json", fabric_profile.inherits_from));

        if !base_json_path.exists() {
            let err_msg = format!(
                "Base Minecraft version {} not found! Please install it first.",
                fabric_profile.inherits_from
            );
            Self::emit_error_log(app_handle, instance_name, &err_msg);
            return Err(err_msg.into());
        }

        let base_json_content = fs::read_to_string(&base_json_path)
            .map_err(|e| format!("Failed to read base version JSON: {}", e))?;

        let base_version: VersionDetails = serde_json::from_str(&base_json_content)
            .map_err(|e| format!("Failed to parse base version: {}", e))?;

        let assets_id = base_version.assets.clone();

        let mut combined_libs = Vec::new();
        let mut base_lib_names = HashSet::new();

        for lib in &base_version.libraries {
            if lib.name.contains(":natives-") {
                continue;
            }
            if let Some(rules) = &lib.rules {
                if !should_include_library(rules, current_os) {
                    continue;
                }
            }
            let parts: Vec<&str> = lib.name.split(':').collect();
            if parts.len() >= 2 {
                let lib_key = format!("{}:{}", parts[0], parts[1]);
                base_lib_names.insert(lib_key);
            }
        }

        for lib in &fabric_profile.libraries {
            let parts: Vec<&str> = lib.name.split(':').collect();
            if parts.len() >= 2 {
                let lib_key = format!("{}:{}", parts[0], parts[1]);
                if base_lib_names.contains(&lib_key) {
                    continue;
                }
            }
            combined_libs.push((lib.name.clone(), lib.url.clone(), None));
        }

        for lib in &base_version.libraries {
            if lib.name.contains(":natives-") {
                continue;
            }
            if let Some(rules) = &lib.rules {
                if !should_include_library(rules, current_os) {
                    continue;
                }
            }
            if let Some(downloads) = &lib.downloads {
                if let Some(artifact) = &downloads.artifact {
                    combined_libs.push((lib.name.clone(), String::new(), Some(artifact.path.clone())));
                }
            } else {
                combined_libs.push((lib.name.clone(), String::new(), None));
            }
        }

        Ok(ResolvedProfile {
            main_class: fabric_profile.main_class,
            base_version_id: fabric_profile.inherits_from,
            base_version,
            libraries: combined_libs,
            assets_id,
            is_neoforge: false,
            is_forge: false,
            jvm_arguments: Vec::new(),
            game_arguments: Vec::new(),
        })
    }

    fn resolve_neoforge_profile(
        instance_name: &str,
        _version: &str,
        json_content: &str,
        current_os: &str,
        meta_dir: &PathBuf,
        app_handle: &tauri::AppHandle,
    ) -> Result<ResolvedProfile, Box<dyn std::error::Error>> {
        let neoforge_profile: NeoForgeProfileJson = serde_json::from_str(json_content)
            .map_err(|e| format!("Failed to parse NeoForge profile: {}", e))?;

        let base_version_dir = meta_dir.join("versions").join(&neoforge_profile.inherits_from);
        let base_json_path = base_version_dir.join(format!("{}.json", neoforge_profile.inherits_from));

        if !base_json_path.exists() {
            let err_msg = format!(
                "Base Minecraft version {} not found! Please install it first.",
                neoforge_profile.inherits_from
            );
            Self::emit_error_log(app_handle, instance_name, &err_msg);
            return Err(err_msg.into());
        }

        let base_json_content = fs::read_to_string(&base_json_path)
            .map_err(|e| format!("Failed to read base version JSON: {}", e))?;

        let base_version: VersionDetails = serde_json::from_str(&base_json_content)
            .map_err(|e| format!("Failed to parse base version: {}", e))?;

        let assets_id = base_version.assets.clone();

        let mut combined_libs = Vec::new();
        let mut overlay_lib_keys = HashSet::new();

        for lib in &neoforge_profile.libraries {
            let parts: Vec<&str> = lib.name.split(':').collect();
            if parts.len() >= 2 {
                let lib_key = format!("{}:{}", parts[0], parts[1]);
                overlay_lib_keys.insert(lib_key);
            }
            combined_libs.push((lib.name.clone(), lib.url.clone().unwrap_or_default(), None));
        }

        for lib in &base_version.libraries {
            if lib.name.contains(":natives-") {
                continue;
            }
            if let Some(rules) = &lib.rules {
                if !should_include_library(rules, current_os) {
                    continue;
                }
            }
            let parts: Vec<&str> = lib.name.split(':').collect();
            if parts.len() >= 2 {
                let lib_key = format!("{}:{}", parts[0], parts[1]);
                if overlay_lib_keys.contains(&lib_key) {
                    continue;
                }
            }
            if let Some(downloads) = &lib.downloads {
                if let Some(artifact) = &downloads.artifact {
                    combined_libs.push((lib.name.clone(), String::new(), Some(artifact.path.clone())));
                }
            } else {
                combined_libs.push((lib.name.clone(), String::new(), None));
            }
        }

        let (jvm_arguments, game_arguments) = if let Some(args) = &neoforge_profile.arguments {
            (process_arguments_args(&args.jvm, current_os),
             process_arguments_args(&args.game, current_os))
        } else {
            (Vec::new(), Vec::new())
        };

        Ok(ResolvedProfile {
            main_class: neoforge_profile.main_class,
            base_version_id: neoforge_profile.inherits_from,
            base_version,
            libraries: combined_libs,
            assets_id,
            is_neoforge: true,
            is_forge: false,
            jvm_arguments,
            game_arguments,
        })
    }

    fn resolve_forge_profile(
        instance_name: &str,
        _version: &str,
        json_content: &str,
        current_os: &str,
        meta_dir: &PathBuf,
        app_handle: &tauri::AppHandle,
    ) -> Result<ResolvedProfile, Box<dyn std::error::Error>> {
        let forge_profile: ForgeProfileJson = serde_json::from_str(json_content)
            .map_err(|e| format!("Failed to parse Forge profile: {}", e))?;

        let base_version_dir = meta_dir.join("versions").join(&forge_profile.inherits_from);
        let base_json_path = base_version_dir.join(format!("{}.json", forge_profile.inherits_from));

        if !base_json_path.exists() {
            let err_msg = format!(
                "Base Minecraft version {} not found! Please install it first.",
                forge_profile.inherits_from
            );
            Self::emit_error_log(app_handle, instance_name, &err_msg);
            return Err(err_msg.into());
        }

        let base_json_content = fs::read_to_string(&base_json_path)
            .map_err(|e| format!("Failed to read base version JSON: {}", e))?;

        let base_version: VersionDetails = serde_json::from_str(&base_json_content)
            .map_err(|e| format!("Failed to parse base version: {}", e))?;

        let assets_id = base_version.assets.clone();

        let mut combined_libs = Vec::new();
        let mut overlay_lib_keys = HashSet::new();

        for lib in &forge_profile.libraries {
            let parts: Vec<&str> = lib.name.split(':').collect();
            if parts.len() >= 2 {
                let lib_key = format!("{}:{}", parts[0], parts[1]);
                overlay_lib_keys.insert(lib_key);
            }
            combined_libs.push((lib.name.clone(), lib.url.clone().unwrap_or_default(), None));
        }

        for lib in &base_version.libraries {
            if lib.name.contains(":natives-") {
                continue;
            }
            if let Some(rules) = &lib.rules {
                if !should_include_library(rules, current_os) {
                    continue;
                }
            }
            let parts: Vec<&str> = lib.name.split(':').collect();
            if parts.len() >= 2 {
                let lib_key = format!("{}:{}", parts[0], parts[1]);
                if overlay_lib_keys.contains(&lib_key) {
                    continue;
                }
            }
            if let Some(downloads) = &lib.downloads {
                if let Some(artifact) = &downloads.artifact {
                    combined_libs.push((lib.name.clone(), String::new(), Some(artifact.path.clone())));
                }
            } else {
                combined_libs.push((lib.name.clone(), String::new(), None));
            }
        }

        let (jvm_arguments, game_arguments) = if let Some(args) = &forge_profile.arguments {
            (process_arguments_args(&args.jvm, current_os),
             process_arguments_args(&args.game, current_os))
        } else {
            (Vec::new(), Vec::new())
        };

        Ok(ResolvedProfile {
            main_class: forge_profile.main_class,
            base_version_id: forge_profile.inherits_from,
            base_version,
            libraries: combined_libs,
            assets_id,
            is_neoforge: false,
            is_forge: true,
            jvm_arguments,
            game_arguments,
        })
    }

    fn resolve_vanilla_profile(
        _instance_name: &str,
        json_content: &str,
        _app_handle: &tauri::AppHandle,
    ) -> Result<ResolvedProfile, Box<dyn std::error::Error>> {
        let version_details: VersionDetails = serde_json::from_str(json_content)
            .map_err(|e| format!("Failed to parse Minecraft profile: {}", e))?;

        let current_os = get_current_os();
        let main_class = version_details.main_class.clone();
        let base_version_id = version_details.id.clone();
        let assets_id = version_details.assets.clone();

        let mut libs = Vec::new();
        for lib in &version_details.libraries {
            if lib.name.contains(":natives-") {
                continue;
            }
            if let Some(rules) = &lib.rules {
                if !should_include_library(rules, &current_os) {
                    continue;
                }
            }
            if let Some(downloads) = &lib.downloads {
                if let Some(artifact) = &downloads.artifact {
                    libs.push((lib.name.clone(), String::new(), Some(artifact.path.clone())));
                }
            } else {
                libs.push((lib.name.clone(), String::new(), None));
            }
        }

        Ok(ResolvedProfile {
            main_class,
            base_version_id,
            base_version: version_details,
            libraries: libs,
            assets_id,
            is_neoforge: false,
            is_forge: false,
            jvm_arguments: Vec::new(),
            game_arguments: Vec::new(),
        })
    }
}
