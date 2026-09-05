use super::downloader::download_file;
use super::extractor;
use reqwest::Client;
use std::fs;
use std::path::{Path, PathBuf};

/// Retorna o OS no formato que a API do Adoptium espera
fn adoptium_os() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "mac"
    }
}

/// Retorna o nome do executável Java correto para o OS
fn java_exe_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "java.exe"
    } else {
        "java"
    }
}

/// Baixa e extrai o Java correto se necessario
pub async fn ensure_java(
    client: &Client,
    runtimes_dir: &PathBuf,
    major_version: u32,
) -> Result<PathBuf, String> {
    let java_dir = runtimes_dir.join(format!("java{}", major_version));

    if let Some(exe_path) = find_java_exe(&java_dir) {
        return Ok(exe_path);
    }

    println!(
        "[Verdant/Java] ⚠️ Java {} nao encontrado. Iniciando download...",
        major_version
    );
    fs::create_dir_all(&java_dir).map_err(|e| e.to_string())?;

    // URL dinâmica: baixa a JRE correta para o OS atual via API oficial do Adoptium
    let os = adoptium_os();
    let url = format!(
        "https://api.adoptium.net/v3/binary/latest/{}/ga/{}/x64/jre/hotspot/normal/eclipse",
        major_version, os
    );

    // O arquivo baixado é zip no Windows e tar.gz no Linux/Mac
    let archive_ext = if cfg!(target_os = "windows") { "zip" } else { "tar.gz" };
    let archive_path = runtimes_dir.join(format!("java{}.{}", major_version, archive_ext));

    println!("[Verdant/Java] 📥 Baixando pacote JRE ({}): {}", os, url);
    download_file(client, &url, &archive_path).await?;

    println!("[Verdant/Java] 📦 Extraindo pacote...");
    extractor::extract_all(&archive_path, &java_dir)?;
    let _ = fs::remove_file(archive_path);

    println!(
        "[Verdant/Java] 🟢 Java {} instalado com sucesso!",
        major_version
    );

    let java_exe = find_java_exe(&java_dir).ok_or_else(|| {
        format!(
            "Instalacao do Java {} falhou: {} nao encontrado.",
            major_version,
            java_exe_name()
        )
    })?;

    Ok(java_exe)
}

fn find_java_exe(dir: &Path) -> Option<PathBuf> {
    if !dir.exists() {
        return None;
    }

    let target_name = java_exe_name();
    let entries = std::fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(exe) = find_java_exe(&path) {
                return Some(exe);
            }
        } else if path.is_file() && path.file_name().unwrap().to_string_lossy() == target_name {
            return Some(path);
        }
    }
    None
}
