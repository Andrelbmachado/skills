# Pattern library

Each recipe: **Read** (what it communicates) · **Keys** · **Math/code** (pure f(t), seconds) · **Pitfalls** · **Verify** (what capture/lint should show). Units are arbitrary (px or world units); pick `g` in screen units from the desired fall time: `g = 2h / T²`.

Contents: Bouncing ball · Thrown arc · Roll without slipping · Spring / overshoot-settle · Pendulum · Overlap & follow-through · Anticipation → action → settle · Jump · Walk cycle · Run cycle · Idle / breathing · Falling leaf · Camera shake · Particles · Trails · Stagger · Loops · Kinetic type · Count-up · SVG draw-on · FLIP / shared layout · UI patterns (button, toast, modal, skeleton, scroll reveal)

## Bouncing ball

Read: material and weight through bounce height decay, timing and squash.
Keys: drop → contacts (fastest, squash 1–2 frames) → apexes (slowest, round) → last contact → roll → stop.

```js
// Closed-form ballistic bounce: y(t) and contact info, no per-frame integration.
function bounceImpacts({ h0, e, g, minApex = 0.01 }) {
  const v0 = Math.sqrt(2 * g * h0)
  const out = [{ t: Math.sqrt((2 * h0) / g), speed: v0 }]
  for (let v = v0 * e; (v * v) / (2 * g) >= minApex; v *= e)
    out.push({ t: out.at(-1).t + (2 * v) / g, speed: v })      // flight time 2v/g
  return out
}
function bounceY(t, p, impacts = bounceImpacts(p)) {
  if (t <= impacts[0].t) return p.h0 - 0.5 * p.g * t * t
  let n = 0
  while (n + 1 < impacts.length && impacts[n + 1].t <= t) n++
  if (n + 1 >= impacts.length) return 0                          // at rest
  const v = impacts[n + 1].speed, tau = t - impacts[n].t
  return Math.max(0, v * tau - 0.5 * p.g * tau * tau)
}
// x: separate channel — constant vx between impacts, lose a bit per impact
// (vx *= tangential, ~0.9), then decelerate on the floor: x += vr·τ − ½·μ·τ².
```

- Each apex = e² × previous; each interval = e × previous. Implied g = 8h/T² must be constant across bounces.
- Material: rubber e 0.75–0.85, squash 0.6–0.75 · tennis e ≈ 0.7 · bowling e 0.1–0.2, no squash, 1 tiny hop · beach ball: low g (long airtime), e ≈ 0.6, x drag · steel on steel e ≈ 0.9, no squash, many fast hops.
- Squash/stretch from velocity: `sy = 1 + (maxStretch−1)·min(1,|vy|/vRef)` in air, blend to `1 − (1−maxSquash)·min(1, impactSpeed/vRef)` within ±60 ms of contact; `sx = 1/sy` (2D) or `1/√sy` (3D). Pivot at contact point. Align stretch with the velocity direction on arcs.
- Rotation: θ = x / r while rolling or spinning; never rotate by a fixed rate unrelated to distance.
- Pitfalls: easing (`power2.inOut`) on y → floaty contacts; same duration per bounce → no energy loss; squash lingering many frames → mushy; ball penetrating floor during squash (pivot not at contact).
- Verify: lint `bounce:` line ✓ consistent, interval ratio ≈ e, contacts shrinking; onion: dense near apexes, wide near floor.

## Thrown arc / projectile

`x = x0 + vx·t`, `y = y0 + vy·t − ½g·t²`. To hit a target in time T: `vx = Δx/T`, `vy = (Δy + ½gT²)/T`. Stylized UI arc (e.g. item flies to cart): x with `power1.inOut`, y with `power2.out` up then `power2.in` down, or `y = lerp − 4H·u(1−u)`; add scale-down near the end and a small squash/bounce on arrival.

## Roll without slipping

2D: `angle = (x − x0) / r` (radians, sign by direction). 3D along a path: accumulate quaternion steps `axis = up × Δp`, `angle = |Δp| / r`; precompute a table over arc length so orientation is a lookup (pure in t). Rolling deceleration: `x = vr·τ − ½μτ²` until `τ = vr/μ`.

## Spring / overshoot-settle

Underdamped closed form (start at x0 with velocity 0, rest at target):

```js
function spring(t, { from, to, omega = 2 * Math.PI * 1.6, zeta = 0.5 }) {
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const env = Math.exp(-zeta * omega * t)
  return to + (from - to) * env * (Math.cos(wd * t) + (zeta * omega / wd) * Math.sin(wd * t))
}
// stiffness k, damping c, mass m → omega = √(k/m), zeta = c / (2√(km)); settle ≈ 4 / (zeta·omega) s
```

UI: ζ 0.7–0.9 (≤ 5 % overshoot). Playful: ζ 0.4–0.6. Overshoot ≈ `exp(−πζ/√(1−ζ²))`. CSS can bake a spring with `linear(...)` easing sampled from this function (20–40 stops). For live drag/release use a real spring library (Motion, GSAP inertia, react-spring) so velocity carries over.

## Pendulum, swinging sign

`θ(t) = θ0·e^(−t/τ)·cos(2πt/T)`, `T = 2π√(L/g)` (physical), τ = decay time. Organic version: add overlap on a hanging child (`child(t) = θ(t − lag)·k`). Mechanical metronome: linear-ish with hard turnaround, no decay.

## Overlap & follow-through (tails, hair, antennas, chains, cloth corners)

Pure-f(t) trick: link i samples the parent's motion delayed and damped: `angle_i(t) = A·decay^i · parent(t − i·lag)`. Lag 40–120 ms per link. For interactive motion use a damped spring per link (`x += (target − x)·(1 − e^(−λ·dt))` is frame-rate independent). Nothing stops on the same frame: secondary parts settle 100–300 ms after the main body.

## Anticipation → action → settle

Three beats: wind-up opposite direction (10–25 % travel, ~⅓ of action time, ease-in-out) → action (fast, ease-in into motion, often < ⅓ of total) → overshoot 5–20 % → settle (spring or `back.out`). Holds of 4–8 frames at the wind-up extreme sell intention.

## Jump

Crouch (anticipation, squash, 4–8 f @24) → launch (stretch along velocity, 1–2 f) → ballistic airtime (body round at apex, limbs/hair overlap) → pre-landing stretch → land squash (2–4 f, deeper for heavy) → recover with small overshoot. Root follows the ballistic f(t); squash pivots at the feet.

## Walk cycle (2 steps per cycle)

- Timing: brisk 12 f/step @24 fps (0.5 s), casual 14–16 f, tired/heavy 18–24 f.
- Keys per step: **contact** (heel strikes, legs widest) → **down** (weight lands, body lowest, ~¼) → **passing** (free leg passes the standing one, ~½) → **up** (push-off, body highest, ~¾) → next contact.
- Body bobs 2× per cycle (`y = −A·cos(4π·phase)`), hips rotate/tilt opposite the shoulders, arms swing opposite the legs, head lags slightly.
- In-place cycles: planted foot moves backward at exactly body speed. Moving root: planted foot stays fixed in world — sliding feet is the #1 walk bug. Check with `--track` on the foot: x must hold still during contact.
- Personality: lean, stride length, bounce amplitude, arm swing, timing asymmetry.

## Run cycle

6–8 f/step @24 (≈ 0.25–0.33 s), flight phase (both feet off ground), forward lean, bigger arm swing, lowest pose right after contact, no double support.

## Idle / breathing

Chest/scale `1 + 0.01–0.02·sin(2πt/3.5)`; add a second smaller component at an incommensurate period for life (`+0.005·sin(2πt/5.3)`). If it must loop perfectly, use only harmonics of the loop length (see Loops). Blink every 2–6 s (closing 2 f, open 3 f).

## Falling leaf / feather / paper

`y = y0 − v_term·t` (near-linear: drag-dominated), `x = A·sin(ωt + φ)`, tilt `rot = B·cos(ωt + φ)` (tilt leads sway), add slow noise to A/ω so it doesn't look mechanical. Flips: occasional larger rotation when sideways speed peaks.

## Camera shake

Trauma model: `trauma` 0–1 decays linearly (~1 s); `offset = maxOffset · trauma² · noise(seed, t·freq)` per axis (+ small roll). Use smooth noise (sum of sines with incommensurate frequencies or simplex), never `Math.random()` per frame (jittery, non-deterministic). 2–8 px UI, more for impacts; respect reduced motion (disable).

## Particles (burst, dust, sparks, confetti)

Seeded per-particle RNG (`mulberry32(seed·1000 + i)`) for angle, speed, life; closed form: `x = vx·t`, `y = vy·t − ½g·t²`, with drag `x = (vx/k)(1 − e^(−kt))`. Alpha/scale over life `1 − t/life`. Confetti: add flutter rotation and drag; sparks: high speed, short life, additive blend; dust: slow, low, expanding, fades. Many particles → Canvas/Pixi/InstancedMesh, not DOM.

## Trails / ribbons / motion blur

Sample the object's own f(t) at `t − k·Δ` for k = 1..N and draw fading copies or a polyline — pure, no history buffer. Smear frames (stretched shape along velocity for 1–2 frames) read as speed in 2D cartoon style.

## Stagger

`delay_i = i·step` (list), `|i − center|·step` (from center), `distance(cell, origin)·step` (grid/radial). Step 30–60 ms UI, cap total cascade ≈ 400–500 ms; long lists: stagger only the first ~8–10 visible items.

## Loops

Seamless requires matching position **and** velocity at the seam. Use only periodic terms whose period divides the loop length L: `sin(2π·n·t/L)`. Looping noise: sample 2D noise on a circle `noise(cos(2πt/L)·r, sin(2πt/L)·r)`. Ping-pong only for motions that read the same backwards (not walking, not falling). Verify with `--loop` (seam gaps ✓).

## Kinetic type

Split into chars/words/lines (GSAP SplitText, or spans with `aria-label` on the parent / `aria-hidden` on pieces). Enter: y 0.3–0.6 em + opacity, `back.out(1.4)` or `power3.out`, stagger 20–40 ms per char (60–100 per word). Mask reveal: line wrapper `overflow:hidden`, inner from `yPercent: 100`. Keep text selectable/readable at the end state; reduced motion: fade only.

## Count-up number

0.8–1.5 s, `power2.out`/`expo.out`, round per frame, `font-variant-numeric: tabular-nums` (prevents width jitter), announce final value only (aria-live on completion).

## SVG draw-on

`pathLength="1"` + `stroke-dasharray: 1; stroke-dashoffset: 1 → 0`; duration ∝ path length; ease-in-out; draw multiple paths sequentially with small overlap. Fill fades in after stroke completes.

## FLIP / shared layout

First (measure) → Last (apply final layout) → Invert (transform back to First) → Play (animate transform to identity). Use GSAP Flip, Motion `layout`/`layoutId`, or View Transitions API. Correct scale distortion of children/border-radius (Motion handles; manual FLIP needs counter-scale).

## UI patterns

- **Button press**: scale 0.96–0.98 on pointerdown (80–100 ms ease-out), release with spring/`back.out(2)` to 1; ripple optional. Disabled: no motion.
- **Toast**: enter from its edge 8–16 px + opacity, 200–250 ms ease-out (tiny overshoot ok); exit 150 ms ease-in; stack shifts with layout animation; pause timeout on hover/focus.
- **Modal**: backdrop fade 200 ms; panel scale 0.96→1 + opacity (or slide-up on mobile sheet) 250–300 ms ease-out; exit faster; move focus in, restore on close; content must not be animated in a way that delays reading.
- **Drawer/sheet**: translate from edge, 300–400 ms ease-out or spring; drag-to-dismiss with velocity threshold.
- **Accordion/height auto**: animate `grid-template-rows: 0fr → 1fr` or `interpolate-size: allow-keywords` + `height: auto`, or measure + FLIP; never animate max-height with a huge guess (wrong timing).
- **Skeleton shimmer**: linear gradient translate, 1.2–1.6 s loop; reduced motion: static.
- **Scroll reveal**: once, 16–40 px + opacity, 400–600 ms ease-out, threshold ~15–25 % visible; content must be visible without JS (progressive enhancement), never hide content waiting for an observer that may not fire.
- **Loading spinner**: linear rotation 0.8–1.2 s/turn; indeterminate bars ease-in-out; after ~1 s prefer progress/skeleton.
