use super::*;

impl InstanceImporter {
    pub fn detect() -> Vec<ImportableInstance> {
        let mut found = Vec::new();

        for (source, roots) in Self::source_roots() {
            let modrinth_db = if source == "modrinth" {
                Self::load_modrinth_db_entries()
            } else {
                HashMap::new()
            };

            for root in roots {
                if !root.is_dir() {
                    continue;
                }
                if let Ok(entries) = fs::read_dir(&root) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) else {
                            continue;
                        };
                        if dir_name.starts_with('.') || !path.is_dir() {
                            continue;
                        }
                        if let Some(instance) =
                            Self::inspect_instance(&source, &path, dir_name, &modrinth_db)
                        {
                            found.push(instance);
                        }
                    }
                }
            }
        }

        let source_rank = |s: &str| match s {
            "modrinth" => 0,
            "prism" => 1,
            _ => 2,
        };
        found.sort_by(|a, b| {
            source_rank(&a.source)
                .cmp(&source_rank(&b.source))
                .then(a.name.cmp(&b.name))
        });
        found
    }

    fn source_roots() -> Vec<(&'static str, Vec<PathBuf>)> {
        let mut roots: Vec<(&'static str, Vec<PathBuf>)> = Vec::new();

        #[cfg(target_os = "windows")]
        {
            if let Some(data_dir) = dirs::data_dir() {
                roots.push((
                    "prism",
                    vec![data_dir.join("PrismLauncher").join("instances")],
                ));
                roots.push((
                    "modrinth",
                    vec![
                        data_dir.join("ModrinthApp").join("profiles"),
                        data_dir.join("com.modrinth.ModrinthApp").join("profiles"),
                    ],
                ));
                let mut curseforge_roots = Vec::new();
                if let Some(home) = dirs::home_dir() {
                    // Default install location of the CurseForge (Overwolf) app
                    curseforge_roots.push(home.join("curseforge").join("minecraft").join("Instances"));
                }
                curseforge_roots.push(data_dir.join("curseforge").join("Instances"));
                roots.push(("curseforge", curseforge_roots));
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Some(data_dir) = dirs::data_dir() {
                roots.push((
                    "prism",
                    vec![
                        data_dir.join("PrismLauncher").join("instances"),
                        dirs::home_dir()
                            .map(|h| h.join(".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher/instances"))
                            .unwrap_or_default(),
                    ],
                ));
                roots.push((
                    "modrinth",
                    vec![
                        data_dir.join("ModrinthApp").join("profiles"),
                        data_dir.join("com.modrinth.ModrinthApp").join("profiles"),
                    ],
                ));
            }
        }

        roots
    }

    fn inspect_instance(
        source: &str,
        dir: &Path,
        name: &str,
        modrinth_db: &HashMap<String, ModrinthAppEntry>,
    ) -> Option<ImportableInstance> {
        match source {
            "prism" => {
                let has_meta = dir.join("instance.cfg").exists() || dir.join("mmc-pack.json").exists();
                if !has_meta {
                    return None;
                }
            }
            "curseforge" => {
                let has_content = dir.join("manifest.json").exists()
                    || dir.join("mods").is_dir()
                    || dir.join("saves").is_dir();
                if !has_content {
                    return None;
                }
            }
            "modrinth" => {
                let has_content = Self::read_modrinth_metadata(dir).is_some()
                    || dir.join("mods").is_dir()
                    || dir.join("saves").is_dir()
                    || dir.join("options.txt").exists();
                if !has_content {
                    return None;
                }
            }
            _ => return None,
        }

        let content_root = Self::content_root(source, dir);
        let (mut display_name, mut mc_version, mut loader, mut loader_version, mut icon_path) =
            match source {
                "prism" => {
                    let cfg_name = Self::parse_prism_instance_cfg(&dir.join("instance.cfg"));
                    let (mc, l, lv) = Self::parse_mmc_pack(&dir.join("mmc-pack.json"));
                    let icon = ["instance.gif", "folder.jpg", "icon.png"]
                        .iter()
                        .map(|f| dir.join(f))
                        .find(|p| p.is_file())
                        .map(|p| p.to_string_lossy().to_string());
                    (cfg_name, mc, l, lv, icon)
                }
                "curseforge" => {
                    let (n, mc, l, lv) = Self::parse_curseforge_manifest(&dir.join("manifest.json"));
                    (n, mc, l, lv, None)
                }
                _ => {
                    let (n, mc, l, lv, icon) = Self::parse_modrinth_metadata(dir);
                    (n, mc, l, lv, icon)
                }
            };

        if source == "modrinth" {
            if let Some(entry) = Self::lookup_modrinth_db(dir, modrinth_db) {
                if display_name.is_none() {
                    display_name = entry.name.clone();
                }
                if icon_path.is_none() {
                    icon_path = entry.icon_path.clone();
                }
                if mc_version.is_none() {
                    mc_version = Some(entry.game_version);
                }
                if loader.is_none() {
                    loader = entry.loader.filter(|l| !l.is_empty() && l != "vanilla");
                }
                loader_version = entry.loader_version;
            }
        }

        let trimmed = display_name.take().map(|n| n.trim().to_string());
        let display_name = trimmed.filter(|n| !n.is_empty());

        let icon_path = icon_path.filter(|p| Path::new(p).is_file());

        if loader.is_none() {
            loader = Self::infer_loader_from_mods(&content_root);
        }
        if source != "prism" && mc_version.is_none() {
            mc_version = Self::infer_mc_version(&content_root);
        }

        Some(ImportableInstance {
            source: source.to_string(),
            name: display_name.unwrap_or_else(|| name.to_string()),
            path: dir.to_string_lossy().to_string(),
            mc_version,
            loader,
            loader_version,
            size_bytes: Self::dir_size(dir),
            icon_path,
        })
    }

    pub(super) fn content_root(source: &str, dir: &Path) -> PathBuf {
        let minecraft_subdir = dir.join(".minecraft");
        if (source == "prism" || source == "modrinth") && minecraft_subdir.exists() {
            return minecraft_subdir;
        }
        dir.to_path_buf()
    }
}
