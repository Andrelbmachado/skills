/* vitrine.js: comportamento da vitrine (vira assets/app.js do site).
   - formulário de contato: monta a mensagem e abre o WhatsApp (funciona também sem JS: o campo "text" já vai na URL);
   - toggle de módulos: lê window.SITE_CONFIG (assets/site-config.js) e remove os links da gestão quando gestao não é true;
   - slots de galeria e preços: só aparecem quando o cliente forneceu material (assets/material.js define SITE_CONFIG.galeria e SITE_CONFIG.precos). */
(function () {
  function composeMessage(nome, assunto, mensagem, negocio) {
    var partes = [nome ? "Olá! Sou " + nome + " e encontrei " + negocio + " pelo site." : "Olá! Encontrei " + negocio + " pelo site."];
    if (assunto) partes.push("Assunto: " + assunto);
    if (mensagem) partes.push(mensagem);
    return partes.join("\n");
  }

  function modulosAtivos(cfg) {
    var m = (cfg && cfg.modules) || {};
    // vitrine liga por padrão; a gestão só liga com gestao === true (falha fechada: 0, null, "false" ou config ausente = desligada)
    return { vitrine: m.vitrine !== false, gestao: m.gestao === true };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { composeMessage: composeMessage, modulosAtivos: modulosAtivos };
  }
  if (typeof document === "undefined") return;

  var cfg = window.SITE_CONFIG || {};
  var ativos = modulosAtivos(cfg);

  // Toggle: sem gestão contratada, nenhum link de acesso à gestão na vitrine (só gestao === true mantém o link).
  if (!ativos.gestao) {
    document.querySelectorAll('[data-modulo="gestao"]').forEach(function (el) { el.remove(); });
  }

  // Formulário -> WhatsApp.
  document.querySelectorAll("form.wa-form").forEach(function (form) {
    form.addEventListener("submit", function () {
      var ta = form.querySelector("textarea[name=text]");
      var original = ta.value;
      var nome = form.querySelector("#f-nome");
      var assunto = form.querySelector("#f-assunto");
      ta.value = composeMessage(
        nome ? nome.value.trim() : "",
        assunto ? assunto.value : "",
        original.trim(),
        form.getAttribute("data-negocio") || ""
      );
      setTimeout(function () { ta.value = original; }, 800);
    });
  });

  // Slots de material real. Sem entrada em SITE_CONFIG, nada é criado.
  function secao(titulo, conteudo) {
    var s = document.createElement("section");
    s.className = "secao";
    var c = document.createElement("div");
    c.className = "container";
    var cab = document.createElement("div");
    cab.className = "secao-cabeca";
    var h = document.createElement("h2");
    h.textContent = titulo;
    cab.appendChild(h);
    c.appendChild(cab);
    c.appendChild(conteudo);
    s.appendChild(c);
    return s;
  }

  var slotGaleria = document.querySelector('[data-slot="galeria"]');
  if (slotGaleria && Array.isArray(cfg.galeria) && cfg.galeria.length) {
    var grade = document.createElement("div");
    grade.className = "galeria";
    cfg.galeria.forEach(function (f) {
      if (!f || !f.src || !f.alt) return; // foto sem descrição real não entra
      var fig = document.createElement("figure");
      var img = document.createElement("img");
      img.src = f.src;
      img.alt = f.alt;
      img.loading = "lazy";
      fig.appendChild(img);
      if (f.legenda) {
        var cap = document.createElement("figcaption");
        cap.textContent = f.legenda;
        fig.appendChild(cap);
      }
      grade.appendChild(fig);
    });
    if (grade.children.length) slotGaleria.replaceWith(secao("Fotos", grade));
  }

  var slotPrecos = document.querySelector('[data-slot="precos"]');
  if (slotPrecos && Array.isArray(cfg.precos) && cfg.precos.length) {
    var tab = document.createElement("table");
    tab.className = "tabela-precos";
    var cap = document.createElement("caption");
    cap.className = "sr-only";
    cap.textContent = "Valores informados pela clínica";
    tab.appendChild(cap);
    cfg.precos.forEach(function (p) {
      if (!p || !p.servico || !p.valor) return;
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.scope = "row";
      th.textContent = p.servico;
      var td = document.createElement("td");
      td.textContent = p.valor;
      tr.appendChild(th);
      tr.appendChild(td);
      tab.appendChild(tr);
    });
    if (tab.rows.length) slotPrecos.replaceWith(secao("Valores", tab));
  }

  // Entrada ao rolar (v1.0): só esconde (classe js-revela) depois que o observador existe e nunca com prefers-reduced-motion.
  // Sem JS, sem IntersectionObserver ou com movimento reduzido, tudo fica visível desde o início.
  var reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revelar = document.querySelectorAll(".revela");
  if (!reduz && "IntersectionObserver" in window && revelar.length) {
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("visto");
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revelar.forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 70 + "ms"; io.observe(el); });
    document.documentElement.classList.add("js-revela");
  }
})();
