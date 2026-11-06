---
name: motion-code
description: >-
  A ÚNICA skill de motion design. Use SEMPRE para qualquer motion design, vídeo/reel animado, animação,
  Reels/Shorts/carrossel/post de vídeo DZiny, vídeo por código, motion graphics, transição, easing, scroll
  animation, parallax, hover/loading, GSAP, Framer/Motion, Remotion, Manim, Lottie/Rive, SVG/Canvas/PixiJS,
  Three.js/R3F/WebGL/shaders, partículas, sprites, rig, walk cycle, bola quicando/quique/bounce, tipografia/cor/composição
  animada, círculo cromático/obras de arte como exemplo — mesmo que a palavra "animação" nunca apareça.
  Plan, code, verify and render animation with code: UI motion (CSS/WAAPI, GSAP, Motion), SVG/Canvas/Pixi,
  Three.js/R3F 3D, frame-exact video (Playwright+ffmpeg, Remotion, Manim). Ships principle→parameter recipes,
  absorbed craft (typography, color, composition, 3D, web perf/a11y) and a one-command capture that returns
  contact sheet, onion skin and numeric motion lint. Inclui a REGRA FIXA DO FINAL de todo vídeo
  ("Curta, comenta e compartilha." + ícones Instagram) e o padrão de reels narrados (Fish Audio, legendas sincronizadas).
---

# Motion Code

Goal: motion that reads right in one or two passes, proven by evidence, at low token cost.

## Rules that prevent most rework

1. **Motion = f(t).** Every animated value is a pure function of time, or lives on a paused timeline you `seek`. Scrubbing, rendering, tests and lint all depend on this. Integrate per frame only when live interaction demands it (then fixed timestep + seeded RNG).
2. **Numbers before code.** Write key times and values per channel first (contacts, apexes, holds, durations, easing). Two lines for a micro-interaction; a beat table for a sequence.
3. **Separate channels.** x, y, rotation, scale, opacity each get their own curve. A bounce's y is ballistic while its x drifts linearly — one shared easing is the #1 cause of "robotic".
4. **Easing comes from cause, not taste.** Gravity → quadratic (`power2.in` falling, `power2.out` rising). Constant motor/spin/scroll-scrub → linear. UI enter → ease-out; exit → ease-in; move on screen → ease-in-out. Overshoot only when something has momentum or elasticity.
5. **One engine per property.** CSS transition + GSAP + a rAF loop on the same `transform` fight each other. Pick one owner.
6. **Evidence, not code reading.** Run `scripts/capture.mjs`; read the lint text first, then `onion.png`/`sheet.png` (one image each). A build that compiles proves nothing about motion.
7. **Runtime uses elapsed/delta time** (never assume 60 fps); video uses frame index → `t = i / fps`.
8. **Accessibility + lifecycle are part of done.** `prefers-reduced-motion`: keep the state change, drop travel/parallax/loops. Kill timelines, cancel rAF, remove listeners/observers, dispose GPU resources on unmount.

## REGRAS DO ANDRÉ PARA REELS/CARROSSÉIS DZINY (prioridade máxima — valem sobre qualquer lição abaixo que as contrarie)

- **Proibido contador ou indicador de progresso:** nada de "1/5", "0/4→4/4", escadinha/degraus/barra de progresso, "já vimos X", "os 7 primeiros", "degrau N". Mesmo ao listar itens, não numere na tela nem na fala. Onde lições antigas abaixo falam em contador/escada/degraus/pílula colorida/cor por termo/slider de valor/selo ×2, ignore: foram revogadas.
- **Mostrar de verdade:** cada ferramenta/conceito = PROBLEMA acontecendo visualmente (✗) → SOLUÇÃO resolvendo (✓) → rótulo do termo. Corte firula decorativa (washes, brilhos, anéis, mascotes) que não explica nada.
- **Visual neutro:** fundo #000, título e legenda SEMPRE #FFF; destaque da palavra falada só por peso/opacidade (nunca cor, nem pílula colorida). Cor só em ✗ (vermelho) e ✓ (verde) e só onde cria foco; resto cinza/branco. Na dúvida, cinza.
- **Série em partes:** sem numerar partes na tela; gancho de confronto (não de contagem). O FINAL é sempre a REGRA FIXA DO FINAL ("Curta, comenta e compartilha." + ícones): nada de "segue pra próxima parte", cadeado ou "???".
- **Entrega extra:** pasta `carrossel/` ao lado do MP4 com PNGs 1080×1350 (4:5), 6–10 slides (capa-gancho, problema→solução, CTA), mesma regra neutra, balões sem texto, fontes em `projeto/carrossel-src/` (HTML/SVG + `build.mjs` com Playwright do `scripts/node_modules`). Slide sem numeração/"2/10".

## Padrão de qualidade (post 17)

André aprovou o post 17 ("sensacional"): todo post novo deve igualar ou superar. Evidência: `~/DZiny-pipeline/post17/` (STORYBOARD.md, RESEARCH.md, claude-*.log) e `Posts design/17-iconografia-…/projeto` (`src/`, `tools/`, `carrossel-src/build.mjs`, `artifacts/`).

- **Antes → transformação → depois, visível:** o elemento ruim (ícones feios) é mostrado primeiro e SE TRANSFORMA no bom, animado diante dos olhos. Nunca corte seco entre erro e acerto; o espectador ama ver a correção acontecendo.
- **Ativos reais, defeito = parâmetro:** use biblioteca real (Lucide, ISC, grid 24, stroke uniforme; `tools/mklucide.mjs` gera `src/lucide.js` + licença em `assets/licenses/`). O defeito é só um parâmetro do MESMO ícone (traço fino, preenchido, escala, deslocamento), nunca desenho à mão diferente; assim a transformação é contínua e mensurável.
- **Carrossel:** cada slide mostra o problema ANTES da solução, desenhado em HTML/SVG (não recortes do vídeo). Marca dos posts 16/18: fundo #000, Bricolage Grotesque 800 condensado caixa alta branco, cor só ✗ vermelho/✓ verde, sem contador/escada/rodapé. 8 slides via `carrossel-src/build.mjs` (Playwright) + `contact.html`.
- **Processo:** Codex (esforço médio) pesquisa e escreve `RESEARCH.md` + `STORYBOARD.md` primeiro; Claude implementa. Carrossel e vídeo em sessões/subagentes paralelos. Voz Fish e builds em primeiro plano (headless mata background).
- **SFX:** um por evento visual (post 17: ~147 cues) + música baixa.
- **Crítica em contact sheets:** carrossel 4 rodadas, vídeo 2 (`artifacts/*-contact-r*.png`); corrigir sobreposição, borrão, texto quebrado a cada rodada.
- **Specs que o `check.mjs` deve confirmar:** duração = quadros/30 (post 17: 49,5 s), 1486/1486 quadros, 1080×1920, pico −5,2 dBFS; `syncverify` (whisper base, medium estoura) mediana ≈ 0,016 s, p90 ≈ 0,05 s. Pendência conhecida: alvo ~60 s, voz Fish saiu rápida; planeje texto/pausas para chegar perto.

## Regras do André (feedback post 18)
Valem para TODOS os posts (feedback do vídeo 18 v2).
1. **Final fixo:** o vídeo termina SÓ com o CTA "Curta, comenta e compartilha." — mesmo texto e mesma tela em todo post. Nada de "segue pra próxima parte", "teste no seu perfil" ou variações.
2. **Paleta calma e sóbria:** fundo preto, branco e cinzas; cor só em ✗ vermelho / ✓ verde e, quando for o próprio assunto (ex.: luz indireta), no detalhe em foco. Sem carnaval de cores, sem cor por termo/passo. Única exceção fixa: retângulo violeta `#7250A1` atrás da palavra falada na legenda karaokê.
3. **Mockups detalhados e realistas:** site com navbar, hero, botões, texto; sacola com alças, dobras, sombra, etiqueta; app com status bar, cards, tab bar, ícones Lucide. Nunca retângulos/formas genéricas.
4. **Ritmo:** explicar com calma sem ficar lento — frases completas, pausas curtas, ~130-150 palavras em ~60-70 s.
5. **Proibido** o molde repetitivo "você fez X, mas ainda falta Y / mas aí... então...". Varie o estilo de explicação entre vídeos.
6. ~~Estrutura numerada~~ **REVOGADA** pela regra "proibido contador": gancho de confronto, sem anunciar "N passos" nem "Passo 1/2…" na fala ou na tela; cada ideia entra pelo problema visível.
7. **Cada passo completo antes do próximo:** PROBLEMA (visto na tela) → SOLUÇÃO (transformação animada acontecendo) → COMO FUNCIONA PARA O USUÁRIO FINAL (porquê/benefício). Nunca pular sem explicar o porquê.
8. **Padrão post 17:** antes → transformação na tela → depois. Sem quadros vazios/gaps (ex.: 0,4 s de tela vazia antes do CTA).

## REGRA FIXA DO FINAL (todos os vídeos — prioridade máxima, sem exceção)

O vídeo termina **SOZINHO** com **"Curta, comenta e compartilha."** acompanhado dos ícones correspondentes do Instagram, cada um junto da palavra correspondente. **Nada além disso no final** (sem recap sobreposto, sem cadeado/"???", sem "segue pra próxima parte", sem "PARTE 2", sem marca/URL, sem balão ou legenda extra).

| Palavra | Ícone (estilo Instagram) | Estado visual |
|---|---|---|
| CURTA | coração | **VERMELHO PREENCHIDO** `#FF3040` — estado curtido/apertado |
| COMENTA | balão de comentário | **SEM preenchimento**, só contorno branco (ainda clicável) |
| COMPARTILHA | avião de papel | **SEM preenchimento**, só contorno branco (ainda clicável) |

- Fundo `#000`, palavras brancas (800 condensado caixa alta), ícones e palavra aparecem na ordem falada; sem brilho/glow/neon. O coração pode "apertar" (pop + preencher) assim que a palavra "curta" é dita; balão e avião só entram.
- Mesma fala TTS e mesma tela em todo post; não varie o texto. Tela do CTA sem quadros vazios (sem gap antes dela).
- Implementação de referência pronta: `templates/narrated-reel/src/scene.js` (`drawEnding`, `igHeart`/`igComment`/`igShare`) + `K.ctaLike/ctaComment/ctaShare` em `plan.js`. Em Remotion/HTML/outros motores, copie a mesma geometria e estados.
- Verifique com `capture.mjs --times <último 1 s>`: só 3 ícones + 3 palavras visíveis, coração vermelho preenchido, outros dois só contorno.
- Esta regra **revoga** lições antigas de CTA com loop aberto/lacrada (ver `references/post-lessons.md`).

## Skills absorvidas (esta é a única skill de motion — não carregue as outras para motion)

| Conhecimento | Onde está aqui | Veio de |
|---|---|---|
| Princípios, easing, timing, física, receitas | `principles.md`, `patterns.md` | (original) |
| Three.js: mixer/clips, rigs de câmera, luz/sombra, PBR, shaders animados, pós-processamento, texturas/colorSpace, R3F, perf/dispose, glTF | `references/threejs.md` | threejs-animation, -fundamentals, -geometry, -interaction, -lighting, -materials, -shaders, -postprocessing, -textures, -react-three-fiber, -performance, -loaders, -asset-pipeline |
| Direção estética, tipografia, cor/contraste, composição, safe areas Reels, tokens/DESIGN.md, anti-"AI slop", prompts generativos | `references/design-craft.md` | frontend-design, frontend-skill, canvas-design, theme-factory, brand-guidelines, design-md, apple-ai-chat-design, criar-site-arte, sora, enhance-prompt, site-veterinaria (generative-ui: nada aplicável a vídeo) |
| Web: custo de render, scroll-driven, View Transitions, `linear()`, top layer, a11y/reduced-motion, padrões Radix/shadcn, loop de jogo, verificação Playwright, comparação Apple/Material | `references/web-craft.md` | modern-web-guidance, web-design-guidelines, shadcn-ui, web-components, develop-web-game, playwright, webapp-testing, screenshot, chrome-extensions, guias Apple/Android HIG, macos-patterns |
| Log de lições dos posts já entregues | `references/post-lessons.md` | histórico DZiny (posts 17–30) |

Quando as skills de origem sugerirem paleta ousada, gradientes ou neon, valem as REGRAS DO ANDRÉ (visual neutro) — use cor só quando o assunto do vídeo pedir.

## Regras rápidas de craft (resumo; detalhes nas referências)

- **Tipografia:** hierarquia clara (1 título, 1 apoio, legenda), mínimo legível em 1080×1920 ≈ 44 px corpo / 90+ px título; ênfase por peso/opacidade; fonte variável só com eixos verificados (canvas 2D não anima eixos: pré-renderize SVG). → `design-craft.md`
- **Cor:** neutros + no máx. 1 acento; papéis semânticos; contraste medido por código (WCAG 4,5:1 texto, 3:1 título/gráficos), nunca só cor para erro/sucesso (✗/✓). → `design-craft.md`
- **Composição:** um foco por vez, respiro generoso, safe areas de Reels/Shorts (topo ~220 px, base ~400 px, lado direito ~150 px — convenção aproximada), ordem de leitura previsível. → `design-craft.md`
- **Motion como design:** reveal escalonado 30–60 ms, contraste de velocidade (rápido entra, lento assenta), um gesto de assinatura por cena, cada evento visual com um som. → `principles.md` + `patterns.md`
- **3D:** tempo absoluto determinístico (`setTime(t)`/`Timer`, nunca `Clock` acumulado em render de vídeo), `colorSpace`/tone mapping corretos, `dispose()` de tudo, instancing para repetição, `renderer.info` para medir. → `threejs.md`
- **Web:** só `transform`/`opacity`/`filter`; sem `transition: all`; `prefers-reduced-motion` mantém o estado final; scroll-driven/View Transitions com fallback. → `web-craft.md`
- **Render de vídeo:** quadro = `t = i / fps`, seek puro, 1080×1920 30 fps, pico de áudio ≈ −5 dBFS, `check.mjs` + `syncverify`. → `video-render.md`
- **Checklist de qualidade final:** `design-craft.md` (12 itens visuais) + "Done means" abaixo.

## Route — read only what the task needs

| Task | Read | Usual engine |
|---|---|---|
| Feel/weight/character/physics, "looks off", style presets | `references/principles.md` | — |
| Concrete recipe (bounce, arc, roll, spring, pendulum, overlap, walk/run/jump, idle, leaf, shake, particles, stagger, loop, kinetic type, UI patterns) | `references/patterns.md` (grep the `##` heading) | — |
| DOM/SVG/UI, scroll, page transitions, React motion, Lottie/Rive | `references/web-runtime.md` | CSS/WAAPI → GSAP → Motion |
| Canvas, sprite sheets, pixel art, PixiJS/Phaser, 2D rigs, SVG morph | `references/2d.md` | Canvas/PixiJS |
| Three.js/R3F scenes, cameras, clips, rigs, morph targets, glTF | `references/3d.md` | Three.js / R3F |
| MP4/GIF output, frame-exact render, Remotion, Manim, audio sync | `references/video-render.md` | seekable page + capture `--video` |
| Narrated educational Reel/Short (TTS voice, word-synced captions, diagram + real artwork examples, CTA) | `references/narrated-reel.md` + `templates/narrated-reel/` | template (canvas f(t) + Fish TTS + whisper) |
| Three.js/R3F depth: mixer, camera rigs, lights/shadows, shaders, postprocessing, perf/dispose | `references/threejs.md` (after `3d.md`) | Three.js / R3F |
| Look & feel: typography, color, composition, safe areas, tokens, anti-slop, quality checklist | `references/design-craft.md` | — |
| Web perf/a11y details: scroll-driven, View Transitions, `linear()`, top layer, Radix/shadcn, game loop, Playwright checks | `references/web-craft.md` | CSS/WAAPI |
| Verifying, fixing by symptom, perf, a11y, determinism tests | `references/qa.md` | — |
| Past reels: render/sync gotchas per post | `references/post-lessons.md` | — |
| ANY video ending | **REGRA FIXA DO FINAL** (section above) | — |

UI micro-interactions covered by the defaults table below need no reference at all.

## Workflow

1. **Discover** — `package.json` deps (gsap, motion/framer-motion, three, @react-three/fiber, pixi.js, lottie/dotlottie, @rive-app, remotion), existing animation code, run/dev command. Reuse what is installed; add a dependency only when the native platform cannot do it cleanly.
2. **Brief** — subject · trigger · intent/personality · duration · loop? · reduced-motion fallback. Ask only if a choice changes the build (e.g. video file vs live page).
3. **Plan keys** — times + values per channel; pick easing per channel by rule 4.
4. **Build as f(t)** — and expose a dev seek/probe hook so it can be measured: `window.__seek = t => tl.seek(t)`, `window.__probe = () => ({ y: ball.position.y })`.
5. **Probe, proportional to risk** — physics, character, sequences, loops, "looks off" fixes: `capture.mjs` before and after → lint → onion/sheet; fix by symptom (`references/qa.md`), max ~3 loops. A UI micro-interaction in a project you cannot run (no `node_modules`/dev server): review the code against the defaults table and say it was not run — don't build a CDN harness just to measure a 200 ms fade.
6. **Deliver** — files changed, run command, what was verified (quote lint lines / frames inspected), known limits.

## capture.mjs — one command, compact evidence

```bash
C=~/.claude/skills/motion-code/scripts/capture.mjs
# any page, unmodified (fake clock drives rAF/timers; CSS/WAAPI timeline frozen and stepped)
node $C http://localhost:5173 --to 1.2 --frames 8 --track '.ball' --onion
# interaction-triggered
node $C index.html --before "document.querySelector('#save').click()" --to .6 --track '#save'
node $C index.html --hover '.card' --to .3 --track '.card'
# seekable scene / canvas / WebGL (probe exposes non-DOM values)
node $C dist --seek "window.__reel.seek(t)" --ready "window.__reel.ready" --from 4 --to 10 --probe "window.__probe()" --onion
# frame-exact MP4 (no stills)
node $C dist --seek "window.__reel.seek(t)" --to 60 --frames 0 --video out/reel.mp4 --fps 24 --viewport 1920x1080
```

- Accepts URL, `.html` file or directory (served over local http; a local path keeps its query, e.g. `"index.html?captions=0"` for a variant). `--help` lists all flags (`--times`, `--loop`, `--clip`, `--viewport`, `--reduced-motion`, `--driver realtime`).
- Writes to `./motion-capture/` (`--out`): `lint.txt`, `onion.png`, `sheet.png`, `frames/t*.png`, `track.json`.
- Lint reports per channel: range, peak speed, easing per segment, pops (one-frame jumps), settle time, overshoot %, bounce restitution + implied-gravity consistency, loop seam gap.
- Token cost: lint ≈ 200 tokens · onion/sheet ≈ 1–3k · each full frame ≈ 1.2k+. Read in that order; open a single frame only to inspect a specific moment.
- `--probe` is required for canvas/WebGL objects (DOM tracking cannot see inside a canvas).
- `--ready` takes a promise (`"window.app.ready"`) or a condition polled until true (`"window.__ready"`). Timers in `--before` run on the fake clock (`setTimeout(() => close(), 600)` fires at t=0.6).
- Playwright and ffmpeg resolve from the project, else from the skill's own pinned install; a Playwright whose browser is missing is skipped automatically. Never build browser shims — if it still fails, `npm i --prefix ~/.claude/skills/motion-code/scripts` or set `CHROME_PATH`.

## UI defaults (use directly, adjust to brand)

| Interaction | Duration | Easing |
|---|---|---|
| Press / hover feedback | 80–150 ms | ease-out; press scale 0.96–0.98 |
| Small enter (tooltip, toast, menu) | 150–250 ms | `cubic-bezier(.2,0,0,1)` / `power2.out` |
| Exit | ~70% of enter | `cubic-bezier(.4,0,1,1)` / `power2.in` |
| Modal, drawer, sheet | 250–400 ms | ease-out, or spring ζ≈0.8 |
| Large move / shared layout / page | 300–500 ms | ease-in-out `power2.inOut` |
| Stagger | 30–60 ms per item, whole cascade ≤ 400–500 ms | same as item |
| Overshoot | UI ≤ 5–10 %, playful 10–20 %, cartoon 20–40 % | `back.out(1.2–2)` or spring |
| Continuous spin / progress / marquee | period by speed | linear |

Mobile: ~20–30 % shorter. Bigger travel takes longer but sublinearly. Animate `transform`/`opacity` (and `filter`, `clip-path` sparingly), not `top/left/width/height`.

## Done means

- Lint shows no unexplained ⚠ and the onion shows the intended arcs/spacing.
- `--reduced-motion` capture still reaches the correct final state with nothing hidden.
- Capture reports no page errors; cleanup paths exist in code.
- Report says what was measured, not "should look good".
- Reel sync gate: `scripts/syncverify.sh` (whisper medium) can exceed 10 min and get killed; fall back to `whisper --model base` under `timeout 100` with ffmpeg-static in PATH. Judge by median/p90 (base: ≤0.15 s median, 127/142 words matched), never the max.
- No Gemini review file = no review: validate Codex notes with `tools/check.mjs` (duration = frames/30, 1080x1920, peak −5.2 dBFS), syncverify and frames; if MP4 is newer than src/, timing.json, mix.mjs and nothing real found, do not re-render.
- Never `sleep N` + cat for a long job: start it with run_in_background and one `until [ -s out ]` watcher; do not stack extra watchers.
- Iconografia (17, versão com escada 0/4→4/4 e cor por passo REVOGADA): pôster de ícones com um defeito por passo (estilo misturado, traço fino/grosso, fora da grade, tamanho pequeno ilegível) segue ERRO → CORREÇÃO → rótulo. Meça o que mostra: espessura de traço, área ocupada (círculo vs quadrado) e grade vêm de números calculados no plan.js, nunca chutados; ajuste óptico não afirma igualdade geométrica. Valores (2 px, 24 px, grade 24) são exemplos ilustrativos, nunca regra universal.

## Experience reflector — explainable UI transformation reels

Use after a verified motion-design task where narration describes sequential interface corrections:

- Keep a single owner for the virtual camera/device transform and a separate owner for the flat UI layer. On a focus zoom, move the complete device body forward with subtle perspective; keep the screen content front-facing and legible. Never zoom the UI inside the device (viewers read it as the screen resizing). Fake body depth with a few silhouette slices scaled toward a vanishing point (`back = VP + k·(front − VP)`), so a side wall shows only off-centre and the screen never distorts.
- Device pop-in: scale from ~0.12 with a damped spring (f ≈ 2.2 Hz, ζ ≈ 0.62 → ~7 % overshoot, settled ≈ 0.5 s); derive squash & stretch from the scale's speed (taller while growing, wider on the rebound).
- Bind each narration segment to one explicit property and correction. Gate the next correction until the current spoken cue and corresponding visual change have completed. Generate word/letter-reveal captions from the same timing map, with caption styling isolated as an editable layer.
- Stage focus callouts as a lifecycle: draw on, run a low-intensity perimeter light pass while active, then draw off. Clip the callout to the device screen and check that it does not cross device edges or unrelated UI.
- For dimensional edits, draw every measuring line in ONE colour — white/black on the art (André's neutral rule; saturated cyan/blue guide colours were revoked). Only the faulty gap/edge gets red. Whenever something grows or shrinks, show both numbers: the width over the element and the height beside it, each in a tag joined to the element's edges by dotted lines with perpendicular end ticks (when an edge is shorter than the tag, put the tag just outside the line). Animate the numbers and measured bounds from the same pure time-based value.
- Size changes should use a damped overshoot/squash sequence with a short rebound before settling, rather than a linear scale tween. Keep the measured edge and numeric readout synchronized.
- Give every meaningful action a sound cue, but maintain a clear mix hierarchy. A practical starting point is narration peaks near -6 dBFS, Ratchet Click peaks near -12 dBFS (about half the voice amplitude), motion/transition effects near -15.5 dBFS (about one third of voice amplitude), and music well below speech. Apply a final true-peak limiter and check the encoded mix (per-cue levels, bus limiters and mono-voice upmix: `references/video-render.md`).
- For full mobile dashboard mockups, render the whole device at device scale and inspect all safe areas, section gaps, transaction rows, and bottom navigation. Include explicit UTF-8 metadata in HTML wrappers used for SVG captures; otherwise accented Portuguese text can render as mojibake.

Only retain these patterns when the render and audio review confirm they improve clarity. Put reusable procedures here; keep project-specific copy, voice IDs, API credentials, and data in project files or secure environment inputs, never in this skill.

### Sequential problem → focus → correction choreography

For narrated design critiques, subdivide each beat into timed phases: state the visible problem; pulse a red fill over the exact faulty region twice at 30–40% opacity (saturated, e.g. `#ff2a2a` with a stronger stroke — low saturation was too faint); fade the highlight; name the relevant principle and animate only its matching correction; finish with a soft confirmation cue and one small spring settle. Do not animate the fix before the flaw is identified. Avoid repeatedly circling the area when a brief fill communicates the fault more clearly.

For layout changes, move the element toward its target quickly, allow one small recoil at the end, then settle. Avoid sustained oscillation. For focus callouts, animate entry, keep a restrained light sweep along the perimeter while active, and animate exit. For app-wide corrections, highlight and update the whole selected screen rather than a single subcomponent.

When teaching hierarchy, use paired examples: enlarge an essential item that is too small and reduce a secondary heading that is too large. Keep balance distinct from spacing by adjusting relative visual weight among peer controls. Introduce chromatic relationships before contrast when that sequence helps: first standardize semantic color roles, then correct text/icon legibility across the full selected interface.

Ratchet Click loops should be faster, with short repeated cycles and crossfades to cover the dimensional change. Reduce zoom swooshes to a soft, low-level cue. End a three-part CTA with the corresponding icons and labels appearing in spoken order after the example devices have exited the frame. Keep the CTA icons in their platform-native look (filled red like-heart, white comment/share outlines, no glow); neon variants of the social icons were rejected as off-platform. A Z-reading guide is one clean diagonal between two horizontal strokes, not a zigzag path.

Build notes that held up on render:
- Narrate problem and principle as two TTS clips per beat, placed with a fixed gap that the red highlight occupies (start it ~0.15 s before the problem clip ends: 0.4 s pulse + 0.25 s fade). Pack beats by need (`lead + problem + gap + principle + tail`) and share the spare time equally; even out long/short beats with per-line TTS speed instead of `atempo`. Starting the correction on the name word (not after it) buys ~0.5 s per beat.
- Endpoints come from the approved screens; intermediate states are free. When the brief asks for a change the endpoints do not contain (e.g. "enlarge X" but X ends smaller), route it through an intermediate value owned by an earlier principle and let the later one land on the approved value — report it as a decision.
- Whole-screen corrections as one pure channel: a wipe front `w` and per-element progress `clamp((1.25·w − y/H)/0.25)`, plus a scan line at the front, so the change visibly crosses the entire selected screen.
- Short scroll inside a device mockup: translate a content group (bg, status bar and nav stay fixed) and fade in a status-bar strip in the background colour above it; overlays drawn outside the group subtract the scroll offset.
- Captions: keep the whole phrase visible (upcoming words dimmed) and mark the spoken word by opacity/weight only (white text; no accent colour, no coloured pill — André's neutral rule). Break sentences longer than ~8 words before a conjunction so a phrase never needs more than two lines.
- Camera on a device mockup: zoom about the frame centre only — a sideways pan reads as the phone drifting off. Cap each zoom so the inspected region stays clear of the title/caption zones: `y_frame = cy + z·(y_rest − cy)`; end by dropping the device straight out of frame.
- Rebuilding an approved HTML screen in SVG: unpack bundled fonts from `document.styleSheets` (`CSSFontFaceRule` → `fetch(blob)` → woff2, keep the OFL notice), take boxes with `getBoundingClientRect`, and baselines with a zero-size `inline-block` marker inserted before each text node — except where the text is a direct child of a flex container (the marker becomes a flex item): compute those from the centred line box. Diff the endpoint against the HTML at 3× by region (page vs fixed bars).
- A page taller than the phone keeps a real viewport: iOS status bar on top (time, cellular bars, Wi-Fi wedges, battery at iPhone metrics, never animated), page offset under it, tab bar + home indicator fixed, the rest below the fold; principles act on what is visible and Movimento's scroll reveals the rest.
- Determinism failures: compare the scene DOM (`innerHTML`) of the two seek paths before hunting state leaks — identical DOM with different pixels is compositor timing, not impure scene code.
- Gate with a per-beat sync report (highlight after problem start and gone before the principle line; correction after the highlight; correction + confirmation inside the slot; every change SFX inside its own correction window).
- Reordering whole groups (composition): give each group `y = lerp(wrongY, stackSlot, k)`, where the stack is computed from the live heights (owned by later principles) and gaps (owned by rhythm), so the stack equals the approved screen exactly when every channel is 1. Groups cross while travelling: draw the longest trip on top, use a small absolute overshoot (≈2 % of a 500 pt trip, not 6 %), and exempt only that window from the overlap probe; take the probe baseline from both approved screens.
- Palette before contrast: let the palette beat land secondary text/icons on a washed tone (`mix(final, background, 0.55)`) and the contrast wipe take them to the final colour — both beats then show a change across the whole screen without touching each other's property.
- When the generator of the approved screens is unreadable, rebuild them from the PNGs: crop 3× bands with a 10 pt grid, bound elements with a background-distance scan, and infer font sizes from summed glyph advances (cap heights read ~0.5 pt high). A mean difference ≤ ~4/255 per endpoint is visually identical at reel scale.

### Highlight overlays and atomic design-principle edits

When a design-principle reel uses an explicit red problem highlight, do not add a second selection rectangle or perimeter light sweep around the same region. Let the translucent filled highlight identify the target. For grid teaching, keep both vertical and horizontal guides visible until the elements finish aligning; fade the complete grid only after alignment is readable.

Keep a paired before/after interface identical in content and visual identity except for the deliberately demonstrated design defects. For composition defects, change group order and place related controls/profile/notifications in incorrect screen regions; do not alter content semantics. To teach balance among peer shortcuts, vary icon visual weight while preserving each icon's color and the group's layout. Apply color only during chromatic-relationship or contrast beats; make a palette correction consistently across the whole selected interface, then treat text/icon contrast as its own subsequent full-interface pass.

Teach texture/materiality as a surface treatment independent of palette: keep the established colors and reveal a restrained gradient/material surface with a vertical before/after wipe. Center a CTA group after all example devices have exited the frame.

### Narrated explainer reels (approved format)

Educational 9:16 reel with a voice-driven timeline, one persistent diagram, a real-artwork example per concept and a CTA: copy `templates/narrated-reel/` and follow `references/narrated-reel.md` (pipeline, layout tokens, artwork evidence, persistent geometry, verification). Lessons from new reels of this kind go into that reference, not here.

### Lições por post (índice)

O log detalhado de render/sync/armadilhas de cada reel entregue (Kerning, Pantone, Microinterações, Liquid Glass, Halloween, Tipografias, Dia a dia do designer, Datas comemorativas, Hierarquia visual, Contraste/alinhamento, Grid, Espaço em branco, Teoria das cores, Paleta, Tipografia por categoria, Legibilidade, Iconografia, Identidade visual, UX×UI, Wireframe, Estados de interface, Design system, Botão claro, Formulários/login, Luz e materiais 3D, Low poly) foi movido, sem perda, para **`references/post-lessons.md`** (grep pelo título). Regras gerais que sobreviveram a todos os redos: recap `✗ problema → ✓ TERMO` sem numeração, ✗/✓ no mesmo canto, título do termo branco, voz Fish em cache quando o texto não muda (`retime` → `shift` → `seekall` → `build`), validar com `check.mjs` + `syncverify.sh` (base) + folha de contato, MP4 mais novo que src/timing/mix → não re-renderiza, `timing.json` manda na duração. A CTA de todos os posts agora é a REGRA FIXA DO FINAL.

### Lição post 32 (render tempo real × pré-calculado)
- `desat()` cinzeia `rgba(255,42,42,.6)`: use hex `#FF2A2A` + `globalAlpha`; cor quente só com `withSat(1)` onde é o assunto.
- Painel de um bloco vaza para o seguinte: feche no `mas` do próximo bloco; confira folha de contato nos tempos de transição.
- Projeto herdado sem cena: reaproveite voz Fish em cache; só sintetize linhas com texto novo. Orçamento/limite = faixa fixa com excesso vermelho, nunca barra de progresso.
