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

- **Pacing (André: a 1 s pause between principles "demora muito"):** pack the beats on the measured clips; do not pad fixed 9 s windows. Each window is `[prev_end, prev_end + lead + clip + 0.27]`, with lead 0.12 (0.35 for the hook), which gives ≈0.4 s of voice-to-voice gap. The recap before the CTA lasts ≈1.2 s (CTA lead 1.2). `duration = ceil((cta_end + 0.45)·fps)/fps`, so the video length follows the narration (≈52–53 s for 6 beats), not 60.
  - To retime, rewrite only `script.json` windows from `timing.json` durations and rerun `tts.mjs`. Clips are cached by text + speed, so there are no new API calls.
  - Caveat: if a window budget becomes shorter than a cached clip, `tts.mjs` re-synthesizes (spends API). After retiming, use `scripts/shift.mjs` (copy to `tools/`): reapplies `script.json` windows to the existing `timing.json` with no Fish/whisper call.
  - Write numerals out in `script.json` ("80" → "oitenta"): TTS speaks the word and the whisper-based caption would not match.
  - Strips of many mini-cells must fit inside their card (12 cells: step 31 px in a 372 px card); an abstract logo must not read as a face (hollow diamond).
  - Dates/quantities ("30 dias", 3 cores + neutro) are illustrative: label them "exemplo" on art and in speech.
  - Re-render instead of cutting silences out of the MP4: cuts break animations and SFX at the seams.
  - Fish voice at speed 1.0 says ≈23–31 pt-BR words in 7–8 s.
- **Visual changes are bound to spoken words.** The concept name triggers the title and caption pill. The geometry word ("opostos", "igualmente", "quatro") triggers the point move, edge or interval arcs. The example appears on the word that introduces it, and each sampled colour ball pops on the word naming that colour.
- **CTA:**
  - The recap (six mini diagrams) plays silently from `End(last) + 0.1`.
  - The CTA voice line ("Salva e testa na próxima paleta.") starts together with the on-screen CTA text. Set the CTA `lead` so that `ctaText = L('cta') − 0.04`.
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
  - The spoken word lights up; scheme names get a PAPER pill.
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
- **Persistent-poster reels:** one poster object carries all 10 defects; each step toggles exactly one property (contrast, alignment, spacing…), so ERRO → CORREÇÃO → rótulo reads as progression and the final poster is the cumulative "after".

Lessons from "Kerning, tracking e padding" (3 steps, one persistent poster card + before/after zoom crops):

- **`syncverify.mjs` needs the whisper JSON as argv[2]** (bare run → `ERR_INVALID_ARG_TYPE`). Recipe: `ffmpeg -i final.mp4 -vn -ac 1 -ar 16000 /tmp/sv/final.wav` then `PATH=<ffmpeg-static dir>:$PATH whisper final.wav --model base --language Portuguese --word_timestamps True --output_format json --output_dir /tmp/sv` then `node tools/syncverify.mjs /tmp/sv/final.json`. Template now ships the script (needs `norm` exported by `lib.mjs`). Result here: 117/144 words, median 0.012 s, p90 0.079 s → pass.
- **Codex text review is pre-TTS:** its "pending" list (recalibrate to whisper, check overlaps, check levels) is a checklist for the build, not defects. Close each with evidence: timing.json present, contact sheet shows no caption/poster overlap, `check.mjs` peak −5.7 dBFS. Nothing real + MP4 newer than src/timing/mix = no re-render.
- **Teaching a visual defect:** blur ("squint test") must reveal the real gap — brighten only the offending glyph pair, leave others dark; correction changes only the pairs flagged. Show the same poster at identical positions across before/after so the delta is the lesson.
- **Numbers on art are layout-specific:** if narration says "suggestion/ponto de partida", label art "16 × 32 · ponto de partida", not a universal rule.
- **Contact sheet = `frames/sheet.png`** (6 frames at step triggers); read that one image instead of many PNGs.

Lessons from "A cor do ano da Pantone e sua história" (timeline poster 2000→2026 + counter, 46,3 s / 1390 frames):

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
