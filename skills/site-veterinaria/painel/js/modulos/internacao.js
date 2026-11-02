/* Internação e plantão (subtipo hospital24h): mapa de leitos, pacientes internados com as observações do plantão, escala de plantão
   e folha de passagem para imprimir. Dono e veterinário (a recepção não acessa por padrão: são dados clínicos). Excluir é só do dono.
   Opção `recepcao_ve_leitos` (v0.7): a recepção, com a tela só para leitura, vê apenas o mapa de leitos recortado (paciente, tutor e entrada): `renderRestrita`.
   Coleções do subtipo (colecoesExtras): leitos, internacoes, evolucoes (observações), plantoes. Regras puras em regras.js. */
(function () {
  'use strict';
  var h = window.UI.h, UI = window.UI, R = window.Regras;
  var SITUACOES = ['Estável', 'Em observação', 'Requer atenção'];
  var TOM = { 'Estável': 'ok', 'Em observação': 'info', 'Requer atenção': 'aviso' };
  var TIPOS = ['Observação', 'Medicação', 'Alimentação e hidratação', 'Procedimento', 'Outro'];
  var DESFECHOS = ['Alta', 'Transferência', 'Óbito', 'Outro'];
  var COLS = ['leitos', 'internacoes', 'evolucoes', 'plantoes', 'pets', 'tutores', 'profissionais'];
  var aba = 'leitos', mostrar = 'ativas', termo = '';

  var porNome = function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { numeric: true }); };
  var opcoes = function (lista, rotulo) { return lista.map(function (x) { return { valor: x.id, rotulo: rotulo(x) }; }); };
  var textoOpcoes = function (lista) { return lista.map(function (x) { return { valor: x, rotulo: x }; }); };

  /* Visão restrita (recepção): quem está em qual leito, e nada do que é clínico. Trabalha só com a cópia recortada (R.internacoesParaPerfil) e nem carrega as
     observações, o plantão nem os profissionais; o observação do leito (`obs`) também fica de fora (pode dizer "isolamento"). Sem botões: é só leitura. */
  function renderRestrita(raiz, ctx) {
    var termo = '';
    return ctx.mapa(['leitos', 'internacoes', 'pets', 'tutores']).then(function (m) {
      var internacoes = R.internacoesParaPerfil(ctx.perfil, m.internacoes_lista).filter(R.internacaoAtiva);
      var leitos = m.leitos_lista.filter(function (l) { return l && typeof l === 'object'; }).sort(porNome);
      var nomePet = function (id) { var p = m.pets[id]; return p ? String(p.nome) : 'Pet removido'; };
      var nomeTutor = function (petId) { var p = m.pets[petId], t = p && m.tutores[p.tutorId]; return t ? String(t.nome) : ''; };
      var oc = R.ocupacaoLeitos(leitos, internacoes);
      UI.limpar(raiz);
      raiz.appendChild(UI.titulo('Quem está em cada leito', []));
      raiz.appendChild(h('p', { class: 'resumo-internacao', text: oc.total ? oc.ocupados + ' de ' + oc.total + (oc.total === 1 ? ' leito ocupado.' : ' leitos ocupados.') : 'Nenhum leito cadastrado.' }));
      raiz.appendChild(h('p', { class: 'nota-restrita', text: 'Visão da recepção: leito, paciente, tutor e hora da entrada. Motivo, situação, observações e plantão são da equipe veterinária.' }));
      if (!leitos.length) return;
      raiz.appendChild(UI.busca('Buscar por paciente, tutor ou leito', function (v) { termo = v; desenhar(); }, termo));
      var area = h('div', { class: 'lista-area' }); raiz.appendChild(area);
      function desenhar() {
        UI.limpar(area);
        var vis = R.buscar(leitos, termo, function (l) { var i = R.leitoOcupado(internacoes, l.id); return [l.nome, i ? nomePet(i.petId) : '', i ? nomeTutor(i.petId) : '']; });
        if (!vis.length) { area.appendChild(UI.vazio('Nenhum leito encontrado', '')); return; }
        area.appendChild(h('div', { class: 'leitos' }, vis.map(function (l) {
          var i = R.leitoOcupado(internacoes, l.id), inativo = l.ativo === false, corpo;
          if (i) {
            corpo = h('div', { class: 'leito-corpo leito-parado' }, h('strong', { class: 'leito-nome', text: String(l.nome) }),
              h('span', { class: 'leito-pet', text: nomePet(i.petId) + (nomeTutor(i.petId) ? ' (' + nomeTutor(i.petId) + ')' : '') }),
              h('span', { class: 'leito-meta', text: 'Desde ' + UI.fmt.dataHora(i.entradaEm) + ' · ' + ((R.tempoInternado(i.entradaEm, R.agoraISO()) || {}).texto || '') }));
          } else corpo = h('div', { class: 'leito-corpo leito-parado' }, h('strong', { class: 'leito-nome', text: String(l.nome) }), inativo ? UI.chip('Desativado', 'neutro') : UI.chip('Livre', 'ok'));
          return h('div', { class: 'leito' + (i ? ' leito--ocupado' : '') + (inativo ? ' leito--inativo' : ''), 'data-leito': l.id }, corpo, UI.marcaExemplo(i || l));
        })));
      }
      desenhar();
    });
  }

  function render(raiz, ctx) {
    if (R.visaoRestritaInternacao(ctx.perfil)) return renderRestrita(raiz, ctx);
    var escreve = ctx.podeEscrever('internacao'), excluir = ctx.podeExcluir('internacao');
    if (['leitos', 'internados', 'plantao'].indexOf(ctx.params.aba) !== -1) aba = ctx.params.aba; // atalhos do Início (#/internacao?aba=plantao)

    function carregar() { return ctx.mapa(COLS); }
    var nomePet = function (m, id) { var p = m.pets[id]; return p ? p.nome : 'Pet removido'; };
    var nomeTutor = function (m, petId) { var p = m.pets[petId], t = p && m.tutores[p.tutorId]; return t ? t.nome : ''; };
    var nomeProf = function (m, id) { var p = m.profissionais[id]; return p ? p.nome : ''; };
    var nomeLeito = function (m, id) { var l = m.leitos[id]; return l ? l.nome : 'Leito removido'; };
    var agora = function () { return R.agoraISO(); };

    function desenhar() {
      return carregar().then(function (m) {
        UI.limpar(raiz);
        var acoes = [];
        if (escreve) {
          acoes.push(UI.botao('Internar paciente', function () { formInternacao(m, {}); }, { icone: 'mais' }));
          acoes.push(UI.botao('Novo leito', function () { formLeito(m, null); }, { classe: 'btn-sec', icone: 'internacao' }));
        }
        raiz.appendChild(UI.titulo('Internação e plantão', acoes));
        var oc = R.ocupacaoLeitos(m.leitos_lista, m.internacoes_lista), plant = R.plantonistasAgora(m.plantoes_lista, agora());
        raiz.appendChild(h('p', { class: 'resumo-internacao', text: (oc.total ? oc.ocupados + ' de ' + oc.total + (oc.total === 1 ? ' leito ocupado' : ' leitos ocupados') + '. ' : 'Nenhum leito cadastrado. ') +
          (plant.length ? 'No plantão agora: ' + plant.map(function (p) { return nomeProf(m, p.profissionalId) || 'profissional removido'; }).join(', ') + '.' : 'Nenhum plantão registrado para agora.') }));
        raiz.appendChild(UI.abas([{ id: 'leitos', rotulo: 'Leitos' }, { id: 'internados', rotulo: 'Internações' }, { id: 'plantao', rotulo: 'Plantão' }], aba, function (id) { aba = id; desenhar(); }));
        var area = UI.painelAba(aba); raiz.appendChild(area);
        if (aba === 'leitos') abaLeitos(m, area); else if (aba === 'internados') abaInternacoes(m, area); else abaPlantao(m, area);
      });
    }

    /* ---------- leitos ---------- */
    function abaLeitos(m, area) {
      var leitos = m.leitos_lista.slice().sort(porNome);
      if (!leitos.length) {
        area.appendChild(UI.vazio('Nenhum leito cadastrado', escreve ? 'Cadastre os leitos da clínica (baias, gaiolas, isolamento) com "Novo leito" para ver quem está em cada um.' : ''));
        return;
      }
      area.appendChild(h('div', { class: 'leitos' }, leitos.map(function (l) {
        var i = R.leitoOcupado(m.internacoes_lista, l.id), inativo = l.ativo === false;
        var corpo;
        if (i) {
          corpo = h('button', { type: 'button', class: 'leito-corpo', on: { click: function () { detalhe(i.id); } } },
            h('strong', { class: 'leito-nome', text: l.nome }),
            h('span', { class: 'leito-pet', text: nomePet(m, i.petId) + (nomeTutor(m, i.petId) ? ' (' + nomeTutor(m, i.petId) + ')' : '') }),
            h('span', { class: 'leito-meta', text: 'Desde ' + UI.fmt.dataHora(i.entradaEm) + ' · ' + ((R.tempoInternado(i.entradaEm, agora()) || {}).texto || '') }),
            h('span', { class: 'leito-meta', text: nomeProf(m, i.responsavelId) ? 'Responsável: ' + nomeProf(m, i.responsavelId) : 'Sem responsável' }),
            i.situacao ? UI.chip(i.situacao, TOM[i.situacao] || 'neutro') : null);
        } else if (inativo) {
          corpo = h('div', { class: 'leito-corpo leito-parado' }, h('strong', { class: 'leito-nome', text: l.nome }), UI.chip('Desativado', 'neutro'));
        } else if (escreve) {
          corpo = h('button', { type: 'button', class: 'leito-corpo', on: { click: function () { formInternacao(m, { leitoId: l.id }); } } },
            h('strong', { class: 'leito-nome', text: l.nome }), h('span', { class: 'leito-meta', text: 'Livre. Toque para internar aqui.' }), UI.chip('Livre', 'ok'));
        } else {
          corpo = h('div', { class: 'leito-corpo leito-parado' }, h('strong', { class: 'leito-nome', text: l.nome }), UI.chip('Livre', 'ok'));
        }
        return h('div', { class: 'leito' + (i ? ' leito--ocupado' : '') + (inativo ? ' leito--inativo' : ''), 'data-leito': l.id },
          corpo, h('p', { class: 'leito-obs', text: l.obs || '' }), UI.marcaExemplo(l),
          escreve ? UI.botao('Editar leito', function () { formLeito(m, l); }, { classe: 'btn-sec btn-peq', aria: 'Editar ' + l.nome }) : null);
      })));
    }

    /* ---------- internações ---------- */
    function abaInternacoes(m, area) {
      var ativas = m.internacoes_lista.filter(R.internacaoAtiva), encerradas = m.internacoes_lista.filter(function (i) { return !R.internacaoAtiva(i); });
      area.appendChild(h('div', { class: 'filtros', role: 'group', 'aria-label': 'Filtrar internações' }, [['ativas', 'Internados agora (' + ativas.length + ')'], ['encerradas', 'Encerradas (' + encerradas.length + ')']].map(function (f) {
        return h('button', { type: 'button', class: 'chip-botao', 'aria-pressed': String(mostrar === f[0]), on: { click: function () { mostrar = f[0]; desenhar().then(function () { var b = raiz.querySelector('.filtros .chip-botao[aria-pressed="true"]'); if (b) b.focus(); }); } } }, f[1]);
      })));
      area.appendChild(UI.busca('Buscar por paciente, tutor ou leito', function (v) { termo = v; lista(); }, termo));
      var caixa = h('div', { class: 'lista-area' }); area.appendChild(caixa);
      function lista() {
        UI.limpar(caixa);
        var base = mostrar === 'ativas' ? ativas : encerradas;
        var vis = R.buscar(base, termo, function (i) { return [nomePet(m, i.petId), nomeTutor(m, i.petId), nomeLeito(m, i.leitoId), i.motivo]; })
          .sort(function (a, b) { return a.entradaEm < b.entradaEm ? 1 : -1; });
        var cols = [
          { rotulo: 'Paciente', render: function (i) { return h('span', null, nomePet(m, i.petId), ' ', UI.marcaExemplo(i), nomeTutor(m, i.petId) ? h('small', { class: 'bloco-sub', text: nomeTutor(m, i.petId) }) : null); } },
          { rotulo: 'Leito', render: function (i) { return nomeLeito(m, i.leitoId); } },
          { rotulo: 'Entrada', render: function (i) { return UI.fmt.dataHora(i.entradaEm); } }
        ];
        if (mostrar === 'ativas') {
          cols.push({ rotulo: 'Tempo', render: function (i) { return (R.tempoInternado(i.entradaEm, agora()) || {}).texto || '-'; } });
          cols.push({ rotulo: 'Situação', render: function (i) { return i.situacao ? UI.chip(i.situacao, TOM[i.situacao] || 'neutro') : '-'; } });
          cols.push({ rotulo: 'Responsável', render: function (i) { return nomeProf(m, i.responsavelId) || '-'; } });
        } else {
          cols.push({ rotulo: 'Saída', render: function (i) { return UI.fmt.dataHora(i.saidaEm); } });
          cols.push({ rotulo: 'Desfecho', render: function (i) { return i.desfecho || '-'; } });
        }
        caixa.appendChild(UI.tabela({
          linhas: vis, vazio: termo ? 'Nenhuma internação encontrada.' : mostrar === 'ativas' ? 'Nenhum paciente internado agora.' : 'Nenhuma internação encerrada.',
          vazioTexto: !termo && mostrar === 'ativas' && escreve ? 'Use "Internar paciente" para registrar a entrada em um leito.' : '',
          aoClicarLinha: function (i) { detalhe(i.id); }, colunas: cols
        }));
      }
      lista();
    }

    /* ---------- plantão ---------- */
    function abaPlantao(m, area) {
      var plant = R.plantonistasAgora(m.plantoes_lista, agora());
      area.appendChild(h('section', { class: 'bloco' }, h('h2', { text: 'No plantão agora' }),
        plant.length ? h('ul', { class: 'lista-simples-painel' }, plant.map(function (p) {
          var prof = m.profissionais[p.profissionalId];
          return h('li', null, h('strong', { text: prof ? prof.nome : 'Profissional removido' }), prof && prof.funcao ? ' · ' + prof.funcao : '', ' até ' + UI.fmt.dataHora(p.fim), ' ', UI.marcaExemplo(p),
            p.obs ? h('small', { class: 'bloco-sub', text: p.obs }) : null);
        })) : h('p', { class: 'mudo', text: 'Nenhum plantão registrado para este momento.' }),
        h('div', { class: 'linha-botoes-painel' },
          escreve ? UI.botao('Registrar plantão', function () { formPlantao(m, null); }, { icone: 'mais' }) : null,
          UI.botao('Imprimir folha de passagem', function () { UI.imprimir(folhaDePassagem(m)); }, { classe: 'btn-sec' }))));
      var todos = m.plantoes_lista.filter(function (p) { return p && p.inicio; }).sort(function (a, b) { return a.inicio < b.inicio ? 1 : -1; }).slice(0, 40);
      area.appendChild(UI.tabela({
        linhas: todos, vazio: 'Nenhum plantão registrado.', vazioTexto: escreve ? 'Registre quem está de plantão e anote a passagem de plantão.' : '',
        aoClicarLinha: escreve ? function (p) { formPlantao(m, p); } : null,
        colunas: [
          { rotulo: 'Início', render: function (p) { return UI.fmt.dataHora(p.inicio); } },
          { rotulo: 'Fim', render: function (p) { return UI.fmt.dataHora(p.fim); } },
          { rotulo: 'Profissional', render: function (p) { return h('span', null, nomeProf(m, p.profissionalId) || 'Profissional removido', ' ', UI.marcaExemplo(p)); } },
          { rotulo: 'Passagem de plantão', render: function (p) { return p.obs || '-'; } }
        ]
      }));
    }

    function ultimaObservacao(m, internacaoId) {
      return m.evolucoes_lista.filter(function (e) { return e.internacaoId === internacaoId; }).sort(function (a, b) { return a.em < b.em ? 1 : -1; })[0] || null;
    }
    function folhaDePassagem(m) {
      var ativas = m.internacoes_lista.filter(R.internacaoAtiva).sort(function (a, b) { return nomeLeito(m, a.leitoId).localeCompare(nomeLeito(m, b.leitoId), 'pt-BR', { numeric: true }); });
      var plant = R.plantonistasAgora(m.plantoes_lista, agora());
      var corpo = ativas.length ? ativas.map(function (i) {
        var u = ultimaObservacao(m, i.id);
        var linhas = [['Leito', nomeLeito(m, i.leitoId)], ['Paciente', nomePet(m, i.petId) + (nomeTutor(m, i.petId) ? ' (tutor: ' + nomeTutor(m, i.petId) + ')' : '')],
          ['Entrada', UI.fmt.dataHora(i.entradaEm) + ' · ' + ((R.tempoInternado(i.entradaEm, agora()) || {}).texto || '')], ['Responsável', nomeProf(m, i.responsavelId)], ['Situação', i.situacao], ['Motivo', i.motivo],
          ['Previsão de alta', i.previsaoAlta ? UI.fmt.data(i.previsaoAlta) : ''], ['Última observação', u ? UI.fmt.dataHora(u.em) + ' · ' + u.tipo + ': ' + u.texto : '']].filter(function (l) { return l[1]; });
        return h('section', { class: 'passagem-item' }, h('dl', { class: 'dl-ficha' }, linhas.map(function (l) { return [h('dt', { text: l[0] }), h('dd', { text: l[1] })]; })));
      }) : [h('p', { text: 'Nenhum paciente internado neste momento.' })];
      return h('article', { class: 'impressao' }, h('h1', { text: 'Folha de passagem de plantão' }),
        h('p', { class: 'mudo', text: 'Emitida em ' + UI.fmt.dataHora(agora()) + '. Documento interno da clínica; não substitui o prontuário.' }),
        h('p', { text: plant.length ? 'No plantão: ' + plant.map(function (p) { return nomeProf(m, p.profissionalId) || 'profissional removido'; }).join(', ') + '.' : 'Plantão não registrado para este momento.' }), corpo);
    }

    /* ---------- detalhe da internação ---------- */
    function detalhe(id) {
      return carregar().then(function (m) {
        var i = m.internacoes[id];
        if (!i) { UI.toast('Internação não encontrada.', 'erro'); return desenhar(); }
        var ativa = R.internacaoAtiva(i), t = m.tutores[(m.pets[i.petId] || {}).tutorId];
        var obs = m.evolucoes_lista.filter(function (e) { return e.internacaoId === id; }).sort(function (a, b) { return a.em < b.em ? 1 : -1; });
        var linhas = [['Paciente', nomePet(m, i.petId)], ['Tutor', t ? t.nome + (t.telefone ? ' · ' + t.telefone : '') : ''], ['Leito', nomeLeito(m, i.leitoId)], ['Entrada', UI.fmt.dataHora(i.entradaEm)],
          ['Tempo', ativa ? (R.tempoInternado(i.entradaEm, agora()) || {}).texto : ''], ['Responsável', nomeProf(m, i.responsavelId)], ['Situação', i.situacao], ['Motivo', i.motivo],
          ['Previsão de alta', i.previsaoAlta ? UI.fmt.data(i.previsaoAlta) : ''], ['Saída', ativa ? '' : UI.fmt.dataHora(i.saidaEm)], ['Desfecho', ativa ? '' : i.desfecho], ['Resumo da saída', ativa ? '' : i.resumoSaida]].filter(function (l) { return l[1]; });
        var corpo = h('div', null, h('p', null, UI.marcaExemplo(i), ativa ? null : UI.chip('Encerrada', 'neutro')),
          h('dl', { class: 'dl-ficha' }, linhas.map(function (l) { return [h('dt', { text: l[0] }), h('dd', { text: l[1] })]; })),
          h('h3', { text: 'Observações do plantão' }),
          obs.length ? h('ul', { class: 'lista-simples-painel observacoes' }, obs.map(function (e) {
            return h('li', null, h('strong', { text: UI.fmt.dataHora(e.em) }), ' ', UI.chip(e.tipo || 'Observação', 'neutro'), nomeProf(m, e.profissionalId) ? ' ' + nomeProf(m, e.profissionalId) : '', ' ', UI.marcaExemplo(e),
              h('span', { class: 'bloco-sub', text: e.texto || '' }),
              excluir ? UI.botao('Excluir', function () {
                UI.confirmar('Excluir esta observação? Não dá para desfazer.', { ok: 'Excluir', perigo: true }).then(function (sim) {
                  if (!sim) return;
                  api.fechar(); // sem isto o detalhe antigo ficava aberto embaixo do novo, ainda mostrando a observação apagada
                  ctx.store.remover('evolucoes', e.id).then(function () { UI.toast('Observação excluída.'); return desenhar().then(function () { return detalhe(id); }); });
                });
              }, { classe: 'btn-perigo btn-peq', aria: 'Excluir a observação de ' + UI.fmt.dataHora(e.em) }) : null);
          })) : h('p', { class: 'mudo', text: 'Nenhuma observação registrada.' }));
        var acoes = [];
        var api;
        if (escreve && ativa) {
          acoes.push({ texto: 'Registrar observação', aoClicar: function (a) { a.fechar(); formObservacao(m, i); } });
          acoes.push({ texto: 'Editar internação', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); formInternacao(m, i); } });
          acoes.push({ texto: 'Encerrar internação', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); formEncerrar(m, i); } });
        }
        if (ctx.pode('prontuarios')) acoes.push({ texto: 'Prontuário', classe: 'btn-sec', aoClicar: function (a) { a.fechar(); ctx.navegar('prontuarios', { pet: i.petId }); } });
        if (excluir) acoes.push({ texto: 'Excluir internação', classe: 'btn-perigo', aoClicar: function (a) {
          a.fechar();
          UI.confirmar('Excluir esta internação e as ' + obs.length + ' observação(ões) dela? Não dá para desfazer.', { ok: 'Excluir', perigo: true, titulo: 'Excluir internação' }).then(function (sim) {
            if (!sim) return;
            Promise.all(obs.map(function (e) { return ctx.store.remover('evolucoes', e.id); }).concat([ctx.store.remover('internacoes', id)])).then(function () { UI.toast('Internação excluída.'); return desenhar(); });
          });
        } });
        api = UI.modal({ titulo: 'Internação: ' + nomePet(m, i.petId), corpo: corpo, acoes: acoes, larga: true });
        return api;
      });
    }

    /* ---------- formulários ---------- */
    /* O formulário guarda a internação de quando abriu. Antes de gravar lê a ATUAL: se foi excluída ou encerrada por outra pessoa (outra aba, outro computador
       no mesmo navegador), recusa em vez de recriar, reabrir ou deixar observação órfã. */
    function internacaoAtual(i, aindaAtiva) {
      return ctx.store.obter('internacoes', i.id).then(function (atual) {
        if (!atual) throw new Error('Esta internação não existe mais (foi excluída em outra aba). Feche esta janela e atualize a tela.');
        if (aindaAtiva && !R.internacaoAtiva(atual)) throw new Error('Esta internação já foi encerrada em outra aba. Feche esta janela e atualize a tela.');
        if (!aindaAtiva && R.internacaoAtiva(atual) !== R.internacaoAtiva(i)) throw new Error('A situação desta internação mudou em outra aba. Feche esta janela e abra de novo.');
        return atual;
      });
    }
    function aposSalvar(id) { return function (salvou) { if (salvou) return desenhar().then(function () { return id ? detalhe(id) : null; }); }; }

    function formInternacao(m, i) {
      var existente = !!i.id, pets = m.pets_lista.filter(function (p) { return !p.falecido || (existente && p.id === i.petId); }).sort(porNome);
      var leitos = m.leitos_lista.filter(function (l) { return l.ativo !== false || l.id === i.leitoId; }).sort(porNome);
      var vets = m.profissionais_lista.filter(function (p) { return (p.ativo !== false && p.funcao !== 'Recepção') || p.id === i.responsavelId; }); // o responsável atual fica na lista mesmo desativado (senão salvar sem mexer apagava o campo)
      if (!pets.length) { UI.toast('Cadastre o paciente em "Tutores e pets" antes de internar.', 'erro'); return Promise.resolve(); }
      if (!leitos.length) { UI.toast('Cadastre ao menos um leito antes de internar.', 'erro'); return Promise.resolve(); }
      var valores = existente ? i : Object.assign({ entradaEm: agora(), situacao: SITUACOES[0] }, i);
      return UI.abrirFormulario({
        titulo: existente ? 'Editar internação' : 'Internar paciente', larga: true, valores: valores,
        aviso: 'Registro clínico: dados sensíveis. Escreva apenas o necessário ao atendimento.',
        campos: [
          { nome: 'petId', rotulo: 'Paciente', tipo: 'select', requerido: true, opcoes: opcoes(pets, function (p) { return ctx.rotuloPet(p, m.tutores); }) },
          { nome: 'leitoId', rotulo: 'Leito', tipo: 'select', requerido: true, largura: 'meia', opcoes: opcoes(leitos, function (l) { return l.nome + (R.leitoOcupado(m.internacoes_lista, l.id, i.id) ? ' (ocupado)' : '') + (l.ativo === false ? ' (desativado)' : ''); }) },
          { nome: 'entradaEm', rotulo: 'Entrada', tipo: 'datetime-local', requerido: true, largura: 'meia' },
          { nome: 'responsavelId', rotulo: 'Responsável pela internação', tipo: 'select', largura: 'meia', vazio: 'Sem responsável definido', opcoes: opcoes(vets, function (p) { return p.nome; }) },
          { nome: 'situacao', rotulo: 'Situação', tipo: 'select', largura: 'meia', opcoes: textoOpcoes(SITUACOES) },
          { nome: 'motivo', rotulo: 'Motivo da internação', tipo: 'textarea', linhas: 2 },
          { nome: 'previsaoAlta', rotulo: 'Previsão de alta', tipo: 'date', largura: 'meia', ajuda: 'Só uma previsão da equipe; não é promessa ao tutor.' }
        ],
        aoSalvar: function (v) {
          return (existente ? internacaoAtual(i, true) : Promise.resolve(null)).then(function (atual) {
            var reg = Object.assign({}, atual || {}, v, { status: atual ? atual.status : 'internado' });
            var erro = R.validarInternacao(reg); if (erro) throw new Error(erro);
            return conferirEGravar(reg);
          });
        }
      }).then(function (salvou) { if (salvou) return desenhar().then(function () { return i && i.id ? detalhe(i.id) : null; }); });
      function conferirEGravar(reg) {
          return ctx.store.listar('internacoes').then(function (todas) { // lista fresca: outra pessoa pode ter ocupado o leito depois que o formulário abriu
            var c1 = R.leitoOcupado(todas, reg.leitoId, reg.id), c2 = R.petInternado(todas, reg.petId, reg.id);
            if (c1) throw new Error('O leito ' + nomeLeito(m, reg.leitoId) + ' já está ocupado por ' + nomePet(m, c1.petId) + '.');
            if (c2) throw new Error(nomePet(m, reg.petId) + ' já está internado no leito ' + nomeLeito(m, c2.leitoId) + '.');
            return ctx.store.salvar('internacoes', reg);
          }).then(function (salvo) { i = salvo; UI.toast(existente ? 'Internação atualizada.' : 'Paciente internado.'); });
      }
    }

    function formObservacao(m, i) {
      var quem = m.profissionais_lista.filter(function (p) { return p.ativo !== false; });
      var plant = R.plantonistasAgora(m.plantoes_lista, agora())[0];
      return UI.abrirFormulario({
        titulo: 'Observação: ' + nomePet(m, i.petId), larga: true, valores: { em: agora(), tipo: TIPOS[0], profissionalId: (plant && plant.profissionalId) || i.responsavelId || '' },
        campos: [
          { nome: 'em', rotulo: 'Data e hora', tipo: 'datetime-local', requerido: true, largura: 'meia' },
          { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', requerido: true, largura: 'meia', opcoes: textoOpcoes(TIPOS) },
          { nome: 'profissionalId', rotulo: 'Registrado por', tipo: 'select', vazio: 'Não informado', opcoes: opcoes(quem, function (p) { return p.nome; }) },
          { nome: 'texto', rotulo: 'Observação', tipo: 'textarea', linhas: 4, requerido: true }
        ],
        aoSalvar: function (v) {
          var reg = Object.assign({}, v, { internacaoId: i.id }); var erro = R.validarObservacao(reg); if (erro) throw new Error(erro);
          return internacaoAtual(i, true).then(function () { return ctx.store.salvar('evolucoes', reg); }).then(function () { UI.toast('Observação registrada.'); });
        }
      }).then(aposSalvar(i.id));
    }

    function formEncerrar(m, i) {
      var campos = [
        { nome: 'saidaEm', rotulo: 'Saída', tipo: 'datetime-local', requerido: true, largura: 'meia' },
        { nome: 'desfecho', rotulo: 'Desfecho', tipo: 'select', requerido: true, largura: 'meia', opcoes: textoOpcoes(DESFECHOS), ajuda: 'Com "Óbito" o pet é marcado como falecido no cadastro (para de gerar lembretes e mensagens ao tutor).' },
        { nome: 'resumoSaida', rotulo: 'Resumo da saída', tipo: 'textarea', linhas: 3 }
      ];
      return UI.abrirFormulario({
        titulo: 'Encerrar internação: ' + nomePet(m, i.petId), larga: true, valores: { saidaEm: agora(), desfecho: DESFECHOS[0] }, campos: campos, textoSalvar: 'Encerrar internação',
        aoSalvar: function (v) {
          return internacaoAtual(i, true).then(function (atual) {
            var reg = Object.assign({}, atual, { status: 'encerrada', saidaEm: v.saidaEm, desfecho: v.desfecho, resumoSaida: v.resumoSaida });
            var erro = R.validarInternacao(reg); if (erro) throw new Error(erro);
            return ctx.store.salvar('internacoes', reg);
          }).then(function () {
            if (v.desfecho !== 'Óbito') return null;
            return ctx.store.obter('pets', i.petId).then(function (pet) { return pet && !pet.falecido ? ctx.store.salvar('pets', Object.assign({}, pet, { falecido: true })) : null; });
          }).then(function () { UI.toast(v.desfecho === 'Óbito' ? 'Internação encerrada e pet marcado como falecido.' : 'Internação encerrada. O leito está livre.'); });
        }
      }).then(aposSalvar(i.id));
    }

    function formLeito(m, l) {
      return UI.abrirFormulario({
        titulo: l ? 'Editar leito' : 'Novo leito', valores: l || { ativo: true },
        campos: [
          { nome: 'nome', rotulo: 'Nome do leito', requerido: true, placeholder: 'Ex.: Leito 1, Isolamento' },
          { nome: 'obs', rotulo: 'Observação', ajuda: 'Opcional. Aparece no mapa de leitos.' },
          { nome: 'ativo', rotulo: 'Ativo (aparece para novas internações)', tipo: 'checkbox' }
        ],
        aoExcluir: l && excluir ? function () {
          if (m.internacoes_lista.some(function (i) { return i.leitoId === l.id; })) throw new Error('Há internações (inclusive encerradas) neste leito. Em vez de excluir, desmarque "Ativo".');
          return ctx.store.remover('leitos', l.id);
        } : null,
        aoSalvar: function (v) {
          if (!String(v.nome || '').trim()) throw new Error('Informe o nome do leito.');
          if (l && v.ativo === false && R.leitoOcupado(m.internacoes_lista, l.id)) throw new Error('Há um paciente internado neste leito. Encerre a internação antes de desativá-lo.');
          return ctx.store.salvar('leitos', Object.assign({}, l || {}, v)).then(function () { UI.toast('Leito salvo.'); });
        }
      }).then(function (salvou) { if (salvou) return desenhar(); });
    }

    function formPlantao(m, p) {
      var quem = m.profissionais_lista.filter(function (x) { return x.ativo !== false; });
      return UI.abrirFormulario({
        titulo: p ? 'Editar plantão' : 'Registrar plantão', larga: true, valores: p || { inicio: agora(), fim: '' },
        campos: [
          { nome: 'profissionalId', rotulo: 'Profissional', tipo: 'select', requerido: true, opcoes: opcoes(quem, function (x) { return x.nome + (x.funcao ? ' (' + x.funcao + ')' : ''); }) },
          { nome: 'inicio', rotulo: 'Início', tipo: 'datetime-local', requerido: true, largura: 'meia' },
          { nome: 'fim', rotulo: 'Fim', tipo: 'datetime-local', requerido: true, largura: 'meia' },
          { nome: 'obs', rotulo: 'Passagem de plantão', tipo: 'textarea', linhas: 3, ajuda: 'O que o próximo plantão precisa saber.' }
        ],
        aoExcluir: p && excluir ? function () { return ctx.store.remover('plantoes', p.id); } : null,
        aoSalvar: function (v) {
          var reg = Object.assign({}, p || {}, v); var erro = R.validarPlantao(reg); if (erro) throw new Error(erro);
          return ctx.store.salvar('plantoes', reg).then(function () { UI.toast('Plantão salvo.'); });
        }
      }).then(function (salvou) { if (salvou) return desenhar(); });
    }

    return desenhar().then(function () {
      if (ctx.params.novo && escreve) {
        var pet = ctx.params.pet; delete ctx.params.novo; delete ctx.params.pet; // o pet vem só na primeira abertura (atalho da ficha do pet)
        return carregar().then(function (m) { return formInternacao(m, pet ? { petId: pet } : {}); });
      }
    });
  }

  /* o menu da recepção (visão restrita) diz "Leitos": é o que a tela mostra */
  window.Painel.registrar({ id: 'internacao', titulo: 'Internação e plantão', tituloPara: function (perfil) { return R.visaoRestritaInternacao(perfil) ? 'Leitos' : null; }, icone: 'internacao', render: render });
})();
