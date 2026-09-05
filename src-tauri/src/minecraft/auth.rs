use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::sleep;

// ==========================================
// NOTA IMPORTANTE PARA O DESENVOLVEDOR:
// Substitua este CLIENT_ID pelo do seu app no Azure Entra ID!
// Escopos necessÃ¡rios: "XboxLive.signin offline_access"
// ==========================================
const CLIENT_ID: &str = "c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb"; // PrismLauncher Client ID (Publico/Aprovado)
const SCOPE: &str = "XboxLive.signin offline_access";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DeviceCodeResponse {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
    pub message: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MsTokenResponse {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct XboxResponse {
    pub Token: String,
    pub DisplayClaims: DisplayClaims,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DisplayClaims {
    pub xui: Vec<XuiClaim>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct XuiClaim {
    pub uhs: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct McTokenResponse {
    pub access_token: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct McProfile {
    pub id: String,
    pub name: String,
}

#[tauri::command]
pub async fn ms_request_device_code() -> Result<DeviceCodeResponse, String> {
    let client = Client::new();
    let res = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
        .form(&[("client_id", CLIENT_ID), ("scope", SCOPE)])
        .send()
        .await
        .map_err(|e| format!("Falha ao conectar com Microsoft: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let error_body = res.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(format!("Erro MS ({}): {}", status, error_body));
    }

    let data = res
        .json::<DeviceCodeResponse>()
        .await
        .map_err(|e| format!("Erro ao parsear resposta: {}", e))?;
    Ok(data)
}

#[tauri::command]
pub async fn ms_poll_token(device_code: String, interval: u64) -> Result<String, String> {
    let client = Client::new();
    let mut attempts = 0;
    let max_attempts = (15 * 60) / interval; // ~15 minutos de timeout

    while attempts < max_attempts {
        let res = client
            .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
            .form(&[
                ("client_id", CLIENT_ID),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("device_code", &device_code),
            ])
            .send()
            .await
            .map_err(|e| format!("Falha de conexÃ£o: {}", e))?;

        let json = res
            .json::<MsTokenResponse>()
            .await
            .map_err(|e| e.to_string())?;

        if let Some(err) = json.error {
            if err == "authorization_pending" {
                sleep(Duration::from_secs(interval)).await;
                attempts += 1;
                continue;
            } else if err == "expired_token" {
                return Err("CÃ³digo expirou. Tente novamente.".to_string());
            } else {
                return Err(format!("Erro de autorizaÃ§Ã£o: {}", err));
            }
        }

        if let Some(token) = json.access_token {
            return Ok(token);
        }

        sleep(Duration::from_secs(interval)).await;
        attempts += 1;
    }

    Err("Tempo limite esgotado.".to_string())
}

#[tauri::command]
pub async fn auth_xbox_live(ms_token: String) -> Result<XboxResponse, String> {
    let client = Client::new();
    let res = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&serde_json::json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={}", ms_token)
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        }))
        .send()
        .await
        .map_err(|e| format!("Erro XBL request: {}", e))?;

    if !res.status().is_success() {
        return Err("Falha ao autenticar no Xbox Live".to_string());
    }

    let data = res
        .json::<XboxResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn auth_xsts(xbl_token: String) -> Result<XboxResponse, String> {
    let client = Client::new();
    let res = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&serde_json::json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbl_token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        }))
        .send()
        .await
        .map_err(|e| format!("Erro XSTS request: {}", e))?;

    if !res.status().is_success() {
        // Se a conta de Xbox n tiver perfil ou for conta infantil, daria erro aqui
        return Err(
            "Falha ao autenticar no Xbox (XSTS). Conta sem perfil Xbox ou conta infantil?"
                .to_string(),
        );
    }

    let data = res
        .json::<XboxResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn auth_minecraft(uhs: String, xsts_token: String) -> Result<String, String> {
    let client = Client::new();
    let res = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&serde_json::json!({
            "identityToken": format!("XBL3.0 x={};{}", uhs, xsts_token)
        }))
        .send()
        .await
        .map_err(|e| format!("Erro MC Auth: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(format!("Falha Minecraft Auth ({}): {}", status, body));
    }

    let data = res
        .json::<McTokenResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(data.access_token)
}

#[tauri::command]
pub async fn get_minecraft_profile(mc_token: String) -> Result<McProfile, String> {
    let client = Client::new();
    let res = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .header("Authorization", format!("Bearer {}", mc_token))
        .send()
        .await
        .map_err(|e| format!("Erro MC Profile: {}", e))?;

    if !res.status().is_success() {
        return Err("O usuÃ¡rio nÃ£o possui o Minecraft original comprado nesta conta!".to_string());
    }

    let data = res.json::<McProfile>().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn upload_mc_skin(mc_token: String, file_path: String, variant: String) -> Result<(), String> {
    use reqwest::multipart;
    use tokio::fs::File;
    use tokio::io::AsyncReadExt;

    let mut file = File::open(&file_path)
        .await
        .map_err(|e| format!("Erro ao abrir a imagem: {}", e))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .await
        .map_err(|e| format!("Erro ao ler a imagem: {}", e))?;

    let part = multipart::Part::bytes(buffer)
        .file_name("skin.png")
        .mime_str("image/png")
        .map_err(|e| format!("Erro ao formatar parte da imagem: {}", e))?;

    let form = multipart::Form::new()
        .text("variant", variant)
        .part("file", part);

    let client = Client::new();
    let res = client
        .post("https://api.minecraftservices.com/minecraft/profile/skins")
        .header("Authorization", format!("Bearer {}", mc_token))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Erro ao enviar skin para Mojang: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(format!("Falha na Microsoft ({}): {}", status, body));
    }

    Ok(())
}

#[tauri::command]
pub async fn fetch_mojang_skin(uuid: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client.get(&format!("https://sessionserver.mojang.com/session/minecraft/profile/{}?unsigned=false", uuid))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err("Falha ao buscar perfil".to_string());
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    if let Some(props) = json["properties"].as_array() {
        for prop in props {
            if prop["name"] == "textures" {
                if let Some(val) = prop["value"].as_str() {
                    use base64::{Engine as _, engine::general_purpose};
                    let decoded = general_purpose::STANDARD.decode(val).map_err(|e| e.to_string())?;
                    let tex_json: serde_json::Value = serde_json::from_slice(&decoded).map_err(|e| e.to_string())?;
                    if let Some(url) = tex_json["textures"]["SKIN"]["url"].as_str() {
                        return Ok(url.to_string());
                    }
                }
            }
        }
    }
    
    Err("Skin não encontrada no perfil".to_string())
}

