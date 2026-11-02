// Mini-cliente do protocolo do Chrome (CDP) sem dependências: Node 22+ (WebSocket e fetch nativos).
// Serve para screenshots em 390px reais (o --window-size do headless tem largura mínima) e para testar o painel de verdade.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function abrirChrome({ porta = 9333 + Math.floor(Math.random() * 500) } = {}) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-perfil-'));
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  let info;
  for (let i = 0; i < 80; i++) {
    try { info = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json(); if (info.length) break; } catch (e) { /* aguarda */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!info || !info.length) { proc.kill(); throw new Error('Chrome não respondeu no CDP'); }
  const alvo = info.find((t) => t.type === 'page') || info[0];
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pend = new Map();
  const ouvintes = [];
  const console_ = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pend.has(msg.id)) {
      const { res, rej } = pend.get(msg.id); pend.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method) {
      if (msg.method === 'Runtime.consoleAPICalled') console_.push(msg.params.type + ': ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
      if (msg.method === 'Runtime.exceptionThrown') console_.push('EXCEÇÃO: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
      ouvintes.forEach((f) => f(msg));
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');

  const api = {
    console: console_,
    send,
    async emular(largura, altura, mobile = largura < 700) {
      await send('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile });
    },
    async navegar(url, espera = 500) {
      const carregou = new Promise((res) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { ouvintes.splice(ouvintes.indexOf(f), 1); res(); } }; ouvintes.push(f); });
      await send('Page.navigate', { url });
      await Promise.race([carregou, new Promise((r) => setTimeout(r, 8000))]);
      await new Promise((r) => setTimeout(r, espera));
    },
    async avaliar(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('avaliar: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async esperar(expr, ms = 5000) {
      const fim = Date.now() + ms;
      while (Date.now() < fim) { if (await api.avaliar(`!!(${expr})`)) return true; await new Promise((r) => setTimeout(r, 80)); }
      throw new Error('tempo esgotado esperando: ' + expr);
    },
    async foto(arquivo, { pagina = true } = {}) {
      const params = { format: 'png' };
      if (pagina) {
        const m = await send('Page.getLayoutMetrics');
        const w = Math.ceil(m.cssContentSize.width), h = Math.min(Math.ceil(m.cssContentSize.height), 6000);
        params.clip = { x: 0, y: 0, width: w, height: h, scale: 1 };
        params.captureBeyondViewport = true;
      }
      const r = await send('Page.captureScreenshot', params);
      fs.writeFileSync(arquivo, Buffer.from(r.data, 'base64'));
    },
    async digitar(seletor, texto) {
      await api.avaliar(`(()=>{const e=document.querySelector(${JSON.stringify(seletor)});if(!e)throw new Error('sem '+${JSON.stringify(seletor)});e.focus();e.value=${JSON.stringify(texto)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    },
    async clicar(seletor) {
      await api.avaliar(`(()=>{const e=document.querySelector(${JSON.stringify(seletor)});if(!e)throw new Error('sem '+${JSON.stringify(seletor)});e.click();})()`);
    },
    async clicarTexto(seletor, texto) {
      const ok = await api.avaliar(`(()=>{const t=${JSON.stringify(texto)};const e=[...document.querySelectorAll(${JSON.stringify(seletor)})].find(x=>x.textContent.trim().includes(t)&&x.offsetParent!==null);if(!e)return false;e.click();return true;})()`);
      if (!ok) throw new Error(`sem ${seletor} com texto "${texto}"`);
    },
    async fechar() { try { ws.close(); } catch (e) { /* ok */ } proc.kill(); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) { /* ok */ } },
  };
  return api;
}
