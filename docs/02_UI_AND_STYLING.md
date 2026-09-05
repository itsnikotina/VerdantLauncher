# 02 - UI, Layout e CSS Customizado

## 🎨 Visual e Tailwind
O projeto segue uma paleta escura (inspirada em clients famosos como Lunar Client).
- **Backgrounds:** `#0a0c0a`, `#111411`, `#151815`
- **Acentos Verdes:** `#2dba7e`, `#32d583`, `#1db868`
- **Textos:** Branco/Cinza claro, sempre `font-sans` nos cards para garantir leitura perfeita (as fontes pixeladas "Minecraft" só são usadas em Headers e botões grandes).

## 📐 Soluções de Layout (Grid)
- **NewsSection:** Usa `grid-cols-3` e auto-placement.
- **Força de Posição (%pos=X%):** O CSS Grid costuma jogar itens para a linha 2 caso um item tente voltar em uma coluna. Para travar uma única linha com 3 colunas limitadas:
  - Usamos `grid-row: 1` absoluto em **todos** os cards de notícias. 
  - Isso faz com que a flag `%pos=1%` e `%pos=3%` apenas setem a `grid-column: X`, garantindo o preenchimento dos espaços vazios automaticamente sem quebrar o layout.
- **Alinhamento Y:** Ajustamos o banner de fundo (`HeroBackground`) de 55% para 40% da tela para deixar altura suficiente aos cards da grade, permitindo que eles caibam antes do corte da tela.

## 📝 Parser de Formatação Verdant (Discord -> Launcher)
O Launcher interpreta um "pseudo-BBCode" dinâmico gerado das mensagens do Discord:
- `[title]Texto[/title]`: Gera um Header no topo do card.
- `[desc]Texto[/desc]`: (Opcional) Limita o corpo de texto. Sem tags, pega o cru.
- `[hyperlink]URL[/hyperlink]`: Oculta a URL visualmente, converte o card num botão, altera o cursor (pointer) e adiciona glow verde na borda no `:hover`. Usa o Tauri para abrir com segurança.
- `[imglink]URL[/imglink]`: Fallback caso não seja enviado um anexo no Discord.

### Modificadores de Letras (Inline)
- `{red-glow}Texto{/red}`, `{green}Texto{/green}`, etc.
- Suporta `rainbow` (ciclo infinito Hue-Rotate `360deg` de 3s).
- Suporta `floating` (Translate Y animado, Wave Delay `0.1s` por letra).
- As animações são aplicadas via Spans Aninhados ("Boneca Russa"). Apenas UM `animation` CSS funciona por elemento. Assim o floating fica no pai (`span outer`), e a cor/rainbow fica no filho (`span inner`).
- Sombras: O Glow customizado usa duplo `text-shadow: 0 0 6px currentColor, 0 0 12px currentColor` para parear exatamente a cor da animação.
