# Web craft for motion

Distilled from the repo's web/front-end skills. Adds platform details, gotchas and verification recipes on top of `web-runtime.md` (engine choice, GSAP/Motion/Lottie, minimum a11y/perf bar), `qa.md` (evidence, determinism) and the "UI defaults" table in `SKILL.md`; not repeated here. Grep by `##` heading.

## Source map (topic -> origin skill)

| Topic | Origin |
|---|---|
| Fetch current platform guides before coding | modern-web-guidance |
| Cost model, layout thrash, will-change, CLS, touch/hover/focus, WCAG numbers | web-design-guidelines |
| Animated components (Radix `data-state`, Tailwind animate) | shadcn-ui |
| Chat micro-motion and its anti-patterns | web-components |
| Fixed timestep, `render_game_to_text`, `advanceTime` | develop-web-game |
| Browser/CLI verification, server lifecycle, OS screenshots | playwright, webapp-testing, screenshot |
| rAF batching in injected UI | chrome-extensions |
| Springs, haptics, Reduce Motion, parallax, depth | ios/ipados/macos/tvos/visionos/watchos/android guidelines, macos-patterns |

## Look up current guides first

Training data holds obsolete web patterns; the CLI returns vetted guides with fallbacks (network; allowlist `npx -y modern-web-guidance@latest *`):

```sh
npx -y modern-web-guidance@latest search "scroll entry effects"    # 2-5 words, one capability, no framework names
npx -y modern-web-guidance@latest retrieve "motion,scroll-entry-exit-effects"
```
Motion ids: `motion`, `animate-to-from-top-layer`, `physics-based-easing`, `scroll-entry-exit-effects`, `parallax-scroll-effects`, `same-document-transitions`, `cross-document-transitions`, `spinner`, `efficient-background-processing`, `defer-rendering-heavy-content`. Non-Baseline features need the guide's fallback. When the reply ships web code, end with a `### Modern Web Guidance` section: one bullet per applied id, quoting its rule.

## Rendering cost model

| Class | Properties | Rule |
|---|---|---|
| Compositor | `transform` (incl. individual `translate/scale/rotate`), `opacity`, often `filter` | default for anything that moves |
| Paint | colours, `box-shadow`, `clip-path`, `mask`, `border-radius` | small elements only; shadow trick: animate `opacity` of a pseudo-element holding it |
| Layout | `width/height`, `top/left`, `margin`, `padding`, `grid-template-*` | never per frame; FLIP (read First, apply, read Last, animate inverse transform) |

- Transform movement is not CLS; layout movement is. Reserve space (image `width/height`, skeletons at final size).
- `will-change` creates a layer, stacking context and fixed-position containing block: set it just before the animation, remove on `animationend`/`finish`, never `*`.
- `transition: all` is an anti-pattern; list properties. A sidebar that transitions `width` should use `translateX()`.
- `content-visibility: auto; contain-intrinsic-size: auto 600px` on long sections; `contain: layout paint` on widget roots. Thrash: all reads (`offsetHeight`, `getBoundingClientRect`) first, then all writes.

## rAF, observers, scroll work

```js
let raf, last = 0
const tick = t => { const dt = Math.min((t - last) / 1000, 0.05); last = t; step(dt); raf = requestAnimationFrame(tick) }
new IntersectionObserver(([e]) => e.isIntersecting
  ? (last = performance.now(), raf = requestAnimationFrame(tick)) : cancelAnimationFrame(raf), { rootMargin: '100px' }).observe(canvas)
document.addEventListener('visibilitychange', () => document.hidden && cancelAnimationFrame(raf))
```
- No analytics/fetch/layout per `scroll` event: `passive: true`, defer to `scrollend`. Injected UI (extensions): batch mutations (20 per rAF, `scheduler.yield?.()`), mount in a shadow root.

## Entry/exit and top layer

- `<dialog>`/`[popover]`/`display:none`: `@starting-style` + `allow-discrete` (after the shorthand, or `display, overlay` inside it) + `overlay` for top layer. Snippet: `web-runtime.md`.
- Firefox 129+ parses `allow-discrete` but did not transition `display` (bug 1882408): exit may vanish; accept or use WAAPI for that exit.
- `showModal()` already traps focus and inerts the page; animate `::backdrop` separately.
- `e.animation` on `animationstart/end`/`transitionrun/end` is the exact `Animation` (works for WAAPI, duplicate names, pseudo-elements; feature-detect `'animation' in AnimationEvent.prototype`). `animation: none` never fires `animationend`: if JS waits for it, branch on `matchMedia`.

## `linear()`, `@property`, WAAPI details

- `linear()` needs an explicit duration (spring ~0.5-0.8 s, bounce ~0.4 s); keep stops in a custom property and generate them from a spring function. Never on `opacity` (overshoot flickers) or layout properties. Fallback: plain `ease-out` declared first.
- `@property` for conic rings, gradient sweeps, counters (main-thread, small elements).
- WAAPI: `el.getAnimations({ subtree: true })` to list/pause/assert cleanup; `playbackRate` for slow-mo; `ScrollTimeline`/`ViewTimeline` are the JS twins.
- Use `translate`/`scale`/`rotate` separately when different triggers own different axes.

## Scroll-driven animations

```css
@media (prefers-reduced-motion: no-preference) { @supports (animation-timeline: view()) {
  @keyframes grow   { from { scale: .5; opacity: 0 } }
  @keyframes shrink { to   { scale: .5; opacity: 0 } }
  .card { animation: grow auto linear backwards, shrink auto linear forwards;
          animation-timeline: view(); animation-range: entry, exit; }
} }
```
- Entry keyframes fill `backwards`, exit `forwards`; scroll is the clock (duration `auto`); trim with `animation-range: entry 0% entry 60%`.
- `scroll()` = scroller progress (progress bar, shrinking header); `view()` = element crossing the viewport (reveals, parallax); `view(inline)` for carousels; cross-element via `view-timeline-name` + `timeline-scope`.
- Parallax: `translate` per layer over `cover`, small amplitude, far layers slower. Always `@supports`-gate; GSAP ScrollTrigger when essential (pin, snapping scrub).

## View Transitions gotchas

- Guard: `if (!document.startViewTransition) { update(); return }`.
- **One element per `view-transition-name` per state** or the transition aborts. For lists name only the clicked item, clear after `transition.finished`; `view-transition-class` shares styling.
- The API does not move focus: after `finished`, focus the new heading.
- Direction: set `data-direction` on `<html>` before the call; style `::view-transition-old/new(root)` per direction.
- Cross-document (`@view-transition { navigation: auto }`): `<link rel="expect" blocking="render">` for critical CSS avoids a first-frame flash; keep under ~300-400 ms.
- Reduce: `@media (prefers-reduced-motion: reduce) { ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none } }`.

## Accessibility rules that bite

| Rule | Do | Avoid |
|---|---|---|
| Reduced motion | Nested per rule: `@media (prefers-reduced-motion: reduce) { animation: none; opacity: .5 }`, or static by default and opt in under `no-preference`; keep opacity/colour feedback | Blanket `* { animation-duration: .01ms !important }`: web-design-guidelines recommends it, modern-web-guidance warns it can be more jarring and breaks sequencing; legacy apps only, then hand-check spinners |
| Pause (2.2.2) / flashes (2.3.1) | Pause control for auto motion > 5 s; stop offscreen/hidden; <= 3 flashes/s | Uncontrollable autoplay, strobing |
| Focus | `:focus-visible` ring (3:1, >= 2px) stays visible during transitions; move focus after the revealing transition ends | `outline:none` on animated controls |
| Targets / hover | >= 44x44 px (24 AA min); scale the visual layer, not the hit area; pair `:hover` with `:focus-visible`; gate polish with `@media (hover:hover) and (pointer:fine)` | Hover-only disclosure |
| Live text | `role="status"`/`aria-live="polite"` toasts, `role="alert"` urgent, `aria-busy` while loading; live text stays static | Per-letter splits without `aria-label` on parent + `aria-hidden` on spans |

## Component patterns

**Radix / shadcn** (Tailwind v3 `tailwindcss-animate`, v4 `tw-animate-css`; the shadcn skill documents only v3). Radix sets `data-state="open|closed"` and vars such as `--radix-accordion-content-height`:

```tsx
className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0
  data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 motion-reduce:animate-none"
```
- `Presence` keeps the node mounted until the **CSS animation** on `closed` ends; a bare `transition` will not delay unmount; `animation-name: none` (reduced motion) unmounts at once.
- Retime with `duration-150 ease-out` or `theme.extend.keyframes/animation` (`accordion-down 0.15s ease-out`). Accordion height via the Radix var is the accepted layout animation; custom collapsibles use `grid-template-rows: 0fr -> 1fr`.
- Prefer `transition-transform` over `transition-all`; `animate-spin`/`animate-pulse` get `motion-reduce:animate-none` (static tint) and `aria-busy`.
- If Motion/AnimatePresence owns a Radix part: `forceMount` + `asChild`, drop Radix animate classes.

**Chat micro-motion** (web-components): message enter `opacity 0->1` + `scale .95->1`, 200-300 ms ease-out; typing dots 1.4 s ease-in-out infinite, `opacity .3<->1`, delays 0/.2/.4 s. The reference ships `transition: all`, `transition: width` and no reduced-motion rule: fix before reuse.

**Custom elements**: start observers/animations in `connectedCallback`, release them (`io.disconnect()`, `anim.cancel()`) in `disconnectedCallback` (elements are re-attached when moved); expose `--fx-duration` and `::part()` for retiming; reduced-motion queries work inside shadow roots.

## Game / real-time loop (develop-web-game)

```js
const STEP = 1000 / 60; let acc = 0, prev = performance.now()
function frame(now) { acc += Math.min(now - prev, 100); prev = now
  while (acc >= STEP) { update(STEP / 1000); acc -= STEP }     // fixed timestep
  render(acc / STEP); requestAnimationFrame(frame) }            // alpha = interpolation
window.advanceTime = ms => { for (let i = 0, n = Math.max(1, Math.round(ms / STEP)); i < n; i++) update(STEP / 1000); render(1) }
window.render_game_to_text = () => JSON.stringify({ coord: 'origin top-left, +y down', mode, player, entities, timers, score })
```
- With `advanceTime` present the harness owns time: the rAF loop must not double-step. Seeded RNG; no `Date.now()`/`Math.random()` in `update`.
- Text state is the oracle (positions, velocities, cooldowns, win/lose, axis note); screenshots are evidence and must be opened. One centred canvas, background on canvas, `f` fullscreen / `Esc` exit with resize + input remap.
- Per change: `node "$WEB_GAME_CLIENT" --url http://localhost:5173 --actions-file "$WEB_GAME_ACTIONS" --click-selector "#start-btn" --iterations 3 --pause-ms 250` (steps `{ buttons, frames, mouse_x, mouse_y }`). Fix the first console error first; reset state per scenario; cover win/lose, boundaries, pause/restart. Interaction feel only; frame-exact output goes through `capture` (`qa.md`).

## Verifying web motion

| Need | Recipe |
|---|---|
| Reduced-motion path | `page.emulateMedia({ reducedMotion: 'reduce' })`; assert end state visible |
| Deterministic JS timers | `await page.clock.install(); await page.clock.runFor(600)` (PW >= 1.45) |
| Stable screenshot | `toHaveScreenshot({ animations: 'disabled' })`: finite animations jump to end, infinite reset |
| Wait for settle | `Promise.all(document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished))` |
| Mid-motion frame | pause all `document.getAnimations()`, set `currentTime = 150`, screenshot |
| Leak check | `document.getAnimations().length === 0` after teardown; no console errors |
| Server + script | `python scripts/with_server.py --server "npm run dev" --port 5173 -- python test.py` (`--help` first); headless Chromium; `networkidle`; recon screenshot/DOM before selectors |
| Ad-hoc / OS capture | `playwright-cli` open, snapshot, act on refs, re-snapshot after navigation; screenshot skill `take_screenshot.py --app "<App>" --mode temp` after `ensure_macos_permissions.sh` |

Evidence order: numbers (`qa.md`), frames, real-time feel. Finished sites: embedded browser, never Chrome.

## Platform comparison (what to borrow)

(general) = standard HIG/Material knowledge, not in the repo skills (they give principles, not milliseconds).

| Aspect | Apple (iOS/iPadOS/macOS) | tvOS / visionOS / watchOS | Material 3 / Android | Web translation |
|---|---|---|---|---|
| Timing | Springs by default, `.smooth/.snappy/.bouncy` (general); interruptible | tvOS focus ~0.15 s ease-in-out; visionOS dims immersion gradually | Durations (general): short 50-200 ms, medium 250-400, long 450-600, extra-long 700-1000 | `SKILL.md` defaults; spring via `linear()`/Motion |
| Easing | Spring response/damping | same | standard `(.2,0,0,1)`; emphasized-decelerate `(.05,.7,.1,1)` in; emphasized-accelerate `(.3,0,.8,.15)` out (general) | decelerate in, accelerate out, exit ~70% |
| Reduce Motion | `accessibilityReduceMotion`: drop decorative motion/parallax, cross-fade instead (`.animation(reduce ? nil : .spring(), value:)`) | tvOS parallax off; visionOS spatial transitions reduced; watchOS honours it | "Remove animations" (animator scale 0) respected | `prefers-reduced-motion` per component |
| Parallax / depth | Subtle, decorative | tvOS layers on focus: bg 1-2 pt, mid 3-5, fg 5-8; visionOS world-locked (head-locked UI causes sickness) | Layered surfaces, shared-axis / container transform | Layer travel <= ~8-16 px, far layers slower |
| Haptics | Impact / Notification / Selection generators; visual + haptic for key actions | watchOS `.click` Crown detents, `.success/.failure`, `.directionUp/Down`, `.start/.stop`, matched to urgency | `HapticFeedbackType.LongPress` | `navigator.vibrate` is Android-only; mirror with a visual pulse |
| State changes | iPad resize: animate layout, keep scroll; macOS success = subtle inline animation, no modal | watchOS Always-On: no animations, no layout shift on dim/wake | Predictive back: drive from `BackEventCompat.progress` 0..1 | Drive gesture motion by progress |

Cross-platform: motion explains cause and space, never decorates; gesture animations are interruptible and keep velocity; the reduced variant keeps meaning (cross-fade, colour) and drops travel, zoom, parallax, loops.
