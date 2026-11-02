/* Caixa simples: entradas e saídas do dia ou do mês, por forma de pagamento, exportação em CSV. Valores em centavos. */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI, R = window.Regras;
  var estado = { periodo: 'dia', ref: null };

  function render(raiz, ctx) {
    var escreve = ctx.podeEscrever('caixa');
    if (!estado.ref) estado.ref = ctx.hoje();

    function intervalo() {
      return estado.periodo === 'dia' ? [estado.ref, estado.ref] : [estado.ref.slice(0, 7) + '-01', estado.ref.slice(0, 7) + '-31'];
    }
    function desenhar() {
      return ctx.mapa(['lancamentos', 'tutores', 'consultas', 'pets', 'servicos']).then(function (m) {
        UI.limpar(raiz);
        var iv = intervalo();
        var linhas = m.lancamentos_lista.filter(function (l) { return l.data >= iv[0] && l.data <= iv[1]; }).sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : (a.criadoEm < b.criadoEm ? 1 : -1); });
        var res = R.resumoCaixa(linhas);
        raiz.appendChild(UI.titulo('Caixa', escreve ? [UI.botao('Nova entrada', function () { form(m, null, 'entrada'); }, { icone: 'mais' }), UI.botao('Nova saída', function () { form(m, null, 'saida'); }, { classe: 'btn-sec', icone: 'mais' })] : []));
        raiz.appendChild(h('div', { class: 'agenda-barra' },
          h('select', { 'aria-label': 'Período', on: { change: function (e) { estado.periodo = e.target.value; desenhar(); } } }, h('option', { value: 'dia', selected: estado.periodo === 'dia' }, 'Por dia'), h('option', { value: 'mes', selected: estado.periodo === 'mes' }, 'Por mês')),
          h('input', { type: 'date', value: estado.ref, 'aria-label': 'Data de referência', on: { change: function (e) { if (e.target.value) { estado.ref = e.target.value; desenhar(); } } } }),
          UI.botao('Exportar CSV', function () {
            var csv = R.paraCSV([{ rotulo: 'Data', valor: function (l) { return l.data; } }, { rotulo: 'Tipo', valor: function (l) { return l.tipo === 'saida' ? 'Saída' : 'Entrada'; } }, { rotulo: 'Descrição', valor: function (l) { return l.descricao; } },
              { rotulo: 'Forma', valor: function (l) { return UI.fmt.forma(l.forma); } }, { rotulo: 'Valor (R$)', valor: function (l) { return (l.valorCents / 100).toFixed(2).replace('.', ','); } }, { rotulo: 'Categoria', valor: function (l) { return l.categoria || ''; } }], linhas);
            UI.baixar('caixa-' + iv[0] + (iv[0] === iv[1] ? '' : '-a-' + iv[1]) + '.csv', csv, 'text/csv;charset=utf-8'); UI.toast('CSV baixado.');
          }, { classe: 'btn-sec', desabilitado: !linhas.length })));
        raiz.appendChild(h('div', { class: 'resumo-grade' },
          h('div', { class: 'resumo-card' }, h('span', { class: 'resumo-rotulo', text: 'Entradas' }), h('strong', { class: 'resumo-valor', text: UI.fmt.brl(res.entradas) })),
          h('div', { class: 'resumo-card' }, h('span', { class: 'resumo-rotulo', text: 'Saídas' }), h('strong', { class: 'resumo-valor', text: UI.fmt.brl(res.saidas) })),
          h('div', { class: 'resumo-card resumo-forte' }, h('span', { class: 'resumo-rotulo', text: 'Saldo' }), h('strong', { class: 'resumo-valor', text: UI.fmt.brl(res.saldo) }))));
        var formas = Object.keys(res.porForma);
        if (formas.length) raiz.appendChild(h('section', { class: 'bloco' }, h('h2', { text: 'Por forma de pagamento' }), h('ul', { class: 'lista-simples-painel' }, formas.map(function (f) {
          var x = res.porForma[f]; return h('li', null, h('strong', { text: UI.fmt.forma(f) }), ' entradas ' + UI.fmt.brl(x.entradas) + (x.saidas ? ' · saídas ' + UI.fmt.brl(x.saidas) : ''));
        }))));
        raiz.appendChild(UI.tabela({
          linhas: linhas, vazio: 'Nenhum lançamento neste ' + (estado.periodo === 'dia' ? 'dia' : 'mês') + '.', vazioTexto: escreve ? 'Use "Nova entrada" ou "Nova saída".' : '',
          aoClicarLinha: escreve ? function (l) { form(m, l, l.tipo); } : null,
          colunas: [
            { rotulo: 'Data', render: function (l) { return UI.fmt.data(l.data); } },
            { rotulo: 'Descrição', render: function (l) { var t = m.tutores[l.tutorId]; return h('span', null, l.descricao, ' ', UI.marcaExemplo(l), t ? h('small', { class: 'bloco-sub', text: t.nome }) : null); } },
            { rotulo: 'Forma', render: function (l) { return UI.fmt.forma(l.forma); } },
            { rotulo: 'Valor', classe: 'num', render: function (l) { return h('span', { class: l.tipo === 'saida' ? 'neg' : 'pos', text: (l.tipo === 'saida' ? '- ' : '+ ') + UI.fmt.brl(l.valorCents) }); } }
          ]
        }));
      });
    }

    function form(m, l, tipo) {
      var base = l || { data: ctx.hoje(), tipo: tipo, forma: 'pix' };
      var consulta = !l && ctx.params.consulta && m.consultas[ctx.params.consulta];
      if (consulta) {
        var pet = m.pets[consulta.petId], serv = m.servicos[consulta.servicoId];
        base = Object.assign({}, base, { descricao: (serv ? serv.nome : 'Consulta') + (pet ? ' · ' + pet.nome : ''), valorCents: serv && serv.valorCents ? serv.valorCents : null, tutorId: consulta.tutorId, consultaId: consulta.id, categoria: 'Atendimento' });
      }
      return UI.abrirFormulario({
        titulo: l ? 'Editar lançamento' : (tipo === 'saida' ? 'Nova saída' : 'Nova entrada'), valores: base,
        campos: [
          { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', requerido: true, largura: 'meia', opcoes: [{ valor: 'entrada', rotulo: 'Entrada' }, { valor: 'saida', rotulo: 'Saída' }] },
          { nome: 'data', rotulo: 'Data', tipo: 'date', requerido: true, largura: 'meia' },
          { nome: 'descricao', rotulo: 'Descrição', requerido: true },
          { nome: 'valorCents', rotulo: 'Valor (R$)', tipo: 'money', requerido: true, largura: 'meia', placeholder: '0,00' },
          { nome: 'forma', rotulo: 'Forma de pagamento', tipo: 'select', requerido: true, largura: 'meia', opcoes: UI.FORMAS.map(function (f) { return { valor: f[0], rotulo: f[1] }; }) },
          { nome: 'categoria', rotulo: 'Categoria', largura: 'meia' },
          { nome: 'tutorId', rotulo: 'Tutor (opcional)', tipo: 'select', largura: 'meia', vazio: 'Sem vínculo', opcoes: m.tutores_lista.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (t) { return { valor: t.id, rotulo: t.nome }; }) }
        ],
        aoExcluir: l && ctx.podeExcluir('caixa') ? function () { return ctx.store.remover('lancamentos', l.id); } : null,
        aoSalvar: function (v) {
          if (v.valorCents == null || isNaN(v.valorCents) || v.valorCents <= 0) throw new Error('Informe um valor maior que zero.');
          return ctx.store.salvar('lancamentos', Object.assign({}, l || {}, { consultaId: base.consultaId || '' }, v)).then(function () { estado.ref = v.data; UI.toast('Lançamento salvo.'); });
        }
      }).then(function (salvou) { if (salvou) { if (ctx.params.consulta) { delete ctx.params.consulta; delete ctx.params.novo; } return desenhar(); } });
    }

    return desenhar().then(function () {
      if (ctx.params.novo && escreve) return ctx.mapa(['lancamentos', 'tutores', 'consultas', 'pets', 'servicos']).then(function (m) { return form(m, null, ctx.params.novo === 'saida' ? 'saida' : 'entrada'); });
    });
  }

  window.Painel.registrar({ id: 'caixa', titulo: 'Caixa', icone: 'caixa', render: render });
})();
