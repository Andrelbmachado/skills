/* ui.js: peças de interface do painel (DOM puro, sem framework). Texto sempre entra como texto (nunca innerHTML). */
(function () {
  'use strict';
  var R = window.Regras;
  var UI = window.UI = {};
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- DOM ---------- */
  UI.h = function h(tag, attrs) {
    var el = document.createElement(tag), filhos = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
      else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled' || k === 'hidden') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    (function anexa(lista) {
      lista.forEach(function (f) {
        if (f == null || f === false) return;
        if (Array.isArray(f)) anexa(f);
        else el.appendChild(f.nodeType ? f : document.createTextNode(String(f)));
      });
    })(filhos);
    return el;
  };
  var h = UI.h;
  UI.limpar = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  var ICONES = {
    inicio: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    agenda: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M8 17h2',
    tutores: 'M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zM3 20c0-3.3 2.7-6 6-6s6 2.700 6 6M17 10.500a2.600 2.600 0 1 0 0-5.200M17.500 14c2.200.4 3.500 2.200 3.500 5',
    prontuarios: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
    vacinas: 'M15 4l5 5M13 6l5 5M16.500 2.500l5 5M12 8l4 4-8 8H4v-4zM3 21l3-3',
    caixa: 'M3 7h18v12H3zM3 11h18M7 15h3',
    estoque: 'M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9',
    equipe: 'M5 4h14v16H5zM12 11a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5zM7.500 17c.5-2 2.200-3 4.500-3s4 1 4.500 3',
    config: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
    sair: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
    menu: 'M4 7h16M4 12h16M4 17h16',
    mais: 'M12 5v14M5 12h14',
    pata: 'M12 12.500c-2.500 0-5 2.700-5 5 0 2 1.600 3 3.300 2.700.6-.1 1.200-.3 1.700-.3s1.100.2 1.700.3c1.700.3 3.300-.7 3.300-2.700 0-2.300-2.500-5-5-5zM5.500 10.500a1.800 2.500 0 1 0 0-.1zM9.500 6.500a1.800 2.600 0 1 0 0-.1zM14.500 6.500a1.800 2.600 0 1 0 0-.1zM18.500 10.500a1.800 2.500 0 1 0 0-.1z',
    pena: 'M5 19C4 10 10 5 19 4C20 12 14 18 5 19zM5 19L16 8',
    internacao: 'M3 19V6M3 14h18v5M21 14v-2.500a2.500 2.500 0 0 0-2.500-2.500H11v5M7 12.500a1.500 1.500 0 1 0 0-.1',
    cruz: 'M9.500 3h5v6.500H21v5h-6.500V21h-5v-6.500H3v-5h6.500z',
    exames: 'M4 3h16v18H4zM4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4M10 8h4v8h-4z',
    encaminhadores: 'M9 11a3.200 3.200 0 1 0 0-6.400A3.200 3.200 0 0 0 9 11zM3 20c0-3.300 2.700-6 6-6M14 16h7M18 12l3 4-3 4',
    etiqueta: 'M3 12V4h8l10 10-8 8zM7.500 8.500a.8.8 0 1 0 0 .01',
    dupla: 'M2 12a6.500 6.500 0 1 0 13 0 6.500 6.500 0 1 0-13 0zM9 12a6.500 6.500 0 1 0 13 0 6.500 6.500 0 1 0-13 0z',
    letreiro: 'M3 5h18v10H3zM7 15v5M17 15v5M7 9h10M7 12h6',
    numero: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM6.500 12h.01M17.500 12h.01M10 9v6M12 9v6M14 9v6',
    pilares: 'M12 3L21 8H3zM6 11v8M12 11v8M18 11v8M3 21h18',
    registro: 'M5 3h14v18H5zM8.500 3v18M12 12h4.500M12 16h4.500M13 1.500h3.500V8L14.750 6.500 13 8z',
    mira: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 1v8M12 15v8M1 12h8M15 12h8',
    whats: 'M4 20l1.300-4.200A8 8 0 1 1 8.300 19zM9 9.500c.3 2.500 2.500 4.700 5.500 5.500l1.200-1.300-1.800-1-.8.800c-1-.4-1.900-1.300-2.300-2.300l.8-.8-1-1.800z'
  };
  /* ícone da marca: SITE_CONFIG.painel.marca ('pata' padrão, 'pena' no tema terrário, 'cruz', 'mira', 'etiqueta' no tema gôndola, 'dupla' no tema dupla, 'letreiro' no tema letreiro) */
  UI.iconeMarca = function (tam) {
    var cfg = window.SITE_CONFIG || {}, nome = cfg.painel && cfg.painel.marca;
    return UI.icone(ICONES[nome] ? nome : 'pata', tam);
  };
  UI.icone = function (nome, tam) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', tam || 20); s.setAttribute('height', tam || 20);
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    var p = document.createElementNS(NS, 'path'); p.setAttribute('d', ICONES[nome] || ICONES.pata); s.appendChild(p);
    return s;
  };

  /* ---------- formatação ---------- */
  UI.fmt = {
    data: R.dataBR,
    hora: function (dt) { return dt ? dt.slice(11, 16) : ''; },
    dataHora: function (dt) { return dt ? R.dataBR(dt) + ' ' + dt.slice(11, 16) : ''; },
    brl: R.formatBRL,
    diaSemana: function (iso) { return ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][R.diaDaSemana(iso)]; },
    diaCurto: function (iso) { return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][R.diaDaSemana(iso)]; },
    forma: function (f) { return ({ dinheiro: 'Dinheiro', pix: 'Pix', cartao_debito: 'Cartão de débito', cartao_credito: 'Cartão de crédito', outro: 'Outro' })[f] || f || ''; },
    quando: function (st) {
      if (st.codigo === 'vencido') return 'Vencido há ' + Math.abs(st.dias) + (Math.abs(st.dias) === 1 ? ' dia' : ' dias');
      if (st.codigo === 'hoje') return 'Hoje';
      return 'Em ' + st.dias + (st.dias === 1 ? ' dia' : ' dias');
    }
  };
  UI.FORMAS = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['cartao_debito', 'Cartão de débito'], ['cartao_credito', 'Cartão de crédito'], ['outro', 'Outro']];

  /* ---------- pequenos componentes ---------- */
  UI.chip = function (texto, tom) { return h('span', { class: 'chip chip-' + (tom || 'neutro'), text: texto }); };
  UI.marcaExemplo = function (item) { return item && item.exemplo ? h('span', { class: 'chip chip-exemplo', title: 'Registro fictício de demonstração' }, 'Exemplo') : null; };
  UI.vazio = function (titulo, texto, acao) {
    return h('div', { class: 'vazio' }, h('strong', { text: titulo }), texto ? h('p', { text: texto }) : null, acao || null);
  };
  UI.botao = function (texto, aoClicar, opc) {
    opc = opc || {};
    return h('button', { type: opc.tipo || 'button', class: 'btn' + (opc.classe ? ' ' + opc.classe : ''), disabled: opc.desabilitado, 'aria-label': opc.aria, on: aoClicar ? { click: aoClicar } : null },
      opc.icone ? UI.icone(opc.icone, 18) : null, texto);
  };
  UI.titulo = function (texto, acoes) {
    return h('div', { class: 'tela-titulo' }, h('h1', { tabindex: '-1', id: 'titulo-tela', text: texto }), acoes && acoes.length ? h('div', { class: 'tela-acoes' }, acoes) : null);
  };
  /* Abas acessíveis: tablist + tab (setas, Home e End; só a aba ativa entra na ordem de Tab) + tabpanel (UI.painelAba) ligados por id/aria-controls. */
  UI.abas = function (lista, ativo, aoTrocar) {
    function trocar(id) {
      aoTrocar(id);
      var tentativas = 0; // a tela se redesenha de forma assíncrona: devolve o foco à aba nova quando ela existir
      (function focar() { var el = document.getElementById('aba-' + id); if (el && el.getAttribute('aria-selected') === 'true') el.focus(); else if (tentativas++ < 40) setTimeout(focar, 25); })();
    }
    return h('div', { class: 'abas', role: 'tablist', on: { keydown: function (e) {
      var i = lista.findIndex(function (a) { return a.id === ativo; }), n = lista.length, novo = -1;
      if (e.key === 'ArrowRight') novo = (i + 1) % n; else if (e.key === 'ArrowLeft') novo = (i - 1 + n) % n; else if (e.key === 'Home') novo = 0; else if (e.key === 'End') novo = n - 1;
      if (novo < 0) return; e.preventDefault(); trocar(lista[novo].id);
    } } }, lista.map(function (a) {
      var sel = a.id === ativo;
      return h('button', { type: 'button', role: 'tab', class: 'aba', id: 'aba-' + a.id, 'aria-selected': String(sel), 'aria-controls': 'painel-abas', tabindex: sel ? '0' : '-1', on: { click: function () { trocar(a.id); } } }, a.rotulo); // a tela se redesenha: o foco volta à aba nova (antes só as setas faziam isso e o clique deixava o foco no body)
    }));
  };
  UI.painelAba = function (ativo) { return h('div', { class: 'painel-abas', id: 'painel-abas', role: 'tabpanel', 'aria-labelledby': 'aba-' + ativo }); };
  UI.busca = function (placeholder, aoMudar, valor) {
    var t = null;
    return h('input', { type: 'search', class: 'busca', placeholder: placeholder, 'aria-label': placeholder, value: valor || '', on: { input: function (e) {
      clearTimeout(t); var v = e.target.value; t = setTimeout(function () { aoMudar(v); }, 120);
    } } });
  };
  UI.tabela = function (o) {
    if (!o.linhas.length) return UI.vazio(o.vazio || 'Nada por aqui ainda.', o.vazioTexto, o.vazioAcao);
    var tb = h('tbody');
    o.linhas.forEach(function (l, idx) {
      var tr = h('tr', o.aoClicarLinha ? { class: 'clicavel', on: { click: function (e) { if (!e.target.closest('a,button,input,select')) o.aoClicarLinha(l); } } } : {});
      o.colunas.forEach(function (c, ci) {
        var conteudo = c.render(l, idx);
        if (ci === 0 && o.aoClicarLinha) conteudo = h('button', { type: 'button', class: 'link-linha', 'aria-label': o.rotuloLinha ? o.rotuloLinha(l) : null, on: { click: function () { o.aoClicarLinha(l); } } }, conteudo);
        tr.appendChild(h('td', { 'data-rotulo': c.rotulo, class: c.classe || '' }, conteudo));
      });
      tb.appendChild(tr);
    });
    return h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' },
      h('thead', null, h('tr', null, o.colunas.map(function (c) { return h('th', { scope: 'col', class: c.classe || '', text: c.rotulo }); }))), tb));
  };

  /* ---------- avisos ---------- */
  var regiao = null;
  /* <dialog> aberto com showModal() fica na "camada superior" do navegador e cobre qualquer z-index: o aviso entra DENTRO do diálogo aberto
     (senão uma mensagem de validação ficaria atrás do fundo escurecido). Fechado o diálogo, a região volta para o body. */
  UI.toast = function (msg, tom) {
    if (!regiao) regiao = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    var abertos = document.querySelectorAll('dialog[open]'), anfitriao = abertos.length ? abertos[abertos.length - 1] : document.body;
    if (regiao.parentNode !== anfitriao) anfitriao.appendChild(regiao);
    var t = h('div', { class: 'toast toast-' + (tom || 'ok'), text: msg }); regiao.appendChild(t);
    setTimeout(function () { t.remove(); }, tom === 'erro' ? 7000 : 3500);
  };

  /* ---------- diálogos (<dialog> nativo: foco preso e ESC de graça) ---------- */
  UI.modal = function (o) {
    var anterior = document.activeElement === document.body ? null : document.activeElement, tid = 'dlg-titulo-' + Math.random().toString(36).slice(2, 8);
    var corpo = h('div', { class: 'modal-corpo' }, o.corpo);
    var rodape = h('div', { class: 'modal-rodape' }, (o.acoes || []).map(function (a) {
      return h('button', { type: 'button', class: 'btn ' + (a.classe || ''), on: { click: function () { a.aoClicar(api); } } }, a.texto);
    }));
    var dlg = h('dialog', { class: 'modal' + (o.larga ? ' modal-larga' : ''), 'aria-labelledby': tid },
      h('div', { class: 'modal-topo' }, h('h2', { id: tid, text: o.titulo }),
        h('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Fechar', on: { click: function () { api.fechar(); } } }, '×')),
      corpo, (o.acoes || []).length ? rodape : null);
    var api = { el: dlg, corpo: corpo, fechar: function (r) { api.resultado = r; if (dlg.open) dlg.close(); } };
    api.aoFechar = new Promise(function (res) {
      dlg.addEventListener('close', function () {
        if (regiao && dlg.contains(regiao)) document.body.appendChild(regiao); // não leva os avisos embora junto com o diálogo
        dlg.remove();
        if (anterior && anterior.focus && document.contains(anterior)) anterior.focus();
        else { var titulo = document.getElementById('titulo-tela'); if (titulo && titulo.focus) titulo.focus({ preventScroll: true }); } // a tela foi redesenhada e o botão que abriu o diálogo não existe mais: o foco vai para o título (não para o fim do documento)
        res(api.resultado); });
    });
    document.body.appendChild(dlg); dlg.showModal();
    return api;
  };
  UI.confirmar = function (msg, o) {
    o = o || {};
    return new Promise(function (res) {
      var m = UI.modal({ titulo: o.titulo || 'Confirmar', corpo: h('p', { text: msg }), acoes: [
        { texto: 'Cancelar', classe: 'btn-sec', aoClicar: function (a) { a.fechar(false); } },
        { texto: o.ok || 'Confirmar', classe: o.perigo ? 'btn-perigo' : '', aoClicar: function (a) { a.fechar(true); } }] });
      m.aoFechar.then(function (r) { res(!!r); });
    });
  };

  /* ---------- formulários ---------- */
  UI.campo = function (def, valor) {
    var id = 'c-' + def.nome + '-' + Math.random().toString(36).slice(2, 6), input, tipo = def.tipo || 'text';
    var comum = { id: id, name: def.nome, required: !!def.requerido, placeholder: def.placeholder, disabled: !!def.somenteLeitura, 'aria-describedby': def.ajuda ? id + '-aj' : null };
    if (tipo === 'textarea') input = h('textarea', Object.assign({ rows: def.linhas || 3 }, comum), valor == null ? '' : String(valor));
    else if (tipo === 'select') {
      input = h('select', comum, h('option', { value: '' }, def.vazio || 'Selecione'),
        (def.opcoes || []).map(function (o) { return h('option', { value: o.valor, selected: String(o.valor) === String(valor == null ? '' : valor) }, o.rotulo); }));
    } else if (tipo === 'checkbox') {
      input = h('input', Object.assign({ type: 'checkbox', checked: !!valor }, comum));
    } else if (tipo === 'money') {
      input = h('input', Object.assign({ type: 'text', inputmode: 'decimal', autocomplete: 'off', value: valor == null || valor === '' ? '' : (valor / 100).toFixed(2).replace('.', ',') }, comum));
    } else {
      input = h('input', Object.assign({ type: tipo, value: valor == null ? '' : valor, min: def.min, max: def.max, step: def.step, autocomplete: def.autocomplete || 'off',
        list: def.lista ? id + '-lista' : null, minlength: def.minimo }, comum));
    }
    var lista = def.lista ? h('datalist', { id: id + '-lista' }, def.lista.map(function (v) { return h('option', { value: v }); })) : null;
    if (def.aoMudar) input.addEventListener('change', function () { def.aoMudar(input.value, input); });
    var el = tipo === 'checkbox'
      ? h('div', { class: 'campo campo-check ' + (def.largura === 'meia' ? 'meia' : '') }, h('label', null, input, ' ' + def.rotulo), def.ajuda ? h('small', { id: id + '-aj', text: def.ajuda }) : null)
      : h('div', { class: 'campo ' + (def.largura === 'meia' ? 'meia' : def.largura === 'terco' ? 'terco' : '') }, h('label', { for: id, text: def.rotulo + (def.requerido ? ' *' : '') }), input, lista, def.ajuda ? h('small', { id: id + '-aj', text: def.ajuda }) : null);
    return { el: el, input: input, def: def };
  };
  UI.valorDe = function (c) {
    var t = c.def.tipo || 'text', i = c.input;
    if (t === 'checkbox') return i.checked;
    if (t === 'money') { if (!i.value.trim()) return null; var v = R.parseBRL(i.value); return isNaN(v) ? NaN : v; }
    if (t === 'number') return i.value === '' ? null : Number(i.value);
    return typeof i.value === 'string' ? i.value.trim() : i.value;
  };
  UI.formulario = function (campos, valores) {
    valores = valores || {};
    var cs = campos.map(function (d) { return UI.campo(d, valores[d.nome]); });
    var el = h('div', { class: 'grade-campos' }, cs.map(function (c) { return c.el; }));
    return {
      el: el, campos: cs,
      campo: function (nome) { return cs.find(function (c) { return c.def.nome === nome; }); },
      valores: function () { var o = {}; cs.forEach(function (c) { o[c.def.nome] = UI.valorDe(c); }); return o; },
      invalido: function () { // devolve a mensagem do primeiro dinheiro mal digitado
        var ruim = cs.find(function (c) { return c.def.tipo === 'money' && c.input.value.trim() && isNaN(R.parseBRL(c.input.value)); });
        return ruim ? 'Valor inválido em "' + ruim.def.rotulo + '". Use o formato 12,50.' : null;
      }
    };
  };
  /* abrirFormulario({titulo, campos, valores, aoSalvar(valores)->Promise, aoExcluir, textoSalvar, extras:[{texto, aoClicar(valores, api)}], aviso}) -> Promise<salvou?> */
  UI.abrirFormulario = function (o) {
    var f = UI.formulario(o.campos, o.valores);
    var erro = h('div', { class: 'erro-form', role: 'alert', hidden: true });
    var form = h('form', { novalidate: false }, o.aviso ? h('p', { class: 'aviso-form', text: o.aviso }) : null, f.el, o.extraCorpo || null, erro);
    var ocupado = false;
    function mostrarErro(msg) { erro.textContent = msg; erro.hidden = !msg; }
    function salvar(api) {
      if (ocupado) return;
      mostrarErro('');
      if (!form.reportValidity()) return;
      var inv = f.invalido(); if (inv) return mostrarErro(inv);
      ocupado = true;
      Promise.resolve().then(function () { return o.aoSalvar(f.valores(), api); }).then(function (r) { if (r !== false) api.fechar(true); }, function (e) { mostrarErro(e.message || String(e)); })
        .then(function () { ocupado = false; });
    }
    var acoes = [{ texto: 'Cancelar', classe: 'btn-sec', aoClicar: function (a) { a.fechar(false); } }];
    (o.extras || []).forEach(function (x) { acoes.push({ texto: x.texto, classe: 'btn-sec', aoClicar: function (a) { x.aoClicar(f.valores(), a); } }); });
    if (o.aoExcluir) acoes.push({ texto: 'Excluir', classe: 'btn-perigo', aoClicar: function (a) {
      UI.confirmar(o.confirmaExcluir || 'Excluir este registro? Não dá para desfazer.', { ok: 'Excluir', perigo: true }).then(function (sim) {
        if (!sim) return; Promise.resolve(o.aoExcluir()).then(function () { a.fechar(true); }, function (e) { mostrarErro(e.message || String(e)); });
      });
    } });
    acoes.push({ texto: o.textoSalvar || 'Salvar', aoClicar: salvar });
    var m = UI.modal({ titulo: o.titulo, corpo: form, acoes: acoes, larga: o.larga });
    form.addEventListener('submit', function (e) { e.preventDefault(); salvar(m); });
    var primeiro = form.querySelector('input:not([disabled]),select,textarea'); if (primeiro && !o.semFoco) primeiro.focus();
    m.formulario = f;
    if (o.aoAbrir) o.aoAbrir(m, f);
    return m.aoFechar.then(function (r) { return !!r; });
  };

  /* ---------- arquivos e impressão ---------- */
  UI.baixar = function (nome, conteudo, mime) {
    var a = h('a', { href: URL.createObjectURL(new Blob([conteudo], { type: mime || 'text/plain;charset=utf-8' })), download: nome });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  UI.imprimir = function (no) {
    var area = document.getElementById('area-impressao');
    if (!area) { area = h('div', { id: 'area-impressao' }); document.body.appendChild(area); }
    UI.limpar(area).appendChild(no);
    document.body.classList.add('imprimindo');
    setTimeout(function () { window.print(); document.body.classList.remove('imprimindo'); UI.limpar(area); }, 50);
  };
  UI.lerArquivoTexto = function (file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(new Error('Não foi possível ler o arquivo.')); }; r.readAsText(file); });
  };
})();
