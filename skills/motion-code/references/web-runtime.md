# Web runtime engines

Check the installed major version (`package.json`/lockfile) before copying any API; consult official docs (Context7 MCP if available) when unsure.

## Choosing

| Need | First choice | Alternatives |
|---|---|---|
| Hover/focus/press, simple enter/exit | CSS transitions | WAAPI for imperative control |
| Enter/exit of `display:none`/`<dialog>`/popover | CSS `@starting-style` + `transition-behavior: allow-discrete` | Motion `AnimatePresence` |
| Sequenced timeline, SVG, text, complex choreography | GSAP timeline | anime.js v4, Motion `animate` sequences |
| Scroll-linked (scrub/pin/storytelling) | GSAP ScrollTrigger | CSS `animation-timeline: view()/scroll()` for simple cases; Motion `useScroll` in React |
| React UI, gestures, layout/shared element, exit animations | Motion (`motion/react`) | react-spring |
| Page/state transitions | View Transition API | Motion `layoutId`, GSAP Flip |
| Designer-authored vector animation | dotLottie / Lottie | Rive when it needs interactive state machines |
| Visual timeline editing of a scene | Theatre.js | GSAP + `__seek` debug scrubber |

Never two engines on the same property of the same element.

## CSS / WAAPI

```css
.toast { transition: opacity .2s cubic-bezier(.2,0,0,1), transform .2s cubic-bezier(.2,0,0,1),
         display .2s allow-discrete, overlay .2s allow-discrete; }
@starting-style { .toast { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .toast { transition-property: opacity; } }
```
```js
const a = el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
                     { duration: 200, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' })
await a.finished; a.commitStyles(); a.cancel()   // persist end state, release the animation
```
- `linear(0, 0.2 10%, …)` easing encodes springs/bounces in pure CSS (sample a spring f(t)).
- `@property --angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }` makes custom properties animatable (gradients, conic progress).
- Height auto: `grid-template-rows: 0fr → 1fr`, or `interpolate-size: allow-keywords` (Chromium only — feature-detect).
- Scroll-driven: `animation: reveal linear both; animation-timeline: view(); animation-range: entry 0% cover 30%;` — wrap in `@supports (animation-timeline: view())`, content visible without it.
- View transitions: `document.startViewTransition(() => updateDOM())`; style with `::view-transition-old/new(name)`, `view-transition-name` per element; cross-document `@view-transition { navigation: auto; }`. Feature-detect; skip under reduced motion.

## GSAP (3.13+: all plugins incl. SplitText, MorphSVG, DrawSVG are free in the `gsap` package)

```js
gsap.registerPlugin(ScrollTrigger, SplitText)
const mm = gsap.matchMedia()
mm.add({ ok: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, ctx => {
  const { reduce } = ctx.conditions
  const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.4 } })
  tl.from('.card', { y: reduce ? 0 : 24, autoAlpha: 0, stagger: 0.05 })
    .from('.cta', { scale: 0.9, autoAlpha: 0, ease: 'back.out(1.6)' }, '-=0.2')   // position param, not delays
})   // mm.revert() cleans everything
```
- React: `useGSAP(() => { … }, { scope: ref, dependencies: [...] })` from `@gsap/react` (auto-revert). Vanilla SPA: `const ctx = gsap.context(() => {…}, root)` → `ctx.revert()` on teardown.
- Prefer `autoAlpha` (opacity + visibility), `x/y/scale/rotation` (transforms) over `left/top`.
- ScrollTrigger: `{ trigger, start: 'top 80%', end: 'bottom 20%', scrub: 0.5, pin: true, toggleActions: 'play none none reverse' }`; `markers: true` while debugging; `ScrollTrigger.refresh()` after layout/async content; never hijack native scroll speed.
- Debug/scrub hook: `window.__seek = t => tl.pause().seek(t)` → capture with `--seek "window.__seek(t)"`.
- Labels + position parameter (`'<'`, `'-=0.2'`, `'label+=0.1'`) keep choreography editable; avoid chains of `delay`.

## Motion (formerly Framer Motion) — package `motion`

```jsx
import { motion, AnimatePresence, MotionConfig } from 'motion/react'
<MotionConfig reducedMotion="user">
  <AnimatePresence>{open && (
    <motion.div key="panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', visualDuration: 0.3, bounce: 0.15 }} />)}
  </AnimatePresence>
</MotionConfig>
```
- `layout` / `layoutId` for FLIP/shared elements; `whileHover`, `whileTap`, `drag` with `dragConstraints`; `useScroll({ target, offset: ['start end', 'end start'] })` + `useTransform`.
- Vanilla: `import { animate, scroll, inView } from 'motion'`.
- Motion runs transform/opacity on WAAPI when possible → capture's clock driver handles both paths.

## Lottie / dotLottie / Rive

- dotLottie: `new DotLottie({ canvas, src, autoplay, loop })`, seek `setFrame(n)`, `destroy()` on unmount. lottie-web: `goToAndStop(frame, true)`. Check unsupported AE features (expressions, some effects) and file size (< ~200 KB for UI).
- Rive (`@rive-app/canvas` or `webgl2`): `new Rive({ src, canvas, stateMachines: 'SM', autoplay: true, onLoad: () => r.resizeDrawingSurfaceToCanvas() })`; drive inputs via `r.stateMachineInputs('SM')`; `r.cleanup()` on unmount.
- Both: set explicit canvas size × DPR, pause when offscreen, provide static fallback frame for reduced motion.

## Accessibility (minimum bar)

- `prefers-reduced-motion: reduce` → remove travel, parallax, zoom, auto-loops, shake; keep fades/state changes ≤ 200 ms. In JS: `matchMedia('(prefers-reduced-motion: reduce)')` + `change` listener.
- Auto-playing motion longer than 5 s needs pause/stop (WCAG 2.2.2). Nothing flashes more than 3×/s (2.3.1).
- Focus stays where the user expects; animated content is in the DOM and readable at rest; never block input during non-essential animation; scroll effects never trap scrolling.

## Performance

- Animate `transform`/`opacity`; avoid per-frame layout reads after writes (batch reads, then writes). Verify in DevTools Performance (no purple layout bars per frame).
- `will-change` only on elements about to animate, removed after; too many layers costs memory.
- Pause loops offscreen (`IntersectionObserver`) and in hidden tabs (`visibilitychange`); GSAP: `tl.pause()`, Three/Canvas: stop the loop.
- Hundreds+ moving items → Canvas/Pixi/WebGL, not DOM.

## Lifecycle checklist

Timelines/tweens killed or reverted · ScrollTriggers killed · rAF cancelled · listeners/observers removed · Lottie/Rive destroyed · canvases released. In React StrictMode effects run twice: animations must be idempotent and cleaned up.
