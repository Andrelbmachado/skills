/* Tutores e pets: cadastro, ficha, exportação dos dados do tutor e exclusão com tudo que depende dele (LGPD). */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI, R = window.Regras;
  /* subtipo (SITE_CONFIG.painel): espécies, sexos, rótulos, peso em gramas e campos extras do cadastro (ex.: exóticos) */
  var PC = (window.SITE_CONFIG && window.SITE_CONFIG.painel) || {};
  var ESPECIES = PC.especies || ['Cão', 'Gato', 'Ave', 'Roedor', 'Coelho', 'Réptil', 'Outro'];
  var SEXOS = PC.sexos || ['Macho', 'Fêmea'];
  var ROT = Object.assign({ raca: 'Raça', microchip: 'Microchip', nascimento: 'Nascimento (aproximado)', marcar: 'Marcar consulta' }, PC.rotulos || {});
  var EXTRAS = PC.camposPet || [];
  var aba = 'tutores', termo = '';

  function render(raiz, ctx) {
    var escreve = ctx.podeEscrever('tutores');

    function desenhar() {
      return ctx.mapa(['tutores', 'pets']).then(function (m) {
        UI.limpar(raiz);
        raiz.appendChild(UI.titulo('Tutores e pets', escreve ? [UI.botao('Novo tutor', function () { formTutor(m); }, { icone: 'mais' }), UI.botao('Novo pet', function () { formPet(m, {}); }, { classe: 'btn-sec', icone: 'pata' })] : []));
        raiz.appendChild(UI.abas([{ id: 'tutores', rotulo: 'Tutores (' + m.tutores_lista.length + ')' }, { id: 'pets', rotulo: 'Pets (' + m.pets_lista.length + ')' }], aba, function (id) { aba = id; desenhar(); }));
        var lista = h('div', { class: 'lista-area' }), painelAba = UI.painelAba(aba);
        painelAba.appendChild(UI.busca(aba === 'tutores' ? 'Buscar tutor por nome ou telefone' : 'Buscar pet por nome, espécie, raça ou tutor', function (v) { termo = v; preencher(); }, termo));
        painelAba.appendChild(lista);
        raiz.appendChild(painelAba);

        function preencher() {
          UI.limpar(lista);
          if (aba === 'tutores') {
            var ts = R.buscar(m.tutores_lista, termo, function (t) { return [t.nome, t.telefone, t.email]; }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
            lista.appendChild(UI.tabela({
              linhas: ts, vazio: termo ? 'Nenhum tutor encontrado.' : 'Nenhum tutor cadastrado.', vazioTexto: termo ? 'Tente outro nome ou telefone.' : 'Cadastre o primeiro tutor para começar.',
              aoClicarLinha: function (t) { fichaTutor(t, m); },
              colunas: [
                { rotulo: 'Tutor', render: function (t) { return h('span', null, t.nome, ' ', UI.marcaExemplo(t)); } },
                { rotulo: 'Telefone', render: function (t) { return t.telefone || '-'; } },
                { rotulo: 'Pets', render: function (t) { var ps = m.pets_lista.filter(function (p) { return p.tutorId === t.id; }); return ps.length ? ps.map(function (p) { return p.nome + (p.especie ? ' (' + p.especie + ')' : ''); }).join(', ') : 'Sem pets'; } }
              ]
            }));
          } else {
            var ps = R.buscar(m.pets_lista, termo, function (p) { var t = m.tutores[p.tutorId]; return [p.nome, p.especie, p.raca, p.microchip, t && t.nome]; }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
            lista.appendChild(UI.tabela({
              linhas: ps, vazio: termo ? 'Nenhum pet encontrado.' : 'Nenhum pet cadastrado.', vazioTexto: termo ? '' : 'Cadastre um tutor e adicione os pets dele.',
              aoClicarLinha: function (p) { fichaPet(p, m); },
              colunas: [
                { rotulo: 'Pet', render: function (p) { return h('span', null, p.nome, ' ', UI.marcaExemplo(p), p.falecido ? [' ', UI.chip('Falecido', 'neutro')] : null); } },
                { rotulo: 'Espécie e raça', render: function (p) { return [p.especie, p.raca].filter(Boolean).join(' · ') || '-'; } },
                { rotulo: 'Idade', render: function (p) { var i = R.idade(p.nascimento, ctx.hoje()); return i ? i.texto : '-'; } },
                { rotulo: 'Tutor', render: function (p) { var t = m.tutores[p.tutorId]; return t ? t.nome : '-'; } }
              ]
            }));
          }
        }
        preencher();
      });
    }

    /* ---------- tutor ---------- */
    function formTutor(m, t) {
      return UI.abrirFormulario({
        titulo: t ? 'Editar tutor' : 'Novo tutor', valores: t || {},
        campos: [
          { nome: 'nome', rotulo: 'Nome', requerido: true, autocomplete: 'off' },
          { nome: 'telefone', rotulo: 'Telefone/WhatsApp (com DDD)', tipo: 'tel', largura: 'meia', ajuda: 'Usado nos lembretes por WhatsApp.' },
          { nome: 'email', rotulo: 'E-mail', tipo: 'email', largura: 'meia' },
          { nome: 'endereco', rotulo: 'Endereço' },
          { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', linhas: 2 }
        ],
        aviso: 'Dado pessoal (LGPD): registre só o necessário para o atendimento.',
        aoSalvar: function (v) {
          var erro = R.validarTutor(v); if (erro) throw new Error(erro);
          return ctx.store.salvar('tutores', Object.assign({}, t || {}, v)).then(function (novo) { UI.toast(t ? 'Tutor atualizado.' : 'Tutor cadastrado.'); return novo; });
        }
      }).then(function (salvou) { if (salvou) return desenhar(); });
    }
    function fichaTutor(t, m) {
      var pets = m.pets_lista.filter(function (p) { return p.tutorId === t.id; });
      var corpo = h('div', null,
        h('p', null, UI.marcaExemplo(t)),
        h('dl', { class: 'dl-ficha' }, [['Telefone', t.telefone], ['E-mail', t.email], ['Endereço', t.endereco], ['Observações', t.observacoes]].filter(function (l) { return l[1]; }).map(function (l) { return [h('dt', { text: l[0] }), h('dd', { text: l[1] })]; })),
        h('h3', { text: 'Pets' }),
        pets.length ? h('ul', { class: 'lista-simples-painel' }, pets.map(function (p) {
          return h('li', null, h('button', { type: 'button', class: 'link-linha', on: { click: function () { api.fechar(); fichaPet(p, m); } } }, p.nome), ' ' + [p.especie, p.raca].filter(Boolean).join(' · '));
        })) : h('p', { class: 'mudo', text: 'Nenhum pet cadastrado para este tutor.' }));
      var acoes = [];
      if (escreve) {
        acoes.push({ texto: 'Adicionar pet', aoClicar: function (a) { a.fechar(); formPet(m, { tutorId: t.id }); } });
        acoes.push({ texto: 'Editar tutor', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); formTutor(m, t); } });
      }
      acoes.push({ texto: 'Exportar dados deste tutor', classe: 'btn-sec', aoClicar: function () { exportarTutor(t, m); } });
      if (ctx.podeExcluir('tutores')) acoes.push({ texto: 'Excluir tutor e dados', classe: 'btn-perigo', aoClicar: function (a) { a.fechar(); excluirTutor(t, m); } });
      var api = UI.modal({ titulo: t.nome, corpo: corpo, acoes: acoes });
    }
    function dadosDoTutor(t) {
      return ctx.mapa(['pets', 'consultas', 'prontuarios', 'vacinas', 'lancamentos', 'lembretes', 'internacoes', 'evolucoes', 'exames']).then(function (m) {
        var pets = m.pets_lista.filter(function (p) { return p.tutorId === t.id; }), ids = Object.create(null); pets.forEach(function (p) { ids[p.id] = true; }); // sem protótipo: petId "toString" não pode contar como pet deste tutor
        var vac = m.vacinas_lista.filter(function (x) { return ids[x.petId]; }), pro = m.prontuarios_lista.filter(function (x) { return ids[x.petId]; });
        var d = {
          tutor: t, pets: pets, consultas: m.consultas_lista.filter(function (x) { return ids[x.petId]; }), prontuarios: pro, vacinas: vac,
          lancamentos: m.lancamentos_lista.filter(function (x) { return x.tutorId === t.id; }),
          lembretes: m.lembretes_lista.filter(function (l) { var p = String(l && l.chave || '').split(':'); return (p[0] === 'vacina' ? vac : pro).some(function (x) { return x.id === p[1]; }); })
        };
        if (ctx.store.tem('internacoes')) { // hospital: internações do pet e as observações delas acompanham o tutor (exportar e excluir)
          d.internacoes = m.internacoes_lista.filter(function (x) { return ids[x.petId]; });
          var iid = Object.create(null); d.internacoes.forEach(function (x) { iid[x.id] = true; });
          d.evolucoes = m.evolucoes_lista.filter(function (x) { return iid[x.internacaoId]; });
        }
        if (ctx.store.tem('exames')) d.exames = m.exames_lista.filter(function (x) { return x && ids[x.petId]; }); // diagnóstico: os exames (e laudos) do pet acompanham o tutor
        return d;
      });
    }
    var ROTULO_PARTE = { prontuarios: 'prontuários', vacinas: 'vacinas', lembretes: 'lembretes', lancamentos: 'lançamentos do caixa', consultas: 'consultas', pets: 'pets', tutor: 'tutor',
      internacoes: 'internações', evolucoes: 'observações de internação', exames: 'exames', laudos: 'laudos e indicações clínicas', internacao_clinica: 'motivo, situação e desfecho das internações' };
    function exportarTutor(t) {
      dadosDoTutor(t).then(function (d) {
        var rec = R.recortarDadosDoTutor(ctx.perfil, d); // cada perfil leva só o que pode ler (recepção não leva prontuário; veterinário não leva caixa)
        UI.baixar('dados-' + R.normalizar(t.nome).replace(/[^a-z0-9]+/g, '-') + '.json', JSON.stringify({ versao: 1, geradoEm: new Date().toISOString(), tipo: 'dados-do-tutor', omitidos: rec.omitidos, dados: rec.dados }, null, 2), 'application/json');
        UI.toast('Arquivo com os dados do tutor baixado' + (rec.omitidos.length ? ', sem ' + rec.omitidos.map(function (k) { return ROTULO_PARTE[k] || k; }).join(' e ') + ' (o seu perfil não acessa)' : '') + '.');
      });
    }
    function excluirTutor(t) {
      dadosDoTutor(t).then(function (d) {
        var resumo = d.exames ? d.pets.length + ' pet(s), ' + d.consultas.length + ' agendamento(s) e ' + d.exames.length + ' exame(s) com laudos' : d.pets.length + ' pet(s), ' + d.consultas.length + ' consulta(s), ' + d.prontuarios.length + ' prontuário(s)' + (d.internacoes ? ', ' + d.internacoes.length + ' internação(ões)' : '') + ' e ' + d.vacinas.length + ' vacina(s)';
        return UI.confirmar('Excluir ' + t.nome + ' e ' + resumo + '? Os lançamentos do caixa ficam, sem o vínculo com o tutor. Não dá para desfazer; exporte os dados antes se precisar.', { ok: 'Excluir tudo', perigo: true, titulo: 'Excluir tutor' }).then(function (sim) {
          if (!sim) return;
          var st = ctx.store, tarefas = [];
          d.consultas.forEach(function (x) { tarefas.push(st.remover('consultas', x.id)); });
          d.prontuarios.forEach(function (x) { tarefas.push(st.remover('prontuarios', x.id)); });
          d.vacinas.forEach(function (x) { tarefas.push(st.remover('vacinas', x.id)); });
          d.lembretes.forEach(function (x) { tarefas.push(st.remover('lembretes', x.id)); });
          (d.evolucoes || []).forEach(function (x) { tarefas.push(st.remover('evolucoes', x.id)); });
          (d.internacoes || []).forEach(function (x) { tarefas.push(st.remover('internacoes', x.id)); });
          (d.exames || []).forEach(function (x) { tarefas.push(st.remover('exames', x.id)); });
          d.lancamentos.forEach(function (x) { tarefas.push(st.salvar('lancamentos', Object.assign({}, x, { tutorId: '' }))); });
          d.pets.forEach(function (x) { tarefas.push(st.remover('pets', x.id)); });
          tarefas.push(st.remover('tutores', t.id));
          return Promise.all(tarefas).then(function () { UI.toast('Tutor e dados excluídos.'); return desenhar(); });
        });
      });
    }

    /* ---------- pet ---------- */
    function formPet(m, p) {
      var tutores = m.tutores_lista.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); });
      if (!tutores.length) { UI.toast('Cadastre um tutor antes de adicionar pets.', 'erro'); return; }
      return UI.abrirFormulario({
        titulo: p && p.id ? 'Editar pet' : 'Novo pet', valores: p || {}, larga: true,
        campos: [
          { nome: 'tutorId', rotulo: 'Tutor', tipo: 'select', requerido: true, opcoes: tutores.map(function (t) { return { valor: t.id, rotulo: t.nome }; }) },
          { nome: 'nome', rotulo: 'Nome do pet', requerido: true, largura: 'meia' },
          { nome: 'especie', rotulo: 'Espécie', tipo: 'select', requerido: true, largura: 'meia', opcoes: ESPECIES.map(function (e) { return { valor: e, rotulo: e }; }) },
          { nome: 'raca', rotulo: ROT.raca, largura: 'meia' },
          { nome: 'sexo', rotulo: 'Sexo', tipo: 'select', largura: 'meia', opcoes: SEXOS.map(function (x) { return { valor: x, rotulo: x }; }) },
          { nome: 'nascimento', rotulo: ROT.nascimento, tipo: 'date', largura: 'terco' },
          PC.pesoEmGramas ? { nome: 'pesoG', rotulo: 'Peso (g)', tipo: 'number', min: 0, step: 1, largura: 'terco' } : { nome: 'pesoKg', rotulo: 'Peso (kg)', tipo: 'number', min: 0, step: 0.1, largura: 'terco' },
          { nome: 'microchip', rotulo: ROT.microchip, largura: 'terco' },
          { nome: 'castrado', rotulo: 'Castrado', tipo: 'checkbox', largura: 'meia' },
          { nome: 'falecido', rotulo: 'Falecido (para de gerar lembretes)', tipo: 'checkbox', largura: 'meia' }
        ].concat(EXTRAS, [{ nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', linhas: 2 }]),
        aoExcluir: p && p.id && ctx.podeExcluir('tutores') ? function () {
          return Promise.all([ctx.store.listar('consultas'), ctx.store.listar('prontuarios'), ctx.store.listar('vacinas'), ctx.mapa(['internacoes', 'evolucoes', 'exames'])]).then(function (r) {
            var t = [];
            var ints = r[3].internacoes_lista.filter(function (x) { return x.petId === p.id; }), iid = Object.create(null); ints.forEach(function (x) { iid[x.id] = true; });
            r[3].evolucoes_lista.filter(function (x) { return iid[x.internacaoId]; }).forEach(function (x) { t.push(ctx.store.remover('evolucoes', x.id)); });
            ints.forEach(function (x) { t.push(ctx.store.remover('internacoes', x.id)); });
            r[3].exames_lista.filter(function (x) { return x && x.petId === p.id; }).forEach(function (x) { t.push(ctx.store.remover('exames', x.id)); });
            r[0].filter(function (x) { return x.petId === p.id; }).forEach(function (x) { t.push(ctx.store.remover('consultas', x.id)); });
            r[1].filter(function (x) { return x.petId === p.id; }).forEach(function (x) { t.push(ctx.store.remover('prontuarios', x.id)); });
            r[2].filter(function (x) { return x.petId === p.id; }).forEach(function (x) { t.push(ctx.store.remover('vacinas', x.id)); });
            t.push(ctx.store.remover('pets', p.id)); return Promise.all(t);
          });
        } : null,
        confirmaExcluir: ctx.store.tem('exames') ? 'Excluir este pet junto com os agendamentos, exames e laudos dele? Não dá para desfazer.' : 'Excluir este pet junto com as consultas, prontuários, vacinas' + (ctx.store.tem('internacoes') ? ', internações' : '') + ' dele? Não dá para desfazer.',
        aoSalvar: function (v) {
          var erro = R.validarPet(v); if (erro) throw new Error(erro);
          return ctx.store.salvar('pets', Object.assign({}, p || {}, v)).then(function () { UI.toast(p && p.id ? 'Pet atualizado.' : 'Pet cadastrado.'); });
        }
      }).then(function (salvou) { if (salvou) return desenhar(); });
    }
    function fichaPet(p, m) {
      var t = m.tutores[p.tutorId], idade = R.idade(p.nascimento, ctx.hoje());
      var linhas = [['Tutor', t ? t.nome : ''], ['Espécie e raça', [p.especie, p.raca].filter(Boolean).join(' · ')], ['Sexo', p.sexo], ['Idade', idade ? idade.texto : ''], ['Peso', R.pesoTexto(p)],
        ['Castrado', p.castrado ? 'Sim' : ''], [ROT.microchip, p.microchip]].concat(R.camposExtras(EXTRAS, p), [['Observações', p.observacoes]]).filter(function (l) { return l[1]; });
      var corpo = h('div', null, h('p', null, UI.marcaExemplo(p), p.falecido ? UI.chip('Falecido', 'neutro') : null), h('dl', { class: 'dl-ficha' }, linhas.map(function (l) { return [h('dt', { text: l[0] }), h('dd', { text: l[1] })]; })));
      var acoes = [];
      if (ctx.podeEscrever('agenda') && !p.falecido) acoes.push({ texto: ROT.marcar, aoClicar: function (a) { a.fechar(); ctx.navegar('agenda', { pet: p.id }); } });
      if (ctx.pode('prontuarios')) acoes.push({ texto: 'Prontuário', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); ctx.navegar('prontuarios', { pet: p.id }); } });
      if (ctx.pode('exames')) acoes.push({ texto: 'Exames', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); ctx.navegar('exames', { pet: p.id }); } });
      if (ctx.pode('vacinas')) acoes.push({ texto: 'Vacinas', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); ctx.navegar('vacinas', { pet: p.id }); } });
      if (ctx.podeEscrever('internacao') && ctx.store.tem('internacoes') && !p.falecido) acoes.push({ texto: 'Internar', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); ctx.navegar('internacao', { pet: p.id, novo: 1 }); } });
      if (escreve) acoes.push({ texto: 'Editar pet', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); formPet(m, p); } });
      UI.modal({ titulo: p.nome, corpo: corpo, acoes: acoes });
    }

    return desenhar().then(function () {
      if (ctx.params.novo && escreve) return ctx.mapa(['tutores', 'pets']).then(function (m) { return formTutor(m); });
    });
  }

  window.Painel.registrar({ id: 'tutores', titulo: 'Tutores e pets', icone: 'tutores', render: render });
})();
