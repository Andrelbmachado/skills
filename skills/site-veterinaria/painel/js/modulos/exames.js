/* Exames e laudos (subtipo diagnostico): fila de exames do pedido à entrega do laudo, com a situação de cada um.
   O horário mora na AGENDA: o exame guarda só o vínculo (`consultaId`) e a tela lê o horário de lá. Quem escreve na tela (dono, veterinário e recepção) cuida dos
   passos administrativos (pedido, agenda, entrega); só dono e veterinário leem e escrevem a indicação clínica e o laudo (tela virtual `laudos` da matriz).
   A recepção vê a situação, as datas e como foi entregue, nunca o texto do laudo. Regras puras (transições, permissões, recorte) em regras.js.
   Limite: o painel guarda TEXTO. Imagem, arquivo de laudo e integração com equipamento não existem aqui; "Entregue por" é um campo livre. */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI, R = window.Regras;
  var COLS = ['exames', 'encaminhadores', 'consultas', 'pets', 'tutores', 'profissionais', 'servicos'];
  var FILTROS = [['abertos', 'Em andamento'], ['agendar', 'Para agendar'], ['agendados', 'Agendados'], ['laudo', 'Aguardando laudo'], ['entrega', 'Para entregar'], ['entregues', 'Entregues'], ['cancelados', 'Cancelados'], ['todos', 'Todos']];
  var ABERTOS = ['agendar', 'agendados', 'laudo', 'entrega'];
  var filtro = 'abertos', termo = '';

  var porNome = function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { numeric: true }); };
  var opcoes = function (lista, rotulo) { return lista.map(function (x) { return { valor: x.id, rotulo: rotulo(x) }; }); };
  /* o texto da situação pode ser longo (por exemplo, Agendado para 23/10/2026 às 11:00): esta etiqueta quebra a linha em vez de alargar a página em 320px */
  var chipSituacao = function (s) { var ch = UI.chip(s.rotulo, s.tom); ch.className += ' chip-longo'; return ch; };
  var dh = function (x) { return x ? UI.fmt.dataHora(String(x)) : ''; };

  /* texto do botão de cada mudança de situação, por "de>para" */
  var ACAO = {
    'solicitado>agendado': 'Marcar na agenda', 'agendado>solicitado': 'Desmarcar (voltar a solicitado)', 'solicitado>realizado': 'Registrar realização', 'agendado>realizado': 'Registrar realização',
    'solicitado>cancelado': 'Cancelar exame', 'agendado>cancelado': 'Cancelar exame', 'realizado>laudado': 'Registrar laudo', 'laudado>entregue': 'Registrar entrega',
    'realizado>agendado': 'Desfazer a realização (voltar a agendado)', 'realizado>solicitado': 'Desfazer a realização (voltar a solicitado)', 'laudado>realizado': 'Desfazer o laudo (voltar a realizado)',
    'entregue>laudado': 'Desfazer a entrega (voltar a laudado)', 'cancelado>solicitado': 'Reabrir o pedido'
  };

  function render(raiz, ctx) {
    var escreve = ctx.podeEscrever('exames'), verLaudo = R.podeVerLaudo(ctx.perfil), escreveLaudo = R.podeEscreverLaudo(ctx.perfil), excluir = ctx.podeExcluir('exames');
    var petFiltro = ctx.params.pet || '';
    if (ctx.params.f && FILTROS.some(function (f) { return f[0] === ctx.params.f; })) filtro = ctx.params.f;

    /* Quem não lê laudo recebe a lista sem indicação e sem laudo (R.examesParaPerfil): a tela inteira trabalha com essa cópia. */
    function carregar() {
      return Promise.all([ctx.mapa(COLS), ctx.config()]).then(function (r) {
        var m = r[0]; m.nomeNegocio = r[1].nome || '';
        m.exames_lista = R.examesParaPerfil(ctx.perfil, m.exames_lista).filter(function (e) { return e && typeof e.id === 'string'; });
        m.exames = Object.create(null); m.exames_lista.forEach(function (e) { m.exames[e.id] = e; });
        return m;
      });
    }
    var nomePet = function (m, id) { var p = m.pets[id]; return p ? p.nome : 'Pet removido'; };
    var nomeTutor = function (m, petId) { var p = m.pets[petId], t = p && m.tutores[p.tutorId]; return t ? t.nome : ''; };
    var nomeProf = function (m, id) { var p = m.profissionais[id]; return p ? p.nome : ''; };
    var nomeExame = function (m, e) { var s = m.servicos[e.servicoId]; return s ? s.nome : 'Exame removido'; };
    var nomeEnc = function (m, e) { var x = e.encaminhadorId && m.encaminhadores[e.encaminhadorId]; return x ? x.nome : ''; };
    var agora = function () { return R.agoraISO(); };
    var naoAntes = function (ref) { var a = agora(); return ref && String(ref) > a ? String(ref) : a; }; // a sugestão de data nunca vem antes do passo anterior (o pedido pode ter hora futura em relógio atrasado)
    var consultaDe = function (m, e) { return e.consultaId ? m.consultas[e.consultaId] : null; };
    var situacao = function (m, e) { return R.situacaoDoExame(e, consultaDe(m, e)); };
    var grupo = function (m, e) { return R.grupoDoExame(e, consultaDe(m, e)); };

    /* ordem da fila: o que espera há mais tempo primeiro; agendados pelo horário; o resto do mais novo para o mais antigo */
    function chaveDeOrdem(m, e, g) {
      var c = consultaDe(m, e);
      if (g === 'agendados' && c && c.inicio) return String(c.inicio);
      if (g === 'laudo') return String(e.realizadoEm || e.solicitadoEm || '');
      if (g === 'entrega') return String(e.laudoEm || e.solicitadoEm || '');
      return String(e.solicitadoEm || '');
    }

    function desenhar() {
      return carregar().then(function (m) {
        UI.limpar(raiz);
        var acoes = [];
        if (escreve) acoes.push(UI.botao('Novo exame', function () { formExame(m, null, petFiltro ? { petId: petFiltro } : {}); }, { icone: 'mais' }));
        raiz.appendChild(UI.titulo(ctx.titulo('exames', 'Exames e laudos'), acoes));
        var grupos = Object.create(null); FILTROS.forEach(function (f) { grupos[f[0]] = 0; });
        m.exames_lista.forEach(function (e) { var g = grupo(m, e); grupos[g]++; grupos.todos++; if (ABERTOS.indexOf(g) !== -1) grupos.abertos++; });
        raiz.appendChild(h('p', { class: 'resumo-exames', text: grupos.todos ? grupos.abertos + (grupos.abertos === 1 ? ' exame em andamento' : ' exames em andamento') + '. ' + grupos.laudo + ' aguardando laudo e ' + grupos.entrega + ' para entregar.' : 'Nenhum exame registrado.' }));
        if (petFiltro) {
          raiz.appendChild(h('p', { class: 'filtro-pet' }, 'Exames de ' + nomePet(m, petFiltro) + '. ',
            UI.botao('Ver todos', function () { petFiltro = ''; delete ctx.params.pet; desenhar(); }, { classe: 'btn-sec btn-peq' })));
        }
        raiz.appendChild(h('div', { class: 'filtros', role: 'group', 'aria-label': 'Filtrar exames' }, FILTROS.map(function (f) {
          return h('button', { type: 'button', class: 'chip-botao', 'aria-pressed': String(filtro === f[0]), on: { click: function () { filtro = f[0]; desenhar().then(function () { var b = raiz.querySelector('.filtros .chip-botao[aria-pressed="true"]'); if (b) b.focus(); }); } } }, f[1] + ' (' + grupos[f[0]] + ')');
        })));
        raiz.appendChild(UI.busca('Buscar por paciente, tutor, exame ou encaminhador', function (v) { termo = v; lista(); }, termo));
        var caixa = h('div', { class: 'lista-area' }); raiz.appendChild(caixa);
        if (!verLaudo) raiz.appendChild(h('p', { class: 'nota-restrita', text: 'A indicação clínica e o laudo são do dono e do veterinário: esta tela mostra só a situação do exame.' }));

        function lista() {
          UI.limpar(caixa);
          var base = m.exames_lista.filter(function (e) {
            var g = grupo(m, e);
            return (!petFiltro || e.petId === petFiltro) && (filtro === 'todos' || (filtro === 'abertos' ? ABERTOS.indexOf(g) !== -1 : g === filtro));
          });
          var vis = R.buscar(base, termo, function (e) { return [nomePet(m, e.petId), nomeTutor(m, e.petId), nomeExame(m, e), nomeEnc(m, e), situacao(m, e).rotulo]; });
          var recente = filtro === 'todos' || filtro === 'entregues' || filtro === 'cancelados';
          vis.sort(function (a, b) {
            var ka = chaveDeOrdem(m, a, grupo(m, a)), kb = chaveDeOrdem(m, b, grupo(m, b));
            return recente ? (ka < kb ? 1 : ka > kb ? -1 : 0) : (ka < kb ? -1 : ka > kb ? 1 : 0);
          });
          caixa.appendChild(UI.tabela({
            linhas: vis, vazio: termo ? 'Nenhum exame encontrado.' : 'Nenhum exame nesta lista.',
            vazioTexto: !termo && escreve && !m.exames_lista.length ? 'Use "Novo exame" para registrar o pedido que chegou. O horário é marcado na agenda.' : '',
            aoClicarLinha: function (e) { detalhe(e.id); },
            rotuloLinha: function (e) { return nomeExame(m, e) + ', ' + nomePet(m, e.petId) + ', ' + situacao(m, e).rotulo; }, // várias linhas com o mesmo exame precisam se distinguir para quem usa leitor de tela
            colunas: [
              { rotulo: 'Exame', render: function (e) { return h('span', null, nomeExame(m, e), ' ', UI.marcaExemplo(e)); } },
              { rotulo: 'Paciente', render: function (e) { return h('span', null, nomePet(m, e.petId), nomeTutor(m, e.petId) ? h('small', { class: 'bloco-sub', text: nomeTutor(m, e.petId) }) : null); } },
              { rotulo: 'Situação', render: function (e) { return chipSituacao(situacao(m, e)); } },
              { rotulo: 'Encaminhador', render: function (e) { return nomeEnc(m, e) || '-'; } },
              { rotulo: 'Pedido em', render: function (e) { return dh(e.solicitadoEm) || '-'; } }
            ]
          }));
        }
        lista();
      });
    }

    /* ---------- passos do exame ---------- */
    /* Lê o exame ATUAL, aplica o passo (permissão, transição e datas conferidas em R.mudarStatusDoExame) e deixa a consulta da agenda acompanhar. */
    function aplicar(id, para, dados) {
      return ctx.store.obter('exames', id).then(function (atual) {
        var novo = R.mudarStatusDoExame(ctx.perfil, atual, para, dados);
        return ctx.store.salvar('exames', novo).then(function (salvo) {
          if (!atual.consultaId) return salvo;
          return ctx.store.obter('consultas', atual.consultaId).then(function (c) {
            var ns = c && c.petId === atual.petId && R.statusDaConsultaDoExame(c.status, atual.status, para); // consulta de outro paciente (edição antiga na agenda) não é tocada
            return ns ? ctx.store.salvar('consultas', Object.assign({}, c, { status: ns })) : null;
          }).then(function () { return salvo; });
        });
      });
    }
    function depois(id) { return function (salvou) { if (salvou) return desenhar().then(function () { return id ? detalhe(id) : null; }); }; }

    function formPasso(m, e, para) {
      var quem = m.profissionais_lista.filter(function (p) { return p.ativo !== false; });
      var vets = quem.filter(function (p) { return /veterin/i.test(p.funcao || ''); }); if (!vets.length) vets = quem;
      if (para === 'laudado' && !vets.length) { UI.toast('Não há profissional ativo para assinar o laudo. Peça ao dono para cadastrar o veterinário em "Profissionais e exames".', 'erro'); return Promise.resolve(); }
      var cfg;
      if (para === 'realizado') cfg = { titulo: 'Registrar realização', valores: { realizadoEm: naoAntes(e.solicitadoEm), responsavelId: e.responsavelId || '' }, campos: [
        { nome: 'realizadoEm', rotulo: 'Realizado em', tipo: 'datetime-local', requerido: true, largura: 'meia' },
        { nome: 'responsavelId', rotulo: 'Quem realizou', tipo: 'select', largura: 'meia', vazio: 'Não informado', opcoes: opcoes(quem, function (p) { return p.nome; }) }] };
      else if (para === 'laudado') cfg = { titulo: 'Registrar laudo', valores: { laudoEm: naoAntes(e.realizadoEm || e.solicitadoEm), laudoPorId: e.laudoPorId || e.responsavelId || '', laudo: e.laudo || '' }, campos: [
        { nome: 'laudoEm', rotulo: 'Laudo emitido em', tipo: 'datetime-local', requerido: true, largura: 'meia' },
        { nome: 'laudoPorId', rotulo: 'Quem emitiu o laudo', tipo: 'select', requerido: true, largura: 'meia', opcoes: opcoes(vets, function (p) { return p.nome + (p.registro ? ' (' + p.registro + ')' : ''); }) },
        { nome: 'laudo', rotulo: 'Texto do laudo', tipo: 'textarea', linhas: 10, ajuda: 'Opcional. O painel guarda só texto: imagens e o arquivo do laudo não são guardados aqui.' }] };
      else cfg = { titulo: 'Registrar entrega', valores: { entregueEm: naoAntes(e.laudoEm || e.realizadoEm || e.solicitadoEm), entregaVia: e.entregaVia || '' }, campos: [
        { nome: 'entregueEm', rotulo: 'Entregue em', tipo: 'datetime-local', requerido: true, largura: 'meia' },
        { nome: 'entregaVia', rotulo: 'Entregue por (link, e-mail ou local)', largura: 'meia', ajuda: 'Como o centro combinou entregar. O painel não envia nem guarda o arquivo do laudo.' }] };
      return UI.abrirFormulario({
        titulo: cfg.titulo + ': ' + nomePet(m, e.petId), larga: true, valores: cfg.valores, campos: cfg.campos, textoSalvar: cfg.titulo,
        aviso: para === 'laudado' ? 'Registro clínico: dado sensível. Escreva apenas o necessário.' : null,
        aoSalvar: function (v) { return aplicar(e.id, para, v).then(function () { UI.toast(cfg.titulo + ': feito.'); }); }
      }).then(depois(e.id));
    }
    function simples(m, e, para) {
      var de = e.status, perde = (de === 'agendado' && (para === 'cancelado' || para === 'solicitado')) ? ' O horário na agenda será cancelado.' : '';
      return UI.confirmar(ACAO[de + '>' + para] + '? Exame de ' + nomePet(m, e.petId) + '.' + perde, { ok: 'Confirmar', perigo: para === 'cancelado', titulo: 'Mudar a situação do exame' }).then(function (sim) {
        if (!sim) return;
        return aplicar(e.id, para, {}).then(function () { UI.toast('Situação do exame atualizada.'); return desenhar().then(function () { return detalhe(e.id); }); })
          .catch(function (err) { UI.toast(err.message || 'Não foi possível mudar a situação.', 'erro'); });
      });
    }
    function executar(m, e, para, api) {
      api.fechar();
      var avanca = R.STATUS_EXAME.indexOf(para) > R.STATUS_EXAME.indexOf(e.status) && para !== 'cancelado';
      if (para === 'agendado' && e.status === 'solicitado') { ctx.navegar('agenda', { exame: e.id }); return; } // o horário é marcado na agenda e volta ligado ao exame
      if (avanca && ['realizado', 'laudado', 'entregue'].indexOf(para) !== -1) return formPasso(m, e, para);
      return simples(m, e, para);
    }

    /* ---------- detalhe ---------- */
    function detalhe(id) {
      return carregar().then(function (m) {
        var e = m.exames[id];
        if (!e) { UI.toast('Exame não encontrado.', 'erro'); return desenhar(); }
        var cons = consultaDe(m, e), sit = situacao(m, e), pet = m.pets[e.petId], t = pet && m.tutores[pet.tutorId];
        var linhas = [['Paciente', pet ? pet.nome + (pet.especie ? ' (' + pet.especie + ')' : '') : 'Pet removido'], ['Tutor', t ? t.nome + (t.telefone ? ' · ' + t.telefone : '') : ''],
          ['Exame', nomeExame(m, e)], ['Encaminhador', nomeEnc(m, e)], ['Pedido em', dh(e.solicitadoEm)],
          ['Horário na agenda', cons && cons.inicio ? dh(cons.inicio) + ' (' + (cons.duracaoMin || 30) + ' min)' : ''],
          ['Realizado em', dh(e.realizadoEm)], ['Realizado por', nomeProf(m, e.responsavelId)], ['Laudo emitido em', dh(e.laudoEm)], ['Laudo emitido por', nomeProf(m, e.laudoPorId)],
          ['Entregue em', dh(e.entregueEm)], ['Entregue por', e.entregaVia ? String(e.entregaVia) : ''], ['Observações', e.obs ? String(e.obs) : '']].filter(function (l) { return l[1]; });
        var partes = [h('p', null, chipSituacao(sit), ' ', UI.marcaExemplo(e)), h('dl', { class: 'dl-ficha' }, linhas.map(function (l) { return [h('dt', { text: l[0] }), h('dd', { text: l[1] })]; }))];
        if (verLaudo) {
          partes.push(h('h3', { text: 'Indicação clínica' }), e.indicacao ? h('p', { class: 'laudo-texto', text: String(e.indicacao) }) : h('p', { class: 'mudo', text: 'Não registrada.' }));
          partes.push(h('h3', { text: 'Laudo' }), e.laudo ? h('p', { class: 'laudo-texto', text: String(e.laudo) }) : h('p', { class: 'mudo', text: 'Sem texto de laudo registrado.' }));
        } else partes.push(h('p', { class: 'nota-restrita', text: 'Indicação clínica e laudo: só o dono e o veterinário veem.' }));
        var api, botoes = [];
        var destinos = Object.keys(R.TRANSICOES_EXAME[R.statusDoExame(e)] || {}).filter(function (para) {
          if (!R.podeMudarStatus(ctx.perfil, e.status, para)) return false;
          if (e.status === 'realizado' && para === 'agendado') return !!e.consultaId; // desfazer volta ao horário se ele existe; senão, a solicitado
          if (e.status === 'realizado' && para === 'solicitado') return !e.consultaId;
          return true;
        });
        destinos.forEach(function (para) {
          var avanca = R.STATUS_EXAME.indexOf(para) > R.STATUS_EXAME.indexOf(e.status) && para !== 'cancelado';
          botoes.push({ texto: ACAO[e.status + '>' + para] || para, classe: avanca ? '' : 'btn-sec', aoClicar: function (a) { executar(m, e, para, a); } });
        });
        if (e.status === 'agendado' && sit.codigo !== 'agendado' && escreve) botoes.unshift({ texto: 'Remarcar na agenda', aoClicar: function (a) { a.fechar(); ctx.navegar('agenda', { exame: e.id }); } });
        else if (e.status === 'agendado' && escreve) botoes.push({ texto: 'Remarcar na agenda', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); ctx.navegar('agenda', { exame: e.id }); } });
        if (escreve) botoes.push({ texto: 'Editar', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); formExame(m, e, {}); } });
        if (excluir) botoes.push({ texto: 'Excluir exame', classe: 'btn-perigo', aoClicar: function (a) {
          a.fechar();
          UI.confirmar('Excluir este exame' + (verLaudo ? ' e o laudo dele' : '') + '? O horário dele na agenda, se ainda valer, é cancelado. Não dá para desfazer.', { ok: 'Excluir', perigo: true, titulo: 'Excluir exame' }).then(function (sim) {
            if (!sim) return;
            ctx.store.obter('exames', e.id).then(function (atual) { // o horário da agenda que ainda vale para este exame é cancelado junto (senão ficava na agenda sem exame)
              if (!atual || !atual.consultaId) return null;
              return ctx.store.obter('consultas', atual.consultaId).then(function (c) { var ns = c && c.petId === atual.petId && R.statusDaConsultaDoExame(c.status, 'agendado', 'cancelado'); return ns ? ctx.store.salvar('consultas', Object.assign({}, c, { status: ns })) : null; });
            }).then(function () { return ctx.store.remover('exames', e.id); }).then(function () { UI.toast('Exame excluído.'); return desenhar(); });
          });
        } });
        var link = e.status === 'laudado' && t && R.linkWhats(t.telefone, 'Olá, ' + t.nome + '! Aqui é ' + (m.nomeNegocio ? 'da ' + m.nomeNegocio : 'do centro') + '. O laudo do exame de ' + (pet ? pet.nome : 'seu animal') + ' já está pronto. Responda esta mensagem para combinarmos como você prefere recebê-lo.');
        if (link) partes.push(h('p', null, h('a', { class: 'btn btn-sec', href: link, target: '_blank', rel: 'noopener' }, UI.icone('whats', 18), 'Avisar o tutor pelo WhatsApp')));
        botoes.push({ texto: 'Fechar', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); } });
        api = UI.modal({ titulo: 'Exame: ' + nomePet(m, e.petId), corpo: h('div', null, partes), acoes: botoes, larga: true });
        return api;
      });
    }

    /* ---------- formulário do exame (novo e edição geral) ---------- */
    function formExame(m, e, base) {
      var existente = !!(e && e.id), preso = existente && ['solicitado', 'cancelado'].indexOf(e.status) === -1; // com horário ou resultado, o paciente não troca
      var pets = m.pets_lista.filter(function (p) { return !p.falecido || (existente && p.id === e.petId); }).sort(porNome);
      var servicos = m.servicos_lista.filter(function (s) { return s.ativo !== false || (existente && s.id === e.servicoId); }).sort(porNome);
      var encs = m.encaminhadores_lista.filter(function (x) { return x.ativo !== false || (existente && x.id === e.encaminhadorId); }).sort(porNome);
      if (!pets.length) { UI.toast('Cadastre o paciente em "Tutores e pets" antes de registrar o exame.', 'erro'); return Promise.resolve(); }
      if (!servicos.length) { UI.toast(ctx.perfil === 'dono' ? 'Cadastre os exames em "Profissionais e exames" antes de registrar um pedido.' : 'Peça ao dono para cadastrar os exames em "Profissionais e exames".', 'erro'); return Promise.resolve(); }
      var valores = existente ? e : Object.assign({ solicitadoEm: agora() }, base);
      var campos = [
        { nome: 'petId', rotulo: 'Paciente', tipo: 'select', requerido: true, somenteLeitura: preso, ajuda: preso ? 'Com horário ou resultado, o paciente não muda. Para trocar, desmarque ou cancele o exame e registre outro.' : null, opcoes: opcoes(pets, function (p) { return ctx.rotuloPet(p, m.tutores); }) },
        { nome: 'servicoId', rotulo: 'Exame', tipo: 'select', requerido: true, largura: 'meia', opcoes: opcoes(servicos, function (s) { return s.nome + (s.ativo === false ? ' (inativo)' : ''); }) },
        { nome: 'encaminhadorId', rotulo: 'Encaminhador', tipo: 'select', largura: 'meia', vazio: 'Sem encaminhador (tutor direto)', opcoes: opcoes(encs, function (x) { return x.nome; }) },
        { nome: 'solicitadoEm', rotulo: 'Pedido recebido em', tipo: 'datetime-local', requerido: true, largura: 'meia' }
      ];
      if (escreveLaudo) {
        campos.push({ nome: 'indicacao', rotulo: 'Indicação clínica (do pedido)', tipo: 'textarea', linhas: 3, ajuda: 'Dado clínico: só o dono e o veterinário veem.' });
        if (existente && ['realizado', 'laudado', 'entregue'].indexOf(e.status) !== -1) campos.push({ nome: 'laudo', rotulo: 'Texto do laudo', tipo: 'textarea', linhas: 10 });
      }
      campos.push({ nome: 'obs', rotulo: 'Observações', tipo: 'textarea', linhas: 2, ajuda: 'Visível para a recepção: não escreva dado clínico aqui.' });
      return UI.abrirFormulario({
        titulo: existente ? 'Editar exame' : 'Novo exame', larga: true, valores: valores, campos: campos,
        aoSalvar: function (v) {
          return (existente ? ctx.store.obter('exames', e.id) : Promise.resolve({ status: 'solicitado', consultaId: '' })).then(function (atual) {
            /* só entra o que a pessoa mudou em relação ao que o formulário mostrava; o resto é o registro ATUAL (laudo escrito em outra aba não é apagado) */
            var reg = existente ? R.mesclarExameEditado(ctx.perfil, atual, valores, v) : R.mesclarExame(ctx.perfil, atual, v);
            var erro = R.validarExame(reg); if (erro) throw new Error(erro);
            var existem = [['pets', reg.petId, 'O paciente'], ['servicos', reg.servicoId, 'O exame'], ['encaminhadores', reg.encaminhadorId, 'O encaminhador']].map(function (x) { // alguém pode ter excluído o cadastro depois que o formulário abriu
              return !x[1] ? null : ctx.store.obter(x[0], x[1]).then(function (r) { if (!r) throw new Error(x[2] + ' foi excluído em outra aba. Feche esta janela, atualize a tela e escolha de novo.'); });
            });
            return Promise.all(existem).then(function () { return ctx.store.salvar('exames', reg); });
          }).then(function (salvo) { e = salvo; UI.toast(existente ? 'Exame atualizado.' : 'Exame registrado. Marque o horário na agenda quando o tutor combinar.'); });
        }
      }).then(function (salvou) { if (salvou) return desenhar().then(function () { return e && e.id ? detalhe(e.id) : null; }); });
    }

    return desenhar().then(function () {
      var ver = ctx.params.ver, novo = ctx.params.novo; delete ctx.params.ver; delete ctx.params.novo; ctx.limparRota(); // consumidos: um novo desenho da tela (atualizar, F5) não repete a ação
      if (ver) return detalhe(ver);
      if (novo && escreve) return carregar().then(function (m) { return formExame(m, null, petFiltro ? { petId: petFiltro } : {}); });
    });
  }

  window.Painel.registrar({ id: 'exames', titulo: 'Exames e laudos', icone: 'exames', render: render });
})();
