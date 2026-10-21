use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "windows")]
pub fn find_java_homes_from_registry() -> Vec<String> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    let hives = [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER];
    let roots = [
        r"SOFTWARE\JavaSoft\JDK",
        r"SOFTWARE\JavaSoft\Java Runtime Environment",
        r"SOFTWARE\JavaSoft\JRE",
        r"SOFTWARE\Eclipse Adoptium\JDK",
        r"SOFTWARE\Eclipse Adoptium\JRE",
        r"SOFTWARE\Microsoft\JDK",
        r"SOFTWARE\Amazon Corretto",
        r"SOFTWARE\Azul Systems\Zulu",
    ];

    let mut homes: Vec<String> = Vec::new();
    for hive in hives {
        let hkey = RegKey::predef(hive);
        for root in roots {
            let Ok(key) = hkey.open_subkey(root) else { continue };
            if let Ok(home) = key.get_value::<String, _>("JavaHome") {
                homes.push(home);
            }
            for sub in key.enum_keys().flatten() {
                if let Ok(subkey) = key.open_subkey(&sub) {
                    if let Ok(home) = subkey.get_value::<String, _>("JavaHome") {
                        homes.push(home);
                    }
                }
            }
        }
    }
    homes
}

pub fn find_java() -> Option<String> {
    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        #[cfg(target_os = "windows")]
        {
            let javaw_path = PathBuf::from(&java_home).join("bin").join("javaw.exe");
            if javaw_path.exists() {
                return Some(javaw_path.to_string_lossy().to_string());
            }
        }
        let java_bin = if cfg!(windows) { "java.exe" } else { "java" };
        let java_path = PathBuf::from(&java_home).join("bin").join(java_bin);
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
                            let candidate = PathBuf::from(&trimmed);
                            if candidate.file_name().and_then(|f| f.to_str()) == Some("java.exe") {
                                if let Some(parent) = candidate.parent() {
                                    let javaw = parent.join("javaw.exe");
                                    if javaw.exists() {
                                        return Some(javaw.to_string_lossy().to_string());
                                    }
                                }
                            }
                            return Some(trimmed);
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let search_roots = [
            r"C:\Program Files\Java",
            r"C:\Program Files (x86)\Java",
            r"C:\Program Files\Eclipse Adoptium",
            r"C:\Program Files (x86)\Eclipse Adoptium",
            r"C:\Program Files\Microsoft",
            r"C:\Program Files\Zulu",
            r"C:\Program Files\GraalVM",
            r"C:\Program Files\BellSoft",
            r"C:\Program Files\Amazon Corretto",
        ];
        if let Some(path) = scan_jvm_dirs(&search_roots, "bin\\javaw.exe") {
            return Some(path);
        }
        if let Some(path) = scan_jvm_dirs(&search_roots, "bin\\java.exe") {
            return Some(path);
        }
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let local_programs = PathBuf::from(local_app_data).join("Programs");
            if local_programs.exists() {
                if let Ok(entries) = fs::read_dir(&local_programs) {
                    for entry in entries.flatten() {
                        let javaw_path = entry.path().join("bin").join("javaw.exe");
                        if javaw_path.exists() {
                            return Some(javaw_path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }

        let mut registry_homes = find_java_homes_from_registry();
        registry_homes.sort();
        registry_homes.dedup();
        for home in registry_homes {
            let home_dir = PathBuf::from(&home);
            let javaw = home_dir.join("bin").join("javaw.exe");
            if javaw.exists() {
                return Some(javaw.to_string_lossy().to_string());
            }
            let java = home_dir.join("bin").join("java.exe");
            if java.exists() {
                return Some(java.to_string_lossy().to_string());
            }
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

fn parse_java_major_from_dirname(dirname: &str) -> u32 {
    dirname.split(|c: char| !c.is_ascii_digit() && c != '.')
        .filter(|s| !s.is_empty())
        .filter_map(|s| {
            let parts: Vec<&str> = s.split('.').collect();
            if parts.len() >= 2 && parts[0] == "1" {
                parts[1].parse::<u32>().ok()
            } else {
                parts[0].parse::<u32>().ok()
            }
        })
        .max()
        .unwrap_or(0)
}

fn scan_jvm_dirs(roots: &[&str], binary_relative: &str) -> Option<String> {
    let mut candidates: Vec<(PathBuf, u32)> = Vec::new();

    for root in roots {
        let root_path = PathBuf::from(root);
        if !root_path.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&root_path) {
            for entry in entries.flatten() {
                let java_bin = entry.path().join(binary_relative);
                if java_bin.exists() {
                    let version = entry.path()
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(parse_java_major_from_dirname)
                        .unwrap_or(0);
                    candidates.push((java_bin, version));
                }
            }
        }
    }

    candidates.sort_by(|a, b| b.1.cmp(&a.1));
    candidates.into_iter().next().map(|(p, _)| p.to_string_lossy().to_string())
}
