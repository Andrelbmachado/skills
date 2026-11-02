---
name: criar-site-arte
description: Cria sites, dashboards e app screens temáticos de movimentos artísticos/civilizações (style kits do Design Master — Paleolítico, Egito, Mesopotâmia, Grécia, Barroco, Art Nouveau, Bauhaus, etc.). Orquestra o Codex para pesquisar imagens licenciadas (nome do item, fonte, licença, o que tem na imagem), extrai da imagem texturas, formas, tipografia/escrita, cores, objetos icônicos e palavras, e transforma isso em UI — botões de pedra, setas-pirâmide, abas-zigurate, tipografia cuneiforme/hieroglífica real, gráficos com forma do período. Use SEMPRE que André pedir um novo style kit, "site do estilo X", "dashboard egípcio/sumério/...", "tela temática de um movimento de arte", "pesquisa de imagens com o Codex para um estilo", "extrair textura/tipografia de referência", ou revisar/refazer um kit existente — mesmo que não diga "skill" nem "kit". Ao terminar, mostra o site no navegador embutido do app Claude Code (nunca abre o Google Chrome).
---

# criar-site-arte

Transforma um movimento artístico em uma interface que *é* daquele movimento: o material vira botão, a escrita vira tipografia, a arquitetura vira forma, a obra icônica vira easter egg. Não é "tema marrom com fonte antiga" — é caricatura séria, de estúdio.

Princípio central: **tudo que aparece na tela tem que ter saído de uma imagem real e licenciada que você olhou e entendeu.** O Codex encontra e baixa; você inspeciona, nomeia e extrai; o pipeline converte em assets; o builder monta.

## Contexto do projeto (verifique antes de usar — pode ter mudado)

- Worktree de trabalho: `~/Developer/Design-Master-style-kits` (clone parcial esparso, fora do iCloud). Nunca `git grep <rev>`, `git ls-tree -r` ou `git status` do repo inteiro — faz lazy-fetch e mata o disco. Use caminhos (`git status -- Styles/<F>`).
- Kit vive em `Styles/<Pasta>/` (ver `references/pipeline-tecnico.md` para layout, comandos e schemas).
- Regras do repo: `Styles/STYLE_KIT_GUIDELINES.md`, `Styles/COLLECTION_POLICY.md`. Plano de ondas: `docs/superpowers/plans/style-kit-waves.md`.
- Kits de referência: Mesopotâmia "Esagila" (rodada 2 aprovada, commit 5451be2 — o padrão-ouro de tipografia e botões), Paleolítico "Karu" (completo, PR #199), Egito "Akhet Khufu" (draft, branch `claude/style-kit-egypt`). Leia o kit mais próximo antes de começar um novo.
- Chronos Art (`Andrelbmachado/chronos-art`) só decide **quais obras** entram; as imagens dele são IA ou erradas — nunca copie.

## Fluxo (7 fases)

Faça na ordem. Cada fase tem um gate; não pule para código antes de ter o vocabulário visual.

### 1. Enquadrar o movimento
Defina em 5 linhas: nome/datas/região; **cenário do app** (uma tela concreta com narrativa — "livro-razão do templo de Esagila, ano 30 de Nabucodonosor II", não "dashboard genérico"); 1–3 **assinaturas** icônicas (a obra/material/figura que qualquer pessoa reconhece); a **escrita** do período; o **material** dominante; a **forma arquitetônica** dominante. Use `references/gramatica-movimentos.md` como ponto de partida — ele já mapeia Egito, Mesopotâmia, Paleolítico e dá pistas para os outros.

### 2. Mandar o Codex pesquisar
Escreva um brief a partir de `references/codex-brief.md` (template completo + invocação). O brief pede, por imagem: arquivo, nome do item, fonte (`File:` page ou página do objeto no museu), autor, licença, data, foco/o que mostra, dimensões, sha256 — mais `research.md` com candidatos a hero e uma seção **Design vocabulary**. Rode em background:

```bash
codex exec -s workspace-write -c sandbox_workspace_write.network_access=true \
  -C ~/Developer/Design-Master-style-kits - < .superpowers/briefs/<data>-codex-<estilo>.md
```

Enquanto roda, adiante a fase 3 com o que já se sabe do movimento.

### 3. Inspecionar e catalogar (gate obrigatório)
O Codex erra muito: "Giza" era Saqqara, "Hammurabi" era capa de livro, "tijolo da Porta de Ishtar" era grifo aquemênida de Susa, texturas eram tiras finas, Horus era SVG moderno. Então **abra e olhe cada imagem** (Read no arquivo, ou contact-sheet + amostras em resolução cheia) antes de usá-la. Para cada uma registre: é o que diz ser? licença confere na página? resolução útil? serve para quê (hero / textura / forma / ícone / tipografia / cor)? Descarte ou peça um `codex-fix` com a lista exata de problemas.

### 4. Extrair o vocabulário visual
Para cada imagem aprovada, extraia nas 8 camadas descritas em `references/extracao-visual.md`: **texturas, cores, formas, tipografia/escrita, ornamentos/padrões, objetos/figuras icônicas, palavras/nomes/frases do período, luz e profundidade**. Salve o resultado como `Styles/<F>/research/vocabulario.json` (esqueleto: `scripts/vocabulario_template.json`) — cada item aponta para o arquivo de origem e o recorte. É esse arquivo que justifica cada decisão de UI depois.

### 5. Traduzir vocabulário → componentes
Aplique o mapa (detalhado em `references/extracao-visual.md` §Tradução):

| Camada extraída | Vira na UI |
|---|---|
| Material (pedra, tijolo vitrificado, argila, papiro, ouro) | superfície de botões, cards, sidebar — textura PBR real recortada da foto |
| Escrita (hieróglifo, cuneiforme, rúnica, gótica…) | **fonte própria do kit: nosso alfabeto desenhado com o traço da escrita** (cunhas, pinceladas, entalhes) aplicada a TODO o texto do site, gerada como TTF/WOFF2 por script; signos reais só como acento, com leitura latina |
| Botões-assinatura (sidebar, CTA) | imagem gerada pelo Codex (`image_gen`) a partir de folha de referência com as palavras já na fonte do kit + recorte do material; recortada por script e aplicada por botão (texto real oculto para leitor de tela) |
| Arquitetura (pirâmide, zigurate, arco, coluna, vitral) | formas: setas/chevrons-pirâmide, abas e barras em degrau-zigurate, molduras em arco |
| Padrões (roseta, guilhoche, meandro, friso) | bordas, divisores, faixas de seção, estados de foco |
| Obra icônica | hero, fundo, vinheta da sidebar, cena dentro do gráfico |
| Símbolos/deuses/emblemas | conjunto de ícones de navegação (desenhados, não clip-art) |
| Vocabulário/nomes do período | copy do app: nomes de seções, métricas, unidades, datas no calendário local |
| Luz do lugar | interação: tocha, sol de Rá, lamparina, brilho do esmalte — intensifica, nunca revela |

**Forma padrão:** dashboard = retângulo deitado (landscape), cards retangulares. Fuja da forma padrão onde o movimento oferece uma melhor e a função continua clara: botão-pedra na sidebar, seta-pirâmide para próximo/voltar, abas-zigurate, gráfico de barras em degraus. Use inteligência: uma forma temática só entra se o usuário continua entendendo o que o controle faz (alvo ≥ 44 px, foco visível, rótulo legível).

### 6. Construir
Siga `references/pipeline-tecnico.md`: paleta (`sample_palette.py`), texturas (`pbr_maps.py` / script do kit tipo `meso_assets.py`), ícones e gráficos SVG computados, **fonte própria do kit** (nosso alfabeto no traço da escrita do período, padrão `meso_wedge_font.py`) aplicada a todo o texto, signos reais subsetados com `scripts/subset_escrita.py` como acento, **botões-assinatura gerados pelo Codex** a partir de folha de referência (receita em `codex-brief.md`), `kit.json`/`kit.css`/`app.html`/`credits.json`, build e testes. Carregue a skill `motion-code` para qualquer animação e `frontend-design` para direção visual.

### 7. Verificar e entregar
Screenshots light/dark em 1440/390/360, foco, contraste, 0 erros de console, `file://` funcionando (`screenshot.mjs`). Olhe os screenshots você mesmo antes de mostrar. Publique a revisão como Artifact privado para André. **Sempre abra o site para ele ao terminar:** suba o preview local se não estiver rodando (`python3 -m http.server 8844 --bind 127.0.0.1` no worktree) e rode `http://127.0.0.1:8844/Styles/<Pasta>/dashboard/index.html` no navegador dele. Ele quer ver o site em si, não só o link da revisão. `status: complete`, push e PR só depois do aval dele. No fim, rode o **Experience Reflector**: lições comprovadas desta rodada (erros do Codex, decisões aprovadas/rejeitadas) entram em `references/licoes.md` desta skill.

## Regras que não se negociam (e por quê)

- **Material 2D vira 3D: todo material grande ganha mapas PBR.** Fundo, painel, card, sidebar ou objeto feito de material (pedra, argila, bronze, laca, madeira) sai com albedo + normal + roughness + AO (+ height quando houver parallax), via `pbr_maps.py`, e é iluminado pela luz do kit (no Paleolítico, a tocha do mouse: WebGL relighting). André aprovou o fundo de pedra do Karu justamente por isso e pediu o mesmo para TODAS as outras pedras/objetos. Regras: (1) separe objeto e fundo em camadas (Codex gera cada peça isolada: sidebar, itens de nav, título, cards) para parallax no scroll e sombra projetada real; (2) sature a foto antes de extrair o albedo se ela estiver lavada; (3) textura no máximo 1920×1080, repetida em array com transição suave (blend/gradiente 100→0 entre tiles e entre seções), nunca emenda visível nem duplicação óbvia; (4) a luz interativa (tocha) vale para a página inteira, não só para o primeiro bloco; (5) seções genéricas da landing (paleta, tipografia, obras, créditos, rodapé) usam o mesmo material com mapas, não o fundo antigo — rodapé/créditos podem virar escrita pintada a dedo com pigmento na pedra.

- **Mostre o site finalizado no navegador embutido do app Claude Code, nunca no Google Chrome.** Toda rodada termina com o site aberto no Browser do app (ferramentas `Claude_Browser`, `preview_start` com a URL local). André (2026-11-01): "usa o navegador do claude code app... e não fica abrindo o chrome, me incomoda". Sem essas ferramentas na sessão (CLI), verifique em Chrome headless/Playwright e só passe a URL — não rode `open -a "Google Chrome"`.

- **Assinaturas visíveis em repouso.** André julgou "sutil até passar o mouse" como escondido. A interação só intensifica.
- **Studio-grade, nunca cheesy.** Proibido: Papyrus, Herculanum, Luminari, Trajan, Comic Sans, clip-art, gradiente plástico, emenda de textura visível, upscaling. Caricatura ≠ fantasia barata.
- **Escrita antiga é real.** Hieróglifos/cuneiforme vêm de Noto Sans Egyptian Hieroglyphs / Noto Sans Cuneiform (OFL) e escrevem algo verdadeiro (fórmula *ḥtp dj nswt*, numerais sexagesimais, nome de rei). Nunca "fonte que parece antiga" para corpo de texto — corpo fica numa fonte legível do sistema.
- **Contraste medido, não estimado.** Texto ≥ 4.5:1 e gráfico ≥ 3:1 contra p5 e p95 da textura com a luz no máximo. Texto vai em zona calma, nunca sobre textura crua. Cor que falha vira só-gráfico.
- **Licença rastreada.** Só PD/CC0/CC BY/CC BY-SA verificados; todo asset derivado tem entrada em `credits.json`; derivado de BY-SA continua BY-SA; foto de objeto 3D tem copyright do fotógrafo; material ICIP é só referência.
- **Não refaça material sem referência aprovada.** O recorte de madeira do Karu foi rejeitado ("piorou, volte como estava antes"). Se for mudar textura/material de algo já aprovado, pergunte qual referência André tem em mente.

## Arquivos desta skill

- `references/gramatica-movimentos.md` — escrita, material, forma, assinaturas, cores e componentes por movimento (Paleolítico, Egito, Mesopotâmia + pistas para os demais). Leia na fase 1.
- `references/codex-brief.md` — template do brief, invocação, follow-up de correção, armadilhas conhecidas. Leia na fase 2.
- `references/extracao-visual.md` — checklist das 8 camadas + tradução detalhada para componentes. Leia nas fases 3–5.
- `references/pipeline-tecnico.md` — layout do kit, schemas, scripts, comandos de build/teste/preview, orçamento, contrato do `kit.js`. Leia nas fases 6–7.
- `references/licoes.md` — log de lições comprovadas; acrescente ao final de cada kit.
- `scripts/subset_escrita.py` — subset woff2 de Noto Hieroglyphs/Cuneiform/etc. só com os signos usados.
- `scripts/vocabulario_template.json` — esqueleto do `vocabulario.json`.
