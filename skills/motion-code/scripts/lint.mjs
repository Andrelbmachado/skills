#!/usr/bin/env node
// Numeric motion lint: reads per-frame channels and reports what an animator
// checks on a graph editor — extremes, spacing/easing, pops, settle, overshoot,
// bounce consistency and loop seams. Text out, so no screenshots are needed
// to answer "is the timing right?".
//
//   node lint.mjs track.json [--loop]
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const f = (v, d = 2) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(d))
const ft = t => `${t.toFixed(3)}s`

// Zigzag with hysteresis: a turn counts only once the value retreats more than
// `h` from the running extreme, so pixel/float noise cannot fake reversals.
function extrema(t, v, h) {
  const out = []
  const at = (i, kind) => ({ i, t: t[i], v: v[i], kind })
  let dir = 0
  let ext = 0
  for (let i = 1; i < v.length; i++) {
    if (dir === 0) {
      if (Math.abs(v[i] - v[0]) > h) [dir, ext] = [Math.sign(v[i] - v[0]), i]
    } else if (dir > 0) {
      if (v[i] > v[ext]) ext = i
      else if (v[ext] - v[i] > h) [out[out.length], dir, ext] = [at(ext, 'max'), -1, i]
    } else {
      if (v[i] < v[ext]) ext = i
      else if (v[i] - v[ext] > h) [out[out.length], dir, ext] = [at(ext, 'min'), 1, i]
    }
  }
  return out
}

function easingOf(speeds) {
  const n = speeds.length
  const q = Math.max(1, Math.floor(n / 4))
  const head = mean(speeds.slice(0, q))
  const tail = mean(speeds.slice(n - q))
  const mid = mean(speeds.slice(q, n - q)) || (head + tail) / 2
  const hi = Math.max(head, mid, tail)
  const lo = Math.min(head, mid, tail)
  if (hi > 0 && lo / hi > 0.8) return 'linear'
  if (head < 0.6 * mid && tail < 0.6 * mid) return 'ease-in-out'
  if (head < 0.6 * tail) return 'ease-in (accelerates)'
  if (tail < 0.6 * head) return 'ease-out (decelerates)'
  return 'irregular'
}

// Floor = the extreme kind whose values barely vary (contacts); the other kind
// holds the apexes. Ballistic arcs obey h = g·T²/8, so g per bounce must match.
function bounce(ext, range) {
  const byKind = k => ext.filter(e => e.kind === k)
  const spread = es => (es.length < 2 ? Infinity : Math.max(...es.map(e => e.v)) - Math.min(...es.map(e => e.v)))
  const [maxs, mins] = [byKind('max'), byKind('min')]
  const floorKind = spread(maxs) < spread(mins) ? 'max' : 'min'
  const contacts = floorKind === 'max' ? maxs : mins
  const apexes = floorKind === 'max' ? mins : maxs
  if (contacts.length < 2 || apexes.length < 2 || spread(contacts) > 0.08 * range) return null
  const floor = mean(contacts.map(c => c.v))
  const arcs = []
  for (let k = 0; k + 1 < contacts.length; k++) {
    const a = apexes.find(p => p.t > contacts[k].t && p.t < contacts[k + 1].t)
    if (a) arcs.push({ h: Math.abs(a.v - floor), T: contacts[k + 1].t - contacts[k].t })
  }
  if (arcs.length < 2) return null
  const lines = [`bounce: ${contacts.length} contacts @ ${contacts.map(c => c.t.toFixed(2)).join(', ')}s`]
  const hr = arcs.slice(1).map((a, k) => a.h / arcs[k].h)
  const tr = arcs.slice(1).map((a, k) => a.T / arcs[k].T)
  // Tiny late hops are dominated by squash offset and sampling error: judge the
  // physics on arcs at least 15% of the first one.
  const big = arcs.filter(a => a.h >= 0.15 * arcs[0].h)
  const bhr = big.slice(1).map((a, k) => a.h / big[k].h)
  const btr = big.slice(1).map((a, k) => a.T / big[k].T)
  const g = big.map(a => (8 * a.h) / (a.T * a.T))
  const gcv = Math.sqrt(mean(g.map(x => (x - mean(g)) ** 2))) / mean(g)
  const e = Math.sqrt(mean(bhr))
  lines.push(`  apex ratio ${hr.map(x => f(x)).join(' ')} (e≈${f(e)}), interval ratio ${tr.map(x => f(x)).join(' ')} (≈e if physical)`)
  const flags = []
  if (bhr.some(x => x >= 1)) flags.push('apex not shrinking')
  if (btr.some(x => x >= 1)) flags.push('interval not shrinking (floaty)')
  if (gcv > 0.2) flags.push(`implied gravity varies ${Math.round(gcv * 100)}% between bounces — timing does not match heights`)
  lines.push(`  implied g ${g.map(x => f(x, 0)).join(' ')} units/s²${flags.length ? ' ⚠ ' + flags.join('; ') : ' ✓ consistent'}`)
  return lines
}

export function lintChannel(name, t, v, { loop = false } = {}) {
  const min = Math.min(...v)
  const max = Math.max(...v)
  const range = max - min
  // Float/pixel jitter is not motion.
  if (!(range > 1e-3 * Math.max(1, Math.abs(min), Math.abs(max)))) return { static: true, lines: [] }
  const eps = 0.002 * range
  const d = v.slice(1).map((x, i) => x - v[i])
  const dt = mean(t.slice(1).map((x, i) => x - t[i])) || 1 / 60
  const lines = [`${name}: ${f(v[0])} → ${f(v[v.length - 1])}  [min ${f(min)}, max ${f(max)}]  peak speed ${f(Math.max(...d.map(Math.abs)) / dt)}/s`]

  const pops = []
  for (let i = 1; i + 1 < d.length; i++) {
    const a = Math.abs(d[i])
    if (a > 0.05 * range && a > 3 * Math.max(Math.abs(d[i - 1]), Math.abs(d[i + 1]), eps)) pops.push(t[i + 1])
  }
  if (pops.length) lines.push(`  ⚠ pop/jump at ${pops.slice(0, 6).map(ft).join(', ')} (one-frame spike vs neighbours)`)

  const ext = extrema(t, v, Math.max(eps, 0.02 * range))
  const b = ext.length >= 3 ? bounce(ext, range) : null
  if (b) lines.push(...b.map(l => '  ' + l))
  else if (ext.length) lines.push(`  reversals: ${ext.slice(0, 8).map(e => `${e.kind}@${e.t.toFixed(2)}s=${f(e.v)}`).join(' ')}${ext.length > 8 ? ' …' : ''}`)

  // Spacing of each monotonic stretch (between reversals) with enough samples.
  const cuts = [0, ...ext.map(e => e.i), v.length - 1]
  const segs = []
  for (let k = 0; k + 1 < cuts.length; k++) {
    const [a, z] = [cuts[k], cuts[k + 1]]
    const speeds = d.slice(a, z).map(Math.abs)
    // Trim holds/jitter at both ends so easing is judged on the actual move.
    const floor = Math.max(eps, 0.05 * Math.max(0, ...speeds))
    const moving = speeds.map((s, i) => (s > floor ? i : -1)).filter(i => i >= 0)
    if (moving.length < 4) continue
    const s0 = a + moving[0]
    const s1 = a + moving[moving.length - 1] + 1
    segs.push(`${t[s0].toFixed(2)}–${t[s1].toFixed(2)}s ${easingOf(d.slice(s0, s1).map(Math.abs))}`)
  }
  if (segs.length && !b) lines.push(`  spacing: ${segs.slice(0, 6).join(' | ')}${segs.length > 6 ? ' …' : ''}`)

  let last = -1
  for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > eps) last = i
  if (last >= 0 && last + 1 < d.length - 1) lines.push(`  settles at ${ft(t[last + 1])}`)
  if (ext.length && ext.length <= 3 && !b) {
    const end = v[v.length - 1]
    const dir = Math.sign(end - v[0])
    const past = dir > 0 ? max - end : end - min
    const travel = Math.abs(end - v[0])
    // past ≥ half the travel is a there-and-back move, not an overshoot.
    if (dir && past > eps && travel > eps && past < 0.5 * travel) lines.push(`  overshoot ${f(past)} (${Math.round((100 * past) / travel)}% of travel)`)
  }
  if (loop) {
    const gap = Math.abs(v[v.length - 1] - v[0]) / range
    const vgap = Math.abs(d[d.length - 1] - d[0]) / Math.max(Math.abs(d[0]), Math.abs(d[d.length - 1]), eps)
    lines.push(`  loop seam: position gap ${Math.round(gap * 100)}%, velocity gap ${Math.round(vgap * 100)}%${gap > 0.02 || vgap > 0.5 ? ' ⚠ will pop on wrap' : ' ✓'}`)
  }
  return { static: false, lines }
}

export function lintTrack(rows, opts = {}) {
  if (rows.length < 3) return ['track: fewer than 3 samples — nothing to lint']
  const t = rows.map(r => r.t)
  const names = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => k !== 't')
  const out = []
  const statics = []
  const partial = new Map() // "a–b" window → channels only present inside it
  for (const name of names) {
    const ok = rows.filter(r => typeof r[name] === 'number' && Number.isFinite(r[name]))
    if (ok.length < 3) {
      partial.set('<3 samples', [...(partial.get('<3 samples') ?? []), name])
      continue
    }
    if (ok.length < rows.length) {
      const w = `${ok[0].t.toFixed(2)}–${ok[ok.length - 1].t.toFixed(2)}s`
      partial.set(w, [...(partial.get(w) ?? []), name])
    }
    const r = lintChannel(name, ok.map(x => x.t), ok.map(x => x[name]), opts)
    if (r.static) statics.push(name)
    else out.push(...r.lines)
  }
  for (const [w, ns] of partial) out.push(`present only ${w}: ${ns.join(', ')} (element absent/unmounted outside)`)
  if (statics.length) out.push(`static: ${statics.join(', ')}`)
  out.unshift(`track: ${rows.length} samples ${t[0].toFixed(2)}–${t[t.length - 1].toFixed(2)}s`)
  return out
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, ...rest] = process.argv.slice(2)
  if (!file) {
    console.error('usage: node lint.mjs track.json [--loop]')
    process.exit(2)
  }
  const rows = JSON.parse(await readFile(file, 'utf8'))
  console.log(lintTrack(rows, { loop: rest.includes('--loop') }).join('\n'))
}
