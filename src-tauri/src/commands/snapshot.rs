use crate::services::snapshot::SnapshotManager;
use crate::models::Snapshot;

#[tauri::command]
pub async fn create_launcher_snapshot(name: String) -> Result<Snapshot, String> {
    SnapshotManager::create_snapshot(name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_launcher_snapshots() -> Result<Vec<Snapshot>, String> {
    SnapshotManager::get_all_snapshots()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_launcher_snapshot(snapshot_id: String) -> Result<(), String> {
    SnapshotManager::restore_snapshot(snapshot_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_launcher_snapshot(snapshot_id: String) -> Result<(), String> {
    SnapshotManager::delete_snapshot(snapshot_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_launcher_snapshot(
    snapshot_id: String,
    export_path: String,
) -> Result<(), String> {
    SnapshotManager::export_snapshot(snapshot_id, export_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_launcher_snapshot(
    import_path: String,
    name: String,
) -> Result<Snapshot, String> {
    SnapshotManager::import_snapshot(import_path, name)
        .map_err(|e| e.to_string())
}