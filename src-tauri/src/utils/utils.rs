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