# Principles → parameters

Each principle below is phrased as the knob you turn in code. Apply when it serves what the motion must communicate; ask "what does this motion tell the viewer?" before decorating.

## The 12 principles as knobs

| Principle | Knob in code | Typical values / note |
|---|---|---|
| Squash & stretch | scale along velocity axis; preserve area (2D `sx = 1/sy`) or volume (3D `sx = sz = 1/√sy`) | rubber squash 0.6–0.75, stretch 1.2–1.35; rigid objects: none. Pivot at the contact point so squash stays on the floor |
| Anticipation | short move opposite the action before it | 10–25 % of travel, ~⅓ of action duration; UI: 1–3 % scale-down or a 2–4 px pull-back |
| Staging | what moves first, contrast, framing, holds | one primary motion at a time; secondary motion smaller/later |
| Straight-ahead vs pose-to-pose | simulation/procedural vs keyed tweens | keyed for control, procedural for chaos (particles, cloth); combine: keyed body + procedural overlap |
| Follow-through & overlap | children lag the parent: `child(t) = parent(t − lag)` with decaying amplitude, or a damped spring per link | lag 40–120 ms per link; nothing stops at the same frame |
| Slow in / slow out | easing at poses where force starts/stops | NOT on gravity contacts (impact is fastest), NOT on constant motion |
| Arcs | path curves for organic motion | separate x (ease-in-out) and y (`-4H·u(1−u)`), or a bezier/path; mechanical things may move straight |
| Secondary action | small supporting motion | ≤ ½ amplitude of primary, offset in time |
| Timing | duration/frames between keys | sets weight & mood: heavy = slower to start, quicker to stop; light = floaty, longer airtime |
| Exaggeration | push amplitude beyond physical | scale all extremes 1.2–1.5× for cartoon; never for data viz/serious UI |
| Solid drawing / volume | keep proportions, perspective, volume | check silhouettes at extremes (`sheet.png`) |
| Appeal | clear silhouette, rhythm variation, asymmetry | vary timing between repeats (not 1:1 copies) |

## Timing vs spacing

- **Timing** = how many frames/ms between keys. **Spacing** = how far the value moves per frame. Same timing + different spacing = different feel.
- Spacing is what the onion skin shows: tight clusters = slow, gaps = fast. Gravity: tight at the apex, wide near the contact. Ease-out: wide then tight.
- At 24 fps: 1 frame ≈ 42 ms. Hits/contacts often 1–2 frames; holds for readability 4–12 frames; a pose must stay ≥ 3–4 frames to register.
- Animating "on twos" (12 fps poses in 24 fps video) gives hand-drawn texture; use stepped time `t = floor(t·12)/12` on selected channels.

## Choosing easing

| Cause / intent | Curve |
|---|---|
| Free fall, thrown upward | quadratic (`power2.in` down, `power2.out` up) — or real ballistic f(t) |
| Constant speed: spin, conveyor, scrub-to-scroll, progress | linear |
| Enters & comes to rest (UI enter) | ease-out (`power2/3.out`, `cubic-bezier(.2,0,0,1)`) |
| Leaves & disappears (UI exit) | ease-in (`power2.in`), shorter |
| Moves between two rest points on screen | ease-in-out |
| Has momentum, elastic, playful | spring / `back.out` (overshoot then settle) |
| Impact then rebound | ballistic arcs, not `bounce.out` unless stylized |
| Mechanical/robotic on purpose | linear with hard stops, or stepped |

`elastic` and `bounce` presets read as toy-like; reserve for intentional cartoon. Springs are the best default for interactive drag/release because they keep velocity.

## Style presets (change these numbers together)

| Style | Anticipation | Overshoot | Squash/stretch | Easing | Holds | Timing |
|---|---|---|---|---|---|---|
| Realistic | minimal | physical only | rigid or subtle (≤ 5 %) | physics | short | physical |
| Cartoon | strong 20–30 % | 20–40 % | 30–40 % | snappy in/out, fast actions | long, pose-y | exaggerated contrast fast/slow |
| Mechanical | none | none or tiny bounce | none | linear + hard stops / steps | exact | uniform |
| Elegant / premium | subtle | 0–5 % | none | long ease-out (`expo.out`), soft | breathing room | slower, 400–700 ms |
| Elastic / playful | small | 10–25 % spring | 10–20 % | spring ζ 0.4–0.6 | short | quick |

## Weight cheat sheet

- Heavy: slow to start (long ease-in), short decisive stop, little bounce, ground reaction (shake/dust), low restitution.
- Light: quick start, long airtime, drifts, many small bounces or air drag, high restitution.
- Big objects move slower in screen terms; small objects can be snappier.

## Translating principles to UI

- Anticipation → tiny press-down before a launch; staging → animate the element the user should look at first; follow-through → toast settles with 2–4 % overshoot; squash/stretch → playful buttons only, never on navigation/text.
- Motion must clarify state (where it came from, where it went, what changed). If removing the motion loses no information and no delight, cut or shorten it.
- Never delay the user's next action for an animation; input stays responsive mid-animation (interruptible, or retargetable springs).
