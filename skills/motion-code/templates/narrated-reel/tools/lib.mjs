// Shared helpers for the build tools (no secrets here).
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const SR = 48000

const SKILL_FFMPEG = path.join(os.homedir(), '.claude/skills/motion-code/scripts/node_modules/ffmpeg-static/ffmpeg')
export const FFMPEG = process.env.FFMPEG || (fs.existsSync(SKILL_FFMPEG) ? SKILL_FFMPEG : 'ffmpeg')

export function ff(args) {
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] })
}

// Loads KEY=VALUE pairs from .env into process.env without echoing anything.
export function loadEnv() {
  const f = path.join(ROOT, '.env')
  if (!fs.existsSync(f)) return
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = v
  }
}

// Reads a mono/stereo 16-bit or float WAV → Float32Array (first channel) at its own rate.
export function readWav(file) {
  const b = fs.readFileSync(file)
  let p = 12, fmt = null, data = null
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4)
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) }
    if (id === 'data') { data = b.subarray(p + 8, p + 8 + size); break }
    p += 8 + size + (size & 1)
  }
  if (!fmt || !data) throw new Error('bad wav ' + file)
  const bps = fmt.bits / 8, n = Math.floor(data.length / (bps * fmt.ch)), out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const o = i * bps * fmt.ch
    out[i] = fmt.tag === 3 ? data.readFloatLE(o) : data.readInt16LE(o) / 32768
  }
  return { sr: fmt.sr, samples: out }
}

export function writeWav(file, samples, sr = SR) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8)
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22)
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34)
  b.write('data', 36); b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2)
  fs.writeFileSync(file, b)
}

export const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
