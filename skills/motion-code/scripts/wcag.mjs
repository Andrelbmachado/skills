#!/usr/bin/env node
// Razão de contraste WCAG 2.x entre cores hex. Uso: node wcag.mjs "#ffffff" "#102030" [mais pares...]
// Importável: import { lum, ratio } from './wcag.mjs'. Use no colorcheck.mjs de reels de cor/contraste.
export const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.replace('#', '').padEnd(6, '0').slice(i - 1, i + 1), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
// Simulação de deuteranopia (Machado 2009, severidade 1) em hex -> hex. Ferramenta de inspeção, não a experiência de todas as pessoas.
// Erro×sucesso só por cor (vermelho×verde) cai para ~1,07:1 de luminância; corrija com luminância + forma (✗/✓).
const D = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]]
const lin = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4, unlin = c => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055)
export const deutan = h => { const l = [1, 3, 5].map(i => lin(parseInt(h.replace('#', '').slice(i - 1, i + 1), 16))); return '#' + D.map(r => Math.round(Math.min(255, Math.max(0, unlin(r[0] * l[0] + r[1] * l[1] + r[2] * l[2])))).toString(16).padStart(2, '0')).join('') }
if (import.meta.url === `file://${process.argv[1]}`) { const a = process.argv.slice(2); for (let i = 0; i + 1 < a.length; i += 2) console.log(a[i], a[i + 1], ratio(a[i], a[i + 1]).toFixed(2).replace('.', ',') + ':1') }
