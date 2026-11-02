// Audio: places each narration clip at its planned start and synthesizes discreet SFX from the shared plan cues.
// Mix hierarchy: voice peaks ≈ -6 dBFS; SFX classes −16…−22 dBFS; final true-peak limiter at −1 dBFS.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, SR, ff, readWav, writeWav } from './lib.mjs'
import { buildPlan } from '../src/plan.js'

const { TIMING } = await import('../src/timing.js?' + Date.now())
const { cues } = buildPlan(TIMING)
const N = Math.round(TIMING.duration * SR)
const voice = new Float32Array(N), sfx = new Float32Array(N)

// ---- voice ----
let vpeak = 0
const clips = TIMING.lines.map(l => { const w = readWav(path.join(ROOT, l.file)); if (w.sr !== SR) throw new Error('clip sr'); for (const v of w.samples) vpeak = Math.max(vpeak, Math.abs(v)); return { l, s: w.samples } })
const vg = 0.501 / vpeak
for (const { l, s } of clips) { const o = Math.round(l.start * SR); for (let i = 0; i < s.length && o + i < N; i++) voice[o + i] += s[i] * vg }

// ---- SFX synthesis (seeded, deterministic) ----
const mulberry32 = s => () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const TAU = Math.PI * 2
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26] // pentatonic steps, one per hue
function bandNoise(len, rnd, fc0, fc1, q = 1.2) { // state-variable filter with swept centre
  const out = new Float32Array(len); let lp = 0, bp = 0
  for (let i = 0; i < len; i++) {
    const k = i / len, fc = fc0 * Math.pow(fc1 / fc0, k), f = 2 * Math.sin(Math.PI * fc / SR)
    const x = rnd() * 2 - 1, hp = x - lp - bp / q; bp += f * hp; lp += f * bp; out[i] = bp
  }
  return out
}
function synth(type, hue, rnd) {
  const d = { pop: 0.2, draw: 0.26, whoosh: 0.5, swell: 0.9, slide: 0.3, soft: 0.18, blend: 0.36, tick: 0.04, chime: 1.3 }[type]
  const len = Math.round(d * SR), b = new Float32Array(len)
  if (type === 'pop') {
    const f = 520 * Math.pow(2, SCALE[hue ?? 0] / 24)
    for (let i = 0; i < len; i++) { const t = i / SR, env = Math.min(1, t / 0.004) * Math.exp(-t / 0.055); b[i] = env * (Math.sin(TAU * f * t) + 0.22 * Math.sin(TAU * 2 * f * t)) }
  } else if (type === 'draw') {
    const n = bandNoise(len, rnd, 700, 3200, 2.5)
    for (let i = 0; i < len; i++) { const k = i / len; b[i] = n[i] * Math.sin(Math.PI * Math.pow(k, 0.7)) ** 2 }
  } else if (type === 'whoosh') {
    const n = bandNoise(len, rnd, 260, 1500, 0.9)
    for (let i = 0; i < len; i++) { const k = i / len; b[i] = n[i] * Math.sin(Math.PI * k) ** 1.6 }
  } else if (type === 'swell') {
    for (let i = 0; i < len; i++) { const t = i / SR, k = i / len; b[i] = Math.sin(Math.PI * k) ** 2 * (Math.sin(TAU * 220 * t) + 0.5 * Math.sin(TAU * 330 * t)) }
  } else if (type === 'slide') {
    let ph = 0
    for (let i = 0; i < len; i++) { const k = i / len, f = 320 + 260 * (1 - (1 - k) ** 2); ph += TAU * f / SR; b[i] = Math.sin(Math.PI * k) ** 1.5 * Math.sin(ph) }
  } else if (type === 'soft') {
    const n = bandNoise(len, rnd, 1800, 900, 0.8)
    for (let i = 0; i < len; i++) { const t = i / SR, env = Math.min(1, t / 0.006) * Math.exp(-t / 0.05); b[i] = env * (0.8 * Math.sin(TAU * 170 * t) + 0.5 * n[i]) }
  } else if (type === 'blend') {
    let ph = 0
    for (let i = 0; i < len; i++) { const t = i / SR, k = i / len, f = 720 - 360 * k + 18 * Math.sin(TAU * 9 * t); ph += TAU * f / SR; b[i] = Math.sin(Math.PI * k) * Math.sin(ph) }
  } else if (type === 'tick') {
    for (let i = 0; i < len; i++) { const t = i / SR; b[i] = Math.exp(-t / 0.006) * Math.sin(TAU * 2400 * t) }
  } else if (type === 'chime') {
    for (let i = 0; i < len; i++) { const t = i / SR, env = Math.min(1, t / 0.005) * Math.exp(-t / 0.35); b[i] = env * (Math.sin(TAU * 880 * t) + 0.6 * Math.sin(TAU * 1318.5 * t) + 0.25 * Math.sin(TAU * 1760 * t)) }
  }
  return b
}
const PEAK_DB = { pop: -18, draw: -21, whoosh: -22, swell: -24, slide: -21, soft: -21, blend: -21, tick: -23, chime: -16 }
cues.forEach((c, n) => {
  const b = synth(c.type, c.hue, mulberry32(1000 + n * 77))
  let pk = 0; for (const v of b) pk = Math.max(pk, Math.abs(v))
  const g = Math.pow(10, PEAK_DB[c.type] / 20) * (c.gain ?? 1) / (pk || 1)
  const o = Math.round(c.t * SR)
  for (let i = 0; i < b.length && o + i < N; i++) if (o + i >= 0) sfx[o + i] += b[i] * g
})

const A = path.join(ROOT, 'audio')
writeWav(path.join(A, 'voice.wav'), voice); writeWav(path.join(A, 'sfx.wav'), sfx)
ff(['-i', path.join(A, 'voice.wav'), '-i', path.join(A, 'sfx.wav'), '-filter_complex',
  '[0]pan=stereo|c0=c0|c1=c0[v];[1]pan=stereo|c0=c0|c1=c0[s];[v][s]amix=inputs=2:normalize=0,alimiter=limit=0.891:attack=2:release=40:level=false,atrim=0:' + TIMING.duration,
  '-ar', String(SR), '-c:a', 'pcm_s16le', path.join(A, 'mix.wav')])
console.log(`mix.wav: ${cues.length} SFX cues, voice gain ${(20 * Math.log10(vg)).toFixed(1)} dB (${TIMING.engine})`)
