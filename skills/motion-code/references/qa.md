# QA: verify and fix motion

## Evidence order (cheapest first)

1. `lint.txt` (numbers) — answers timing, easing, pops, settle, physics consistency.
2. `onion.png` — one image shows path/arc, spacing and squash at all stills.
3. `sheet.png` — poses/silhouettes/composition at each still, labelled with t.
4. Single `frames/t*.png` — only to inspect a specific moment closely.
5. Real-time run in a browser — only for perf/interaction feel the above cannot show.

Pick still times at meaningful beats (start, anticipation extreme, contact, apex, overshoot peak, settle, loop seam) with `--times`, not just evenly spaced.

## Symptom → cause → fix

| Symptom | Likely cause | Fix |
|---|---|---|
| Floaty / moon gravity | contacts eased; intervals don't shrink; g too low for screen size | real ballistic f(t); `g = 2h/T²` from desired fall time; lint `implied g` consistent |
| Robotic | linear on organic motion; all channels share one easing; everything starts/stops together | per-channel easing; offset secondary parts 40–120 ms; add anticipation/settle |
| Mushy / soft | easing everywhere, long squash, overshoot without cause | sharp contacts (1–2 frames), shorter settle, overshoot only with momentum |
| Sliding (feet, rolling ball) | rotation/foot not tied to distance | `angle = distance / r`; planted foot fixed in world while in contact |
| Pop / snap | discontinuity at a key, clip switch, loop seam, two engines writing one property, state left over after backward seek | lint `pop at t`; match pose+velocity at boundaries; one owner per property; reset state each seek |
| Jitter / shimmer | sub-pixel text, animating layout props, integer rounding in one channel only, noisy per-frame random, `dt` spikes | transform-only, `will-change` briefly, smooth noise, clamp dt |
| Stutter (dropped frames) | layout thrash, huge paint areas, too many DOM nodes, heavy shaders, GC from per-frame allocations | DevTools perf trace; move to Canvas/WebGL; reuse objects; lower DPR |
| Feels slow / delays user | durations too long for UI; waiting for animation before input | use defaults table; make interruptible |
| Unclear what happened | competing motions, no staging, no hold on the result | animate one thing first, hold the end state, reduce secondary motion |
| Loop hitches | position matches but velocity doesn't | periodic terms with period dividing loop length; lint `--loop` |
| Text unreadable in video | too short on screen, low contrast, outside safe area | ≥ 1.5 s + 0.3 s/word; contrast; safe areas |

## Check the encoded file, not just the page

- Frames from the MP4 itself: `ffmpeg -i out.mp4 -vf "select='eq(n,60)+eq(n,240)+...',scale=270:-1,tile=6x2" -frames:v 1 -fps_mode passthrough sheet.png` — one image, proves text/layout survived encoding.
- Unintended hard cuts: `ffmpeg -i out.mp4 -vf "select='gt(scene,0.08)',showinfo" -f null - 2>&1 | grep pts_time` — empty output = every transition is continuous.
- A downscaled sheet tile that looks wrong: confirm with `--probe` or a pixel crop before debugging; small tiles mislead.
- Multiply-blended colour over a dark fill is invisible until the fill goes — plan blend order, or the colour "pops" in.

## Determinism test (seekable scenes)

Hash the frame at t fresh, then after seeking from several later/earlier times — must match:

```js
// Playwright test
for (const t of CHECK_TIMES) test(`frame ${t}s stable under scrubbing`, async ({ page }) => {
  await openScene(page)                                  // goto + await window.__reel.ready
  const shot = async () => createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex')
  await page.evaluate(t => __reel.seek(t), t); const fresh = await shot()
  for (const from of [59, 31, 41, 0]) {
    await page.evaluate(([f, t]) => { __reel.seek(f); __reel.seek(t) }, [from, t])
    expect(await shot(), `from ${from}`).toBe(fresh)
  }
})
```
Choose source times inside scenes that leave non-trivial state (rolls, FX, camera moves). DOM scenes: compare a per-node snapshot (`el.style.cssText` + class + attributes) instead of a screenshot hash — it names the diverging node, and also catches state left on hidden nodes (stale opacity, lit caption letters) that no screenshot can see. Use `style.cssText`, not `getAttribute('style')`: the attribute text re-serializes (`left:290px` → `left: 290px;`) and gives false diffs. Unit-test pure motion functions too (impact times, restitution, roll angle = distance/r).

## Reduced motion

`capture.mjs … --reduced-motion --times <end>` → end state correct, nothing invisible, no large travel in the onion. In code: CSS media query, `gsap.matchMedia`, `MotionConfig reducedMotion="user"`, or a JS flag for Canvas/Three.

## Performance

- Real FPS: `--driver realtime` with `--probe "window.__fps"` where the page counts rAF callbacks per second, or DevTools Performance panel. Test at 4× CPU throttle for mobile realism (CDP `Emulation.setCPUThrottlingRate`).
- Three.js: probe `renderer.info.render.calls` and `.triangles`; Pixi: sprite counts.
- Mobile viewport: `--viewport 390x844 --dpr 3`; check that motion still reads and text does not collide.

## Video QA

`ffprobe` frame count = duration × fps; tile sheet of the whole video (`video-render.md`); spot-check beats with single-frame extraction; listen for sync if audio.

## Audit checklist (final pass)

- Reads without explanation; first mover leads the eye; clear start → action → settle.
- Timing/spacing match the requested weight and material; arcs where organic; nothing stops on the same frame unless intended.
- Silhouettes readable at extremes; loops seamless; clip transitions without pops.
- One engine per property; versions match lockfile; cleanup present; frame-rate independent at runtime.
- Reduced motion tested; focus/keyboard intact; no scroll trap; no flashes > 3/s; auto-motion > 5 s pausable.
- Evidence quoted in the delivery (lint lines, frames/beats inspected, commands run).
- Shell: under zsh, `for p in "a b"; do set -- $p` does not split — select frames with explicit loops (`for n in 0 1 898 899`). Pixel-run probes on frames from the MP4 are cheap evidence for stroke width/size claims.
- `capture --probe` keeps numeric fields only (strings are dropped from track.json). Encode flags/sets as numbers (e.g. overlapping pairs `i*10+j` packed as digits, 0 = none) and scan track.json with node.
- UI "before → after" reels: model the whole screen as `layout(progress)` (0 = bad, 1 = fixed) with one progress channel per principle; the before copy is `layout(ZERO)` and a per-frame rect-overlap probe proves no block crosses another during the transitions. Text rects for that probe come from glyph extents (`getBBox().width`, height ≈ cap-height 0.74·font-size), not the line box — line boxes reported touching labels that never overlapped. If the approved bad screen already has collisions (rows under a nav, content past the screen edge), compute the issue list once at `layout(ZERO)` as a baseline and report only new ones; assert zero at `layout(ONE)`.
- Before animating, re-diff `layout(ZERO/ONE)` against the approved PNGs (mean abs difference printed, e.g. ffmpeg `blend=difference,signalstats` YAVG — the metadata goes to stderr). Approved screens were regenerated between versions once, and only this diff caught it.
- Inspection zooms on a device mockup: never zoom the UI inside the phone (screen `viewBox`/inner scale) — viewers read it as the screen itself resizing and the edit loses credibility. Move the whole device (one transform, focus point → frame centre), keep the screen at native scale, and assert in the frame scan that the screen `viewBox` never changes. Titles/captions sit above the device on scrims; probe that the inspected rect, mapped through the device transform, stays inside the clear band between them while the shot holds.
