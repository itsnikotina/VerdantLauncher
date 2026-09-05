# Verdant Launcher - Master Index

Este é o documento principal (Index) do projeto **Verdant Launcher**. Para evitar consumo excessivo de tokens ao utilizar IAs, leia apenas este índice e acesse os arquivos `.md` específicos listados abaixo de acordo com o que precisar.

## 📚 Documentações Disponíveis

### 1. Arquitetura e Backend
📄 **Arquivo:** [01_ARCHITECTURE.md](./01_ARCHITECTURE.md)
*Contém:*
- Detalhes sobre o Tauri v2 + Rust
- Sistema de pastas e gerenciamento de arquivos (Downloads, extrações)
- Integração Supabase Auth e Supabase Realtime (Websockets)
- Estrutura do Bot do Discord standalone (Node.js) para sincronização de notícias.

### 2. UI, Layout e CSS Customizado
📄 **Arquivo:** [02_UI_AND_STYLING.md](./02_UI_AND_STYLING.md)
*Contém:*
- Estrutura do Tailwind (cores baseadas no mockup Lunar Client)
- Lógicas complexas de CSS Grid e Flexbox (ex: alinhamento dos cards na parte inferior)
- Parser Customizado de Notícias (BBCode simulado: `[title]`, `[br]`, `[hyperlink]`, `%pos=X%`)
- Efeitos visuais (Rainbow Hue-Rotate, Floating Waves, Double Text-Shadow).

### 3. Engine do Minecraft e Versões (Dicas Críticas)
📄 **Arquivo:** [03_MINECRAFT_VERSIONS.md](./03_MINECRAFT_VERSIONS.md)
*Contém:*
- Avisos de compatibilidade
- Diferenças entre versões antigas (ex: 1.8.9, 1.12.2) e novas (1.20+)
- Issues conhecidas com assets de áudio, bibliotecas antigas e a transição do LWJGL 2 para LWJGL 3.

---
**Nota para IAs:** Caso precise debugar um problema de interface, leia o `02_UI_AND_STYLING.md`. Se o problema for relacionado ao Rust ou autenticação, leia `01_ARCHITECTURE.md`.
