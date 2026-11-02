/* regras.js: regras de negócio PURAS da gestão veterinária (sem DOM, sem armazenamento).
   Datas: 'YYYY-MM-DD'; data e hora: 'YYYY-MM-DDTHH:MM' (horário local da clínica). Dinheiro: centavos (inteiros). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Regras = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var pad = function (n) { return String(n).padStart(2, '0'); };
  var DIA_MS = 86400000;

  /* ---------- datas ---------- */
  function hojeISO(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function agoraISO(d) { d = d || new Date(); return hojeISO(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function utc(iso) { var p = iso.slice(0, 10).split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function somarDias(iso, n) { var t = new Date(utc(iso) + n * DIA_MS); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }
  function diffDias(de, ate) { return Math.round((utc(ate) - utc(de)) / DIA_MS); }
  function diaDaSemana(iso) { return new Date(utc(iso)).getUTCDay(); } // 0 = domingo
  function inicioDaSemana(iso) { return somarDias(iso, -((diaDaSemana(iso) + 6) % 7)); } // segunda-feira
  function hhmmParaMin(hhmm) { var p = String(hhmm).split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }
  function minParaHHMM(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function minutosAbsolutos(dtISO) {
    var d = dtISO.slice(0, 10).split('-').map(Number), h = (dtISO.slice(11, 16) || '00:00').split(':').map(Number);
    return Date.UTC(d[0], d[1] - 1, d[2], h[0], h[1]) / 60000;
  }
  function juntarDataHora(data, hora) { return data + 'T' + hora; }

  /* ---------- retornos e vacinas ---------- */
  function proximaDose(dataAplicacao, intervaloDias) {
    var n = Number(intervaloDias);
    if (!dataAplicacao || !isFinite(n) || n <= 0) return null;
    return somarDias(dataAplicacao, Math.round(n));
  }
  function statusRetorno(dataISO, hoje, janela) {
    var dias = diffDias(hoje, dataISO), j = janela == null ? 7 : janela;
    var codigo = dias < 0 ? 'vencido' : dias === 0 ? 'hoje' : dias <= j ? 'em_breve' : 'futuro';
    return { codigo: codigo, dias: dias };
  }
  function idade(nascimento, hoje) {
    if (!nascimento) return null;
    var n = nascimento.slice(0, 10).split('-').map(Number), h = hoje.slice(0, 10).split('-').map(Number);
    var meses = (h[0] - n[0]) * 12 + (h[1] - n[1]) - (h[2] < n[2] ? 1 : 0);
    if (meses < 0) return null;
    var anos = Math.floor(meses / 12), m = meses % 12, texto;
    if (anos === 0) texto = m === 0 ? 'menos de 1 mês' : m + (m === 1 ? ' mês' : ' meses');
    else texto = anos + (anos === 1 ? ' ano' : ' anos') + (m ? ' e ' + m + (m === 1 ? ' mês' : ' meses') : '');
    return { anos: anos, meses: m, texto: texto };
  }

  /* ---------- texto ---------- */
  function normalizar(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function buscar(lista, termo, camposFn) {
    var t = normalizar(termo);
    if (!t) return lista.slice();
    var partes = t.split(/\s+/);
    return lista.filter(function (item) {
      var alvo = normalizar(camposFn(item).join(' '));
      return partes.every(function (p) { return alvo.indexOf(p) !== -1; });
    });
  }
  function normalizaTelefone(tel) {
    var d = String(tel || '').replace(/\D/g, '');
    if ((d.length === 12 || d.length === 13) && d.indexOf('55') === 0) return d;
    if (d.length === 10 || d.length === 11) return '55' + d;
    return null;
  }
  function linkWhats(tel, texto) {
    var n = normalizaTelefone(tel);
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto || '') : null;
  }
  function montarMensagem(modelo, vars) {
    return String(modelo || '').replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; });
  }
  function dataBR(iso) { if (!iso) return ''; iso = String(iso); return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4); } // String(): dado de fora que não é texto não derruba a tela

  /* ---------- dinheiro ---------- */
  /* Aceita 1.234,56 | 1234,5 | 12.50 | 1.200 (milhar) | R$ 12. Recusa agrupamento fora de padrão (1.2.3), mais de 2 casas e valor
     acima de R$ 99.999.999,99 (evita número absurdo no caixa). Devolve centavos (inteiro) ou NaN. */
  function parseBRL(str) {
    var s = String(str == null ? '' : str).replace(/R\$|\s/g, '');
    if (!s || !/^[\d.,]+$/.test(s)) return NaN;
    var inteiro, dec = '', i = s.lastIndexOf(',');
    if (i !== -1) { inteiro = s.slice(0, i); dec = s.slice(i + 1); }
    else {
      var j = s.lastIndexOf('.');
      if (j !== -1 && s.indexOf('.') === j && s.length - j - 1 <= 2) { inteiro = s.slice(0, j); dec = s.slice(j + 1); }
      else inteiro = s;
    }
    if (!/^(\d{1,3}(\.\d{3})+|\d*)$/.test(inteiro) || !/^\d{0,2}$/.test(dec) || (!inteiro && !dec)) return NaN;
    var digitos = inteiro.replace(/\./g, '');
    if (digitos.length > 8) return NaN;
    return Number(digitos || '0') * 100 + Number((dec + '00').slice(0, 2));
  }
  function formatBRL(cents) {
    if (cents == null || isNaN(cents)) return '';
    var neg = cents < 0, v = Math.abs(Math.round(cents)), i = Math.floor(v / 100), c = v % 100;
    return (neg ? '-' : '') + 'R$ ' + String(i).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + pad(c);
  }
  function resumoCaixa(lancamentos) {
    var r = { entradas: 0, saidas: 0, saldo: 0, porForma: {} };
    lancamentos.forEach(function (l) {
      var f = r.porForma[l.forma || 'outro'] = r.porForma[l.forma || 'outro'] || { entradas: 0, saidas: 0 };
      if (l.tipo === 'saida') { r.saidas += l.valorCents; f.saidas += l.valorCents; } else { r.entradas += l.valorCents; f.entradas += l.valorCents; }
    });
    r.saldo = r.entradas - r.saidas;
    return r;
  }
  function csvCelula(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita fórmula ao abrir no Excel
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function paraCSV(colunas, linhas) {
    var cab = colunas.map(function (c) { return csvCelula(c.rotulo); }).join(';');
    var corpo = linhas.map(function (l) { return colunas.map(function (c) { return csvCelula(c.valor(l)); }).join(';'); });
    return '﻿' + [cab].concat(corpo).join('\r\n');
  }

  /* ---------- estoque ---------- */
  function estoqueStatus(item, hoje, diasAviso) {
    var aviso = diasAviso == null ? 30 : diasAviso, qtd = Number(item.quantidade) || 0;
    var min = item.minimo == null || item.minimo === '' ? null : Number(item.minimo);
    var d = item.validade ? diffDias(hoje, item.validade) : null;
    return {
      baixo: min != null && qtd <= min,
      zerado: qtd <= 0,
      vencido: d != null && d < 0,
      vencendo: d != null && d >= 0 && d <= aviso,
      diasParaVencer: d
    };
  }
  function aplicarMovimento(qtdAtual, mov) {
    var atual = Number(qtdAtual) || 0, q = Number(mov.qtd);
    if (!isFinite(q) || q < 0) throw new Error('Quantidade inválida.');
    if (mov.tipo === 'entrada') return atual + q;
    if (mov.tipo === 'saida') { if (q > atual) throw new Error('Saída maior que o estoque (' + atual + ').'); return atual - q; }
    if (mov.tipo === 'ajuste') return q;
    throw new Error('Tipo de movimento inválido.');
  }

  /* ---------- venda no balcão (subtipo com loja, v0.6) ---------- */
  /* Valor máximo de um lançamento: o mesmo teto de parseBRL (R$ 99.999.999,99). */
  var TETO_CENTAVOS = 9999999999;
  /* preço de venda do item em centavos (inteiro > 0), ou null se o item não é vendido no balcão. Entrada de fora (texto, objeto, negativo) vale como "sem preço". */
  function precoDeVenda(item) {
    var p = item && typeof item === 'object' && !Array.isArray(item) ? item.precoVendaCents : null;
    return typeof p === 'number' && Number.isInteger(p) && p > 0 && p <= TETO_CENTAVOS ? p : null;
  }
  /* Confere uma venda contra o registro ATUAL do item (quem chama lê o item de novo ao salvar) e devolve { qtd, valorCents, novaQuantidade }.
     qtd: inteiro de 1 em diante e até o saldo (a venda é de unidades inteiras); valorCents: o combinado no balcão, ou, em branco, preço de venda x quantidade.
     Lança Error com mensagem legível; nunca aceita NaN, texto, negativo, fração nem valor acima do teto. */
  function calcularVenda(item, qtd, valorCents, hoje) {
    var preco = precoDeVenda(item);
    if (!preco) throw new Error('Este item não tem preço de venda. Cadastre o preço em "Editar item".');
    /* item vencido não vende (medicamento fora da validade); `hoje` é passado por quem chama; data ilegível não bloqueia nem derruba */
    if (hoje && item.validade && /^\d{4}-\d{2}-\d{2}$/.test(String(item.validade)) && diffDias(hoje, String(item.validade)) < 0) throw new Error('Este item está vencido (validade ' + dataBR(item.validade) + '): não registre a venda. Se a data do cadastro estiver errada, corrija em "Editar item".');
    var q = typeof qtd === 'string' && qtd.trim() !== '' ? Number(qtd) : qtd;
    if (typeof q !== 'number' || !Number.isInteger(q) || q < 1) throw new Error('Informe uma quantidade inteira, de 1 em diante.');
    var nova = aplicarMovimento(item.quantidade, { tipo: 'saida', qtd: q }); // erro legível se passa do saldo
    var v = valorCents == null || valorCents === '' ? preco * q : valorCents;
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) throw new Error('Informe um valor maior que zero.');
    if (v > TETO_CENTAVOS) throw new Error('Valor acima do permitido (R$ 99.999.999,99).');
    return { qtd: q, valorCents: v, novaQuantidade: nova };
  }
  /* "Venda: Ração (exemplo) × 2" (texto do lançamento no caixa; o nome do item vem de dado e só é texto) */
  function descricaoDaVenda(item, qtd, valorCents) {
    var nome = item && typeof item.nome === 'string' ? item.nome.trim() : '', preco = precoDeVenda(item);
    var combinado = typeof valorCents === 'number' && preco && typeof qtd === 'number' && valorCents !== preco * qtd; // valor diferente da tabela deixa o rastro (quem vendeu pode ter dado desconto)
    return 'Venda: ' + (nome || 'item') + ' × ' + qtd + (combinado ? ' (valor combinado; tabela ' + formatBRL(preco * qtd) + ')' : '');
  }

  /* ---------- agenda ---------- */
  var STATUS_INATIVOS = ['cancelada', 'faltou'];
  function intervaloConsulta(c) {
    var ini = minutosAbsolutos(c.inicio), dur = Number(c.duracaoMin) > 0 ? Number(c.duracaoMin) : 30;
    return { ini: ini, fim: ini + dur };
  }
  function temConflito(consultas, nova) {
    var n = intervaloConsulta(nova);
    for (var i = 0; i < consultas.length; i++) {
      var x = consultas[i];
      if (x.id && x.id === nova.id) continue;
      if (STATUS_INATIVOS.indexOf(x.status) !== -1) continue;
      var xi = intervaloConsulta(x);
      if (n.ini < xi.fim && xi.ini < n.fim) {
        if (x.profissionalId && x.profissionalId === nova.profissionalId) return { tipo: 'profissional', consulta: x };
        if (x.petId && x.petId === nova.petId) return { tipo: 'pet', consulta: x };
      }
    }
    return null;
  }
  /* consultas que contam no dia (a Agenda e o Início usam a mesma regra): sem canceladas e sem faltas */
  function consultasAtivasDoDia(consultas, dia) {
    return consultas.filter(function (c) { return c.inicio && c.inicio.slice(0, 10) === dia && STATUS_INATIVOS.indexOf(c.status) === -1; })
      .sort(function (a, b) { return a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0; });
  }
  /* primeira consulta (da lista do dia, em ordem) que começa agora ou depois; null se todas já passaram */
  function proximaConsulta(doDia, agoraISO) {
    return doDia.find(function (c) { return c.inicio >= agoraISO; }) || null;
  }
  function layoutDia(consultas) {
    var itens = consultas.map(function (c) { var iv = intervaloConsulta(c); return { c: c, ini: iv.ini, fim: iv.fim, lane: 0 }; })
      .sort(function (a, b) { return a.ini - b.ini || a.fim - b.fim; });
    var out = [], cluster = [], laneFim = [], fimCluster = -Infinity;
    function fecha() { var lanes = laneFim.length; cluster.forEach(function (i) { out.push({ consulta: i.c, lane: i.lane, lanes: lanes }); }); cluster = []; laneFim = []; }
    itens.forEach(function (it) {
      if (cluster.length && it.ini >= fimCluster) fecha();
      var l = laneFim.findIndex(function (f) { return f <= it.ini; });
      if (l < 0) { l = laneFim.length; laneFim.push(it.fim); } else laneFim[l] = it.fim;
      it.lane = l; cluster.push(it); fimCluster = Math.max(fimCluster, it.fim);
    });
    if (cluster.length) fecha();
    return out;
  }
  function horariosLivres(consultas, o) {
    var abre = hhmmParaMin(o.abertura || '08:00'), fecha = hhmmParaMin(o.fechamento || '18:00');
    /* passo e duração mínimos de 5 minutos: um passo negativo ou próximo de zero (config importada ou editada à mão) fazia o laço nunca terminar e travava a aba */
    var dur = Math.max(5, Number(o.duracao) || 30), passo = Math.max(5, Number(o.passo) || 30), livres = [];
    for (var m = abre; m + dur <= fecha; m += passo) {
      var cand = { id: o.ignorarId, inicio: juntarDataHora(o.data, minParaHHMM(m)), duracaoMin: dur, profissionalId: o.profissionalId, petId: null };
      var conflito = temConflito(consultas.filter(function (c) { return c.inicio.slice(0, 10) === o.data; }), cand);
      if (!conflito) livres.push(minParaHHMM(m));
    }
    return livres;
  }

  /* ---------- lembretes de retorno ---------- */
  /* d: { hoje, pets, tutores, vacinas, prontuarios, lembretes, comQueixa, incluirDispensados }
     comQueixa: o título do retorno cita a queixa do prontuário só quando quem vê tem acesso a prontuários (recepção não tem).
     incluirDispensados: devolve também os dispensados (com dispensado:true), para a tela poder restaurá-los. */
  function agruparRetornos(d) {
    var hoje = d.hoje, lemb = Object.create(null), pets = Object.create(null), tutores = Object.create(null); // sem protótipo: id "toString" não pode achar função do Object
    (d.lembretes || []).forEach(function (l) { lemb[l.chave] = l; });
    (d.pets || []).forEach(function (p) { pets[p.id] = p; });
    (d.tutores || []).forEach(function (t) { tutores[t.id] = t; });
    var out = [];
    function adiciona(chave, origem, origemId, petId, data, titulo) {
      var pet = pets[petId];
      if (!pet || pet.falecido) return;
      var l = lemb[chave];
      var dispensado = !!(l && l.dispensado);
      if (dispensado && !d.incluirDispensados) return;
      out.push({
        chave: chave, origem: origem, origemId: origemId, petId: petId, tutorId: pet.tutorId, data: data, titulo: titulo,
        status: statusRetorno(data, hoje), enviadoEm: l && l.enviadoEm ? l.enviadoEm : null, dispensado: dispensado
      });
    }
    (d.vacinas || []).forEach(function (v) {
      if (!v.proximaDose) return;
      var atendida = (d.vacinas || []).some(function (o) {
        return o.id !== v.id && o.petId === v.petId && normalizar(o.vacina) === normalizar(v.vacina) && o.dataAplicacao > v.dataAplicacao;
      });
      if (!atendida) adiciona('vacina:' + v.id, 'vacina', v.id, v.petId, v.proximaDose, 'Próxima dose: ' + v.vacina);
    });
    (d.prontuarios || []).forEach(function (p) {
      if (!p.retornoEm) return;
      /* atendido = outro registro do mesmo pet NA data do retorno ou depois; uma visita antes da data (outro assunto) não encerra o retorno.
         Se o tutor veio antes do combinado, "Dispensar" encerra o lembrete (e dá para restaurar). */
      var atendido = (d.prontuarios || []).some(function (o) { return o.id !== p.id && o.petId === p.petId && o.data > p.data && o.data >= p.retornoEm; });
      if (!atendido) adiciona('retorno:' + p.id, 'retorno', p.id, p.petId, p.retornoEm, 'Retorno' + (d.comQueixa && p.queixa ? ': ' + p.queixa : ''));
    });
    out.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    return out;
  }

  /* ---------- perfis ---------- */
  var PERFIS = { dono: 'Dono/gerente', veterinario: 'Veterinário(a)', recepcao: 'Recepção' };
  /* Telas e permissões BASE (clínica geral). Um subtipo pode acrescentar telas e mudar permissões por SITE_CONFIG.painel
     ({ modulos: [ids na ordem do menu], matriz: { perfil: { tela: 'r' | 'rw' | null } } }): ver configurarModulos(). */
  var MODULOS_BASE = ['inicio', 'agenda', 'tutores', 'prontuarios', 'vacinas', 'caixa', 'estoque', 'equipe', 'config'];
  var MATRIZ_BASE = {
    dono: { inicio: 'rw', agenda: 'rw', tutores: 'rw', prontuarios: 'rw', vacinas: 'rw', caixa: 'rw', estoque: 'rw', equipe: 'rw', config: 'rw' },
    veterinario: { inicio: 'r', agenda: 'rw', tutores: 'rw', prontuarios: 'rw', vacinas: 'rw', estoque: 'rw' },
    recepcao: { inicio: 'r', agenda: 'rw', tutores: 'rw', vacinas: 'r', caixa: 'rw', estoque: 'r' }
  };
  var temPropria = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var MODULOS = MODULOS_BASE.slice();      // mesma referência exportada: configurarModulos() altera no lugar
  var MATRIZ = {};
  var TITULOS = Object.create(null);       // títulos de tela do subtipo (ex.: agenda -> "Agenda de exames"); só texto
  function restaurarMatriz() {
    Object.keys(MATRIZ).forEach(function (p) { delete MATRIZ[p]; });
    Object.keys(MATRIZ_BASE).forEach(function (p) { MATRIZ[p] = Object.assign({}, MATRIZ_BASE[p]); });
  }
  restaurarMatriz();
  /* Aplica a configuração do subtipo (sempre parte do padrão, nunca acumula chamadas anteriores). Entrada não confiável por princípio:
     só ids [a-z][a-z0-9]*, só perfis que existem, só 'r' | 'rw' (null/'' remove a permissão); o resto é ignorado. configurarModulos(null) volta ao padrão.
     `titulos` ({ tela: 'Texto' }): só texto de até 60 caracteres, sem caracteres de controle. Tela da clínica geral que o subtipo NÃO lista em `modulos`
     perde a permissão de todos os perfis (v0.5): sem isso o veterinário "tinha acesso" a prontuários que o subtipo não tem e o arquivo do tutor deixaria sair a coleção. */
  function configurarModulos(cfg) {
    MODULOS.length = 0; MODULOS_BASE.forEach(function (m) { MODULOS.push(m); });
    restaurarMatriz();
    Object.keys(TITULOS).forEach(function (k) { delete TITULOS[k]; });
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return MODULOS.slice();
    var id = /^[a-z][a-z0-9]{0,31}$/;
    if (Array.isArray(cfg.modulos)) {
      var lista = [];
      cfg.modulos.forEach(function (m) { if (typeof m === 'string' && id.test(m) && lista.indexOf(m) === -1) lista.push(m); });
      if (lista.length) {
        MODULOS.length = 0; lista.forEach(function (m) { MODULOS.push(m); });
        MODULOS_BASE.forEach(function (m) { if (lista.indexOf(m) === -1) Object.keys(MATRIZ).forEach(function (p) { delete MATRIZ[p][m]; }); });
      }
    }
    if (cfg.titulos && typeof cfg.titulos === 'object' && !Array.isArray(cfg.titulos)) {
      Object.keys(cfg.titulos).forEach(function (tela) {
        var t = cfg.titulos[tela];
        if (!id.test(tela) || typeof t !== 'string') return;
        t = t.replace(/[\u0000-\u001f\u007f]/g, '').trim();
        if (t && t.length <= 60) TITULOS[tela] = t;
      });
    }
    if (cfg.matriz && typeof cfg.matriz === 'object' && !Array.isArray(cfg.matriz)) {
      Object.keys(cfg.matriz).forEach(function (perfil) {
        var mod = cfg.matriz[perfil];
        if (!temPropria(PERFIS, perfil) || !mod || typeof mod !== 'object' || Array.isArray(mod)) return;
        Object.keys(mod).forEach(function (tela) {
          if (!id.test(tela)) return;
          var v = mod[tela];
          if (v === 'r' || v === 'rw') MATRIZ[perfil][tela] = v; else if (v === null || v === '') delete MATRIZ[perfil][tela];
        });
      });
    }
    return MODULOS.slice();
  }
  /* só propriedades PRÓPRIAS: sem isto "constructor", "toString" ou "__proto__" (nome de tela ou de perfil) devolviam uma função herdada do Object,
     contavam como permissão e a URL #/constructor abria uma tela inexistente. */
  function permissao(perfil, modulo) {
    if (!temPropria(MATRIZ, perfil) || !temPropria(MATRIZ[perfil], modulo)) return null;
    return MATRIZ[perfil][modulo] || null;
  }
  function modulosDoPerfil(perfil) { return MODULOS.filter(function (m) { return permissao(perfil, m); }); }
  function podeEscrever(perfil, modulo) { return permissao(perfil, modulo) === 'rw'; }
  /* Excluir: o dono exclui tudo. Os demais só excluem consulta da agenda. Excluir tutor ou pet apaga em cascata prontuários, vacinas, consultas
     (e internações, no hospital), então fica com o dono (a recepção edita cadastro, mas não destrói histórico clínico). */
  function podeExcluir(perfil, modulo) {
    if (perfil === 'dono') return true;
    return modulo === 'agenda' && podeEscrever(perfil, modulo);
  }
  /* dados do tutor para exportar: cada perfil leva só as coleções que pode LER. Devolve { dados, omitidos } sem alterar o original.
     Negar por padrão: coleção que não está no mapa NÃO sai (antes saía para todo mundo, e uma coleção nova vazaria prontuário para a recepção). */
  var MODULO_DA_PARTE = { tutor: 'tutores', pets: 'tutores', consultas: 'agenda', prontuarios: 'prontuarios', vacinas: 'vacinas', lembretes: 'vacinas', lancamentos: 'caixa',
    internacoes: 'internacao', evolucoes: 'internacao', exames: 'exames' };
  /* Exames (subtipo diagnóstico) são recortados por CAMPO: quem lê a tela de exames mas não lê laudos (recepção) leva o exame sem indicação clínica nem laudo,
     e o arquivo diz que omitiu 'laudos'. */
  function recortarDadosDoTutor(perfil, dados) {
    var out = {}, omitidos = [];
    Object.keys(dados).forEach(function (k) {
      var modulo = temPropria(MODULO_DA_PARTE, k) ? MODULO_DA_PARTE[k] : null;
      if (!modulo || !permissao(perfil, modulo)) { omitidos.push(k); return; }
      if (k === 'exames') {
        if (!Array.isArray(dados[k])) { omitidos.push(k); return; }
        out[k] = examesParaPerfil(perfil, dados[k]);
        if (!podeVerLaudo(perfil)) omitidos.push('laudos');
        return;
      }
      if (modulo === 'internacao' && visaoRestritaInternacao(perfil)) { // leitura restrita (v0.7): leito, paciente e entrada; o clínico e as observações ficam de fora
        if (k === 'internacoes' && Array.isArray(dados[k])) { out[k] = internacoesParaPerfil(perfil, dados[k]); if (omitidos.indexOf('internacao_clinica') === -1) omitidos.push('internacao_clinica'); }
        else omitidos.push(k);
        return;
      }
      out[k] = dados[k];
    });
    return { dados: out, omitidos: omitidos };
  }
  /* título de uma tela: o do subtipo (`titulos`) ou o padrão do módulo */
  function tituloDaTela(id, padrao) { return temPropria(TITULOS, id) ? TITULOS[id] : padrao; }

  /* ---------- internação e plantão (subtipo hospital24h) ---------- */
  /* internação ativa = sem status ou diferente de 'encerrada'. Entrada de fora (lista com null, número, texto) nunca derruba. */
  function ehObjeto(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  /* Visão restrita da internação (v0.7, opção `recepcao_ve_leitos` do subtipo hospital24h): quem tem a tela de internação só para LEITURA ('r') vê quem está em qual
     leito e desde quando; o clínico (motivo, situação, previsão de alta, responsável, desfecho, resumo da saída), as observações e o plantão ficam de fora. Mesmo desenho
     dos exames (cópia restrita, a tela inteira trabalha com ela), mas por LISTA DE PERMITIDOS: campo novo que alguém acrescentar à internação não vaza por esquecimento.
     Só as internações ATIVAS entram na cópia restrita (as encerradas são histórico clínico).
     A barreira é de interface (o dado segue no armazenamento do navegador, como em todo o painel). */
  var CAMPOS_VISIVEIS_NA_INTERNACAO = ['id', 'petId', 'leitoId', 'entradaEm', 'status', 'exemplo'];
  function visaoRestritaInternacao(perfil) { return permissao(perfil, 'internacao') === 'r'; }
  function internacaoParaPerfil(perfil, i) {
    if (!ehObjeto(i) || !permissao(perfil, 'internacao')) return null;
    if (!visaoRestritaInternacao(perfil)) return i;
    if (!internacaoAtiva(i)) return null; // a leitura restrita é "quem está em qual leito AGORA": o histórico de internações (já encerradas) é clínico e fica de fora, também do arquivo do tutor
    var c = {};
    CAMPOS_VISIVEIS_NA_INTERNACAO.forEach(function (k) { if (temPropria(i, k)) c[k] = i[k]; });
    return c;
  }
  function internacoesParaPerfil(perfil, lista) {
    if (!Array.isArray(lista) || !permissao(perfil, 'internacao')) return [];
    if (!visaoRestritaInternacao(perfil)) return lista.slice();
    return lista.map(function (i) { return internacaoParaPerfil(perfil, i); }).filter(Boolean);
  }
  /* observações do plantão: só quem escreve na internação (leitura restrita não as vê) */
  function evolucoesParaPerfil(perfil, lista) {
    if (!Array.isArray(lista) || permissao(perfil, 'internacao') !== 'rw') return [];
    return lista.slice();
  }
  function internacaoAtiva(i) { return ehObjeto(i) && i.status !== 'encerrada'; }
  function ativaDe(lista, campo, valor, ignorarId) {
    if (!Array.isArray(lista) || !valor) return null;
    return lista.find(function (i) { return internacaoAtiva(i) && i[campo] === valor && !(ignorarId && i.id === ignorarId); }) || null;
  }
  function leitoOcupado(internacoes, leitoId, ignorarId) { return ativaDe(internacoes, 'leitoId', leitoId, ignorarId); }
  function petInternado(internacoes, petId, ignorarId) { return ativaDe(internacoes, 'petId', petId, ignorarId); }
  /* data e hora 'AAAA-MM-DDTHH:MM' (é o que o campo datetime-local e agoraISO() produzem). Confere o calendário: '2026-19-45T99:99' não passa. */
  var DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  function dataHoraValida(s) {
    if (typeof s !== 'string' || !DATA_HORA.test(s)) return false;
    var a = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10)), h = Number(s.slice(11, 13)), mi = Number(s.slice(14, 16));
    if (m < 1 || m > 12 || d < 1 || h > 23 || mi > 59) return false;
    return d <= new Date(Date.UTC(a, m, 0)).getUTCDate();
  }
  function validarInternacao(i) {
    if (!ehObjeto(i)) return 'Internação inválida.';
    if (!i.petId) return 'Escolha o paciente.';
    if (!i.leitoId) return 'Escolha o leito.';
    if (!dataHoraValida(i.entradaEm)) return 'Informe a data e a hora da entrada.';
    if (i.status === 'encerrada') {
      if (!dataHoraValida(i.saidaEm)) return 'Informe a data e a hora da saída.';
      if (i.saidaEm < i.entradaEm) return 'A saída não pode ser antes da entrada.';
      if (!i.desfecho) return 'Informe o desfecho (alta, transferência ou outro).';
    }
    return null;
  }
  function validarObservacao(e) {
    if (!ehObjeto(e)) return 'Observação inválida.';
    if (!e.internacaoId) return 'Escolha a internação.';
    if (!dataHoraValida(e.em)) return 'Informe a data e a hora da observação.';
    if (!String(e.texto == null ? '' : e.texto).trim()) return 'Escreva a observação.';
    return null;
  }
  function validarPlantao(p) {
    if (!ehObjeto(p)) return 'Plantão inválido.';
    if (!p.profissionalId) return 'Escolha o profissional do plantão.';
    if (!dataHoraValida(p.inicio)) return 'Informe o início do plantão.';
    if (!dataHoraValida(p.fim)) return 'Informe o fim do plantão.';
    if (p.fim <= p.inicio) return 'O fim do plantão precisa ser depois do início.';
    return null;
  }
  /* tempo desde a entrada: 'menos de 1 h', '5 h', '2 d 4 h', '3 d'. Relógio atrasado não gera tempo negativo. */
  function tempoInternado(entradaEm, agoraISO) {
    if (!dataHoraValida(entradaEm) || !dataHoraValida(agoraISO)) return null;
    var min = Math.max(0, minutosAbsolutos(agoraISO) - minutosAbsolutos(entradaEm)), h = Math.floor(min / 60), d = Math.floor(h / 24);
    var texto = d > 0 ? d + ' d' + (h % 24 ? ' ' + (h % 24) + ' h' : '') : h > 0 ? h + ' h' : 'menos de 1 h';
    return { minutos: min, texto: texto };
  }
  /* plantões em curso: começam antes ou na hora e terminam depois (o fim é exclusivo, assim a troca às 19:00 não duplica ninguém) */
  function plantonistasAgora(plantoes, agoraISO) {
    if (!Array.isArray(plantoes)) return [];
    return plantoes.filter(function (p) { return ehObjeto(p) && dataHoraValida(p.inicio) && dataHoraValida(p.fim) && p.inicio <= agoraISO && agoraISO < p.fim; });
  }
  /* leito desativado não conta; ocupado = tem internação ativa */
  function ocupacaoLeitos(leitos, internacoes) {
    var ativos = (Array.isArray(leitos) ? leitos : []).filter(function (l) { return ehObjeto(l) && l.ativo !== false; });
    var ocupados = ativos.filter(function (l) { return !!leitoOcupado(internacoes, l.id); }).length;
    return { total: ativos.length, ocupados: ocupados, livres: ativos.length - ocupados };
  }

  /* ---------- exames e laudos (subtipo diagnostico) ---------- */
  /* Um exame passa por: solicitado -> agendado -> realizado -> laudado -> entregue (ou cancelado). O horário mora na agenda (consultas): o exame guarda só
     `consultaId` e a tela mostra o horário lendo a consulta, então remarcar na agenda não deixa dois horários. Dados clínicos do exame: `indicacao` e `laudo`
     (a permissão de ler e escrever é a tela virtual `laudos` da matriz; a recepção não a tem). Estado, datas, pessoa que fez e forma de entrega são
     administrativos: a recepção vê. O painel guarda TEXTO; não guarda imagem nem arquivo de laudo (o store só guarda JSON). */
  var STATUS_EXAME = ['solicitado', 'agendado', 'realizado', 'laudado', 'entregue', 'cancelado'];
  var ROTULO_STATUS_EXAME = { solicitado: 'Solicitado', agendado: 'Agendado', realizado: 'Realizado', laudado: 'Laudado', entregue: 'Entregue', cancelado: 'Cancelado' };
  var TOM_STATUS_EXAME = { solicitado: 'neutro', agendado: 'info', realizado: 'aviso', laudado: 'aviso', entregue: 'ok', cancelado: 'neutro' };
  var CAMPOS_RESERVADOS_AO_LAUDO = ['indicacao', 'laudo'];
  var CAMPOS_GERAIS_DO_EXAME = ['petId', 'servicoId', 'encaminhadorId', 'solicitadoEm', 'obs'];
  var LIMITE_LAUDO = 20000, LIMITE_TEXTO = 2000;
  /* quem faz cada passo: 'exames' = quem escreve na tela de exames (inclui a recepção); 'laudos' = quem lê e escreve laudo (dono e veterinário) */
  var TRANSICOES_EXAME = {
    solicitado: { agendado: 'exames', realizado: 'laudos', cancelado: 'exames' },
    agendado: { solicitado: 'exames', realizado: 'laudos', cancelado: 'exames' },
    realizado: { agendado: 'laudos', solicitado: 'laudos', laudado: 'laudos' }, // desfazer a realização volta a agendado (se há horário) ou a solicitado
    laudado: { realizado: 'laudos', entregue: 'exames' },
    entregue: { laudado: 'exames' },
    cancelado: { solicitado: 'exames' }
  };
  function copiarRegistro(o) { var c = {}; Object.keys(o).forEach(function (k) { if (k !== '__proto__') c[k] = o[k]; }); return c; }
  function textoDe(v) { return v == null ? '' : String(v); }
  function statusDoExame(e) { return ehObjeto(e) && STATUS_EXAME.indexOf(e.status) !== -1 ? e.status : 'solicitado'; }
  function podeVerLaudo(perfil) { return !!permissao(perfil, 'laudos'); }
  function podeEscreverLaudo(perfil) { return permissao(perfil, 'laudos') === 'rw'; }
  /* o exame como o perfil pode ler: sem indicação clínica nem laudo para quem não lê laudos. Item que não é registro some da cópia restrita. */
  function exameParaPerfil(perfil, e) {
    if (!ehObjeto(e)) return null;
    var c = copiarRegistro(e);
    if (!podeVerLaudo(perfil)) CAMPOS_RESERVADOS_AO_LAUDO.forEach(function (k) { delete c[k]; });
    return c;
  }
  function examesParaPerfil(perfil, lista) {
    if (!Array.isArray(lista)) return [];
    if (podeVerLaudo(perfil)) return lista.slice();
    return lista.map(function (e) { return exameParaPerfil(perfil, e); }).filter(Boolean);
  }
  function podeMudarStatus(perfil, de, para) {
    if (typeof de !== 'string' || typeof para !== 'string' || !temPropria(TRANSICOES_EXAME, de) || !temPropria(TRANSICOES_EXAME[de], para)) return false;
    return permissao(perfil, TRANSICOES_EXAME[de][para]) === 'rw';
  }
  /* o que a edição geral pode mudar: campos administrativos; indicação e laudo só com permissão de laudo. Os outros campos (status, datas dos passos, vínculo
     com a agenda) mudam só por mudarStatusDoExame. Parte SEMPRE do registro atual, para que quem não lê o laudo não o apague ao salvar. */
  function mesclarExame(perfil, atual, valores) {
    var base = ehObjeto(atual) ? copiarRegistro(atual) : {}, v = ehObjeto(valores) ? valores : {};
    CAMPOS_GERAIS_DO_EXAME.concat(podeEscreverLaudo(perfil) ? CAMPOS_RESERVADOS_AO_LAUDO : []).forEach(function (k) { if (temPropria(v, k)) base[k] = v[k]; });
    return base;
  }
  var ROTULO_CAMPO_DO_EXAME = { petId: 'Paciente', servicoId: 'Exame', encaminhadorId: 'Encaminhador', solicitadoEm: 'Pedido recebido em', obs: 'Observações', indicacao: 'Indicação clínica', laudo: 'Laudo' };
  /* Edição geral a partir do formulário que ficou aberto: só entra o que a pessoa MUDOU em relação ao que o formulário mostrava (o resto fica como está no registro
     atual, então o laudo que um colega escreveu enquanto isso não é apagado por um campo velho). Campo que ela mudou e que mudou também em outra aba recusa,
     em vez de passar por cima. O paciente só muda enquanto o exame não tem horário nem resultado (situação do registro ATUAL). */
  function mesclarExameEditado(perfil, atual, inicial, valores) {
    if (!ehObjeto(atual)) throw new Error('Este exame foi excluído em outra aba. Feche esta janela e atualize a tela.');
    var v = ehObjeto(valores) ? valores : {}, ini = ehObjeto(inicial) ? inicial : {}, mudou = {};
    CAMPOS_GERAIS_DO_EXAME.concat(podeEscreverLaudo(perfil) ? CAMPOS_RESERVADOS_AO_LAUDO : []).forEach(function (k) {
      if (!temPropria(v, k) || textoDe(v[k]) === textoDe(ini[k])) return;
      if (k === 'petId' && ['solicitado', 'cancelado'].indexOf(atual.status) === -1) throw new Error('O paciente não muda depois que o exame tem horário ou resultado.');
      if (textoDe(atual[k]) !== textoDe(ini[k])) throw new Error('O campo "' + ROTULO_CAMPO_DO_EXAME[k] + '" foi alterado em outra aba. Feche esta janela, abra o exame de novo e refaça a alteração.');
      mudou[k] = v[k];
    });
    return mesclarExame(perfil, atual, mudou);
  }
  var ORDEM_PASSOS = [['realizadoEm', 'realizado'], ['laudoEm', 'laudado'], ['entregueEm', 'entregue']];
  function validarExame(e) {
    if (!ehObjeto(e)) return 'Exame inválido.';
    if (!e.petId) return 'Escolha o paciente.';
    if (!e.servicoId) return 'Escolha o exame.';
    if (STATUS_EXAME.indexOf(e.status) === -1) return 'Situação do exame inválida.';
    if (!dataHoraValida(e.solicitadoEm)) return 'Informe a data e a hora do pedido.';
    if (e.status === 'agendado' && !e.consultaId) return 'Um exame agendado precisa de um horário na agenda.';
    var anterior = e.solicitadoEm, rotuloAnterior = 'do pedido';
    var rot = { realizadoEm: 'da realização', laudoEm: 'do laudo', entregueEm: 'da entrega' }, ate = STATUS_EXAME.indexOf(e.status);
    for (var i = 0; i < ORDEM_PASSOS.length; i++) {
      var campo = ORDEM_PASSOS[i][0], exige = ate >= STATUS_EXAME.indexOf(ORDEM_PASSOS[i][1]) && e.status !== 'cancelado';
      if (!exige && !e[campo]) continue;
      if (!dataHoraValida(e[campo])) return 'Informe a data e a hora ' + rot[campo] + '.';
      if (e[campo] < anterior) return 'A data e a hora ' + rot[campo] + ' não podem ser antes ' + rotuloAnterior + '.';
      anterior = e[campo]; rotuloAnterior = rot[campo];
    }
    if (['laudado', 'entregue'].indexOf(e.status) !== -1 && !e.laudoPorId) return 'Escolha quem emitiu o laudo.';
    if (textoDe(e.laudo).length > LIMITE_LAUDO) return 'O laudo passou do limite de ' + LIMITE_LAUDO + ' caracteres.';
    var curtos = ['indicacao', 'obs', 'entregaVia'];
    for (var j = 0; j < curtos.length; j++) if (textoDe(e[curtos[j]]).length > LIMITE_TEXTO) return 'Texto muito longo em "' + curtos[j] + '" (limite de ' + LIMITE_TEXTO + ' caracteres).';
    return null;
  }
  /* Faz a mudança de situação de um exame a partir do registro ATUAL (quem chama lê o registro de novo antes). Confere permissão e transição, aplica os dados do
     passo, limpa o que pertence aos passos desfeitos e valida o resultado. Lança Error com mensagem em português. */
  function mudarStatusDoExame(perfil, atual, para, dados) {
    if (!ehObjeto(atual)) throw new Error('Exame não encontrado (pode ter sido excluído em outra aba).');
    var de = atual.status, d = ehObjeto(dados) ? dados : {};
    if (!podeMudarStatus(perfil, de, para)) throw new Error(temPropria(TRANSICOES_EXAME, de) && temPropria(TRANSICOES_EXAME[de], para)
      ? 'Seu perfil não faz esta mudança de situação.' : 'Esta mudança de situação não é permitida (o exame está "' + (temPropria(ROTULO_STATUS_EXAME, de) ? ROTULO_STATUS_EXAME[de] : 'desconhecido').toLowerCase() + '").');
    var novo = copiarRegistro(atual); novo.status = para;
    if (para === 'agendado') {
      if (de === 'realizado') { novo.realizadoEm = ''; novo.responsavelId = ''; } // desfazer a realização: o horário continua ligado
      else { if (!d.consultaId) throw new Error('Marque o horário na agenda para agendar o exame.'); novo.consultaId = textoDe(d.consultaId); }
    }
    if (para === 'solicitado') { novo.consultaId = ''; if (de === 'realizado') { novo.realizadoEm = ''; novo.responsavelId = ''; } }
    if (para === 'realizado') {
      if (de === 'laudado') { novo.laudoEm = ''; novo.laudoPorId = ''; } // desfazer o laudo: o texto fica como rascunho
      else { novo.realizadoEm = textoDe(d.realizadoEm); novo.responsavelId = textoDe(d.responsavelId); }
    }
    if (para === 'laudado') {
      if (de === 'entregue') { novo.entregueEm = ''; novo.entregaVia = ''; }
      else { novo.laudoEm = textoDe(d.laudoEm); novo.laudoPorId = textoDe(d.laudoPorId); if (temPropria(d, 'laudo')) novo.laudo = textoDe(d.laudo); }
    }
    if (para === 'entregue') { novo.entregueEm = textoDe(d.entregueEm); novo.entregaVia = textoDe(d.entregaVia).trim(); }
    var erro = validarExame(novo); if (erro) throw new Error(erro);
    return novo;
  }
  /* remarcar: o exame já está agendado e passa a apontar para outra consulta da agenda */
  function remarcarExame(perfil, atual, consultaId) {
    if (!ehObjeto(atual)) throw new Error('Exame não encontrado (pode ter sido excluído em outra aba).');
    if (atual.status !== 'agendado') throw new Error('Só dá para remarcar um exame agendado.');
    if (permissao(perfil, 'exames') !== 'rw') throw new Error('Seu perfil não faz esta mudança de situação.');
    if (!consultaId) throw new Error('Marque o horário na agenda para remarcar o exame.');
    return Object.assign(copiarRegistro(atual), { consultaId: textoDe(consultaId) });
  }
  /* o horário na agenda acompanha o exame: realizar conclui a consulta; cancelar ou desmarcar cancela a consulta que ainda estava ativa. null = não mexe. */
  function statusDaConsultaDoExame(statusConsulta, deExame, paraExame) {
    if (statusConsulta === 'concluida' && deExame === 'realizado' && paraExame === 'agendado') return 'confirmada'; // desfazer a realização: o horário volta a valer (senão o exame fica "agendado" num horário já concluído)
    var ativa = ['agendada', 'confirmada', 'em_atendimento'].indexOf(statusConsulta) !== -1;
    if (!ativa) return null;
    if (deExame === 'agendado' && paraExame === 'realizado') return 'concluida';
    if (deExame === 'agendado' && (paraExame === 'cancelado' || paraExame === 'solicitado')) return 'cancelada';
    return null;
  }
  /* situação para mostrar: o status guardado, corrigido pelo que a agenda diz (horário cancelado, falta ou removido) */
  function situacaoDoExame(e, consulta) {
    var s = statusDoExame(e);
    if (s === 'agendado') {
      if (!ehObjeto(consulta)) return { codigo: 'sem_horario', rotulo: 'Horário removido da agenda', tom: 'aviso' };
      if (STATUS_INATIVOS.indexOf(consulta.status) !== -1) return { codigo: 'horario_perdido', rotulo: (consulta.status === 'faltou' ? 'Faltou' : 'Horário cancelado') + ': remarcar', tom: 'perigo' };
      var q = dataHoraValida(consulta.inicio) ? ' para ' + dataBR(consulta.inicio) + ' às ' + consulta.inicio.slice(11, 16) : '';
      return { codigo: 'agendado', rotulo: 'Agendado' + q, tom: 'info' };
    }
    return { codigo: s, rotulo: ROTULO_STATUS_EXAME[s], tom: TOM_STATUS_EXAME[s] };
  }
  var GRUPO_DA_SITUACAO = { solicitado: 'agendar', sem_horario: 'agendar', horario_perdido: 'agendar', agendado: 'agendados', realizado: 'laudo', laudado: 'entrega', entregue: 'entregues', cancelado: 'cancelados' };
  function grupoDoExame(e, consulta) { return GRUPO_DA_SITUACAO[situacaoDoExame(e, consulta).codigo]; }
  /* quantos exames por encaminhador (id -> n); item inválido não conta e o id "toString" não acha função herdada */
  function examesPorEncaminhador(exames) {
    var n = Object.create(null);
    (Array.isArray(exames) ? exames : []).forEach(function (e) { if (ehObjeto(e) && e.encaminhadorId) n[e.encaminhadorId] = (n[e.encaminhadorId] || 0) + 1; });
    return n;
  }
  function validarEncaminhador(e) {
    if (!ehObjeto(e)) return 'Encaminhador inválido.';
    if (!textoDe(e.nome).trim()) return 'Informe o nome do encaminhador.';
    if (e.telefone && !normalizaTelefone(e.telefone)) return 'Telefone inválido: use DDD + número.';
    if (textoDe(e.condicoes).length > LIMITE_TEXTO || textoDe(e.obs).length > LIMITE_TEXTO) return 'Texto muito longo (limite de ' + LIMITE_TEXTO + ' caracteres).';
    return null;
  }

  /* ---------- validações ---------- */
  /* ---------- peso e campos extras do subtipo (ver SITE_CONFIG.painel) ---------- */
  /* pesoG (gramas, exóticos) tem prioridade sobre pesoKg; a partir de 1000 g mostra em kg */
  function pesoTexto(o) {
    if (!o) return '';
    var g = Number(o.pesoG), kg = Number(o.pesoKg);
    if (g > 0) return g >= 1000 ? String(Math.round(g) / 1000).replace('.', ',') + ' kg' : String(Math.round(g)) + ' g';
    if (kg > 0) return String(kg).replace('.', ',') + ' kg';
    return '';
  }
  /* campos extras definidos no subtipo ([{nome, curto, rotulo}]) -> [[rótulo curto, valor]] só dos preenchidos */
  function camposExtras(defs, obj) {
    return (defs || []).map(function (d) { return [d.curto || d.rotulo, obj && obj[d.nome] ? String(obj[d.nome]).trim() : '']; }).filter(function (l) { return l[1]; });
  }

  function validarTutor(t) {
    if (!t.nome || !t.nome.trim()) return 'Informe o nome do tutor.';
    if (t.telefone && !normalizaTelefone(t.telefone)) return 'Telefone inválido: use DDD + número.';
    return null;
  }
  function validarPet(p) {
    if (!p.tutorId) return 'Escolha o tutor do pet.';
    if (!p.nome || !p.nome.trim()) return 'Informe o nome do pet.';
    if (!p.especie) return 'Informe a espécie.';
    return null;
  }
  function validarConsulta(c) {
    if (!c.petId) return 'Escolha o pet.';
    if (!c.profissionalId) return 'Escolha o profissional.';
    if (!c.inicio || c.inicio.length < 16) return 'Informe data e hora.';
    if (!(Number(c.duracaoMin) > 0)) return 'Duração deve ser maior que zero.';
    return null;
  }
  function validarSenha(s) {
    if (!s || s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
    return null;
  }

  return {
    hojeISO: hojeISO, agoraISO: agoraISO, somarDias: somarDias, diffDias: diffDias, diaDaSemana: diaDaSemana, inicioDaSemana: inicioDaSemana,
    hhmmParaMin: hhmmParaMin, minParaHHMM: minParaHHMM, minutosAbsolutos: minutosAbsolutos, juntarDataHora: juntarDataHora,
    proximaDose: proximaDose, statusRetorno: statusRetorno, idade: idade, STATUS_INATIVOS: STATUS_INATIVOS,
    consultasAtivasDoDia: consultasAtivasDoDia, proximaConsulta: proximaConsulta, recortarDadosDoTutor: recortarDadosDoTutor,
    normalizar: normalizar, buscar: buscar, normalizaTelefone: normalizaTelefone, linkWhats: linkWhats, montarMensagem: montarMensagem, dataBR: dataBR,
    parseBRL: parseBRL, formatBRL: formatBRL, resumoCaixa: resumoCaixa, paraCSV: paraCSV,
    estoqueStatus: estoqueStatus, aplicarMovimento: aplicarMovimento, precoDeVenda: precoDeVenda, calcularVenda: calcularVenda, descricaoDaVenda: descricaoDaVenda, TETO_CENTAVOS: TETO_CENTAVOS,
    intervaloConsulta: intervaloConsulta, temConflito: temConflito, layoutDia: layoutDia, horariosLivres: horariosLivres,
    agruparRetornos: agruparRetornos,
    PERFIS: PERFIS, MODULOS: MODULOS, configurarModulos: configurarModulos, permissao: permissao, modulosDoPerfil: modulosDoPerfil, podeEscrever: podeEscrever, podeExcluir: podeExcluir,
    dataHoraValida: dataHoraValida, internacaoAtiva: internacaoAtiva, leitoOcupado: leitoOcupado, petInternado: petInternado, validarInternacao: validarInternacao, validarObservacao: validarObservacao,
    validarPlantao: validarPlantao, tempoInternado: tempoInternado, plantonistasAgora: plantonistasAgora, ocupacaoLeitos: ocupacaoLeitos,
    visaoRestritaInternacao: visaoRestritaInternacao, internacaoParaPerfil: internacaoParaPerfil, internacoesParaPerfil: internacoesParaPerfil, evolucoesParaPerfil: evolucoesParaPerfil,
    CAMPOS_VISIVEIS_NA_INTERNACAO: CAMPOS_VISIVEIS_NA_INTERNACAO,
    tituloDaTela: tituloDaTela, TITULOS: TITULOS,
    STATUS_EXAME: STATUS_EXAME, ROTULO_STATUS_EXAME: ROTULO_STATUS_EXAME, TRANSICOES_EXAME: TRANSICOES_EXAME, CAMPOS_RESERVADOS_AO_LAUDO: CAMPOS_RESERVADOS_AO_LAUDO,
    podeVerLaudo: podeVerLaudo, podeEscreverLaudo: podeEscreverLaudo, exameParaPerfil: exameParaPerfil, examesParaPerfil: examesParaPerfil, podeMudarStatus: podeMudarStatus,
    mesclarExame: mesclarExame, mesclarExameEditado: mesclarExameEditado, validarExame: validarExame, mudarStatusDoExame: mudarStatusDoExame, remarcarExame: remarcarExame, statusDaConsultaDoExame: statusDaConsultaDoExame,
    situacaoDoExame: situacaoDoExame, grupoDoExame: grupoDoExame, statusDoExame: statusDoExame, examesPorEncaminhador: examesPorEncaminhador, validarEncaminhador: validarEncaminhador,
    pesoTexto: pesoTexto, camposExtras: camposExtras,
    validarTutor: validarTutor, validarPet: validarPet, validarConsulta: validarConsulta, validarSenha: validarSenha
  };
});
