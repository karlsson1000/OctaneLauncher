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
    let launcher_dir = home.join("AppData").join("Roaming").join("Octane Launcher");

    #[cfg(target_os = "macos")]
    let launcher_dir = home
        .join("Library")
        .join("Application Support")
        .join("Octane Launcher");

    #[cfg(target_os = "linux")]
    let launcher_dir = home.join(".octane-launcher");

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
        let java_path = PathBuf::from(&java_home)
            .join("bin")
            .join(if cfg!(windows) { "java.exe" } else { "java" });
        if java_path.exists() {
            return Some(java_path.to_string_lossy().to_string());
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = Command::new("which").arg("java").output() {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    let trimmed = path.trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(trimmed);
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = Command::new("where");
        cmd.arg("java");
        cmd.creation_flags(0x08000000);
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                if let Ok(paths) = String::from_utf8(output.stdout) {
                    if let Some(first) = paths.lines().next() {
                        let trimmed = first.trim().to_string();
                        if !trimmed.is_empty() {
                            return Some(trimmed);
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = Command::new("/usr/libexec/java_home").output() {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    let java = PathBuf::from(path.trim()).join("bin").join("java");
                    if java.exists() {
                        return Some(java.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let search_roots = [
            r"C:\Program Files\Java",
            r"C:\Program Files\Eclipse Adoptium",
            r"C:\Program Files\Microsoft",
            r"C:\Program Files\Zulu",
            r"C:\Program Files\GraalVM",
            r"C:\Program Files\BellSoft",
        ];
        if let Some(path) = scan_jvm_dirs(&search_roots, "bin\\java.exe") {
            return Some(path);
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(path) = scan_jvm_dirs_macos(&["/Library/Java/JavaVirtualMachines"]) {
            return Some(path);
        }
    }

    #[cfg(target_os = "linux")]
    {
        let search_roots = [
            "/usr/lib/jvm",
            "/usr/local/lib/jvm",
        ];
        if let Some(path) = scan_jvm_dirs(&search_roots, "bin/java") {
            return Some(path);
        }
        let snap_path = PathBuf::from("/snap/bin/java");
        if snap_path.exists() {
            return Some(snap_path.to_string_lossy().to_string());
        }
    }

    None
}

fn scan_jvm_dirs(roots: &[&str], binary_relative: &str) -> Option<String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    for root in roots {
        let root_path = PathBuf::from(root);
        if !root_path.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&root_path) {
            for entry in entries.flatten() {
                let java_bin = entry.path().join(binary_relative);
                if java_bin.exists() {
                    candidates.push(java_bin);
                }
            }
        }
    }

    candidates.sort_by(|a, b| b.cmp(a));
    candidates.into_iter().next().map(|p| p.to_string_lossy().to_string())
}

#[cfg(target_os = "macos")]
fn scan_jvm_dirs_macos(roots: &[&str]) -> Option<String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    for root in roots {
        let root_path = PathBuf::from(root);
        if !root_path.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&root_path) {
            for entry in entries.flatten() {
                let java_bin = entry.path()
                    .join("Contents")
                    .join("Home")
                    .join("bin")
                    .join("java");
                if java_bin.exists() {
                    candidates.push(java_bin);
                }
            }
        }
    }

    candidates.sort_by(|a, b| b.cmp(a));
    candidates.into_iter().next().map(|p| p.to_string_lossy().to_string())
}

pub fn open_folder(path: PathBuf) -> Result<(), std::io::Error> {
    #[cfg(target_os = "windows")]
    Command::new("explorer").arg(path).spawn()?;

    #[cfg(target_os = "macos")]
    Command::new("open").arg(path).spawn()?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open").arg(path).spawn()?;

    Ok(())
}