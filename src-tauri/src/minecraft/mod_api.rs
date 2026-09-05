use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FabricLoader {
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FabricVersion {
    pub loader: FabricLoader,
}

#[tauri::command]
pub async fn fetch_loader_versions(mc_version: String, loader: String) -> Result<String, String> {
    let client = Client::builder()
        .user_agent("VerdantLauncher/0.1.0")
        .build()
        .map_err(|e| e.to_string())?;

    match loader.to_lowercase().as_str() {
        "fabric" => {
            let url = format!(
                "https://meta.fabricmc.net/v2/versions/loader/{}",
                mc_version
            );
            let versions: Vec<FabricVersion> = client
                .get(&url)
                .send()
                .await
                .map_err(|e| format!("Erro HTTP: {}", e))?
                .json()
                .await
                .map_err(|e| format!("Erro Parse JSON: {}", e))?;

            let mut list = Vec::new();
            for v in versions {
                list.push(v.loader.version);
            }
            Ok(serde_json::to_string(&list).unwrap_or_else(|_| "[]".to_string()))
        }
        "forge" => {
            let url =
                "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";
            let raw: serde_json::Value = client
                .get(url)
                .send()
                .await
                .map_err(|e| format!("Erro HTTP: {}", e))?
                .json()
                .await
                .map_err(|e| format!("Erro Parse JSON: {}", e))?;

            let mut list = Vec::new();
            if let Some(promos) = raw.get("promos").and_then(|p| p.as_object()) {
                let prefix = format!("{}-", mc_version);
                for (key, val) in promos {
                    if key.starts_with(&prefix) {
                        if let Some(v) = val.as_str() {
                            list.push(v.to_string());
                        }
                    }
                }
            }
            list.sort_by(|a, b| b.cmp(a));
            list.dedup();
            Ok(serde_json::to_string(&list).unwrap_or_else(|_| "[]".to_string()))
        }
        _ => Ok("[]".to_string()),
    }
}
