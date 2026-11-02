/* Configurações: dados da clínica, agenda, mensagem de lembrete, acessos da equipe, minha senha e dados/privacidade (LGPD). Só o dono. */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI, R = window.Regras, Auth = window.Auth, Store = window.Store;
  var NOMES = { tutores: 'Tutores', pets: 'Pets', profissionais: 'Profissionais', servicos: 'Serviços', consultas: 'Consultas', prontuarios: 'Prontuários', vacinas: 'Vacinas', lembretes: 'Lembretes', lancamentos: 'Caixa', estoque: 'Estoque', movimentos: 'Movimentos de estoque', config: 'Configurações',
    leitos: 'Leitos', internacoes: 'Internações', evolucoes: 'Observações de internação', plantoes: 'Plantões', exames: 'Exames e laudos', encaminhadores: 'Encaminhadores' };

  function render(raiz, ctx) {
    function salvarTexto(nome, msg) {
      return function (valores) { return ctx.config().then(function (c) { return ctx.salvarConfig(Object.assign({}, c, valores)); }).then(function () { UI.toast(msg); return true; }); };
    }
    function secao(titulo, descricao, filhos) { return h('section', { class: 'bloco' }, h('h2', { text: titulo }), descricao ? h('p', { class: 'mudo', text: descricao }) : null, filhos); }
    function formSecao(campos, valores, aoSalvar, rotulo) {
      var f = UI.formulario(campos, valores), erro = h('div', { class: 'erro-form', role: 'alert', hidden: true });
      var form = h('form', { on: { submit: function (e) {
        e.preventDefault(); erro.hidden = true;
        var inv = f.invalido(); if (inv) { erro.textContent = inv; erro.hidden = false; return; }
        Promise.resolve(aoSalvar(f.valores())).then(null, function (x) { erro.textContent = x.message; erro.hidden = false; });
      } } }, f.el, erro, h('button', { class: 'btn', type: 'submit' }, rotulo || 'Salvar'));
      return form;
    }

    function desenhar() {
      return Promise.all([ctx.config(), ctx.store.listar('usuarios')]).then(function (r) {
        var c = r[0], usuarios = r[1];
        UI.limpar(raiz);
        raiz.appendChild(UI.titulo('Configurações'));

        raiz.appendChild(secao('Dados da clínica', 'Usados nas mensagens de lembrete e nas impressões. Não alteram o site público.', formSecao([
          { nome: 'nome', rotulo: 'Nome da clínica', requerido: true }, { nome: 'telefone', rotulo: 'Telefone', largura: 'meia' }, { nome: 'whatsapp', rotulo: 'WhatsApp', largura: 'meia' }, { nome: 'endereco', rotulo: 'Endereço' }
        ], c, salvarTexto('clinica', 'Dados da clínica salvos.'))));

        raiz.appendChild(secao('Agenda', 'Expediente exibido na grade da agenda (define as linhas visíveis; consultas fora dele ainda aparecem).', formSecao([
          { nome: 'aberturaAgenda', rotulo: 'Início', tipo: 'time', requerido: true, largura: 'terco' }, { nome: 'fechamentoAgenda', rotulo: 'Fim', tipo: 'time', requerido: true, largura: 'terco' },
          { nome: 'passoAgenda', rotulo: 'Intervalo dos horários livres (min)', tipo: 'number', min: 5, step: 5, requerido: true, largura: 'terco' },
          { nome: 'duracaoPadrao', rotulo: 'Duração padrão da consulta (min)', tipo: 'number', min: 5, step: 5, requerido: true, largura: 'meia' },
          { nome: 'diasAvisoValidade', rotulo: 'Avisar validade com (dias)', tipo: 'number', min: 1, requerido: true, largura: 'meia' }
        ], c, function (v) {
          if (R.hhmmParaMin(v.fechamentoAgenda) <= R.hhmmParaMin(v.aberturaAgenda)) throw new Error('O fim do expediente precisa ser depois do início.');
          return salvarTexto('agenda', 'Configurações da agenda salvas.')(v);
        })));

        /* só onde há retornos e vacinas (o centro de diagnóstico não tem) */
        if (ctx.pode('vacinas')) raiz.appendChild(secao('Mensagem de lembrete', 'Texto que abre no WhatsApp ao lembrar um retorno. Variáveis: {tutor}, {pet}, {clinica}, {data}, {motivo}. A mensagem é informativa; evite promessas ou condições comerciais.', formSecao([
          { nome: 'modeloLembrete', rotulo: 'Mensagem', tipo: 'textarea', linhas: 4, requerido: true }
        ], c, salvarTexto('lembrete', 'Mensagem salva.'))));

        /* acessos */
        raiz.appendChild(secao('Acessos da equipe', 'Cada pessoa entra com o próprio usuário. A senha provisória precisa ser trocada no primeiro acesso.', [
          UI.botao('Novo acesso', function () { formUsuario(null, usuarios); }, { icone: 'mais', classe: 'btn-peq' }),
          UI.tabela({
            linhas: usuarios, vazio: 'Nenhum acesso.', aoClicarLinha: function (u) { formUsuario(u, usuarios); },
            colunas: [
              { rotulo: 'Nome', render: function (u) { return u.nome + (u.id === ctx.usuario.id ? ' (você)' : ''); } },
              { rotulo: 'Usuário', render: function (u) { return u.usuario; } },
              { rotulo: 'Perfil', render: function (u) { return R.PERFIS[u.perfil] || u.perfil; } },
              { rotulo: 'Situação', render: function (u) { return u.ativo === false ? UI.chip('Desativado', 'neutro') : u.trocarSenha ? UI.chip('Senha provisória', 'aviso') : UI.chip('Ativo', 'ok'); } }
            ]
          })]));

        /* minha senha */
        var atual = UI.campo({ nome: 'atual', rotulo: 'Senha atual', tipo: 'password', requerido: true, autocomplete: 'current-password', largura: 'terco' }, ''), nova = UI.campo({ nome: 'nova', rotulo: 'Nova senha (mín. 8)', tipo: 'password', requerido: true, autocomplete: 'new-password', largura: 'terco' }, ''), conf = UI.campo({ nome: 'conf', rotulo: 'Repita a nova senha', tipo: 'password', requerido: true, autocomplete: 'new-password', largura: 'terco' }, '');
        var erroSenha = h('div', { class: 'erro-form', role: 'alert', hidden: true });
        raiz.appendChild(secao('Minha senha', null, h('form', { on: { submit: function (e) {
          e.preventDefault(); erroSenha.hidden = true;
          function falha(msg) { erroSenha.textContent = msg; erroSenha.hidden = false; }
          if (nova.input.value !== conf.input.value) return falha('As senhas novas não são iguais.');
          Auth.autenticar(ctx.store, ctx.usuario.usuario, atual.input.value).then(function (u) {
            if (!u) throw new Error('A senha atual está incorreta.');
            return Auth.trocarSenha(ctx.store, ctx.usuario.id, nova.input.value);
          }).then(function () { UI.toast('Senha alterada.'); atual.input.value = nova.input.value = conf.input.value = ''; }, function (x) { falha(x.message); });
        } } }, h('div', { class: 'grade-campos' }, atual.el, nova.el, conf.el), erroSenha, h('button', { class: 'btn', type: 'submit' }, 'Alterar senha'))));

        /* dados e privacidade */
        var arquivo = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, id: 'arquivo-import', 'aria-label': 'Arquivo de exportação para importar', on: { change: function (e) {
          var f = e.target.files[0]; e.target.value = ''; if (!f) return;
          UI.lerArquivoTexto(f).then(function (t) {
            var dump; try { dump = JSON.parse(t); } catch (x) { throw new Error('O arquivo não é um JSON válido: escolha uma exportação feita aqui em Configurações.'); }
            var v = Store.validarExportacao(dump, ctx.store.colecoes); if (!v.ok) throw new Error(v.erro); // confere o arquivo inteiro ANTES de mexer em qualquer dado
            return confirmarImportacao(dump, v);
          }).then(function (n) { if (n != null) { UI.toast('Dados importados (' + n + ' grupos).'); return desenhar(); } }, function (x) { UI.toast(x.message || 'Arquivo inválido.', 'erro'); });
        } } });
        /* Importar SUBSTITUI tudo (v0.6): o grupo que o arquivo não traz fica VAZIO (backup de uma versão mais antiga). A tela diz isso, com a contagem do que será apagado,
           e avisa quando o arquivo cita cadastros que não estão nele (as telas mostrariam "removido"). */
        function confirmarImportacao(dump, v) {
          var resumo = v.resumo, nome = function (c) { return NOMES[c] || c; };
          var grupos = Object.keys(resumo).concat(v.ausentes || []);
          // quantos registros cada grupo tem HOJE (o que o arquivo traz substitui; o que não traz fica vazio)
          return Promise.all(grupos.map(function (c) { return ctx.store.listar(c).then(function (l) { return [c, l.length]; }); })).then(function (pares) {
            var hoje = Object.create(null); pares.forEach(function (p) { hoje[p[0]] = p[1]; });
            var linhas = Object.keys(resumo).map(function (c) { return h('li', { text: nome(c) + ': ' + resumo[c] + ' registro(s) no arquivo (hoje: ' + hoje[c] + ')' }); });
            var esvaziam = (v.ausentes || []).filter(function (c) { return hoje[c] > 0; }).map(function (c) { return [c, hoje[c]]; });
            var avisos = [];
            if (esvaziam.length) avisos.push(h('div', { class: 'erro-form', 'data-aviso': 'esvazia' }, h('p', { text: 'O arquivo NÃO traz estes grupos, que hoje têm registros e ficarão VAZIOS (é o que acontece com um backup de uma versão mais antiga do painel):' }),
              h('ul', { class: 'lista-simples-painel' }, esvaziam.map(function (p) { return h('li', { text: nome(p[0]) + ': ' + p[1] + ' registro(s) atual(is) serão apagados' }); }))));
            if ((v.quebradas || []).length) avisos.push(h('div', { class: 'erro-form', 'data-aviso': 'quebradas' }, h('p', { text: 'Atenção: o arquivo tem registros que citam cadastros que não estão nele; esses registros aparecem como "removido" ou ficam sem acesso pelas telas:' }),
              h('ul', { class: 'lista-simples-painel' }, v.quebradas.map(function (q) { return h('li', { text: nome(q.colecao) + ': ' + q.quantidade + ' registro(s) citam ' + nome(q.alvo).toLowerCase() + ' que não está no arquivo' }); }))));
            return new Promise(function (res) {
              var m = UI.modal({ titulo: 'Importar dados', corpo: h('div', null, h('p', { text: 'Importar SUBSTITUI todos os cadastros deste navegador pelo conteúdo do arquivo. Não dá para desfazer; exporte uma cópia dos dados atuais antes se precisar.' }), h('ul', { class: 'lista-simples-painel' }, linhas), avisos),
                acoes: [{ texto: 'Cancelar', classe: 'btn-sec', aoClicar: function (a) { a.fechar('cancelar'); } },
                  { texto: 'Exportar cópia atual', classe: 'btn-sec', aoClicar: function () { exportarTudo(); } },
                  { texto: 'Importar e substituir', classe: 'btn-perigo', aoClicar: function (a) { a.fechar('importar'); } }] });
              m.aoFechar.then(function (r) { // Esc ou "Cancelar": nada acontece
                if (r !== 'importar') return res(null);
                ctx.store.importar(dump).then(res, function (x) { UI.toast(x.message, 'erro'); res(null); });
              });
            });
          });
        }
        raiz.appendChild(secao('Dados e privacidade (LGPD)', 'Tudo o que você cadastra fica salvo apenas neste navegador. Tutores e pets são dados pessoais: registre o necessário, exporte cópias e apague quando o tutor pedir.', [
          h('div', { class: 'linha-botoes-painel' },
            UI.botao('Exportar todos os dados (JSON)', exportarTudo, { classe: 'btn-sec' }),
            UI.botao('Importar exportação', function () { arquivo.click(); }, { classe: 'btn-sec' }), arquivo,
            UI.botao('Carregar dados de exemplo', function () { ctx.Seed.carregar(ctx.store, ctx.hoje(), ctx.subtipo, { exames: (ctx.cfg.painel || {}).exames }).then(function (n) { UI.toast(n ? n + ' registros de exemplo carregados (fictícios).' : 'Os dados de exemplo já estão carregados. Remova-os antes de carregar de novo.'); return ctx.atualizar(); }); }, { classe: 'btn-sec' }),
            UI.botao('Remover dados de exemplo', function () { ctx.Seed.remover(ctx.store).then(function (n) { UI.toast(n + ' registros de exemplo removidos.'); return ctx.atualizar(); }); }, { classe: 'btn-sec' })),
          h('p', { class: 'mudo', text: 'A exportação não inclui as contas de acesso. Importar substitui todos os cadastros pelo conteúdo do arquivo (o que o arquivo não traz fica vazio).' }),
          UI.botao('Apagar todos os dados deste navegador', apagarTudo, { classe: 'btn-perigo' })]));

        raiz.appendChild(secao('Sobre o login', null, [
          h('p', { text: 'O login desta tela é uma barreira de interface, não segurança real: o site é estático, as contas e os dados ficam neste navegador e quem tiver acesso ao computador ou aos arquivos consegue contornar. Até a sessão e o perfil de quem entrou ficam no armazenamento do navegador e podem ser alterados por quem sabe mexer nele.' }),
          h('p', { text: 'As senhas não são guardadas em texto: ficam como código de verificação (PBKDF2 com 100 mil repetições em páginas https ou localhost; fora delas, SHA-256 repetido, que é mais fraco). Não há limite de tentativas de senha.' }),
          h('p', { text: 'Para uso com vários computadores e proteção de verdade, a camada de dados troca para um servidor com autenticação (adaptador do store), sem mudar as telas.' })]));
      });
    }

    function exportarTudo() { return ctx.store.exportar().then(function (d) { UI.baixar('gestao-' + ctx.slug + '-' + ctx.hoje() + '.json', JSON.stringify(d, null, 2), 'application/json'); UI.toast('Cópia baixada. Guarde em local seguro.'); }); }

    function apagarTudo() {
      var campo = UI.campo({ nome: 'c', rotulo: 'Digite APAGAR para confirmar', requerido: true }, '');
      var m = UI.modal({ titulo: 'Apagar todos os dados', corpo: h('div', null, h('p', { text: 'Isto remove ' + (ctx.store.tem('exames') ? 'tutores, pets, agenda, exames e laudos, encaminhadores, caixa, estoque, configurações' : 'tutores, pets, consultas, prontuários, vacinas, caixa, estoque, configurações') + ' e todas as contas de acesso deste navegador. Não dá para desfazer. Exporte uma cópia antes: ela não inclui as contas de acesso.' }), campo.el),
        acoes: [{ texto: 'Cancelar', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); } },
          { texto: 'Exportar uma cópia antes', classe: 'btn-sec', aoClicar: function () { exportarTudo(); } },
          { texto: 'Apagar tudo', classe: 'btn-perigo', aoClicar: function () {
            if (campo.input.value.trim() !== 'APAGAR') { UI.toast('Digite APAGAR para confirmar.', 'erro'); return; }
            ctx.store.limparTudo().then(function () { Auth.encerrarSessao(sessionStorage, ctx.slug); location.href = 'index.html'; });
          } }] });
      return m;
    }

    function formUsuario(u, todos) {
      var self = u && u.id === ctx.usuario.id;
      var campos = [
        { nome: 'nome', rotulo: 'Nome', requerido: true },
        { nome: 'usuario', rotulo: 'Usuário de acesso', requerido: true, largura: 'meia', somenteLeitura: !!u, ajuda: u ? 'O usuário não muda depois de criado.' : 'Mínimo de 3 caracteres, sem espaços.' },
        { nome: 'perfil', rotulo: 'Perfil', tipo: 'select', requerido: true, largura: 'meia', opcoes: Object.keys(R.PERFIS).map(function (k) { return { valor: k, rotulo: R.PERFIS[k] }; }), somenteLeitura: self }
      ];
      if (!u) campos.push({ nome: 'senha', rotulo: 'Senha provisória (mín. 8)', tipo: 'password', requerido: true, autocomplete: 'new-password' });
      else campos.push({ nome: 'ativo', rotulo: 'Acesso ativo', tipo: 'checkbox', somenteLeitura: self });
      var extras = u && !self ? [{ texto: 'Redefinir senha', aoClicar: function (v, api) {
        var senha = Auth.gerarSenhaProvisoria();
        UI.confirmar('Definir a senha provisória "' + senha + '" para ' + u.nome + '? Anote e entregue a ela; no próximo acesso será pedido que troque.', { ok: 'Redefinir' }).then(function (sim) {
          if (sim) Auth.redefinirSenha(ctx.store, u.id, senha).then(function () { UI.toast('Senha redefinida: ' + senha, 'ok'); api.fechar(true); desenhar(); });
        });
      } }] : [];
      return UI.abrirFormulario({
        titulo: u ? 'Editar acesso' : 'Novo acesso', campos: campos, valores: u ? Object.assign({ ativo: u.ativo !== false }, u) : { perfil: 'recepcao' }, extras: extras,
        aoSalvar: function (v) {
          if (!u) return Auth.criarUsuario(ctx.store, { nome: v.nome, usuario: v.usuario, senha: v.senha, perfil: v.perfil, trocarSenha: true }).then(function () { UI.toast('Acesso criado. A senha provisória deve ser trocada no primeiro login.'); });
          var donosAtivos = todos.filter(function (x) { return x.perfil === 'dono' && x.ativo !== false && x.id !== u.id; });
          if ((v.perfil !== 'dono' || v.ativo === false) && !donosAtivos.length && u.perfil === 'dono') throw new Error('É preciso manter pelo menos um dono ativo.');
          return ctx.store.salvar('usuarios', Object.assign({}, u, { nome: v.nome, perfil: self ? u.perfil : v.perfil, ativo: self ? true : v.ativo })).then(function () { UI.toast('Acesso atualizado.'); });
        }
      }).then(function (ok) { if (ok) return desenhar(); });
    }

    return desenhar();
  }

  window.Painel.registrar({ id: 'config', titulo: 'Configurações', icone: 'config', render: render });
})();
