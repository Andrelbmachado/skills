/* Profissionais e serviços: base da agenda (quem atende, quanto dura cada serviço). Só o dono edita. */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI;
  var FUNCOES = ['Veterinário(a)', 'Auxiliar veterinário', 'Recepção', 'Gerente', 'Outro'];

  /* subtipo (SITE_CONFIG.painel): textos do bloco de serviços (diagnóstico: "Exames") e a lista de exames que o site público apresenta */
  var PC = (window.SITE_CONFIG && window.SITE_CONFIG.painel) || {};
  var TX = Object.assign({ plural: 'Serviços', novo: 'Novo serviço', vazio: 'Nenhum serviço cadastrado.', vazioTexto: 'Os serviços definem a duração padrão na agenda e o valor sugerido no caixa.' }, (PC.textos && PC.textos.servico) || {});
  var DO_SITE = Array.isArray(PC.exames) ? PC.exames.filter(function (n) { return typeof n === 'string' && n.trim(); }) : [];

  function render(raiz, ctx) {
    function desenhar() {
      return ctx.mapa(['profissionais', 'servicos']).then(function (m) {
        UI.limpar(raiz);
        raiz.appendChild(UI.titulo(ctx.titulo('equipe', 'Profissionais e serviços')));
        raiz.appendChild(h('section', { class: 'bloco' },
          h('div', { class: 'bloco-topo' }, h('h2', { text: 'Profissionais' }), UI.botao('Novo profissional', function () { formProf(null); }, { icone: 'mais', classe: 'btn-peq' })),
          UI.tabela({
            linhas: m.profissionais_lista.sort(function (a, b) { return a.nome.localeCompare(b.nome); }), vazio: 'Nenhum profissional cadastrado.', vazioTexto: 'Cadastre quem atende para poder marcar consultas.', aoClicarLinha: formProf,
            colunas: [
              { rotulo: 'Nome', render: function (p) { return h('span', null, p.nome, ' ', UI.marcaExemplo(p)); } },
              { rotulo: 'Função', render: function (p) { return p.funcao || '-'; } },
              { rotulo: 'Registro profissional', render: function (p) { return p.registro || '-'; } },
              { rotulo: 'Situação', render: function (p) { return p.ativo === false ? UI.chip('Inativo', 'neutro') : UI.chip('Ativo', 'ok'); } }
            ]
          })));
        raiz.appendChild(h('section', { class: 'bloco' },
          h('div', { class: 'bloco-topo' }, h('h2', { text: TX.plural }), UI.botao(TX.novo, function () { formServ(null); }, { icone: 'mais', classe: 'btn-peq' })),
          faltamDoSite(m).length ? h('p', { class: 'mudo' }, 'O site público apresenta: ' + DO_SITE.join(', ') + '. ', UI.botao('Cadastrar os que faltam', function (ev) { if (ev && ev.currentTarget) ev.currentTarget.disabled = true; cadastrarDoSite(m); }, { classe: 'btn-sec btn-peq' }), ' A duração padrão é de 30 minutos; ajuste depois.') : null,
          UI.tabela({
            linhas: m.servicos_lista.sort(function (a, b) { return a.nome.localeCompare(b.nome); }), vazio: TX.vazio, vazioTexto: TX.vazioTexto, aoClicarLinha: formServ,
            colunas: [
              { rotulo: 'Serviço', render: function (s) { return h('span', null, s.nome, ' ', UI.marcaExemplo(s)); } },
              { rotulo: 'Duração', render: function (s) { return s.duracaoMin + ' min'; } },
              { rotulo: 'Valor interno', classe: 'num', render: function (s) { return s.valorCents ? UI.fmt.brl(s.valorCents) : '-'; } },
              { rotulo: 'Situação', render: function (s) { return s.ativo === false ? UI.chip('Inativo', 'neutro') : UI.chip('Ativo', 'ok'); } }
            ]
          })));
        raiz.appendChild(h('p', { class: 'mudo', text: 'Os valores cadastrados aqui são de uso interno do caixa e não aparecem no site público.' }));
      });
    }
    function faltamDoSite(m) {
      var tem = Object.create(null); m.servicos_lista.forEach(function (s) { tem[String(s.nome || '').trim().toLowerCase()] = true; });
      return DO_SITE.filter(function (n) { return !tem[n.trim().toLowerCase()]; });
    }
    function cadastrarDoSite(m) {
      Promise.all(faltamDoSite(m).map(function (n) { return ctx.store.salvar('servicos', { nome: n.trim(), duracaoMin: 30, valorCents: 0, ativo: true }); }))
        .then(function (r) { UI.toast(r.length + (r.length === 1 ? ' exame cadastrado.' : ' exames cadastrados.')); return desenhar(); });
    }
    function formProf(p) {
      return UI.abrirFormulario({
        titulo: p ? 'Editar profissional' : 'Novo profissional', valores: p || { ativo: true, funcao: FUNCOES[0] },
        campos: [
          { nome: 'nome', rotulo: 'Nome', requerido: true },
          { nome: 'funcao', rotulo: 'Função', tipo: 'select', requerido: true, largura: 'meia', opcoes: FUNCOES.map(function (f) { return { valor: f, rotulo: f }; }) },
          { nome: 'registro', rotulo: 'Registro profissional (CRMV)', largura: 'meia', ajuda: ctx.store.tem('exames') ? 'Informe o número real, se houver; aparece ao lado do nome de quem realizou ou assinou o laudo.' : 'Informe o número real, se houver; sai em impressões de prontuário.' },
          { nome: 'ativo', rotulo: 'Ativo (aparece na agenda)', tipo: 'checkbox' }
        ],
        aoExcluir: p ? function () {
          return ctx.mapa(['consultas', 'prontuarios', 'vacinas', 'internacoes', 'evolucoes', 'plantoes', 'exames']).then(function (m) { // tudo que aponta para o profissional (prontuário e vacina levam o nome e o CRMV nas impressões)
            var usado = m.consultas_lista.some(function (c) { return c.profissionalId === p.id; }) || m.prontuarios_lista.some(function (r) { return r.profissionalId === p.id; }) ||
              m.vacinas_lista.some(function (v) { return v.profissionalId === p.id; }) || m.internacoes_lista.some(function (i) { return i.responsavelId === p.id; }) ||
              m.evolucoes_lista.some(function (e) { return e.profissionalId === p.id; }) || m.plantoes_lista.some(function (x) { return x.profissionalId === p.id; }) ||
              m.exames_lista.some(function (x) { return x && (x.responsavelId === p.id || x.laudoPorId === p.id); }); // quem realizou ou assinou o laudo de um exame (diagnóstico)
            if (usado) throw new Error('Há consultas, prontuários, vacinas, internações' + (ctx.store.tem('exames') ? ', exames' : '') + ' ou plantões deste profissional. Em vez de excluir, desmarque "Ativo".');
            return ctx.store.remover('profissionais', p.id);
          });
        } : null,
        aoSalvar: function (v) { return ctx.store.salvar('profissionais', Object.assign({}, p || {}, v)).then(function () { UI.toast('Profissional salvo.'); }); }
      }).then(function (ok) { if (ok) return desenhar(); });
    }
    function formServ(s) {
      return UI.abrirFormulario({
        titulo: s ? 'Editar serviço' : 'Novo serviço', valores: s || { ativo: true, duracaoMin: 30 },
        campos: [
          { nome: 'nome', rotulo: 'Nome do serviço', requerido: true },
          { nome: 'duracaoMin', rotulo: 'Duração (min)', tipo: 'number', requerido: true, min: 5, step: 5, largura: 'meia' },
          { nome: 'valorCents', rotulo: 'Valor interno (R$)', tipo: 'money', largura: 'meia', ajuda: 'Opcional. Sugere o valor ao registrar o pagamento.' },
          { nome: 'ativo', rotulo: 'Ativo (aparece na agenda)', tipo: 'checkbox' }
        ],
        aoExcluir: s ? function () {
          return ctx.mapa(['exames', 'consultas']).then(function (m) { // um exame sem o serviço (o nome do exame) não pode mais ser editado: a lista fresca decide
            if (m.exames_lista.some(function (x) { return x && x.servicoId === s.id; })) throw new Error('Há exames registrados com este serviço. Em vez de excluir, desmarque "Ativo".');
            /* v0.7: a consulta com um serviço que não existe mais mostrava o campo em branco e, ao editar e salvar, perdia o vínculo em silêncio */
            if (m.consultas_lista.some(function (x) { return x && x.servicoId === s.id; })) throw new Error('Há consultas na agenda com este serviço. Em vez de excluir, desmarque "Ativo".');
            return ctx.store.remover('servicos', s.id);
          });
        } : null,
        aoSalvar: function (v) { return ctx.store.salvar('servicos', Object.assign({}, s || {}, v)).then(function () { UI.toast('Serviço salvo.'); }); }
      }).then(function (ok) { if (ok) return desenhar(); });
    }
    return desenhar();
  }

  window.Painel.registrar({ id: 'equipe', titulo: 'Profissionais e serviços', icone: 'equipe', render: render });
})();
