/* gate.js: porteiro do módulo de gestão (toggle). Carregado ANTES de qualquer outro script do painel.
   - SITE_CONFIG.modules.gestao diferente de true (ou sem SITE_CONFIG)  ->  mostra "Módulo de gestão não contratado" e NÃO carrega mais nada.
   - caso contrário carrega, em ordem, os scripts listados em data-scripts (nomes relativos a js/).
   Ressalva honesta: isto esconde a interface; só o build sem gestão (pasta painel/ inexistente) remove os arquivos. */
(function () {
  var self = document.currentScript;
  var cfg = window.SITE_CONFIG;
  var semConfig = !cfg || typeof cfg !== 'object';
  /* falha fechada: só abre com gestao === true. Config ausente, "false", 0 ou null = fechado */
  var ativa = !semConfig && !!cfg.modules && cfg.modules.gestao === true;
  window.GESTAO_ATIVA = ativa;

  if (!ativa) {
    document.body.className = 'painel-aviso';
    document.body.textContent = '';
    var caixa = document.createElement('main');
    caixa.className = 'aviso-modulo';
    var h = document.createElement('h1'), p = document.createElement('p');
    if (semConfig) {
      document.title = 'Configuração do site não encontrada';
      h.textContent = 'Configuração do site não encontrada';
      p.textContent = 'Não foi possível ler assets/site-config.js. Confira se a pasta assets/ foi publicada junto com a pasta painel/ e abra o site por um servidor.';
      caixa.appendChild(h); caixa.appendChild(p);
    } else {
      document.title = 'Módulo de gestão não contratado';
      h.textContent = 'Módulo de gestão não contratado';
      var temVitrine = !(cfg.modules && cfg.modules.vitrine === false);
      p.textContent = temVitrine ? 'Este site está com a vitrine ativa. A área de gestão não faz parte do plano contratado.' : 'A área de gestão não faz parte do plano contratado.';
      caixa.appendChild(h); caixa.appendChild(p);
      if (temVitrine) { var a = document.createElement('a'); a.className = 'btn'; a.href = '../index.html'; a.textContent = 'Voltar ao site'; caixa.appendChild(a); }
    }
    var cred = document.createElement('p'), ca = document.createElement('a'); // v1.3: o crédito também na tela de "não contratado" (PEDIDO_DESIGN_3, item E: todos os sites)
    cred.className = 'login-credito'; ca.href = 'https://andremachado.design'; ca.target = '_blank'; ca.rel = 'noopener'; ca.textContent = 'criado por andremachado.design';
    cred.appendChild(ca); caixa.appendChild(cred);
    document.body.appendChild(caixa);
    return;
  }

  var nomes = (self.getAttribute('data-scripts') || '').split(',').filter(Boolean);
  var base = self.src.replace(/gate\.js(\?.*)?$/, '');
  nomes.forEach(function (n) {
    var s = document.createElement('script');
    s.src = base + n.trim() + '.js';
    s.async = false; // mantém a ordem de execução
    s.onerror = function () {
      var e = document.createElement('p'); e.className = 'erro-form'; e.setAttribute('role', 'alert');
      e.textContent = 'Não foi possível carregar ' + n + '.js. Abra o painel por um servidor (ex.: python3 -m http.server) e confira se os arquivos estão na pasta painel/js/.';
      document.body.appendChild(e);
    };
    document.body.appendChild(s);
  });
})();
