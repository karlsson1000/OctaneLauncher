use super::*;

impl InstanceImporter {
    pub(super) fn infer_loader_from_mods(content_root: &Path) -> Option<String> {
        let mods_dir = content_root.join("mods");
        let entries = fs::read_dir(&mods_dir).ok()?;

        let mut jars = 0;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jar") {
                continue;
            }

            jars += 1;
            if jars > 25 {
                break;
            }

            if let Some(loader) = Self::infer_jar_loader(&path) {
                return Some(loader);
            }
        }

        None
    }

    fn infer_jar_loader(jar_path: &Path) -> Option<String> {
        let file = fs::File::open(jar_path).ok()?;
        let mut archive = ZipArchive::new(file).ok()?;

        let marker_for = |name: &str| -> Option<&'static str> {
            if name == "fabric.mod.json" {
                Some("fabric")
            } else if name == "META-INF/neoforge.mods.toml" {
                Some("neoforge")
            } else if name == "META-INF/mods.toml" || name == "mcmod.info" {
                Some("forge")
            } else {
                None
            }
        };

        for i in 0..archive.len() {
            let Ok(file) = archive.by_index(i) else { continue };
            if let Some(loader) = marker_for(file.name()) {
                return Some(loader.to_string());
            }
        }

        None
    }

    pub(super) fn infer_mc_version(content_root: &Path) -> Option<String> {
        let versions_dir = content_root.join("versions");
        if let Ok(entries) = fs::read_dir(&versions_dir) {
            for entry in entries.flatten().take(5) {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let version_json = path.join("version.json");
                if let Ok(content) = fs::read_to_string(&version_json) {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(id) = value.get("id").and_then(|v| v.as_str()) {
                            return Some(id.to_string());
                        }
                    }
                }
            }
        }

        Self::infer_mc_version_from_log(content_root)
    }

    fn infer_mc_version_from_log(content_root: &Path) -> Option<String> {
        let log_path = content_root.join("logs").join("latest.log");
        let Ok(content) = fs::read_to_string(&log_path) else {
            return None;
        };

        for line in content.lines().take(500) {
            if let Some(idx) = line.find("Loading Minecraft ") {
                let rest = &line[idx + "Loading Minecraft ".len()..];
                let version: String =
                    rest.chars().take_while(|c| !c.is_whitespace()).collect();
                if !version.is_empty() && version.chars().next().is_some_and(|c| c.is_ascii_digit())
                {
                    return Some(version);
                }
            }
        }

        None
    }
}
