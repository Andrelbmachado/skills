# Video output: frame-exact render

A video is not a screen recording. Each frame i is rendered at `t = i / fps` by seeking a pure scene, so output is identical every run and never drops frames.

## Seekable page contract (web stack: Three.js/Canvas/DOM + GSAP)

```js
// reel.js — master clock: paused GSAP timeline + procedural tickers, all pure in t.
export function createReel({ duration }) {
  const tl = gsap.timeline({ paused: true })
  tl.set({}, {}, duration)                     // pin timeline length
  const tickers = []                           // fn(t) for procedural channels (physics, particles, waves)
  return {
    tl, duration,
    addTicker: fn => tickers.push(fn),
    seek(t) { t = Math.min(Math.max(t, 0), duration); tl.time(t, false); for (const fn of tickers) fn(t) },
  }
}
// main.js
window.__reel = { duration, fps, ready, seek: t => { reel.seek(t); renderer.render(scene, camera) }, debug }
```

Rules (each one came from a real bug):
- No `Math.random`, `Date.now`, `performance.now`, per-frame integration or `+=` accumulation in scene code. Seeded RNG only:
  `const mulberry32 = s => () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }`
- Every ticker resets the state it owns at the start of each seek (transforms, visibility, materials), so seeking **backwards** from a later scene leaves nothing behind. Order tickers explicitly (reset → scenes → derived state → camera).
- `ready` awaits fonts (`document.fonts.load(...)` + `document.fonts.ready`), textures, models. Never screenshot before it resolves.
- Rendering is synchronous inside `seek`; the capture waits 2 rAFs for compositing.
- The preview player is the only place allowed to use rAF; it just calls `seek(elapsed)`.
- Gate the preview UI off under capture (`?render` or `navigator.webdriver`), or its controls/fit-to-window scale end up in the frames.
- Timing windows with an open end: use `DURATION + 1`, not `Infinity` — `(t - Infinity) / NaN` makes eased progress NaN and the element silently never shows.

## Render

```bash
node ~/.claude/skills/motion-code/scripts/capture.mjs dist --seek "window.__reel.seek(t)" --ready "window.__reel.ready" \
  --to 60 --fps 24 --frames 0 --video out/reel.mp4 --viewport 1920x1080
```
Writes `<out>.part` and renames on success (a failed render never clobbers the last good file). H.264 yuv420p CRF 18, `+faststart`. Build first (`vite build`) and serve the production bundle, not the dev server (HMR overlays, slower).

Before a long render, check stills at the key beats (`--times`), run the determinism test (qa.md), then render.

## ffmpeg recipes

```bash
ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=width,height,r_frame_rate,nb_read_frames -of csv=p=0 out.mp4
ffmpeg -i out.mp4 -vf "fps=2,scale=320:-1,tile=6x5" -frames:v 1 sheet.png       # whole video in one image
ffmpeg -ss 12.5 -i out.mp4 -frames:v 1 f.png                                       # one frame
ffmpeg -i out.mp4 -i music.wav -c:v copy -c:a aac -b:a 192k -shortest final.mp4  # mux audio
ffmpeg -i out.mp4 -vf "fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif
```

## Audio sync

Beat time `t_n = n · 60 / bpm (+ offset)`; frame `round(t_n · fps)`. Put hits (contacts, cuts, text pops) on beats or 1 frame before (perceived sync). Extract onsets with `ffmpeg -i music.wav -af silencedetect` or a small analysis script if no BPM.

## Formats & framing

16:9 1920×1080 · 9:16 1080×1920 (keep text out of top ~12 % and bottom ~20 % for platform UI) · 4:5 1080×1350 · 1:1 1080×1080. Title-safe ≈ inner 90 %. 24 fps = filmic/cartoon cadence, 30 = social default, 60 = UI demos/games. Text on screen ≥ ~1.5 s + 0.3 s per extra word.

## Remotion (React video)

- `const frame = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig()`; values from `interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })` or `spring({ frame, fps, config: { damping: 200 } })`.
- Structure with `<Sequence from durationInFrames>` / `<Series>`; assets via `staticFile()`; fonts/data via `delayRender`/`continueRender`; random via `random(seed)`.
- No CSS transitions/animations or timers — everything from `frame`.
- `npx remotion studio` (preview) · `npx remotion still <Comp> --frame=45 f.png` (check beats) · `npx remotion render <Comp> out.mp4`. Check Remotion's license terms for company use.

## Manim (math/diagram explainers)

- `self.play(Create(obj), run_time=2, rate_func=smooth)`, `self.wait(0.5)`; continuous f(t) via `ValueTracker` + `always_redraw`.
- `manim -ql scene.py Scene` (fast preview) → `-qh` final; `-s` saves the last frame for a quick check; verify timing with the ffmpeg tile sheet.

- Looping video with sound: synthesize audio into a circular buffer of exactly D seconds (`idx = ((start+n) % N + N) % N`), allow negative cue times, and pick BPM so whole beats = D. Verify the seam with `ffmpeg -lavfi ssim` last→first frame ≈ consecutive-frame SSIM.

- **Frame count off-by-one:** `capture --to D - 1/fps` loses the last frame (floating `29.9667*30 = 898.99` → 899 frames, a 1-frame hole at the loop seam). Pass `--to D - 0.5/fps` and confirm `frames == D*fps` on the MP4 (`ffmpeg -i f.mp4 -map 0:v -c copy -f null -`).
- **Voice-driven timeline:** generate one TTS clip per section, trim silence, measure, then write the section starts to a generated `timing.js` the scene imports (pack `max(minAnim, clip + gap)`, speed up via the TTS `speed` param before resorting to `atempo`). When the brief asks for a slower/faster read, multiply every line's TTS speed by one global `scale` and let the video length follow the narration (`D = ceil(end · fps) / fps`) instead of squeezing a fixed duration. Every animation time is relative to its section start, so changing a line re-syncs everything. Duck the bed with `sidechaincompress` keyed by the voice; check voice ≈ 10 dB above the ducked bed with `ebur128`.
- **Word-level sync (action on a spoken word, karaoke captions):** TTS rarely returns word times — run ASR with word timestamps on each trimmed clip and align the *script* words to the ASR words by letter-level edit distance (DP), not greedy word matching: one misheard word shifts every later match. Script words the alignment cannot place = mispronounced take → regenerate that clip and keep the take with fewest misses. Derive every action/SFX/camera beat from those word times in one shared plan module that both the scene and the audio synth import.
- **Constant stroke under scale/perspective:** transform/project points in JS and stroke in screen space with one `lineWidth`; never `ctx.scale` stroked geometry. Verify on the MP4 by measuring white-run lengths across strokes per section.
- **ASR inherits PATH ffmpeg:** the `whisper` CLI shells out to `ffmpeg` on PATH, so a broken Homebrew ffmpeg makes it skip every clip silently. Symlink the static binary into a project `bin/` dir and prepend it to PATH only for the whisper call.
- **Bundled ffmpeg:** a Homebrew ffmpeg can break after a library upgrade (`dyld: Library not loaded … libx265`); project scripts should resolve `ffmpeg-static` from the skill's pinned install (or `$FFMPEG`), not `ffmpeg` on PATH.
- **Peak hierarchy (voice > ratchet > motion SFX > zoom > music):** give the softest family (zoom) its own class bus too, so its ceiling holds when cues overlap. Set each level upstream and only sum in the final mix (`amix normalize=0` + peak limiter); a final `loudnorm` re-levels everything and breaks the requested peaks. Normalize each SFX cue to its class peak, then run a peak limiter per class bus — two overlapping −15.5 dBFS cues summed to −12.3. A mono voice through `aformat=channel_layouts=stereo` lost ~3 dB in the mix (−6 → −8.3 dBFS); upmix with `pan=stereo|c0=c0|c1=c0`. Verify on the MP4 with `astats` over windows without speech and over speech-only windows.
- Secrets (TTS keys): read from env/untracked `.env`, never print; hash text+voice for the clip cache so the key never touches filenames.

- **Pronunciation overrides:** keep a `say` map (written word → spelling for the TTS, e.g. an English loanword spelled phonetically) applied only to the text sent to the TTS and to the cache hash; captions, alignment and the retake check keep the written form, because the ASR writes the phonetic spelling back as the written word.
- **Higher-resolution render without relayout:** keep the 1080×1920 composition and capture at `--dpr 4/3` → 1440×2560 (2K 9:16); confirm the frame size on a still before the long render.
