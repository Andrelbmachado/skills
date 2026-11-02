# Pipeline técnico

Repo: `~/Developer/Design-Master-style-kits` · venv: `~/Developer/.venvs/design-master` · preview: `python3 -m http.server 8844 --bind 127.0.0.1`.
Antes de tudo: `git sparse-checkout add Styles/<Pasta>` se a pasta não estiver no checkout; nunca inclua `Referencias_Reais/`/`thumbs/` de outros estilos. Novo kit = nova branch `claude/style-kit-<id>`.

## Layout do kit (`Styles/<Pasta>/`)
- `README.md`, `references.json` (harvester), `SOURCES.md` (gerado — não editar), `Referencias_Reais/`, `thumbs/`
- `research/` — do Codex, não versionado; você lê, não edita (exceto `vocabulario.json`)
- `cores/palette.json` — tokens light/dark `bg, surface, text, muted, accent, accent2, accent3, line, btnText` + `graphicsOnly`, `swatches`, `chart`; `cores/sampled-sources.txt`
- `tipografia/typography.json` — `display, body, data, banned[], rationale`
- `dashboard/`
  - `kit.json` — `shape{radius,radiusUneven,border,shadow}`, `motion{duration}`, `chart{texture}`, `status: draft|complete`
  - `kit.css`, `kit.js` opcional, `works.json` (`chronos,title,date,culture,holder,image,width,height,license,licenseUrl,author,sourceUrl,alt,note`)
  - `landing.json` (`{periodLabel}`), `app.html` (com `<!--#include "rel/path"-->`, confinado a `dashboard/`) + `app.css`
  - `assets/` (`credits.json`, `stats.json`, pbr/hero/wall), pasta da tela (`karu/`, `esagila/`…) com `credits.json`, `manifest.json`, `icons.svg`, `fonts/*.woff2` + `OFL.txt`
  - `index.html` gerado
Schemas e regras de contraste: cabeçalho de `07_UI_UX/tools/style-kits.mjs`. Builder: `07_UI_UX/tools/build-style-dashboard.mjs` (exige que toda imagem usada exista e esteja coberta por `credits.json`).

## Scripts (`tools/style-kits/`)
- `sample_palette.py <imgs> --bands bands/<id>.json --out <json> [--files list.txt]` — bandas HLS `[hmin,hmax,lmin,lmax,smin(,smax)]` + 24 swatches k-means. Papéis da paleta só de swatches amostrados.
- `pbr_maps.py --material stone --src foto.jpg --crop x,y,w,h --size 1024 --tile xy --out assets/pbr/<m>` — albedo/normal/roughness/height/ao WebP, de-lit, seamless (delta de emenda < 4/255). `--hero <nome> --src` recortes; `--stats`; `--emit-js` (data-URI p/ WebGL); `--recipe recipes/<x>.json`.
- Script de assets por kit (`karu_assets.py`, `meso_assets.py`) — padrão a copiar: determinístico, `--previews DIR` fora do repo, grava `assets/stats.json` (p5/p50/p95 para contraste). Ex.: meso recorta tijolos inteiros da foto e reassenta em running bond.
- Script SVG por kit (`meso_svg.py`) — ícones e gráficos computados, CC0.
- `svg-views.mjs <file.svg>` — separa `<view>`s em SVGs avulsos (Safari).
- `screenshot.mjs --style <id> [--benchmark --reference ref.png]` — shots + asserções (forced colors, toque 360 px, sem overflow-x, sobreposição de labels). **Bloqueio conhecido:** seletores Paleolítico hardcoded (tarefa I2 do plano de ondas) — confira antes e adapte via `kit.json effects{}`.
- Fonte de escrita antiga: `~/.claude/skills/criar-site-arte/scripts/subset_escrita.py --font <ttf> --out <woff2> --text "<signos>"` (avisa signos ausentes). Fontes Noto OFL já no macOS em `/System/Library/Fonts/Supplemental/`: Cuneiform, EgyptianHieroglyphs, LinearA/B (Creta/Micenas), OldPersian, Phoenician, Ugaritic, OldItalic (etrusco), OldTurkic, OldHungarian, OldSouth/NorthArabian. Runas/ogham: Noto Sans Runic/Ogham (baixar do Google Fonts). Envie `OFL.txt` junto.

## Ordem de build/teste
```bash
python3 tools/generate-style-docs.py
python3 tools/harvest resolve-seeds --style <id>
python3 tools/style-kits/sample_palette.py ...
node 07_UI_UX/tools/generate-application-ui.mjs
node 07_UI_UX/tools/sync-research-progress.mjs
node 07_UI_UX/tools/build-style-dashboard.mjs --style <id>
node --test '07_UI_UX/tools/tests/*.test.mjs'
~/Developer/.venvs/design-master/bin/python -m unittest discover -s tools/style-kits/tests
node tools/audit-project.mjs
node tools/style-kits/screenshot.mjs --style <id>
```

## Restrições técnicas
- Texturas WebGL via data URI (`file://` contamina WebGL). Bisel assado em imagem. Reduced motion = luz estática assada. Forced colors = sem textura, SVG em cores do sistema.
- Canvas DPR ≤ 1.5, flicker ≤ 30 fps, cleanup não deixa nada ao trocar de estilo.
- Orçamento: primeira viewport ≤ 4.5 MB, assets ≤ 6 MiB, WebP.
- `kit.js`: `StyleKitEffects.register(id,{mount(preview,ctx){… return cleanup}})`.
- Toque ≥ 44 px, traço ≥ 1.5 px, texto ≥ 4.5:1 / gráfico ≥ 3:1 contra p5 e p95 da textura com luz máxima.

## Fonte própria do kit (escrita do período no nosso alfabeto)
- Modelo: `tools/style-kits/meso_wedge_font.py` — fontTools `FontBuilder`, cada letra = lista de traços (x0,y0,x1,y1) numa caixa 0..700; cada traço vira o polígono do instrumento (cunha: cabeça triangular + cauda afinando). Minúsculas = maiúsculas em small caps (x-height 540), dígitos, pontuação usada, diacríticos de transliteração como traços pequenos. Contornos todos no mesmo sentido (horário) para a união não furar.
- Calibrar no specimen (`--specimen png`): traço fino some < 15 px; Meso final cabeça 210×175 u, cauda 74→36 u, letter-spacing .03–.05em, texto mínimo 13 px.
- Aplicar a todo o landing: `.preview[data-style=<id>] *:not(.<classe-signos-reais>):not(svg *){font-family:"<Fonte>",fallback!important}`; `@font-face` no `app.css` (kitCss só reescreve `url(assets/…)`). Antes, liste os caracteres usados no `index.html` para cobrir todos.
- Ver para outros: hieróglifo (traço de cinzel), rúnico (talho em madeira), chinês (pincel/selo), maia (glifo em bloco).

## Botões-assinatura gerados
`tools/style-kits/meso_nav_buttons.py` + receita em `codex-brief.md` §Imagens geradas. Imagem no `::before` com `clip-path` (contorno temático) e `background:var(--img)` por link; estado ativo troca para `var(--img-on)`; texto real em `.esg-sr`; `filter:drop-shadow` no próprio link (filter roda antes do clip-path). Forced colors: esconde a imagem e mostra o texto.

## Fontes de imagem extras
Busca direta na API do Commons (mais rápida que Codex para 3–5 peças pontuais): `generator=search&gsrnamespace=6&prop=imageinfo&iiprop=url|size|extmetadata&iiextmetadatafilter=LicenseShortName|Artist&iiurlwidth=3000` (via `ctx_execute`/python, UA identificado). Salve em `~/Developer/design-master-assets/<kit>-raws/` com `provenance.json` (título, autor, licença, url, sha256) e olhe cada imagem.

## Créditos
Todo derivado: entrada em `credits.json` (`file, source_record, title, author, license, license_url, source_url, derivative`). Créditos aparecem na landing. Gerado: "Generated with <model> via Codex CLI, <data>" + prompt versionado.

## Verificação e entrega
Armadilhas: `app.html` aberto sozinho mostra mojibake (sem charset/includes) — olhe sempre o `index.html` gerado. Tema escuro do landing é classe `.dark` (não `prefers-color-scheme`): adicione a classe no screenshot. Imagens `loading=lazy` só aparecem no fullPage se o script rolar a página antes.
Light/dark × 1440/390/360, posições de ponteiro, foco, 0 erros de console, geradores idempotentes, `file://` ok. Benchmark contra PNG de referência (1672×941) até 4 rodadas. Olhe os screenshots antes de mostrar. Revisão = Artifact privado (screenshots não são commitados). Safari quem checa é André. Push/PR/`status: complete` só com aval dele.
