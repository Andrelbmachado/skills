# Narrated explainer reel (9:16, 60 s, voice-driven) — approved format

Use for educational Reels/Shorts in which a narrator teaches a sequence of concepts on one persistent diagram, with a live example per concept and a CTA. Approved end to end in "Círculo cromático" (2026-11, André: "tá perfeito, não tem nada a alterar"). Start from the template; change content, not the pipeline.

## Start

```bash
cp -R ~/.claude/skills/motion-code/templates/narrated-reel "<project dir>" && cd "<project dir>"
# .env (never commit, never print): FISH_API_KEY=… FISH_VOICE_ID=… [FISH_MODEL=s1]
npm run build      # tts → whisper word times → mix → frame-exact capture → mux → check
npm run voice:draft && npm run render   # no key: macOS `say` draft, file named "(rascunho voz do sistema)"
```

If the user pastes a key in chat: write it to `.env` with `umask 077` without echoing it, then advise rotating it, since it is now in the transcript. `npm run check` fails if the key's value appears in any file other than `.env`.

## Files and roles

| File | Role |
|---|---|
| `script.json` | `output` filename, `duration`, `fps`, lines `{id, window:[t0,t1], lead, speed, text}`. Text is the spoken script; write numbers as words ("sessenta, trinta, dez") so the voice reads them, and let captions map them back to digits (`NUM` in scene.js). |
| `tools/tts.mjs` | One Fish clip per line. Trims silence, fits it to the window via the TTS `speed` param (retries up to 1.45, then `atempo`), and gets word times from `whisper --word_timestamps` aligned to the script (letter-level DP). Writes `timing.json` and `src/timing.js`. The cache is hashed on voice + speed + text, so unchanged lines cost no API call. |
| `src/plan.js` | All key times as `w(lineId, word)` plus the SFX cue list. Imported by the scene **and** the mixer, so picture and sound never drift. Rename words here whenever the narration changes, because `w()` throws on a missing word. |
| `src/scene.js` | Canvas f(t): wheel and persistent points, shapes, titles, captions, art panel, CTA. Exposes `window.__reel.seek`, `__probe`, and a preview player (click to play with `audio/mix.wav`, ←/→ to seek). |
| `tools/mix.mjs` | Voice peak −6 dBFS; synthesized SFX classes from −16 to −24 dBFS; `pan` upmix; `amix normalize=0`; limiter at −1 dBFS. |
| `tools/build.mjs` | Mix → `capture.mjs --seek --to D-0.5/fps` → AAC mux `-t D +faststart`. |
| `tools/check.mjs` | Final gate: duration, frames == D·fps, 1080×1920, peak between −9 and −1 dBFS, engine, and no secret outside `.env`. |
| `tools/commons-dl.mjs` | Searches and downloads public-domain art from Wikimedia Commons (rate-limit safe) and records credits. |
| `tools/art-grid.py` | `grid`: a labelled 10×10 grid over each painting, for picking points by eye. `check`: markers plus sampled swatches. |
| `tools/art-pick.py` | `points.json` → box-mean colour per point → `src/art.js`. |

## Timeline rules

- **Pacing (André: a 1 s pause between principles "demora muito"):** pack the beats on the measured clips; do not pad fixed 9 s windows. Each window is `[prev_end, prev_end + lead + clip + 0.27]`, with lead 0.12 (0.35 for the hook), which gives ≈0.4 s of voice-to-voice gap. The silent recap before the CTA lasts ≥2.4 s (CTA lead ≈2.6: one row "problema ✗ → termo" every 0.3 s, then a hold); 1.2 s was too short to read (revised 2026-11-02). `duration = ceil((cta_end + 0.45)·fps)/fps`, so the video length follows the narration (≈52–53 s for 6 beats), not 60.
  - To retime, rewrite only `script.json` windows from `timing.json` durations and rerun `tts.mjs`. Clips are cached by text + speed, so there are no new API calls.
  - Caveat: if a window budget becomes shorter than a cached clip, `tts.mjs` re-synthesizes (spends API). After retiming, use `scripts/shift.mjs` (copy to `tools/`): reapplies `script.json` windows to the existing `timing.json` with no Fish/whisper call.
  - Write numerals out in `script.json` ("80" → "oitenta"): TTS speaks the word and the whisper-based caption would not match.
  - Strips of many mini-cells must fit inside their card (12 cells: step 31 px in a 372 px card); an abstract logo must not read as a face (hollow diamond).
  - Dates/quantities ("30 dias", 3 cores + neutro) are illustrative: label them "exemplo" on art and in speech.
  - Re-render instead of cutting silences out of the MP4: cuts break animations and SFX at the seams.
  - Fish voice at speed 1.0 says ≈23–31 pt-BR words in 7–8 s.
- **Visual changes are bound to spoken words.** The concept name triggers the title and the caption's heavier weight (no coloured pill). The geometry word ("opostos", "igualmente", "quatro") triggers the point move, edge or interval arcs. The example appears on the word that introduces it, and each sampled colour ball pops on the word naming that colour.
- **CTA:**
  - The recap (six mini diagrams) plays silently from `End(last) + 0.1`.
  - The CTA voice line ("Curta, comenta e compartilha." — the FIXED ENDING; icons + words in `drawEnding`, see SKILL.md "REGRA FIXA DO FINAL") starts together with the on-screen CTA text. Set the CTA `lead` so that `ctaText = L('cta') − 0.04`.
  - Captions hide from `ctaText` onwards, because the on-screen text is the caption.

## Layout tokens (1080×1920)

- **Background:** BG pure black `#000000` (André asked for it), flat, with **no radial glow** behind the diagram; a glow reads as blur and lowers contrast. PAPER `#F3EEE4`, MUTED `#8D8A99`. Font Bricolage Grotesque; titles 800 condensed, 104 px (84 px for two lines) at y≈326; subtitle 42/500.
- **Wheel:**
  - Centre (540, 800); ring R_O 308 / R_I 218; 12 RYB hues with yellow at the top.
  - Inactive segments sit at 36 % alpha; active segments grow 18 px outward and get a label.
  - **Points and inscribed shapes sit inside the hole at R_P = R_I − 46 (≈24 px of air), never on the hue band.**
  - Elastic pop-in from 0.12 (f 2.2, ζ 0.62); camera push 6 %.
- **Example panel:**
  - `PANEL = {y:1200, h:368}`: everything between the wheel's bottom labels (~1160) and the caption band.
  - The painting fills the height up to 610 px wide, with a credit line underneath ("Title  Artist, year": 23 px, 650 weight for the title, MUTED for the artist).
  - The ball column sits 54 px to the right, 300 px wide; the whole group is centred on x = 540.
- **Captions:**
  - One fixed band with baseline `CAP_Y = 1700`, 58/650, always the same size.
  - Groups are ≤22 characters or ≤4 words and break at punctuation.
  - White only (André's neutral rule): the spoken word = full opacity, spoken = 0.82, upcoming = 0.32; the step's term = weight 800 (measure each word at its own weight so the line never jitters). No yellow, no coloured/light pill.
  - Note for the user: the Instagram UI covers roughly the bottom 300 px.

## Artwork as evidence (colour/design theory)

1. **Choose public-domain works.** Use Commons only and check the license; living artists, such as Gerhard Richter, are copyrighted, so substitute a PD work and say so. Record the page and license in `assets/art/CREDITOS.md`.
2. **Map each work to the scheme on *our* wheel (RYB).** Readings that depend on another wheel fail. For example, yellow–blue is not complementary on RYB, and Richter's red/yellow/green/blue is not a square on RYB. Choose the hue indices the work really shows, then route the persistent points to them.
3. **Pick points by hand.** Run `npm run art:grid`, read u,v off the grid, set `hue` and `r` (0.006–0.01) in `points.json`, then `npm run art:pick` and `npm run art:check`. Automatic "most saturated pixel" searches drift onto neighbouring strokes.
   - Photographed pigment reads duller and yellower than its name. Some works lack a colour that seems obvious (the Night Café photo has no readable blue except the seated figures), so scan hue clusters before promising it in narration.
4. **Draw the evidence.**
   - A marker ring sits on the exact spot in the painting, with an elastic leader running to a ball outside the frame.
   - The ball is the sampled colour, ringed by the **pure wheel hue**: an honest colour shown next to the scheme colour.
   - Ball slots follow the points' vertical order, so leaders never cross. Slot pitch is ≥96 px; ball radius is 31 px for 3 balls, 27 px for 4, and sized by proportion for 60/30/10 tags.
   - The hue name (25/600) sits to the right of each ball. Pulse a ball's glow on "dominante" or "sombra".
5. **Make the two uses of a pair explicit in the narration and the visuals.** Complementary colours can (a) darken each other: a little green shades a red, shown by the sphere demo; and (b) create contrast, so one colour jumps out of the other: Van Gogh's orange beard against the blue background, with the orange ball's glow pulsing on "salta". Name both effects ("Uma pode escurecer a outra… Ou dar contraste…"). Showing the second example without naming its purpose read to André as a contradiction of the first.
6. **Reserve code-drawn illustration** for claims no artwork shows. In the approved video this was a red sphere whose shadow side takes a little green, with balls reading Vermelho, + um pouco de verde, = sombra.

## Persistent geometry across schemes

- **Point identities persist.** P, N1, N2 and V1–V3 keep their identity across schemes; each move is a spring step (`chan`) on the idx channel.
- **Edges are drawn by identity:** P–V1, V1–V2, P–V2 (triangle); V2–V3 and V3–P (four points). Assign target indices so the **cyclic order around the wheel stays P → V1 → V2 → V3**, otherwise edges cross.
- **Rectangle diagonals mark the complementary pairs:** V1–V3 and V2–P must be 6 steps apart.
- **Approved route:**

  | Scheme | Indices |
  |---|---|
  | Analogous | 7, 8, 9 |
  | Complementary | 10–4, rotating to 8–2 |
  | Triad | 8, 0, 4 |
  | Split | 8, 1, 3 (ghost at 2) |
  | Rectangle | 8 / 10 / 2 / 4 (V3 emerges from V2 and slides) |
  | Square | 7 / 10 / 1 / 4 |

- **Lint target:** overshoot 3–8 %, settle ≤ 0.6 s, no pops (`--probe "window.__probe()"`).

## Verify before delivery

1. Run `capture --times` at each beat's last ball, the recap and the CTA, and read `sheet.png`. Check: no overlap with the wheel labels or captions, balls not touching, credit clear of captions.
2. Full-resolution crop of the 4-ball panel and the caption band.
3. Motion lint on the point moves.
4. `npm run check` all ok. Report the levels, frames and rulings; for example, which artworks were substituted and why.

## Tech-concept reels (ex.: "IA do zero ao agente", 15 ferramentas em 2 partes)

> **Redo 2026-11-02 (regras novas do André, prioridade máxima):** sem escadinha, degraus, contador "n/15", barra de progresso nem "parte 1 · degraus 1 a 7". Fala e arte nunca contam passos. Gancho = confronto ("Usa IA só pra conversar? Ela faz bem mais. Mas quebra…") com balões vazios e ✗/✓. Cada ferramenta: ERRO → CORREÇÃO → rótulo, sem persistir um diagrama que "cresce" como contagem. O fecho recapitula com linhas "problema → termo" sem numeração; o agente final é um anel de loop liso (planeja · usa ferramentas · testa · repete). Cor só em ✗/✓; título e legenda brancos; realce da palavra falada só por opacidade/peso; palavra do termo sempre em negrito. Cuidado ao reaproveitar a voz: mantenha o texto das falas inalteradas para o cache do Fish (hash texto+velocidade) acertar; reescreva só gancho/CTA/fecho e use `mkscript` + janelas a partir das durações do timing.json antigo (`fixwin`) para não re-sintetizar o resto. Lições abaixo sobre escada/contador estão revogadas; o resto (ordem ERRO→CORREÇÃO→termo, balões sem texto, fonte única em shared/) segue valendo.

Lessons from the redo of a staircase explainer (error → fix → term per step):

- **Order per step = visible ERROR first, then the FIX, then the term label.** Never name the tool before the viewer sees the problem (brain + red X for lost context, tangled cables before MCP, 100 red dots before canary). Each step scene has `ERRO:` / `CORREÇÃO:` comments and its own `K.<key>` trigger words from `plan.js`.
- **Chat = text-free bubbles** (dot + 2 grey bars, ✓/✗ icons). No `label` arg on `bubble()`; labels belong to stamps/chips only. Grep the scene for `bubble(…, 'text')` before delivery.
- **Single source for 2-part series:** `shared/texts.json` → `mkscript.mjs` → each `parte-N/script.json`; `shared/*.js` scenes synced into each part's `src/scene.js` (`sync.sh`). Edit shared, never the copies.
- **Rename art labels when the narration changes** (CI/CD ≠ canary: label "DEPLOY GRADUAL"/"canary"). Codex/Gemini reviews catch these; re-grep labels after every script edit.
- **Background music is part of the mix:** synthesized pad+pluck at ≈ −27 dBFS peak under voice, fade in 1.5 s / out 1.2 s, written as separate `music.wav` so levels are inspectable.
- **Verify by code, never speaker:** `node tools/check.mjs` (duration/frames/size/peak/engine/secret scan) + `tools/syncverify.mjs` (whisper vs caption words: median |Δ| ≤ 0.05 s, p90 ≤ 0.1 s) + contact-sheet frames at each step's trigger time.
- **Tooling trap:** Homebrew ffmpeg/ffprobe can break after upgrades (`Library not loaded: libx265.*.dylib`). Use the `ffmpeg-static` binary in `scripts/node_modules` (symlink it as `audio/.bin/ffmpeg`) and probe via ffmpeg (`-af volumedetect`, `astats`) instead of ffprobe.
- **Slow checks:** whisper-based `syncverify` takes >2 min; run in background and poll, don't re-launch.
- **Reviewer outages:** an external reviewer (Gemini CLI) can 401 ("ACCESS_TOKEN_TYPE_UNSUPPORTED") and leave no review file. Fall back to checking the other reviewer's open points against the built scene and frames, and say so.

Lessons from "10 princípios básicos do design" (10 steps × ~5 s, persistent poster that is broken then fixed):

- **Planned windows are estimates; the voice wins.** Script planned 60 s / 149 words, Fish voice measured 52.5 s (1575 frames). Never pad to the plan: `timing.json` (whisper) owns duration, frames = `round(duration·fps)`, and `check.mjs` gates against it, not against the script.
- **`syncverify` gate = median/p90, not max.** Whisper mishears 1-syllable words ("seu", "e") → max Δ 0.67 s while median was 0.013 s, p90 0.073 s, 132/149 words matched. Judge by median ≤ 0.05 / p90 ≤ 0.1 and list outliers; only fix if the outlier is a trigger word of a visual event.
- **Freshness check before re-rendering:** compare `stat` mtimes — if the MP4 is newer than `src/*.js`, `timing.json`, `tools/mix.mjs` and the whisper `final.json`, a review with no real findings needs no re-render.
- **Missing reviewer file ≠ clean review.** If `revisao-gemini.md` does not exist, validate the other reviewer's open items (voice generated? windows from whisper? CTA loop planned? labels vs speech) with `check.mjs` + `syncverify` + frames, and record the absence in the report.
- **Persistent-poster reels:** one poster object carries all 10 defects; each step toggles exactly one property (contrast, alignment, spacing…), so ERRO → CORREÇÃO → rótulo reads clearly and the final poster is the cumulative "after" (never add a counter/ladder: that reading comes from the poster itself).

Lessons from "Kerning, tracking e padding" (3 steps, one persistent poster card + before/after zoom crops):

- **`syncverify.mjs` needs the whisper JSON as argv[2]** (bare run → `ERR_INVALID_ARG_TYPE`). Recipe: `ffmpeg -i final.mp4 -vn -ac 1 -ar 16000 /tmp/sv/final.wav` then `PATH=<ffmpeg-static dir>:$PATH whisper final.wav --model base --language Portuguese --word_timestamps True --output_format json --output_dir /tmp/sv` then `node tools/syncverify.mjs /tmp/sv/final.json`. Template now ships the script (needs `norm` exported by `lib.mjs`). Result here: 117/144 words, median 0.012 s, p90 0.079 s → pass.
- **Codex text review is pre-TTS:** its "pending" list (recalibrate to whisper, check overlaps, check levels) is a checklist for the build, not defects. Close each with evidence: timing.json present, contact sheet shows no caption/poster overlap, `check.mjs` peak −5.7 dBFS. Nothing real + MP4 newer than src/timing/mix = no re-render.
- **Teaching a visual defect:** blur ("squint test") must reveal the real gap — brighten only the offending glyph pair, leave others dark; correction changes only the pairs flagged. Show the same poster at identical positions across before/after so the delta is the lesson.
- **Numbers on art are layout-specific:** if narration says "suggestion/ponto de partida", label art "16 × 32 · ponto de partida", not a universal rule.
- **Contact sheet = `frames/sheet.png`** (6 frames at step triggers); read that one image instead of many PNGs.

Lessons from "A cor do ano da Pantone e sua história" (timeline poster 2000→2026, 46,3 s / 1390 frames; counter/ruler later revoked — see redo notes):

- **`whisper` fails silently with Homebrew ffmpeg broken** (`Skipping … Failed to load audio … libx265.215.dylib`; output redirected to /dev/null = no JSON, later `ENOENT f.json`). Always put ffmpeg-static first on PATH; `scripts/syncverify.sh final.mp4` does the whole chain (wav → whisper medium → syncverify → volumedetect) in one call.
- **Syncverify with whisper `medium` read median 0,097 s / p90 0,124 s / max 0,35 s (108/140 words)** vs 0,012 s with `base` in earlier posts: a fixed offset between two whisper passes, ~3 frames, not a defect. Judge pass/fail at median < 0,15 s and p90 < 0,2 s; only inspect frames if p90 jumps.
- **No `revisao-gemini.md` (third project in a row):** validate Codex's list with check.mjs + syncverify + `frames/sheet.png`; if MP4 mtime is newer than src/, timing.json, mix.mjs, do not re-render.
- **Brand/colour names in art:** swatch card carries official name + code (Cerulean 15-4020); spoken spelling may differ for TTS, art keeps the official one.

Lessons from "Hierarquia visual: como guiar o olhar" (cartão de post + ponto do olhar com rastro, 42,4 s / 1273 quadros):

- **Duration that is an exact frame count renders one frame short** (`--to D−0.5/fps` → 1272/1273). Set `script.json` duration to `N + 0.1` frames (42,4367 s) and run `shift.mjs`.
- **`tts.mjs` writes `src/timing.js`:** create `src/` first or it dies at the very end (after the paid synthesis; timing.json is already written, run `shift.mjs` to regenerate timing.js). Never start two `tts.mjs` at once; whisper medium takes ~3–4 min per line, so detach it with `nohup` and poll.
- **Colours:** `mixh()` takes hex only; feeding it a `rgba()` string yields NaN and the shape silently disappears. Mix as RGB arrays and convert with `css()` once.
- **Gaze/trail pattern:** one pure `gaze(t)` built from time-sorted segments (`toP`/`fnP`), trail = samples of `gaze(t−τ)`; the trail length/alpha per step is what proves each defect (tangle, fog, stuck, scribble) and the fix (straight line, calm arc, Z).
- **Squint test:** per-op `ctx.filter = blur()` works in the capture browser; draw non-key blocks heavily blurred and key blocks (title, button) lightly.
- syncverify base: median 0,088 s / p90 0,153 s, 142/159 matched — accepted.
- **`rtk find` rejects `-newer`/`-not`/`-exec` (CC/alinhamento/repetição/proximidade):** the RTK hook rewrites `find` and prints "does not support compound predicates" with no results — an empty output is NOT "nothing newer". Compare freshness with `stat -f '%Sm %N' MP4 timing.json src/* tools/mix.mjs` (macOS) instead.
- **4-principles-on-one-flyer reel (contrast/alignment/repetition/proximity):** real 50.1 s (1503 frames) vs 60 s planned; syncverify base 143/154, median 0.107 s / p90 0.167 s, accepted. Etapa 5 with no Gemini review and MP4 (12:32) newer than src/timing/mix → no re-render.


## Regras neutras do André (2026-11-02, prioridade máxima — vencem qualquer lição acima que as contrarie)

Lessons from the redo of "Kerning, tracking e padding" (poster reel):
- **Antigas orientações revogadas:** contador `n/3` no topo + pontos, slider/barra de valor embaixo, pílula clara/amarela na legenda, destaque amarelo no título, selo "×2", cores por termo (azul/laranja/verde). Nada disso volta.
- **Cor só onde é foco:** pôster/arte em tons de cinza; o vão ERRADO fica vermelho (preenchimento pulsante), a medida/solução em preto/branco; ✗ vermelho e ✓ verde só como selos. Quando um valor muda (tracking +8% → −2%), a leitura vira etiqueta presa ao próprio texto, nunca slider/barra de progresso.
- **Recap sem numeração:** uma linha por termo = mini ícone do problema (com ✗) → seta → termo branco; sem "n/3".
- **Reaproveitar a voz:** se o texto do roteiro não mudou (sem contagem), não rode `tts.mjs`: só `node tools/build.mjs` (mix + captura). Cues de SFX de elementos removidos (tick do contador, selo ×2) saem do `plan.js`.
- **Antes do build:** carregue a página com Playwright, rode `seek` em todos os quadros (pageerror) e olhe uma folha de contato; só então renderize em background.
- **Carrossel:** `projeto/carrossel-src/build.mjs` (HTML/CSS + Playwright do `scripts/node_modules`), painéis problema (✗) → solução (✓) + termo; 1 vão de letra = `<i class="gap">` com largura em px (vermelho no erro). Confira overflow do cartaz da capa (fonte menor com letter-spacing positivo) e flex que espreme o painel (use `flex: none`).
- **Pantone redo (2026-11-02):** série cronológica sem régua: rótulo de ano estático + ficha que sai deslizando; `verdict(cx, cy, t, tBad, tOk, r, a)` desenha ✗ até `tOk` e ✓ depois (tempos vêm do `plan.js`: `K.x.bad`/`K.x.ok`); `dockCard` virou saída (sem slot). Recap = fichas lado a lado com o ano dentro da ficha; CTA = ficha com cadeado + "???" e canto virando. Bug de layout achado em frame/PNG: selo "1ª"/estrela no mesmo canto do ✓ (mova para o lado oposto); título do carrossel a 82 px encosta nas bordas (use 72 px); impressoras lado a lado sobrepostas (escale 0,68).

## Redo Liquid Glass da Apple (2026-11-02, regras neutras do André)

- **Removed:** escada de 5 degraus coloridos + contador `n/5`, recap em que a pílula "pula" nos degraus, odômetro de ano (2007→2013→2025 rolando), pílula clara na legenda, ciano/creme em título e legenda, pílula "PARTE 2". **Now:** o ano é título estático (`2013` → `2025`, um clique de SFX por troca); o rótulo do termo é o próprio título branco que entra depois da correção; legenda branca (1 / 0,82 / 0,32 de opacidade, termo em peso 800, cada palavra medida no próprio peso); CTA = pílula de vidro com cadeado + "???" e canto virando (loop aberto).
- **Recap silencioso:** 5 linhas `mini cena do problema (✗) → seta → termo branco`, uma a cada 0,3 s (`K.recapRow(i)` no plan.js; pops de SFX nos mesmos tempos). Faça o celular sumir ANTES da 1ª linha (`phoneA` fade em `recap−0,05`, `recapHop = recap+0,4`) — achado em folha de contato: as 2 primeiras linhas nasciam sobre o celular.
- **Cor só no foco:** papel de parede, foto e conteúdo do celular em cinza; ficam coloridos só os chips atrás da pílula (é o detalhe que a refração/vidro curva) e ✗/✓/toggle ligado. Sem ciano/rosa/laranja decorativos nos poofs, camadas, brilhos, fundo do CTA.
- **Voz reaproveitada:** texto sem contagem → zero TTS. Só `script.json`: CTA `lead` 1,2 → 2,6 e `window`/`duration` alargadas (duração +frame fracionário), depois `tools/shift.mjs` (copiado de `scripts/`) e `tools/build.mjs`. Ordem: shift → seek em todos os quadros (Playwright, sem pageerror) → folha de contato → build em background com um único watcher `until [ -s done ]`.
- **Carrossel a partir da própria cena:** `window.__reel.geo(t)` (offset/escala do celular) + `page.screenshot({clip})` em tempos do plan.js geram os recortes reais (problema com ✗ do canvas → solução + ✓ HTML); slides em HTML/CSS por `carrossel-src/build.mjs`. Armadilhas: caminho com espaço quebra `url()`/`file://` (use `encodeURI` e aspas) → a fonte cai silenciosamente para Arial; halo de gradiente cortado na borda do recorte (máscara radial no `<img>`); título do CTA a 140 px quebra em 3 linhas (112 px).
- **Medidas:** 45,67 s, 1370/1370 quadros, 1080×1920, pico −5,1 dBFS; syncverify base 128/142, mediana 0,100 s, p90 0,159 s (aceito; whisper base vs medium). Sem `revisao-gemini.md` → sem revisão, validado por check + syncverify + frames.

## Redo Halloween (2026-11-02, regras neutras do André)

- **Removed:** escada de 5 degraus coloridos + contador `n/5`, anel laranja do recap, "PARTE 2", legenda com pílula/laranja, subtítulo/título creme e laranja. **Now:** rótulo do termo = título branco depois do ✓ verde (`badgeOk` no mesmo lugar do ✗, `K.lad*` do plan.js); recap = 5 linhas `mini cena do problema (✗) → seta → termo` (`K.recapRow(i)`, centralizado com `RC.cx` ~310); CTA = pílula de contorno com cadeado + "???" e máscara cinza.
- **Cor só no foco, barato:** `ctx.filter = 'grayscale()'` em cada objeto custou 0,5–1,5 s por quadro (1290 quadros = inviável). Use `desat(c)` — `fillStyle`/`strokeStyle`/`addColorStop` reescritos com `Object.defineProperty(ctx, …)` e um `SAT` global (0 = cinza, 1 = cor); `withSat(k, fn)` para o foco do passo (`focusWin(t, a, b)`: entra no passo, sai 0,7 s depois do rótulo) e `SAT = 1` dentro de ✗/✓. Resultado: ~5 ms por quadro, 1289 quadros em 3 s no `seek`.
- **Hook de confronto:** "parece filme" (tela + claquete) ganha ✗ vermelho na palavra "Mas", e saem antes de "camadas".
- **Voz reaproveitada:** texto sem contagem → zero TTS; CTA `lead` 1,2 → 2,6 e janela/duração +1,4 s no `script.json`, depois `tools/shift.mjs` (copiar de `scripts/`) e `tools/build.mjs`. A casa sai em `recap−0,05`, 1ª linha em `recap+0,45`.
- **Carrossel 8 slides** por recortes reais da cena (`seek` + `page.screenshot({clip})` 1000×700 em tempos do plan.js: problema em `K.x1+0,45` etc., solução em `K.lad*+0,4`), problema ↑ ✓ ↓ empilhados (painéis ≤ 462 px de altura para não estourar 1350). Checar `OVERFLOW` do build.
- **Medidas:** 42,97 s, 1289/1289 quadros, 1080×1920, pico −5,5 dBFS; syncverify base 111/122, mediana 0,099 s, p90 0,179 s (aceito). Sem `revisao-gemini.md` → sem revisão.

## Redo Tipografias — Melhores tipografias do ano (2026-11-02, regras neutras do André)

- **Removed:** escada de 5 degraus coloridos + contador `n/5`, cor por fonte (azul/laranja/ciano/amarelo/roxo), pílula clara na legenda, ciano no título, sliders PESO/LARGURA, fila de barras de download, "PARTE 2", recap em cartões coloridos. **Now:** `PAPER/ACC/C_*` = `#FFF`, resto em cinza, `GREEN` só no ✓; legenda branca com termo em peso 800 e opacidade 1 / 0,82 / 0,32 (cada palavra medida no próprio peso); título 2 linhas e subtítulo brancos.
- **ERRO → CORREÇÃO → rótulo:** `verdict()` põe ✗ (balão murchando, "=" vermelho, janela com orelhas, I l 1 iguais, celular borrado) e troca por ✓ em `s.ok` (palavra do termo + 0,3–0,9 s); o título com o nome da fonte entra em `s.lad`, depois do ✓. SFX: ✗ = `buzz`, ✓ = `plic`+`ding`, rótulo = `click`+`tap` (sem riser).
- **Valores como etiqueta, não barra:** peso = amostra de traço cuja espessura cresce ao lado de "PESO"; largura = colchete com pontas na largura real do texto (bbox de pixels em cada quadro SVG de `wdth`) + "LARGURA"; ícones volume/lupa nascem nas palavras "volume"/"zoom". Downloads = 4 setas ↓ que caem em sequência.
- **Recap:** 5 linhas `mini cena do problema (✗) → seta → "Aa" na fonte + nome` (`K.recapRow(i)`), poster some em `recap−0,05`; CTA = "A 🔒 a" + "???" (loop aberto), "PRÓXIMA PARTE" sem número. Voz em cache: só CTA `lead` 1,2 → 2,6 + `shift.mjs` + `build.mjs`.
- **Medidas:** 48,83 s, 1465/1465 quadros, 1080×1920, pico −6,0 dBFS; syncverify base 135/149, mediana 0,096 s, p90 0,154 s. Carrossel 8 slides 1080×1350 em HTML puro com as fontes reais do `assets/fonts` (`@font-face` relativo), sem overflow; `justify-content:center` evita rodapé vazio.

## Redo Dia a dia do designer (2026-11-02, regras neutras do André)

- **Removed:** barra de 5 compartimentos que pintam por passo, escada `0/5→5/5` com contador, círculos 1…5 sob as versões, pincel que preenche a faixa do dia, título "1 DE 5 BLOCOS", subtítulo "cinco etapas…", "PARTE 2", pílula/ciano na legenda, cores por etapa, brilho/anel amarelo, cortiça marrom, logos coloridos. **Now:** `PAPER/ACC` = `#FFF`, resto cinza, `GREEN` só no ✓, `RED` só no ✗.
- **Relógio persistente sem ponteiro rodando:** `FACES` (hora única por passo) cruza por fade 0,22 s; hora é conteúdo falado ("nove da manhã"), mas sem rolagem/odômetro nem tique-taque. Sol → lua só como ícone do rosto das 18h.
- **Gancho:** prancheta com rabisco (lápis) → ✗ em "Nem" → cinco tiles de ícones soltos em "real" (sem numerar); somem quando o 1º passo começa.
- **Cada passo:** problema com ✗ (pedido vago → retrabalho; tela em branco; uma ideia só; retorno vago; arquivo bagunçado + equipe travada) → correção → ✓ (`s.ok` no plan.js) → título branco do termo. SFX: ✗ `buzz`, ✓ `ping`+`plic`, rótulo `ding`+`plic`+`click`; sem riser.
- **Recap:** 5 linhas `✗ problema (cinza) / ✓ TERMO (branco)` sem numeração, stagger 0,16 s, janela ≥ 2,0 s com todas visíveis (CTA `lead` 2,8). CTA = ficha lacrada: balão sem texto + cadeado que fecha em `deixa` + "???" em `bonito`.
- **Voz Fish em cache** (texto igual): `script.json` CTA `lead` 2,8 + `retime.mjs` atualizado + `shift.mjs` + `build.mjs`; zero API. Medidas: 47,8 s, 1434/1434 quadros, 1080×1920, pico −5,1 dBFS; syncverify base 131/141, mediana 0,102 s, p90 0,166 s. Sem `revisao-gemini.md` → sem revisão; validado por check.mjs + syncverify + frames.
- **Carrossel 8 slides** 1080×1350 em HTML/SVG puro (`projeto/carrossel-src/build.mjs`, com `Bricolage.ttf` local): capa-confronto, 5 pares problema ✗ ↓ solução ✓ + termo, resumo, CTA lacrada; sem overflow (build avisa `OVERFLOW`).

## Redo Datas comemorativas e temas em alta (2026-11-02, regras neutras do André)

- **Removed:** escada de 5 degraus coloridos + contador `n/5`, brilho "pisca" do degrau, régua de 30 dias que preenche (lia como progresso), cor por passo (azul/rosa/verde/roxo/âmbar), título com cor por termo, legenda com pílula clara + ciano, "PARTE 2", leque de 5 cartões coloridos no recap. **Now:** `PAPER=#FFF`, `SC[]` todo cinza, `AMBER` = cinza claro; cartão persistente ganha uma camada por passo; ✗ vermelho no cartão → ✓ verde no canto (`drawVerdicts`, `s.ok = term − 0,4`) → título branco do termo.
- **Cor só no foco, e só enquanto é foco:** rosa (swatch da ideia), 3 chips do Natal, néon e roupas ficam coloridos no passo deles; quando o PRÓXIMO passo começa, `grayMix(hex, k)` leva a camada já resolvida para cinza (0,4 s). Arco-íris do problema e o pôr do sol retrô são o próprio assunto → mantêm cor.
- **Régua/seta de "30 dias" não preenche:** o vão aparece inteiro de uma vez (alpha), com "30" + selo "exemplo". Qualquer coisa que cresce da esquerda p/ direita lê como barra de progresso.
- **Legenda neutra:** peso fixo por palavra (termo 800, resto 650; medir cada palavra no próprio peso), opacidade 1 / 0,82 / 0,32; termo do "Isso é …" fica em negrito e acende a 1 ao ser falado. Sem pílula, sem cor.
- **Recap:** 5 linhas `pictograma do problema (✗) → seta → termo branco (✓)`, stagger 0,2 s (`K.r.row[i]`, `pop` de SFX nos mesmos tempos), sem numeração. CTA `lead` 1,2 → 2,6 e cauda +0,35 s no `retime.mjs` para o "???" ficar ≥ 0,5 s na tela. Cadeado fecha em `template`, "???" em `template + 0,3`.
- **Títulos em sequência:** saída do título-problema em `term − 0,26` (com `term − 0,1` os dois títulos ficavam sobrepostos ~0,2 s — visto só em quadro real do MP4 em `term`).
- **Voz Fish em cache** (texto igual): `retime.mjs` + `shift.mjs` + `build.mjs`; zero API. Medidas: 47,0 s, 1410/1410 quadros, 1080×1920, pico −4,9 dBFS; syncverify base 141/149, mediana 0,104 s, p90 0,150 s (aceito).
- **Carrossel 8 slides** 1080×1350 (`projeto/carrossel-src/build.mjs`): recortes reais da cena (`page.screenshot({clip})` 840×920 do cartão+painel em `s.x+0,12…0,4` = problema com ✗; `s.term+0,3`/`s.ok+0,12`/`s.term−0,2` = solução com ✓) lado a lado + termo branco + frase da fala; capa = recorte do gancho; slides 7 e 8 = recortes do recap e da CTA. Tempo do problema do passo "identidade" tem de ser ANTES de `entao` (manequim já cobre o ✗ em `x+0,4`). Build avisa `OVERFLOW`.
- **Armadilha:** `sed -E 's/… \}/…/'` no macOS não casou `},` e a cadeia `&&` parou em silêncio no `grep -c` (0 → exit 1); substitua por `node -e` com `replace` e confirme a contagem.

### Redo Hierarquia visual (2026-11-02)
- **Removed:** escada 5 degraus + contador `n/5`, cores por princípio, legenda com pílula clara/ciano, 2º título ciano, números nas paradas de leitura, cartão vazio tracejado ciano da CTA. **Now:** `PAPER/ACC/TEAL` = #FFF, blocos do cartão em cinzas, `GREEN` só no ✓, `RED` só no ✗, `ORANGE` só no título em foco (contraste).
- **Veredito por passo:** `drawVerdicts` desenha ✓ no mesmo canto do ✗ (`cardX+175, CC.y−250`) de `s.ok = term − 0,45` até o próximo "Mas aí"; cue `ding`+`plic` no ✓ e `pop` no título do termo. `whoosh` baixo marca o título-problema novo (substitui riser/tick de degrau).
- **Recap:** card + Z à esquerda, 5 linhas à direita (✗ + problema em cinza / ✓ + termo branco, sem numeração), CTA `lead` 2,6 para ≥ 2,4 s legíveis. CTA = cartão lacrado (cadeado abre → fecha em "parte", "???").
- **Carrossel 8 slides** (`projeto/carrossel-src/build.mjs`): capa-confronto (recorte do gancho), 5 pares ✗|✓ (recorte 780×950 em `s.x+0,4` e `s.ok+0,3`) com termo branco + frase da fala, recap e CTA recortados. Título de uma palavra > 10 letras (AGRUPAMENTO) precisa de 112 px, não 150 (cortava nas bordas).
- Medidas: 43,83 s, 1315/1315 quadros, pico −5,8 dBFS; syncverify base 143/159, mediana 0,091 s, p90 0,148 s.

### Redo Contraste, alinhamento, repetição e proximidade (2026-11-02, regras neutras)
- **Removed:** escada `0/4→4/4` + contador, quatro pontos que "contam" no gancho, `SC[]` coloridos, teal `ACC` na legenda/título/guia, pílula clara na legenda, etiquetas coloridas do recap, checkboxes coloridos + folheto vazio tracejado da CTA. **Now:** `PAPER=#FFF`, `ACC=#E6E6E6`, `SC[]` cinza, `OKC` só no ✓, `RED` só no ✗/pulso de erro; neon/uniformes/livros em cinza; erro de repetição por cinzas/peso/forma distintos.
- **Veredito:** `verdict(t, s, x, y)` = ✗ (`s.x`→`s.entao+0,1`) e ✓ (`s.ok = term − 0,45` → `term+0,9`) no mesmo canto; cue `plic` no ✓. Título-problema sai em `term − 0,26`, título-termo em `próximo.mas − 0,3`.
- **Recap/CTA:** `cardVis(t)` apaga o folheto no recap (4 linhas ✗ problema / seta / ✓ termo, `labDt` 0,4 s) e o devolve dentro do celular na CTA, onde 4 ✓ verdes marcam T/I/L2/B (nunca sobrepor T e S: ficam a ~30 px). CTA lead 2,6 em `retime.mjs`.
- **Carrossel:** recortes `CARD` 600×660 em `s.x+0,2…0,3` e `s.ok+0,3`, metáfora `META` 760×290 em `term−0,3`; fonte por `pathToFileURL().href` sem `encodeURI`.
- Medidas: 51,5 s, 1545/1545 quadros, pico −6 dBFS; syncverify base 144/154, mediana 0,107 s, p90 0,167 s.

## Redo neutro — Grid, colunas e composição (2026-11-02)
- **Removed:** escada `0/4→4/4` + contador `n/4`, quatro pontos do gancho, `SC[]` coloridos (azul/laranja/verde/roxo), pílula/ciano na legenda, etiquetas coloridas do recap, checkboxes coloridos da CTA, folheto vazio tracejado ciano. **Now:** cartão de post persistente em cinza (`photo()` em tons de cinza, guias em branco/cinza), ✗ vermelho → ✓ verde no canto (`s.ok = term − 0,45`) → título branco do termo; recap 4 linhas "problema ✗ → termo ✓"; CTA = celular com o cartão + 4 ✓ (título, foto, vazio, botão) → cartão lacrado (cadeado + "???").
- **✓ não pode invadir o passo seguinte:** `end = min(term+0,9, próximo.mas − 0,08)`; sem isso o ✓ verde ficava sobre o título "LINHA LONGA DEMAIS". Só apareceu no quadro real do MP4, não na folha de contato do seekall.
- **Voz:** texto igual (hook "Quatro ajustes dão estrutura" é fala, não contagem na tela) → cache Fish, zero API: `retime.mjs` (CTA lead 3,0) → `shift.mjs` → `build.mjs`. Recap: `labDt` 0,32 s, fade em `abre − 0,15`.
- **Medidas:** 50,0 s, 1500/1500 quadros, pico −5,7 dBFS; syncverify base 150/157, mediana 0,103 s, p90 0,161 s (aceito). Carrossel 7 slides 1080×1350 em recortes reais (capa, 4 × [problema ✗ | solução ✓ + metáfora], recap, CTA).

## Redo Teoria das cores (2026-11-02, regras neutras)
- **Removed:** escada 0/3→3/3 + contador, pontos do gancho, `SC[]`/ciano/âmbar, pílula na legenda, etiquetas coloridas do recap, checkboxes da CTA, barra que preenche na régua de contraste.
- **Now:** pôster persistente colorido (cor é o assunto); ERRO (pulso vermelho + ✗) → CORREÇÃO → ✓ (`s.ok = term − 0,4`) → título branco do termo; régua WCAG com zonas fixas e marcadores "antes ✗ 1,3:1" / "depois ✓ 14,2:1" medidos por `ratio()`; recap 3 linhas "✗ → ✓ TERMO"; CTA com ✓ pequenos no cartão dentro do celular e cartão lacrado.
- **Transições de título:** sempre conferir tempos `term−0,2 / term+0,1 / próximo.mas±0,2 / recap±0,2` no seekall (passe os tempos como argumentos).
- **Medidas:** 47,9 s, 1437 quadros, pico −5,1 dBFS; syncverify base 143/156, mediana 0,121 s, p90 0,181 s (offset entre passes, aceito). Carrossel 8 slides 1080×1350 em recortes reais.

## Redo Como escolher uma paleta de cores (2026-11-02, regras neutras)
- **Removed:** escada 0/3→3/3 + contador, 3 pontos do gancho, `SC[]` (rosa/âmbar/azul) em títulos/etiquetas, ciano na legenda/título, pílula clara na legenda, etiquetas coloridas do recap, checkboxes/cartão vazio da CTA, contador de cinco pontos do exemplo, âmbar do selo EXEMPLO.
- **Now:** ✗ (canto da tela) → correção → ✓ no mesmo canto → título branco; recap linhas `✗ problema → ✓ termo`; CTA = ✓ pequenos no canto do celular + cartão lacrado (cadeado + ???). Cor só na tela/paleta (assunto), ✗/✓ e detalhes em foco (calendário do dia, cartão calmo escolhido, gota base, duas cores do globo, roupas do espelho, craque do time).
- **Fala sem contagem:** gancho trocado ("Tem método que dá direção"); 1 síntese Fish só dele, `tts.mjs` reaproveitou o cache das outras 4 linhas; depois `retime` (CTA lead 2,8) → `shift` → `build`.
- **Pré-voo:** `tools/seekall.mjs` + folha de contato nos tempos de transição (`x+0,02 / x+0,12`) é o que acha sobreposição de título; `s.x` não existe no passo 3 (use `xs[i]`).

## Redo Tipografia (categorias, 2026-11-02)
- **Removed:** escada 0/4→4/4 + contador `n/4`, 4 zonas do gancho acendendo em ordem, cores por categoria, pílula de rótulo nas zonas e no CTA colorido, pílula/ciano na legenda, "PARTE" ciano, título "QUATRO TIPOS". **Now:** página persistente cinza; ✗ → correção → ✓ (mesmo canto) → título branco; recap `✗ problema → ✓ termo` ×4; CTA = ícones de uso (cinza→branco ao encaixar a chave) → projeto com lupa e ✓ → "SEGUE PRA PRÓXIMA PARTE" + duas fichas "Aa" se juntando (loop aberto literal).
- **Pipeline:** zero TTS (texto igual). `retime.mjs` com CTA lead 2,8 → `shift.mjs` → `tools/seekall.mjs` (1532 quadros sem erro; tempos de chaves do plano, `window.__K = K`) → `build.mjs` → `check.mjs` → `syncverify.sh` (base).
- **Medidas:** 51,07 s, 1532/1532 quadros, pico −5,8 dBFS; syncverify base 144/149, mediana 0,098 s, p90 0,158 s.
- **Carrossel:** 8 slides 1080×1350 (`carrossel-src/build.mjs`): recortes reais da página (clip x190 y410 700×790) ✗ | ✓ + metáfora (clip y1200 h260), recap, usos, CTA. Recorte de "usos" precisa de tempo em que as chaves já encaixaram e o projeto ainda não entrou (`uso+0,12`).

## Redo neutro — Legibilidade, leiturabilidade e acessibilidade (2026-11-02)
- **Removed:** escada 0/4→4/4 + contador `n/4`, 4 zonas do gancho acendendo em ordem, pílulas coloridas (zona, recap, CTA), cores por termo, agulha do medidor que desliza (lia como progresso), "QUATRO CUIDADOS" no título. **Now:** ✗ → correção → ✓ no mesmo canto → título branco; medidor com marcadores "antes ✗" / "depois ✓" trocados no lugar; recap 4 linhas "✗ problema → ✓ termo" (card some em `recap−0,1`); CTA com leitores juntos (sem contagem).
- **Voz em cache** (texto igual): CTA lead 1,2 → 2,8 em `retime.mjs` → `shift.mjs` → `seekall.mjs` → `build.mjs`. 51,23 s, 1537/1537 quadros, pico −5,6 dBFS; syncverify base 143/160, mediana 0,095 s, p90 0,169 s.
- **Carrossel:** 8 slides em `carrossel-src/build.mjs`; clip do cartão 700×800 em `(190,390)`, metáfora 760×260 em `(160,1200)`; ✗ no meio da janela do erro, ✓ em `s.ok+0,5`.

## Redo neutro — Iconografia: consistência, peso e tamanhos (2026-11-02)

- Folha 3×3 persistente em branco/cinza; "apps diferentes" = tiles de raios distintos (não cores). Cor só em ✗/✓.
- Medidor de ocupação (círculo parece menor): sem barra (lê como progresso); número ("78%", "100%") preso à forma, medido por código (MEAS).
- Recap: a folha some (`vis` = 1 − smooth(recap) + smooth(CTA.quatro)); linhas "✗ problema ↓ ✓ TERMO"; fade das linhas em `ctaText − 0,4` para não colidir com a folha voltando.
- CTA: contorno único + ✓ na folha ("conjunto"), celular com ✓ simultâneos, cartão lacrado sobre o quadro (fundo .95 para os slots não vazarem).
- Anel/✓ da folha deslizante precisam sumir antes do slide-out (`teste − 0,55`) senão aparecem duplicados.

## Redo neutro — Como criar uma identidade visual consistente (2026-11-02)
- **Removed:** escada 0/4→4/4 + contador `n/4`, anéis coloridos do passo ativo na mesa, `SC[]` em títulos/placas/recap, pílula clara + ciano na legenda, três marcadores de 1-2-3 pontos no gancho, quatro chaves coloridas na CTA, "QUATRO PASSOS" no título (contagem só na fala), pílulas coloridas do recap, tela "espiando" tracejada na CTA.
- **Now:** mesa de marca persistente; ✗ (pulso vermelho dentro da mesa) → correção → ✓ no MESMO canto → título branco (`drawMesaMarks` roda DEPOIS das placas para ✗/✓ nunca ficarem cobertos; o pulso vermelho fica DENTRO da mesa, antes das placas, senão tinge a placa que está entrando). Recap 4 linhas "✗ problema → ✓ termo"; a mesa some no recap (`vis`) e volta na CTA com contorno branco + ✓ ("uma marca só"); apresentação ao cliente lacrada (cadeado + ???).
- **Cor por janela de tempo, não por objeto:** `core.js` ganhou `desat()`/`setSat()`/`withSat()` (padrão cinza); `satMesa(t)` liga a cor da mesa só no gancho (cores brigando), no kit e na CTA; placas de kit e aplicação rodam em `withSat(1)`; badges/✓/✗ já são `withSat(1)` por dentro. Plate/panel perderam o parâmetro de cor (borda branca neutra).
- **Voz reaproveitada:** texto igual → zero API; `retime.mjs` (CTA lead 2,8) → `shift.mjs` → `seekall.mjs` → `build.mjs`. Recap precisa de ≥ 2,4 s: lead 1,2 deixava < 1,5 s.
- **Janela de título curta:** "UMA MARCA SÓ" amarrado a `uma − 0,12` ficava ~0,3 s (o próximo título forçava o fade); amarre ao 1º word da CTA e deixe o título seguinte entrar só em `teste`.
- **Carrossel:** recortes reais (✗ | ✓ + metáfora) com `K` do plano; slide do recap/CTA recortados do próprio reel; tamanho do termo adaptado ao comprimento (128/112/88 px).

## Redo neutro — Wireframe, protótipo e interface final (2026-11-02)
- Sem escada/contador/pílula/cores por termo. Neutralize pelos tokens de `core.js` (PAPER/ACC brancos, AMBER cinza, SC cinzas, `checkMark` verde) e depois cace literais hex com spread > 20.
- Custo/esforço = área vermelha por versão (nunca barras crescentes); hierarquia = marcadores de tamanho (nunca 1-2-3 pontos).
- Recap em colunas sob os celulares: ✗ problema ↓ ✓ TERMO; CTA lead 2,8; fade da seta do loop e do selo EXEMPLO em `recap − 0,15`.
- Voz em cache: retime → shift → seekall → build. Carrossel: CTA recortado a partir de y 70.

### Redo neutro — Microinterações (2026-11-02)
- **Removed:** escada `0/4→4/4` + contador `n/4` (drawLadder inteiro), cores por função (`SC[]` teal/âmbar/rosa/violeta), pílula clara/teal na legenda, "PARTE" teal no CTA, chips coloridos do recap, botão azul/violeta, lâmpada amarela, barra âmbar, confete colorido. **Now:** ✗ → correção → ✓ no mesmo canto (`okb`; sutileza ganhou `s.okb = tapCalm + 0,25`, antes só tinha ✓ no painel) → título branco; recap = colunas "✗ problema ↓ ✓ TERMO" sob os mini-celulares (`R.lab` = ✗, `R.term` = ✓); botão cinza (7A→B4 para "só troca de tom"); cor só em ✗/✓ e nos estados de erro/validação do campo.
- Trocar tokens de `core.js` (PAPER/ACC branco, AMBER cinza, SC cinzas, GREEN só ✓) + `rep()` que lança se faltar o trecho neutraliza quase tudo; `checkMark` default passa a verde.
- Voz Fish em cache (texto igual): `retime` (CTA lead 2,8) → `shift` → `seekall` → `build`; 47,57 s, 1427 quadros, pico −5,7 dBFS; syncverify base 150/155, mediana 0,104 s, p90 0,179 s. Nunca edite `src/` com o build rodando: mix e página já carregaram o plano antigo; mate, edite e relance (ou o MP4 sai sem a mudança).
- `pkill -f build.mjs` casa com o próprio comando de shell que contém a string; confira com `pgrep` depois. Wrapper `run_in_background` com `( … ) &` termina na hora e dispara notificação falsa de "concluído": use `nohup sh -c '…; echo $? > done' &` e vigie o arquivo.
- Carrossel 8 slides: recorte do painel de metáfora "sussurro/grito" precisa de `S4.big + 0,55` (em `okw + 0,4` o grito ainda não existia).

## Redo neutro — Estados de interface (2026-11-02)
- Troque a lógica de "fileira de minis + contador" por veredito no canto: ✗ (`xIcon`, pop + tremor) de `s.x` a `entao`, ✓ (`okIcon` com traço desenhando) de `vOk` a `okEnd`, em coordenadas absolutas do canto do celular (aqui `PH.cx+188, PH.cy−330`, disco preto atrás).
- Cor só ✗/✓: `desat()` já exempta #FF2A2A/#35D07F — não reutilize esses hex em avatares/props. Tokens (PAPER/ACC branco, SC cinza escuro) neutralizam títulos, legenda, botões.
- Recap em linhas centralizadas por medida (`measureText` do maior texto), ✗ nasce em `pop[i]`, seta ↓ e ✓ + TERMO em `pop[i]+0,3`; fade conjunto em `segue−0,12`.
- Carrossel: recorte do recap precisa começar acima do título (y 80), não em y 160 (cortava "DO PROBLEMA").
- Reescrever `scene.js` inteiro por script (cabeçalho até "quadro") é mais seguro que editar função a função; rode `seekall` antes do build e não edite `src/` durante o build.

## Etapa 5 sem revisão — Design responsivo (2026-11-02)
- Sem `revisao-gemini.md` (só `revisao-codex.md` pré-TTS): fechar com `check.mjs` (49,23 s, 1477/1477 quadros, 1080x1920, pico −5,6 dBFS) + `stat -f '%Sm %N'` (MP4 22:11 > src/timing/mix 22:10) → não re-renderiza. Confirmar o MP4 copiado na pasta do post antes de encerrar.
- `check.mjs` roda de dentro de `projeto/`; ele também audita segredo fora do `.env` e engine Fish — útil como checklist único de entrega.
- Legenda: o Codex sugeriu caixa violeta `#5B4A70`; regra neutra do André manda retângulo cinza translúcido. Em conflito, prevalece a regra neutra.

## Etapa 5 sem revisão — Acessibilidade (contraste, foco, área de toque) (2026-11-02)
- Sem `revisao-gemini.md`: `check.mjs` (50,7 s, 1521/1521 quadros, 1080x1920, pico −5,9 dBFS) + mtimes (MP4 22:28 > src/timing/mix) → não re-renderiza.
- Valores de plataforma têm unidade própria: 48 dp (Android) e 44 pt (Apple) ≠ px; WCAG 2.2 AA = 24×24 CSS px (com exceções), AAA = 44×44. Mostre com selo EXEMPLO, nunca como valor universal.
- Razões de contraste na arte vêm de `wcag.mjs` (ex.: #B2B2B2 × branco = 2,12:1 → #727272 = 4,8:1), não do roteiro; rótulo na tela = valor medido.
- Foco visível: contorno que acompanha o controle e salta de um para o outro por Tab; toque que acerta o vizinho → área ampliada + espaçamento. Sem contador de Tab.

## Etapa 5 sem revisão — Página inicial (2026-11-02)
- Sem `revisao-gemini.md` → sem revisão. Validar: `check.mjs` (49,7 s, 1491/1491 quadros, pico −5,7 dBFS) + `syncverify.sh` com caminho absoluto do MP4 (base: 147/153, mediana 0,093 s, p90 0,170 s; max 0,79 s = outlier do whisper) + grep de balões. MP4 (23:45) mais novo que src/timing/mix → não re-renderiza.
- Duração real 49,7 s vs 60 s planejados; timing.json manda.
- Exemplos de copy/avaliações/depoimentos levam selo EXEMPLO; prova social nunca com nomes/notas inventados que pareçam reais.
