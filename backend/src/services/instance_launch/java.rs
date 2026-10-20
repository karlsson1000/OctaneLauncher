use super::*;

impl InstanceManager {
    pub(super) fn get_java_version(java_path: &str) -> Result<u32, Box<dyn std::error::Error>> {
        let mut cmd = Command::new(java_path);
        cmd.arg("-version");

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let output = cmd.output()?;

        let version_text = String::from_utf8_lossy(&output.stderr);

        for line in version_text.lines() {
            if let Some(captures) = line.split('"').nth(1) {
                if let Some(major) = Self::parse_major_version(captures) {
                    return Ok(major);
                }
            }

            if line.starts_with("openjdk") || line.starts_with("java") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    if let Some(major) = Self::parse_major_version(parts[1]) {
                        return Ok(major);
                    }
                }
            }
        }

        Err("Could not parse Java version from output".into())
    }

    fn parse_major_version(version_str: &str) -> Option<u32> {
        let parts: Vec<&str> = version_str.split('.').collect();

        if parts.is_empty() {
            return None;
        }

        if parts[0] == "1" && parts.len() > 1 {
            parts[1].parse::<u32>().ok()
        } else {
            parts[0].parse::<u32>().ok()
        }
    }

    fn get_required_java_version_from_meta(version: &str) -> Option<u32> {
        let meta_dir = get_meta_dir();
        let json_path = meta_dir.join("versions").join(version).join(format!("{}.json", version));
        let content = std::fs::read_to_string(&json_path).ok()?;
        let json: serde_json::Value = serde_json::from_str(&content).ok()?;

        let inherits_from = json.get("inheritsFrom").and_then(|v| v.as_str());
        let base_version = inherits_from.unwrap_or(version);

        if base_version != version {
            let base_path = meta_dir.join("versions").join(base_version).join(format!("{}.json", base_version));
            if let Ok(base_content) = std::fs::read_to_string(&base_path) {
                if let Ok(base_json) = serde_json::from_str::<serde_json::Value>(&base_content) {
                    if let Some(mv) = base_json.pointer("/javaVersion/majorVersion").and_then(|v| v.as_u64()) {
                        return Some(mv as u32);
                    }
                }
            }
        } else if let Some(mv) = json.pointer("/javaVersion/majorVersion").and_then(|v| v.as_u64()) {
            return Some(mv as u32);
        }

        None
    }

    pub(super) fn get_required_java_version(minecraft_version: &str) -> u32 {
        Self::get_required_java_version_from_meta(minecraft_version)
            .unwrap_or_else(|| Self::get_required_java_version_fallback(minecraft_version))
    }

    fn get_required_java_version_fallback(minecraft_version: &str) -> u32 {
        let base_version = if let Some(pos) = minecraft_version.find('-') {
            &minecraft_version[..pos]
        } else {
            minecraft_version
        };

        let parts: Vec<&str> = base_version.split('.').collect();
        if parts.len() >= 1 {
            if let Ok(major) = parts[0].parse::<u32>() {
                if major >= 26 {
                    return 25;
                }
            }
        }

        if parts.len() >= 2 {
            if let (Ok(major), Ok(minor)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                if major == 1 {
                    if minor == 20 && parts.len() >= 3 {
                        if let Ok(patch) = parts[2].parse::<u32>() {
                            if patch >= 5 {
                                return 21;
                            }
                        }
                    }

                    if minor > 20 { return 21; }
                    if minor == 20 { return 17; }
                    if minor >= 18 { return 17; }
                    if minor == 17 { return 16; }
                    if minor <= 16 { return 8; }
                }
            }
        }

        8
    }

    pub(super) fn is_java_compatible(found_major: u32, required_major: u32) -> bool {
        if required_major <= 8 {
            found_major == required_major
        } else {
            found_major >= required_major
        }
    }
}
