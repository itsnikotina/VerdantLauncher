# 01 - Arquitetura e Backend

## 🛠 Tech Stack
- **Desktop Core:** Tauri v2
- **Backend Nativo:** Rust (reqwest, serde_json, tokio)
- **Frontend UI:** React 19 + TypeScript + Vite
- **Banco de Dados/Auth:** Supabase
- **Integração de Notícias:** Discord Bot (Node.js) externo rodando no server do usuário.

## 🗄 Estrutura de Pastas (Rust)
O Launcher cria automaticamente a raiz do jogo em `%APPDATA%\.verdant` ao invés de `.minecraft`.
- `instances/`: Onde cada modpack/versão do jogo reside.
- `assets/`: Indexes e objetos nativos da Mojang (sons, ícones).
- `libraries/`: JARs das bibliotecas do jogo (LWJGL, etc).
- `versions/`: JSONs de manifestos do jogo.

## 🌐 Integração Supabase e Notícias
O painel de notícias na aba "JOGAR" é completamente assíncrono e Realtime:
1. Um **Bot do Discord** no canal designado escuta mensagens, edições e exclusões.
2. O bot processa anexos (imagens) e metadados do autor (avatar, apelido).
3. O bot atualiza a tabela `news` no Supabase (usando `upsert`).
4. O Launcher tem um frontend React inscrito no canal `schema-db-changes` do Supabase via WebSockets. No exato milissegundo em que o bot atualiza o banco, a UI re-renderiza o Feed sem recarregar a tela.

## 🔧 Tauri v2 (Observações de Setup)
- Usamos `@tauri-apps/plugin-opener` (com `openUrl`) ao invés do antigo `@tauri-apps/api/shell` para manipulação segura de links de terceiros.
- A sincronização de instâncias (thumbnails e backgrounds editados) entre as Modals do backend e a UI principal é feita através do método `refreshActiveInstance` no `App.tsx` via eventos/callbacks, evitando `stale closures` no React.
