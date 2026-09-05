pub mod auth;
use crate::GameProcessState;
use reqwest::Client;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

// Importa o mÃ³dulo criado
pub mod assets;
pub mod downloader;
pub mod extractor;
pub mod java;
pub mod mojang_api;

#[tauri::command]
pub async fn play_game(
    app: AppHandle,
    state: tauri::State<'_, GameProcessState>,
    instance_id: String,
    username: String,
    uuid: Option<String>,
    access_token: Option<String>,
) -> Result<String, String> {
    let final_uuid = uuid.unwrap_or_else(|| "00000000-0000-0000-0000-000000000000".to_string());
    let final_token = access_token.unwrap_or_else(|| "offline_token".to_string());
    let final_user_type = if final_token == "offline_token" {
        "mojang"
    } else {
        "msa"
    };
    if state.process.lock().unwrap().is_some() {
        return Err("O jogo jÃ¡ estÃ¡ aberto!".to_string());
    }

    let emit_status = |msg: &str| {
        let _ = app.emit("launch-status", msg);
        println!("[Verdant/Core] {}", msg);
    };

    let client = Client::new();

    let root = {
        #[cfg(target_os = "windows")]
        {
            let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA nao encontrado".to_string())?;
            PathBuf::from(appdata).join(".verdant")
        }
        #[cfg(not(target_os = "windows"))]
        {
            let home = std::env::var("HOME").map_err(|_| "HOME nao encontrado".to_string())?;
            PathBuf::from(home).join(".config").join("verdant-launcher")
        }
    };

    let instance_dir = root.join("instances").join(&instance_id);
    let config_path = instance_dir.join("instance.json");
    if !config_path.exists() {
        return Err("instancia nÃ£o encontrada!".to_string());
    }

    let config_str = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let config: crate::instances::InstanceConfig =
        serde_json::from_str(&config_str).map_err(|e| e.to_string())?;

    let version = config.mc_version;
    let ram_mb = config.ram_mb;

    emit_status(&format!("Preparando boot da instancia {}", config.name));

    let version_dir = root.join("versions").join(&version);
    let libraries_dir = root.join("libraries");
    let runtimes_dir = root.join("runtimes");
    let assets_dir = root.join("assets");

    fs::create_dir_all(&version_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&libraries_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&runtimes_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    emit_status("Buscando metadados da versao...");
    let manifest: mojang_api::VersionManifest = client
        .get("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let version_info = manifest
        .versions
        .into_iter()
        .find(|v| v.id == version)
        .ok_or_else(|| format!("versao {} nÃ£o encontrada!", version))?;

    let meta = mojang_api::fetch_version_meta(&client, &version_info.url).await?;

    let major_java_version = if let Some(jv) = &meta.java_version {
        jv.major_version
    } else {
        8 // Minecraft antigo (1.8, 1.12 etc) usa Java 8, e eles nÃ£o tinham 'javaVersion' no JSON
    };

    emit_status(&format!(
        "Verificando integridade do Java {}...",
        major_java_version
    ));
    let java_exe = java::ensure_java(&client, &runtimes_dir, major_java_version).await?;

    emit_status("Validando client principal...");
    let client_jar_path = version_dir.join(format!("{}.jar", version));
    downloader::download_file(&client, &meta.downloads.client.url, &client_jar_path).await?;

    emit_status("Sincronizando bibliotecas nativas...");
    let natives_dir = version_dir.join("natives");
    fs::create_dir_all(&natives_dir).map_err(|e| e.to_string())?;

    let mut classpath_entries = Vec::new();

    for lib in meta.libraries {
        let mut allow = false;
        if let Some(rules) = &lib.rules {
            for rule in rules {
                let current_os = std::env::consts::OS; // "windows", "linux", "macos"
                let match_os = match &rule.os {
                    Some(os) => {
                        // O JSON da Mojang usa "osx" para Mac, mas o Rust usa "macos"
                        let os_name = os.name.as_str();
                        let matches = os_name == current_os
                            || (os_name == "osx" && current_os == "macos");
                        matches
                    }
                    None => true,
                };
                if match_os {
                    allow = rule.action == "allow";
                }
            }
        } else {
            allow = true;
        }

        if !allow {
            continue;
        }

        if let Some(downloads) = lib.downloads {
            // 1. Processa o Artifact principal
            if let Some(artifact) = downloads.artifact {
                if let Some(path_str) = artifact.path {
                    let lib_path = libraries_dir.join(path_str);
                    downloader::download_file(&client, &artifact.url, &lib_path).await?;
                    classpath_entries.push(lib_path.to_string_lossy().into_owned());

                    let file_name = lib_path.file_name().unwrap_or_default().to_string_lossy();
                    // Detecta nativo baseado no OS atual
                    let is_native = if cfg!(target_os = "windows") {
                        file_name.contains("natives-windows") || file_name.contains("native")
                    } else if cfg!(target_os = "linux") {
                        file_name.contains("natives-linux") || file_name.contains("native")
                    } else {
                        file_name.contains("natives-macos") || file_name.contains("natives-osx") || file_name.contains("native")
                    };
                    if is_native {
                        let _ = extractor::extract_natives(&lib_path, &natives_dir);
                    }
                }
            }

            // 2. Processa os Classifiers (Natives das versões antigas como 1.8.9)
            if let Some(classifiers) = downloads.classifiers {
                // Determina a chave de nativo esperada baseada no OS
                let native_key = if cfg!(target_os = "windows") {
                    "windows"
                } else if cfg!(target_os = "linux") {
                    "linux"
                } else {
                    "osx"
                };

                for (key, download) in classifiers {
                    if key.contains(native_key) {
                        // Evita baixar/extrair nativos de 32 bits em sistema 64 bits
                        if key.contains("x86") || key.contains("32") {
                            continue;
                        }

                        if let Some(path_str) = download.path {
                            let lib_path = libraries_dir.join(path_str);
                            downloader::download_file(&client, &download.url, &lib_path).await?;
                            let _ = extractor::extract_natives(&lib_path, &natives_dir);
                        }
                    }
                }
            }
        }
    }

    let mut main_class = meta.main_class.clone();
    let mut extra_jvm_args = Vec::new();
    let mut extra_game_args = Vec::new();

    if config.loader.to_lowercase() == "fabric" {
        if let Some(loader_version) = &config.loader_version {
            let (fab_main, fab_cp) =
                fabric::setup_fabric(&client, &version, loader_version, &libraries_dir, &app)
                    .await?;
            main_class = fab_main;

            // Prioriza as bibliotecas do Fabric
            let mut new_cp = fab_cp;
            new_cp.extend(classpath_entries);
            classpath_entries = new_cp;
        }
    } else if config.loader.to_lowercase() == "forge" {
        if let Some(loader_version) = &config.loader_version {
            let (forge_main, forge_cp, jvm_a, game_a) =
                forge::setup_forge(&client, &version, loader_version, &root, &java_exe, &app)
                    .await?;
            main_class = forge_main;

            // Prioriza as bibliotecas do Forge (para injetar versoes de Log4j mais recentes, etc)
            let mut new_cp = forge_cp;
            new_cp.extend(classpath_entries);
            classpath_entries = new_cp;

            extra_jvm_args.extend(jvm_a);
            extra_game_args.extend(game_a);
        }
    }

    classpath_entries.push(client_jar_path.to_string_lossy().into_owned());

    // Dedulplica o classpath (a Mojang costuma mandar o lwjgl duas vezes no JSON)
    // O Forge ModLauncher crascha (em nativos C++ como jemalloc) se a mesma biblioteca aparecer duas vezes no classpath
    let mut unique_cp = Vec::new();
    for entry in classpath_entries {
        if !unique_cp.contains(&entry) {
            unique_cp.push(entry);
        }
    }
    // Windows usa ';' para separar entradas do classpath, Linux/macOS usam ':'
    let cp_separator = if cfg!(target_os = "windows") { ";" } else { ":" };
    let classpath = unique_cp.join(cp_separator);

    emit_status("Checando os Assets do jogo...");
    let indexes_dir = assets_dir.join("indexes");
    let objects_dir = assets_dir.join("objects");
    fs::create_dir_all(&indexes_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&objects_dir).map_err(|e| e.to_string())?;

    let asset_index_path = indexes_dir.join(format!("{}.json", meta.asset_index.id));
    downloader::download_file(&client, &meta.asset_index.url, &asset_index_path).await?;

    assets::download_assets(&client, &asset_index_path, &objects_dir).await?;

    // Processa a configuracao de logging (Log4j)
    if let Some(logging) = meta.logging {
        if let Some(client_log) = logging.client {
            let log_dir = assets_dir.join("log_configs");
            fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;

            // O id do arquivo geralmente vem da url ou do prprio objeto, o objeto file tem um `id` em JSON reais do mojang,
            // mas nossa struct `DownloadFile` no tem `id`. Vamos extrair o nome do arquivo da URL.
            let file_name = client_log
                .file
                .url
                .split('/')
                .last()
                .unwrap_or("client.xml");
            let log_file_path = log_dir.join(file_name);

            if !log_file_path.exists() {
                downloader::download_file(&client, &client_log.file.url, &log_file_path).await?;
            }

            let arg = client_log
                .argument
                .replace("${path}", &log_file_path.to_string_lossy().into_owned());
            extra_jvm_args.push(arg);
        }
    }

    emit_status("Iniciando a Maquina Virtual (JVM)...");

    let mut cmd = std::process::Command::new(java_exe);
    cmd.current_dir(&instance_dir);

    cmd.arg(format!("-Xmx{}M", ram_mb));
    cmd.arg(format!("-Djava.library.path={}", natives_dir.display()));
    cmd.arg(format!("-Djna.tmpdir={}", natives_dir.display()));
    cmd.arg(format!(
        "-Dorg.lwjgl.system.SharedLibraryExtractPath={}",
        natives_dir.display()
    ));

    for arg in extra_jvm_args {
        let arg = arg
            .replace("${version_name}", &version)
            .replace("${library_directory}", &libraries_dir.display().to_string())
            .replace("${classpath_separator}", cp_separator);
        cmd.arg(arg);
    }

    cmd.arg("-cp");
    cmd.arg(classpath);

    cmd.arg(&main_class);

    let mut skip_vanilla_args = false;
    for arg in &extra_game_args {
        if arg == "--gameDir" || arg == "--version" {
            skip_vanilla_args = true;
            break;
        }
    }

    if !skip_vanilla_args {
        cmd.arg("--username").arg(&username);
        cmd.arg("--version").arg(&version);
        cmd.arg("--gameDir").arg(instance_dir.display().to_string());
        cmd.arg("--assetsDir").arg(assets_dir.display().to_string());
        cmd.arg("--assetIndex").arg(&meta.asset_index.id);
        cmd.arg("--uuid").arg(&final_uuid);
        cmd.arg("--accessToken").arg(&final_token);
        cmd.arg("--userType").arg(final_user_type);
        cmd.arg("--versionType").arg("release");
        cmd.arg("--userProperties").arg("{}");
    }

    for arg in extra_game_args {
        let arg = arg
            .replace("${version_name}", &version)
            .replace("${game_directory}", &instance_dir.display().to_string())
            .replace("${library_directory}", &libraries_dir.display().to_string())
            .replace("${classpath_separator}", cp_separator)
            .replace("${assets_root}", &assets_dir.display().to_string())
            .replace("${assets_index_name}", &meta.asset_index.id)
            .replace("${auth_player_name}", &username)
            .replace("${auth_uuid}", &final_uuid)
            .replace("${auth_access_token}", &final_token)
            .replace("${user_type}", final_user_type)
            .replace("${version_type}", "release")
            .replace("${user_properties}", "{}")
            .replace("${resolution_width}", "854")
            .replace("${resolution_height}", "480");
        cmd.arg(arg);
    }

    emit_status(&format!("Command Line: {:?}", cmd));

    let child = cmd
        .spawn()
        .map_err(|e| format!("Falha ao iniciar o jogo: {}", e))?;

    let _ = app.emit("game-opened", ());
    *state.process.lock().unwrap() = Some(child);

    // Monitora quando o jogo fecha sem travar a interface
    let app_clone = app.clone();
    let process_arc = state.process.clone();

    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            let mut proc = process_arc.lock().unwrap();

            if let Some(child) = proc.as_mut() {
                if let Ok(Some(_)) = child.try_wait() {
                    // Jogo fechou!
                    *proc = None;
                    break;
                }
            } else {
                // Processo jÃ¡ nÃ£o existe mais (foi fechado pelo kill_game)
                break;
            }
        }
        let _ = app_clone.emit("game-closed", ());
    });

    Ok("LanÃ§amento despachado para a UI.".to_string())
}
pub mod fabric;
pub mod forge;
pub mod mod_api;
pub mod modrinth;

pub mod mrpack;
