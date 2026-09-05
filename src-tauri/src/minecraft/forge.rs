use super::downloader::download_file;
use reqwest::Client;
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;
use tauri::Emitter;

#[derive(Debug, Deserialize)]
pub struct ForgeProfile {
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub arguments: Option<ForgeArguments>,
    #[serde(rename = "minecraftArguments")]
    pub minecraft_arguments: Option<String>,
    pub libraries: Vec<ForgeLibrary>,
}

#[derive(Debug, Deserialize)]
pub struct ForgeArguments {
    pub game: Option<Vec<serde_json::Value>>,
    pub jvm: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub struct ForgeLibrary {
    pub name: String,
    pub downloads: Option<ForgeLibraryDownloads>,
    pub url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ForgeLibraryDownloads {
    pub artifact: Option<ForgeDownloadFile>,
}

#[derive(Debug, Deserialize)]
pub struct ForgeDownloadFile {
    pub url: String,
    pub path: String,
}

pub async fn setup_forge(
    client: &Client,
    mc_version: &str,
    loader_version: &str,
    root_dir: &PathBuf,
    java_exe: &PathBuf,
    app: &AppHandle,
) -> Result<(String, Vec<String>, Vec<String>, Vec<String>), String> {
    let emit_status = |msg: &str| {
        let _ = app.emit("launch-status", msg);
    };

    let forge_id = format!("{}-forge-{}", mc_version, loader_version);
    let forge_version_dir = root_dir.join("versions").join(&forge_id);
    let profile_path = forge_version_dir.join(format!("{}.json", forge_id));

    if !profile_path.exists() {
        emit_status("Baixando o instalador do Forge...");

        let installer_name = format!("forge-{}-{}-installer.jar", mc_version, loader_version);
        let installer_url = format!(
            "https://maven.minecraftforge.net/net/minecraftforge/forge/{}-{}/{}",
            mc_version, loader_version, installer_name
        );

        let temp_installer = root_dir.join("temp").join(&installer_name);
        if let Some(parent) = temp_installer.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let mut final_installer_name = installer_name.clone();
        if let Err(_) = download_file(client, &installer_url, &temp_installer).await {
            emit_status(
                "URL padrao do instalador falhou (404), tentando formato legacy (1.8.9/1.7.10)...",
            );

            let legacy_version = format!("{}-{}-{}", mc_version, loader_version, mc_version);
            final_installer_name = format!("forge-{}-installer.jar", legacy_version);
            let installer_url_legacy = format!(
                "https://maven.minecraftforge.net/net/minecraftforge/forge/{}/{}",
                legacy_version, final_installer_name
            );

            download_file(client, &installer_url_legacy, &temp_installer)
                .await
                .map_err(|e| {
                    format!(
                        "Falha ao baixar instalador Forge (ambos os formatos): {}",
                        e
                    )
                })?;
        }

        emit_status("Enganando o instalador da Forge (Fake profile)...");
        let fake_profile = root_dir.join("launcher_profiles.json");
        if !fake_profile.exists() {
            let _ = fs::write(&fake_profile, "{\"profiles\": {}}");
        }

        let mut install_success = false;

        emit_status("Processando instalacao do Forge (Isso pode demorar)...");
        if let Ok(st) = Command::new(java_exe)
            .arg("-jar")
            .arg(&temp_installer)
            .arg("--installClient")
            .arg(root_dir)
            .status()
        {
            if st.success() {
                install_success = true;
            }
        }

        if !install_success {
            emit_status(
                "Instalador falhou no modo moderno. Tentando extracao manual (Legacy Forge)...",
            );

            let temp_extract_dir = root_dir.join("temp").join("forge_legacy_extract");
            if temp_extract_dir.exists() {
                let _ = fs::remove_dir_all(&temp_extract_dir);
            }
            fs::create_dir_all(&temp_extract_dir).map_err(|e| e.to_string())?;

            super::extractor::extract_all(&temp_installer, &temp_extract_dir)?;

            let profile_json_path = temp_extract_dir.join("install_profile.json");
            if !profile_json_path.exists() {
                return Err(
                    "Nao foi possivel instalar via metodo legacy (install_profile.json ausente)"
                        .into(),
                );
            }

            let legacy_profile_content =
                fs::read_to_string(&profile_json_path).map_err(|e| e.to_string())?;
            let parsed_legacy: serde_json::Value =
                serde_json::from_str(&legacy_profile_content).map_err(|e| e.to_string())?;

            let version_info = parsed_legacy
                .get("versionInfo")
                .ok_or("install_profile.json nao contem versionInfo!")?;

            if let Some(parent) = profile_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(
                &profile_path,
                serde_json::to_string_pretty(version_info).unwrap(),
            )
            .map_err(|e| e.to_string())?;

            if let Some(install_node) = parsed_legacy.get("install") {
                if let (Some(lib_path), Some(file_path)) = (
                    install_node.get("path").and_then(|v| v.as_str()),
                    install_node.get("filePath").and_then(|v| v.as_str()),
                ) {
                    let parts: Vec<&str> = lib_path.split(':').collect();
                    if parts.len() == 3 {
                        let group = parts[0].replace('.', "/");
                        let artifact = parts[1];
                        let version = parts[2];
                        let dest_lib_dir = root_dir
                            .join("libraries")
                            .join(group)
                            .join(artifact)
                            .join(version);
                        fs::create_dir_all(&dest_lib_dir).map_err(|e| e.to_string())?;

                        let dest_jar = dest_lib_dir.join(format!("{}-{}.jar", artifact, version));
                        let extracted_jar = temp_extract_dir.join(file_path);
                        if extracted_jar.exists() {
                            fs::copy(&extracted_jar, &dest_jar).map_err(|e| {
                                format!("Falha ao copiar forge universal jar: {}", e)
                            })?;
                        }
                    }
                }
            }

            let _ = fs::remove_dir_all(&temp_extract_dir);
        }

        let _ = fs::remove_file(temp_installer);
    }

    emit_status("Lendo perfil do Forge...");
    let profile_str =
        fs::read_to_string(&profile_path).map_err(|e| format!("Erro lendo forge json: {}", e))?;
    let profile: ForgeProfile = serde_json::from_str(&profile_str)
        .map_err(|e| format!("Erro no parse do forge json: {}", e))?;

    let mut extra_classpath = Vec::new();
    let libraries_dir = root_dir.join("libraries");

    emit_status("Resolvendo bibliotecas do Forge...");
    for lib in profile.libraries {
        if let Some(downloads) = lib.downloads {
            if let Some(artifact) = downloads.artifact {
                let lib_path = libraries_dir.join(&artifact.path);

                if !artifact.url.is_empty() {
                    if !lib_path.exists() {
                        if let Some(parent) = lib_path.parent() {
                            let _ = fs::create_dir_all(parent);
                        }
                        let _ = download_file(client, &artifact.url, &lib_path).await;
                    }
                }
                extra_classpath.push(lib_path.to_string_lossy().into_owned());
            }
        } else {
            // Fallback para perfis MUITO antigos (ex: 1.8.9) que nao tem "downloads", mas tem "name"
            let parts: Vec<&str> = lib.name.split(':').collect();
            if parts.len() >= 3 {
                let group = parts[0].replace('.', "/");
                let artifact = parts[1];
                let version = parts[2];
                // Em profiles antigos, o classifier opcional (ex: client) pode vir depois
                let jar_name = if parts.len() == 4 {
                    format!("{}-{}-{}.jar", artifact, version, parts[3])
                } else {
                    format!("{}-{}.jar", artifact, version)
                };

                let rel_path = format!("{}/{}/{}/{}", group, artifact, version, jar_name);
                let lib_path = libraries_dir.join(&rel_path);

                let base_url = lib
                    .url
                    .clone()
                    .unwrap_or_else(|| "https://libraries.minecraft.net/".to_string());

                // Se a biblioteca nao existir, tentar baixar
                if !lib_path.exists() {
                    let full_url = if base_url.ends_with('/') {
                        format!("{}{}", base_url, rel_path)
                    } else {
                        format!("{}/{}", base_url, rel_path)
                    };
                    if let Some(parent) = lib_path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let _ = download_file(client, &full_url, &lib_path).await;
                }
                extra_classpath.push(lib_path.to_string_lossy().into_owned());
            }
        }
    }

    let mut jvm_args = Vec::new();
    let mut game_args = Vec::new();

    if let Some(args) = profile.arguments {
        if let Some(g_args) = args.game {
            for arg in g_args {
                if let Some(s) = arg.as_str() {
                    game_args.push(s.to_string());
                }
            }
        }
        if let Some(j_args) = args.jvm {
            for arg in j_args {
                if let Some(s) = arg.as_str() {
                    jvm_args.push(s.to_string());
                }
            }
        }
    } else if let Some(legacy_args) = profile.minecraft_arguments {
        // Fallback para Forge Legacy (1.12.2 e inferiores)
        for arg in legacy_args.split_whitespace() {
            game_args.push(arg.to_string());
        }
    }

    Ok((profile.main_class, extra_classpath, jvm_args, game_args))
}
