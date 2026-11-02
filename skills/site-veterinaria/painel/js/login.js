/* login.js: primeiro acesso (cria o dono), entrada e troca de senha provisória. Barreira de interface, não segurança real. */
(function () {
  'use strict';
  var UI = window.UI, h = UI.h, Auth = window.Auth, R = window.Regras;
  var cfg = window.SITE_CONFIG || {}, neg = cfg.negocio || {}, slug = neg.slug || 'site';
  var temVitrine = !(cfg.modules && cfg.modules.vitrine === false); // ESSENCIAL: a raiz do site já é este login
  var store = window.Store.criarPadrao(slug, cfg.painel && cfg.painel.armazenamento, cfg.painel && cfg.painel.colecoesExtras);
  var raiz = document.getElementById('login-raiz');
  document.title = 'Gestão | ' + (neg.nome || '') + ' | Entrar';

  function entrar(u) {
    Auth.iniciarSessao(sessionStorage, slug, u);
    location.href = 'app.html';
  }
  function cartao(titulo, filhos) {
    UI.limpar(raiz).appendChild(h('div', { class: 'login-cartao' },
      temVitrine ? h('a', { class: 'login-voltar', href: '../index.html' }, 'Voltar ao site') : null,
      h('div', { class: 'login-marca' }, UI.iconeMarca(30), h('span', { text: neg.nome || 'Clínica' })),
      h('h1', { id: 'login-titulo', tabindex: '-1', text: titulo }), filhos,
      h('div', { class: 'aviso-limite' },
        h('strong', { text: 'Sobre este login' }),
        h('p', { text: 'Esta tela é uma barreira de interface, não segurança real: o site é estático e as contas ficam neste navegador. Use em computadores da clínica.' }),
        h('p', { text: 'Os dados de tutores e pets são dados pessoais (LGPD): registre só o necessário. Tudo fica salvo neste navegador; nada é enviado a servidores.' })),
      h('p', { class: 'login-credito' }, h('a', { href: 'https://andremachado.design', target: '_blank', rel: 'noopener', text: 'criado por andremachado.design' }))));  // v1.0 (PEDIDO_DESIGN_3, item E)
    var t = document.getElementById('login-titulo'); if (t) t.focus();
  }
  function erroBox() { return h('div', { class: 'erro-form', role: 'alert', hidden: true }); }
  function campo(rotulo, tipo, nome, extra) {
    var c = UI.campo(Object.assign({ nome: nome, rotulo: rotulo, tipo: tipo, requerido: true }, extra || {}), '');
    return c;
  }
  function mostrar(box, msg) { box.textContent = msg; box.hidden = !msg; }

  function telaPrimeiroAcesso() {
    var nome = campo('Seu nome', 'text', 'nome', { autocomplete: 'name' }), usuario = campo('Usuário de acesso', 'text', 'usuario', { autocomplete: 'username', ajuda: 'Mínimo de 3 caracteres, sem espaços. Ex.: dono' }),
      senha = campo('Senha (mínimo de 8 caracteres)', 'password', 'senha', { autocomplete: 'new-password' }), conf = campo('Repita a senha', 'password', 'conf', { autocomplete: 'new-password' });
    var erro = erroBox(), ocupado = false;
    var form = h('form', { class: 'login-form', on: { submit: function (e) {
      e.preventDefault(); if (ocupado) return; mostrar(erro, '');
      if (senha.input.value !== conf.input.value) return mostrar(erro, 'As senhas não são iguais.');
      ocupado = true;
      Auth.criarUsuario(store, { nome: nome.input.value, usuario: usuario.input.value, senha: senha.input.value, perfil: 'dono' })
        .then(entrar, function (err) { ocupado = false; mostrar(erro, err.message); });
    } } }, nome.el, usuario.el, senha.el, conf.el, erro, h('button', { class: 'btn', type: 'submit' }, 'Criar conta do dono e entrar'));
    cartao('Primeiro acesso', [h('p', { class: 'login-ajuda', text: 'Ainda não há contas neste navegador. Crie a conta do dono/gerente; depois, em Configurações, ele cria o acesso dos funcionários.' }), form]);
  }

  function telaEntrar() {
    var usuario = campo('Usuário', 'text', 'usuario', { autocomplete: 'username' }), senha = campo('Senha', 'password', 'senha', { autocomplete: 'current-password' });
    var erro = erroBox(), ocupado = false;
    var form = h('form', { class: 'login-form', on: { submit: function (e) {
      e.preventDefault(); if (ocupado) return; mostrar(erro, ''); ocupado = true;
      Auth.autenticar(store, usuario.input.value, senha.input.value).then(function (u) {
        ocupado = false;
        if (!u) return mostrar(erro, 'Usuário ou senha incorretos.');
        if (u.trocarSenha) return telaTrocar(u);
        entrar(u);
      }, function (err) { ocupado = false; mostrar(erro, err.message); });
    } } }, usuario.el, senha.el, erro, h('button', { class: 'btn', type: 'submit' }, 'Entrar'));
    /* Sem botão de apagar aqui: esta tela não autentica ninguém, então qualquer pessoa com acesso ao navegador apagaria tudo e criaria um novo dono.
       Apagar dados fica em Configurações (só o dono, depois do login, digitando APAGAR). */
    var apagar = h('details', { class: 'esqueci' }, h('summary', { text: 'Esqueci a senha' }),
      h('p', { text: 'Funcionário: peça ao dono para redefinir a sua senha em Configurações. Dono: não há recuperação automática pelo painel. Se a senha for perdida, só limpando os dados deste site nas configurações do navegador (isso remove tudo o que foi cadastrado aqui). Por isso, exporte uma cópia dos dados em Configurações de tempos em tempos.' }));
    cartao('Entrar na gestão', [form, apagar]);
  }

  function telaTrocar(u) {
    var nova = campo('Nova senha (mínimo de 8 caracteres)', 'password', 'nova', { autocomplete: 'new-password' }), conf = campo('Repita a nova senha', 'password', 'conf', { autocomplete: 'new-password' });
    var erro = erroBox();
    var form = h('form', { class: 'login-form', on: { submit: function (e) {
      e.preventDefault(); mostrar(erro, '');
      if (nova.input.value !== conf.input.value) return mostrar(erro, 'As senhas não são iguais.');
      var inv = R.validarSenha(nova.input.value); if (inv) return mostrar(erro, inv);
      Auth.trocarSenha(store, u.id, nova.input.value).then(entrar, function (err) { mostrar(erro, err.message); });
    } } }, nova.el, conf.el, erro, h('button', { class: 'btn', type: 'submit' }, 'Salvar senha e entrar'));
    cartao('Defina a sua senha', [h('p', { class: 'login-ajuda', text: 'Você entrou com uma senha provisória. Escolha uma senha só sua para continuar.' }), form]);
  }

  var atual = Auth.sessaoAtual(sessionStorage, slug);
  if (atual) { location.replace('app.html'); return; }
  if (store.aviso) raiz.setAttribute('data-aviso', store.aviso);
  Auth.existeUsuario(store).then(function (ha) { (ha ? telaEntrar : telaPrimeiroAcesso)(); if (store.aviso) raiz.firstChild.appendChild(h('p', { class: 'erro-form', role: 'alert', text: store.aviso })); });
})();
