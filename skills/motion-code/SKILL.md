---
name: motion-code
description: >-
  Plan, code, verify and render animation with code — UI motion (CSS/WAAPI, GSAP, Motion/Framer),
  SVG/Canvas/PixiJS/sprites, Three.js/R3F 3D, and frame-exact video (Playwright+ffmpeg, Remotion, Manim).
  Ships principle→parameter recipes (bouncing ball, arcs, squash & stretch, overlap, springs, walk cycles,
  camera moves, particles) and a one-command capture that returns a contact sheet, onion skin and numeric
  motion lint instead of piles of screenshots. Use whenever the user wants anything on screen to move or asks
  why motion looks off: animação, animar, anime, motion, transição, easing, bounce, quique, bola quicando,
  walk cycle, sprite, rig, partículas, scroll animation, parallax, hover effect, loading spinner, GSAP,
  Three.js, R3F, PixiJS, Lottie, Rive, motion graphics, vídeo por código, render MP4, Reels/Shorts
  educativos narrados (Fish Audio, legendas sincronizadas, círculo cromático, obras de arte como exemplo) — even
  if the word "animation" never appears.
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

- **Proibido contador ou indicador de progresso:** nada de "1/5", "0/4→4/4", escadinha/degraus/barra de progresso, "já vimos X", "os 7 primeiros", "degrau N". Mesmo ao listar itens, não numere na tela nem na fala. Onde lições antigas abaixo falam em contador/escada/degraus, ignore: foram revogadas.
- **Mostrar de verdade:** cada ferramenta/conceito = PROBLEMA acontecendo visualmente (✗) → SOLUÇÃO resolvendo (✓) → rótulo do termo. Corte firula decorativa (washes, brilhos, anéis, mascotes) que não explica nada.
- **Visual neutro:** fundo #000, título e legenda SEMPRE #FFF; destaque da palavra falada só por peso/opacidade (nunca cor, nem pílula colorida). Cor só em ✗ (vermelho) e ✓ (verde) e só onde cria foco; resto cinza/branco. Na dúvida, cinza.
- **Série em partes:** sem numerar partes na tela; gancho de confronto (não de contagem) e CTA com loop aberto ("segue pra próxima parte").
- **Entrega extra:** pasta `carrossel/` ao lado do MP4 com PNGs 1080×1350 (4:5), 6–10 slides (capa-gancho, problema→solução, CTA), mesma regra neutra, balões sem texto, fontes em `projeto/carrossel-src/` (HTML/SVG + `build.mjs` com Playwright do `scripts/node_modules`). Slide sem numeração/"2/10".

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
| Verifying, fixing by symptom, perf, a11y, determinism tests | `references/qa.md` | — |

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
- Iconografia (17): pôster de ícones com um defeito por passo (estilo misturado, traço fino/grosso, fora da grade, tamanho pequeno ilegível) segue ERRO → CORREÇÃO → rótulo. Meça o que mostra: espessura de traço, área ocupada (círculo vs quadrado) e grade vêm de números calculados no plan.js, nunca chutados; ajuste óptico não afirma igualdade geométrica. Valores (2 px, 24 px, grade 24) são exemplos ilustrativos, nunca regra universal.

## Experience reflector — explainable UI transformation reels

Use after a verified motion-design task where narration describes sequential interface corrections:

- Keep a single owner for the virtual camera/device transform and a separate owner for the flat UI layer. On a focus zoom, move the complete device body forward with subtle perspective; keep the screen content front-facing and legible. Never zoom the UI inside the device (viewers read it as the screen resizing). Fake body depth with a few silhouette slices scaled toward a vanishing point (`back = VP + k·(front − VP)`), so a side wall shows only off-centre and the screen never distorts.
- Device pop-in: scale from ~0.12 with a damped spring (f ≈ 2.2 Hz, ζ ≈ 0.62 → ~7 % overshoot, settled ≈ 0.5 s); derive squash & stretch from the scale's speed (taller while growing, wider on the rebound).
- Bind each narration segment to one explicit property and correction. Gate the next correction until the current spoken cue and corresponding visual change have completed. Generate word/letter-reveal captions from the same timing map, with caption styling isolated as an editable layer.
- Stage focus callouts as a lifecycle: draw on, run a low-intensity perimeter light pass while active, then draw off. Clip the callout to the device screen and check that it does not cross device edges or unrelated UI.
- For dimensional edits, use one saturated guide colour for every measuring line (low-saturation blue/red read as too faint on a phone at reel scale; a saturated red tested clearer). Whenever something grows or shrinks, show both numbers: the width over the element and the height beside it, each in a tag joined to the element's edges by dotted lines with perpendicular end ticks (when an edge is shorter than the tag, put the tag just outside the line). Animate the numbers and measured bounds from the same pure time-based value.
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

**Review gate (lição Halloween, 2026-11-02):** `revisao-gemini.md` ausente = sem revisão; valide o Codex com `tools/check.mjs` + `scripts/syncverify.sh` (padrão whisper `base`, aceita mediana < 0,15 s) + frames. Compare mtime do MP4 com src/timing/mix: MP4 mais novo e sem achado real = não re-renderiza. Duração vem do `timing.json`, não do roteiro.

**Tipografia / eixos variáveis (lição Tipografias, 2026-11-02):** canvas 2D não anima eixos de fonte variável (SOFT, wdth, opsz). Pré-renderize quadros SVG com a fonte em base64 (`@font-face` data-URI) numa imagem e cruze com alpha; a fonte só carrega no 2º render, então renderize 2× antes de capturar. Nunca passe raio negativo a `ctx.arc` (sstep + seno overshoot): use `Math.max(0, r)` — o build percorre todos os quadros e acusa. Letras faladas ("a", "g", "L") saem como fala fonética no TTS ("gê", "éle"): mapeie de volta na legenda e confira no whisper. Verifique os eixos reais do arquivo baixado antes de prometer animação; não afirme ganho de performance de fonte variável.

**Revisão pós-render (lição Dia a dia do designer, 2026-11-02):** `scripts/syncverify.sh` agora aceita caminho do MP4 de qualquer pasta (vira absoluto) e entra em `projeto/` sozinho se `tools/syncverify.mjs` não estiver no cwd; antes falhava com MODULE_NOT_FOUND. Rodar a partir do `projeto/` com MP4 em `../`. Gancho "contraste/confronto" (ex.: "designer desenha o dia inteiro?") + barra de tempo com contorno visível sobre #000 funciona; horários/quantidades do roteiro são exemplo, não regra — diga isso na fala ou na arte.

**Hierarquia visual (lição 2026-11-02):** sem `revisao-gemini.md` = sem revisão; Codex validado com `check.mjs` (42,44 s, 1273 quadros, pico −5,6 dBFS) + `syncverify.sh` base (142/159, mediana 0,088 s, p90 0,153 s) + grep de balões sem texto; MP4 mais novo que src/timing/mix → não re-renderiza. Duração real 42,4 s vs 51,1 s planejados (timing.json manda). Cartão persistente com 5 princípios (contraste, escala, agrupamento, espaço negativo, percurso em Z): mantenha UM foco por vez (ao aplicar a cor de destaque, o botão volta a neutro); exemplos numéricos ("título o dobro") e o Z são ilustrativos, nunca regra universal. 142 cues de SFX em ~42 s é OK se cada um nasce de um evento visual.

**Contraste/alinhamento/repetição/proximidade (lição 2026-11-02):** `rtk find -newer` falha em silêncio (saída vazia ≠ "nada mais novo"); compare mtimes com `stat -f '%Sm %N'`. Folheto persistente com 4 princípios (ERRO → CORREÇÃO → rótulo), duração real 50,1 s vs 60 s planejados (timing.json manda), syncverify base 143/154, mediana 0,107 s / p90 0,167 s — aceito; sem Gemini → check.mjs + syncverify + grep de balões sem texto; MP4 mais novo → não re-renderiza.

**Grid, colunas e composição (lição 2026-11-02):** sem `revisao-gemini.md` = sem revisão; Codex validado com `check.mjs` (48,2 s, 1446 quadros, pico −5,7 dBFS) + `syncverify.sh` base (149/157, mediana 0,103 s, p90 0,161 s) + grep de balões sem texto (vazio); MP4 (12:57) mais novo que src/timing/mix → não re-renderiza. Duração real 48,2 s vs ~60 s planejados (timing.json manda). `grep "bubble("` é reescrito pelo hook RTK para `rg` e falha com "unclosed group": use `grep -nF "bubble("` e filtre com um segundo grep. Medidas de colunas/margens/gutter na arte são exemplos ilustrativos, não regra universal.

**Espaço em branco e ritmo (lição 2026-11-02):** sem `revisao-gemini.md` = sem revisão; Codex validado com `check.mjs` (45,3 s, 1359 quadros, pico −5,3 dBFS) + `syncverify.sh` base (135/152, mediana 0,101 s, p90 0,166 s) + grep de balões sem texto; MP4 (13:16) mais novo que src/timing/mix → não re-renderiza. Ritmo visual pede SFX de bateria: `mix.mjs` ganhou tipos `kick`/`snare`/`hat` (batida no compasso do espaçamento; cada cue ainda nasce de um evento do plan.js). Números falados ("oito, dezesseis, trinta e dois") o whisper devolve como dígitos: as palavras ficam sem tempo próprio, então o fill proporcional ancora o evento; confira nos frames. Espaço em branco: mude só o vão (padding/gap), nunca tamanho/forma do elemento no mesmo passo; múltiplos de 8 e vão de 64 são exemplos, marque com selo EXEMPLO + "Só um exemplo" na fala. Metáfora da régua (unidades iguais, vãos diferentes) > escada para escala de espaçamento.

**Teoria das cores (lição 2026-11-02):** reel de cor/contraste/temperatura precisa de `tools/colorcheck.mjs` com as razões WCAG medidas por código (`scripts/wcag.mjs` tem `lum`/`ratio`): defeito de harmonia < 1,6:1, texto comum ≥ 4,5:1, título/hero ≥ 3:1, placa legível ≥ 7:1 vs ilegível < 1,5:1, e teste P&B (cada forma ≥ 3:1 do fundo). Para temperatura, isole a variável: troque só o matiz mantendo luminância (±3%) e tamanho; não afirme "quente salta, frio recua" como regra, diga "pode sugerir profundidade". WCAG 4,5/3:1 vale para texto, não para qualquer gráfico. Check final: 46,5 s, 1395 quadros, pico −4,9 dBFS; syncverify base 144/156, mediana 0,112 s / p90 0,181 s (p90 acima de 0,17 por offset entre passes; aceito com mediana < 0,15 s). Sem `revisao-gemini.md` → Codex validado por check + colorcheck + syncverify; MP4 (13:35) mais novo que src/timing/mix → não re-renderiza.

**Paleta de cores (lição 2026-11-02):** `scripts/wcag.mjs` agora exporta `deutan(hex)` (simulação de deuteranopia, Machado 2009) além de `lum`/`ratio`: meça erro×sucesso antes/depois (1,07:1 → 3,38:1 com luminância corrigida + forma ✗/✓; nunca só cor). Teste de sol forte = lavagem branca (mix com #fff, ~0,8): botão 1,33:1 → 3,06:1 com texto ≥ 4,5:1; modo escuro ruim = texto ≈ fundo (< 1,6:1). Mostre claro/escuro/sol como 3 telefones lado a lado, lente no do sol. Cinco cores (2 neutras, base, apoio, acento), azul-petróleo = calmo e festa/time/espelho são exemplos, não regra; diga "simulação de visão de cores", não "como daltônicos veem". `tts.mjs` rodou 1× e `retime.mjs`+`shift.mjs` reajustaram janelas sem Fish; `duration` com 1381,1 quadros evita render com 1 quadro a menos. Check final: 46,04 s, 1381 quadros, pico −5,8 dBFS; syncverify base 149/158, mediana 0,100 s / p90 0,160 s; sem Gemini → check + colorcheck + syncverify; MP4 (13:56) mais novo que src/timing/mix → não re-renderiza.

**Tipografia por categoria (lição 2026-11-02):** reel de famílias (serifada/sem serifa/display/mono) = pôster persistente de 4 zonas (sem escada/contador), cada zona ERRO (X) → CORREÇÃO → rótulo; uma fonte OFL por categoria só em `assets/fonts/LICENSES.md`, nome de fonte nunca na fala/tela. Afirmações sempre moduladas ("pode guiar o olho", "pode pesar"), nunca categóricas; exemplos (café, 1.111, tabular) são ilustrativos. Etapa 5 sem `revisao-gemini.md`: `check.mjs` (49,47 s, 1484 quadros, pico −5,6 dBFS) + syncverify base + grep `-nF "bubble("` vazio; MP4 (14:16) mais novo que src/timing/mix → não re-renderiza. Duração real 49,5 s vs 60,2 s planejados.

**Legibilidade/leiturabilidade/acessibilidade (lição 2026-11-02):** cartão persistente com 4 princípios (caracteres, parágrafo, contraste, acessibilidade), cada um ERRO → CORREÇÃO → rótulo. Meça por código no `colorcheck.mjs`: cinza #AAAAAA×#F4F4F4 = 2,11:1 → #6B6B6B = 4,85:1 (AA texto comum 4,5:1); erro vermelho×verde deutan 1,08:1 → 2,15:1 com luminância + ✗/✓ + texto curto ("E-mail inválido"); só mostre o valor medido na tela. Acessibilidade é mais ampla que o exemplo: diga isso. Mensagem de erro curta é a única exceção de texto real na arte (não é balão de chat). Check final: 49,64 s, 1489 quadros, pico −5,6 dBFS; syncverify base 143/160, mediana 0,095 s / p90 0,167 s. Sem `revisao-gemini.md` → check + colorcheck + syncverify; MP4 mais novo que src/timing/mix → não re-renderiza. Duração real 49,6 s vs 52,3 s planejados.

**Identidade visual (lição 2026-11-02):** mesa de marca persistente (perfil + cartão + sacola, só formas) com estilo numérico por touchpoint `{col, rad, body, bh, bwf, lg}` interpolado por passo (`lerpObj`): defeito → correção → rótulo; cena dividida em `core.js`/`brand.js`/`steps.js`/`scene.js`. Placa de demonstração opaca sobre a mesa: a janela da placa precisa terminar DEPOIS do check (confira `ok < fim da placa` no plan.js; palavra "Como" tem pouco tempo após o último termo). Humor alternando = `kfv` (keyframes suavizados), nunca `Math.random`. Respiro do logo = diâmetro do ponto do logo, medido em código, sem número na tela; versões/paleta/fontes são exemplos. Check final: 44,77 s, 1343 quadros, pico −4,4 dBFS; syncverify base 142/146, mediana 0,105 s / p90 0,170 s; sem Gemini → check + syncverify + frames.

**Etapa 5 sem Gemini (identidade visual, 2026-11-02):** syncverify pode mostrar `max` > 1 s (1,391 s) com mediana 0,105 s — outlier de palavra curta do whisper; julgue por mediana/p90 e não re-renderize se MP4 for mais novo que src/timing/mix (`stat -f '%Sm %N'`).

**UX × UI (lição 2026-11-02):** conceitos "um contém o outro" (UI ⊂ UX) viram uma cena persistente que cresce por passo (fachada → circular na loja → mapa → provar sapato), cada passo ERRO → CORREÇÃO → rótulo. Siglas faladas vão fonéticas no TTS (`U I`, `U X`) e o whisper ouve "U" como "O": mantenha a legenda mapeada pela tabela do plan, não pelo texto transcrito; syncverify base ainda deu 148/158, mediana 0,106 s, p90 0,171 s. Palavra ambígua no roteiro ("tipo") vira "fonte"/termo exato antes do TTS. Definição didática ganha ressalva falada ("além da tela"), sem número ilustrativo de toques/participantes. Etapa 5 sem Gemini: `check.mjs` (45,87 s, 1376/1376, −4,8 dBFS) + grep `bubble(` vazio + MP4 (15:26) mais novo que src/timing/mix → não re-renderizar.

**Wireframe → protótipo → interface final (lição 2026-11-02):** três artefatos de fidelidade crescente sobre uma tela-base única (posições preservadas); "iterar" é seta circular de retorno (sem contador). Cada passo ERRO → CORREÇÃO → rótulo; gancho = retrabalho visível (botão movido refaz tudo). Barras de custo de mudança levam selo EXEMPLO e fala "tende a custar", sem número. Ressalva falada: etapas podem se misturar e protótipo tem fidelidades diferentes. "wireframe" pode sair estranho no TTS/whisper: confira no timing.json. Etapa 5 sem `revisao-gemini.md`: `check.mjs` (45,44 s, 1363/1363 quadros, pico −5,7 dBFS) + syncverify base da etapa 3 (131/141, mediana 0,101 s, p90 0,170 s) + grep `-nF "bubble("` vazio; MP4 (15:44) mais novo que src/timing/mix → não re-renderiza. Duração real 45,4 s vs 58 s planejados.

**Microinterações (lição 2026-11-02):** sem `revisao-gemini.md` = sem revisão; Codex validado com `check.mjs` (45,97 s, 1379 quadros, pico −5,8 dBFS) + `syncverify.sh` base (151/155, mediana 0,104 s, p90 0,182 s; max 0,502 s = outlier whisper) + grep de balões vazio; MP4 mais novo que src/timing/mix → não re-renderiza. Duração real 46,0 s vs 56–60 s alvo; timing.json manda. Quando a CTA estoura a janela, o Fish sai rápido (1,23×): alargue a janela e re-sintetize só esse clipe (1× API), depois `retime.mjs` + `shift.mjs`. Barra de progresso/status só preenche por etapas conhecidas (sem % inventada); validação de formulário dispara ao perder foco, com `✗`/`✓` além da cor; faixas de tempo curta/longa levam selo EXEMPLO, sem ms. 185 cues de SFX em 46 s OK se cada um nasce de evento do plan.js.

**Estados de interface — carregando/vazio/erro/sucesso (lição 2026-11-02):** um celular + lista persistentes, quatro estados na ordem ERRO → CORREÇÃO → rótulo (espera sem retorno → molde pulsante; tela vazia → convite + ação; erro que perde dados → ✗ + orientação + dados mantidos; envio duplo → botão inativo, depois ✓). (Fileira de mini-celulares + contador foi revogada: sem indicador de progresso.) Molde pulsante não promete duração; recomende animação estática para movimento reduzido. Erro sempre ✗ + ícone, sucesso ✓ (nunca só cor). Sem `revisao-gemini.md` = sem revisão; Codex validado com `check.mjs` (41,13 s, 1234/1234 quadros, pico −5,3 dBFS) + syncverify base (132/145, mediana 0,100 s, p90 0,161 s, max 0,48 s) + grep `-nF "bubble("` vazio; MP4 (16:16) mais novo que src/timing/mix → não re-renderiza. Duração real 41,1 s vs 59,2 s planejados (Fish ~3,9 palavras/s; timing.json manda). Alargue a janela da CTA ANTES do TTS (5,6 s) para evitar re-síntese. `check.mjs` precisa rodar de dentro de `projeto/`.

**Design responsivo — celular/tablet/desktop (lição 2026-11-02):** página-exemplo persistente (só formas) renderizada em três molduras (celular → tablet → monitor); defeito visível primeiro (celular: corta/letra miúda; monitor: sobra espaço), depois correção → rótulo, (sem contador de dispositivos.) Chaveta/anotação perto da borda da moldura pode ser cortada: confira em frame real e desloque a coluna (center 0.86). Ponto de quebra e larguras são exemplos (selo EXEMPLO), nunca regra; "mude quando o conteúdo pedir". Gancho curto: janela 2,8 → 3,6 s antes do TTS evita re-síntese. Fish: 6 clipes, 1 síntese cada; 202 cues de SFX em 46,9 s OK se cada um nasce de evento do plan.js. Etapa 5 sem `revisao-gemini.md`: `check.mjs` (46,9 s, 1407/1407, pico −5,9 dBFS) + syncverify base da etapa 3 (153/159, mediana 0,094 s, p90 0,172 s) + sheet.png sem sobreposição + grep `-nF "bubble("` vazio; MP4 (16:34) mais novo que src/timing/mix → não re-renderiza. Duração real 46,9 s vs 60,6 s planejados.
