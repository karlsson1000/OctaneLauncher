use std::fs;
use std::path::Path;

pub fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    copy_dir_with(src, dst, |_| false, |_| {})
}

pub fn copy_dir_with<Filter, OnFile>(
    src: &Path,
    dst: &Path,
    mut should_skip: Filter,
    mut on_file: OnFile,
) -> std::io::Result<()>
where
    Filter: FnMut(&fs::DirEntry) -> bool,
    OnFile: FnMut(&fs::DirEntry),
{
    copy_dir_with_ref(src, dst, &mut should_skip, &mut on_file)
}

fn copy_dir_with_ref(
    src: &Path,
    dst: &Path,
    should_skip: &mut dyn FnMut(&fs::DirEntry) -> bool,
    on_file: &mut dyn FnMut(&fs::DirEntry),
) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        if should_skip(&entry) {
            continue;
        }

        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_with_ref(&src_path, &dst_path, should_skip, on_file)?;
        } else if file_type.is_file() {
            fs::copy(&src_path, &dst_path)?;
            on_file(&entry);
        }
    }

    Ok(())
}