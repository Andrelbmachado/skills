/* Vacinas e retornos: lembretes por WhatsApp (o link abre a conversa; a clínica envia) e caderneta de vacinação por pet. */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI, R = window.Regras;
  var aba = 'retornos', filtro = 'pendentes', petCaderneta = '';
  var FILTROS = [['pendentes', 'A avisar'], ['vencidos', 'Vencidos'], ['hoje', 'Hoje'], ['7', 'Próximos 7 dias'], ['30', 'Próximos 30 dias'], ['todos', 'Todos'], ['dispensados', 'Dispensados']];

  function render(raiz, ctx) {
    var escreve = ctx.podeEscrever('vacinas');
    if (ctx.params.pet) { petCaderneta = ctx.params.pet; aba = 'caderneta'; }

    function desenhar() {
      return Promise.all([ctx.mapa(['vacinas', 'prontuarios', 'lembretes', 'pets', 'tutores', 'profissionais', 'estoque']), ctx.config()]).then(function (r) {
        var m = r[0], cfgc = r[1];
        UI.limpar(raiz);
        raiz.appendChild(UI.titulo('Vacinas e retornos', escreve ? [UI.botao('Registrar vacina', function () { formVacina(m, {}); }, { icone: 'mais' })] : []));
        raiz.appendChild(UI.abas([{ id: 'retornos', rotulo: 'Retornos e lembretes' }, { id: 'caderneta', rotulo: 'Caderneta do pet' }], aba, function (id) { aba = id; desenhar(); }));
        var area = UI.painelAba(aba); raiz.appendChild(area);
        if (aba === 'retornos') retornos(m, cfgc, area); else caderneta(m, area);
      });
    }

    /* ---------- lembretes ---------- */
    function retornos(m, cfgc, area) {
      var hoje = ctx.hoje();
      /* comQueixa: a recepção não lê prontuários, então o título do retorno não cita a queixa */
      var tudo = R.agruparRetornos({ hoje: hoje, pets: m.pets_lista, tutores: m.tutores_lista, vacinas: m.vacinas_lista, prontuarios: m.prontuarios_lista, lembretes: m.lembretes_lista,
        comQueixa: ctx.pode('prontuarios'), incluirDispensados: true });
      var todos = tudo.filter(function (x) { return !x.dispensado; }), dispensados = tudo.filter(function (x) { return x.dispensado; });
      if (!escreve && filtro === 'dispensados') filtro = 'pendentes'; // só quem edita vacinas lida com dispensados
      var filtrados = (filtro === 'dispensados' ? dispensados : todos).filter(function (x) {
        var c = x.status.codigo, d = x.status.dias;
        if (filtro === 'dispensados') return true;
        if (filtro === 'pendentes') return !x.enviadoEm && (c === 'vencido' || c === 'hoje' || c === 'em_breve');
        if (filtro === 'vencidos') return c === 'vencido';
        if (filtro === 'hoje') return c === 'hoje';
        if (filtro === '7') return d >= 0 && d <= 7;
        if (filtro === '30') return d >= 0 && d <= 30;
        return true;
      });
      area.appendChild(h('div', { class: 'filtros', role: 'group', 'aria-label': 'Filtrar lembretes' }, FILTROS.filter(function (f) { return escreve || f[0] !== 'dispensados'; }).map(function (f) {
        return h('button', { type: 'button', class: 'chip-botao', 'aria-pressed': String(filtro === f[0]), on: { click: function () { filtro = f[0]; desenhar(); } } }, f[1] + (f[0] === 'dispensados' ? ' (' + dispensados.length + ')' : ''));
      })));
      area.appendChild(h('p', { class: 'mudo', text: 'O botão de WhatsApp abre a conversa com a mensagem pronta; quem envia é a clínica. O texto da mensagem pode ser ajustado em Configurações.' }));
      area.appendChild(UI.tabela({
        linhas: filtrados, vazio: filtro === 'dispensados' ? 'Nenhum lembrete dispensado.' : todos.length ? 'Nenhum lembrete neste filtro.' : 'Nenhum retorno ou próxima dose registrado.',
        vazioTexto: todos.length ? 'Troque o filtro para ver os demais.' : 'Registre uma vacina com intervalo (ou um retorno em um prontuário) e ele aparece aqui.',
        colunas: [
          { rotulo: 'Data', render: function (x) { return h('strong', { text: UI.fmt.data(x.data) }); } },
          { rotulo: 'Situação', render: function (x) { return [UI.chip(UI.fmt.quando(x.status), x.status.codigo === 'vencido' ? 'perigo' : x.status.codigo === 'hoje' ? 'aviso' : x.status.codigo === 'em_breve' ? 'info' : 'neutro'), x.enviadoEm ? [' ', UI.chip('Avisado', 'ok')] : null]; } },
          { rotulo: 'Pet e tutor', render: function (x) { var p = m.pets[x.petId], t = m.tutores[x.tutorId]; return h('span', null, (p ? p.nome : 'Pet removido'), t ? h('small', { class: 'bloco-sub', text: t.nome + (t.telefone ? ' · ' + t.telefone : '') }) : null, ' ', UI.marcaExemplo(p)); } },
          { rotulo: 'O que', render: function (x) { return x.titulo; } },
          { rotulo: 'Ações', classe: 'col-acoes', render: function (x) { return acoesLembrete(x, m, cfgc); } }
        ]
      }));
    }
    function marcar(x, extra) {
      var existente = null;
      return ctx.store.listar('lembretes').then(function (l) {
        existente = l.find(function (y) { return y.chave === x.chave; });
        return ctx.store.salvar('lembretes', Object.assign({}, existente || { chave: x.chave }, extra));
      });
    }
    function acoesLembrete(x, m, cfgc) {
      var pet = m.pets[x.petId], t = m.tutores[x.tutorId], out = [];
      if (x.dispensado) { // lembrete dispensado: só dá para restaurar (e só para quem edita vacinas)
        out.push(UI.botao('Restaurar', function () { marcar(x, { dispensado: false }).then(function () { UI.toast('Lembrete restaurado.'); desenhar(); }); }, { classe: 'btn-sec btn-peq' }));
        return h('div', { class: 'acoes-linha' }, out);
      }
      var texto = R.montarMensagem(cfgc.modeloLembrete, { tutor: t ? t.nome.split(' ')[0] : '', pet: pet ? pet.nome : '', clinica: cfgc.nome, data: UI.fmt.data(x.data), motivo: x.origem === 'vacina' ? 'a próxima dose de ' + x.titulo.replace('Próxima dose: ', '') : 'o retorno' });
      var link = t && R.linkWhats(t.telefone, texto);
      if (link) out.push(h('a', { class: 'btn btn-peq', href: link, target: '_blank', rel: 'noopener', 'aria-label': 'Lembrar ' + (t.nome) + ' pelo WhatsApp', on: { click: function () { marcar(x, { enviadoEm: new Date().toISOString() }).then(function () { setTimeout(desenhar, 600); }); } } }, UI.icone('whats', 16), 'WhatsApp'));
      else out.push(h('span', { class: 'mudo', text: 'Sem telefone válido' }));
      if (!x.enviadoEm) out.push(UI.botao('Marcar avisado', function () { marcar(x, { enviadoEm: new Date().toISOString() }).then(desenhar); }, { classe: 'btn-sec btn-peq' }));
      if (x.origem === 'vacina' && escreve) out.push(UI.botao('Registrar aplicação', function () {
        var v = m.vacinas[x.origemId]; formVacina(m, { petId: x.petId, vacina: v ? v.vacina : '', intervaloDias: v ? v.intervaloDias : '' });
      }, { classe: 'btn-sec btn-peq' }));
      if (escreve) out.push(UI.botao('Dispensar', function () {
        UI.confirmar('Dispensar este lembrete? Ele sai da lista, mas fica no filtro "Dispensados", de onde dá para restaurar (o registro da vacina ou do prontuário continua).', { ok: 'Dispensar' }).then(function (sim) { if (sim) marcar(x, { dispensado: true }).then(function () { UI.toast('Lembrete dispensado.'); desenhar(); }); });
      }, { classe: 'btn-sec btn-peq' }));
      return h('div', { class: 'acoes-linha' }, out);
    }

    /* ---------- caderneta ---------- */
    function caderneta(m, area) {
      var pets = m.pets_lista.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); });
      if (petCaderneta && !m.pets[petCaderneta]) petCaderneta = '';
      area.appendChild(h('div', { class: 'agenda-barra' }, h('label', { class: 'rotulo-inline' }, 'Pet ', h('select', { 'aria-label': 'Escolher o pet', on: { change: function (e) { petCaderneta = e.target.value; desenhar(); } } },
        h('option', { value: '' }, pets.length ? 'Escolha um pet' : 'Nenhum pet cadastrado'), pets.map(function (p) { return h('option', { value: p.id, selected: p.id === petCaderneta }, ctx.rotuloPet(p, m.tutores)); })))));
      if (!petCaderneta) { area.appendChild(UI.vazio('Escolha um pet', 'A caderneta lista todas as vacinas aplicadas e a próxima dose de cada uma.')); return; }
      var regs = m.vacinas_lista.filter(function (v) { return v.petId === petCaderneta; }).sort(function (a, b) { return a.dataAplicacao < b.dataAplicacao ? 1 : -1; });
      area.appendChild(UI.tabela({
        linhas: regs, vazio: 'Nenhuma vacina registrada para este pet.', vazioTexto: escreve ? 'Use "Registrar vacina".' : '',
        aoClicarLinha: escreve ? function (v) { formVacina(m, v); } : null,
        colunas: [
          { rotulo: 'Vacina', render: function (v) { return h('span', null, v.vacina, ' ', UI.marcaExemplo(v)); } },
          { rotulo: 'Aplicada em', render: function (v) { return UI.fmt.data(v.dataAplicacao); } },
          { rotulo: 'Lote', render: function (v) { return v.lote || '-'; } },
          { rotulo: 'Próxima dose', render: function (v) { return v.proximaDose ? UI.fmt.data(v.proximaDose) : '-'; } },
          { rotulo: 'Aplicada por', render: function (v) { var p = m.profissionais[v.profissionalId]; return p ? p.nome : '-'; } }
        ]
      }));
    }

    /* ---------- formulário ---------- */
    function formVacina(m, v) {
      var pets = m.pets_lista.filter(function (p) { return !p.falecido; }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
      if (!pets.length) { UI.toast('Cadastre um pet antes de registrar vacinas.', 'erro'); return; }
      var nomes = Array.from(new Set(m.vacinas_lista.map(function (x) { return x.vacina; }))).sort();
      var vets = m.profissionais_lista.filter(function (p) { return p.ativo !== false; });
      var itens = m.estoque_lista.filter(function (i) { return i.categoria === 'vacina' || i.categoria === 'medicamento'; });
      var existente = v && v.id ? v : null, f = null;
      var valores = existente || Object.assign({ dataAplicacao: ctx.hoje(), petId: petCaderneta }, v || {});
      function recalcular() {
        if (!f) return; var x = f.valores(), d = R.proximaDose(x.dataAplicacao, x.intervaloDias);
        if (d) f.campo('proximaDose').input.value = d;
      }
      return UI.abrirFormulario({
        titulo: existente ? 'Editar vacina' : 'Registrar vacina', valores: valores, larga: true,
        campos: [
          { nome: 'petId', rotulo: 'Pet', tipo: 'select', requerido: true, opcoes: pets.map(function (p) { return { valor: p.id, rotulo: ctx.rotuloPet(p, m.tutores) }; }) },
          { nome: 'vacina', rotulo: 'Vacina', requerido: true, lista: nomes, largura: 'meia', ajuda: 'Digite o nome como a clínica usa; nomes já registrados aparecem como sugestão.' },
          { nome: 'dataAplicacao', rotulo: 'Data da aplicação', tipo: 'date', requerido: true, largura: 'meia', aoMudar: recalcular },
          { nome: 'lote', rotulo: 'Lote', largura: 'terco' },
          { nome: 'intervaloDias', rotulo: 'Dias até a próxima dose', tipo: 'number', min: 1, largura: 'terco', aoMudar: recalcular },
          { nome: 'proximaDose', rotulo: 'Próxima dose', tipo: 'date', largura: 'terco', ajuda: 'Calculada pelo intervalo; pode ajustar.' },
          { nome: 'profissionalId', rotulo: 'Aplicada por', tipo: 'select', largura: 'meia', opcoes: vets.map(function (p) { return { valor: p.id, rotulo: p.nome }; }) },
          existente ? null : { nome: 'itemEstoque', rotulo: 'Dar baixa de 1 unidade no estoque', tipo: 'select', largura: 'meia', opcoes: itens.map(function (i) { var s = R.estoqueStatus(i, ctx.hoje()); return { valor: i.id, rotulo: i.nome + ' (' + i.quantidade + ' em estoque' + (s.vencido ? '; VENCIDO em ' + UI.fmt.data(i.validade) : s.vencendo ? '; vence em ' + UI.fmt.data(i.validade) : '') + ')' }; }), vazio: 'Não dar baixa' },
          { nome: 'obs', rotulo: 'Observações' }
        ].filter(Boolean),
        aoAbrir: function (m2, form) { f = form; },
        aoExcluir: existente && ctx.podeExcluir('vacinas') ? function () { return ctx.store.remover('vacinas', existente.id); } : null,
        aoSalvar: function (x) {
          if (!x.vacina) throw new Error('Informe o nome da vacina.');
          var reg = Object.assign({}, existente || {}, { petId: x.petId, vacina: x.vacina, dataAplicacao: x.dataAplicacao, lote: x.lote, intervaloDias: x.intervaloDias, proximaDose: x.proximaDose || '', profissionalId: x.profissionalId, obs: x.obs });
          var baixa = x.itemEstoque ? m.estoque[x.itemEstoque] : null, nova;
          if (baixa) nova = R.aplicarMovimento(baixa.quantidade, { tipo: 'saida', qtd: 1 }); // lança erro legível se não há estoque
          var vencido = baixa && R.estoqueStatus(baixa, ctx.hoje()).vencido;
          return Promise.resolve(vencido ? UI.confirmar('"' + baixa.nome + '" está com a validade vencida (' + UI.fmt.data(baixa.validade) + '). Registrar a aplicação e dar baixa neste item mesmo assim?', { ok: 'Registrar mesmo assim', perigo: true, titulo: 'Item vencido' }) : true).then(function (segue) {
            if (!segue) return false;
            return gravar();
          });
          function gravar() { return ctx.store.salvar('vacinas', reg).then(function (salva) {
            if (!baixa) return;
            return ctx.store.salvar('estoque', Object.assign({}, baixa, { quantidade: nova })).then(function () {
              return ctx.store.salvar('movimentos', { itemId: baixa.id, tipo: 'saida', qtd: 1, data: x.dataAplicacao, motivo: 'Aplicação em ' + (m.pets[x.petId] ? m.pets[x.petId].nome : 'pet'), petId: x.petId, vacinaId: salva.id });
            });
          }).then(function () { petCaderneta = x.petId; UI.toast(existente ? 'Vacina atualizada.' : 'Vacina registrada.' + (x.proximaDose ? ' Próxima dose nos lembretes.' : '')); }); }
        }
      }).then(function (salvou) { if (salvou) return desenhar(); });
    }

    return desenhar();
  }

  window.Painel.registrar({ id: 'vacinas', titulo: 'Vacinas e retornos', icone: 'vacinas', render: render });
})();
