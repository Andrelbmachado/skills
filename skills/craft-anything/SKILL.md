---
name: craft-anything
description: Recria um site, app ou jogo a partir do original, do jeito do Craft Anything (storytold/craft-anything), mas feito pelo próprio Claude Code, sem o app. O loop é Estudar → Construir → Checar → Refinar → Pronto. O estudo captura o original como visitante com Playwright (screenshots em 1440/768/390, tokens de design, layout por largura, estados, outras páginas). A construção fica toda em app/. A checagem dá a nota "X% parecido" (pixels + SSIM) e as afirmações que bloqueiam o resultado. Também cobre os contratos de jogos e apps (--screenshot, --self-test, mechanics.json) e a comparação de programas de console. Use sempre que o usuário pedir para recriar, clonar, refazer, copiar o visual ou "fazer minha versão" de um site, landing page, app ou jogo. Use também quando pedir "recreate this website", "rebuild this app", "make my own version of this game", quando colar uma URL pedindo algo igual, ou quando mandar prints dizendo "faz igual", mesmo sem dizer "craft anything".
---

# Craft Anything (no Claude Code)

Método do Craft Anything (storytold/craft-anything): **estudar o original com ferramentas reais → construir um projeto novo → comparar com o original → refinar até ficar perto.** Aqui você faz tudo isso direto, com Playwright, ffmpeg e os próprios scripts desta skill.

Detalhes, números e formatos completos estão em `references/methodology.md`. Leia a seção do tipo de alvo (site §3.1, jogo §3.2, app §3.3, projeto próprio §3.4) antes de construir.

## Limites (leia antes de começar)

- **Clean room é o padrão.** Use só o que um visitante vê: screenshots, texto visível, layout e estilos medidos, menus abertos, as fotos que a pessoa mandou. Não leia o HTML/CSS/JS do original, não baixe os arquivos dele e não descompile. **Deep** (`--deep`, ler código e arquivos) só entra quando a pessoa pede e o alvo é dela ou ela tem autorização. Mesmo em Deep, nunca cole o código original em `app/` e nunca quebre proteção ou criptografia.
- **Nada de imitar marca.** Não copie logos, fotos, nomes de marca nem textos longos, a menos que a pessoa confirme que é dona do original ou tem permissão (pergunte uma vez, se fizer diferença). Fora disso, use placeholders neutros: formas ou gradientes no lugar de imagens, texto curto de exemplo. Um clone de site não pode passar pelo site real: nada de domínio, marca ou formulário de login de terceiros.
- **Jogos:** recrie as *mecânicas* (regras, controles, números, sensação) num jogo original, com nome, personagens, arte, música e fases próprios. Não refaça um jogo comercial específico com a identidade dele. Se o pedido for "o jogo X igualzinho", ofereça "um jogo original com as mesmas mecânicas".

## Layout do projeto

Crie `<projeto>/` (padrão: `./craft-<slug>/` na pasta atual):

```
capture/        evidência do original (só leitura): README.md, capture.json, screenshot-<w>.png, noise-<w>.png, states*/, routes/
reference/      fotos/prints que a pessoa mandou
app/            O ÚNICO lugar onde você escreve o projeto
checks/round-N/ capturas e report.md de cada checagem
unknowns.md     perguntas abertas: pergunta | como resolver | gravidade | status | resolução
state.json      {"kind","stack","mode","round","refinements","failed_rounds","no_change_turns"}
```

Guarde os contadores em `state.json`. É isso que impede o orçamento de refinamento de zerar quando a pessoa diz "tenta de novo".

## Fluxo

### 0. Entender o pedido (sem cerimônia)
- **Tipo:** site (tem URL, ou fala "site/landing/página"), jogo (fala "jogo/gameplay/fase/player" ou cita uma engine) ou app (o resto). Se for o próprio projeto da pessoa, edite no lugar (§3.4).
- **Stack:** se o pedido citar linguagem, framework ou engine, **use exatamente essa** (§4). Se não citar: site → a escolha que fizer mais sentido (reaproveite o framework do original quando a captura mostrar, `/_next/` → Next.js estático), jogo → web (Canvas/Three.js/Phaser) ou a engine que estiver instalada, app → Rust + egui ou Electron. O padrão nunca passa por cima do pedido. Um build quebrado se conserta; não é motivo para trocar de stack.
- Pergunte (AskUserQuestion, 2 a 4 opções curtas) **só** quando a escolha muda o resultado: deixar parte do pedido de fora, se a pessoa é dona da marca, ou comportamento que não dá para ver em Clean room. Detalhe técnico você mesmo decide.

### 1. Estudar
**Site:**
```bash
uv run ~/.claude/skills/craft-anything/scripts/craft_web.py capture <URL> <projeto>/capture [--max-pages 4] [--deep]
```
O comando captura em 1440/768/390 px. Antes do print de página inteira, rola a página para revelar o conteúdo lazy (até 12.000 px de altura). Também gera uma máscara de regiões animadas, tokens (cores, fontes, tamanhos, espaçamentos, raios, larguras), o layout de cada largura (padding, gap, itens por linha, coluna de conteúdo), títulos, links, formulários, texto visível, saúde da página (erros de console, requests com falha, landmarks), estados abertos (menus, tabs, details) no desktop e no celular, e até 4 outras páginas do mesmo domínio. Se o Chromium do Playwright faltar: `uv run --with playwright playwright install chromium`.

Depois **leia `capture/README.md` e abra cada `screenshot-<w>.png` com Read**, olhando com atenção.

**App/jogo:** em Clean room, use a descrição da pessoa, as fotos em `reference/` e, se ela permitir, um print da janela (`screencapture -l<id>` ou `screencapture -x` 15 s depois de abrir) → `capture/window.png`. Para um programa de console, registre a saída sem argumentos, com `--help` e com `--version`. Escreva `capture/README.md` com o que você viu.

**Sem alvo:** `capture/README.md` = "Sem alvo. Construir só pelo pedido."

Para cada lacuna que importa, anote em `unknowns.md` em vez de chutar. Faltar evidência nunca prova nada, então marque o que foi estimado.

### 2. Construir (só em `app/`)
- Monte um checklist de 3 a 7 passos em linguagem simples.
- **Seja exato, não aproximado:** use cores, fontes, tamanhos, padding, gaps, raios e larguras de `capture.json` como tokens do tema, e não os padrões de uma biblioteca. Use as mesmas fontes ou as gratuitas mais próximas. Mude o layout onde os prints mostram mudança (seções empilham, colunas por linha, nav vira menu). **No celular, nada de rolagem lateral.**
- Refaça cada página de `routes.json` no mesmo caminho, com a mesma navegação, e faça os estados (menus, tabs) abrirem igual em cada largura.
- Site: o resultado é estático, em `app/dist`, `app/out` ou `app/build` (com `index.html` no topo e cada página no próprio caminho), ou um `index.html` solto em `app/`. Next.js: `output:'export'`, `trailingSlash:true`, `images.unoptimized`. Vite: `base:'./'`.
- Jogo: crie `app/mechanics.json` (a fonte da verdade; `app/MECHANICS.md` é só a versão legível dele) com **todo número que molda o jogo** (velocidade, pulo, gravidade, dano, cadência, vida, pontuação, timers, IA), no formato `{"version":1,"values":[{"name","group","value","unit","source"|"estimated":true}]}`. Cada valor leva a fonte ou `"estimated": true`, e o número precisa aparecer **literal** no código (sem `9.8*2`). Implemente `--screenshot <png>` (desenha cerca de 120 frames em modo demo/autopiloto, salva, sai) e `--self-test <json>` (dirige o jogador com teclas de verdade e mede pelo estado do próprio jogo os passos `move`, `act` e `hud`, mais passos extras para as regras: colisão, game over, pausa).
  - **Jogo web:** copie `assets/web_game_contract.py` para `app/tools/game.py` e adapte as partes `ADAPT`. O jogo expõe um gancho de teste `window.__craft = {state, setup}` e aceita `?demo=1`. O comando da checagem é `uv run <projeto>/app/tools/game.py` (com caminho absoluto).
- App de janela: implemente `--screenshot <png>`. Console: mesma saída e mesmo exit code para cada entrada.
- Asset gerado ou de terceiros → `app/CREDITS.md`.
- **Nunca rode dev server ou watcher** (`npm run dev`, `vite`, `npm start`): eles não terminam. Rode só `npm install && npm run build`, `cargo build` etc. Não crie projeto aninhado (`app/app`).
- **Só diga que construiu depois de ver a saída do comando de build e os arquivos em `app/`.**

### 3. Checar
**Site:**
```bash
uv run ~/.claude/skills/craft-anything/scripts/craft_web.py check <projeto>   # exit 0 = passa
```
O comando serve o build estático, captura do mesmo jeito em `checks/round-N/` e calcula a nota de cada largura como `50 × (blocos 16px com cor média ≤24 + SSIM de luminância)`, sem contar a área animada. A nota final é a média das larguras e das páginas.

**Afirmações que bloqueiam:** nada de rolagem lateral, nada de erro de console ou request com falha que o original não tem, os landmarks do original presentes, os estados abrindo.

**Conselhos** (não bloqueiam, mas trazem valores exatos): tamanhos de h1/h2/body, padding por seção, itens por linha, coluna de conteúdo, cores e fontes ausentes, títulos e palavras faltando.

**Jogo/app:**
```bash
uv run ~/.claude/skills/craft-anything/scripts/check_program.py screenshot <projeto> -- <comando do build>
uv run ~/.claude/skills/craft-anything/scripts/check_program.py selftest   <projeto> -- <comando do build>
uv run ~/.claude/skills/craft-anything/scripts/check_program.py mechanics  <projeto>
uv run ~/.claude/skills/craft-anything/scripts/check_program.py runs <projeto> --orig "<orig>" --build "<build>"   # console
```
A ordem é build → screenshot (não pode sair em branco) → self-test (move, act e hud passam) → mechanics. Pare na primeira que falhar. A comparação com as fotos de referência só orienta, não bloqueia. As rodadas se numeram sozinhas: um screenshot novo abre `checks/round-N+1/`, e o self-test seguinte cai na mesma rodada. `--round N` vai antes do `--`.

No mechanics, inteiro pequeno (≤10) é evidência fraca porque aparece em qualquer código. Verifique esses valores no self-test (por exemplo, "cresce 1 casa"). Se quase tudo estiver `estimated`, diga a cobertura no resumo.

O exit code é 0 quando passa. Não esconda esse código com `| tail`; use `; echo $?` ou leia `report.md`.

O check também gera `side-<w>-<n>.png`, faixas lado a lado (original à esquerda, build à direita) legíveis no Read. **Use essas faixas para comparar**, e não os prints de página inteira, que ficam ilegíveis.

A nota cai quando a altura da página difere muito do original. Assim uma página curta demais não ganha nota alta só por acertar o topo.

**Limite real:** em Clean room sem permissão para usar os textos, uma página cheia de texto (docs, blog) costuma parar em 50 a 80%, porque o SSIM mede as letras. Por isso a pergunta sobre a marca e os textos vale a pena **logo no início**. Sem permissão, entregue com a nota honesta e não force 90%.

**Está bom quando:** todas as checagens passam, todas as afirmações valem, nada ficou sem comparar e o site está **≥ 90%** parecido.

### 4. Refinar
Abra as faixas lado a lado (`checks/round-N/side-<w>-<n>.png`) com Read. Corrija primeiro as maiores diferenças visíveis: ordem e layout das seções, espaçamento, tamanhos, cores, fontes e partes que faltam. Depois aplique os valores exatos que o `report.md` aponta. Reconstrua e cheque de novo.

**Quando parar:**
- passou;
- **6 refinamentos** depois do primeiro build;
- 2 rodadas seguidas sem mudar nenhum arquivo em `app/`;
- 10 rodadas seguidas com falha (aí pare e conte o que está travando).

Atualize `state.json` a cada rodada.

### 5. Pronto
Mostre o resultado. Site: sirva `app/dist` (por exemplo `python3 -m http.server -d <dir> 8765` em background) e abra no **navegador embutido do app** (ferramentas `Claude_Browser`). Jogo/app: o print.

Depois responda em 3 a 5 frases simples, sem código e sem caminhos de arquivo: o que foi construído, "cerca de S% parecido, H de N afirmações valem" (sem original nem foto para comparar: "todas as N checagens passam, X de Y números com fonte"), o que difere ou continua desconhecido (as linhas abertas de `unknowns.md`) e uma sugestão do que pedir em seguida.

Se a pessoa pedir mudanças depois: mude em `app/`, reconstrua, cheque e responda em 1 a 3 frases.

## Armadilhas (vindas do repositório original)
- Dizer que o build passou com `app/` vazio: cite o comando e as últimas linhas da saída.
- Ler o stack padrão como ordem e ignorar "em Electron" ou "em Rust" no pedido.
- Fazer print de página inteira sem rolar antes: as seções lazy ficam de fora.
- Um único elemento largo demais no celular derruba a checagem inteira (`scrollWidth ≤ largura+1`).
- Número de mecânica calculado em tempo de execução não aparece como literal no código: escreva o valor como está ou marque como estimado.
- Electron com `--screenshot`: `backgroundThrottling:false`, espere o load e mais uns 2 s, use `capturePage()`.
- Para lançar o programa, escolha pelo manifesto (`default-run`, crate da janela), nunca pelo "executável mais novo".
