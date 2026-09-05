# 03 - Engine do Minecraft e Versões (Dicas Críticas)

## ⚠️ Transição LWJGL (2 para 3)
Um dos maiores gargalos ao criar Launchers de Minecraft é a transição de bibliotecas nativas.
- **Versões Legadas (<= 1.12.2):** Usam LWJGL 2. Estas precisam de parâmetros de extração nativos específicos (`-Djava.library.path`) e regras antigas de extração de natives do pacote.
- **Versões Modernas (>= 1.13):** Usam LWJGL 3. O gerenciamento de janelas mudou totalmente para GLFW. As regras de download JSON de bibliotecas são diferentes, baseando-se no OS (`windows-x64`). 

## 📦 Assets e Index (Legacy vs Modern)
O objeto do manifesto de versions (`version.json`) aponta para um `assetIndex`.
- Na versão `1.7.10` e anteriores, há as regras de "virtual" e "map_to_resources", exigindo recriar a estrutura de pastas física em `assets/virtual/legacy` para sons antigos funcionarem.
- Versões modernas apenas verificam os hashes em `assets/objects`.
- Certifique-se de que o Rust (`lib.rs`) obedece à flag `"map_to_resources": true` do JSON da Mojang caso uma versão antiga seja instalada pelo Launcher.

## 💾 Auth Híbrido 
Atualmente, o projeto do Verdant planeja integrar "Microsoft OAuth" via PKCE em um proxy local ou via URI callback, vinculando tokens ao banco de dados Supabase do jogador. Para instâncias crackeadas ou offline (mockup provisório), nomes locais genéricos e UUIDs v3 (MD5 based) são suficientes.
