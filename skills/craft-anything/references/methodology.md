# Craft Anything rebuild methodology, distilled for a Claude Code skill

Source: `crates/ai/src/rebuild/**`, `crates/engine/src/{clean_room.rs,settings.rs,tools/web_common.rs,tools/website_tools.rs,tools/browser_tools.rs}`, `docs/claude-code.md`, `docs/pitfalls.md`, README.
Every number below comes from the code. "Tool" names like `web_site_capture` are the app's MCP tools. The "Claude Code equivalent" notes say how to do the same thing with Playwright, ffmpeg and Claude Code's own tools.

---

## 0. Workspace layout (keep it, the prompts reference it)

```
<project>/
  capture/            Study output (read-only evidence for the builder)
    README.md         start here: human summary (colours, fonts, spacing, layout per width)
    capture.json      design tokens + per-width layouts + outline + headings + links + text
    screenshot-<w>.png  full-page screenshot per width
    noise-<w>.png     mask of self-changing regions (white = ignore)
    page.html         rendered HTML (Deep mode only)
    how-it-works.md   Deep only: JS modules, routes, requests, 10 s of network/console/WebSocket
    states/states.json + state-<n>.png      menus/popups/tabs opened at desktop width
    states-<phone w>/ the same at phone width (e.g. states-390/)
    routes.json + routes/<slug>/...          other pages, captured the same way
    runs/<input>.json console programs: what each input printed + exit
    window.png, ui-tree.json                 app window 15 s after launch + its control tree
  reference/          pictures the person supplied of the original
  app/                THE ONLY folder the builder may write
    MECHANICS.md, mechanics.json, CREDITS.md, README.md, shots/now.png
  checks/round-<N>/   the check's own captures of the build (same file names as capture/)
  investigation/      open questions ("unknowns") recorded by the builder
```

---

## 1. Phases and their inputs/outputs

Pipeline (mod.rs header): **Study → Build → Check → Refine (loop) → Ready.**

### 1.1 Study (study.rs), before the first build
**Website target:**
1. Open URL in a private browser; delete any old `capture/`.
2. `web_site_capture` into `capture/` at widths **[1440, 768, 390]** (`build.web_widths`, at most 4, each 320..3840) with `noise_pass: true`. Per width:
   - viewport `w × 900`, settle **900 ms**;
   - "reveal" scroll: step `max(200, 0.8·innerHeight)`, 120 ms pause per step, at most **5 s**, force `loading=lazy` images to eager, wait for images, scroll back to top, 200 ms;
   - blueprint (first width only): design tokens (backgrounds, text_colors, fonts, font_sizes, spacing, each as `{value,count}` most-used first), outline (tag/role/position in CSS px), headings h1-h3 (≤120), links, forms (type/name/label/placeholder only), asset lists, `text` (body innerText ≤30 000 chars), `health` (console errors, failed requests), `a11y` (unnamed controls, images without alt, lang, landmarks);
   - layout (every width) into `layouts[]`: `{width, page_w, page_h, type:{h1,h2,h3,body px}, blocks:[{tag, y, w, h, pad:[t,r,b,l], per_row, heading, gap, background(hex), column:{max_w, x, w, pad}}]}` for `header,nav,main,footer,section,article,aside` (≤60 blocks, height ≥24). `per_row` = most visible children sharing a top edge (±2 px) whose width ≥ max(40, 15% of block).
   - full-page PNG clipped at `max_height` **12 000 px** → `screenshot-<w>.png`;
   - noise pass: 2 more shots at +900 ms and +1300 ms; tiles that changed (threshold 24) → `noise-<w>.png`.
3. `web_page_states_capture` (menus, pop-ups, tabs opened one at a time) at desktop width → `states/`, and at the phone width (narrowest < 768) → `states-<w>/`. Failure is reported, not fatal.
4. Other pages: up to `build.max_pages` (default **4**, hard max **12**) same-origin links from `capture.json.links` (http/https, same host, not a file unless .html/.htm, not the start page, each path once), then one level deeper while there is room. Each into `capture/routes/<slug>/` (no HTML), list in `routes.json`.
5. Deep only: `how-it-works.md` (JS analysis with source maps + 10 s watch of requests/console/WebSocket).
6. Clean room: `visitor_view` strips meta, breakpoints, stylesheets, scripts, fonts, request lists, class names, query strings; keeps screenshots, visible text, measured layout/styles, links, forms.

**Local program target (Deep):** triage the program; locate the main exe in a folder; if a game folder, detect the engine ("Made with X, the giveaway: …") and inventory maps/textures/models/sounds/settings; JS/Electron → app map; start Ghidra analysis and wait. Runtime study (setting): console program → run with inputs; windowed → launch, wait **15 s**, `window.png` + `ui-tree.json`. All written to `capture/README.md`.
**Local program (Clean room):** nothing read. README says so; optionally one launch → `window.png` (+ ui tree).
**No target:** `capture/README.md` = "No target. Build from the request alone."

**Claude Code equivalent:** Playwright script doing exactly steps 2-4 (set viewport, scroll-reveal, `page.evaluate` for tokens/layouts, `page.screenshot({fullPage:true, clip})`, two delayed re-shots → noise mask); write `capture.json` + README.md yourself.

### 1.2 Build (brief.rs), the builder's first message
Assembled in this order:
1. `You are the builder… rebuilding software for a person who doesn't code.`
2. `Their request: "<request>"`, `Target: …`, working folder.
3. Capture paragraph (website Clean/Deep, program Clean/Deep, see §2.3).
4. `What to build: <kind goal>` (§3).
5. `How to build it, unless their request says otherwise: <stack steps + library steps>` (§4).
6. "How to work" steps (§2.2).
7. RULES (§2.1).
8. Kind-specific sections (routes list, states list, game steps, screenshot/self-test contracts, assets note).
9. Pictures note if `reference/` has files; start-files note; `The person also said: "…"`.

Files the builder must write (depending on kind): `app/**` project; `app/MECHANICS.md` (human) + `app/mechanics.json` (machine) for games and Deep-mode apps; `app/CREDITS.md` (generated assets, original files used); `app/README.md` starting with the private-use line when original game files are used; `app/shots/now.png` (own screenshot). Website builds must output static files in `app/dist`, `app/out` or `app/build` (`index.html` at top, each page at its own path), or plain `index.html` in `app/` with no package.json.

### 1.3 Check (kinds/*, check.rs, self_check.rs)
Checks run in order and **stop at the first one that fails** (a screenshot needs a build). Output goes to `checks/round-<N>/`. The builder can trigger the same checks mid-turn with `rebuild_check` (self-check). Its report lists: each check passed/failed + `X% alike (needs Y%)` + note; the failed claims ("These must hold before it can pass"); the unknowns ("Not compared, so it can't pass yet"); up to 8 open questions; paths of the build's pictures; and finally either "This would pass. Finish what you're doing, then reply." or "Not good enough yet: fix what it lists, build again, and check again".

### 1.4 Refine / Ready (mod.rs)
See §7. When it is done, the status is `Ready: about 93% like the original, 5 of 5 claims hold.` (or `all 4 checks pass…`), plus `N questions about the original are still open.`

---

## 2. Builder prompt (quoted or closely paraphrased)

### 2.1 RULES (verbatim intent)
- **The request comes first.** If it names a language, framework, engine, library or platform, use exactly that. The default stack applies only to what the request leaves open. Don't switch away from the requested stack to get past a failing build; fix the build.
- **Change files only inside `app/`.** Everything else is read-only evidence.
- **Rebuild the layout, styling and behaviour yourself from the evidence.** Don't copy logos, photos, brand names or long passages of text unless the person confirms they own the original or have permission (ask once if it matters). Otherwise use neutral placeholders: simple shapes or gradients for images, short sample copy for text.
- **Ask only about choices that really change the result**, with 2-4 short options. Never ask about technical details you can decide yourself.
- **Build what was asked.** If part won't fit this version (online co-op, a whole mode, another platform), ask before leaving it out, with the smaller version as one option. Never drop it silently.
- **Never start dev servers, watchers or anything that doesn't exit** (`npm run dev`, `npm start`, `vite`, `cargo watch`).
- **Finish with 3-5 plain sentences:** what you built, what differs from the original or is still unknown, and one idea for what to ask next. No code and no file paths.

### 2.2 "How to work" steps
1. Study the evidence overview-first (README and summaries before details). Where a gap matters, ask a focused follow-up instead of guessing:
   - Deep: capture another width or an opened state into a new `checks/` folder, inspect a page or bundle, look up strings/functions by exact name, read a game's settings/files;
   - Clean: capture another width/opened state of the website, or ask the person. "Never open, read, list, fetch, run or decompile its files, its folder, its pages' code or its program, with any tool."
   Don't repeat a call that already answered. **Record each unanswered question** (`core_unknown_add`: question, probes that would settle it, severity). Close it when answered (`status resolved`, the resolution, evidence ids). Until then, say what you did instead (estimate, placeholder, question). "Missing evidence is never proof, so mark what you estimated."
2. TodoWrite checklist: 3-7 plain-language steps with an `activeForm` ("Drawing the map"), kept updated.
3. Build in `app/` and fix errors until the build succeeds.
4. Test against the original with `rebuild_check`, then fix, rebuild and re-check until it says it would pass.
5. Before replying, review the checklist and the open unknowns. Settle what one more look can settle, and put the rest in the summary.

### 2.3 Capture paragraph, website (Clean room, verbatim core)
> capture/ holds what a visitor of the live site sees … README.md (start here …), capture.json (design tokens with colours in hex, spacing and content widths, the layout measured at each width (`layouts`: page width, heading and text sizes, each section's padding, gap, content column and items per row), a layout outline with positions in CSS pixels, headings, links, form outlines, picture sizes and the visible text), screenshot-<width>.png for each width (open them all with the Read tool and look closely), and noise-<width>.png (white squares … aren't compared, so match how they look, not the exact frame).
> **Match it exactly, not roughly:** take colours, fonts, text sizes, padding, gaps, corner radii and content widths from capture.json as exact values (make them the project's theme tokens rather than a library's defaults), use the same font families (or the closest free ones), change the layout where the screenshots at each width show it changing (sections stack, columns per row and the navigation switch), and **never let the page scroll sideways on a phone**.

Deep adds `breakpoints`, font files and `page.html`. It also says to load the same font families and switch the layout at the same breakpoints. Deep tools: open other pages, inspect structure/scripts/network/console, list event listeners on a control, measure coverage, record a walkthrough, and restore JS sources. "Rebuild the behaviour you learn in your own code; **never paste the original's code into app/**."

Program (Clean): build from the request, the description, `reference/` pictures and `capture/window.png`; ask about anything you can't see. Program (Deep): read settings/scripts for the real numbers (speeds, health, weapons, modes, controls), open a few pictures for style, never modify the target folder, and decompile.

### 2.4 Pictures note (when `reference/` has files)
"Open every one with the Read tool before you plan and match: camera/view, on-screen layout (menus, HUD, panels) and where each part sits, colours and lighting, look of surfaces/characters, proportions and scale. Make your own artwork in that style; don't trace or copy logos, characters or other artwork." For apps and games: "After each build, run the program with `--screenshot` to `app/shots/now.png`, open it, compare with each picture, fix the biggest differences first." Later rounds add: "Keep matching the N picture(s)… compare a fresh screenshot before you reply."

### 2.5 Follow-ups
- Change request: `The person asks: "<msg>"`. Make the change in app/, rebuild, fix errors, run rebuild_check, and reply in 1-3 plain sentences.
- Added mid-turn: "While you were working, the person added: …. Take this into account now…"
- Resume: "Your last run stopped before it finished… see what's done (checklist and unknowns), finish, rebuild, check."
- Empty app/ after a turn: "The check found no project: app/ has no files… Create the project's files now… Reply with the exact command you ran and the last lines of its output. Say something is built only when that output says so."

---

## 3. Per kind

Kind detection scores (highest wins): Game: an engine stack = 200, the words "game/gameplay/steam/level/player" = 60. Website: URL target = 100, "website/web page/landing page/site" = 50, a site stack with no target = 30. App: the fallback, 1.

### 3.1 Website (`WebsiteKind`)
- Goal: "a website that looks and behaves like the original". Default stack: **Builder's choice**.
- Brief extras: the other pages (`path (capture/routes/<slug>/)`, "Rebuild each at the same path, with the same navigation between them") and the opened states ("Make them open and look the same way at each width").
- **Check `WebVisualCheck`** (only with a URL target; with no target just `BuildCheck`):
  1. Find the site dir (`dist/`, `build/`, `out/`, or `index.html` in app/ with no package.json); serve it on loopback.
  2. For the start page and every route, open it (settle 1200 ms) and capture it the same way at the same widths into `checks/round-N/` (and `routes/<slug>/`).
  3. Compare each width's screenshot pair with `web_pixels_compare {common_area:true, tolerance:24, ignore: noise-<w>.png}`:
     - crop both to the shared top-left area (min width × min height);
     - **layout** = share of 16×16 tiles whose mean RGB differ by ≤24 per channel (masked tiles skipped);
     - **detail** = mean SSIM of luminance over 8×8 windows, after downscaling so the longer side is ≤512 px (masked windows skipped);
     - **width score = (layout + detail)/2 × 100**.
  4. Page score = mean of its widths. **Overall similarity = mean of page scores.**
  5. Advisory notes (they don't change the score but go to the builder):
     - text likeness = Dice over word counts (words ≥2 chars, lowercased), plus missing headings (≤8) and the most frequent missing words (≤12);
     - structure likeness = LCS of the landmark/heading/list/media/control sequence (`header, nav, main, footer, section, article, aside, form, h1, h2-h4, list, img, video, button, form field`), 200·common/(a+b), plus missing parts (≤6);
     - design notes: the top 6 background and text colours absent in the build (same colour = every channel within 3); the main font family differs (next/font `__Figtree_x` → Figtree); the top 8 font sizes and spacing values absent; per width: horizontal scroll, h1/h2/body size differs by >2 px, and per section padding differs by >4 px, `per_row` differs (not nav/header), or content column `max_w` differs by >8 px or is missing. Sections are paired by (tag, heading) in order, then by tag in order;
     - health: console errors and failed requests (compared by path) that the original doesn't have; more unnamed controls or alt-less images than the original; missing `lang`.
  6. **Claims (each must hold to pass):** per width, "doesn't scroll sideways" (`page_w ≤ w+1`, only where the original doesn't); "logs no errors the original doesn't"; "loads every file it asks for"; "has the original's landmarks"; for each opened state, "<the 'Menu' button> opens in the build at W px" (the build's states are captured with `max_states: 8`, paired by kind + label, and each pair's pictures compared the same way).
  7. **Unknowns** (blocking): any width the original was captured at but couldn't be compared, or a state that couldn't be opened or compared.
- Refine prompt (website): "compared with the original, your build looks S% alike (<note>). Your screenshots are in checks/round-N/ … the original's are in capture/. Open each pair with the Read tool, fix the biggest visible differences first (layout and section order, spacing, sizes, colours, fonts, missing parts), fix the padding, items per row, sizes, colours and fonts the check names at each width with the exact values it gives, add any missing headings or words it lists, build it again, and reply with 1-2 plain sentences."

### 3.2 Game (`GameKind`)
- Goal: "a playable game that plays like the original: the same rules, controls, numbers and feel". Default stack: the original's own engine if detected (Deep: Unreal/Godot), else **Unity**. "in/with/using <engine>" picks the engine.
- Game steps: start `app/MECHANICS.md` with **every number that shapes play**: movement (walk/run speed, acceleration, friction, air control, jump height, gravity, crouch), camera (FOV, sensitivity), each weapon (damage, fire rate, magazine, reload, spread, recoil, range), health and armour, respawn, scoring, modes, timers, and AI behaviour. Give each value's source (file, function address, evidence id) or mark it `estimated`. Match the controls, key bindings, HUD placement and mode rules. "We can't watch the original running… use reference/ pictures; ask the person about behaviour."
- **Mechanics contract** (`app/mechanics.json`): `{"version":1,"values":[{"name":"walk speed","group":"movement","value":4.5,"unit":"m/s","source":"function 0x140012a0"},{"name":"crouch","group":"controls","value":"hold","estimated":true}]}`. **MechanicsCheck** fails if the file is missing, empty, too large or unreadable. Every non-estimated numeric value must appear **as a literal** in the code/data under app/ (compared to 7 significant digits, sign ignored; skips target/node_modules/build/dist/bin/obj/library/temp/shots/addons/binaries/intermediate/saved/deriveddatacache; files ≤2 MB, ≤32 MB total). Each such value is a claim (≤60).
- **Screenshot contract** (apps and games): "Give the program a `--screenshot <file.png>` option: start normally, draw about **120 frames**, save the window's picture as a PNG to that file and exit." **ScreenshotCheck** runs it (time limit **90 s**) into `checks/round-N/screenshot.png`. It fails if there's no program, no file, an unreadable PNG, or a **blank** picture (64×36 downscale, luma std-dev < 2.0). Otherwise it passes. Likeness to `reference/` pictures or `capture/window.png` = (SSIM + block similarity with 16 px tiles, threshold 24)/2 ×100 at **640×360**. This is **advisory** unless `build.picture_good_enough` is set (default None). For Godot, pass the option after `--`.
- **Self-test contract**: "`--self-test <file.json>`: start a game the way a player would, drive the player with scripted input for a few seconds, measure from the game's own state whether each step of the core loop works, save and exit": `{"version":1,"steps":[{"step":"move","passed":true,"detail":"walked 3.1 m forward"},{"step":"act",…},{"step":"hud",…}]}`. Required steps: **move** (the player moves), **act** (the main action works), **hud** (the on-screen info is drawn). A missing step = "not tested" = a failed claim. Extra steps become claims too (≤20). Output: `checks/round-N/self-test.json`.
- Checks: Build → Screenshot → SelfTest → Mechanics (not for a website-targeted game) → Credits (Deep + local only: `app/README.md` must start with the exact private-use line and `app/CREDITS.md` must be non-empty).
- Assets: Clean = "take nothing from the original game's files; make your own simple versions in the original's style (same role, size, palette, feel), without logos/trademarks". Generated assets (paid, opt-in): GLB at ~500-1500 faces for props, 2000-5000 for weapons/vehicles, 6000-15000 for main characters; spend the budget on what the player sees most; every asset is an original design ("never a recognisable character, logo or brand artwork"); list each in `app/CREDITS.md`. Deep with the person's own copy: original readable files may be used 1:1 for private use, **never decrypt/crack/bypass protection** (encrypted .pak/.utoc/.ucas stay closed and are recreated instead).

### 3.3 App (`AppKind`, fallback)
- Goal: "a desktop app with the same core features". Default: **Rust + egui (eframe)**. Console program (Deep only) → **Rust (console)**.
- Brief: screenshot contract, or for a console program the RUNS brief: "make the rebuild a console program that prints the same text for each input (its own name may differ) and exits the same way". Deep + local adds decompile-first + mechanics contract.
- **RunsCheck** (console): inputs `no arguments`, `--help`, `--version`; each run has an **8 s** timeout. Per input there are 2 claims: the same exit (code, or "still running"), and the output words match **≥80%** (Dice over word counts, with both programs' names replaced by "program"). Files go to `checks/round-N/runs/<input>.json` (`{name, arguments, reason, exit_code, lines}`).
- **ScreenshotCheck** (windowed), plus when `capture/window.png` exists: launch the build normally, picture it after 15 s, and compare. The control tree's labels (case, `&`, trailing colon and AX prefix ignored) give a Dice similarity (only if the original has ≥3 labels) and one claim per original interactive control (button, menu, menuitem, tab, checkbox, radio, combobox, textfield, link, slider…, ≤20): "It has the original's 'Copy' button".
- Checks: Build → Runs → Screenshot → Mechanics (Deep + local only).

### 3.4 Own project (edit in place)
- The workspace folder is the app ("wherever these instructions say app/, use ./"). "Keep what works and change only what the request needs; never start over, delete or replace their work"; add nothing for the tool's sake (no `--screenshot`, no mechanics sheet). Stack = "keep to what the project already uses".
- Checks: **OwnBuild** (the engine's build, else the toolchain's `build`, else a static site; unknown → passes with "Nothing was built"), then **OwnTests** (toolchain `test`; "no tests ran" outputs are not failures).
- Start-from files (not in place): "read them first, build on what they show, bring into app/ what the app uses; leave the originals unchanged."

---

## 4. stacks.toml

Stack choice = (1) a kind-specific named stack (a game engine "in/with/using X"); else (2) the first `[[stack]]` in table order whose `asked_by` phrase appears in the request (normalised: lowercase, punctuation → spaces, padded with spaces, so "Next.js," → " next js "); else (3) the kind default. After each turn, the recorded stack is updated from `package.json` deps (`uses`/`needs`) to what was actually built. Libraries (`[[library]]`) whose phrases appear are appended if they are compatible with the stack.

| Stack | asked_by | Key steps |
|---|---|---|
| **Builder's choice** (website default) | — | Use the request's choice, else the best fit. If the capture reveals the original's stack (`/_next/` → Next.js, `/_nuxt/` → Nuxt), use the same. Website: package.json with a `build` script; `npm install && npm run build` until static output lands in `app/dist`, `out` or `build` |
| Electron | " electron " | contextIsolation on, nodeIntegration off, preload + IPC; the `build` script must exit without opening a window; for `--screenshot`: `backgroundThrottling:false`, wait for load + ~2 s (not rAF counting), `capturePage()` |
| Next.js + TypeScript | " nextjs ", " next js ", " use next "… | App Router, `output:'export'`, `trailingSlash:true`, `images.unoptimized`; fonts via next/font; no API routes, server actions, middleware or dynamic routes without generateStaticParams → `app/out` |
| Python | " in python", " with python" | generic |
| React + TypeScript (Vite) | " in typescript", " in react", " with react", " in javascript", " vite " | `base './'`, build `tsc -b && vite build` → `app/dist` |
| Plain HTML and CSS | " html and css ", " plain html ", " no frameworks ", " static html "… | index.html + one .css (+ .js only if needed), one file per page (about.html), relative links, no build |
| Rust (console) | — | cargo in app/ itself (not app/app), the same stdout/stderr and exit codes |
| Rust + macroquad | engine "rust" | procedural assets unless provided |
| Rust + egui (eframe) (app default) | — | cargo in app/ itself |
| Unity (game default) | engine | Assets/Scripts C#; scenes built from code in `Assets/Editor/CraftBuild.cs` `Build()` → `app/Build/Game.<ext>`; `-batchmode -quit -nographics -executeMethod CraftBuild.Build` |
| Unreal Engine | engine | C++ only (Blueprints/umaps are binary); levels spawned from a GameMode; BuildCookRun into `app/Build` |
| Godot | engine | GDScript, text .tscn; check with `--headless --import` then `--quit-after 120`; any `SCRIPT ERROR`, `Parse Error` or `ERROR:` line fails |

Libraries: **shadcn/ui** (`npx shadcn@latest init --yes --defaults`, `add --yes <names>`; set the theme CSS vars to the original's colours/radii, not shadcn defaults), **Tailwind** (v4, `@theme` tokens from capture.json).
Toolchains (own projects): Rust `cargo build/test --quiet`; Node `npm run build --if-present` / `npm test`; Python `compileall` / `pytest -q`; Go; .NET; Maven; Gradle; Make. Build timeouts: 2 min for cargo/npm, 4 h Unity, 8 h Unreal, 60 min Godot import + 10 min play.

---

## 5. Clean room vs Deep

| | Clean room (default) | Deep |
|---|---|---|
| Website | visitor view only: screenshots, visible text, measured layout/styles, links, forms, opened states, other pages. No HTML/CSS/JS, requests, breakpoints, class names, query strings. Fetching the original's files is refused. | + `page.html`, breakpoints, font files, `how-it-works.md`, live inspection, listeners, coverage, walkthroughs, JS source restore. Behaviour may be learned; code is never pasted. |
| Program | nothing inside is opened, listed, read, run or decompiled. Allowed: the person's description, `reference/` pictures, one launch for `window.png`/UI tree, recorded runs, phone screenshots. | triage, decompile (**required**: one `DECOMPILE_FIRST` reminder if a turn skipped it), write constants/formulas to `MECHANICS.md` with function addresses, "mark a value estimated only after you looked for it in the code". "Never paste decompiled code into app/." |
| Game assets | none of the original's; own versions in its style | the person's own copy, 1:1, private use, credits + private-use README line; never decrypt |

Clean room is an allow-list of tools (`clean_room.rs::TOOLS`). Anything not listed is Deep-only, with the refusal "This looks inside the original (its code, files or page source), which Clean room never does." It is **not** an OS sandbox. In Clean room, Claude Code chats run with `--disallowedTools Read,Glob,Grep,LS,NotebookRead` plus write/web tools. During a build, reads go through the approval tool, which refuses the original's folder or site.

---

## 6. Questions and approvals

- `core_person_ask` (Claude Code's `AskUserQuestion` is disabled): only for choices that really change the result; 2-4 short options; never technical details. Mandatory cases: (a) before dropping any requested part (with the smaller version as an option); (b) once, if copying logos/photos/brand/long text matters (ownership/permission); (c) Clean room behaviour you can't see. Per-project mode: **Ask** (card, builder waits) or **Decide** (answered at once with "decide yourself and say what you chose").
- `core_action_approve` (permission-prompt tool): auto-allows edits inside `app/` and a fixed list of build commands (`npm install`, `npm run build`, `cargo build`…). Dev servers are refused. Anything else asks the person: Allow once / Always for this project / Don't allow.
- Unknowns are a ledger, not questions: `core_unknown_add` {question, probes, severity}; `core_unknown_edit` to resolve them with evidence ids. The open ones are listed in each self-check and in the Ready summary.
- **Skill mapping:** use AskUserQuestion with 2-4 options only for these cases; keep `unknowns.md` (question | probes | severity | status | resolution/evidence) and surface the open ones at the end.

---

## 7. Stop/refine criteria and "alike %"

- Defaults (`BuildSettings`): `good_enough` **90%**, `max_rounds` **6** refinements after the first build (the CLI defaults to 2), widths **[1440, 768, 390]**, `max_pages` **4**, `picture_good_enough` None.
- **A check is "good"** when `passed && unknowns.is_empty() && every claim passed && (similarity is None || similarity ≥ good_enough)`.
- Loop: builder turn → round += 1 → run checks (one retry if the check itself errors) → if every check is good, **stop (Ready)** → else if `not_working_checks ≥ 10` (consecutive rounds where any check failed outright, counted across runs and reset only by a new request), stop with an error → else if refinements ≥ max_rounds, stop → else send `kind.refine(first not-good check)` + pictures reminder + "Before you reply, check your build again with rebuild_check and fix what it still lists."
- **Stall guard:** the build stops if **two builder turns change no files in app/**.
- **Empty app/** after a turn → the NO_PROJECT prompt (demand the exact command plus its last output lines).
- Deep + program: a turn without any decompiling gets `DECOMPILE_FIRST` once.
- At the end: if the last check didn't pass (no working build) → error "The build isn't working yet". A site that builds but is under 90% is still delivered as Ready with its %.
- **alike %** (websites) = mean over pages of mean over widths of `50 × (tile_layout + SSIM_detail)`. Apps/games: `50 × (SSIM + tile layout)` at 640×360 against the best-matching reference picture (advisory). Consoles: no %, only claims.
- Summary line: `about S% like the original, H of N claims hold` / `all N checks pass…` / `G of N checks pass…`.

---

## 8. Pitfalls relevant to an agent doing this

1. **Claiming a build that doesn't exist** (#736): the agent said `npm run build` passed while app/ was empty. Verify files exist and quote the actual command output.
2. **Defaults read as orders:** "a notes app in Electron" got built in Rust because the stack line came later and was more specific. Always write "unless the request says otherwise". Record and check the stack actually built.
3. **Never run dev servers or watchers**: they never exit. Serve `dist/` statically for checks.
4. **Retry budgets must persist:** "Try again" reset `max_rounds`, and one build reached check 49. Keep the round and failure counters in a project file.
5. **Loop on what it is stuck on:** one API builder spent 9.4M tokens on code that never compiled. Count consecutive failed build commands, not only total steps.
6. **Best-effort steps must say why they failed:** route captures silently dropped out. Also, create an output's parent folder, never the folder a capture tool must create itself (`web_site_capture` refuses an existing folder, and `checks/round-N` must not pre-exist).
7. **Pick what to launch from the project manifest** (`default-run`, the window crate), never "newest executable".
8. **Don't write your own archive parser** when a tool refuses something: fix the call (the extractor wrote a Python .pak reader).
9. **Keyword handling must be end-to-end:** "…in Rust" worked for apps but not games. Test the real flow.
10. **Nested project:** `cargo new app` inside app/ makes app/app/. Create projects in app/ itself.
11. Electron screenshot: a window behind others gets no rAF frames, so wait for load + 2 s and set `backgroundThrottling:false`.
12. Lazy and scroll-revealed content: scroll through the page before full-page screenshots, or the reference will be missing sections.
13. Animated regions: build a noise mask (2 extra shots at uneven gaps, +900/+1300 ms) and exclude it from the diff. Match the look, not the frame.
14. Shell hygiene: never `python -` with an empty heredoc, no pagers (`--no-pager`), and no `timeout` on macOS. Don't hide stderr when an empty result means something.
15. **Code observation:** `kinds/self_test.rs::verdict` looks inverted. When `not` (failed/missing steps) is non-empty, it returns `passed=true` with "plays the core loop". When all pass, it returns `false`. The per-step claims still block a pass. In a skill, treat "all three of move/act/hud passed" as the pass condition.
16. Mechanics numbers must appear literally in code (to 7 significant digits). A constant computed at runtime (e.g. `9.8 * 2`) won't match: write the sheet's value as is, or mark it estimated.
17. The phone-width "doesn't scroll sideways" claim is blocking (`scrollWidth ≤ width+1`). A single overflowing element fails the whole check.

---

## 9. Minimal Claude Code recipe (what the skill should do)

1. **Study:** Playwright capture at 1440/768/390 (viewport ×900, settle 900 ms, scroll-reveal ≤5 s, full page ≤12000 px, noise mask), with tokens + layouts JSON, states (open menus/dialogs/tabs at desktop + 390), and ≤4 same-origin routes. Write `capture/README.md` + `capture.json`. Apps: launch → screenshot after 15 s (or ffmpeg/screencapture). Consoles: record `''`, `--help`, `--version` (8 s each).
2. **Brief yourself** with §2 rules, then TodoWrite 3-7 steps and `unknowns.md`.
3. **Build** in `app/` only, with a static output dir. Games/apps get `--screenshot` and (games) `--self-test` + `mechanics.json`.
4. **Check:** serve the output statically, recapture identically into `checks/round-N/`, compute per width `50·(tile16@24 + SSIM)`, plus the claims (no horizontal scroll, no new console errors or 404s, landmarks, states open) and the advisory text/structure/design diffs. Read both screenshots of each pair.
5. **Refine** until every check is good (≥90%, all claims hold, no unknowns), at most 6 refinements. Stop if 2 turns change nothing or 10 consecutive rounds fail.
6. **Ready:** a 3-5 sentence plain summary with the %, the claims, what differs, the open unknowns, and one next idea.
