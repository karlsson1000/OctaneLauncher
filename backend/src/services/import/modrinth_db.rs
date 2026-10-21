use super::*;

impl InstanceImporter {
    pub(super) fn load_modrinth_db_entries() -> HashMap<String, ModrinthAppEntry> {
        let mut map = HashMap::new();

        let Some(data_dir) = dirs::data_dir() else {
            return map;
        };

        let bases = [
            data_dir.join("ModrinthApp"),
            data_dir.join("com.modrinth.ModrinthApp"),
            data_dir.join("com.modrinth.theseus"),
        ];

        let mut temp_dirs: Vec<PathBuf> = Vec::new();

        for base in bases {
            for db_path in Self::find_sqlite_files(&base) {
                let Some(snapshot_path) = Self::snapshot_sqlite_db(&db_path, &mut temp_dirs)
                else {
                    continue;
                };

                let Ok(conn) = rusqlite::Connection::open_with_flags(
                    &snapshot_path,
                    rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
                ) else {
                    continue;
                };

                let mut load = |sql: &str| -> rusqlite::Result<()> {
                    let mut stmt = conn.prepare(sql)?;
                    let rows = stmt.query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, Option<String>>(1)?,
                            row.get::<_, String>(2)?,
                            row.get::<_, Option<String>>(3)?,
                            row.get::<_, Option<String>>(4)?,
                            row.get::<_, Option<String>>(5)?,
                        ))
                    })?;
                    for row in rows.flatten() {
                        let (path, name, game_version, loader, loader_version, icon_path) = row;
                        map.insert(
                            path.replace('\\', "/"),
                            ModrinthAppEntry {
                                name,
                                game_version,
                                loader,
                                loader_version,
                                icon_path,
                            },
                        );
                    }
                    Ok(())
                };

                let _ = load(
                    "SELECT i.path, i.name, cs.game_version, cs.loader, cs.loader_version, i.icon_path \
                     FROM instances i \
                     JOIN instance_content_sets cs ON cs.instance_id = i.id",
                );

                let _ = load(
                    "SELECT path, name, game_version, mod_loader, mod_loader_version, icon_path FROM profiles",
                );
            }
        }

        for dir in temp_dirs {
            let _ = fs::remove_dir_all(dir);
        }

        map
    }

    fn snapshot_sqlite_db(db_path: &Path, temp_dirs: &mut Vec<PathBuf>) -> Option<PathBuf> {
        let dir = std::env::temp_dir().join(format!(
            "octane_import_db_{}_{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        fs::create_dir_all(&dir).ok()?;

        let file_name = db_path.file_name()?.to_string_lossy().to_string();
        fs::copy(db_path, dir.join(&file_name)).ok()?;

        for sidecar_ext in ["-wal", "-shm"] {
            let mut sidecar = db_path.as_os_str().to_owned();
            sidecar.push(sidecar_ext);
            let sidecar_path = PathBuf::from(sidecar);
            if sidecar_path.exists() {
                let mut sidecar_copy = file_name.clone();
                sidecar_copy.push_str(sidecar_ext);
                let _ = fs::copy(&sidecar_path, dir.join(sidecar_copy));
            }
        }

        temp_dirs.push(dir.clone());
        Some(dir.join(file_name))
    }

    fn find_sqlite_files(base: &Path) -> Vec<PathBuf> {
        let mut found = Vec::new();

        for candidate in [base.to_path_buf(), base.join("settings"), base.join("data")] {
            let Ok(entries) = fs::read_dir(&candidate) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                let is_db_file = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e == "db" || e == "sqlite" || e == "sqlite3")
                    .unwrap_or(false);
                if is_db_file {
                    found.push(path);
                }
            }
        }

        found
    }

    pub(super) fn lookup_modrinth_db(
        dir: &Path,
        db: &HashMap<String, ModrinthAppEntry>,
    ) -> Option<ModrinthAppEntry> {
        if db.is_empty() {
            return None;
        }

        let folder = dir.file_name()?.to_str()?.to_string();
        let full_forward = dir.to_string_lossy().replace('\\', "/");
        let trimmed = full_forward.trim_end_matches('/').to_string();

        for key in [full_forward, trimmed, folder] {
            if let Some(entry) = db.get(&key) {
                return Some(entry.clone());
            }
        }

        None
    }
}
