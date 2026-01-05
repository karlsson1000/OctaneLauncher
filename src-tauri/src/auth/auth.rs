use crate::models::*;
use chrono::Utc;
use oauth2::{
    basic::{BasicClient, BasicTokenResponse},
    AuthUrl, AuthorizationCode, ClientId, CsrfToken, PkceCodeChallenge, RedirectUrl, 
    RefreshToken, Scope, TokenResponse, TokenUrl,
};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use url::Url;

const AUTH_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const REDIRECT_URL: &str = "http://localhost:3160/auth";
const SERVER_ADDRESS: &str = "127.0.0.1:3160";
const XBOX_AUTHENTICATE_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTHORIZE_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_LOGIN_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MINECRAFT_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";

pub struct Authenticator {
    oauth_client: BasicClient,
    http_client: reqwest::Client,
}

impl Authenticator {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let client_id = env!("MICROSOFT_CLIENT_ID").to_string();

        let oauth_client = BasicClient::new(
            ClientId::new(client_id),
            None,
            AuthUrl::new(AUTH_URL.to_string()).unwrap(),
            Some(TokenUrl::new(TOKEN_URL.to_string()).unwrap()),
        )
        .set_redirect_uri(RedirectUrl::new(REDIRECT_URL.to_string()).unwrap());

        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();

        Ok(Self {
            oauth_client,
            http_client,
        })
    }

    pub fn create_authorization_url(&self) -> (Url, CsrfToken, oauth2::PkceCodeVerifier) {
        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let (url, csrf_token) = self
            .oauth_client
            .authorize_url(CsrfToken::new_random)
            .add_extra_param("prompt", "select_account")
            .add_scope(Scope::new("XboxLive.signin".to_string()))
            .add_scope(Scope::new("offline_access".to_string()))
            .set_pkce_challenge(pkce_challenge)
            .url();

        (url, csrf_token, pkce_verifier)
    }

    pub async fn wait_for_callback(&self, expected_csrf: &str) -> Result<String, Box<dyn std::error::Error>> {
        let listener = tokio::net::TcpListener::bind(SERVER_ADDRESS).await?;
        println!("Waiting for authentication callback...");

        let (mut stream, _) = listener.accept().await?;
        let mut buf = [0u8; 2048];
        let n = stream.read(&mut buf).await?;

        let request = String::from_utf8_lossy(&buf[..n]);
        let first_line = request.lines().next().unwrap_or("");
        let path = first_line.split_whitespace().nth(1).unwrap_or("");

        let url = Url::parse(&format!("http://localhost{}", path))?;

        let mut code = None;
        let mut state = None;

        for (key, value) in url.query_pairs() {
            match key.as_ref() {
                "code" => code = Some(value.to_string()),
                "state" => state = Some(value.to_string()),
                _ => {}
            }
        }
        let received_state = state.ok_or("No state in callback")?;
        
        if received_state != expected_csrf {
            // Send error response
            let error_response = b"HTTP/1.1 400 Bad Request\r\n\
    Content-Type: text/html; charset=utf-8\r\n\
    Connection: close\r\n\
    \r\n\
    <!DOCTYPE html>\
    <html>\
        <p>Authentication error. Invalid authentication state. Please try again.</p>\
    </html>";
            
            stream.write_all(error_response).await?;
            stream.flush().await?;
            
            return Err("CSRF token mismatch - possible attack detected!".into());
        }

        // Only proceed if CSRF token is valid
        let auth_code = code.ok_or("No code in callback")?;

        let success_response = b"HTTP/1.1 200 OK\r\n\
    Content-Type: text/html; charset=utf-8\r\n\
    Connection: close\r\n\
    \r\n\
    <!DOCTYPE html>\
    <html>\
        <p>Authentication complete. Please return to the Atomic Launcher to continue.</p>\
    </html>";

        // Write response and flush
        stream.write_all(success_response).await?;
        stream.flush().await?;

        // Give the browser time to receive and render the page
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        Ok(auth_code)
    }

    pub async fn exchange_code(
        &self,
        code: String,
        pkce_verifier: oauth2::PkceCodeVerifier,
    ) -> Result<BasicTokenResponse, Box<dyn std::error::Error>> {
        let token_response = self
            .oauth_client
            .exchange_code(AuthorizationCode::new(code))
            .set_pkce_verifier(pkce_verifier)
            .request_async(oauth2::reqwest::async_http_client)
            .await?;

        Ok(token_response)
    }

    pub async fn authenticate_xbox(
        &self,
        msa_token: &str,
    ) -> Result<TokenWithExpiry, Box<dyn std::error::Error>> {
        let request = XboxLiveAuthRequest {
            properties: XboxLiveAuthProperties {
                auth_method: "RPS",
                site_name: "user.auth.xboxlive.com",
                rps_ticket: &format!("d={}", msa_token),
            },
            relying_party: "http://auth.xboxlive.com",
            token_type: "JWT",
        };

        let response = self
            .http_client
            .post(XBOX_AUTHENTICATE_URL)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Xbox Live auth failed: {}", error_text).into());
        }

        let xbl_response: XboxLiveAuthResponse = response.json().await?;
        let skew = Utc::now() - xbl_response.issue_instant;

        Ok(TokenWithExpiry {
            token: xbl_response.token,
            expiry: xbl_response.not_after + skew,
        })
    }

    pub async fn obtain_xsts(
        &self,
        xbl_token: &str,
    ) -> Result<(TokenWithExpiry, String), Box<dyn std::error::Error>> {
        let request = XstsAuthRequest {
            properties: XstsAuthProperties {
                sandbox_id: "RETAIL",
                user_tokens: &[xbl_token],
            },
            relying_party: "rp://api.minecraftservices.com/",
            token_type: "JWT",
        };

        let response = self
            .http_client
            .post(XSTS_AUTHORIZE_URL)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("XSTS auth failed: {}", error_text).into());
        }

        let xsts_response: XstsAuthResponse = response.json().await?;
        let skew = Utc::now() - xsts_response.issue_instant;

        let userhash = xsts_response
            .display_claims
            .xui
            .first()
            .and_then(|m| m.get("uhs"))
            .ok_or("Missing userhash")?
            .clone();

        Ok((
            TokenWithExpiry {
                token: xsts_response.token,
                expiry: xsts_response.not_after + skew,
            },
            userhash,
        ))
    }

    pub async fn authenticate_minecraft(
        &self,
        xsts_token: &str,
        userhash: &str,
    ) -> Result<TokenWithExpiry, Box<dyn std::error::Error>> {
        println!("Sending request to: {}", MINECRAFT_LOGIN_URL);
        
        let request = MinecraftLoginRequest {
            identity_token: &format!("XBL3.0 x={};{}", userhash, xsts_token),
        };

        let response = self
            .http_client
            .post(MINECRAFT_LOGIN_URL)
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        println!("Response status: {}", status);

        if !response.status().is_success() {
            let error_text = response.text().await?;
            eprintln!("Error response body: {}", error_text);
            return Err(format!("Minecraft auth failed with status {}: {}", status, error_text).into());
        }

        let mc_response: MinecraftLoginResponse = response.json().await?;

        Ok(TokenWithExpiry {
            token: mc_response.access_token,
            expiry: Utc::now() + chrono::Duration::seconds(mc_response.expires_in as i64),
        })
    }

    pub async fn get_minecraft_profile(
        &self,
        access_token: &str,
    ) -> Result<MinecraftProfile, Box<dyn std::error::Error>> {
        println!("Fetching profile from: {}", MINECRAFT_PROFILE_URL);
        
        let response = self
            .http_client
            .get(MINECRAFT_PROFILE_URL)
            .bearer_auth(access_token)
            .send()
            .await?;

        let status = response.status();
        println!("Profile response status: {}", status);

        if response.status() == 404 {
            return Err("Account does not own Minecraft".into());
        }

        if !response.status().is_success() {
            let error_text = response.text().await?;
            eprintln!("Profile error response: {}", error_text);
            return Err(format!("Failed to get profile: {}", error_text).into());
        }

        let profile: MinecraftProfile = response.json().await?;
        Ok(profile)
    }

    pub async fn authenticate(&self) -> Result<AuthResponse, Box<dyn std::error::Error>> {
        println!("=== Starting Microsoft Login ===");

        let (auth_url, csrf_token, pkce_verifier) = self.create_authorization_url();

        println!("Opening browser for authentication...");

        if let Err(e) = webbrowser::open(auth_url.as_str()) {
            println!("Could not open browser automatically: {}", e);
        }

        let code = self.wait_for_callback(csrf_token.secret()).await?;

        println!("✓ Authorization code received and validated");

        let token_response = self.exchange_code(code, pkce_verifier).await?;
        let msa_token = token_response.access_token().secret();
        let refresh_token = token_response
            .refresh_token()
            .ok_or("No refresh token received")?
            .secret()
            .to_string();
        
        println!("✓ Microsoft access token obtained");

        let xbl_token = self.authenticate_xbox(msa_token).await?;
        println!("✓ Xbox Live token obtained");

        let (xsts_token, userhash) = self.obtain_xsts(&xbl_token.token).await?;
        println!("✓ XSTS token obtained");

        println!("Attempting Minecraft authentication...");

        let mc_token = match self.authenticate_minecraft(&xsts_token.token, &userhash).await {
            Ok(token) => {
                println!("✓ Minecraft access token obtained");
                token
            }
            Err(e) => {
                eprintln!("✗ Minecraft authentication FAILED: {:?}", e);
                return Err(e);
            }
        };

        println!("Attempting to get profile...");
        let profile = match self.get_minecraft_profile(&mc_token.token).await {
            Ok(p) => {
                println!("✓ Profile retrieved");
                p
            }
            Err(e) => {
                eprintln!("✗ Profile retrieval FAILED: {:?}", e);
                return Err(e);
            }
        };

        println!("✓ Authentication Complete");
        println!("Username: {}", profile.name);
        println!("UUID: {}", profile.id);

        Ok(AuthResponse {
            access_token: mc_token.token.to_string(),
            refresh_token,
            token_expiry: mc_token.expiry,
            username: profile.name.to_string(),
            uuid: profile.id.to_string(),
        })
    }

    pub async fn refresh_tokens(
        &self,
        refresh_token: &str,
    ) -> Result<AuthResponse, Box<dyn std::error::Error>> {
        println!("=== Refreshing Microsoft Token ===");
        
        let token_response = self
            .oauth_client
            .exchange_refresh_token(&RefreshToken::new(refresh_token.to_string()))
            .request_async(oauth2::reqwest::async_http_client)
            .await?;

        let msa_token = token_response.access_token().secret();
        let new_refresh_token = token_response
            .refresh_token()
            .ok_or("No refresh token in response")?
            .secret()
            .to_string();
        
        println!("✓ Microsoft token refreshed");

        // Re-authenticate through the Xbox/XSTS/Minecraft chain
        let xbl_token = self.authenticate_xbox(msa_token).await?;
        println!("✓ Xbox Live token obtained");

        let (xsts_token, userhash) = self.obtain_xsts(&xbl_token.token).await?;
        println!("✓ XSTS token obtained");

        let mc_token = self.authenticate_minecraft(&xsts_token.token, &userhash).await?;
        println!("✓ Minecraft access token refreshed");

        let profile = self.get_minecraft_profile(&mc_token.token).await?;
        println!("✓ Profile retrieved");

        Ok(AuthResponse {
            access_token: mc_token.token.to_string(),
            refresh_token: new_refresh_token,
            token_expiry: mc_token.expiry,
            username: profile.name.to_string(),
            uuid: profile.id.to_string(),
        })
    }
}