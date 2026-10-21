use std::path::PathBuf;

pub fn open_folder(path: PathBuf) -> Result<(), std::io::Error> {
    open::that(path)
}
