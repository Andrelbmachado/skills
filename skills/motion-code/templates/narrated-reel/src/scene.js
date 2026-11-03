// Círculo cromático — 60 s reel, 1080×1920. Pure f(t): seek(t) redraws everything from scratch.
import { TIMING } from './timing.js'
import { buildPlan, HUES } from './plan.js'
import { ART } from './art.js'

const { K } = buildPlan(TIMING)
const DUR = TIMING.duration, FPS = TIMING.fps
const cv = document.getElementById('c'), ctx = cv.getContext('2d')
const W = 1080, H = 1920

// ---------- tokens ----------
const BG = '#000000', PAPER = '#F3EEE4', MUTED = '#8D8A99', TRACK = '#2C2B38'
const FONT = 'Bricolage'
const C = { x: 540, y: 800 }, R_O = 308, R_I = 218, R_P = 172, PT = 17 // points sit inside the ring with ~24 px of air
const PANEL = { x: 110, y: 1200, w: 860, h: 368 }
const CAP_Y = 1700 // caption baseline: fixed band at the bottom of the frame

// ---------- math ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, k) => a + (b - a) * k
const eOut = k => 1 - (1 - k) ** 3, eIn = k => k ** 3, eInOut = k => k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k) }
// damped step response (0→1); f = natural freq (Hz), z = damping ratio
function sstep(t, f = 1.8, z = 0.62) {
  if (t <= 0) return 0
  const w = 2 * Math.PI * f
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t)
  const wd = w * Math.sqrt(1 - z * z)
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t))
}
// keyed channel = superposition of spring steps
function chan(t, v0, keys) { let v = v0, prev = v0; for (const [tk, vk, f = 1.8, z = 0.62] of keys) { v += (vk - prev) * sstep(t - tk, f, z); prev = vk } return v }
const fin = (t, t0, d = 0.22) => eOut(clamp((t - t0) / d))
const fout = (t, t1, d = 0.2) => 1 - eIn(clamp((t - t1) / d))
const win = (t, a, b, di = 0.22, dout = 0.2) => fin(t, a, di) * fout(t, b, dout)
const pulse = (t, t0, k = 4.5) => t < t0 ? 0 : Math.exp(-(t - t0) * k) * (1 - Math.exp(-(t - t0) * 40))
const wrapD = (a, b) => ((a - b) % 12 + 18) % 12 - 6
const ang = idx => -Math.PI / 2 + idx * Math.PI / 6
const polar = (a, r) => ({ x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r })

// ---------- color ----------
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const mixc = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k)
const css = (c, a = 1) => `rgba(${c.map(v => Math.round(v)).join(',')},${a})`
const HC = HUES.map(h => hex(h[1]))
const P_RGB = hex(PAPER), BG_RGB = hex(BG)
const hueAt = idx => { const i = Math.floor(idx), k = idx - i, a = ((i % 12) + 12) % 12; return mixc(HC[a], HC[(a + 1) % 12], k) }
const lum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255

// ---------- selection points (persistent identities) ----------
const ctaFade = t => fout(t, K.ctaStart, 0.25)
const PTS = {
  P: { idx: t => chan(t, 7.4, [[K.hookLit + 0.1, 11.2, 1.3, 0.72], [K.hookLit + 0.72, 9.3, 1.4, 0.72], [K.hookLit + 1.3, 10.55, 1.5, 0.7], [K.anMain - 0.12, 8, 1.9, 0.62], [K.cpRetract, 10, 1.5, 0.65], [K.cpRotate, 8, 1.3, 0.62], [K.sqMove, 7, 1.6, 0.65]]),
       a: t => fin(t, K.hookLit, 0.1) * ctaFade(t), born: () => K.hookLit,
       glows: [K.anMain, K.cpContrast, K.trBaseLight, K.spMain, K.sqLight + 0.28] },
  N1: { idx: t => chan(t, 8, [[K.anN1, 7, 2.0, 0.6], [K.cpRetract, 8, 2.3, 0.85]]),
        a: t => fin(t, K.anN1, 0.06) * fout(t, K.cpRetract + 0.2, 0.14), born: () => K.anN1, glows: [K.anShadow] },
  N2: { idx: t => chan(t, 8, [[K.anN2, 9, 2.0, 0.6], [K.cpRetract, 8, 2.3, 0.85]]),
        a: t => fin(t, K.anN2, 0.06) * fout(t, K.cpRetract + 0.2, 0.14), born: () => K.anN2, glows: [] },
  V1: { idx: t => chan(t, 4, [[K.cpRotate, 2, 1.3, 0.62], [K.trSplit, 0, 1.6, 0.62], [K.spNarrow, 1, 1.8, 0.6], [K.rcMove, -2, 1.5, 0.65]]),
        a: t => fin(t, K.cpOpp, 0.06) * ctaFade(t), born: () => K.cpOpp, glows: [K.cpContrast, K.trBaseLight + 0.12, K.sqLight + 0.42] },
  V2: { idx: t => chan(t, 2, [[K.trSplit, 4, 1.6, 0.62], [K.spNarrow, 3, 1.8, 0.6], [K.rcMove, 2, 1.6, 0.65], [K.sqMove, 1, 1.6, 0.65]]),
        a: t => (t >= K.trSplit ? 1 : 0) * ctaFade(t), born: () => K.trSplit, noPop: true, glows: [K.trBaseLight + 0.24, K.sqLight] },
  V3: { idx: t => chan(t, 2, [[K.rcFourth, 4, 1.8, 0.62]]),
        a: t => fin(t, K.rcFourth, 0.08) * ctaFade(t), born: () => K.rcFourth, glows: [K.rcFourth + 0.05, K.sqLight + 0.14] },
}
const ghost = t => ({ idx: 2, a: win(t, K.spGhost, K.rcMove, 0.3, 0.3) })

// wheel scale: elastic pop-in, slight camera push, collapse at CTA
const wheelS = t => (0.12 + 0.88 * sstep(t - K.wheelIn, 2.2, 0.62)) * (0.94 + 0.06 * sstep(t - K.camPush, 1.0, 0.9)) * (1 - 0.55 * eIn(clamp((t - K.ctaStart) / 0.28)))
const wheelA = t => fin(t, K.wheelIn, 0.12) * fout(t, K.ctaStart, 0.26)

function pointState(t, S) {
  const out = {}
  for (const [id, p] of Object.entries(PTS)) {
    const idx = p.idx(t), a = p.a(t)
    const h = 1 / 120, v = (p.idx(t + h) - p.idx(t - h)) / (2 * h) // idx/s
    const pos = polar(ang(idx), R_P * S)
    const pop = p.noPop ? 1 : sstep(t - p.born(), 2.6, 0.5)
    let g = 0.0; for (const tg of p.glows) g += pulse(t, tg)
    out[id] = { id, idx, a, v, pos, pop, g, col: hueAt(idx) }
  }
  return out
}

// ---------- drawing primitives ----------
function setFont(px, weight = 600, stretch = 'normal') { ctx.font = `${weight} ${px}px ${FONT}`; ctx.fontStretch = stretch }
function sector(a0, a1, r0, r1) {
  const g0 = 3 / r0, g1 = 3 / r1
  ctx.beginPath(); ctx.arc(C.x, C.y, r1, a0 + g1, a1 - g1); ctx.arc(C.x, C.y, r0, a1 - g0, a0 + g0, true); ctx.closePath()
}

function drawWheel(t, S, pts) {
  const A = wheelA(t); if (A <= 0.001) return { sel: [] }
  const list = Object.values(pts).filter(p => p.a > 0.01)
  const gh = ghost(t)
  const sel = HUES.map((_, i) => {
    let s = 0; for (const p of list) s = Math.max(s, p.a * clamp(1 - Math.abs(wrapD(p.idx, i))))
    return Math.max(s, gh.a * 0.22 * (i === 2 ? 1 : 0))
  })
  const active = clamp(0.3 * fin(t, K.hookLit, 0.3) + 0.7 * fin(t, K.anMain - 0.05, 0.3))
  const labelsAll = win(t, K.labelsAll, K.labelsOff, 0.3, 0.25)
  // track (the border the points travel on)
  ctx.save(); ctx.globalAlpha = A
  ctx.strokeStyle = TRACK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(C.x, C.y, R_P * S, 0, Math.PI * 2); ctx.stroke()
  for (let i = 0; i < 12; i++) {
    const segIn = fin(t, K.wheelIn + i * 0.022, 0.14)
    const base = lerp(1, 0.36, active)
    ctx.globalAlpha = A * segIn * (base + (1 - base) * sel[i])
    ctx.fillStyle = css(HC[i])
    sector(ang(i - 0.5), ang(i + 0.5), R_I * S, R_O * S + 18 * sel[i])
    ctx.fill()
  }
  // hue labels: selected hues (and all of them while "cada posição" is spoken)
  for (let i = 0; i < 12; i++) {
    const la = Math.max(smooth(0.55, 0.95, sel[i]), labelsAll * 0.85) * A
    if (la < 0.01) continue
    const a = ang(i), r = R_O * S + 30 + 18 * sel[i]
    const p = polar(a, r), c = Math.cos(a), s = Math.sin(a)
    const [l1, l2] = HUES[i][0].includes('-') ? [HUES[i][0].split('-')[0] + '-', HUES[i][0].split('-')[1]] : [HUES[i][0], null]
    setFont(25, 600); ctx.fillStyle = css(sel[i] > 0.5 ? P_RGB : hex('#BDB9C8'), la)
    ctx.textAlign = c > 0.35 ? 'left' : c < -0.35 ? 'right' : 'center'
    ctx.textBaseline = 'middle'
    const lh = 27, n = l2 ? 2 : 1
    let y0 = p.y + (s > 0.35 ? (n * lh) / 2 - lh / 2 + 6 : s < -0.35 ? -(n * lh) / 2 + lh / 2 - 6 : -(n - 1) * lh / 2)
    ctx.fillText(l1, p.x, y0); if (l2) ctx.fillText(l2, p.x, y0 + lh)
  }
  ctx.restore()
  return { sel }
}

function drawPoint(p, A) {
  if (p.a <= 0.01) return
  const tangentSpeed = Math.abs(p.v) * (Math.PI / 6) * R_P // px/s
  const k = clamp(tangentSpeed / 2200, 0, 0.42)
  const sx = (1 + k) * p.pop, sy = p.pop / (1 + k)
  const ta = Math.atan2(p.pos.y - C.y, p.pos.x - C.x) + Math.PI / 2
  ctx.save(); ctx.globalAlpha = p.a * A; ctx.translate(p.pos.x, p.pos.y)
  // glow ("acende")
  const gr = PT * (2.0 + 1.6 * p.g)
  const grad = ctx.createRadialGradient(0, 0, PT * 0.6, 0, 0, gr)
  grad.addColorStop(0, css(p.col, 0.55 * (0.45 + 0.55 * clamp(p.g)))); grad.addColorStop(1, css(p.col, 0))
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, gr, 0, Math.PI * 2); ctx.fill()
  ctx.rotate(ta); ctx.scale(sx * (1 + 0.18 * clamp(p.g)), sy * (1 + 0.18 * clamp(p.g)))
  ctx.beginPath(); ctx.arc(0, 0, PT + 5, 0, Math.PI * 2); ctx.fillStyle = css(BG_RGB, 0.85); ctx.fill()
  ctx.beginPath(); ctx.arc(0, 0, PT, 0, Math.PI * 2)
  ctx.fillStyle = css(p.col); ctx.fill()
  ctx.lineWidth = 4.5 / Math.max(0.5, (sx + sy) / 2); ctx.strokeStyle = PAPER; ctx.stroke()
  ctx.restore()
}

// connection that draws from a toward b with a damped overshoot; width stretches thin while fast, squashes on arrival
function edgeProg(t, t0) { return t < t0 ? 0 : sstep(t - t0, 2.0, 0.68) }
function drawEdge(a, b, t, t0, { alpha = 1, dash = null, width = 5, extra = 0 } = {}) {
  if (alpha <= 0.01 || t < t0) return
  const p = edgeProg(t, t0), dp = (edgeProg(t + 1 / 120, t0) - edgeProg(t - 1 / 120, t0)) * 60
  const wmul = clamp(1 - 0.38 * clamp(dp / 7) + 3.5 * Math.max(0, p - 1) + extra, 0.55, 2.4)
  const ex = a.x + (b.x - a.x) * p, ey = a.y + (b.y - a.y) * p
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = PAPER; ctx.lineCap = 'round'; ctx.lineWidth = width * wmul
  if (dash) ctx.setLineDash(dash)
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.restore()
}

function drawArcs(t, verts, A, S) {
  if (A <= 0.01) return
  const v = verts.map(p => ({ ...p, m: ((p.idx % 12) + 12) % 12 })).sort((x, y) => x.m - y.m)
  setFont(26, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  v.forEach((p, i) => {
    const q = v[(i + 1) % v.length]
    const span = ((q.m - p.m) + 12) % 12 || 12
    const a0 = ang(p.m), a1 = a0 + span * Math.PI / 6, gap = (PT + 10) / (R_P * S)
    const pr = eOut(clamp(A * 1.4 - i * 0.08))
    ctx.save(); ctx.globalAlpha = A; ctx.strokeStyle = PAPER; ctx.lineWidth = 4; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(C.x, C.y, R_P * S, a0 + gap, a0 + gap + (a1 - a0 - 2 * gap) * pr); ctx.stroke()
    const half = span * Math.PI / 12, d = R_P * S * Math.cos(half)
    const rl = R_P * S - d > 50 ? (d + R_P * S) / 2 : d - 34
    const m = polar((a0 + a1) / 2, rl)
    ctx.fillStyle = PAPER; ctx.fillText(Math.round(span * 30) + '°', m.x, m.y)
    ctx.restore()
  })
}

function drawShapes(t, pts, S) {
  const A = wheelA(t)
  const P = pts.P.pos, V1 = pts.V1.pos, V2 = pts.V2.pos, V3 = pts.V3.pos
  const fade = ctaFade(t)
  // analogous band along the border, colored by the hues it covers
  const bandA = win(t, K.anBand, K.cpRetract + 0.25, 0.15, 0.2) * A
  if (bandA > 0.01) {
    const i0 = pts.N1.idx, i1 = pts.N2.idx, n = 28
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 44
    for (let k = 0; k < n; k++) {
      const a = lerp(i0, i1, k / n), b = lerp(i0, i1, (k + 1) / n)
      ctx.globalAlpha = bandA * 0.62; ctx.strokeStyle = css(hueAt((a + b) / 2))
      ctx.beginPath(); ctx.arc(C.x, C.y, R_P * S, ang(a), ang(b) + 0.004); ctx.stroke()
    }
    ctx.restore()
  }
  // polygon fill (triad → split → rectangle → square)
  const fillA = fin(t, K.trBase + 0.3, 0.4) * fade * 0.07
  if (fillA > 0.002) {
    const poly = t < K.rcFourth ? [pts.P, pts.V1, pts.V2] : [pts.V1, pts.V2, pts.V3, pts.P]
    const s = poly.map(p => ({ ...p, m: ((p.idx % 12) + 12) % 12 })).sort((x, y) => x.m - y.m)
    ctx.save(); ctx.globalAlpha = fillA; ctx.fillStyle = PAPER; ctx.beginPath()
    s.forEach((p, i) => i ? ctx.lineTo(p.pos.x, p.pos.y) : ctx.moveTo(p.pos.x, p.pos.y)); ctx.closePath(); ctx.fill(); ctx.restore()
  }
  // ghost of the old opposite (split complementary reference)
  const g = ghost(t)
  if (g.a > 0.01) {
    const gp = polar(ang(g.idx), R_P * S)
    drawEdge(P, gp, t, K.spGhost, { alpha: g.a * 0.45 * A, dash: [10, 12], width: 3 })
    ctx.save(); ctx.globalAlpha = g.a * 0.6 * A; ctx.setLineDash([6, 6]); ctx.strokeStyle = PAPER; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(gp.x, gp.y, PT + 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
  }
  // diagonals = the two complementary pairs of the rectangle
  const dA = win(t, K.rcDiag, K.rcDiagOff, 0.1, 0.35) * A
  drawEdge(V1, V3, t, K.rcDiag, { alpha: dA * 0.8, dash: [14, 12], width: 4 })
  drawEdge(V2, P, t, K.rcDiag + 0.08, { alpha: dA * 0.8, dash: [14, 12], width: 4 })
  // solid connections
  const ca = A * fade
  const lineExtra = 0.9 * pulse(t, K.cpContrast, 5)
  drawEdge(P, V1, t, K.cpLine, { alpha: ca, extra: lineExtra })
  if (t >= K.trSplit && t < K.rcFourth) drawEdge(P, V2, t, -10, { alpha: ca })
  if (t >= K.rcFourth) { drawEdge(V3, V2, t, -10, { alpha: ca }); drawEdge(P, V3, t, -10, { alpha: ca }) }
  drawEdge(V1, V2, t, K.trBase, { alpha: ca })
  // interval arcs (equal vs unequal spacing)
  drawArcs(t, [pts.P, pts.V1, pts.V2], win(t, K.trArcs, K.trArcsOff, 0.35, 0.25) * A, S)
  drawArcs(t, [pts.V1, pts.V2, pts.V3, pts.P], win(t, K.rcArcs, K.rcArcsOff, 0.35, 0.25) * A, S)
  drawArcs(t, [pts.V1, pts.V2, pts.V3, pts.P], win(t, K.sqArcs, K.sqArcsOff, 0.35, 0.25) * A, S)
  // points on top
  for (const id of ['N1', 'N2', 'V3', 'V2', 'V1', 'P']) drawPoint(pts[id], A)
}

// ---------- titles ----------
const TITLES = [
  { lines: ['COMBINAÇÃO DE CORES,', 'SEM CHUTE'], tin: K.hookTitle, tout: K.anTitle - 0.12, size: 84 },
  { lines: ['ANÁLOGAS'], sub: 'cores vizinhas', tin: K.anTitle, tout: K.cpTitle - 0.12 },
  { lines: ['COMPLEMENTARES'], sub: 'lados opostos', tin: K.cpTitle, tout: K.trTitle - 0.12 },
  { lines: ['TRÍADE'], sub: 'três pontos equilibrados', tin: K.trTitle, tout: K.spTitle - 0.12 },
  { lines: ['COMPLEMENTARES', 'DIVIDIDAS'], tin: K.spTitle, tout: K.rcTitle - 0.12, size: 84 },
  { lines: ['TETRÁDICA'], sub: 'retângulo', tin: K.rcTitle, tout: K.sqTitle - 0.12 },
  { lines: ['TETRÁDICA'], sub: 'quadrado', tin: K.sqTitle, tout: K.ctaStart - 0.05 },
]
function drawTitles(t) {
  for (const T of TITLES) {
    if (t < T.tin || t > T.tout + 0.2) continue
    const ain = fin(t, T.tin, 0.12), aout = fout(t, T.tout, 0.16), a = ain * aout
    const sp = sstep(t - T.tin, 2.4, 0.5)
    const dy = (1 - sp) * 26 - (1 - aout) * 18
    const sc = 1 + (1 - sp) * 0.08
    const size = T.size || 104
    ctx.save(); ctx.globalAlpha = a; ctx.translate(540, 0)
    setFont(size, 800, 'condensed'); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = PAPER
    const lh = size * 0.98
    const base = T.lines.length === 2 ? 296 : 326
    T.lines.forEach((ln, i) => {
      const wd = ctx.measureText(ln).width, fit = Math.min(1, 940 / wd)
      ctx.save(); ctx.translate(0, base + i * lh + dy); ctx.scale(sc * fit, sc * fit); ctx.fillText(ln, 0, 0); ctx.restore()
    })
    if (T.sub) {
      const sa = fin(t, T.tin + 0.12, 0.2)
      setFont(42, 500); ctx.fillStyle = css(hex('#BDB9C8'), sa)
      ctx.fillText(T.sub, 0, base + 58 + dy * 0.6 + (1 - sa) * 10)
    }
    ctx.restore()
  }
}

// ---------- captions (short word groups, scheme names highlighted) ----------
const HL = { analog: ['análogas'], comp: ['complementares#0'], triad: ['tríade'], split: ['complementares', 'divididas'], rect: ['tetrádica', 'retangular'], square: ['tetrádica', 'quadrada'] }
const normW = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
const NUM = { sessenta: '60', trinta: '30', dez: '10' }
const GROUPS = (() => {
  const groups = []
  for (const L of TIMING.lines) {
    const hl = (HL[L.id] || []).map(x => normW(x.split('#')[0]))
    let g = null, seenComp = 0
    L.words.forEach((w, i) => {
      const isHL = hl.includes(normW(w.w)) && !(L.id === 'comp' && normW(w.w) === 'complementares' && seenComp++ > 0)
      const len = g ? g.words.reduce((s, x) => s + x.w.length + 1, 0) : 0
      if (!g || len + w.w.length > 22 || g.words.length >= 4 || /[,.?:!]$/.test(g.words[g.words.length - 1].w)) {
        g = { line: L.id, words: [], end: L.start + L.dur + 0.35 }; groups.push(g)
      }
      g.words.push({ ...w, w: w.w.replace(/^(sessenta|trinta|dez)/i, m => NUM[m.toLowerCase()]), hl: isHL })
    })
  }
  groups.forEach((g, i) => {
    g.start = g.words[0].t0 - 0.06
    const nx = groups[i + 1]
    if (nx) g.end = Math.min(nx.line === g.line ? nx.words[0].t0 - 0.06 : g.end, nx.words[0].t0 - 0.06)
  })
  return groups
})()
function drawCaptions(t) { // neutro: branco; palavra falada = opacidade total; termo do passo = peso 800 (sem pílula colorida)
  if (t > K.ctaText - 0.05) return
  const g = GROUPS.find(g => t >= g.start && t < g.end); if (!g) return
  const a = fin(t, g.start, 0.1) * fout(t, g.end - 0.08, 0.08)
  const wt = w => w.hl ? 800 : 650
  let size = 58
  const meas = () => g.words.map(w => { setFont(size, wt(w)); return ctx.measureText(w.w).width })
  let widths = meas(); setFont(size, 650); let sp = ctx.measureText(' ').width
  let total = widths.reduce((s, x) => s + x, 0) + sp * (g.words.length - 1)
  if (total > 980) { size = Math.floor(size * 980 / total); widths = meas(); setFont(size, 650); sp = ctx.measureText(' ').width; total = widths.reduce((s, x) => s + x, 0) + sp * (g.words.length - 1) }
  const y = CAP_Y + (1 - eOut(clamp((t - g.start) / 0.14))) * 10
  let x = 540 - total / 2; const xs = []; g.words.forEach((w, i) => { xs.push(x); x += widths[i] + sp })
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  g.words.forEach((w, i) => {
    const cur = t >= w.t0 - 0.03 && t < w.t1 + 0.04, past = t >= w.t1 + 0.04
    setFont(size, wt(w)); ctx.fillStyle = `rgba(255,255,255,${cur ? 1 : past ? 0.82 : 0.32})`
    ctx.fillText(w.w, xs[i], y)
  })
  ctx.restore()
}

// ---------- art panel: real paintings, exact sample points → colour balls compared outside the frame ----------
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r) }
const IMG = {}
const artReady = Promise.all(Object.entries(ART).map(([k, a]) => new Promise((res, rej) => {
  const im = new Image(); im.onload = () => { IMG[k] = im; res() }; im.onerror = () => rej(new Error('art ' + a.file)); im.src = 'assets/art/' + a.file
})))
const ART_MAXW = 610, BALL_COL = 300, ART_GAP = 54
function artLayout(key) {
  let h = PANEL.h, w = ART[key].aspect * h
  if (w > ART_MAXW) { w = ART_MAXW; h = w / ART[key].aspect }
  const total = w + ART_GAP + BALL_COL, x = 540 - total / 2
  return { x, y: PANEL.y + (PANEL.h - h) / 2, w, h, bx: x + w + ART_GAP + 36 }
}
// ball = the colour sampled from the painting, ringed by the pure hue of the matching wheel position
function drawBall(cx, cy, r, rgb, hue, k, A, glow = 0) {
  if (k <= 0.001 || A <= 0.01) return
  ctx.save(); ctx.globalAlpha = A; ctx.translate(cx, cy); ctx.scale(k, k)
  if (glow > 0.01) {
    const g = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 2.4)
    g.addColorStop(0, css(HC[hue], 0.5 * clamp(glow))); g.addColorStop(1, css(HC[hue], 0))
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2); ctx.fill()
  }
  ctx.beginPath(); ctx.arc(0, 0, r + 7, 0, Math.PI * 2); ctx.fillStyle = css(HC[hue]); ctx.fill()
  ctx.beginPath(); ctx.arc(0, 0, r + 2.5, 0, Math.PI * 2); ctx.fillStyle = BG; ctx.fill()
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = rgb; ctx.fill()
  ctx.restore()
}
function ballLabel(text, x, y, a, tag = null) {
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'left'
  if (tag) {
    setFont(34, 800, 'condensed'); ctx.fillStyle = PAPER; ctx.textBaseline = 'alphabetic'; ctx.fillText(tag, x, y + 2)
    setFont(22, 550); ctx.fillStyle = css(hex('#BDB9C8')); ctx.fillText(text, x, y + 28)
  } else { setFont(25, 600); ctx.fillStyle = css(P_RGB, 0.94); ctx.textBaseline = 'middle'; ctx.fillText(text, x, y) }
  ctx.restore()
}

function drawArt(t, key, tin, tout, times, o = {}) {
  const A = win(t, tin, tout, 0.22, 0.22); if (A <= 0.01) return
  const a = ART[key], L = artLayout(key), im = IMG[key]
  const k = sstep(t - tin, 2.2, 0.66), s = 0.92 + 0.08 * k
  ctx.save(); ctx.globalAlpha = A * clamp(k * 1.6)
  ctx.translate(L.x + L.w / 2, L.y + L.h / 2); ctx.scale(s, s); ctx.translate(-L.w / 2, -L.h / 2)
  ctx.save(); rrect(0, 0, L.w, L.h, 10); ctx.clip(); if (im) ctx.drawImage(im, 0, 0, L.w, L.h); ctx.restore()
  ctx.strokeStyle = css(P_RGB, 0.3); ctx.lineWidth = 2; rrect(0, 0, L.w, L.h, 10); ctx.stroke()
  ctx.restore()
  // credit under the painting
  const ca = A * fin(t, tin + 0.25, 0.3)
  ctx.save(); ctx.globalAlpha = ca; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  setFont(23, 650); ctx.fillStyle = PAPER; ctx.fillText(a.title, L.x, L.y + L.h + 31)
  const tw = ctx.measureText(a.title).width
  setFont(23, 450); ctx.fillStyle = MUTED; ctx.fillText(a.by, L.x + tw + 12, L.y + L.h + 31)
  ctx.restore()
  // ball slots follow the vertical order of the points, so leaders never cross
  const n = a.points.length
  const rank = a.points.map((p, i) => a.points.filter((q, j) => q.v < p.v || (q.v === p.v && j < i)).length)
  a.points.forEach((p, i) => {
    const tb = times[i]; if (t < tb) return
    const px = L.x + p.u * L.w, py = L.y + p.v * L.h
    const r = o.sizes ? o.sizes[i] : (n > 3 ? 27 : 31)
    const span = Math.max(L.h, n * 96), cx = L.bx, cy = L.y + L.h / 2 - span / 2 + span * (rank[i] + 0.5) / n
    const km = sstep(t - tb, 3.0, 0.5), kb = sstep(t - tb - 0.14, 2.6, 0.52)
    // marker on the exact spot of the painting
    ctx.save(); ctx.globalAlpha = A; ctx.translate(px, py); ctx.scale(km, km)
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.lineWidth = 7; ctx.strokeStyle = css(BG_RGB, 0.55); ctx.stroke()
    ctx.lineWidth = 3.5; ctx.strokeStyle = PAPER; ctx.stroke()
    ctx.restore()
    // leader from the marker to the ball
    const dx = cx - px, dy = cy - py, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d
    drawEdge({ x: px + ux * 14, y: py + uy * 14 }, { x: cx - ux * (r + 11), y: cy - uy * (r + 11) }, t, tb + 0.05, { alpha: A * 0.9, width: 3 })
    drawBall(cx, cy, r, p.rgb, p.hue, kb, A, o.glow ? o.glow(t, i) : 0)
    ballLabel(HUES[p.hue][0], cx + r + 20, cy, A * fin(t, tb + 0.22, 0.2), o.tags ? o.tags[i] : null)
  })
}

// a dab of paint that falls (gravity: ease-in) and squashes on contact
function drawDab(t, t0, x, y, r, col, A) {
  if (t < t0) return
  const fall = 0.26, k = clamp((t - t0) / fall)
  const yy = lerp(y - 120, y, k * k)
  const land = t - t0 - fall
  const sq = land > 0 ? 0.32 * Math.exp(-land * 7) * Math.cos(land * 26) : -0.12 * k
  const melt = clamp((t - t0 - fall - 0.25) / 0.45)
  ctx.save(); ctx.globalAlpha = A * (1 - melt * 0.85); ctx.translate(x, yy); ctx.scale(1 + sq, 1 - sq); ctx.fillStyle = css(col)
  ctx.beginPath(); ctx.arc(0, 0, r * (1 + melt * 0.6), 0, Math.PI * 2); ctx.fill(); ctx.restore()
}

// complementary as a shadow: a red sphere whose shadow side takes a little green (a possibility, not a rule)
function drawShadowDemo(t) {
  const A = win(t, K.cpShadow, K.cpArt - 0.05, 0.2, 0.2); if (A <= 0.01) return
  const red = HC[4], green = HC[10]
  const flat = mixc(red, BG_RGB, 0.5), mixed = mixc(mixc(red, green, 0.32), BG_RGB, 0.42)
  const shadow = mixc(flat, mixed, eInOut(clamp((t - K.cpMix) / 0.55)))
  const k = sstep(t - K.cpShadow, 2.2, 0.62)
  const cx = 350, cy = PANEL.y + PANEL.h / 2, r = 150 * k
  ctx.save(); ctx.globalAlpha = A
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = css(shadow); ctx.fill()
  ctx.save(); ctx.clip(); ctx.beginPath(); ctx.arc(cx - 42 * k, cy - 36 * k, r * 0.92, 0, Math.PI * 2); ctx.fillStyle = css(red); ctx.fill(); ctx.restore()
  ctx.restore()
  drawDab(t, K.cpDab, cx + 96, cy + 78, 16, green, A)
  const bx = 660, rows = [
    [css(red), 4, 'Vermelho', K.cpShadow + 0.15], [css(green), 10, '+ um pouco de verde', K.cpDab], [css(mixed), 4, '= sombra', K.cpMix],
  ]
  rows.forEach(([rgb, hue, text, tb], i) => {
    if (t < tb) return
    const cy2 = PANEL.y + PANEL.h * (i + 0.5) / 3
    drawBall(bx, cy2, 31, rgb, hue, sstep(t - tb, 2.6, 0.52), A)
    ballLabel(text, bx + 49, cy2, A * fin(t, tb + 0.15, 0.2))
  })
}

function drawPanels(t) {
  const st = (t0, n, d = 0.16) => Array.from({ length: n }, (_, i) => t0 + 0.35 + i * d)
  drawArt(t, 'analog', K.anArt, K.cpOut, st(K.anArt, 3), { glow: (t, i) => i === 2 ? pulse(t, K.anShadow, 2.2) : 0 })
  drawShadowDemo(t)
  drawArt(t, 'comp', K.cpArt, K.trPanelOut, [K.cpB1, K.cpB2], { glow: (t, i) => i === 0 ? pulse(t, K.cpPop, 1.8) : 0 })
  drawArt(t, 'triad', K.trArt, K.spOut, [K.trB1, K.trB2, K.trB3], { sizes: [40, 30, 20], tags: ['60%', '30%', '10%'] })
  drawArt(t, 'split', K.spArt, K.rcOut, [K.spB1, K.spB2, K.spB3])
  drawArt(t, 'rect', K.rcArt, K.sqOut, [K.rcB1, K.rcB2, K.rcB3, K.rcB4], { glow: (t, i) => i === 0 ? pulse(t, K.rcDom, 2.2) : 0 })
  drawArt(t, 'square', K.sqArt, K.ctaStart, st(K.sqArt, 4, 0.14), { glow: (t, i) => i === 3 ? pulse(t, K.sqDom, 2.2) : 0 })
}

// ---------- CTA ----------
const MINIS = [
  { name: 'Análogas', idx: [7, 8, 9], band: true },
  { name: 'Complementares', idx: [8, 2] },
  { name: 'Tríade', idx: [8, 0, 4] },
  { name: 'Divididas', idx: [8, 1, 3] },
  { name: 'Retângulo', idx: [2, 4, 8, 10] },
  { name: 'Quadrado', idx: [1, 4, 7, 10] },
]
function drawMini(m, cx, cy, s, a) {
  const ro = 100 * s, ri = 72 * s, rp = 56 * s
  ctx.save(); ctx.globalAlpha = a
  for (let i = 0; i < 12; i++) {
    const on = m.idx.includes(i)
    ctx.globalAlpha = a * (on ? 1 : 0.32); ctx.fillStyle = css(HC[i])
    const a0 = ang(i - 0.5), a1 = ang(i + 0.5), g = 2 / ro
    ctx.beginPath(); ctx.arc(cx, cy, ro + (on ? 7 * s : 0), a0 + g, a1 - g); ctx.arc(cx, cy, ri, a1 - g, a0 + g, true); ctx.closePath(); ctx.fill()
  }
  ctx.globalAlpha = a
  const pts = m.idx.map(i => ({ x: cx + Math.cos(ang(i)) * rp, y: cy + Math.sin(ang(i)) * rp, i }))
  ctx.strokeStyle = PAPER; ctx.lineWidth = 3; ctx.lineCap = 'round'
  if (m.band) { ctx.globalAlpha = a * 0.5; ctx.lineWidth = 12; ctx.strokeStyle = css(HC[8]); ctx.beginPath(); ctx.arc(cx, cy, rp, ang(7), ang(9)); ctx.stroke(); ctx.globalAlpha = a }
  else if (pts.length === 2) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke() }
  else { const s2 = [...pts].sort((p, q) => p.i - q.i); ctx.beginPath(); s2.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke() }
  for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 8 * s, 0, Math.PI * 2); ctx.fillStyle = css(HC[p.i]); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = PAPER; ctx.stroke() }
  setFont(27, 600); ctx.textAlign = 'center'; ctx.fillStyle = PAPER; ctx.globalAlpha = a
  ctx.fillText(m.name, cx, cy + 148 * s)
  ctx.restore()
}
function drawCTA(t) {
  if (t < K.ctaStart) return
  MINIS.forEach((m, k) => {
    const cx = [210, 540, 870][k % 3], cy = [720, 1060][Math.floor(k / 3)]
    const sIn = sstep(t - K.ctaMinis - k * 0.045, 2.6, 0.56)
    const out = eIn(clamp((t - K.ctaMinisOut - k * 0.03) / 0.22))
    const s = sIn * (1 - out)
    if (s > 0.01) drawMini(m, cx, cy, s, clamp(sIn * 2) * (1 - out))
  })
  if (t >= K.ctaText) {
    const k = sstep(t - K.ctaText, 2.4, 0.55), a = fin(t, K.ctaText, 0.12)
    ctx.save(); ctx.globalAlpha = a; ctx.translate(540, 900); ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k)
    // bookmark (save) glyph
    ctx.strokeStyle = PAPER; ctx.lineWidth = 7; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(-34, -250); ctx.lineTo(34, -250); ctx.lineTo(34, -150); ctx.lineTo(0, -178); ctx.lineTo(-34, -150); ctx.closePath(); ctx.stroke()
    setFont(96, 800, 'condensed'); ctx.textAlign = 'center'; ctx.fillStyle = PAPER
    ctx.fillText('SALVA E TESTA', 0, -10)
    ctx.fillText('NA PRÓXIMA PALETA', 0, 84)
    ctx.restore()
  }
}

// ---------- frame ----------
function seek(t) {
  t = clamp(t, 0, DUR)
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.setLineDash([])
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H)
  const S = wheelS(t)
  const pts = pointState(t, S)
  drawWheel(t, S, pts)
  drawShapes(t, pts, S)
  drawTitles(t)
  drawPanels(t)
  drawCaptions(t)
  drawCTA(t)
  window.__t = t
}

const ready = (async () => {
  await Promise.all([document.fonts.load(`800 96px ${FONT}`), document.fonts.load(`600 58px ${FONT}`), document.fonts.load(`500 40px ${FONT}`)])
  await document.fonts.ready
  await artReady
  seek(0)
})()

window.__reel = { duration: DUR, fps: FPS, ready, seek }
window.__probe = () => { const p = pointState(window.__t || 0, wheelS(window.__t || 0)); return { Pidx: p.P.idx, V1idx: p.V1.idx, V2idx: p.V2.idx, V3idx: p.V3.idx, scale: wheelS(window.__t || 0) } }

// ---------- preview player (never active under capture) ----------
if (!navigator.webdriver) {
  const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px' }
  fit(); addEventListener('resize', fit)
  const audio = new Audio('audio/mix.wav')
  let playing = false, t0 = 0, base = 0
  const tick = now => { if (!playing) return; const t = base + (now - t0) / 1000; seek(t); if (t < DUR) requestAnimationFrame(tick); else playing = false }
  const toggle = () => {
    playing = !playing
    if (playing) { if (base >= DUR) base = 0; t0 = performance.now(); audio.currentTime = base; audio.play().catch(() => {}); requestAnimationFrame(tick) }
    else { base = window.__t || 0; audio.pause() }
  }
  cv.addEventListener('click', toggle)
  addEventListener('keydown', e => { if (e.code === 'Space') toggle(); if (e.code === 'ArrowRight') { base = Math.min(DUR, (window.__t || 0) + 1); seek(base) } if (e.code === 'ArrowLeft') { base = Math.max(0, (window.__t || 0) - 1); seek(base) } })
}
