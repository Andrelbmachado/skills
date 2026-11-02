// Contraste REAL no navegador (não só dos tokens): para cada texto visível, compara a cor computada com o fundo opaco mais próximo
// na árvore. Limite WCAG AA: 4,5 (3,0 para texto grande: >= 24px, ou >= 18,66px em negrito). Gradientes e padrões decorativos são ignorados
// (o texto nunca fica direto sobre eles: o fundo opaco de baixo é o que conta, e o tema deve garantir isso).
// Também confere o anel de foco de CADA elemento focável (sólido, >= 2px, contraste >= 3:1 com o fundo que o cerca).
// Cobre as páginas da vitrine (se existirem) em 390 e 1280 e as telas principais do painel (cria o dono e carrega os dados de exemplo).
// Uso: node contraste.mjs <pastaDoSite>
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { abrirChrome } from './cdp.mjs';
import { servir } from './servidor.mjs';

const [pasta] = process.argv.slice(2);
if (!pasta) { console.error('uso: node contraste.mjs <pastaDoSite>'); process.exit(2); }
const srv = await servir(pasta);
const c = await abrirChrome();
await c.send('Emulation.setFocusEmulationEnabled', { enabled: true }); // sem isto o headless não tem foco de janela e :focus-visible nunca casa
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const MEDIDOR = `(() => {
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (k) => 0.2126 * lin(k.r) + 0.7152 * lin(k.g) + 0.0722 * lin(k.b);
  const mistura = (topo, base) => ({ r: topo.r * topo.a + base.r * (1 - topo.a), g: topo.g * topo.a + base.g * (1 - topo.a), b: topo.b * topo.a + base.b * (1 - topo.a), a: 1 });
  const fundo = (el) => { const camadas = []; for (let e = el; e; e = e.parentElement) { const k = parse(getComputedStyle(e).backgroundColor); if (k && k.a > 0) { camadas.push(k); if (k.a === 1) break; } }
    let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = camadas.length - 1; i >= 0; i--) base = mistura(camadas[i], base); return base; };
  const falhas = []; let n = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode, el = t.parentElement;
    if (!t.textContent.trim() || vistos.has(el) || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName)) continue;
    vistos.add(el);
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width < 2 || r.height < 2 || el.closest('.sr-only, [hidden], dialog:not([open])')) continue;
    let k = parse(cs.color); if (!k) continue;
    const f = fundo(el); if (k.a < 1) k = mistura(k, f);
    const a = lum(k), b = lum(f), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const px = parseFloat(cs.fontSize), grande = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
    n++;
    if (ratio < (grande ? 3 : 4.5)) falhas.push({ no: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : ''), texto: t.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, cor: cs.color, fundo: 'rgb(' + [f.r, f.g, f.b].map(Math.round).join(',') + ')' });
  }
  return { n, falhas };
})()`;
const FOCO = `(() => {
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (k) => 0.2126 * lin(k.r) + 0.7152 * lin(k.g) + 0.0722 * lin(k.b);
  const mistura = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const fundo = (el) => { const cam = []; for (let e = el; e; e = e.parentElement) { const k = parse(getComputedStyle(e).backgroundColor); if (k && k.a > 0) { cam.push(k); if (k.a === 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = cam.length - 1; i >= 0; i--) base = mistura(cam[i], base); return base; };
  const falhas = []; let n = 0;
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary')) {
    const r = el.getBoundingClientRect(), cs0 = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || cs0.visibility === 'hidden' || el.closest('[hidden], dialog:not([open])') || el.disabled || el.hidden) continue;
    if (el.classList.contains('pular') || el.closest('.sr-only')) continue; // o link de pular só aparece ao focar; já é conferido no e2e
    el.focus({ focusVisible: true }); if (document.activeElement !== el) continue;
    const cs = getComputedStyle(el), k = parse(cs.outlineColor), f = fundo(el.parentElement || el); n++;
    const ratio = k ? (Math.max(lum(k), lum(f)) + 0.05) / (Math.min(lum(k), lum(f)) + 0.05) : 0;
    if (cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) < 2 || ratio < 3) falhas.push({ no: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).join('.') : ''), estilo: cs.outlineStyle, largura: cs.outlineWidth, ratio: Math.round(ratio * 100) / 100, fundo: 'rgb(' + [f.r, f.g, f.b].map(Math.round).join(',') + ')' });
  }
  return { n, falhas };
})()`;
let total = 0; const todas = [];
async function medir(rotulo) {
  const r = await c.avaliar(MEDIDOR); total += r.n;
  r.falhas.forEach((f) => todas.push({ rotulo, ...f }));
  const f = await c.avaliar(FOCO); total += f.n;
  f.falhas.forEach((x) => todas.push({ rotulo: rotulo + ' (foco)', ...x }));
  console.log(`${r.falhas.length + f.falhas.length ? 'FALHA' : 'ok   '} ${rotulo}: ${r.n} textos e ${f.n} anéis de foco, ${r.falhas.length + f.falhas.length} abaixo do mínimo`);
}
try {
  if (fs.existsSync(path.join(pasta, 'sobre.html'))) {  // v1.1: tem vitrine (a servicos.html deixou de existir na v1.0 e o contraste da vitrine era pulado sem aviso)
    for (const [l, a] of [[390, 844], [1280, 800]]) {
      await c.emular(l, a);
      for (const p of ['index.html', 'sobre.html', 'contato.html']) { await c.navegar(srv.url + p, 2200); await medir(`${p} ${l}px`); }
    }
  }
  if (fs.existsSync(path.join(pasta, 'painel'))) {
    await c.emular(1280, 800);
    await c.navegar(srv.url + 'painel/', 500); await medir('painel: primeiro acesso');
    await c.digitar('[name="nome"]', 'Dono Teste'); await c.digitar('[name="usuario"]', 'dono'); await c.digitar('[name="senha"]', 'senha-segura-1'); await c.digitar('[name="conf"]', 'senha-segura-1');
    await c.avaliar(`document.querySelector('.login-form').requestSubmit()`);
    await c.esperar('document.getElementById("titulo-tela")');
    await c.clicarTexto('.painel-vazio button', 'Carregar dados de exemplo'); await c.esperar('document.querySelector(".resumo-grade") && !document.querySelector(".painel-vazio")'); await dormir(400);
    const rotas = await c.avaliar(`Regras.modulosDoPerfil('dono')`); // as telas do subtipo (hospital: inclui internacao)
    for (const [l, a] of [[1280, 800], [390, 844]]) {
      await c.emular(l, a);
      for (const rota of rotas) {
        await c.avaliar(`location.hash = '#/${rota}'`); await dormir(500); await medir(`painel ${rota} ${l}px`);
        if (rota === 'internacao') { // as três abas e o diálogo de uma internação
          for (const aba of ['Internações', 'Plantão', 'Leitos']) { await c.clicarTexto('.aba', aba); await dormir(350); await medir(`painel internacao (${aba}) ${l}px`); }
          await c.clicarTexto('.leito--ocupado .leito-corpo', 'Exemplo'); await c.esperar('document.querySelector("dialog.modal[open]")'); await dormir(250); await medir(`painel internacao (detalhe) ${l}px`);
          await c.avaliar('document.querySelectorAll("dialog.modal[open]").forEach(d => d.close())'); await dormir(100);
        }
        if (rota === 'estoque' && await c.avaliar('(window.SITE_CONFIG.painel || {}).venda === true')) { // clínica com loja: detalhe do item à venda e formulário de venda
          await c.clicarTexto('.tabela tbody tr', 'Ração'); await c.esperar('document.querySelector("dialog.modal[open]")'); await dormir(250); await medir(`painel estoque (detalhe do item à venda) ${l}px`);
          await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar venda'); await c.esperar('document.querySelector("dialog.modal[open] [name=\\"qtd\\"]")'); await dormir(250); await medir(`painel estoque (formulário de venda) ${l}px`);
          await c.avaliar('document.querySelectorAll("dialog.modal[open]").forEach(d => d.close())'); await dormir(100);
        }
        if (rota === 'config') { // diálogo de importação com os dois avisos (o que ficará vazio e as referências quebradas)
          await c.avaliar(`(() => { const dt = new DataTransfer(); dt.items.add(new File([JSON.stringify({ versao: 1, colecoes: { tutores: [{ id: 'old-t', nome: 'Tutor antigo' }], consultas: [{ id: 'old-c', petId: 'sumiu', inicio: '2026-01-10T09:00' }] } })], 'antigo.json', { type: 'application/json' }));
            const i = document.getElementById('arquivo-import'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
          await c.esperar('document.querySelector("dialog.modal[open] [data-aviso=\\"esvazia\\"]")'); await dormir(250); await medir(`painel config (importar backup antigo) ${l}px`);
          await c.avaliar('document.querySelectorAll("dialog.modal[open]").forEach(d => d.close())'); await dormir(100);
        }
        if (rota === 'exames') { // centro de diagnóstico: filtros, detalhe de um exame laudado (situação, laudo e botões) e o formulário de laudo
          await c.clicarTexto('.chip-botao', 'Para entregar'); await dormir(300); await medir(`painel exames (para entregar) ${l}px`);
          await c.clicarTexto('.tabela tbody tr', 'Exemplo'); await c.esperar('document.querySelector("dialog.modal[open]")'); await dormir(250); await medir(`painel exames (detalhe) ${l}px`);
          await c.avaliar('document.querySelectorAll("dialog.modal[open]").forEach(d => d.close())'); await dormir(100);
          await c.clicarTexto('.chip-botao', 'Aguardando laudo'); await dormir(300); await c.clicarTexto('.tabela tbody tr', 'Exemplo'); await c.esperar('document.querySelector("dialog.modal[open]")'); await dormir(250);
          await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar laudo'); await c.esperar('document.querySelector("dialog.modal[open] [name=\\"laudo\\"]")'); await dormir(250); await medir(`painel exames (formulário de laudo) ${l}px`);
          await c.avaliar('document.querySelectorAll("dialog.modal[open]").forEach(d => d.close())'); await dormir(100);
          await c.clicarTexto('.chip-botao', 'Em andamento'); await dormir(200);
        }
      }
    }
  }
  if (fs.existsSync(path.join(pasta, 'painel')) && await c.avaliar(`((window.SITE_CONFIG.painel || {}).matriz || {}).recepcao && window.SITE_CONFIG.painel.matriz.recepcao.internacao === 'r'`)) {
    // v0.7: a visão restrita da internação é outra tela (a da recepção); o dono não a vê, então ela é medida logada como recepção
    await c.avaliar(`Auth.criarUsuario(Painel.ctx.store, { nome: 'Recep Teste', usuario: 'recep', senha: 'senha-rec-123', perfil: 'recepcao' })`); await dormir(300);
    await c.clicarTexto('button', 'Sair'); await c.esperar('document.querySelector("#login-raiz h1")');
    await c.digitar('[name="usuario"]', 'recep'); await c.digitar('[name="senha"]', 'senha-rec-123'); await c.clicarTexto('button[type="submit"]', 'Entrar'); await c.esperar('document.getElementById("titulo-tela")', 8000);
    for (const [l, a] of [[1280, 800], [390, 844]]) {
      await c.emular(l, a);
      for (const rota of ['inicio', 'internacao']) { await c.avaliar(`location.hash = '#/${rota}'`); await dormir(500); await medir(`painel ${rota} (recepção, visão restrita) ${l}px`); }
      await c.avaliar(`(() => { const i = document.querySelector('.tela input'); i.value = 'zzzz'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await dormir(300); await medir(`painel internacao (recepção, busca sem resultado) ${l}px`);
    }
  }
  if (todas.length) { console.log('\nAbaixo do mínimo:'); todas.slice(0, 25).forEach((f) => console.log(' ', JSON.stringify(f))); }
  assert.equal(todas.length, 0, `${todas.length} textos abaixo do contraste mínimo`);
  console.log(`\nContraste real: ${total} textos conferidos, todos >= mínimo AA.`);
} catch (e) { console.error('FALHOU:', e.message); process.exitCode = 1; } finally { await c.fechar(); srv.fechar(); }
