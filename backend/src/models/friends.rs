use super::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Friend {
    pub uuid: String,
    pub username: String,
    pub status: FriendStatus,
    pub last_seen: DateTime<Utc>,
    pub current_instance: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FriendStatus {
    Online,
    Offline,
    InGame,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FriendRequest {
    pub id: String,
    pub from_uuid: String,
    pub from_username: String,
    pub to_uuid: String,
    pub status: RequestStatus,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RequestStatus {
    Pending,
    Accepted,
    Rejected,
}
