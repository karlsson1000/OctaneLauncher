use super::*;

impl InstanceImporter {
    pub(super) fn parse_mmc_pack(path: &Path) -> (Option<String>, Option<String>, Option<String>) {
        let Ok(content) = fs::read_to_string(path) else {
            return (None, None, None);
        };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) else {
            return (None, None, None);
        };

        let mut mc_version = None;
        let mut loader = None;
        let mut loader_version = None;

        if let Some(components) = value.get("components").and_then(|c| c.as_array()) {
            for component in components {
                let Some(uid) = component.get("uid").and_then(|u| u.as_str()) else {
                    continue;
                };
                let version = component
                    .get("version")
                    .or_else(|| component.get("cachedVersion"))
                    .and_then(|v| v.as_str())
                    .map(String::from);

                match uid {
                    "net.minecraft" => mc_version = version,
                    "net.fabricmc.fabric-loader" => {
                        loader = Some("fabric".to_string());
                        loader_version = version;
                    }
                    "net.minecraftforge" => {
                        loader = Some("forge".to_string());
                        loader_version = version;
                    }
                    u if u.starts_with("net.neoforged") => {
                        loader = Some("neoforge".to_string());
                        loader_version = version;
                    }
                    _ => {}
                }
            }
        }

        (mc_version, loader, loader_version)
    }

    pub(super) fn parse_curseforge_manifest(
        path: &Path,
    ) -> (Option<String>, Option<String>, Option<String>, Option<String>) {
        let Ok(content) = fs::read_to_string(path) else {
            return (None, None, None, None);
        };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) else {
            return (None, None, None, None);
        };

        let name = value
            .get("name")
            .and_then(|v| v.as_str())
            .map(String::from);

        let Some(minecraft) = value.get("minecraft") else {
            return (name, None, None, None);
        };

        let mc_version = minecraft
            .get("version")
            .and_then(|v| v.as_str())
            .map(String::from);

        let mut loader = None;
        let mut loader_version = None;

        if let Some(mod_loaders) = minecraft.get("modLoaders").and_then(|m| m.as_array()) {
            for mod_loader in mod_loaders {
                let Some(id) = mod_loader.get("id").and_then(|i| i.as_str()) else {
                    continue;
                };
                if let Some((kind, version)) = id.split_once('-') {
                    loader = Some(kind.to_lowercase());
                    loader_version = Some(version.to_string());
                    break;
                }
            }
        }

        (name, mc_version, loader, loader_version)
    }

    pub(super) fn parse_modrinth_metadata(
        dir: &Path,
    ) -> (
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    ) {
        match Self::read_modrinth_metadata(dir) {
            Some(value) => {
                let metadata = value.get("metadata").unwrap_or(&value);
                let name = metadata
                    .get("name")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let mc_version = metadata
                    .get("game_version")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let loader = metadata
                    .get("loader")
                    .and_then(|v| v.as_str())
                    .filter(|l| !l.is_empty() && *l != "vanilla" && *l != "unknown")
                    .map(String::from);
                let loader_version = metadata
                    .get("loader_version")
                    .and_then(|v| v.as_str())
                    .filter(|l| !l.is_empty())
                    .map(String::from);
                let raw_icon = metadata
                    .get("icon")
                    .and_then(|v| v.as_str())
                    .filter(|i| !i.is_empty());
                let icon = raw_icon.map(|i| {
                    let p = PathBuf::from(i);
                    if p.is_absolute() {
                        p
                    } else {
                        dir.join(p)
                    }
                });
                let icon = icon
                    .filter(|p| p.is_file())
                    .map(|p| p.to_string_lossy().to_string());
                (name, mc_version, loader, loader_version, icon)
            }
            None => (None, None, None, None, None),
        }
    }

    pub(super) fn parse_prism_instance_cfg(path: &Path) -> Option<String> {
        let content = fs::read_to_string(path).ok()?;
        for line in content.lines() {
            if let Some(value) = line.strip_prefix("name=") {
                return Some(value.trim().to_string());
            }
        }
        None
    }

    pub(super) fn read_modrinth_metadata(dir: &Path) -> Option<serde_json::Value> {
        let entries = fs::read_dir(dir).ok()?;
        for entry in entries.flatten().take(10) {
            let path = entry.path();
            let is_json = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("json"))
                .unwrap_or(false);
            if !is_json {
                continue;
            }
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) {
                    let metadata = value.get("metadata").unwrap_or(&value);
                    if metadata.get("game_version").is_some() {
                        return Some(value);
                    }
                }
            }
        }
        None
    }
}
