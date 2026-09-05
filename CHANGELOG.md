# Changelog - Verdant Launcher

Este documento registra todas as implementa\u00E7\u00F5es, corre\u00E7\u00F5es e melhorias recentes feitas no Verdant Launcher e no seu ecossistema.

## [v0.2.2] - Atualiza\u00E7\u00F5es Recentes

### \uD83D\uDC7E Skins e Avatares
- **Corre\u00E7\u00E3o Multiplayer (Mod):** Corrigido o bug de skins invis\u00EDveis em servidores LAN/Multiplayer for\u00E7ando a propriedade `secure = true` no injetor do construtor `PlayerSkin`.
- **API de Skins da Microsoft:** Substitu\u00EDda a chamada nativa da Mojang (que bloqueava CORS no navegador) pela API p\u00FAblica `api.mcheads.org/skin/`, permitindo renderiza\u00E7\u00E3o correta do modelo 3D e dos rostos 2D.
- **Corre\u00E7\u00E3o de Rota Verdant:** O preview 3D de contas Verdant estava buscando a imagem pelo ID longo do usu\u00E1rio. Corrigido para buscar corretamente pelo `username`.
- **Preven\u00E7\u00E3o de Cache (Ghost Skins):** Adicionado um "quebrador de cache" (`?t=timestamp`) na barra lateral para garantir que o Chromium n\u00E3o reutilize a "carinha" da Microsoft quando o usu\u00E1rio troca para a conta Verdant.
- **Detec\u00E7\u00E3o Inteligente de Modelo (Slim/Classic):** O painel "Meu Perfil" agora detecta automaticamente o modelo da skin ao abrir:
  - **Microsoft:** Faz consulta \u00E0 API Ashcon da Mojang para verificar a propriedade `textures.slim`.
  - **Verdant:** L\u00EA as propriedades salvas localmente no `user_metadata` do Supabase.

### \uD83C\uDFA8 Interface Visual e Janela (UI/UX)
- **\u00CDcones Nativos Atualizados:** Gerada a fam\u00EDlia completa de \u00EDcones (PNG, ICO, ICNS) a partir da logo oficial do Verdant (`Verdant512.png`) usando o motor nativo do Tauri. A barra de tarefas do Windows agora exibe a folha do Verdant em vez da bigorna do Tauri.
- **Barra de T\u00EDtulo Global:** A barra superior (com bot\u00F5es de fechar e minimizar) foi extra\u00EDda do `LauncherLayout` e promovida ao `App.tsx`, garantindo que os bot\u00F5es apare\u00E7am e funcionem perfeitamente inclusive na tela de Login.
- **Corre\u00E7\u00E3o dos Bot\u00F5es Fechar/Minimizar:** 
  - Resolvido o conflito com a \u00E1rea de arrasto do CSS (`no-drag`).
  - Importa\u00E7\u00F5es din\u00E2micas convertidas para est\u00E1ticas para evitar travamentos no Vite.
  - Permiss\u00F5es de seguran\u00E7a (`core:window:allow-close`, `allow-minimize`, `process:allow-exit`) autorizadas nas configura\u00E7\u00F5es do Tauri v2 (`capabilities/default.json`).

### \uD83D\uDD27 Core, Updater e Conectividade
- **Limpeza do Sistema de Atualiza\u00E7\u00E3o Autom\u00E1tica:** Interface visual de logs de debug do `GlobalUpdater` removida para a vers\u00E3o de produ\u00E7\u00E3o.
- **Corre\u00E7\u00E3o de BOM no Build:** O script `build_release.ps1` foi reescrito para salvar o JSON de updates como `UTF-8` limpo. Antes, o PowerShell injetava caracteres invis\u00EDveis (`UTF-8 BOM / \u00B4\u2557\u2510`) que derrubavam o decodificador JSON do Rust.
- **Novo Host do Updater:** A rota do atualizador (`tauri.conf.json`) foi migrada do Storage do Supabase para o GitHub Raw (`main/verdant-updater.json`) a pedido do usu\u00E1rio, eliminando o atraso de cache da CDN de 1 hora.
- **Corre\u00E7\u00E3o das Not\u00EDcias em Tempo Real:** As atualiza\u00E7\u00F5es din\u00E2micas do Supabase n\u00E3o estavam funcionando em modo Produ\u00E7\u00E3o. Adicionada a flag de permiss\u00F5es `wss: ws: tauri:` na tag `<meta>` CSP do `index.html` para liberar conex\u00F5es WebSocket.

---
*Documento gerado automaticamente para controle e versionamento.*
