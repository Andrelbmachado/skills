// Sincronia: whisper no áudio FINAL (MP4) vs. tempos de palavra usados pela cena (legenda/eventos).
//   node tools/syncverify.mjs /tmp/sv/final.json
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, norm } from './lib.mjs'
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'timing.json'), 'utf8'))
const asr = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).segments.flatMap(s => s.words || []).map(w => ({ n: norm(w.word), t: w.start }))
const want = T.lines.flatMap(l => l.words.map(w => ({ n: norm(w.w), t: w.t0, id: l.id })))
// casamento sequencial guloso numa janela de ±1,5 s
let j = 0; const d = []
for (const w of want) {
  for (let k = j; k < Math.min(asr.length, j + 6); k++) if (asr[k].n === w.n && Math.abs(asr[k].t - w.t) < 1.5) { d.push(asr[k].t - w.t); j = k + 1; break }
}
const abs = d.map(Math.abs).sort((a, b) => a - b), q = p => abs[Math.floor(p * (abs.length - 1))]
console.log(`palavras casadas ${d.length}/${want.length}  mediana |Δ| ${q(0.5).toFixed(3)} s  p90 ${q(0.9).toFixed(3)} s  max ${abs.at(-1).toFixed(3)} s`)
