use super::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrashItem {
    pub id: String,
    pub original_name: String,
    pub original_type: String,
    pub folder_name: String,
    pub moved_at: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct TrashIndex {
    pub items: Vec<TrashItem>,
}
