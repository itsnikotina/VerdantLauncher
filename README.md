# Verdant Launcher
Um launcher de Minecraft moderno, seguro e open-source.

## 🌿 O que é o projeto?

O **Verdant Launcher** é um launcher de Minecraft focado em performance, segurança e usabilidade. Desenvolvido com uma interface moderna e minimalista, o objetivo principal é proporcionar aos jogadores a melhor experiência ao gerenciar suas instâncias, modpacks e contas de Minecraft, tudo em um só lugar.

## 🛡️ Por que ele existe?

Este projeto nasceu de uma necessidade latente na comunidade global de jogadores por uma alternativa direta, segura e transparente ao TLauncher.

Embora o TLauncher seja extremamente popular mundialmente, a comunidade há muito tempo debate e enfrenta problemas graves envolvendo **spywares, malwares e falta de privacidade**, com muitas acusações e polêmicas que mancham a confiança no aplicativo, e infelizmente nada é feito a respeito pelos desenvolvedores.

O **Verdant Launcher** existe para preencher essa lacuna. Acredito que você não deveria ter que arriscar a segurança do seu computador só para jogar Minecraft. Sendo um projeto **100% open-source**, qualquer pessoa pode ler o código, compilar em casa e ter a certeza absoluta de que **não há spywares, rastreadores ocultos ou vírus** aqui.

## 🚀 Tecnologias Utilizadas

Para garantir a máxima performance, baixo consumo de memória RAM (diferente de launchers baseados em Electron) e segurança, utilizei as melhores ferramentas modernas no desenvolvimento do projeto:

- **[Tauri](https://tauri.app/):** Framework principal do aplicativo. Permite que o launcher seja extremamente leve e rápido usando as webviews nativas do sistema.
- **[Rust](https://www.rust-lang.org/):** Todo o "motor" (back-end) do launcher, incluindo download de arquivos, extração do Java, execução do jogo e comunicação segura.
- **[React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/):** Construção da interface do usuário (front-end) com código tipado e seguro.
- **[Tailwind CSS](https://tailwindcss.com/):** Estilização da interface, garantindo um design responsivo e altamente customizável.
- **[Supabase](https://supabase.com/):** Gerenciamento e banco de dados para contas Verdant e skins personalizadas.
