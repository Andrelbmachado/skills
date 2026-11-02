/* app.js: casca do painel (sessão, menu por perfil, rotas por hash) e o objeto `ctx` entregue a cada módulo.
   Um módulo é { id, titulo, icone, render(raiz, ctx) } registrado com Painel.registrar(). Rotas: #/agenda?pet=ID */
(function () {
  'use strict';
  var R = window.Regras, UI = window.UI, h = UI.h, Auth = window.Auth, Seed = window.Seed;
  var cfg = window.SITE_CONFIG || {}, neg = cfg.negocio || {}, slug = neg.slug || 'site';
  var temVitrine = !(cfg.modules && cfg.modules.vitrine === false); // pacote ESSENCIAL: sem vitrine, sem links para o site público

  var Painel = window.Painel = {
    modulos: {}, ordem: [],
    registrar: function (m) { Painel.modulos[m.id] = m; Painel.ordem.push(m.id); }
  };

  var MODELO_LEMBRETE = 'Olá, {tutor}! Aqui é da {clinica}. Passando para lembrar: {motivo} de {pet}, previsto para {data}. Se já resolveu, pode desconsiderar esta mensagem.';
  var PADRAO_CONFIG = { id: 'clinica', nome: neg.nome || '', telefone: neg.telefone || '', whatsapp: neg.whatsapp || '', endereco: neg.endereco || '',
    aberturaAgenda: '08:00', fechamentoAgenda: '18:00', passoAgenda: 30, duracaoPadrao: 30, diasAvisoValidade: 30, modeloLembrete: MODELO_LEMBRETE };

  var temModulo = function (id) { return Object.prototype.hasOwnProperty.call(Painel.modulos, id); }; // "constructor" e "__proto__" na URL não são telas
  /* título da tela: o do subtipo (`titulos`) vence; senão o do módulo, que pode variar por perfil (`tituloPara`: a recepção vê "Leitos" onde a equipe vê "Internação e plantão") */
  function tituloDe(id, perfil) {
    var m = Painel.modulos[id], padrao = m.titulo, p = typeof m.tituloPara === 'function' ? m.tituloPara(perfil) : null;
    return R.tituloDaTela(id, typeof p === 'string' && p ? p : padrao);
  }

  Painel.iniciar = function () {
    R.configurarModulos(cfg.painel); // telas e permissões do subtipo (hospital: internação); sem configuração, as 9 telas da clínica geral
    var raiz = document.getElementById('raiz'), store = window.Store.criarPadrao(slug, cfg.painel && cfg.painel.armazenamento, cfg.painel && cfg.painel.colecoesExtras);
    var sessao = Auth.sessaoAtual(sessionStorage, slug);
    if (!sessao) { location.replace('index.html'); return; }

    store.obter('usuarios', sessao.uid).then(function (usuario) {
      if (!usuario || usuario.ativo === false || usuario.trocarSenha) { Auth.encerrarSessao(sessionStorage, slug); location.replace('index.html'); return; }
      montar(raiz, store, usuario);
    });
  };

  function montar(raiz, store, usuario) {
    var perfil = usuario.perfil, tela = h('main', { id: 'tela', class: 'tela', tabindex: '-1' }), banner = h('div', { class: 'banner-exemplo', hidden: true });
    var ctx = {
      store: store, usuario: usuario, perfil: perfil, slug: slug, cfg: cfg, subtipo: (cfg.painel && cfg.painel.subtipo) || 'geral', R: R, UI: UI, Seed: Seed, Auth: Auth, params: {}, tela: tela,
      hoje: function () { return R.hojeISO(); },
      titulo: function (id, padrao) { return R.tituloDaTela(id, padrao); }, // o subtipo pode renomear telas (ex.: Agenda -> Agenda de exames)
      pode: function (m) { return R.permissao(perfil, m); },
      podeEscrever: function (m) { return R.podeEscrever(perfil, m); },
      podeExcluir: function (m) { return R.podeExcluir(perfil, m); },
      navegar: function (rota, params) {
        var q = Object.keys(params || {}).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
        location.hash = '#/' + rota + (q ? '?' + q : '');
      },
      config: function () { return store.obter('config', 'clinica').then(function (c) { return Object.assign({}, PADRAO_CONFIG, c || {}); }); },
      salvarConfig: function (c) { return store.salvar('config', Object.assign({}, c, { id: 'clinica' })); },
      /* lê várias coleções de uma vez; coleção que o subtipo não tem (ex.: internações numa clínica geral) vem vazia em vez de dar erro no IndexedDB */
      mapa: function (cols) {
        return Promise.all(cols.map(function (c) { return store.tem(c) ? store.listar(c) : Promise.resolve([]); })).then(function (ls) {
          /* mapas por id SEM protótipo: um id como "toString" ou "constructor" não pode devolver função herdada do Object quando uma tela procura o pet ou o tutor */
          var o = {}; cols.forEach(function (c, i) { o[c] = Object.create(null); ls[i].forEach(function (x) { o[c][x.id] = x; }); o[c + '_lista'] = ls[i]; }); return o;
        });
      },
      rotuloPet: function (pet, tutores) { var t = tutores && tutores[pet.tutorId]; return pet.nome + (t ? ' (' + t.nome + ')' : ''); },
      /* reescreve o hash com os parâmetros que sobraram em ctx.params (sem disparar a rota): quem consome um atalho (?ver=, ?exame=, ?novo=) o apaga daqui, senão
         qualquer novo desenho da tela (Remover dados de exemplo, F5) repetiria a ação */
      limparRota: function () {
        var q = Object.keys(ctx.params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(ctx.params[k]); }).join('&');
        try { history.replaceState(null, '', location.pathname + location.search + '#/' + ctx.rota + (q ? '?' + q : '')); } catch (e) { /* sem history: o atalho só repete num novo desenho */ }
      },
      atualizar: function () { return rotear(); },
      atualizarBanner: function () { return atualizarBanner(); }
    };
    Painel.ctx = ctx;

    var lateral = h('aside', { class: 'lateral', id: 'lateral', 'aria-label': 'Menu da gestão' });
    var shell = h('div', { class: 'shell' });
    var fundo = h('div', { class: 'fundo-menu', on: { click: function () { fecharMenu(); } } });
    /* No celular o menu é uma gaveta: fechado, não pode receber foco (CSS visibility + inert); Esc fecha e devolve o foco ao botão. */
    var celular = window.matchMedia ? window.matchMedia('(max-width: 860px)') : { matches: false };
    function sincronizarMenu() { lateral.inert = !!celular.matches && !shell.classList.contains('menu-aberto'); }
    function abrirMenu() {
      shell.classList.add('menu-aberto'); botaoMenu.setAttribute('aria-expanded', 'true'); sincronizarMenu();
      var primeiro = lateral.querySelector('nav a'); if (primeiro) primeiro.focus();
    }
    function fecharMenu() {
      var tinhaFoco = lateral.contains(document.activeElement);
      shell.classList.remove('menu-aberto'); botaoMenu.setAttribute('aria-expanded', 'false'); sincronizarMenu();
      if (tinhaFoco && celular.matches) botaoMenu.focus();
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && shell.classList.contains('menu-aberto') && !document.querySelector('dialog[open]')) fecharMenu(); });
    if (celular.addEventListener) celular.addEventListener('change', sincronizarMenu);
    window.addEventListener('resize', sincronizarMenu); // reforço: nem todo navegador avisa a mudança de largura pelo matchMedia na hora
    var botaoMenu = h('button', { type: 'button', class: 'btn-icone btn-menu', 'aria-label': 'Abrir menu', 'aria-expanded': 'false', 'aria-controls': 'lateral',
      on: { click: function () { shell.classList.contains('menu-aberto') ? fecharMenu() : abrirMenu(); } } }, UI.icone('menu', 24));

    var itens = R.modulosDoPerfil(perfil).filter(temModulo);
    var nav = h('nav', { 'aria-label': 'Telas' }, h('ul', null, itens.map(function (id) {
      var m = Painel.modulos[id];
      return h('li', null, h('a', { href: '#/' + id, 'data-rota': id, on: { click: fecharMenu } }, UI.icone(m.icone || id, 20), h('span', { text: tituloDe(id, perfil) })));
    })));
    lateral.appendChild(h('div', { class: 'lateral-marca' }, UI.iconeMarca(28), h('div', null, h('strong', { text: neg.nome || 'Clínica' }), h('small', { text: 'Gestão' }))));
    lateral.appendChild(nav);
    lateral.appendChild(h('div', { class: 'lateral-usuario' },
      h('div', null, h('strong', { text: usuario.nome }), h('small', { text: R.PERFIS[perfil] || perfil })),
      temVitrine ? h('a', { class: 'link-claro', href: '../index.html', target: '_blank', rel: 'noopener', text: 'Ver o site' }) : null,
      h('button', { type: 'button', class: 'btn btn-sec btn-sair', on: { click: function () { Auth.encerrarSessao(sessionStorage, slug); location.href = 'index.html'; } } }, UI.icone('sair', 18), 'Sair')));

    var topo = h('header', { class: 'topo-app' }, botaoMenu, h('span', { class: 'topo-marca', text: neg.nome || 'Gestão' }));
    shell.appendChild(topo); shell.appendChild(lateral); shell.appendChild(fundo);
    shell.appendChild(h('div', { class: 'conteudo' }, banner, tela));
    UI.limpar(raiz).appendChild(shell);
    sincronizarMenu();
    if (store.aviso) UI.toast(store.aviso, 'erro');

    function atualizarBanner() {
      return Seed.temExemplo(store).then(function (tem) {
        UI.limpar(banner); banner.hidden = !tem;
        if (!tem) return;
        banner.appendChild(h('span', { text: 'Há dados de exemplo (fictícios) carregados. Nada aqui representa pessoas ou animais reais.' }));
        if (perfil === 'dono') banner.appendChild(UI.botao('Remover dados de exemplo', function () {
          UI.confirmar('Remover todos os registros de exemplo? Os dados que você cadastrou ficam.', { ok: 'Remover', perigo: true }).then(function (sim) {
            if (!sim) return; Seed.remover(store).then(function (n) { UI.toast(n + ' registros de exemplo removidos.'); return rotear(); });
          });
        }, { classe: 'btn-sec btn-peq' }));
      });
    }

    function parseHash() {
      var cru = location.hash.replace(/^#\/?/, ''), partes = cru.split('?'), params = {};
      var dec = function (t) { try { return decodeURIComponent(t); } catch (e) { return t; } }; // '%' malformado na URL não pode derrubar a tela
      (partes[1] || '').split('&').filter(Boolean).forEach(function (kv) { var p = kv.split('='); params[dec(p[0])] = dec(p[1] || ''); });
      return { rota: dec(partes[0]) || 'inicio', params: params };
    }
    var versao = 0;
    function rotear() {
      var r = parseHash(), id = r.rota;
      if (!temModulo(id) || !ctx.pode(id)) {
        if (id !== 'inicio') { UI.toast('Seu perfil não acessa essa tela.', 'erro'); }
        location.hash = '#/inicio'; return Promise.resolve();
      }
      var minha = ++versao, m = Painel.modulos[id];
      ctx.params = r.params; ctx.rota = id;
      nav.querySelectorAll('a').forEach(function (a) { if (a.getAttribute('data-rota') === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      document.title = tituloDe(id, perfil) + ' | Gestão ' + (neg.nome || '');
      UI.limpar(tela);
      return Promise.resolve(m.render(tela, ctx)).then(function () {
        if (minha !== versao) return;
        var t = document.getElementById('titulo-tela'); if (t && !ctx._semFoco) t.focus({ preventScroll: true });
        return atualizarBanner();
      }).catch(function (e) {
        UI.limpar(tela).appendChild(h('div', { class: 'erro-form', role: 'alert', text: 'Não foi possível abrir esta tela: ' + (e && e.message || e) }));
        if (window.console) console.error(e);
      });
    }
    window.addEventListener('hashchange', rotear);
    if (!location.hash) location.hash = '#/inicio'; else rotear();
  }
})();
