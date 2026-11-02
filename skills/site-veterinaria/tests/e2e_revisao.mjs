// Regressões achadas na revisão independente do site 1 (skill v0.3): cada passo abaixo reproduz um defeito do template do painel
// ou do gerador e confere a correção no Chrome de verdade. Rodado contra o painel da v0.2, os passos de defeito FALHAM; contra a v0.3, passam.
// Diferente de e2e_painel.mjs, não para na primeira falha: cada passo é independente e o resumo lista os que reprovaram.
// Serve para PREMIUM e ESSENCIAL e para qualquer subtipo (lê SITE_CONFIG e os nomes do Seed na página).
// Uso: node e2e_revisao.mjs <pastaDoSite>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { abrirChrome } from './cdp.mjs';
import { servir } from './servidor.mjs';

const [pasta] = process.argv.slice(2);
if (!pasta) { console.error('uso: node e2e_revisao.mjs <pastaDoSite>'); process.exit(2); }
const srv = await servir(pasta);
const c = await abrirChrome();
await c.send('Emulation.setFocusEmulationEnabled', { enabled: true }); // headless sem foco de janela: sem isto :focus-visible e Tab não se comportam
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (sel) => `document.querySelector(${JSON.stringify(sel)})`;
const texto = (sel) => c.avaliar(`(${q(sel)} || {}).textContent || ''`);
const contar = (sel) => c.avaliar(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const falhas = []; let feitos = 0;
const CONTAS = { dono: 'senha-segura-1', vet: 'senha-vet-123', recep: 'senha-rec-123' };
/* cada passo roda logado como o perfil pedido (padrão: dono); se um passo anterior falhou no meio, a sessão e os diálogos são recompostos */
async function garantir(usuario) {
  await c.emular(1280, 800); await c.navegar(srv.url + 'painel/', 500); // recarrega: apaga remendos de um passo anterior que falhou no meio
  await c.esperar('document.querySelector("#login-raiz h1") || document.getElementById("titulo-tela")', 8000);
  if (await c.avaliar('!!document.querySelector("#login-raiz h1")')) { await entrar(usuario, CONTAS[usuario]); return; }
  const atual = await c.avaliar(`(Auth.sessaoAtual(sessionStorage, SITE_CONFIG.negocio.slug) || {}).usuario`);
  if (atual !== usuario) { await sair(); await entrar(usuario, CONTAS[usuario]); }
}
async function passo(nome, fn, perfil = 'dono') {
  if (process.env.SO && !nome.startsWith(process.env.SO)) return; // depuração: SO=I node e2e_revisao.mjs <pasta> roda só os passos cujo nome começa por "I"
  try { await garantir(perfil); await fn(); feitos++; console.log('ok    ' + nome); } catch (e) { falhas.push(nome + ' => ' + String(e.message).replace(/\s+/g, ' ').slice(0, 700)); console.log('FALHA ' + nome + '\n        ' + String(e.message).replace(/\s+/g, ' ').slice(0, 700)); }
}
async function tecla(key, code, vk) { for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk }); }
async function irPara(rota, titulo) {
  await c.avaliar(`location.hash = '#/${rota}'`);
  await c.esperar(`document.getElementById('titulo-tela') && document.getElementById('titulo-tela').textContent.includes(${JSON.stringify(titulo)})`);
  await dormir(150);
}
/* irPara só troca o hash: se a tela já está aberta, nada é redesenhado e o teste lê dado velho. Depois de criar dados pelo store, use este. */
async function irParaFresco(rota, titulo) { await irPara(rota, titulo); await c.avaliar('Painel.ctx.atualizar()'); await dormir(300); }
async function abrirDialog() { await c.esperar('document.querySelector("dialog.modal[open]")'); await dormir(80); }
async function botaoDialog(rotulo) { await c.clicarTexto('dialog.modal[open] .modal-rodape button', rotulo); await dormir(300); }
async function fecharDialogs() { await c.avaliar('document.querySelectorAll("dialog.modal[open]").forEach(d => d.close())'); await dormir(100); }
async function campo(nome, valor) { await c.digitar(`dialog.modal[open] [name="${nome}"]`, valor); }
async function sair() { await c.clicarTexto('button', 'Sair'); await c.esperar('document.querySelector("#login-raiz h1")'); }
async function entrar(usuario, senha) {
  await c.digitar('[name="usuario"]', usuario); await c.digitar('[name="senha"]', senha);
  await c.clicarTexto('button[type="submit"]', 'Entrar'); await c.esperar('document.getElementById("titulo-tela")', 8000);
}
const lista = (col) => c.avaliar(`Painel.ctx.store.listar(${JSON.stringify(col)})`);
const hojeISO = () => c.avaliar('Regras.hojeISO()');

try {
  await c.emular(1280, 800);
  const base = srv.url;
  await c.navegar(base + 'painel/', 400);
  const cfg = await c.avaliar('JSON.parse(JSON.stringify(window.SITE_CONFIG))');
  const pc = cfg.painel || {}, semVitrine = cfg.modules.vitrine === false, diag = (pc.modulos || []).includes('exames'); // diagnóstico: sem prontuário nem vacina; os passos I cobrem o equivalente
  console.log(`site: vitrine ${semVitrine ? 'desligada (ESSENCIAL)' : 'ligada'}, subtipo ${pc.subtipo || 'geral'}\n`);

  /* ---------- preparo: dono, dados de exemplo, veterinário e recepção ---------- */
  await c.digitar('[name="nome"]', 'Dono Teste'); await c.digitar('[name="usuario"]', 'dono'); await c.digitar('[name="senha"]', 'senha-segura-1'); await c.digitar('[name="conf"]', 'senha-segura-1');
  await c.avaliar(`document.querySelector('.login-form').requestSubmit()`);
  await c.esperar('document.getElementById("titulo-tela")');
  await c.clicarTexto('.painel-vazio button', 'Carregar dados de exemplo');
  await c.esperar('document.querySelector(".resumo-grade") && !document.querySelector(".painel-vazio")'); await dormir(300);
  const S = await c.avaliar(`Seed.gerar(Regras.hojeISO(), ${JSON.stringify(pc.subtipo || null)}, ${JSON.stringify({ exames: pc.exames })})`);
  const queixas = S.prontuarios.map((p) => p.queixa).filter(Boolean);
  await c.avaliar(`(async () => { const st = Painel.ctx.store;
    await Auth.criarUsuario(st, { nome: 'Vet Teste', usuario: 'vet', senha: 'senha-vet-123', perfil: 'veterinario' });
    await Auth.criarUsuario(st, { nome: 'Recep Teste', usuario: 'recep', senha: 'senha-rec-123', perfil: 'recepcao' }); })()`);

  /* ---------- 1. login sem botão de apagar tudo ---------- */
  await passo('1. a tela de login não oferece apagar os dados (qualquer pessoa apagaria tudo e criaria um novo dono)', async () => {
    await sair();
    assert.equal(await contar('#login-raiz .esqueci button'), 0, 'há botão dentro de "Esqueci a senha"');
    assert.doesNotMatch(await c.avaliar('document.body.textContent'), /Apagar dados deste navegador/);
    const botoes = await c.avaliar(`[...document.querySelectorAll('#login-raiz button')].map(b => b.textContent.trim())`);
    assert.deepEqual(botoes, ['Entrar'], 'só o botão Entrar');
    await entrar('dono', 'senha-segura-1');
  });
  await passo('1b. Configurações mantém "Apagar tudo" só para o dono, com APAGAR e oferta de exportar antes', async () => {
    await irPara('config', 'Configurações');
    await c.clicarTexto('button', 'Apagar todos os dados deste navegador'); await abrirDialog();
    const botoes = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].map(b => b.textContent.trim())`);
    assert.ok(botoes.some((b) => /Exportar uma cópia antes/.test(b)), 'sem "Exportar uma cópia antes": ' + botoes.join(' | '));
    await campo('c', 'qualquer coisa'); await botaoDialog('Apagar tudo');
    assert.ok((await lista('tutores')).length > 0, 'apagou sem digitar APAGAR');
    await fecharDialogs();
  });

  /* ---------- 16. senha provisória ---------- */
  await passo('16. senha provisória redefinida usa 8 caracteres do gerador criptográfico', async () => {
    await irPara('config', 'Configurações');
    for (let i = 0; i < 3; i++) {
      await c.clicarTexto('.tabela tbody tr', 'Recep Teste'); await abrirDialog();
      await botaoDialog('Redefinir senha'); await abrirDialog();
      const msg = await texto('dialog.modal[open]:last-of-type .modal-corpo');
      assert.match(msg, /"prov-[a-hj-km-np-z2-9]{8}"/, 'formato da senha provisória: ' + msg.slice(0, 80));
      await botaoDialog('Cancelar'); await fecharDialogs();
    }
  });

  /* ---------- 2 e 7. perfis ---------- */
  const tutorComProntuario = diag ? 'Ana Exemplo' : S.tutores.find((t) => S.pets.some((p) => p.tutorId === t.id && S.prontuarios.some((r) => r.petId === p.id))).nome;
  async function exportarComoPerfil() {
    await irPara('tutores', 'Tutores e pets'); await c.clicarTexto('.aba', 'Tutores'); await dormir(200);
    await c.clicarTexto('.tabela tbody tr', tutorComProntuario); await abrirDialog();
    await c.avaliar('window.__baixado = null; UI.baixar = function (n, conteudo) { window.__baixado = conteudo; };');
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Exportar dados deste tutor');
    await c.esperar('window.__baixado');
    return { arquivo: JSON.parse(await c.avaliar('window.__baixado')), botoes: await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].map(b => b.textContent.trim())`), bruto: await c.avaliar('window.__baixado') };
  }
  if (!diag) await passo('2a/2b. recepção: exportar dados do tutor sem prontuário e sem poder excluir tutor ou pet', async () => {
    const r = await exportarComoPerfil();
    assert.equal(r.arquivo.dados.prontuarios, undefined, 'recepção baixou prontuários');
    assert.ok(r.arquivo.omitidos.includes('prontuarios'), 'sem o aviso do que foi omitido');
    for (const p of S.prontuarios) assert.ok(!r.bruto.includes(p.prescricao || '__nada__'), 'prescrição no arquivo da recepção');
    assert.ok(r.arquivo.dados.tutor && r.arquivo.dados.pets, 'cadastro do tutor deveria vir');
    assert.ok(!r.botoes.some((b) => /Excluir tutor/.test(b)), 'recepção vê "Excluir tutor e dados": ' + r.botoes.join(' | '));
    await fecharDialogs();
    await c.clicarTexto('.aba', 'Pets'); await dormir(200);
    await c.clicarTexto('.tabela tbody tr', S.pets[0].nome); await abrirDialog();
    await botaoDialog('Editar pet'); await abrirDialog();
    const botoes = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].map(b => b.textContent.trim())`);
    assert.ok(!botoes.includes('Excluir'), 'recepção pode excluir pet (cascata em prontuários e vacinas): ' + botoes.join(' | '));
    await fecharDialogs();
  }, 'recep');
  if (!diag) await passo('2c. recepção não lê a queixa do prontuário pelo Início nem por Vacinas e retornos', async () => {
    await irPara('inicio', 'Olá');
    let t = await texto('.tela');
    for (const qx of queixas) assert.ok(!t.includes(qx), `Início da recepção mostra a queixa "${qx}"`);
    assert.ok(/: Retorno(?!:)/.test(t), 'o Início da recepção deveria listar retornos (só "Retorno", sem a queixa)');
    await irPara('vacinas', 'Vacinas e retornos'); await c.clicarTexto('.chip-botao', 'Todos'); await dormir(250);
    t = await texto('.tela');
    for (const qx of queixas) assert.ok(!t.includes(qx), `Vacinas da recepção mostra a queixa "${qx}"`);
    assert.ok(await c.avaliar(`[...document.querySelectorAll('.tabela td[data-rotulo="O que"]')].some(td => td.textContent.trim() === 'Retorno')`), 'Vacinas deveria listar o retorno como "Retorno"');
  }, 'recep');
  if (!diag) await passo('7a. recepção (só leitura em Vacinas) não vê "Dispensar" nem o filtro "Dispensados", mas ainda avisa o tutor', async () => {
    await irPara('vacinas', 'Vacinas e retornos'); await c.clicarTexto('.chip-botao', 'Todos'); await dormir(250);
    const botoes = await c.avaliar(`[...document.querySelectorAll('.tabela button, .filtros button')].map(b => b.textContent.trim())`);
    assert.ok(!botoes.some((b) => /Dispensar|Dispensados/.test(b)), 'recepção vê: ' + botoes.filter((b) => /Dispens/.test(b)).join(' | '));
    assert.ok(botoes.some((b) => /Marcar avisado/.test(b)), 'recepção deveria poder marcar como avisado');
  }, 'recep');
  if (!diag) await passo('2a/2b. veterinário: exporta sem o caixa e não exclui tutor', async () => {
    const r = await exportarComoPerfil();
    assert.equal(r.arquivo.dados.lancamentos, undefined, 'veterinário baixou o caixa'); assert.ok(r.arquivo.omitidos.includes('lancamentos'));
    assert.ok(r.arquivo.dados.prontuarios && r.arquivo.dados.prontuarios.length > 0, 'veterinário deveria levar os prontuários');
    assert.ok(!r.botoes.some((b) => /Excluir tutor/.test(b)), 'veterinário vê "Excluir tutor e dados"');
    await fecharDialogs();
    await irPara('inicio', 'Olá'); const t = await texto('.tela');
    assert.ok(queixas.some((qx) => t.includes(qx)), 'veterinário deveria ver a queixa no retorno (controle positivo)');
  }, 'vet');
  if (!diag) await passo('2 (controle). dono exporta tudo e vê "Excluir tutor e dados"', async () => {
    const r = await exportarComoPerfil();
    assert.deepEqual(r.arquivo.omitidos, []); assert.ok(r.arquivo.dados.lancamentos.length > 0 && r.arquivo.dados.prontuarios.length > 0);
    assert.ok(r.botoes.some((b) => /Excluir tutor/.test(b)));
    await fecharDialogs();
  });

  /* ---------- 7. dispensar e restaurar ---------- */
  if (!diag) await passo('7b. dono dispensa um lembrete, acha em "Dispensados" e restaura', async () => {
    await irPara('vacinas', 'Vacinas e retornos'); await c.clicarTexto('.chip-botao', 'Todos'); await dormir(250);
    const n0 = await contar('.tabela tbody tr'); assert.ok(n0 >= 3);
    await c.clicarTexto('.tabela tbody tr:first-child button', 'Dispensar'); await abrirDialog(); await botaoDialog('Dispensar'); await dormir(400);
    assert.equal(await contar('.tabela tbody tr'), n0 - 1, 'dispensado deveria sair de "Todos"');
    await c.clicarTexto('.chip-botao', 'Dispensados'); await dormir(300);
    assert.equal(await contar('.tabela tbody tr'), 1, 'filtro Dispensados não mostra o lembrete');
    await c.clicarTexto('.tabela tbody tr button', 'Restaurar'); await dormir(500);
    await c.clicarTexto('.chip-botao', 'Todos'); await dormir(300);
    assert.equal(await contar('.tabela tbody tr'), n0, 'restaurar deveria devolver o lembrete');
  });

  /* ---------- 4. reabrir consulta ---------- */
  if (!diag) await passo('4. reabrir consulta cancelada confere conflito de horário e erro de gravação não fica sem tratamento', async () => {
    const hoje = await hojeISO();
    const ids = await c.avaliar(`(async () => { const st = Painel.ctx.store;
      const a = await st.salvar('consultas', { petId: 'ex-pet-2', tutorId: 'ex-tut-1', profissionalId: 'ex-prof-2', inicio: '${hoje}T16:30', duracaoMin: 30, status: 'cancelada', motivo: 'Cancelada (teste)' });
      await st.salvar('consultas', { petId: 'ex-pet-4', tutorId: 'ex-tut-3', profissionalId: 'ex-prof-2', inicio: '${hoje}T16:30', duracaoMin: 30, status: 'agendada', motivo: 'Já marcada (teste)' });
      return a.id; })()`);
    await irPara('agenda', 'Agenda'); await c.avaliar('document.querySelectorAll(".agenda-barra button")[2].click()'); await dormir(300);
    await c.avaliar(`[...document.querySelectorAll('.bloco li')].find(li => li.textContent.includes(${JSON.stringify(S.pets[1].nome)})).querySelector('button').click()`); await abrirDialog();
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Reabrir como agendada'); await dormir(400);
    const abertos = await c.avaliar('document.querySelectorAll("dialog.modal[open]").length');
    assert.equal(abertos, 2, 'não pediu confirmação de conflito (reabriu direto)');
    assert.match(await texto('dialog.modal[open]:last-of-type .modal-corpo'), /já tem consulta às 16:30/);
    await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Cancelar'); await dormir(300);
    assert.equal((await lista('consultas')).find((x) => x.id === ids).status, 'cancelada', 'reabriu mesmo recusando');
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Reabrir como agendada'); await dormir(300);
    await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Reabrir mesmo assim'); await dormir(500);
    assert.equal((await lista('consultas')).find((x) => x.id === ids).status, 'agendada');
    // erro ao gravar: aviso na tela e nenhuma exceção solta
    await c.avaliar(`window.__salvar = Painel.ctx.store.salvar; Painel.ctx.store.salvar = () => Promise.reject(new Error('disco cheio (teste)'));`);
    await irPara('agenda', 'Agenda'); await c.clicarTexto('.bloco-consulta', S.pets[0].nome); await abrirDialog();
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Faltou'); await c.esperar('document.querySelector(".toast-erro")');
    assert.match(await texto('.toast-erro'), /disco cheio/);
    await c.avaliar('Painel.ctx.store.salvar = window.__salvar'); await fecharDialogs();
    assert.deepEqual(c.console.filter((x) => /EXCEÇÃO|Uncaught/.test(x) && !/URIError/.test(x)), [], 'exceção sem tratamento');
  });

  /* ---------- 14. Início ---------- */
  await passo('14. "Consultas hoje" não conta falta e "Próxima às" não volta para a primeira do dia', async () => {
    await irPara('inicio', 'Olá');
    const lerCartao = () => c.avaliar(`(() => { const k = [...document.querySelectorAll('.resumo-card')].find(e => /Consultas hoje|Exames hoje/.test(e.textContent)); return [Number(k.querySelector('.resumo-valor').textContent), k.querySelector('.resumo-detalhe').textContent]; })()`);
    const [n0] = await lerCartao();
    await c.avaliar(`(async () => { const st = Painel.ctx.store; const x = (await st.listar('consultas')).find(k => k.id === 'ex-cons-2'); await st.salvar('consultas', Object.assign({}, x, { status: 'faltou' })); })()`);
    await irPara('agenda', 'Agenda'); await irPara('inicio', 'Olá');
    const [n1] = await lerCartao(); assert.equal(n1, n0 - 1, `a falta ainda conta (${n0} -> ${n1})`);
    const hoje = await hojeISO();
    await c.avaliar(`(async () => { const st = Painel.ctx.store; for (const k of await st.listar('consultas')) if (k.inicio.slice(0, 10) === '${hoje}') await st.salvar('consultas', Object.assign({}, k, { inicio: '${hoje}T00:0' + (k.id.length % 9) })); })()`);
    await irPara('agenda', 'Agenda'); await irPara('inicio', 'Olá');
    const agora = await c.avaliar('Regras.agoraISO().slice(11, 16)');
    if (agora > '00:10') { const [, det] = await lerCartao(); assert.doesNotMatch(det, /Próxima às 00:/, 'todas já passaram e ainda mostra a primeira do dia: ' + det); }
  });

  /* ---------- 13. estoque ---------- */
  if (!diag) await passo('13a. aplicar vacina com item vencido avisa na lista e pede confirmação antes de dar baixa', async () => {
    const vencido = S.estoque.find((e) => e.validade && e.validade < S.estoque[0].validade && /Soro/.test(e.nome));
    const n0 = (await lista('vacinas')).length, q0 = (await lista('estoque')).find((e) => e.id === vencido.id).quantidade;
    await irPara('vacinas', 'Vacinas e retornos'); await c.clicarTexto('.tela-acoes button', 'Registrar vacina'); await abrirDialog();
    const rotulos = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] [name="itemEstoque"] option')].map(o => o.textContent)`);
    assert.ok(rotulos.some((r) => /Soro/.test(r) && /VENCIDO/i.test(r)), 'item vencido sem aviso na lista: ' + rotulos.join(' | '));
    await campo('petId', 'ex-pet-5'); await campo('vacina', 'Teste de item vencido'); await campo('itemEstoque', vencido.id);
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Salvar'); await dormir(500);
    assert.equal(await c.avaliar('document.querySelectorAll("dialog.modal[open]").length'), 2, 'não pediu confirmação do item vencido');
    assert.match(await texto('dialog.modal[open]:last-of-type .modal-corpo'), /vencida/);
    await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Cancelar'); await dormir(300);
    assert.equal((await lista('vacinas')).length, n0, 'gravou mesmo recusando'); assert.equal((await lista('estoque')).find((e) => e.id === vencido.id).quantidade, q0);
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Salvar'); await dormir(300);
    await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Registrar mesmo assim'); await dormir(600);
    assert.equal((await lista('vacinas')).length, n0 + 1); assert.equal((await lista('estoque')).find((e) => e.id === vencido.id).quantidade, q0 - 1);
  });
  if (!diag) await passo('13b. mudar a quantidade em "Editar item" registra um ajuste no histórico de movimentos', async () => {
    const item = S.estoque.find((e) => /Vermífugo/.test(e.nome));
    await irPara('estoque', 'Estoque'); await c.clicarTexto('.tabela tbody tr', 'Vermífugo'); await abrirDialog();
    await botaoDialog('Editar item'); await abrirDialog();
    await campo('quantidade', String(item.quantidade + 7)); await botaoDialog('Salvar'); await dormir(400);
    const movs = (await lista('movimentos')).filter((m) => m.itemId === item.id && m.tipo === 'ajuste');
    assert.equal(movs.length, 1, 'edição da quantidade não gerou movimento'); assert.equal(movs[0].qtd, item.quantidade + 7); assert.match(movs[0].motivo, /edição/);
    await c.clicarTexto('.tabela tbody tr', 'Vermífugo'); await abrirDialog();
    assert.match(await texto('dialog.modal[open] .modal-corpo'), /Ajuste para/); await fecharDialogs();
  });

  /* ---------- 19. pequenos ---------- */
  await passo('19a. valor com agrupamento malformado ou absurdo é recusado no caixa', async () => {
    await irPara('caixa', 'Caixa');
    for (const ruim of ['1.2.3', '99999999999999999']) {
      await c.clicarTexto('.tela-acoes button', 'Nova entrada'); await abrirDialog();
      await campo('descricao', 'Teste valor ruim'); await campo('valorCents', ruim); await campo('forma', 'pix'); await botaoDialog('Salvar');
      assert.match(await texto('dialog.modal[open] .erro-form'), /Valor inválido/, `aceitou ${ruim}`); await fecharDialogs();
    }
  });
  await passo('19b. "%" malformado no endereço da página não derruba a tela', async () => {
    await c.avaliar(`location.hash = '#/agenda?pet=%E0%A4%A'`); await dormir(600);
    assert.match(await texto('#titulo-tela'), /Agenda|Olá/); assert.deepEqual(c.console.filter((x) => /URIError|malformed/i.test(x)), [], 'URIError solto');
    await irPara('inicio', 'Olá');
  });
  await passo('19c. abas acessíveis: tablist ligado a tabpanel, só a ativa na ordem de Tab, setas trocam de aba e levam o foco', async () => {
    await irPara('tutores', 'Tutores e pets'); await c.clicarTexto('.aba', 'Tutores'); await dormir(250);
    const ligacao = await c.avaliar(`(() => { const t = [...document.querySelectorAll('[role=tab]')]; const p = document.querySelector('[role=tabpanel]');
      return { n: t.length, alvo: t.every(x => x.getAttribute('aria-controls') === (p && p.id)), rotulado: !!p && t.some(x => p.getAttribute('aria-labelledby') === x.id), tabindex: t.map(x => x.getAttribute('tabindex')) }; })()`);
    assert.ok(ligacao.alvo && ligacao.rotulado, 'tab sem tabpanel ou aria-controls: ' + JSON.stringify(ligacao)); assert.deepEqual(ligacao.tabindex, ['0', '-1']);
    await c.avaliar(`document.querySelector('[role=tab][aria-selected=true]').focus()`); await tecla('ArrowRight', 'ArrowRight', 39); await dormir(500);
    assert.equal(await c.avaliar(`document.querySelector('[role=tab][aria-selected=true]').textContent.startsWith('Pets')`), true, 'seta direita não trocou de aba');
    assert.equal(await c.avaliar(`document.activeElement.getAttribute('role')`), 'tab', 'o foco não acompanhou a aba');
    await tecla('Home', 'Home', 36); await dormir(500);
    assert.equal(await c.avaliar(`document.querySelector('[role=tab][aria-selected=true]').textContent.startsWith('Tutores')`), true);
  });

  /* ---------- 15. aviso sobre o diálogo ---------- */
  await passo('15. o aviso (toast) aparece POR CIMA de um diálogo aberto e volta ao normal depois', async () => {
    await irPara('tutores', 'Tutores e pets'); await c.clicarTexto('.tela-acoes button', 'Novo tutor'); await abrirDialog();
    await c.avaliar(`UI.toast('Aviso de teste sobre o diálogo', 'erro')`); await dormir(200);
    // .toasts tem pointer-events:none (não rouba clique); para testar quem fica por cima, liga o hit-test só no aviso
    const topo = await c.avaliar(`(() => { const t = [...document.querySelectorAll('.toast')].find(e => /Aviso de teste/.test(e.textContent)); t.style.pointerEvents = 'auto'; const r = t.getBoundingClientRect();
      const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && !!e.closest('.toast'); })()`);
    assert.equal(topo, true, 'o aviso ficou atrás do diálogo/fundo escurecido');
    await fecharDialogs();
    await c.avaliar(`UI.toast('Aviso depois de fechar', 'ok')`); await dormir(200);
    assert.equal(await c.avaliar(`(() => { const t = [...document.querySelectorAll('.toast')].find(e => /depois de fechar/.test(e.textContent)); t.style.pointerEvents = 'auto'; const r = t.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && !!e.closest('.toast'); })()`), true);
    assert.equal(await c.avaliar(`document.querySelector('.toasts').parentNode === document.body`), true);
  });

  /* ---------- 10. menu lateral no celular ---------- */
  await passo('10. celular: gaveta fechada não recebe foco; abrir leva o foco ao menu; Esc fecha e devolve o foco ao botão', async () => {
    await c.emular(390, 844); await c.navegar(base + 'painel/app.html#/inicio', 600); await c.esperar('document.getElementById("titulo-tela")');
    const fechado = await c.avaliar(`(() => { const l = document.getElementById('lateral'); return [getComputedStyle(l).visibility, l.inert, document.querySelector('.btn-menu').getAttribute('aria-expanded')]; })()`);
    assert.equal(fechado[0], 'hidden', 'gaveta fechada ainda visível para o foco'); assert.equal(fechado[1], true, 'inert ausente'); assert.equal(fechado[2], 'false');
    await c.avaliar(`document.querySelector('.btn-menu').focus()`);
    const visitados = [];
    for (let i = 0; i < 4; i++) { await tecla('Tab', 'Tab', 9); visitados.push(await c.avaliar(`!!document.activeElement.closest('#lateral')`)); }
    assert.ok(!visitados.some(Boolean), 'Tab entrou nos links da gaveta fechada');
    await c.avaliar(`document.querySelector('.btn-menu').click()`); await dormir(400);
    assert.equal(await c.avaliar(`getComputedStyle(document.getElementById('lateral')).visibility`), 'visible');
    assert.equal(await c.avaliar(`!!document.activeElement.closest('#lateral')`), true, 'o foco não foi para o menu aberto');
    await tecla('Escape', 'Escape', 27); await dormir(500);
    assert.equal(await c.avaliar(`document.querySelector('.btn-menu').getAttribute('aria-expanded')`), 'false', 'Esc não fechou o menu');
    assert.equal(await c.avaliar(`document.activeElement === document.querySelector('.btn-menu')`), true, 'o foco não voltou ao botão');
    assert.equal(await c.avaliar(`getComputedStyle(document.getElementById('lateral')).visibility`), 'hidden');
    await c.emular(1280, 800); await dormir(500); // o navegador avisa a mudança de largura (matchMedia) no próximo quadro
    assert.equal(await c.avaliar(`document.getElementById('lateral').inert`), false, 'no desktop o menu não pode ficar inert');
  });

  /* ---------- 9. 320px ---------- */
  await passo('9. 320px: nenhuma tela do painel e nenhuma página da vitrine ganha rolagem horizontal', async () => {
    await c.emular(320, 700); const ruins = [];
    for (const rota of await c.avaliar(`Regras.modulosDoPerfil('dono')`)) { // as telas do subtipo (o hospital acrescenta internacao)
      await c.avaliar(`location.hash = '#/${rota}'`); await dormir(500);
      const sw = await c.avaliar('document.documentElement.scrollWidth'); if (sw > 320) ruins.push(`painel ${rota}: ${sw}`);
      if (rota === 'internacao') {
        for (const aba of ['Internações', 'Plantão', 'Leitos']) {
          await c.clicarTexto('.aba', aba); await dormir(300); const w = await c.avaliar('document.documentElement.scrollWidth'); if (w > 320) ruins.push(`painel internacao (${aba}): ${w}`);
        }
        await c.clicarTexto('.leito--ocupado .leito-corpo', 'Exemplo'); await c.esperar('document.querySelector("dialog.modal[open]")'); await dormir(250);
        const w = await c.avaliar('document.documentElement.scrollWidth'); const larg = await c.avaliar('document.querySelector("dialog.modal[open]").getBoundingClientRect().width');
        if (w > 320 || larg > 320) ruins.push(`painel internacao (detalhe): página ${w}, diálogo ${larg}`);
        await c.avaliar('document.querySelectorAll("dialog.modal[open]").forEach(d => d.close())'); await dormir(100);
      }
    }
    if (!semVitrine) for (const p of ['index.html', 'sobre.html', 'contato.html']) {  // v1.0: Serviços é seção da inicial
      await c.navegar(base + p, 1800); const sw = await c.avaliar('document.documentElement.scrollWidth'); if (sw > 320) ruins.push(`${p}: ${sw}`);
    }
    await c.emular(1280, 800);
    assert.deepEqual(ruins, [], 'rolagem horizontal em 320px');
  });

  /* ---------- 5. importação (por último: o defeito antigo APAGAVA os cadastros e atrapalharia os outros passos) ---------- */
  await passo('5. importar arquivo hostil não apaga nada (valida tudo antes) e dá mensagem legível', async () => {
    const antes = (await lista('tutores')).length;
    const r = await c.avaliar(`(async () => { const st = Painel.ctx.store; const saidas = [];
      for (const d of [{ versao: 1, colecoes: { pets: [{ id: 'a' }], tutores: 'oops' } }, { versao: 1, colecoes: { pets: [null] } }, { versao: 1, colecoes: { pets: [{ nome: 'sem id' }] } },
        { versao: 1, colecoes: { tutores: [{ id: 'x' }, { id: 'x' }] } }, { versao: 1, colecoes: { usuarios: [{ id: 'u', perfil: 'dono' }] } }]) {
        try { await st.importar(d); saidas.push('aceitou'); } catch (e) { saidas.push(e.message); } }
      return saidas; })()`);
    assert.ok(r.every((m) => m !== 'aceitou' && /inválido|conta|identificador|registro/i.test(m)), 'aceitou ou mensagem estranha: ' + JSON.stringify(r));
    assert.equal((await lista('tutores')).length, antes, 'tutores foram apagados');
    assert.ok((await lista('pets')).length > 0, 'pets foram apagados');
  });
  await passo('5b. pela tela: arquivo inválido gera aviso e nada muda; arquivo bom pede confirmação e só então substitui', async () => {
    await irPara('config', 'Configurações');
    const antes = (await lista('tutores')).length;
    const enviar = (conteudo) => c.avaliar(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(conteudo)}], 'dados.json', { type: 'application/json' }));
      const i = document.getElementById('arquivo-import'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await enviar('{ isto não é json'); await c.esperar('document.querySelector(".toast-erro")');
    assert.match(await texto('.toast-erro'), /JSON válido/);
    await enviar(JSON.stringify({ versao: 1, colecoes: { pets: [{ id: 'a', nome: 'A' }, { id: 'a', nome: 'B' }] } })); await dormir(500);
    assert.match(await c.avaliar('[...document.querySelectorAll(".toast-erro")].map(e => e.textContent).join(" | ")'), /repete um identificador/);
    assert.equal((await lista('tutores')).length, antes);
    const dump = await c.avaliar('Painel.ctx.store.exportar()');
    await enviar(JSON.stringify(dump)); await abrirDialog();
    assert.match(await texto('dialog.modal[open] .modal-corpo'), /SUBSTITUI/); assert.ok((await contar('dialog.modal[open] .modal-corpo li')) >= 5);
    await botaoDialog('Cancelar'); assert.equal((await lista('tutores')).length, antes);
    await enviar(JSON.stringify(dump)); await abrirDialog(); await botaoDialog('Importar e substituir');
    await c.esperar('[...document.querySelectorAll(".toast")].some(t => /importados/.test(t.textContent))');
    assert.equal((await lista('tutores')).length, antes);
  });

  /* ---------- 17. IndexedDB ---------- */
  await passo('17. IndexedDB: banco criado antes de uma coleção existir ganha a coleção nova sem perder dados', async () => {
    await c.navegar(base + 'painel/app.html#/inicio', 600); await c.esperar('document.getElementById("titulo-tela")');
    const r = await c.avaliar(`(async () => {
      const nome = 'teste-migra-' + Date.now();
      await new Promise((res, rej) => { const rq = indexedDB.open(nome, 1); rq.onupgradeneeded = () => { rq.result.createObjectStore('tutores', { keyPath: 'id' }); }; rq.onsuccess = () => { rq.result.close(); res(); }; rq.onerror = () => rej(rq.error); });
      const extras = ['internacao'];
      const s0 = Store.criarStore(Store.adaptadorIndexedDB(nome, undefined, Store.COLECOES), []); await s0.salvar('tutores', { id: 'antigo', nome: 'Existia antes' });
      const s = Store.criarStore(Store.adaptadorIndexedDB(nome, undefined, Store.COLECOES.concat(extras)), extras);
      await s.salvar('internacao', { id: 'leito1', nome: 'Leito 1' }); await s.salvar('pets', { id: 'p', nome: 'Bidu' });
      return [(await s.listar('tutores')).map(t => t.id), (await s.listar('internacao')).length, (await s.listar('pets')).length]; })()`);
    assert.deepEqual(r, [['antigo'], 1, 1]);
  });

  /* ---------- 12. toggle falha fechada ---------- */
  await passo('12. toggle: só gestao === true abre; valor estranho ou site-config.js ausente mostra aviso claro (sem tela em branco)', async () => {
    const linhaModulos = semVitrine ? 'vitrine: false, gestao: true' : 'vitrine: true, gestao: true';
    for (const valor of ['false', '0', 'null', '"false"', '"true"', '1', 'undefined']) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toggle-')); fs.cpSync(pasta, tmp, { recursive: true });
      const arq = path.join(tmp, 'assets/site-config.js'); const orig = fs.readFileSync(arq, 'utf8'); assert.ok(orig.includes(linhaModulos));
      fs.writeFileSync(arq, orig.replace(linhaModulos, linhaModulos.replace('gestao: true', 'gestao: ' + valor)));
      const s2 = await servir(tmp);
      try {
        await c.navegar(s2.url + 'painel/', 400);
        assert.equal(await texto('h1'), 'Módulo de gestão não contratado', `gestao: ${valor} deixou o painel aberto`); assert.equal(await contar('input'), 0);
        await c.navegar(s2.url + 'painel/app.html', 400); assert.equal(await texto('h1'), 'Módulo de gestão não contratado', `app.html aberto com gestao: ${valor}`);
        if (!semVitrine) { await c.navegar(s2.url + 'index.html', 500); assert.equal(await contar('[data-modulo="gestao"]'), 0, `link do painel continua na vitrine com gestao: ${valor}`); }
      } finally { s2.fechar(); fs.rmSync(tmp, { recursive: true, force: true }); }
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'semconfig-')); fs.cpSync(pasta, tmp, { recursive: true }); fs.rmSync(path.join(tmp, 'assets/site-config.js'));
    const s3 = await servir(tmp); const antes = c.console.length;
    try {
      await c.navegar(s3.url + 'painel/', 500);
      assert.equal(await texto('h1'), 'Configuração do site não encontrada'); assert.match(await texto('main'), /site-config\.js/);
      assert.deepEqual(c.console.slice(antes).filter((x) => /EXCEÇÃO|TypeError/.test(x)), [], 'TypeError solto sem a configuração');
    } finally { s3.fechar(); fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  /* ---------- 6. material do cliente na vitrine ---------- */
  if (!semVitrine) await passo('6. fotos e valores do cliente (assets/material.js, em JS e várias linhas) aparecem na vitrine', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'material-')); fs.cpSync(pasta, tmp, { recursive: true });
    fs.mkdirSync(path.join(tmp, 'assets/img'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'assets/img/fachada.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#888"/></svg>');
    fs.writeFileSync(path.join(tmp, 'assets/material.js'), `window.SITE_CONFIG = window.SITE_CONFIG || {};
window.SITE_CONFIG.galeria = [
  { src: 'assets/img/fachada.svg', alt: 'Fachada da clínica', legenda: 'Entrada' },
];
window.SITE_CONFIG.precos = [
  { servico: 'Consulta',
    valor: 'R$ 100,00' },
];
`);
    const s2 = await servir(tmp);
    try {
      await c.navegar(s2.url + 'index.html', 800); assert.equal(await contar('.galeria img'), 1); assert.equal(await c.avaliar(`document.querySelector('.galeria img').alt`), 'Fachada da clínica');
      assert.equal(await contar('.tabela-precos tr'), 1); assert.match(await texto('.tabela-precos'), /R\$ 100,00/);  // v1.0: a tabela de preços é slot da inicial (não há servicos.html)
    } finally { s2.fechar(); fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  /* =====================================================================================================================
     v0.4 (site 3, hospital 24h). Os passos G valem para qualquer subtipo; os H, só para o hospital (módulo internacao).
     Cada um reproduz um defeito do painel v0.3 ou exercita a internação com perfil de recepção/veterinário e entrada hostil.
     ===================================================================================================================== */
  await passo('G1. URL com nome herdado do Object (#/constructor, #/__proto__, #/toString) não vira tela, não dá exceção e volta ao início', async () => {
    await irPara('inicio', 'Olá');
    const antes = c.console.length;
    for (const nome of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      await c.avaliar(`location.hash = '#/${nome}'`); await dormir(500);
      assert.equal(await c.avaliar('location.hash'), '#/inicio', `#/${nome} deveria voltar ao início`);
      assert.doesNotMatch(await c.avaliar('document.title'), /undefined/, `título depois de #/${nome}`);
      assert.ok(await c.avaliar('!!document.getElementById("titulo-tela")'), `tela em branco depois de #/${nome}`);
    }
    assert.deepEqual(c.console.slice(antes).filter((x) => /EXCEÇÃO|TypeError/.test(x)), [], 'exceção solta ao abrir rota com nome herdado');
  });
  await passo('G2. importar arquivo com id "__proto__"/"toString" ou campo de texto que não é texto é recusado pela tela e nada muda', async () => {
    await irPara('config', 'Configurações');
    const antes = (await lista('pets')).length;
    const casos = [[{ pets: [{ id: '__proto__', nome: 'X' }] }, /identificador não permitido/], [{ pets: [{ id: 'toString', nome: 'X' }] }, /identificador não permitido/],
      [{ tutores: [{ id: 'a', nome: 12345 }] }, /deveria ser texto/], [{ consultas: [{ id: 'a', inicio: { x: 1 } }] }, /deveria ser texto/]];
    for (const [colecoes, esperado] of casos) {
      await c.avaliar(`document.querySelectorAll('.toast').forEach(t => t.remove())`);
      await c.avaliar(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify({ versao: 1, colecoes }))}], 'd.json', { type: 'application/json' }));
        const i = document.getElementById('arquivo-import'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await c.esperar('document.querySelector(".toast-erro")');
      assert.match(await texto('.toast-erro'), esperado, JSON.stringify(colecoes));
      assert.equal((await lista('pets')).length, antes); assert.equal(await contar('dialog.modal[open]'), 0, 'abriu a confirmação de importação');
    }
  });
  await passo('G3. lembrete sem "chave" (arquivo ou banco adulterado) não impede exportar os dados do tutor', async () => {
    await c.avaliar(`Painel.ctx.store.salvar('lembretes', { id: 'sem-chave' })`);
    await irPara('tutores', 'Tutores e pets'); await c.clicarTexto('.aba', 'Tutores'); await dormir(200);
    await c.clicarTexto('.tabela tbody tr', S.tutores[0].nome); await abrirDialog();
    await c.avaliar('window.__baixado = null; UI.baixar = function (n, conteudo) { window.__baixado = conteudo; };');
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Exportar dados deste tutor'); await c.esperar('window.__baixado', 4000);
    assert.ok(JSON.parse(await c.avaliar('window.__baixado')).dados.tutor); await fecharDialogs();
    await c.avaliar(`Painel.ctx.store.remover('lembretes', 'sem-chave')`);
  });
  await passo('G4. mapas por id das telas não têm protótipo (id "constructor" ou "toString" não devolve função do Object)', async () => {
    const r = await c.avaliar(`(async () => { const st = Painel.ctx.store; await st.salvar('tutores', { id: 'toString', nome: 'Id esquisito' });
      const m = await Painel.ctx.mapa(['tutores', 'pets']); await st.remover('tutores', 'toString');
      return [Object.getPrototypeOf(m.tutores) === null, typeof m.tutores.constructor, typeof m.pets.hasOwnProperty, m.tutores.toString.nome]; })()`);
    assert.deepEqual(r, [true, 'undefined', 'undefined', 'Id esquisito']);
  });

  if (!diag) await passo('G5. profissional que assina prontuário ou vacina não pode ser excluído (o nome e o CRMV some das impressões)', async () => {
    const prof = JSON.parse(await c.avaliar(`(async () => JSON.stringify(await Painel.ctx.store.salvar('profissionais', { nome: 'Prof G5', funcao: 'Veterinário(a)', ativo: true, registro: 'CRMV 1' })))()`));
    await c.avaliar(`Painel.ctx.store.salvar('prontuarios', { petId: 'ex-pet-1', data: Regras.hojeISO(), queixa: 'g5', profissionalId: ${JSON.stringify(prof.id)} })`);
    await irPara('equipe', 'Profissionais e serviços'); await c.clicarTexto('.tabela tbody tr', 'Prof G5'); await abrirDialog();
    await botaoDialog('Excluir'); await abrirDialog(); await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir'); await dormir(400);
    assert.match(await texto('dialog.modal[open] .erro-form'), /prontuários/); await fecharDialogs();
    assert.ok((await lista('profissionais')).some((p) => p.id === prof.id), 'profissional com prontuário foi excluído');
  });

  if ((pc.modulos || []).includes('internacao')) {
    const criar = (col, o) => c.avaliar(`Painel.ctx.store.salvar(${JSON.stringify(col)}, ${JSON.stringify(o)})`);
    const lerCol = (col) => lista(col);
    const exportarTutor = async (nome) => {
      await irPara('tutores', 'Tutores e pets'); await c.clicarTexto('.aba', 'Tutores'); await dormir(200);
      await c.clicarTexto('.tabela tbody tr', nome); await abrirDialog();
      await c.avaliar('window.__baixado = null; UI.baixar = function (n, conteudo) { window.__baixado = conteudo; };');
      await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Exportar dados deste tutor'); await c.esperar('window.__baixado');
      const bruto = await c.avaliar('window.__baixado'); await fecharDialogs();
      return { arquivo: JSON.parse(bruto), bruto };
    };
    const tutorDoThor = S.tutores.find((t) => S.pets.some((p) => p.tutorId === t.id && p.id === 'ex-pet-3')).nome;

    const leitosRec = pc.matriz && pc.matriz.recepcao && pc.matriz.recepcao.internacao === 'r'; // opção recepcao_ve_leitos (v0.7)
    if (!leitosRec) await passo('H1. recepção não acessa Internação pela URL nem pelo Início, e o arquivo do tutor sai SEM internações e observações', async () => {
      await c.avaliar(`location.hash = '#/internacao'`); await dormir(500);
      assert.equal(await c.avaliar('location.hash'), '#/inicio');
      assert.doesNotMatch(await texto('.resumo-grade'), /Internados agora|plantão agora/);
      assert.equal(await contar('.lateral nav a[data-rota="internacao"]'), 0);
      const r = await exportarTutor(tutorDoThor);
      assert.equal(r.arquivo.dados.internacoes, undefined); assert.equal(r.arquivo.dados.evolucoes, undefined);
      assert.ok(r.arquivo.omitidos.includes('internacoes') && r.arquivo.omitidos.includes('evolucoes'), 'sem aviso do que foi omitido: ' + r.arquivo.omitidos);
      for (const e of S.evolucoes) assert.ok(!r.bruto.includes(e.texto), 'observação do plantão no arquivo da recepção');
      for (const i of S.internacoes) assert.ok(!r.bruto.includes(i.motivo), 'motivo da internação no arquivo da recepção');
      assert.ok(r.arquivo.dados.tutor && r.arquivo.dados.pets);
      await c.clicarTexto('.aba', 'Pets'); await dormir(200);
      await c.clicarTexto('.tabela tbody tr', 'Thor'); await abrirDialog();
      assert.ok(!(await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].map(b => b.textContent.trim())`)).includes('Internar'), 'recepção vê "Internar" na ficha do pet');
      await fecharDialogs();
    }, 'recep');

    /* ---------- L (v0.7): a recepção com a visão restrita da internação (opção recepcao_ve_leitos). Só roda quando o site liga a opção ---------- */
    if (leitosRec) {
      const apagarL = (col, id) => c.avaliar(`Painel.ctx.store.remover(${JSON.stringify(col)}, ${JSON.stringify(id)})`);
      const SEGREDOS = ['Observação após procedimento', 'Acompanhamento de hidratação', 'Monitoramento', 'Em observação', 'Requer atenção', 'Passagem de plantão', 'Entrou calmo', 'Uso reservado', 'Fluido de manutenção', 'Respiração acompanhada'];
      await passo('L1. recepção: o mapa de leitos traz leito, paciente, tutor e entrada, e NADA do clínico (nem no DOM); o arquivo do tutor leva a internação recortada, sem observações, e diz o que omitiu', async () => {
        await irParaFresco('internacao', 'Quem está em cada leito');
        const tela = await texto('.tela'), dom = await c.avaliar('document.body.innerHTML');
        for (const s of SEGREDOS) { assert.ok(!tela.includes(s) && !dom.includes(s), 'a recepção lê: ' + s); }
        assert.match(tela, /Thor \(/); assert.equal(await contar('.leito button, .tela-acoes button'), 0);
        const r = await exportarTutor(tutorDoThor);
        assert.ok(Array.isArray(r.arquivo.dados.internacoes) && r.arquivo.dados.internacoes.length >= 1, 'o arquivo da recepção deveria levar a internação recortada');
        for (const i of r.arquivo.dados.internacoes) assert.deepEqual(Object.keys(i).filter((k) => !['id', 'petId', 'leitoId', 'entradaEm', 'status', 'exemplo', 'criadoEm', 'atualizadoEm'].includes(k)), [], 'campo clínico no arquivo da recepção: ' + Object.keys(i));
        assert.equal(r.arquivo.dados.evolucoes, undefined); assert.ok(r.arquivo.omitidos.includes('evolucoes') && r.arquivo.omitidos.includes('internacao_clinica'), r.arquivo.omitidos.join(','));
        for (const e of S.evolucoes) assert.ok(!r.bruto.includes(e.texto), 'observação do plantão no arquivo da recepção');
        for (const i of S.internacoes) assert.ok(!r.bruto.includes(i.motivo) && !r.bruto.includes(i.situacao) , 'dado clínico no arquivo da recepção');
        // achado da revisão independente: o histórico (internação ENCERRADA) também é clínico; o arquivo da recepção só leva quem está internado agora
        const encerrada = S.internacoes.find((i) => i.status === 'encerrada'), tutorEncerrada = S.tutores.find((tt) => S.pets.some((p) => p.tutorId === tt.id && p.id === encerrada.petId)).nome;
        const r2 = await exportarTutor(tutorEncerrada);
        assert.ok(r2.arquivo.dados.internacoes.every((i) => i.id !== encerrada.id && i.status !== 'encerrada'), 'a internação encerrada saiu no arquivo da recepção'); assert.ok(!r2.bruto.includes(encerrada.motivo) && !r2.bruto.includes(encerrada.resumoSaida) && !r2.bruto.includes('"desfecho"'), 'histórico clínico no arquivo da recepção');
        await c.clicarTexto('.aba', 'Pets'); await dormir(200); await c.clicarTexto('.tabela tbody tr', 'Thor'); await abrirDialog();
        assert.ok(!(await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].map(b => b.textContent.trim())`)).includes('Internar'), 'recepção vê "Internar" na ficha do pet');
        await fecharDialogs();
      }, 'recep');
      await passo('L2. recepção: atalhos da URL (?aba=plantao, ?novo=1) não abrem plantão nem formulário; por URL ela não chega à escrita', async () => {
        for (const rota of ['internacao?aba=plantao', 'internacao?aba=internados', 'internacao?novo=1&pet=ex-pet-1']) {
          await c.avaliar(`location.hash = '#/${rota}'`); await dormir(600); await c.avaliar('Painel.ctx.atualizar()'); await dormir(400);
          assert.equal(await contar('dialog.modal[open]'), 0, rota + ': abriu diálogo'); assert.match(await texto('#titulo-tela'), /Quem está em cada leito/, rota);
          assert.equal(await contar('.abas [role="tab"], .tela-acoes button'), 0, rota); assert.ok(!(await texto('.tela')).includes('No plantão agora'), rota);
        }
      }, 'recep');
      await passo('L3. texto hostil (<img onerror>, <script>) em paciente, tutor e leito aparece como texto; internação de leito removido, sem pet ou com campo clínico novo não derruba nem vaza', async () => {
        const salvar = (col, o) => c.avaliar(`Painel.ctx.store.salvar(${JSON.stringify(col)}, ${JSON.stringify(o)})`);
        await c.avaliar('window.__l3 = 0');
        const t = await salvar('tutores', { nome: '<img src=x onerror="window.__l3=1">Tutor L3' }), p = await salvar('pets', { tutorId: t.id, nome: '<script>window.__l3=2</script>Pet L3', especie: 'Cão' });
        const leito = await salvar('leitos', { nome: '<img src=x onerror="window.__l3=3">Leito L3', ativo: true });
        const i1 = await salvar('internacoes', { petId: p.id, leitoId: leito.id, entradaEm: (await hojeISO()) + 'T02:00', status: 'internado', motivo: 'SEGREDO-L3', situacao: 'SEGREDO-L3', campoNovo: 'SEGREDO-L3' });
        const i2 = await salvar('internacoes', { petId: 'pet-que-nao-existe', leitoId: 'leito-que-nao-existe', entradaEm: (await hojeISO()) + 'T03:00', status: 'internado', motivo: 'SEGREDO-L3' });
        const o = await salvar('evolucoes', { internacaoId: i1.id, em: (await hojeISO()) + 'T02:30', tipo: 'Observação', texto: 'SEGREDO-L3 observação' });
        await irParaFresco('internacao', 'Quem está em cada leito');
        const tela = await texto('.tela'); assert.ok(tela.includes('<img src=x onerror') && tela.includes('<script>window.__l3=2</script>Pet L3'), 'o texto hostil precisa aparecer como texto');
        assert.equal(await c.avaliar('window.__l3'), 0, 'o texto hostil executou'); assert.ok(!(await c.avaliar('document.body.innerHTML')).includes('SEGREDO-L3'), 'dado clínico no DOM da recepção');
        for (const id of [o.id]) await apagarL('evolucoes', id);
        for (const id of [i1.id, i2.id]) await apagarL('internacoes', id);
        await apagarL('leitos', leito.id); await apagarL('pets', p.id); await apagarL('tutores', t.id);
      }, 'recep');
      await passo('L4. recepção: a busca por paciente, tutor ou leito filtra o mapa; sem resultado diz que não achou; uma internação encerrada em outra aba some do mapa depois de atualizar', async () => {
        await irParaFresco('internacao', 'Quem está em cada leito');
        const total = await contar('.leito');
        await c.avaliar(`(() => { const i = document.querySelector('.tela input'); i.value = 'Thor'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await dormir(300);
        assert.equal(await contar('.leito'), 1, 'a busca por Thor deveria deixar 1 leito (de ' + total + ')');
        await c.avaliar(`(() => { const i = document.querySelector('.tela input'); i.value = 'zzzz'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await dormir(300);
        assert.equal(await contar('.leito'), 0); assert.match(await texto('.tela'), /Nenhum leito encontrado/);
        const ints = await lerCol('internacoes'), thor = ints.find((i) => i.petId === 'ex-pet-3' && i.status !== 'encerrada');
        await c.avaliar(`Painel.ctx.store.salvar('internacoes', Object.assign({}, ${JSON.stringify(thor)}, { status: 'encerrada', saidaEm: Regras.agoraISO(), desfecho: 'Alta' }))`);
        await irParaFresco('internacao', 'Quem está em cada leito');
        assert.ok(!(await texto('.tela')).includes('Thor ('), 'o leito do Thor deveria estar livre'); assert.equal(await contar('.leito--ocupado'), (await lerCol('internacoes')).filter((i) => i.status !== 'encerrada').length);
        await c.avaliar(`Painel.ctx.store.salvar('internacoes', ${JSON.stringify(thor)})`); // devolve o exemplo como estava
      }, 'recep');
    }

    await passo('H2. veterinário: arquivo do tutor leva internações e observações (e não o caixa); não exclui internação, observação nem leito', async () => {
      const r = await exportarTutor(tutorDoThor);
      assert.ok(r.arquivo.dados.internacoes.length >= 1 && r.arquivo.dados.evolucoes.length >= 2); assert.equal(r.arquivo.dados.lancamentos, undefined);
      await irParaFresco('internacao', 'Internação e plantão');
      await c.clicarTexto('.leito--ocupado .leito-corpo', 'Thor'); await abrirDialog();
      const botoes = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].map(b => b.textContent.trim())`);
      assert.ok(botoes.includes('Registrar observação') && botoes.includes('Encerrar internação'), botoes.join(' | '));
      assert.ok(!botoes.includes('Excluir internação'), 'veterinário vê "Excluir internação"');
      assert.equal(await contar('dialog.modal[open] .observacoes .btn-perigo'), 0, 'veterinário vê "Excluir" na observação');
      await fecharDialogs();
      await c.clicarTexto('.leito .btn', 'Editar leito'); await abrirDialog();
      assert.equal(await contar('dialog.modal[open] .modal-rodape .btn-perigo'), 0, 'veterinário vê "Excluir" no leito'); await fecharDialogs();
    }, 'vet');

    await passo('H3. texto hostil (<script>, <img onerror>) em paciente, leito, motivo e observação aparece como texto e nada executa', async () => {
      await c.avaliar('window.__xss = undefined');
      const sujo = '<img src=x onerror="window.__xss=1">';
      const t = await criar('tutores', { nome: sujo + ' tutor', telefone: '(15) 99999-1111' });
      const pet = await criar('pets', { tutorId: t.id, nome: sujo + ' pet', especie: 'Cão' });
      const leito = await criar('leitos', { nome: '<script>window.__xss=2</script> leito', ativo: true });
      const int = await criar('internacoes', { petId: pet.id, leitoId: leito.id, entradaEm: await c.avaliar('Regras.agoraISO()'), motivo: '<b>negrito?</b> ' + sujo, status: 'internado', situacao: 'Estável' });
      await criar('evolucoes', { internacaoId: int.id, em: await c.avaliar('Regras.agoraISO()'), tipo: 'Observação', texto: '<script>window.__xss=3</script>' });
      await criar('plantoes', { profissionalId: 'ex-prof-1', inicio: await c.avaliar('Regras.agoraISO()'), fim: await c.avaliar(`Regras.somarDias(Regras.hojeISO(), 1) + 'T07:00'`), obs: sujo });
      await irParaFresco('internacao', 'Internação e plantão');
      for (const aba of ['Leitos', 'Internações', 'Plantão']) { await c.clicarTexto('.aba', aba); await dormir(300); }
      await c.clicarTexto('.aba', 'Leitos'); await dormir(300);
      await c.clicarTexto('.leito--ocupado .leito-corpo', '<img src=x'); await abrirDialog();
      assert.match(await texto('dialog.modal[open] .modal-corpo'), /<b>negrito\?<\/b>/); assert.match(await texto('dialog.modal[open] .observacoes'), /<script>window\.__xss=3<\/script>/);
      assert.equal(await contar('dialog.modal[open] img, dialog.modal[open] b, dialog.modal[open] script'), 0, 'o texto virou marcação');
      await fecharDialogs();
      assert.equal(await c.avaliar('window.__xss'), undefined, 'script executou'); assert.equal(await contar('.tela img, .tela script'), 0);
      await c.avaliar(`(async () => { const st = Painel.ctx.store; for (const col of ['evolucoes', 'internacoes', 'leitos', 'plantoes', 'pets', 'tutores']) for (const x of await st.listar(col)) if (/x onerror|__xss/.test(JSON.stringify(x))) await st.remover(col, x.id); })()`);
    });

    await passo('H4. outra pessoa ocupa o leito DEPOIS de o formulário abrir: salvar confere a lista atual e recusa', async () => {
      await irParaFresco('internacao', 'Internação e plantão');
      const livre = await c.avaliar(`(() => { const l = [...document.querySelectorAll('.leito:not(.leito--ocupado):not(.leito--inativo)')][0]; return l && l.getAttribute('data-leito'); })()`);
      assert.ok(livre, 'sem leito livre para o teste');
      await c.clicarTexto(`[data-leito="${livre}"] .leito-corpo`, 'Livre'); await abrirDialog();
      const petLivre = await c.avaliar(`(async () => { const ints = await Painel.ctx.store.listar('internacoes'); const ocup = new Set(ints.filter(i => i.status !== 'encerrada').map(i => i.petId));
        return (await Painel.ctx.store.listar('pets')).find(p => !ocup.has(p.id) && !p.falecido).id; })()`);
      await campo('petId', petLivre);
      const intruso = await criar('internacoes', { petId: 'outro-pet', leitoId: livre, entradaEm: await c.avaliar('Regras.agoraISO()'), status: 'internado' });
      await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Salvar'); await dormir(400);
      assert.match(await texto('dialog.modal[open] .erro-form'), /já está ocupado/);
      await fecharDialogs(); await c.avaliar(`Painel.ctx.store.remover('internacoes', ${JSON.stringify(intruso.id)})`);
    });

    await passo('H5. encerrar internação: saída antes da entrada é recusada; ao encerrar o leito fica livre e o pet pode ser marcado como falecido', async () => {
      const t = await criar('tutores', { nome: 'Tutor H5' }); const pet = await criar('pets', { tutorId: t.id, nome: 'Paciente H5', especie: 'Gato' });
      const leito = await criar('leitos', { nome: 'Leito H5', ativo: true });
      const agora = await c.avaliar('Regras.agoraISO()');
      const int = await criar('internacoes', { petId: pet.id, leitoId: leito.id, entradaEm: agora, status: 'internado', situacao: 'Estável', motivo: 'h5' });
      await irParaFresco('internacao', 'Internação e plantão');
      await c.clicarTexto('.leito--ocupado .leito-corpo', 'Paciente H5'); await abrirDialog();
      await botaoDialog('Encerrar internação'); await abrirDialog();
      assert.equal(await contar('dialog.modal[open] [name="falecido"]'), 0, 'a caixa "falecido" não existe mais: o desfecho Óbito decide');
      await campo('saidaEm', await c.avaliar(`Regras.somarDias(Regras.hojeISO(), -1) + 'T08:00'`)); await campo('desfecho', 'Alta'); await botaoDialog('Encerrar internação');
      assert.match(await texto('dialog.modal[open] .erro-form'), /antes da entrada/);
      await campo('saidaEm', await c.avaliar(`Regras.somarDias(Regras.hojeISO(), 1) + 'T08:00'`)); await campo('desfecho', 'Óbito');
      await botaoDialog('Encerrar internação'); await dormir(500); await fecharDialogs();
      const salva = (await lerCol('internacoes')).find((i) => i.id === int.id);
      assert.equal(salva.status, 'encerrada'); assert.equal(salva.desfecho, 'Óbito');
      assert.equal((await lerCol('pets')).find((p) => p.id === pet.id).falecido, true, 'Óbito deveria marcar o pet como falecido');
      // controle: com desfecho Alta o pet continua vivo
      const pet2 = await criar('pets', { tutorId: t.id, nome: 'Paciente H5b', especie: 'Cão' }); const leito2 = await criar('leitos', { nome: 'Leito H5b', ativo: true });
      await criar('internacoes', { petId: pet2.id, leitoId: leito2.id, entradaEm: await c.avaliar('Regras.agoraISO()'), status: 'internado', situacao: 'Estável' });
      await irParaFresco('internacao', 'Internação e plantão'); await c.clicarTexto('.leito--ocupado .leito-corpo', 'Paciente H5b'); await abrirDialog();
      await botaoDialog('Encerrar internação'); await abrirDialog(); await campo('saidaEm', await c.avaliar(`Regras.somarDias(Regras.hojeISO(), 1) + 'T09:00'`)); await campo('desfecho', 'Alta');
      await botaoDialog('Encerrar internação'); await dormir(500); await fecharDialogs();
      assert.ok(!(await lerCol('pets')).find((p) => p.id === pet2.id).falecido, 'Alta marcou o pet como falecido');
      await irParaFresco('internacao', 'Internação e plantão');
      assert.equal(await c.avaliar(`document.querySelector('[data-leito="${leito.id}"]').classList.contains('leito--ocupado')`), false, 'leito continua ocupado');
      // pet falecido não aparece na lista de pacientes para internar
      await c.clicarTexto(`[data-leito="${leito.id}"] .leito-corpo`, 'Livre'); await abrirDialog();
      assert.ok(!(await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] [name="petId"] option')].map(o => o.textContent).join('|')`)).includes('Paciente H5 ('), 'pet falecido na lista de internação'); // "Paciente H5b" (vivo) pode aparecer
      await fecharDialogs();
    });

    await passo('H6. dono exclui internação e as observações dela (cascata); excluir tutor leva as internações do pet junto', async () => {
      const t = await criar('tutores', { nome: 'Tutor H6' }); const pet = await criar('pets', { tutorId: t.id, nome: 'Paciente H6', especie: 'Cão' });
      const leito = await criar('leitos', { nome: 'Leito H6', ativo: true });
      const agora = await c.avaliar('Regras.agoraISO()');
      const i1 = await criar('internacoes', { petId: pet.id, leitoId: leito.id, entradaEm: agora, status: 'encerrada', saidaEm: agora, desfecho: 'Alta' });
      const i2 = await criar('internacoes', { petId: pet.id, leitoId: leito.id, entradaEm: agora, status: 'internado' });
      await criar('evolucoes', { internacaoId: i1.id, em: agora, texto: 'obs1' }); await criar('evolucoes', { internacaoId: i2.id, em: agora, texto: 'obs2' });
      // excluir só a internação encerrada pela tela
      await irParaFresco('internacao', 'Internação e plantão'); await c.clicarTexto('.aba', 'Internações'); await dormir(250);
      await c.clicarTexto('.chip-botao', 'Encerradas'); await dormir(250);
      await c.clicarTexto('.tabela tbody tr', 'Paciente H6'); await abrirDialog();
      await botaoDialog('Excluir internação'); await abrirDialog(); await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Excluir'); await dormir(500);
      assert.deepEqual((await lerCol('internacoes')).filter((i) => i.petId === pet.id).map((i) => i.id), [i2.id]);
      assert.deepEqual((await lerCol('evolucoes')).filter((e) => [i1.id, i2.id].includes(e.internacaoId)).map((e) => e.texto), ['obs2']);
      // excluir o tutor: some tudo do pet
      await irPara('tutores', 'Tutores e pets'); await c.clicarTexto('.aba', 'Tutores'); await dormir(200);
      await c.clicarTexto('.tabela tbody tr', 'Tutor H6'); await abrirDialog(); await botaoDialog('Excluir tutor e dados'); await abrirDialog();
      assert.match(await texto('dialog.modal[open] .modal-corpo'), /1 internação\(ões\)/);
      await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Excluir tudo'); await dormir(600);
      assert.equal((await lerCol('internacoes')).filter((i) => i.petId === pet.id).length, 0, 'internação do pet excluído ficou');
      assert.equal((await lerCol('evolucoes')).filter((e) => e.internacaoId === i2.id).length, 0, 'observação ficou sem internação');
    });

    await passo('H7. excluir só o pet também leva as internações e observações dele; profissional com internação não pode ser excluído', async () => {
      const t = await criar('tutores', { nome: 'Tutor H7' }); const pet = await criar('pets', { tutorId: t.id, nome: 'Paciente H7', especie: 'Cão' });
      const leito = await criar('leitos', { nome: 'Leito H7', ativo: true }); const agora = await c.avaliar('Regras.agoraISO()');
      const prof = await criar('profissionais', { nome: 'Prof H7', funcao: 'Veterinário(a)', ativo: true });
      const i = await criar('internacoes', { petId: pet.id, leitoId: leito.id, entradaEm: agora, status: 'internado', responsavelId: prof.id });
      await criar('evolucoes', { internacaoId: i.id, em: agora, texto: 'obs h7' });
      await irPara('equipe', 'Profissionais e serviços'); await c.clicarTexto('.tabela tbody tr', 'Prof H7'); await abrirDialog();
      await botaoDialog('Excluir'); await abrirDialog(); await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir'); await dormir(400);
      assert.match(await texto('dialog.modal[open] .erro-form'), /internações ou plantões/); await fecharDialogs();
      assert.ok((await lerCol('profissionais')).some((p) => p.id === prof.id), 'profissional com internação foi excluído');
      await irPara('tutores', 'Tutores e pets'); await c.clicarTexto('.aba', 'Pets'); await dormir(250);
      await c.clicarTexto('.tabela tbody tr', 'Paciente H7'); await abrirDialog(); await botaoDialog('Editar pet'); await abrirDialog();
      await botaoDialog('Excluir'); await abrirDialog(); await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir'); await dormir(600);
      assert.equal((await lerCol('internacoes')).filter((x) => x.petId === pet.id).length, 0); assert.equal((await lerCol('evolucoes')).filter((e) => e.internacaoId === i.id).length, 0);
    });

    await passo('H8. plantão: quem terminou o plantão (fim exclusivo) não aparece como "agora"; quem está no meio dele aparece no Início e abre a aba Plantão', async () => {
      const agora = await c.avaliar('Regras.agoraISO()');
      const prof = await criar('profissionais', { nome: 'Plantonista H8', funcao: 'Veterinário(a)', ativo: true });
      const ant = await criar('profissionais', { nome: 'Anterior H8', funcao: 'Veterinário(a)', ativo: true });
      await criar('plantoes', { profissionalId: ant.id, inicio: await c.avaliar(`Regras.somarDias(Regras.hojeISO(), -3) + 'T07:00'`), fim: await c.avaliar(`Regras.somarDias(Regras.hojeISO(), -2) + 'T07:00'`), obs: '' });
      await criar('plantoes', { profissionalId: prof.id, inicio: await c.avaliar(`Regras.somarDias(Regras.hojeISO(), -1) + 'T00:00'`), fim: await c.avaliar(`Regras.somarDias(Regras.hojeISO(), 2) + 'T23:00'`), obs: 'Passagem H8' });
      await irPara('inicio', 'Olá'); await c.avaliar('Painel.ctx.atualizar()'); await dormir(400); // a tela já podia estar aberta: redesenha com os plantões criados agora
      const cartao = await c.avaliar(`[...document.querySelectorAll('.resumo-card')].find(a => a.textContent.includes('No plantão agora')).textContent`);
      assert.match(cartao, /Plantonista H8/); assert.doesNotMatch(cartao, /Anterior H8/);
      await c.clicarTexto('.resumo-card', 'No plantão agora'); await c.esperar('document.getElementById("titulo-tela") && document.getElementById("titulo-tela").textContent.includes("Internação")'); await dormir(300);
      assert.equal(await c.avaliar(`document.querySelector('.aba[aria-selected="true"]').textContent.trim()`), 'Plantão');
      assert.match(await texto('.bloco'), /Plantonista H8/); assert.match(await texto('.bloco'), /Passagem H8/);
    });

    await passo('H9. IndexedDB com a configuração real do hospital: banco criado só com as coleções antigas ganha as do hospital sem perder dados', async () => {
      await c.navegar(base + 'painel/app.html#/inicio', 600); await c.esperar('document.getElementById("titulo-tela")');
      const r = await c.avaliar(`(async () => {
        const extras = SITE_CONFIG.painel.colecoesExtras, nome = 'teste-hospital-' + Date.now();
        const antigo = Store.criarStore(Store.adaptadorIndexedDB(nome, undefined, Store.COLECOES), []); await antigo.salvar('tutores', { id: 'antigo', nome: 'Já existia' });
        const s = Store.criarStore(Store.adaptadorIndexedDB(nome, undefined, Store.COLECOES.concat(extras)), extras);
        for (const col of extras) await s.salvar(col, { id: col + '-1', nome: 'x' });
        const tudo = await s.exportar();
        return [(await s.listar('tutores')).map(t => t.id), extras.map(c => tudo.colecoes[c].length), s.tem('internacoes')]; })()`);
      assert.deepEqual(r, [['antigo'], [1, 1, 1, 1], true]);
    });

    await passo('H10. exportar tudo e importar de volta (Configurações) funciona com as coleções do hospital', async () => {
      await irPara('config', 'Configurações');
      const dump = await c.avaliar('Painel.ctx.store.exportar()');
      for (const col of ['leitos', 'internacoes', 'evolucoes', 'plantoes']) assert.ok(Array.isArray(dump.colecoes[col]), col);
      const antes = (await lerCol('internacoes')).length;
      await c.avaliar(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify(dump))}], 'dados.json', { type: 'application/json' }));
        const i = document.getElementById('arquivo-import'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await abrirDialog();
      assert.match(await texto('dialog.modal[open] .modal-corpo'), /Internações: \d+ registro/); assert.match(await texto('dialog.modal[open] .modal-corpo'), /Leitos: \d+ registro/);
      await botaoDialog('Importar e substituir');
      await c.esperar('[...document.querySelectorAll(".toast")].some(t => /importados/.test(t.textContent))');
      assert.equal((await lerCol('internacoes')).length, antes);
    });

    await passo('H11. folha de passagem: só internados de agora (não as encerradas), com a última observação de cada um', async () => {
      await irParaFresco('internacao', 'Internação e plantão'); await c.clicarTexto('.aba', 'Plantão'); await dormir(250);
      const folha = await c.avaliar(`(() => { let n; const orig = UI.imprimir; UI.imprimir = (no) => { n = no.textContent; }; [...document.querySelectorAll('button')].find(b => b.textContent.includes('Imprimir folha')).click(); UI.imprimir = orig; return n; })()`);
      for (const i of S.internacoes.filter((x) => x.status !== 'encerrada')) assert.ok(folha.includes(S.pets.find((p) => p.id === i.petId).nome), 'faltou paciente internado: ' + i.id);
      const encerrada = S.internacoes.find((x) => x.status === 'encerrada');
      assert.ok(!folha.includes(encerrada.resumoSaida), 'a folha lista internação encerrada');
      assert.match(folha, /Folha de passagem de plantão/); assert.match(folha, /Documento interno da clínica/);
    });

    /* achados da revisão independente do hospital */
    const novaInternacao = async (rotulo) => {
      const t = await criar('tutores', { nome: 'Tutor ' + rotulo }); const pet = await criar('pets', { tutorId: t.id, nome: 'Paciente ' + rotulo, especie: 'Cão' });
      const leito = await criar('leitos', { nome: 'Leito ' + rotulo, ativo: true });
      const int = await criar('internacoes', { petId: pet.id, leitoId: leito.id, entradaEm: await c.avaliar('Regras.agoraISO()'), status: 'internado', situacao: 'Estável', motivo: rotulo });
      return { t, pet, leito, int };
    };
    await passo('H12. corrida: a internação mudou ou sumiu depois de o formulário abrir; salvar recusa em vez de reabrir, recriar ou deixar observação órfã', async () => {
      const a = await novaInternacao('H12a');
      await irParaFresco('internacao', 'Internação e plantão'); await c.clicarTexto('.leito--ocupado .leito-corpo', 'Paciente H12a'); await abrirDialog();
      await botaoDialog('Editar internação'); await abrirDialog();
      await c.avaliar(`Painel.ctx.store.salvar('internacoes', Object.assign({}, ${JSON.stringify(a.int)}, { status: 'encerrada', saidaEm: Regras.agoraISO(), desfecho: 'Alta' }))`);
      await campo('motivo', 'editado com a tela velha'); await botaoDialog('Salvar'); await dormir(400);
      assert.match(await texto('dialog.modal[open] .erro-form'), /já foi encerrada/); await fecharDialogs();
      const depois = (await lerCol('internacoes')).find((i) => i.id === a.int.id);
      assert.equal(depois.status, 'encerrada', 'a edição velha reabriu a internação'); assert.equal(depois.motivo, 'H12a', 'a edição velha sobrescreveu');
      const b = await novaInternacao('H12b');
      await irParaFresco('internacao', 'Internação e plantão'); await c.clicarTexto('.leito--ocupado .leito-corpo', 'Paciente H12b'); await abrirDialog();
      await botaoDialog('Registrar observação'); await abrirDialog();
      await c.avaliar(`Painel.ctx.store.remover('internacoes', ${JSON.stringify(b.int.id)})`);
      await campo('texto', 'observação que ficaria órfã'); await botaoDialog('Salvar'); await dormir(400);
      assert.match(await texto('dialog.modal[open] .erro-form'), /não existe mais/); await fecharDialogs();
      assert.equal((await lerCol('evolucoes')).filter((e) => e.internacaoId === b.int.id).length, 0, 'observação órfã gravada');
      const d = await novaInternacao('H12c');
      await irParaFresco('internacao', 'Internação e plantão'); await c.clicarTexto('.leito--ocupado .leito-corpo', 'Paciente H12c'); await abrirDialog();
      await botaoDialog('Encerrar internação'); await abrirDialog();
      await c.avaliar(`Painel.ctx.store.remover('internacoes', ${JSON.stringify(d.int.id)})`);
      await campo('saidaEm', await c.avaliar(`Regras.somarDias(Regras.hojeISO(), 1) + 'T09:00'`)); await botaoDialog('Encerrar internação'); await dormir(400);
      assert.match(await texto('dialog.modal[open] .erro-form'), /não existe mais/); await fecharDialogs();
      assert.equal((await lerCol('internacoes')).filter((i) => i.id === d.int.id).length, 0, 'a internação excluída foi recriada');
    });
    await passo('H13. excluir observação não empilha diálogos; botões repetidos têm nome acessível com contexto', async () => {
      const a = await novaInternacao('H13'); const agora = await c.avaliar('Regras.agoraISO()');
      await criar('evolucoes', { internacaoId: a.int.id, em: agora, tipo: 'Observação', texto: 'primeira' }); await criar('evolucoes', { internacaoId: a.int.id, em: await c.avaliar(`Regras.agoraISO().slice(0, 14) + '59'`), tipo: 'Observação', texto: 'segunda' });
      await irParaFresco('internacao', 'Internação e plantão');
      const nomes = await c.avaliar(`[...document.querySelectorAll('.leito .btn')].map(b => b.getAttribute('aria-label') || b.textContent.trim())`);
      assert.equal(new Set(nomes).size, nomes.length, 'botões "Editar leito" repetidos sem contexto: ' + nomes.slice(0, 4).join(' | '));
      await c.clicarTexto('.leito--ocupado .leito-corpo', 'Paciente H13'); await abrirDialog();
      const excl = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .observacoes .btn-perigo')].map(b => b.getAttribute('aria-label'))`);
      assert.equal(excl.length, 2); assert.ok(excl.every((n) => /^Excluir a observação de \d{2}\/\d{2}\/\d{4}/.test(n)), excl.join(' | '));
      await c.clicarTexto('dialog.modal[open] .observacoes .btn-perigo', 'Excluir'); await abrirDialog();
      await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir'); await dormir(700);
      assert.equal(await contar('dialog.modal[open]'), 1, 'diálogos empilhados depois de excluir a observação');
      assert.equal(await contar('dialog.modal[open] .observacoes li'), 1); await fecharDialogs();
    });
    await passo('H14. editar a internação sem mexer em nada mantém o responsável, mesmo desativado', async () => {
      const a = await novaInternacao('H14'); const prof = await criar('profissionais', { nome: 'Resp H14', funcao: 'Veterinário(a)', ativo: true });
      await criar('internacoes', Object.assign({}, a.int, { responsavelId: prof.id })); await criar('profissionais', Object.assign({}, prof, { ativo: false }));
      await irParaFresco('internacao', 'Internação e plantão'); await c.clicarTexto('.leito--ocupado .leito-corpo', 'Paciente H14'); await abrirDialog();
      await botaoDialog('Editar internação'); await abrirDialog();
      assert.equal(await c.avaliar(`document.querySelector('dialog.modal[open] [name="responsavelId"]').value`), prof.id, 'responsável desativado sumiu da lista');
      await botaoDialog('Salvar'); await dormir(400); await fecharDialogs();
      assert.equal((await lerCol('internacoes')).find((i) => i.id === a.int.id).responsavelId, prof.id, 'o responsável foi apagado ao salvar sem mexer');
    });
    await passo('H15. arquivo com entrada numérica ou duas internações no mesmo leito é recusado pela tela (a tela de Internação nunca quebra por dado importado)', async () => {
      await irPara('config', 'Configurações'); const antes = (await lerCol('internacoes')).length;
      for (const [colecoes, esperado] of [[{ internacoes: [{ id: 'z1', petId: 'p', leitoId: 'l', entradaEm: 1234 }] }, /deveria ser texto/],
        [{ internacoes: [{ id: 'z1', petId: 'p', leitoId: 'l', entradaEm: '2026-10-22T08:00' }, { id: 'z2', petId: 'q', leitoId: 'l', entradaEm: '2026-10-22T09:00' }] }, /duas internações ativas/]]) {
        await c.avaliar(`document.querySelectorAll('.toast').forEach(t => t.remove())`);
        await c.avaliar(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify({ versao: 1, colecoes }))}], 'd.json', { type: 'application/json' }));
          const i = document.getElementById('arquivo-import'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await c.esperar('document.querySelector(".toast-erro")'); assert.match(await texto('.toast-erro'), esperado);
      }
      assert.equal((await lerCol('internacoes')).length, antes);
      await irParaFresco('internacao', 'Internação e plantão'); assert.ok(await c.avaliar(`!!document.querySelector('.leitos')`));
    });
    await passo('H16. "Carregar dados de exemplo" de novo não reabre nada (avisa que já estão carregados)', async () => {
      await irPara('config', 'Configurações'); const antes = JSON.stringify((await lerCol('internacoes')).map((i) => [i.id, i.status]).sort());
      await c.clicarTexto('button', 'Carregar dados de exemplo'); await c.esperar('[...document.querySelectorAll(".toast")].some(t => /já estão carregados/.test(t.textContent))');
      assert.equal(JSON.stringify((await lerCol('internacoes')).map((i) => [i.id, i.status]).sort()), antes);
    });
  }

  /* ---------- I. centro de diagnóstico: exames e laudos (v0.5). Cada passo é independente; os dados que criam saem no fim ---------- */
  if (diag) {
    const criar = (col, o) => c.avaliar(`Painel.ctx.store.salvar(${JSON.stringify(col)}, ${JSON.stringify(o)})`);
    const obter = (col, id) => c.avaliar(`Painel.ctx.store.obter(${JSON.stringify(col)}, ${JSON.stringify(id)})`);
    const apagar = (col, id) => c.avaliar(`Painel.ctx.store.remover(${JSON.stringify(col)}, ${JSON.stringify(id)})`);
    const agoraISO = () => c.avaliar('Regras.agoraISO()');
    const SEGREDO = /Texto fictício de laudo|Indicação fictícia|LAUDO-SECRETO|INDICACAO-SECRETA/;
    const abrirExame = async (filtro, pet) => {
      await irParaFresco('exames', 'Exames e laudos'); await c.clicarTexto('.chip-botao', filtro); await dormir(250);
      await c.clicarTexto('.tabela tbody tr', pet); await abrirDialog();
    };

    await passo('I1. recepção: "laudos", Prontuários e Vacinas não são telas (URL volta ao início) e nenhum exame, em nenhuma situação, mostra indicação ou laudo', async () => {
      for (const rota of ['laudos', 'prontuarios', 'vacinas', 'internacao', 'constructor']) {
        await c.avaliar(`location.hash = '#/${rota}'`); await dormir(500); assert.equal(await c.avaliar('location.hash'), '#/inicio', rota);
      }
      await irParaFresco('exames', 'Exames e laudos'); await c.clicarTexto('.chip-botao', 'Todos'); await dormir(250);
      const n = await contar('.tabela tbody tr'); assert.ok(n >= 8);
      for (let i = 1; i <= n; i++) {
        await c.avaliar(`document.querySelector('.tabela tbody tr:nth-child(${i})').click()`); await abrirDialog();
        assert.doesNotMatch(await c.avaliar('document.body.textContent'), SEGREDO, 'exame ' + i); assert.equal(await contar('dialog.modal[open] .laudo-texto'), 0); await fecharDialogs();
      }
      const brutoMapa = await c.avaliar(`(async () => JSON.stringify((await Painel.ctx.mapa(['exames'])).exames_lista.length))()`); assert.ok(Number(brutoMapa) >= 8); // o dado existe no armazenamento; a tela é que não o mostra (barreira de interface, dito no README)
    }, 'recep');

    await passo('I2. texto hostil (<img onerror>, <script>) em exame, laudo, indicação, entrega, encaminhador e exame do catálogo aparece como texto e nada executa', async () => {
      await c.avaliar('window.__xss = undefined');
      const sujo = '<img src=x onerror="window.__xss=1">', agora = await agoraISO();
      const t = await criar('tutores', { nome: sujo + ' tutor', telefone: '(15) 99999-1111' }), pet = await criar('pets', { tutorId: t.id, nome: sujo + ' pet', especie: 'Cão' });
      const enc = await criar('encaminhadores', { nome: '<script>window.__xss=2</script> clínica', tipo: sujo, ativo: true }), srv = await criar('servicos', { nome: '<b>exame</b> ' + sujo, duracaoMin: 30, ativo: true });
      const dia = await hojeISO();
      await criar('exames', { petId: pet.id, servicoId: srv.id, encaminhadorId: enc.id, status: 'entregue', consultaId: '', solicitadoEm: dia + 'T01:00', realizadoEm: dia + 'T02:00', laudoEm: dia + 'T03:00', laudoPorId: 'ex-prof-1', entregueEm: dia + 'T04:00',
        indicacao: '<script>window.__xss=3</script>', laudo: '<b>negrito?</b> ' + sujo, entregaVia: sujo, obs: sujo });
      await irParaFresco('exames', 'Exames e laudos'); await c.clicarTexto('.chip-botao', 'Todos'); await dormir(250);
      await c.clicarTexto('.tabela tbody tr', '<img src=x'); await abrirDialog();
      assert.match(await texto('dialog.modal[open] .modal-corpo'), /<b>negrito\?<\/b>/); assert.equal(await contar('dialog.modal[open] img, dialog.modal[open] b, dialog.modal[open] script'), 0, 'o texto virou marcação'); await fecharDialogs();
      await irParaFresco('encaminhadores', 'Encaminhadores'); await irParaFresco('equipe', 'Profissionais e'); await irParaFresco('tutores', 'Tutores e pets'); await c.clicarTexto('.aba', 'Pets'); await dormir(200);
      assert.equal(await c.avaliar('window.__xss'), undefined, 'script executou'); assert.equal(await contar('.tela img, .tela script'), 0);
      await c.avaliar(`(async () => { const st = Painel.ctx.store; for (const col of ['exames', 'encaminhadores', 'servicos', 'pets', 'tutores']) for (const x of await st.listar(col)) if (/x onerror|__xss/.test(JSON.stringify(x))) await st.remover(col, x.id); })()`);
    });

    await passo('I3. corrida: a recepção abre a edição e outra aba entrega, altera o laudo ou exclui o exame; salvar parte do registro ATUAL (nada volta atrás, o laudo não some) e recusa o exame excluído', async () => {
      const dia = await hojeISO();
      const base = { petId: 'ex-pet-3', servicoId: 'ex-serv-1', status: 'laudado', consultaId: '', solicitadoEm: dia + 'T01:00', realizadoEm: dia + 'T02:00', laudoEm: dia + 'T03:00', laudoPorId: 'ex-prof-1', laudo: 'LAUDO-SECRETO v1', indicacao: 'INDICACAO-SECRETA', obs: '', exemplo: false };
      const a = await criar('exames', { ...base }), b = await criar('exames', { ...base, petId: 'ex-pet-4' });
      // recepção: abre a edição do exame "a" pelo detalhe
      await c.avaliar(`Painel.ctx.navegar('exames', { ver: ${JSON.stringify(a.id)} })`); await abrirDialog();
      await botaoDialog('Editar'); await abrirDialog();
      await c.avaliar(`(async () => { const st = Painel.ctx.store; const x = await st.obter('exames', ${JSON.stringify(a.id)}); await st.salvar('exames', Object.assign({}, x, { status: 'entregue', entregueEm: '${dia}T05:00', entregaVia: 'na recepção', laudo: 'LAUDO-SECRETO v2' })); })()`);
      await campo('obs', 'obs da recepção'); await botaoDialog('Salvar'); await dormir(500);
      const depois = await obter('exames', a.id);
      assert.equal(depois.obs, 'obs da recepção'); assert.equal(depois.status, 'entregue', 'a edição desfez a entrega feita em outra aba'); assert.equal(depois.laudo, 'LAUDO-SECRETO v2', 'a edição voltou o laudo ou o apagou'); assert.equal(depois.indicacao, 'INDICACAO-SECRETA');
      await fecharDialogs();
      // exame excluído em outra aba: salvar recusa e não recria
      await c.avaliar(`Painel.ctx.navegar('exames', { ver: ${JSON.stringify(b.id)} })`); await abrirDialog(); await botaoDialog('Editar'); await abrirDialog();
      await apagar('exames', b.id); await campo('obs', 'x'); await botaoDialog('Salvar');
      assert.match(await texto('dialog.modal[open] .erro-form'), /excluído em outra aba/); assert.equal(await obter('exames', b.id), null, 'recriou o exame excluído'); await fecharDialogs();
      await apagar('exames', a.id);
    }, 'recep');

    await passo('I4. corrida: o exame mudou de situação depois de o detalhe abrir; o passo é conferido contra o registro atual e recusado (sem desfazer o que outra pessoa fez)', async () => {
      const dia = await hojeISO();
      const e = await criar('exames', { petId: 'ex-pet-3', servicoId: 'ex-serv-1', status: 'solicitado', consultaId: '', solicitadoEm: dia + 'T01:00' });
      await c.avaliar(`Painel.ctx.navegar('exames', { ver: ${JSON.stringify(e.id)} })`); await abrirDialog();
      await c.avaliar(`(async () => { const st = Painel.ctx.store; const x = await st.obter('exames', ${JSON.stringify(e.id)}); await st.salvar('exames', Object.assign({}, x, { status: 'entregue', realizadoEm: '${dia}T02:00', laudoEm: '${dia}T03:00', laudoPorId: 'ex-prof-1', entregueEm: '${dia}T04:00' })); })()`);
      await botaoDialog('Cancelar exame'); await abrirDialog(); await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Confirmar'); await c.esperar('document.querySelector(".toast-erro")');
      assert.match(await texto('.toast-erro'), /não é permitida/); assert.equal((await obter('exames', e.id)).status, 'entregue', 'cancelou um exame já entregue'); await fecharDialogs();
      await apagar('exames', e.id);
    }, 'recep');

    await passo('I5. remarcar: o horário novo da agenda substitui o antigo e a consulta antiga ativa é cancelada; horário já perdido só é trocado', async () => {
      const dia = await hojeISO(), em3 = await c.avaliar('Regras.somarDias(Regras.hojeISO(), 3)');
      const antes = await obter('exames', 'ex-exa-5'); assert.equal(antes.consultaId, 'ex-cons-5');
      await abrirExame('Agendados', S.pets[4].nome); await botaoDialog('Remarcar na agenda');
      await c.esperar('document.querySelector(\'dialog.modal[open] [name="petId"]\')'); await dormir(250);
      assert.equal(await c.avaliar(`document.querySelector('dialog.modal[open] [name="petId"]').value`), 'ex-pet-5');
      await campo('profissionalId', 'ex-prof-2'); await campo('data', em3); await campo('hora', '15:00'); await botaoDialog('Salvar'); await dormir(700);
      const depois = await obter('exames', 'ex-exa-5'); assert.notEqual(depois.consultaId, 'ex-cons-5'); assert.equal(depois.status, 'agendado');
      assert.equal((await obter('consultas', 'ex-cons-5')).status, 'cancelada', 'o horário antigo continuou ativo na agenda'); assert.equal((await obter('consultas', depois.consultaId)).inicio, em3 + 'T15:00');
      const perdido = await obter('exames', 'ex-exa-8'); assert.equal(perdido.consultaId, 'ex-cons-7');
      await abrirExame('Para agendar', S.pets[0].nome); assert.match(await texto('dialog.modal[open] .modal-corpo'), /Horário cancelado: remarcar/); await fecharDialogs(); void dia;
    });

    await passo('I6. cascatas e bloqueios: excluir tutor ou pet leva os exames (e laudos) deles e só deles; profissional que laudou e exame do catálogo em uso não se excluem', async () => {
      const dia = await hojeISO();
      const t = await criar('tutores', { nome: 'Tutor Cascata', telefone: '(15) 99999-2222' }), p1 = await criar('pets', { tutorId: t.id, nome: 'Pet Um', especie: 'Cão' }), p2 = await criar('pets', { tutorId: t.id, nome: 'Pet Dois', especie: 'Gato' });
      const ex = (pet) => ({ petId: pet, servicoId: 'ex-serv-1', status: 'solicitado', consultaId: '', solicitadoEm: dia + 'T01:00' });
      const e1 = await criar('exames', ex(p1.id)), e2 = await criar('exames', ex(p2.id));
      await irParaFresco('tutores', 'Tutores e pets'); await c.clicarTexto('.aba', 'Pets'); await dormir(200);
      await c.clicarTexto('.tabela tbody tr', 'Pet Um'); await abrirDialog(); await botaoDialog('Editar pet'); await abrirDialog();
      await botaoDialog('Excluir'); await c.esperar('document.querySelectorAll("dialog.modal[open]").length === 2');
      assert.match(await texto('dialog.modal[open]:last-of-type .modal-corpo'), /exames e laudos/); await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir'); await dormir(600); await fecharDialogs();
      assert.equal(await obter('exames', e1.id), null, 'o exame do pet excluído ficou'); assert.ok(await obter('exames', e2.id), 'excluir um pet levou o exame de outro');
      await irParaFresco('tutores', 'Tutores e pets'); await c.clicarTexto('.aba', 'Tutores'); await dormir(200);
      await c.clicarTexto('.tabela tbody tr', 'Tutor Cascata'); await abrirDialog(); await botaoDialog('Excluir tutor e dados'); await c.esperar('document.querySelectorAll("dialog.modal[open]").length >= 1'); await dormir(200);
      assert.match(await texto('dialog.modal[open]:last-of-type .modal-corpo'), /1 exame\(s\) com laudos/); await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir tudo'); await dormir(700);
      assert.equal(await obter('exames', e2.id), null, 'excluir o tutor deixou o exame do pet'); assert.ok(await obter('exames', 'ex-exa-1'), 'excluir um tutor levou exames de outro');
      await irParaFresco('equipe', 'Profissionais e');
      await c.clicarTexto('.tabela tbody tr', 'Dr. Paulo Exemplo'); await abrirDialog(); await botaoDialog('Excluir'); await c.esperar('document.querySelectorAll("dialog.modal[open]").length === 2'); await dormir(100);
      await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir'); await dormir(500);
      assert.match(await texto('dialog.modal[open] .erro-form'), /exames/); await fecharDialogs();
      await c.clicarTexto('.tabela tbody tr', 'Tomografia'); await abrirDialog(); await botaoDialog('Excluir'); await c.esperar('document.querySelectorAll("dialog.modal[open]").length === 2'); await dormir(100);
      await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir'); await dormir(500);
      assert.match(await texto('dialog.modal[open] .erro-form'), /Há exames registrados com este serviço/); await fecharDialogs();
    });

    await passo('I7. exportar tudo e importar de volta funciona com exames e encaminhadores; arquivo com situação desconhecida ou laudo que não é texto é recusado e nada muda', async () => {
      await irPara('config', 'Configurações');
      const dump = await c.avaliar('Painel.ctx.store.exportar()'); for (const col of ['exames', 'encaminhadores']) assert.ok(Array.isArray(dump.colecoes[col]), col);
      const antes = (await lista('exames')).length;
      const importar = (obj) => c.avaliar(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify(obj))}], 'd.json', { type: 'application/json' }));
        const i = document.getElementById('arquivo-import'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await importar(dump); await abrirDialog(); assert.match(await texto('dialog.modal[open] .modal-corpo'), /Exames e laudos: \d+ registro/); assert.match(await texto('dialog.modal[open] .modal-corpo'), /Encaminhadores: \d+ registro/);
      await botaoDialog('Importar e substituir'); await c.esperar('[...document.querySelectorAll(".toast")].some(t => /importados/.test(t.textContent))'); assert.equal((await lista('exames')).length, antes);
      for (const [colecoes, esperado] of [[{ exames: [{ id: 'z1', petId: 'p', servicoId: 's', status: 'voando', solicitadoEm: '2026-10-22T08:00' }] }, /situação desconhecida/], [{ exames: [{ id: 'z1', petId: 'p', servicoId: 's', status: 'solicitado', laudo: 1234 }] }, /deveria ser texto/]]) {
        await c.avaliar(`document.querySelectorAll('.toast').forEach(t => t.remove())`); await importar({ versao: 1, colecoes });
        await c.esperar('document.querySelector(".toast-erro")'); assert.match(await texto('.toast-erro'), esperado);
      }
      assert.equal((await lista('exames')).length, antes);
      await irParaFresco('exames', 'Exames e laudos'); assert.equal(await contar('.tabela'), 1);
    });

    await passo('I8. IndexedDB com a configuração real do centro: banco criado só com as coleções antigas ganha exames e encaminhadores sem perder dados', async () => {
      await c.navegar(srv.url + 'painel/app.html#/inicio', 600); await c.esperar('document.getElementById("titulo-tela")');
      const r = await c.avaliar(`(async () => {
        const extras = SITE_CONFIG.painel.colecoesExtras, nome = 'teste-diag-' + Date.now();
        const antigo = Store.criarStore(Store.adaptadorIndexedDB(nome, undefined, Store.COLECOES), []); await antigo.salvar('tutores', { id: 'antigo', nome: 'Já existia' });
        const s = Store.criarStore(Store.adaptadorIndexedDB(nome, undefined, Store.COLECOES.concat(extras)), extras);
        for (const col of extras) await s.salvar(col, { id: col + '-1', nome: 'x' });
        const tudo = await s.exportar();
        return [(await s.listar('tutores')).map(t => t.id), extras.map(c => tudo.colecoes[c].length), s.tem('exames')]; })()`);
      assert.deepEqual(r, [['antigo'], [1, 1], true]);
    });

    /* ---- achados da revisão independente do módulo de exames (v0.5): cada um reprova no módulo antes da correção ---- */
    await passo('I10. "Marcar na agenda" com o exame já realizado em outra aba: recusa, não desfaz a realização e cancela o horário recém-marcado (nada de horário ativo sem exame)', async () => {
      const dia = await hojeISO(), em4 = await c.avaliar('Regras.somarDias(Regras.hojeISO(), 4)');
      const e = await criar('exames', { petId: 'ex-pet-3', servicoId: 'ex-serv-1', status: 'solicitado', consultaId: '', solicitadoEm: dia + 'T01:00' });
      await c.avaliar(`Painel.ctx.navegar('agenda', { exame: ${JSON.stringify(e.id)} })`); await c.esperar('document.querySelector(\'dialog.modal[open] [name="petId"]\')'); await dormir(250);
      assert.equal(await c.avaliar(`document.querySelector('dialog.modal[open] [name="petId"]').disabled`), true, 'o paciente do horário de um exame não pode trocar');
      assert.equal(await c.avaliar('location.hash'), '#/agenda', 'o atalho ficou no endereço da página');
      await c.avaliar(`(async () => { const st = Painel.ctx.store; const x = await st.obter('exames', ${JSON.stringify(e.id)}); await st.salvar('exames', Object.assign({}, x, { status: 'realizado', realizadoEm: '${dia}T02:00', responsavelId: 'ex-prof-1' })); })()`);
      await campo('profissionalId', 'ex-prof-1'); await campo('data', em4); await campo('hora', '08:00'); await botaoDialog('Salvar'); await c.esperar('document.querySelector(".toast-erro")');
      assert.match(await texto('.toast-erro'), /mudou em outra aba/);
      const depois = await obter('exames', e.id); assert.equal(depois.status, 'realizado'); assert.equal(depois.realizadoEm, dia + 'T02:00'); assert.equal(depois.responsavelId, 'ex-prof-1');
      const novas = (await lista('consultas')).filter((x) => x.inicio === em4 + 'T08:00'); assert.ok(novas.length >= 1 && novas.every((x) => x.status === 'cancelada'), 'o horário novo ficou ativo sem exame');
      await apagar('exames', e.id);
    });

    await passo('I11. edição geral por dono/veterinário com o formulário velho: o laudo escrito em outra aba não é apagado; campo mudado dos dois lados recusa', async () => {
      const dia = await hojeISO();
      const e = await criar('exames', { petId: 'ex-pet-3', servicoId: 'ex-serv-1', status: 'realizado', consultaId: '', solicitadoEm: dia + 'T01:00', realizadoEm: dia + 'T02:00', responsavelId: 'ex-prof-1', laudo: '', indicacao: 'ind', obs: '' });
      const escreverLaudoEmOutraAba = (txt) => c.avaliar(`(async () => { const st = Painel.ctx.store; const x = await st.obter('exames', ${JSON.stringify(e.id)}); await st.salvar('exames', Object.assign({}, x, { status: 'laudado', laudoEm: '${dia}T03:00', laudoPorId: 'ex-prof-2', laudo: ${JSON.stringify(txt)} })); })()`);
      await c.avaliar(`Painel.ctx.navegar('exames', { ver: ${JSON.stringify(e.id)} })`); await abrirDialog(); await botaoDialog('Editar'); await abrirDialog();
      await escreverLaudoEmOutraAba('LAUDO DO COLEGA'); await campo('obs', 'ajuste meu'); await botaoDialog('Salvar'); await dormir(500);
      const a = await obter('exames', e.id); assert.equal(a.obs, 'ajuste meu'); assert.equal(a.laudo, 'LAUDO DO COLEGA', 'o formulário velho apagou o laudo'); assert.equal(a.status, 'laudado'); await fecharDialogs();
      await c.avaliar(`Painel.ctx.navegar('exames', { ver: ${JSON.stringify(e.id)} })`); await abrirDialog(); await botaoDialog('Editar'); await abrirDialog();
      await c.avaliar(`(async () => { const st = Painel.ctx.store; const x = await st.obter('exames', ${JSON.stringify(e.id)}); await st.salvar('exames', Object.assign({}, x, { laudo: 'LAUDO REVISTO PELO COLEGA' })); })()`);
      await campo('laudo', 'MEU TEXTO'); await botaoDialog('Salvar'); await dormir(400);
      assert.match(await texto('dialog.modal[open] .erro-form'), /"Laudo" foi alterado em outra aba/); assert.equal((await obter('exames', e.id)).laudo, 'LAUDO REVISTO PELO COLEGA'); await fecharDialogs();
      await apagar('exames', e.id);
    }, 'vet');

    await passo('I12. editar o horário de um exame na agenda: o paciente e o exame não mudam (senão "Desmarcar" cancelaria a consulta de outro animal) e salvar parte do horário atual', async () => {
      const dia = await hojeISO(), em5 = await c.avaliar('Regras.somarDias(Regras.hojeISO(), 5)');
      const cons = await criar('consultas', { petId: 'ex-pet-2', tutorId: 'ex-tut-1', profissionalId: 'ex-prof-1', servicoId: 'ex-serv-1', inicio: em5 + 'T14:00', duracaoMin: 30, status: 'agendada', motivo: 'Exame: teste' });
      const e = await criar('exames', { petId: 'ex-pet-2', servicoId: 'ex-serv-1', status: 'agendado', consultaId: cons.id, solicitadoEm: dia + 'T01:00' });
      await c.avaliar(`location.hash = '#/agenda?dia=${em5}'`); await dormir(600); await c.esperar('document.querySelector(".bloco-consulta")');
      await c.clicarTexto('.bloco-consulta', S.pets[1].nome); await abrirDialog(); await botaoDialog('Editar'); await abrirDialog();
      assert.equal(await c.avaliar(`document.querySelector('dialog.modal[open] [name="petId"]').disabled`), true); assert.equal(await c.avaliar(`document.querySelector('dialog.modal[open] [name="servicoId"]').disabled`), true);
      await c.avaliar(`(async () => { const st = Painel.ctx.store; const x = await st.obter('consultas', ${JSON.stringify(cons.id)}); await st.salvar('consultas', Object.assign({}, x, { status: 'cancelada' })); })()`); // outra aba cancelou
      await campo('hora', '15:30'); await botaoDialog('Salvar'); await dormir(600);
      const depois = await obter('consultas', cons.id); assert.equal(depois.inicio, em5 + 'T15:30'); assert.equal(depois.status, 'cancelada', 'a edição velha devolveu o status antigo'); assert.equal(depois.petId, 'ex-pet-2');
      await fecharDialogs(); await apagar('exames', e.id); await apagar('consultas', cons.id);
    });

    await passo('I13. atalhos do endereço (?ver=, ?exame=, ?pet=) são consumidos: atualizar a tela não reabre o detalhe nem o formulário; ?dia= com texto é ignorado', async () => {
      await c.avaliar(`location.hash = '#/exames?ver=ex-exa-1'`); await abrirDialog(); assert.equal(await c.avaliar('location.hash'), '#/exames'); await fecharDialogs();
      await c.avaliar('Painel.ctx.atualizar()'); await dormir(500); assert.equal(await contar('dialog.modal[open]'), 0, 'o detalhe reabriu');
      await c.avaliar(`location.hash = '#/agenda?pet=ex-pet-1'`); await abrirDialog(); assert.equal(await c.avaliar('location.hash'), '#/agenda'); await fecharDialogs();
      await c.avaliar('Painel.ctx.atualizar()'); await dormir(500); assert.equal(await contar('dialog.modal[open]'), 0, 'o formulário da agenda reabriu');
      await c.avaliar(`location.hash = '#/agenda?dia=%3Cscript%3E'`); await dormir(600);
      assert.doesNotMatch(await texto('.data-hoje'), /script|undefined/); await irPara('inicio', 'Olá');
    });

    await passo('I14. excluir um exame agendado cancela o horário dele na agenda; desfazer a realização reabre a consulta concluída', async () => {
      const dia = await hojeISO(), em6 = await c.avaliar('Regras.somarDias(Regras.hojeISO(), 6)');
      const cons = await criar('consultas', { petId: 'ex-pet-2', tutorId: 'ex-tut-1', profissionalId: 'ex-prof-1', servicoId: 'ex-serv-1', inicio: em6 + 'T10:00', duracaoMin: 30, status: 'agendada', motivo: 'Exame: teste' });
      const e = await criar('exames', { petId: 'ex-pet-2', servicoId: 'ex-serv-1', status: 'agendado', consultaId: cons.id, solicitadoEm: dia + 'T01:00' });
      await c.avaliar(`Painel.ctx.navegar('exames', { ver: ${JSON.stringify(e.id)} })`); await abrirDialog();
      await botaoDialog('Registrar realização'); await abrirDialog(); await campo('realizadoEm', dia + 'T23:00'); await botaoDialog('Registrar realização'); await c.esperar('document.querySelector("dialog.modal[open] .dl-ficha")'); await dormir(300);
      assert.equal((await obter('consultas', cons.id)).status, 'concluida');
      await botaoDialog('Desfazer a realização'); await dormir(300); await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Confirmar'); await c.esperar('document.querySelector(".toast")'); await dormir(500);
      assert.equal((await obter('exames', e.id)).status, 'agendado'); assert.equal((await obter('consultas', cons.id)).status, 'confirmada', 'a consulta ficou concluída num exame que voltou a agendado');
      await fecharDialogs(); await c.avaliar(`Painel.ctx.navegar('exames', { ver: ${JSON.stringify(e.id)} })`); await abrirDialog();
      await botaoDialog('Excluir exame'); await c.esperar('document.querySelectorAll("dialog.modal[open]").length >= 1'); await dormir(200);
      assert.match(await texto('dialog.modal[open]:last-of-type .modal-corpo'), /cancelado/); await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir'); await dormir(600);
      assert.equal(await obter('exames', e.id), null); assert.equal((await obter('consultas', cons.id)).status, 'cancelada', 'o horário ficou ativo na agenda sem exame'); await apagar('consultas', cons.id);
    });

    await passo('I15. importar tutor sem nome, consulta sem início ou passo da agenda inválido é recusado pela tela (as telas quebravam e a agenda travava)', async () => {
      await irPara('config', 'Configurações'); const antes = (await lista('tutores')).length;
      for (const [colecoes, esperado] of [[{ tutores: [{ id: 'z1' }] }, /não tem o campo "nome"/], [{ consultas: [{ id: 'z1', petId: 'p' }] }, /não tem o campo "inicio"/], [{ config: [{ id: 'clinica', passoAgenda: -5 }] }, /passoAgenda/]]) {
        await c.avaliar(`document.querySelectorAll('.toast').forEach(t => t.remove())`);
        await c.avaliar(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify({ versao: 1, colecoes }))}], 'd.json', { type: 'application/json' }));
          const i = document.getElementById('arquivo-import'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await c.esperar('document.querySelector(".toast-erro")'); assert.match(await texto('.toast-erro'), esperado);
      }
      assert.equal((await lista('tutores')).length, antes);
    });

    await passo('I16. o foco não se perde no fim do documento: depois de salvar uma edição (a tela foi redesenhada) e fechar o detalhe, o foco fica na tela (título ou lista), não no body', async () => {
      await irParaFresco('exames', 'Exames e laudos'); await c.clicarTexto('.chip-botao', 'Todos'); await dormir(250);
      await c.clicarTexto('.tabela tbody tr button', 'Exemplo'); await abrirDialog(); await botaoDialog('Editar'); await abrirDialog();
      await campo('obs', 'foco ' + Date.now()); await botaoDialog('Salvar'); await c.esperar('document.querySelector("dialog.modal[open] .dl-ficha")'); await dormir(250);
      await botaoDialog('Fechar'); await dormir(250);
      assert.notEqual(await c.avaliar('document.activeElement && document.activeElement.tagName'), 'BODY', 'o foco caiu no body');
    });

    await passo('I9. "Carregar dados de exemplo" de novo não recria nem reabre nada, e remover exemplos leva os exames de exemplo e deixa o exame real de paciente real', async () => {
      const dia = await hojeISO();
      const t = await criar('tutores', { nome: 'Tutor Real I9', telefone: '(15) 99999-3333' }), pet = await criar('pets', { tutorId: t.id, nome: 'Pet Real I9', especie: 'Cão' });
      const real = await criar('exames', { petId: pet.id, servicoId: 'ex-serv-1', encaminhadorId: 'ex-enc-1', status: 'solicitado', consultaId: '', solicitadoEm: dia + 'T01:00' });
      await irPara('config', 'Configurações'); const antes = JSON.stringify((await lista('exames')).map((e) => [e.id, e.status]).sort());
      await c.clicarTexto('button', 'Carregar dados de exemplo'); await c.esperar('[...document.querySelectorAll(".toast")].some(t => /já estão carregados/.test(t.textContent))');
      assert.equal(JSON.stringify((await lista('exames')).map((e) => [e.id, e.status]).sort()), antes);
      await c.avaliar(`Seed.remover(Painel.ctx.store)`); await dormir(500);
      assert.deepEqual((await lista('exames')).map((e) => e.id), [real.id]); assert.deepEqual((await lista('encaminhadores')).map((e) => e.id), ['ex-enc-1']); // o exame real cita o encaminhador de exemplo: ele fica, sem a marca
      await irParaFresco('exames', 'Exames e laudos'); await c.clicarTexto('.chip-botao', 'Todos'); await dormir(250); assert.equal(await contar('.tabela tbody tr'), 1); assert.match(await texto('.tabela'), /Tomografia|Exame de imagem/); assert.doesNotMatch(await texto('.tabela'), /Exame removido/); // o serviço citado pelo exame real ficou
    });
  }

  /* ---------- v0.6: venda no balcão (clínica com loja) ---------- */
  if (pc.venda === true) {
    const venderPelaTela = async (nomeItem, qtd, extra = {}) => {
      await irParaFresco('estoque', 'Estoque e produtos'); await c.clicarTexto('.tabela tbody tr', nomeItem); await abrirDialog();
      await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar venda'); await abrirDialog(); await campo('qtd', String(qtd));
      for (const [k, v] of Object.entries(extra)) await campo(k, v);
      await botaoDialog('Registrar venda');
    };
    await passo('K1. texto hostil (<img onerror>, <script>) no nome do item à venda aparece como texto no estoque, no formulário de venda e no caixa, e nada executa', async () => {
      const nome = '<img src=x onerror="window.__pwn=1"> <script>window.__pwn=2</script>';
      await c.avaliar(`window.__pwn = 0; Painel.ctx.store.salvar('estoque', { id: 'k1-item', nome: ${JSON.stringify(nome)}, categoria: 'artigo', unidade: 'unidade', quantidade: 5, minimo: 1, precoVendaCents: 1000 })`);
      await venderPelaTela('<img src=x', 2);
      await dormir(300);
      assert.equal(await c.avaliar('window.__pwn'), 0, 'o nome hostil executou');
      assert.equal(await contar('.tabela img, dialog.modal img, .tela img'), 0);
      const lanc = (await lista('lancamentos')).find((l) => l.itemId === 'k1-item');
      assert.ok(lanc && lanc.descricao.startsWith('Venda: <img src=x') && lanc.valorCents === 2000, JSON.stringify(lanc));
      await irParaFresco('caixa', 'Caixa'); assert.match(await texto('.tela'), /Venda: <img src=x onerror/); assert.equal(await contar('.tela img'), 0); assert.equal(await c.avaliar('window.__pwn'), 0);
      await c.avaliar(`Painel.ctx.store.remover('estoque', 'k1-item')`);
    });
    await passo('K2. se o caixa falhar depois da baixa, a quantidade volta e a saída some do histórico (nada de estoque que sai sem dinheiro)', async () => {
      await c.avaliar(`Painel.ctx.store.salvar('estoque', { id: 'k2-item', nome: 'Item K2', categoria: 'artigo', unidade: 'unidade', quantidade: 5, minimo: 1, precoVendaCents: 1500 })`);
      await c.avaliar(`(() => { const st = Painel.ctx.store, orig = st.salvar; window.__origSalvar = orig; st.salvar = (col, obj) => col === 'lancamentos' ? Promise.reject(new Error('disco cheio')) : orig(col, obj); })()`);
      await venderPelaTela('Item K2', 2);
      await c.esperar('document.querySelector("dialog.modal[open] .erro-form:not([hidden])")');
      assert.match(await texto('dialog.modal[open] .erro-form'), /baixa do estoque foi desfeita.*disco cheio/);
      await c.avaliar(`Painel.ctx.store.salvar = window.__origSalvar`);
      assert.equal((await c.avaliar(`Painel.ctx.store.obter('estoque', 'k2-item')`)).quantidade, 5, 'a quantidade não voltou');
      assert.equal((await lista('movimentos')).filter((m) => m.itemId === 'k2-item').length, 0, 'sobrou a saída no histórico');
      assert.equal((await lista('lancamentos')).filter((l) => l.itemId === 'k2-item').length, 0);
      await fecharDialogs(); await c.avaliar(`Painel.ctx.store.remover('estoque', 'k2-item')`);
    });
    await passo('K3. item com preço ou saldo adulterado (texto, negativo, objeto) não vende e a tela não quebra; arquivo com esses valores é recusado', async () => {
      for (const [id, preco, qtd] of [['k3-a', '15,00', 5], ['k3-b', -100, 5], ['k3-c', { x: 1 }, 5], ['k3-d', 1500, 'abc'], ['k3-e', 1500, -3]]) await c.avaliar(`Painel.ctx.store.salvar('estoque', { id: ${JSON.stringify(id)}, nome: 'Adulterado ' + ${JSON.stringify(id)}, categoria: 'artigo', unidade: 'un', quantidade: ${JSON.stringify(qtd)}, precoVendaCents: ${JSON.stringify(preco)} })`);
      await irParaFresco('estoque', 'Estoque e produtos'); assert.ok((await contar('.tabela tbody tr')) >= 5);
      for (const id of ['k3-a', 'k3-b', 'k3-c']) { await c.clicarTexto('.tabela tbody tr', 'Adulterado ' + id); await abrirDialog(); assert.ok(!(await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].some(b => b.textContent === 'Registrar venda')`)), id + ' oferece venda sem preço válido'); await fecharDialogs(); }
      for (const id of ['k3-d', 'k3-e']) { await c.clicarTexto('.tabela tbody tr', 'Adulterado ' + id); await abrirDialog(); await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar venda'); await abrirDialog(); await campo('qtd', '1'); await botaoDialog('Registrar venda'); assert.match(await texto('dialog.modal[open] .erro-form'), /maior que o estoque/, id); await fecharDialogs(); }
      assert.equal((await lista('lancamentos')).filter((l) => /k3-/.test(l.itemId || '')).length, 0);
      const r = await c.avaliar(`Store.validarExportacao({ versao: 1, colecoes: { estoque: [{ id: 'z', nome: 'x', precoVendaCents: '1500' }] } }, Painel.ctx.store.colecoes)`); assert.equal(r.ok, false);
      for (const id of ['k3-a', 'k3-b', 'k3-c', 'k3-d', 'k3-e']) await c.avaliar(`Painel.ctx.store.remover('estoque', ${JSON.stringify(id)})`);
    });
    await passo('K4. a baixa não fica sem caixa NEM sem histórico: se gravar a saída do histórico falhar, a quantidade volta e nada fica pela metade (achado da revisão: só o caixa era coberto)', async () => {
      await c.avaliar(`Painel.ctx.store.salvar('estoque', { id: 'k4-item', nome: 'Item K4', categoria: 'artigo', unidade: 'unidade', quantidade: 5, minimo: 1, precoVendaCents: 1500 })`);
      await c.avaliar(`(() => { const st = Painel.ctx.store, orig = st.salvar; window.__origSalvar = orig; st.salvar = (col, obj) => col === 'movimentos' ? Promise.reject(new Error('cota do histórico')) : orig(col, obj); })()`);
      await venderPelaTela('Item K4', 2);
      await c.esperar('document.querySelector("dialog.modal[open] .erro-form:not([hidden])")');
      assert.match(await texto('dialog.modal[open] .erro-form'), /baixa do estoque foi desfeita.*cota do histórico/);
      await c.avaliar(`Painel.ctx.store.salvar = window.__origSalvar`);
      assert.equal((await c.avaliar(`Painel.ctx.store.obter('estoque', 'k4-item')`)).quantidade, 5, 'a quantidade não voltou');
      assert.equal((await lista('lancamentos')).filter((l) => l.itemId === 'k4-item').length, 0);
      await fecharDialogs(); await c.avaliar(`Painel.ctx.store.remover('estoque', 'k4-item')`);
    });
    await passo('K5. item vencido não vende; preço que mudou depois de abrir a venda é mostrado antes de cobrar; item de exemplo vende como exemplo', async () => {
      const ontem = await c.avaliar(`Regras.somarDias(Regras.hojeISO(), -1)`);
      await c.avaliar(`Promise.all([Painel.ctx.store.salvar('estoque', { id: 'k5-venc', nome: 'Item vencido K5', categoria: 'medicamento', unidade: 'frasco', quantidade: 5, precoVendaCents: 1000, validade: ${JSON.stringify(ontem)} }),
        Painel.ctx.store.salvar('estoque', { id: 'k5-preco', nome: 'Item preco K5', categoria: 'artigo', unidade: 'un', quantidade: 5, precoVendaCents: 1000 }),
        Painel.ctx.store.salvar('estoque', { id: 'k5-ex', nome: 'Item exemplo K5', categoria: 'artigo', unidade: 'un', quantidade: 5, precoVendaCents: 1000, exemplo: true })])`);
      await venderPelaTela('Item vencido K5', 1); await c.esperar('document.querySelector("dialog.modal[open] .erro-form:not([hidden])")');
      assert.match(await texto('dialog.modal[open] .erro-form'), /está vencido \(validade/); await fecharDialogs();
      assert.equal((await c.avaliar(`Painel.ctx.store.obter('estoque', 'k5-venc')`)).quantidade, 5);
      // preço muda em outra aba depois de a janela abrir
      await irParaFresco('estoque', 'Estoque'); await c.clicarTexto('.tabela tbody tr', 'Item preco K5'); await abrirDialog();
      await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar venda'); await abrirDialog();
      await c.avaliar(`(async () => { const st = Painel.ctx.store, i = await st.obter('estoque', 'k5-preco'); await st.salvar('estoque', Object.assign({}, i, { precoVendaCents: 4500 })); })()`);
      await campo('qtd', '2'); await botaoDialog('Registrar venda');
      assert.match(await texto('dialog.modal[open] .erro-form'), /preço deste item mudou \(agora R\$ 45,00\)/);
      assert.equal((await c.avaliar(`Painel.ctx.store.obter('estoque', 'k5-preco')`)).quantidade, 5); await fecharDialogs();
      await venderPelaTela('Item exemplo K5', 1); await dormir(300);
      assert.ok((await lista('lancamentos')).some((l) => l.itemId === 'k5-ex' && l.exemplo === true) && (await lista('movimentos')).some((m) => m.itemId === 'k5-ex' && m.exemplo === true), 'a venda de um item de exemplo precisa ser de exemplo');
      for (const id of ['k5-venc', 'k5-preco', 'k5-ex']) await c.avaliar(`Painel.ctx.store.remover('estoque', ${JSON.stringify(id)})`);
      await c.avaliar(`(async () => { const st = Painel.ctx.store; for (const l of await st.listar('lancamentos')) if (/^k5-/.test(l.itemId || '')) await st.remover('lancamentos', l.id); for (const m of await st.listar('movimentos')) if (/^k5-/.test(m.itemId || '')) await st.remover('movimentos', m.id); })()`);
    });
  }

  await passo('J3. estoque: formulário aberto antes de outra pessoa mexer no saldo: "Entrada" soma ao saldo ATUAL e "Editar item" só leva o que a pessoa mudou (antes devolvia o saldo antigo e apagava a venda feita em outra aba)', async () => {
    await c.avaliar(`Painel.ctx.store.salvar('estoque', { id: 'j3-item', nome: 'Item J3', categoria: 'insumo', unidade: 'un', quantidade: 10, minimo: 2 })`);
    const atual = () => c.avaliar(`Painel.ctx.store.obter('estoque', 'j3-item')`);
    const mexer = (q) => c.avaliar(`(async () => { const st = Painel.ctx.store, i = await st.obter('estoque', 'j3-item'); await st.salvar('estoque', Object.assign({}, i, { quantidade: ${q} })); })()`);
    const abrirItem = async (botao) => { await irParaFresco('estoque', 'Estoque'); await c.clicarTexto('.tabela tbody tr', 'Item J3'); await abrirDialog(); await c.clicarTexto('dialog.modal[open] .modal-rodape button', botao); await abrirDialog(); };
    await abrirItem('Entrada'); await mexer(7); await campo('qtd', '5'); await botaoDialog('Salvar');
    assert.equal((await atual()).quantidade, 12, 'a entrada tem de somar ao saldo atual (7), não ao de quando a janela abriu (10)');
    await abrirItem('Editar item'); await mexer(3); await campo('nome', 'Item J3 renomeado'); await botaoDialog('Salvar'); await dormir(200);
    const depois = await atual(); assert.equal(depois.nome, 'Item J3 renomeado'); assert.equal(depois.quantidade, 3, 'editar só o nome não pode devolver o saldo antigo');
    await irParaFresco('estoque', 'Estoque'); await c.clicarTexto('.tabela tbody tr', 'Item J3 renomeado'); await abrirDialog(); await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Editar item'); await abrirDialog();
    await mexer(9); await campo('quantidade', '4'); await botaoDialog('Salvar');
    assert.match(await texto('dialog.modal[open] .erro-form'), /quantidade deste item mudou em outra tela \(agora 9\)/); assert.equal((await atual()).quantidade, 9); await fecharDialogs();
    await c.avaliar(`Painel.ctx.store.remover('estoque', 'j3-item')`);
  });

  /* a importação (e a exportação e o apagar tudo) é só do dono: veterinário e recepção não chegam a Configurações nem pelo menu nem pela URL */
  for (const [perfilTeste, rotulo] of [['vet', 'veterinário'], ['recep', 'recepção']]) {
    await passo(`J2. ${rotulo}: Configurações (exportar, importar e apagar tudo) não aparece no menu e a URL volta ao início, sem o campo de arquivo`, async () => {
      assert.ok(!(await c.avaliar(`[...document.querySelectorAll('.lateral nav a')].some(a => a.textContent === 'Configurações')`)), 'menu mostra Configurações');
      await c.avaliar(`location.hash = '#/config'`); await dormir(600);
      assert.equal(await c.avaliar('location.hash'), '#/inicio'); assert.equal(await contar('#arquivo-import'), 0); assert.equal(await contar('.btn-perigo'), 0);
      assert.equal(await c.avaliar(`Regras.permissao(Painel.ctx.perfil, 'config')`), null);
    }, perfilTeste);
  }

  /* ---------- v0.6: importar backup antigo ---------- */
  await passo('J1. backup antigo (sem os grupos que a versão nova tem): a tela avisa o que ficará vazio, cancelar não muda nada e importar não deixa registro clínico sem paciente', async () => {
    await irPara('config', 'Configurações');
    const completo = await c.avaliar('Painel.ctx.store.exportar()');
    const com = ['exames', 'prontuarios', 'internacoes', 'vacinas'].filter((col) => (completo.colecoes[col] || []).length > 0);
    assert.ok(com.length > 0, 'o site de teste precisa ter dados em algum grupo dependente do pet (prontuários, exames, internações ou vacinas)');
    const antigo = { versao: 1, colecoes: { tutores: [{ id: 'old-t', nome: 'Tutor do backup antigo' }], pets: [{ id: 'old-p', tutorId: 'old-t', nome: 'Pet do backup antigo', especie: 'Cão' }] } };
    const enviar = (obj) => c.avaliar(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify(obj))}], 'antigo.json', { type: 'application/json' }));
      const i = document.getElementById('arquivo-import'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const contagens = async () => JSON.stringify(await Promise.all(com.map(async (col) => (await lista(col)).length)));
    const antes = await contagens();
    await enviar(antigo); await abrirDialog();
    const aviso = await texto('dialog.modal[open] [data-aviso="esvazia"]');
    assert.match(aviso, /ficarão VAZIOS/); assert.match(aviso, /registro\(s\) atual\(is\) serão apagados/);
    await botaoDialog('Cancelar'); assert.equal(await contagens(), antes, 'cancelar não pode mudar nada');
    await enviar(antigo); await abrirDialog(); await botaoDialog('Importar e substituir');
    await c.esperar('[...document.querySelectorAll(".toast")].some(t => /importados/.test(t.textContent))');
    assert.equal(await contagens(), JSON.stringify(com.map(() => 0)), 'o que o arquivo não traz tem de ficar vazio, senão fica registro clínico de um paciente que não existe mais');
    const quebradas = await c.avaliar(`(async () => { const st = Painel.ctx.store, o = {}; for (const col of st.colecoes) if (col !== 'usuarios') o[col] = await st.listar(col); return Store.referenciasQuebradas(o); })()`);
    assert.deepEqual(quebradas, [], 'sobrou registro citando tutor, pet ou internação que não existe');
    for (const rota of ['inicio', 'agenda', 'tutores']) { await irParaFresco(rota, ''); assert.ok(await c.avaliar('!!document.getElementById("titulo-tela")'), rota + ' não abriu depois da importação'); } // irParaFresco espera o título da tela
    await c.avaliar(`Painel.ctx.store.importar(${JSON.stringify(completo)})`); await dormir(300); // devolve o que havia (os passos seguintes dependem dos exemplos)
    assert.equal(await contagens(), antes);
  });

  /* ---------- v0.7: dívidas do site 5 (referências, importação grande, serviço em uso) ---------- */
  await passo('M1. serviço usado em consulta da agenda não se exclui (desativa); sem uso, exclui (antes a consulta ficava com um serviço que não existe e editá-la apagava o vínculo em silêncio)', async () => {
    const dia = await hojeISO();
    const serv = await c.avaliar(`Painel.ctx.store.salvar('servicos', { nome: 'Servico M1', duracaoMin: 30, valorCents: 0, ativo: true })`);
    const cons = await c.avaliar(`Painel.ctx.store.salvar('consultas', { petId: ${JSON.stringify(S.pets[0].id)}, tutorId: ${JSON.stringify(S.pets[0].tutorId)}, profissionalId: 'ex-prof-1', servicoId: ${JSON.stringify(serv.id)}, inicio: ${JSON.stringify(dia + 'T21:00')}, duracaoMin: 30, status: 'agendada', motivo: 'm1' })`);
    const excluir = async () => { await irParaFresco('equipe', 'Profissionais e'); await c.clicarTexto('.tabela tbody tr', 'Servico M1'); await abrirDialog(); await botaoDialog('Excluir'); await c.esperar('document.querySelectorAll("dialog.modal[open]").length === 2'); await dormir(100);
      await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir'); await dormir(500); };
    await excluir();
    assert.match(await texto('dialog.modal[open] .erro-form'), /Há consultas/, 'deveria recusar: há consulta com este serviço'); await fecharDialogs();
    assert.ok(await c.avaliar(`Painel.ctx.store.obter('servicos', ${JSON.stringify(serv.id)})`), 'o serviço em uso foi excluído');
    await c.avaliar(`Painel.ctx.store.remover('consultas', ${JSON.stringify(cons.id)})`);
    await excluir(); await fecharDialogs();
    assert.equal(await c.avaliar(`Painel.ctx.store.obter('servicos', ${JSON.stringify(serv.id)})`), null, 'sem uso o serviço deveria sair');
  });

  await passo('M2. importar 4.000 registros no localStorage/IndexedDB leva menos de 1,5 s (era O(n²): ~1,4 s para 3.000 e ~5,5 s para 6.000)', async () => {
    const completo = await c.avaliar('Painel.ctx.store.exportar()');
    const dump = { versao: 1, colecoes: { tutores: [{ id: 'm2t', nome: 'Tutor M2' }], pets: Array.from({ length: 4000 }, (_, i) => ({ id: 'm2p' + i, tutorId: 'm2t', nome: 'Pet ' + i, especie: 'Cão' })) } };
    try {
      const ms = await c.avaliar(`(async () => { const t0 = performance.now(); await Painel.ctx.store.importar(${JSON.stringify(dump)}); return Math.round(performance.now() - t0); })()`);
      assert.equal((await lista('pets')).length, 4000); assert.ok(ms < 1500, 'importar 4.000 registros levou ' + ms + ' ms');
    } finally { await c.avaliar(`Painel.ctx.store.importar(${JSON.stringify(completo)})`); await dormir(300); }
  });

  await passo('M3. arquivo que cita profissional, serviço ou horário que não estão nele: a tela de importação avisa (antes só avisava de tutor, pet e leito)', async () => {
    await irPara('config', 'Configurações');
    const arq = { versao: 1, colecoes: { tutores: [{ id: 'm3t', nome: 'T' }], pets: [{ id: 'm3p', tutorId: 'm3t', nome: 'P' }],
      consultas: [{ id: 'm3c', petId: 'm3p', inicio: '2026-10-22T09:00', profissionalId: 'sumiu-prof', servicoId: 'sumiu-serv' }], prontuarios: [{ id: 'm3r', petId: 'm3p', data: '2026-10-22', profissionalId: 'sumiu-prof' }] } };
    await c.avaliar(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify(arq))}], 'm3.json', { type: 'application/json' }));
      const i = document.getElementById('arquivo-import'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await abrirDialog();
    const aviso = await texto('dialog.modal[open] [data-aviso="quebradas"]');
    assert.match(aviso, /Consultas: 1 registro\(s\) citam profissionais/); assert.match(aviso, /Consultas: 1 registro\(s\) citam serviços/); assert.match(aviso, /Prontuários: 1 registro\(s\) citam profissionais/);
    await botaoDialog('Cancelar');
  });

  await passo('M4. IndexedDB: importar em lote (uma transação por grupo) grava tudo, substitui o que havia e devolve os dados se uma gravação falha', async () => {
    const r = await c.avaliar(`(async () => {
      const nome = 'm4-' + Date.now(), st = Store.criarStore(Store.adaptadorIndexedDB(nome, undefined, Store.COLECOES));
      await st.salvar('tutores', { id: 'velho', nome: 'Velho' });
      const dump = { versao: 1, colecoes: { tutores: [{ id: 't', nome: 'T' }], pets: Array.from({ length: 1500 }, (_, i) => ({ id: 'p' + i, tutorId: 't', nome: 'P' + i })) } };
      const t0 = performance.now(); await st.importar(dump); const ms = Math.round(performance.now() - t0);
      const pets = await st.listar('pets'), tut = await st.listar('tutores');
      const lote = st.adaptador.gravarLote; let falhou = null;
      let jaFalhou = false; st.adaptador.gravarLote = (col, itens) => (col === 'pets' && !jaFalhou && (jaFalhou = true) ? Promise.reject(new Error('disco cheio')) : lote(col, itens)); // falha só a primeira gravação dos pets; a restauração passa
      try { await st.importar({ versao: 1, colecoes: { tutores: [{ id: 'novo', nome: 'N' }], pets: [{ id: 'x', tutorId: 'novo', nome: 'X' }] } }); } catch (e) { falhou = String(e.message); }
      st.adaptador.gravarLote = lote;
      const depois = { tutores: (await st.listar('tutores')).map((x) => x.id), pets: (await st.listar('pets')).length };
      indexedDB.deleteDatabase(nome);
      return { n: pets.length, tutores: tut.map((x) => x.id), ms, tipo: typeof lote, falhou, depois }; })()`);
    assert.equal(r.tipo, 'function'); assert.equal(r.n, 1500); assert.deepEqual(r.tutores, ['t']); assert.ok(r.ms < 4000, 'importar 1.500 registros no IndexedDB levou ' + r.ms + ' ms');
    assert.match(r.falhou || '', /restaurad/); assert.deepEqual(r.depois, { tutores: ['t'], pets: 1500 }, 'a gravação que falhou tem de devolver os dados anteriores');
  });

  console.log(`\nRevisão: ${feitos} passos passaram, ${falhas.length} falharam.`);
  if (falhas.length) { console.log('\n' + falhas.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
} catch (e) {
  console.error('\nERRO NO PREPARO:', e.message); console.error('console:', c.console.slice(-6)); process.exitCode = 1;
} finally { await c.fechar(); srv.fechar(); }
