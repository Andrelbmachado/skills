/* Encaminhadores (subtipo diagnostico): clínicas e veterinários que pedem exames ao centro. Cadastro do próprio centro: nada aqui vem do site público
   e o painel não afirma convênio nem parceria; "condições combinadas" é um campo livre que o centro preenche. Dono e recepção cadastram, o veterinário só consulta;
   excluir é só do dono, e um encaminhador com exames não se exclui (desative). A contagem de exames é administrativa: não lê indicação nem laudo. */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI, R = window.Regras;
  var TIPOS = ['Clínica ou hospital veterinário', 'Veterinário(a) autônomo(a)', 'Outro'];
  var termo = '';

  function render(raiz, ctx) {
    var escreve = ctx.podeEscrever('encaminhadores'), excluir = ctx.podeExcluir('encaminhadores');

    function carregar() { return ctx.mapa(['encaminhadores', 'exames']); }
    function desenhar() {
      return carregar().then(function (m) {
        UI.limpar(raiz);
        raiz.appendChild(UI.titulo(ctx.titulo('encaminhadores', 'Encaminhadores'), escreve ? [UI.botao('Novo encaminhador', function () { form(m, null); }, { icone: 'mais' })] : []));
        raiz.appendChild(h('p', { class: 'resumo-exames', text: 'Quem pede exames ao centro. Ao registrar um exame, escolha o encaminhador; o tutor que chega sozinho fica sem encaminhador.' }));
        raiz.appendChild(UI.busca('Buscar por nome, telefone ou tipo', function (v) { termo = v; lista(); }, termo));
        var caixa = h('div', { class: 'lista-area' }); raiz.appendChild(caixa);
        var por = R.examesPorEncaminhador(m.exames_lista);
        function lista() {
          UI.limpar(caixa);
          var vis = R.buscar(m.encaminhadores_lista, termo, function (x) { return [x.nome, x.telefone, x.tipo]; }).sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'); });
          caixa.appendChild(UI.tabela({
            linhas: vis, vazio: termo ? 'Nenhum encaminhador encontrado.' : 'Nenhum encaminhador cadastrado.',
            vazioTexto: !termo && escreve ? 'Cadastre as clínicas e os veterinários que pedem exames, para saber de quem veio cada pedido.' : '',
            aoClicarLinha: function (x) { escreve ? form(m, x) : ficha(x, por); },
            colunas: [
              { rotulo: 'Nome', render: function (x) { return h('span', null, x.nome, ' ', UI.marcaExemplo(x)); } },
              { rotulo: 'Tipo', render: function (x) { return x.tipo || '-'; } },
              { rotulo: 'Contato', render: function (x) { return x.telefone || x.email || '-'; } },
              { rotulo: 'Exames', classe: 'num', render: function (x) { return String(por[x.id] || 0); } },
              { rotulo: 'Situação', render: function (x) { return x.ativo === false ? UI.chip('Inativo', 'neutro') : UI.chip('Ativo', 'ok'); } }
            ]
          }));
        }
        lista();
      });
    }

    function ficha(x, por) { // quem só consulta (veterinário) vê os dados sem editar
      var linhas = [['Tipo', x.tipo], ['Telefone', x.telefone], ['E-mail', x.email], ['Condições combinadas', x.condicoes], ['Observações', x.obs], ['Exames registrados', String(por[x.id] || 0)]].filter(function (l) { return l[1]; });
      UI.modal({ titulo: x.nome, corpo: h('dl', { class: 'dl-ficha' }, linhas.map(function (l) { return [h('dt', { text: l[0] }), h('dd', { text: String(l[1]) })]; })), acoes: [{ texto: 'Fechar', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); } }] });
    }

    function form(m, x) {
      return UI.abrirFormulario({
        titulo: x ? 'Editar encaminhador' : 'Novo encaminhador', larga: true, valores: x || { ativo: true, tipo: TIPOS[0] },
        aviso: 'Dado de contato de terceiros (LGPD): registre só o necessário para o atendimento.',
        campos: [
          { nome: 'nome', rotulo: 'Nome', requerido: true },
          { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', largura: 'meia', opcoes: TIPOS.map(function (t) { return { valor: t, rotulo: t }; }) },
          { nome: 'telefone', rotulo: 'Telefone (com DDD)', tipo: 'tel', largura: 'meia' },
          { nome: 'email', rotulo: 'E-mail', tipo: 'email', largura: 'meia' },
          { nome: 'condicoes', rotulo: 'Convênio ou condições combinadas', tipo: 'textarea', linhas: 3, ajuda: 'Escreva só o que o centro combinou com este encaminhador. O painel não afirma convênio.' },
          { nome: 'obs', rotulo: 'Observações', tipo: 'textarea', linhas: 2 },
          { nome: 'ativo', rotulo: 'Ativo (aparece nos novos pedidos)', tipo: 'checkbox' }
        ],
        aoExcluir: x && excluir ? function () {
          return ctx.store.listar('exames').then(function (ex) { // lista fresca: outra pessoa pode ter registrado um exame depois que o formulário abriu
            if (ex.some(function (e) { return e && e.encaminhadorId === x.id; })) throw new Error('Há exames deste encaminhador. Em vez de excluir, desmarque "Ativo".');
            return ctx.store.remover('encaminhadores', x.id);
          });
        } : null,
        aoSalvar: function (v) {
          var reg = Object.assign({}, x || {}, v); var erro = R.validarEncaminhador(reg); if (erro) throw new Error(erro);
          return ctx.store.salvar('encaminhadores', reg).then(function () { UI.toast('Encaminhador salvo.'); });
        }
      }).then(function (salvou) { if (salvou) return desenhar(); });
    }

    return desenhar();
  }

  window.Painel.registrar({ id: 'encaminhadores', titulo: 'Encaminhadores', icone: 'encaminhadores', render: render });
})();
