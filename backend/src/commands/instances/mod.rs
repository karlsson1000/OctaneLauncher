use crate::services::instance::InstanceManager;
use crate::services::installer::MinecraftInstaller;
use crate::services::fabric::FabricInstaller;
use crate::services::accounts::AccountManager;
use crate::models::{AppConfig, Instance};
use crate::utils::*;
use std::sync::Mutex;
use crate::commands::validation::sanitize_instance_name;
use tauri::{Emitter, Manager};
use std::path::PathBuf;

mod icons;
mod lifecycle;
mod loaders;
mod system;
mod worlds;

pub use icons::*;
pub use lifecycle::*;
pub use loaders::*;
pub use system::*;
pub use worlds::*;

lazy_static::lazy_static! {
    pub static ref RUNNING_PROCESSES: Mutex<std::collections::HashMap<String, u32>> = Mutex::new(std::collections::HashMap::new());
}
