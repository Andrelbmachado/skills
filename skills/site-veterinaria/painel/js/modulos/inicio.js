/* Início: resumo do dia (agenda, retornos, estoque, caixa) e primeiro passo para quem abre o painel vazio. */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI, R = window.Regras;
  /* subtipo (SITE_CONFIG.painel.textos.agenda): diagnóstico fala em exames e agendamentos */
  var PC = (window.SITE_CONFIG && window.SITE_CONFIG.painel) || {};
  var AG = Object.assign({ hoje: 'Consultas hoje', livre: 'Agenda livre', semMais: 'Nenhuma consulta pela frente hoje', bloco: 'Agenda de hoje', vazio: 'Nenhuma consulta marcada para hoje.', abrir: 'Abrir a agenda' }, (PC.textos && PC.textos.agenda) || {});

  function cartao(titulo, valor, detalhe, href, tom) {
    return h('a', { class: 'resumo-card' + (tom ? ' resumo-' + tom : ''), href: href },
      h('span', { class: 'resumo-rotulo', text: titulo }), h('strong', { class: 'resumo-valor', text: valor }), detalhe ? h('span', { class: 'resumo-detalhe', text: detalhe }) : null);
  }

  window.Painel.registrar({
    id: 'inicio', titulo: 'Início', icone: 'inicio',
    render: function (raiz, ctx) {
      var hoje = ctx.hoje(), st = ctx.store;
      return Promise.all([ctx.mapa(['consultas', 'pets', 'tutores', 'profissionais', 'servicos', 'vacinas', 'prontuarios', 'lembretes', 'estoque', 'lancamentos', 'leitos', 'internacoes', 'plantoes', 'exames']), ctx.config()]).then(function (r) {
        var m = r[0], cfgc = r[1];
        var total = ['tutores', 'pets', 'consultas', 'estoque'].reduce(function (n, c) { return n + m[c + '_lista'].length; }, 0);
        raiz.appendChild(UI.titulo('Olá, ' + ctx.usuario.nome.split(' ')[0]));
        raiz.appendChild(h('p', { class: 'data-hoje', text: UI.fmt.diaSemana(hoje) + ', ' + UI.fmt.data(hoje) }));

        if (total === 0) {
          var acoes = [];
          if (ctx.podeEscrever('tutores')) acoes.push(UI.botao('Cadastrar o primeiro tutor', function () { ctx.navegar('tutores', { novo: 1 }); }, { icone: 'mais' }));
          if (ctx.perfil === 'dono') {
            acoes.push(UI.botao('Carregar dados de exemplo', function () {
              ctx.Seed.carregar(st, hoje, ctx.subtipo, { exames: PC.exames }).then(function (n) { UI.toast(n ? n + ' registros de exemplo carregados (fictícios).' : 'Os dados de exemplo já estão carregados.'); return ctx.atualizar(); });
            }, { classe: 'btn-sec' }));
          }
          raiz.appendChild(h('section', { class: 'painel-vazio' }, h('h2', { text: 'O painel começa vazio' }),
            h('p', { text: (ctx.store.tem('exames') ? 'Cadastre tutores e pets para agendar exames e acompanhar pedidos, laudos e entregas. ' : 'Cadastre tutores e pets para agendar consultas, registrar prontuários e vacinas. ') + 'Para conhecer as telas antes, carregue os dados de exemplo: são fictícios, vêm marcados como "Exemplo" e saem com um clique.' }),
            h('div', { class: 'linha-botoes-painel' }, acoes)));
        }

        var consultasHoje = R.consultasAtivasDoDia(m.consultas_lista, hoje); // mesma regra da Agenda: sem canceladas e sem faltas
        var proxima = R.proximaConsulta(consultasHoje, R.agoraISO());
        var retornos = R.agruparRetornos({ hoje: hoje, pets: m.pets_lista, tutores: m.tutores_lista, vacinas: m.vacinas_lista, prontuarios: m.prontuarios_lista, lembretes: m.lembretes_lista, comQueixa: ctx.pode('prontuarios') });
        var aAvisar = retornos.filter(function (x) { return (x.status.codigo === 'vencido' || x.status.codigo === 'hoje' || x.status.codigo === 'em_breve') && !x.enviadoEm; });
        var estoqueAlerta = m.estoque_lista.filter(function (i) { var s = R.estoqueStatus(i, hoje, cfgc.diasAvisoValidade); return s.baixo || s.vencido || s.vencendo; });
        var cards = [cartao(AG.hoje, String(consultasHoje.length), proxima ? 'Próxima às ' + proxima.inicio.slice(11, 16) : consultasHoje.length ? AG.semMais : AG.livre, '#/agenda')];
        var exames = ctx.pode('exames') && ctx.store.tem('exames'), fila = { agendar: [], laudo: [], entrega: [] };
        if (exames) { // diagnóstico: o que está esperando alguém (só situação, nunca o laudo)
          m.exames_lista.forEach(function (e) { if (!e || typeof e !== 'object') return; var g = R.grupoDoExame(e, m.consultas[e.consultaId]); if (fila[g]) fila[g].push(e); });
          cards.push(cartao('Para agendar', String(fila.agendar.length), 'Pedidos sem horário na agenda', '#/exames?f=agendar', fila.agendar.length ? 'aviso' : ''));
          cards.push(cartao('Aguardando laudo', String(fila.laudo.length), 'Exames realizados', '#/exames?f=laudo'));
          cards.push(cartao('Para entregar', String(fila.entrega.length), 'Laudos prontos', '#/exames?f=entrega', fila.entrega.length ? 'aviso' : ''));
        }
        if (ctx.pode('vacinas')) cards.push(cartao('Retornos a avisar', String(aAvisar.length), 'Vencidos, de hoje e dos próximos 7 dias', '#/vacinas', aAvisar.some(function (x) { return x.status.codigo === 'vencido'; }) ? 'aviso' : ''));
        if (ctx.pode('estoque')) cards.push(cartao('Estoque em alerta', String(estoqueAlerta.length), 'Baixo, vencendo ou vencido', '#/estoque', estoqueAlerta.length ? 'aviso' : ''));
        if (ctx.pode('caixa')) {
          var cx = R.resumoCaixa(m.lancamentos_lista.filter(function (l) { return l.data === hoje; }));
          cards.push(cartao('Caixa de hoje', UI.fmt.brl(cx.saldo), 'Entradas ' + UI.fmt.brl(cx.entradas) + ' | saídas ' + UI.fmt.brl(cx.saidas), '#/caixa'));
        }
        if (ctx.pode('internacao') && ctx.store.tem('internacoes')) { // hospital: quem está internado e quem está de plantão (dado clínico: só quem acessa a internação)
          var restrita = R.visaoRestritaInternacao(ctx.perfil), ints = R.internacoesParaPerfil(ctx.perfil, m.internacoes_lista); // recepção com leitura: só a contagem de leitos, sem plantão
          var oc = R.ocupacaoLeitos(m.leitos_lista, ints), plant = restrita ? [] : R.plantonistasAgora(m.plantoes_lista, R.agoraISO());
          cards.push(cartao('Internados agora', String(ints.filter(R.internacaoAtiva).length), oc.total ? oc.livres + (oc.livres === 1 ? ' leito livre' : ' leitos livres') + ' de ' + oc.total : 'Cadastre os leitos', '#/internacao'));
          if (!restrita) cards.push(cartao('No plantão agora', String(plant.length), plant.length ? plant.map(function (p) { return (m.profissionais[p.profissionalId] || { nome: 'profissional removido' }).nome; }).join(', ') : 'Nenhum plantão registrado', '#/internacao?aba=plantao'));
        }
        raiz.appendChild(h('div', { class: 'resumo-grade' }, cards));

        var colunas = [];
        var lista = h('ul', { class: 'lista-simples-painel' }, consultasHoje.length ? consultasHoje.slice(0, 8).map(function (c) {
          var pet = m.pets[c.petId], t = pet && m.tutores[pet.tutorId], p = m.profissionais[c.profissionalId];
          return h('li', null, h('strong', { text: c.inicio.slice(11, 16) }), ' ', (pet ? pet.nome : 'Pet removido') + (t ? ' (' + t.nome + ')' : ''), h('small', { text: p ? ' com ' + p.nome : '' }), ' ', UI.marcaExemplo(c));
        }) : [h('li', { class: 'mudo', text: AG.vazio })]);
        colunas.push(h('section', { class: 'bloco' }, h('h2', { text: AG.bloco }), lista, h('a', { href: '#/agenda', text: AG.abrir })));
        if (exames) {
          colunas.push(h('section', { class: 'bloco' }, h('h2', { text: 'Laudos para entregar' }), h('ul', { class: 'lista-simples-painel' }, fila.entrega.length ? fila.entrega.slice(0, 6).map(function (e) {
            var pet = m.pets[e.petId], t = pet && m.tutores[pet.tutorId], s = m.servicos[e.servicoId];
            return h('li', null, h('strong', { text: pet ? pet.nome : 'Pet removido' }), (t ? ' (' + t.nome + ')' : '') + (s ? ': ' + s.nome : ''), ' ', UI.marcaExemplo(e));
          }) : [h('li', { class: 'mudo', text: 'Nenhum laudo esperando entrega.' })]), h('a', { href: '#/exames?f=entrega', text: 'Ver exames' })));
        }
        if (ctx.pode('vacinas')) {
          colunas.push(h('section', { class: 'bloco' }, h('h2', { text: 'Retornos para avisar' }), h('ul', { class: 'lista-simples-painel' }, aAvisar.length ? aAvisar.slice(0, 6).map(function (x) {
            var pet = m.pets[x.petId], t = m.tutores[x.tutorId];
            return h('li', null, h('strong', { text: UI.fmt.data(x.data) }), ' ', (pet ? pet.nome : '') + (t ? ' (' + t.nome + ')' : '') + ': ' + x.titulo, ' ', UI.chip(UI.fmt.quando(x.status), x.status.codigo === 'vencido' ? 'perigo' : x.status.codigo === 'hoje' ? 'aviso' : 'info'));
          }) : [h('li', { class: 'mudo', text: 'Nenhum retorno pendente de aviso.' })]), h('a', { href: '#/vacinas', text: 'Ver vacinas e retornos' })));
        }
        raiz.appendChild(h('div', { class: 'duas-col-painel' }, colunas));
        raiz.appendChild(h('p', { class: 'nota-lgpd' }, 'Tutores e pets são dados pessoais (LGPD): registre só o necessário e use Configurações para exportar ou apagar dados. O login desta tela é uma barreira de interface, não segurança real.'));
      });
    }
  });
})();
