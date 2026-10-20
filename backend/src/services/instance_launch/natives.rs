use super::*;

impl InstanceManager {
    pub(super) fn extract_native_jar(
        archive: &mut ZipArchive<fs::File>,
        natives_dir: &PathBuf,
    ) -> std::io::Result<usize> {
        let mut extracted = 0;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            if file.name().ends_with('/') || file.name().starts_with("META-INF") {
                continue;
            }
            let Some(safe_name) = file.enclosed_name() else {
                continue;
            };
            let outpath = natives_dir.join(safe_name);
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut outfile = fs::File::create(&outpath)?;
            std::io::copy(&mut file, &mut outfile)?;
            extracted += 1;
        }
        Ok(extracted)
    }
}
