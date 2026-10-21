use super::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_expiry: DateTime<Utc>,
    pub username: String,
    pub uuid: String,
}

#[derive(Serialize, Deserialize)]
pub struct TokenWithExpiry {
    pub token: Arc<str>,
    pub expiry: DateTime<Utc>,
}

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct XboxLiveAuthRequest<'a> {
    pub properties: XboxLiveAuthProperties<'a>,
    pub relying_party: &'a str,
    pub token_type: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct XboxLiveAuthProperties<'a> {
    pub auth_method: &'a str,
    pub site_name: &'a str,
    pub rps_ticket: &'a str,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct XboxLiveAuthResponse {
    pub issue_instant: DateTime<Utc>,
    pub not_after: DateTime<Utc>,
    pub token: Arc<str>,
}

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct XstsAuthRequest<'a> {
    pub properties: XstsAuthProperties<'a>,
    pub relying_party: &'a str,
    pub token_type: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct XstsAuthProperties<'a> {
    pub sandbox_id: &'a str,
    pub user_tokens: &'a [&'a str],
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct XstsAuthResponse {
    pub issue_instant: DateTime<Utc>,
    pub not_after: DateTime<Utc>,
    pub token: Arc<str>,
    pub display_claims: DisplayClaims,
}

#[derive(Deserialize)]
pub struct DisplayClaims {
    pub xui: Vec<HashMap<String, String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MinecraftLoginRequest<'a> {
    pub xtoken: &'a str,
    pub platform: &'a str,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct MinecraftLoginResponse {
    pub access_token: Arc<str>,
    pub expires_in: usize,
}

#[derive(Deserialize)]
pub struct MinecraftProfile {
    pub id: Uuid,
    pub name: Arc<str>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredAccount {
    pub uuid: String,
    pub username: String,
    pub access_token: String,
    pub refresh_token: String,
    pub token_expiry: DateTime<Utc>,
    pub added_at: String,
    pub last_used: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccountsData {
    pub accounts: HashMap<String, StoredAccount>,
    pub active_account_uuid: Option<String>,
}

impl Default for AccountsData {
    fn default() -> Self {
        Self {
            accounts: HashMap::new(),
            active_account_uuid: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccountInfo {
    pub uuid: String,
    pub username: String,
    pub is_active: bool,
    pub added_at: String,
    pub last_used: Option<String>,
}
