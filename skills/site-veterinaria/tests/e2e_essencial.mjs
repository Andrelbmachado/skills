// Pacote ESSENCIAL (build --sem-vitrine) no Chrome: a raiz do site leva direto ao login do painel, não existe vitrine pública
// (páginas respondem 404), nenhum link aponta para o site público e a configuração diz vitrine:false.
// O painel em si é coberto por e2e_painel.mjs (que também lê vitrine:false e adapta as verificações).
// Uso: node e2e_essencial.mjs <pastaDoSite>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { abrirChrome } from './cdp.mjs';
import { servir } from './servidor.mjs';

const [pasta] = process.argv.slice(2);
if (!pasta) { console.error('uso: node e2e_essencial.mjs <pastaDoSite>'); process.exit(2); }
const srv = await servir(pasta);
const c = await abrirChrome();
const ok = (m) => console.log('ok  ' + m);
try {
  for (const p of ['servicos.html', 'sobre.html', 'contato.html', 'assets/style.css', 'assets/app.js']) {
    assert.ok(!fs.existsSync(path.join(pasta, p)), `${p} não deve existir no ESSENCIAL`);
    const r = await fetch(srv.url + p); assert.equal(r.status, 404, p);
  }
  ok('servicos, sobre, contato, style.css e app.js da vitrine não existem (404)');

  for (const [l, a] of [[390, 844], [1280, 800]]) {
    await c.emular(l, a);
    await c.navegar(srv.url, 1200); // raiz do site
    const m = await c.avaliar(`({ caminho: location.pathname, titulo: document.querySelector('h1') && document.querySelector('h1').textContent, voltar: document.querySelectorAll('.login-voltar').length,
      sw: document.documentElement.scrollWidth, links: [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(h => h && /index\\.html|servicos|sobre|contato/.test(h)) })`);
    assert.equal(m.caminho, '/painel/', `a raiz deveria levar a /painel/ (foi para ${m.caminho})`);
    assert.match(m.titulo, /Primeiro acesso|Entrar na gestão/);
    assert.equal(m.voltar, 0); assert.deepEqual(m.links, []); assert.ok(m.sw <= l, `rolagem horizontal em ${l}px`);
    ok(`${l}px: a raiz abre o login do painel (${m.titulo}), sem link para o site público, sem rolagem horizontal`);
  }

  // sem JavaScript o index.html ainda aponta para o painel (meta refresh + link visível)
  const html = fs.readFileSync(path.join(pasta, 'index.html'), 'utf8');
  assert.match(html, /<meta http-equiv="refresh" content="0; url=painel\/">/); assert.match(html, /<a href="painel\/">Entrar na gestão<\/a>/);
  assert.match(html, /name="robots" content="noindex"/);
  ok('index.html tem redirecionamento sem JavaScript (meta refresh), link "Entrar na gestão" e noindex');

  assert.match(fs.readFileSync(path.join(pasta, 'assets/site-config.js'), 'utf8'), /modules: \{ vitrine: false, gestao: true \}/);
  ok('site-config.js com vitrine:false e gestao:true');
  assert.deepEqual(c.console.filter((x) => !/favicon/i.test(x)), [], 'erros no console'); ok('sem erros no console');
} catch (e) { console.error('FALHOU:', e.message); process.exitCode = 1; } finally { await c.fechar(); srv.fechar(); }
