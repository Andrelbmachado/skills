// Final gate for the delivered MP4: exact duration and frame count, 9:16 size, audio peak, and no secret in the project.
//   node tools/check.mjs ["<video>.mp4"]
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT, FFMPEG, loadEnv } from './lib.mjs'

const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'timing.json'), 'utf8'))
const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'script.json'), 'utf8'))
const file = path.join(ROOT, process.argv[2] || script.output || 'reel.mp4')
const run = args => { const r = spawnSync(FFMPEG, ['-hide_banner', ...args], { encoding: 'utf8' }); return (r.stdout || '') + (r.stderr || '') } // ffmpeg reports on stderr
const info = run(['-i', file, '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-'])
const frames = +(run(['-i', file, '-map', '0:v', '-c', 'copy', '-f', 'null', '-']).match(/frame=\s*(\d+)/g) || ['0']).pop().replace(/\D/g, '')
const dur = info.match(/Duration: (\d+):(\d+):([\d.]+)/), secs = dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : NaN
const size = (info.match(/Video: .*?, (\d{2,5}x\d{2,5})[ ,]/) || [])[1], peak = +(info.match(/max_volume: (-?[\d.]+) dB/) || [])[1]
const want = Math.round(T.duration * T.fps)
const ok = [
  ['duration', Math.abs(secs - T.duration) < 0.02, secs + ' s'],
  ['frames', frames === want, frames + ' / ' + want],
  ['size', size === '1080x1920', size],
  ['audio peak ≤ −1 dBFS and ≥ −9', peak <= -1 && peak >= -9, peak + ' dBFS'],
  ['engine', T.engine !== 'say' || /rascunho/.test(file), T.engine],
]
// secret scan: the key value itself must only live in .env
loadEnv()
const secrets = ['FISH_API_KEY'].map(k => process.env[k]).filter(Boolean)
const leaks = []
const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, f.name)
  if (f.isDirectory()) { if (!['node_modules', 'cache', '.git', 'motion-capture', 'out'].includes(f.name)) walk(p) }
  else if (f.name !== '.env' && fs.statSync(p).size < 5e6 && secrets.some(s => fs.readFileSync(p).includes(s))) leaks.push(path.relative(ROOT, p))
} }
walk(ROOT)
ok.push(['no secret outside .env', leaks.length === 0, leaks.join(', ') || 'clean'])
for (const [k, pass, v] of ok) console.log((pass ? 'ok   ' : 'FAIL ') + k.padEnd(32) + v)
process.exit(ok.every(x => x[1]) ? 0 : 1)
