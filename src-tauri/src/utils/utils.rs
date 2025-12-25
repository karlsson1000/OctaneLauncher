use std::{path::PathBuf, process::Command, fs};

pub fn get_current_os() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();

    #[cfg(target_os = "macos")]
    return "osx".to_string();

    #[cfg(target_os = "linux")]
    return "linux".to_string();
}

pub fn get_launcher_dir() -> PathBuf {
    let home = dirs::home_dir().expect("Could not find home directory");

    #[cfg(target_os = "windows")]
    let launcher_dir = home.join("AppData").join("Roaming").join("Atomic Launcher");

    #[cfg(target_os = "macos")]
    let launcher_dir = home
        .join("Library")
        .join("Application Support")
        .join("Atomic Launcher");

    #[cfg(target_os = "linux")]
    let launcher_dir = home.join(".atomic-launcher");

    launcher_dir
}

pub fn get_meta_dir() -> PathBuf {
    get_launcher_dir().join("meta")
}

pub fn get_logs_dir() -> PathBuf {
    get_launcher_dir().join("logs")
}

pub fn get_instances_dir() -> PathBuf {
    get_launcher_dir().join("instances")
}

pub fn get_instance_dir(instance_name: &str) -> PathBuf {
    get_instances_dir().join(instance_name)
}

pub fn find_java() -> Option<String> {
    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let java_path = PathBuf::from(java_home)
            .join("bin")
            .join(if cfg!(windows) { "java.exe" } else { "java" });
        if java_path.exists() {
            return Some(java_path.to_string_lossy().to_string());
        }
    }

    let java_cmd = if cfg!(windows) { "java.exe" } else { "java" };
    if let Ok(output) = Command::new("which").arg(java_cmd).output() {
        if output.status.success() {
            if let Ok(path) = String::from_utf8(output.stdout) {
                return Some(path.trim().to_string());
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let common_paths = vec![
            r"C:\Program Files\Java\jdk-17\bin\java.exe",
            r"C:\Program Files\Java\jdk-21\bin\java.exe",
            r"C:\Program Files\Eclipse Adoptium\jdk-17.0.8.7-hotspot\bin\java.exe",
            r"C:\Program Files\Eclipse Adoptium\jdk-21.0.1.12-hotspot\bin\java.exe",
        ];

        for path in common_paths {
            if PathBuf::from(path).exists() {
                return Some(path.to_string());
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let common_paths = vec![
            "/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home/bin/java",
            "/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home/bin/java",
        ];

        for path in common_paths {
            if PathBuf::from(path).exists() {
                return Some(path.to_string());
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let common_paths = vec![
            "/usr/lib/jvm/java-17-openjdk-amd64/bin/java",
            "/usr/lib/jvm/java-21-openjdk-amd64/bin/java",
            "/usr/lib/jvm/default-java/bin/java",
        ];

        for path in common_paths {
            if PathBuf::from(path).exists() {
                return Some(path.to_string());
            }
        }
    }

    None
}

pub fn open_folder(path: PathBuf) -> Result<(), std::io::Error> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer").arg(path).spawn()?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(path).spawn()?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open").arg(path).spawn()?;
    }

    Ok(())
}

/// Generate a comprehensive debug report for troubleshooting
pub fn generate_debug_report(version: &str) -> String {
    let mut report = String::new();
    
    report.push_str("=== ATOMIC LAUNCHER DEBUG REPORT ===\n\n");
    
    // System Information
    report.push_str("## SYSTEM INFORMATION\n");
    report.push_str(&format!("OS: {}\n", get_current_os()));
    report.push_str(&format!("Target: {}\n", std::env::consts::OS));
    report.push_str(&format!("Architecture: {}\n\n", std::env::consts::ARCH));
    
    // Directories
    report.push_str("## LAUNCHER DIRECTORIES\n");
    let launcher_dir = get_launcher_dir();
    report.push_str(&format!("Launcher Dir: {}\n", launcher_dir.display()));
    report.push_str(&format!("Launcher Dir Exists: {}\n", launcher_dir.exists()));
    
    let meta_dir = get_meta_dir();
    report.push_str(&format!("Meta Dir: {}\n", meta_dir.display()));
    report.push_str(&format!("Meta Dir Exists: {}\n\n", meta_dir.exists()));
    
    // Java Detection
    report.push_str("## JAVA DETECTION\n");
    if let Some(java) = find_java() {
        report.push_str(&format!("Java Found: {}\n", java));
        
        // Try to get Java version
        if let Ok(output) = Command::new(&java).arg("-version").output() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            report.push_str(&format!("Java Version Output:\n{}\n", stderr));
        }
    } else {
        report.push_str("Java NOT FOUND!\n");
    }
    report.push_str("\n");
    
    // Version-specific checks
    report.push_str(&format!("## VERSION {} INSTALLATION CHECK\n", version));
    
    let version_dir = meta_dir.join("versions").join(version);
    report.push_str(&format!("Version Dir: {}\n", version_dir.display()));
    report.push_str(&format!("Version Dir Exists: {}\n", version_dir.exists()));
    
    let jar_path = version_dir.join(format!("{}.jar", version));
    report.push_str(&format!("JAR Path: {}\n", jar_path.display()));
    report.push_str(&format!("JAR Exists: {}\n", jar_path.exists()));
    if jar_path.exists() {
        if let Ok(metadata) = fs::metadata(&jar_path) {
            report.push_str(&format!("JAR Size: {} bytes\n", metadata.len()));
        }
    }
    
    let json_path = version_dir.join(format!("{}.json", version));
    report.push_str(&format!("JSON Path: {}\n", json_path.display()));
    report.push_str(&format!("JSON Exists: {}\n\n", json_path.exists()));
    
    // Libraries directory check
    report.push_str("## LIBRARIES CHECK\n");
    let libraries_dir = meta_dir.join("libraries");
    report.push_str(&format!("Libraries Dir: {}\n", libraries_dir.display()));
    report.push_str(&format!("Libraries Dir Exists: {}\n", libraries_dir.exists()));
    
    if libraries_dir.exists() {
        let mut lib_count = 0;
        if let Ok(entries) = fs::read_dir(&libraries_dir) {
            for _entry in entries.flatten() {
                lib_count += 1;
            }
        }
        report.push_str(&format!("Top-level library folders: {}\n", lib_count));
    }
    report.push_str("\n");
    
    // Native libraries check
    report.push_str("## NATIVE LIBRARIES CHECK\n");
    let current_os = get_current_os();
    report.push_str(&format!("Checking natives for OS: {}\n", current_os));
    
    if json_path.exists() {
        if let Ok(json_content) = fs::read_to_string(&json_path) {
            // Try to parse and check for natives
            if let Ok(version_details) = serde_json::from_str::<serde_json::Value>(&json_content) {
                if let Some(libraries) = version_details.get("libraries").and_then(|v| v.as_array()) {
                    let mut natives_found = 0;
                    let mut natives_for_os = 0;
                    let mut natives_existing = 0;
                    
                    for lib in libraries {
                        if let Some(name) = lib.get("name").and_then(|v| v.as_str()) {
                            if name.contains(":natives-") {
                                natives_found += 1;
                                
                                let matches_os = (current_os == "windows" && name.contains(":natives-windows"))
                                    || (current_os == "linux" && name.contains(":natives-linux"))
                                    || (current_os == "osx" && (name.contains(":natives-macos") || name.contains(":natives-osx")));
                                
                                if matches_os {
                                    natives_for_os += 1;
                                    
                                    // Check if file exists
                                    if let Some(path) = lib.get("downloads")
                                        .and_then(|d| d.get("artifact"))
                                        .and_then(|a| a.get("path"))
                                        .and_then(|p| p.as_str())
                                    {
                                        let native_path = libraries_dir.join(path);
                                        if native_path.exists() {
                                            natives_existing += 1;
                                            if let Ok(metadata) = fs::metadata(&native_path) {
                                                report.push_str(&format!("  ✓ {} ({} bytes)\n", path, metadata.len()));
                                            }
                                        } else {
                                            report.push_str(&format!("  ✗ MISSING: {}\n", path));
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    report.push_str(&format!("\nTotal native libraries in manifest: {}\n", natives_found));
                    report.push_str(&format!("Native libraries for {}: {}\n", current_os, natives_for_os));
                    report.push_str(&format!("Native libraries actually downloaded: {}\n", natives_existing));
                    
                    if natives_for_os == 0 {
                        report.push_str("\nWARNING: NO NATIVES FOUND FOR YOUR OS!\n");
                        report.push_str("This will cause launch failures!\n");
                    } else if natives_existing < natives_for_os {
                        report.push_str(&format!("\nWARNING: MISSING {} NATIVE FILES!\n", natives_for_os - natives_existing));
                        report.push_str("Minecraft may fail to launch!\n");
                    }
                }
            }
        }
    }
    
    report.push_str("\n=== END DEBUG REPORT ===\n");
    
    report
}