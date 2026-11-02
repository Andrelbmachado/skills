// Teste de ponta a ponta do painel no Chrome de verdade: primeiro acesso, dados de exemplo, as 9 telas, perfis, toggle e IndexedDB.
// Serve para os três pacotes (completo, só vitrine não tem painel, e ESSENCIAL = sem vitrine) e para qualquer subtipo:
// lê SITE_CONFIG (modules.vitrine, painel.subtipo, painel.camposPet...) e adapta as verificações.
// Uso: node e2e_painel.mjs <pastaDoSite> [pastaDeFotos]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { abrirChrome } from './cdp.mjs';
import { servir } from './servidor.mjs';

const [pasta, fotos] = process.argv.slice(2);
if (!pasta) { console.error('uso: node e2e_painel.mjs <pastaDoSite> [pastaDeFotos]'); process.exit(2); }
if (fotos) fs.mkdirSync(fotos, { recursive: true });
const srv = await servir(pasta);
const c = await abrirChrome();
const passos = [];
const ok = (m) => { passos.push(m); console.log('ok  ' + m); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (sel) => `document.querySelector(${JSON.stringify(sel)})`;
const texto = (sel) => c.avaliar(`(${q(sel)} || {}).textContent || ''`);
const contar = (sel) => c.avaliar(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
async function tirar(nome) { // mede a rolagem horizontal em 1280 e 390 e, se pedido, grava as fotos
  for (const [sufixo, l, a] of [['d', 1280, 800], ['m', 390, 844]]) {
    await c.emular(l, a); await dormir(150);
    const sw = await c.avaliar('document.documentElement.scrollWidth');
    assert.ok(sw <= l, `${nome} em ${l}px: rolagem horizontal (scrollWidth ${sw})`);
    if (fotos) await c.foto(path.join(fotos, `${nome}_${sufixo}.png`));
  }
}
async function irPara(rota, titulo) {
  await c.avaliar(`location.hash = '#/${rota}'`);
  await c.esperar(`document.getElementById('titulo-tela') && document.getElementById('titulo-tela').textContent.includes(${JSON.stringify(titulo)})`);
  await dormir(120);
}
async function abrirDialog() { await c.esperar('document.querySelector("dialog.modal[open]")'); await dormir(80); }
async function salvarDialog(rotulo = 'Salvar') { await c.clicarTexto('dialog.modal[open] .modal-rodape button', rotulo); await dormir(250); }
async function fecharDialogs() { await c.avaliar('document.querySelectorAll("dialog.modal[open]").forEach(d => d.close())'); await dormir(80); }
async function campo(nome, valor) { await c.digitar(`dialog.modal[open] [name="${nome}"]`, valor); }
async function semErros() { assert.deepEqual(c.console.filter((x) => !/favicon/i.test(x)), [], 'erros no console do navegador'); }
async function sair() { await c.clicarTexto('button', 'Sair'); await c.esperar('document.querySelector("#login-raiz h1")'); }
async function entrar(usuario, senha) {
  await c.digitar('[name="usuario"]', usuario); await c.digitar('[name="senha"]', senha);
  await c.clicarTexto('button[type="submit"]', 'Entrar'); await dormir(600);
}

try {
  await c.emular(1280, 800);
  const base = srv.url;
  await c.navegar(base + 'painel/', 300);
  const cfg = await c.avaliar('JSON.parse(JSON.stringify(window.SITE_CONFIG))');
  const semVitrine = cfg.modules.vitrine === false, pc = cfg.painel || {}, nomeNegocio = cfg.negocio.nome;
  ok(`configuração lida: vitrine ${semVitrine ? 'desligada (ESSENCIAL)' : 'ligada'}, subtipo ${pc.subtipo || 'geral'}`);

  /* ---------- primeiro acesso e login ---------- */
  await c.navegar(base + 'painel/', 500);
  assert.equal(await texto('h1'), 'Primeiro acesso'); ok('painel/ abre no primeiro acesso');
  assert.match(await texto('.aviso-limite'), /barreira de interface, não segurança real/); ok('aviso de login estático visível na tela de acesso');
  assert.equal(await contar('.login-voltar'), semVitrine ? 0 : 1); ok(semVitrine ? 'sem vitrine: a tela de acesso não tem "Voltar ao site"' : 'com vitrine: a tela de acesso tem "Voltar ao site"');
  await tirar('01-login');
  await c.digitar('[name="nome"]', 'Dona Teste'); await c.digitar('[name="usuario"]', 'dona');
  await c.digitar('[name="senha"]', 'curta'); await c.digitar('[name="conf"]', 'curta');
  await c.avaliar(`document.querySelector('.login-form').requestSubmit()`); await dormir(300);
  assert.match(await texto('.erro-form'), /8 caracteres/); ok('senha curta é recusada');
  await c.digitar('[name="senha"]', 'senha-segura-1'); await c.digitar('[name="conf"]', 'senha-diferente');
  await c.avaliar(`document.querySelector('.login-form').requestSubmit()`); await dormir(300);
  assert.match(await texto('.erro-form'), /não são iguais/); ok('confirmação diferente é recusada');
  await c.digitar('[name="conf"]', 'senha-segura-1');
  await c.avaliar(`document.querySelector('.login-form').requestSubmit()`);
  await c.esperar('location.pathname.endsWith("app.html")'); await c.esperar('document.getElementById("titulo-tela")'); ok('conta do dono criada e sessão aberta');
  assert.match(await texto('#titulo-tela'), /Olá, Dona/);
  const modulos = pc.modulos || ['inicio', 'agenda', 'tutores', 'prontuarios', 'vacinas', 'caixa', 'estoque', 'equipe', 'config'];
  const hospital = modulos.includes('internacao'), diag = modulos.includes('exames'), ag = (pc.textos && pc.textos.agenda) || {};
  const loja = pc.venda === true, tituloEstoque = loja ? 'Estoque e produtos' : 'Estoque'; // clínica com loja: preço de venda e venda no balcão
  assert.equal(await contar('.lateral nav a'), modulos.length); ok(`dono vê as ${modulos.length} telas no menu`);
  assert.equal(await contar('.lateral a[href="../index.html"]'), semVitrine ? 0 : 1); ok(semVitrine ? 'sem vitrine: o menu lateral não tem "Ver o site"' : 'com vitrine: o menu lateral tem "Ver o site"');
  const S = await c.avaliar(`Seed.gerar(Regras.hojeISO(), ${JSON.stringify(pc.subtipo || null)}, ${JSON.stringify({ exames: pc.exames })})`); // nomes dos pets de exemplo do subtipo
  const [pet1, , pet3] = S.pets.map((p) => p.nome);

  /* ---------- nasce vazio + dados de exemplo ---------- */
  assert.equal(await contar('.painel-vazio'), 1); assert.match(await texto('.painel-vazio'), /começa vazio/); ok('painel nasce vazio, com convite para cadastrar ou carregar exemplo');
  assert.equal(await contar('.banner-exemplo:not([hidden])'), 0);
  await tirar('02-inicio-vazio');
  await c.clicarTexto('.painel-vazio button', 'Carregar dados de exemplo');
  await c.esperar('document.querySelector(".resumo-grade") && !document.querySelector(".painel-vazio")'); await dormir(300);
  assert.equal(await contar('.banner-exemplo:not([hidden])'), 1); assert.match(await texto('.banner-exemplo'), /fictícios/); ok('dados de exemplo carregados e marcados como fictícios');
  assert.ok((await contar('.resumo-card')) >= 4);
  await tirar('03-inicio-exemplo');

  /* ---------- agenda ---------- */
  await irPara('agenda', 'Agenda');
  const nHoje = diag ? 2 : 4;
  assert.equal(await contar('.bloco-consulta'), nHoje); ok(`agenda de hoje mostra as ${nHoje} consultas de exemplo`);
  assert.equal(await contar('.semana-dia'), 7);
  await tirar('04-agenda');
  await c.clicarTexto('.tela-acoes button', ag.nova || 'Nova consulta'); await abrirDialog();
  const hoje = await c.avaliar('Regras.hojeISO()');
  await campo('petId', 'ex-pet-2'); await campo('profissionalId', 'ex-prof-1'); await campo('data', hoje); await campo('hora', '09:15'); await campo('duracaoMin', '30');
  assert.ok((await contar('dialog.modal[open] .horarios-livres button')) > 3); ok('horários livres aparecem no formulário');
  await tirar('04b-form-consulta');
  await salvarDialog();
  await c.esperar('document.querySelectorAll("dialog.modal[open]").length === 2'); // diálogo de conflito empilhado
  assert.match(await texto('dialog.modal[open]:last-of-type .modal-corpo'), /já tem consulta às 09:00/);
  await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Cancelar'); await dormir(200);
  assert.equal(await contar('.bloco-consulta'), nHoje); ok('conflito de horário do profissional é detectado e a consulta não é criada ao recusar');
  await campo('hora', '11:00'); await salvarDialog();
  await c.esperar(`document.querySelectorAll(".bloco-consulta").length === ${nHoje + 1}`); ok(`consulta nova criada sem conflito (${nHoje + 1} na grade)`);
  await c.clicarTexto('.bloco-consulta', diag ? S.pets[3].nome : pet1); await abrirDialog();
  assert.match(await texto('dialog.modal[open] .modal-corpo'), diag ? /Carla Exemplo/ : /Ana Exemplo/);
  await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Iniciar atendimento'); await dormir(300);
  await c.esperar('document.querySelector(".bloco-consulta.st-em_atendimento")'); ok('status da consulta muda (agendada para em atendimento)');
  await semErros();

  /* ---------- tutores e pets ---------- */
  await irPara('tutores', 'Tutores e pets');
  assert.equal(await contar('.tabela tbody tr'), 4);
  await tirar('05-tutores');
  await c.clicarTexto('.tela-acoes button', 'Novo tutor'); await abrirDialog();
  await campo('nome', 'Elisa Teste'); await campo('telefone', '(15) 99999-0000'); await salvarDialog();
  await c.esperar('document.querySelectorAll(".tabela tbody tr").length === 5'); ok('tutor novo cadastrado');
  await c.clicarTexto('.tela-acoes button', 'Novo pet'); await abrirDialog();
  const tutorId = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] [name="tutorId"] option')].find(o => o.textContent === 'Elisa Teste').value`);
  await campo('tutorId', tutorId); await campo('nome', 'Fred'); await campo('especie', 'Cão'); await salvarDialog();
  await c.clicarTexto('.aba', 'Pets'); await dormir(200);
  assert.equal(await contar('.tabela tbody tr'), 6); ok('pet novo cadastrado (6 pets)');
  await c.avaliar(`document.querySelector('.busca').value=${JSON.stringify(pet3.toLowerCase())}; document.querySelector('.busca').dispatchEvent(new Event('input',{bubbles:true}))`); await dormir(400);
  assert.equal(await contar('.tabela tbody tr'), 1); ok('busca por pet funciona (sem acento/caixa)');
  await c.avaliar(`document.querySelector('.busca').value=''; document.querySelector('.busca').dispatchEvent(new Event('input',{bubbles:true}))`); await dormir(300);

  /* ---------- subtipo: espécies, peso em gramas e campos extras do cadastro ---------- */
  if (pc.camposPet) {
    await c.clicarTexto('.tela-acoes button', 'Novo pet'); await abrirDialog();
    const especies = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] [name="especie"] option')].map(o => o.value).filter(Boolean)`);
    assert.deepEqual(especies, pc.especies); ok(`cadastro de pet oferece as ${especies.length} espécies do subtipo`);
    for (const f of pc.camposPet) assert.equal(await contar(`dialog.modal[open] [name="${f.nome}"]`), 1, f.nome);
    assert.equal(await contar('dialog.modal[open] [name="pesoG"]'), pc.pesoEmGramas ? 1 : 0); assert.equal(await contar('dialog.modal[open] [name="pesoKg"]'), pc.pesoEmGramas ? 0 : 1);
    const sexos = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] [name="sexo"] option')].map(o => o.value).filter(Boolean)`);
    assert.deepEqual(sexos, pc.sexos); ok('campos extras (' + pc.camposPet.map((f) => f.nome).join(', ') + '), peso em gramas e sexos do subtipo presentes');
    const tutorElisa = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] [name="tutorId"] option')].find(o => o.textContent === 'Elisa Teste').value`);
    await campo('tutorId', tutorElisa); await campo('nome', 'Zazu'); await campo('especie', pc.especies.find((e) => e !== 'Cão' && e !== 'Gato'));
    await campo('pesoG', '85'); await campo('ambiente', 'Viveiro externo com poleiros'); await campo('dieta', 'Sementes e frutas'); await campo('manejo', 'Limpeza diária');
    await salvarDialog(); await dormir(300);
    await c.clicarTexto('.tabela tbody tr', 'Zazu'); await abrirDialog();
    const ficha = await texto('dialog.modal[open] .modal-corpo');
    assert.match(ficha, /85 g/); assert.match(ficha, /Viveiro externo com poleiros/); assert.match(ficha, /Sementes e frutas/); assert.match(ficha, /Limpeza diária/);
    ok('ficha do pet mostra peso em gramas, ambiente, dieta e manejo'); await tirar('05b-ficha-pet-subtipo'); await fecharDialogs();
  }

  /* ---------- diagnóstico: exames e laudos, encaminhadores (dono) ---------- */
  if (diag) {
    const hojeD = await c.avaliar('Regras.hojeISO()'), em2 = await c.avaliar('Regras.somarDias(Regras.hojeISO(), 2)');
    const ex = (id) => c.avaliar(`Painel.ctx.store.obter('exames', ${JSON.stringify(id)})`);
    await irPara('exames', 'Exames e laudos');
    assert.equal(await contar('.tabela tbody tr'), 6); assert.match(await texto('.resumo-exames'), /6 exames em andamento\. 1 aguardando laudo e 1 para entregar/); ok('Exames e laudos: 6 em andamento (8 de exemplo), 1 aguardando laudo e 1 para entregar');
    assert.deepEqual(await c.avaliar(`[...document.querySelectorAll('.filtros .chip-botao')].map(b => b.textContent)`),
      ['Em andamento (6)', 'Para agendar (2)', 'Agendados (2)', 'Aguardando laudo (1)', 'Para entregar (1)', 'Entregues (1)', 'Cancelados (1)', 'Todos (8)']);
    await tirar('06-exames');
    await c.clicarTexto('.chip-botao', 'Para agendar'); await dormir(200);
    assert.equal(await contar('.tabela tbody tr'), 2); assert.match(await texto('.tabela'), /Horário cancelado: remarcar/); ok('filtros por situação com a contagem certa; horário cancelado na agenda volta para "Para agendar"');
    await c.clicarTexto('.tabela tbody tr', S.pets[2].nome); await abrirDialog();
    assert.match(await texto('dialog.modal[open] .modal-corpo'), /Solicitado/); await tirar('06b-detalhe-exame');
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Marcar na agenda');
    await c.esperar('document.querySelector(\'dialog.modal[open] [name="petId"]\')'); await dormir(250);
    assert.equal(await c.avaliar(`document.querySelector('dialog.modal[open] [name="petId"]').value`), 'ex-pet-3'); assert.equal(await c.avaliar(`document.querySelector('dialog.modal[open] [name="servicoId"]').value`), 'ex-serv-2');
    assert.match(await c.avaliar(`document.querySelector('dialog.modal[open] [name="motivo"]').value`), /^Exame: /); ok('"Marcar na agenda" abre a agenda com o paciente e o exame já preenchidos');
    await campo('profissionalId', 'ex-prof-1'); await campo('data', em2); await campo('hora', '10:00'); await salvarDialog(); await dormir(500);
    const e6 = await ex('ex-exa-6'); assert.equal(e6.status, 'agendado'); assert.ok(e6.consultaId);
    assert.equal((await c.avaliar(`Painel.ctx.store.obter('consultas', ${JSON.stringify(e6.consultaId)})`)).servicoId, 'ex-serv-2'); ok('horário marcado na agenda fica ligado ao exame, que passa a "agendado"');
    await irPara('exames', 'Exames e laudos'); await c.avaliar('Painel.ctx.atualizar()'); await dormir(300);
    await c.clicarTexto('.chip-botao', 'Agendados'); await dormir(200);
    assert.match(await texto('.tabela'), new RegExp('Agendado para ' + em2.split('-').reverse().join('/') + ' às 10:00')); ok('a lista mostra o horário lido da agenda (um só horário, o da agenda)');
    await c.clicarTexto('.tabela tbody tr', S.pets[2].nome); await abrirDialog();
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar realização'); await abrirDialog();
    await campo('realizadoEm', hojeD + 'T23:10'); await campo('responsavelId', 'ex-prof-1'); await tirar('06c-form-realizacao'); await salvarDialog('Registrar realização');
    await c.esperar('document.querySelector("dialog.modal[open] .dl-ficha")'); await dormir(200);
    assert.equal((await ex('ex-exa-6')).status, 'realizado'); assert.equal((await c.avaliar(`Painel.ctx.store.obter('consultas', ${JSON.stringify(e6.consultaId)})`)).status, 'concluida'); ok('realização registrada: o exame passa a "realizado" e a consulta da agenda é concluída');
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar laudo'); await abrirDialog();
    await campo('laudoEm', hojeD + 'T23:20'); await campo('laudoPorId', 'ex-prof-2'); await campo('laudo', 'Laudo de teste do e2e: texto livre.'); await tirar('06d-form-laudo'); await salvarDialog('Registrar laudo');
    await c.esperar('document.querySelector("dialog.modal[open] .laudo-texto")'); await dormir(200);
    assert.match(await texto('dialog.modal[open] .modal-corpo'), /Laudo de teste do e2e/); assert.equal((await ex('ex-exa-6')).status, 'laudado'); ok('laudo registrado; o dono lê o texto no detalhe do exame');
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar entrega'); await abrirDialog();
    await campo('entregueEm', hojeD + 'T23:30'); await campo('entregaVia', 'link combinado com o tutor'); await salvarDialog('Registrar entrega');
    await c.esperar('document.querySelector("dialog.modal[open] .dl-ficha")'); await dormir(200);
    const e6b = await ex('ex-exa-6'); assert.equal(e6b.status, 'entregue'); assert.equal(e6b.entregaVia, 'link combinado com o tutor'); assert.equal(e6b.laudo, 'Laudo de teste do e2e: texto livre.'); ok('entrega registrada ("entregue por" é texto livre do centro)'); await fecharDialogs();
    await c.clicarTexto('.tela-acoes button', 'Novo exame'); await abrirDialog();
    await campo('petId', 'ex-pet-5'); await campo('servicoId', 'ex-serv-3'); await campo('encaminhadorId', 'ex-enc-2'); await campo('indicacao', 'Indicação do teste'); await salvarDialog();
    await c.esperar('document.querySelector("dialog.modal[open] .dl-ficha")'); await dormir(200);
    assert.match(await texto('dialog.modal[open] .modal-corpo'), /Solicitado/); assert.match(await texto('dialog.modal[open] .modal-corpo'), /Indicação do teste/); ok('exame novo registrado como solicitado, com encaminhador e indicação clínica'); await fecharDialogs();
    await irPara('encaminhadores', 'Encaminhadores'); assert.equal(await contar('.tabela tbody tr'), 3); await tirar('06e-encaminhadores');
    await c.clicarTexto('.tela-acoes button', 'Novo encaminhador'); await abrirDialog(); await campo('nome', 'Clínica Nova'); await campo('telefone', '123'); await salvarDialog();
    assert.match(await texto('dialog.modal[open] .erro-form'), /Telefone inválido/); await campo('telefone', '(15) 98888-7777'); await salvarDialog(); await dormir(300);
    assert.equal(await contar('.tabela tbody tr'), 4); ok('encaminhador novo cadastrado (telefone conferido)');
    await c.clicarTexto('.tabela tbody tr', 'Clínica Exemplo A'); await abrirDialog();
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Excluir'); await c.esperar('document.querySelectorAll("dialog.modal[open]").length === 2'); await dormir(100);
    await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir'); await dormir(400);
    assert.match(await texto('dialog.modal[open] .erro-form'), /Há exames deste encaminhador/); ok('encaminhador com exames não é excluído (a mensagem manda desativar)'); await fecharDialogs();
    await c.clicarTexto('.tabela tbody tr', 'Clínica Nova'); await abrirDialog();
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Excluir'); await c.esperar('document.querySelectorAll("dialog.modal[open]").length === 2'); await dormir(100);
    await c.clicarTexto('dialog.modal[open]:last-of-type .modal-rodape button', 'Excluir'); await dormir(500);
    assert.equal(await contar('.tabela tbody tr'), 3); ok('encaminhador sem exames é excluído pelo dono');
    await semErros();
  }

  /* ---------- prontuários ---------- */
  if (!diag) {
  await irPara('prontuarios', 'Prontuários');
  await c.avaliar(`(()=>{const s=document.querySelector('select[aria-label="Escolher o pet"]'); s.value='ex-pet-3'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await c.esperar('document.querySelector(".registro")'); assert.equal(await contar('details.registro'), 1);
  await tirar('06-prontuario');
  await c.clicarTexto('.tela-acoes button', 'Novo registro'); await abrirDialog();
  if (pc.camposPet && pc.camposProntuario) {
    for (const f of pc.camposProntuario) assert.equal(await c.avaliar(`document.querySelector('dialog.modal[open] [name="${f.nome}"]').value`), S.pets[2][f.nome]);
    assert.equal(await contar('dialog.modal[open] [name="pesoG"]'), 1); ok('prontuário novo já traz ambiente, dieta e manejo do cadastro do pet e pede o peso em gramas');
    await tirar('06b-form-prontuario-subtipo');
  }
  if (hospital) {
    const f = pc.camposProntuario.find((x) => x.nome === 'prioridade');
    assert.deepEqual(await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] [name="prioridade"] option')].map(o => o.value)`), ['', ...f.opcoes.map((o) => o.valor)]);
    await campo('prioridade', 'Urgente'); ok('prontuário do hospital oferece a prioridade no atendimento (rotina, urgente, emergência)');
    await tirar('06b-form-prontuario-subtipo');
  }
  await campo('profissionalId', 'ex-prof-2'); await campo('queixa', 'Teste de queixa'); await campo('retornoEm', await c.avaliar('Regras.somarDias(Regras.hojeISO(), 2)')); await salvarDialog();
  await c.esperar('document.querySelectorAll("details.registro").length === 2'); ok('registro de prontuário criado (2 registros do pet)');
  if (pc.camposPet && pc.camposProntuario) {
    assert.match(await texto('details.registro[open]'), /Ambiente/); assert.match(await texto('.ficha-pet'), /último peso: 1,1 kg/); ok('registro mostra os campos do subtipo e o último peso em kg (1100 g)');
  }
  if (hospital) { assert.match(await texto('details.registro[open]'), /Prioridade/); assert.match(await texto('details.registro[open]'), /Urgente/); ok('registro mostra a prioridade escolhida'); }
  await semErros();
  }

  /* ---------- hospital: internação e plantão ---------- */
  if (hospital) {
    await irPara('internacao', 'Internação e plantão');
    assert.equal(await contar('.leito'), 5); assert.equal(await contar('.leito--ocupado'), 3); assert.match(await texto('.resumo-internacao'), /3 de 5 leitos ocupados/);
    assert.match(await texto('.resumo-internacao'), /No plantão agora: /); ok('mapa de leitos: 5 leitos, 3 ocupados, plantonista de agora no resumo');
    await tirar('06c-internacao-leitos');
    const fredId = await c.avaliar(`(async () => (await Painel.ctx.store.listar('pets')).find(p => p.nome === 'Fred').id)()`);
    /* internar o Fred (pet cadastrado por este teste, que fica depois de remover os exemplos) no leito livre */
    await c.clicarTexto('[data-leito="ex-leito-4"] .leito-corpo', 'Livre'); await abrirDialog();
    assert.equal(await c.avaliar(`document.querySelector('dialog.modal[open] [name="leitoId"]').value`), 'ex-leito-4'); ok('toque num leito livre abre "Internar paciente" com o leito escolhido');
    await campo('petId', fredId); await campo('motivo', 'Teste de internação'); await campo('responsavelId', 'ex-prof-1'); await campo('situacao', 'Em observação');
    await tirar('06d-form-internacao');
    await campo('leitoId', 'ex-leito-1'); await salvarDialog(); await dormir(300);
    assert.match(await texto('dialog.modal[open] .erro-form'), /já está ocupado/); ok('leito ocupado não recebe outro paciente');
    await campo('leitoId', 'ex-leito-4'); await campo('petId', 'ex-pet-3'); await salvarDialog(); await dormir(300);
    assert.match(await texto('dialog.modal[open] .erro-form'), /já está internado/); ok('paciente já internado não é internado de novo');
    await campo('petId', fredId); await salvarDialog();
    await c.esperar('document.querySelector("dialog.modal[open] .dl-ficha")'); await dormir(200);
    assert.match(await texto('dialog.modal[open] .modal-corpo'), /Fred/); ok('internação criada; o detalhe abre em seguida'); await tirar('06e-detalhe-internacao');
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar observação'); await abrirDialog();
    await campo('tipo', 'Medicação'); await campo('texto', 'Dose de teste administrada'); await salvarDialog();
    await c.esperar('document.querySelector("dialog.modal[open] .observacoes")'); await dormir(200);
    assert.match(await texto('dialog.modal[open] .observacoes'), /Dose de teste administrada/); assert.match(await texto('dialog.modal[open] .observacoes'), /Medicação/); ok('observação do plantão registrada e listada na internação');
    await fecharDialogs(); await dormir(150);
    assert.equal(await contar('.leito--ocupado'), 4); ok('o mapa passa a mostrar 4 leitos ocupados');
    await c.clicarTexto('.aba', 'Internações'); await dormir(250);
    assert.equal(await contar('.tabela tbody tr'), 4); assert.match(await texto('.tela'), /Encerradas \(1\)/); ok('lista de internados: 4 agora e 1 encerrada de exemplo'); await tirar('06f-internacoes-lista');
    await c.clicarTexto('.aba', 'Plantão'); await dormir(250);
    assert.ok((await contar('.bloco .lista-simples-painel li')) >= 1); assert.equal(await contar('.tabela tbody tr'), 3); ok('aba Plantão: quem está agora e a escala (3 plantões de exemplo)'); await tirar('06g-plantao');
    await c.clicarTexto('.bloco button', 'Registrar plantão'); await abrirDialog();
    await campo('profissionalId', 'ex-prof-1'); await campo('inicio', await c.avaliar(`Regras.somarDias(Regras.hojeISO(), 3) + 'T19:00'`)); await campo('fim', await c.avaliar(`Regras.somarDias(Regras.hojeISO(), 3) + 'T07:00'`)); await salvarDialog();
    assert.match(await texto('dialog.modal[open] .erro-form'), /depois do início/); ok('plantão com fim antes do início é recusado');
    await campo('fim', await c.avaliar(`Regras.somarDias(Regras.hojeISO(), 4) + 'T07:00'`)); await campo('obs', 'Passagem de teste'); await salvarDialog(); await dormir(300);
    assert.equal(await contar('.tabela tbody tr'), 4); ok('plantão registrado (4 na escala)');
    const folha = await c.avaliar(`(() => { let n; const orig = UI.imprimir; UI.imprimir = (no) => { n = no.textContent; }; [...document.querySelectorAll('button')].find(b => b.textContent.includes('Imprimir folha')).click(); UI.imprimir = orig; return n; })()`);
    assert.match(folha, /Folha de passagem de plantão/); assert.match(folha, /Fred/); assert.match(folha, /Dose de teste administrada/); ok('a folha de passagem lista os internados e a última observação de cada um');
    await semErros();
  }

  /* ---------- vacinas e retornos ---------- */
  if (!diag) {
  await irPara('vacinas', 'Vacinas e retornos');
  const linhas = await contar('.tabela tbody tr'); assert.ok(linhas >= 3, 'lembretes a avisar'); ok(`lembretes a avisar listados (${linhas})`);
  assert.ok(await c.avaliar(`[...document.querySelectorAll('.tabela a[href^="https://wa.me/55"]')].every(a => /text=/.test(a.href))`)); ok('links de lembrete usam wa.me com mensagem pronta');
  const msg = await c.avaliar(`decodeURIComponent(document.querySelector('.tabela a[href^="https://wa.me/55"]').href.split('text=')[1])`);
  assert.match(msg, new RegExp('Aqui é da ' + nomeNegocio)); ok('mensagem do lembrete usa o nome da clínica e as variáveis');
  await tirar('07-vacinas');
  await c.clicarTexto('.tabela button', 'Marcar avisado'); await dormir(400);
  assert.ok((await contar('.tabela tbody tr')) < linhas); ok('lembrete marcado como avisado sai do filtro "A avisar"');
  await c.clicarTexto('.tela-acoes button', 'Registrar vacina'); await abrirDialog();
  await campo('petId', 'ex-pet-5'); await campo('vacina', 'Vacina de teste'); await campo('intervaloDias', '30');
  assert.equal(await c.avaliar(`document.querySelector('dialog.modal[open] [name="proximaDose"]').value`), await c.avaliar(`Regras.somarDias(Regras.hojeISO(), 30)`)); ok('próxima dose é calculada pelo intervalo');
  await campo('itemEstoque', 'ex-est-1'); await salvarDialog(); await dormir(300);
  await c.clicarTexto('.aba', 'Caderneta do pet'); await dormir(200);
  await c.avaliar(`(()=>{const s=document.querySelector('select[aria-label="Escolher o pet"]'); s.value='ex-pet-5'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`); await dormir(300);
  assert.equal(await contar('.tabela tbody tr'), 1); ok('vacina aparece na caderneta do pet');

  /* ---------- estoque (baixa pela vacina + saída maior que o saldo) ---------- */
  await irPara('estoque', 'Estoque');
  assert.match(await texto('.tela'), /Vacina V10 \(exemplo\)/);
  assert.equal(await c.avaliar(`[...document.querySelectorAll('.tabela tbody tr')].find(r => r.textContent.includes('Vacina V10')).querySelector('[data-rotulo="Quantidade"]').textContent.trim()`), '11 dose'); ok('aplicação de vacina deu baixa de 1 no estoque (12 para 11)');
  await tirar('08-estoque');
  await c.clicarTexto('.chip-botao', 'Estoque baixo'); await dormir(200);
  assert.ok((await contar('.tabela tbody tr')) >= 1); ok('filtro de estoque baixo');
  await c.clicarTexto('.chip-botao', 'Todos'); await dormir(200);
  await c.clicarTexto('.tabela tbody tr', 'Vermífugo'); await abrirDialog();
  await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Saída'); await abrirDialog();
  await campo('qtd', '999'); await salvarDialog();
  assert.match(await texto('dialog.modal[open] .erro-form'), /maior que o estoque/); ok('saída maior que o estoque é bloqueada com mensagem clara');
  await campo('qtd', '5'); await salvarDialog(); await dormir(300);
  assert.match(await texto('.tela'), /15 comprimido/); ok('saída válida baixa o estoque (20 para 15)');
  } else {
    await irPara('estoque', 'Estoque'); assert.equal(await contar('.tabela tbody tr'), 5); await tirar('08-estoque');
    await c.clicarTexto('.chip-botao', 'Estoque baixo'); await dormir(200); assert.ok((await contar('.tabela tbody tr')) >= 1); ok('estoque de insumos do centro: 5 itens de exemplo e filtro de estoque baixo');
  }

  /* ---------- caixa ---------- */
  await irPara('caixa', 'Caixa');
  const cartoes = await c.avaliar(`[...document.querySelectorAll('.resumo-card')].map(e => e.textContent.replace(/\\s+/g,' ').trim())`);
  const [eIn, sOut, sdo] = diag ? ['430,00', '45,50', '384,50'] : loja ? ['299,90', '45,50', '254,40'] : ['210,00', '45,50', '164,50']; // a loja tem uma venda de exemplo (89,90)
  assert.match(cartoes[0], new RegExp('R\\$ ' + eIn)); assert.match(cartoes[1], new RegExp('R\\$ ' + sOut)); assert.match(cartoes[2], new RegExp('R\\$ ' + sdo)); ok(`caixa do dia soma entradas, saídas e saldo em centavos (${eIn} / ${sOut} / ${sdo})`);
  await c.clicarTexto('.tela-acoes button', 'Nova entrada'); await abrirDialog();
  await campo('descricao', 'Teste entrada'); await campo('valorCents', '1.234,50'); await campo('forma', 'dinheiro'); await salvarDialog(); await dormir(300);
  const cartoes2 = await c.avaliar(`[...document.querySelectorAll('.resumo-card')].map(e => e.textContent.replace(/\\s+/g,' ').trim())`);
  const novoSaldo = diag ? '1\\.619,00' : loja ? '1\\.488,90' : '1\\.399,00';
  assert.match(cartoes2[2], new RegExp('R\\$ ' + novoSaldo)); ok('lançamento novo com vírgula e milhar atualiza o saldo (' + novoSaldo.replace('\\', '') + ')');
  await c.clicarTexto('.tela-acoes button', 'Nova saída'); await abrirDialog();
  await campo('descricao', 'Valor ruim'); await campo('valorCents', 'abc'); await campo('forma', 'pix'); await salvarDialog();
  assert.match(await texto('dialog.modal[open] .erro-form'), /Valor inválido/); ok('valor mal digitado é recusado'); await fecharDialogs();
  await tirar('09-caixa');

  /* ---------- venda no balcão (clínica com loja): preço por item, "Registrar venda" dá baixa e lança no caixa ---------- */
  if (loja) {
    await irPara('estoque', tituloEstoque);
    assert.match(await texto('.tela'), /Preço de venda/); assert.match(await texto('.tela'), /À venda \(3\)/); ok('estoque da loja: coluna "Preço de venda" e filtro "À venda (3)"');
    await c.clicarTexto('.chip-botao', 'À venda'); await dormir(200); assert.equal(await contar('.tabela tbody tr'), 3); await c.clicarTexto('.chip-botao', 'Todos'); await dormir(200);
    await c.clicarTexto('.tabela tbody tr', 'Seringa'); await abrirDialog();
    assert.ok(!(await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].some(b => b.textContent === 'Registrar venda')`))); ok('item sem preço de venda não tem "Registrar venda"'); await fecharDialogs();
    await c.clicarTexto('.tabela tbody tr', 'Ração para cães'); await abrirDialog();
    assert.match(await texto('dialog.modal[open] .modal-corpo'), /Preço de venda\s*R\$ 89,90/);
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar venda'); await abrirDialog();
    await campo('qtd', '99'); await salvarDialog('Registrar venda');
    assert.match(await texto('dialog.modal[open] .erro-form'), /maior que o estoque \(14\)/); ok('venda acima do saldo é recusada com mensagem clara e nada muda');
    assert.equal((await c.avaliar(`Painel.ctx.store.obter('estoque', 'ex-est-6')`)).quantidade, 14);
    await campo('qtd', '2'); await campo('forma', 'dinheiro'); await salvarDialog('Registrar venda'); await dormir(400);
    assert.match(await c.avaliar(`[...document.querySelectorAll('.toast')].map(t => t.textContent).join('|')`), /Venda registrada: R\$ 179,80\. Estoque: 12 pacote/); ok('venda de 2 pacotes: 14 para 12 e valor preço x quantidade (179,80)');
    const mov = await c.avaliar(`Painel.ctx.store.listar('movimentos')`), lanc = await c.avaliar(`Painel.ctx.store.listar('lancamentos')`);
    assert.ok(mov.some((m) => m.itemId === 'ex-est-6' && m.tipo === 'saida' && m.qtd === 2 && m.motivo === 'Venda no balcão' && m.exemplo === true)); // item de exemplo: a venda também é de exemplo ("Remover exemplos" a leva junto)
    assert.ok(lanc.some((l) => l.descricao === 'Venda: Ração para cães (exemplo) × 2' && l.valorCents === 17980 && l.forma === 'dinheiro' && l.categoria === 'Venda de produtos' && l.itemId === 'ex-est-6' && l.tipo === 'entrada' && l.exemplo === true)); ok('a venda deixou a saída no histórico do item e a entrada no caixa');
    await c.clicarTexto('.tabela tbody tr', 'Ração para cães'); await abrirDialog(); await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar venda'); await abrirDialog();
    await campo('qtd', '1'); await campo('valorCents', '80,00'); await campo('forma', 'pix'); await salvarDialog('Registrar venda'); await dormir(400);
    assert.ok((await c.avaliar(`Painel.ctx.store.listar('lancamentos')`)).some((l) => l.descricao === 'Venda: Ração para cães (exemplo) × 1 (valor combinado; tabela R$ 89,90)' && l.valorCents === 8000 && l.forma === 'pix')); ok('valor combinado no balcão (80,00) vale no lugar de preço x quantidade e a descrição guarda o valor de tabela');
    // corrida: o saldo mudou em outra aba depois de o formulário abrir; a venda confere o registro ATUAL
    await c.clicarTexto('.tabela tbody tr', 'Coleira'); await abrirDialog(); await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar venda'); await abrirDialog();
    await c.avaliar(`(async () => { const st = Painel.ctx.store, i = await st.obter('estoque', 'ex-est-7'); await st.salvar('estoque', Object.assign({}, i, { quantidade: 1 })); })()`);
    await campo('qtd', '3'); await salvarDialog('Registrar venda');
    assert.match(await texto('dialog.modal[open] .erro-form'), /maior que o estoque \(1\)/); ok('corrida: saldo mudou depois de abrir o formulário e a venda é recusada pelo saldo atual');
    await c.avaliar(`Painel.ctx.store.remover('estoque', 'ex-est-7')`); await dormir(100);
    await campo('qtd', '1'); await salvarDialog('Registrar venda');
    assert.match(await texto('dialog.modal[open] .erro-form'), /removido do estoque/); ok('corrida: item removido em outra aba não vende'); await fecharDialogs();
    await irPara('caixa', 'Caixa'); assert.match(await texto('.tela'), /Venda: Ração para cães \(exemplo\) × 2/); ok('as vendas aparecem no caixa');
    await irPara('estoque', tituloEstoque); await c.clicarTexto('.tabela tbody tr', 'Vermífugo'); await abrirDialog(); await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Editar item'); await abrirDialog();
    await campo('precoVendaCents', 'abc'); await salvarDialog(); assert.match(await texto('dialog.modal[open] .erro-form'), /Valor inválido/);
    await campo('precoVendaCents', '0,00'); await salvarDialog(); assert.match(await texto('dialog.modal[open] .erro-form'), /maior que zero/);
    await campo('precoVendaCents', '27,50'); await salvarDialog(); await dormir(300);
    assert.equal((await c.avaliar(`Painel.ctx.store.obter('estoque', 'ex-est-3')`)).precoVendaCents, 2750); ok('preço de venda: texto e zero são recusados; 27,50 vira 2750 centavos');
    await tirar('09b-estoque-loja');
  }

  /* ---------- profissionais e serviços, configurações ---------- */
  await irPara('equipe', 'Profissionais e');
  assert.equal(await contar('.tabela'), 2); assert.equal(await contar('.tabela tbody tr'), diag ? 6 : 7); ok(diag ? 'equipe: 3 profissionais e 3 exames oferecidos' : 'equipe: 3 profissionais e 4 serviços');
  await tirar('10-equipe');
  await irPara('config', 'Configurações');
  assert.match(await texto('.tela'), /barreira de interface, não segurança real/); ok('configurações repetem o limite do login');
  await tirar('11-config');

  /* ---------- perfis: veterinário e recepção ---------- */
  await c.clicarTexto('button', 'Novo acesso'); await abrirDialog();
  await campo('nome', 'Vet Teste'); await campo('usuario', 'vet'); await campo('perfil', 'veterinario'); await campo('senha', 'provisoria-1'); await salvarDialog(); await dormir(400);
  await c.clicarTexto('button', 'Novo acesso'); await abrirDialog();
  await campo('nome', 'Recep Teste'); await campo('usuario', 'recep'); await campo('perfil', 'recepcao'); await campo('senha', 'provisoria-2'); await salvarDialog(); await dormir(400);
  assert.equal(await contar('.tabela tbody tr'), 3); ok('acessos de veterinário e recepção criados com senha provisória');
  await sair();
  await entrar('vet', 'provisoria-1');
  assert.equal(await texto('h1'), 'Defina a sua senha'); ok('senha provisória obriga a trocar no primeiro acesso');
  await c.digitar('[name="nova"]', 'definitiva-vet-1'); await c.digitar('[name="conf"]', 'definitiva-vet-1');
  await c.avaliar(`document.querySelector('.login-form').requestSubmit()`);
  await c.esperar('document.getElementById("titulo-tela")');
  const menuVet = await c.avaliar(`[...document.querySelectorAll('.lateral nav a')].map(a => a.textContent)`);
  assert.deepEqual(menuVet, diag ? ['Início', 'Agenda de exames', 'Tutores e pets', 'Exames e laudos', 'Encaminhadores', 'Estoque'] : ['Início', 'Agenda', 'Tutores e pets', 'Prontuários', ...(hospital ? ['Internação e plantão'] : []), 'Vacinas e retornos', tituloEstoque]); ok('veterinário vê: ' + menuVet.join(', '));
  if (loja) {
    await irPara('estoque', tituloEstoque); await c.clicarTexto('.tabela tbody tr', 'Ração para cães'); await abrirDialog();
    const botoesVet = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].map(b => b.textContent)`);
    assert.ok(!botoesVet.includes('Registrar venda') && botoesVet.includes('Editar item'), botoesVet.join(', ')); ok('veterinário edita o item (inclusive o preço) mas não registra venda: a venda é do balcão (dono e recepção)'); await fecharDialogs();
  }
  await c.avaliar(`location.hash = '#/caixa'`); await dormir(500);
  assert.equal(await c.avaliar('location.hash'), '#/inicio'); ok('veterinário não entra em Caixa pela URL (volta ao início)');
  if (hospital) {
    await irPara('internacao', 'Internação e plantão');
    assert.ok((await contar('.tela-acoes button')) >= 2); assert.equal(await contar('.leito'), 5); ok('veterinário opera a internação (internar, observar, encerrar)');
    await c.clicarTexto('.leito--ocupado .leito-corpo', 'Fred'); await abrirDialog();
    assert.equal(await contar('dialog.modal[open] .modal-rodape .btn-perigo'), 0); ok('veterinário não vê "Excluir internação" (só o dono)'); await fecharDialogs();
    await c.avaliar(`location.hash = '#/inicio'`); await dormir(400);
    assert.match(await texto('.resumo-grade'), /Internados agora/); assert.match(await texto('.resumo-grade'), /No plantão agora/); ok('Início do veterinário mostra internados e plantão');
  }
  if (diag) {
    await irPara('exames', 'Exames e laudos');
    await c.clicarTexto('.chip-botao', 'Aguardando laudo'); await dormir(250);
    await c.clicarTexto('.tabela tbody tr', S.pets[1].nome); await abrirDialog();
    assert.ok(await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].some(b => b.textContent === 'Registrar laudo')`));
    assert.equal(await contar('dialog.modal[open] .modal-rodape .btn-perigo'), 0); ok('veterinário registra laudo, mas não exclui exame (só o dono)'); await fecharDialogs();
    await c.clicarTexto('.chip-botao', 'Para entregar'); await dormir(250);
    await c.clicarTexto('.tabela tbody tr', S.pets[0].nome); await abrirDialog();
    assert.match(await texto('dialog.modal[open] .modal-corpo'), /Texto fictício de laudo/); assert.match(await texto('dialog.modal[open] .modal-corpo'), /Indicação fictícia/); assert.equal(await contar('dialog.modal[open] a[href^="https://wa.me/55"]'), 1);
    ok('veterinário lê indicação e laudo; o aviso de laudo pronto ao tutor é um link wa.me com a mensagem pronta'); await fecharDialogs();
    await irPara('encaminhadores', 'Encaminhadores'); assert.equal(await contar('.tela-acoes button'), 0); await c.clicarTexto('.tabela tbody tr', 'Clínica Exemplo A'); await abrirDialog();
    assert.equal(await contar('dialog.modal[open] form'), 0); ok('veterinário só consulta os encaminhadores (sem botão de cadastro e sem formulário)'); await fecharDialogs();
    await c.avaliar(`location.hash = '#/inicio'`); await dormir(400);
    assert.match(await texto('.resumo-grade'), /Aguardando laudo/); ok('Início do veterinário mostra a fila de exames');
  }
  await sair();
  await entrar('recep', 'provisoria-2');
  await c.digitar('[name="nova"]', 'definitiva-rec-1'); await c.digitar('[name="conf"]', 'definitiva-rec-1');
  await c.avaliar(`document.querySelector('.login-form').requestSubmit()`);
  await c.esperar('document.getElementById("titulo-tela")');
  const menuRec = await c.avaliar(`[...document.querySelectorAll('.lateral nav a')].map(a => a.textContent)`);
  const leitosRec = hospital && pc.matriz && pc.matriz.recepcao && pc.matriz.recepcao.internacao === 'r'; // opção recepcao_ve_leitos (v0.7): a recepção só LÊ o mapa de leitos
  assert.deepEqual(menuRec, diag ? ['Início', 'Agenda de exames', 'Tutores e pets', 'Exames e laudos', 'Encaminhadores', 'Caixa', 'Estoque'] : ['Início', 'Agenda', 'Tutores e pets', ...(leitosRec ? ['Leitos'] : []), 'Vacinas e retornos', 'Caixa', tituloEstoque]); ok('recepção vê: ' + menuRec.join(', '));
  await c.avaliar(`location.hash = '#/prontuarios'`); await dormir(500);
  assert.equal(await c.avaliar('location.hash'), '#/inicio'); ok('recepção não acessa Prontuários');
  if (leitosRec) {
    assert.match(await texto('.resumo-grade'), /Internados agora/); assert.doesNotMatch(await texto('.resumo-grade'), /plantão agora/); ok('Início da recepção mostra quantos estão internados e leitos livres, sem o plantão');
    await irPara('internacao', 'Quem está em cada leito');
    const tela = await texto('.tela');
    for (const idPet of ['ex-pet-3', 'ex-pet-2', 'ex-pet-5']) { const nomePet = S.pets.find((p) => p.id === idPet).nome; assert.ok(tela.includes(nomePet), 'a tela mostra o paciente ' + nomePet); }
    const ativas = await c.avaliar(`Painel.ctx.store.listar('internacoes').then(l => l.filter(i => i.status !== 'encerrada').length)`), leitosN = await c.avaliar(`Painel.ctx.store.listar('leitos').then(l => l.length)`);
    assert.equal(await contar('.leito--ocupado'), ativas); assert.equal(await contar('.leito'), leitosN); assert.ok(ativas >= 3);
    assert.equal(await contar('.tela-acoes button, .leito button, .abas [role="tab"]'), 0); ok(`recepção vê o mapa de leitos (${ativas} de ${leitosN} ocupados) sem botão nenhum: só leitura, sem abas de internações nem de plantão`);
    for (const segredo of ['Observação após procedimento', 'Acompanhamento de hidratação', 'Monitoramento', 'Em observação', 'Requer atenção', 'Estável', 'Passagem de plantão', 'Entrou calmo', 'Uso reservado', 'Responsável', 'Previsão de alta']) assert.ok(!tela.includes(segredo), 'a recepção não pode ler: ' + segredo);
    ok('nada clínico no DOM da recepção: motivo, situação, previsão, responsável, observações, plantão e a observação do leito ficam de fora');
    await tirar('06g-leitos-recepcao');
    await c.avaliar(`location.hash = '#/inicio'`); await dormir(300);
  } else if (hospital) {
    await c.avaliar(`location.hash = '#/internacao'`); await dormir(500);
    assert.equal(await c.avaliar('location.hash'), '#/inicio'); assert.doesNotMatch(await texto('.resumo-grade'), /Internados agora|plantão agora/); ok('recepção não acessa Internação (nem pela URL) e o Início dela não mostra internados');
  }
  if (diag) {
    await c.avaliar(`location.hash = '#/laudos'`); await dormir(500);
    assert.equal(await c.avaliar('location.hash'), '#/inicio'); ok('"laudos" não é uma tela: a URL volta ao início');
    await irPara('exames', 'Exames e laudos');
    assert.match(await texto('.nota-restrita'), /só a situação do exame/);
    await c.clicarTexto('.chip-botao', 'Para entregar'); await dormir(250);
    await c.clicarTexto('.tabela tbody tr', S.pets[0].nome); await abrirDialog();
    const corpo = await texto('dialog.modal[open] .modal-corpo');
    assert.doesNotMatch(corpo, /Texto fictício de laudo|Indicação fictícia/); assert.match(corpo, /só o dono e o veterinário veem/);
    assert.equal(await contar('dialog.modal[open] .laudo-texto'), 0); assert.doesNotMatch(await c.avaliar('document.body.textContent'), /Texto fictício de laudo|Indicação fictícia/);
    const botoes = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].map(b => b.textContent)`);
    assert.ok(botoes.includes('Registrar entrega') && botoes.includes('Editar')); assert.ok(!botoes.some((b) => /laudo|realização|Excluir/.test(b)), botoes.join(', '));
    ok('recepção vê a situação do exame sem ler indicação nem laudo (nem no DOM) e só tem os botões dela: entrega, edição, agenda'); await tirar('06f-exame-recepcao');
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Editar'); await abrirDialog();
    assert.equal(await contar('dialog.modal[open] [name="laudo"]'), 0); assert.equal(await contar('dialog.modal[open] [name="indicacao"]'), 0);
    await campo('obs', 'Tutor retira à tarde'); await salvarDialog(); await c.esperar('document.querySelector("dialog.modal[open] .dl-ficha")'); await dormir(200);
    const guardado = await c.avaliar(`Painel.ctx.store.obter('exames', 'ex-exa-2')`);
    assert.equal(guardado.obs, 'Tutor retira à tarde'); assert.match(guardado.laudo, /Texto fictício de laudo/); assert.match(guardado.indicacao, /Indicação fictícia/); ok('a recepção edita o exame sem apagar o laudo e a indicação que ela não lê');
    const hojeR = await c.avaliar('Regras.hojeISO()');
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar entrega'); await abrirDialog();
    await campo('entregueEm', hojeR + 'T23:40'); await campo('entregaVia', 'retirado na recepção'); await salvarDialog('Registrar entrega'); await c.esperar('document.querySelector("dialog.modal[open] .dl-ficha")'); await dormir(200);
    const entregue = await c.avaliar(`Painel.ctx.store.obter('exames', 'ex-exa-2')`); assert.equal(entregue.status, 'entregue'); assert.match(entregue.laudo, /Texto fictício de laudo/); ok('a recepção registra a entrega; o laudo continua guardado'); await fecharDialogs();
    await c.avaliar(`window.__baixado = []; UI.baixar = (nome, conteudo) => window.__baixado.push([nome, conteudo]);`);
    await irPara('tutores', 'Tutores e pets'); await c.clicarTexto('.tabela tbody tr', 'Ana Exemplo'); await abrirDialog();
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Exportar dados deste tutor'); await dormir(500);
    const arq = await c.avaliar('window.__baixado[0][1]'); const dump = JSON.parse(arq);
    assert.doesNotMatch(arq, /Texto fictício de laudo|Indicação fictícia/); assert.ok(dump.omitidos.includes('laudos')); assert.ok(dump.dados.exames.length >= 2); assert.equal(dump.dados.exames[0].laudo, undefined);
    ok('arquivo do tutor para a recepção leva os exames sem laudo nem indicação e diz que omitiu "laudos"'); await fecharDialogs();
    await c.avaliar(`location.hash = '#/inicio'`); await dormir(400);
    assert.match(await texto('.resumo-grade'), /Para entregar/); assert.doesNotMatch(await texto('.tela'), /Texto fictício de laudo/); ok('Início da recepção mostra a fila (agendar, laudo, entrega) sem conteúdo clínico');
  }
  if (!diag) { await irPara('vacinas', 'Vacinas e retornos');
  assert.equal(await contar('.tela-acoes button'), 0); ok('recepção só consulta vacinas (sem botão de registrar)'); }
  if (loja) {
    await irPara('estoque', tituloEstoque); assert.equal(await contar('.tela-acoes button'), 0); ok('recepção só lê o estoque (sem "Novo item")');
    const antes = (await c.avaliar(`Painel.ctx.store.listar('lancamentos')`)).length;
    await c.clicarTexto('.tabela tbody tr', 'Vermífugo'); await abrirDialog();
    const botoesRec = await c.avaliar(`[...document.querySelectorAll('dialog.modal[open] .modal-rodape button')].map(b => b.textContent)`);
    assert.deepEqual(botoesRec, ['Registrar venda'], botoesRec.join(', ')); ok('recepção só tem "Registrar venda" no item (nada de editar preço, entrada, saída nem ajuste)');
    await c.clicarTexto('dialog.modal[open] .modal-rodape button', 'Registrar venda'); await abrirDialog(); await campo('qtd', '2'); await salvarDialog('Registrar venda'); await dormir(400);
    const depois = await c.avaliar(`Painel.ctx.store.listar('lancamentos')`);
    assert.equal(depois.length, antes + 1); assert.ok(depois.some((l) => l.descricao === 'Venda: Vermífugo (exemplo) × 2' && l.valorCents === 5500 && l.categoria === 'Venda de produtos')); ok('recepção registra a venda (2 vermífugos a 27,50 = 55,00) e o caixa recebe a entrada');
  }
  await irPara('caixa', 'Caixa'); assert.equal(await contar('.tela-acoes button'), 2); ok('recepção opera o caixa');
  await sair();
  await entrar('dona', 'senha-errada-1');
  assert.match(await texto('.erro-form'), /incorretos/); ok('senha errada é recusada');
  await entrar('dona', 'senha-segura-1'); await c.esperar('document.getElementById("titulo-tela")');
  await semErros();

  /* ---------- remover exemplos mantém o que o usuário cadastrou ---------- */
  await c.clicarTexto('.banner-exemplo button', 'Remover dados de exemplo'); await abrirDialog(); await salvarDialog('Remover'); await dormir(500);
  await irPara('tutores', 'Tutores e pets'); await c.clicarTexto('.aba', 'Tutores'); await dormir(200);
  assert.equal(await contar('.tabela tbody tr'), 1); assert.match(await texto('.tabela'), /Elisa Teste/); ok('remover exemplos preservou o tutor real (Elisa Teste)');
  assert.equal(await contar('.banner-exemplo:not([hidden])'), 0);

  /* ---------- IndexedDB como adaptador alternativo ---------- */
  const idb = await c.avaliar(`(async () => {
    const s = Store.criarStore(Store.adaptadorIndexedDB('teste-' + Date.now()));
    const a = await s.salvar('tutores', { nome: 'Idb' });
    const antes = (await s.listar('tutores')).length;
    await s.remover('tutores', a.id);
    return [antes, (await s.listar('tutores')).length];
  })()`);
  assert.deepEqual(idb, [1, 0]); ok('adaptador IndexedDB grava, lista e remove');
  await semErros();

  /* ---------- toggle: gestão desligada ---------- */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toggle-'));
  fs.cpSync(pasta, tmp, { recursive: true });
  const cfgArq = path.join(tmp, 'assets/site-config.js');
  const linhaModulos = semVitrine ? '{ vitrine: false, gestao: true }' : '{ vitrine: true, gestao: true }';
  assert.ok(fs.readFileSync(cfgArq, 'utf8').includes(linhaModulos), 'site-config.js do site testado deve estar com gestao:true');
  fs.writeFileSync(cfgArq, fs.readFileSync(cfgArq, 'utf8').replace(linhaModulos, linhaModulos.replace('gestao: true', 'gestao: false')));
  const srv2 = await servir(tmp);
  await c.emular(1280, 800);
  if (!semVitrine) {
    await c.navegar(srv2.url + 'index.html', 400);
    assert.equal(await contar('[data-modulo="gestao"]'), 0); assert.equal(await contar('a[href*="painel"]'), 0); ok('gestao:false esconde o link do painel na vitrine');
  }
  await c.navegar(srv2.url + 'painel/', 400);
  assert.equal(await texto('h1'), 'Módulo de gestão não contratado'); assert.equal(await contar('input'), 0); ok('gestao:false: painel/ mostra "Módulo de gestão não contratado" e não carrega o login');
  assert.equal(await contar('.aviso-modulo a.btn'), semVitrine ? 0 : 1); assert.equal(await contar('.aviso-modulo .login-credito a[href="https://andremachado.design"][target="_blank"][rel="noopener"]'), 1); // v1.3: o crédito também aqui
  ok(semVitrine ? 'sem vitrine e sem gestão: o aviso não oferece "Voltar ao site" (não há site)' : 'com vitrine: o aviso oferece "Voltar ao site"');
  await c.navegar(srv2.url + 'painel/app.html', 400);
  assert.equal(await texto('h1'), 'Módulo de gestão não contratado'); ok('gestao:false também bloqueia painel/app.html');
  await tirar('12-gestao-desligada');
  srv2.fechar(); fs.rmSync(tmp, { recursive: true, force: true });
  if (!semVitrine) {
    await c.navegar(base + 'index.html', 400);
    assert.equal(await contar('[data-modulo="gestao"]'), 1); ok('gestao:true mostra o acesso da equipe no rodapé da vitrine');
  }
  await semErros();
  console.log(`\nE2E: ${passos.length} verificações passaram.`);
} catch (e) {
  console.error('\nFALHOU:', e.message);
  console.error('console do navegador:', c.console.slice(-8));
  try { if (fotos) await c.foto(path.join(fotos, 'falha.png'), { pagina: false }); } catch (x) { /* ok */ }
  process.exitCode = 1;
} finally { await c.fechar(); srv.fechar(); }
