# Design craft for motion work

Distilled from the repo's design skills so motion, video and Reels look designed, not generated. It never overrides "REGRAS DO ANDRÉ" in `SKILL.md` or `principles.md`; louder suggestions from the sources are filed under "only when the subject asks" or dropped.

## Theme → source skill

| Theme (grep the `##`) | Source skill(s) |
|---|---|
| Direction before code | frontend-design, frontend-skill, canvas-design |
| Typography | frontend-design, apple-ai-chat-design, canvas-design |
| Color and contrast | brand-guidelines, theme-factory, frontend-skill |
| Composition and safe areas | frontend-skill, canvas-design, apple-ai-chat-design |
| Motion as design | frontend-design, frontend-skill, apple-ai-chat-design, site-veterinaria |
| Texture, depth, materiality | criar-site-arte, canvas-design, apple-ai-chat-design |
| Tokens, themes, DESIGN.md | design-md, theme-factory, brand-guidelines |
| Canvas philosophy | canvas-design |
| Subject-driven look | criar-site-arte |
| Anti-patterns (AI slop) | frontend-design, frontend-skill |
| Generative prompts | sora, enhance-prompt |
| Visual quality checklist | all |

generative-ui gave nothing for video (widget plumbing, CSP, inline sizing).

## André's constraints (win over everything below)

- Background `#000`; title and captions always `#FFF`; spoken-word emphasis by weight/opacity, never color or colored pill.
- Color only on red ✗ / green ✓ and, when the video is about it, the subject itself (color wheel, artwork). Else white or grey; in doubt, grey.
- No counters, ladders, progress bars, "1/5", "step N" on screen. Fixed CTA. Problem, animated transformation, benefit; no empty frames.
- "Accent" below means at most one, and only if the subject or fictional brand needs it.

## Direction before code

- Write three lines first. **Visual thesis**: mood, material, energy in one sentence. **Content plan**: hook, proof, detail, CTA, one job per beat. **Motion thesis**: 2-3 motions that define the feel (for example "one slow reveal, one snap correction, one settle").
- Ground the look in the subject's own materials, objects and vocabulary, not in a trending style.
- Token plan (4-6 named values): colors, type roles, layout concept (one sentence or an ASCII 9:16 wireframe), principles. Then challenge it: if it matches what you would make for any similar video, change that part.
- Spend boldness in one place: one memorable element, everything else quiet. Before rendering, remove one accessory.
- Show the real thing (real icon sets, real UI anatomy, real artwork). Decoration that explains nothing is cut.

## Typography

- **Hierarchy by scale**: one dominant line, one supporting line, optional micro-label; steps of 1.25-1.5x.
- **One family or two, clearly distinct** (heavy condensed display + quiet text, or serif + grotesque), chosen deliberately. House face for posts 16/18: Bricolage Grotesque 800 condensed, uppercase, white.
- **Minimum on 1080x1920**: captions 44-56 px+, labels never under 36 px, hero words 120-220 px. Test on a phone at arm's length.
- **Tracking/leading**: display -1% to -3%, leading 1.0-1.1; body 0, leading 1.3-1.5 (serif slightly more than sans); uppercase +2% to +6%.
- **Line length**: 14-22 characters per caption line on 9:16, 2-3 lines max (under 80 on wide frames).
- **Emphasis by weight/opacity**: 400 to 800 or 40% to 100% on the spoken word. Variable fonts animate the `wght`/`wdth` axes: `font-variation-settings: "wght" 400 -> 800`, ease-out, 120-200 ms. Reserve width (fixed box, tabular figures) so neighbors do not reflow.
- Type is an active element when it is the headline: scale, crop, per-word stagger, one big word carrying the frame.
- Avoid the tells: one word of a headline in italic/accent color, tracked ALL-CAPS eyebrow on everything, needless labels, middle-dot strings, spaced em-dash labels, trailing arrows. Numbering/dividers are information only for real sequences, and on-screen counters are banned here anyway.
- Character fonts (canvas-design, OFL): Bricolage Grotesque, Big Shoulders, Instrument Sans, Outfit, Gloock, Young Serif, Lora, Crimson Pro, Italiana, Jura, DM Mono, Geist Mono. Thin weights suit large quiet formats; heavy condensed suits hooks.
- Period scripts (cuneiform, hieroglyphs) use real Noto fonts, always with a Latin reading, never as body text.

## Color and contrast

- **Semantic roles**: base `#000`, text `#FFF`, secondary grey, muted grey, plus ✗ red and ✓ green (calm, desaturated enough to not shout). Name tokens by role.
- **Contrast**: WCAG 4.5:1 text, 3:1 graphics and large type. `#FFF` on `#000` is 21:1; secondary text never darker than about `#8A8A8A`. Measure against the worst pixel under the text, not the average.
- **Temperature** is the mood lever for neutrals (cool grey technical, warm grey editorial); pick one and keep it.
- **Single accent** (frontend-skill): exactly one hue plus tints, only if needed.
- Text over imagery needs a calm zone or scrim, never a glow (glow lowers contrast).
- **Only when the subject asks**: multi-hue palettes, gradients, neon cyan, purple or sunset blends (theme-factory Tech Innovation, Midnight Galaxy, Sunset Boulevard, Golden Hour). Legitimate for a color-wheel lesson, a painting, a fictional brand mockup.

## Composition and safe areas

- **Single focus** per beat; thumbnail test at 270x480. If the focus is not obvious, simplify.
- **Reading order and Z**: top to bottom on 9:16; depth supports it (subject front, labels, background). Animate in the order you want it read.
- **Grid**: one base unit (8 or 12 px at 1080 wide), multiples only; one alignment axis, do not mix centered and left.
- **Negative space is content**; fill it only with something that explains.
- **Safe areas, 1080x1920** (conventional, platform UI shifts): top 220-250 px clear, bottom 380-420 px (caption, CTA, account row), right 140-160 px (like/comment column), left 60-80 px. Key content in y 250-1500. Carousel 1080x1350: 80 px margins.
- Cardless by default; a card only when it is the thing shown (a UI mockup, a bag, a post).
- Image beats need a stable tonal area for text; avoid backgrounds with logos or typographic clutter.

## Motion as design

- **Orchestrate one moment, not scattered effects.** Fade-and-slide-up on everything and hover-lift on every card read as generated.
- **Staggered reveals**: 40-90 ms between siblings (60 default), total under about 600 ms, in reading order; the focal element first or last, never mid-pack by accident.
- **Timing hierarchy**: primary 400-700 ms, secondary 250-400, micro-feedback 120-200 (apple: 200 / 300 / 400 / 600). Exits about 60-70% of entry length.
- **Contrast of speed**: pair one slow move with one fast snap; hold 6-12 frames on key information so the eye can land.
- **Curves**: ease-out arrivals, ease-in exits, ease-in-out between rests, linear scrubs. Premium: long `expo.out`, 0-5% overshoot. Reveal: `cubic-bezier(.2,.7,.2,1)` (opacity .6 s, translate 22 px in .7 s, from the vet site); UI settle `cubic-bezier(.2,0,0,1)`.
- **Transformation over cuts**: before, morph, after, then label; animate one parameter of the same object (stroke, scale, offset) so the change is continuous.
- **Page entrance**: one hero sequence (subject, headline, support). **Scroll-linked**: one sticky or depth effect, scrubbed linearly, opacity/translate/scale only. **Hover/press**: -2 px lift, 0.97 scale, 150-200 ms; reveals that answer an action are welcome, ambient motion is not.
- Ambient loops and drifts off by default. Noticeable in a quick recording, smooth at 30 fps, consistent, removed if only ornamental. Live pages need a `prefers-reduced-motion` path.

## Texture, depth and materiality

- Only when it communicates material: real photo converted to albedo + normal + roughness + AO, lit by one consistent light. A flat tinted fill fails "studio-grade".
- One light direction per frame; one soft shadow with consistent angle and blur. The same grey shadow under everything is the SaaS tell.
- Layer object and background for parallax and a real cast shadow; text only in calm zones; measure contrast at the lightest and darkest texture percentile.
- Seamless tiles, no visible repeats, no upscaling.
- Glass (8-16 px backdrop blur, 85-95% opacity, hairline light border) fits floating bars in app mockups, not as a frame filler.
- Subtle grain (3-6%) over flat black can prevent banding; it must not read as texture.
- Mockups need anatomy (status bar, navbar, hero, buttons, bag handles and folds, tab bar with real icons), never anonymous rectangles. Icons from one real set (Lucide, 24 grid, uniform stroke); the defect is a parameter of the same icon.

## Tokens, themes and DESIGN.md

- One `tokens` object per video (JSON or CSS variables) for every color, size, duration, easing; series stay consistent by editing one file.
- DESIGN.md sections: **atmosphere** (adjectives, density), **palette with roles** (descriptive name + hex + function), **typography rules**, **component styling** (shape in words, shadow depth), **layout principles**. Explain the why. Add for video: **motion tokens** (durations, easings, stagger step, hold lengths) and **safe areas**.
- theme-factory presets (Ocean Depths, Sunset Boulevard, Forest Canopy, Modern Minimalist, Golden Hour, Arctic Frost, Desert Rose, Tech Innovation, Botanical Garden, Midnight Galaxy) are palette + font pairs. Only **Modern Minimalist** (charcoal/slate, white) fits the neutral rule; the others are references for subject-driven color. A custom theme: 4 colors, header/body fonts, a "best for" line.
- Brand application (brand-guidelines): dark/light base, mid/light greys, accent only on non-text shapes, display face for headings 24 pt+, text face for body, always a fallback font. A fictional brand in a mockup gets at most one accent, on its own UI only.

## Canvas philosophy

- Name the aesthetic in 1-2 words ("Geometric Silence", "Analog Meditation") and write 4-6 sentences on space, scale, rhythm, balance, hierarchy before executing. About 90% visual, 10% essential text.
- Craft signal: nothing overlaps or clips, margins consistent, alignment from refinement, as if an expert labored over it.
- Last pass: do not add elements; refine what exists. If the urge is a new shape or filter, ask how to make what is there more coherent.
- The subject can be a quiet thread (a motif, a proportion) rather than a literal picture.

## Subject-driven look

For art, period or place Reels:
- Map six axes: writing/type, material, architecture/shape, signature objects, colors, copy vocabulary. Material becomes surface, writing becomes type, architecture becomes shape (pyramid as arrow, ziggurat as stepped bars).
- Everything traces to a real, licensed image you looked at; verify identity, license, resolution; record credits.
- Colors are sampled pigments of the actual works, the allowed use of color. Signatures visible at rest; interaction only intensifies. No Papyrus, Trajan, Comic Sans, clip art or plastic gradients.

## Anti-patterns (AI slop)

- Cream background + high-contrast serif + terracotta (`#D97757`); near-black + one acid-green/vermilion accent; broadsheet hairline columns; identical rounded cards with one radius and one soft shadow; gradient washes; tracked-caps eyebrow on every heading; tinted near-black (`#0B0B0B`) in place of black; monospace for every small label. Pure `#000` here is a brief instruction, not the slop version.
- Inter/Roboto by default, purple-blue gradients, glowing blobs, stat strip + gradient hero, floating dashboards, pill soup, ornamental icons.
- Slide-up on everything, hover on every card, carousels without narrative, decorative loops.
- Copy: filler, design commentary on screen, repeated mood statements. Be specific and active; one job per line; cut 30%.
- The brief's own words always win, even when they ask for one of these looks.

## Generative prompts

For text-to-video/image models (sora, enhance-prompt):
- Short labeled lines: subject, setting, camera, lighting, palette (3-5 anchors), action, constraints, avoid.
- One subject, one action, one camera move; timing in beats ("0-2 s, 2-4 s"); a 4 s clip takes 1-2 beats.
- Visible nouns and verbs ("wet asphalt, neon reflections"), exact quoted text, straight-on framing for UI.
- Repeat invariants in each edit, change one thing per iteration, simplify when chaotic.
- For UI prompts add platform, page type, concrete component names and the DESIGN.md block; append "pure black background, white type, no gradients".

## Visual quality checklist

1. Visual, content and motion thesis written first?
2. One focal point per beat (thumbnail test)?
3. Only `#000`/`#FFF`/greys plus ✗/✓ or the subject's own color; no gradients, glows, carnival?
4. No counters, ladders, progress bars or numbering?
5. Captions at least 44 px, labels 36 px, contrast 4.5:1 at the worst pixel, inside safe areas?
6. Spoken-word highlight by weight/opacity only?
7. At most two families, per-role tracking and leading, no eyebrow or one-word-accent tell?
8. Motion staggered in reading order, speeds contrasted, ease-out arrivals, short exits, no ambient decoration, holds long enough to read?
9. Problem, animated transformation, benefit; no empty frames?
10. Mockups have real anatomy, real icons, real references?
11. One grid, nothing overlapping or clipped (checked on the contact sheet)?
12. Anti-pattern scan done, one accessory removed, refine rather than add?
