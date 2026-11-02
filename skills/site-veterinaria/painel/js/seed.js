/* seed.js: dados de EXEMPLO (fictícios) do painel. Só entram quando o dono clica em "Carregar dados de exemplo".
   Todo registro leva exemplo:true, aparece com a marca "Exemplo" e pode ser removido de uma vez. Nada disto vai para a vitrine.
   Nomes, telefones (DDD 00), valores e lotes são inventados de propósito e não representam pessoas nem a clínica. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./regras.js'));
  else root.Seed = factory(root.Regras);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  /* Variantes por subtipo (SITE_CONFIG.painel.subtipo): mesmos ids e mesma quantidade de registros; mudam espécies, nomes e campos clínicos.
     Tudo fictício. Sem sinais vitais nos exemplos de exóticos: os valores de referência mudam por espécie e não cabe inventá-los. */
  var VARIANTES = {
    exoticos: function (d, pets, prontuarios, vacinas) {
      var troca = function (id, campos) { Object.assign(pets.find(function (x) { return x.id === id; }), campos); };
      troca('ex-pet-1', { nome: 'Pitoco', especie: 'Ave', raca: 'Calopsita (exemplo)', sexo: 'Macho', nascimento: d(-900), pesoKg: undefined, pesoG: 90, castrado: false,
        ambiente: 'Gaiola ampla, perto da janela (exemplo).', dieta: 'Ração própria para a espécie e frutas (exemplo).', manejo: 'Limpeza do fundo da gaiola todo dia (exemplo).' });
      troca('ex-pet-2', { nome: 'Jade', especie: 'Réptil', raca: 'Lagarto (exemplo)', sexo: 'Indeterminado', nascimento: d(-700), pesoKg: undefined, pesoG: 420, castrado: false,
        ambiente: 'Terrário com lâmpada de aquecimento (exemplo).', dieta: 'Insetos e folhas (exemplo).', manejo: 'Higiene do terrário toda semana (exemplo).' });
      troca('ex-pet-3', { nome: 'Fumaça', especie: 'Furão (ferret)', raca: 'Exemplo', sexo: 'Macho', nascimento: d(-1100), pesoKg: undefined, pesoG: 1100, castrado: true,
        ambiente: 'Cercado com redes e tocas (exemplo).', dieta: 'Ração para carnívoros (exemplo).', manejo: 'Solto em área segura por algumas horas (exemplo).' });
      troca('ex-pet-4', { nome: 'Nina', especie: 'Coelho', raca: 'Exemplo', sexo: 'Fêmea', nascimento: d(-150), pesoKg: undefined, pesoG: 1400, castrado: false,
        ambiente: 'Baia com feno e esconderijo (exemplo).', dieta: 'Feno à vontade e verduras (exemplo).', manejo: 'Convive sozinha (exemplo).' });
      var pr1 = prontuarios.find(function (x) { return x.id === 'ex-pront-1'; }), pr2 = prontuarios.find(function (x) { return x.id === 'ex-pront-2'; });
      Object.assign(pr1, { queixa: 'Perda de penas ou pelos (exemplo)', pesoKg: undefined, pesoG: 1100, fc: '', fr: '', mucosas: '',
        ambiente: 'Cercado com redes e tocas (exemplo).', dieta: 'Ração para carnívoros (exemplo).', manejo: 'Solto em área segura (exemplo).' });
      Object.assign(pr2, { queixa: 'Apetite reduzido (exemplo)', pesoKg: undefined, pesoG: 420, fc: '', fr: '', mucosas: '',
        ambiente: 'Terrário com lâmpada de aquecimento (exemplo).', dieta: 'Insetos e folhas (exemplo).', manejo: 'Higiene semanal (exemplo).' });
      var va = function (id) { return vacinas.find(function (x) { return x.id === id; }); };
      va('ex-vac-1').vacina = 'Vacina (exemplo)';
      va('ex-vac-2').vacina = 'Antirrábica (exemplo)';
      va('ex-vac-3').vacina = 'Controle de parasitas (exemplo)';
      va('ex-vac-4').vacina = 'Vacina (exemplo)';
    },
    hospital24h: function (d, pets, prontuarios) {
      prontuarios.find(function (x) { return x.id === 'ex-pront-1'; }).prioridade = 'Rotina';
      prontuarios.find(function (x) { return x.id === 'ex-pront-2'; }).prioridade = 'Urgente';
    }
  };

  /* Coleções que só existem em certos subtipos (declaradas em colecoesExtras do subtipo). Mesmos pets e profissionais do padrão, tudo fictício.
     Datas e horários são relativos a hoje; nada aqui diz como é a escala ou o funcionamento de uma clínica real. */
  var EXTRAS_POR_SUBTIPO = {
    hospital24h: function (d, dh, ex) {
      var leitos = [
        ex({ id: 'ex-leito-1', nome: 'Leito 1 (exemplo)', obs: '', ativo: true }),
        ex({ id: 'ex-leito-2', nome: 'Leito 2 (exemplo)', obs: '', ativo: true }),
        ex({ id: 'ex-leito-3', nome: 'Leito 3 (exemplo)', obs: '', ativo: true }),
        ex({ id: 'ex-leito-4', nome: 'Isolamento (exemplo)', obs: 'Uso reservado (exemplo).', ativo: true }),
        ex({ id: 'ex-leito-5', nome: 'Observação (exemplo)', obs: '', ativo: true })
      ];
      var internacoes = [
        ex({ id: 'ex-int-1', petId: 'ex-pet-3', leitoId: 'ex-leito-1', entradaEm: dh(-1, '21:15'), motivo: 'Observação após procedimento (exemplo)', responsavelId: 'ex-prof-2',
          situacao: 'Em observação', previsaoAlta: d(1), status: 'internado', saidaEm: '', desfecho: '', resumoSaida: '' }),
        ex({ id: 'ex-int-2', petId: 'ex-pet-2', leitoId: 'ex-leito-3', entradaEm: dh(-2, '10:00'), motivo: 'Acompanhamento de hidratação (exemplo)', responsavelId: 'ex-prof-1',
          situacao: 'Estável', previsaoAlta: d(0), status: 'internado', saidaEm: '', desfecho: '', resumoSaida: '' }),
        ex({ id: 'ex-int-3', petId: 'ex-pet-5', leitoId: 'ex-leito-5', entradaEm: dh(0, '01:00'), motivo: 'Monitoramento (exemplo)', responsavelId: 'ex-prof-2',
          situacao: 'Requer atenção', previsaoAlta: '', status: 'internado', saidaEm: '', desfecho: '', resumoSaida: '' }),
        ex({ id: 'ex-int-4', petId: 'ex-pet-1', leitoId: 'ex-leito-2', entradaEm: dh(-5, '14:00'), motivo: 'Exemplo de internação encerrada', responsavelId: 'ex-prof-1',
          situacao: 'Estável', previsaoAlta: d(-3), status: 'encerrada', saidaEm: dh(-3, '11:30'), desfecho: 'Alta', resumoSaida: 'Alta com orientações (exemplo).' })
      ];
      var evo = function (id, int, dia, hora, prof, tipo, texto) {
        return ex({ id: id, internacaoId: int, em: dh(dia, hora), profissionalId: prof, tipo: tipo, texto: texto + ' (exemplo)' });
      };
      var evolucoes = [
        evo('ex-evo-1', 'ex-int-1', -1, '21:30', 'ex-prof-2', 'Observação', 'Entrou calmo e aceitou água'),
        evo('ex-evo-2', 'ex-int-1', -1, '23:30', 'ex-prof-2', 'Medicação', 'Medicação do plantão administrada, sem intercorrência'),
        evo('ex-evo-3', 'ex-int-1', 0, '06:00', 'ex-prof-2', 'Alimentação e hidratação', 'Comeu metade da refeição'),
        evo('ex-evo-4', 'ex-int-2', -2, '18:00', 'ex-prof-1', 'Procedimento', 'Fluido de manutenção iniciado'),
        evo('ex-evo-5', 'ex-int-2', -1, '08:00', 'ex-prof-1', 'Observação', 'Urinou e se alimentou'),
        evo('ex-evo-6', 'ex-int-3', 0, '02:00', 'ex-prof-2', 'Observação', 'Respiração acompanhada a cada hora')
      ];
      var plantoes = [
        ex({ id: 'ex-plant-1', profissionalId: 'ex-prof-2', inicio: dh(-1, '19:00'), fim: dh(0, '07:00'), obs: 'Passagem de plantão (exemplo): Thor e Pipoca em observação.' }),
        ex({ id: 'ex-plant-2', profissionalId: 'ex-prof-1', inicio: dh(0, '07:00'), fim: dh(0, '19:00'), obs: '' }),
        ex({ id: 'ex-plant-3', profissionalId: 'ex-prof-2', inicio: dh(0, '19:00'), fim: dh(1, '07:00'), obs: '' })
      ];
      return { leitos: leitos, internacoes: internacoes, evolucoes: evolucoes, plantoes: plantoes };
    },
    diagnostico: function (d, dh, ex) {
      var encaminhadores = [
        ex({ id: 'ex-enc-1', nome: 'Clínica Exemplo A', tipo: 'Clínica ou hospital veterinário', telefone: '(00) 90000-0101', email: '', condicoes: 'Condição combinada fictícia (exemplo).', obs: '', ativo: true }),
        ex({ id: 'ex-enc-2', nome: 'Dr. Exemplo B', tipo: 'Veterinário(a) autônomo(a)', telefone: '(00) 90000-0102', email: '', condicoes: '', obs: '', ativo: true }),
        ex({ id: 'ex-enc-3', nome: 'Hospital Exemplo C', tipo: 'Clínica ou hospital veterinário', telefone: '(00) 90000-0103', email: '', condicoes: '', obs: '', ativo: true })
      ];
      var texto = ' (exemplo)';
      var e = function (id, pet, serv, enc, status, campos) {
        return ex(Object.assign({ id: id, petId: pet, servicoId: serv, encaminhadorId: enc, status: status, consultaId: '', solicitadoEm: dh(-1, '10:00'), indicacao: '', realizadoEm: '', responsavelId: '',
          laudoEm: '', laudoPorId: '', laudo: '', entregueEm: '', entregaVia: '', obs: '' }, campos));
      };
      var exames = [
        e('ex-exa-1', 'ex-pet-3', 'ex-serv-1', 'ex-enc-1', 'entregue', { solicitadoEm: dh(-4, '10:00'), consultaId: 'ex-cons-6', indicacao: 'Indicação fictícia' + texto + '.', realizadoEm: dh(-1, '15:20'), responsavelId: 'ex-prof-1',
          laudoEm: dh(-1, '18:00'), laudoPorId: 'ex-prof-1', laudo: 'Texto fictício de laudo para demonstrar a tela' + texto + '.', entregueEm: dh(0, '08:30'), entregaVia: 'Retirado na recepção' + texto }),
        e('ex-exa-2', 'ex-pet-1', 'ex-serv-2', 'ex-enc-2', 'laudado', { solicitadoEm: dh(-3, '09:00'), consultaId: 'ex-cons-8', indicacao: 'Indicação fictícia' + texto + '.', realizadoEm: dh(-1, '11:10'), responsavelId: 'ex-prof-2',
          laudoEm: dh(0, '07:45'), laudoPorId: 'ex-prof-2', laudo: 'Texto fictício de laudo para demonstrar a tela' + texto + '.' }),
        e('ex-exa-3', 'ex-pet-2', 'ex-serv-1', 'ex-enc-1', 'realizado', { solicitadoEm: dh(-2, '16:00'), consultaId: 'ex-cons-1', indicacao: 'Indicação fictícia' + texto + '.', realizadoEm: dh(0, '09:10'), responsavelId: 'ex-prof-1' }),
        e('ex-exa-4', 'ex-pet-4', 'ex-serv-3', '', 'agendado', { solicitadoEm: dh(-1, '12:00'), consultaId: 'ex-cons-2' }),
        e('ex-exa-5', 'ex-pet-5', 'ex-serv-2', 'ex-enc-3', 'agendado', { solicitadoEm: dh(-1, '17:30'), consultaId: 'ex-cons-5', indicacao: 'Indicação fictícia' + texto + '.' }),
        e('ex-exa-6', 'ex-pet-3', 'ex-serv-2', 'ex-enc-2', 'solicitado', { solicitadoEm: dh(0, '08:15'), obs: 'Tutor prefere o período da tarde' + texto + '.' }),
        e('ex-exa-7', 'ex-pet-4', 'ex-serv-1', 'ex-enc-3', 'cancelado', { solicitadoEm: dh(-6, '14:00'), obs: 'Tutor desistiu' + texto + '.' }),
        e('ex-exa-8', 'ex-pet-1', 'ex-serv-3', 'ex-enc-1', 'agendado', { solicitadoEm: dh(-3, '11:00'), consultaId: 'ex-cons-7', obs: 'Horário cancelado: falta remarcar' + texto + '.' })
      ];
      return { encaminhadores: encaminhadores, exames: exames };
    }
  };

  /* Subtipos que trocam partes do conjunto base (centro de diagnóstico: agenda de exames, sem prontuários nem vacinas) e acrescentam coleções.
     `opcoes.exames`: nomes dos exames que o site público apresenta (SITE_CONFIG.painel.exames); sem eles, nomes genéricos. Tudo fictício e marcado "(exemplo)". */
  var AJUSTES_POR_SUBTIPO = {
    /* clínica com loja (v0.6): as 9 telas de sempre; o estoque ganha preço de venda, dois produtos e uma venda de exemplo (saída no histórico + entrada no caixa) */
    clinica_loja: function (dados, d, dh, ex) {
      dados.estoque.find(function (x) { return x.id === 'ex-est-3'; }).precoVendaCents = 2490; // o vermífugo do exemplo também é vendido no balcão
      dados.estoque.push(
        ex({ id: 'ex-est-6', nome: 'Ração para cães (exemplo)', categoria: 'alimento', unidade: 'pacote', quantidade: 14, minimo: 5, lote: 'EX-0030', validade: d(120), precoVendaCents: 8990 }),
        ex({ id: 'ex-est-7', nome: 'Coleira (exemplo)', categoria: 'artigo', unidade: 'unidade', quantidade: 8, minimo: 3, lote: '', validade: '', precoVendaCents: 3490 }));
      dados.lancamentos.push(ex({ id: 'ex-lanc-5', data: d(0), tipo: 'entrada', descricao: 'Venda: Ração para cães (exemplo) × 1', valorCents: 8990, forma: 'pix', categoria: 'Venda de produtos', tutorId: 'ex-tut-1', itemId: 'ex-est-6' }));
      dados.movimentos.push(ex({ id: 'ex-mov-1', itemId: 'ex-est-6', tipo: 'saida', qtd: 1, data: d(0), motivo: 'Venda no balcão' }));
    },
    diagnostico: function (dados, d, dh, ex, opcoes) {
      var nomes = ((opcoes && opcoes.exames) || []).filter(function (n) { return typeof n === 'string' && n.trim(); }).slice(0, 3);
      while (nomes.length < 3) nomes.push('Exame de imagem ' + (nomes.length + 1));
      dados.servicos = [
        ex({ id: 'ex-serv-1', nome: nomes[0] + ' (exemplo)', duracaoMin: 60, valorCents: 0 }),
        ex({ id: 'ex-serv-2', nome: nomes[1] + ' (exemplo)', duracaoMin: 45, valorCents: 0 }),
        ex({ id: 'ex-serv-3', nome: nomes[2] + ' (exemplo)', duracaoMin: 60, valorCents: 0 })
      ];
      var pet = function (id) { return dados.pets.find(function (x) { return x.id === id; }); };
      var c = function (id, p, prof, serv, dia, hora, dur, status) {
        var s = dados.servicos.find(function (x) { return x.id === serv; });
        return ex({ id: id, petId: p, tutorId: pet(p).tutorId, profissionalId: prof, servicoId: serv, inicio: dh(dia, hora), duracaoMin: dur, status: status, motivo: 'Exame: ' + s.nome, obs: '' });
      };
      dados.consultas = [
        c('ex-cons-1', 'ex-pet-2', 'ex-prof-1', 'ex-serv-1', 0, '09:00', 60, 'concluida'),
        c('ex-cons-2', 'ex-pet-4', 'ex-prof-2', 'ex-serv-3', 0, '14:00', 60, 'agendada'),
        c('ex-cons-5', 'ex-pet-5', 'ex-prof-1', 'ex-serv-2', 1, '11:00', 45, 'agendada'),
        c('ex-cons-6', 'ex-pet-3', 'ex-prof-1', 'ex-serv-1', -1, '15:00', 60, 'concluida'),
        c('ex-cons-7', 'ex-pet-1', 'ex-prof-2', 'ex-serv-3', -1, '16:00', 60, 'cancelada'),
        c('ex-cons-8', 'ex-pet-1', 'ex-prof-2', 'ex-serv-2', -1, '11:00', 45, 'concluida')
      ];
      dados.prontuarios = []; dados.vacinas = [];
      dados.lancamentos = [
        ex({ id: 'ex-lanc-1', data: d(0), tipo: 'entrada', descricao: 'Exame (exemplo)', valorCents: 25000, forma: 'pix', categoria: 'Atendimento', tutorId: 'ex-tut-2' }),
        ex({ id: 'ex-lanc-2', data: d(0), tipo: 'entrada', descricao: 'Exame (exemplo)', valorCents: 18000, forma: 'cartao_credito', categoria: 'Atendimento', tutorId: 'ex-tut-1' }),
        ex({ id: 'ex-lanc-3', data: d(0), tipo: 'saida', descricao: 'Material de limpeza (exemplo)', valorCents: 4550, forma: 'dinheiro', categoria: 'Despesa' }),
        ex({ id: 'ex-lanc-4', data: d(-1), tipo: 'entrada', descricao: 'Exame (exemplo)', valorCents: 25000, forma: 'dinheiro', categoria: 'Atendimento', tutorId: 'ex-tut-2' })
      ];
      dados.estoque = [
        ex({ id: 'ex-est-1', nome: 'Insumo A (exemplo)', categoria: 'insumo', unidade: 'frasco', quantidade: 8, minimo: 3, lote: 'EX-0001', validade: d(200) }),
        ex({ id: 'ex-est-2', nome: 'Insumo B (exemplo)', categoria: 'insumo', unidade: 'frasco', quantidade: 2, minimo: 4, lote: 'EX-0002', validade: d(150) }),
        ex({ id: 'ex-est-3', nome: 'Seringa 10 mL (exemplo)', categoria: 'insumo', unidade: 'unidade', quantidade: 80, minimo: 40, lote: '', validade: '' }),
        ex({ id: 'ex-est-4', nome: 'Luvas descartáveis (exemplo)', categoria: 'insumo', unidade: 'caixa', quantidade: 6, minimo: 2, lote: '', validade: '' }),
        ex({ id: 'ex-est-5', nome: 'Soro fisiológico (exemplo)', categoria: 'medicamento', unidade: 'frasco', quantidade: 6, minimo: 2, lote: 'EX-0020', validade: d(-5) })
      ];
    }
  };

  function gerar(hoje, subtipo, opcoes) {
    var d = function (n) { return R.somarDias(hoje, n); };
    var dh = function (n, hhmm) { return d(n) + 'T' + hhmm; };
    var ex = function (o) { o.exemplo = true; return o; };

    var profissionais = [
      ex({ id: 'ex-prof-1', nome: 'Dra. Helena Exemplo', funcao: 'Veterinário(a)', registro: '00000 (exemplo)', ativo: true }),
      ex({ id: 'ex-prof-2', nome: 'Dr. Paulo Exemplo', funcao: 'Veterinário(a)', registro: '00001 (exemplo)', ativo: true }),
      ex({ id: 'ex-prof-3', nome: 'Camila Exemplo', funcao: 'Recepção', registro: '', ativo: true })
    ];
    var servicos = [
      ex({ id: 'ex-serv-1', nome: 'Consulta', duracaoMin: 30, valorCents: 12000 }),
      ex({ id: 'ex-serv-2', nome: 'Retorno', duracaoMin: 20, valorCents: 0 }),
      ex({ id: 'ex-serv-3', nome: 'Vacinação', duracaoMin: 20, valorCents: 9000 }),
      ex({ id: 'ex-serv-4', nome: 'Exame', duracaoMin: 45, valorCents: 15000 })
    ];
    var tutores = [
      ex({ id: 'ex-tut-1', nome: 'Ana Exemplo', telefone: '(00) 90000-0001', email: '', observacoes: 'Cadastro fictício.' }),
      ex({ id: 'ex-tut-2', nome: 'Bruno Exemplo', telefone: '(00) 90000-0002', email: '', observacoes: '' }),
      ex({ id: 'ex-tut-3', nome: 'Carla Exemplo', telefone: '(00) 90000-0003', email: '', observacoes: '' }),
      ex({ id: 'ex-tut-4', nome: 'Diego Exemplo', telefone: '(00) 90000-0004', email: '', observacoes: '' })
    ];
    var pets = [
      ex({ id: 'ex-pet-1', tutorId: 'ex-tut-1', nome: 'Bidu', especie: 'Cão', raca: 'Sem raça definida', sexo: 'Macho', nascimento: d(-1200), pesoKg: 14.5, castrado: true }),
      ex({ id: 'ex-pet-2', tutorId: 'ex-tut-1', nome: 'Mel', especie: 'Gato', raca: 'Sem raça definida', sexo: 'Fêmea', nascimento: d(-700), pesoKg: 3.9, castrado: true }),
      ex({ id: 'ex-pet-3', tutorId: 'ex-tut-2', nome: 'Thor', especie: 'Cão', raca: 'Exemplo', sexo: 'Macho', nascimento: d(-2100), pesoKg: 28, castrado: false }),
      ex({ id: 'ex-pet-4', tutorId: 'ex-tut-3', nome: 'Nina', especie: 'Cão', raca: 'Exemplo', sexo: 'Fêmea', nascimento: d(-150), pesoKg: 6.2, castrado: false }),
      ex({ id: 'ex-pet-5', tutorId: 'ex-tut-4', nome: 'Pipoca', especie: 'Gato', raca: 'Sem raça definida', sexo: 'Macho', nascimento: d(-1800), pesoKg: 5.1, castrado: true })
    ];
    var c = function (id, pet, prof, serv, dia, hora, dur, status, motivo) {
      var p = pets.find(function (x) { return x.id === pet; });
      return ex({ id: id, petId: pet, tutorId: p.tutorId, profissionalId: prof, servicoId: serv, inicio: dh(dia, hora), duracaoMin: dur, status: status, motivo: motivo, obs: '' });
    };
    var consultas = [
      c('ex-cons-1', 'ex-pet-1', 'ex-prof-1', 'ex-serv-1', 0, '09:00', 30, 'confirmada', 'Consulta de rotina (exemplo)'),
      c('ex-cons-2', 'ex-pet-3', 'ex-prof-2', 'ex-serv-3', 0, '09:30', 20, 'agendada', 'Vacinação (exemplo)'),
      c('ex-cons-3', 'ex-pet-2', 'ex-prof-1', 'ex-serv-2', 0, '10:30', 20, 'agendada', 'Retorno (exemplo)'),
      c('ex-cons-4', 'ex-pet-4', 'ex-prof-2', 'ex-serv-1', 0, '14:00', 30, 'agendada', 'Primeira consulta (exemplo)'),
      c('ex-cons-5', 'ex-pet-5', 'ex-prof-1', 'ex-serv-4', 1, '11:00', 45, 'agendada', 'Exame (exemplo)'),
      c('ex-cons-6', 'ex-pet-3', 'ex-prof-1', 'ex-serv-1', -1, '15:00', 30, 'concluida', 'Consulta (exemplo)'),
      c('ex-cons-7', 'ex-pet-4', 'ex-prof-2', 'ex-serv-1', -1, '16:00', 30, 'cancelada', 'Consulta (exemplo)')
    ];
    var prontuarios = [
      ex({ id: 'ex-pront-1', petId: 'ex-pet-3', consultaId: 'ex-cons-6', profissionalId: 'ex-prof-1', data: d(-1), queixa: 'Coceira (exemplo)',
        anamnese: 'Texto fictício de anamnese para demonstrar o prontuário.', pesoKg: 28, temperatura: 38.5, fc: 100, fr: 24, mucosas: 'Normocoradas',
        diagnostico: 'Exemplo de diagnóstico.', conduta: 'Exemplo de conduta.', prescricao: 'Exemplo de prescrição (não é receita).', retornoEm: d(-2), obs: '' }),
      ex({ id: 'ex-pront-2', petId: 'ex-pet-2', consultaId: '', profissionalId: 'ex-prof-2', data: d(-10), queixa: 'Apetite reduzido (exemplo)',
        anamnese: 'Registro fictício.', pesoKg: 3.9, temperatura: 38.8, fc: 180, fr: 28, mucosas: 'Normocoradas', diagnostico: '', conduta: 'Observação em casa.',
        prescricao: '', retornoEm: d(3), obs: '' })
    ];
    var vacinas = [
      ex({ id: 'ex-vac-1', petId: 'ex-pet-1', vacina: 'V10 (exemplo)', dataAplicacao: d(-360), lote: 'EX-0001', intervaloDias: 365, proximaDose: d(5), profissionalId: 'ex-prof-1', obs: '' }),
      ex({ id: 'ex-vac-2', petId: 'ex-pet-3', vacina: 'Antirrábica (exemplo)', dataAplicacao: d(-380), lote: 'EX-0002', intervaloDias: 365, proximaDose: d(-15), profissionalId: 'ex-prof-2', obs: '' }),
      ex({ id: 'ex-vac-3', petId: 'ex-pet-2', vacina: 'V4 felina (exemplo)', dataAplicacao: d(-335), lote: 'EX-0003', intervaloDias: 365, proximaDose: d(30), profissionalId: 'ex-prof-1', obs: '' }),
      ex({ id: 'ex-vac-4', petId: 'ex-pet-4', vacina: 'V10 (exemplo)', dataAplicacao: d(-20), lote: 'EX-0001', intervaloDias: 21, proximaDose: d(1), profissionalId: 'ex-prof-2', obs: '' })
    ];
    var lancamentos = [
      ex({ id: 'ex-lanc-1', data: d(0), tipo: 'entrada', descricao: 'Consulta (exemplo)', valorCents: 12000, forma: 'pix', categoria: 'Atendimento', tutorId: 'ex-tut-1' }),
      ex({ id: 'ex-lanc-2', data: d(0), tipo: 'entrada', descricao: 'Vacinação (exemplo)', valorCents: 9000, forma: 'cartao_credito', categoria: 'Atendimento', tutorId: 'ex-tut-2' }),
      ex({ id: 'ex-lanc-3', data: d(0), tipo: 'saida', descricao: 'Material de limpeza (exemplo)', valorCents: 4550, forma: 'dinheiro', categoria: 'Despesa' }),
      ex({ id: 'ex-lanc-4', data: d(-1), tipo: 'entrada', descricao: 'Consulta (exemplo)', valorCents: 12000, forma: 'dinheiro', categoria: 'Atendimento', tutorId: 'ex-tut-2' })
    ];
    var estoque = [
      ex({ id: 'ex-est-1', nome: 'Vacina V10 (exemplo)', categoria: 'vacina', unidade: 'dose', quantidade: 12, minimo: 5, lote: 'EX-0001', validade: d(200) }),
      ex({ id: 'ex-est-2', nome: 'Vacina antirrábica (exemplo)', categoria: 'vacina', unidade: 'dose', quantidade: 3, minimo: 5, lote: 'EX-0002', validade: d(150) }),
      ex({ id: 'ex-est-3', nome: 'Vermífugo (exemplo)', categoria: 'medicamento', unidade: 'comprimido', quantidade: 20, minimo: 10, lote: 'EX-0010', validade: d(20) }),
      ex({ id: 'ex-est-4', nome: 'Seringa 3 mL (exemplo)', categoria: 'insumo', unidade: 'unidade', quantidade: 100, minimo: 50, lote: '', validade: '' }),
      ex({ id: 'ex-est-5', nome: 'Soro fisiológico (exemplo)', categoria: 'medicamento', unidade: 'frasco', quantidade: 6, minimo: 2, lote: 'EX-0020', validade: d(-5) })
    ];
    if (VARIANTES[subtipo]) VARIANTES[subtipo](d, pets, prontuarios, vacinas);
    var dados = { profissionais: profissionais, servicos: servicos, tutores: tutores, pets: pets, consultas: consultas, prontuarios: prontuarios,
      vacinas: vacinas, lancamentos: lancamentos, estoque: estoque, movimentos: [] };
    if (AJUSTES_POR_SUBTIPO[subtipo]) AJUSTES_POR_SUBTIPO[subtipo](dados, d, dh, ex, opcoes);
    if (EXTRAS_POR_SUBTIPO[subtipo]) Object.assign(dados, EXTRAS_POR_SUBTIPO[subtipo](d, dh, ex));
    return dados;
  }

  /* Carrega os exemplos UMA vez: se já existe qualquer registro de exemplo, não grava nada e devolve 0. Antes, carregar de novo regravava os mesmos ids e
     reabria internações que o usuário já tinha encerrado (dois pacientes no mesmo leito, o mesmo paciente em dois leitos). Devolve quantos registros gravou. */
  function carregar(store, hoje, subtipo, opcoes) {
    return existeExemplo(store).then(function (ja) {
      if (ja) return 0;
      var dados = gerar(hoje, subtipo, opcoes), cols = Object.keys(dados).filter(function (c) { return store.tem(c); });
      return cols.reduce(function (p, col) {
        return p.then(function () {
          return dados[col].reduce(function (q, item) { return q.then(function () { return store.salvar(col, item); }); }, Promise.resolve());
        });
      }, Promise.resolve()).then(function () { return cols.reduce(function (n, c) { return n + dados[c].length; }, 0); });
    });
  }

  /* qualquer coleção da loja tem registro de exemplo? */
  function existeExemplo(store) {
    var cols = store.colecoes.filter(function (c) { return c !== 'usuarios' && c !== 'config'; });
    return Promise.all(cols.map(function (c) { return store.listar(c); })).then(function (ls) {
      return ls.some(function (l) { return l.some(function (x) { return x && x.exemplo; }); });
    });
  }

  /* remove tudo que é exemplo e o que dependia deles: lembretes e movimentos órfãos, e (hospital) a internação de um paciente ou leito de exemplo
     com as observações dela (senão sobrava um leito "ocupado" por "Pet removido"). Cadastros reais que só citam um exemplo seguem como estavam. */
  function remover(store) {
    var cols = store.colecoes.filter(function (c) { return c !== 'usuarios' && c !== 'config'; });
    return Promise.all(cols.map(function (c) { return store.listar(c).then(function (l) { return [c, l]; }); })).then(function (pares) {
      var por = Object.create(null); pares.forEach(function (p) { por[p[0]] = p[1].filter(function (x) { return x && typeof x === 'object'; }); });
      var some = Object.create(null); // ids que vão sair, por coleção
      cols.forEach(function (c) { some[c] = Object.create(null); por[c].forEach(function (x) { if (x.exemplo) some[c][x.id] = true; }); });
      var vivo = function (c, id) { return !some[c][id] && por[c].some(function (x) { return x.id === id; }); };
      (por.internacoes || []).forEach(function (i) { if (some.pets[i.petId] || some.leitos[i.leitoId]) some.internacoes[i.id] = true; });
      (por.exames || []).forEach(function (e) { if (some.pets[e.petId]) some.exames[e.id] = true; }); // exame (e laudo) de um paciente de exemplo sai junto
      /* profissional, serviço (exame do catálogo) e encaminhador de exemplo que um registro REAL cita ficam (deixam de ser exemplo): remover o profissional apagava quem
         assinou o laudo (ou atendeu a consulta, escreveu o prontuário, aplicou a vacina) e remover o serviço deixava "Exame removido" num exame que ninguém mais consegue editar.
         Os mesmos bloqueios da exclusão pelas telas. Antes (até a 0.6) só o exame real era protegido; o dono que agendava uma consulta com a "Dra. Exemplo" e depois
         removia os exemplos ficava com a consulta sem profissional (v0.7, revisão independente). */
      var mantidos = [];
      [['exames', 'responsavelId', 'profissionais'], ['exames', 'laudoPorId', 'profissionais'], ['exames', 'servicoId', 'servicos'], ['exames', 'encaminhadorId', 'encaminhadores'],
        ['consultas', 'profissionalId', 'profissionais'], ['consultas', 'servicoId', 'servicos'], ['prontuarios', 'profissionalId', 'profissionais'], ['vacinas', 'profissionalId', 'profissionais'],
        ['internacoes', 'responsavelId', 'profissionais'], ['evolucoes', 'profissionalId', 'profissionais'], ['plantoes', 'profissionalId', 'profissionais']].forEach(function (rel) {
        (por[rel[0]] || []).forEach(function (reg) {
          if (reg.exemplo || (some[rel[0]] && some[rel[0]][reg.id])) return; // o registro que cita também é de exemplo (ou sai junto)
          var alvo = reg[rel[1]];
          if (typeof alvo === 'string' && alvo && some[rel[2]] && some[rel[2]][alvo]) { delete some[rel[2]][alvo]; mantidos.push([rel[2], alvo]); }
        });
      });
      var removidos = 0, tarefas = [];
      cols.forEach(function (col) {
        por[col].forEach(function (x) {
          var orfa = false;
          if (col === 'lembretes') { var partes = String(x.chave || '').split(':'), alvo = partes[0] === 'vacina' ? 'vacinas' : 'prontuarios'; orfa = !vivo(alvo, partes[1]); }
          if (col === 'movimentos') orfa = !vivo('estoque', x.itemId);
          if (col === 'evolucoes') orfa = !vivo('internacoes', x.internacaoId); // observação cuja internação saiu ou nunca existiu
          if (some[col][x.id] || orfa) { removidos++; tarefas.push(store.remover(col, x.id)); }
        });
      });
      mantidos.forEach(function (r) { var x = por[r[0]].find(function (y) { return y.id === r[1]; }); if (x && x.exemplo) tarefas.push(store.salvar(r[0], Object.assign({}, x, { exemplo: false }))); });
      return Promise.all(tarefas).then(function () { return removidos; });
    });
  }

  function temExemplo(store) {
    return Promise.all(['tutores', 'pets', 'consultas', 'estoque'].map(function (c) { return store.listar(c); })).then(function (ls) {
      return ls.some(function (l) { return l.some(function (x) { return x.exemplo; }); });
    });
  }

  return { gerar: gerar, carregar: carregar, remover: remover, temExemplo: temExemplo, existeExemplo: existeExemplo };
});
