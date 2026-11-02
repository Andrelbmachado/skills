// Testes unitários do painel (módulos puros) e da vitrine. Rodar: node --test .claude/skills/site-veterinaria/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const R = require(path.join(aqui, '../painel/js/regras.js'));
const Store = require(path.join(aqui, '../painel/js/store.js'));
const Auth = require(path.join(aqui, '../painel/js/auth.js'));
const Seed = require(path.join(aqui, '../painel/js/seed.js'));
const Vitrine = require(path.join(aqui, '../components/vitrine.js'));

/* ---------- datas, retornos, idade ---------- */
test('datas: somar dias, diferença, semana começa na segunda', () => {
  assert.equal(R.somarDias('2026-10-22', 10), '2026-11-01');
  assert.equal(R.somarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(R.somarDias('2028-02-28', 1), '2028-02-29');
  assert.equal(R.diffDias('2026-10-22', '2026-12-25'), 64);
  assert.equal(R.inicioDaSemana('2026-10-22'), '2026-10-19'); // quinta -> segunda
  assert.equal(R.inicioDaSemana('2026-10-25'), '2026-10-19'); // domingo -> segunda anterior
});
test('próxima dose e status do retorno', () => {
  assert.equal(R.proximaDose('2026-01-10', 365), '2027-01-10');
  assert.equal(R.proximaDose('2026-01-10', 0), null);
  assert.equal(R.proximaDose('2026-01-10', 'abc'), null);
  assert.deepEqual(R.statusRetorno('2026-10-20', '2026-10-22'), { codigo: 'vencido', dias: -2 });
  assert.equal(R.statusRetorno('2026-10-22', '2026-10-22').codigo, 'hoje');
  assert.equal(R.statusRetorno('2026-10-29', '2026-10-22').codigo, 'em_breve');
  assert.equal(R.statusRetorno('2026-10-30', '2026-10-22').codigo, 'futuro');
});
test('idade do pet', () => {
  assert.equal(R.idade('2024-01-15', '2026-10-22').texto, '2 anos e 9 meses');
  assert.equal(R.idade('2026-10-01', '2026-10-22').texto, 'menos de 1 mês');
  assert.equal(R.idade('2026-08-22', '2026-10-22').texto, '2 meses');
  assert.equal(R.idade('2025-10-22', '2026-10-22').texto, '1 ano');
  assert.equal(R.idade('', '2026-10-22'), null);
  assert.equal(R.idade('2027-01-01', '2026-10-22'), null);
});

/* ---------- dinheiro e CSV ---------- */
test('dinheiro: parse e formatação em centavos', () => {
  assert.equal(R.parseBRL('1.234,56'), 123456);
  assert.equal(R.parseBRL('R$ 12,5'), 1250);
  assert.equal(R.parseBRL('12'), 1200);
  assert.equal(R.parseBRL('12.50'), 1250);
  assert.equal(R.parseBRL('1.200'), 120000);
  assert.ok(Number.isNaN(R.parseBRL('abc')));
  assert.ok(Number.isNaN(R.parseBRL('12,345')));
  assert.ok(Number.isNaN(R.parseBRL('-5')));
  assert.equal(R.formatBRL(123456), 'R$ 1.234,56');
  assert.equal(R.formatBRL(5), 'R$ 0,05');
  assert.equal(R.formatBRL(-4550), '-R$ 45,50');
});
test('caixa: resumo por forma de pagamento', () => {
  const r = R.resumoCaixa([
    { tipo: 'entrada', valorCents: 12000, forma: 'pix' }, { tipo: 'entrada', valorCents: 9000, forma: 'pix' },
    { tipo: 'saida', valorCents: 4550, forma: 'dinheiro' }]);
  assert.equal(r.entradas, 21000); assert.equal(r.saidas, 4550); assert.equal(r.saldo, 16450);
  assert.deepEqual(r.porForma.pix, { entradas: 21000, saidas: 0 });
});
test('CSV: aspas, ponto e vírgula e proteção contra fórmula', () => {
  const csv = R.paraCSV([{ rotulo: 'a', valor: (x) => x.a }, { rotulo: 'b', valor: (x) => x.b }], [{ a: 'x;y', b: '=1+1' }, { a: 'diz "oi"', b: 'ok' }]);
  const linhas = csv.replace('﻿', '').split('\r\n');
  assert.equal(linhas[0], 'a;b');
  assert.equal(linhas[1], '"x;y";\'=1+1');
  assert.equal(linhas[2], '"diz ""oi""";ok');
});

/* ---------- estoque ---------- */
test('estoque: baixo, vencendo, vencido e movimentos', () => {
  const h = '2026-10-22';
  assert.equal(R.estoqueStatus({ quantidade: 3, minimo: 5 }, h).baixo, true);
  assert.equal(R.estoqueStatus({ quantidade: 6, minimo: 5 }, h).baixo, false);
  assert.equal(R.estoqueStatus({ quantidade: 6, minimo: '' }, h).baixo, false);
  assert.equal(R.estoqueStatus({ quantidade: 1, validade: '2026-10-17' }, h).vencido, true);
  assert.equal(R.estoqueStatus({ quantidade: 1, validade: '2026-11-10' }, h).vencendo, true);
  assert.equal(R.estoqueStatus({ quantidade: 1, validade: '2027-03-10' }, h).vencendo, false);
  assert.equal(R.aplicarMovimento(5, { tipo: 'entrada', qtd: 3 }), 8);
  assert.equal(R.aplicarMovimento(5, { tipo: 'saida', qtd: 5 }), 0);
  assert.equal(R.aplicarMovimento(5, { tipo: 'ajuste', qtd: 2 }), 2);
  assert.throws(() => R.aplicarMovimento(5, { tipo: 'saida', qtd: 6 }), /maior que o estoque/);
  assert.throws(() => R.aplicarMovimento(5, { tipo: 'entrada', qtd: -1 }), /inválida/);
});

/* ---------- agenda ---------- */
const base = [
  { id: 'a', petId: 'p1', profissionalId: 'v1', inicio: '2026-10-22T09:00', duracaoMin: 30, status: 'agendada' },
  { id: 'b', petId: 'p2', profissionalId: 'v2', inicio: '2026-10-22T09:15', duracaoMin: 30, status: 'agendada' },
  { id: 'c', petId: 'p3', profissionalId: 'v1', inicio: '2026-10-22T10:00', duracaoMin: 30, status: 'cancelada' }
];
test('agenda: conflito por profissional e por pet, ignora canceladas', () => {
  assert.equal(R.temConflito(base, { petId: 'p9', profissionalId: 'v1', inicio: '2026-10-22T09:20', duracaoMin: 30 }).tipo, 'profissional');
  assert.equal(R.temConflito(base, { petId: 'p1', profissionalId: 'v3', inicio: '2026-10-22T09:10', duracaoMin: 30 }).tipo, 'pet');
  assert.equal(R.temConflito(base, { petId: 'p9', profissionalId: 'v1', inicio: '2026-10-22T09:30', duracaoMin: 30 }), null); // encostado não conflita
  assert.equal(R.temConflito(base, { petId: 'p9', profissionalId: 'v1', inicio: '2026-10-22T10:00', duracaoMin: 30 }), null); // cancelada libera
  assert.equal(R.temConflito(base, { id: 'a', petId: 'p1', profissionalId: 'v1', inicio: '2026-10-22T09:00', duracaoMin: 45 }), null); // editar a si mesma
  assert.equal(R.temConflito(base, { petId: 'p9', profissionalId: 'v1', inicio: '2026-10-23T09:00', duracaoMin: 30 }), null); // outro dia
});
test('agenda: layout em colunas para consultas sobrepostas', () => {
  const l = R.layoutDia(base.slice(0, 2).concat([{ id: 'd', petId: 'p4', profissionalId: 'v1', inicio: '2026-10-22T11:00', duracaoMin: 30, status: 'agendada' }]));
  const por = Object.fromEntries(l.map((x) => [x.consulta.id, x]));
  assert.equal(por.a.lanes, 2); assert.equal(por.b.lanes, 2); assert.notEqual(por.a.lane, por.b.lane);
  assert.equal(por.d.lanes, 1); assert.equal(por.d.lane, 0);
});
test('agenda: horários livres respeitam o profissional', () => {
  const livres = R.horariosLivres(base, { data: '2026-10-22', profissionalId: 'v1', abertura: '08:30', fechamento: '10:30', duracao: 30, passo: 30 });
  assert.deepEqual(livres, ['08:30', '09:30', '10:00']); // 09:00 ocupado por v1; 10:00 liberado (cancelada)
  const outro = R.horariosLivres(base, { data: '2026-10-22', profissionalId: 'v9', abertura: '09:00', fechamento: '10:00', duracao: 30, passo: 30 });
  assert.deepEqual(outro, ['09:00', '09:30']);
});

/* ---------- lembretes ---------- */
test('lembretes: agrupa vacinas e retornos, ignora atendidos, dispensados e pet falecido', () => {
  const hoje = '2026-10-22';
  const pets = [{ id: 'p1', tutorId: 't1', nome: 'Bidu' }, { id: 'p2', tutorId: 't1', nome: 'Mel', falecido: true }, { id: 'p3', tutorId: 't2', nome: 'Thor' }];
  const vacinas = [
    { id: 'v1', petId: 'p1', vacina: 'V10', dataAplicacao: '2025-10-27', proximaDose: '2026-10-27' },
    { id: 'v2', petId: 'p1', vacina: 'Antirrábica', dataAplicacao: '2025-09-01', proximaDose: '2026-09-01' },
    { id: 'v3', petId: 'p1', vacina: 'antirrabica', dataAplicacao: '2026-09-10', proximaDose: '2027-09-10' }, // atende v2
    { id: 'v4', petId: 'p2', vacina: 'V4', dataAplicacao: '2025-10-01', proximaDose: '2026-10-25' }, // pet falecido
    { id: 'v5', petId: 'p3', vacina: 'V10', dataAplicacao: '2025-10-01', proximaDose: '2026-10-22' } // dispensada
  ];
  const prontuarios = [
    { id: 'r1', petId: 'p3', data: '2026-10-10', retornoEm: '2026-10-20', queixa: 'Coceira' },
    { id: 'r2', petId: 'p1', data: '2026-10-01', retornoEm: '2026-10-15', queixa: 'Tosse' },
    { id: 'r3', petId: 'p1', data: '2026-10-16', retornoEm: '', queixa: 'Retorno de tosse' } // atende r2
  ];
  const lembretes = [{ chave: 'vacina:v5', dispensado: true }, { chave: 'vacina:v1', enviadoEm: '2026-10-21T10:00:00Z' }];
  const l = R.agruparRetornos({ hoje, pets, tutores: [], vacinas, prontuarios, lembretes });
  assert.deepEqual(l.map((x) => x.chave), ['retorno:r1', 'vacina:v1', 'vacina:v3']);
  assert.equal(l[0].status.codigo, 'vencido');
  assert.equal(l[1].status.codigo, 'em_breve'); assert.ok(l[1].enviadoEm);
  assert.equal(l[0].tutorId, 't2');
});
test('lembrete por WhatsApp: telefone e mensagem', () => {
  assert.equal(R.normalizaTelefone('(15) 99106-1211'), '5515991061211');
  assert.equal(R.normalizaTelefone('+55 15 3226-2888'), '551532262888');
  assert.equal(R.normalizaTelefone('123'), null);
  assert.equal(R.linkWhats('(15) 99106-1211', 'Olá, tudo bem?'), 'https://wa.me/5515991061211?text=Ol%C3%A1%2C%20tudo%20bem%3F');
  assert.equal(R.linkWhats('', 'x'), null);
  assert.equal(R.montarMensagem('Oi {tutor}, {pet} {nada}', { tutor: 'Ana', pet: 'Bidu' }), 'Oi Ana, Bidu {nada}');
});

/* ---------- perfis ---------- */
test('perfis: o que cada um enxerga e pode fazer', () => {
  assert.deepEqual(R.modulosDoPerfil('dono'), R.MODULOS);
  assert.deepEqual(R.modulosDoPerfil('veterinario'), ['inicio', 'agenda', 'tutores', 'prontuarios', 'vacinas', 'estoque']);
  assert.deepEqual(R.modulosDoPerfil('recepcao'), ['inicio', 'agenda', 'tutores', 'vacinas', 'caixa', 'estoque']);
  assert.equal(R.permissao('recepcao', 'prontuarios'), null);
  assert.equal(R.podeEscrever('recepcao', 'vacinas'), false);
  assert.equal(R.podeEscrever('recepcao', 'caixa'), true);
  assert.equal(R.podeExcluir('recepcao', 'caixa'), false);
  assert.equal(R.podeExcluir('veterinario', 'prontuarios'), false);
  assert.equal(R.podeExcluir('dono', 'prontuarios'), true);
  assert.equal(R.podeExcluir('recepcao', 'agenda'), true);
  assert.equal(R.permissao('x', 'agenda'), null);
});
test('validações básicas', () => {
  assert.match(R.validarTutor({ nome: ' ' }), /nome/);
  assert.match(R.validarTutor({ nome: 'A', telefone: '12' }), /Telefone/);
  assert.equal(R.validarTutor({ nome: 'A', telefone: '(15) 99106-1211' }), null);
  assert.match(R.validarPet({ nome: 'x', especie: 'Cão' }), /tutor/);
  assert.match(R.validarConsulta({ petId: 'p', profissionalId: 'v', inicio: '2026-10-22', duracaoMin: 30 }), /data e hora/i);
  assert.match(R.validarSenha('curta'), /8 caracteres/);
});

/* ---------- store ---------- */
function falsoLocalStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
for (const [nome, criar] of [['memória', () => Store.adaptadorMemoria()], ['localStorage', () => Store.adaptadorLocalStorage('t', falsoLocalStorage())]]) {
  test(`store (${nome}): salvar, obter, listar, remover, exportar e importar`, async () => {
    const s = Store.criarStore(criar());
    const a = await s.salvar('tutores', { nome: 'Ana' });
    assert.ok(a.id.startsWith('tut_')); assert.ok(a.criadoEm);
    await s.salvar('tutores', { nome: 'Bruno' });
    assert.equal((await s.listar('tutores')).length, 2);
    await s.salvar('tutores', { ...a, nome: 'Ana Maria' });
    assert.equal((await s.listar('tutores')).length, 2); // atualizou, não duplicou
    assert.equal((await s.obter('tutores', a.id)).nome, 'Ana Maria');
    await s.salvar('usuarios', { nome: 'dono', usuario: 'dono' });
    const dump = await s.exportar();
    assert.equal(dump.colecoes.tutores.length, 2);
    assert.equal(dump.colecoes.usuarios, undefined); // contas não saem na exportação
    await s.remover('tutores', a.id);
    assert.equal((await s.listar('tutores')).length, 1);
    await s.limpar('tutores');
    await s.importar(dump);
    assert.equal((await s.listar('tutores')).length, 2);
    assert.equal((await s.listar('usuarios')).length, 1); // importar não apaga contas
    await assert.rejects(s.importar({ x: 1 }), /inválido/);
  });
}
test('store: erro legível quando o localStorage está cheio', async () => {
  const ls = falsoLocalStorage(); ls.setItem = () => { throw new Error('quota'); };
  const s = Store.criarStore(Store.adaptadorLocalStorage('t', ls));
  await assert.rejects(s.salvar('tutores', { nome: 'x' }), /cheio ou bloqueado/);
});

/* ---------- auth ---------- */
test('sha256 em JS puro confere com o do Node', () => {
  for (const t of ['', 'abc', 'senha-forte-123', 'ação ç ü 日本', 'x'.repeat(200)]) {
    assert.equal(Auth.sha256Hex(t), crypto.createHash('sha256').update(t, 'utf8').digest('hex'), t.slice(0, 12));
  }
});
test('auth: primeiro acesso, login, senha errada, usuário inativo, troca de senha', async () => {
  const s = Store.criarStore(Store.adaptadorMemoria());
  assert.equal(await Auth.existeUsuario(s), false);
  const dono = await Auth.criarUsuario(s, { nome: 'Dona', usuario: 'Dona', senha: 'segredo-123', perfil: 'dono' });
  assert.equal(dono.usuario, 'dona'); assert.notEqual(dono.senha.hash.includes('segredo'), true);
  assert.equal((await Auth.autenticar(s, 'DONA', 'segredo-123')).id, dono.id);
  assert.equal(await Auth.autenticar(s, 'dona', 'errada-123'), null);
  assert.equal(await Auth.autenticar(s, 'ninguem', 'segredo-123'), null);
  await assert.rejects(Auth.criarUsuario(s, { nome: 'x', usuario: 'dona', senha: 'outra-senha-1' }), /Já existe/);
  await assert.rejects(Auth.criarUsuario(s, { nome: 'x', usuario: 'ab', senha: 'outra-senha-1' }), /Usuário/);
  await assert.rejects(Auth.criarUsuario(s, { nome: 'x', usuario: 'novo', senha: 'curta' }), /8 caracteres/);
  const func = await Auth.criarUsuario(s, { nome: 'Vet', usuario: 'vet', senha: 'provisoria-1', perfil: 'veterinario', trocarSenha: true });
  assert.equal((await Auth.autenticar(s, 'vet', 'provisoria-1')).trocarSenha, true);
  await Auth.trocarSenha(s, func.id, 'definitiva-9');
  assert.equal(await Auth.autenticar(s, 'vet', 'provisoria-1'), null);
  assert.equal((await Auth.autenticar(s, 'vet', 'definitiva-9')).trocarSenha, false);
  await s.salvar('usuarios', { ...(await s.obter('usuarios', func.id)), ativo: false });
  assert.equal(await Auth.autenticar(s, 'vet', 'definitiva-9'), null);
});
test('auth: senha também confere pelo caminho sem WebCrypto (SHA-256 iterado)', async () => {
  const r = await Auth.novaSenha('minha-senha-1', Auth.ALGO_SHA);
  assert.equal(r.algo, Auth.ALGO_SHA);
  assert.equal(await Auth.conferirSenha('minha-senha-1', r), true);
  assert.equal(await Auth.conferirSenha('minha-senha-2', r), false);
});
test('auth: sessão expira', () => {
  const st = { v: {}, getItem(k) { return this.v[k] ?? null; }, setItem(k, x) { this.v[k] = x; }, removeItem(k) { delete this.v[k]; } };
  Auth.iniciarSessao(st, 'x', { id: 'u1', nome: 'A', usuario: 'a', perfil: 'dono' }, 1000);
  assert.equal(Auth.sessaoAtual(st, 'x', 2000).perfil, 'dono');
  assert.equal(Auth.sessaoAtual(st, 'x', 1000 + 9 * 3600 * 1000), null);
  Auth.encerrarSessao(st, 'x');
  assert.equal(Auth.sessaoAtual(st, 'x', 2000), null);
});

/* ---------- seed ---------- */
test('seed: gera dados consistentes, marcados como exemplo, e remove tudo de volta', async () => {
  const hoje = '2026-10-22';
  const dados = Seed.gerar(hoje);
  const todos = Object.values(dados).flat();
  assert.ok(todos.length > 30);
  assert.ok(todos.every((x) => x.exemplo === true && String(x.id).startsWith('ex-')));
  const ids = (c) => new Set(dados[c].map((x) => x.id));
  assert.ok(dados.pets.every((p) => ids('tutores').has(p.tutorId)));
  assert.ok(dados.consultas.every((c) => ids('pets').has(c.petId) && ids('profissionais').has(c.profissionalId) && ids('servicos').has(c.servicoId)));
  assert.equal(R.validarConsulta(dados.consultas[0]), null);
  // nenhum conflito dentro do próprio exemplo
  for (const c of dados.consultas) assert.equal(R.temConflito(dados.consultas, c), null, c.id);
  const s = Store.criarStore(Store.adaptadorMemoria());
  await s.salvar('tutores', { nome: 'Tutor real' });
  const n = await Seed.carregar(s, hoje);
  assert.equal(n, todos.length);
  assert.equal(await Seed.temExemplo(s), true);
  const r = R.agruparRetornos({ hoje, pets: await s.listar('pets'), tutores: await s.listar('tutores'), vacinas: await s.listar('vacinas'), prontuarios: await s.listar('prontuarios'), lembretes: [] });
  assert.ok(r.some((x) => x.status.codigo === 'vencido') && r.some((x) => x.status.codigo === 'em_breve'));
  await s.salvar('lembretes', { chave: 'vacina:ex-vac-1', enviadoEm: 'x' });
  const removidos = await Seed.remover(s);
  assert.ok(removidos >= n + 1);
  assert.equal(await Seed.temExemplo(s), false);
  assert.equal((await s.listar('tutores')).length, 1); // o real fica
  assert.equal((await s.listar('lembretes')).length, 0);
});

/* ---------- vitrine ---------- */
test('vitrine: mensagem do formulário e leitura do toggle', () => {
  assert.equal(Vitrine.composeMessage('Ana', 'Consulta', 'Oi', 'Família Vet'), 'Olá! Sou Ana e encontrei Família Vet pelo site.\nAssunto: Consulta\nOi');
  assert.equal(Vitrine.composeMessage('', '', '', 'X'), 'Olá! Encontrei X pelo site.');
  assert.deepEqual(Vitrine.modulosAtivos({ modules: { vitrine: true, gestao: false } }), { vitrine: true, gestao: false });
  assert.deepEqual(Vitrine.modulosAtivos({}), { vitrine: true, gestao: false }); // sem configuração: a gestão não liga sozinha
  assert.deepEqual(Vitrine.modulosAtivos(undefined), { vitrine: true, gestao: false });
});

/* ---------- subtipo exóticos: peso em gramas, campos extras e dados de exemplo ---------- */
test('pesoTexto: gramas, kg e prioridade de pesoG', () => {
  assert.equal(R.pesoTexto({ pesoG: 90 }), '90 g');
  assert.equal(R.pesoTexto({ pesoG: 1100 }), '1,1 kg');
  assert.equal(R.pesoTexto({ pesoG: 1234 }), '1,234 kg');
  assert.equal(R.pesoTexto({ pesoKg: 14.5 }), '14,5 kg');
  assert.equal(R.pesoTexto({ pesoG: 420, pesoKg: 14.5 }), '420 g');
  assert.equal(R.pesoTexto({ pesoG: '', pesoKg: '' }), '');
  assert.equal(R.pesoTexto(null), '');
});

test('camposExtras: só os preenchidos, com o rótulo curto', () => {
  const defs = [{ nome: 'ambiente', curto: 'Ambiente', rotulo: 'Ambiente (recinto...)' }, { nome: 'dieta', rotulo: 'Dieta' }, { nome: 'manejo', curto: 'Manejo' }];
  assert.deepEqual(R.camposExtras(defs, { ambiente: ' Terrário ', dieta: 'Insetos', manejo: '' }), [['Ambiente', 'Terrário'], ['Dieta', 'Insetos']]);
  assert.deepEqual(R.camposExtras(undefined, { ambiente: 'x' }), []);
  assert.deepEqual(R.camposExtras(defs, null), []);
});

test('seed exóticos: mesma estrutura do padrão, tudo marcado como exemplo e dentro das espécies do subtipo', async () => {
  const fs = await import('node:fs');
  const sub = JSON.parse(fs.readFileSync(path.join(aqui, '../subtipos/exoticos.json'), 'utf8'));
  const base = Seed.gerar('2026-10-22'), ex = Seed.gerar('2026-10-22', 'exoticos');
  assert.deepEqual(Object.keys(ex), Object.keys(base));
  for (const col of Object.keys(base)) assert.equal(ex[col].length, base[col].length, col);
  assert.deepEqual(ex.pets.map((p) => p.id), base.pets.map((p) => p.id));
  for (const col of Object.keys(ex)) for (const x of ex[col]) assert.equal(x.exemplo, true, `${col}/${x.id}`);
  const tutores = new Set(ex.tutores.map((t) => t.id));
  for (const p of ex.pets) {
    assert.ok(tutores.has(p.tutorId));
    assert.ok(sub.painel.especies.includes(p.especie), `espécie fora da lista: ${p.especie}`);
  }
  assert.ok(ex.pets.some((p) => p.pesoG && p.ambiente && p.dieta && p.manejo), 'exemplo com peso em gramas e campos de ambiente, dieta e manejo');
  assert.ok(ex.pets.filter((p) => p.pesoG).every((p) => p.pesoKg === undefined));
  assert.ok(!ex.vacinas.some((v) => /V10|felina/i.test(v.vacina) && ex.pets.find((p) => p.id === v.petId).especie !== 'Cão'), 'vacina de cão em pet exótico');
  assert.deepEqual(Seed.gerar('2026-10-22', 'geral').pets.map((p) => p.nome), base.pets.map((p) => p.nome), 'subtipo geral = padrão');
  const campos = new Set(sub.painel.camposPet.map((c) => c.nome));
  for (const c of sub.painel.camposProntuario) assert.ok(campos.has(c.nome), `campo de prontuário ${c.nome} sem equivalente no cadastro do pet`);
});

test('subtipos e temas: JSON válido, painel do subtipo coerente', async () => {
  const fs = await import('node:fs');
  for (const f of fs.readdirSync(path.join(aqui, '../subtipos'))) {
    const j = JSON.parse(fs.readFileSync(path.join(aqui, '../subtipos', f), 'utf8'));
    assert.equal(j.nome + '.json', f);
    for (const c of [...(j.painel.camposPet || []), ...(j.painel.camposProntuario || [])]) assert.ok(c.nome && c.rotulo, `${f}: campo sem nome ou rótulo`);
  }
  for (const f of fs.readdirSync(path.join(aqui, '../temas')).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(aqui, '../temas', f), 'utf8'));
    assert.equal(j.nome + '.json', f);
    assert.ok(j.tokens && j.pares_contraste.length >= 10, f);
  }
});

/* ======================================================================================================
   Regressões achadas na revisão independente do site 1 (v0.3). Cada teste abaixo falhava antes da correção.
   ====================================================================================================== */
test('retorno: só é atendido por prontuário NA data do retorno ou depois (não por qualquer visita posterior)', () => {
  const pets = [{ id: 'p1', tutorId: 't1', nome: 'Bidu' }, { id: 'p2', tutorId: 't1', nome: 'Mel' }];
  const base = (extra) => R.agruparRetornos({ hoje: '2026-02-01', pets, tutores: [], vacinas: [], lembretes: [], prontuarios: [
    { id: 'r1', petId: 'p1', data: '2026-01-10', retornoEm: '2026-02-10', queixa: 'Tosse' }, ...extra] });
  assert.deepEqual(base([{ id: 'r2', petId: 'p1', data: '2026-01-15', retornoEm: '' }]).map((x) => x.chave), ['retorno:r1'], 'visita de 15/01 não atende o retorno de 10/02');
  assert.deepEqual(base([{ id: 'r2', petId: 'p1', data: '2026-02-10', retornoEm: '' }]).map((x) => x.chave), [], 'visita no dia do retorno atende');
  assert.deepEqual(base([{ id: 'r2', petId: 'p1', data: '2026-02-12', retornoEm: '' }]).map((x) => x.chave), [], 'visita depois do retorno atende');
  assert.deepEqual(base([{ id: 'r2', petId: 'p2', data: '2026-02-12', retornoEm: '' }]).map((x) => x.chave), ['retorno:r1'], 'visita de outro pet não atende');
  assert.deepEqual(base([{ id: 'r2', petId: 'p1', data: '2026-01-05', retornoEm: '' }]).map((x) => x.chave), ['retorno:r1'], 'visita anterior não atende');
});

test('retorno: o título só leva a queixa quando o perfil lê prontuários', () => {
  const dados = { hoje: '2026-10-22', pets: [{ id: 'p1', tutorId: 't1' }], tutores: [], vacinas: [], lembretes: [], prontuarios: [{ id: 'r1', petId: 'p1', data: '2026-10-10', retornoEm: '2026-10-25', queixa: 'Coceira' }] };
  assert.equal(R.agruparRetornos(dados)[0].titulo, 'Retorno');
  assert.equal(R.agruparRetornos({ ...dados, comQueixa: false })[0].titulo, 'Retorno');
  assert.equal(R.agruparRetornos({ ...dados, comQueixa: true })[0].titulo, 'Retorno: Coceira');
});

test('lembretes dispensados: saem das listas normais, voltam com incluirDispensados e podem ser restaurados', () => {
  const dados = { hoje: '2026-10-22', pets: [{ id: 'p1', tutorId: 't1' }], tutores: [], prontuarios: [], vacinas: [{ id: 'v1', petId: 'p1', vacina: 'V10', dataAplicacao: '2025-10-22', proximaDose: '2026-10-25' }],
    lembretes: [{ chave: 'vacina:v1', dispensado: true }] };
  assert.deepEqual(R.agruparRetornos(dados), []);
  const so = R.agruparRetornos({ ...dados, incluirDispensados: true });
  assert.equal(so.length, 1); assert.equal(so[0].dispensado, true);
  assert.equal(R.agruparRetornos({ ...dados, lembretes: [{ chave: 'vacina:v1', dispensado: false }] })[0].dispensado, false); // restaurado
});

test('perfis: excluir tutor, pet e registros clínicos (com cascata) é só do dono; recepção e veterinário só excluem consulta', () => {
  for (const perfil of ['recepcao', 'veterinario']) {
    for (const m of ['tutores', 'prontuarios', 'vacinas', 'caixa', 'estoque', 'equipe', 'config']) assert.equal(R.podeExcluir(perfil, m), false, `${perfil}/${m}`);
    assert.equal(R.podeExcluir(perfil, 'agenda'), true);
  }
  for (const m of R.MODULOS) assert.equal(R.podeExcluir('dono', m), true, m);
});

test('exportar dados do tutor: cada perfil leva só o que pode ler', () => {
  const dados = { tutor: { id: 't1' }, pets: [{ id: 'p1' }], consultas: [{ id: 'c1' }], prontuarios: [{ id: 'r1', prescricao: 'x' }], vacinas: [{ id: 'v1' }], lancamentos: [{ id: 'l1' }], lembretes: [{ id: 'm1' }] };
  const rec = R.recortarDadosDoTutor('recepcao', dados);
  assert.equal(rec.dados.prontuarios, undefined); assert.deepEqual(rec.omitidos, ['prontuarios']);
  assert.ok(rec.dados.lancamentos && rec.dados.vacinas && rec.dados.consultas && rec.dados.pets && rec.dados.tutor);
  const vet = R.recortarDadosDoTutor('veterinario', dados);
  assert.equal(vet.dados.lancamentos, undefined); assert.deepEqual(vet.omitidos, ['lancamentos']);
  assert.ok(vet.dados.prontuarios);
  const dono = R.recortarDadosDoTutor('dono', dados);
  assert.deepEqual(dono.omitidos, []); assert.equal(Object.keys(dono.dados).length, 7);
  assert.ok(dados.prontuarios, 'não altera o original');
});

test('parseBRL: rejeita agrupamento malformado e valor absurdo', () => {
  for (const ruim of ['1.2.3', '1.23.456', '12.345.67', '99999999999999999', '1.000.000.000', '1,2,3', '.5.', '1..2']) assert.ok(Number.isNaN(R.parseBRL(ruim)), ruim);
  assert.equal(R.parseBRL('1.234,56'), 123456); assert.equal(R.parseBRL('1.234.567,89'), 123456789); assert.equal(R.parseBRL('1234,5'), 123450);
  assert.equal(R.parseBRL('12.5'), 1250); assert.equal(R.parseBRL('12.50'), 1250); assert.equal(R.parseBRL('1.200'), 120000); assert.equal(R.parseBRL('0,99'), 99);
  assert.equal(R.parseBRL('99.999.999,99'), 9999999999);
});

test('início: consultas de hoje ignoram canceladas e faltas; próxima consulta não volta para a primeira do dia', () => {
  const cs = [
    { id: 'a', inicio: '2026-10-22T09:00', status: 'concluida' }, { id: 'b', inicio: '2026-10-22T10:00', status: 'faltou' }, { id: 'c', inicio: '2026-10-22T11:00', status: 'cancelada' },
    { id: 'd', inicio: '2026-10-22T14:00', status: 'agendada' }, { id: 'e', inicio: '2026-10-23T09:00', status: 'agendada' }];
  const hoje = R.consultasAtivasDoDia(cs, '2026-10-22');
  assert.deepEqual(hoje.map((c) => c.id), ['a', 'd']);
  assert.equal(R.proximaConsulta(hoje, '2026-10-22T08:00').id, 'a');
  assert.equal(R.proximaConsulta(hoje, '2026-10-22T13:00').id, 'd');
  assert.equal(R.proximaConsulta(hoje, '2026-10-22T14:00').id, 'd');
  assert.equal(R.proximaConsulta(hoje, '2026-10-22T18:00'), null);
});

test('store: importação valida o arquivo inteiro ANTES de apagar qualquer coisa', async () => {
  const novoStore = async () => { const s = Store.criarStore(Store.adaptadorMemoria()); await s.salvar('tutores', { id: 't1', nome: 'Ana' }); await s.salvar('pets', { id: 'p1', nome: 'Bidu', tutorId: 't1', especie: 'Cão' }); return s; };
  const hostis = {
    'coleção que não é lista': { versao: 1, colecoes: { pets: [{ id: 'a' }], tutores: 'oops' } },
    'item null': { versao: 1, colecoes: { pets: [null] } },
    'item que é lista': { versao: 1, colecoes: { pets: [[1]] } },
    'item sem id': { versao: 1, colecoes: { pets: [{ nome: 'sem id' }] } },
    'id vazio': { versao: 1, colecoes: { pets: [{ id: '' }] } },
    'id que não é texto': { versao: 1, colecoes: { pets: [{ id: 7 }] } },
    'ids repetidos': { versao: 1, colecoes: { pets: [{ id: 'x' }, { id: 'x' }] } },
    'coleção desconhecida': { versao: 1, colecoes: { qualquer: [{ id: 'x' }] } },
    'contas de acesso': { versao: 1, colecoes: { usuarios: [{ id: 'u', perfil: 'dono' }] } },
    'chave __proto__': { versao: 1, colecoes: JSON.parse('{"pets":[{"id":"x","__proto__":{"perfil":"dono"}}]}') },
    'versão errada': { versao: 2, colecoes: {} }, 'sem colecoes': { versao: 1 }, 'colecoes é lista': { versao: 1, colecoes: [] }, 'nulo': null, 'texto': 'x',
  };
  for (const [nome, dump] of Object.entries(hostis)) {
    const s = await novoStore();
    assert.equal(Store.validarExportacao(dump).ok, false, `validar deveria reprovar: ${nome}`);
    await assert.rejects(s.importar(dump), Error, nome);
    assert.equal((await s.listar('tutores')).length, 1, `${nome}: tutores intactos`);
    assert.equal((await s.listar('pets')).length, 1, `${nome}: pets intactos`);
  }
  const s = await novoStore();
  const bom = { versao: 1, colecoes: { tutores: [{ id: 't9', nome: 'Zé' }], pets: [] } };
  const v = Store.validarExportacao(bom); assert.equal(v.ok, true); assert.deepEqual(v.resumo, { tutores: 1, pets: 0 });
  await s.importar(bom);
  assert.deepEqual((await s.listar('tutores')).map((t) => t.id), ['t9']); assert.equal((await s.listar('pets')).length, 0);
});

test('store: se a gravação falha no meio da importação, o que havia antes volta', async () => {
  const ad = Store.adaptadorMemoria(), s = Store.criarStore(ad);
  await s.salvar('tutores', { id: 't1', nome: 'Ana' });
  const gravar = ad.gravar; let n = 0;
  ad.gravar = (col, item) => (++n === 3 ? Promise.reject(new Error('disco cheio')) : gravar(col, item));
  await assert.rejects(s.importar({ versao: 1, colecoes: { tutores: [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }, { id: 'c', nome: 'C' }] } }), /restaurad/i);
  ad.gravar = gravar;
  assert.deepEqual((await s.listar('tutores')).map((t) => t.id), ['t1']);
});

test('auth: senha provisória sai do gerador criptográfico e não repete', () => {
  const Auth = require(path.join(aqui, '../painel/js/auth.js'));
  const a = Auth.gerarSenhaProvisoria(), b = Auth.gerarSenhaProvisoria();
  assert.match(a, /^prov-[a-hj-km-np-z2-9]{8}$/); assert.notEqual(a, b);
  assert.ok(a.length >= 8 && !R.validarSenha(a));
  let usou = false; const falso = { getRandomValues: (v) => { usou = true; for (let i = 0; i < v.length; i++) v[i] = i; return v; } };
  assert.match(Auth.gerarSenhaProvisoria(falso), /^prov-/); assert.ok(usou, 'tem de usar o gerador criptográfico recebido');
});

test('vitrine: a gestão só liga com gestao === true (falha fechada)', () => {
  for (const v of [false, 0, null, 'false', undefined, 'true', 1]) assert.equal(Vitrine.modulosAtivos({ modules: { vitrine: true, gestao: v } }).gestao, false, String(v));
  assert.equal(Vitrine.modulosAtivos({ modules: { gestao: true } }).gestao, true);
  assert.equal(Vitrine.modulosAtivos({}).gestao, false); assert.equal(Vitrine.modulosAtivos(undefined).gestao, false);
  assert.equal(Vitrine.modulosAtivos({}).vitrine, true); // a vitrine segue ligada por padrão
  assert.equal(Vitrine.modulosAtivos({ modules: { vitrine: false } }).vitrine, false);
});

/* =====================================================================================================================
   v0.4 (site 3, CEDVET, hospital 24h): módulos e perfis configuráveis por subtipo, internação e plantão, entradas hostis.
   Os testes marcados [defeito do v0.3] reprovam no painel v0.3 (foram reproduzidos antes da correção).
   ===================================================================================================================== */
const HOSPITAL = JSON.parse(fs.readFileSync(path.join(aqui, '../subtipos/hospital24h.json'), 'utf8'));
const comModulos = (cfg, fn) => { R.configurarModulos(cfg); try { return fn(); } finally { R.configurarModulos(null); } };

test('módulos: sem configuração nada muda (clínica geral e exóticos continuam com as 9 telas)', () => {
  R.configurarModulos(null);
  assert.deepEqual(R.MODULOS, ['inicio', 'agenda', 'tutores', 'prontuarios', 'vacinas', 'caixa', 'estoque', 'equipe', 'config']);
  assert.deepEqual(R.modulosDoPerfil('recepcao'), ['inicio', 'agenda', 'tutores', 'vacinas', 'caixa', 'estoque']);
  assert.equal(R.permissao('dono', 'internacao'), null);
});

test('módulos: o subtipo hospital24h acrescenta internação para dono e veterinário, e a recepção não a vê', () => {
  comModulos(HOSPITAL.painel, () => {
    assert.ok(R.MODULOS.includes('internacao'));
    assert.equal(R.MODULOS.length, 10);
    assert.equal(R.permissao('dono', 'internacao'), 'rw');
    assert.equal(R.permissao('veterinario', 'internacao'), 'rw');
    assert.equal(R.permissao('recepcao', 'internacao'), null);
    assert.ok(R.modulosDoPerfil('veterinario').includes('internacao'));
    assert.ok(!R.modulosDoPerfil('recepcao').includes('internacao'));
    assert.equal(R.podeExcluir('veterinario', 'internacao'), false); // excluir internação (e as observações dela) é do dono, como os demais registros clínicos
    assert.equal(R.podeExcluir('dono', 'internacao'), true);
    assert.equal(R.podeExcluir('recepcao', 'agenda'), true); // o resto da matriz continua como era
  });
  assert.equal(R.permissao('dono', 'internacao'), null); // e a configuração anterior volta ao zerar
});

test('módulos: configuração hostil é ignorada (ids estranhos, perfis inventados, permissões fora de r/rw, __proto__)', () => {
  const hostil = JSON.parse(`{"modulos":["inicio","<img src=x>","a b","__proto__","constructor",7,null,"inicio","internacao"],
    "matriz":{"__proto__":{"inicio":"rw"},"admin":{"inicio":"rw"},"recepcao":{"internacao":"deus","__proto__":"rw","caixa":"r","agenda":null},"dono":"rw"}}`);
  comModulos(hostil, () => {
    assert.deepEqual(R.MODULOS, ['inicio', 'constructor', 'internacao']); // só ids [a-z0-9], sem repetição
    assert.equal(R.permissao('admin', 'inicio'), null);
    assert.equal(R.permissao('recepcao', 'internacao'), null);
    assert.equal(R.permissao('recepcao', 'caixa'), 'r');
    assert.equal(R.permissao('recepcao', 'agenda'), null); // null remove a permissão
    assert.equal(R.permissao('dono', 'inicio'), 'rw');
    assert.equal(({}).inicio, undefined); assert.equal(({}).perfil, undefined); // nada vazou para o protótipo
  });
  for (const ruim of [undefined, null, 'x', 5, [], { modulos: 'x' }, { modulos: [] }, { matriz: [] }]) {
    comModulos(ruim, () => assert.deepEqual(R.MODULOS.slice(0, 3), ['inicio', 'agenda', 'tutores']));
  }
});

test('[defeito do v0.3] permissão por nome herdado do Object: "constructor", "toString" e "__proto__" não são telas', () => {
  for (const nome of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
    for (const perfil of ['dono', 'veterinario', 'recepcao']) assert.equal(R.permissao(perfil, nome), null, `${perfil}/${nome}`);
  }
  for (const perfil of ['constructor', 'toString', '__proto__']) assert.equal(R.permissao(perfil, 'inicio'), null, perfil);
  assert.equal(R.podeEscrever('dono', 'constructor'), false);
});

test('[defeito do v0.3] exportar dados do tutor: coleção que o recorte não conhece NÃO passa para a recepção (negar por padrão)', () => {
  const dados = { tutor: { id: 't' }, pets: [], internacoes: [{ id: 'i', motivo: 'x' }], novidade: [{ id: 'n' }] };
  const rec = R.recortarDadosDoTutor('recepcao', dados); // sem configurar nada: a chave desconhecida não pode vazar
  assert.equal(rec.dados.novidade, undefined); assert.equal(rec.dados.internacoes, undefined);
  assert.ok(rec.omitidos.includes('novidade') && rec.omitidos.includes('internacoes'));
  assert.ok(rec.dados.tutor && rec.dados.pets);
});

test('exportar dados do tutor no hospital: internação e observações só para quem acessa a internação', () => {
  const dados = { tutor: { id: 't' }, pets: [], internacoes: [{ id: 'i', motivo: 'x' }], evolucoes: [{ id: 'e', texto: 'dose' }], novidade: [{ id: 'n' }] };
  comModulos(HOSPITAL.painel, () => {
    const rec = R.recortarDadosDoTutor('recepcao', dados);
    assert.equal(rec.dados.internacoes, undefined); assert.equal(rec.dados.evolucoes, undefined); assert.equal(rec.dados.novidade, undefined);
    assert.deepEqual(rec.omitidos.sort(), ['evolucoes', 'internacoes', 'novidade']);
    const vet = R.recortarDadosDoTutor('veterinario', dados);
    assert.ok(vet.dados.internacoes && vet.dados.evolucoes); assert.equal(vet.dados.novidade, undefined);
    assert.equal(R.recortarDadosDoTutor('dono', dados).dados.internacoes.length, 1);
  });
  assert.equal(dados.internacoes.length, 1); // o original não é alterado
});

/* ---------- internação ---------- */
test('internação: um leito e um paciente só podem estar em uma internação ativa por vez', () => {
  const lista = [
    { id: 'i1', petId: 'p1', leitoId: 'l1', status: 'internado' },
    { id: 'i2', petId: 'p2', leitoId: 'l2', status: 'encerrada' },
    { id: 'i3', petId: 'p3', leitoId: 'l3' }, // sem status = ativa
  ];
  assert.equal(R.leitoOcupado(lista, 'l1').id, 'i1');
  assert.equal(R.leitoOcupado(lista, 'l1', 'i1'), null); // editando a própria internação
  assert.equal(R.leitoOcupado(lista, 'l2'), null); // encerrada libera o leito
  assert.equal(R.leitoOcupado(lista, 'l3').id, 'i3');
  assert.equal(R.petInternado(lista, 'p1').id, 'i1');
  assert.equal(R.petInternado(lista, 'p2'), null);
  assert.equal(R.petInternado(lista, 'p1', 'i1'), null);
  assert.equal(R.leitoOcupado([null, undefined, 3, 'x', {}], 'l1'), null); // lixo na lista não derruba
});

test('internação: validações (paciente, leito, datas e encerramento)', () => {
  const ok = { petId: 'p', leitoId: 'l', entradaEm: '2026-10-22T08:00', status: 'internado' };
  assert.equal(R.validarInternacao(ok), null);
  assert.match(R.validarInternacao({ ...ok, petId: '' }), /paciente/i);
  assert.match(R.validarInternacao({ ...ok, leitoId: '' }), /leito/i);
  assert.match(R.validarInternacao({ ...ok, entradaEm: '2026-10-22' }), /entrada/i);
  assert.match(R.validarInternacao({ ...ok, status: 'encerrada', saidaEm: '', desfecho: 'Alta' }), /sa[ií]da/i);
  assert.match(R.validarInternacao({ ...ok, status: 'encerrada', saidaEm: '2026-10-22T07:59', desfecho: 'Alta' }), /antes da entrada/i);
  assert.equal(R.validarInternacao({ ...ok, status: 'encerrada', saidaEm: '2026-10-22T08:00', desfecho: 'Alta' }), null); // no mesmo minuto vale (a mensagem não promete "depois")
  assert.match(R.validarInternacao({ ...ok, status: 'encerrada', saidaEm: '2026-10-23T09:00', desfecho: '' }), /desfecho/i);
  assert.equal(R.validarInternacao({ ...ok, status: 'encerrada', saidaEm: '2026-10-23T09:00', desfecho: 'Alta' }), null);
  assert.ok(R.validarInternacao(null) && R.validarInternacao(undefined)); // entrada hostil devolve mensagem, não exceção
});

test('internação: tempo internado em minutos, horas e dias', () => {
  assert.equal(R.tempoInternado('2026-10-22T08:00', '2026-10-22T08:20').texto, 'menos de 1 h');
  assert.equal(R.tempoInternado('2026-10-22T08:00', '2026-10-22T13:10').texto, '5 h');
  assert.equal(R.tempoInternado('2026-10-22T08:00', '2026-10-24T12:00').texto, '2 d 4 h');
  assert.equal(R.tempoInternado('2026-10-22T08:00', '2026-10-25T08:00').texto, '3 d');
  assert.equal(R.tempoInternado('2026-10-22T08:00', '2026-10-21T08:00').texto, 'menos de 1 h'); // relógio atrasado não gera tempo negativo
  assert.equal(R.tempoInternado('', '2026-10-21T08:00'), null);
});

test('plantão: quem está em plantão agora, validação do período e ocupação dos leitos', () => {
  const ps = [
    { id: 'a', profissionalId: 'v1', inicio: '2026-10-22T07:00', fim: '2026-10-22T19:00' },
    { id: 'b', profissionalId: 'v2', inicio: '2026-10-22T19:00', fim: '2026-10-23T07:00' },
    { id: 'c', profissionalId: 'v3', inicio: '2026-10-21T19:00', fim: '2026-10-22T07:00' },
    null, { id: 'd' }, { id: 'e', inicio: '2026-10-22T07:00' },
  ];
  assert.deepEqual(R.plantonistasAgora(ps, '2026-10-22T10:00').map((p) => p.id), ['a']);
  assert.deepEqual(R.plantonistasAgora(ps, '2026-10-22T19:00').map((p) => p.id), ['b']); // o fim é exclusivo
  assert.deepEqual(R.plantonistasAgora(ps, '2026-10-22T07:00').map((p) => p.id), ['a']);
  assert.equal(R.validarPlantao({ profissionalId: 'v', inicio: '2026-10-22T07:00', fim: '2026-10-22T19:00' }), null);
  assert.match(R.validarPlantao({ profissionalId: '', inicio: '2026-10-22T07:00', fim: '2026-10-22T19:00' }), /profissional/i);
  assert.match(R.validarPlantao({ profissionalId: 'v', inicio: '2026-10-22T19:00', fim: '2026-10-22T07:00' }), /depois do in[ií]cio/i);
  assert.match(R.validarPlantao({ profissionalId: 'v', inicio: '', fim: '' }), /in[ií]cio/i);
  const oc = R.ocupacaoLeitos([{ id: 'l1' }, { id: 'l2' }, { id: 'l3', ativo: false }], [{ leitoId: 'l1', status: 'internado' }, { leitoId: 'l2', status: 'encerrada' }, { leitoId: 'l3', status: 'internado' }]);
  assert.deepEqual(oc, { total: 2, ocupados: 1, livres: 1 }); // leito desativado não conta
});

test('observação de plantão: validação', () => {
  assert.equal(R.validarObservacao({ internacaoId: 'i', em: '2026-10-22T09:00', texto: 'Aceitou ração.' }), null);
  assert.match(R.validarObservacao({ internacaoId: 'i', em: '2026-10-22T09:00', texto: '   ' }), /observa/i);
  assert.match(R.validarObservacao({ internacaoId: '', em: '2026-10-22T09:00', texto: 'x' }), /interna/i);
  assert.match(R.validarObservacao({ internacaoId: 'i', em: '', texto: 'x' }), /data/i);
});

/* ---------- store com coleções extras ---------- */
test('[defeito do v0.3] importar com coleções extras do subtipo: a tela de Configurações precisa validar com as coleções DA LOJA, não só as padrão', async () => {
  const extras = HOSPITAL.painel.colecoesExtras;
  assert.ok(extras.includes('internacoes') && extras.includes('leitos') && extras.includes('evolucoes') && extras.includes('plantoes'));
  const s = Store.criarStore(Store.adaptadorMemoria(), extras);
  await s.salvar('leitos', { id: 'l1', nome: 'Leito 1' }); await s.salvar('internacoes', { id: 'i1', petId: 'p', leitoId: 'l1' });
  const dump = await s.exportar();
  assert.ok(dump.colecoes.internacoes && dump.colecoes.leitos && !dump.colecoes.usuarios);
  assert.equal(Store.validarExportacao(dump).ok, false, 'sem informar as coleções do subtipo o arquivo é rejeitado (é isto que a tela de Configurações fazia)');
  assert.equal(Store.validarExportacao(dump, s.colecoes).ok, true);
  const s2 = Store.criarStore(Store.adaptadorMemoria(), extras);
  await s2.importar(dump);
  assert.equal((await s2.listar('internacoes')).length, 1);
  const semExtras = Store.criarStore(Store.adaptadorMemoria());
  await assert.rejects(semExtras.importar(dump), /desconhecido/); // um site sem internação não aceita o arquivo de um hospital
  assert.equal(s.tem('internacoes'), true); assert.equal(semExtras.tem('internacoes'), false); assert.equal(s.tem('__proto__'), false);
});

/* ---------- dados de exemplo do hospital ---------- */
test('seed hospital24h: mesmos ids e quantidades das 9 telas; acrescenta leitos, internações, observações e plantões, todos marcados como exemplo', () => {
  const base = Seed.gerar('2026-10-22', null), h = Seed.gerar('2026-10-22', 'hospital24h');
  for (const col of Object.keys(base)) assert.deepEqual(h[col].map((x) => x.id), base[col].map((x) => x.id), col);
  for (const col of ['leitos', 'internacoes', 'evolucoes', 'plantoes']) {
    assert.ok(h[col].length >= 2, col); assert.ok(h[col].every((x) => x.exemplo === true), col);
    assert.ok(HOSPITAL.painel.colecoesExtras.includes(col), col);
  }
  assert.equal(base.leitos, undefined); assert.equal(Seed.gerar('2026-10-22', 'exoticos').internacoes, undefined);
  const ids = (col) => new Set(h[col].map((x) => x.id));
  for (const i of h.internacoes) { assert.ok(ids('pets').has(i.petId)); assert.ok(ids('leitos').has(i.leitoId)); assert.ok(ids('profissionais').has(i.responsavelId)); assert.equal(R.validarInternacao(i), null, i.id); }
  for (const e of h.evolucoes) { assert.ok(ids('internacoes').has(e.internacaoId)); assert.equal(R.validarObservacao(e), null, e.id); }
  for (const p of h.plantoes) { assert.ok(ids('profissionais').has(p.profissionalId)); assert.equal(R.validarPlantao(p), null, p.id); }
  // nenhum leito tem dois pacientes ativos e nenhum paciente está em dois leitos
  const ativas = h.internacoes.filter((i) => i.status !== 'encerrada');
  assert.equal(new Set(ativas.map((i) => i.leitoId)).size, ativas.length); assert.equal(new Set(ativas.map((i) => i.petId)).size, ativas.length);
  assert.ok(ativas.length >= 2 && h.internacoes.some((i) => i.status === 'encerrada'));
  assert.ok(R.plantonistasAgora(h.plantoes, '2026-10-22T' + '12:00').length >= 1 || h.plantoes.length >= 2); // há plantão em curso ou próximo
  assert.ok(JSON.stringify(h).match(/\(exemplo\)|Exemplo/));
});

test('seed hospital24h: carregar e remover exemplo deixa só o que o usuário cadastrou (inclusive observações órfãs)', async () => {
  const s = Store.criarStore(Store.adaptadorMemoria(), HOSPITAL.painel.colecoesExtras);
  await Seed.carregar(s, '2026-10-22', 'hospital24h');
  assert.ok((await s.listar('internacoes')).length >= 2);
  await s.salvar('leitos', { id: 'meu-leito', nome: 'Leito real' });
  await s.salvar('internacoes', { id: 'minha-int', petId: 'meu-pet', leitoId: 'meu-leito', entradaEm: '2026-10-22T08:00', status: 'internado' });
  await s.salvar('evolucoes', { id: 'minha-evo', internacaoId: 'minha-int', em: '2026-10-22T09:00', texto: 'real' });
  await s.salvar('evolucoes', { id: 'evo-orfa', internacaoId: 'ex-int-que-sumiu', em: '2026-10-22T09:00', texto: 'ficou sem internação' });
  await Seed.remover(s);
  assert.deepEqual((await s.listar('internacoes')).map((x) => x.id), ['minha-int']);
  assert.deepEqual((await s.listar('leitos')).map((x) => x.id), ['meu-leito']);
  assert.deepEqual((await s.listar('evolucoes')).map((x) => x.id), ['minha-evo']);
  assert.equal((await s.listar('plantoes')).length, 0);
  assert.equal((await s.listar('pets')).length, 0);
});

test('subtipo hospital24h: receita coerente (módulos conhecidos, matriz válida, coleções do módulo declaradas, sem afirmações)', () => {
  const p = HOSPITAL.painel;
  assert.deepEqual(p.modulos.slice(0, 4), ['inicio', 'agenda', 'tutores', 'prontuarios']);
  assert.equal(p.modulos.length, new Set(p.modulos).size);
  for (const [perfil, m] of Object.entries(p.matriz)) { assert.ok(R.PERFIS[perfil], perfil); for (const v of Object.values(m)) assert.ok(['r', 'rw', null].includes(v)); }
  assert.equal(p.subtipo, undefined); // o nome do subtipo é acrescentado pelo gerador
  assert.ok(p.modulos.every((m) => /^[a-z][a-z0-9]*$/.test(m)));
  assert.doesNotMatch(JSON.stringify({ v: HOSPITAL.vitrine, p: HOSPITAL.painel, r: HOSPITAL.resumo_painel }), /24 ?h|crmv|desde \d{4}|garant|melhor/i); // o que a receita escreve no site não afirma nada sobre o negócio
});

test('[defeito do v0.3] importação recusa id "__proto__"/"constructor"/"prototype" (valor, não só chave) e a remoção de exemplo aguenta lembrete sem chave', async () => {
  for (const id of ['__proto__', 'constructor', 'prototype']) {
    const r = Store.validarExportacao({ versao: 1, colecoes: { pets: [{ id, nome: 'x' }] } });
    assert.equal(r.ok, false, id); assert.match(r.erro, /identificador/);
  }
  assert.equal(Store.validarExportacao({ versao: 1, colecoes: { pets: [{ id: 'abc', nome: 'x' }] } }).ok, true);
  const s = Store.criarStore(Store.adaptadorMemoria());
  await s.salvar('lembretes', { id: 'l1' }); await s.salvar('lembretes', { id: 'l2', chave: null }); await s.salvar('lembretes', { id: 'l3', chave: 'vacina:x', enviadoEm: 'a' });
  await Seed.remover(s); // antes: TypeError em x.chave.split
  assert.equal((await s.listar('lembretes')).length, 0); // sem alvo conhecido = órfão
});

/* ---------- achados da revisão independente do hospital (v0.4) ---------- */
test('datas e horas: o calendário é conferido (mês 19, dia 45, hora 99, 31 de abril, texto colado) e a tela não promete "depois" quando aceita igual', () => {
  for (const ruim of ['2026-19-45T99:99', '2026-10-22T99:00', '2026-04-31T08:00', '2026-02-30T08:00', '2026-10-22T08:00<script>', '2026-10-22T08:00:30', '2026-10-22', '', null, 12345, {}]) {
    assert.equal(R.dataHoraValida(ruim), false, String(ruim));
    assert.ok(R.validarInternacao({ petId: 'p', leitoId: 'l', entradaEm: ruim }), 'internação aceitou ' + String(ruim));
    assert.ok(R.validarObservacao({ internacaoId: 'i', em: ruim, texto: 'x' }), 'observação aceitou ' + String(ruim));
    assert.ok(R.validarPlantao({ profissionalId: 'v', inicio: ruim, fim: '2026-10-23T08:00' }), 'plantão aceitou ' + String(ruim));
    assert.equal(R.tempoInternado(ruim, '2026-10-22T08:00'), null);
  }
  for (const bom of ['2026-10-22T08:00', '2028-02-29T23:59', '2026-12-31T00:00']) assert.equal(R.dataHoraValida(bom), true, bom);
  assert.equal(R.dataHoraValida('2027-02-29T08:00'), false); // 2027 não é bissexto
  assert.deepEqual(R.plantonistasAgora([{ id: 'a', inicio: '2026-10-22T07:00:30', fim: '2026-10-22T19:00:30' }], '2026-10-22T10:00'), [], 'plantão com segundos (fora do formato) não conta');
  assert.doesNotThrow(() => R.dataBR(20261022)); // número vindo de fora não derruba a tela (antes: iso.slice is not a function)
});

test('[defeito do v0.3] ids que são nomes do Object ("toString", "hasOwnProperty"...) não entram na importação e não vazam dado de um tutor para outro', async () => {
  for (const id of ['toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', '__defineGetter__']) {
    assert.equal(Store.validarExportacao({ versao: 1, colecoes: { pets: [{ id }] } }).ok, false, id);
  }
  const lembretes = R.agruparRetornos({ hoje: '2026-10-22', pets: [{ id: 'p1', tutorId: 't' }], tutores: [{ id: 't' }], vacinas: [{ id: 'v1', petId: 'toString', vacina: 'X', dataAplicacao: '2026-01-01', proximaDose: '2026-10-25' }], prontuarios: [], lembretes: [{ id: 'l', chave: 'constructor' }] });
  assert.deepEqual(lembretes, [], 'vacina de pet "toString" não pode achar um pet que não existe');
});

test('[defeito do v0.3] importar recusa campo de texto que não é texto (a tela inteira quebrava) e internações ativas em dobro', () => {
  const extras = HOSPITAL.painel.colecoesExtras, todas = Store.COLECOES.concat(extras);
  const casos = {
    'nome numérico': { pets: [{ id: 'a', nome: 12 }] }, 'nome lista': { tutores: [{ id: 'a', nome: ['x'] }] }, 'entrada numérica': { internacoes: [{ id: 'a', entradaEm: 1234 }] },
    'entrada sem hora': { internacoes: [{ id: 'a', entradaEm: '2026-10-22' }] }, 'observação com data lixo': { evolucoes: [{ id: 'a', em: 'ontem' }] },
    'plantão com segundos': { plantoes: [{ id: 'a', inicio: '2026-10-22T07:00:00', fim: '2026-10-22T19:00' }] },
    'dois no mesmo leito': { internacoes: [{ id: 'a', leitoId: 'l', petId: 'p1' }, { id: 'b', leitoId: 'l', petId: 'p2' }] },
    'mesmo paciente em dois leitos': { internacoes: [{ id: 'a', leitoId: 'l1', petId: 'p' }, { id: 'b', leitoId: 'l2', petId: 'p' }] },
  };
  for (const [nome, colecoes] of Object.entries(casos)) assert.equal(Store.validarExportacao({ versao: 1, colecoes }, todas).ok, false, nome);
  const bons = { internacoes: [{ id: 'a', leitoId: 'l', petId: 'p', entradaEm: '2026-10-22T08:00', status: 'internado' }, { id: 'b', leitoId: 'l', petId: 'p', status: 'encerrada', entradaEm: '2026-10-20T08:00', saidaEm: '2026-10-21T08:00' }], pets: [{ id: 'x', nome: 'Bidu', nascimento: '' }] };
  assert.equal(Store.validarExportacao({ versao: 1, colecoes: bons }, todas).ok, true); // uma encerrada no mesmo leito de uma ativa é história, não conflito
  // os dados de exemplo e um export real continuam passando
  const ex = Seed.gerar('2026-10-22', 'hospital24h'); const dump = { versao: 1, colecoes: {} };
  for (const k of Object.keys(ex)) if (ex[k].length) dump.colecoes[k] = ex[k];
  assert.equal(Store.validarExportacao(dump, todas).ok, true);
});

test('seed: carregar exemplo duas vezes não recria nem reabre nada; remover leva também a internação de quem usou paciente ou leito de exemplo', async () => {
  const s = Store.criarStore(Store.adaptadorMemoria(), HOSPITAL.painel.colecoesExtras);
  assert.ok((await Seed.carregar(s, '2026-10-22', 'hospital24h')) > 50);
  const encerrada = (await s.listar('internacoes')).find((i) => i.status === 'encerrada');
  await s.salvar('internacoes', { ...(await s.obter('internacoes', 'ex-int-1')), status: 'encerrada', saidaEm: '2026-10-22T09:00', desfecho: 'Alta' }); // o usuário encerrou esta
  assert.equal(await Seed.carregar(s, '2026-10-22', 'hospital24h'), 0, 'segunda carga');
  assert.equal((await s.obter('internacoes', 'ex-int-1')).status, 'encerrada', 'a segunda carga reabriu a internação');
  assert.equal(R.leitoOcupado(await s.listar('internacoes'), 'ex-leito-1'), null);
  // internação do usuário num paciente de exemplo e num leito de exemplo
  await s.salvar('leitos', { id: 'meu-leito', nome: 'Meu leito' }); await s.salvar('pets', { id: 'meu-pet', nome: 'Meu pet', tutorId: 't' });
  await s.salvar('internacoes', { id: 'int-pet-ex', petId: 'ex-pet-4', leitoId: 'meu-leito', entradaEm: '2026-10-22T08:00', status: 'internado' });
  await s.salvar('internacoes', { id: 'int-leito-ex', petId: 'meu-pet', leitoId: 'ex-leito-2', entradaEm: '2026-10-22T08:00', status: 'internado' });
  await s.salvar('internacoes', { id: 'int-real', petId: 'meu-pet', leitoId: 'meu-leito', entradaEm: '2026-10-22T08:00', status: 'encerrada', saidaEm: '2026-10-22T09:00', desfecho: 'Alta' });
  await s.salvar('evolucoes', { id: 'evo-pet-ex', internacaoId: 'int-pet-ex', em: '2026-10-22T09:00', texto: 'x' }); await s.salvar('evolucoes', { id: 'evo-real', internacaoId: 'int-real', em: '2026-10-22T09:00', texto: 'y' });
  await Seed.remover(s);
  assert.deepEqual((await s.listar('internacoes')).map((i) => i.id).sort(), ['int-real']); // nada de leito ocupado por "Pet removido"
  assert.deepEqual((await s.listar('evolucoes')).map((e) => e.id), ['evo-real']);
  assert.ok(encerrada);
});

test('seed hospital24h: os tipos de observação do exemplo existem na lista da tela', () => {
  const TIPOS = ['Observação', 'Medicação', 'Alimentação e hidratação', 'Procedimento', 'Outro']; // mesma lista de modulos/internacao.js
  const src = fs.readFileSync(path.join(aqui, '../painel/js/modulos/internacao.js'), 'utf8');
  for (const t of TIPOS) assert.ok(src.includes("'" + t + "'"), t);
  for (const e of Seed.gerar('2026-10-22', 'hospital24h').evolucoes) assert.ok(TIPOS.includes(e.tipo), e.id + ': ' + e.tipo);
});

/* ---------- v0.5: centro de diagnóstico (subtipo diagnostico): exames e laudos, encaminhadores, títulos ---------- */
const DIAG = JSON.parse(fs.readFileSync(path.join(aqui, '../subtipos/diagnostico.json'), 'utf8')).painel;
const comDiagnostico = (fn) => { R.configurarModulos(DIAG); try { return fn(); } finally { R.configurarModulos(null); } };
const examePronto = (extra = {}) => ({ id: 'e1', petId: 'p1', servicoId: 's1', encaminhadorId: 'enc1', status: 'solicitado', consultaId: '', solicitadoEm: '2026-10-22T09:00', indicacao: 'dado clínico secreto', laudo: 'laudo secreto', obs: '', ...extra });

test('diagnostico: telas, títulos e permissões vêm da receita; tela da clínica geral que o subtipo não tem perde a permissão [defeito do v0.4]', () => comDiagnostico(() => {
  assert.deepEqual(R.MODULOS, ['inicio', 'agenda', 'tutores', 'exames', 'encaminhadores', 'caixa', 'estoque', 'equipe', 'config']);
  assert.equal(R.tituloDaTela('agenda', 'Agenda'), 'Agenda de exames');
  assert.equal(R.tituloDaTela('tutores', 'Tutores e pets'), 'Tutores e pets'); // sem título no subtipo, vale o padrão do módulo
  for (const perfil of Object.keys(R.PERFIS)) for (const tela of ['prontuarios', 'vacinas']) assert.equal(R.permissao(perfil, tela), null, `${perfil}/${tela}`); // antes o veterinário "tinha" rw em tela inexistente
  assert.deepEqual(R.modulosDoPerfil('recepcao'), ['inicio', 'agenda', 'tutores', 'exames', 'encaminhadores', 'caixa', 'estoque']);
  assert.deepEqual(R.modulosDoPerfil('veterinario'), ['inicio', 'agenda', 'tutores', 'exames', 'encaminhadores', 'estoque']);
  assert.equal(R.permissao('recepcao', 'laudos'), null); assert.equal(R.permissao('veterinario', 'laudos'), 'rw'); assert.equal(R.permissao('dono', 'laudos'), 'rw');
  assert.equal(R.permissao('veterinario', 'encaminhadores'), 'r'); assert.equal(R.podeExcluir('recepcao', 'exames'), false); assert.equal(R.podeExcluir('veterinario', 'exames'), false);
}));
test('configurarModulos: tela que o subtipo mantém (hospital) não perde nada; configurarModulos(null) devolve tudo, inclusive os títulos', () => {
  const hosp = JSON.parse(fs.readFileSync(path.join(aqui, '../subtipos/hospital24h.json'), 'utf8')).painel;
  R.configurarModulos(hosp);
  assert.equal(R.permissao('veterinario', 'prontuarios'), 'rw'); assert.equal(R.permissao('recepcao', 'vacinas'), 'r');
  R.configurarModulos(DIAG); assert.equal(R.tituloDaTela('agenda', 'Agenda'), 'Agenda de exames');
  R.configurarModulos(null);
  assert.equal(R.tituloDaTela('agenda', 'Agenda'), 'Agenda'); assert.equal(R.permissao('veterinario', 'prontuarios'), 'rw'); assert.equal(R.permissao('veterinario', 'laudos'), null);
});
test('títulos de tela: só texto curto; nomes herdados do Object, tipo errado e caracteres de controle são ignorados', () => {
  R.configurarModulos({ titulos: JSON.parse('{"agenda":"  Agenda de exames  ","__proto__":"x","constructor":"y","toString":3,"prontuarios":"a\\u0000b\\n","vacinas":"' + 'x'.repeat(61) + '","caixa":"","Config":"Maiúscula","equipe":{"a":1}}') });
  try {
    assert.equal(R.tituloDaTela('agenda', 'Agenda'), 'Agenda de exames');
    assert.equal(R.tituloDaTela('prontuarios', 'P'), 'ab');
    for (const k of ['toString', 'vacinas', 'caixa', 'config', 'Config', 'equipe', '__proto__', 'hasOwnProperty']) assert.equal(R.tituloDaTela(k, 'padrão'), 'padrão', k);
    assert.equal(R.tituloDaTela('constructor', 'padrão'), 'y'); // nome comum de tela válido; vale como texto, nunca como a função herdada
    for (const lixo of [undefined, 7, 'texto', [], { titulos: [1] }, { titulos: 'x' }]) { R.configurarModulos(lixo); assert.equal(R.tituloDaTela('agenda', 'A'), 'A'); }
  } finally { R.configurarModulos(null); }
});

test('exames: quem pode cada mudança de situação (dono, veterinário e recepção) e entrada hostil', () => comDiagnostico(() => {
  const quem = (perfil) => Object.fromEntries(Object.entries(R.TRANSICOES_EXAME).flatMap(([de, alvos]) => Object.keys(alvos).map((para) => [de + '>' + para, R.podeMudarStatus(perfil, de, para)])));
  const rec = quem('recepcao'), vet = quem('veterinario'), dono = quem('dono');
  assert.deepEqual(Object.keys(rec).filter((k) => rec[k]).sort(), ['agendado>cancelado', 'agendado>solicitado', 'cancelado>solicitado', 'entregue>laudado', 'laudado>entregue', 'solicitado>agendado', 'solicitado>cancelado']);
  for (const k of ['solicitado>realizado', 'agendado>realizado', 'realizado>laudado', 'laudado>realizado', 'realizado>agendado']) assert.equal(rec[k], false, 'recepção não faz ' + k);
  assert.ok(Object.values(vet).every(Boolean) && Object.values(dono).every(Boolean));
  for (const lixo of [null, undefined, 7, {}, [], '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.equal(R.podeMudarStatus('dono', lixo, 'agendado'), false); assert.equal(R.podeMudarStatus('dono', 'solicitado', lixo), false);
  }
  assert.equal(R.podeMudarStatus('__proto__', 'solicitado', 'agendado'), false); assert.equal(R.podeMudarStatus('constructor', 'solicitado', 'agendado'), false);
  assert.equal(R.podeMudarStatus('dono', 'entregue', 'cancelado'), false); assert.equal(R.podeMudarStatus('dono', 'solicitado', 'entregue'), false); // não pula etapas
}));
test('exames: o caminho completo, as datas em ordem e o que cada passo exige', () => comDiagnostico(() => {
  let e = examePronto({ indicacao: '', laudo: '' });
  assert.throws(() => R.mudarStatusDoExame('recepcao', e, 'agendado', {}), /Marque o horário/);
  e = R.mudarStatusDoExame('recepcao', e, 'agendado', { consultaId: 'c1' }); assert.equal(e.status, 'agendado'); assert.equal(e.consultaId, 'c1');
  assert.throws(() => R.mudarStatusDoExame('recepcao', e, 'realizado', { realizadoEm: '2026-10-23T10:00' }), /perfil não faz/);
  assert.throws(() => R.mudarStatusDoExame('veterinario', e, 'realizado', { realizadoEm: '2026-10-22T08:59' }), /antes do pedido/);
  assert.throws(() => R.mudarStatusDoExame('veterinario', e, 'realizado', { realizadoEm: '2026-19-45T10:00' }), /data e a hora da realização/);
  assert.throws(() => R.mudarStatusDoExame('veterinario', e, 'realizado', {}), /data e a hora da realização/);
  e = R.mudarStatusDoExame('veterinario', e, 'realizado', { realizadoEm: '2026-10-23T10:00', responsavelId: 'prof1' }); assert.equal(e.status, 'realizado');
  assert.throws(() => R.mudarStatusDoExame('veterinario', e, 'laudado', { laudoEm: '2026-10-23T09:59', laudoPorId: 'prof1' }), /antes da realização/);
  assert.throws(() => R.mudarStatusDoExame('veterinario', e, 'laudado', { laudoEm: '2026-10-23T11:00' }), /Escolha quem emitiu/);
  assert.throws(() => R.mudarStatusDoExame('recepcao', e, 'laudado', { laudoEm: '2026-10-23T11:00', laudoPorId: 'prof1', laudo: 'x' }), /perfil não faz/);
  e = R.mudarStatusDoExame('veterinario', e, 'laudado', { laudoEm: '2026-10-23T11:00', laudoPorId: 'prof1', laudo: 'Texto do laudo' }); assert.equal(e.laudo, 'Texto do laudo');
  assert.throws(() => R.mudarStatusDoExame('recepcao', e, 'entregue', { entregueEm: '2026-10-23T10:59' }), /antes do laudo/);
  const entregue = R.mudarStatusDoExame('recepcao', e, 'entregue', { entregueEm: '2026-10-23T12:00', entregaVia: '  retirado na recepção ' });
  assert.equal(entregue.status, 'entregue'); assert.equal(entregue.entregaVia, 'retirado na recepção');
  assert.equal(entregue.laudo, 'Texto do laudo', 'a recepção registra a entrega sem apagar o laudo que ela não lê');
  // desfazer limpa só o que pertence ao passo desfeito
  const volta = R.mudarStatusDoExame('recepcao', entregue, 'laudado', {}); assert.equal(volta.entregueEm, ''); assert.equal(volta.entregaVia, ''); assert.equal(volta.laudoEm, '2026-10-23T11:00');
  const semLaudo = R.mudarStatusDoExame('veterinario', volta, 'realizado', {}); assert.equal(semLaudo.laudoEm, ''); assert.equal(semLaudo.laudoPorId, ''); assert.equal(semLaudo.laudo, 'Texto do laudo', 'o texto fica como rascunho');
  assert.throws(() => R.mudarStatusDoExame('recepcao', semLaudo, 'agendado', {}), /perfil não faz/);
  const desmarcado = R.mudarStatusDoExame('recepcao', R.mudarStatusDoExame('veterinario', semLaudo, 'agendado', {}), 'solicitado', {}); assert.equal(desmarcado.consultaId, '');
  assert.throws(() => R.mudarStatusDoExame('dono', null, 'agendado', {}), /não encontrado/); assert.throws(() => R.mudarStatusDoExame('dono', 'x', 'agendado', {}), /não encontrado/);
  assert.throws(() => R.mudarStatusDoExame('dono', { ...examePronto(), status: '__proto__' }, 'agendado', { consultaId: 'c' }), /não é permitida/);
  assert.throws(() => R.mudarStatusDoExame('dono', examePronto(), 'cancelado__', {}), /não é permitida/);
  assert.equal(examePronto().status, 'solicitado', 'o registro original não é alterado');
}));
test('exames: sem horário o exame não fica agendado; texto longo e situação inválida são recusados', () => {
  assert.match(R.validarExame({ ...examePronto(), status: 'agendado' }), /horário na agenda/);
  assert.match(R.validarExame({ ...examePronto(), status: 'voando' }), /Situação/);
  assert.match(R.validarExame({ ...examePronto(), solicitadoEm: '2026-02-30T10:00' }), /data e a hora do pedido/);
  assert.match(R.validarExame({ ...examePronto(), laudo: 'x'.repeat(20001) }), /limite/);
  assert.match(R.validarExame({ ...examePronto(), obs: 'x'.repeat(2001) }), /muito longo/);
  assert.equal(R.validarExame({ ...examePronto(), laudo: 'x'.repeat(20000) }), null);
  for (const lixo of [null, undefined, 3, 'x', []]) assert.match(R.validarExame(lixo), /inválido/);
  assert.equal(R.validarExame({ ...examePronto(), status: 'cancelado', realizadoEm: '' }), null);
});

test('exames: quem não lê laudo recebe o exame sem indicação clínica e sem laudo; entrada hostil não vaza nem derruba [recorte por campo]', () => comDiagnostico(() => {
  const original = examePronto({ status: 'laudado', laudoEm: '2026-10-23T11:00', laudoPorId: 'p', realizadoEm: '2026-10-23T10:00' });
  const rec = R.exameParaPerfil('recepcao', original);
  assert.ok(!('laudo' in rec) && !('indicacao' in rec)); assert.equal(rec.status, 'laudado'); assert.equal(rec.encaminhadorId, 'enc1'); assert.equal(original.laudo, 'laudo secreto', 'a cópia não altera o original');
  assert.equal(R.exameParaPerfil('veterinario', original).laudo, 'laudo secreto');
  const hostil = JSON.parse('{"id":"a","petId":"p","__proto__":{"laudo":"vazou","indicacao":"vazou"},"laudo":"x"}');
  const c = R.exameParaPerfil('recepcao', hostil);
  assert.equal(c.laudo, undefined); assert.equal(c.indicacao, undefined); assert.ok(!JSON.stringify(c).includes('vazou'));
  assert.deepEqual(R.examesParaPerfil('recepcao', [null, 5, 'laudo secreto', [], original, undefined]).map((x) => x.id), ['e1']); // o que não é registro some da cópia restrita
  for (const lixo of [null, undefined, 'x', 7, {}]) assert.deepEqual(R.examesParaPerfil('recepcao', lixo), []);
  assert.equal(R.examesParaPerfil('perfil-que-nao-existe', [original])[0].laudo, undefined, 'perfil desconhecido não lê laudo');
}));
test('exames: o arquivo do tutor sai sem laudo para a recepção, com laudo para o veterinário, e coleção malformada é omitida', () => comDiagnostico(() => {
  const dados = { tutor: { id: 't' }, pets: [{ id: 'p1' }], consultas: [], exames: [examePronto()], prontuarios: [{ id: 'x', queixa: 'q' }], vacinas: [], lancamentos: [] };
  const rec = R.recortarDadosDoTutor('recepcao', dados);
  assert.ok(rec.omitidos.includes('laudos') && rec.omitidos.includes('prontuarios')); assert.ok(!JSON.stringify(rec.dados).match(/secreto/));
  assert.equal(rec.dados.exames.length, 1); assert.equal(rec.dados.exames[0].status, 'solicitado');
  const vet = R.recortarDadosDoTutor('veterinario', dados); assert.equal(vet.dados.exames[0].laudo, 'laudo secreto'); assert.ok(!vet.omitidos.includes('laudos'));
  for (const lixo of [null, 'laudo secreto', { laudo: 'secreto' }, 7]) { const r = R.recortarDadosDoTutor('recepcao', { exames: lixo }); assert.ok(!('exames' in r.dados) && r.omitidos.includes('exames') && !JSON.stringify(r).includes('secreto')); }
  assert.ok(R.recortarDadosDoTutor('recepcao', { exames_extra: [examePronto()] }).omitidos.includes('exames_extra'), 'coleção desconhecida segue negada por padrão');
}));
test('exames: a edição geral parte do registro atual e não deixa a recepção apagar nem trocar o que ela não lê', () => comDiagnostico(() => {
  const atual = examePronto({ status: 'agendado', consultaId: 'c1' });
  const rec = R.mesclarExame('recepcao', atual, { petId: 'p1', servicoId: 's2', encaminhadorId: '', solicitadoEm: '2026-10-22T10:00', obs: 'ligar antes', indicacao: 'INVENTADA', laudo: 'INVENTADO', status: 'entregue', consultaId: 'outro' });
  assert.equal(rec.servicoId, 's2'); assert.equal(rec.obs, 'ligar antes'); assert.equal(rec.indicacao, 'dado clínico secreto'); assert.equal(rec.laudo, 'laudo secreto');
  assert.equal(rec.status, 'agendado'); assert.equal(rec.consultaId, 'c1');
  const vet = R.mesclarExame('veterinario', atual, { indicacao: 'nova', laudo: 'novo texto', status: 'entregue' }); assert.equal(vet.indicacao, 'nova'); assert.equal(vet.laudo, 'novo texto'); assert.equal(vet.status, 'agendado');
  const so = R.mesclarExame('recepcao', atual, JSON.parse('{"__proto__":{"laudo":"vazou"},"obs":"ok"}')); assert.equal(so.laudo, 'laudo secreto'); assert.equal(so.obs, 'ok');
  assert.deepEqual(R.mesclarExame('recepcao', null, null), {}); assert.equal(R.mesclarExame('recepcao', atual, undefined).obs, '');
}));
test('exames: situação mostrada considera a agenda (horário cancelado, falta ou removido) e a consulta acompanha o exame', () => {
  const ag = examePronto({ status: 'agendado', consultaId: 'c1' });
  assert.equal(R.situacaoDoExame(ag, { id: 'c1', status: 'agendada', inicio: '2026-10-24T14:30' }).rotulo, 'Agendado para 24/10/2026 às 14:30');
  assert.equal(R.situacaoDoExame(ag, { status: 'cancelada', inicio: '2026-10-24T14:30' }).codigo, 'horario_perdido');
  assert.match(R.situacaoDoExame(ag, { status: 'faltou' }).rotulo, /^Faltou/);
  assert.equal(R.situacaoDoExame(ag, undefined).codigo, 'sem_horario'); assert.equal(R.situacaoDoExame(ag, 'lixo').codigo, 'sem_horario');
  assert.equal(R.grupoDoExame(ag, { status: 'cancelada' }), 'agendar'); assert.equal(R.grupoDoExame(ag, { status: 'agendada', inicio: '2026-10-24T14:30' }), 'agendados');
  for (const [s, g] of [['solicitado', 'agendar'], ['realizado', 'laudo'], ['laudado', 'entrega'], ['entregue', 'entregues'], ['cancelado', 'cancelados']]) assert.equal(R.grupoDoExame(examePronto({ status: s })), g, s);
  assert.equal(R.situacaoDoExame(null).codigo, 'solicitado'); assert.equal(R.situacaoDoExame({ status: 'toString' }).codigo, 'solicitado');
  assert.equal(R.statusDaConsultaDoExame('agendada', 'agendado', 'realizado'), 'concluida'); assert.equal(R.statusDaConsultaDoExame('em_atendimento', 'agendado', 'cancelado'), 'cancelada');
  assert.equal(R.statusDaConsultaDoExame('confirmada', 'agendado', 'solicitado'), 'cancelada');
  for (const s of ['concluida', 'cancelada', 'faltou', undefined, null]) assert.equal(R.statusDaConsultaDoExame(s, 'agendado', 'cancelado'), null, String(s));
  assert.equal(R.statusDaConsultaDoExame('agendada', 'solicitado', 'cancelado'), null);
  assert.equal(R.statusDaConsultaDoExame('agendada', 'laudado', 'entregue'), null);
});
test('exames: remarcar só vale para exame agendado e quem escreve na tela', () => comDiagnostico(() => {
  const ag = examePronto({ status: 'agendado', consultaId: 'c1' });
  assert.equal(R.remarcarExame('recepcao', ag, 'c2').consultaId, 'c2');
  assert.throws(() => R.remarcarExame('recepcao', examePronto(), 'c2'), /Só dá para remarcar/); assert.throws(() => R.remarcarExame('recepcao', ag, ''), /Marque o horário/);
  assert.throws(() => R.remarcarExame('perfil-x', ag, 'c2'), /perfil não faz/); assert.throws(() => R.remarcarExame('dono', null, 'c2'), /não encontrado/);
}));
test('encaminhadores: validação e contagem de exames sem protótipo', () => {
  assert.match(R.validarEncaminhador({ nome: ' ' }), /nome/); assert.match(R.validarEncaminhador({ nome: 'A', telefone: '123' }), /Telefone/);
  assert.equal(R.validarEncaminhador({ nome: 'A', telefone: '(15) 99999-0000', condicoes: 'x' }), null); assert.match(R.validarEncaminhador({ nome: 'A', condicoes: 'x'.repeat(2001) }), /muito longo/);
  for (const lixo of [null, 'x', [], 4]) assert.match(R.validarEncaminhador(lixo), /inválido/);
  const n = R.examesPorEncaminhador([{ encaminhadorId: 'a' }, { encaminhadorId: 'a' }, { encaminhadorId: 'toString' }, { encaminhadorId: '' }, null, 'x', { encaminhadorId: '__proto__' }]);
  assert.equal(n.a, 2); assert.equal(n.toString, 1); assert.equal(n.b, undefined); assert.equal(n.constructor, undefined); assert.deepEqual(R.examesPorEncaminhador('x'), Object.create(null));
});

test('importação: exame com situação desconhecida, laudo que não é texto ou data inválida é recusado; o exemplo do diagnóstico importa', async () => {
  const cols = ['usuarios', ...Store.COLECOES.filter((c) => c !== 'usuarios'), 'exames', 'encaminhadores'];
  const arq = (colecoes) => ({ versao: 1, colecoes });
  assert.equal(Store.validarExportacao(arq({ exames: [examePronto()] }), cols).ok, true);
  assert.match(Store.validarExportacao(arq({ exames: [examePronto({ status: 'voando' })] }), cols).erro, /situação desconhecida/);
  assert.match(Store.validarExportacao(arq({ exames: [{ id: 'x', petId: 'p', servicoId: 's' }] }), cols).erro, /situação desconhecida/);
  assert.match(Store.validarExportacao(arq({ exames: [examePronto({ laudo: { texto: 1 } })] }), cols).erro, /"laudo" deveria ser texto/);
  assert.match(Store.validarExportacao(arq({ exames: [examePronto({ solicitadoEm: '22/10/2026' })] }), cols).erro, /data e hora/);
  assert.match(Store.validarExportacao(arq({ exames: [examePronto({ id: '__proto__' })] }), cols).erro, /identificador/);
  assert.match(Store.validarExportacao(arq({ exames: [JSON.parse('{"id":"a","status":"solicitado","__proto__":{}}')] }), cols).erro, /campo não permitido/);
  assert.match(Store.validarExportacao(arq({ encaminhadores: [{ id: 'e', nome: 5 }] }), cols).erro, /"nome" deveria ser texto/);
  assert.equal(Store.validarExportacao(arq({ exames: [] }), Store.COLECOES).ok, false, 'sem a coleção no subtipo o grupo é desconhecido');
  const s = Store.criarStore(Store.adaptadorMemoria(), ['exames', 'encaminhadores']);
  const n = await Seed.carregar(s, '2026-10-22', 'diagnostico', { exames: ['Tomografia computadorizada', 'Fistulografia', 'Linfangiografia'] });
  assert.ok(n > 30);
  const copia = Store.criarStore(Store.adaptadorMemoria(), ['exames', 'encaminhadores']);
  await copia.importar(await s.exportar()); assert.equal((await copia.listar('exames')).length, 8);
});

test('seed diagnostico: tudo coerente (ids únicos, referências existem, exames válidos e na situação certa), sem prontuário nem vacina', () => {
  const d = Seed.gerar('2026-10-22', 'diagnostico', { exames: ['Tomografia computadorizada', 'Fistulografia', 'Linfangiografia'] });
  assert.deepEqual([d.prontuarios.length, d.vacinas.length], [0, 0]);
  const ids = (l) => new Set(l.map((x) => x.id));
  for (const [col, lista] of Object.entries(d)) { assert.equal(ids(lista).size, lista.length, 'ids repetidos em ' + col); assert.ok(lista.every((x) => x.exemplo === true || col === 'movimentos'), col + ' sem marca de exemplo'); }
  assert.deepEqual(d.servicos.map((s) => s.nome), ['Tomografia computadorizada (exemplo)', 'Fistulografia (exemplo)', 'Linfangiografia (exemplo)']);
  const pets = ids(d.pets), srv = ids(d.servicos), enc = ids(d.encaminhadores), prof = ids(d.profissionais), cons = Object.fromEntries(d.consultas.map((c) => [c.id, c]));
  const vistos = new Set();
  for (const e of d.exames) {
    assert.equal(R.validarExame(e), null, e.id);
    assert.ok(pets.has(e.petId) && srv.has(e.servicoId), e.id);
    if (e.encaminhadorId) assert.ok(enc.has(e.encaminhadorId), e.id);
    for (const k of ['responsavelId', 'laudoPorId']) if (e[k]) assert.ok(prof.has(e[k]), e.id + ' ' + k);
    if (e.consultaId) { assert.ok(cons[e.consultaId], e.id + ': consulta inexistente'); assert.ok(!vistos.has(e.consultaId), 'dois exames na mesma consulta'); vistos.add(e.consultaId); assert.equal(cons[e.consultaId].petId, e.petId, e.id + ': pet da agenda diferente'); }
  }
  assert.deepEqual([...new Set(d.exames.map((e) => e.status))].sort(), ['agendado', 'cancelado', 'entregue', 'laudado', 'realizado', 'solicitado']);
  assert.deepEqual(new Set(d.exames.map((e) => R.grupoDoExame(e, cons[e.consultaId]))), new Set(['agendar', 'agendados', 'laudo', 'entrega', 'entregues', 'cancelados']));
  assert.ok(d.consultas.every((c) => c.petId && pets.has(c.petId) && prof.has(c.profissionalId) && srv.has(c.servicoId)));
  const semOpcoes = Seed.gerar('2026-10-22', 'diagnostico'); assert.ok(semOpcoes.servicos.every((s) => /^Exame de imagem \d \(exemplo\)$/.test(s.nome)), 'sem a lista do site, nomes genéricos (nada de tomografia inventada)');
  assert.ok(!Seed.gerar('2026-10-22', 'geral').exames && !Seed.gerar('2026-10-22', 'hospital24h').exames);
  assert.ok(!JSON.stringify(Seed.gerar('2026-10-22', 'exoticos')).includes('Exame de imagem'));
});
test('seed diagnostico: carregar uma vez só; remover leva o exame (e o laudo) do paciente de exemplo e preserva o exame real de paciente real', async () => {
  const s = Store.criarStore(Store.adaptadorMemoria(), ['exames', 'encaminhadores']);
  assert.ok((await Seed.carregar(s, '2026-10-22', 'diagnostico')) > 0); assert.equal(await Seed.carregar(s, '2026-10-22', 'diagnostico'), 0);
  assert.equal((await s.listar('exames')).length, 8);
  await s.salvar('tutores', { id: 't-real', nome: 'Real' }); await s.salvar('pets', { id: 'p-real', tutorId: 't-real', nome: 'Meu pet', especie: 'Cão' });
  await s.salvar('exames', { id: 'x-real', petId: 'p-real', servicoId: 'serv-real', encaminhadorId: 'ex-enc-1', status: 'solicitado', solicitadoEm: '2026-10-22T08:00', consultaId: '' });
  await s.salvar('exames', { id: 'x-pet-ex', petId: 'ex-pet-1', servicoId: 'serv-real', status: 'solicitado', solicitadoEm: '2026-10-22T08:00', consultaId: '' }); // exame do usuário num paciente de exemplo
  await Seed.remover(s);
  assert.deepEqual((await s.listar('exames')).map((e) => e.id), ['x-real']);
  assert.deepEqual((await s.listar('encaminhadores')).map((e) => e.id), ['ex-enc-1']); // o exame real cita o encaminhador de exemplo: ele fica
});

/* ---------- v0.5: achados da revisão independente do módulo de exames (cada um reprova no código anterior) ---------- */
test('[revisão] edição geral parte do que o formulário mudou: o laudo escrito em outra aba não é apagado, e campo mudado nos dois lados recusa', () => comDiagnostico(() => {
  const inicial = examePronto({ status: 'realizado', laudo: '', indicacao: 'ind', obs: '' });                    // o que o formulário do veterinário A mostrava ao abrir
  const atual = { ...inicial, status: 'laudado', laudoPorId: 'p', laudoEm: '2026-10-22T10:00', realizadoEm: '2026-10-22T09:30', laudo: 'laudo do colega' }; // o veterinário B laudou enquanto isso
  const r = R.mesclarExameEditado('veterinario', atual, inicial, { ...inicial, obs: 'ajuste do A' });
  assert.equal(r.obs, 'ajuste do A'); assert.equal(r.laudo, 'laudo do colega', 'o campo velho apagou o laudo do colega'); assert.equal(r.status, 'laudado');
  assert.throws(() => R.mesclarExameEditado('veterinario', atual, inicial, { ...inicial, laudo: 'texto do A' }), /"Laudo" foi alterado em outra aba/);
  assert.equal(R.mesclarExameEditado('veterinario', { ...atual, laudo: '' }, inicial, { ...inicial, laudo: 'texto do A' }).laudo, 'texto do A'); // mudou só de um lado: passa
  assert.throws(() => R.mesclarExameEditado('veterinario', atual, inicial, { ...inicial, petId: 'outro' }), /paciente não muda/); // já tem resultado
  assert.equal(R.mesclarExameEditado('recepcao', examePronto(), examePronto(), { ...examePronto(), petId: 'p9' }).petId, 'p9'); // solicitado: pode trocar
  assert.equal(R.mesclarExameEditado('recepcao', atual, inicial, { ...inicial, laudo: 'INVENTADO', indicacao: 'INVENTADA', obs: 'x' }).laudo, 'laudo do colega', 'recepção não escreve laudo');
  assert.throws(() => R.mesclarExameEditado('dono', null, inicial, inicial), /excluído em outra aba/);
  assert.deepEqual(R.mesclarExameEditado('dono', atual, null, null), atual); assert.doesNotThrow(() => R.mesclarExameEditado('dono', atual, 'x', [1]));
}));
test('[revisão] desfazer a realização reabre a consulta concluída (senão o exame fica "agendado" num horário já concluído)', () => {
  assert.equal(R.statusDaConsultaDoExame('concluida', 'realizado', 'agendado'), 'confirmada');
  for (const s of ['cancelada', 'faltou', undefined]) assert.equal(R.statusDaConsultaDoExame(s, 'realizado', 'agendado'), null);
  assert.equal(R.statusDaConsultaDoExame('concluida', 'laudado', 'realizado'), null);
});
test('[revisão] importação: registro sem nome ou sem início da consulta e passo da agenda inválido são recusados (as telas quebravam e a agenda travava)', () => {
  const ok = (colecoes) => Store.validarExportacao({ versao: 1, colecoes }, [...Store.COLECOES, 'exames', 'encaminhadores', 'leitos']);
  for (const [col, item, campo] of [['tutores', {}, 'nome'], ['pets', { nome: '  ' }, 'nome'], ['profissionais', { nome: 7 }, 'nome'], ['servicos', {}, 'nome'], ['estoque', {}, 'nome'], ['leitos', {}, 'nome'], ['encaminhadores', {}, 'nome'], ['consultas', { petId: 'p' }, 'inicio']]) {
    const r = ok({ [col]: [{ id: 'z', ...item }] }); assert.equal(r.ok, false, col); assert.match(r.erro, new RegExp('"' + campo + '"'), col);
  }
  assert.match(ok({ consultas: [{ id: 'c', inicio: '2026-10-22' }] }).erro, /data e hora/);
  assert.equal(ok({ consultas: [{ id: 'c', inicio: '2026-10-22T09:00' }], tutores: [{ id: 't', nome: 'Ana' }] }).ok, true);
  for (const ruim of [-5, 0, 0.0001, '30', 5.5, 99999, null === 1]) assert.equal(ok({ config: [{ id: 'clinica', passoAgenda: ruim }] }).ok, false, String(ruim));
  assert.equal(ok({ config: [{ id: 'clinica', passoAgenda: 15, duracaoPadrao: 30, nome: 'x' }] }).ok, true);
  assert.equal(ok({ config: [{ id: 'clinica' }] }).ok, true);
});
test('[revisão] horários livres terminam mesmo com passo negativo ou quase zero (a aba travava)', () => {
  for (const passo of [-5, 0, 0.0001, 'abc', NaN]) {
    const t0 = Date.now(), l = R.horariosLivres([], { data: '2026-10-22', passo, duracao: passo, abertura: '08:00', fechamento: '18:00' });
    assert.ok(Date.now() - t0 < 500 && l.length > 0 && l.length <= 120, String(passo));
  }
});

test('[revisão] remover exemplos mantém (sem a marca de exemplo) o profissional, o serviço e o encaminhador de exemplo que um exame REAL cita', async () => {
  const s = Store.criarStore(Store.adaptadorMemoria(), ['exames', 'encaminhadores']);
  await Seed.carregar(s, '2026-10-22', 'diagnostico');
  await s.salvar('tutores', { id: 't-real', nome: 'Real' }); await s.salvar('pets', { id: 'p-real', tutorId: 't-real', nome: 'Meu pet', especie: 'Cão' });
  await s.salvar('exames', { id: 'x-real', petId: 'p-real', servicoId: 'ex-serv-1', encaminhadorId: 'ex-enc-1', status: 'laudado', consultaId: '', solicitadoEm: '2026-10-22T08:00', realizadoEm: '2026-10-22T09:00', responsavelId: 'ex-prof-2', laudoEm: '2026-10-22T10:00', laudoPorId: 'ex-prof-1', laudo: 'texto' });
  await Seed.remover(s);
  assert.deepEqual((await s.listar('profissionais')).map((x) => x.id).sort(), ['ex-prof-1', 'ex-prof-2']); assert.deepEqual((await s.listar('servicos')).map((x) => x.id), ['ex-serv-1']);
  assert.deepEqual((await s.listar('encaminhadores')).map((x) => x.id), ['ex-enc-1']); assert.deepEqual((await s.listar('exames')).map((x) => x.id), ['x-real']);
  for (const col of ['profissionais', 'servicos', 'encaminhadores']) assert.ok((await s.listar(col)).every((x) => !x.exemplo), col + ' ainda marcado como exemplo');
  assert.equal(await Seed.existeExemplo(s), false, 'sobrou marca de exemplo');
});

/* =====================================================================================================================
   v0.6 (site 5, Nutrimed Ipanema): importação de backup antigo, referências quebradas, venda no balcão.
   Os marcados [defeito do v0.5] reprovam no painel v0.5 (foram reproduzidos antes da correção).
   ===================================================================================================================== */
const EXTRAS_DIAG = ['exames', 'encaminhadores'];
const ids = (l) => l.map((x) => x.id).sort();
async function lojaComExames() {
  const s = Store.criarStore(Store.adaptadorMemoria(), EXTRAS_DIAG);
  await s.salvar('tutores', { id: 't1', nome: 'Ana' }); await s.salvar('tutores', { id: 't2', nome: 'Beto' });
  await s.salvar('pets', { id: 'p1', tutorId: 't1', nome: 'Bidu', especie: 'Cão' }); await s.salvar('pets', { id: 'p2', tutorId: 't2', nome: 'Mia', especie: 'Gato' });
  await s.salvar('consultas', { id: 'c1', petId: 'p1', tutorId: 't1', inicio: '2026-10-22T09:00' });
  await s.salvar('exames', { id: 'x1', petId: 'p1', servicoId: 's1', status: 'laudado', laudo: 'texto do laudo', solicitadoEm: '2026-10-22T08:00' });
  await s.salvar('encaminhadores', { id: 'e1', nome: 'Clínica Y' });
  return s;
}
/* backup feito antes de a coleção existir (ex.: exportado por uma clínica geral e importado no centro de diagnóstico): traz pets e consultas, não traz exames */
const BACKUP_ANTIGO = { versao: 1, colecoes: { tutores: [{ id: 'old-t', nome: 'Antigo' }], pets: [{ id: 'old-p', tutorId: 'old-t', nome: 'Rex', especie: 'Cão' }], consultas: [{ id: 'old-c', petId: 'old-p', inicio: '2026-01-10T09:00' }] } };

test('[defeito do v0.5] importar backup antigo (sem a coleção exames): exames de pets que sumiram não ficam órfãos; o que o arquivo não traz fica vazio', async () => {
  const s = await lojaComExames();
  const v = Store.validarExportacao(BACKUP_ANTIGO, s.colecoes);
  assert.equal(v.ok, true);
  assert.ok(v.ausentes.includes('exames') && v.ausentes.includes('encaminhadores') && v.ausentes.includes('prontuarios') && v.ausentes.includes('config'), 'o resultado diz o que o arquivo não traz');
  assert.ok(!v.ausentes.includes('usuarios') && !v.ausentes.includes('tutores'));
  await s.importar(BACKUP_ANTIGO);
  assert.deepEqual(ids(await s.listar('pets')), ['old-p']);
  const orfaos = Store.referenciasQuebradas(Object.fromEntries(await Promise.all(s.colecoes.filter((c) => c !== 'usuarios').map(async (c) => [c, await s.listar(c)]))));
  assert.deepEqual(orfaos, [], 'nenhum registro pode citar um tutor, pet ou internação que não existe mais');
  assert.deepEqual(await s.listar('exames'), [], 'o exame do pet substituído não pode sobrar sem o pet');
  assert.deepEqual(await s.listar('encaminhadores'), []);
});

test('[defeito do v0.5] importação: quem cuida do aviso sabe o que vai ficar vazio (ausentes) e o que o arquivo cita e não traz (referências quebradas)', async () => {
  const s = await lojaComExames();
  // arquivo incompleto de propósito: consultas e exames que citam pets que o arquivo não traz
  const parcial = { versao: 1, colecoes: { tutores: [{ id: 'a', nome: 'A' }], consultas: [{ id: 'k', petId: 'sumiu', inicio: '2026-10-22T09:00' }], servicos: [{ id: 's', nome: 'S' }], exames: [{ id: 'z', petId: 'sumiu', servicoId: 's', status: 'solicitado' }] } };
  const v = Store.validarExportacao(parcial, s.colecoes);
  assert.equal(v.ok, true, 'o arquivo é aceito (o aviso fica com a tela), mas ela precisa saber');
  assert.ok(v.ausentes.includes('pets'));
  assert.deepEqual(v.quebradas.map((q) => q.colecao + '.' + q.campo).sort(), ['consultas.petId', 'exames.petId']);
  assert.ok(v.quebradas.every((q) => q.quantidade === 1 && q.alvo === 'pets'));
});

test('importação: coleção que a loja tem e o arquivo não traz é esvaziada; se a gravação falha no meio, TUDO volta (inclusive o que seria esvaziado)', async () => {
  const ad = Store.adaptadorMemoria(), s = Store.criarStore(ad, EXTRAS_DIAG);
  await s.salvar('tutores', { id: 't1', nome: 'Ana' }); await s.salvar('exames', { id: 'x1', petId: 'p', servicoId: 's', status: 'solicitado' });
  await s.salvar('estoque', { id: 'e1', nome: 'Item', quantidade: 3 });
  const gravar = ad.gravar; let n = 0;
  ad.gravar = (col, item) => (++n === 2 ? Promise.reject(new Error('disco cheio')) : gravar(col, item));
  await assert.rejects(s.importar({ versao: 1, colecoes: { tutores: [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }] } }), /restaurad/i);
  ad.gravar = gravar;
  assert.deepEqual(ids(await s.listar('tutores')), ['t1']); assert.deepEqual(ids(await s.listar('exames')), ['x1']); assert.deepEqual(ids(await s.listar('estoque')), ['e1']);
});

test('importação: arquivo hostil continua recusado ANTES de esvaziar qualquer coisa, inclusive o que ele não traz', async () => {
  const s = await lojaComExames();
  for (const dump of [{ versao: 1, colecoes: { pets: [null] } }, { versao: 1, colecoes: { pets: [{ id: '__proto__' }] } }, { versao: 1, colecoes: { tutores: 'x' } }, { versao: 1, colecoes: {} }, { versao: 1, colecoes: { qualquer: [] } }, null, 'x', { versao: 1, colecoes: { usuarios: [] } }]) {
    await assert.rejects(s.importar(dump), Error);
    assert.deepEqual(ids(await s.listar('exames')), ['x1']); assert.deepEqual(ids(await s.listar('pets')), ['p1', 'p2']); assert.deepEqual(ids(await s.listar('encaminhadores')), ['e1']);
  }
});

test('referenciasQuebradas: só conta citação a cadastro que falta; entrada hostil (null, __proto__, texto onde se espera lista) não derruba', () => {
  const ok = { tutores: [{ id: 't' }], pets: [{ id: 'p', tutorId: 't' }], consultas: [{ id: 'c', petId: 'p' }], prontuarios: [{ id: 'r', petId: 'p' }], vacinas: [], exames: [{ id: 'x', petId: 'p' }], internacoes: [{ id: 'i', petId: 'p', leitoId: 'l' }], leitos: [{ id: 'l' }], evolucoes: [{ id: 'e', internacaoId: 'i' }] };
  assert.deepEqual(Store.referenciasQuebradas(ok), []);
  const r = Store.referenciasQuebradas({ ...ok, pets: [], leitos: [] });
  assert.deepEqual(r.map((q) => q.colecao + '.' + q.campo).sort(), ['consultas.petId', 'exames.petId', 'internacoes.leitoId', 'internacoes.petId', 'prontuarios.petId']);
  for (const hostil of [null, 'x', 7, [], { pets: 'oops', consultas: [null, 3, 'x', { id: 'c', petId: {} }], exames: [{ id: 'x', petId: ['p'] }], tutores: [{ id: '__proto__' }] }, JSON.parse('{"pets":[{"id":"p","__proto__":{"tutorId":"z"}}]}')]) {
    assert.doesNotThrow(() => Store.referenciasQuebradas(hostil)); assert.ok(Array.isArray(Store.referenciasQuebradas(hostil)));
  }
  // citação vazia (sem tutor, sem pet) não é referência; id que é nome do Object não "existe" por herança
  assert.deepEqual(Store.referenciasQuebradas({ pets: [{ id: 'p', tutorId: '' }], consultas: [{ id: 'c', petId: 'toString' }] }).map((q) => q.colecao), ['consultas']);
});

/* ---------- venda no balcão (subtipo clinica_loja) ---------- */
const LOJA = JSON.parse(fs.readFileSync(path.join(aqui, '../subtipos/clinica_loja.json'), 'utf8'));

test('venda: calcularVenda confere preço, quantidade inteira e saldo; em branco o valor é preço x quantidade', () => {
  const item = { id: 'i', nome: 'Ração (exemplo)', quantidade: 10, precoVendaCents: 8990 };
  assert.deepEqual(R.calcularVenda(item, 2), { qtd: 2, valorCents: 17980, novaQuantidade: 8 });
  assert.deepEqual(R.calcularVenda(item, '3', null), { qtd: 3, valorCents: 26970, novaQuantidade: 7 });
  assert.deepEqual(R.calcularVenda(item, 10, ''), { qtd: 10, valorCents: 89900, novaQuantidade: 0 });
  assert.equal(R.calcularVenda(item, 2, 15000).valorCents, 15000, 'o valor combinado vale no lugar de preço x quantidade');
  for (const q of [0, -1, 1.5, NaN, Infinity, 'abc', '', null, undefined, {}, [], true]) assert.throws(() => R.calcularVenda(item, q), /quantidade inteira/, String(q));
  assert.throws(() => R.calcularVenda(item, 11), /maior que o estoque \(10\)/);
  for (const v of [0, -5, 1.5, NaN, Infinity, '150', {}, [], true]) assert.throws(() => R.calcularVenda(item, 1, v), /maior que zero/, String(v));
  assert.throws(() => R.calcularVenda(item, 1, R.TETO_CENTAVOS + 1), /acima do permitido/);
  assert.throws(() => R.calcularVenda({ ...item, quantidade: 1e12, precoVendaCents: R.TETO_CENTAVOS }, 2), /acima do permitido/, 'preço x quantidade acima do teto');
});

test('venda: item sem preço válido ou entrada hostil nunca vende', () => {
  for (const preco of [undefined, null, 0, -100, 12.5, NaN, Infinity, '89,90', '8990', {}, [], true, R.TETO_CENTAVOS + 1]) {
    assert.equal(R.precoDeVenda({ quantidade: 5, precoVendaCents: preco }), null, String(preco));
    assert.throws(() => R.calcularVenda({ quantidade: 5, precoVendaCents: preco }, 1), /não tem preço de venda/, String(preco));
  }
  for (const item of [null, undefined, 'x', 7, [], [{ precoVendaCents: 100 }]]) { assert.equal(R.precoDeVenda(item), null); assert.throws(() => R.calcularVenda(item, 1), /preço de venda/); }
  assert.throws(() => R.calcularVenda({ precoVendaCents: 100, quantidade: 'abc' }, 1), /maior que o estoque/, 'saldo que não é número vale zero');
  assert.equal(R.descricaoDaVenda({ nome: '  Ração  ' }, 2), 'Venda: Ração × 2');
  assert.equal(R.descricaoDaVenda({ nome: { x: 1 } }, 1), 'Venda: item × 1'); assert.equal(R.descricaoDaVenda(null, 1), 'Venda: item × 1');
});

test('venda: a receita clinica_loja dá a venda ao dono e à recepção (não ao veterinário) e renomeia o estoque; os outros subtipos não ganham nada', () => {
  comModulos(LOJA.painel, () => {
    assert.equal(R.podeEscrever('dono', 'vendas'), true); assert.equal(R.podeEscrever('recepcao', 'vendas'), true);
    assert.equal(R.permissao('veterinario', 'vendas'), null);
    assert.equal(R.permissao('recepcao', 'estoque'), 'r', 'a recepção segue só lendo o estoque (não edita preço nem saldo)');
    assert.equal(R.tituloDaTela('estoque', 'Estoque'), 'Estoque e produtos');
    assert.deepEqual(R.modulosDoPerfil('dono'), ['inicio', 'agenda', 'tutores', 'prontuarios', 'vacinas', 'caixa', 'estoque', 'equipe', 'config'], '"vendas" é permissão virtual: não vira tela nem entra no menu');
    assert.equal(R.permissao('dono', 'constructor'), null);
  });
  for (const outro of ['geral', 'exoticos', 'hospital24h', 'diagnostico']) {
    const cfg = JSON.parse(fs.readFileSync(path.join(aqui, `../subtipos/${outro}.json`), 'utf8')).painel;
    comModulos(cfg, () => { for (const perfil of ['dono', 'veterinario', 'recepcao']) assert.equal(R.permissao(perfil, 'vendas'), null, outro + '/' + perfil); });
    assert.ok(!('venda' in cfg), outro);
  }
  assert.equal(LOJA.painel.venda, true);
});

test('seed clinica_loja: as 9 telas de sempre mais produtos à venda e uma venda de exemplo coerente (saída no histórico + entrada no caixa)', async () => {
  const base = Seed.gerar('2026-10-22', null), l = Seed.gerar('2026-10-22', 'clinica_loja');
  for (const col of Object.keys(base)) for (const x of base[col]) assert.ok(l[col].some((y) => y.id === x.id), col + ' ' + x.id);
  assert.equal(l.estoque.length, base.estoque.length + 2); assert.equal(l.movimentos.length, 1); assert.equal(l.lancamentos.length, base.lancamentos.length + 1);
  for (const col of Object.keys(l)) assert.ok(l[col].every((x) => x.exemplo === true), col + ': tudo marcado como exemplo');
  const venda = l.lancamentos.find((x) => x.categoria === 'Venda de produtos'), item = l.estoque.find((x) => x.id === venda.itemId);
  assert.ok(item && R.precoDeVenda(item) && /exemplo/.test(item.nome) && /exemplo/.test(venda.descricao)); assert.equal(venda.valorCents, item.precoVendaCents);
  assert.deepEqual(l.movimentos[0], { id: 'ex-mov-1', itemId: item.id, tipo: 'saida', qtd: 1, data: '2026-10-22', motivo: 'Venda no balcão', exemplo: true });
  assert.ok(l.estoque.filter((x) => R.precoDeVenda(x)).length >= 3);
  const s = Store.criarStore(Store.adaptadorMemoria());
  assert.ok((await Seed.carregar(s, '2026-10-22', 'clinica_loja')) > 0);
  const dump = await s.exportar(); assert.equal(Store.validarExportacao(dump, s.colecoes).ok, true, 'os exemplos importam');
  assert.deepEqual(Store.referenciasQuebradas(dump.colecoes), []);
  assert.equal(await Seed.remover(s) > 0, true); for (const col of ['estoque', 'movimentos', 'lancamentos']) assert.deepEqual(await s.listar(col), [], col + ' depois de remover os exemplos');
});

test('importação: valor em centavos que não é número inteiro (preço de venda, lançamento) é recusado antes de gravar', () => {
  const v = (colecoes) => Store.validarExportacao({ versao: 1, colecoes }, Store.COLECOES);
  for (const ruim of ['8990', 'abc', {}, [], true, 12.5, -1]) {
    assert.equal(v({ estoque: [{ id: 'e', nome: 'Item', precoVendaCents: ruim }] }).ok, false, 'preço ' + JSON.stringify(ruim));
    assert.equal(v({ lancamentos: [{ id: 'l', valorCents: ruim }] }).ok, false, 'valor ' + JSON.stringify(ruim));
  }
  assert.match(v({ estoque: [{ id: 'e', nome: 'Item', precoVendaCents: 'x' }] }).erro, /precoVendaCents/);
  assert.equal(v({ estoque: [{ id: 'e', nome: 'Item', precoVendaCents: 8990 }, { id: 'f', nome: 'Sem preço', precoVendaCents: null }, { id: 'g', nome: 'Outro' }], lancamentos: [{ id: 'l', valorCents: 0 }, { id: 'm', valorCents: 12000, itemId: 'e' }] }).ok, true);
  assert.equal(v({ lancamentos: [{ id: 'l', itemId: 7 }] }).ok, false, 'itemId é texto');
});

/* ---------- v0.6, achados da revisão independente ---------- */
function storageCota(max) { // localStorage falso com cota (o do navegador estoura em ~5 MB)
  const m = new Map(), tam = () => [...m].reduce((s, [k, v]) => s + k.length + v.length, 0);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => { m.delete(k); }, tam,
    setItem(k, v) { const velho = m.has(k) ? m.get(k) : null; if (tam() - (velho != null ? k.length + velho.length : 0) + k.length + v.length > max) throw new Error('QuotaExceededError'); m.set(k, v); } };
}
test('[revisão] importação que falha por cota cheia devolve TUDO que havia (limpa todos os grupos antes de regravar os antigos)', async () => {
  const big = (n) => 'x'.repeat(n), sto = storageCota(30000), s = Store.criarStore(Store.adaptadorLocalStorage('p', sto));
  await s.salvar('tutores', { id: 't1', nome: 'A', observacoes: big(14000) }); await s.salvar('pets', { id: 'p1', nome: 'B', tutorId: 't1' });
  // o arquivo cabe até os pets (20k) e estoura nas vacinas (20k); restaurar tutores (14k) ANTES de limpar os pets novos (20k) daria 34k e perderia dados
  const arquivo = { versao: 1, colecoes: { tutores: [{ id: 't2', nome: 'N' }], pets: [{ id: 'p2', nome: 'P', tutorId: 't2', raca: big(20000) }], vacinas: [{ id: 'v', petId: 'p2', vacina: big(20000) }] } };
  await assert.rejects(s.importar(arquivo), /Os dados anteriores foram restaurados/);
  assert.deepEqual((await s.listar('tutores')).map((x) => x.id), ['t1']); assert.deepEqual((await s.listar('pets')).map((x) => x.id), ['p1']); assert.deepEqual(await s.listar('vacinas'), []);
});

test('[revisão] importação: valorCents e precoVendaCents ausentes (lançamento), gigantes ou acima do teto são recusados (o Caixa mostrava NaN e "R$ 1.0.000...e+298")', () => {
  const v = (colecoes) => Store.validarExportacao({ versao: 1, colecoes }, Store.COLECOES);
  assert.match(v({ lancamentos: [{ id: 'l', data: '2026-10-22', tipo: 'entrada', descricao: 'x' }] }).erro, /valorCents/); // lançamento sem valor
  for (const ruim of [1e300, 2 ** 60, R.TETO_CENTAVOS + 1, 1e16]) {
    assert.equal(v({ lancamentos: [{ id: 'l', valorCents: ruim }] }).ok, false, 'valor ' + ruim);
    assert.equal(v({ estoque: [{ id: 'e', nome: 'x', precoVendaCents: ruim }] }).ok, false, 'preço ' + ruim);
  }
  assert.equal(v({ lancamentos: [{ id: 'l', valorCents: R.TETO_CENTAVOS }], estoque: [{ id: 'e', nome: 'x', precoVendaCents: R.TETO_CENTAVOS }] }).ok, true);
});

test('[revisão] venda: item vencido não vende (medicamento fora da validade); sem validade ou dentro dela vende', () => {
  const base = { nome: 'Vermífugo', quantidade: 5, precoVendaCents: 2490 };
  assert.throws(() => R.calcularVenda({ ...base, validade: '2026-10-21' }, 1, null, '2026-10-22'), /vencido.*21\/10\/2026/);
  assert.equal(R.calcularVenda({ ...base, validade: '2026-10-22' }, 1, null, '2026-10-22').qtd, 1, 'vence hoje ainda vende'); assert.equal(R.calcularVenda({ ...base, validade: '' }, 1, null, '2026-10-22').qtd, 1);
  assert.equal(R.calcularVenda({ ...base, validade: '2020-01-01' }, 1).qtd, 1, 'sem a data de hoje a regra não se aplica (quem chama sempre passa)');
  assert.equal(R.calcularVenda({ ...base, validade: 'lixo' }, 1, null, '2026-10-22').qtd, 1, 'data ilegível não bloqueia nem derruba');
});

test('[revisão] venda com valor combinado diferente da tabela deixa o rastro na descrição; a de tabela não', () => {
  const item = { nome: 'Ração', quantidade: 10, precoVendaCents: 8990 };
  assert.equal(R.descricaoDaVenda(item, 2), 'Venda: Ração × 2');
  assert.equal(R.descricaoDaVenda(item, 2, 15000), 'Venda: Ração × 2 (valor combinado; tabela R$ 179,80)');
  assert.equal(R.descricaoDaVenda(item, 2, 17980), 'Venda: Ração × 2'); assert.equal(R.descricaoDaVenda(item, 2, null), 'Venda: Ração × 2');
});

/* =====================================================================================================================
   v0.7 (site 6: Doc & Dog, hospital 24h). Os marcados [defeito do v0.6] reprovam no painel v0.6 (foram reproduzidos antes da correção).
   ===================================================================================================================== */
const COMPLETO = {
  tutores: [{ id: 't', nome: 'T' }], pets: [{ id: 'p', nome: 'P', tutorId: 't' }], profissionais: [{ id: 'pr', nome: 'Pr' }], servicos: [{ id: 'sv', nome: 'Sv' }], encaminhadores: [{ id: 'en', nome: 'En' }], leitos: [{ id: 'l', nome: 'L' }],
  consultas: [{ id: 'c', petId: 'p', inicio: '2026-10-22T09:00', profissionalId: 'pr', servicoId: 'sv' }], prontuarios: [{ id: 'r', petId: 'p', profissionalId: 'pr' }], vacinas: [{ id: 'v', petId: 'p', profissionalId: 'pr' }],
  exames: [{ id: 'x', petId: 'p', status: 'solicitado', servicoId: 'sv', consultaId: 'c', responsavelId: 'pr', laudoPorId: 'pr', encaminhadorId: 'en' }],
  internacoes: [{ id: 'i', petId: 'p', leitoId: 'l', responsavelId: 'pr' }], evolucoes: [{ id: 'e', internacaoId: 'i', profissionalId: 'pr' }], plantoes: [{ id: 'pl', profissionalId: 'pr' }]
};

test('[defeito do v0.6] referenciasQuebradas cobre profissional, serviço e encaminhador (antes só pet, tutor, leito e internação); a consulta do exame fica de fora', () => {
  assert.deepEqual(Store.referenciasQuebradas(COMPLETO), []);
  const sem = (...nomes) => Object.fromEntries(Object.entries(COMPLETO).map(([k, v]) => [k, nomes.includes(k) ? [] : v]));
  const chaves = (c) => Store.referenciasQuebradas(c).map((q) => q.colecao + '.' + q.campo).sort();
  assert.deepEqual(chaves(sem('profissionais')), ['consultas.profissionalId', 'evolucoes.profissionalId', 'exames.laudoPorId', 'exames.responsavelId', 'internacoes.responsavelId', 'plantoes.profissionalId', 'prontuarios.profissionalId', 'vacinas.profissionalId']);
  assert.deepEqual(chaves(sem('servicos')), ['consultas.servicoId', 'exames.servicoId']);
  assert.deepEqual(chaves(sem('consultas')), [], 'exames.consultaId NÃO é referência: a Agenda exclui a consulta e o exame vira "remarcar" (arquivo legítimo)');
  assert.deepEqual(chaves(sem('encaminhadores')), ['exames.encaminhadorId']);
  // o aviso da tela de importação usa o mesmo cálculo: arquivo aceito, com o aviso
  const v = Store.validarExportacao({ versao: 1, colecoes: sem('profissionais', 'servicos') }, Store.COLECOES.concat(['encaminhadores', 'leitos', 'internacoes', 'evolucoes', 'plantoes', 'exames']));
  assert.equal(v.ok, true); assert.ok(v.quebradas.some((q) => q.colecao === 'consultas' && q.campo === 'profissionalId' && q.alvo === 'profissionais' && q.quantidade === 1));
  // citação vazia não é referência, e o que a exclusão nunca apagou continua fora (movimento de estoque, lançamento, lembrete)
  assert.deepEqual(chaves({ consultas: [{ id: 'c', petId: '', profissionalId: '', servicoId: '' }], movimentos: [{ id: 'm', itemId: 'sumiu' }], lancamentos: [{ id: 'l', itemId: 'sumiu', consultaId: 'sumiu' }], lembretes: [{ id: 'z', chave: 'vacina:sumiu' }] }), []);
  // entrada hostil não derruba e "toString"/"__proto__" não existem por herança
  for (const hostil of [{ consultas: [null, 3, { id: 'c', profissionalId: {}, servicoId: ['x'] }], profissionais: 'oops', servicos: [{ id: '__proto__' }] }, JSON.parse('{"exames":[{"id":"x","__proto__":{"consultaId":"z"},"servicoId":"toString"}]}')]) assert.doesNotThrow(() => Store.referenciasQuebradas(hostil));
  assert.deepEqual(chaves({ consultas: [{ id: 'c', profissionalId: 'toString' }] }), ['consultas.profissionalId']);
});

test('[defeito do v0.6] importar milhares de registros no localStorage grava cada grupo UMA vez (era O(n²): 3.000 registros levavam ~1,4 s e 6.000 ~5,5 s)', async () => {
  const m = new Map(), gravacoes = [];
  const sto = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { gravacoes.push(k); m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
  const s = Store.criarStore(Store.adaptadorLocalStorage('p', sto));
  const N = 6000;
  const dump = { versao: 1, colecoes: { tutores: [{ id: 't', nome: 'A' }], pets: Array.from({ length: N }, (_, i) => ({ id: 'p' + i, nome: 'Pet ' + i, tutorId: 't' })), consultas: Array.from({ length: N }, (_, i) => ({ id: 'c' + i, petId: 'p' + i, inicio: '2026-10-22T09:00' })) } };
  gravacoes.length = 0;
  const t0 = Date.now(); await s.importar(dump); const ms = Date.now() - t0;
  assert.equal((await s.listar('pets')).length, N); assert.equal((await s.listar('consultas')).length, N);
  assert.deepEqual((await s.listar('pets')).slice(0, 3).map((x) => x.id), ['p0', 'p1', 'p2'], 'a ordem do arquivo é mantida');
  assert.ok(gravacoes.filter((k) => k === 'p:pets').length <= 1, 'os pets são gravados de uma vez: ' + gravacoes.filter((k) => k === 'p:pets').length + ' gravações');
  assert.ok(gravacoes.length <= 20, 'no total ' + gravacoes.length + ' gravações no armazenamento (uma por grupo)');
  assert.ok(ms < 2500, 'importar 12.000 registros levou ' + ms + ' ms');
});

test('importação em lote: adaptador só com as 4 operações (servidor) continua funcionando e a restauração também; lote que falha devolve TUDO', async () => {
  const base = Store.adaptadorMemoria();
  const simples = { nome: 'servidor', listar: base.listar, gravar: base.gravar, excluir: base.excluir, limpar: base.limpar };
  const s = Store.criarStore(simples);
  await s.salvar('tutores', { id: 't1', nome: 'Ana' });
  await s.importar({ versao: 1, colecoes: { tutores: [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }] } });
  assert.deepEqual(ids(await s.listar('tutores')), ['a', 'b']);
  // lote que falha: restaura todos os grupos
  const ad = Store.adaptadorLocalStorage('q', falsoLocalStorage()), s2 = Store.criarStore(ad);
  await s2.salvar('tutores', { id: 't1', nome: 'Ana' }); await s2.salvar('estoque', { id: 'e1', nome: 'Item', quantidade: 3 });
  const lote = ad.gravarLote; assert.equal(typeof lote, 'function', 'o localStorage tem gravação em lote'); let n = 0;
  ad.gravarLote = (col, itens) => (itens.length && ++n === 2 ? Promise.reject(new Error('disco cheio')) : lote(col, itens));
  await assert.rejects(s2.importar({ versao: 1, colecoes: { tutores: [{ id: 'a', nome: 'A' }], pets: [{ id: 'p', nome: 'P', tutorId: 'a' }] } }), /restaurad/i);
  ad.gravarLote = lote;
  assert.deepEqual(ids(await s2.listar('tutores')), ['t1']); assert.deepEqual(ids(await s2.listar('estoque')), ['e1']); assert.deepEqual(await s2.listar('pets'), []);
});

/* ---------- internação restrita para a recepção (opção do subtipo hospital24h, v0.7) ---------- */
const OPCAO_RECEPCAO = HOSPITAL.opcoes && HOSPITAL.opcoes.recepcao_ve_leitos;
const HOSP_RECEPCAO = OPCAO_RECEPCAO && { ...HOSPITAL.painel, matriz: { ...HOSPITAL.painel.matriz, recepcao: { ...(HOSPITAL.painel.matriz.recepcao || {}), ...OPCAO_RECEPCAO.painel.matriz.recepcao } } };
const INTERNACAO_CLINICA = { id: 'i1', petId: 'p1', leitoId: 'l1', entradaEm: '2026-10-22T08:00', status: 'internado', motivo: 'SEGREDO motivo', situacao: 'Requer atenção', previsaoAlta: '2026-10-25',
  responsavelId: 'pr', desfecho: 'Óbito', resumoSaida: 'SEGREDO saída', saidaEm: '2026-10-23T08:00', exemplo: true, campoFuturo: 'SEGREDO futuro' };

test('internação restrita: a opção existe no subtipo hospital24h, é opcional (o padrão segue sem acesso) e só a recepção muda', () => {
  assert.ok(OPCAO_RECEPCAO, 'subtipos/hospital24h.json → opcoes.recepcao_ve_leitos');
  assert.equal(OPCAO_RECEPCAO.painel.matriz.recepcao.internacao, 'r');
  assert.deepEqual(Object.keys(OPCAO_RECEPCAO.painel.matriz), ['recepcao'], 'a opção não toca em dono nem veterinário');
  assert.ok(typeof OPCAO_RECEPCAO.resumo_painel === 'string' && /recepção/i.test(OPCAO_RECEPCAO.resumo_painel) && !/IA|agente|Claude/.test(OPCAO_RECEPCAO.resumo_painel));
  assert.equal((HOSPITAL.painel.matriz.recepcao || {}).internacao, undefined, 'sem a opção, o hospital continua sem internação para a recepção (site 3)');
  comModulos(HOSPITAL.painel, () => {
    assert.equal(R.permissao('recepcao', 'internacao'), null); assert.equal(R.visaoRestritaInternacao('recepcao'), false);
    assert.deepEqual(R.modulosDoPerfil('recepcao').includes('internacao'), false);
    assert.deepEqual(R.internacoesParaPerfil('recepcao', [INTERNACAO_CLINICA]), [], 'sem acesso nenhum, nada sai');
    assert.deepEqual(R.evolucoesParaPerfil('recepcao', [{ id: 'e', internacaoId: 'i1', texto: 'SEGREDO' }]), []);
  });
});

test('internação restrita: recepção com leitura vê leito, paciente e entrada; motivo, situação, previsão, desfecho, responsável e campos novos nunca saem (lista de permitidos)', () => {
  assert.ok(HOSP_RECEPCAO);
  comModulos(HOSP_RECEPCAO, () => {
    assert.equal(R.permissao('recepcao', 'internacao'), 'r'); assert.equal(R.podeEscrever('recepcao', 'internacao'), false); assert.equal(R.podeExcluir('recepcao', 'internacao'), false);
    assert.ok(R.modulosDoPerfil('recepcao').includes('internacao'));
    assert.equal(R.visaoRestritaInternacao('recepcao'), true); assert.equal(R.visaoRestritaInternacao('dono'), false); assert.equal(R.visaoRestritaInternacao('veterinario'), false);
    assert.equal(R.visaoRestritaInternacao('perfil-que-nao-existe'), false); assert.equal(R.visaoRestritaInternacao('constructor'), false); assert.equal(R.visaoRestritaInternacao(undefined), false);
    const lista = [INTERNACAO_CLINICA, null, 7, 'x', [], undefined, JSON.parse('{"id":"h","petId":"p","leitoId":"l","motivo":"SEGREDO","__proto__":{"motivo":"SEGREDO"}}')];
    const v = R.internacoesParaPerfil('recepcao', lista);
    assert.equal(v.length, 2, 'null, número, texto e lista somem da cópia restrita');
    assert.deepEqual(Object.keys(v[0]).sort(), ['entradaEm', 'exemplo', 'id', 'leitoId', 'petId', 'status']);
    assert.ok(!JSON.stringify(v).includes('SEGREDO'), 'nada do clínico na cópia restrita');
    assert.equal(Object.getPrototypeOf(v[1]), Object.prototype); assert.equal(v[1].motivo, undefined); assert.equal({}.motivo, undefined, 'sem poluir o protótipo');
    assert.equal(INTERNACAO_CLINICA.motivo, 'SEGREDO motivo', 'o original não é alterado');
    assert.equal(R.internacaoParaPerfil('recepcao', null), null); assert.equal(R.internacaoParaPerfil('recepcao', 'x'), null);
    assert.deepEqual(R.internacoesParaPerfil('recepcao', 'oops'), []); assert.deepEqual(R.internacoesParaPerfil('recepcao', null), []);
    // dono e veterinário leem tudo; observações só para quem escreve na internação
    assert.deepEqual(R.internacoesParaPerfil('veterinario', [INTERNACAO_CLINICA]), [INTERNACAO_CLINICA]); assert.deepEqual(R.internacoesParaPerfil('dono', [INTERNACAO_CLINICA]), [INTERNACAO_CLINICA]);
    const obs = [{ id: 'e', internacaoId: 'i1', texto: 'SEGREDO' }];
    assert.deepEqual(R.evolucoesParaPerfil('recepcao', obs), []); assert.equal(R.evolucoesParaPerfil('veterinario', obs).length, 1); assert.deepEqual(R.evolucoesParaPerfil('recepcao', 'oops'), []);
  });
});

test('internação restrita: o arquivo do tutor da recepção leva a internação recortada, sem observações, e diz o que omitiu; sem a opção a recepção não leva nada de internação', () => {
  assert.ok(HOSP_RECEPCAO);
  const dados = { tutor: { id: 't1' }, pets: [{ id: 'p1' }], consultas: [], prontuarios: [{ id: 'r', queixa: 'SEGREDO' }], vacinas: [], internacoes: [INTERNACAO_CLINICA], evolucoes: [{ id: 'e', internacaoId: 'i1', texto: 'SEGREDO' }], lancamentos: [] };
  comModulos(HOSP_RECEPCAO, () => {
    const rec = R.recortarDadosDoTutor('recepcao', dados);
    assert.equal(rec.dados.internacoes.length, 1); assert.deepEqual(Object.keys(rec.dados.internacoes[0]).sort(), ['entradaEm', 'exemplo', 'id', 'leitoId', 'petId', 'status']);
    assert.ok(!('evolucoes' in rec.dados) && !('prontuarios' in rec.dados));
    assert.ok(!JSON.stringify(rec.dados).includes('SEGREDO'));
    assert.ok(rec.omitidos.includes('evolucoes') && rec.omitidos.includes('prontuarios') && rec.omitidos.includes('internacao_clinica'), rec.omitidos.join(','));
    const vet = R.recortarDadosDoTutor('veterinario', dados);
    assert.deepEqual(vet.dados.internacoes, [INTERNACAO_CLINICA]); assert.equal(vet.dados.evolucoes.length, 1); assert.ok(!vet.omitidos.includes('internacao_clinica'));
    assert.deepEqual(R.recortarDadosDoTutor('dono', dados).omitidos.includes('internacao_clinica'), false);
    // internacoes que não é lista: omitida, sem derrubar
    const estranho = R.recortarDadosDoTutor('recepcao', { ...dados, internacoes: 'oops' });
    assert.deepEqual(estranho.dados.internacoes || [], []);
  });
  comModulos(HOSPITAL.painel, () => {
    const rec = R.recortarDadosDoTutor('recepcao', dados);
    assert.ok(!('internacoes' in rec.dados) && !('evolucoes' in rec.dados)); assert.ok(rec.omitidos.includes('internacoes') && rec.omitidos.includes('evolucoes'));
  });
});

test('gravarLote (localStorage): ids hostis ("__proto__", "constructor"), id repetido no lote e registro nulo não envenenam o armazenamento nem o protótipo', async () => {
  const sto = falsoLocalStorage(), ad = Store.adaptadorLocalStorage('h', sto);
  await ad.gravarLote('pets', [{ id: 'a', nome: 'A1' }, { id: 'constructor', nome: 'C' }, { id: '__proto__', nome: 'P' }, { id: 'toString', nome: 'T' }, { id: 'a', nome: 'A2' }]);
  const l = await ad.listar('pets');
  assert.deepEqual(l.map((x) => x.id), ['a', 'constructor', '__proto__', 'toString'], 'o id repetido funde no lugar do primeiro');
  assert.equal(l[0].nome, 'A2'); assert.equal({}.nome, undefined); assert.equal(Object.getPrototypeOf({}), Object.prototype);
  await ad.gravarLote('pets', [{ id: 'toString', nome: 'T2' }, { id: 'novo', nome: 'N' }]); // já existe: substitui no lugar; novo entra no fim
  assert.deepEqual((await ad.listar('pets')).map((x) => x.id + ':' + x.nome), ['a:A2', 'constructor:C', '__proto__:P', 'toString:T2', 'novo:N']);
  await assert.rejects(ad.gravarLote('pets', [null]), Error); // registro nulo vira rejeição, não exceção solta
  assert.equal((await ad.listar('pets')).length, 5, 'a gravação que falhou não mexeu em nada');
  await ad.gravarLote('vazio', []); assert.deepEqual(await ad.listar('vazio'), []);
});


test('[revisão] exame cuja consulta foi excluída pela Agenda é estado legítimo: exportar e importar não avisa de referência quebrada', async () => {
  const s = Store.criarStore(Store.adaptadorMemoria(), EXTRAS_DIAG);
  await Seed.carregar(s, '2026-10-22', 'diagnostico');
  const exame = (await s.listar('exames')).find((e) => e.consultaId);
  assert.ok(exame, 'o exemplo do diagnóstico tem exame ligado a um horário'); await s.remover('consultas', exame.consultaId);
  const dump = await s.exportar();
  assert.deepEqual(Store.validarExportacao(dump, s.colecoes).quebradas, []);
});

test('[revisão] internação restrita: só as ATIVAS entram (o histórico encerrado é clínico), na lista, na cópia única e no arquivo do tutor; sem acesso nenhum a cópia única é nula', () => {
  assert.ok(HOSP_RECEPCAO);
  const encerrada = { ...INTERNACAO_CLINICA, id: 'i2', status: 'encerrada', desfecho: 'Óbito' };
  comModulos(HOSP_RECEPCAO, () => {
    assert.deepEqual(R.internacoesParaPerfil('recepcao', [INTERNACAO_CLINICA, encerrada]).map((i) => i.id), ['i1']);
    assert.equal(R.internacaoParaPerfil('recepcao', encerrada), null); assert.ok(R.internacaoParaPerfil('recepcao', INTERNACAO_CLINICA));
    const rec = R.recortarDadosDoTutor('recepcao', { tutor: { id: 't' }, internacoes: [INTERNACAO_CLINICA, encerrada] });
    assert.deepEqual(rec.dados.internacoes.map((i) => i.id), ['i1']); assert.ok(!JSON.stringify(rec.dados).includes('Óbito'));
    assert.equal(R.internacoesParaPerfil('veterinario', [INTERNACAO_CLINICA, encerrada]).length, 2, 'o veterinário lê o histórico inteiro');
  });
  comModulos(HOSPITAL.painel, () => { // a cópia única exige permissão: sem acesso nenhum, nada sai (mutante A15 da revisão)
    assert.equal(R.internacaoParaPerfil('recepcao', INTERNACAO_CLINICA), null); assert.equal(R.internacaoParaPerfil('perfil-que-nao-existe', INTERNACAO_CLINICA), null);
    assert.equal(R.internacaoParaPerfil('dono', INTERNACAO_CLINICA), INTERNACAO_CLINICA);
  });
});

test('[revisão] "Remover dados de exemplo" não deixa consulta, prontuário, vacina, internação, observação nem plantão REAIS sem o profissional ou o serviço de exemplo que citam (antes só o exame real era protegido)', async () => {
  for (const subtipo of ['geral', 'hospital24h', 'diagnostico']) {
    const s = Store.criarStore(Store.adaptadorMemoria(), subtipo === 'hospital24h' ? ['leitos', 'internacoes', 'evolucoes', 'plantoes'] : subtipo === 'diagnostico' ? EXTRAS_DIAG : []);
    await Seed.carregar(s, '2026-10-22', subtipo);
    await s.salvar('tutores', { id: 'real-t', nome: 'Tutor real' }); await s.salvar('pets', { id: 'real-p', tutorId: 'real-t', nome: 'Pet real' });
    const prof = (await s.listar('profissionais')).find((p) => p.exemplo), serv = (await s.listar('servicos')).find((x) => x.exemplo);
    await s.salvar('consultas', { id: 'real-c', petId: 'real-p', tutorId: 'real-t', profissionalId: prof.id, servicoId: serv.id, inicio: '2026-10-23T09:00', duracaoMin: 30, status: 'agendada' });
    await s.salvar('prontuarios', { id: 'real-r', petId: 'real-p', data: '2026-10-23', queixa: 'real', profissionalId: prof.id });
    await s.salvar('vacinas', { id: 'real-v', petId: 'real-p', vacina: 'V10', dataAplicacao: '2026-10-23', profissionalId: prof.id });
    if (subtipo === 'hospital24h') {
      await s.salvar('leitos', { id: 'real-l', nome: 'Leito real', ativo: true });
      await s.salvar('internacoes', { id: 'real-i', petId: 'real-p', leitoId: 'real-l', entradaEm: '2026-10-23T08:00', status: 'internado', responsavelId: prof.id });
      await s.salvar('evolucoes', { id: 'real-e', internacaoId: 'real-i', em: '2026-10-23T09:00', texto: 'real', profissionalId: prof.id });
      await s.salvar('plantoes', { id: 'real-pl', profissionalId: prof.id, inicio: '2026-10-23T07:00', fim: '2026-10-23T19:00' });
    }
    await Seed.remover(s);
    const dump = await s.exportar();
    assert.deepEqual(Store.referenciasQuebradas(dump.colecoes).filter((q) => q.alvo === 'profissionais' || q.alvo === 'servicos'), [], subtipo);
    const mantido = (await s.listar('profissionais')).find((p) => p.id === prof.id); assert.ok(mantido, subtipo + ': o profissional citado ficou'); assert.notEqual(mantido.exemplo, true, 'e deixou de ser exemplo');
    assert.ok((await s.listar('servicos')).some((x) => x.id === serv.id), subtipo + ': o serviço citado ficou');
    // o que NINGUÉM real cita sai junto com os exemplos
    assert.ok(!(await s.listar('profissionais')).some((p) => p.exemplo), subtipo);
  }
});

/* IndexedDB falso o bastante para provar a transação: `put` e `clear` só confirmam no fim, `put` de registro sem id lança DataError de forma SÍNCRONA (como o real) e a transação
   confirma sozinha no fim do turno, a não ser que seja abortada */
function idbFalso() {
  const dados = new Map(), nomes = new Set();
  const tx = (col) => {
    const staged = []; let abortada = false;
    const t = { error: null, oncomplete: null, onerror: null, onabort: null,
      objectStore: () => ({ put: (it) => { if (!it || typeof it.id !== 'string') { const e = new Error('DataError'); e.name = 'DataError'; throw e; } staged.push(it); return {}; },
        delete: (id) => { dados.get(col).delete(id); return {}; }, clear: () => { dados.get(col).clear(); return {}; }, getAll: () => ({ result: [...dados.get(col).values()].map((x) => JSON.parse(JSON.stringify(x))) }) }),
      abort: () => { abortada = true; staged.length = 0; setTimeout(() => t.onabort && t.onabort(), 0); } };
    setTimeout(() => { if (abortada) return; staged.forEach((it) => dados.get(col).set(it.id, JSON.parse(JSON.stringify(it)))); t.oncomplete && t.oncomplete(); }, 0);
    return t;
  };
  return { open: () => {
    const rq = {};
    setTimeout(() => {
      const db = { version: 1, objectStoreNames: { contains: (c) => nomes.has(c) }, createObjectStore: (c) => { nomes.add(c); if (!dados.has(c)) dados.set(c, new Map()); }, transaction: tx, close() {} };
      rq.result = db; if (!nomes.size && rq.onupgradeneeded) rq.onupgradeneeded(); rq.onsuccess && rq.onsuccess();
    }, 0);
    return rq;
  } };
}

test('[revisão] IndexedDB: lote com um registro que lança de forma síncrona aborta a transação (antes os registros anteriores confirmavam) e a mensagem nunca é "null"', async () => {
  const ad = Store.adaptadorIndexedDB('t', idbFalso(), ['pets']);
  await ad.gravarLote('pets', [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }]);
  await assert.rejects(ad.gravarLote('pets', [{ id: 'c', nome: 'C' }, { id: 'd', nome: 'D' }, { nome: 'sem id' }]), /DataError/);
  await new Promise((r) => setTimeout(r, 25)); // a transação que NÃO foi abortada confirma no fim do turno; sem esperar o teste leria antes
  assert.deepEqual((await ad.listar('pets')).map((x) => x.id).sort(), ['a', 'b'], 'nenhum registro do lote que falhou pode ter ficado');
  await assert.rejects(ad.gravar('pets', { nome: 'sem id' }), /DataError/);
  // a importação inteira por cima de um lote que falha devolve o que havia
  const s = Store.criarStore(Store.adaptadorIndexedDB('t2', idbFalso(), Store.COLECOES)); await s.salvar('tutores', { id: 'velho', nome: 'Velho' });
  const lote = s.adaptador.gravarLote; s.adaptador.gravarLote = (col, itens) => (col === 'pets' ? Promise.reject(new Error('disco cheio')) : lote(col, itens));
  await assert.rejects(s.importar({ versao: 1, colecoes: { tutores: [{ id: 'novo', nome: 'N' }], pets: [{ id: 'x', tutorId: 'novo', nome: 'X' }] } }), /A importação falhou \(disco cheio\)/);
  s.adaptador.gravarLote = lote;
});
