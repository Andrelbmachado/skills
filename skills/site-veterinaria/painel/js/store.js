/* store.js: camada de dados TROCÁVEL do painel.
   As telas só falam com `criarStore(adaptador)`. O adaptador é um objeto com 4 operações assíncronas (item a item, para caber em um servidor depois):
     listar(colecao) -> Promise<objeto[]>      gravar(colecao, objeto) -> Promise<void>
     excluir(colecao, id) -> Promise<void>     limpar(colecao) -> Promise<void>
   Opcional (v0.7): gravarLote(colecao, objetos[]) -> Promise<void>, para a importação não gravar item a item; sem ele a loja grava um por vez.
   Adaptadores prontos: memória (testes), localStorage (padrão), IndexedDB. Para ligar a um servidor, escreva um adaptador com fetch()
   que implemente essas 4 operações e passe em `criarStore`; nenhuma tela muda. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Store = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var COLECOES = ['usuarios', 'tutores', 'pets', 'profissionais', 'servicos', 'consultas', 'prontuarios', 'vacinas',
    'lembretes', 'lancamentos', 'estoque', 'movimentos', 'config'];
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  function adaptadorMemoria() {
    var d = {};
    var api = {
      nome: 'memoria',
      listar: function (col) { return Promise.resolve(clone(d[col] || [])); },
      gravar: function (col, item) {
        var l = d[col] = d[col] || [], i = l.findIndex(function (x) { return x.id === item.id; });
        if (i >= 0) l[i] = clone(item); else l.push(clone(item));
        return Promise.resolve();
      },
      /* lote: na memória cada item passa pelo `gravar` do próprio adaptador (custa pouco e permite simular falha de gravação nos testes) */
      gravarLote: function (col, itens) { return itens.reduce(function (q, it) { return q.then(function () { return api.gravar(col, it); }); }, Promise.resolve()); },
      excluir: function (col, id) { d[col] = (d[col] || []).filter(function (x) { return x.id !== id; }); return Promise.resolve(); },
      limpar: function (col) { d[col] = []; return Promise.resolve(); }
    };
    return api;
  }

  function adaptadorLocalStorage(prefixo, storage) {
    var st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!st) throw new Error('localStorage indisponível');
    var chave = function (col) { return prefixo + ':' + col; };
    var ler = function (col) { try { return JSON.parse(st.getItem(chave(col)) || '[]'); } catch (e) { return []; } };
    var escrever = function (col, l) {
      try { st.setItem(chave(col), JSON.stringify(l)); } catch (e) { throw new Error('Não foi possível salvar: o armazenamento do navegador está cheio ou bloqueado.'); }
    };
    var promessa = function (fn) { try { return Promise.resolve(fn()); } catch (e) { return Promise.reject(e); } }; // erro sempre vira rejeição
    return {
      nome: 'localStorage',
      listar: function (col) { return promessa(function () { return ler(col); }); },
      gravar: function (col, item) {
        return promessa(function () {
          var l = ler(col), i = l.findIndex(function (x) { return x.id === item.id; });
          if (i >= 0) l[i] = item; else l.push(item);
          escrever(col, l);
        });
      },
      /* Lote (v0.7): lê o grupo uma vez, funde por id (o que já existe é substituído, o novo entra no fim) e grava uma vez. Gravar item a item relia e
         regravava o grupo inteiro a cada registro: 3.000 registros levavam ~1,4 s e 6.000, ~5,5 s (crescia com o quadrado). */
      gravarLote: function (col, itens) {
        return promessa(function () {
          var l = ler(col), onde = Object.create(null);
          l.forEach(function (x, i) { if (x && typeof x.id === 'string') onde[x.id] = i; });
          itens.forEach(function (it) { if (it.id in onde) l[onde[it.id]] = it; else { onde[it.id] = l.length; l.push(it); } });
          escrever(col, l);
        });
      },
      excluir: function (col, id) { return promessa(function () { escrever(col, ler(col).filter(function (x) { return x.id !== id; })); }); },
      limpar: function (col) { return promessa(function () { st.removeItem(chave(col)); }); }
    };
  }

  /* `colecoes` (opcional): lista completa de coleções; o padrão é COLECOES. Um subtipo pode acrescentar as suas (ex.: internação). */
  function adaptadorIndexedDB(nomeBanco, idb, colecoes) {
    var api = idb || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    if (!api) throw new Error('IndexedDB indisponível');
    var lista = colecoes || COLECOES, conexao = null;
    function abrirVersao(versao) {
      return new Promise(function (res, rej) {
        var rq = versao ? api.open(nomeBanco, versao) : api.open(nomeBanco);
        rq.onupgradeneeded = function () { lista.forEach(function (c) { if (!rq.result.objectStoreNames.contains(c)) rq.result.createObjectStore(c, { keyPath: 'id' }); }); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { rej(rq.error); };
        rq.onblocked = function () { rej(new Error('Feche as outras abas deste painel para atualizar o armazenamento e tente de novo.')); };
      });
    }
    /* Abre a versão que já existe (ou cria a 1). Se faltar alguma coleção (banco criado antes de um subtipo ou de uma atualização),
       sobe a versão e cria só as que faltam, sem tocar nos dados. Antes a versão era fixa em 1 e coleção nova dava NotFoundError. */
    function abrir() {
      if (conexao) return conexao;
      conexao = abrirVersao().then(function (db) {
        var faltam = lista.filter(function (c) { return !db.objectStoreNames.contains(c); });
        if (!faltam.length) { db.onversionchange = function () { db.close(); conexao = null; }; return db; }
        var proxima = db.version + 1; db.close();
        return abrirVersao(proxima).then(function (db2) { db2.onversionchange = function () { db2.close(); conexao = null; }; return db2; });
      });
      conexao.catch(function () { conexao = null; });
      return conexao;
    }
    function tx(col, modo, fn) {
      return abrir().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction(col, modo), os = t.objectStore(col), out;
          t.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); };
          t.onerror = t.onabort = function () { rej(t.error || new Error('A gravação no armazenamento do navegador foi cancelada.')); };
          /* uma exceção síncrona no meio (ex.: `put` de registro sem id lança DataError) não aborta a transação sozinha: os `put` anteriores confirmariam. Aborta e rejeita. */
          try { out = fn(os); } catch (e) { try { t.abort(); } catch (e2) { /* já terminou */ } rej(e); }
        });
      });
    }
    return {
      nome: 'indexedDB',
      listar: function (col) { return tx(col, 'readonly', function (os) { return os.getAll(); }).then(function (r) { return r || []; }); },
      gravar: function (col, item) { return tx(col, 'readwrite', function (os) { os.put(item); }); },
      gravarLote: function (col, itens) { return tx(col, 'readwrite', function (os) { itens.forEach(function (it) { os.put(it); }); }); }, // uma transação: ou grava tudo ou nada (`tx` aborta se um `put` lançar)
      excluir: function (col, id) { return tx(col, 'readwrite', function (os) { os.delete(id); }); },
      limpar: function (col) { return tx(col, 'readwrite', function (os) { os.clear(); }); }
    };
  }

  /* ---------- validação da importação (o arquivo vem de fora: nada de confiar) ---------- */
  var CHAVES_PERIGOSAS = ['__proto__', 'constructor', 'prototype'];
  /* campos que as telas tratam como TEXTO (slice, split, localeCompare...): se vierem como número, objeto ou lista, a tela inteira quebra e o registro
     nem dá para corrigir pela interface. Por isso o arquivo é recusado antes de gravar. */
  var CAMPOS_TEXTO = {
    tutores: ['nome', 'telefone', 'email', 'endereco', 'observacoes'], pets: ['nome', 'especie', 'raca', 'sexo', 'nascimento', 'microchip', 'tutorId'],
    profissionais: ['nome', 'funcao', 'registro'], servicos: ['nome'], consultas: ['inicio', 'petId', 'profissionalId', 'status', 'motivo'],
    prontuarios: ['data', 'petId', 'queixa', 'retornoEm', 'profissionalId'], vacinas: ['vacina', 'dataAplicacao', 'proximaDose', 'petId'], lembretes: ['chave'],
    lancamentos: ['data', 'descricao', 'tipo', 'forma', 'itemId'], estoque: ['nome', 'categoria', 'unidade', 'validade'], movimentos: ['itemId', 'tipo', 'data'],
    leitos: ['nome', 'obs'], internacoes: ['petId', 'leitoId', 'entradaEm', 'saidaEm', 'status', 'responsavelId', 'previsaoAlta', 'situacao', 'desfecho', 'motivo'],
    evolucoes: ['internacaoId', 'em', 'texto', 'tipo', 'profissionalId'], plantoes: ['profissionalId', 'inicio', 'fim', 'obs'],
    exames: ['petId', 'servicoId', 'encaminhadorId', 'status', 'solicitadoEm', 'consultaId', 'realizadoEm', 'responsavelId', 'laudoEm', 'laudoPorId', 'laudo', 'indicacao', 'entregueEm', 'entregaVia', 'obs'],
    encaminhadores: ['nome', 'tipo', 'telefone', 'email', 'condicoes', 'obs']
  };
  /* valores em centavos: se vierem como texto ou objeto o caixa soma "0abc" e o preço de venda vira NaN. Recusados antes de gravar (inteiro, 0 ou mais; null/ausente vale como vazio). */
  var TETO_CENTAVOS = 9999999999; // R$ 99.999.999,99, o mesmo teto de parseBRL e de regras.js (o store não depende de regras)
  var CAMPOS_CENTAVOS = { estoque: ['precoVendaCents'], lancamentos: ['valorCents'] };
  var CAMPOS_DATA_HORA = { internacoes: ['entradaEm', 'saidaEm'], evolucoes: ['em'], plantoes: ['inicio', 'fim'], exames: ['solicitadoEm', 'realizadoEm', 'laudoEm', 'entregueEm'] };
  /* sem estes campos a tela quebra (ordenar por nome, cortar a data) e a interface não deixa corrigir o registro: o arquivo é recusado antes de gravar */
  var CAMPOS_OBRIGATORIOS = { tutores: ['nome'], pets: ['nome'], profissionais: ['nome'], servicos: ['nome'], estoque: ['nome'], leitos: ['nome'], encaminhadores: ['nome'], consultas: ['inicio'], lancamentos: ['valorCents'] }; // lançamento sem valor deixava o Caixa em NaN
  var STATUS_EXAME = ['solicitado', 'agendado', 'realizado', 'laudado', 'entregue', 'cancelado']; // a mesma lista de regras.js (o store não depende dele)
  var FORMATO_DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  /* Quem cita quem: [coleção, campo, coleção citada]. Só as relações que as telas tratam como obrigatórias (um exame sem o pet, uma consulta sem o pet).
     Movimentos de estoque e lembretes ficam de fora de propósito: a exclusão de um item ou de uma consulta nunca os apagou, então arquivos legítimos os têm órfãos. */
  var REFERENCIAS = [['pets', 'tutorId', 'tutores'], ['consultas', 'petId', 'pets'], ['prontuarios', 'petId', 'pets'], ['vacinas', 'petId', 'pets'],
    ['exames', 'petId', 'pets'], ['internacoes', 'petId', 'pets'], ['internacoes', 'leitoId', 'leitos'], ['evolucoes', 'internacaoId', 'internacoes'],
    /* v0.7: quem atendeu, o serviço e o encaminhador. A tela mostra "profissional removido" e "exame removido" no lugar, mas o registro clínico perde a assinatura de quem o
       fez; a exclusão de profissional, serviço e encaminhador já recusa quando há registro que os cita (equipe.js, encaminhadores.js). `exames.consultaId` NÃO está aqui de
       propósito: a Agenda deixa excluir a consulta de um exame e a tela do exame trata isso como "remarcar", um estado legítimo (um arquivo exportado assim não pode avisar). */
    ['consultas', 'profissionalId', 'profissionais'], ['consultas', 'servicoId', 'servicos'], ['prontuarios', 'profissionalId', 'profissionais'], ['vacinas', 'profissionalId', 'profissionais'],
    ['exames', 'servicoId', 'servicos'], ['exames', 'encaminhadorId', 'encaminhadores'], ['exames', 'responsavelId', 'profissionais'], ['exames', 'laudoPorId', 'profissionais'],
    ['internacoes', 'responsavelId', 'profissionais'], ['evolucoes', 'profissionalId', 'profissionais'], ['plantoes', 'profissionalId', 'profissionais']];
  /* Registros que citam um cadastro que NÃO está no conjunto (ex.: exame de um pet que sumiu). Recebe { coleção: [registros] }; coleção ausente vale como vazia.
     Entrada hostil (null, texto onde se espera lista, id "__proto__") nunca derruba: devolve só o que consegue ler. Cada item: { colecao, campo, alvo, quantidade }. */
  function referenciasQuebradas(colecoes) {
    var out = [];
    if (!colecoes || typeof colecoes !== 'object' || Array.isArray(colecoes)) return out;
    var lista = function (nome) { return Object.prototype.hasOwnProperty.call(colecoes, nome) && Array.isArray(colecoes[nome]) ? colecoes[nome] : []; };
    var conjuntos = Object.create(null);
    var idsDe = function (nome) {
      if (conjuntos[nome]) return conjuntos[nome];
      var s = conjuntos[nome] = Object.create(null); // sem protótipo: "toString" e "constructor" não existem por herança
      lista(nome).forEach(function (x) { if (x && typeof x === 'object' && typeof x.id === 'string') s[x.id] = true; });
      return s;
    };
    REFERENCIAS.forEach(function (r) {
      var alvo = idsDe(r[2]), n = 0;
      lista(r[0]).forEach(function (x) {
        if (!x || typeof x !== 'object' || Array.isArray(x)) return;
        var ref = Object.prototype.hasOwnProperty.call(x, r[1]) ? x[r[1]] : null;
        if (typeof ref === 'string' && ref && !alvo[ref]) n++;
      });
      if (n) out.push({ colecao: r[0], campo: r[1], alvo: r[2], quantidade: n });
    });
    return out;
  }

  /* Valida o arquivo INTEIRO antes de qualquer gravação. Devolve { ok: true, resumo: {coleção: n}, ausentes: [grupos que a loja tem e o arquivo não traz],
     quebradas: referenciasQuebradas(arquivo) } ou { ok: false, erro }. Importar substitui TUDO (v0.6): o que o arquivo não traz fica vazio, e é por isso que a tela precisa avisar. */
  function validarExportacao(dump, conhecidas) {
    conhecidas = conhecidas || COLECOES;
    var falha = function (erro) { return { ok: false, erro: erro }; };
    if (!dump || typeof dump !== 'object' || Array.isArray(dump) || dump.versao !== 1) return falha('Arquivo inválido: não é uma exportação do painel.');
    var cols = dump.colecoes;
    if (!cols || typeof cols !== 'object' || Array.isArray(cols)) return falha('Arquivo inválido: faltam as coleções de dados.');
    var nomes = Object.keys(cols), resumo = {};
    if (!nomes.length) return falha('O arquivo não tem nenhum cadastro para importar.');
    for (var k = 0; k < nomes.length; k++) {
      var nome = nomes[k], lista = cols[nome];
      if (nome === 'usuarios') return falha('O arquivo traz contas de acesso, que a exportação do painel nunca inclui. Importação cancelada por segurança.');
      if (conhecidas.indexOf(nome) === -1) return falha('Arquivo inválido: grupo de dados desconhecido ("' + String(nome).slice(0, 40) + '").');
      if (!Array.isArray(lista)) return falha('Arquivo inválido: "' + nome + '" deveria ser uma lista de registros.');
      var vistos = Object.create(null);
      for (var i = 0; i < lista.length; i++) {
        var it = lista[i], onde = '"' + nome + '", registro ' + (i + 1);
        if (!it || typeof it !== 'object' || Array.isArray(it)) return falha('Arquivo inválido: ' + onde + ' não é um registro.');
        if (typeof it.id !== 'string' || !it.id.trim() || it.id.length > 120) return falha('Arquivo inválido: ' + onde + ' não tem identificador (id).');
        /* id igual a um nome do Object ("__proto__", "constructor", "toString"...) faz mapas e conjuntos por id devolverem função herdada: um tutor passaria a "ter" os dados de outro */
        if (CHAVES_PERIGOSAS.indexOf(it.id) !== -1 || it.id in Object.prototype) return falha('Arquivo inválido: ' + onde + ' usa um identificador não permitido.');
        var textos = CAMPOS_TEXTO[nome] || [], datas = CAMPOS_DATA_HORA[nome] || [];
        var exigidos = CAMPOS_OBRIGATORIOS[nome] || [];
        for (var r = 0; r < exigidos.length; r++) {
          var ev = it[exigidos[r]];
          if (ev == null || (typeof ev === 'string' && !ev.trim())) return falha('Arquivo inválido: ' + onde + ' não tem o campo "' + exigidos[r] + '".');
          if (nome === 'consultas' && typeof ev === 'string' && !FORMATO_DATA_HORA.test(ev)) return falha('Arquivo inválido: ' + onde + ', o campo "inicio" não é uma data e hora (AAAA-MM-DDTHH:MM).');
        }
        for (var t = 0; t < textos.length; t++) {
          var v = it[textos[t]];
          if (v != null && typeof v !== 'string') return falha('Arquivo inválido: ' + onde + ', o campo "' + textos[t] + '" deveria ser texto.');
          if (v && datas.indexOf(textos[t]) !== -1 && !FORMATO_DATA_HORA.test(v)) return falha('Arquivo inválido: ' + onde + ', o campo "' + textos[t] + '" não é uma data e hora (AAAA-MM-DDTHH:MM).');
        }
        var centavos = CAMPOS_CENTAVOS[nome] || [];
        for (var cv = 0; cv < centavos.length; cv++) {
          var n = it[centavos[cv]];
          if (n != null && !(typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= TETO_CENTAVOS)) return falha('Arquivo inválido: ' + onde + ', o campo "' + centavos[cv] + '" deveria ser um valor em centavos (número inteiro, até R$ 99.999.999,99).');
        }
        if (vistos[it.id]) return falha('Arquivo inválido: ' + onde + ' repete um identificador já usado.');
        for (var c = 0; c < CHAVES_PERIGOSAS.length; c++) if (Object.prototype.hasOwnProperty.call(it, CHAVES_PERIGOSAS[c])) return falha('Arquivo inválido: ' + onde + ' tem um campo não permitido.');
        vistos[it.id] = true;
      }
      if (nome === 'config') { // o passo da agenda alimenta um laço: precisa ser um número positivo e inteiro
        for (var g = 0; g < lista.length; g++) {
          var cfgp = lista[g];
          for (var campoCfg of ['passoAgenda', 'duracaoPadrao']) if (cfgp[campoCfg] != null && !(Number.isInteger(cfgp[campoCfg]) && cfgp[campoCfg] >= 5 && cfgp[campoCfg] <= 1440)) return falha('Arquivo inválido: "config", o campo "' + campoCfg + '" precisa ser um número inteiro de minutos (5 a 1440).');
        }
      }
      if (nome === 'exames') { // situação fora da lista deixaria o exame fora de todos os filtros da tela
        for (var x = 0; x < lista.length; x++) if (STATUS_EXAME.indexOf(lista[x].status) === -1) return falha('Arquivo inválido: "exames", registro ' + (x + 1) + ' tem uma situação desconhecida.');
      }
      if (nome === 'internacoes') { // um leito e um paciente só em uma internação ativa (o mapa mostraria só a primeira e a outra ficaria invisível)
        var leitos = Object.create(null), pets = Object.create(null);
        for (var q = 0; q < lista.length; q++) {
          if (lista[q].status === 'encerrada') continue;
          if ((lista[q].leitoId && leitos[lista[q].leitoId]) || (lista[q].petId && pets[lista[q].petId])) return falha('Arquivo inválido: "internacoes" tem duas internações ativas no mesmo leito ou para o mesmo paciente.');
          leitos[lista[q].leitoId] = true; pets[lista[q].petId] = true;
        }
      }
      resumo[nome] = lista.length;
    }
    var ausentes = conhecidas.filter(function (c) { return c !== 'usuarios' && nomes.indexOf(c) === -1; });
    return { ok: true, resumo: resumo, ausentes: ausentes, quebradas: referenciasQuebradas(cols) };
  }

  function novoId(prefixo) {
    return (prefixo || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function criarStore(adaptador, extras) {
    var agora = function () { return new Date().toISOString(); };
    var COLECOES_DO_STORE = COLECOES.concat(extras || []);
    var api = {
      adaptador: adaptador,
      colecoes: COLECOES_DO_STORE,
      /* a loja tem essa coleção? (subtipos acrescentam as suas; ler uma que o banco não criou daria NotFoundError no IndexedDB) */
      tem: function (col) { return COLECOES_DO_STORE.indexOf(col) !== -1; },
      novoId: novoId,
      listar: function (col) { return adaptador.listar(col); },
      obter: function (col, id) { return adaptador.listar(col).then(function (l) { return l.find(function (x) { return x.id === id; }) || null; }); },
      salvar: function (col, obj) {
        var item = Object.assign({}, obj);
        if (!item.id) { item.id = novoId(col.slice(0, 3)); item.criadoEm = agora(); }
        item.atualizadoEm = agora();
        return adaptador.gravar(col, item).then(function () { return item; });
      },
      remover: function (col, id) { return adaptador.excluir(col, id); },
      limpar: function (col) { return adaptador.limpar(col); },
      limparTudo: function () { return Promise.all(COLECOES_DO_STORE.map(function (c) { return adaptador.limpar(c); })); },
      /* exporta tudo, menos as contas de acesso (hashes de senha não saem do navegador) */
      exportar: function () {
        return Promise.all(COLECOES_DO_STORE.filter(function (c) { return c !== 'usuarios'; }).map(function (c) {
          return adaptador.listar(c).then(function (l) { return [c, l]; });
        })).then(function (pares) {
          var colecoes = {}; pares.forEach(function (p) { colecoes[p[0]] = p[1]; });
          return { versao: 1, geradoEm: agora(), colecoes: colecoes };
        });
      },
      /* Importar SUBSTITUI todos os cadastros (v0.6): a loja fica exatamente como o arquivo; o grupo que o arquivo não traz (backup de uma versão mais antiga, sem
         exames, por exemplo) fica VAZIO. Antes só os grupos do arquivo eram trocados: pets e consultas novos conviviam com exames e laudos que citavam os pets
         antigos, e o registro clínico ficava sem paciente. Valida tudo antes de apagar; se a gravação falhar no meio, devolve o que havia antes (de todos os grupos).
         As contas de acesso nunca entram nem saem por aqui. Devolve quantos grupos o arquivo trazia. */
      importar: function (dump) {
        var v = validarExportacao(dump, COLECOES_DO_STORE);
        if (!v.ok) return Promise.reject(new Error(v.erro));
        var cols = COLECOES_DO_STORE.filter(function (c) { return c !== 'usuarios'; });
        var doArquivo = function (c) { return Object.prototype.hasOwnProperty.call(dump.colecoes, c) ? dump.colecoes[c] : []; };
        function gravarTudo(c, lista) {
          if (!lista.length) return Promise.resolve();
          if (typeof adaptador.gravarLote === 'function') return adaptador.gravarLote(c, lista); // uma gravação por grupo (adaptador de servidor sem lote cai no item a item)
          return lista.reduce(function (q, it) { return q.then(function () { return adaptador.gravar(c, it); }); }, Promise.resolve());
        }
        return Promise.all(cols.map(function (c) { return adaptador.listar(c); })).then(function (antes) {
          return cols.reduce(function (p, c) {
            return p.then(function () { return adaptador.limpar(c); }).then(function () { return gravarTudo(c, doArquivo(c)); });
          }, Promise.resolve()).then(function () { return Object.keys(dump.colecoes).length; }, function (erro) {
            /* limpa TODOS os grupos antes de regravar os antigos: restaurar um grupo enquanto os seguintes ainda têm dados do arquivo novo estourava a cota do
               localStorage (reproduzido na revisão da 0.6) e perdia o que havia */
            return cols.reduce(function (p, c) { return p.then(function () { return adaptador.limpar(c); }); }, Promise.resolve()).then(function () {
              return cols.reduce(function (p, c, i) { return p.then(function () { return gravarTudo(c, antes[i]); }); }, Promise.resolve());
            }).then(function () {
              throw new Error('A importação falhou (' + (erro && erro.message || erro) + '). Os dados anteriores foram restaurados.');
            }, function () {
              throw new Error('A importação falhou (' + (erro && erro.message || erro) + ') e não foi possível restaurar tudo. Confira os cadastros.');
            });
          });
        });
      }
    };
    return api;
  }

  /* Escolhe o adaptador conforme SITE_CONFIG.painel.armazenamento ('localstorage' | 'indexeddb'); cai para memória se o navegador bloquear. */
  function criarPadrao(slug, tipo, extras) {
    var aviso = null, ad;
    try {
      ad = tipo === 'indexeddb' ? adaptadorIndexedDB('painel-' + slug, undefined, COLECOES.concat(extras || [])) : adaptadorLocalStorage('painel:' + slug);
      if (tipo !== 'indexeddb') { localStorage.setItem('painel:' + slug + ':__teste', '1'); localStorage.removeItem('painel:' + slug + ':__teste'); }
    } catch (e) {
      ad = adaptadorMemoria();
      aviso = 'O navegador bloqueou o armazenamento: nada será salvo depois de fechar esta aba.';
    }
    var s = criarStore(ad, extras); s.aviso = aviso; return s;
  }

  return { COLECOES: COLECOES, validarExportacao: validarExportacao, referenciasQuebradas: referenciasQuebradas, adaptadorMemoria: adaptadorMemoria, adaptadorLocalStorage: adaptadorLocalStorage,
    adaptadorIndexedDB: adaptadorIndexedDB, criarStore: criarStore, criarPadrao: criarPadrao, novoId: novoId };
});
