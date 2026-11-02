/* Agenda de consultas: grade do dia por profissional (consultas sobrepostas ficam lado a lado), semana, conflitos e horários livres. */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI, R = window.Regras;
  var PPM = 1.6; // pixels por minuto
  var STATUS = {
    agendada: ['Agendada', 'neutro'], confirmada: ['Confirmada', 'info'], em_atendimento: ['Em atendimento', 'aviso'],
    concluida: ['Concluída', 'ok'], cancelada: ['Cancelada', 'perigo'], faltou: ['Faltou', 'perigo']
  };
  var estado = { dia: null, prof: '' };
  /* subtipo (SITE_CONFIG.painel.textos.agenda): palavras da agenda (diagnóstico: "Agenda de exames", "agendamento") */
  var PC = (window.SITE_CONFIG && window.SITE_CONFIG.painel) || {};
  var AG = Object.assign({ nova: 'Nova consulta', editar: 'Editar consulta', singular: 'consulta', plural: 'consultas', marcada: 'Consulta marcada.', atualizada: 'Consulta atualizada.' }, (PC.textos && PC.textos.agenda) || {});

  function render(raiz, ctx) {
    if (ctx.params.dia && /^\d{4}-\d{2}-\d{2}$/.test(ctx.params.dia) && R.somarDias(ctx.params.dia, 0) === ctx.params.dia) estado.dia = ctx.params.dia; // data de verdade: texto colado na URL deixava a agenda com data lixo
    if (!estado.dia) estado.dia = ctx.hoje();
    var escreve = ctx.podeEscrever('agenda');

    /* diagnóstico: os exames entram junto, para mostrar o exame ligado a cada horário */
    function carregar() { return ctx.mapa(['consultas', 'pets', 'tutores', 'profissionais', 'servicos'].concat(ctx.store.tem('exames') ? ['exames'] : [])); }
    function desenhar() {
      return Promise.all([carregar(), ctx.config()]).then(function (r) {
        var m = r[0], cfgc = r[1], dia = estado.dia;
        UI.limpar(raiz);
        raiz.appendChild(UI.titulo(ctx.titulo('agenda', 'Agenda'), escreve ? [UI.botao(AG.nova, function () { abrirForm(m, cfgc, { data: dia }); }, { icone: 'mais' })] : []));

        /* navegação de dia + filtro de profissional */
        var seletorProf = h('select', { 'aria-label': 'Filtrar por profissional', on: { change: function (e) { estado.prof = e.target.value; desenhar(); } } },
          h('option', { value: '' }, 'Todos os profissionais'),
          m.profissionais_lista.filter(function (p) { return p.ativo !== false; }).map(function (p) { return h('option', { value: p.id, selected: p.id === estado.prof }, p.nome); }));
        var entradaDia = h('input', { type: 'date', value: dia, 'aria-label': 'Escolher o dia', on: { change: function (e) { if (e.target.value) { estado.dia = e.target.value; desenhar(); } } } });
        raiz.appendChild(h('div', { class: 'agenda-barra' },
          h('button', { type: 'button', class: 'btn btn-sec btn-icone-txt', 'aria-label': 'Dia anterior', on: { click: function () { estado.dia = R.somarDias(dia, -1); desenhar(); } } }, '‹'),
          entradaDia,
          h('button', { type: 'button', class: 'btn btn-sec btn-icone-txt', 'aria-label': 'Dia seguinte', on: { click: function () { estado.dia = R.somarDias(dia, 1); desenhar(); } } }, '›'),
          h('button', { type: 'button', class: 'btn btn-sec', on: { click: function () { estado.dia = ctx.hoje(); desenhar(); } } }, 'Hoje'), seletorProf));
        raiz.appendChild(h('p', { class: 'data-hoje', text: UI.fmt.diaSemana(dia) + ', ' + UI.fmt.data(dia) }));

        var todas = m.consultas_lista.filter(function (c) { return !estado.prof || c.profissionalId === estado.prof; });

        /* semana */
        var ini = R.inicioDaSemana(dia), dias = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return R.somarDias(ini, i); });
        raiz.appendChild(h('div', { class: 'semana', role: 'group', 'aria-label': 'Dias da semana' }, dias.map(function (d) {
          var n = todas.filter(function (c) { return c.inicio.slice(0, 10) === d && c.status !== 'cancelada' && c.status !== 'faltou'; }).length;
          return h('button', { type: 'button', class: 'semana-dia', 'aria-current': d === dia ? 'date' : null, on: { click: function () { estado.dia = d; desenhar(); } } },
            h('span', { text: UI.fmt.diaCurto(d) }), h('strong', { text: d.slice(8, 10) }), h('small', { text: n ? n + (n === 1 ? ' ' + AG.singular : ' ' + AG.plural) : 'livre' }));
        })));

        /* grade do dia */
        var doDia = todas.filter(function (c) { return c.inicio.slice(0, 10) === dia; });
        var ativas = doDia.filter(function (c) { return c.status !== 'cancelada' && c.status !== 'faltou'; });
        var inativas = doDia.filter(function (c) { return c.status === 'cancelada' || c.status === 'faltou'; });
        var abre = R.hhmmParaMin(cfgc.aberturaAgenda), fecha = R.hhmmParaMin(cfgc.fechamentoAgenda);
        ativas.forEach(function (c) { var s = R.hhmmParaMin(c.inicio.slice(11, 16)), e = s + (Number(c.duracaoMin) || 30); abre = Math.min(abre, Math.floor(s / 60) * 60); fecha = Math.max(fecha, Math.ceil(e / 60) * 60); });
        var altura = (fecha - abre) * PPM;
        var area = h('div', { class: 'grade-area', style: 'height:' + altura + 'px;--hora:' + (60 * PPM) + 'px' });
        var rotulos = h('div', { class: 'grade-horas', 'aria-hidden': 'true' });
        for (var mm = abre; mm < fecha; mm += 60) rotulos.appendChild(h('span', { style: 'top:' + ((mm - abre) * PPM) + 'px', text: R.minParaHHMM(mm) }));
        R.layoutDia(ativas).forEach(function (it) {
          var c = it.consulta, pet = m.pets[c.petId], t = pet && m.tutores[pet.tutorId], p = m.profissionais[c.profissionalId];
          var s = R.hhmmParaMin(c.inicio.slice(11, 16)), dur = Number(c.duracaoMin) || 30;
          var st = STATUS[c.status] || STATUS.agendada;
          area.appendChild(h('button', { type: 'button', class: 'bloco-consulta st-' + c.status + (c.exemplo ? ' exemplo' : ''), 'aria-label': c.inicio.slice(11, 16) + ' ' + (pet ? pet.nome : 'pet removido') + ', ' + st[0] + (c.exemplo ? ', exemplo' : ''),
            style: 'top:' + ((s - abre) * PPM) + 'px;height:' + Math.max(dur * PPM, 40) + 'px;left:calc(' + (it.lane / it.lanes * 100) + '% + 2px);width:calc(' + (100 / it.lanes) + '% - 4px)',
            on: { click: function (e) { e.stopPropagation(); abrirDetalhe(c, m, cfgc); } } },
            h('strong', { text: c.inicio.slice(11, 16) + ' ' + (pet ? pet.nome : 'Pet removido') }),
            h('span', { text: (t ? t.nome : '') + (p ? ' · ' + p.nome.split(' ').slice(0, 2).join(' ') : '') })));
        });
        if (dia === ctx.hoje()) {
          var agora = R.hhmmParaMin(R.agoraISO().slice(11, 16));
          if (agora >= abre && agora <= fecha) area.appendChild(h('div', { class: 'linha-agora', style: 'top:' + ((agora - abre) * PPM) + 'px', 'aria-hidden': 'true' }));
        }
        if (escreve) area.addEventListener('click', function (e) {
          if (e.target !== area) return;
          var min = abre + Math.round(e.offsetY / PPM / 15) * 15;
          abrirForm(m, cfgc, { data: dia, hora: R.minParaHHMM(min) });
        });
        raiz.appendChild(h('div', { class: 'grade-dia' }, rotulos, area));
        if (!ativas.length) raiz.appendChild(h('p', { class: 'mudo', text: 'Nenhuma consulta neste dia' + (estado.prof ? ' para este profissional' : '') + '.' + (escreve ? ' Clique na grade ou em "Nova consulta" para marcar.' : '') }));
        if (inativas.length) {
          raiz.appendChild(h('section', { class: 'bloco' }, h('h2', { text: 'Canceladas e faltas do dia' }), h('ul', { class: 'lista-simples-painel' }, inativas.map(function (c) {
            var pet = m.pets[c.petId];
            return h('li', null, h('strong', { text: c.inicio.slice(11, 16) }), ' ' + (pet ? pet.nome : 'Pet removido') + ' ', UI.chip(STATUS[c.status][0], 'perigo'), ' ', h('button', { type: 'button', class: 'link-linha', on: { click: function () { abrirDetalhe(c, m, cfgc); } } }, 'abrir'));
          }))));
        }
      });
    }

    /* ---------- formulário ---------- */
    function abrirForm(m, cfgc, base, existente) {
      var pets = m.pets_lista.filter(function (p) { return !p.falecido; }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
      var vets = m.profissionais_lista.filter(function (p) { return p.ativo !== false && /veterin/i.test(p.funcao || ''); });
      if (!vets.length) vets = m.profissionais_lista.filter(function (p) { return p.ativo !== false; });
      var servicos = m.servicos_lista.filter(function (s) { return s.ativo !== false; });
      var valores = existente ? {
        petId: existente.petId, profissionalId: existente.profissionalId, servicoId: existente.servicoId || '', data: existente.inicio.slice(0, 10), hora: existente.inicio.slice(11, 16),
        duracaoMin: existente.duracaoMin, motivo: existente.motivo || '', obs: existente.obs || ''
      } : { petId: base.petId || '', profissionalId: base.profissionalId || (estado.prof || (vets.length === 1 ? vets[0].id : '')), servicoId: base.servicoId || '', data: base.data || estado.dia, hora: base.hora || '', duracaoMin: base.duracaoMin || cfgc.duracaoPadrao || 30, motivo: base.motivo || '', obs: '' };
      if (!pets.length || !vets.length) {
        UI.modal({ titulo: 'Antes de marcar', corpo: h('p', { text: !pets.length ? 'Cadastre pelo menos um tutor e um pet para marcar consultas.' : 'Cadastre pelo menos um profissional em Profissionais e serviços.' }),
          acoes: [{ texto: 'Entendi', aoClicar: function (a) { a.fechar(); } }] });
        return;
      }
      var livres = h('div', { class: 'horarios-livres' });
      var formRef = null;
      function atualizarLivres() {
        if (!formRef) return;
        var v = formRef.valores(); UI.limpar(livres);
        if (!v.data || !v.profissionalId) { livres.appendChild(h('small', { text: 'Escolha o dia e o profissional para ver os horários livres.' })); return; }
        var lista = R.horariosLivres(m.consultas_lista, { data: v.data, profissionalId: v.profissionalId, abertura: cfgc.aberturaAgenda, fechamento: cfgc.fechamentoAgenda, duracao: Number(v.duracaoMin) || 30, passo: Number(cfgc.passoAgenda) || 30, ignorarId: existente && existente.id });
        livres.appendChild(h('small', { text: lista.length ? 'Horários livres deste profissional:' : 'Sem horários livres neste dia dentro do expediente.' }));
        lista.slice(0, 16).forEach(function (hh) {
          livres.appendChild(h('button', { type: 'button', class: 'chip-botao', on: { click: function () { formRef.campo('hora').input.value = hh; } } }, hh));
        });
      }
      /* horário de um exame (já ligado, ou marcado a partir do exame): o paciente e o exame não mudam aqui, senão o exame ficava com o horário de outro animal */
      var exameLigado = existente ? (m.exames_lista || []).find(function (x) { return x && x.consultaId === existente.id; }) : null;
      var travado = exameLigado ? { petId: existente.petId, servicoId: existente.servicoId || '' } : base.exameId ? { petId: base.petId, servicoId: base.servicoId || '' } : null;
      var ajudaTrava = travado ? 'Este horário é de um exame: o paciente e o exame não mudam aqui. Para trocar, desmarque o exame em Exames e laudos.' : null;
      var campos = [
        { nome: 'petId', rotulo: 'Pet', tipo: 'select', requerido: true, somenteLeitura: !!travado, ajuda: ajudaTrava, opcoes: pets.map(function (p) { return { valor: p.id, rotulo: ctx.rotuloPet(p, m.tutores) }; }) },
        { nome: 'profissionalId', rotulo: 'Profissional', tipo: 'select', requerido: true, opcoes: vets.map(function (p) { return { valor: p.id, rotulo: p.nome }; }), aoMudar: atualizarLivres, largura: 'meia' },
        { nome: 'servicoId', rotulo: 'Serviço', tipo: 'select', somenteLeitura: !!travado, opcoes: servicos.map(function (s) { return { valor: s.id, rotulo: s.nome }; }), largura: 'meia',
          aoMudar: function (id) { var s = m.servicos[id]; if (s && formRef) { formRef.campo('duracaoMin').input.value = s.duracaoMin; atualizarLivres(); } } },
        { nome: 'data', rotulo: 'Data', tipo: 'date', requerido: true, largura: 'terco', aoMudar: atualizarLivres },
        { nome: 'hora', rotulo: 'Hora', tipo: 'time', requerido: true, step: 300, largura: 'terco' },
        { nome: 'duracaoMin', rotulo: 'Duração (min)', tipo: 'number', requerido: true, min: 5, step: 5, largura: 'terco', aoMudar: atualizarLivres },
        { nome: 'motivo', rotulo: 'Motivo' },
        { nome: 'obs', rotulo: 'Observações', tipo: 'textarea', linhas: 2 }
      ];
      UI.abrirFormulario({
        titulo: existente ? AG.editar : AG.nova, campos: campos, valores: valores, extraCorpo: livres, larga: true,
        aoAbrir: function (m2, f) { formRef = f; atualizarLivres(); },
        aoExcluir: existente && ctx.podeExcluir('agenda') ? function () { return ctx.store.remover('consultas', existente.id).then(function () { UI.toast('Consulta excluída.'); }); } : null,
        confirmaExcluir: 'Excluir esta consulta da agenda? Não dá para desfazer (para manter o histórico, use "Cancelar consulta").',
        aoSalvar: function (v0) {
          /* grava a partir da consulta ATUAL: uma aba velha não devolve o status antigo (um horário cancelado pelo exame voltava a "agendada") */
          return (existente ? ctx.store.obter('consultas', existente.id) : Promise.resolve(null)).then(function (atualDaConsulta) {
            if (existente && !atualDaConsulta) throw new Error('Este horário foi excluído em outra aba. Feche esta janela e atualize a tela.');
            return gravar(travado ? Object.assign({}, v0, travado) : v0, atualDaConsulta);
          });
          function gravar(v, atualDaConsulta) {
          var pet = m.pets[v.petId];
          var nova = { id: existente && existente.id, petId: v.petId, profissionalId: v.profissionalId, inicio: R.juntarDataHora(v.data, v.hora), duracaoMin: Number(v.duracaoMin) };
          var erro = R.validarConsulta(nova); if (erro) throw new Error(erro);
          var conflito = R.temConflito(m.consultas_lista, nova);
          return Promise.resolve(conflito ? UI.confirmar((conflito.tipo === 'profissional' ? 'Este profissional já tem consulta' : 'Este pet já tem consulta') + ' às ' + conflito.consulta.inicio.slice(11, 16) + ' em ' + UI.fmt.data(conflito.consulta.inicio) + '. Marcar mesmo assim?', { ok: 'Marcar mesmo assim' }) : true).then(function (ok) {
            if (!ok) return false;
            var reg = Object.assign({}, atualDaConsulta || { status: 'agendada' }, { petId: v.petId, tutorId: pet.tutorId, profissionalId: v.profissionalId, servicoId: v.servicoId, inicio: nova.inicio, duracaoMin: nova.duracaoMin, motivo: v.motivo, obs: v.obs });
            return ctx.store.salvar('consultas', reg).then(function (salvo) { estado.dia = v.data; UI.toast(existente ? AG.atualizada : AG.marcada); return salvo; })
              .then(function (salvo) { return base.exameId ? ligarAoExame(base.exameId, salvo) : null; });
          });
          }
        }
      }).then(function (salvou) { if (salvou) desenhar(); });
    }

    /* Liga a consulta recém-marcada ao exame (exame solicitado passa a agendado; exame já agendado é remarcado e o horário antigo, se ativo, é cancelado).
       Lê o exame ATUAL; se não der para ligar, avisa em vez de falhar em silêncio (a consulta já foi gravada). */
    function ligarAoExame(exameId, consulta) {
      /* o horário só vale se o exame ainda espera horário; senão o horário recém-marcado é cancelado (ficava ativo na agenda sem exame) e a pessoa é avisada */
      function desfazer(motivo) {
        return ctx.store.salvar('consultas', Object.assign({}, consulta, { status: 'cancelada' })).then(function () {
          throw new Error(motivo + ' O horário que acabou de ser marcado foi cancelado: não ficou ligado a nenhum exame.');
        });
      }
      return ctx.store.obter('exames', exameId).then(function (e) {
        if (!e) return desfazer('O exame não existe mais.');
        if (e.petId !== consulta.petId) return desfazer('O paciente da agenda é diferente do paciente do exame.');
        if (['solicitado', 'agendado'].indexOf(e.status) === -1) return desfazer('O exame mudou em outra aba (agora: ' + R.situacaoDoExame(e).rotulo.toLowerCase() + ') e não espera mais horário.');
        var antigo = e.status === 'agendado' ? e.consultaId : null;
        var novo = e.status === 'agendado' ? R.remarcarExame(ctx.perfil, e, consulta.id) : R.mudarStatusDoExame(ctx.perfil, e, 'agendado', { consultaId: consulta.id });
        return ctx.store.salvar('exames', novo).then(function () {
          if (!antigo || antigo === consulta.id) return null;
          return ctx.store.obter('consultas', antigo).then(function (c) { return c && R.STATUS_INATIVOS.indexOf(c.status) === -1 && c.status !== 'concluida' ? ctx.store.salvar('consultas', Object.assign({}, c, { status: 'cancelada' })) : null; });
        }).then(function () { UI.toast('Horário ligado ao exame.'); });
      }).catch(function (err) { UI.toast(err.message || 'Não foi possível ligar o horário ao exame.', 'erro'); });
    }

    /* ---------- detalhe e mudança de status ---------- */
    function abrirDetalhe(c, m, cfgc) {
      var pet = m.pets[c.petId], t = pet && m.tutores[pet.tutorId], p = m.profissionais[c.profissionalId], s = m.servicos[c.servicoId], st = STATUS[c.status] || STATUS.agendada;
      var linhas = [['Pet', pet ? pet.nome + (pet.especie ? ' (' + pet.especie + ')' : '') : 'Pet removido'], ['Tutor', t ? t.nome + (t.telefone ? ' · ' + t.telefone : '') : ''], ['Profissional', p ? p.nome : ''],
        ['Serviço', s ? s.nome : ''], ['Horário', UI.fmt.dataHora(c.inicio) + ' (' + (c.duracaoMin || 30) + ' min)'], ['Motivo', c.motivo || ''], ['Observações', c.obs || '']].filter(function (l) { return l[1]; });
      var corpo = h('div', null, h('p', null, UI.chip(st[0], st[1]), ' ', UI.marcaExemplo(c)), h('dl', { class: 'dl-ficha' }, linhas.map(function (l) { return [h('dt', { text: l[0] }), h('dd', { text: l[1] })]; })));
      var acoes = [];
      function mudar(novo, msg) {
        return function (a) {
          var reg = Object.assign({}, c, { status: novo });
          /* reabrir uma consulta cancelada ou com falta a coloca de volta na agenda: confere o conflito como em qualquer marcação */
          var reabre = R.STATUS_INATIVOS.indexOf(c.status) !== -1 && R.STATUS_INATIVOS.indexOf(novo) === -1;
          var conflito = reabre ? R.temConflito(m.consultas_lista, reg) : null;
          Promise.resolve(conflito ? UI.confirmar((conflito.tipo === 'profissional' ? 'Este profissional já tem consulta' : 'Este pet já tem consulta') + ' às ' + conflito.consulta.inicio.slice(11, 16) + ' em ' + UI.fmt.data(conflito.consulta.inicio) + '. Reabrir mesmo assim?', { ok: 'Reabrir mesmo assim', titulo: 'Horário ocupado' }) : true)
            .then(function (ok) { if (!ok) return; return ctx.store.obter('consultas', c.id).then(function (atual) { // o status novo vai sobre a consulta ATUAL (horário alterado em outra aba não volta ao antigo)
              if (!atual) throw new Error('Este horário foi excluído em outra aba. Atualize a tela.');
              return ctx.store.salvar('consultas', Object.assign({}, atual, { status: novo }));
            }).then(function () { UI.toast(msg); a.fechar(true); desenhar(); }); })
            .catch(function (e) { UI.toast((e && e.message) || 'Não foi possível salvar a consulta.', 'erro'); });
        };
      }
      if (escreve) {
        if (c.status === 'agendada') acoes.push({ texto: 'Confirmar', aoClicar: mudar('confirmada', 'Consulta confirmada.') });
        if (c.status === 'agendada' || c.status === 'confirmada') {
          acoes.push({ texto: 'Iniciar atendimento', aoClicar: mudar('em_atendimento', 'Atendimento iniciado.') });
          acoes.push({ texto: 'Faltou', classe: 'btn-sec', aoClicar: mudar('faltou', 'Marcada como falta.') });
          acoes.push({ texto: 'Cancelar consulta', classe: 'btn-sec', aoClicar: mudar('cancelada', 'Consulta cancelada.') });
        }
        if (c.status === 'em_atendimento') acoes.push({ texto: 'Concluir', aoClicar: mudar('concluida', 'Consulta concluída.') });
        if (c.status === 'cancelada' || c.status === 'faltou') acoes.push({ texto: 'Reabrir como agendada', classe: 'btn-sec', aoClicar: mudar('agendada', 'Consulta reaberta.') });
        acoes.push({ texto: 'Editar', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); abrirForm(m, cfgc, {}, c); } });
      }
      if ((c.status === 'em_atendimento' || c.status === 'concluida') && ctx.pode('prontuarios') && ctx.podeEscrever('prontuarios')) {
        acoes.push({ texto: 'Abrir prontuário', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); ctx.navegar('prontuarios', { pet: c.petId, consulta: c.id, novo: 1 }); } });
      }
      var exameDaConsulta = ctx.pode('exames') && (m.exames_lista || []).find(function (x) { return x && x.consultaId === c.id; });
      if (exameDaConsulta) acoes.push({ texto: 'Abrir exame', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); ctx.navegar('exames', { ver: exameDaConsulta.id }); } });
      if (c.status === 'concluida' && ctx.podeEscrever('caixa')) {
        acoes.push({ texto: 'Registrar pagamento', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); ctx.navegar('caixa', { consulta: c.id, novo: 'entrada' }); } });
      }
      var link = t && R.linkWhats(t.telefone, 'Olá, ' + t.nome + '! Aqui é da ' + cfgc.nome + '. Confirmando a consulta de ' + (pet ? pet.nome : 'seu pet') + ' em ' + UI.fmt.data(c.inicio) + ' às ' + c.inicio.slice(11, 16) + '. Se precisar remarcar, é só responder esta mensagem.');
      if (link && (c.status === 'agendada' || c.status === 'confirmada')) corpo.appendChild(h('p', null, h('a', { class: 'btn btn-sec', href: link, target: '_blank', rel: 'noopener' }, UI.icone('whats', 18), 'Confirmar pelo WhatsApp')));
      acoes.push({ texto: 'Fechar', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); } });
      UI.modal({ titulo: 'Consulta de ' + (pet ? pet.nome : 'pet removido'), corpo: corpo, acoes: acoes });
    }

    return desenhar().then(function () {
      if (ctx.params.exame && escreve && ctx.store.tem('exames')) { // atalho vindo de Exames e laudos ("Marcar na agenda"): o formulário já vem com o paciente e o exame
        var exameId = ctx.params.exame; delete ctx.params.exame; delete ctx.params.pet; ctx.limparRota(); // atalho consumido: atualizar a tela não abre o formulário de novo
        return Promise.all([carregar(), ctx.config()]).then(function (r) {
          var e = r[0].exames[exameId], s = e && r[0].servicos[e.servicoId];
          if (!e || ['solicitado', 'agendado'].indexOf(e.status) === -1) { UI.toast('Este exame não está mais esperando horário.', 'erro'); return; }
          abrirForm(r[0], r[1], { petId: e.petId, servicoId: e.servicoId || '', duracaoMin: s && s.duracaoMin, motivo: s ? 'Exame: ' + s.nome : 'Exame', data: estado.dia, exameId: exameId });
        });
      }
      if (ctx.params.pet && escreve) { // atalho vindo de Tutores e pets
        var petDoAtalho = ctx.params.pet; delete ctx.params.pet; ctx.limparRota();
        return Promise.all([carregar(), ctx.config()]).then(function (r) { abrirForm(r[0], r[1], { petId: petDoAtalho, data: estado.dia }); });
      }
    });
  }

  window.Painel.registrar({ id: 'agenda', titulo: 'Agenda', icone: 'agenda', render: render });
})();
