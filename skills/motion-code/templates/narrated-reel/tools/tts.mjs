// Narration: one TTS clip per line → trim → fit into its window → word times (whisper) → timing.json + src/timing.js
// Voice: Fish Audio when FISH_API_KEY + FISH_VOICE_ID exist (env or untracked .env). Otherwise, with --engine say,
// a macOS system voice is used for a draft. The key is never printed, logged or written to disk.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { ROOT, ff, loadEnv, readWav, norm, FFMPEG } from './lib.mjs'

loadEnv()
const args = process.argv.slice(2)
const want = args.includes('--engine') ? args[args.indexOf('--engine') + 1] : 'fish'
const hasFish = !!(process.env.FISH_API_KEY && process.env.FISH_VOICE_ID)
const engine = want === 'say' ? 'say' : 'fish'
if (engine === 'fish' && !hasFish) {
  console.error('Fish Audio não configurado: crie .env com FISH_API_KEY e FISH_VOICE_ID (ou rode com --engine say para um rascunho).')
  process.exit(2)
}

const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'script.json'), 'utf8'))
const CACHE = path.join(ROOT, 'audio/cache'), CLIPS = path.join(ROOT, 'audio/clips'), ASR = path.join(ROOT, 'audio/asr')
for (const d of [CACHE, CLIPS, ASR]) fs.mkdirSync(d, { recursive: true })
// whisper shells out to `ffmpeg` on PATH; point it at the working (static) binary.
const BIN = path.join(ROOT, 'audio/.bin'); fs.mkdirSync(BIN, { recursive: true })
if (FFMPEG.includes('/')) { try { fs.rmSync(path.join(BIN, 'ffmpeg')) } catch {} fs.symlinkSync(FFMPEG, path.join(BIN, 'ffmpeg')) }
const WENV = { ...process.env, PATH: BIN + ':' + process.env.PATH }

const voiceTag = engine === 'fish' ? 'fish:' + (process.env.FISH_MODEL || 's1') + ':' + process.env.FISH_VOICE_ID : 'say:' + (process.env.SAY_VOICE || 'Luciana')
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16)

async function synth(text, speed) {
  const id = hash(voiceTag + '|' + speed.toFixed(3) + '|' + text)
  const raw = path.join(CACHE, id + '.wav')
  if (fs.existsSync(raw)) return raw
  if (engine === 'fish') {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.FISH_API_KEY, 'Content-Type': 'application/json', model: process.env.FISH_MODEL || 's1' },
      body: JSON.stringify({ text, reference_id: process.env.FISH_VOICE_ID, format: 'wav', sample_rate: 44100, normalize: true, latency: 'normal', prosody: { speed, volume: 0 } }),
    })
    if (!res.ok) throw new Error('Fish Audio HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200))
    const tmp = raw + '.src'
    fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()))
    ff(['-i', tmp, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', raw]); fs.rmSync(tmp)
  } else {
    const tmp = raw + '.aiff'
    execFileSync('say', ['-v', process.env.SAY_VOICE || 'Luciana', '-r', String(Math.round(178 * speed)), '-o', tmp, text])
    ff(['-i', tmp, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', raw]); fs.rmSync(tmp)
  }
  return raw
}

function trim(src, dst, tempo = 1) {
  const af = ['silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.03',
    'areverse', 'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.08', 'areverse']
  if (tempo !== 1) af.push('atempo=' + tempo.toFixed(4))
  af.push('afade=t=in:d=0.01')
  ff(['-i', src, '-af', af.join(','), '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', dst])
  const w = readWav(dst)
  return w.samples.length / w.sr
}

// Needleman–Wunsch on words with a letter-level edit-distance substitution cost.
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
function align(scriptWords, asrWords) {
  const S = scriptWords.map(norm), A = asrWords.map(w => norm(w.word)), G = 0.7
  const n = S.length, m = A.length, C = [], P = []
  for (let i = 0; i <= n; i++) { C.push(new Float64Array(m + 1)); P.push(new Int8Array(m + 1)) }
  for (let i = 1; i <= n; i++) { C[i][0] = i * G; P[i][0] = 1 }
  for (let j = 1; j <= m; j++) { C[0][j] = j * G; P[0][j] = 2 }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const sub = lev(S[i - 1], A[j - 1]) / Math.max(S[i - 1].length, A[j - 1].length, 1)
    const opts = [C[i - 1][j - 1] + sub * 1.4, C[i - 1][j] + G, C[i][j - 1] + G]
    const k = opts.indexOf(Math.min(...opts)); C[i][j] = opts[k]; P[i][j] = k
  }
  const map = new Array(n).fill(null)
  for (let i = n, j = m; i > 0 || j > 0;) {
    const k = P[i][j]
    if (k === 0) { const sub = lev(S[i - 1], A[j - 1]) / Math.max(S[i - 1].length, A[j - 1].length, 1); if (sub < 0.6) map[i - 1] = j - 1; i--; j-- }
    else if (k === 1) i--; else j--
  }
  return map
}

function wordTimes(text, wav, dur) {
  const words = text.split(/\s+/).filter(Boolean)
  let asr = []
  try {
    execFileSync('whisper', [wav, '--model', 'base', '--language', 'Portuguese', '--word_timestamps', 'True', '--output_format', 'json',
      '--output_dir', ASR, '--fp16', 'False', '--verbose', 'False'], { stdio: 'ignore', env: WENV })
    const j = JSON.parse(fs.readFileSync(path.join(ASR, path.basename(wav, '.wav') + '.json'), 'utf8'))
    asr = j.segments.flatMap(s => s.words || [])
  } catch (e) { console.warn('  whisper falhou, usando tempo proporcional:', e.message.split('\n')[0]) }
  const map = align(words, asr)
  const out = words.map((w, i) => map[i] == null ? { w, t0: null, t1: null } : { w, t0: asr[map[i]].start, t1: asr[map[i]].end })
  // Fill unmatched words by distributing the gap proportionally to letter count.
  const known = [{ i: -1, t: 0 }, ...out.map((o, i) => o.t0 == null ? null : { i, t: o.t0 }).filter(Boolean), { i: out.length, t: dur }]
  for (let k = 0; k < known.length - 1; k++) {
    const a = known[k], b = known[k + 1]
    const gapIdx = []; for (let i = a.i + 1; i < b.i; i++) gapIdx.push(i)
    if (!gapIdx.length) continue
    const t0 = a.i >= 0 ? (out[a.i].t1 ?? a.t) : 0, t1 = b.t
    const lens = gapIdx.map(i => norm(out[i].w).length + 1), tot = lens.reduce((x, y) => x + y, 0)
    let acc = t0
    gapIdx.forEach((i, q) => { const d = (t1 - t0) * lens[q] / tot; out[i].t0 = acc; out[i].t1 = acc + d * 0.9; out[i].fill = true; acc += d })
  }
  const misses = map.filter(x => x == null).length
  return { words: out, misses }
}

const lines = []
for (const L of script.lines) {
  const budget = L.window[1] - L.window[0] - L.lead - 0.25
  let speed = L.speed, raw, dur, clip = path.join(CLIPS, L.id + '.wav'), tempo = 1
  for (let k = 0; k < 3; k++) {
    raw = await synth(L.text, speed)
    dur = trim(raw, clip)
    if (dur <= budget) break
    speed = Math.min(1.45, speed * (dur / budget) * 1.02)
  }
  if (dur > budget) { tempo = dur / budget; dur = trim(raw, clip, tempo) }
  const { words, misses } = wordTimes(L.text, clip, dur)
  const start = L.window[0] + L.lead
  lines.push({ id: L.id, text: L.text, start, dur, speed: +speed.toFixed(3), tempo: +tempo.toFixed(3), file: path.relative(ROOT, clip), misses,
    words: words.map(w => ({ w: w.w, t0: +(start + w.t0).toFixed(3), t1: +(start + w.t1).toFixed(3), ...(w.fill ? { fill: 1 } : {}) })) })
  console.log(`${L.id.padEnd(7)} ${dur.toFixed(2)}s / budget ${budget.toFixed(2)}s  speed ${speed.toFixed(2)}${tempo !== 1 ? ' atempo ' + tempo.toFixed(3) : ''}  unmatched ${misses}/${words.length}`)
}
const timing = { engine, duration: script.duration, fps: script.fps, lines }
fs.writeFileSync(path.join(ROOT, 'timing.json'), JSON.stringify(timing, null, 1))
fs.writeFileSync(path.join(ROOT, 'src/timing.js'), '// generated by tools/tts.mjs\nexport const TIMING = ' + JSON.stringify(timing) + '\n')
console.log('timing.json + src/timing.js escritos (' + engine + ')')
