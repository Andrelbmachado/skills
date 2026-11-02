/* Estoque de medicamentos, vacinas e insumos: quantidade, mínimo, validade, lote e histórico de movimentos. */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI, R = window.Regras;
  var PC = (window.SITE_CONFIG && window.SITE_CONFIG.painel) || {};
  var VENDA = PC.venda === true; // subtipo com loja (v0.6): preço de venda por item e "Registrar venda" (baixa no estoque + entrada no caixa)
  var CATEGORIAS = [['medicamento', 'Medicamento'], ['vacina', 'Vacina'], ['insumo', 'Insumo'], ['outro', 'Outro']];
  if (VENDA && Array.isArray(PC.estoqueCategorias)) PC.estoqueCategorias.forEach(function (c) { // categorias do subtipo entram antes de "Outro"; só pares de texto curto
    if (Array.isArray(c) && typeof c[0] === 'string' && /^[a-z][a-z0-9]{0,20}$/.test(c[0]) && typeof c[1] === 'string' && c[1].length <= 40 && !CATEGORIAS.some(function (x) { return x[0] === c[0]; })) CATEGORIAS.splice(CATEGORIAS.length - 1, 0, [c[0], c[1]]);
  });
  var rotuloCat = function (c) { return (CATEGORIAS.find(function (x) { return x[0] === c; }) || [0, c || ''])[1]; };
  var filtro = 'todos', termo = '';
  var FILTROS = [['todos', 'Todos'], ['baixo', 'Estoque baixo'], ['vencendo', 'Vencendo'], ['vencido', 'Vencidos']].concat(VENDA ? [['avenda', 'À venda']] : []);

  function render(raiz, ctx) {
    var escreve = ctx.podeEscrever('estoque');
    var vende = VENDA && ctx.podeEscrever('vendas'); // dono e recepção (a recepção só lê o estoque, mas atende o balcão)

    function desenhar() {
      return Promise.all([ctx.mapa(['estoque', 'movimentos'].concat(VENDA ? ['tutores'] : [])), ctx.config()]).then(function (r) {
        var m = r[0], cfgc = r[1], hoje = ctx.hoje();
        UI.limpar(raiz);
        raiz.appendChild(UI.titulo(ctx.titulo('estoque', 'Estoque'), escreve ? [UI.botao('Novo item', function () { formItem(m, null); }, { icone: 'mais' })] : []));
        var itens = m.estoque_lista.map(function (i) { var st = R.estoqueStatus(i, hoje, cfgc.diasAvisoValidade); st.avenda = !!R.precoDeVenda(i); return { item: i, st: st }; });
        var n = { baixo: itens.filter(function (x) { return x.st.baixo; }).length, vencendo: itens.filter(function (x) { return x.st.vencendo; }).length, vencido: itens.filter(function (x) { return x.st.vencido; }).length, avenda: itens.filter(function (x) { return x.st.avenda; }).length };
        raiz.appendChild(h('div', { class: 'filtros', role: 'group', 'aria-label': 'Filtrar estoque' }, FILTROS.map(function (f) {
          return h('button', { type: 'button', class: 'chip-botao', 'aria-pressed': String(filtro === f[0]), on: { click: function () { filtro = f[0]; desenhar(); } } }, f[1] + (f[0] !== 'todos' ? ' (' + n[f[0]] + ')' : ''));
        })));
        raiz.appendChild(UI.busca('Buscar item por nome ou lote', function (v) { termo = v; lista(); }, termo));
        var area = h('div', { class: 'lista-area' }); raiz.appendChild(area);
        function lista() {
          UI.limpar(area);
          var vis = R.buscar(itens, termo, function (x) { return [x.item.nome, x.item.lote, rotuloCat(x.item.categoria)]; }).filter(function (x) { return filtro === 'todos' || x.st[filtro]; }).sort(function (a, b) { return a.item.nome.localeCompare(b.item.nome); });
          area.appendChild(UI.tabela({
            linhas: vis, vazio: itens.length ? 'Nenhum item neste filtro.' : 'Nenhum item no estoque.', vazioTexto: itens.length ? '' : (escreve ? 'Cadastre medicamentos, vacinas e insumos com "Novo item".' : ''),
            aoClicarLinha: function (x) { detalhe(x.item, m, cfgc); },
            colunas: [
              { rotulo: 'Item', render: function (x) { return h('span', null, x.item.nome, ' ', UI.marcaExemplo(x.item), h('small', { class: 'bloco-sub', text: rotuloCat(x.item.categoria) })); } },
              { rotulo: 'Quantidade', classe: 'num', render: function (x) { return x.item.quantidade + ' ' + (x.item.unidade || ''); } },
              { rotulo: 'Mínimo', classe: 'num', render: function (x) { return x.item.minimo === '' || x.item.minimo == null ? '-' : x.item.minimo; } },
              { rotulo: 'Validade', render: function (x) { return x.item.validade ? UI.fmt.data(x.item.validade) : '-'; } }
            ].concat(VENDA ? [{ rotulo: 'Preço de venda', classe: 'num', render: function (x) { return x.st.avenda ? R.formatBRL(x.item.precoVendaCents) : '-'; } }] : []).concat([
              { rotulo: 'Situação', render: function (x) {
                var c = [];
                if (x.st.zerado) c.push(UI.chip('Zerado', 'perigo')); else if (x.st.baixo) c.push(UI.chip('Estoque baixo', 'aviso'));
                if (x.st.vencido) c.push(UI.chip('Vencido', 'perigo')); else if (x.st.vencendo) c.push(UI.chip('Vence em ' + x.st.diasParaVencer + ' d', 'aviso'));
                return c.length ? c.map(function (e) { return [e, ' ']; }) : UI.chip('Em dia', 'ok');
              } }
            ])
          }));
        }
        lista();
      });
    }

    function detalhe(item, m, cfgc) {
      var st = R.estoqueStatus(item, ctx.hoje(), cfgc.diasAvisoValidade);
      var movs = m.movimentos_lista.filter(function (x) { return x.itemId === item.id; }).sort(function (a, b) { return (a.criadoEm || '') < (b.criadoEm || '') ? 1 : -1; });
      var rot = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste para' };
      var corpo = h('div', null, h('p', null, UI.marcaExemplo(item)),
        h('dl', { class: 'dl-ficha' }, [['Quantidade', item.quantidade + ' ' + (item.unidade || '')], ['Mínimo', item.minimo === '' || item.minimo == null ? '' : String(item.minimo)], ['Lote', item.lote], ['Validade', item.validade ? UI.fmt.data(item.validade) : ''], ['Categoria', rotuloCat(item.categoria)]].concat(VENDA && R.precoDeVenda(item) ? [['Preço de venda', R.formatBRL(item.precoVendaCents)]] : []).filter(function (l) { return l[1]; }).map(function (l) { return [h('dt', { text: l[0] }), h('dd', { text: l[1] })]; })),
        h('h3', { text: 'Movimentos' }),
        movs.length ? h('ul', { class: 'lista-simples-painel' }, movs.slice(0, 12).map(function (x) { return h('li', null, h('strong', { text: UI.fmt.data(x.data) }), ' ' + rot[x.tipo] + ' ' + x.qtd + (x.motivo ? ' · ' + x.motivo : '')); })) : h('p', { class: 'mudo', text: 'Sem movimentos registrados.' }));
      var acoes = [];
      if (vende && R.precoDeVenda(item)) acoes.push({ texto: 'Registrar venda', aoClicar: function (a) { a.fechar(); venda(item, m); } });
      if (escreve) {
        acoes.push({ texto: 'Entrada', aoClicar: function (a) { a.fechar(); movimento(item, 'entrada'); } });
        acoes.push({ texto: 'Saída', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); movimento(item, 'saida'); } });
        acoes.push({ texto: 'Ajustar quantidade', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); movimento(item, 'ajuste'); } });
        acoes.push({ texto: 'Editar item', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); formItem(m, item); } });
      }
      UI.modal({ titulo: item.nome, corpo: corpo, acoes: acoes });
      return st;
    }

    function movimento(item, tipo) {
      var titulos = { entrada: 'Entrada no estoque', saida: 'Saída do estoque', ajuste: 'Ajustar quantidade (contagem)' };
      return UI.abrirFormulario({
        titulo: titulos[tipo] + ': ' + item.nome, valores: { data: ctx.hoje() },
        campos: [
          { nome: 'qtd', rotulo: tipo === 'ajuste' ? 'Quantidade contada' : 'Quantidade', tipo: 'number', requerido: true, min: 0, step: 1, largura: 'meia', ajuda: 'Hoje: ' + item.quantidade + ' ' + (item.unidade || '') },
          { nome: 'data', rotulo: 'Data', tipo: 'date', requerido: true, largura: 'meia' },
          { nome: 'motivo', rotulo: tipo === 'saida' ? 'Motivo (uso, perda, descarte)' : 'Observação' }
        ],
        aoSalvar: function (v) {
          /* v0.6: soma ou tira do saldo ATUAL, não do que a tela mostrava quando abriu (outra aba, ou a recepção vendendo, pode ter mexido: "Entrada +5" dava 15 em vez de 12) */
          return ctx.store.obter('estoque', item.id).then(function (atual) {
            if (!atual) throw new Error('Este item foi removido do estoque.');
            var nova = R.aplicarMovimento(atual.quantidade, { tipo: tipo, qtd: v.qtd }); // erro legível se a saída passa do estoque (o saldo citado é o atual)
            return ctx.store.salvar('estoque', Object.assign({}, atual, { quantidade: nova })).then(function () {
              return ctx.store.salvar('movimentos', { itemId: atual.id, tipo: tipo, qtd: v.qtd, data: v.data, motivo: v.motivo });
            }).then(function () { UI.toast('Estoque atualizado: ' + nova + ' ' + (atual.unidade || '') + '.'); });
          });
        }
      }).then(function (salvou) { if (salvou) return desenhar(); });
    }

    /* Venda no balcão: confere contra o registro ATUAL do item (outra aba pode ter vendido, ajustado o saldo ou mudado o preço depois de o formulário abrir), dá baixa,
       registra a saída no histórico e lança a entrada no caixa. Se o caixa falhar depois da baixa, devolve a quantidade e apaga a saída (nada de estoque que some sem dinheiro). */
    function venda(item, m) {
      return UI.abrirFormulario({
        titulo: 'Registrar venda: ' + item.nome, valores: { data: ctx.hoje(), forma: 'pix', qtd: 1 }, textoSalvar: 'Registrar venda',
        campos: [
          { nome: 'qtd', rotulo: 'Quantidade', tipo: 'number', requerido: true, min: 1, step: 1, largura: 'meia', ajuda: 'Hoje: ' + item.quantidade + ' ' + (item.unidade || '') + ' · preço ' + R.formatBRL(item.precoVendaCents) + ' cada' },
          { nome: 'data', rotulo: 'Data', tipo: 'date', requerido: true, largura: 'meia' },
          { nome: 'forma', rotulo: 'Forma de pagamento', tipo: 'select', requerido: true, largura: 'meia', opcoes: UI.FORMAS.map(function (f) { return { valor: f[0], rotulo: f[1] }; }) },
          { nome: 'tutorId', rotulo: 'Tutor (opcional)', tipo: 'select', largura: 'meia', vazio: 'Sem vínculo', opcoes: m.tutores_lista.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (t) { return { valor: t.id, rotulo: t.nome }; }) },
          { nome: 'valorCents', rotulo: 'Valor cobrado (R$)', tipo: 'money', placeholder: 'em branco: preço × quantidade', ajuda: 'Só preencha se o valor combinado for diferente de preço × quantidade.' }
        ],
        aoSalvar: function (v) {
          var anterior = null, movimento = null, baixou = false;
          return ctx.store.obter('estoque', item.id).then(function (atual) {
            if (!atual) throw new Error('Este item foi removido do estoque.');
            if (!ctx.podeEscrever('vendas')) throw new Error('Seu perfil não registra vendas.');
            /* o formulário mostra o preço de quando abriu; se mudou, quem vende vê de novo antes de cobrar um valor que não esperava (com "Valor cobrado" preenchido o preço não conta) */
            if (v.valorCents == null && R.precoDeVenda(atual) !== R.precoDeVenda(item)) throw new Error('O preço deste item mudou' + (R.precoDeVenda(atual) ? ' (agora ' + R.formatBRL(atual.precoVendaCents) + ')' : ' (agora sem preço de venda)') + '. Feche esta janela e abra a venda de novo.');
            var venda = R.calcularVenda(atual, v.qtd, v.valorCents, ctx.hoje()); // lança Error legível: sem preço, vencido, quantidade inválida, acima do saldo, valor inválido
            var marca = atual.exemplo === true ? { exemplo: true } : {}; // vender um item de exemplo não deixa lançamento "real" depois de remover os exemplos
            anterior = atual;
            return ctx.store.salvar('estoque', Object.assign({}, atual, { quantidade: venda.novaQuantidade })).then(function () {
              baixou = true;
              return ctx.store.salvar('movimentos', Object.assign({ itemId: atual.id, tipo: 'saida', qtd: venda.qtd, data: v.data, motivo: 'Venda no balcão' }, marca));
            }).then(function (mov) {
              movimento = mov;
              return ctx.store.salvar('lancamentos', Object.assign({ tipo: 'entrada', data: v.data, descricao: R.descricaoDaVenda(atual, venda.qtd, v.valorCents), valorCents: venda.valorCents, forma: v.forma, categoria: 'Venda de produtos', tutorId: v.tutorId || '', itemId: atual.id }, marca));
            }).then(function () { UI.toast('Venda registrada: ' + R.formatBRL(venda.valorCents) + '. Estoque: ' + venda.novaQuantidade + ' ' + (atual.unidade || '') + '.'); }, function (erro) {
              if (!baixou) throw erro; // falhou antes de baixar: nada mudou
              /* falhou DEPOIS da baixa (na saída do histórico ou no caixa): devolve a quantidade e apaga a saída, em qualquer um dos dois casos (melhor esforço) */
              return ctx.store.salvar('estoque', anterior).then(function () { return movimento ? ctx.store.remover('movimentos', movimento.id) : null; })
                .then(function () { throw new Error('A venda não foi registrada e a baixa do estoque foi desfeita: ' + (erro && erro.message || erro)); },
                  function () { throw new Error('A venda ficou pela metade (' + (erro && erro.message || erro) + '). Confira a quantidade do item e o caixa.'); });
            });
          });
        }
      }).then(function (salvou) { if (salvou) return desenhar(); });
    }

    function formItem(m, item) {
      return UI.abrirFormulario({
        titulo: item ? 'Editar item' : 'Novo item', valores: item || { categoria: 'medicamento', unidade: 'unidade' }, larga: true,
        campos: [
          { nome: 'nome', rotulo: 'Nome', requerido: true },
          { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', requerido: true, largura: 'meia', opcoes: CATEGORIAS.map(function (c) { return { valor: c[0], rotulo: c[1] }; }) },
          { nome: 'unidade', rotulo: 'Unidade', largura: 'meia', placeholder: 'dose, frasco, comprimido...' },
          { nome: 'quantidade', rotulo: item ? 'Quantidade atual' : 'Quantidade inicial', tipo: 'number', requerido: true, min: 0, step: 1, largura: 'terco', ajuda: item ? 'Se mudar aqui, o histórico registra um ajuste de quantidade. Para entradas e saídas do dia a dia, use os botões do item.' : '' },
          { nome: 'minimo', rotulo: 'Mínimo (alerta)', tipo: 'number', min: 0, step: 1, largura: 'terco' },
          { nome: 'lote', rotulo: 'Lote', largura: 'terco' },
          { nome: 'validade', rotulo: 'Validade', tipo: 'date', largura: 'meia' }
        ].concat(VENDA ? [{ nome: 'precoVendaCents', rotulo: 'Preço de venda (R$)', tipo: 'money', largura: 'meia', placeholder: '0,00', ajuda: 'Deixe em branco se o item não é vendido no balcão.' }] : []),
        aoExcluir: item && ctx.podeExcluir('estoque') ? function () { return ctx.store.remover('estoque', item.id); } : null,
        aoSalvar: function (v) {
          if (VENDA && v.precoVendaCents != null && !(v.precoVendaCents > 0)) throw new Error('O preço de venda precisa ser maior que zero (ou fique em branco).');
          /* v0.6: a edição parte do registro ATUAL e só leva por cima o que a pessoa mudou nesta janela (antes o formulário inteiro, com o saldo de quando abriu,
             apagava a venda feita em outra aba: "Editar item" só para mudar o preço devolvia o saldo antigo) */
          return (item ? ctx.store.obter('estoque', item.id) : Promise.resolve({})).then(function (atual) {
            if (!atual) throw new Error('Este item foi removido do estoque.');
            var mudou = {};
            Object.keys(v).forEach(function (k) {
              if (!item) { mudou[k] = v[k]; return; }
              if ((item[k] == null ? '' : String(item[k])) !== (v[k] == null ? '' : String(v[k]))) mudou[k] = v[k];
            });
            var mudouQtd = !!item && Object.prototype.hasOwnProperty.call(mudou, 'quantidade');
            if (mudouQtd) {
              if (Number(atual.quantidade) !== Number(item.quantidade)) throw new Error('A quantidade deste item mudou em outra tela (agora ' + atual.quantidade + '). Feche, abra o item de novo e confira antes de corrigir.');
              R.aplicarMovimento(atual.quantidade, { tipo: 'ajuste', qtd: v.quantidade }); // valida (não aceita quantidade negativa ou vazia)
            }
            return ctx.store.salvar('estoque', Object.assign({}, atual, mudou)).then(function (salvo) {
              // mudar a quantidade pela edição do cadastro também fica no histórico (sem movimento, o saldo "aparecia" do nada)
              if (mudouQtd) return ctx.store.salvar('movimentos', { itemId: salvo.id, tipo: 'ajuste', qtd: Number(v.quantidade), data: ctx.hoje(), motivo: 'Quantidade corrigida na edição do item (era ' + atual.quantidade + ')' });
            }).then(function () { UI.toast(item ? 'Item atualizado.' : 'Item cadastrado.'); });
          });
        }
      }).then(function (salvou) { if (salvou) return desenhar(); });
    }

    return desenhar();
  }

  window.Painel.registrar({ id: 'estoque', titulo: 'Estoque', icone: 'estoque', render: render });
})();
