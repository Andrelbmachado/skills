// Screenshots de página inteira em 320x700, 390x844 (mobile real, por emulação) e 1280x800 + checagem de rolagem horizontal.
// Uso: node capturar.mjs <pastaDoSite|urlBase> <dirSaida> <pagina1.html> [pagina2.html ...]
//   Se o primeiro argumento for uma pasta, ela é servida aqui mesmo. "painel/" captura a entrada do painel (login ou primeiro acesso).
// OLHE as imagens: contraste e rolagem dão números, mas só a imagem mostra login fora do centro, anel de foco cortado e texto sobre padrão.
import fs from 'node:fs';
import { abrirChrome } from './cdp.mjs';
import { servir } from './servidor.mjs';

const [alvo, saida, ...paginas] = process.argv.slice(2);
if (!alvo || !saida || !paginas.length) { console.error('uso: node capturar.mjs <pasta|urlBase> <dirSaida> <paginas...>'); process.exit(2); }
fs.mkdirSync(saida, { recursive: true });
const srv = fs.existsSync(alvo) && fs.statSync(alvo).isDirectory() ? await servir(alvo) : null;
const base = srv ? srv.url : alvo;
const c = await abrirChrome();
let falhou = false;
try {
  for (const [nome, l, a] of [['p', 320, 700], ['m', 390, 844], ['d', 1280, 800]]) {
    await c.emular(l, a);
    for (const p of paginas) {
      await c.navegar(new URL(p, base).href, 900);
      const medidas = await c.avaliar(`({sw: document.documentElement.scrollWidth, iw: ${l}, ov: [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > ${l} + 1 && getComputedStyle(e).position !== "fixed").slice(0,6).map(e => e.tagName + "." + e.className)})`);
      // v1.3: a foto de página inteira não rola, então os cards com `.revela` (revelação ao rolar, v1.0) saíam em branco; marca todos como vistos e espera a transição
      await c.avaliar(`document.querySelectorAll('.revela').forEach((e) => e.classList.add('visto')); document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; })`);
      // as imagens abaixo da dobra (loading=lazy) também não carregavam na foto de página inteira (`complete` é true antes de buscar): `decode()` força a busca e espera a imagem; depois a transição dos cards
      await c.avaliar(`Promise.all([...document.images].map((i) => i.decode().catch(() => null))).then(() => true)`);
      await new Promise((r) => setTimeout(r, 1000));
      const arq = `${saida}/${p.replace(/[\/.]/g, '_')}_${nome}.png`;
      await c.foto(arq);
      const ok = medidas.sw <= medidas.iw;
      if (!ok) falhou = true;
      console.log(`${ok ? 'ok ' : 'ROLAGEM'} ${nome} ${p} scrollWidth=${medidas.sw} viewport=${medidas.iw} ${ok ? '' : JSON.stringify(medidas.ov)} -> ${arq}`);
    }
  }
  if (c.console.length) console.log('console:', c.console.join(' | '));
} finally { await c.fechar(); if (srv) srv.fechar(); }
process.exit(falhou ? 1 : 0);
