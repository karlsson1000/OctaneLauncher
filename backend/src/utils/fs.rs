use std::path::{Path, PathBuf};

pub fn dir_size(path: &Path) -> u64 {
    dir_size_skipping(path, &[])
}

pub fn dir_size_skipping(path: &Path, skip: &[PathBuf]) -> u64 {
    let mut total = 0u64;
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        if skip.iter().any(|root| path == *root) {
            continue;
        }
        if file_type.is_dir() {
            total += dir_size_skipping(&path, skip);
        } else if file_type.is_file() {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    total
}