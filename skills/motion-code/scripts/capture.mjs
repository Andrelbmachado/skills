#!/usr/bin/env node
// Deterministic animation capture for any web page: frames at exact times,
// one contact sheet + one onion-skin image (cheap to inspect), a numeric
// track with motion lint, and optional frame-matched MP4.
//
// Drivers:
//   clock    (default) fakes Date/performance/rAF/timers and freezes the CSS/WAAPI
//            timeline, then steps both in ≤16 ms ticks — works on unmodified pages
//            (CSS, WAAPI, GSAP, Motion, Three.js, Canvas, Pixi).
//   seek     page exposes a pure seek; --seek "window.__reel.seek(t)" (t in s).
//   realtime plain wall-clock screenshots (fallback: video/audio/workers).
//
// Run with --help for options.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { lintTrack } from './lint.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const STEP_MS = 16

const HELP = `usage: node capture.mjs <url | file.html | dir> [options]
  --driver clock|seek|realtime   default: seek if --seek given, else clock
  --seek "<js using t>"          e.g. "window.__reel.seek(t)" (t in seconds)
  --ready "<js>"                 awaited before t=0 (fonts are always awaited)
  --before "<js>"                run at t=0, e.g. "document.querySelector('#btn').click()"
  --hover <selector>             hover element at t=0 (CSS :hover transitions)
  --from <s> --to <s>            time window (default 0..1)
  --frames <n>                   evenly spaced stills in window (default 8)
  --times a,b,c                  explicit still times (overrides --frames)
  --cols <n> --tile <px>         contact sheet layout (default 4 cols, 400 px tiles)
  --onion                        also write onion-skin overlay of all stills
  --track <selector>             record x,y,w,h,opacity,rot,sx,sy per tick → lint
  --probe "<js>"                 per-tick number or {name:number} → lint
  --track-fps <n>                track sample rate (default 60)
  --loop                         lint loop seam (first vs last sample)
  --clip <selector>              crop stills to element box (measured at t=0)
  --viewport WxH --dpr <n>       default 1280x720, 1
  --reduced-motion               emulate prefers-reduced-motion: reduce
  --video <out.mp4> --fps <n>    frame-matched MP4 of the window (needs ffmpeg)
  --out <dir>                    output dir (default ./motion-capture)`

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    driver: { type: 'string' },
    seek: { type: 'string' },
    ready: { type: 'string' },
    before: { type: 'string' },
    hover: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    frames: { type: 'string', default: '8' },
    times: { type: 'string' },
    cols: { type: 'string' },
    tile: { type: 'string', default: '400' },
    onion: { type: 'boolean', default: false },
    track: { type: 'string' },
    probe: { type: 'string' },
    'track-fps': { type: 'string', default: '60' },
    loop: { type: 'boolean', default: false },
    clip: { type: 'string' },
    viewport: { type: 'string', default: '1280x720' },
    dpr: { type: 'string', default: '1' },
    'reduced-motion': { type: 'boolean', default: false },
    video: { type: 'string' },
    fps: { type: 'string', default: '30' },
    out: { type: 'string', default: 'motion-capture' },
    help: { type: 'boolean', short: 'h' },
  },
})

const fail = msg => {
  console.error(`[capture] ${msg}`)
  process.exit(1)
}

if (o.help || !positionals[0]) {
  console.log(HELP)
  process.exit(o.help ? 0 : 2)
}

// Module resolution walks up parent dirs, so a stray old Playwright (e.g. in
// ~/.claude/node_modules) can win; only accept one whose browser is installed.
function loadChromium() {
  const tried = []
  for (const base of [join(process.cwd(), '/'), join(HERE, '/')]) {
    const req = createRequire(base)
    for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
      let chromium
      try {
        chromium = req(name).chromium
      } catch {
        continue
      }
      if (process.env.CHROME_PATH || existsSync(chromium.executablePath())) return chromium
      tried.push(`${req.resolve(name)} (browser missing)`)
    }
  }
  fail(`no usable playwright${tried.length ? ': ' + tried.join(', ') : ''}. One-time: npm i --prefix ${HERE} && npx --prefix ${HERE} playwright-core install chromium   (or set CHROME_PATH)`)
}

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG
  // Prefer a static build: Homebrew ffmpeg breaks on dylib upgrades.
  for (const base of [join(process.cwd(), '/'), join(HERE, '/')]) {
    try {
      const bin = createRequire(base)('ffmpeg-static')
      if (bin && existsSync(bin)) return bin
    } catch {}
  }
  if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg'
  fail(`no working ffmpeg. One-time: npm i --prefix ${HERE}   (or set FFMPEG=/path/to/ffmpeg)`)
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
}

// Local files are served over http so ES modules, fetch and wasm work.
async function serveLocal(target) {
  const abs = resolve(target)
  const isDir = statSync(abs).isDirectory()
  const root = isDir ? abs : dirname(abs)
  const server = createServer((req, res) => {
    let file = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if (file !== root && !file.startsWith(root + sep)) return res.writeHead(403).end()
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) return res.writeHead(404).end()
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const entry = isDir ? '' : basename(abs)
  return { url: `http://127.0.0.1:${server.address().port}/${entry}`, close: () => server.close() }
}

const spread = (a, b, n) => (n <= 0 ? [] : n === 1 ? [a] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)))
const round3 = x => Math.round(x * 1000) / 1000

function plan() {
  const stills = o.times ? o.times.split(',').map(Number) : null
  const from = o.from !== undefined ? +o.from : stills ? Math.min(...stills) : 0
  const to = o.to !== undefined ? +o.to : stills ? Math.max(...stills) : 1
  if (!(to >= from)) fail('--to must be >= --from')
  const events = new Map()
  const mark = (t, key) => {
    const k = round3(t)
    events.set(k, { ...events.get(k), [key]: true })
  }
  for (const t of stills ?? spread(from, to, +o.frames)) mark(t, 'shot')
  if (o.track || o.probe) {
    const n = Math.max(2, Math.round((to - from) * +o['track-fps']) + 1)
    for (const t of spread(from, to, n)) mark(t, 'track')
  }
  if (o.video) {
    const fps = +o.fps
    for (let i = Math.round(from * fps); i < Math.round(to * fps); i++) mark(i / fps, 'video')
  }
  return [...events.entries()].sort((a, b) => a[0] - b[0]).map(([t, e]) => ({ t, ...e }))
}

// In-page helpers (serialised into the page).
// The document timeline is frozen via CDP, so running animations hold still and
// we set currentTime directly. Never pause(): a paused animation never reaches
// "finished", so `finished`/onfinish never fire and libraries waiting on them
// (Motion, AnimatePresence exit, commitStyles) stall mid-way.
function pageSyncAnimations(now) {
  const m = (window.__mcAnims ??= new Map())
  for (const a of document.getAnimations()) {
    if (a.timeline && a.timeline !== document.timeline) continue // scroll-driven
    // Page-paused (or created paused and played later, as Motion does): leave it
    // alone and re-anchor from its current position when it runs again.
    if (a.playState === 'paused') {
      m.delete(a)
      continue
    }
    // Negative currentTime = startTime set from the (fake) performance.now while the
    // real document timeline is frozen elsewhere (Motion does this): start now.
    if (!m.has(a)) m.set(a, now - Math.max(0, a.currentTime ?? 0) / (a.playbackRate || 1))
    a.currentTime = (now - m.get(a)) * (a.playbackRate || 1)
  }
}

function pageSample([sel, probe]) {
  const r = {}
  if (sel) {
    const el = document.querySelector(sel)
    if (el) {
      const b = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform)
      Object.assign(r, {
        x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, opacity: +cs.opacity,
        rot: (Math.atan2(m.b, m.a) * 180) / Math.PI, sx: Math.hypot(m.a, m.b), sy: Math.hypot(m.c, m.d),
      })
    }
  }
  if (probe) {
    const v = (0, eval)(probe)
    if (typeof v === 'number') r.probe = v
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (typeof x === 'number') r[k] = x
  }
  return r
}

// --ready may be a promise ("window.app.ready") or a condition polled until
// truthy ("window.__ready"); fonts are always awaited after it.
function pageReady(expr) {
  if (window.__mcReady === true) return true
  if (window.__mcReady === 'pending') return false
  let v = true
  if (expr) {
    try {
      v = (0, eval)(expr)
    } catch {
      v = false
    }
  }
  if (!v) return false
  window.__mcReady = 'pending'
  Promise.resolve(v)
    .then(() => document.fonts.ready)
    .then(() => { window.__mcReady = true })
  return false
}

async function waitReady(page, clocked) {
  const deadline = Date.now() + 20_000
  let fakeWait = 0
  while (!(await page.evaluate(pageReady, o.ready ?? null))) {
    if (Date.now() > deadline) fail('page never became ready (check --ready)')
    if (clocked && Date.now() > deadline - 15_000) {
      await page.clock.runFor(STEP_MS) // ready needs timers: let fake time flow
      fakeWait += STEP_MS
    } else await new Promise(r => setTimeout(r, 50))
  }
  if (fakeWait) console.log(`[capture] note: ready needed ${fakeWait} ms of fake time; t=0 starts after it`)
}

async function compose(browser, shots, outDir) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const imgs = shots.map(s => ({ t: s.t, src: `data:image/png;base64,${s.buf.toString('base64')}` }))
  const cols = Math.min(+(o.cols ?? 4), imgs.length)
  const tile = +o.tile
  await page.setContent(`<body style="margin:0;background:#111;font:12px ui-monospace,monospace;color:#ddd">
    <div id=g style="display:grid;grid-template-columns:repeat(${cols},${tile}px);gap:4px;padding:4px;width:max-content">
    ${imgs.map(i => `<figure style="margin:0"><img src="${i.src}" style="width:${tile}px;display:block"><figcaption style="padding:2px 4px">t=${i.t.toFixed(3)}s</figcaption></figure>`).join('')}
    </div></body>`)
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())))
  const sheet = join(outDir, 'sheet.png')
  await page.locator('#g').screenshot({ path: sheet })
  const outputs = [sheet]

  if (o.onion && imgs.length > 1) {
    const dataUrl = await page.evaluate(async srcs => {
      const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src })
      const frames = await Promise.all(srcs.map(load))
      const scale = Math.min(1, 1000 / frames[0].width)
      const c = document.createElement('canvas')
      c.width = Math.round(frames[0].width * scale)
      c.height = Math.round(frames[0].height * scale)
      const g = c.getContext('2d')
      // Base = last frame at full strength; earlier frames blend in fainter.
      g.drawImage(frames[frames.length - 1], 0, 0, c.width, c.height)
      const px = g.getImageData(0, 0, c.width, c.height).data
      let lum = 0
      for (let p = 0; p < px.length; p += 4 * 97) lum += (px[p] + px[p + 1] + px[p + 2]) / 765
      const light = lum / (px.length / (4 * 97)) > 0.5
      // Light background: keep the darkest pixel of every frame (and vice versa).
      g.globalCompositeOperation = light ? 'darken' : 'lighten'
      frames.forEach((im, k) => {
        g.globalAlpha = 0.3 + (0.7 * k) / (frames.length - 1)
        g.drawImage(im, 0, 0, c.width, c.height)
      })
      return c.toDataURL('image/png')
    }, imgs.map(i => i.src))
    const onion = join(outDir, 'onion.png')
    await writeFile(onion, Buffer.from(dataUrl.split(',')[1], 'base64'))
    outputs.push(onion)
  }
  await page.close()
  return outputs
}

// Frames go to <out>.part and are renamed only on success, so a failed render
// never clobbers a previous good file.
function startEncoder(out, fps) {
  const part = `${out}.part`
  const ff = spawn(findFfmpeg(), [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', '-f', 'mp4', part,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  let err = null
  const exited = new Promise(r => { ff.on('error', e => { err = e; r(-1) }); ff.on('close', r) })
  ff.stdin.on('error', e => { err ??= e })
  return {
    async write(buf) {
      if (err) throw err
      if (!ff.stdin.write(buf)) await Promise.race([once(ff.stdin, 'drain'), exited])
    },
    async finish() {
      ff.stdin.end()
      const code = await exited
      if (err || code !== 0) throw err ?? new Error(`ffmpeg exited with ${code}`)
      await rename(part, out)
    },
    async abort() {
      ff.kill('SIGKILL')
      await exited
      await rm(part, { force: true })
    },
  }
}

async function main() {
  const target = positionals[0]
  const local = !/^https?:|^file:/.test(target)
  // a local target may carry a query/hash (index.html?captions=0): serve the path, keep the suffix
  const [entry, suffix = ''] = local ? [target.replace(/[?#].*$/, ''), target.match(/[?#].*$/)?.[0]] : [target]
  if (local && !existsSync(entry)) fail(`not found: ${entry}`)
  const driver = o.driver ?? (o.seek ? 'seek' : 'clock')
  if (!['clock', 'seek', 'realtime'].includes(driver)) fail(`unknown driver ${driver}`)
  if (driver === 'seek' && !o.seek) fail('--driver seek needs --seek "<js using t>"')
  const [w, h] = o.viewport.split('x').map(Number)
  const events = plan()
  const outDir = resolve(o.out)
  await mkdir(join(outDir, 'frames'), { recursive: true })

  const server = local ? await serveLocal(entry) : null
  const url = server ? server.url + suffix : target
  const chromium = loadChromium()
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  })
  const errors = []
  let encoder = null
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +o.dpr })
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => m.type() === 'error' && errors.push(m.text()))
    if (o['reduced-motion']) await page.emulateMedia({ reducedMotion: 'reduce' })

    let now = 0 // fake ms since the clock was paused
    const sync = () => page.evaluate(pageSyncAnimations, now)
    if (driver === 'clock') {
      await page.clock.install({ time: 0 })
      await page.clock.pauseAt(1000)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Animation.enable')
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 })
    }
    await page.goto(url, { waitUntil: 'load' })
    await waitReady(page, driver === 'clock')
    if (driver === 'clock') now = await page.evaluate(() => performance.now())
    const origin = now
    if (o.hover) await page.hover(o.hover)
    if (o.before) await page.evaluate(expr => { (0, eval)(expr) }, o.before)
    if (driver === 'clock') await sync()

    const clip = o.clip ? await page.locator(o.clip).boundingBox() : undefined
    if (o.clip && !clip) fail(`--clip ${o.clip}: element not visible`)
    if (o.video) encoder = startEncoder(resolve(o.video), +o.fps)

    const realStart = Date.now()
    const shots = []
    const track = []
    for (const ev of events) {
      if (driver === 'clock') {
        const target = origin + Math.round(ev.t * 1000)
        while (now < target) {
          const step = Math.min(STEP_MS, target - now)
          await page.clock.runFor(step)
          now += step
          await sync()
        }
      } else if (driver === 'seek') {
        await page.evaluate(([expr, t]) => new Function('t', `return (${expr})`)(t), [o.seek, ev.t])
        if (ev.shot || ev.video) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
      } else {
        const wait = realStart + ev.t * 1000 - Date.now()
        if (wait > 0) await new Promise(r => setTimeout(r, wait))
      }
      if (ev.track) track.push({ t: ev.t, ...(await page.evaluate(pageSample, [o.track ?? null, o.probe ?? null])) })
      if (ev.shot) {
        const buf = await page.screenshot({ type: 'png', clip })
        const path = join(outDir, 'frames', `t${ev.t.toFixed(3)}.png`)
        await writeFile(path, buf)
        shots.push({ t: ev.t, buf })
      }
      if (ev.video) await encoder.write(await page.screenshot({ type: 'jpeg', quality: 92, clip }))
    }

    const outputs = shots.length ? await compose(browser, shots, outDir) : []
    if (encoder) {
      await encoder.finish()
      encoder = null
      outputs.push(resolve(o.video))
    }
    console.log(`[capture] driver=${driver} stills=${shots.length} → ${join(outDir, 'frames')}/`)
    for (const p of outputs) console.log(`[capture] ${p}`)
    if (track.length) {
      await writeFile(join(outDir, 'track.json'), JSON.stringify(track))
      const report = lintTrack(track, { loop: o.loop }).join('\n')
      await writeFile(join(outDir, 'lint.txt'), report + '\n')
      console.log(report)
    }
    if (errors.length) console.log(`[capture] ⚠ ${errors.length} page error(s): ${[...new Set(errors)].slice(0, 5).join(' | ')}`)
  } finally {
    if (encoder) await encoder.abort()
    await browser.close()
    server?.close()
  }
}

main().catch(e => fail(e.message))
