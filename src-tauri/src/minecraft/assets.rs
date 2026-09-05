use futures::stream::{self, StreamExt};
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct AssetIndexContent {
    pub objects: HashMap<String, AssetObject>,
}

#[derive(Debug, Deserialize)]
pub struct AssetObject {
    pub hash: String,
    pub size: u64,
}

/// Lê o arquivo de índice já baixado e engatilha o download de todos os milhares de arquivos
/// (sons, linguagens, imagens de fundo) diretamente dos servidores de resource da Mojang.
pub async fn download_assets(
    client: &Client,
    index_path: &Path,
    objects_dir: &Path,
) -> Result<(), String> {
    // 1. Lê e decodifica o JSON do índice
    let content = std::fs::read_to_string(index_path)
        .map_err(|e| format!("Falha ao ler o index de assets: {}", e))?;

    let index: AssetIndexContent = serde_json::from_str(&content)
        .map_err(|e| format!("Falha no parser do index de assets: {}", e))?;

    let mut tasks = Vec::new();

    // 2. Prepara as tarefas de download
    for (_, obj) in index.objects {
        let hash = obj.hash.clone();
        let subhash = &hash[0..2];

        // A Mojang guarda os arquivos em URLs organizadas pelas 2 primeiras letras da hash
        let url = format!(
            "https://resources.download.minecraft.net/{}/{}",
            subhash, hash
        );
        let out_path = objects_dir.join(subhash).join(&hash);

        if !out_path.exists() {
            let client_ref = client.clone();
            // Adiciona a "promessa" de download na nossa lista
            tasks.push(async move {
                let _ =
                    crate::minecraft::downloader::download_file(&client_ref, &url, &out_path).await;
            });
        }
    }

    if tasks.is_empty() {
        println!("[Verdant/Assets] ✅ Todos os assets já estão sincronizados!");
        return Ok(());
    }

    println!(
        "[Verdant/Assets] 🎶 Baixando {} arquivos de som/textura faltantes...",
        tasks.len()
    );

    // 3. Executa os downloads paralelamente (20 conexões simultâneas para ser muito rápido)
    let mut stream = stream::iter(tasks).buffer_unordered(20);

    // Aguarda todos finalizarem
    while let Some(_) = stream.next().await {}

    println!("[Verdant/Assets] ✅ Download massivo de assets concluído!");
    Ok(())
}
