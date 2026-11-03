// Shared plan: every visual beat and SFX cue is derived from the narration word times.
// Imported by the scene (browser) and by tools/mix.mjs (node), so picture and sound never drift.

export const HUES = [
  ['Amarelo', '#FFD60A'],
  ['Amarelo-laranja', '#FFAA1C'],
  ['Laranja', '#FF7B1A'],
  ['Vermelho-laranja', '#FF4D2E'],
  ['Vermelho', '#EE2B47'],
  ['Vermelho-violeta', '#D0307E'],
  ['Violeta', '#9346C6'],
  ['Azul-violeta', '#5E4FD9'],
  ['Azul', '#2F72F0'],
  ['Azul-verde', '#18AFC2'],
  ['Verde', '#2DBE5C'],
  ['Amarelo-verde', '#A6D52A'],
]

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

export function buildPlan(T) {
  const line = id => T.lines.find(l => l.id === id)
  const w = (id, word, n = 0) => {
    const hits = line(id).words.filter(x => norm(x.w) === norm(word))
    if (!hits[n]) throw new Error(`word "${word}" #${n} not in line ${id}`)
    return hits[n].t0
  }
  // like w(), but falls back to a fraction of the line when the word is missing (stale sample timing)
  const wOr = (id, word, frac) => { try { return w(id, word) } catch { return line(id).start + frac * line(id).dur } }
  const L = id => line(id).start
  const End = id => line(id).start + line(id).dur

  // ---- key times (seconds) ----
  const K = {
    wheelIn: 0.18,
    hookTitle: 0.42,
    hookLit: Math.max(0.95, w('hook', 'cores') - 0.05),

    camPush: L('analog') - 0.1,
    labelsAll: w('analog', 'cada'),
    labelsOff: w('analog', 'nas') - 0.05,
    anTitle: w('analog', 'analogas'),
    anMain: w('analog', 'analogas') + 0.05,
    anN1: w('analog', 'vizinhas'),
    anN2: w('analog', 'vizinhas') + 0.16,
    anBand: w('analog', 'vizinhas') + 0.06,
    anArt: w('analog', 'vizinhas') + 0.45,
    anShadow: w('analog', 'sombra'),
    anCredit: w('analog', 'como'),

    cpOut: L('comp') - 0.05,
    cpTitle: w('comp', 'complementares'),
    cpRetract: w('comp', 'complementares') + 0.05,
    cpOpp: w('comp', 'opostos'),
    cpLine: w('comp', 'opostos') + 0.06,
    cpContrast: w('comp', 'contraste'),
    cpShadow: w('comp', 'pouco'),
    cpDab: w('comp', 'verde'),
    cpMix: w('comp', 'sombreia'),
    cpRotate: w('comp', 'contraste'),
    cpArt: w('comp', 'contraste'),
    cpPop: w('comp', 'salta'),
    cpB1: w('comp', 'laranja'),
    cpB2: w('comp', 'azul'),

    trTitle: w('triad', 'triade'),
    trSplit: w('triad', 'triade') + 0.08,
    trBase: w('triad', 'triade') + 0.62,
    trArcs: w('triad', 'igualmente'),
    trArcsOff: w('triad', 'use'),
    trPanelOut: w('triad', 'triade') - 0.1,
    trArt: w('triad', 'regra'),
    trB1: w('triad', 'sessenta'),
    trB2: w('triad', 'trinta'),
    trB3: w('triad', 'dez'),

    spOut: L('split') - 0.05,
    spTitle: w('split', 'complementares'),
    spMain: w('split', 'principal'),
    spGhost: w('split', 'use'),
    spNarrow: w('split', 'vizinhas'),
    spArt: w('split', 'oposta'),
    spB1: w('split', 'ceu'),
    spB2: w('split', 'trigo'),
    spB3: w('split', 'terra'),

    rcOut: L('rect') - 0.05,
    rcTitle: w('rect', 'tetradica'),
    rcMove: w('rect', 'retangular'),
    rcFourth: w('rect', 'quatro'),
    rcArcs: w('rect', 'formam'),
    rcArcsOff: w('rect', 'pares'),
    rcDiag: w('rect', 'pares'),
    rcDiagOff: w('rect', 'escolha'),
    rcArt: w('rect', 'cafe'),
    rcB1: w('rect', 'vermelho'),
    rcB2: w('rect', 'verde'),
    rcB3: w('rect', 'laranja'),
    rcB4: w('rect', 'azul'),
    rcDom: w('rect', 'dominante'),

    sqOut: L('square') - 0.05,
    sqTitle: w('square', 'tetradica'),
    sqMove: w('square', 'quadrada'),
    sqLight: w('square', 'quatro'),
    sqArcs: w('square', 'igualmente'),
    sqArcsOff: w('square', 'cuidado'),
    sqArt: w('square', 'cuidado'),
    sqDom: w('square', 'dominante'),

    // CTA: recap of the six schemes first; the spoken line starts together with the on-screen text
    ctaStart: End('square') + 0.1,
    ctaText: L('cta') - 0.04,
    // FIXED ENDING (André, all videos): ONLY "Curta, comenta e compartilha." + the 3 Instagram icons, each on its word
    ctaLike: wOr('cta', 'curta', 0),
    ctaComment: wOr('cta', 'comenta', 0.36),
    ctaShare: wOr('cta', 'compartilha', 0.62),
    end: T.duration,
  }
  K.ctaMinis = K.ctaStart + 0.12
  K.ctaMinisOut = K.ctaText - 0.26
  K.trBaseLight = K.trBase + 0.25
  K.sqEnd = K.ctaStart

  // ---- SFX cues: {t, type, hue?, gain?} ----
  const art = (t0, hues, step = 0.16) => [{ t: t0, type: 'soft' }, ...hues.map((h, i) => ({ t: t0 + 0.35 + i * step, type: 'pop', hue: h, gain: 0.7 }))]
  const cues = [
    { t: K.wheelIn, type: 'whoosh', gain: 0.9 },
    { t: K.hookLit, type: 'pop', hue: 8 },
    { t: K.camPush, type: 'swell' },
    { t: K.anMain, type: 'pop', hue: 8 },
    { t: K.anN1, type: 'pop', hue: 7 }, { t: K.anN2, type: 'pop', hue: 9 },
    { t: K.anBand, type: 'draw' },
    ...art(K.anArt, [9, 8, 7]),
    { t: K.cpTitle - 0.08, type: 'whoosh' },
    { t: K.cpOpp, type: 'pop', hue: 4 }, { t: K.cpLine, type: 'draw' },
    { t: K.cpShadow, type: 'soft' }, { t: K.cpMix, type: 'blend' },
    { t: K.cpRotate, type: 'slide' },
    { t: K.cpB1, type: 'pop', hue: 2, gain: 0.7 }, { t: K.cpB2, type: 'pop', hue: 8, gain: 0.7 },
    { t: K.trTitle - 0.08, type: 'whoosh' },
    { t: K.trSplit, type: 'slide' }, { t: K.trBase, type: 'draw' },
    { t: K.trBaseLight, type: 'pop', hue: 8 }, { t: K.trBaseLight + 0.12, type: 'pop', hue: 0 }, { t: K.trBaseLight + 0.24, type: 'pop', hue: 4 },
    { t: K.trArt, type: 'soft' },
    { t: K.trB1, type: 'pop', hue: 4, gain: 0.7 }, { t: K.trB2, type: 'pop', hue: 8, gain: 0.7 }, { t: K.trB3, type: 'pop', hue: 0, gain: 0.7 },
    { t: K.spTitle - 0.08, type: 'whoosh' },
    { t: K.spMain, type: 'pop', hue: 8 }, { t: K.spGhost, type: 'tick' }, { t: K.spNarrow, type: 'slide' },
    { t: K.spArt, type: 'soft' },
    { t: K.spB1, type: 'pop', hue: 8, gain: 0.7 }, { t: K.spB2, type: 'pop', hue: 1, gain: 0.7 }, { t: K.spB3, type: 'pop', hue: 3, gain: 0.7 },
    { t: K.rcTitle - 0.08, type: 'whoosh' },
    { t: K.rcMove, type: 'slide' }, { t: K.rcFourth, type: 'pop', hue: 4 }, { t: K.rcFourth + 0.1, type: 'draw' },
    { t: K.rcDiag, type: 'tick' }, { t: K.rcArt, type: 'soft' },
    { t: K.rcB1, type: 'pop', hue: 4, gain: 0.7 }, { t: K.rcB2, type: 'pop', hue: 10, gain: 0.7 }, { t: K.rcB3, type: 'pop', hue: 2, gain: 0.7 }, { t: K.rcB4, type: 'pop', hue: 8, gain: 0.7 },
    { t: K.sqTitle - 0.08, type: 'whoosh' },
    { t: K.sqMove, type: 'slide' },
    { t: K.sqLight, type: 'pop', hue: 1 }, { t: K.sqLight + 0.14, type: 'pop', hue: 4 }, { t: K.sqLight + 0.28, type: 'pop', hue: 7 }, { t: K.sqLight + 0.42, type: 'pop', hue: 10 },
    ...art(K.sqArt, [1, 4, 7, 10], 0.14),
    { t: K.ctaStart, type: 'whoosh' },
    { t: K.ctaMinis, type: 'pop', hue: 0, gain: 0.6 }, { t: K.ctaMinis + 0.25, type: 'pop', hue: 4, gain: 0.6 },
    { t: K.ctaLike, type: 'pop', hue: 4, gain: 0.8 }, { t: K.ctaComment, type: 'pop', hue: 8, gain: 0.7 }, { t: K.ctaShare, type: 'pop', hue: 2, gain: 0.7 },
  ]
  return { K, cues: cues.sort((a, b) => a.t - b.t), line, End }
}
