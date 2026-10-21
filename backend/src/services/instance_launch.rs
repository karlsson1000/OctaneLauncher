use crate::models::{FabricProfileJson, ForgeProfileJson, Instance, LauncherSettings, NeoForgeProfileJson, Rule, VersionDetails};
use crate::services::installer::should_include_library;
use crate::utils::*;
use chrono::Utc;
use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::{fs, path::PathBuf};
use tauri::Emitter;
use zip::ZipArchive;

use super::instance::InstanceManager;

mod args;
mod java;
mod natives;
mod profiles;
mod quickplay;
mod steps;

struct ResolvedProfile {
    main_class: String,
    base_version_id: String,
    base_version: VersionDetails,
    libraries: Vec<(String, String, Option<String>)>,
    assets_id: String,
    is_neoforge: bool,
    is_forge: bool,
    jvm_arguments: Vec<String>,
    game_arguments: Vec<String>,
}

struct LaunchGuard<'a>(&'a str);

impl Drop for LaunchGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut processes) = crate::commands::instances::RUNNING_PROCESSES.lock() {
            if processes.get(self.0) == Some(&0) {
                processes.remove(self.0);
            }
        }
    }
}

impl InstanceManager {
    fn emit_error_log(app_handle: &tauri::AppHandle, instance_name: &str, error_msg: &str) {
        let _ = app_handle.emit("console-log", serde_json::json!({
            "instance": instance_name,
            "message": format!("ERROR: {}", error_msg),
            "type": "stderr"
        }));
    }

    pub fn launch(
        instance_name: &str,
        username: &str,
        uuid: &str,
        access_token: &str,
        app_handle: tauri::AppHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        Self::launch_internal(instance_name, username, uuid, access_token, None, None, app_handle)
    }

    pub fn launch_with_server(
        instance_name: &str,
        username: &str,
        uuid: &str,
        access_token: &str,
        server_address: &str,
        app_handle: tauri::AppHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        Self::launch_internal(instance_name, username, uuid, access_token, Some(server_address), None, app_handle)
    }

    pub fn launch_with_world(
        instance_name: &str,
        username: &str,
        uuid: &str,
        access_token: &str,
        world_name: &str,
        app_handle: tauri::AppHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        Self::launch_internal(instance_name, username, uuid, access_token, None, Some(world_name), app_handle)
    }

    fn launch_internal(
        instance_name: &str,
        username: &str,
        uuid: &str,
        access_token: &str,
        server_address: Option<&str>,
        world_name: Option<&str>,
        app_handle: tauri::AppHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        {
            let mut processes = crate::commands::instances::RUNNING_PROCESSES
                .lock()
                .map_err(|e| format!("Failed to acquire process lock: {}", e))?;
            if let Some(pid) = processes.get(instance_name) {
                let err_msg = if *pid == 0 {
                    format!(
                        "Instance '{}' is still launching (a first-time Java download may be in progress)",
                        instance_name
                    )
                } else {
                    format!("Instance '{}' is already running", instance_name)
                };
                Self::emit_error_log(&app_handle, instance_name, &err_msg);
                return Err(err_msg.into());
            }
            processes.insert(instance_name.to_string(), 0);
        }

        let _guard = LaunchGuard(instance_name);

        Self::perform_launch(
            instance_name, username, uuid, access_token, server_address, world_name, &app_handle,
        )
    }

    fn perform_launch(
        instance_name: &str,
        username: &str,
        uuid: &str,
        access_token: &str,
        server_address: Option<&str>,
        world_name: Option<&str>,
        app_handle: &tauri::AppHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let meta_dir = get_meta_dir();
        let instance_dir = get_instance_dir(instance_name);

        if !instance_dir.exists() {
            let err_msg = format!("Instance '{}' does not exist", instance_name);
            Self::emit_error_log(app_handle, instance_name, &err_msg);
            return Err(err_msg.into());
        }

        let (instance, version) = Self::step_load_instance(instance_name, &instance_dir, app_handle)?;
        let required_java = Self::get_required_java_version(&version);
        let (java_path, effective_settings) =
            Self::step_resolve_java(instance_name, &instance, required_java, app_handle)?;
        Self::step_check_java(instance_name, &version, &java_path, required_java, app_handle)?;
        let resolved = Self::step_resolve_profile(instance_name, &version, &meta_dir, app_handle)?;
        Self::step_extract_natives(instance_name, &resolved, &meta_dir, app_handle)?;
        let classpath = Self::step_build_classpath(instance_name, &resolved.libraries, &meta_dir, app_handle)?;
        Self::step_launch(
            instance_name, username, uuid, access_token, server_address, world_name,
            &instance, &version, &java_path, &resolved,
            &classpath, &instance_dir, &meta_dir, app_handle,
            &effective_settings,
        )?;
        Ok(())
    }
}
