// Teste da vitrine no Chrome (v1.1): UM botão de WhatsApp (o flutuante, redondo, só o ícone; nada no topo) quando há número de conversa e nenhum quando não há, sem ligar nem formulário,
// imagens só ilustrativas e legendadas, crédito no rodapé, "Serviços" rolando até #servicos, 320 e 390px sem rolagem horizontal, foco visível, revelação ao rolar,
// toggle (link do painel presente/ausente conforme o build).
// Uso: node e2e_vitrine.mjs <pastaDoSite> [esperaPainel=sim|nao]
import assert from 'node:assert/strict';
import { abrirChrome } from './cdp.mjs';
import { servir } from './servidor.mjs';

const [pasta, painel = 'sim'] = process.argv.slice(2);
if (!pasta) { console.error('uso: node e2e_vitrine.mjs <pastaDoSite> [sim|nao]'); process.exit(2); }
const srv = await servir(pasta);
const c = await abrirChrome();
const ok = (m) => console.log('ok  ' + m);
try {
  const paginas = ['index.html', 'sobre.html', 'contato.html'];
  const cfg = await (async () => { await c.navegar(srv.url + 'index.html', 300); return c.avaliar('JSON.parse(JSON.stringify(window.SITE_CONFIG))'); })();
  const temWa = !!cfg.negocio.whatsapp; // o WhatsApp das Configurações é o número de conversa da vitrine (vazio = só telefone fixo ou nenhum)

  for (const [larg, alt] of [[320, 700], [390, 844], [1280, 800]]) { // 320px é o menor celular comum: a rolagem horizontal aparece primeiro aqui
    await c.emular(larg, alt);
    for (const p of paginas) {
      await c.navegar(srv.url + p, 500);
      const m = await c.avaliar(`({sw: document.documentElement.scrollWidth, h1: document.querySelectorAll('h1').length,
        flutuantes: [...document.querySelectorAll('.wa-flutuante, .ligar-flutuante')].map(e => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
          return [e.className, e.getAttribute('aria-label'), e.textContent.trim() === '' ? 'so-icone' : 'com-texto', Math.abs(b.width - b.height) <= 1 && parseFloat(cs.borderTopLeftRadius) >= b.width / 2 - 1 ? 'redondo' : 'nao-redondo',
            b.right <= innerWidth && b.bottom <= innerHeight && b.left > innerWidth / 2 && b.top > innerHeight / 2 ? 'canto' : 'fora-do-canto'].join('|'); }),
        waLinks: [...document.querySelectorAll('a[href^="https://wa.me/"]')].map(a => a.className),
        tel: document.querySelectorAll('a[href^="tel:"]').length, forms: document.forms.length,
        painelLink: document.querySelectorAll('a[href*="painel"]').length,
        imgsSoltas: [...document.images].filter(i => !(i.closest('figure[data-ilustrativa]') && i.closest('figure').querySelector('figcaption') && i.closest('figure').querySelector('figcaption').textContent === 'Imagem ilustrativa')).length,
        legendaVisivel: [...document.querySelectorAll('figure[data-ilustrativa] figcaption')].every(f => { const r = f.getBoundingClientRect(), cs = getComputedStyle(f); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; }),
        credito: (() => { const a = document.querySelector('footer a[href="https://andremachado.design"]'); return a ? [a.textContent.trim(), a.target, a.rel].join('|') : ''; })(),
        secoesVazias: [...document.querySelectorAll('section')].filter(s => !s.textContent.trim()).length})`);
      assert.ok(m.sw <= larg, `${p} em ${larg}px: rolagem horizontal (${m.sw})`);
      assert.equal(m.h1, 1, `${p}: um único h1`);
      if (temWa) {
        assert.deepEqual(m.flutuantes, ['wa-flutuante|Conversar no WhatsApp|so-icone|redondo|canto'], `${p}: um único flutuante, o de WhatsApp, redondo, só o ícone, no canto inferior direito (${m.flutuantes.join(',')})`);
        assert.deepEqual(m.waLinks, ['wa-flutuante'], `${p}: um único botão de WhatsApp, o flutuante (${m.waLinks.join(',')})`);
      } else {
        assert.deepEqual(m.flutuantes, [], `${p}: sem número de conversa, nenhum flutuante`); assert.deepEqual(m.waLinks, [], `${p}: sem número de conversa, nenhum wa.me`);
      }
      assert.equal(m.tel, 0, `${p}: nenhum botão de ligar (tel:)`); assert.equal(m.forms, 0, `${p}: sem formulário`);
      assert.equal(m.imgsSoltas, 0, `${p}: só imagens ilustrativas legendadas (foto real só com material do cliente)`); assert.ok(m.legendaVisivel, `${p}: legenda "Imagem ilustrativa" visível`);
      assert.equal(m.credito, 'criado por andremachado.design|_blank|noopener', `${p}: crédito no rodapé`);
      assert.equal(m.secoesVazias, 0);
      assert.equal(m.painelLink > 0, painel === 'sim', `${p}: link do painel ${painel === 'sim' ? 'deveria existir' : 'não deveria existir'}`);
    }
    ok(`${larg}px: 3 páginas sem rolagem horizontal, 1 h1, ${temWa ? 'um botão de WhatsApp (flutuante, redondo, só o ícone)' : 'nenhum botão de WhatsApp (sem número de conversa)'}, sem tel: nem formulário, imagens só ilustrativas, crédito, link do painel ${painel === 'sim' ? 'presente' : 'ausente'}`);
  }

  // v1.1: primeiro toque no celular. O WhatsApp flutuante (quando há número) aparece inteiro sem rolar e o topo não tem botão; o hero começa na primeira tela com o atalho de Serviços
  for (const [l, a] of [[390, 844], [360, 740]]) {
    await c.emular(l, a); await c.navegar(srv.url + 'index.html', 1200);
    const v = await c.avaliar(`(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
      return { topo: r('.wa-flutuante'), botaoNoTopo: document.querySelectorAll('.topo a.btn, .topo a[href^="https://wa.me/"]').length, servicos: r('.hero [data-toque="servicos"], .hero .placa--servicos'), tentar: [...document.querySelectorAll('a')].some(x => /Tentar pelo WhatsApp|^\\s*Ligar/.test(x.textContent)) }; })()`);
    if (temWa) assert.ok(v.topo && v.topo[1] <= a, `${l}x${a}: o WhatsApp flutuante precisa aparecer sem rolar (${JSON.stringify(v)})`);
    assert.equal(v.botaoNoTopo, 0, 'o topo não tem botão (v1.1)');
    if (v.servicos) assert.ok(v.servicos[0] < a, `${l}x${a}: o atalho de Serviços do hero precisa começar na primeira tela (${JSON.stringify(v)})`);
    assert.equal(v.tentar, false, 'nada de "Tentar pelo WhatsApp" nem "Ligar"');
    ok(`${l}x${a}: ${temWa ? 'WhatsApp flutuante inteiro sem rolar, topo sem botão; ' : ''}atalho de Serviços na primeira tela (${JSON.stringify(v)})`);
  }
  // "Serviços" no menu de outra página leva à seção da inicial e rola até ela; o fim da inicial é "Onde estamos" com o Como chegar
  await c.emular(390, 844); await c.navegar(srv.url + 'sobre.html', 400);
  await c.avaliar(`document.querySelector('.menu a[href="index.html#servicos"]').click()`);
  await new Promise((r) => setTimeout(r, 1500));
  const ancora = await c.avaliar(`({ hash: location.hash, pag: location.pathname.split('/').pop(), topo: Math.round(document.getElementById('servicos').getBoundingClientRect().top), y: Math.round(scrollY),
    fim: (() => { const s = [...document.querySelectorAll('main > section')].pop(); return s.id + '|' + /Como chegar/.test(s.textContent) + '|' + !!s.querySelector('iframe'); })() })`);
  assert.equal(ancora.pag, 'index.html'); assert.equal(ancora.hash, '#servicos'); assert.ok(ancora.y > 0 && Math.abs(ancora.topo) < 120, 'a inicial não rolou até #servicos: ' + JSON.stringify(ancora));
  assert.equal(ancora.fim, 'localizacao|true|true', 'a última seção da inicial é "Onde estamos" com o Como chegar e o mapa');
  ok('menu "Serviços" abre a inicial em #servicos (rolou ' + ancora.y + 'px); a inicial termina em "Onde estamos" com Como chegar e mapa');
  // revelação ao rolar: com movimento liberado, todo card .revela fica visível depois que a página passa por ele
  await c.navegar(srv.url + 'index.html', 600);
  const rev = await c.avaliar(`(async () => { for (let y = 0; y <= document.documentElement.scrollHeight; y += 300) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    await new Promise(r => setTimeout(r, 900)); const els = [...document.querySelectorAll('.revela')];
    return { js: document.documentElement.classList.contains('js-revela'), total: els.length, vistos: els.filter(e => e.classList.contains('visto') && getComputedStyle(e).opacity === '1').length }; })()`);
  assert.ok(rev.total > 0 && rev.vistos === rev.total, 'cards que não apareceram ao rolar: ' + JSON.stringify(rev)); ok(`revelação ao rolar: ${rev.vistos}/${rev.total} cards visíveis depois de rolar`);
  // ordem de leitura do hero: o hero `letreiro` é uma coluna só, então a ordem do DOM (título, telefone, como chegar, horário, apresentação) TEM de ser a ordem visual de cima para baixo
  // no celular e no desktop. (A `dupla` sobe o texto de apresentação acima da faixa no desktop: limite documentado na skill, não é medido aqui.)
  if (await c.avaliar(`!!document.querySelector('.hero--letreiro')`)) {
    for (const [l, a] of [[390, 844], [1280, 800]]) {
      await c.emular(l, a); await c.navegar(srv.url + 'index.html', 900);
      const m = await c.avaliar(`(() => { const r = (s) => { const e = document.querySelector('.hero--letreiro ' + s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; };
        return { h1: r('h1'), fone: r('.lt-fone'), servicos: r('.lt-linha--servicos'), rota: r('.lt-linha--onde'), horario: r('.lt-linha--horario'), linhas: r('.lt-linhas'), lead: r('.lt-lead') }; })()`);
      const v = ['h1', 'fone', 'servicos', 'rota', 'horario'].filter((k) => m[k]).map((k) => m[k].top);
      assert.ok(v.every((x, i) => i === 0 || x >= v[i - 1] - 1), `${l}px: título, número, serviços, onde fica e horário fora da ordem do DOM: ${JSON.stringify(m)}`);
      if (m.fone) assert.ok(m.fone.top >= m.h1.bottom - 1, `${l}px: o número vem depois do título`);
      // a apresentação vem DEPOIS das linhas: abaixo delas (celular) ou na coluna ao lado (desktop; o DOM é esquerda e depois direita)
      assert.ok(m.lead.top >= m.linhas.bottom - 1 || m.lead.left >= m.linhas.right - 1, `${l}px: a apresentação aparece antes das linhas: ${JSON.stringify(m)}`);
    }
    ok('hero letreiro: a ordem do DOM é a ordem visual (celular e desktop)');
  }
  // hero `numero` (v1.5, PEDIDO_DESIGN_4): a faixa de abertura vai de uma borda à outra; a ordem do DOM (título, apresentação, Ver serviços, Onde fica, fatos, imagem) TEM de ser a ordem
  // visual (de cima para baixo e, na mesma altura, da esquerda para a direita) no celular e no desktop; a placa do número e a nota ficam sobre a imagem sem sair da tela nem cobrir a legenda
  if (await c.avaliar(`!!document.querySelector('.hero--numero')`)) {
    for (const [l, a] of [[320, 700], [390, 844], [1280, 800]]) {
      await c.emular(l, a); await c.navegar(srv.url + 'index.html', 900);
      const m = await c.avaliar(`(() => { const r = (s) => { const e = document.querySelector('.hero--numero ' + s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; };
        return { faixa: r('.nm-faixa'), h1: r('h1'), lead: r('.nm-lead'), servicos: r('[data-toque="servicos"]'), onde: r('[data-toque="onde"]'), fatos: r('.nm-fatos'), foto: r('.nm-foto'), bloco: r('.nm-bloco'), nota: r('.nm-nota'), legenda: r('.nm-foto figcaption'), vw: document.documentElement.clientWidth }; })()`);
      const ordem = ['h1', 'lead', 'servicos', 'onde', 'fatos', 'foto'].filter((k) => m[k]);
      for (let i = 1; i < ordem.length; i++) {
        const x = m[ordem[i - 1]], y = m[ordem[i]];
        assert.ok(y.top > x.top - 1 || (Math.abs(y.top - x.top) <= 1 && y.left >= x.left - 1) || (l >= 900 && ordem[i] === 'foto' && y.left >= m.fatos.right), `${l}px: ${ordem[i]} aparece antes de ${ordem[i - 1]}: ${JSON.stringify(m)}`);
      }
      assert.ok(m.faixa.left <= 0 && m.faixa.right >= m.vw, `${l}px: a faixa não vai de uma borda à outra: ${JSON.stringify(m)}`);
      for (const k of ['bloco', 'nota', 'foto']) if (m[k]) assert.ok(m[k].left >= 0 && m[k].right <= m.vw && m[k].top >= m.faixa.top - 1 && m[k].bottom <= m.faixa.bottom + 1, `${l}px: ${k} sai da tela ou da faixa: ${JSON.stringify(m)}`);
      const bate = (p, q) => p && q && p.left < q.right && p.right > q.left && p.top < q.bottom && p.bottom > q.top;
      assert.ok(!bate(m.bloco, m.legenda) && !bate(m.nota, m.legenda), `${l}px: a placa ou a nota cobre a legenda "Imagem ilustrativa": ${JSON.stringify(m)}`);
    }
    ok('hero numero: faixa de borda a borda, ordem do DOM = ordem visual, placa e nota sem cobrir a legenda (320, 390 e 1280)');
  }
  // hero `registro` (v1.3): a folha é UMA grade; a ordem do DOM (título, apresentação, atalhos, linhas, nota) TEM de ser a ordem visual (de cima para baixo e, na mesma altura, da esquerda
  // para a direita: no desktop o título e a apresentação dividem a primeira fileira e os atalhos e as linhas, a segunda); tudo fica dentro da folha, à direita da margem dupla, e a fita
  // marcadora (decoração) não cobre nenhuma linha de texto do título nem da apresentação
  if (await c.avaliar(`!!document.querySelector('.hero--registro')`)) {
    for (const [l, a] of [[320, 700], [390, 844], [1280, 800]]) {
      await c.emular(l, a); await c.navegar(srv.url + 'index.html', 1200);
      const m = await c.avaliar(`(() => { const r = (s) => { const e = document.querySelector('.hero--registro ' + s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; };
        const linhasDeTexto = (s) => { const e = document.querySelector('.hero--registro ' + s), g = document.createRange(); g.selectNodeContents(e); return [...g.getClientRects()].map((q) => ({ top: q.top, bottom: q.bottom, left: q.left, right: q.right })); };
        const fita = document.querySelector('.rg-fita').getBoundingClientRect(), bate = (q) => q.left < fita.right && q.right > fita.left && q.top < fita.bottom && q.bottom > fita.top;
        return { folha: r('.rg-folha'), h1: r('h1'), lead: r('.rg-lead'), acoes: r('.rg-acoes'), linhas: r('.rg-linhas'), pe: r('.rg-pe'), fitaSobTexto: [...linhasDeTexto('h1'), ...linhasDeTexto('.rg-lead')].filter(bate).length,
          margem: Math.round(parseFloat(getComputedStyle(document.querySelector('.rg-folha'), '::before').left)) + 7 }; })()`);
      const ordem = ['h1', 'lead', 'acoes', 'linhas', 'pe'].filter((k) => m[k]);
      for (let i = 1; i < ordem.length; i++) {
        const x = m[ordem[i - 1]], y = m[ordem[i]];
        assert.ok(y.top > x.top - 1 || (Math.abs(y.top - x.top) <= 1 && y.left >= x.left - 1), `${l}px: ${ordem[i]} aparece antes de ${ordem[i - 1]}: ${JSON.stringify(m)}`);
      }
      for (const k of ordem) assert.ok(m[k].left >= m.folha.left + m.margem + 8 && m[k].right <= m.folha.right + 1 && m[k].top >= m.folha.top - 1 && m[k].bottom <= m.folha.bottom + 1, `${l}px: ${k} fora da folha ou sobre a margem dupla: ${JSON.stringify(m)}`);
      assert.equal(m.fitaSobTexto, 0, `${l}px: a fita marcadora cobre texto do título ou da apresentação: ${JSON.stringify(m)}`);
    }
    ok('hero registro: a ordem do DOM é a ordem visual, tudo dentro da folha e à direita da margem, e a fita não cobre texto (320, 390 e 1280)');
  }
  // hero `pilares` (v1.4): a fachada é UMA grade (friso, colunata, degraus, nota); a ordem do DOM TEM de ser a visual; no celular as colunas são UMA coluna de tambores empilhados (mesma esquerda, uma
  // abaixo da outra) e no desktop ficam lado a lado (mesmo topo); o texto de cada placa cabe no fuste; o frontão (::before do friso) cabe no espaço acima da fachada, sem tocar o topo
  if (await c.avaliar(`!!document.querySelector('.hero--pilares')`)) {
    for (const [l, a] of [[320, 700], [390, 844], [768, 900], [1024, 768], [1099, 800], [1100, 800], [1280, 800]]) {
      await c.emular(l, a); await c.navegar(srv.url + 'index.html', 1500);
      const m = await c.avaliar(`(() => { const R = (e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; }, r = (s) => { const e = document.querySelector('.hero--pilares ' + s); return e ? R(e) : null; };
        // nenhuma palavra do título de uma coluna pode ser quebrada no meio (achado da revisão: entre 900 e 1080px "Atendimento" e "especializado" quebravam, e o overflow-wrap anywhere esconde isso do teste de caixa):
        // o Range de cada palavra tem de ficar numa linha só
        const quebradas = []; for (const b of document.querySelectorAll('.pl-fuste b')) { const no = b.firstChild; if (!no) continue; const re = /\\S+/g; let k; while ((k = re.exec(no.textContent))) { const g = document.createRange(); g.setStart(no, k.index); g.setEnd(no, k.index + k[0].length); if (new Set([...g.getClientRects()].map((q) => Math.round(q.top))).size > 1) quebradas.push(k[0]); } }
        const cols = [...document.querySelectorAll('.pl-coluna')].map(R), placas = [...document.querySelectorAll('.pl-fuste')].map((f) => ({ f: R(f), b: R(f.querySelector('b')) }));
        const frontao = parseFloat(getComputedStyle(document.querySelector('.pl-friso'), '::before').height), topo = R(document.querySelector('.topo'));
        return { quebradas, fachada: r('.pl-fachada'), h1: r('h1'), lead: r('.pl-lead'), acoes: r('.pl-acoes'), colunas: r('.pl-colunas'), degraus: r('.pl-degraus'), pe: r('.pl-pe'), cols, placas, frontao, topoBottom: topo.bottom }; })()`);
      const ordem = ['h1', 'lead', 'acoes', 'colunas', 'degraus', 'pe'].filter((k) => m[k]);
      for (let i = 1; i < ordem.length; i++) {
        const x = m[ordem[i - 1]], y = m[ordem[i]];
        assert.ok(y.top > x.top - 1 || (Math.abs(y.top - x.top) <= 1 && y.left >= x.left - 1), `${l}px: ${ordem[i]} aparece antes de ${ordem[i - 1]}: ${JSON.stringify(m)}`);
      }
      for (const k of ordem) assert.ok(m[k].left >= m.fachada.left - 1 && m[k].right <= m.fachada.right + 1, `${l}px: ${k} fora da fachada: ${JSON.stringify(m)}`);
      assert.ok(m.cols.length >= 1, 'a colunata tem colunas');
      if (l < 1100) assert.ok(m.cols.every((x, i) => i === 0 || (x.left === m.cols[0].left && x.top >= m.cols[i - 1].bottom - 1)), `${l}px: no celular as colunas são UMA coluna de tambores empilhados: ${JSON.stringify(m.cols)}`);
      else assert.ok(m.cols.length === 1 || m.cols.every((x, i) => i === 0 || (Math.abs(x.top - m.cols[0].top) <= 1 && x.left >= m.cols[i - 1].right - 1)), `${l}px: no desktop as colunas ficam lado a lado: ${JSON.stringify(m.cols)}`);
      for (const p of m.placas) assert.ok(p.b.left >= p.f.left - 1 && p.b.right <= p.f.right + 1, `${l}px: o título de uma coluna não cabe no fuste: ${JSON.stringify(p)}`);
      assert.deepEqual(m.quebradas, [], `${l}px: palavra quebrada no meio no título de uma coluna: ${m.quebradas.join(', ')}`);
      assert.ok(m.fachada.top - m.topoBottom >= m.frontao - 1, `${l}px: o frontão (${m.frontao}px) encosta no topo da página: ${JSON.stringify({ f: m.fachada.top, t: m.topoBottom })}`);
    }
    ok('hero pilares: a ordem do DOM é a ordem visual, colunas empilhadas até 1099px e lado a lado a partir de 1100px, nenhuma palavra quebrada no meio, títulos dentro do fuste e o frontão cabe sob o topo (320, 390, 768, 1024, 1099, 1100 e 1280)');
  }

  // nome longo e fonte reserva (v0.8, dívida do site 6): o nome do negócio mais comprido que o do cadastro, na fonte do sistema que não é a do tema (Arial, o que Windows e Android usam
  // no lugar de Helvetica Neue, Avenir, DIN...), não pode alargar nenhuma página em 320px. Troca todo texto que é o nome (e as duas metades do cartaz da `dupla`) e a fonte de tudo.
  for (const [l, a] of [[320, 700], [390, 844]]) {
    await c.emular(l, a);
    for (const longo of ['Clínica Veterinária Santa Maria de Nossa Senhora', 'Otorrinolaringologia']) {
      for (const p of paginas) {
        await c.navegar(srv.url + p, 300);
        const sw = await c.avaliar(`(async () => {
          const nome = (window.SITE_CONFIG && SITE_CONFIG.negocio && SITE_CONFIG.negocio.nome) || '', longo = ${JSON.stringify(longo)};
          const st = document.createElement('style'); st.textContent = '*, *::before, *::after { font-family: Arial, Helvetica, sans-serif !important; animation: none !important; }'; document.head.appendChild(st);
          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const ns = []; while (w.nextNode()) ns.push(w.currentNode);
          for (const n of ns) if (nome && n.nodeValue.includes(nome)) n.nodeValue = n.nodeValue.split(nome).join(longo);
          const metades = document.querySelectorAll('.dp-metade'); if (metades.length) { metades[0].textContent = longo.split(' ').slice(0, 2).join(' '); if (metades[1]) metades[1].textContent = longo.split(' ').slice(2).join(' ') || longo; }
          await new Promise((r) => setTimeout(r, 150));
          return document.documentElement.scrollWidth; })()`);
        assert.ok(sw <= l, `${p} em ${l}px com o nome "${longo}" e Arial: rolagem horizontal (${sw}px)`);
      }
    }
    ok(`${l}px: nome longo ("Clínica Veterinária Santa Maria de Nossa Senhora" e uma palavra de 20 letras) na fonte reserva Arial, 3 páginas sem rolagem horizontal`);
  }
  await c.emular(390, 844);
  await c.navegar(srv.url + 'contato.html', 400);
  assert.equal(await c.avaliar(`document.forms.length + document.querySelectorAll('#f-nome, #f-msg, .wa-form').length`), 0); ok('contato sem formulário (v1.1: o contato é pelo WhatsApp flutuante)');

  // foco por teclado de verdade (Tab), não por script: o anel precisa aparecer em cada item navegado
  await c.navegar(srv.url + 'index.html', 300);
  const aneis = [];
  for (let i = 0; i < 6; i++) {
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    aneis.push(await c.avaliar(`(() => { const e = document.activeElement, cs = getComputedStyle(e); return [e.tagName + '.' + e.className, e.matches(':focus-visible'), cs.outlineStyle, cs.outlineWidth].join('|'); })()`));
  }
  assert.ok(aneis.every((a) => a.split('|')[1] === 'true' && a.split('|')[2] === 'solid' && parseFloat(a.split('|')[3]) >= 2), 'anel de foco ausente: ' + aneis.join(' ; '));
  ok('foco por Tab mostra anel sólido de 3px nos 6 primeiros itens (' + aneis[0].split('|')[0] + ' ...)');
  const anim = await c.avaliar(`[...document.styleSheets].some(s => [...s.cssRules].some(r => r.media && /prefers-reduced-motion/.test(r.media.mediaText)))`);
  assert.ok(anim); ok('prefers-reduced-motion presente no CSS');
  // movimento: com prefers-reduced-motion nenhuma animação roda (CSS e Web Animations); sem a preferência, a identidade pode ter UMA animação de entrada
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await c.emular(1280, 800); await c.navegar(srv.url + 'index.html', 900);
  const rodando = await c.avaliar(`document.getAnimations().filter(a => a.playState === 'running').map(a => (a.effect && a.effect.target ? a.effect.target.className : '') + ':' + a.animationName)`);
  assert.deepEqual(rodando, [], 'animação rodando com prefers-reduced-motion: ' + rodando.join(', ')); ok('prefers-reduced-motion: nenhuma animação em execução');
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await c.navegar(srv.url + 'index.html', 150);
  // v1.0: além da entrada da identidade, só a entrada do WhatsApp flutuante (movimento.css) e o passo das patinhas (caderneta) podem rodar
  const nomes = await c.avaliar(`[...new Set(document.getAnimations().filter(a => a instanceof CSSAnimation).map(a => a.animationName))]`); // v1.4: só as animações do CSS: a transição de opacidade dos cards `.revela` que já estão na primeira tela (Doc & Dog) tem `animationName` indefinido e contava como uma segunda 'animação da identidade'
  const daIdentidade = nomes.filter((n) => !['flutuante-entra', 'passo'].includes(n));
  assert.ok(daIdentidade.length <= 1, `a identidade deve ter no máximo UMA animação de entrada (achou ${daIdentidade.join(', ')})`); ok(`sem a preferência: ${nomes.join(', ') || 'nenhuma'} (da identidade: ${daIdentidade.length}, limite 1)`);
  assert.deepEqual(c.console, [], 'erros no console'); ok('sem erros no console');
} catch (e) { console.error('FALHOU:', e.message); process.exitCode = 1; } finally { await c.fechar(); srv.fechar(); }
