// Pré-voo: serve o projeto, carrega a página (pageerror), roda seek em TODOS os quadros e salva quadros-chave (+ folha de contato).
//   node tools/seekall.mjs [t1 t2 ...]   → /tmp/sheet06/*.png + /tmp/sheet06/sheet.png
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import { ROOT, ff } from './lib.mjs'
const require = createRequire(path.join(os.homedir(), '.claude/skills/motion-code/scripts/'))
const { chromium } = require('playwright-core')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.wav': 'audio/wav' }
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f.endsWith('/') ? f + 'index.html' : f, (e, d) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d) } }) })
await new Promise(r => srv.listen(0, r))
const port = srv.address().port
const exe = process.env.CHROME_PATH || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
const br = await chromium.launch({ executablePath: exe })
const pg = await br.newPage({ viewport: { width: 1080, height: 1920 } })
const errs = []
pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()) })
await pg.goto(`http://127.0.0.1:${port}/index.html`)
await pg.evaluate(() => window.__reel.ready)
const { dur, fps } = await pg.evaluate(() => ({ dur: window.__reel.duration, fps: window.__reel.fps }))
const n = Math.round(dur * fps), t0 = Date.now()
const bad = await pg.evaluate(async ({ n, fps }) => { const e = []; for (let i = 0; i < n; i++) { try { window.__reel.seek(i / fps) } catch (x) { e.push(i + ':' + x.message); if (e.length > 5) break } } return e }, { n, fps })
console.log(`seek ${n} quadros em ${((Date.now() - t0) / 1000).toFixed(1)} s; erros de seek: ${bad.length ? bad.join(' | ') : 'nenhum'}; pageerror: ${errs.length ? errs.join(' | ') : 'nenhum'}`)
const K = await pg.evaluate(() => window.__K)
const times = process.argv.slice(2).map(Number).length ? process.argv.slice(2).map(Number) : [
  K.h.bubble + 0.1, K.h.x + 0.5, K.s1.blur + 0.5, K.s1.ok + 0.4, K.s1.lad + 0.4,
  K.s2.eq + 0.4, K.s2.ok + 0.4, K.s2.lad + 0.4, K.s3.manual + 0.5, K.s3.ok + 0.3, K.s3.lad + 0.4,
  K.s4.down + 0.6, K.s4.ok + 0.3, K.s4.larg + 0.8, K.s5.x + 0.4, K.s5.ok + 0.5, K.s5.lad + 0.4,
  K.recap + 2.0, K.c.duas + 0.9, dur - 0.1]
const out = '/tmp/sheet06'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true })
for (const [i, t] of times.entries()) { await pg.evaluate(t => window.__reel.seek(t), t); await pg.locator('#c').screenshot({ path: `${out}/f${String(i).padStart(2, '0')}.png` }) }
await br.close(); srv.close()
const cols = 7, rows = Math.ceil(times.length / cols)
ff(['-framerate', '1', '-i', `${out}/f%02d.png`, '-vf', `scale=240:-1,tile=${cols}x${rows}:padding=6:color=0x222222`, '-frames:v', '1', `${out}/sheet.png`])
console.log('times', times.map(t => t.toFixed(2)).join(' '), '\nsheet', `${out}/sheet.png`)
process.exit(errs.length || bad.length ? 1 : 0)
