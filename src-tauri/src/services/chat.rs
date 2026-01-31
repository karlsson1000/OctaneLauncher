use crate::models::ChatMessage;
use chrono::Utc;
use serde_json::json;
use std::collections::HashMap;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{Engine as _, engine::general_purpose};

pub struct ChatService {
    client: reqwest::Client,
    supabase_url: String,
    supabase_key: String,
}

impl ChatService {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let supabase_url = env!("SUPABASE_URL").to_string();
        let supabase_key = env!("SUPABASE_ANON_KEY").to_string();

        Ok(Self {
            client: reqwest::Client::new(),
            supabase_url,
            supabase_key,
        })
    }

    fn derive_key(user1_uuid: &str, user2_uuid: &str) -> [u8; 32] {
        let mut uuids = vec![user1_uuid, user2_uuid];
        uuids.sort();
        let combined = format!("{}{}", uuids[0], uuids[1]);
        
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(combined.as_bytes());
        let result = hasher.finalize();
        
        let mut key = [0u8; 32];
        key.copy_from_slice(&result);
        key
    }

    fn encrypt_message(content: &str, from_uuid: &str, to_uuid: &str) -> Result<String, Box<dyn std::error::Error>> {
        let key = Self::derive_key(from_uuid, to_uuid);
        let cipher = Aes256Gcm::new(&key.into());

        let mut nonce_bytes = [0u8; 12];
        use rand::RngCore;
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // Encrypt the message
        let ciphertext = cipher.encrypt(nonce, content.as_bytes())
            .map_err(|e| format!("Encryption failed: {}", e))?;

        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);
        
        // Encode to base64
        Ok(general_purpose::STANDARD.encode(&combined))
    }

    fn decrypt_message(encrypted: &str, from_uuid: &str, to_uuid: &str) -> Result<String, Box<dyn std::error::Error>> {
        // Decode from base64
        let combined = general_purpose::STANDARD.decode(encrypted)
            .map_err(|e| format!("Base64 decode failed: {}", e))?;
        
        if combined.len() < 12 {
            return Err("Invalid encrypted message".into());
        }

        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let key = Self::derive_key(from_uuid, to_uuid);
        let cipher = Aes256Gcm::new(&key.into());

        let plaintext = cipher.decrypt(nonce, ciphertext)
            .map_err(|e| format!("Decryption failed: {}", e))?;
        
        String::from_utf8(plaintext)
            .map_err(|e| format!("UTF-8 decode failed: {}", e).into())
    }

    pub async fn send_message(&self, from_uuid: &str, to_uuid: &str, content: &str) -> Result<(), Box<dyn std::error::Error>> {
        // Encrypt the message
        let encrypted_content = Self::encrypt_message(content, from_uuid, to_uuid)?;
        
        let url = format!("{}/rest/v1/chat_messages", self.supabase_url);
        
        let payload = json!({
            "from_uuid": from_uuid,
            "to_uuid": to_uuid,
            "content": encrypted_content,
        });

        let response = self.client
            .post(&url)
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(error_text.into());
        }

        Ok(())
    }

    pub async fn get_messages(&self, user_uuid: &str, friend_uuid: &str) -> Result<Vec<ChatMessage>, Box<dyn std::error::Error>> {
        let url = format!(
            "{}/rest/v1/chat_messages?or=(and(from_uuid.eq.{},to_uuid.eq.{}),and(from_uuid.eq.{},to_uuid.eq.{}))&order=created_at.asc",
            self.supabase_url, user_uuid, friend_uuid, friend_uuid, user_uuid
        );

        let response = self.client
            .get(&url)
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .send()
            .await?;

        let data: Vec<serde_json::Value> = response.json().await?;
        
        let mut messages = Vec::new();
        for item in data {
            let from_uuid = item["from_uuid"].as_str().unwrap_or("");
            let to_uuid = item["to_uuid"].as_str().unwrap_or("");
            let encrypted_content = item["content"].as_str().unwrap_or("");
            
            // Decrypt the message
            let content = Self::decrypt_message(encrypted_content, from_uuid, to_uuid)
                .unwrap_or_else(|_| "[Failed to decrypt]".to_string());
            
            messages.push(ChatMessage {
                id: item["id"].as_str().unwrap_or("").to_string(),
                from_uuid: from_uuid.to_string(),
                to_uuid: to_uuid.to_string(),
                content,
                timestamp: item["created_at"].as_str()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or_else(Utc::now),
                is_own: from_uuid == user_uuid,
            });
        }

        Ok(messages)
    }

    pub async fn cleanup_messages_if_both_offline(&self, user_uuid: &str) -> Result<(), Box<dyn std::error::Error>> {
        // First check if the current user is offline
        let user_status_url = format!(
            "{}/rest/v1/users?uuid=eq.{}&select=status",
            self.supabase_url, user_uuid
        );
        
        let user_response = self.client
            .get(&user_status_url)
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .send()
            .await?;
        
        let user_data: Vec<serde_json::Value> = user_response.json().await?;
        
        if let Some(user) = user_data.first() {
            let current_user_status = user["status"].as_str().unwrap_or("offline");
            
            // Only proceed if current user is offline
            if current_user_status != "offline" {
                return Ok(());
            }
        }

        // Get all messages involving this user
        let messages_url = format!(
            "{}/rest/v1/chat_messages?or=(from_uuid.eq.{},to_uuid.eq.{})&select=from_uuid,to_uuid",
            self.supabase_url, user_uuid, user_uuid
        );

        let response = self.client
            .get(&messages_url)
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .send()
            .await?;

        let messages: Vec<serde_json::Value> = response.json().await?;
        
        // Collect unique conversation partners
        let mut partners = std::collections::HashSet::new();
        for msg in messages {
            let from = msg["from_uuid"].as_str().unwrap_or("");
            let to = msg["to_uuid"].as_str().unwrap_or("");
            
            if from == user_uuid {
                partners.insert(to.to_string());
            } else {
                partners.insert(from.to_string());
            }
        }

        for partner_uuid in partners {
            // Check partner's status
            let status_url = format!(
                "{}/rest/v1/users?uuid=eq.{}&select=status",
                self.supabase_url, partner_uuid
            );

            let status_response = self.client
                .get(&status_url)
                .header("apikey", &self.supabase_key)
                .header("Authorization", format!("Bearer {}", self.supabase_key))
                .send()
                .await?;

            let users: Vec<serde_json::Value> = status_response.json().await?;
            
            if let Some(user) = users.first() {
                let partner_status = user["status"].as_str().unwrap_or("offline");

                if partner_status == "offline" {
                    let delete_url = format!(
                        "{}/rest/v1/chat_messages?or=(and(from_uuid.eq.{},to_uuid.eq.{}),and(from_uuid.eq.{},to_uuid.eq.{}))&is_read=eq.true",
                        self.supabase_url, user_uuid, partner_uuid, partner_uuid, user_uuid
                    );

                    self.client
                        .delete(&delete_url)
                        .header("apikey", &self.supabase_key)
                        .header("Authorization", format!("Bearer {}", self.supabase_key))
                        .send()
                        .await?;
                }
            }
        }

        Ok(())
    }

    /// Get unread message counts for all friends
    pub async fn get_unread_counts(&self, user_uuid: &str) -> Result<HashMap<String, u32>, Box<dyn std::error::Error>> {
        let url = format!(
            "{}/rest/v1/chat_messages?to_uuid=eq.{}&is_read=eq.false&select=from_uuid",
            self.supabase_url, user_uuid
        );

        let response = self.client
            .get(&url)
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .send()
            .await?;

        let data: Vec<serde_json::Value> = response.json().await?;
        
        let mut counts: HashMap<String, u32> = HashMap::new();
        for item in data {
            if let Some(from_uuid) = item["from_uuid"].as_str() {
                *counts.entry(from_uuid.to_string()).or_insert(0) += 1;
            }
        }

        Ok(counts)
    }

    /// Mark all messages from a friend as read
    pub async fn mark_as_read(&self, user_uuid: &str, friend_uuid: &str) -> Result<(), Box<dyn std::error::Error>> {
        let url = format!(
            "{}/rest/v1/chat_messages?from_uuid=eq.{}&to_uuid=eq.{}",
            self.supabase_url, friend_uuid, user_uuid
        );

        let payload = json!({
            "is_read": true
        });

        let response = self.client
            .patch(&url)
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Failed to mark messages as read: {}", error_text).into());
        }

        Ok(())
    }
}