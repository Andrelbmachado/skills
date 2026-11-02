/* Prontuários: histórico clínico por pet (queixa, exame físico, diagnóstico, conduta, prescrição, retorno). Recepção não acessa. */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI, R = window.Regras;
  var petAtual = '';
  /* subtipo (SITE_CONFIG.painel): peso em gramas e campos extras do prontuário (ex.: ambiente, dieta e manejo em exóticos) */
  var PC = (window.SITE_CONFIG && window.SITE_CONFIG.painel) || {};
  var EXTRAS = PC.camposProntuario || [];

  function render(raiz, ctx) {
    var escreve = ctx.podeEscrever('prontuarios');
    if (ctx.params.pet) petAtual = ctx.params.pet;

    function desenhar() {
      return Promise.all([ctx.mapa(['pets', 'tutores', 'profissionais', 'prontuarios', 'consultas'])]).then(function (r) {
        var m = r[0];
        UI.limpar(raiz);
        var pets = m.pets_lista.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); });
        if (petAtual && !m.pets[petAtual]) petAtual = '';
        raiz.appendChild(UI.titulo('Prontuários', escreve && petAtual ? [UI.botao('Novo registro', function () { form(m, null, {}); }, { icone: 'mais' })] : []));
        var seletor = h('select', { 'aria-label': 'Escolher o pet', on: { change: function (e) { petAtual = e.target.value; desenhar(); } } },
          h('option', { value: '' }, pets.length ? 'Escolha um pet' : 'Nenhum pet cadastrado'),
          pets.map(function (p) { return h('option', { value: p.id, selected: p.id === petAtual }, ctx.rotuloPet(p, m.tutores)); }));
        raiz.appendChild(h('div', { class: 'agenda-barra' }, h('label', { class: 'rotulo-inline' }, 'Pet ', seletor)));
        if (!petAtual) {
          raiz.appendChild(UI.vazio('Escolha um pet para ver o prontuário', pets.length ? 'O histórico clínico aparece aqui, do registro mais recente para o mais antigo.' : 'Cadastre tutores e pets em "Tutores e pets" primeiro.'));
          return;
        }
        var pet = m.pets[petAtual], t = m.tutores[pet.tutorId], idade = R.idade(pet.nascimento, ctx.hoje());
        var regs = m.prontuarios_lista.filter(function (x) { return x.petId === petAtual; }).sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : (a.criadoEm < b.criadoEm ? 1 : -1); });
        var ultimoPeso = regs.find(function (x) { return R.pesoTexto(x); });
        raiz.appendChild(h('section', { class: 'bloco ficha-pet' }, h('h2', null, pet.nome, ' ', UI.marcaExemplo(pet)),
          h('p', { text: [pet.especie, pet.raca, pet.sexo, idade && idade.texto, pet.castrado ? 'castrado(a)' : '', ultimoPeso ? 'último peso: ' + R.pesoTexto(ultimoPeso) : ''].filter(Boolean).join(' · ') }),
          h('p', { class: 'mudo', text: t ? 'Tutor: ' + t.nome + (t.telefone ? ' · ' + t.telefone : '') : '' })));
        if (!regs.length) { raiz.appendChild(UI.vazio('Sem registros clínicos', escreve ? 'Use "Novo registro" para abrir o primeiro atendimento deste pet.' : '')); return; }
        regs.forEach(function (x, i) {
          var p = m.profissionais[x.profissionalId];
          var campos = [['Anamnese', x.anamnese]].concat(R.camposExtras(EXTRAS, x), [['Exame físico', exameTexto(x)], ['Diagnóstico', x.diagnostico], ['Conduta e tratamento', x.conduta], ['Prescrição', x.prescricao], ['Retorno previsto', x.retornoEm ? UI.fmt.data(x.retornoEm) : ''], ['Observações', x.obs]]).filter(function (c) { return c[1]; });
          var corpo = h('div', { class: 'prontuario-corpo' }, h('dl', { class: 'dl-ficha' }, campos.map(function (c) { return [h('dt', { text: c[0] }), h('dd', { text: c[1] })]; })),
            h('div', { class: 'linha-botoes-painel' },
              UI.botao('Imprimir', function () { UI.imprimir(paraImpressao(x, pet, t, p)); }, { classe: 'btn-sec btn-peq' }),
              escreve ? UI.botao('Editar', function () { form(m, x, {}); }, { classe: 'btn-sec btn-peq' }) : null,
              ctx.podeExcluir('prontuarios') ? UI.botao('Excluir', function () {
                UI.confirmar('Excluir este registro do prontuário? Não dá para desfazer.', { ok: 'Excluir', perigo: true }).then(function (sim) { if (sim) ctx.store.remover('prontuarios', x.id).then(function () { UI.toast('Registro excluído.'); desenhar(); }); });
              }, { classe: 'btn-perigo btn-peq' }) : null));
          raiz.appendChild(h('details', { class: 'registro', open: i === 0 },
            h('summary', null, h('strong', { text: UI.fmt.data(x.data) }), ' ' + (x.queixa || 'Sem queixa registrada'), h('small', { text: p ? ' · ' + p.nome : '' }), ' ', UI.marcaExemplo(x)), corpo));
        });
      });
    }
    function exameTexto(x) {
      return [R.pesoTexto(x) ? 'Peso ' + R.pesoTexto(x) : '', x.temperatura ? 'Temperatura ' + String(x.temperatura).replace('.', ',') + ' °C' : '', x.fc ? 'FC ' + x.fc + ' bpm' : '', x.fr ? 'FR ' + x.fr + ' mpm' : '', x.mucosas ? 'Mucosas ' + x.mucosas : ''].filter(Boolean).join(' · ');
    }
    function paraImpressao(x, pet, t, p) {
      var linhas = [['Data', UI.fmt.data(x.data)], ['Pet', pet.nome + ' (' + [pet.especie, pet.raca].filter(Boolean).join(', ') + ')'], ['Tutor', t ? t.nome : ''], ['Profissional', p ? p.nome + (p.registro ? ' · ' + p.registro : '') : ''],
        ['Queixa', x.queixa], ['Anamnese', x.anamnese]].concat(R.camposExtras(EXTRAS, x), [['Exame físico', exameTexto(x)], ['Diagnóstico', x.diagnostico], ['Conduta e tratamento', x.conduta], ['Prescrição', x.prescricao], ['Retorno previsto', x.retornoEm ? UI.fmt.data(x.retornoEm) : ''], ['Observações', x.obs]]).filter(function (l) { return l[1]; });
      return h('article', { class: 'impressao' }, h('h1', { text: 'Registro de atendimento' }), h('p', { class: 'mudo', text: 'Documento interno da clínica. Não substitui receituário nem laudo.' }),
        h('dl', { class: 'dl-ficha' }, linhas.map(function (l) { return [h('dt', { text: l[0] }), h('dd', { text: l[1] })]; })));
    }

    function form(m, existente, base) {
      var vets = m.profissionais_lista.filter(function (p) { return p.ativo !== false; });
      var consultaId = existente ? existente.consultaId : (ctx.params.consulta || '');
      var consulta = consultaId && m.consultas[consultaId];
      var valores = existente || { data: ctx.hoje(), profissionalId: consulta ? consulta.profissionalId : (vets.length === 1 ? vets[0].id : ''), queixa: consulta ? (consulta.motivo || '') : '' };
      if (!existente) EXTRAS.forEach(function (d) { var pet = m.pets[petAtual]; if (pet && pet[d.nome]) valores[d.nome] = pet[d.nome]; }); // parte do que está no cadastro do pet; o veterinário confere
      var pesoCampo = PC.pesoEmGramas ? { nome: 'pesoG', rotulo: 'Peso (g)', tipo: 'number', min: 0, step: 1, largura: 'terco' } : { nome: 'pesoKg', rotulo: 'Peso (kg)', tipo: 'number', min: 0, step: 0.01, largura: 'terco' };
      return UI.abrirFormulario({
        titulo: existente ? 'Editar registro' : 'Novo registro de atendimento', valores: valores, larga: true,
        aviso: 'Registro clínico: dados sensíveis. Escreva apenas o necessário ao atendimento.',
        campos: [
          { nome: 'data', rotulo: 'Data', tipo: 'date', requerido: true, largura: 'meia' },
          { nome: 'profissionalId', rotulo: 'Profissional', tipo: 'select', requerido: true, largura: 'meia', opcoes: vets.map(function (p) { return { valor: p.id, rotulo: p.nome }; }) },
          { nome: 'queixa', rotulo: 'Queixa principal', requerido: true },
          { nome: 'anamnese', rotulo: 'Anamnese', tipo: 'textarea', linhas: 3 }
        ].concat(EXTRAS, [
          pesoCampo,
          { nome: 'temperatura', rotulo: 'Temperatura (°C)', tipo: 'number', min: 0, step: 0.1, largura: 'terco' },
          { nome: 'fc', rotulo: 'FC (bpm)', tipo: 'number', min: 0, largura: 'terco' },
          { nome: 'fr', rotulo: 'FR (mpm)', tipo: 'number', min: 0, largura: 'terco' },
          { nome: 'mucosas', rotulo: 'Mucosas', largura: 'terco' },
          { nome: 'diagnostico', rotulo: 'Diagnóstico', tipo: 'textarea', linhas: 2 },
          { nome: 'conduta', rotulo: 'Conduta e tratamento', tipo: 'textarea', linhas: 2 },
          { nome: 'prescricao', rotulo: 'Prescrição', tipo: 'textarea', linhas: 2 },
          { nome: 'retornoEm', rotulo: 'Retorno previsto', tipo: 'date', largura: 'meia', ajuda: 'Gera lembrete em Vacinas e retornos.' },
          { nome: 'obs', rotulo: 'Observações', largura: 'meia' }
        ]),
        aoSalvar: function (v) {
          var reg = Object.assign({}, existente || {}, v, { petId: petAtual, consultaId: consultaId || '' });
          return ctx.store.salvar('prontuarios', reg).then(function () {
            var tarefas = [];
            if (consulta && consulta.status === 'em_atendimento') tarefas.push(ctx.store.salvar('consultas', Object.assign({}, consulta, { status: 'concluida' })));
            return Promise.all(tarefas);
          }).then(function () { UI.toast(existente ? 'Registro atualizado.' : 'Registro salvo.' + (v.retornoEm ? ' Retorno incluído nos lembretes.' : '')); });
        }
      }).then(function (salvou) { if (salvou) { if (ctx.params.consulta) { delete ctx.params.consulta; delete ctx.params.novo; } return desenhar(); } });
    }

    return desenhar().then(function () {
      if (ctx.params.novo && petAtual && escreve) return ctx.mapa(['pets', 'tutores', 'profissionais', 'prontuarios', 'consultas']).then(function (m) { return form(m, null, {}); });
    });
  }

  window.Painel.registrar({ id: 'prontuarios', titulo: 'Prontuários', icone: 'prontuarios', render: render });
})();
