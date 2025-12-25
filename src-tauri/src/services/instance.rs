use crate::services::installer::should_include_library;
use crate::models::{FabricProfileJson, Instance, VersionDetails};
use crate::utils::*;
use chrono::Utc;
use std::io::{BufRead, BufReader};
use std::{fs, process::{Command, Stdio}};
use tauri::Emitter;
use zip::ZipArchive;

pub struct InstanceManager;

impl InstanceManager {
    pub fn create(
        instance_name: &str,
        version: &str,
        loader: Option<String>,
        loader_version: Option<String>,
    ) -> Result<Instance, Box<dyn std::error::Error>> {
        let instance_dir = get_instance_dir(instance_name);

        if instance_dir.exists() {
            return Err(format!("Instance '{}' already exists!", instance_name).into());
        }

        // Create instance directory structure
        fs::create_dir_all(&instance_dir)?;
        fs::create_dir_all(instance_dir.join("saves"))?;
        fs::create_dir_all(instance_dir.join("resourcepacks"))?;
        fs::create_dir_all(instance_dir.join("shaderpacks"))?;
        fs::create_dir_all(instance_dir.join("mods"))?;
        fs::create_dir_all(instance_dir.join("logs"))?;

        // Save instance metadata
        let instance = Instance {
            name: instance_name.to_string(),
            version: version.to_string(),
            created_at: Utc::now().to_rfc3339(),
            last_played: None,
            loader,
            loader_version,
            settings_override: None,
            icon_path: None,
        };

        let instance_json = serde_json::to_string_pretty(&instance)?;
        fs::write(instance_dir.join("instance.json"), instance_json)?;

        Ok(instance)
    }

    pub fn get_all() -> Result<Vec<Instance>, Box<dyn std::error::Error>> {
        let instances_dir = get_instances_dir();

        if !instances_dir.exists() {
            return Ok(Vec::new());
        }

        let mut instances = Vec::new();

        let entries = fs::read_dir(&instances_dir)?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    let instance_json = path.join("instance.json");
                    if instance_json.exists() {
                        if let Ok(content) = fs::read_to_string(instance_json) {
                            if let Ok(instance) = serde_json::from_str::<Instance>(&content) {
                                instances.push(instance);
                            }
                        }
                    }
                }
            }
        }

        Ok(instances)
    }

    pub fn delete(instance_name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let instance_dir = get_instance_dir(instance_name);

        if !instance_dir.exists() {
            return Err(format!("Instance '{}' does not exist", instance_name).into());
        }

        fs::remove_dir_all(&instance_dir)?;

        Ok(())
    }

    #[allow(dead_code)]
    pub fn rename(old_name: &str, new_name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let old_dir = get_instance_dir(old_name);
        let new_dir = get_instance_dir(new_name);

        if !old_dir.exists() {
            return Err(format!("Instance '{}' does not exist", old_name).into());
        }

        if new_dir.exists() {
            return Err(format!("Instance '{}' already exists", new_name).into());
        }

        // Rename directory
        fs::rename(&old_dir, &new_dir)?;

        // Update metadata
        let instance_json = new_dir.join("instance.json");
        let mut instance: Instance = serde_json::from_str(&fs::read_to_string(&instance_json)?)?;

        instance.name = new_name.to_string();

        let updated_json = serde_json::to_string_pretty(&instance)?;
        fs::write(instance_json, updated_json)?;

        Ok(())
    }

    pub fn launch(
        instance_name: &str,
        username: &str,
        uuid: &str,
        access_token: &str,
        app_handle: tauri::AppHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        println!("=== Launching Instance: {} ===", instance_name);

        let meta_dir = get_meta_dir();
        let instance_dir = get_instance_dir(instance_name);

        if !instance_dir.exists() {
            return Err(format!("Instance '{}' does not exist", instance_name).into());
        }

        // Load instance metadata
        let instance_json = instance_dir.join("instance.json");
        let instance: Instance = serde_json::from_str(&fs::read_to_string(&instance_json)?)?;

        let version = instance.version.clone();
        println!("Version: {}", version);
        println!("Username: {}", username);

        // Load settings
        let global_settings = crate::services::settings::SettingsManager::load()
            .unwrap_or_default();

        let effective_settings = if let Some(override_settings) = &instance.settings_override {
            override_settings.clone()
        } else {
            global_settings
        };

        // Use the settings for Java path
        let java_path = if let Some(custom_java) = &effective_settings.java_path {
            custom_java.clone()
        } else {
            find_java().ok_or("Java not found. Please install Java 17 or higher.")?
        };

        println!("Java found: {}", java_path);
        println!("RAM allocation: {}MB", effective_settings.memory_mb);

        // Check if this is a Fabric instance
        let is_fabric = version.contains("fabric-loader");
        println!("Is Fabric: {}", is_fabric);

        let versions_dir = meta_dir.join("versions").join(&version);
        let json_path = versions_dir.join(format!("{}.json", version));

        if !json_path.exists() {
            return Err(format!("Version {} is not installed!", version).into());
        }

        let json_content = fs::read_to_string(&json_path)?;

        // Parse the profile based on type
        let (main_class, base_version_id, all_libraries, assets_id) = if is_fabric {
            println!("Parsing as Fabric profile...");
            
            let fabric_profile: FabricProfileJson = serde_json::from_str(&json_content)
                .map_err(|e| format!("Failed to parse Fabric profile: {}", e))?;
            
            println!("Fabric main class: {}", fabric_profile.main_class);
            println!("Inherits from: {}", fabric_profile.inherits_from);
            
            let base_version_dir = meta_dir.join("versions").join(&fabric_profile.inherits_from);
            let base_json_path = base_version_dir.join(format!("{}.json", fabric_profile.inherits_from));
            
            if !base_json_path.exists() {
                return Err(format!(
                    "Base Minecraft version {} not found! Please install it first.",
                    fabric_profile.inherits_from
                ).into());
            }
            
            let base_json_content = fs::read_to_string(&base_json_path)?;
            let base_version: VersionDetails = serde_json::from_str(&base_json_content)?;
            
            println!("Loaded base Minecraft version: {}", base_version.id);
            
            let mut combined_libs = Vec::new();
            
            for lib in &fabric_profile.libraries {
                combined_libs.push((lib.name.clone(), lib.url.clone(), None));
            }
            
            for lib in &base_version.libraries {
                if let Some(downloads) = &lib.downloads {
                    if let Some(artifact) = &downloads.artifact {
                        combined_libs.push((
                            lib.name.clone(),
                            String::new(),
                            Some(artifact.path.clone())
                        ));
                    }
                } else {
                    combined_libs.push((lib.name.clone(), String::new(), None));
                }
            }
            
            (
                fabric_profile.main_class,
                fabric_profile.inherits_from,
                combined_libs,
                base_version.assets,
            )
        } else {
            println!("Parsing as vanilla Minecraft profile...");
            
            let version_details: VersionDetails = serde_json::from_str(&json_content)
                .map_err(|e| format!("Failed to parse Minecraft profile: {}", e))?;
            
            let mut libs = Vec::new();
            for lib in &version_details.libraries {
                if let Some(downloads) = &lib.downloads {
                    if let Some(artifact) = &downloads.artifact {
                        libs.push((
                            lib.name.clone(),
                            String::new(),
                            Some(artifact.path.clone())
                        ));
                    }
                } else {
                    libs.push((lib.name.clone(), String::new(), None));
                }
            }
            
            (
                version_details.main_class,
                version_details.id.clone(),
                libs,
                version_details.assets,
            )
        };

        // Create natives directory
        let natives_dir = instance_dir.join("natives");
        fs::create_dir_all(&natives_dir)?;

        // Load the base version to extract native libraries
        let base_version_dir = meta_dir.join("versions").join(&base_version_id);
        let base_json_path = base_version_dir.join(format!("{}.json", base_version_id));
        let base_json_content = fs::read_to_string(&base_json_path)?;
        let base_version: VersionDetails = serde_json::from_str(&base_json_content)?;
        
        let current_os = get_current_os();
        let libraries_dir = meta_dir.join("libraries");
        
        println!("Extracting native libraries for OS: {}", current_os);
        let mut natives_extracted = 0;
        let mut natives_attempted = 0;
        
        for library in &base_version.libraries {
            let is_native = library.name.contains(":natives-");
            
            if !is_native {
                continue;
            }
            
            let platform_suffix = if library.name.contains(":natives-windows") {
                "windows"
            } else if library.name.contains(":natives-linux") {
                "linux"
            } else if library.name.contains(":natives-macos") || library.name.contains(":natives-osx") {
                "osx"
            } else {
                ""
            };
            
            if platform_suffix != current_os {
                continue;
            }
            
            if let Some(rules) = &library.rules {
                if !should_include_library(rules, &current_os) {
                    continue;
                }
            }
            
            if let Some(downloads) = &library.downloads {
                if let Some(artifact) = &downloads.artifact {
                    natives_attempted += 1;
                    let native_path = libraries_dir.join(&artifact.path);
                    
                    println!("  → Processing native: {} ({})", library.name, artifact.path);
                    
                    if native_path.exists() {
                        match fs::File::open(&native_path) {
                            Ok(file) => {
                                match ZipArchive::new(file) {
                                    Ok(mut archive) => {
                                        for i in 0..archive.len() {
                                            if let Ok(mut file) = archive.by_index(i) {
                                                let file_name = file.name().to_string();
                                                
                                                if file_name.ends_with('/') || file_name.starts_with("META-INF") {
                                                    continue;
                                                }
                                                
                                                let outpath = natives_dir.join(&file_name);
                                                
                                                if let Some(parent) = outpath.parent() {
                                                    let _ = fs::create_dir_all(parent);
                                                }
                                                
                                                if let Ok(mut outfile) = fs::File::create(&outpath) {
                                                    if std::io::copy(&mut file, &mut outfile).is_ok() {
                                                        natives_extracted += 1;
                                                    }
                                                }
                                            }
                                        }
                                        println!("    ✓ Extracted native library");
                                    }
                                    Err(e) => println!("    ✗ Failed to open native archive: {}", e),
                                }
                            }
                            Err(e) => println!("    ✗ Failed to open native file: {}", e),
                        }
                    } else {
                        println!("    ✗ Native library not found at: {}", native_path.display());
                        println!("       CRITICAL: This will cause LWJGL to fail!");
                        return Err(format!(
                            "Native library missing: {}. Please reinstall Minecraft {}",
                            artifact.path, base_version_id
                        ).into());
                    }
                }
            }
        }
        
        println!("✓ Extracted {} native library files from {} native JARs", natives_extracted, natives_attempted);
        
        if natives_attempted == 0 {
            return Err(format!(
                "CRITICAL ERROR: No native libraries found for OS '{}'. Minecraft cannot start without natives. Please reinstall Minecraft version {}",
                current_os, base_version_id
            ).into());
        }
        
        if natives_extracted == 0 && natives_attempted > 0 {
            return Err(format!(
                "CRITICAL ERROR: Found {} native JARs but failed to extract any files. Check file permissions and disk space.",
                natives_attempted
            ).into());
        }

        // Build classpath
        let mut classpath = Vec::new();
        println!("Building classpath from {} libraries...", all_libraries.len());
        
        for (lib_name, _lib_url, artifact_path) in all_libraries {
            let parts: Vec<&str> = lib_name.split(':').collect();
            if parts.len() != 3 {
                continue;
            }
            
            let (group, artifact, lib_version) = (parts[0], parts[1], parts[2]);
            
            let lib_path = if let Some(path) = artifact_path {
                libraries_dir.join(path)
            } else {
                let group_path = group.replace('.', "/");
                let jar_name = format!("{}-{}.jar", artifact, lib_version);
                libraries_dir
                    .join(&group_path)
                    .join(artifact)
                    .join(lib_version)
                    .join(&jar_name)
            };
            
            if lib_path.exists() {
                classpath.push(lib_path.to_string_lossy().to_string());
            } else {
                println!("Warning: Library not found: {}", lib_path.display());
            }
        }

        let client_jar = meta_dir
            .join("versions")
            .join(&base_version_id)
            .join(format!("{}.jar", base_version_id));

        if !client_jar.exists() {
            return Err(format!(
                "Minecraft {} JAR not found at: {}",
                base_version_id,
                client_jar.display()
            ).into());
        }

        classpath.push(client_jar.to_string_lossy().to_string());
        
        println!("Total classpath entries: {}", classpath.len());

        let classpath_separator = if cfg!(windows) { ";" } else { ":" };
        let classpath_str = classpath.join(classpath_separator);

        println!("Main class: {}", main_class);
        println!("Assets ID: {}", assets_id);
        println!("Natives directory: {}", natives_dir.display());
        println!("Starting Minecraft process...");

        let mut cmd = Command::new(java_path);
        cmd.arg(format!("-Xmx{}M", effective_settings.memory_mb))
            .arg(format!("-Xms{}M", effective_settings.memory_mb))
            .arg(format!("-Djava.library.path={}", natives_dir.display()))
            .arg("-cp")
            .arg(&classpath_str);

        cmd.arg(&main_class)
            .arg("--username")
            .arg(username)
            .arg("--uuid")
            .arg(uuid)
            .arg("--accessToken")
            .arg("${env:MINECRAFT_ACCESS_TOKEN}")
            .arg("--version")
            .arg(&version)
            .arg("--gameDir")
            .arg(&instance_dir)
            .arg("--assetsDir")
            .arg(meta_dir.join("assets"))
            .arg("--assetIndex")
            .arg(&assets_id);

        // Set access token as environment variable
        cmd.env("MINECRAFT_ACCESS_TOKEN", access_token);

        cmd.current_dir(&instance_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn Minecraft process: {}", e))?;

        println!("✓ Minecraft process started (PID: {:?})", child.id());

        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let instance_name_clone = instance_name.to_string();
            let app_handle_clone = app_handle.clone();
            
            std::thread::spawn(move || {
                for line in reader.lines() {
                    if let Ok(line) = line {
                        // Filter out any lines that might contain the access token
                        if !line.contains("accessToken") && !line.contains("MINECRAFT_ACCESS_TOKEN") {
                            println!("[STDOUT] {}", line);
                            let _ = app_handle_clone.emit("console-log", serde_json::json!({
                                "instance": instance_name_clone,
                                "message": line,
                                "type": "stdout"
                            }));
                        }
                    }
                }
            });
        }

        // Capture stderr
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let instance_name_clone = instance_name.to_string();
            let app_handle_clone = app_handle.clone();
            
            std::thread::spawn(move || {
                for line in reader.lines() {
                    if let Ok(line) = line {
                        // Filter out any lines that might contain the access token
                        if !line.contains("accessToken") && !line.contains("MINECRAFT_ACCESS_TOKEN") {
                            println!("[STDERR] {}", line);
                            let _ = app_handle_clone.emit("console-log", serde_json::json!({
                                "instance": instance_name_clone,
                                "message": line,
                                "type": "stderr"
                            }));
                        }
                    }
                }
            });
        }

        // Update last played time
        let mut updated_instance = instance.clone();
        updated_instance.last_played = Some(Utc::now().to_rfc3339());

        let updated_json = serde_json::to_string_pretty(&updated_instance)?;
        fs::write(instance_json, updated_json)?;

        println!("✓ Launch command completed successfully!");

        Ok(())
    }
}