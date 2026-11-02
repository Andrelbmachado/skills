// Regressão visual SEM imagem: compara o estilo computado de TODOS os elementos (e dos pseudo-elementos ::before e ::after) das páginas da
// vitrine de duas pastas, em 320, 390 e 1280px. Serve para mexer no CSS base ou no gerador e provar que um site já entregue não mudou.
// Com prefers-reduced-motion emulado, o estado final é o estático (sem animação em andamento), então a comparação não depende de tempo.
// Uso: node regressao_visual.mjs <pastaReferencia> <pastaNova> [--painel] [pagina ...]      (padrão: as 4 páginas da vitrine)
//   --painel: além da vitrine, cria o dono, carrega os dados de exemplo e compara a entrada e cada tela do painel (1280 e 390px).
// Saída: "igual" (código 0) ou as primeiras diferenças (código 1): página, largura, caminho do elemento, propriedade, valor antes e depois.
import fs from 'node:fs';
import path from 'node:path';
import { abrirChrome } from './cdp.mjs';
import { servir } from './servidor.mjs';

const [refDir, novaDir, ...argumentos] = process.argv.slice(2);
const comPainel = argumentos.includes('--painel'), resto = argumentos.filter((a) => a !== '--painel');
if (!refDir || !novaDir) { console.error('uso: node regressao_visual.mjs <pastaReferencia> <pastaNova> [paginas...]'); process.exit(2); }
const paginas = resto.length ? resto : (require_vitrine(refDir) ? ['index.html', 'sobre.html', 'contato.html'] : []);
function require_vitrine(dir) { return fs.existsSync(path.join(dir, 'sobre.html')); }
const PROPS = ['display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'z-index', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'box-sizing', 'overflow-x', 'overflow-y', 'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self', 'justify-items', 'align-content', 'gap',
  'grid-template-columns', 'grid-template-areas', 'grid-area', 'grid-column', 'order', 'color', 'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'border-top-width', 'border-right-width',
  'border-bottom-width', 'border-left-width', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius', 'box-shadow', 'outline-style', 'outline-width', 'outline-color', 'opacity', 'visibility', 'transform', 'clip-path',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-decoration-line', 'text-transform', 'text-wrap', 'white-space', 'overflow-wrap', 'cursor', 'fill', 'content', 'animation-name', 'transition-property'];
const COLETOR = `(() => {
  const props = ${JSON.stringify(PROPS)};
  const caminho = (e) => { const p = []; for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const i = x.parentElement ? [...x.parentElement.children].indexOf(x) : 0; p.unshift(x.tagName.toLowerCase() + (typeof x.className === 'string' && x.className ? '.' + x.className.trim().split(/\\s+/).join('.') : '') + ':' + i); } return p.join('>'); };
  const estilo = (cs) => props.map((k) => k + '=' + cs.getPropertyValue(k)).join(';');
  const out = {};
  for (const e of document.body.querySelectorAll('*')) {
    if (/^(SCRIPT|STYLE|SYMBOL|PATH|USE)$/i.test(e.tagName)) continue;
    if (e.closest('.toasts')) continue; // avisos passageiros: quantos estão na tela depende de quando a captura acontece, não do CSS
    const r = e.getBoundingClientRect();
    const base = caminho(e);
    out[base] = estilo(getComputedStyle(e)) + ';rect=' + [r.x, r.y, r.width, r.height].map(Math.round).join(',');
    if (e.tagName === 'DIALOG' && e.open) out[base + '::backdrop'] = estilo(getComputedStyle(e, '::backdrop'));
    for (const ps of ['::before', '::after']) { const cs = getComputedStyle(e, ps); if (cs.content && cs.content !== 'none' && cs.content !== 'normal') out[base + ps] = estilo(cs); }
  }
  const b = getComputedStyle(document.body); out['body'] = estilo(b); out['scrollWidth'] = String(document.documentElement.scrollWidth);
  return out;
})()`;
const srvA = await servir(refDir), srvB = await servir(novaDir);
const c = await abrirChrome();
await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
let diffs = 0, elementos = 0;
try {
  for (const [l, a] of [[320, 700], [390, 844], [1280, 800]]) {
    await c.emular(l, a);
    for (const p of paginas) {
      const medidas = [];
      for (const s of [srvA, srvB]) { await c.navegar(s.url + p, 700); medidas.push(await c.avaliar(COLETOR)); }
      const [A, B] = medidas; const chaves = new Set([...Object.keys(A), ...Object.keys(B)]); elementos += chaves.size;
      let n = 0;
      for (const k of chaves) {
        if (A[k] === B[k]) continue;
        diffs++; if (n++ >= 6) continue;
        if (A[k] == null || B[k] == null) { console.log(`DIFERE ${p} ${l}px: elemento só em ${A[k] == null ? 'nova' : 'referência'}: ${k.slice(-110)}`); continue; }
        const pa = A[k].split(';'), pb = B[k].split(';');
        const quais = pa.map((x, i) => (x !== pb[i] ? `${x.split('=')[0]}: ${x.split('=').slice(1).join('=').slice(0, 50)} -> ${(pb[i] || '').split('=').slice(1).join('=').slice(0, 50)}` : null)).filter(Boolean).slice(0, 4);
        console.log(`DIFERE ${p} ${l}px ${k.slice(-90)}\n        ${quais.join(' | ')}`);
      }
      if (!n) console.log(`igual  ${p} ${l}px (${chaves.size} nós)`); else console.log(`       ${p} ${l}px: ${n} nós diferentes`);
    }
  }
  if (comPainel) {
    const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
    async function varrerPainel(srv, larguras) { // devolve { "<largura> <tela>": fingerprint }
      const out = {};
      await c.emular(1280, 800);
      await c.navegar(srv.url + 'painel/', 600); out['1280 entrada'] = await c.avaliar(COLETOR);
      await c.emular(320, 700); await c.navegar(srv.url + 'painel/', 600); out['320 entrada'] = await c.avaliar(COLETOR);
      await c.emular(1280, 800); await c.navegar(srv.url + 'painel/', 600);
      await c.digitar('[name="nome"]', 'Dono Teste'); await c.digitar('[name="usuario"]', 'dono'); await c.digitar('[name="senha"]', 'senha-segura-1'); await c.digitar('[name="conf"]', 'senha-segura-1');
      await c.avaliar(`document.querySelector('.login-form').requestSubmit()`); await c.esperar('document.getElementById("titulo-tela")');
      await c.clicarTexto('.painel-vazio button', 'Carregar dados de exemplo'); await c.esperar('document.querySelector(".resumo-grade") && !document.querySelector(".painel-vazio")'); await dormir(500);
      const rotas = await c.avaliar(`Regras.modulosDoPerfil('dono')`);
      for (const [l, a] of larguras) {
        await c.emular(l, a);
        for (const rota of rotas) { await c.avaliar(`location.hash = '#/${rota}'`); await dormir(600); out[`${l} ${rota}`] = await c.avaliar(COLETOR); }
        // um diálogo (ficha de tutor) e um aviso: cobrem modal, fundo e toast
        await c.avaliar(`location.hash = '#/tutores'`); await dormir(500);
        await c.clicarTexto('.tabela tbody tr', 'Exemplo'); await c.esperar('document.querySelector("dialog.modal[open]")'); await dormir(300);
        await c.avaliar(`UI.toast('Aviso de teste', 'ok'); UI.toast('Erro de teste', 'erro')`); await dormir(200);
        out[`${l} dialogo`] = await c.avaliar(COLETOR); await c.avaliar('document.querySelectorAll("dialog.modal[open]").forEach(d => d.close())'); await dormir(100);
      }
      await c.avaliar(`document.querySelector('.btn-sair') && document.querySelector('.btn-sair').click()`); await dormir(500);
      return out;
    }
    const larguras = [[1280, 800], [390, 844]];
    const [PA, PB] = [await varrerPainel(srvA, larguras), await varrerPainel(srvB, larguras)];
    for (const tela of Object.keys(PA)) {
      const A = PA[tela], B = PB[tela] || {}; const chaves = new Set([...Object.keys(A), ...Object.keys(B)]); elementos += chaves.size; let n = 0;
      for (const k of chaves) {
        if (A[k] === B[k]) continue;
        diffs++; if (n++ >= 6) continue;
        if (A[k] == null || B[k] == null) { console.log(`DIFERE painel ${tela}: nó só em ${A[k] == null ? 'nova' : 'referência'}: ${k.slice(-100)}`); continue; }
        const pa = A[k].split(';'), pb = B[k].split(';');
        const quais = pa.map((x, i) => (x !== pb[i] ? `${x.split('=')[0]}: ${x.split('=').slice(1).join('=').slice(0, 50)} -> ${(pb[i] || '').split('=').slice(1).join('=').slice(0, 50)}` : null)).filter(Boolean).slice(0, 4);
        console.log(`DIFERE painel ${tela} ${k.slice(-80)}\n        ${quais.join(' | ')}`);
      }
      if (!n) console.log(`igual  painel ${tela} (${chaves.size} nós)`); else console.log(`       painel ${tela}: ${n} nós diferentes`);
    }
  }
  console.log(diffs ? `\n${diffs} diferenças em ${elementos} nós comparados.` : `\nIgual: ${elementos} nós comparados (estilo computado, pseudo-elementos e posição).`);
} finally { await c.fechar(); srvA.fechar(); srvB.fechar(); }
process.exit(diffs ? 1 : 0);
