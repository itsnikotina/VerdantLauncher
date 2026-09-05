use reqwest::Client;
use std::path::PathBuf;
use tokio::fs;

/// Baixa um arquivo salvando no disco. Se já existir, ignora (cache rápido).
pub async fn download_file(client: &Client, url: &str, path: &PathBuf) -> Result<(), String> {
    if path.exists() {
        return Ok(());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Erro ao criar pasta: {}", e))?;
    }

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Erro no request para {}: {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Falha no download {}: Status {}",
            url,
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Erro ao ler bytes de {}: {}", url, e))?;

    fs::write(path, bytes)
        .await
        .map_err(|e| format!("Erro ao salvar arquivo {}: {}", path.display(), e))?;

    Ok(())
}
