// Render: mix audio → frame-exact capture of the seekable page → mux → script.json `output` (exactly `duration` s, 1080×1920).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { ROOT, ff } from './lib.mjs'

const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'timing.json'), 'utf8'))
execFileSync('node', [path.join(ROOT, 'tools/mix.mjs')], { stdio: 'inherit' })

const CAP = path.join(os.homedir(), '.claude/skills/motion-code/scripts/capture.mjs')
const silent = path.join(ROOT, 'out/silent.mp4')
fs.mkdirSync(path.dirname(silent), { recursive: true })
execFileSync('node', [CAP, path.join(ROOT, 'index.html'), '--seek', 'window.__reel.seek(t)', '--ready', 'window.__reel.ready',
  '--from', '0', '--to', String(T.duration - 0.5 / T.fps), '--fps', String(T.fps), '--frames', '0',
  '--video', silent, '--viewport', '1080x1920', '--out', path.join(ROOT, 'motion-capture/render')], { stdio: 'inherit' })

const OUT = JSON.parse(fs.readFileSync(path.join(ROOT, 'script.json'), 'utf8')).output || 'reel.mp4'
const name = T.engine === 'fish' ? OUT : OUT.replace(/\.mp4$/, ' (rascunho voz do sistema).mp4')
ff(['-i', silent, '-i', path.join(ROOT, 'audio/mix.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
  '-c:a', 'aac', '-b:a', '192k', '-t', String(T.duration), '-movflags', '+faststart', path.join(ROOT, name)])
console.log('→', name)
