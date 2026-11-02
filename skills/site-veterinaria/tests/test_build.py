"""Testes do gerador (build_vet_site.py): rodar com  python3 -m unittest discover -s .claude/skills/site-veterinaria/tests
Usa o slug familia-vet como caso de referência e grava só em diretórios temporários."""
import contextlib
import html as htmllib
import io
import json
import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SKILL = AQUI.parent
ROOT = SKILL.parents[2]
sys.path.insert(0, str(SKILL))
sys.path.insert(0, str(ROOT / "tools"))

import build_vet_site as bv  # noqa: E402
import model  # noqa: E402
import themes  # noqa: E402
import validate  # noqa: E402

SLUG = "familia-vet"
PERFIL_SEM_EXTRAS = {"pendencias_gestao": [], "pendencias_vitrine": [], "pesquisa_pendente": [], "opcoes": [], "retirar_servicos": [], "mapa": None, "hero_servicos": None}  # chaves do perfil que a v0.7, a v0.8 e a v1.0 acrescentaram (sites 1 a 4 não usam)


def um_whatsapp_so_icone(teste, html: str, digitos: str, pagina: str = "") -> None:
    """v1.1 (PEDIDO_DESIGN_3, item F): UM botão de WhatsApp por página, o flutuante, redondo e só com o ícone (aria-label "Conversar no WhatsApp"); nada no topo."""
    teste.assertEqual(html.count(f"https://wa.me/{digitos}"), 1, pagina)
    teste.assertNotIn("btn-topo", html, pagina)
    a = re.search(rf'<a class="wa-flutuante" href="https://wa\.me/{digitos}[^"]*" target="_blank" rel="noopener" aria-label="Conversar no WhatsApp">(.*?)</a>', html, re.S)
    teste.assertIsNotNone(a, pagina)
    teste.assertEqual(re.sub(r"<svg.*?</svg>", "", a.group(1), flags=re.S).strip(), "", f"{pagina}: o flutuante é só o ícone")
PROIBIDOS_CLIENTE = re.compile(r"claude|anthropic|\bIA\b|intelig[eê]ncia artificial|automa[cç]|chatbot|\bGPT\b|\bagentes?\b|assistente virtual|\brob[ôo]s?\b|\bbots?\b", re.I)


# Pendências do README que descrevem a VITRINE (botão Ligar, galeria, título, Sobre, Contato...): o pacote ESSENCIAL não tem vitrine e não pode trazê-las (dívida do site 6, paga na 0.8)
SO_DA_VITRINE = ("WhatsApp não confirmado", "sem celular: só telefone fixo", "registro profissional do responsável (CRMV)", "fotos reais do negócio", "CEP fora do site", "Nome com prazo:", "Horário a confirmar: o título",
                 "Horário a confirmar: o site mostra", "horário de atendimento não encontrado em fonte", "Fotos, preços de produtos e marcas só entram", "Número do endereço fora do site",
                 "Registro profissional mostrado", "Registro profissional fora do site")


def confere_pendencia(test, essencial, p, r, nome):
    if essencial and any(p.startswith(s) for s in SO_DA_VITRINE):
        test.assertNotIn(p, r, f"{nome}: o pacote não tem vitrine, e a pendência descreve a vitrine: {p}")
    else:
        test.assertIn(p, r, f"{nome}: {p}")


def sem_ilustrativas(html: str) -> str:
    """v1.0: tira do HTML as imagens ilustrativas (geradas, com a legenda "Imagem ilustrativa" visível). Sobra só o que seria foto do negócio, que continua proibida
    sem material do cliente. Uma <img> fora de <figure ... data-ilustrativa> com a legenda continua reprovando."""
    return re.sub(r'<figure class="[^"]*" data-ilustrativa><img [^>]*><figcaption>Imagem ilustrativa</figcaption></figure>', "", html)


class TestBuild(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="vet-build-"))
        cls.completo = bv.gerar(SLUG, gestao=True, saida=str(cls.tmp / "completo"))
        cls.sem = bv.gerar(SLUG, gestao=False, saida=str(cls.tmp / "sem"))
        cls.b = model.load_business(SLUG)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_build_completo_tem_painel_e_toggle_ligado(self):
        self.assertTrue((self.completo / "painel" / "index.html").is_file())
        self.assertTrue((self.completo / "painel" / "app.html").is_file())
        self.assertTrue((self.completo / "painel" / "js" / "store.js").is_file())
        cfg = (self.completo / "assets" / "site-config.js").read_text(encoding="utf-8")
        self.assertIn("modules: { vitrine: true, gestao: true }", cfg)
        self.assertIn('href="painel/"', (self.completo / "index.html").read_text(encoding="utf-8"))

    def test_build_sem_gestao_nao_gera_painel_nem_link(self):
        self.assertFalse((self.sem / "painel").exists())
        cfg = (self.sem / "assets" / "site-config.js").read_text(encoding="utf-8")
        self.assertIn("modules: { vitrine: true, gestao: false }", cfg)
        for pagina in ("index.html", "sobre.html", "contato.html"):
            html = (self.sem / pagina).read_text(encoding="utf-8")
            self.assertNotIn("painel", html.lower(), pagina)
            self.assertNotIn("data-modulo", html, pagina)
        self.assertNotIn("painel/", (self.sem / "README.md").read_text(encoding="utf-8").split("## Módulos")[0])
        self.assert_sem_rastro_do_painel(self.sem)

    def assert_sem_rastro_do_painel(self, pasta):
        """BÁSICO: nem o README, nem o site-config.js, nem o JS/CSS da vitrine citam o painel (item 11 da revisão)."""
        for rel in ("README.md", "assets/site-config.js", "assets/app.js", "assets/style.css", "assets/material.js"):
            texto = (pasta / rel).read_text(encoding="utf-8")
            self.assertNotRegex(texto, r"(?i)painel", f"{pasta.name}/{rel}")
        cfg = (pasta / "assets" / "site-config.js").read_text(encoding="utf-8")
        self.assertNotIn("painel:", cfg)
        self.assertIn("gestao: false", cfg)

    def test_rebuild_sem_gestao_remove_painel_antigo(self):
        d = self.tmp / "troca"
        bv.gerar(SLUG, gestao=True, saida=str(d))
        self.assertTrue((d / "painel").exists())
        bv.gerar(SLUG, gestao=False, saida=str(d))
        self.assertFalse((d / "painel").exists())

    def test_vitrine_passa_no_validador_do_projeto(self):
        for pasta in (self.completo, self.sem):
            self.assertEqual(validate.check_site(self.b, str(pasta)), [], pasta.name)

    def test_copy_do_json_aparece_sem_inventar_nada(self):
        c = self.b["content"]
        idx = (self.completo / "index.html").read_text(encoding="utf-8")
        self.assertIn(c["tagline"], idx)
        self.assertIn("nota 4,8 com 346 avaliações", idx)
        sobre = (self.completo / "sobre.html").read_text(encoding="utf-8")
        for p in c["about"]:
            esperado = p.replace("CNPJ aberto em 2019", "CNPJ aberto em 2019 (segundo o Solutudo)")  # v0.8: a fonte do ano de abertura entra no próprio texto
            self.assertIn(esperado.replace("&", "&amp;"), sobre)
        # sem horário/registro nos dados => nada disso na vitrine
        for pagina in ("index.html", "contato.html", "sobre.html"):
            html = (self.completo / pagina).read_text(encoding="utf-8")
            self.assertNotRegex(html, r"CRMV|Horário")
        # sem fotos/preços reais => nenhuma seção de foto ou valores no HTML estático
        for pagina in ("index.html",):
            html = (self.completo / pagina).read_text(encoding="utf-8")
            self.assertNotIn("<img", sem_ilustrativas(html))
            self.assertNotIn('class="galeria"', html)
            self.assertNotIn("tabela-precos", html)

    def test_iphone_nao_transforma_telefone_em_link_de_ligar(self):
        """v1.1: os números são texto; sem a meta o iPhone faz deles um link de ligar (um "botão de ligar" que o pedido proíbe)."""
        for pagina in ("index.html", "sobre.html", "contato.html"):
            self.assertIn('<meta name="format-detection" content="telephone=no">', (self.completo / pagina).read_text(encoding="utf-8").split("</head>")[0], pagina)

    def test_servicos_sao_secao_da_inicial_com_imagem_ilustrativa(self):
        """v1.0 (PEDIDO_DESIGN_2): não há servicos.html; "Serviços" no menu rola até #servicos da inicial; todo serviço tem um card com a imagem ilustrativa do tipo."""
        self.assertFalse((self.completo / "servicos.html").exists())
        for pagina in ("index.html", "sobre.html", "contato.html"):
            html = (self.completo / pagina).read_text(encoding="utf-8")
            self.assertIn('href="index.html#servicos"', html); self.assertNotIn("servicos.html", html)
        idx = (self.completo / "index.html").read_text(encoding="utf-8")
        secao = re.search(r'<section class="[^"]*" id="servicos">(.*?)</section>', idx, re.S).group(1)
        self.assertEqual(secao.count('<article class="servico servico--foto'), len(self.b["content"]["services"]))
        usadas = re.findall(r'<figure class="ilustra" data-ilustrativa><img src="assets/ilustrativas/([a-z-]+)\.webp" alt="[^"]+"[^>]*><figcaption>Imagem ilustrativa</figcaption></figure>', secao)
        self.assertEqual(len(usadas), len(self.b["content"]["services"]))
        self.assertEqual(sorted(p.stem for p in (self.completo / "assets" / "ilustrativas").iterdir()), sorted(set(usadas)))  # só as usadas são copiadas
        r = (self.completo / "README.md").read_text(encoding="utf-8")
        self.assertIn("### Imagens ilustrativas", r)
        for nome in usadas:
            self.assertIn(f"`assets/ilustrativas/{nome}.webp`", r)
        self.assertEqual(bv.vc.foto_servico({"title": "Banho e tosa", "text": ""})[0], "vet-banho-tosa")
        self.assertEqual(bv.vc.foto_servico({"title": "Cirurgias", "text": ""})[0], "vet-cirurgia")
        self.assertEqual(bv.vc.foto_servico({"title": "Qualquer coisa", "text": ""})[0], "vet-atendimento")
        for _, arquivo, *_ in bv.vc.FOTOS_SERVICO:
            self.assertTrue((SKILL / "ilustrativas" / f"{arquivo}.webp").is_file(), arquivo)

    def test_como_chegar_saiu_do_topo_e_fica_no_fim_da_inicial_e_no_rodape(self):
        idx = (self.completo / "index.html").read_text(encoding="utf-8")
        topo = idx[:idx.index("</header>")]; self.assertNotIn("Como chegar", topo); self.assertNotIn("google.com/maps", topo)
        principal = idx[idx.index("<main"):idx.index("</main>")]
        ultima = principal[principal.rindex("<section"):]
        self.assertIn('id="localizacao"', ultima); self.assertIn("Como chegar", ultima); self.assertIn("<iframe", ultima)
        hero = idx[idx.index('<section class="hero'):idx.index("</section>", idx.index('<section class="hero'))]
        self.assertNotIn("Como chegar", hero)
        for pagina in ("index.html", "sobre.html", "contato.html"):
            rodape = (self.completo / pagina).read_text(encoding="utf-8").split("<footer", 1)[1]
            self.assertRegex(rodape, r'<a class="rodape-rota" href="https://www\.google\.com/maps[^"]*" target="_blank" rel="noopener">.*?Como chegar</a>')

    def test_pegadas_andam_como_um_cachorro_so_com_opacidade(self):
        """v1.1 (PEDIDO_DESIGN_3, itens G e H): patas 5x maiores (150) num caminho em S do canto superior esquerdo ao inferior direito, numa camada fixa atrás do
        conteúdo; cada pata tem o seu passo (--passo) e a animação só mexe em opacidade, só com movimento liberado, a 2 passos por segundo."""
        idx = (self.completo / "index.html").read_text(encoding="utf-8")
        self.assertNotIn('class="pegadas"', idx[idx.index('<section class="hero'):idx.index("</section>", idx.index('<section class="hero'))])  # saiu da faixa do hero
        camada = re.search(r'<div class="pegadas" aria-hidden="true">(.*?)</div>', idx, re.S).group(1)
        for forma, (larg, alt) in (("paisagem", (1280, 800)), ("retrato", (390, 844))):
            svg = re.search(rf'<svg class="pegadas-{forma}" viewBox="0 0 {larg} {alt}" preserveAspectRatio="xMidYMid slice" focusable="false">(.*?)</svg>', camada, re.S).group(1)
            usos = re.findall(r'<use href="#pata" width="150" height="150" transform="translate\((-?\d+) (-?\d+)\) rotate\((-?\d+) 75 75\)" style="--passo:(\d+)"/>', svg)
            self.assertEqual([int(u[3]) for u in usos], list(range(len(usos)))); self.assertGreaterEqual(len(usos), 10, forma)  # o S precisa se ler também no celular
            xs, ys = [int(u[0]) + 75 for u in usos], [int(u[1]) + 75 for u in usos]
            self.assertTrue(all(40 <= x <= larg - 40 and 40 <= y <= alt - 40 for x, y in zip(xs, ys)), f"{forma}: pata com o centro fora da tela")
            self.assertLess(xs[0], larg * .35); self.assertLess(ys[0], alt * .2)  # começa no canto superior esquerdo (no retrato a pata tem 38% da largura)
            self.assertGreater(xs[-1], larg * .65); self.assertGreater(ys[-1], alt * .75)  # termina no canto inferior direito
            self.assertGreaterEqual(sum(1 for a, b, c in zip(xs, xs[1:], xs[2:]) if (b - a) * (c - b) < 0), 2)  # vai e volta: serpenteia
            self.assertTrue(any(b < a for a, b in zip(ys, ys[1:])))  # também sobe em algum trecho
        for pagina in ("sobre.html", "contato.html"):
            self.assertNotIn('class="pegadas"', (self.completo / pagina).read_text(encoding="utf-8"))
        css = (SKILL / "temas" / "caderneta.vitrine.css").read_text(encoding="utf-8")
        base = (SKILL / "components" / "vitrine.base.css").read_text(encoding="utf-8")
        self.assertIn(".pegadas { position: fixed; inset: 0; z-index: 0; pointer-events: none; }", base)  # estrutura no chão liso; o tema só pinta e anima
        bloco = re.search(r"@media \(prefers-reduced-motion: no-preference\) \{\n  \.pegadas \{.*?\n\}", css, re.S).group(0)
        self.assertIn("animation-delay: calc(var(--passo) * .5s)", bloco)  # 2 passos por segundo
        quadros = re.search(r"@keyframes passo \{(.*?)\}\n", css).group(1)
        self.assertEqual(set(re.findall(r"([a-z-]+):", quadros)), {"opacity"})

    def test_credito_tambem_na_pagina_de_acesso_e_no_login(self):
        d = bv.gerar(SLUG, vitrine=False, saida=str(self.tmp / "acesso-credito"))
        self.assertIn('<a href="https://andremachado.design" target="_blank" rel="noopener">criado por andremachado.design</a>', (d / "index.html").read_text(encoding="utf-8").split("<footer", 1)[1])
        self.assertIn("criado por andremachado.design", (SKILL / "painel" / "js" / "login.js").read_text(encoding="utf-8"))
        self.assertIn("https://andremachado.design", (SKILL / "painel" / "js" / "gate.js").read_text(encoding="utf-8"))  # v1.3: também na tela "Módulo de gestão não contratado"

    def test_whatsapp_real_em_todas_as_paginas_um_unico_botao_flutuante(self):
        """v1.1 (PEDIDO_DESIGN_3, item F, substitui o A): um único botão de WhatsApp por página, o flutuante redondo só com o ícone; nada no topo; nenhum formulário, nenhum tel:."""
        wa = self.b["whatsapp"]["digits"]
        for pagina in ("index.html", "sobre.html", "contato.html"):
            html = (self.completo / pagina).read_text(encoding="utf-8")
            um_whatsapp_so_icone(self, html, wa, pagina)
            self.assertNotIn("<form", html); self.assertNotIn("tel:", html); self.assertNotIn("ligar-flutuante", html)
            self.assertIn('<a href="https://andremachado.design" target="_blank" rel="noopener">criado por andremachado.design</a>', html[html.index("<footer"):])
        contato = (self.completo / "contato.html").read_text(encoding="utf-8")
        self.assertIn("google.com/maps", contato)

    def test_nada_de_ferramenta_ou_ia_visivel_ao_cliente(self):
        for pasta in (self.completo, self.sem):
            for arq in pasta.rglob("*"):
                if arq.is_file() and arq.suffix in {".html", ".js", ".css", ".md", ".svg"}:
                    achado = PROIBIDOS_CLIENTE.search(arq.read_text(encoding="utf-8"))
                    self.assertIsNone(achado, f"{arq.relative_to(pasta)}: {achado and achado.group(0)}")

    def test_sem_recurso_externo_nem_fonte_externa(self):
        for arq in self.completo.rglob("*"):
            if not arq.is_file() or arq.suffix not in {".html", ".css", ".js"}:
                continue
            t = arq.read_text(encoding="utf-8")
            t_sem_maps = t.replace("https://www.google.com/maps", "").replace("https://wa.me/", "")
            self.assertNotRegex(t_sem_maps, r"""(?:src|href)=["']https?://(?!wa\.me|andremachado\.design)""" if arq.suffix == ".html" else r"@import|url\(https?:", f"{arq.name}")
            self.assertNotIn("fonts.googleapis", t)

    def test_acessibilidade_basica_do_html(self):
        for pagina in ("index.html", "sobre.html", "contato.html"):
            html = (self.completo / pagina).read_text(encoding="utf-8")
            self.assertIn('<html lang="pt-BR">', html)
            self.assertIn('name="viewport"', html)
            self.assertEqual(html.count("<h1"), 1, pagina)
            self.assertIn('class="pular"', html)
            self.assertRegex(html, r'<main id="conteudo">')
        css = (self.completo / "assets" / "style.css").read_text(encoding="utf-8")
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn(":focus-visible", css)
        painel = (self.completo / "painel" / "painel.css").read_text(encoding="utf-8")
        self.assertIn("prefers-reduced-motion", painel)
        self.assertIn(":focus-visible", painel)

    def test_material_do_cliente_vive_em_arquivo_proprio_que_o_gerador_nao_sobrescreve(self):
        d = self.tmp / "material"
        bv.gerar(SLUG, saida=str(d))
        arq = d / "assets" / "material.js"
        self.assertTrue(arq.is_file())
        self.assertNotIn("galeria", (d / "assets" / "site-config.js").read_text(encoding="utf-8").split("window.SITE_CONFIG")[1])
        # JS válido e não só JSON: aspas simples, chave sem aspas, vírgula sobrando, várias linhas, comentário
        meu = """/* meu material */
window.SITE_CONFIG = window.SITE_CONFIG || {};
window.SITE_CONFIG.galeria = [
  { src: 'assets/img/a.jpg', alt: "Recepção da clínica", legenda: 'Entrada' },  // foto 1
];
window.SITE_CONFIG.precos = [
  { servico: 'Consulta',
    valor: 'R$ 100,00' },
  { servico: "Vacina [V10]", valor: "R$ 90,00" },
];
"""
        arq.write_text(meu, encoding="utf-8")
        for _ in range(2):
            bv.gerar(SLUG, saida=str(d))
            self.assertEqual(arq.read_text(encoding="utf-8"), meu)
        bv.gerar(SLUG, vitrine=False, saida=str(d))
        bv.gerar(SLUG, gestao=False, saida=str(d))
        self.assertEqual(arq.read_text(encoding="utf-8"), meu)

    def test_migra_galeria_e_precos_que_estavam_no_site_config_antigo(self):
        d = self.tmp / "legado"
        bv.gerar(SLUG, saida=str(d))
        (d / "assets" / "material.js").unlink()
        antigo = """/* Configuração do site.
     formato da galeria: lista de objetos
   galeria: [{src: 'exemplo-no-comentario.jpg'}] */
window.SITE_CONFIG = {
  modules: { vitrine: true, gestao: true },
  negocio: {"slug": "x"},
  galeria: [{src: 'assets/img/fachada.jpg', alt: 'Fachada, "vista" da rua'}, {src: "assets/img/sala.jpg", alt: 'Sala [1]'}],
  precos: [
    { servico: 'Consulta', valor: 'R$ 100,00' },
    { servico: 'Retorno', valor: 'R$ 50,00' }
  ]
};
"""
        (d / "assets" / "site-config.js").write_text(antigo, encoding="utf-8")
        bv.gerar(SLUG, saida=str(d))
        material = (d / "assets" / "material.js").read_text(encoding="utf-8")
        self.assertIn("{src: 'assets/img/fachada.jpg', alt: 'Fachada, \"vista\" da rua'}", material)
        self.assertIn("{ servico: 'Retorno', valor: 'R$ 50,00' }", material)
        self.assertNotIn("exemplo-no-comentario", material)  # exemplo do comentário nunca vira material
        novo = (d / "assets" / "site-config.js").read_text(encoding="utf-8")
        self.assertNotIn("fachada", novo)
        self.assertIn("modules: { vitrine: true, gestao: true }", novo)

    def test_site_config_antigo_ilegivel_para_o_gerador_em_vez_de_zerar_o_material(self):
        d = self.tmp / "ilegivel"
        bv.gerar(SLUG, saida=str(d))
        (d / "assets" / "material.js").unlink()
        cfg = d / "assets" / "site-config.js"
        cfg.write_text("window.SITE_CONFIG = {\n  modules: { vitrine: true, gestao: true },\n  galeria: [{src: 'a.jpg', alt: 'sem fechar'},\n  precos: []\n};\n", encoding="utf-8")
        antes = cfg.read_text(encoding="utf-8")
        with self.assertRaises(SystemExit) as r:
            bv.gerar(SLUG, saida=str(d))
        self.assertIn("galeria", str(r.exception))
        self.assertEqual(cfg.read_text(encoding="utf-8"), antes)  # nada foi alterado
        self.assertFalse((d / "assets" / "material.js").exists())

    def test_json_ld_com_endereco_separado(self):
        for pasta, slug in ((self.completo, SLUG),):
            idx = (pasta / "index.html").read_text(encoding="utf-8")
            ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', idx, re.S).group(1))
            end = ld["address"]
            self.assertEqual(end["streetAddress"], "Av. Itavuvu, 5294")
            self.assertEqual(end["addressLocality"], "Sorocaba")
            self.assertEqual(end["postalCode"], "18078-005")
            self.assertNotRegex(end["streetAddress"], r"Sorocaba|\d{5}-\d{3}")
        # endereço fora do padrão: mantém o texto inteiro, não inventa nem corta
        self.assertEqual(bv.vc.endereco_estruturado("Rua X, 10")["streetAddress"], "Rua X, 10")
        self.assertNotIn("postalCode", bv.vc.endereco_estruturado("Rua X, 10"))

    def test_template_do_painel_sem_apagar_no_login_e_sem_math_random_em_senha(self):
        painel = SKILL / "painel" / "js"
        self.assertNotIn("limparTudo", (painel / "login.js").read_text(encoding="utf-8"))
        self.assertNotIn("Apagar dados deste navegador", (painel / "login.js").read_text(encoding="utf-8"))
        self.assertNotIn("Math.random", (painel / "modulos" / "config.js").read_text(encoding="utf-8"))
        self.assertNotIn("Math.random", (painel / "auth.js").read_text(encoding="utf-8"))
        self.assertNotIn("regras.test", (painel / "regras.js").read_text(encoding="utf-8"))  # arquivo de teste inexistente citado no código do cliente

    def test_todo_tema_tem_contraste_minimo_4_5(self):
        for arq in sorted((SKILL / "temas").glob("*.json")):
            tema = bv.carregar_tema(arq.stem)
            t = tema["tokens"]
            self.assertGreaterEqual(len(tema["pares_contraste"]), 10, arq.stem)
            for a, b in tema["pares_contraste"]:
                self.assertGreaterEqual(themes.contrast(t[a], t[b]), 4.5, f"{arq.stem}: {a} x {b}")

    def test_temas_cumprem_o_mesmo_contrato_de_papeis(self):
        """O painel e a vitrine base leem estes tokens; um tema novo precisa defini-los todos (papéis, não cores)."""
        referencia = set(bv.carregar_tema("caderneta")["tokens"])
        for arq in sorted((SKILL / "temas").glob("*.json")):
            tema = bv.carregar_tema(arq.stem)
            self.assertEqual(set(tema["tokens"]), referencia, arq.stem)
            usados = set(re.findall(r"var\(--([a-z-]+)\)", (SKILL / "components" / "vitrine.base.css").read_text(encoding="utf-8")
                                    + (SKILL / "painel" / "painel.css").read_text(encoding="utf-8")))
            self.assertLessEqual(usados - referencia - {"hora"}, set(), "CSS base usa token que nenhum tema define")  # --hora é calculada pela agenda em JS
            for css in (tema.get("css") or {}).values():
                if css:
                    texto = (SKILL / "temas" / css).read_text(encoding="utf-8")
                    self.assertLessEqual(set(re.findall(r"var\(--([a-z-]+)\)", texto)) - referencia - {"passo", "escamas", "hexagono", "hex-corte", "escamas-painel", "fio", "chevrons", "chevrons-painel"}, set(), css)

    def test_chips_e_textos_do_painel_tem_contraste_minimo(self):
        css = (SKILL / "painel" / "painel.css").read_text(encoding="utf-8")
        pares = re.findall(r"\.chip-(\w+) \{ background: (#[0-9a-f]{6}); color: ([^;]+);", css)
        self.assertGreaterEqual(len(pares), 5)
        for arq in sorted((SKILL / "temas").glob("*.json")):
            tokens = bv.carregar_tema(arq.stem)["tokens"]
            for nome, fundo, cor in pares:
                cor = tokens[cor.strip()[4:-1]] if cor.strip().startswith("var(") else cor.strip()
                self.assertGreaterEqual(themes.contrast(cor, fundo), 4.5, f"{arq.stem}: chip-{nome}")
        for nome, cor, fundo in (("pos", "#0b5a3a", "#ffffff"), ("neg", "#8a1f1f", "#ffffff"), ("aviso-forte", "#5c3b00", "#fff9e6")):
            self.assertGreaterEqual(themes.contrast(cor, fundo), 4.5, nome)

    def test_readme_explica_toggle_e_limite_do_login(self):
        r = (self.completo / "README.md").read_text(encoding="utf-8")
        self.assertIn("gestao: true", r)
        self.assertIn("mantém a gestão **fechada**", r)
        self.assertIn("HTML bruto desta variante ainda contém o link", r)  # não promete "nenhum link" onde há link no HTML
        self.assertIn("Recursos externos", r)
        self.assertIn("barreira de interface, não segurança real", r)
        self.assertIn("Não há limite de tentativas", r)
        self.assertIn("armazenamento do navegador", r)
        self.assertIn("Carregar dados de exemplo", r)

    def test_perfis_apontam_para_tema_subtipo_e_slug_existentes(self):
        perfis = sorted((SKILL / "perfis").glob("*.json"))
        self.assertGreaterEqual(len(perfis), 2)
        slugs = {b["slug"] for b in model.load_all()}
        for arq in perfis:
            perfil = json.loads(arq.read_text(encoding="utf-8"))
            self.assertIn(arq.stem, slugs)
            self.assertTrue((SKILL / "temas" / f"{perfil['tema']}.json").is_file(), arq.name)
            self.assertTrue((SKILL / "subtipos" / f"{perfil['subtipo']}.json").is_file(), arq.name)
        self.assertEqual(bv.carregar_perfil("slug-sem-perfil"), {"subtipo": "geral", "tema": "caderneta", "pendencias": [], **PERFIL_SEM_EXTRAS})

    def test_site_1_continua_na_identidade_caderneta(self):
        """Regressão da v0.3: o perfil fixa tema e subtipo; a vitrine do site 1 não ganhou nada do tema novo."""
        idx = (self.completo / "index.html").read_text(encoding="utf-8")
        self.assertIn('<section class="hero">', idx)
        self.assertNotIn("viveiro", idx)
        self.assertNotIn('class="quadro"', idx)
        self.assertIn("<symbol id='pata'", idx)
        self.assertEqual((self.completo / "assets" / "style.css").read_text(encoding="utf-8"),
                         (SKILL / "components" / "vitrine.base.css").read_text(encoding="utf-8")
                         + "\n" + (SKILL / "components" / "movimento.css").read_text(encoding="utf-8")  # v1.0: movimento comum entre o chão liso e o tema
                         + "\n/* ---- tema caderneta ---- */\n" + (SKILL / "temas" / "caderneta.vitrine.css").read_text(encoding="utf-8"))
        cfg = (self.completo / "assets" / "site-config.js").read_text(encoding="utf-8")
        self.assertNotIn("painel:", cfg)  # subtipo geral e ícone de marca padrão: nada a configurar
        self.assertNotIn("terrario", (self.completo / "painel" / "painel.css").read_text(encoding="utf-8"))

    def test_descricao_para_buscadores_nao_corta_frase_no_meio(self):
        f = bv.vc.resumo_meta
        self.assertEqual(f("Curto."), "Curto.")
        longo = "A Casa atende na Av. X, 10, no bairro Y. Segundo o diretório, o atendimento é diário e acontece com hora marcada para todos os animais da região inteira."
        self.assertEqual(f(longo), "A Casa atende na Av. X, 10, no bairro Y. Segundo o diretório, o atendimento é diário e acontece com hora marcada para todos os animais da região inteira."[:len(f(longo))])
        self.assertTrue(f(longo).endswith(".") and len(f(longo)) <= 155, f(longo))
        sem_ponto = ("palavra " * 40).strip()
        self.assertTrue(f(sem_ponto).endswith("palavra…") and len(f(sem_ponto)) <= 156)

    def test_css_base_da_vitrine_e_neutro(self):
        """v0.4: o chão liso não carrega identidade nenhuma (picote, sombra deslocada, pontilhado, forma, animação); isso é de cada tema."""
        base = (SKILL / "components" / "vitrine.base.css").read_text(encoding="utf-8")
        self.assertNotRegex(base, r"box-shadow: \d|dotted|dashed|radial-gradient|rotate\(|@keyframes|clip-path:|animation: (?!none)")
        self.assertIn("prefers-reduced-motion", base)
        self.assertIn(":focus-visible", base)
        self.assertFalse((SKILL / "components" / "vitrine.css").exists(), "o CSS antigo (base com a identidade da caderneta) não deve voltar")
        caderneta = (SKILL / "temas" / "caderneta.vitrine.css").read_text(encoding="utf-8")
        for marca in ("dotted", "radial-gradient", "carimbar", "7px 7px 0"):
            self.assertIn(marca, caderneta)  # a identidade do site 1 mora no tema

    def test_camada_das_pegadas_tem_estrutura_no_chao_liso(self):
        """v1.1 (revisão): o ornamento padrão liga as pegadas; um tema novo sem o CSS delas jogaria dois SVGs de 1280x800 e 390x844 no meio da página.
        A estrutura da camada (fixa, atrás do conteúdo, sem clique, paisagem ou retrato) mora no chão liso; o tema só dá cor, opacidade e o passo."""
        base = (SKILL / "components" / "vitrine.base.css").read_text(encoding="utf-8")
        regra = re.search(r"\.pegadas \{([^}]*)\}", base).group(1)
        for d in ("position: fixed", "inset: 0", "z-index: 0", "pointer-events: none"):
            self.assertIn(d, regra)
        self.assertIn(".pegadas svg {", base); self.assertIn(".pegadas-retrato { display: none", base); self.assertIn("@media (orientation: portrait)", base)
        self.assertIn("body:has(> .pegadas)", base)  # o conteúdo sobe acima da camada só quando ela existe

    def test_css_base_do_painel_e_neutro(self):
        base = (SKILL / "painel" / "painel.css").read_text(encoding="utf-8")
        self.assertNotRegex(base, r"7px 7px 0|radial-gradient|rgba\(14, 59, 53|#e3e9e5|#f7faf8|#eef3f0")  # picote, sombra amarela e cinzas verdes são da caderneta
        caderneta = (SKILL / "temas" / "caderneta.painel.css").read_text(encoding="utf-8")
        for marca in ("7px 7px 0", "radial-gradient", "rgba(14, 59, 53"):
            self.assertIn(marca, caderneta)

    def test_baixa_da_baseline_nao_acontece_em_saida_customizada(self):
        base = ROOT / "sites" / "_baseline-gerado" / "pet-veterinaria" / SLUG
        existia = base.exists()
        bv.gerar(SLUG, saida=str(self.tmp / "outra"))
        self.assertEqual(base.exists(), existia)


SLUG2 = "espaco-veterinario-atendimento-de-pets-silvestres"
ARQUIVOS_VITRINE = ("sobre.html", "contato.html", "assets/style.css", "assets/app.js")


class TestSite2ETresPacotes(unittest.TestCase):
    """Site 2 (silvestres e exóticos, tema terrario) nos três pacotes: PREMIUM, BÁSICO (--sem-gestao) e ESSENCIAL (--sem-vitrine)."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="vet-build2-"))
        cls.premium = bv.gerar(SLUG2, saida=str(cls.tmp / "premium"))
        cls.basico = bv.gerar(SLUG2, gestao=False, saida=str(cls.tmp / "basico"))
        cls.essencial = bv.gerar(SLUG2, vitrine=False, saida=str(cls.tmp / "essencial"))
        cls.b = model.load_business(SLUG2)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def ler(self, pasta, rel):
        return (pasta / rel).read_text(encoding="utf-8")

    # ---- ESSENCIAL: só o painel ----
    def test_essencial_nao_tem_nenhuma_pagina_publica(self):
        for rel in ARQUIVOS_VITRINE:
            self.assertFalse((self.essencial / rel).exists(), rel)
        self.assertTrue((self.essencial / "painel" / "index.html").is_file())
        self.assertTrue((self.essencial / "painel" / "app.html").is_file())
        self.assertEqual(sorted(p.name for p in (self.essencial / "assets").iterdir()), ["favicon.svg", "site-config.js", "tema.css"])
        self.assertEqual(sorted(p.name for p in self.essencial.iterdir()), ["README.md", "assets", "index.html", "painel"])

    def test_essencial_raiz_leva_direto_ao_login(self):
        idx = self.ler(self.essencial, "index.html")
        self.assertIn('<meta http-equiv="refresh" content="0; url=painel/">', idx)
        self.assertIn("location.replace('painel/')", idx)
        self.assertIn('<a href="painel/">Entrar na gestão</a>', idx)
        self.assertIn('name="robots" content="noindex"', idx)
        self.assertEqual(idx.count("<h1>"), 1)
        self.assertNotRegex(idx, r"servicos\.html|sobre\.html|contato\.html|wa\.me")

    def test_essencial_config_diz_vitrine_false_e_gestao_true(self):
        cfg = self.ler(self.essencial, "assets/site-config.js")
        self.assertIn("modules: { vitrine: false, gestao: true }", cfg)
        self.assertIn('"subtipo": "exoticos"', cfg)

    def test_essencial_readme_so_fala_de_gestao(self):
        r = self.ler(self.essencial, "README.md")
        self.assertIn("somente a gestão", r)
        self.assertIn("barreira de interface, não segurança real", r)
        self.assertNotIn("Páginas da vitrine", r)
        self.assertNotIn("Material que o cliente pode enviar", r)

    def test_essencial_regerar_por_cima_do_premium_remove_a_vitrine(self):
        d = self.tmp / "troca2"
        bv.gerar(SLUG2, saida=str(d))
        (d / "assets" / "img").mkdir()
        (d / "assets" / "img" / "foto.jpg").write_bytes(b"x")  # material do cliente nunca é apagado
        bv.gerar(SLUG2, vitrine=False, saida=str(d))
        for rel in ARQUIVOS_VITRINE:
            self.assertFalse((d / rel).exists(), rel)
        self.assertTrue((d / "assets" / "img" / "foto.jpg").exists())
        bv.gerar(SLUG2, saida=str(d))  # e volta ao PREMIUM
        self.assertTrue((d / "sobre.html").is_file())
        self.assertIn("modules: { vitrine: true, gestao: true }", self.ler(d, "assets/site-config.js"))

    def test_essencial_preserva_galeria_e_precos_do_cliente(self):
        d = self.tmp / "material2"
        bv.gerar(SLUG2, saida=str(d))
        mat = d / "assets" / "material.js"
        mat.write_text(mat.read_text(encoding="utf-8").replace("galeria = [];", 'galeria = [{src: "assets/img/a.jpg", alt: "Recepção"}];'), encoding="utf-8")
        bv.gerar(SLUG2, vitrine=False, saida=str(d))
        bv.gerar(SLUG2, saida=str(d))
        self.assertIn('alt: "Recepção"', mat.read_text(encoding="utf-8"))

    def test_flags_sem_gestao_e_sem_vitrine_sao_excludentes(self):
        with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
            bv.main([SLUG2, "--sem-gestao", "--sem-vitrine", "--saida", str(self.tmp / "x")])
        with self.assertRaises(SystemExit):
            bv.gerar(SLUG2, gestao=False, vitrine=False, saida=str(self.tmp / "y"))

    def test_validador_do_projeto_so_reclama_da_vitrine_que_nao_existe_no_essencial(self):
        erros = validate.check_site(self.b, str(self.essencial))
        self.assertTrue(erros)
        for e in erros:
            self.assertRegex(e, r"página ausente: (sobre|contato)\.html|asset ausente: assets/(style\.css|app\.js)|index\.html: (falta wa\.me/|0 botões de WhatsApp|falta o WhatsApp flutuante|falta a seção #servicos)", e)
        # o validador foi escrito para a vitrine: no ESSENCIAL reclama das 2 páginas, dos 2 assets, do wa.me, do botão de WhatsApp (contado e procurado: v1.1) e da seção #servicos
        # que a página de acesso não tem (v1.0). Nada além disso (sem link quebrado, seção vazia, recurso externo, valor vazado nem falta do crédito, que a página
        # de acesso também leva). Por isso `validate.py site` vale para BÁSICO e PREMIUM.
        self.assertEqual(len(erros), 8)

    def test_baseline_nao_confunde_index_do_essencial_com_site_do_pipeline(self):
        base = ROOT / "sites" / "_baseline-gerado" / "pet-veterinaria" / SLUG2
        existia = base.exists()
        bv.gerar(SLUG2, vitrine=False, saida=str(self.tmp / "z"))
        self.assertEqual(base.exists(), existia)
        self.assertRegex(self.ler(self.essencial, "index.html"), r'class="vet[" ]')

    # ---- BÁSICO e PREMIUM ----
    def test_basico_so_vitrine_sem_nenhuma_pista_do_painel(self):
        self.assertFalse((self.basico / "painel").exists())
        self.assertIn("modules: { vitrine: true, gestao: false }", self.ler(self.basico, "assets/site-config.js"))
        for pagina in ("index.html", "sobre.html", "contato.html"):
            self.assertNotIn("painel", self.ler(self.basico, pagina).lower(), pagina)
        self.assertEqual(validate.check_site(self.b, str(self.basico)), [])
        for rel in ("README.md", "assets/site-config.js", "assets/app.js", "assets/style.css", "assets/material.js"):
            self.assertNotRegex((self.basico / rel).read_text(encoding="utf-8"), r"(?i)painel", rel)  # inclusive o JSON do painel (subtipo exóticos)

    def test_premium_vitrine_painel_e_toggle(self):
        self.assertEqual(validate.check_site(self.b, str(self.premium)), [])
        self.assertIn("modules: { vitrine: true, gestao: true }", self.ler(self.premium, "assets/site-config.js"))
        self.assertIn('href="painel/"', self.ler(self.premium, "index.html"))
        self.assertTrue((self.premium / "painel" / "js" / "modulos" / "prontuarios.js").is_file())

    def test_validador_de_conteudo_passa(self):
        self.assertEqual(validate.check_content(self.b), [])

    def test_nada_de_ferramenta_ou_ia_visivel_em_nenhum_pacote(self):
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in pasta.rglob("*"):
                if arq.is_file() and arq.suffix in {".html", ".js", ".css", ".md", ".svg"}:
                    achado = PROIBIDOS_CLIENTE.search(arq.read_text(encoding="utf-8"))
                    self.assertIsNone(achado, f"{pasta.name}/{arq.relative_to(pasta)}: {achado and achado.group(0)}")

    # ---- identidade e receita do subtipo ----
    def test_perfil_aplica_tema_terrario_e_subtipo_exoticos(self):
        idx = self.ler(self.premium, "index.html")
        self.assertIn("hero--viveiro", idx)
        self.assertIn("<symbol id='pena'", idx)
        css = self.ler(self.premium, "assets/style.css")
        self.assertTrue(css.startswith((SKILL / "components" / "vitrine.base.css").read_text(encoding="utf-8")))
        self.assertIn("tema terrario", css)
        self.assertIn("terrario", self.ler(self.premium, "painel/painel.css"))
        self.assertIn("#c6ec3f", self.ler(self.premium, "assets/favicon.svg"))
        cfg = self.ler(self.premium, "assets/site-config.js")
        self.assertIn('"marca": "pena"', cfg)
        self.assertIn('"pesoEmGramas": true', cfg)

    def test_flag_de_tema_sobrepoe_o_perfil(self):
        d = bv.gerar(SLUG2, saida=str(self.tmp / "tema-troca"), tema_nome="caderneta")
        self.assertIn('<section class="hero">', self.ler(d, "index.html"))
        self.assertNotIn("viveiro", self.ler(d, "assets/style.css"))

    def test_quadro_de_especies_so_com_o_que_os_servicos_com_fonte_dizem(self):
        idx = self.ler(self.premium, "index.html")
        rotulos = re.findall(r'<li class="especie[^"]*"><svg[^>]*><use href="#\w+"/></svg><strong>([^<]+)</strong><span>Serviço: ([^<]+)</span>', idx)
        self.assertEqual([r for r, _ in rotulos], ["Aves", "Répteis", "Pequenos mamíferos de companhia", "Ferrets", "Cães", "Gatos"])
        titulos = {s["title"] for s in self.b["content"]["services"]}
        for _, servico in rotulos:
            self.assertIn(servico.replace("&amp;", "&"), titulos)
        self.assertEqual(dict(rotulos)["Ferrets"], "Vacinas")
        self.assertEqual(idx.count("especie--destaque"), 3)  # só as do primeiro serviço (silvestres e exóticos)

    def test_especies_sem_fonte_ou_fora_do_texto_nao_aparecem(self):
        sub = bv.carregar_subtipo("exoticos")
        tema = bv.carregar_tema("terrario")
        b = json.loads(json.dumps(self.b))
        for s in b["content"]["services"]:
            if s["title"] == "Vacinas":
                s["source"] = ""  # sem fonte: não conta
            if s["title"] == "Animais silvestres e exóticos":
                s["text"] = "Atendimento para aves."  # só aves
        c = bv.vc.contexto(b, True, tema=tema, subtipo=sub)
        self.assertEqual([e["rotulo"] for e in bv.vc.especies_atendidas(c)], ["Aves", "Cães", "Gatos"])
        sem_receita = bv.vc.contexto(self.b, True, tema=tema, subtipo=bv.carregar_subtipo("geral"))
        self.assertEqual(bv.vc.especies_atendidas(sem_receita), [])
        self.assertEqual(bv.vc.quadro_especies(sem_receita), "")

    def test_nada_afirmado_sem_fonte_no_site_2(self):
        """Licença, autorização ambiental, '24 horas', 'desde ANO', CRMV e emergência só como está no JSON."""
        for pagina in ("index.html", "sobre.html", "contato.html"):
            html = self.ler(self.premium, pagina)
            texto = re.sub(r"<(script|style)\b.*?</\1>", " ", html, flags=re.S)
            texto = re.sub(r"<[^>]+>", " ", texto)
            self.assertNotRegex(texto, r"(?i)licen[cç]|ibama|autoriza[cç][aã]o|24 ?h(oras)?\b|desde 20|CRMV|legaliz|sisfauna|certific")
            self.assertNotIn("<img", sem_ilustrativas(html))
        servicos = self.ler(self.premium, "index.html")
        emerg = [s for s in self.b["content"]["services"] if "mergência" in s["title"]][0]
        self.assertIn(emerg["text"], servicos)  # a única menção a emergência é o texto do JSON, com a ressalva "ligue antes"
        self.assertIn("Ligue antes de sair", servicos)
        for pagina in ("index.html", "sobre.html", "contato.html"):  # v1.0: a seção #servicos (com o texto do JSON) está na inicial; fora dela, nada de emergência
            fora = re.sub(r'<section class="[^"]*" id="servicos">.*?</section>', "", self.ler(self.premium, pagina), flags=re.S)
            self.assertNotIn("mergência", fora.replace("Emergência veterinária", ""), pagina)

    PAGINAS_2 = ("index.html", "sobre.html", "contato.html")

    def test_horario_vem_so_do_json_e_sai_com_a_fonte(self):
        """v0.6: o horário de diretório do site 2 ("0h às 23h59") saía sem dizer de onde veio. Agora leva a fonte (regra `horario_com_fonte`, ligada em todos os subtipos)."""
        contato = visivel(self.ler(self.premium, "contato.html"))
        original = self.b["content"]["hours"]["text"]
        self.assertNotIn("segundo", original)  # o cadastro não foi alterado
        self.assertIn("Todos os dias, das 0h às 23h59, segundo o guia Mais Prático. Confirme pelo WhatsApp ou telefone antes de ir.", contato)
        for pagina in self.PAGINAS_2:
            v = visivel(self.ler(self.premium, pagina))
            self.assertEqual(v.count("23h59"), v.count("23h59, segundo o guia Mais Prático"), pagina)  # toda menção ao horário (ficha do início e do Sobre, Contato) leva a fonte
        self.assertIn("Horário a confirmar: o site mostra o horário com a fonte", self.ler(self.premium, "README.md"))

    def test_painel_exoticos_tem_especies_e_campos_clinicos(self):
        cfg = self.ler(self.premium, "assets/site-config.js")
        m = re.search(r"^  painel: (\{.*\})$", cfg, re.M)
        painel = json.loads(m.group(1))
        for esp in ("Ave", "Réptil", "Coelho", "Roedor", "Furão (ferret)", "Cão", "Gato"):
            self.assertIn(esp, painel["especies"])
        self.assertEqual([c["nome"] for c in painel["camposPet"]], ["ambiente", "dieta", "manejo"])
        self.assertEqual([c["nome"] for c in painel["camposProntuario"]], ["ambiente", "dieta", "manejo"])
        self.assertIn("Indeterminado", painel["sexos"])
        # o painel nasce vazio de dados: nenhum animal, tutor ou valor no código do template além do exemplo marcado
        self.assertIn("o.exemplo = true", self.ler(self.premium, "painel/js/seed.js"))

    def test_acessibilidade_do_tema_novo(self):
        css = self.ler(self.premium, "assets/style.css")
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn(":focus-visible", css)
        self.assertNotRegex(css, r"@import|url\(https?:")
        for pagina in ("index.html", "sobre.html", "contato.html"):
            html = self.ler(self.premium, pagina)
            self.assertIn('class="wa-flutuante"', html)
            self.assertRegex(html, r'class="wa-flutuante"[^>]*aria-label="Conversar no WhatsApp"')
            self.assertEqual(html.count("<h1"), 1, pagina)
        # o selo hexagonal da nota é link com rótulo e usa fundo por data URI, não clip-path (que cortaria o anel de foco)
        self.assertRegex(self.ler(self.premium, "index.html"), r'class="carimbo"[^>]*aria-label="Nota 4,6 com 339 avaliações no Google Maps"')
        self.assertNotRegex(css, r"\.carimbo[^{]*\{[^}]*clip-path")

    def test_sem_recurso_externo_em_nenhum_pacote(self):
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in pasta.rglob("*"):
                if arq.is_file() and arq.suffix in {".css", ".js", ".html"}:
                    t = arq.read_text(encoding="utf-8").replace("https://www.google.com/maps", "").replace("https://wa.me/", "").replace('href="https://andremachado.design"', "")  # crédito: link, não recurso
                    self.assertNotRegex(t, r"@import|url\(\s*[\"']?https?:|(?:src|href)=[\"']https?://", f"{pasta.name}/{arq.name}")
                    self.assertNotIn("fonts.googleapis", t)


ARQUIVOS_GERADOS_DA_VITRINE = ("index.html", "sobre.html", "contato.html", "assets/style.css", "assets/app.js", "assets/tema.css", "assets/favicon.svg")


class TestSitesEntreguesIguaisAoGerador(unittest.TestCase):
    """Regressão: gerar de novo cada site entregue não muda a vitrine dele (HTML, CSS, JS, tokens e favicon). Se mudar de propósito, regere o site em sites/."""

    def test_vitrine_entregue_igual_ao_que_o_gerador_produz(self):
        tmp = Path(tempfile.mkdtemp(prefix="vet-golden-"))
        try:
            for slug in (SLUG, SLUG2, "clinica-veterinaria-cedvet", "prime-centro-de-diagnostico-veterinario-tomografia", "clinica-veterinaria-nutrimed-ipanema", "clinica-veterinaria-doc-dog-24horas", "del-vet", "clinica-veterinaria-animal-inc", "clinica-veterinaria-ishizuka", "pilares-unidade-veterinaria-24h"):
                entregue = ROOT / "sites" / "pet-veterinaria" / slug
                if not (entregue / "assets" / "tema.css").is_file():
                    self.skipTest(f"{slug} ainda não foi gerado pela skill")
                novo = bv.gerar(slug, saida=str(tmp / slug))
                for rel in ARQUIVOS_GERADOS_DA_VITRINE:
                    self.assertEqual((novo / rel).read_text(encoding="utf-8"), (entregue / rel).read_text(encoding="utf-8"), f"{slug}/{rel} mudou: regere o site")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


class TestSitesEntreguesInteirosIguaisAoGerador(unittest.TestCase):
    """O golden da vitrine só olha 8 arquivos. Este compara a PASTA INTEIRA do site entregue (README, site-config.js, painel/ inteiro, CSS do painel) com o que o gerador produz hoje, menos o que é do
    cliente (`assets/material.js` e `assets/img/`): foi assim que a v0.6 achou os painéis dos sites 1 a 3 atrasados e a revisão da 0.8 achou o resto."""

    def test_site_entregue_inteiro_igual_ao_que_o_gerador_produz(self):
        tmp = Path(tempfile.mkdtemp(prefix="vet-golden-inteiro-"))
        try:
            for slug in (SLUG, SLUG2, "clinica-veterinaria-cedvet", "prime-centro-de-diagnostico-veterinario-tomografia", "clinica-veterinaria-nutrimed-ipanema", "clinica-veterinaria-doc-dog-24horas", "del-vet", "clinica-veterinaria-animal-inc", "clinica-veterinaria-ishizuka", "pilares-unidade-veterinaria-24h"):
                entregue = ROOT / "sites" / "pet-veterinaria" / slug
                if not (entregue / "assets" / "tema.css").is_file():
                    self.skipTest(f"{slug} ainda não foi gerado pela skill")
                novo = bv.gerar(slug, saida=str(tmp / slug))
                def arquivos(pasta):
                    return {str(a.relative_to(pasta)) for a in pasta.rglob("*") if a.is_file() and not str(a.relative_to(pasta)).startswith(("assets/img/", "assets/material.js"))}
                self.assertEqual(arquivos(novo), arquivos(entregue), f"{slug}: a lista de arquivos mudou: regere o site")
                for rel in sorted(arquivos(novo)):
                    self.assertEqual((novo / rel).read_bytes(), (entregue / rel).read_bytes(), f"{slug}/{rel} mudou: regere o site")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


SLUG3 = "clinica-veterinaria-cedvet"


def visivel(html: str) -> str:
    """Texto que o visitante lê: sem script, estilo nem marcação."""
    html = re.sub(r"<(script|style)\b.*?</\1>", " ", html, flags=re.S)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))


class TestSite3Hospital(unittest.TestCase):
    """Site 3 (CEDVET: hospital/plantão, tema sinalizacao, subtipo hospital24h) nos três pacotes. Número de WhatsApp só listado (não confirmado)."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="vet-build3-"))
        cls.premium = bv.gerar(SLUG3, saida=str(cls.tmp / "premium"))
        cls.basico = bv.gerar(SLUG3, gestao=False, saida=str(cls.tmp / "basico"))
        cls.essencial = bv.gerar(SLUG3, vitrine=False, saida=str(cls.tmp / "essencial"))
        cls.b = model.load_business(SLUG3)
        cls.c = cls.b["content"]

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def ler(self, pasta, rel):
        return (pasta / rel).read_text(encoding="utf-8")

    PAGINAS = ("index.html", "sobre.html", "contato.html")

    # ---- dados e honestidade ----
    def test_conteudo_e_vitrine_passam_nos_validadores_do_projeto(self):
        self.assertEqual(validate.check_content(self.b), [])
        for pasta in (self.premium, self.basico):
            self.assertEqual(validate.check_site(self.b, str(pasta)), [], pasta.name)

    def test_celular_listado_vira_o_botao_de_whatsapp(self):
        """v1.1 (PEDIDO_DESIGN_3, item F): o celular listado é o número do ÚNICO botão de WhatsApp (o flutuante); sem Ligar nem "Tentar pelo WhatsApp".
        A confirmação com o negócio fica como pendência no README."""
        self.assertEqual(self.b["whatsapp"]["status"], "mobile-listed")
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            um_whatsapp_so_icone(self, html, "5515997140688", pagina)
            self.assertNotRegex(html, r"ligar-flutuante|tel:|Tentar pelo WhatsApp|pode não ter WhatsApp", pagina)
        contato = self.ler(self.premium, "contato.html")
        self.assertIn("WhatsApp</dt>", contato)
        self.assertIn("WhatsApp não confirmado: (15) 99714-0688", self.ler(self.premium, "README.md"))

    def test_celular_listado_mantem_a_copy_e_so_sem_numero_o_canal_vira_telefone(self):
        """v1.0 (PEDIDO_DESIGN_3): o celular listado no Perfil do Google é o número de conversa (dois botões de WhatsApp), então a copy do cadastro sai como está.
        Só um negócio sem número de conversa (fixo ou nenhum) tem as frases "chame no WhatsApp" trocadas por telefone; o cadastro em data/content nunca muda."""
        self.assertIn("Chame no WhatsApp", self.c["lead"])  # data/content segue como está
        idx = visivel(self.ler(self.premium, "index.html"))
        self.assertIn(self.c["lead"], idx)
        self.assertNotIn("Ligue para falar sobre o seu animal.", idx)
        b = json.loads(json.dumps(self.b)); b["wa_contact"] = None  # sem número de conversa
        c = bv.vc.contexto(b, True, tema=bv.carregar_tema("sinalizacao"), subtipo=bv.carregar_subtipo("hospital24h"))
        self.assertFalse(c.tem_wa); self.assertIn("Ligue para falar sobre o seu animal.", c.lead)
        self.assertEqual(self.b["content"]["lead"], self.c["lead"])
        for wa_contact in (None, self.b["wa_contact"]):
            b["wa_contact"] = wa_contact
            self.assertFalse(bv.vc.contexto(b, True).nao_confirmado)  # v1.0: não existe mais "WhatsApp não confirmado" na vitrine

    def test_titulo_e_descricoes_nao_afirmam_24_horas_enquanto_o_horario_esta_a_confirmar(self):
        """Achado da revisão: h1, <title> e meta repetiam "24 horas" sem a fonte; o horário só entra com a atribuição ("segundo o diretório")."""
        self.assertTrue(bv.vc.horario_a_confirmar(self.b))
        self.assertIn("24 horas", self.c["tagline"])  # o JSON diz; o gerador é que não repete no título
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            self.assertNotRegex(re.search(r"<title>(.*?)</title>", html).group(1), r"\b24\b", pagina)
            self.assertNotRegex(re.search(r'<meta name="description" content="([^"]*)"', html).group(1), r"\b24\b|24 ?h", pagina)
            self.assertNotRegex(re.search(r'<meta name="description" content="([^"]*)"', html).group(1), r"(?:,|\bo|\bde|\bda|\bna|\bem)$", pagina)  # descrição não termina no meio da frase
        idx = self.ler(self.premium, "index.html")
        self.assertNotRegex(re.search(r"<h1>(.*?)</h1>", idx).group(1), r"24")
        self.assertIn("<h1>Clínica veterinária na Wanel Ville, em Sorocaba</h1>", idx)
        for texto in ("Atendimento 24 horas, todos os dias, segundo o diretório Cylex. Confirme pelo WhatsApp.", "O diretório Cylex informa atendimento aberto 24 horas, todos os dias."):
            self.assertTrue(any(texto in self.ler(self.premium, p) for p in self.PAGINAS), texto)  # com a fonte, o "24 horas" continua nos textos
        self.assertIn("Segundo o diretório Cylex, o atendimento é 24 horas.", self.ler(self.premium, "sobre.html"))
        # sem a pendência (horário confirmado) o título original volta
        b = json.loads(json.dumps(self.b)); b["research"]["pending"] = [p for p in b["research"]["pending"] if "24 horas" not in p]
        self.assertFalse(bv.vc.horario_a_confirmar(b))
        self.assertEqual(bv.vc.contexto(b, True).tagline, self.c["tagline"])
        self.assertEqual(self.c["tagline"], self.b["content"]["tagline"])  # o dado de origem não foi alterado

    def test_mapa_em_satelite_com_o_pino_no_endereco(self):
        """v1.0 (PEDIDO_DESIGN_3, item C): o perfil do CEDVET pede satélite; o mapa busca o endereço (pino centralizado) com t=k e zoom de rua. Os outros sites não mudam."""
        self.assertEqual(bv.carregar_perfil(SLUG3)["mapa"], "satelite")
        for pagina in ("index.html", "contato.html"):
            src = re.search(r'<iframe title="Mapa em satélite com o endereço de CEDVET" src="([^"]+)"', self.ler(self.premium, pagina)).group(1)
            self.assertTrue(src.startswith("https://www.google.com/maps?q=Av.%20Elias%20Maluf%2C%202199"), src)
            self.assertTrue(src.endswith("&amp;t=k&amp;z=18&amp;output=embed"), src)
        self.assertNotIn("t=k", bv.vc.mapa(bv.vc.contexto(model.load_business(SLUG), True)))
        self.assertIsNone(bv.carregar_perfil(SLUG)["mapa"])

    def test_descricao_do_contato_cita_o_whatsapp_do_celular_listado(self):
        contato = self.ler(self.premium, "contato.html")
        self.assertIn('content="Contato de CEDVET em Sorocaba/SP: endereço, telefone e WhatsApp."', contato)

    def test_readme_e_tokens_nao_citam_ferramentas_nem_o_painel_onde_nao_cabe(self):
        for pasta in (self.premium, self.basico, self.essencial):
            self.assertNotRegex(self.ler(pasta, "README.md"), r"(?i)skill|\.claude")
        self.assertNotRegex(self.ler(self.basico, "assets/tema.css"), r"(?i)painel")

    def test_site_config_chama_de_whatsapp_o_numero_de_conversa(self):
        """v1.0: o WhatsApp das Configurações do painel é o mesmo número dos dois botões da vitrine (aqui, o celular listado)."""
        neg = json.loads(re.search(r"^  negocio: (\{.*\})", self.ler(self.premium, "assets/site-config.js"), re.M).group(1))
        self.assertEqual(neg["whatsapp"], "(15) 99714-0688")
        self.assertEqual(neg["telefone"], "(15) 99714-0688")
        confirmado = json.loads(re.search(r"^  negocio: (\{.*?\})", self.ler(bv.gerar(SLUG, saida=str(self.tmp / "conf1")), "assets/site-config.js"), re.M).group(1))
        self.assertEqual(confirmado["whatsapp"], "(15) 99106-1211")  # site 1 tem WhatsApp confirmado em fonte: nada mudou

    def test_sem_whatsapp_so_troca_as_instrucoes_de_canal(self):
        f = bv.vc.sem_whatsapp
        self.assertEqual(f("Chame no WhatsApp para falar sobre o seu animal."), "Ligue para falar sobre o seu animal.")
        self.assertEqual(f("Fale pelo WhatsApp."), "Fale pelo telefone.")
        self.assertEqual(f("Sem canal citado."), "Sem canal citado.")
        self.assertEqual(f(f("Chame no WhatsApp")), f("Chame no WhatsApp"))
        self.assertIsNone(f(None))

    def test_nada_afirmado_alem_do_json_no_site_3(self):
        """24 horas, emergência, horário, ano e registro só como o JSON diz. Remove da página todo texto que vem do JSON e confere o que sobra."""
        trechos = bv.vc.contexto(self.b, True)  # copy com o canal trocado, como entra no HTML
        textos = [trechos.tagline, trechos.lead, trechos.meta, *trechos.about, trechos.hours["text"], self.b["address"], NOTA_URGENCIA]
        for chave in ("services", "highlights", "how_to"):
            for item in getattr(trechos, chave):
                textos += [item["title"], item["text"]]
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            resto = visivel(html)
            for t in sorted(textos, key=len, reverse=True):
                resto = resto.replace(t, " ")
            self.assertNotRegex(resto, r"(?i)\b24\s?h\b|24 horas|emerg[eê]ncia|urg[eê]ncia|plant[aã]o|aberto|funcionamento|desde \d{4}|CRMV|\b20(1\d|2[0-3])\b", f"{pagina}: texto sem fonte: {resto[:300]}")
            self.assertNotRegex(resto, r"(?i)UTI|cirurgi|exame|interna[cç][aã]o|especialista|tomografia|raio.?x|ultrassom|laborat[oó]rio|melhor|refer[eê]ncia|premiad|certific")
            self.assertNotIn("<img", sem_ilustrativas(html))
        # os 3 fatos que citam 24 horas existem no JSON com fonte (a pendência de confirmar continua na pesquisa)
        self.assertTrue(self.c["hours"]["source"].startswith("http"))
        self.assertTrue(any("24 horas" in p for p in self.b["research"]["pending"]))

    def test_primeiro_toque_servicos_e_onde_fica_antes_de_qualquer_secao(self):
        """v1.2 (PEDIDO_DESIGN_3, item I): hero refeito ("cruz de plantão"). Os dois CTAs levam aos serviços (#servicos) e ao endereço no fim da página (#localizacao);
        nenhum liga, abre o WhatsApp ou o Google Maps. O trilho do pé traz serviços, endereço e o horário com as palavras do JSON (inclusive a fonte)."""
        idx = self.ler(self.premium, "index.html")
        hero = idx[idx.index('<section class="hero hero--cruz">'):idx.index("</section>", idx.index('<section class="hero hero--cruz">'))]
        self.assertNotIn("placa", hero)  # o poste de placas saiu inteiro
        ctas = re.findall(r'<a class="btn cz-cta" data-toque="(\w+)" href="([^"]+)">(.*?)</a>', hero)
        self.assertEqual([(t, h) for t, h, _ in ctas], [("servicos", "#servicos"), ("onde", "#localizacao")])
        self.assertEqual([re.sub(r"<svg.*?</svg>", "", x).strip() for _, _, x in ctas], ["Ver serviços", "Onde fica"])
        self.assertTrue(all("<svg" in x for _, _, x in ctas))  # ícone nos dois
        trilho = re.findall(r'<li class="cz-dado cz-dado--(\w+)"><b><svg.*?</svg>([^<]*)</b><span>(.*?)</span></li>', hero)
        self.assertEqual([(k, r) for k, r, _ in trilho], [("servicos", "Serviços"), ("onde", "Endereço"), ("horario", "Horário")])
        self.assertEqual(trilho[0][2], "Atendimento veterinário, Emergência veterinária")
        self.assertIn("Av. Elias Maluf, 2199", trilho[1][2])
        self.assertEqual(trilho[2][2], "Atendimento 24 horas, todos os dias, segundo o diretório Cylex. Confirme pelo WhatsApp.")
        fig = re.search(r'<figure class="ilustra cz-foto" data-ilustrativa><img src="assets/ilustrativas/vet-emergencia.webp" alt="[^"]+"[^>]*loading="eager"[^>]*><figcaption>Imagem ilustrativa</figcaption></figure>', hero)
        self.assertIsNotNone(fig, "a janela em cruz mostra a imagem ilustrativa, com legenda visível")
        self.assertIn('<span class="cz-sinal" aria-hidden="true"></span>', hero)
        self.assertIn('class="carimbo"', hero)  # a nota do Google fica no canto da janela
        self.assertNotRegex(hero, r"tel:|wa\.me|Tentar pelo WhatsApp|Como chegar|Ligar")
        self.assertEqual(hero.count("<h1>"), 1)
        self.assertIn('id="localizacao"', idx); self.assertIn('id="servicos"', idx)

    def test_sem_horario_no_json_a_placa_de_horario_nao_existe(self):
        b = json.loads(json.dumps(self.b)); b["content"]["hours"] = None
        c = bv.vc.contexto(b, True, tema=bv.carregar_tema("sinalizacao"), subtipo=bv.carregar_subtipo("hospital24h"))
        self.assertNotIn("cz-dado--horario", bv.vc.hero_cruz(c))
        b["whatsapp"] = {"digits": None, "display": None, "status": "none"}; b["wa_contact"] = None; b["phones"] = []; b["google"] = None
        c = bv.vc.contexto(b, True, tema=bv.carregar_tema("sinalizacao"), subtipo=bv.carregar_subtipo("hospital24h"))
        hero = bv.vc.hero_cruz(c)
        self.assertNotIn("carimbo", hero); self.assertNotIn("wa.me", hero); self.assertNotIn("tel:", hero)
        self.assertIn('data-toque="onde"', hero)  # sem telefone, ainda há "Onde fica"

    def test_faixa_de_contato_so_leva_aos_contatos_e_o_hero_aos_servicos(self):
        """v1.0 (PEDIDO_DESIGN_2/3): a faixa de contato e os botões do hero não ligam nem abrem o WhatsApp; a ordem da receita (Ligar, Como chegar, WhatsApp) saiu."""
        sobre = self.ler(self.premium, "sobre.html")  # v1.0: na inicial a faixa deu lugar a "Onde estamos" (#localizacao); continua em Sobre
        faixa = sobre[sobre.index('id="contato-rapido"'):]; faixa = faixa[:faixa.index("</section>")]
        self.assertNotIn('id="contato-rapido"', self.ler(self.premium, "index.html"))
        self.assertIn('<a class="btn" href="contato.html">Ver contatos</a>', faixa)
        self.assertNotRegex(faixa, r"tel:|wa\.me|Ligar|Como chegar|Tentar pelo WhatsApp")
        geral = bv.vc.botoes_cta(bv.vc.contexto(self.b, True))
        self.assertIn('<a class="btn" href="#servicos">Ver serviços</a>', geral); self.assertNotRegex(geral, r"tel:|wa\.me|Como chegar")

    # ---- README ----
    def test_readme_lista_as_pendencias_a_confirmar_em_todos_os_pacotes(self):
        pendencias = [*self.b["research"]["pending"], "WhatsApp não confirmado", "registro profissional do responsável (CRMV) não encontrado em fonte", "fotos reais do negócio"]
        for pasta in (self.premium, self.basico, self.essencial):
            r = self.ler(pasta, "README.md")
            self.assertIn("## Pendências a confirmar com o negócio antes de publicar", r, pasta.name)
            for p in pendencias:
                confere_pendencia(self, pasta is self.essencial, p, r, pasta.name)
        r = self.ler(self.premium, "README.md")
        self.assertIn("Confirmar o horário 24 horas", r)
        self.assertIn("Horário a confirmar: o título e a descrição do site NÃO citam", r)  # diz por que o título não leva o "24 horas"
        self.assertNotIn("Horário a confirmar: o título e a descrição", self.ler(bv.gerar(SLUG2, saida=str(self.tmp / "readme-s2")), "README.md"))  # só quando o gerador de fato tirou o prazo do título (o site 2 só acrescenta a fonte ao horário)
        self.assertIn("build_vet_site.py clinica-veterinaria-cedvet --sem-gestao", r)
        self.assertIn("build_vet_site.py clinica-veterinaria-cedvet --sem-vitrine", r)
        self.assertIn("gestao: true", r)
        self.assertIn("Internação e plantão", r)
        self.assertNotIn("painel", self.ler(self.basico, "README.md").lower())
        self.assertNotIn("painel", self.ler(self.basico, "assets/site-config.js").lower())

    # ---- painel do hospital ----
    def test_painel_do_hospital_tem_internacao_so_no_premium_e_no_essencial(self):
        for pasta in (self.premium, self.essencial):
            self.assertTrue((pasta / "painel/js/modulos/internacao.js").is_file(), pasta.name)
            app = self.ler(pasta, "painel/app.html")
            scripts = re.search(r'data-scripts="([^"]*)"', app).group(1).split(",")
            self.assertEqual(scripts[:6], ["regras", "store", "auth", "seed", "ui", "app"])
            self.assertIn("modulos/internacao", scripts)
            self.assertEqual(scripts[-1], "iniciar")
            for nome in scripts:
                self.assertTrue((pasta / "painel/js" / f"{nome}.js").is_file(), f"{pasta.name}: {nome}")
            arquivos = {f"modulos/{p.stem}" for p in (pasta / "painel/js/modulos").glob("*.js")}
            self.assertEqual(arquivos, {n for n in scripts if n.startswith("modulos/")})  # nenhum módulo sobrando nem faltando
            cfg = self.ler(pasta, "assets/site-config.js")
            painel = json.loads(re.search(r"^  painel: (\{.*\})$", cfg, re.M).group(1))
            self.assertEqual(painel["subtipo"], "hospital24h")
            self.assertEqual(painel["modulos"][4], "internacao")
            self.assertEqual(painel["colecoesExtras"], ["leitos", "internacoes", "evolucoes", "plantoes"])
            self.assertEqual(painel["marca"], "cruz")
        self.assertFalse((self.basico / "painel").exists())

    def test_sites_1_e_2_nao_ganham_internacao(self):
        for slug in (SLUG, SLUG2):
            d = bv.gerar(slug, saida=str(self.tmp / f"ref-{slug}"))
            self.assertFalse((d / "painel/js/modulos/internacao.js").exists(), slug)
            self.assertNotIn("internacao", self.ler(d, "painel/app.html"), slug)
            self.assertNotIn("internacao", self.ler(d, "assets/site-config.js"), slug)
            scripts = re.search(r'data-scripts="([^"]*)"', self.ler(d, "painel/app.html")).group(1).split(",")
            self.assertEqual([n for n in scripts if n.startswith("modulos/")], [f"modulos/{m}" for m in bv.MODULOS_BASE])

    def test_gerador_para_se_o_subtipo_pede_tela_sem_arquivo(self):
        sub = {"nome": "teste", "painel": {"modulos": ["inicio", "tela_que_nao_existe"]}}
        d = self.tmp / "sem-arquivo"; shutil.copytree(SKILL / "painel", d)
        with self.assertRaises(SystemExit) as r:
            bv.ajustar_modulos(d, sub)
        self.assertIn("tela_que_nao_existe", str(r.exception))

    def test_painel_sem_innerhtml_nem_eval(self):
        for arq in (SKILL / "painel").rglob("*.js"):
            t = arq.read_text(encoding="utf-8")
            self.assertNotRegex(t, r"\.innerHTML\s*=|insertAdjacentHTML\(|\.outerHTML\s*=|document\.write\(|\beval\(|new Function\(", str(arq.relative_to(SKILL)))
        for arq in (self.premium / "painel/js").rglob("*.js"):
            self.assertNotRegex(arq.read_text(encoding="utf-8"), r"\.innerHTML\s*=|insertAdjacentHTML\(|\beval\(")

    def test_links_do_painel_so_com_digitos_ou_codificados(self):
        t = (SKILL / "painel/js/regras.js").read_text(encoding="utf-8")
        self.assertIn("encodeURIComponent(texto", t)  # wa.me do lembrete: telefone vira só dígitos e o texto é codificado
        self.assertEqual(bv.vc.wa_link("5515997140688", 'a "b" <c> & d'), "https://wa.me/5515997140688?text=a%20%22b%22%20%3Cc%3E%20%26%20d")

    # ---- identidade ----
    def test_perfil_aplica_tema_sinalizacao_e_subtipo_hospital24h(self):
        self.assertEqual(bv.carregar_perfil(SLUG3), {"subtipo": "hospital24h", "tema": "sinalizacao", "pendencias": [], **PERFIL_SEM_EXTRAS, "mapa": "satelite"})
        idx = self.ler(self.premium, "index.html")
        self.assertIn("hero--cruz", idx)
        for simbolo in ("cruz", "pata", "seta", "fone", "pino", "relogio"):
            self.assertIn(f"<symbol id='{simbolo}'", idx)
        css = self.ler(self.premium, "assets/style.css")
        self.assertIn("tema sinalizacao", css)
        self.assertIn("sinalizacao", self.ler(self.premium, "painel/painel.css"))
        self.assertIn("#2142c7", self.ler(self.premium, "assets/favicon.svg"))
        self.assertNotRegex(css, r"\.carimbo[^{]*\{[^}]*clip-path")  # clip-path corta o anel de foco do link da nota
        self.assertNotRegex(css, r"@import|url\(\s*[\"']?https?:")
        self.assertIn("prefers-reduced-motion", css)
        # uma única animação própria do tema
        self.assertEqual(re.findall(r"animation: ([a-z-]+) ", css.split("tema sinalizacao")[1]), ["cruz-entra"])

    def test_ctas_amarelos_com_texto_e_icone_brancos_legiveis(self):
        """v1.2 (PEDIDO_DESIGN_3, item I.1): os botões principais da CEDVET têm fundo amarelo e texto e ícone brancos. O branco sobre o amarelo da marca (#ffc21a) dá 1,6:1;
        o fundo é o amarelo escurecido #8f6200 (5,4:1 com o branco), com a borda de baixo no amarelo da marca. Vale para o hero, o Como chegar, o Ver contatos e a faixa."""
        css = (SKILL / "temas" / "sinalizacao.vitrine.css").read_text(encoding="utf-8")
        for seletor in (".btn", ".faixa .btn"):
            regra = re.search(r"(?m)^" + re.escape(seletor) + r" \{([^}]*)\}", css).group(1)
            self.assertIn("background: #8f6200", regra, seletor); self.assertIn("color: #fff", regra, seletor)
        self.assertGreaterEqual(themes.contrast("#ffffff", "#8f6200"), 4.5)
        hover = re.search(r"(?m)^\.btn:hover \{([^}]*)\}", css).group(1)
        fundo = re.search(r"background: (#[0-9a-f]{6})", hover).group(1)
        self.assertIn("color: #fff", hover); self.assertGreaterEqual(themes.contrast("#ffffff", fundo), 4.5)
        self.assertIn("box-shadow: inset 0 -4px 0 var(--carimbo)", css)  # a borda de baixo no amarelo da marca

    def test_tema_sinalizacao_nao_repete_as_paletas_dos_sites_1_e_2(self):
        t = bv.carregar_tema("sinalizacao")["tokens"]
        for outro in ("caderneta", "terrario"):
            o = bv.carregar_tema(outro)["tokens"]
            for papel in ("folha", "musgo", "carimbo", "papel"):
                self.assertNotEqual(t[papel].lower(), o[papel].lower(), f"{outro}/{papel}")
        self.assertNotRegex(json.dumps(t), r"(?i)terracota|#c1440e")  # sem a fórmula creme + terracota

    def test_pacote_essencial_do_hospital(self):
        self.assertEqual(sorted(p.name for p in self.essencial.iterdir()), ["README.md", "assets", "index.html", "painel"])
        self.assertIn("modules: { vitrine: false, gestao: true }", self.ler(self.essencial, "assets/site-config.js"))
        self.assertNotRegex(self.ler(self.essencial, "index.html"), r"wa\.me|servicos\.html")

    def test_regerar_por_cima_nao_perde_o_material_do_cliente(self):
        d = self.tmp / "material3"
        bv.gerar(SLUG3, saida=str(d))
        mat = d / "assets" / "material.js"
        mat.write_text(mat.read_text(encoding="utf-8").replace("galeria = [];", 'galeria = [{src: "assets/img/fachada.jpg", alt: "Fachada"}];'), encoding="utf-8")
        for kwargs in ({"vitrine": False}, {"gestao": False}, {}):
            bv.gerar(SLUG3, saida=str(d), **kwargs)
        self.assertIn("Fachada", mat.read_text(encoding="utf-8"))


SLUG4 = "prime-centro-de-diagnostico-veterinario-tomografia"


class TestSite4Diagnostico(unittest.TestCase):
    """Site 4 (Prime, centro de diagnóstico por imagem; tema chapa, subtipo diagnostico) nos três pacotes. Número só listado (não confirmado) e horário de guia a confirmar."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="vet-build4-"))
        cls.premium = bv.gerar(SLUG4, saida=str(cls.tmp / "premium"))
        cls.basico = bv.gerar(SLUG4, gestao=False, saida=str(cls.tmp / "basico"))
        cls.essencial = bv.gerar(SLUG4, vitrine=False, saida=str(cls.tmp / "essencial"))
        cls.b = model.load_business(SLUG4)
        cls.c = cls.b["content"]

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    PAGINAS = ("index.html", "sobre.html", "contato.html")

    def ler(self, pasta, rel):
        return (pasta / rel).read_text(encoding="utf-8")

    # ---- dados e honestidade ----
    def test_conteudo_e_vitrine_passam_nos_validadores_do_projeto(self):
        self.assertEqual(validate.check_content(self.b), [])
        for pasta in (self.premium, self.basico):
            self.assertEqual(validate.check_site(self.b, str(pasta)), [], pasta.name)

    def test_celular_listado_vira_o_botao_e_sem_numero_a_copy_fala_em_centro(self):
        """v1.1: o celular listado é o número do botão de WhatsApp (o flutuante, o único) e a copy do cadastro sai como está. A troca de canal (receita quem_atende = "o centro")
        continua valendo para quando não há número de conversa."""
        self.assertEqual(self.b["whatsapp"]["status"], "mobile-listed")
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            um_whatsapp_so_icone(self, html, "5515996601313", pagina)
            self.assertRegex(html, r'class="wa-flutuante"[^>]*aria-label="Conversar no WhatsApp"')
            self.assertNotRegex(html, r"ligar-flutuante|tel:|Tentar pelo WhatsApp", pagina)
        idx = visivel(self.ler(self.premium, "index.html"))
        self.assertIn("Chame no WhatsApp para falar com a equipe.", idx); self.assertNotIn("Ligue para o centro", idx)
        b = json.loads(json.dumps(self.b)); b["wa_contact"] = None
        c = bv.vc.contexto(b, True, subtipo=bv.carregar_subtipo("diagnostico"))
        self.assertIn("Ligue para falar com a equipe.", c.lead)
        self.assertEqual(bv.vc.sem_whatsapp("pelo WhatsApp ou pelo telefone"), "pelo telefone"); self.assertEqual(bv.vc.sem_whatsapp("no WhatsApp ou telefone"), "pelo telefone")
        self.assertIn("Chame no WhatsApp", self.c["lead"])  # data/content segue como está
        neg = json.loads(re.search(r"^  negocio: (\{.*\})", self.ler(self.premium, "assets/site-config.js"), re.M).group(1))
        self.assertEqual(neg["whatsapp"], "(15) 99660-1313"); self.assertEqual(neg["telefone"], "(15) 99660-1313")
        self.assertEqual(bv.vc.sem_whatsapp("Chame no WhatsApp"), "Ligue para a clínica")
        self.assertEqual(bv.vc.sem_whatsapp("Chame no WhatsApp", "o centro"), "Ligue para o centro")

    def test_horario_de_guia_aparece_com_a_fonte_e_so_enquanto_esta_a_confirmar(self):
        self.assertTrue(bv.vc.horario_a_confirmar(self.b))
        texto = "Das 9h às 17h, segundo o guia Sorocaba Fácil. Confirme os dias de atendimento pelo WhatsApp."
        for pagina in ("index.html", "contato.html"):
            self.assertIn(texto, visivel(self.ler(self.premium, pagina)), pagina)
        self.assertNotIn("segundo", self.c["hours"]["text"])  # o cadastro não foi alterado
        # confirmado (sem a pendência): o texto do cadastro volta como está
        b = json.loads(json.dumps(self.b)); b["research"]["pending"] = [p for p in b["research"]["pending"] if "hor" not in p.lower()]
        c = bv.vc.contexto(b, True, subtipo=bv.carregar_subtipo("diagnostico"))
        self.assertEqual(c.hours["text"], "Das 9h às 17h. Confirme os dias de atendimento pelo WhatsApp.")
        # v0.6: a regra vale para todos os subtipos; o site 3 já trazia a fonte no JSON (não duplica) e o site 2 passa a mostrá-la
        for slug in (SLUG2, SLUG3):
            b2 = model.load_business(slug)
            c2 = bv.vc.contexto(b2, True, subtipo=bv.carregar_subtipo(bv.carregar_perfil(slug)["subtipo"]))
            self.assertEqual(c2.hours["text"].count("segundo"), 1, slug)
            self.assertEqual(c2.hours["text"].count("segundo"), 1 if slug == SLUG2 else b2["content"]["hours"]["text"].count("segundo"), slug)
        # casos de borda da função
        f = bv.vc._horario_com_fonte
        base = {"hours": {"text": "Das 9h às 17h", "source": "https://www.exemplo.com.br/x"}}
        self.assertEqual(f(base)["hours"]["text"], "Das 9h às 17h, segundo exemplo.com.br")  # sem ponto: acrescenta no fim; fonte desconhecida: o endereço
        self.assertEqual(f({"hours": {"text": "Seg. a sex., 9h. Ligue.", "source": "https://sorocabafacil.com.br/x"}})["hours"]["text"], "Seg. a sex., 9h, segundo o guia Sorocaba Fácil. Ligue.")
        self.assertEqual(f({"hours": {"text": "Segundo o diretório X, 9h.", "source": "https://a.com"}})["hours"]["text"], "Segundo o diretório X, 9h.")
        for sem in ({"hours": None}, {"hours": {"text": "9h"}}, {"hours": {"text": "9h", "source": ""}}, {}):
            self.assertEqual(f(sem), sem)
        self.assertEqual(base["hours"]["text"], "Das 9h às 17h")  # a entrada não é alterada

    def test_nada_afirmado_alem_do_json_no_site_4(self):
        """Exame, equipamento, prazo de laudo, convênio, equipe e ano só como o JSON diz. Remove da página todo texto que vem do JSON e confere o que sobra."""
        trechos = bv.vc.contexto(self.b, True, subtipo=bv.carregar_subtipo("diagnostico"))
        textos = [trechos.tagline, trechos.lead, trechos.meta, *trechos.about, trechos.hours["text"], self.b["address"], *self.c["form"]["topic_options"]]
        for chave in ("services", "highlights", "how_to"):
            for item in getattr(trechos, chave):
                textos += [item["title"], item["text"]]
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            resto = visivel(html)
            for t in sorted(textos, key=len, reverse=True):
                resto = resto.replace(t, " ")
            self.assertNotRegex(resto, r"(?i)tomograf|exame|laudo|radiolog|fistul|linfang|raio.?x|ultrassom|resson[âa]ncia|equipamento|[úu]ltima gera|convênio|conv[eê]nio|parceri|especialist|\bhoras?\b|resultado em|em at[ée]|desde \d{4}|CRMV|\b20(1\d|2[0-3])\b|aberto|plant[aã]o|emerg[eê]ncia|urg[eê]ncia|melhor|refer[eê]ncia|premiad|certific|ISO|acredit", f"{pagina}: texto sem fonte: {resto[:300]}")
            self.assertNotIn("<img", sem_ilustrativas(html))
        self.assertTrue(all(s.get("source", "").startswith("http") for s in self.c["services"]))  # todo exame listado tem fonte no JSON

    def test_primeiro_toque_servicos_e_onde_fica_dentro_da_chapa_antes_de_qualquer_secao(self):
        """v1.0: as anotações da chapa levam aos exames (#servicos) e ao endereço no fim da página (#localizacao); nenhuma liga nem abre o WhatsApp."""
        idx = self.ler(self.premium, "index.html")
        ini = idx.index('<section class="hero hero--chapa">'); hero = idx[ini:idx.index("</section>", ini)]
        self.assertIn('class="anotacao anotacao--servicos" data-toque="servicos" href="#servicos"', hero)
        self.assertIn("Tomografia computadorizada, Fistulografia, Linfangiografia", hero)
        self.assertIn('class="anotacao anotacao--onde" data-toque="onde" href="#localizacao"', hero)
        self.assertLess(hero.index('data-toque="servicos"'), hero.index('data-toque="onde"'))
        self.assertIn("Das 9h às 17h, segundo o guia Sorocaba Fácil.", hero)
        self.assertNotRegex(hero, r"tel:|wa\.me|Tentar pelo WhatsApp|Ligar"); self.assertEqual(hero.count("<h1>"), 1)
        self.assertLess(idx.index("hero--chapa"), idx.index('id="servicos"'))
        self.assertNotIn("btn", hero)  # as anotações da chapa são os botões; nada de botões soltos
        sem_horario = json.loads(json.dumps(self.b)); sem_horario["content"]["hours"] = None
        c = bv.vc.contexto(sem_horario, True, tema=bv.carregar_tema("chapa"), subtipo=bv.carregar_subtipo("diagnostico"))
        self.assertNotIn("anotacao--horario", bv.vc.hero_chapa(c))
        sem_tudo = json.loads(json.dumps(sem_horario)); sem_tudo["whatsapp"] = {"digits": None, "display": None, "status": "none"}; sem_tudo["wa_contact"] = None; sem_tudo["phones"] = []; sem_tudo["google"] = None
        h = bv.vc.hero_chapa(bv.vc.contexto(sem_tudo, True, tema=bv.carregar_tema("chapa"), subtipo=bv.carregar_subtipo("diagnostico")))
        self.assertNotIn("carimbo", h); self.assertNotIn("wa.me", h); self.assertIn("anotacao--onde", h)

    def test_faixa_de_contato_so_leva_aos_contatos(self):
        """v1.0: fora do hero não há Ligar, Como chegar nem "Tentar pelo WhatsApp" em sequência; a faixa (em Sobre) leva à página de contato."""
        sobre = self.ler(self.premium, "sobre.html"); faixa = sobre[sobre.index('id="contato-rapido"'):]; faixa = faixa[:faixa.index("</section>")]
        self.assertIn('<a class="btn" href="contato.html">Ver contatos</a>', faixa)
        self.assertNotRegex(faixa, r"tel:|wa\.me|Ligar|Tentar pelo WhatsApp")

    # ---- README ----
    def test_readme_lista_pendencias_e_nao_promete_o_que_o_painel_nao_tem(self):
        pendencias = [*self.b["research"]["pending"], "WhatsApp não confirmado", "registro profissional do responsável (CRMV) não encontrado em fonte", "fotos reais do negócio", "Horário a confirmar: o site mostra o horário com a fonte"]
        for pasta in (self.premium, self.basico, self.essencial):
            r = self.ler(pasta, "README.md")
            self.assertIn("## Pendências a confirmar com o negócio antes de publicar", r, pasta.name)
            for p in pendencias:
                confere_pendencia(self, pasta is self.essencial, p, r, pasta.name)
            self.assertNotRegex(r, r"(?i)skill|\.claude|claude")
        r = self.ler(self.premium, "README.md")
        self.assertIn("Exames e laudos", r); self.assertIn("só texto", r); self.assertIn("integração com equipamentos", r)
        self.assertNotRegex(r, r"(?i)prontu[aá]rios, vacinas e lembretes")  # a gestão deste centro não tem prontuário nem vacinas
        self.assertIn("computadores do centro", r); self.assertNotIn("computadores da clínica", r)
        self.assertIn("build_vet_site.py prime-centro-de-diagnostico-veterinario-tomografia --sem-gestao", r)
        self.assertIn("build_vet_site.py prime-centro-de-diagnostico-veterinario-tomografia --sem-vitrine", r)
        self.assertNotIn("painel", self.ler(self.basico, "README.md").lower())
        self.assertNotIn("painel", self.ler(self.basico, "assets/site-config.js").lower())
        self.assertNotRegex(self.ler(self.basico, "assets/tema.css"), r"(?i)painel")
        self.assertIn("site do centro", self.ler(self.premium, "README.md")); self.assertIn("gestão do centro", self.ler(self.essencial, "README.md"))
        # os sites 1 a 3 continuam dizendo "clínica"
        self.assertIn("site da clínica", self.ler(bv.gerar(SLUG3, saida=str(self.tmp / "r3")), "README.md"))

    # ---- painel do centro ----
    def test_painel_tem_exames_e_encaminhadores_so_no_premium_e_no_essencial(self):
        for pasta in (self.premium, self.essencial):
            for modulo in ("exames", "encaminhadores"):
                self.assertTrue((pasta / "painel/js/modulos" / f"{modulo}.js").is_file(), f"{pasta.name}/{modulo}")
            for ausente in ("prontuarios", "vacinas", "internacao"):
                self.assertFalse((pasta / "painel/js/modulos" / f"{ausente}.js").exists(), f"{pasta.name}/{ausente}")
            scripts = re.search(r'data-scripts="([^"]*)"', self.ler(pasta, "painel/app.html")).group(1).split(",")
            self.assertEqual(scripts[:6], ["regras", "store", "auth", "seed", "ui", "app"]); self.assertEqual(scripts[-1], "iniciar")
            for nome in scripts:
                self.assertTrue((pasta / "painel/js" / f"{nome}.js").is_file(), f"{pasta.name}: {nome}")
            self.assertEqual({f"modulos/{p.stem}" for p in (pasta / "painel/js/modulos").glob("*.js")}, {n for n in scripts if n.startswith("modulos/")})
            painel = json.loads(re.search(r"^  painel: (\{.*\})$", self.ler(pasta, "assets/site-config.js"), re.M).group(1))
            self.assertEqual(painel["subtipo"], "diagnostico"); self.assertEqual(painel["marca"], "mira")
            self.assertEqual(painel["modulos"], ["inicio", "agenda", "tutores", "exames", "encaminhadores", "caixa", "estoque", "equipe", "config"])
            self.assertEqual(painel["colecoesExtras"], ["exames", "encaminhadores"])
            self.assertEqual(painel["titulos"]["agenda"], "Agenda de exames")
            self.assertEqual(painel["matriz"]["recepcao"].get("laudos"), None); self.assertEqual(painel["matriz"]["veterinario"]["laudos"], "rw")
            self.assertEqual(painel["exames"], ["Tomografia computadorizada", "Fistulografia", "Linfangiografia"])  # só serviços com fonte
            self.assertNotIn("exameDosServicos", painel)
        self.assertFalse((self.basico / "painel").exists())

    def test_exames_do_site_so_vem_de_servico_com_fonte(self):
        c = bv.vc.contexto(self.b, True)
        c2 = bv.vc.Contexto(dict(c, services=[{"title": "Com fonte", "text": "x", "source": "https://a.com"}, {"title": "Sem fonte", "text": "x"}, {"title": "", "text": "x", "source": "https://b.com"}]))
        self.assertEqual(bv.exames_do_site(c2), ["Com fonte"])
        self.assertNotIn("exames", bv.config_painel(bv.carregar_tema("caderneta"), bv.carregar_subtipo("hospital24h"), c))  # outros subtipos não ganham a lista

    def test_sites_1_a_3_nao_ganham_exames_nem_titulos(self):
        for slug in (SLUG, SLUG2, SLUG3):
            d = bv.gerar(slug, saida=str(self.tmp / f"ref4-{slug}"))
            for rel in ("painel/js/modulos/exames.js", "painel/js/modulos/encaminhadores.js"):
                self.assertFalse((d / rel).exists(), f"{slug}/{rel}")
            cfg = self.ler(d, "assets/site-config.js")
            for palavra in ("exames", "encaminhadores", "titulos", "textos", "laudos"):
                self.assertNotIn(palavra, cfg, f"{slug}: {palavra}")
            self.assertNotIn("exames", self.ler(d, "painel/app.html"))

    def test_gerador_confere_que_as_telas_do_subtipo_tem_arquivo(self):
        sub = bv.carregar_subtipo("diagnostico")
        d = self.tmp / "ajuste-diag"; shutil.copytree(SKILL / "painel", d)
        self.assertEqual(bv.ajustar_modulos(d, sub), sub["painel"]["modulos"])
        self.assertEqual(sorted(p.stem for p in (d / "js/modulos").glob("*.js")), sorted(sub["painel"]["modulos"]))

    def test_painel_nao_cita_ferramentas_e_nao_tem_html_dinamico(self):
        for arq in (self.premium / "painel").rglob("*"):
            if arq.is_file() and arq.suffix in {".js", ".html", ".css"}:
                texto = arq.read_text(encoding="utf-8")
                self.assertNotRegex(texto, r"(?i)claude|anthropic|\bIA\b|intelig[eê]ncia artificial|\bchatbot\b|\bGPT\b|\bagentes?\b|automa[cç]", arq.name)
        for rel in ("exames.js", "encaminhadores.js"):
            t = (self.premium / "painel/js/modulos" / rel).read_text(encoding="utf-8")
            self.assertNotRegex(t, r"\.innerHTML\s*=|insertAdjacentHTML\(|\.outerHTML\s*=|document\.write\(|\beval\(|new Function\(", rel)
            self.assertNotRegex(t, r"href: *[a-z]+\.(entregaVia|laudo|obs)", rel)  # "entregue por" é texto: nunca vira link clicável

    # ---- identidade ----
    def test_perfil_aplica_tema_chapa_e_subtipo_diagnostico(self):
        self.assertEqual(bv.carregar_perfil(SLUG4), {"subtipo": "diagnostico", "tema": "chapa", "pendencias": [], **PERFIL_SEM_EXTRAS})
        idx = self.ler(self.premium, "index.html")
        self.assertIn("hero--chapa", idx)
        for simbolo in ("mira", "escala", "fone", "pino", "relogio"):
            self.assertIn(f"<symbol id='{simbolo}'", idx)
        for ausente in ("pata", "cruz", "pena", "escama"):
            self.assertNotIn(f"<symbol id='{ausente}'", idx)
        css = self.ler(self.premium, "assets/style.css")
        self.assertIn("tema chapa", css); self.assertIn("chapa", self.ler(self.premium, "painel/painel.css"))
        self.assertIn("#bfe6ff", self.ler(self.premium, "assets/favicon.svg"))
        self.assertNotRegex(css, r"\.carimbo[^{]*\{[^}]*clip-path")
        self.assertNotRegex(css, r"@import|url\(\s*[\"']?https?:")
        self.assertIn("prefers-reduced-motion", css)
        self.assertEqual(re.findall(r"animation: ([a-z-]+) ", css.split("tema chapa")[1]), ["acender"])  # uma única animação própria do tema
        self.assertNotRegex(css.split("tema chapa")[1], r"box-shadow: *\d")  # sem sombra decorativa

    def test_tema_chapa_nao_repete_as_paletas_dos_sites_1_a_3_nem_as_formulas_de_ia(self):
        t = bv.carregar_tema("chapa")["tokens"]
        for outro in ("caderneta", "terrario", "sinalizacao"):
            o = bv.carregar_tema(outro)["tokens"]
            for papel in ("folha", "musgo", "carimbo", "papel"):
                self.assertNotEqual(t[papel].lower(), o[papel].lower(), f"{outro}/{papel}")
        self.assertNotRegex(json.dumps(t), r"(?i)terracota|#c1440e|#0f0f0f|#000000|neon")
        css = (SKILL / "temas" / "chapa.vitrine.css").read_text(encoding="utf-8")
        self.assertNotRegex(css, r"text-transform: *uppercase|font-family:[^;]*mono|ui-monospace")  # sem rótulos em caixa-alta e mono
        self.assertNotRegex(css, r"(?<![\w-])\.nota(?![\w-])")  # `.nota` é o parágrafo do formulário (chão liso): o tema não pode reusar o nome (as anotações da chapa colidiram e espremeram o aviso do formulário)
        self.assertEqual(bv.carregar_tema("chapa")["hero"], "chapa"); self.assertIn("chapa", bv.vc.HEROIS)

    def test_pacote_essencial_do_centro(self):
        self.assertEqual(sorted(p.name for p in self.essencial.iterdir()), ["README.md", "assets", "index.html", "painel"])
        self.assertIn("modules: { vitrine: false, gestao: true }", self.ler(self.essencial, "assets/site-config.js"))
        self.assertNotRegex(self.ler(self.essencial, "index.html"), r"wa\.me|servicos\.html")

    def test_regerar_por_cima_nao_perde_o_material_do_cliente(self):
        d = self.tmp / "material4"
        bv.gerar(SLUG4, saida=str(d))
        mat = d / "assets" / "material.js"
        mat.write_text(mat.read_text(encoding="utf-8").replace("galeria = [];", 'galeria = [{src: "assets/img/fachada.jpg", alt: "Fachada"}];'), encoding="utf-8")
        for kwargs in ({"vitrine": False}, {"gestao": False}, {}):
            bv.gerar(SLUG4, saida=str(d), **kwargs)
        self.assertIn("Fachada", mat.read_text(encoding="utf-8"))


SLUG5 = "clinica-veterinaria-nutrimed-ipanema"


class TestSite5Loja(unittest.TestCase):
    """Site 5 (Nutrimed Ipanema: clínica com venda de produtos; tema gondola, subtipo clinica_loja) nos três pacotes. Número só listado (não confirmado), sem horário no JSON, telefones e CEP que divergem."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="vet-build5-"))
        cls.premium = bv.gerar(SLUG5, saida=str(cls.tmp / "premium"))
        cls.basico = bv.gerar(SLUG5, gestao=False, saida=str(cls.tmp / "basico"))
        cls.essencial = bv.gerar(SLUG5, vitrine=False, saida=str(cls.tmp / "essencial"))
        cls.b = model.load_business(SLUG5)
        cls.c = cls.b["content"]

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    PAGINAS = ("index.html", "sobre.html", "contato.html")

    def ler(self, pasta, rel):
        return (pasta / rel).read_text(encoding="utf-8")

    def ctx(self, b=None, **kw):
        return bv.vc.contexto(b or self.b, True, tema=bv.carregar_tema("gondola"), subtipo=bv.carregar_subtipo("clinica_loja"), **kw)

    # ---- dados e honestidade ----
    def test_conteudo_e_vitrine_passam_nos_validadores_do_projeto(self):
        self.assertEqual(validate.check_content(self.b), [])
        for pasta in (self.premium, self.basico):
            self.assertEqual(validate.check_site(self.b, str(pasta)), [], pasta.name)

    def test_celular_listado_vira_o_botao_de_whatsapp(self):
        self.assertEqual(self.b["whatsapp"]["status"], "mobile-listed")
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            self.assertIn("wa-flutuante", html); self.assertNotIn("ligar-flutuante", html); um_whatsapp_so_icone(self, html, "5515997197619", pagina)
            self.assertNotRegex(html, r"tel:|Tentar pelo WhatsApp|pode não ter WhatsApp")
        idx = visivel(self.ler(self.premium, "index.html"))
        self.assertIn("Chame no WhatsApp e converse com a equipe sobre o atendimento do seu animal.", idx)  # o cadastro sai como está
        self.assertIn("Chame no WhatsApp", self.c["lead"])  # data/content não foi tocado
        self.assertIn('"whatsapp": "(15) 99719-7619"', self.ler(self.premium, "assets/site-config.js"))

    def test_so_o_telefone_do_perfil_entra_no_site_o_outro_so_no_readme(self):
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in pasta.rglob("*"):
                if arq.is_file() and arq.suffix in {".html", ".js", ".css", ".json", ".svg"}:
                    txt = arq.read_text(encoding="utf-8")
                    self.assertNotRegex(txt, r"8105[-\s]?6263", f"{pasta.name}/{arq.relative_to(pasta)}")
        self.assertIn("(15) 8105-6263", self.ler(self.premium, "README.md"))  # a pendência diz qual número ficou de fora

    def test_cep_que_diverge_fica_fora_do_site_e_dentro_da_pendencia(self):
        self.assertTrue(bv.vc.cep_a_confirmar(self.b)); self.assertIn("18070-180", self.b["address"])
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in pasta.rglob("*"):
                if arq.is_file() and arq.suffix in {".html", ".js", ".json"}:
                    self.assertNotRegex(arq.read_text(encoding="utf-8"), r"18070-?180|18071-?801", f"{pasta.name}/{arq.relative_to(pasta)}")
        ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', self.ler(self.premium, "index.html"), re.S).group(1))["address"]
        self.assertEqual(ld["streetAddress"], "Av. Ipanema, 4788"); self.assertEqual(ld["addressLocality"], "Sorocaba")  # a observação de entrada não é a rua
        self.assertNotIn("postalCode", ld)
        self.assertIn("CEP fora do site", self.ler(self.premium, "README.md"))
        # sem a pendência de CEP o endereço volta como está no cadastro
        b = json.loads(json.dumps(self.b)); b["research"]["pending"] = [p for p in b["research"]["pending"] if "CEP" not in p]
        self.assertFalse(bv.vc.cep_a_confirmar(b)); self.assertEqual(self.ctx(b).endereco, b["address"])
        self.assertEqual(bv.vc.endereco_sem_cep("Rua X, 1 - Bairro – Sorocaba, 18070-180"), "Rua X, 1 - Bairro – Sorocaba"); self.assertEqual(bv.vc.endereco_sem_cep("Rua X, 10"), "Rua X, 10")
        # a regra só liga quando ninguém decidiu: o site 3 ("... mantido o do CSV") e a palavra "recepção" (tem "cep" no meio) não ligam
        for pend, liga in (("CEP diverge: CSV 18215-055, Receita 18055-215; mantido o do CSV.", False), ("O CEP diverge (18071-801 nas fontes, 18070-180 no CSV).", True),
                           ("A recepção diverge do cadastro.", False), ("Horário diverge entre guias.", False)):
            self.assertIs(bv.vc.cep_a_confirmar({"research": {"pending": [pend]}}), liga, pend)
        self.assertFalse(bv.vc.cep_a_confirmar(model.load_business(SLUG3)))  # o endereço do CEDVET segue com o CEP do CSV
        self.assertIn("18215-055", model.load_business(SLUG3)["address"])
        # o analisador de endereço dos sites 1 a 4 não mudou, e o endereço de dois travessões deixou de dar a cidade errada
        self.assertEqual(bv.vc.endereco_estruturado("Av. Brasil, 931 - Vila Santa Francisca – Sorocaba, 18060-105")["streetAddress"], "Av. Brasil, 931")
        e = bv.vc.endereco_estruturado("Entrada lateral - Av. Ipanema, 4788 - Jardim Novo Horizonte – Sorocaba, 18070-180")
        self.assertEqual((e["addressLocality"], e["streetAddress"], e["postalCode"]), ("Sorocaba", "Av. Ipanema, 4788", "18070-180"))
        # o link "Como chegar" sem place_id também não leva o CEP em disputa (achado da revisão: a consulta do mapa limpava e o link não)
        sem_place = json.loads(json.dumps(self.b)); sem_place["google"] = None
        for b_ in (sem_place,):
            self.assertNotIn("18070", bv.vc.contexto(b_, True).maps_link)
        b_com = json.loads(json.dumps(sem_place)); b_com["research"]["pending"] = [p for p in b_com["research"]["pending"] if "CEP" not in p]
        self.assertIn("18070", bv.vc.contexto(b_com, True).maps_link)  # confirmado/sem pendência: a consulta volta como está

    def test_horario_nao_existe_no_json_entao_nao_existe_no_site(self):
        self.assertIsNone(self.c["hours"])
        for pagina in self.PAGINAS:
            html = visivel(self.ler(self.premium, pagina))
            self.assertNotRegex(html, r"\bHorário\b|(?i:segunda|sábado)|\d{1,2}h\b|\d{1,2}:\d{2}", pagina)  # "horários" do texto do JSON ("A equipe orienta sobre horários") é dele; o rótulo e os dias e horas são que não existem
        self.assertNotIn("gd-etq--horario", self.ler(self.premium, "index.html"))
        self.assertIn("horário de atendimento não encontrado em fonte", self.ler(self.premium, "README.md"))

    def test_nada_afirmado_alem_do_json_no_site_5(self):
        """Loja, agropet, marca, preço, catálogo, banho, exame, plantão e ano só como o JSON diz. Remove da página todo texto que vem do JSON e confere o que sobra."""
        trechos = self.ctx()
        textos = [trechos.tagline, trechos.lead, trechos.meta, *trechos.about, trechos.endereco, self.b["address"], *self.c["form"]["topic_options"]]
        for chave in ("services", "highlights", "how_to"):
            for item in getattr(trechos, chave):
                textos += [item["title"], item["text"]]
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            resto = visivel(html)
            for t in sorted(textos, key=len, reverse=True):
                resto = resto.replace(t, " ")
            self.assertNotRegex(resto, r"(?i)loja|agro|pet ?shop|ra[çc][ãa]o|marca|pre[çc]o|promo|cat[áa]logo|estoque|banho|tosa|exame|cirurgi|interna|plant[ãa]o|emerg[êe]ncia|urg[êe]ncia|24 ?h|horas?\b|desde \d{4}|\b20(1\d|2[0-6])\b|CRMV|melhor|refer[êe]ncia|premiad|certific|aberto|farm[áa]cia|delivery|entrega", f"{pagina}: texto sem fonte: {resto[:300]}")
            self.assertNotIn("<img", sem_ilustrativas(html))
        self.assertTrue(all(s.get("source", "").startswith("http") for s in self.c["services"]))

    # ---- primeiro toque e identidade ----
    def test_primeiro_toque_servicos_e_onde_fica_dentro_da_parede_antes_de_qualquer_secao(self):
        idx = self.ler(self.premium, "index.html")
        ini = idx.index('<section class="hero hero--gondola">'); hero = idx[ini:idx.index("</section>", ini)]
        self.assertIn('class="gd-etq gd-etq--servicos" data-toque="servicos" href="#servicos"', hero)
        self.assertIn('class="gd-etq gd-etq--onde" data-toque="onde" href="#localizacao"', hero)
        self.assertLess(hero.index('data-toque="servicos"'), hero.index('data-toque="onde"'))
        self.assertNotRegex(hero, r"tel:|wa\.me|Tentar pelo WhatsApp"); self.assertEqual(hero.count("<h1>"), 1)
        self.assertLess(idx.index("hero--gondola"), idx.index('id="servicos"'))
        self.assertNotIn('class="btn', hero)  # as etiquetas são os botões; nada de botões soltos
        # toda classe do hero e do ornamento do tema tem o prefixo gd- (as do chão liso são só as estruturais); `.nota` e as dos outros temas ficam de fora
        classes = {c for g in re.findall(r'class="([^"]+)"', hero) for c in g.split()}
        self.assertEqual({c for c in classes if not c.startswith("gd-")}, {"hero", "hero--gondola", "container", "hero-grade", "hero-texto", "destaque", "carimbo", "ilustra"})  # v1.0: a figura ilustrativa do fundo da parede (ilustra + gd-foto)
        self.assertFalse(classes & {"nota", "placa", "chapa", "anotacao", "viveiro", "ficha"})

    def test_hero_escapa_texto_de_dado(self):
        """O endereço, o horário e o nome vêm de dado: nada disso pode entrar como marcação no hero."""
        b = json.loads(json.dumps(self.b)); b["address"] = '<script>alert(1)</script> & "x" - Bairro – Sorocaba'; b["content"]["hours"] = {"text": "<img src=x onerror=1> Das 9h.", "source": "https://www.sorocabafacil.com.br/x"}
        b["content"]["tagline"] = "<b>negrito</b> Clínica"
        h = sem_ilustrativas(bv.vc.hero_gondola(self.ctx(b)))  # v1.0: a imagem ilustrativa do fundo da parede é do gerador, não dado
        self.assertNotRegex(h, r"<script|<img|<b>negrito")  # <b> do rótulo "Ligar" é do componente
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;", h)

    def test_hero_nao_inventa_etiqueta_sem_dado(self):
        sem_tudo = json.loads(json.dumps(self.b)); sem_tudo["whatsapp"] = {"digits": None, "display": None, "status": "none"}; sem_tudo["wa_contact"] = None; sem_tudo["phones"] = []; sem_tudo["google"] = None
        h = bv.vc.hero_gondola(self.ctx(sem_tudo))
        self.assertNotIn("carimbo", h); self.assertNotIn("wa.me", h); self.assertNotIn("tel:", h); self.assertNotIn("gd-prateleira", h); self.assertIn("gd-etq--onde", h)
        com_horario = json.loads(json.dumps(self.b)); com_horario["content"]["hours"] = {"text": "Das 9h às 18h.", "source": "https://www.sorocabafacil.com.br/x"}
        h = bv.vc.hero_gondola(self.ctx(com_horario))
        self.assertIn("gd-etq--horario", h); self.assertIn("Das 9h às 18h, segundo o guia Sorocaba Fácil.", h)  # horário de guia sai com a fonte

    def test_status_do_whatsapp_nao_muda_o_hero_nem_os_botoes(self):
        """v1.0 (PEDIDO_DESIGN_3): confirmado ou celular listado, o WhatsApp mora só no topo e no flutuante; o hero e os botões ficam iguais."""
        conf = json.loads(json.dumps(self.b)); conf["whatsapp"]["status"] = "confirmed"
        c = self.ctx(conf); nc = self.ctx()
        self.assertFalse(c.nao_confirmado); self.assertFalse(nc.nao_confirmado)
        self.assertEqual(bv.vc.hero_gondola(c), bv.vc.hero_gondola(nc))
        hero = bv.vc.hero_gondola(c)
        self.assertNotRegex(hero, r"wa\.me|tel:|gd-etq--wa|gd-etq--fone|Tentar pelo WhatsApp|pode não ter WhatsApp")
        self.assertEqual(bv.vc.botoes_cta(c), bv.vc.botoes_cta(nc))
        self.assertEqual(bv.vc.botoes_cta(c), '<div class="linha-botoes"><a class="btn" href="#servicos">Ver serviços</a></div>')  # sem Instagram nos dados
        h3 = bv.vc.botoes_cta(bv.vc.contexto(json.loads(json.dumps(model.load_business(SLUG3))), True, subtipo=bv.carregar_subtipo("hospital24h")))
        self.assertIn('href="#servicos"', h3); self.assertNotRegex(h3, r"wa\.me|tel:")

    def test_perfil_aplica_tema_gondola_e_subtipo_clinica_loja(self):
        perfil = bv.carregar_perfil(SLUG5)
        self.assertEqual((perfil["subtipo"], perfil["tema"]), ("clinica_loja", "gondola")); self.assertGreaterEqual(len(perfil["pendencias"]) + len(perfil["pendencias_vitrine"]), 3)
        idx = self.ler(self.premium, "index.html")
        for simbolo in ("etiqueta", "pata", "fone", "pino", "relogio"):
            self.assertIn(f"<symbol id='{simbolo}'", idx)
        for ausente in ("mira", "escala", "cruz", "pena", "escama"):
            self.assertNotIn(f"<symbol id='{ausente}'", idx)
        css = self.ler(self.premium, "assets/style.css")
        self.assertIn("tema gondola", css); self.assertIn("gondola", self.ler(self.premium, "painel/painel.css"))
        self.assertIn("#a8ecd0", self.ler(self.premium, "assets/favicon.svg"))
        self.assertNotRegex(css, r"\.carimbo[^{]*\{[^}]*clip-path")
        self.assertNotRegex(css, r"@import|url\(\s*[\"']?https?:")
        self.assertIn("prefers-reduced-motion", css)
        self.assertEqual(re.findall(r"animation: ([a-z-]+) ", css.split("tema gondola")[1]), ["pendurar"])  # uma única animação própria do tema (as quatro etiquetas só mudam o atraso)
        self.assertNotRegex(css.split("tema gondola")[1], r"box-shadow: *\d")  # sem sombra decorativa
        self.assertEqual(bv.carregar_tema("gondola")["hero"], "gondola"); self.assertIn("gondola", bv.vc.HEROIS)

    def test_tema_gondola_nao_repete_as_paletas_anteriores_nem_as_formulas_de_ia(self):
        t = bv.carregar_tema("gondola")["tokens"]
        for outro in ("caderneta", "terrario", "sinalizacao", "chapa"):
            o = bv.carregar_tema(outro)["tokens"]
            for papel in ("folha", "musgo", "carimbo", "papel", "fonte-titulo"):
                self.assertNotEqual(t[papel].lower(), o[papel].lower(), f"{outro}/{papel}")
        self.assertNotRegex(json.dumps(t), r"(?i)terracota|#c1440e|#0f0f0f|#000000|neon")
        for arq in ("gondola.vitrine.css", "gondola.painel.css"):
            css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / arq).read_text(encoding="utf-8"), flags=re.S)  # os comentários podem citar os nomes que o tema evita
            self.assertNotRegex(css, r"text-transform: *uppercase|font-family:[^;]*mono|ui-monospace", arq)  # sem rótulos em caixa-alta e mono
            self.assertNotRegex(css, r"(?<![\w-])\.(nota|placa|chapa|anotacao)(?![\w-])", arq)  # nomes do chão liso e dos temas anteriores
        # todo gradiente que carrega texto tem cor SÓLIDA por baixo (o contraste é medido contra background-color; sem gradiente o navegador também cai nela)
        css = re.sub(r"/\*.*?\*/", "", "".join((SKILL / "temas" / a).read_text(encoding="utf-8") for a in ("gondola.vitrine.css", "gondola.painel.css")), flags=re.S)
        for seletor, corpo in re.findall(r"([^{}]+)\{([^}]*gradient\([^}]*)\}", css):
            if re.search(r"h2::after", seletor):
                continue  # fileira de furos sem texto
            decl = re.search(r"background:([^;]+);", corpo).group(1).strip()
            self.assertRegex(decl, r"(#[0-9a-fA-F]{3,8}|var\(--[a-z-]+\))$", f"{seletor.strip()}: gradiente sem cor sólida por baixo: {decl[-40:]}")

    # ---- README e pacotes ----
    def test_readme_lista_pendencias_e_a_decisao_da_venda_so_onde_ha_painel(self):
        pendencias = [*self.b["research"]["pending"], "WhatsApp não confirmado", "registro profissional do responsável (CRMV) não encontrado em fonte", "fotos reais do negócio",
                      "horário de atendimento não encontrado em fonte", "CEP fora do site", "(15) 8105-6263", "loja \"Nutrimed Ipanema\" ao lado", "Fotos, preços de produtos e marcas só entram com material do cliente"]
        for pasta in (self.premium, self.basico, self.essencial):
            r = self.ler(pasta, "README.md")
            self.assertIn("## Pendências a confirmar com o negócio antes de publicar", r, pasta.name)
            for p in pendencias:
                confere_pendencia(self, pasta is self.essencial, p, r, pasta.name)
            self.assertNotRegex(r, r"(?i)skill|\.claude|claude")
        for pasta in (self.premium, self.essencial):
            r = self.ler(pasta, "README.md")
            self.assertIn("Venda no balcão no painel (Estoque e produtos)", r); self.assertIn("NÃO foi confirmada com o negócio", r)
            self.assertIn("preço de venda e venda no balcão", r)
        basico = self.ler(self.basico, "README.md")
        self.assertNotIn("Venda no balcão", basico); self.assertNotIn("painel", basico.lower()); self.assertNotIn("painel", self.ler(self.basico, "assets/site-config.js").lower())
        r = self.ler(self.premium, "README.md")
        self.assertIn("build_vet_site.py clinica-veterinaria-nutrimed-ipanema --sem-gestao", r); self.assertIn("build_vet_site.py clinica-veterinaria-nutrimed-ipanema --sem-vitrine", r)
        self.assertIn("gestao: true", r)

    def test_painel_tem_venda_so_no_premium_e_no_essencial_e_nao_ganha_outras_telas(self):
        for pasta in (self.premium, self.essencial):
            painel = json.loads(re.search(r"^  painel: (\{.*\})$", self.ler(pasta, "assets/site-config.js"), re.M).group(1))
            self.assertEqual(painel["subtipo"], "clinica_loja"); self.assertIs(painel["venda"], True); self.assertEqual(painel["marca"], "etiqueta")
            self.assertEqual(painel["matriz"], {"dono": {"vendas": "rw"}, "recepcao": {"vendas": "rw"}}); self.assertEqual(painel["titulos"], {"estoque": "Estoque e produtos"})
            self.assertNotIn("modulos", painel); self.assertNotIn("colecoesExtras", painel)
            modulos = {p.stem for p in (pasta / "painel/js/modulos").glob("*.js")}
            self.assertEqual(modulos, set(bv.MODULOS_BASE))
            estoque = self.ler(pasta, "painel/js/modulos/estoque.js")
            self.assertIn("calcularVenda", estoque); self.assertIn("Registrar venda", estoque)
            self.assertNotRegex(estoque, r"innerHTML|insertAdjacentHTML|eval\(")
        self.assertFalse((self.basico / "painel").exists())
        self.assertNotIn("venda", self.ler(self.basico, "assets/site-config.js").lower())
        # os outros subtipos não ganham venda
        for slug in (SLUG, SLUG2, SLUG3, SLUG4):
            d = bv.gerar(slug, saida=str(self.tmp / f"sem-venda-{slug[:8]}"))
            self.assertNotIn('"venda"', self.ler(d, "assets/site-config.js"), slug)

    def test_pacote_essencial_da_clinica(self):
        self.assertEqual(sorted(p.name for p in self.essencial.iterdir()), ["README.md", "assets", "index.html", "painel"])
        self.assertIn("modules: { vitrine: false, gestao: true }", self.ler(self.essencial, "assets/site-config.js"))
        self.assertNotRegex(self.ler(self.essencial, "index.html"), r"wa\.me|servicos\.html")

    def test_regerar_por_cima_nao_perde_o_material_do_cliente(self):
        d = self.tmp / "material5"
        bv.gerar(SLUG5, saida=str(d))
        mat = d / "assets" / "material.js"
        mat.write_text(mat.read_text(encoding="utf-8").replace("galeria = [];", 'galeria = [{src: "assets/img/fachada.jpg", alt: "Fachada"}];'), encoding="utf-8")
        for kwargs in ({"vitrine": False}, {"gestao": False}, {}):
            bv.gerar(SLUG5, saida=str(d), **kwargs)
        self.assertIn("Fachada", mat.read_text(encoding="utf-8"))

    def test_horario_com_fonte_vale_para_todos_os_subtipos(self):
        """v0.6: o horário de diretório do site 2 saía sem fonte porque só o subtipo do site 4 ligava a regra. Subtipo novo sem a chave reprova aqui."""
        for arq in sorted((SKILL / "subtipos").glob("*.json")):
            self.assertIs(json.loads(arq.read_text(encoding="utf-8"))["vitrine"].get("horario_com_fonte"), True, arq.name)


SLUG6 = "clinica-veterinaria-doc-dog-24horas"
PRAZO = re.compile(r"\b24\s?(?:horas|h)\b", re.I)
NOTA_URGENCIA = "Em caso de urgência, ligue: não espere resposta por mensagem."  # aviso do formulário (v0.7) quando o assunto "emergência" é oferecido a um número sem WhatsApp confirmado


class TestSite6DocDog(unittest.TestCase):
    """Site 6 (Doc & Dog: hospital 24h; tema dupla, subtipo hospital24h com a opção recepcao_ve_leitos) nos três pacotes. Telefone fixo, "24 horas" só de um guia (a confirmar),
    nome do cadastro com o prazo ("- 24Horas"), CEP que diverge sem a pesquisa registrar, internamento visto só em resumo de busca."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="vet-build6-"))
        cls.premium = bv.gerar(SLUG6, saida=str(cls.tmp / "premium"))
        cls.basico = bv.gerar(SLUG6, gestao=False, saida=str(cls.tmp / "basico"))
        cls.essencial = bv.gerar(SLUG6, vitrine=False, saida=str(cls.tmp / "essencial"))
        cls.b = model.load_business(SLUG6)
        cls.c = cls.b["content"]
        cls.perfil = bv.carregar_perfil(SLUG6)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    PAGINAS = ("index.html", "sobre.html", "contato.html")

    def ler(self, pasta, rel):
        return (pasta / rel).read_text(encoding="utf-8")

    def arquivos_do_site(self, pasta):
        return [a for a in pasta.rglob("*") if a.is_file() and a.suffix in {".html", ".js", ".css", ".json", ".svg"}]

    def ctx(self, b=None, **kw):
        return bv.vc.contexto(b or bv.com_pesquisa_do_perfil(self.b, self.perfil), True, tema=bv.carregar_tema("dupla"), subtipo=bv.aplicar_opcoes(bv.carregar_subtipo("hospital24h"), self.perfil["opcoes"]), perfil=self.perfil, **kw)

    # ---- dados e honestidade ----
    def test_conteudo_e_vitrine_passam_nos_validadores_do_projeto(self):
        self.assertEqual(validate.check_content(self.b), [])
        for pasta in (self.premium, self.basico):
            self.assertEqual(validate.check_site(self.b, str(pasta)), [], pasta.name)

    def test_telefone_fixo_nao_vira_botao_nenhum(self):
        """v1.0 (PEDIDO_DESIGN_3, item A): só telefone fixo = nenhum botão de WhatsApp (o site não inventa número) e nenhum de ligar; o número fica como texto
        e a falta vai para o README."""
        self.assertEqual(self.b["whatsapp"]["status"], "landline-unverified")
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            self.assertNotRegex(html, r"wa\.me|wa-flutuante|ligar-flutuante|btn-topo|tel:|Tentar pelo WhatsApp|pode não ter WhatsApp|<form", pagina)
            self.assertIn("(15) 3035-5006", html)  # o número continua na página, como texto
            self.assertIn('<a href="https://andremachado.design" target="_blank" rel="noopener">criado por andremachado.design</a>', html)
        self.assertIn('"whatsapp": ""', self.ler(self.premium, "assets/site-config.js"))
        r = self.ler(self.premium, "README.md")
        self.assertIn("sem celular: só telefone fixo (15) 3035-5006", r); self.assertIn("Botões de contato: nenhum.", r)

    def test_o_prazo_so_aparece_ao_lado_da_fonte_e_nunca_no_titulo_nem_na_descricao(self):
        """h1, <title>, meta e JSON-LD sem "24 horas"; em todo trecho que o visitante lê (item de lista, parágrafo, dado, serviço) o prazo vem com a fonte ao lado."""
        self.assertTrue(bv.vc.horario_a_confirmar(self.b)); self.assertTrue(bv.vc.prazo_tirado_dos_titulos(self.b))
        for pasta in (self.premium, self.basico):
            for pagina in self.PAGINAS:
                html = self.ler(pasta, pagina)
                cab = re.search(r"<title>(.*?)</title>", html).group(1) + re.search(r'<meta name="description" content="([^"]*)"', html).group(1) + "".join(re.findall(r"<h1>(.*?)</h1>", html))
                self.assertIsNone(PRAZO.search(cab), f"{pasta.name}/{pagina}: prazo no título ou na descrição: {cab}")
                ld = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S).group(1)
                self.assertIsNone(PRAZO.search(ld)); self.assertEqual(json.loads(ld)["name"], "Doc & Dog")
                for tag in ("li", "p", "dd", "article", "span"):
                    for corpo in re.findall(rf"<{tag}\b[^>]*>(.*?)</{tag}>", re.sub(r"<script.*?</script>", "", html, flags=re.S), re.S):
                        texto = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", corpo))
                        if PRAZO.search(texto):
                            self.assertRegex(texto, r"(?i)guia nool", f"{pasta.name}/{pagina}: prazo sem a fonte: {texto[:120]}")
        # o texto do serviço de emergência cita o prazo sem fonte no JSON: o gerador acrescenta a do próprio serviço (o JSON não é tocado)
        emergencia = next(s for s in self.c["services"] if s["title"] == "Atendimento de emergência")
        self.assertNotIn("segundo", emergencia["text"])
        self.assertIn("plantão 24 horas, segundo o guia nool. Em caso de urgência", self.ler(self.premium, "index.html"))
        self.assertIn("Atendimento 24 horas, segundo o guia nool. Confirme pelo telefone antes de ir.", self.ler(self.premium, "contato.html"))

    def test_nome_do_cadastro_com_prazo_nao_entra_no_site_so_no_readme(self):
        self.assertEqual(self.b["name"], "Clinica Veterinária Doc & Dog - 24Horas"); self.assertEqual(self.c["display_name"], "Doc & Dog")
        self.assertTrue(bv.vc.nome_com_prazo(self.b))
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in self.arquivos_do_site(pasta):
                txt = arq.read_text(encoding="utf-8")
                self.assertNotRegex(txt, r"24Horas|Cebs", f"{pasta.name}/{arq.relative_to(pasta)}")
        readme = self.ler(self.premium, "README.md")
        self.assertIn("Nome com prazo:", readme); self.assertIn("Clinica Veterinária Doc & Dog - 24Horas", readme)
        # quando a pesquisa confirmar o horário, os dados estruturados voltam ao nome completo; o nome do topo segue o do cadastro do site
        confirmado = json.loads(json.dumps(self.b)); confirmado["research"]["pending"] = [p for p in confirmado["research"]["pending"] if "24 horas" not in p]
        self.assertFalse(bv.vc.nome_com_prazo(confirmado)); self.assertEqual(self.ctx(confirmado).nome_nos_dados, "Clinica Veterinária Doc & Dog - 24Horas"); self.assertEqual(self.ctx(confirmado).nome, "Doc & Dog")
        self.assertTrue(PRAZO.search(self.ctx(confirmado).tagline))  # e o título original volta
        # nenhum dos outros cinco sites muda de nome nos dados estruturados
        for slug in (SLUG, SLUG2, SLUG3, SLUG4, SLUG5):
            b = model.load_business(slug); self.assertFalse(bv.vc.nome_com_prazo(b), slug); self.assertEqual(bv.vc.contexto(b, True).nome_nos_dados, b["name"], slug)

    def test_internamento_visto_so_em_resumo_de_busca_nao_aparece_na_vitrine(self):
        self.assertTrue(any(s["title"] == "Internamento assistido" for s in self.c["services"]))  # o cadastro (data/content) segue como está
        self.assertEqual(self.perfil["retirar_servicos"][0]["titulo"], "Internamento assistido")
        for pasta in (self.premium, self.basico):
            for pagina in self.PAGINAS:
                html = self.ler(pasta, pagina)
                self.assertNotRegex(html, r"(?i)internament|internaç|interna[dr]|leito|\bUTI\b|\bCTI\b", f"{pasta.name}/{pagina}")
        self.assertEqual(self.ler(self.premium, "index.html").count('<article class="servico '), 5)  # v1.0: todos os serviços na inicial, com imagem ilustrativa
        self.assertNotIn("f-assunto", self.ler(self.premium, "contato.html"))  # v1.0: sem formulário
        for pasta in (self.premium, self.basico):
            self.assertIn('Serviço fora da vitrine: "Internamento assistido"', self.ler(pasta, "README.md"))
        self.assertNotIn("Serviço fora da vitrine", self.ler(self.essencial, "README.md"))  # sem vitrine, nada a dizer sobre ela

    def test_cep_em_disputa_sai_do_site_inteiro_e_vai_para_a_pendencia(self):
        self.assertFalse(bv.vc.cep_a_confirmar(self.b), "a pesquisa NÃO registra a divergência: quem registra é o perfil do site")
        self.assertTrue(bv.vc.cep_a_confirmar(bv.com_pesquisa_do_perfil(self.b, self.perfil)))
        self.assertIn("18020-002", self.b["address"])
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in self.arquivos_do_site(pasta):
                self.assertNotRegex(arq.read_text(encoding="utf-8"), r"18020-?00[02]", f"{pasta.name}/{arq.relative_to(pasta)}")
        ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', self.ler(self.premium, "index.html"), re.S).group(1))["address"]
        self.assertNotIn("postalCode", ld); self.assertEqual(ld["streetAddress"], "R. Cel. Nogueira Padilha, 834")
        r = self.ler(self.premium, "README.md")
        self.assertIn("CEP fora do site", r); self.assertIn("18020-000", r); self.assertIn("18020-002", r)
        # o perfil não altera a pesquisa em disco nem a memória de quem chamou
        antes = json.dumps(self.b, sort_keys=True); bv.com_pesquisa_do_perfil(self.b, self.perfil); self.assertEqual(json.dumps(self.b, sort_keys=True), antes)
        self.assertFalse(any("CEP" in p for p in model.load_business(SLUG6)["research"]["pending"]))
        # idempotente: gerar duas vezes não duplica a pendência
        dupla = bv.com_pesquisa_do_perfil(bv.com_pesquisa_do_perfil(self.b, self.perfil), self.perfil)
        self.assertEqual(len([p for p in dupla["research"]["pending"] if "CEP" in p]), 1)

    def test_nada_afirmado_alem_do_json_no_site_6(self):
        """Remove da página todo texto que vem do JSON (com a fonte que o gerador acrescenta) e confere o que sobra."""
        ctx = self.ctx()
        textos = [ctx.tagline, ctx.lead, ctx.meta, *ctx.about, ctx.endereco, self.b["address"], ctx.hours["text"], self.c["hours"]["text"], NOTA_URGENCIA, *ctx.form["topic_options"]]
        for chave in ("services", "highlights", "how_to"):
            for item in getattr(ctx, chave):
                textos += [item["title"], item["text"]]
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            resto = htmllib.unescape(visivel(html))
            for t in sorted(textos, key=len, reverse=True):
                resto = resto.replace(t, " ")
            self.assertNotRegex(resto, r"(?i)\b24\b|plant[ãa]o|emerg[êe]ncia|urg[êe]ncia|interna|leito|\bUTI\b|exame|tomograf|raio|ultrassom|cirurgi|melhor|refer[êe]ncia|premiad|certific|aberto|desde \d{4}|\b20(1\d|2[0-6])\b|CRMV|convênio|pre[çc]o|promo|banho|tosa|agropet|loja|ra[çc][ãa]o", f"{pagina}: texto sem fonte: {resto[:300]}")
            self.assertNotIn("<img", sem_ilustrativas(html))

    # ---- primeiro toque e identidade ----
    def test_primeiro_toque_servicos_e_onde_fica_na_faixa_antes_de_qualquer_secao(self):
        idx = self.ler(self.premium, "index.html")
        ini = idx.index('<section class="hero hero--dupla">'); hero = idx[ini:idx.index("</section>", ini)]
        self.assertIn('data-toque="servicos" href="#servicos"', hero); self.assertIn('data-toque="onde" href="#localizacao"', hero)
        self.assertLess(hero.index('data-toque="servicos"'), hero.index('data-toque="onde"'))
        self.assertNotRegex(hero, r"tel:|wa\.me|Tentar pelo WhatsApp"); self.assertEqual(hero.count("<h1>"), 1)
        self.assertLess(idx.index("hero--dupla"), idx.index('id="servicos"'))
        self.assertNotIn('class="btn', hero)  # as células são os botões
        classes = {c for g in re.findall(r'class="([^"]+)"', hero) for c in g.split()}
        self.assertEqual({c for c in classes if not c.startswith("dp-")}, {"hero", "hero--dupla", "container", "destaque", "carimbo"})
        self.assertFalse(classes & {"nota", "placa", "chapa", "anotacao", "viveiro", "ficha", "gd-etq"})
        self.assertIn('aria-hidden="true"><span class="dp-metade">Doc</span><span class="dp-e">&amp;</span><span class="dp-metade dp-metade--2">Dog</span>', hero)  # o nome como cartaz é decoração: o h1 é o título

    def test_hero_escapa_texto_de_dado_e_nao_inventa_celula_sem_dado(self):
        b = json.loads(json.dumps(self.b)); b["address"] = '<script>alert(1)</script> & "x" - Bairro – Sorocaba'; b["content"]["hours"] = {"text": "<img src=x onerror=1> Das 9h.", "source": "https://www.sorocabafacil.com.br/x"}
        b["content"]["tagline"] = "<b>negrito</b> Clínica"; b["content"]["display_name"] = "<i>Doc</i> & <u>Dog</u>"
        h = bv.vc.hero_dupla(self.ctx(b))
        self.assertNotRegex(h, r"<script|<img|<b>negrito|<i>|<u>")
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;", h)
        sem_tudo = json.loads(json.dumps(self.b)); sem_tudo["whatsapp"] = {"digits": None, "display": None, "status": "none"}; sem_tudo["wa_contact"] = None; sem_tudo["phones"] = []; sem_tudo["google"] = None; sem_tudo["content"]["hours"] = None
        h = bv.vc.hero_dupla(self.ctx(sem_tudo))
        self.assertNotIn("dp-bloco--horario", h); self.assertNotIn("carimbo", h); self.assertNotIn("wa.me", h); self.assertNotIn("tel:", h); self.assertNotIn("dp-pe", h); self.assertIn("dp-bloco--onde", h)
        # nome sem "&": uma metade só, sem o disco
        um = json.loads(json.dumps(self.b)); um["content"]["display_name"] = "Clínica Exemplo"
        h = bv.vc.hero_dupla(self.ctx(um)); self.assertIn('<span class="dp-metade">Clínica Exemplo</span>', h); self.assertNotIn("dp-e", h)

    def test_numero_confirmado_nao_muda_o_hero(self):
        """v1.0: o WhatsApp não fica no hero em nenhum caso (só no topo e no flutuante); o status do número não muda os blocos."""
        conf = json.loads(json.dumps(bv.com_pesquisa_do_perfil(self.b, self.perfil))); conf["whatsapp"]["status"] = "confirmed"
        self.assertFalse(self.ctx(conf).nao_confirmado)
        hero = bv.vc.hero_dupla(self.ctx(conf))
        self.assertNotRegex(hero, r"dp-bloco--wa|dp-bloco--fone|wa\.me|tel:|Tentar pelo WhatsApp")
        self.assertLess(hero.index("dp-bloco--servicos"), hero.index("dp-bloco--onde"))

    def test_perfil_aplica_tema_dupla_e_subtipo_hospital24h_com_a_opcao(self):
        self.assertEqual((self.perfil["subtipo"], self.perfil["tema"], self.perfil["opcoes"]), ("hospital24h", "dupla", ["recepcao_ve_leitos"]))
        idx = self.ler(self.premium, "index.html")
        for simbolo in ("dupla", "pata", "fone", "pino", "relogio"):
            self.assertIn(f"<symbol id='{simbolo}'", idx)
        for ausente in ("mira", "escala", "cruz", "pena", "escama", "etiqueta", "seta"):
            self.assertNotIn(f"<symbol id='{ausente}'", idx)
        css = self.ler(self.premium, "assets/style.css")
        self.assertIn("tema dupla", css); self.assertIn("dupla", self.ler(self.premium, "painel/painel.css"))
        self.assertIn("#dcd2ff", self.ler(self.premium, "assets/favicon.svg"))
        self.assertNotRegex(css, r"\.carimbo[^{]*\{[^}]*clip-path"); self.assertNotRegex(css, r"@import|url\(\s*[\"']?https?:"); self.assertIn("prefers-reduced-motion", css)
        self.assertEqual(re.findall(r"animation: ([a-z-]+) ", css.split("tema dupla")[1]), ["dp-subir"])  # uma única animação (as células só mudam o atraso)
        self.assertNotRegex(css.split("tema dupla")[1], r"box-shadow: *\d")
        self.assertEqual(bv.carregar_tema("dupla")["hero"], "dupla"); self.assertIn("dupla", bv.vc.HEROIS)

    def test_tema_dupla_nao_repete_as_paletas_anteriores_nem_as_formulas_de_ia(self):
        t = bv.carregar_tema("dupla")["tokens"]
        for outro in ("caderneta", "terrario", "sinalizacao", "chapa", "gondola"):
            o = bv.carregar_tema(outro)["tokens"]
            for papel in ("folha", "musgo", "carimbo", "papel", "fonte-titulo"):
                self.assertNotEqual(t[papel].lower(), o[papel].lower(), f"{outro}/{papel}")
        self.assertNotRegex(json.dumps(t), r"(?i)terracota|#c1440e|#0f0f0f|#000000|neon")
        # o hospital anterior (sinalizacao) é do mesmo subtipo: nenhuma das cores de marca pode parecer a dele (cobalto/marinho/âmbar)
        def matiz(h):
            r, g, b = (int(h.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)); mx, mn = max(r, g, b), min(r, g, b)
            if mx == mn: return 0
            d = mx - mn; m = ((g - b) / d) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
            return m * 60
        sin = bv.carregar_tema("sinalizacao")["tokens"]
        for papel in ("musgo", "carimbo"):
            dist = abs(matiz(t[papel]) - matiz(sin[papel])); self.assertGreater(min(dist, 360 - dist), 25, papel)
        for arq in ("dupla.vitrine.css", "dupla.painel.css"):
            css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / arq).read_text(encoding="utf-8"), flags=re.S)
            self.assertNotRegex(css, r"text-transform: *uppercase|font-family:[^;]*mono|ui-monospace", arq)
            self.assertNotRegex(css, r"(?<![\w-])\.(nota|placa|chapa|anotacao)(?![\w-])", arq)
            self.assertNotRegex(css, r"(?i)\b(urgente|urgência|emergência|aberto agora|24 ?h)\b", arq)  # nenhum selo nem texto de funcionamento por enfeite
        # todo gradiente que carrega texto tem cor SÓLIDA por baixo; os dois anéis dos títulos (sem texto) ficam sobre transparente de propósito
        css = re.sub(r"/\*.*?\*/", "", "".join((SKILL / "temas" / a).read_text(encoding="utf-8") for a in ("dupla.vitrine.css", "dupla.painel.css")), flags=re.S)
        for seletor, corpo in re.findall(r"([^{}]+)\{([^}]*gradient\([^}]*)\}", css):
            if re.search(r"h2::before", seletor):
                continue
            decl = re.search(r"background:([^;]+);", corpo)
            self.assertIsNotNone(decl, seletor); self.assertRegex(decl.group(1).strip(), r"(#[0-9a-fA-F]{3,8}|var\(--[a-z-]+\))$", f"{seletor.strip()}: gradiente sem cor sólida por baixo")

    # ---- painel: a opção da recepção ----
    def test_painel_da_recepcao_so_com_a_opcao_e_o_site_3_nao_muda(self):
        for pasta in (self.premium, self.essencial):
            painel = json.loads(re.search(r"^  painel: (\{.*\})$", self.ler(pasta, "assets/site-config.js"), re.M).group(1))
            self.assertEqual(painel["subtipo"], "hospital24h"); self.assertEqual(painel["marca"], "dupla")
            self.assertEqual(painel["matriz"], {"dono": {"internacao": "rw"}, "veterinario": {"internacao": "rw"}, "recepcao": {"internacao": "r"}})
            self.assertNotIn("opcoes", painel)
            self.assertTrue((pasta / "painel/js/modulos/internacao.js").is_file())
        self.assertFalse((self.basico / "painel").exists()); self.assertNotIn("recepcao", self.ler(self.basico, "assets/site-config.js"))
        d3 = bv.gerar(SLUG3, saida=str(self.tmp / "s3"))
        painel3 = json.loads(re.search(r"^  painel: (\{.*\})$", self.ler(d3, "assets/site-config.js"), re.M).group(1))
        self.assertEqual(painel3["matriz"], {"dono": {"internacao": "rw"}, "veterinario": {"internacao": "rw"}}, "o hospital do site 3 segue sem internação para a recepção")
        self.assertNotIn("Visão da recepção", self.ler(d3, "README.md"))

    def test_opcoes_do_subtipo_recusam_nome_e_chave_desconhecidos(self):
        hosp = bv.carregar_subtipo("hospital24h")
        with self.assertRaises(SystemExit) as e: bv.aplicar_opcoes(hosp, ["nao-existe"])
        self.assertIn("opção 'nao-existe' inexistente", str(e.exception)); self.assertIn("recepcao_ve_leitos", str(e.exception))
        ruim = json.loads(json.dumps(hosp)); ruim["opcoes"]["tosca"] = {"painel": {"venda": True}, "tema": "x"}
        with self.assertRaises(SystemExit) as e: bv.aplicar_opcoes(ruim, ["tosca"])
        self.assertIn("chave não suportada", str(e.exception))
        self.assertNotIn("opcoes", bv.aplicar_opcoes(hosp, []))  # a cópia não leva as opções para o site
        feito = bv.aplicar_opcoes(hosp, ["recepcao_ve_leitos"]); self.assertEqual(feito["painel"]["matriz"]["recepcao"], {"internacao": "r"})
        self.assertNotIn("recepcao", hosp["painel"]["matriz"])  # o subtipo original não é alterado
        for outro in ("geral", "exoticos", "diagnostico", "clinica_loja"):
            self.assertNotIn("opcoes", bv.carregar_subtipo(outro), outro)  # a única opção é do hospital

    def test_perfil_com_entrada_hostil_para_com_mensagem_onde_muda_o_site_e_tolera_onde_so_vira_texto(self):
        d = self.tmp / "perfil-hostil"; (d / "perfis").mkdir(parents=True)
        orig = bv.SKILL
        def carregar(conteudo, nome="x"):
            (d / "perfis" / f"{nome}.json").write_text(conteudo if isinstance(conteudo, str) else json.dumps(conteudo), encoding="utf-8")
            bv.SKILL = d
            try:
                return bv.carregar_perfil(nome)
            finally:
                bv.SKILL = orig
        # o que só vira texto de README é tolerante (e sem repetição)
        p = carregar({"subtipo": "geral", "tema": "caderneta", "pesquisa_pendente": [None, 3, "", "ok", "ok"], "pendencias": "texto", "pendencias_gestao": {"a": 1}})
        self.assertEqual((p["pesquisa_pendente"], p["pendencias"], p["pendencias_gestao"], p["opcoes"], p["retirar_servicos"]), (["ok"], [], [], [], []))
        # o que MUDA o site para com mensagem (antes ignorava em silêncio e o site saía sem a visão da recepção ou com o serviço que o README diz ter tirado)
        for ruim in ({"opcoes": "recepcao_ve_leitos"}, {"opcoes": {"a": 1}}, {"opcoes": [3]}, {"opcoes": [""]}, {"retirar_servicos": ["x"]}, {"retirar_servicos": [3]}, {"retirar_servicos": [{"motivo": "sem título"}]},
                     {"retirar_servicos": [{"titulo": "  "}]}, {"retirar_servicos": "x"}, {"retirar_servicos": {"titulo": "x"}}):
            with self.assertRaises(SystemExit, msg=str(ruim)) as e: carregar(ruim)
            self.assertRegex(str(e.exception), r"perfil x\.json: \"(opcoes|retirar_servicos)\" deve ser")
        for quebrado in ("", "{", "[1, 2]", "null", '{"opcoes": '):
            with self.assertRaises(SystemExit, msg=repr(quebrado)) as e: carregar(quebrado)
            self.assertRegex(str(e.exception), r"perfil x\.json: (JSON inválido|deveria ser um objeto)")
        # o título que não casa com nenhum serviço do cadastro para o gerador (antes o serviço ficava no site e o README dizia que estava fora)
        with self.assertRaises(SystemExit) as e: bv.conferir_servicos_retirados(self.b, {"retirar_servicos": [{"titulo": "Internamento assistid"}]})
        self.assertIn("não é título de nenhum serviço do cadastro", str(e.exception)); self.assertIn("cirurgias", str(e.exception))
        bv.conferir_servicos_retirados(self.b, {"retirar_servicos": [{"titulo": " internamento ASSISTIDO "}]})  # maiúsculas e espaços não importam
        bv.conferir_servicos_retirados(self.b, {"retirar_servicos": []}); bv.conferir_servicos_retirados({"content": None}, {})
        # opção com permissão ou perfil inválido, e opção repetida
        hosp = bv.carregar_subtipo("hospital24h")
        for matriz in ({"recepcaoo": {"internacao": "r"}}, {"recepcao": {"internacao": "rww"}}, {"recepcao": "r"}, {"recepcao": {"Internação": "r"}}, ["x"]):
            ruim = json.loads(json.dumps(hosp)); ruim["opcoes"]["x"] = {"painel": {"matriz": matriz}}
            with self.assertRaises(SystemExit, msg=str(matriz)): bv.aplicar_opcoes(ruim, ["x"])
        dupla = bv.aplicar_opcoes(hosp, ["recepcao_ve_leitos", "recepcao_ve_leitos"]); self.assertEqual(len(dupla["pendencias_gestao"]), 1)
        self.assertEqual(bv.aplicar_opcoes(hosp, ["recepcao_ve_leitos"])["painel"]["matriz"]["recepcao"], {"internacao": "r"})
        retirar = json.loads(json.dumps(hosp)); retirar["opcoes"]["x"] = {"painel": {"matriz": {"recepcao": {"internacao": None}}}}; self.assertEqual(bv.aplicar_opcoes(retirar, ["x"])["painel"]["matriz"]["recepcao"], {"internacao": None})  # null remove a permissão

    def test_servico_retirado_e_prazo_com_fonte_no_componente(self):
        c = bv.vc._servicos_com_a_fonte_do_prazo({"services": [
            {"title": "A", "text": "Plantão 24 horas. Ligue.", "source": "https://nool.com.br/x"},
            {"title": "B", "text": "Atendimento 24h", "source": "https://www.sorocabafacil.com.br/y"},
            {"title": "C", "text": "Plantão 24 horas.", "source": ""},
            {"title": "D", "text": "Segundo o guia, 24 horas.", "source": "https://nool.com.br/x"},
            {"title": "E", "text": "Sem prazo.", "source": "https://nool.com.br/x"},
            {"title": "F", "text": None, "source": "https://nool.com.br/x"}, {"title": "G", "text": "Plantão 24 horas e mais.", "source": "https://exemplo.com.br/x"},
            {"title": "H", "text": "Plantão 24 horas com o Dr. Silva. Fale conosco.", "source": "https://nool.com.br/x"},  # "Dr." não é fim de frase
            {"title": "I", "text": "Aberto 24hs, 24 hrs ou 24-horas", "source": "https://nool.com.br/x"}, {"title": "J", "text": "Plantão 24 horas.", "source": 5}, {"title": "K", "text": "24 horas... veja", "source": "https://nool.com.br/x"}]})
        t = [s["text"] for s in c["services"]]
        self.assertEqual(t[0], "Plantão 24 horas, segundo o guia nool. Ligue."); self.assertEqual(t[1], "Atendimento 24h, segundo o guia Sorocaba Fácil")
        self.assertEqual(t[2], "Plantão 24 horas."); self.assertEqual(t[3], "Segundo o guia, 24 horas."); self.assertEqual(t[4], "Sem prazo."); self.assertIsNone(t[5]); self.assertEqual(t[6], "Plantão 24 horas, segundo exemplo.com.br, e mais.")
        self.assertEqual(t[7], "Plantão 24 horas, segundo o guia nool, com o Dr. Silva. Fale conosco.", "a fonte entra logo depois do prazo; o 'Dr.' antes quebrava a frase ('com o Dr, segundo ... Silva')")
        self.assertEqual(t[8], "Aberto 24hs, segundo o guia nool, 24 hrs ou 24-horas"); self.assertEqual(t[9], "Plantão 24 horas.", "fonte que não é texto não derruba nem inventa"); self.assertEqual(t[10], "24 horas, segundo o guia nool... veja")
        for escrita in ("24h", "24hs", "24 hrs", "24-horas", "24Horas", "24 horas", "24 HORAS"):
            self.assertTrue(bv.vc._PRAZO_NO_TITULO.search(f"Plantão {escrita}."), escrita)
        for nao in ("24 hospitais", "2024", "124 horas", "24 hotéis"):
            self.assertIsNone(bv.vc._PRAZO_NO_TITULO.search(nao), nao)
        # pendência que só tem "hor" no meio de uma palavra não pede a confirmação do horário (a regra antiga ligava com "Vila Hortência ... confirmar")
        self.assertFalse(bv.vc.horario_a_confirmar({"research": {"pending": ["Confirmar o endereço da Vila Hortência"]}}))
        self.assertTrue(bv.vc.horario_a_confirmar({"research": {"pending": ["Confirmar o horário"]}})); self.assertTrue(bv.vc.horario_a_confirmar({"research": {"pending": ["Confirmar o atendimento 24h"]}}))
        for hostil in (None, {}, {"research": None}, {"research": {"pending": "Confirmar o horário"}}, {"research": {"pending": [None, 3, {}]}}):
            self.assertFalse(bv.vc.horario_a_confirmar(hostil or {}))
        orig = {"services": [{"title": "A", "text": "Plantão 24 horas.", "source": "https://nool.com.br/x"}], "form": {"topic_options": ["A", "b", "C"]}}
        antes = json.dumps(orig); r = bv.vc._sem_servicos(orig, [{"titulo": " a "}, {"titulo": "c"}, "x", None]); self.assertEqual(json.dumps(orig), antes)
        self.assertEqual(r["services"], []); self.assertEqual(r["form"]["topic_options"], ["b"])
        self.assertIs(bv.vc._sem_servicos(orig, []), orig); self.assertIs(bv.vc._sem_servicos(orig, None), orig)
        # os cinco primeiros sites não têm o prazo em texto de serviço sem fonte: nada mudou na lista de serviços deles
        for slug in (SLUG, SLUG2, SLUG3, SLUG4, SLUG5):
            b = model.load_business(slug); original = [(s["title"], s["text"]) for s in b["content"]["services"]]
            sem_wa = bv.vc.contexto(b, True)
            self.assertEqual(len(sem_wa.services), len(original), slug)

    # ---- README e pacotes ----
    def test_readme_lista_pendencias_e_as_decisoes_so_onde_ha_o_que_decidir(self):
        base = [*self.b["research"]["pending"], "sem celular: só telefone fixo (15) 3035-5006", "registro profissional do responsável (CRMV) não encontrado em fonte", "fotos reais do negócio", "CEP fora do site", "Nome com prazo:",
                "Horário a confirmar: o título e a descrição do site NÃO citam"]
        for pasta in (self.premium, self.basico, self.essencial):
            r = self.ler(pasta, "README.md")
            self.assertIn("## Pendências a confirmar com o negócio antes de publicar", r, pasta.name)
            for p in base:
                confere_pendencia(self, pasta is self.essencial, p, r, pasta.name)
            self.assertNotRegex(r, r"(?i)skill|\.claude|claude|\bIA\b|agente|automa")
        for pasta in (self.premium, self.essencial):
            r = self.ler(pasta, "README.md")
            self.assertIn("Visão da recepção na internação: é PROPOSTA do gerador, não foi confirmada com o negócio", r); self.assertIn("Módulo de internação do painel: é um modelo do gerador", r)
            self.assertIn("recepção vê só o mapa de leitos", r)
        basico = self.ler(self.basico, "README.md")
        self.assertNotIn("Visão da recepção", basico); self.assertNotIn("Módulo de internação", basico); self.assertNotIn("painel", basico.lower()); self.assertNotIn("painel", self.ler(self.basico, "assets/site-config.js").lower())
        r = self.ler(self.premium, "README.md")
        self.assertIn(f"build_vet_site.py {SLUG6} --sem-gestao", r); self.assertIn(f"build_vet_site.py {SLUG6} --sem-vitrine", r); self.assertIn("gestao: true", r)

    def test_readme_do_cep_diz_onde_retirar_a_pendencia_conforme_a_origem(self):
        """Achado da revisão: o README mandava "retirar a pendência da pesquisa", mas a do site 6 mora no perfil do site (a da pesquisa não existe)."""
        r6 = self.ler(self.premium, "README.md")
        self.assertIn('retire a linha do CEP de "pesquisa_pendente" no perfil do site (perfis/clinica-veterinaria-doc-dog-24horas.json)', r6)
        self.assertNotIn("CEP com o negócio, retire a pendência da pesquisa", r6)
        r5 = self.ler(bv.gerar(SLUG5, saida=str(self.tmp / "s5-readme")), "README.md")  # no site 5 a pendência é da pesquisa de verdade
        self.assertIn("CEP com o negócio, retire a pendência da pesquisa e gere o site de novo", r5); self.assertNotIn("pesquisa_pendente", r5)
        # as pendências injetadas pelo perfil não se repetem em README nem na pesquisa em memória
        perfil = dict(self.perfil, pesquisa_pendente=self.perfil["pesquisa_pendente"] * 2)
        self.assertEqual(len([p for p in bv.com_pesquisa_do_perfil(self.b, perfil)["research"]["pending"] if "CEP diverge" in p]), 1)
        self.assertEqual(r6.count("CEP diverge: o CSV traz 18020-002"), 1)

    def test_contato_sem_formulario_nem_aviso_de_formulario(self):
        """v1.0 (PEDIDO_DESIGN_3, item A): o formulário saiu (os únicos botões de contato são os dois de WhatsApp), e com ele o aviso de urgência que o formulário
        mostrava para número sem WhatsApp confirmado (v0.7). O texto do serviço de emergência continua como está no cadastro."""
        self.assertFalse(hasattr(bv.vc, "formulario_wa"))
        for pasta in (self.premium, self.basico):
            contato = self.ler(pasta, "contato.html")
            self.assertNotIn("<form", contato); self.assertNotIn(NOTA_URGENCIA, contato); self.assertNotIn("f-assunto", contato)
        for slug in (SLUG, SLUG4, SLUG5):
            d = bv.gerar(slug, saida=str(self.tmp / f"urg-{slug[:6]}"))
            self.assertNotIn("<form", self.ler(d, "contato.html"), slug)

    def test_pacote_essencial_do_hospital(self):
        self.assertEqual(sorted(p.name for p in self.essencial.iterdir()), ["README.md", "assets", "index.html", "painel"])
        self.assertIn("modules: { vitrine: false, gestao: true }", self.ler(self.essencial, "assets/site-config.js"))
        self.assertNotRegex(self.ler(self.essencial, "index.html"), r"wa\.me|servicos\.html")

    def test_regerar_por_cima_nao_perde_o_material_do_cliente(self):
        d = self.tmp / "material6"
        bv.gerar(SLUG6, saida=str(d))
        mat = d / "assets" / "material.js"
        mat.write_text(mat.read_text(encoding="utf-8").replace("galeria = [];", 'galeria = [{src: "assets/img/fachada.jpg", alt: "Fachada"}];'), encoding="utf-8")
        for kwargs in ({"vitrine": False}, {"gestao": False}, {}):
            bv.gerar(SLUG6, saida=str(d), **kwargs)
        self.assertIn("Fachada", mat.read_text(encoding="utf-8"))

SLUG7 = "del-vet"
SLUG8 = "clinica-veterinaria-animal-inc"
SLUG9 = "clinica-veterinaria-ishizuka"
SLUG10 = "pilares-unidade-veterinaria-24h"
TODOS = (SLUG, SLUG2, SLUG3, SLUG4, SLUG5, SLUG6, SLUG7, SLUG8, SLUG9, SLUG10)
ATRIBUI = re.compile(r"(?i)\b(segundo|informa|informam|registra|registram|lista|listam|cita|citam|consta|constam|conforme|de acordo com|se apresenta|divulga|anuncia|afirma|declara)\b")  # v1.4: os mesmos verbos que o gerador já tratava como atribuição desde a 0.8 (`_JA_ATRIBUI`); "A unidade se apresenta como..." atribui o prazo à própria unidade (site 10)
VITRINE_NO_TEXTO = re.compile(r"(?i)\b(vitrine|galeria|bot[ãa]o|placa|dados estruturados|formul[áa]rio|descri[çc][ãa]o|selo|se[çc][ãa]o|o site|(?<!perfil )do site|no site|este site|ao site|p[áa]gina (?-i:Sobre|Contato)|p[áa]gina inicial|(?-i:Sobre|Contato))\b")  # "perfil do site" é o arquivo de identidade em perfis/, não a vitrine


def pendencias_do_readme(txt: str):
    """Linhas ('- ...') da seção de pendências do README e o texto da seção."""
    sec = txt.split("## Pendências a confirmar com o negócio antes de publicar")[1].split("\n## ")[0]
    return [l[2:] for l in sec.splitlines() if l.startswith("- ")], sec


class TestDividasDoSite6(unittest.TestCase):
    """Dívidas declaradas pelo site 6, pagas na 0.8: README do ESSENCIAL sem a vitrine; fonte no próprio texto (diferenciais e ano do CNPJ). Valem para os 7 sites."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="vet-build-div-"))
        cls.essencial = {s: bv.gerar(s, vitrine=False, saida=str(cls.tmp / f"ess-{s}")) for s in TODOS}
        cls.premium = {s: bv.gerar(s, saida=str(cls.tmp / f"pre-{s}")) for s in TODOS}

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_readme_do_essencial_nao_descreve_itens_de_vitrine(self):
        """O pacote ESSENCIAL não tem vitrine: nenhuma pendência escrita pelo gerador ou pelo perfil pode falar de botão, galeria, título, Sobre, Contato ou dados estruturados.
        As linhas que vêm da pesquisa (data/research) ficam como estão (o gerador não as edita) e TODAS continuam na lista."""
        for slug in TODOS:
            b = model.load_business(slug); perfil = bv.carregar_perfil(slug)
            r = (self.essencial[slug] / "README.md").read_text(encoding="utf-8")
            itens, sec = pendencias_do_readme(r)
            da_pesquisa = set(_pendencias_da_pesquisa(b)) | set(perfil["pesquisa_pendente"])
            for p in _pendencias_da_pesquisa(b):
                self.assertIn(p, itens, f"{slug}: pendência da pesquisa sumiu do README do ESSENCIAL")
            for i in itens:
                if i not in da_pesquisa:
                    self.assertIsNone(VITRINE_NO_TEXTO.search(i), f"{slug}: README do ESSENCIAL descreve a vitrine: {i[:140]}")
            self.assertIn("quem apresenta a gestão ao negócio", sec, slug); self.assertNotIn("quem apresenta o site", sec, slug)
            self.assertNotIn("O site não os afirma", sec, slug)
            # o que vale para a gestão continua: expediente da agenda quando o horário está a confirmar
            if bv.vc.horario_a_confirmar(b):
                self.assertTrue(any("expediente da agenda do painel" in i for i in itens), f"{slug}: falta a pendência do expediente da agenda")

    def test_readme_da_vitrine_continua_com_as_pendencias_da_vitrine(self):
        r = (self.premium[SLUG6] / "README.md").read_text(encoding="utf-8")
        for esperado in ("Horário a confirmar: o título e a descrição do site NÃO citam", "Nome com prazo:", "sem celular: só telefone fixo (15) 3035-5006", "fotos reais do negócio", "CEP fora do site"):
            self.assertIn(esperado, r)
        self.assertIn("quem apresenta o site ao negócio", r)

    def test_todo_diferencial_com_fonte_diz_de_onde_vem_no_proprio_texto(self):
        for slug in TODOS:
            sobre = (self.premium[slug] / "sobre.html").read_text(encoding="utf-8")
            lista = re.search(r'<ul class="lista-simples">(.*?)</ul>', sobre, re.S)
            b = model.load_business(slug)
            if not (b["content"].get("highlights")):
                self.assertIsNone(lista, slug); continue
            itens = re.findall(r"<li>(.*?)</li>", lista.group(1), re.S)
            self.assertEqual(len(itens), len(b["content"]["highlights"]), slug)
            for li in itens:
                texto = htmllib.unescape(re.sub(r"<[^>]+>", " ", li))
                self.assertRegex(texto, ATRIBUI, f"{slug}: diferencial sem a fonte no próprio texto: {texto[:120]}")

    def test_ano_de_abertura_do_cnpj_leva_a_fonte_no_texto_e_na_descricao(self):
        achou = 0
        for slug in TODOS:
            b = model.load_business(slug)
            anos = [m.group(2) for t in b["content"]["about"] for m in re.finditer(r"(CNPJ aberto em (\d{4}))", t)]
            if not anos:
                continue
            achou += 1
            sobre = (self.premium[slug] / "sobre.html").read_text(encoding="utf-8")
            for ano in anos:
                self.assertRegex(htmllib.unescape(sobre), rf"CNPJ aberto em {ano} \(segundo (o|a) [^)]+\)", slug)
            meta = htmllib.unescape(re.search(r'<meta name="description" content="([^"]*)"', sobre).group(1))
            if "CNPJ" in meta:
                self.assertRegex(meta, r"CNPJ aberto em \d{4} \(segundo", slug)
            self.assertNotRegex(" ".join(pendencias_do_readme((self.premium[slug] / "README.md").read_text(encoding="utf-8"))[0]), r"CNPJ aberto em", slug)  # fonte achada: nada a pendenciar
        self.assertGreaterEqual(achou, 3)  # sites 1, 3 e 6

    def test_titulos_quebram_palavra_comprida_na_fonte_reserva(self):
        """Dívida do site 6 (fonte do título que cai para Arial fora da Apple): reproduzida em Chrome com `e2e_vitrine` (nome de 20 letras em Arial: servicos.html com 372px em 320px nos
        sites 1 a 5; só a `dupla` aguentava, por ter `overflow-wrap: anywhere` própria). O chão liso agora quebra o título no meio da palavra em vez de alargar a página."""
        base = (SKILL / "components" / "vitrine.base.css").read_text(encoding="utf-8")
        self.assertRegex(base, r"h1, h2, h3 \{[^}]*overflow-wrap: anywhere")
        e2e = (SKILL / "tests" / "e2e_vitrine.mjs").read_text(encoding="utf-8")
        self.assertIn("Otorrinolaringologia", e2e); self.assertIn("font-family: Arial", e2e)  # o cenário que reprovava continua no teste de Chrome

    def test_descricao_para_buscadores_nao_corta_em_sigla_de_endereco_ou_titulo(self):
        """Achado da revisão da 0.8: a atribuição alongou o primeiro parágrafo de Sobre e o corte da descrição caiu em "... que atende na Av." (familia-vet, doc-dog) e em "... a médica veterinária Dra." (del-vet)."""
        rm = bv.vc.resumo_meta
        longo = "Atendemos na Av. Washington Luiz, 1887, no Jardim América, em Sorocaba. A Dra. Ana Souza, CRMV-SP 12345, atende de segunda a sexta com horário marcado pelo telefone da clínica."
        self.assertEqual(rm(longo), "Atendemos na Av. Washington Luiz, 1887, no Jardim América, em Sorocaba.")
        self.assertEqual(rm("Texto curto com R. Cel. Padilha."), "Texto curto com R. Cel. Padilha.")
        sem_frase = "Fica na Av. Washington Luiz, 1887, no Jardim América, em Sorocaba onde atende a Dra. Ana Souza, com horário marcado pelo telefone da clínica e atendimento de segunda a sexta."
        self.assertTrue(rm(sem_frase).endswith("…") and not rm(sem_frase).endswith("Dra. …"))
        for sigla in ("Av.", "R.", "Dra.", "Dr.", "Cel.", "Prof.", "J."):
            frase = ("x" * 70) + f" {sigla} Nome do lugar que continua por mais algum tempo, bem além do limite de caracteres que cabe numa descrição de busca para esta página."
            self.assertFalse(re.search(rf"(?<![A-Za-zÀ-ÿ]){re.escape(sigla)}$", rm(frase)), f"{sigla}: {rm(frase)}")
        self.assertEqual(rm(("a" * 70) + ". " + ("b" * 100)), ("a" * 70) + ".")  # ponto de fim de frase de verdade ainda corta
        self.assertTrue(rm("Curto. " + "palavra " * 40).endswith("…"), "frase curta demais (menos de 60) não vira a descrição inteira")
        for slug in TODOS:
            for pagina in ("index.html", "sobre.html", "contato.html"):
                meta = htmllib.unescape(re.search(r'<meta name="description" content="([^"]*)"', (self.premium[slug] / pagina).read_text(encoding="utf-8")).group(1))
                self.assertFalse(re.search(r"(?<![A-Za-zÀ-ÿ])(Av|R|Dra?|Cel|Prof|Sra?)\.$", meta), f"{slug}/{pagina}: descrição cortada em sigla: {meta}")

    def test_essencial_nao_traz_pendencia_so_de_vitrine_de_nenhum_tipo_e_avisa_do_expediente_sem_horario(self):
        """Mutantes M12 e M40 da revisão (tirar `no-rating` e `no-phone` de TIPOS_SO_DA_VITRINE) sobreviviam: nenhum teste tinha um negócio sem nota nem telefone."""
        b = json.loads(json.dumps(model.load_business(SLUG))); b["google"] = None; b["whatsapp"] = {"digits": None, "display": None, "status": "none"}; b["wa_contact"] = None; b["phones"] = []; b["content"]["hours"] = None
        com = bv.pendencias_do_negocio(b, True, None, vitrine=True); sem = bv.pendencias_do_negocio(b, True, None, vitrine=False)
        for texto in ("nota e avaliações do Google não coletadas", "sem telefone: botão de WhatsApp", "fotos reais do negócio", "horário de atendimento não encontrado em fonte: seção omitida", "registro profissional do responsável"):
            self.assertTrue(any(texto in p for p in com), f"a vitrine deveria ter: {texto}"); self.assertFalse(any(texto in p for p in sem), f"o ESSENCIAL não pode ter: {texto}")
        self.assertTrue(any("a grade da agenda do painel vem do padrão (08:00 às 18:00)" in p for p in sem))  # sem horário no cadastro, o expediente padrão da agenda fica sem aviso se isto faltar
        self.assertEqual(set(bv.TIPOS_SO_DA_VITRINE), {"wa-unverified", "no-mobile", "no-phone", "no-rating", "registry", "hours", "gallery"})
        self.assertFalse(any("grade da agenda" in p for p in bv.pendencias_do_negocio(b, False, None, vitrine=False)))  # sem gestão não há agenda

    def test_atribuicao_no_componente_com_entrada_hostil(self):
        vc = bv.vc
        c = {"highlights": [
            {"title": "A", "text": "Atende aves.", "source": "https://guiamaispratico.com.br/x"}, {"title": "B", "text": "O guia nool registra 24 horas.", "source": "https://nool.com.br/x"},
            {"title": "C", "text": "Sem fonte.", "source": ""}, {"title": "D", "text": None, "source": "https://nool.com.br/x"}, {"title": "E", "text": "Sem ponto final", "source": "https://nool.com.br/x"},
            {"title": "F", "text": "Fonte que não é endereço.", "source": 5}, {"title": "G", "text": "   ", "source": "https://nool.com.br/x"}, {"title": "H", "text": "Texto.", "source": "https://exemplo.com.br/a"}]}
        antes = json.dumps(c, sort_keys=True); r = vc._destaques_com_a_fonte(c); self.assertEqual(json.dumps(c, sort_keys=True), antes)
        t = [h["text"] for h in r["highlights"]]
        self.assertEqual(t[0], "Atende aves, segundo o guia Mais Prático."); self.assertEqual(t[1], "O guia nool registra 24 horas."); self.assertEqual(t[2], "Sem fonte."); self.assertIsNone(t[3])
        self.assertEqual(t[4], "Sem ponto final, segundo o guia nool"); self.assertEqual(t[5], "Fonte que não é endereço."); self.assertEqual(t[6], "   "); self.assertEqual(t[7], "Texto, segundo o site exemplo.com.br.")
        self.assertEqual(vc._destaques_com_a_fonte({}), {}); self.assertEqual(vc._destaques_com_a_fonte({"highlights": None}), {"highlights": None})
        # pontuação que não é ponto final e verbos que já atribuem (achados da revisão: "Pergunta?, segundo X" e "segundo instagram.com" duplicando "se apresenta")
        p = vc._destaques_com_a_fonte({"highlights": [{"text": t, "source": "https://nool.com.br/x"} for t in ("Pergunta?", "Aceita 24h!", "Reticências...", "Com ponto.", "Se apresenta como 24 horas.", "Conforme o cadastro, atende.", "De acordo com o guia, atende.", "A unidade divulga plantão.")]})
        self.assertEqual([h["text"] for h in p["highlights"]], ["Pergunta? (segundo o guia nool)", "Aceita 24h! (segundo o guia nool)", "Reticências... (segundo o guia nool)", "Com ponto, segundo o guia nool.", "Se apresenta como 24 horas.", "Conforme o cadastro, atende.", "De acordo com o guia, atende.", "A unidade divulga plantão."])
        # fonte sem nome conhecido: "o site <endereço>" (e não só o endereço cru, que lia como "segundo instagram.com")
        self.assertEqual(vc.nome_da_fonte("https://www.facebook.com/x/", site=True), "o site facebook.com"); self.assertEqual(vc.nome_da_fonte("https://www.facebook.com/x/"), "facebook.com"); self.assertEqual(vc.nome_da_fonte("https://nool.com.br/x", site=True), "o guia nool")  # v1.4: o Instagram ganhou nome ("o Instagram do negócio", site 10)
        self.assertEqual(vc.nome_da_fonte(None), ""); self.assertEqual(vc.nome_da_fonte("sem endereço", site=True), "")
        # ano do CNPJ
        pesquisa = {"facts": [{"text": "Cadastrada na Receita Federal como X, aberta em 24/09/2019, situação ativa.", "source": "https://www.solutudo.com.br/x"}, {"text": 5, "source": 3}, None, {"text": "aberta em 2001", "source": ""}]}
        about = {"about": ["A X, com CNPJ aberto em 2019, atende.", "Outra, com CNPJ aberto em 2001, atende.", "Com CNPJ aberto em 2019 (segundo o Solutudo), já tem.", None, 3, "Sem ano."]}
        r = vc._cnpj_com_a_fonte(about, pesquisa)["about"]
        self.assertEqual(r[0], "A X, com CNPJ aberto em 2019 (segundo o Solutudo), atende."); self.assertEqual(r[1], "Outra, com CNPJ aberto em 2001, atende.")  # 2001: o fato não tem endereço de fonte
        self.assertEqual(r[2], "Com CNPJ aberto em 2019 (segundo o Solutudo), já tem."); self.assertIsNone(r[3]); self.assertEqual(r[4], 3); self.assertEqual(r[5], "Sem ano.")
        for hostil in (None, {}, {"facts": None}, {"facts": "x"}, {"facts": [None, 3, {"text": None}]}):
            self.assertEqual(vc._cnpj_com_a_fonte(about, hostil)["about"][0], "A X, com CNPJ aberto em 2019, atende.")  # sem fato, o texto não muda (e o README pendencia)
        # o ano tem de ser o da ABERTURA: "aberta em 10/03/2014, situação ativa desde 2020" não sustenta "CNPJ aberto em 2020" (achado da revisão)
        outro = {"facts": [{"text": "Cadastrada na Receita como X, aberta em 10/03/2014, situação ativa desde 2020.", "source": "https://www.solutudo.com.br/x"}]}
        self.assertEqual(vc._cnpj_com_a_fonte({"about": ["Com CNPJ aberto em 2020, atende.", "Com CNPJ aberto em 2014, atende."]}, outro)["about"], ["Com CNPJ aberto em 2020, atende.", "Com CNPJ aberto em 2014 (segundo o Solutudo), atende."])
        self.assertEqual(vc.cnpj_sem_fonte({"content": {"about": ["Com CNPJ aberto em 2020, atende."]}, "research": outro}), ["2020"])
        self.assertEqual(vc._cnpj_com_a_fonte({"about": ["Com CNPJ aberto em 2014, atende."]}, {"facts": [{"text": "aberta em 2014", "source": "https://exemplo.com.br/a"}]})["about"], ["Com CNPJ aberto em 2014 (segundo o site exemplo.com.br), atende."])
        b = {"content": about, "research": {"facts": [pesquisa["facts"][0]]}}
        self.assertEqual(vc.cnpj_sem_fonte(b), ["2001"])
        self.assertEqual(vc.cnpj_sem_fonte({"content": None}), []); self.assertEqual(vc.cnpj_sem_fonte({"content": {"about": None}, "research": None}), [])

    def test_cnpj_sem_fonte_na_pesquisa_vira_pendencia_do_readme_so_com_vitrine(self):
        b = json.loads(json.dumps(model.load_business(SLUG))); b["research"]["facts"] = []
        c = bv.vc.contexto(b, True)
        self.assertIn("CNPJ aberto em 2019, que atende", " ".join(c.about))  # o texto não ganha fonte que a pesquisa não tem
        com_vitrine = bv.pendencias_do_negocio(b, True, c); sem_vitrine = bv.pendencias_do_negocio(b, True, c, vitrine=False)
        self.assertTrue(any('"com CNPJ aberto em 2019"' in p and "não traz fonte" in p for p in com_vitrine))
        self.assertFalse(any("CNPJ" in p for p in sem_vitrine))


def _pendencias_da_pesquisa(b):
    return [p for p in ((b.get("research") or {}).get("pending") or []) if isinstance(p, str)]

class TestSite7DelVet(unittest.TestCase):
    """Site 7 (Del Vet: clínica geral com consulta em domicílio, banho e tosa e farmácia) nos três pacotes. Primeiro site com `registry` (CRMV-SP), número do endereço em disputa,
    celular que só o Petlife lista, telefone fixo, horário de guia a confirmar. Subtipo `geral`."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="vet-build7-"))
        cls.premium = bv.gerar(SLUG7, saida=str(cls.tmp / "premium"))
        cls.basico = bv.gerar(SLUG7, gestao=False, saida=str(cls.tmp / "basico"))
        cls.essencial = bv.gerar(SLUG7, vitrine=False, saida=str(cls.tmp / "essencial"))
        cls.b = model.load_business(SLUG7)
        cls.c = cls.b["content"]
        cls.perfil = bv.carregar_perfil(SLUG7)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    PAGINAS = ("index.html", "sobre.html", "contato.html")

    def ler(self, pasta, rel):
        return (pasta / rel).read_text(encoding="utf-8")

    def arquivos_do_site(self, pasta, sufixos=(".html", ".js", ".css", ".json", ".svg")):
        return [a for a in pasta.rglob("*") if a.is_file() and a.suffix in sufixos]

    def ctx(self, b=None, gestao=True):
        return bv.vc.contexto(b or self.b, gestao, tema=bv.carregar_tema(self.perfil["tema"]), subtipo=bv.aplicar_opcoes(bv.carregar_subtipo(self.perfil["subtipo"]), self.perfil["opcoes"]), perfil=self.perfil)

    # ---- dados e honestidade ----
    def test_conteudo_e_vitrine_passam_nos_validadores_do_projeto(self):
        self.assertEqual(validate.check_content(self.b), [])
        for pasta in (self.premium, self.basico):
            self.assertEqual(validate.check_site(self.b, str(pasta)), [], pasta.name)

    def test_telefone_fixo_nao_vira_botao_nenhum(self):
        self.assertEqual(self.b["whatsapp"]["status"], "landline-unverified")
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            self.assertNotRegex(html, r"wa\.me|wa-flutuante|ligar-flutuante|btn-topo|tel:|Tentar pelo WhatsApp|pode não ter WhatsApp|<form", pagina)
            self.assertIn("(15) 3346-9536", html)  # o número continua na página, como texto
            self.assertIn('<a href="https://andremachado.design" target="_blank" rel="noopener">criado por andremachado.design</a>', html)
        self.assertIn('"whatsapp": ""', self.ler(self.premium, "assets/site-config.js"))
        r = self.ler(self.premium, "README.md")
        self.assertIn("sem celular: só telefone fixo (15) 3346-9536", r); self.assertIn("Botões de contato: nenhum.", r)

    def test_celular_que_so_o_petlife_lista_fica_so_no_readme(self):
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in self.arquivos_do_site(pasta):
                self.assertNotRegex(arq.read_text(encoding="utf-8"), r"99850-?2323|998502323", f"{pasta.name}/{arq.relative_to(pasta)}")
            r = self.ler(pasta, "README.md")
            self.assertIn("(15) 99850-2323", r); self.assertIn("NÃO foi usado em lugar nenhum do pacote", r)
        self.assertEqual(self.ctx().fone_ligar["digits"], "551533469536")
        # com o celular confirmado como WhatsApp na pesquisa, o destaque muda sozinho (a regra é do status, não do site)
        conf = json.loads(json.dumps(self.b)); conf["whatsapp"] = {"digits": "5515998502323", "display": "(15) 99850-2323", "status": "confirmed"}
        self.assertFalse(self.ctx(conf).nao_confirmado)

    def test_internacao_tem_a_mesma_fonte_dos_outros_servicos_e_fica_na_vitrine(self):
        fontes = {s["source"] for s in self.c["services"]}
        self.assertEqual(fontes, {"https://www.portalltb.com.br/empresa.php?url=del-vet-clinica-veterinaria-e-pet-shop-sorocaba-zona-oeste"})
        self.assertEqual(self.perfil["retirar_servicos"], [])
        serv = self.ler(self.premium, "index.html")
        self.assertEqual(serv.count('<article class="servico '), 6); self.assertIn("<h3>Internação</h3>", serv)
        self.assertIn('src="assets/ilustrativas/vet-internacao.webp"', serv)  # v1.0: o card da internação tem a imagem ilustrativa do tipo
        self.assertNotIn("Serviço fora da vitrine", self.ler(self.premium, "README.md"))
        r = self.ler(self.premium, "README.md")
        self.assertIn("Internação e Cirurgias têm a mesma fonte dos demais", r)
        # o primeiro serviço do cadastro NÃO está na lista "Serviços Prestados" do guia (só nas palavras-chave): o README diz, e a vitrine segue com ele
        self.assertEqual(self.c["services"][0]["title"], "Consultas veterinárias"); self.assertIn('"Consultas veterinárias", o primeiro serviço do cadastro, NÃO está nessa lista', r)

    def test_horario_de_guia_sai_com_a_fonte_e_o_readme_diz_que_a_pagina_nao_abriu(self):
        self.assertTrue(bv.vc.horario_a_confirmar(self.b)); self.assertFalse(bv.vc.prazo_tirado_dos_titulos(self.b))  # não há "24 horas": o título não muda
        for pagina in ("index.html", "contato.html"):
            self.assertIn("Das 8h às 22h, segundo o guia Sorocaba Fácil. Confirme os dias de atendimento pelo telefone.", self.ler(self.premium, pagina))
        r = self.ler(self.premium, "README.md")
        self.assertIn("Horário a confirmar: o site mostra o horário com a fonte", r); self.assertIn("respondeu \"não encontrado\"", r)
        self.assertIn("expediente da agenda do painel", self.ler(self.essencial, "README.md"))

    def test_nao_promete_area_de_atendimento_nem_o_que_o_guia_nao_diz(self):
        """A página do guia lista dezenas de bairros e cidades como palavras-chave de busca. Nada disso pode virar promessa de área, de prazo ou de preço."""
        proibido = re.compile(r"(?i)\bzona (norte|sul|leste|oeste)\b|votorantim|mairinque|itu\b|porto feliz|boituva|campolim|raio de|\bkm\b|toda sorocaba|regi[ãa]o de sorocaba|sem custo|gr[áa]tis|taxa|chegamos|buscamos|levamos|"
                               r"pet ?shop|loja|agropet|ra[çc][ãa]o|pre[çc]o|promo[çc]|conv[êe]nio|castra[çc]|orçamento|melhor|refer[êe]ncia|24 ?h|plant[ãa]o|emerg[êe]ncia|urg[êe]ncia")
        for pasta in (self.premium, self.basico):
            for pagina in self.PAGINAS:
                resto = htmllib.unescape(visivel(self.ler(pasta, pagina)))
                self.assertIsNone(proibido.search(resto), f"{pasta.name}/{pagina}: {proibido.search(resto) and proibido.search(resto).group(0)}")
                self.assertNotIn("<img", sem_ilustrativas(self.ler(pasta, pagina)))

    def test_nada_afirmado_alem_do_json_no_site_7(self):
        ctx = self.ctx()
        textos = [ctx.tagline, ctx.lead, ctx.meta, *ctx.about, ctx.endereco, ctx.hours["text"], self.c["hours"]["text"], ctx.registry["value"], ctx.registry["label"], *ctx.form["topic_options"]]
        for chave in ("services", "highlights", "how_to"):
            for item in getattr(ctx, chave):
                textos += [item["title"], item["text"]]
        for pagina in self.PAGINAS:
            resto = htmllib.unescape(visivel(self.ler(self.premium, pagina)))
            for t in sorted(textos, key=len, reverse=True):
                resto = resto.replace(t, " ")
            self.assertNotRegex(resto, r"(?i)\b24\b|plant[ãa]o|emerg[êe]ncia|urg[êe]ncia|interna|leito|\bUTI\b|exame|cirurgi|domic[ií]lio|banho|tosa|farm[áa]cia|medicament|melhor|refer[êe]ncia|premiad|certific|"
                                       r"aberto|desde \d{4}|\b20(0|1|2)\d\b|CRMV|conv[êe]nio|pre[çc]o|promo|pet ?shop|loja|agropet|ra[çc][ãa]o", f"{pagina}: texto sem fonte: {resto[:300]}")

    # ---- registro profissional (primeiro site com `registry`) ----
    def test_crmv_so_com_a_fonte_ao_lado_e_nunca_como_selo(self):
        for pasta in (self.premium, self.basico):
            for pagina in self.PAGINAS:
                html = self.ler(pasta, pagina)
                ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S).group(1))
                self.assertNotRegex(json.dumps(ld, ensure_ascii=False), r"CRMV|31938|Grossi", f"{pasta.name}/{pagina}: o registro não vai para os dados estruturados")
                corpo = re.sub(r"<script.*?</script>", "", html, flags=re.S)
                for tag in ("p", "dd", "li", "span", "article"):
                    for el in re.findall(rf"<{tag}\b[^>]*>(.*?)</{tag}>", corpo, re.S):
                        texto = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", el))
                        if re.search(r"31938", texto):
                            self.assertRegex(texto, r"Portal LTB|Guias da cidade citam", f"{pasta.name}/{pagina}: registro sem a fonte ao lado: {texto[:120]}")
                self.assertNotRegex(html, r"(?i)verificad|certificad|credenciad|aprovad|garantia|reconhecid|selo de|class=\"[^\"]*(selo|crmv|registro)")
            sobre = self.ler(pasta, "sobre.html")
            self.assertIn("<dt>CRMV-SP</dt><dd>31938 (Dra. Gabriella Clavijo Del Grossi), segundo o guia Portal LTB</dd>", sobre)
            self.assertIn("<p>CRMV-SP: 31938 (Dra. Gabriella Clavijo Del Grossi), segundo o guia Portal LTB</p>", sobre)
        for arq in self.arquivos_do_site(self.essencial):  # o painel tem o campo CRMV em Profissionais; o NÚMERO do registro não vai para pacote nenhum sem vitrine
            self.assertNotRegex(arq.read_text(encoding="utf-8"), r"31938", f"ESSENCIAL/{arq.relative_to(self.essencial)}")

    def test_registro_sem_fonte_nao_e_mostrado_e_vira_pendencia(self):
        vc = bv.vc
        self.assertIsNone(vc.registro_com_a_fonte({"label": "CRMV-SP", "value": "31938"})); self.assertIsNone(vc.registro_com_a_fonte({"label": "CRMV-SP", "value": "31938", "source": "sem endereço"}))
        for hostil in (None, 3, "x", [], {}, {"label": None, "value": "1", "source": "https://x.com/"}, {"label": "CRMV", "value": 5, "source": "https://x.com/"}, {"label": " ", "value": "1", "source": "https://x.com/"}):
            self.assertIsNone(vc.registro_com_a_fonte(hostil), repr(hostil))
        self.assertEqual(vc.registro_com_a_fonte({"label": " CRMV-SP ", "value": " 1 ", "source": "https://www.exemplo.com.br/a"})["value"], "1, segundo o site exemplo.com.br")
        sem = json.loads(json.dumps(self.b)); sem["content"]["registry"].pop("source")
        c = self.ctx(sem)
        self.assertIsNone(c.registry)
        html = bv.vc.pagina_sobre(c)
        self.assertNotRegex(re.sub(r"<script.*?</script>", "", html, flags=re.S).split("<footer")[1], r"31938")  # nem na ficha nem no rodapé
        itens = bv.pendencias_do_negocio(sem, True, c)
        self.assertTrue(any("Registro profissional fora do site" in p and "sem endereço de fonte" in p for p in itens)); self.assertFalse(any("Registro profissional mostrado no site" in p for p in itens))
        ok = bv.pendencias_do_negocio(self.b, True, self.ctx())
        self.assertTrue(any("Registro profissional mostrado no site" in p and "não foi conferido no CRMV-SP" in p for p in ok))
        r = self.ler(self.premium, "README.md")
        self.assertIn("Registro profissional mostrado no site", r); self.assertIn("o site não diz que ela é a responsável técnica", r)
        self.assertNotIn("Registro profissional mostrado", self.ler(self.essencial, "README.md"))

    # ---- número do endereço em disputa ----
    def test_numero_do_endereco_em_disputa_sai_do_site_inteiro_e_vai_para_a_pendencia(self):
        self.assertTrue(bv.vc.numero_a_confirmar(self.b)); self.assertEqual(bv.vc.numeros_em_disputa(self.b), ["227", "245"])
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in self.arquivos_do_site(pasta, (".html", ".js", ".json", ".svg")):
                txt = arq.read_text(encoding="utf-8")
                self.assertNotRegex(txt, r"Queiroz[^<\"]{0,6}(245|227)\b|%2C%20(245|227)\b|18061-?(240|190)", f"{pasta.name}/{arq.relative_to(pasta)}")
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S).group(1))["address"]
            self.assertEqual(ld["streetAddress"], "Av. Percito de Sousa Queiroz"); self.assertNotIn("postalCode", ld); self.assertEqual(ld["addressLocality"], "Sorocaba")
            self.assertIn("Av. Percito de Sousa Queiroz - Vila Barao – Sorocaba</", html)
        # a copy livre do JSON também sai sem o número, sem perder a rua, o bairro nem a cidade
        sobre = htmllib.unescape(self.ler(self.premium, "sobre.html"))
        self.assertIn("A Del Vet atende na Av. Percito de Sousa Queiroz, na Vila Barão, em Sorocaba.", sobre)
        self.assertIn("Av. Percito de Sousa Queiroz, Vila Barão, em Sorocaba.", self.ler(self.premium, "index.html"))
        self.assertNotRegex(htmllib.unescape(self.ler(self.premium, "index.html")), r'content="[^"]*Queiroz, 245')
        # o mapa busca pelo NOME (o pino do negócio) e o "Como chegar" é o link do Perfil do Google; nenhum dos dois leva o número
        contato = self.ler(self.premium, "contato.html")
        self.assertIn("https://www.google.com/maps?q=Del%20Vet%2C%20Av.%20Percito%20de%20Sousa%20Queiroz%20-%20Vila%20Barao%2C%20Sorocaba&amp;output=embed", contato)
        self.assertRegex(contato, r'href="https://www\.google\.com/maps/place/\?q=place_id:[^"]+" target="_blank"')
        cfg = self.ler(self.premium, "assets/site-config.js")
        self.assertIn('"endereco": "Av. Percito de Sousa Queiroz - Vila Barao – Sorocaba"', cfg)
        r = self.ler(self.premium, "README.md")
        self.assertIn("Número do endereço fora do site: as fontes divergem (227 e 245)", r); 
        self.assertIn("Em Configurações do painel o endereço da clínica também vem sem número", r)
        self.assertIn("Número do endereço fora do cadastro: as fontes divergem (227 e 245)", self.ler(self.essencial, "README.md"))
        self.assertNotIn("painel", self.ler(self.basico, "README.md").lower())

    def test_numero_em_disputa_a_pesquisa_em_disco_nao_muda_e_a_regra_se_desfaz_sozinha(self):
        antes = json.dumps(self.b, sort_keys=True); self.ctx(); self.assertEqual(json.dumps(self.b, sort_keys=True), antes)
        self.assertTrue(any("número do endereço diverge" in p for p in model.load_business(SLUG7)["research"]["pending"]))
        # pendência retirada ou resolvida ("mantido"): o endereço e os textos voltam como estão no cadastro
        for nova in ([p for p in self.b["research"]["pending"] if "número do endereço" not in p], [p.replace("; confirmar.", "; mantido 245.") for p in self.b["research"]["pending"]]):
            b = json.loads(json.dumps(self.b)); b["research"]["pending"] = nova
            self.assertFalse(bv.vc.numero_a_confirmar(b)); c = self.ctx(b)
            self.assertEqual(c.endereco, self.b["address"]); self.assertIn("Queiroz, 245, na Vila Barão", " ".join(c.about))
            self.assertIn("245", c.maps_src); self.assertNotIn("Del%20Vet%2C", c.maps_src)
        # os outros seis sites não têm a pendência: nada muda neles
        for slug in (SLUG, SLUG2, SLUG3, SLUG4, SLUG5, SLUG6):
            b = model.load_business(slug); self.assertFalse(bv.vc.numero_a_confirmar(b), slug); self.assertEqual(bv.vc.numeros_em_disputa(b), [], slug)

    def test_numero_em_disputa_com_entrada_hostil_e_formato_nao_reconhecido(self):
        vc = bv.vc
        # a frase tem de falar do "número do endereço": telefone, rua ou bairro que divergem não ligam a regra (falso positivo achado na revisão)
        for pend in (None, "x", [None, 3, {}], ["O número do telefone diverge"], ["Endereço diverge entre fontes: Av. Santos Dumont, 100"], ["O número do endereço diverge: 1 e 2; mantido o 1."],
                     ["O telefone diverge entre guias: o número do guia A não é o do endereço do guia B"], ["Anúmero do endereço diverge: 1 e 2"], ["O número do endereço foi confirmado: 245"], ["O número do endereço mantido: 245"]):
            self.assertFalse(vc.numero_a_confirmar({"research": {"pending": pend}}), repr(pend))
        for pend in ("O número do endereço diverge: 227 em guias, 245 no CSV; confirmar.", "O nº do endereço diverge: 227 e 245", "Endereço: número diverge (227 ou 245)"):
            self.assertTrue(vc.numero_a_confirmar({"research": {"pending": [pend]}}), pend)
        # "mantido" em OUTRA frase da mesma pendência não desliga a regra (a primeira versão publicava o número em disputa); só vale depois de "diverge"
        self.assertTrue(vc.numero_a_confirmar({"research": {"pending": ["O horário foi mantido. O número do endereço diverge: 227 e 245; confirmar."]}}))
        self.assertFalse(vc.numero_a_confirmar({}) or vc.numero_a_confirmar({"research": None})); self.assertEqual(vc.numeros_em_disputa({}), [])
        # os números: só os que vêm DEPOIS de "diverge" e antes do ";", sem data nem ano; mais o do cadastro
        b = {"address": "Av. X, 245 - Vila – Sorocaba, 18061-240", "research": {"pending": ["Segundo 2 guias o número do endereço diverge: 227 em guias (CEP 18061-190, conferido em 22/10/2026, guia de 2026), 245 no CSV; confirmar 10 vezes."]}}
        self.assertEqual(vc.numeros_em_disputa(b), ["227", "245"])
        b["address"] = "Av. X - Vila – Sorocaba"; self.assertEqual(vc.numeros_em_disputa(b), ["227", "245"])  # sem número no cadastro: ficam os da pendência
        b["research"]["pending"] = ["O número do endereço diverge: 227 em guias"]; b["address"] = "Av. X, 245 - Vila – Sorocaba"
        self.assertEqual(vc.numeros_em_disputa(b), ["227", "245"], "o número do cadastro entra mesmo que a pendência cite só o outro")
        self.assertEqual(vc.rua_do_endereco("Av. Percito de Sousa Queiroz, 245 - Vila Barao – Sorocaba, 18061-240"), "Av. Percito de Sousa Queiroz"); self.assertEqual(vc.rua_do_endereco("Rua A - Centro"), ""); self.assertEqual(vc.rua_do_endereco(None), "")
        # a troca no endereço: o número inteiro, nunca "245-B" nem "2450"; "nº" também sai; o CEP sai junto
        self.assertEqual(vc.endereco_sem_numero("Rua A, 10 - Centro – Sorocaba, 18000-000", ["10"]), "Rua A - Centro – Sorocaba")
        self.assertEqual(vc.endereco_sem_numero("Rua A, nº 10 - Centro – Sorocaba", ["10"]), "Rua A - Centro – Sorocaba")
        self.assertEqual(vc.endereco_sem_numero("Rua A, 100 - Centro – Sorocaba", ["10"]), "Rua A, 100 - Centro – Sorocaba")
        self.assertEqual(vc.endereco_sem_numero("Rua A, 245-B - Centro – Sorocaba", ["245"]), "Rua A, 245-B - Centro – Sorocaba")  # (a conferência para o gerador)
        self.assertEqual(vc.endereco_sem_numero("Rua 7, 245 - Centro – Sorocaba", ["245"]), "Rua 7, 245 - Centro – Sorocaba")  # depois de dígito não é "rua, número": a conferência para o gerador
        self.assertEqual(vc.endereco_sem_numero("Rua A, 10 - Centro – Sorocaba", None), "Rua A, 10 - Centro – Sorocaba"); self.assertEqual(vc.endereco_sem_numero("", ["1"]), "")
        # a troca no texto livre: só depois do NOME DA RUA do cadastro; "Sorocaba, 22 anos", telefone e nota nunca mudam, nem quando o número em disputa coincide com eles
        rua = "Av. Percito de Sousa Queiroz"
        self.assertEqual(vc._texto_sem_numero("Na Av. Percito de Sousa Queiroz, 245, na Vila. Em Sorocaba, 22 anos, (15) 3346-9536, nota 4,7 com 22 avaliações.", ["22", "245"], rua),
                         "Na Av. Percito de Sousa Queiroz, na Vila. Em Sorocaba, 22 anos, (15) 3346-9536, nota 4,7 com 22 avaliações.")
        self.assertEqual(vc._texto_sem_numero("Av. Percito de Sousa Queiroz, 245-B", ["245"], rua), "Av. Percito de Sousa Queiroz, 245-B")
        self.assertEqual(vc._texto_sem_numero("Av. Percito de Sousa Queiroz, nº 245, Vila", ["245"], rua), "Av. Percito de Sousa Queiroz, Vila")
        self.assertEqual(vc._texto_sem_numero("Av. Percito de Sousa Queiroz, 245", ["245"], ""), "Av. Percito de Sousa Queiroz, 245"); self.assertIsNone(vc._texto_sem_numero(None, ["1"], rua)); self.assertEqual(vc._texto_sem_numero(5, ["1"], rua), 5)
        # a CONFERÊNCIA é mais larga que a troca e passa por contexto(): formato que a troca não reconhece PARA o gerador (a primeira versão deixava publicar o 245 de "Rua X 245", de "Rua 7, 245" e de "245-B")
        base = json.loads(json.dumps(self.b)); base["content"]["about"] = ["A Del Vet atende na Av. Percito de Sousa Queiroz, 245, na Vila Barão."]
        for endereco in ("Av. Percito de Sousa Queiroz 245 - Vila Barao – Sorocaba, 18061-240", "Av. Percito de Sousa Queiroz, 245-B - Vila Barao – Sorocaba, 18061-240", "Rua 7, 245 - Vila Barao – Sorocaba, 18061-240",
                         "Av. Percito de Sousa Queiroz - Quadra 245 – Sorocaba"):
            ruim = json.loads(json.dumps(base)); ruim["address"] = endereco; ruim["maps_query"] = endereco
            with self.assertRaises(SystemExit, msg=endereco) as e: bv.vc.contexto(ruim, True)
            self.assertIn("número do endereço em disputa (245) ainda aparece em", str(e.exception))
        ok_ = json.loads(json.dumps(base)); ok_["address"] = "Av. Percito de Sousa Queiroz, nº 245 - Vila Barao – Sorocaba, 18061-240"; ok_["maps_query"] = ok_["address"]
        c = bv.vc.contexto(ok_, True); self.assertEqual(c.endereco, "Av. Percito de Sousa Queiroz - Vila Barao – Sorocaba"); self.assertNotIn("245", " ".join(c.about) + c.maps_src)
        texto_com_outra_grafia = json.loads(json.dumps(base)); texto_com_outra_grafia["content"]["about"] = ["Atendemos na Rua Percito de Souza Queiroz, 245, na Vila Barão."]
        with self.assertRaises(SystemExit) as e: bv.vc.contexto(texto_com_outra_grafia, True)  # a rua do texto não é a do cadastro: a troca não vê, a conferência sim
        self.assertIn("about[0]", str(e.exception))
        with self.assertRaises(SystemExit) as e: bv.vc.conferir_numero_fora({"about": ["Atendemos na Rua X, 245."]}, ["245"], "Rua X - Bairro – Sorocaba")
        self.assertIn("ainda aparece em: about[0]", str(e.exception))
        with self.assertRaises(SystemExit) as e: bv.vc.conferir_numero_fora({}, ["245"], "Rua X, 245 - Bairro – Sorocaba", "Rua X, 245 - Bairro, Sorocaba")
        self.assertIn("endereço, consulta do mapa", str(e.exception))
        bv.vc.conferir_numero_fora({"about": ["Rua X, 2450", "Tel (15) 3346-9536", "nota 4,7 com 245 avaliações", "desde 2.245"], "hours": None}, ["245"], "Rua X - Bairro – Sorocaba", "Rua X - Bairro, Sorocaba")  # outros números não contam
        bv.vc.conferir_numero_fora({}, ["245"], "Rua X, 2450 - Bairro – Sorocaba", "Rua X, 12450 - Bairro, Sorocaba")  # dígito colado não é o número em disputa

    # ---- README e pacotes ----
    def test_readme_dos_tres_pacotes(self):
        base = [*self.b["research"]["pending"], "Registro profissional mostrado no site", "Horário a confirmar: o site mostra o horário com a fonte", "Número do endereço fora do site", "sem celular: só telefone fixo (15) 3346-9536", "fotos reais do negócio"]
        for pasta in (self.premium, self.basico, self.essencial):
            r = self.ler(pasta, "README.md")
            self.assertIn("## Pendências a confirmar com o negócio antes de publicar", r, pasta.name)
            for p in base:
                confere_pendencia(self, pasta is self.essencial, p, r, pasta.name)
            self.assertIn("Os serviços vêm de uma única página de divulgação", r); self.assertIn("A lista de bairros e cidades da mesma página é texto de busca", r)
            self.assertIn("rotulado \"WhatsApp\"", r); self.assertIn("https://pt-br.facebook.com/delvetveterinaria/", r)  # o Beneficiar também lista o celular, como WhatsApp, e cita um Facebook que a pesquisa não tem
            self.assertNotRegex(r, r"(?i)skill|\.claude|claude|\bIA\b|agente|automa", pasta.name)
        for pasta in (self.premium, self.essencial):
            r = self.ler(pasta, "README.md")
            self.assertIn("O painel deste pacote é o da clínica geral", r); self.assertIn("NÃO tem tela de internação", r)
        self.assertNotIn("painel", self.ler(self.basico, "README.md").lower()); self.assertNotIn("painel", self.ler(self.basico, "assets/site-config.js").lower())
        r = self.ler(self.premium, "README.md")
        self.assertIn(f"build_vet_site.py {SLUG7} --sem-gestao", r); self.assertIn(f"build_vet_site.py {SLUG7} --sem-vitrine", r); self.assertIn("gestao: true", r)
        self.assertEqual(sorted(p.name for p in self.essencial.iterdir()), ["README.md", "assets", "index.html", "painel"])
        self.assertFalse((self.basico / "painel").exists())

    def test_subtipo_geral_nao_acrescenta_nada_ao_painel(self):
        for pasta in (self.premium, self.essencial):
            cfg = self.ler(pasta, "assets/site-config.js")
            painel = re.search(r"^  painel: (\{.*\})$", cfg, re.M)
            if painel:  # só a marca do tema, se o tema tiver uma
                self.assertEqual(set(json.loads(painel.group(1))), {"marca"})
            self.assertFalse((pasta / "painel/js/modulos/internacao.js").exists()); self.assertFalse((pasta / "painel/js/modulos/exames.js").exists())

    def test_nenhuma_palavra_de_bastidor_nos_arquivos_do_cliente(self):
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in pasta.rglob("*"):
                if arq.is_file() and arq.suffix in {".html", ".js", ".css", ".md", ".svg"}:
                    achado = PROIBIDOS_CLIENTE.search(arq.read_text(encoding="utf-8"))
                    self.assertIsNone(achado, f"{pasta.name}/{arq.relative_to(pasta)}: {achado and achado.group(0)}")

    # ---- identidade: o tema letreiro e o hero ----
    def test_perfil_aplica_tema_letreiro_e_subtipo_geral(self):
        self.assertEqual((self.perfil["subtipo"], self.perfil["tema"], self.perfil["opcoes"], self.perfil["retirar_servicos"], self.perfil["pesquisa_pendente"]), ("geral", "letreiro", [], [], []))
        idx = self.ler(self.premium, "index.html")
        for simbolo in ("letreiro", "pata", "fone", "pino", "relogio"):
            self.assertIn(f"<symbol id='{simbolo}'", idx)
        for ausente in ("dupla", "mira", "escala", "cruz", "pena", "escama", "etiqueta", "seta"):
            self.assertNotIn(f"<symbol id='{ausente}'", idx)
        css = self.ler(self.premium, "assets/style.css")
        self.assertIn("tema letreiro", css); self.assertIn("letreiro", self.ler(self.premium, "painel/painel.css"))
        self.assertIn("#ffcfd9", self.ler(self.premium, "assets/favicon.svg"))
        self.assertNotRegex(css, r"\.carimbo[^{]*\{[^}]*clip-path"); self.assertNotRegex(css, r"@import|url\(\s*[\"']?https?:"); self.assertIn("prefers-reduced-motion", css)
        self.assertEqual(re.findall(r"animation: ([a-z-]+) ", css.split("tema letreiro")[1]), ["lt-pintar"])  # uma única animação de entrada
        self.assertNotRegex(css.split("tema letreiro")[1], r"box-shadow: *\d")
        self.assertEqual(bv.carregar_tema("letreiro")["hero"], "letreiro"); self.assertIn("letreiro", bv.vc.HEROIS)
        self.assertIn("letreiro:", self.ler(self.premium, "painel/js/ui.js"))  # o ícone da marca no painel
        self.assertIn('"marca": "letreiro"', self.ler(self.premium, "assets/site-config.js"))

    def test_hero_letreiro_o_telefone_e_a_faixa_e_a_ordem_do_dom_e_a_ordem_visual(self):
        idx = self.ler(self.premium, "index.html")
        ini = idx.index('<section class="hero hero--letreiro">'); hero = idx[ini:idx.index("</section>", ini)]
        # v1.0: o telefone continua sendo o letreiro, como TEXTO (sem tel:); as linhas levam aos serviços e ao endereço no fim da página
        self.assertRegex(hero, r'<div class="lt-fone" data-toque="numero">.*?Telefone</span><span class="lt-numero"><span class="lt-grupo">\(15\)</span> <span class="lt-grupo">3346-9536</span>')
        self.assertIn('data-toque="servicos" href="#servicos"', hero); self.assertIn('data-toque="onde" href="#localizacao"', hero)
        self.assertNotRegex(hero, r"tel:|wa\.me|Tentar pelo WhatsApp"); self.assertEqual(hero.count("<h1>"), 1); self.assertLess(idx.index("hero--letreiro"), idx.index('id="servicos"'))
        self.assertNotIn('class="btn', hero)  # a faixa e as linhas SÃO o hero
        # uma coluna: o DOM segue a ordem em que se lê (título, telefone, serviços, onde fica, horário, apresentação, nota), no celular e no desktop
        ordem = [hero.index(x) for x in ("<h1>", 'data-toque="numero"', 'data-toque="servicos"', 'data-toque="onde"', "lt-linha--horario", 'class="destaque lt-lead"', "carimbo")]
        self.assertEqual(ordem, sorted(ordem))
        classes = {c for g in re.findall(r'class="([^"]+)"', hero) for c in g.split()}
        self.assertEqual({c for c in classes if not c.startswith("lt-")}, {"hero", "hero--letreiro", "container", "destaque", "carimbo"})
        self.assertFalse(classes & {"nota", "placa", "chapa", "anotacao", "viveiro", "ficha", "gd-etq", "dp-bloco"})
        self.assertIn("Das 8h às 22h, segundo o guia Sorocaba Fácil.", hero)

    def test_hero_letreiro_escapa_texto_de_dado_e_nao_inventa_o_que_nao_ha(self):
        b = json.loads(json.dumps(self.b)); b["address"] = '<script>alert(1)</script> & "x" - Bairro – Sorocaba'; b["content"]["hours"] = {"text": "<img src=x onerror=1> Das 9h.", "source": "https://www.sorocabafacil.com.br/x"}
        b["content"]["tagline"] = "<b>negrito</b> Clínica"; b["phones"][0]["display"] = "(15) <i>3346</i>-9536"; b["research"]["pending"] = []; b["content"]["lead"] = "<u>lead</u> & mais"
        h = bv.vc.hero_letreiro(self.ctx(b))
        self.assertNotRegex(h, r"<script|<img|<b>negrito|<i>|<u>")
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;", h); self.assertIn("(15) &lt;i&gt;3346&lt;/i&gt;-9536", h.replace('<span class="lt-grupo">', "").replace("</span>", ""))
        self.assertIn("&lt;u&gt;lead&lt;/u&gt; &amp; mais", h)
        self.assertEqual(bv.vc.linha_letreiro("pino", "rota", "<i>T</i>", "<b>x</b>", "https://a/?q=1&r=2", True), '<li><a class="lt-linha lt-linha--rota" data-toque="rota" href="https://a/?q=1&amp;r=2" target="_blank" rel="noopener"><span class="lt-rotulo"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#pino"/></svg><b>&lt;i&gt;T&lt;/i&gt;</b></span><span class="lt-valor">&lt;b&gt;x&lt;/b&gt;</span></a></li>')
        sem = json.loads(json.dumps(self.b)); sem["whatsapp"] = {"digits": None, "display": None, "status": "none"}; sem["wa_contact"] = None; sem["phones"] = []; sem["google"] = None; sem["content"]["hours"] = None
        h = bv.vc.hero_letreiro(self.ctx(sem))
        for ausente in ("lt-faixa", "lt-fone", "lt-linha--horario", "carimbo", "wa.me", "tel:", "lt-pe"):
            self.assertNotIn(ausente, h, ausente)
        self.assertIn("lt-linha--onde", h)
        self.assertEqual(bv.vc._numero_em_grupos("(15) 3346-9536"), '<span class="lt-grupo">(15)</span> <span class="lt-grupo">3346-9536</span>')
        self.assertEqual(bv.vc._numero_em_grupos("3346-9536"), '<span class="lt-grupo">3346-9536</span>'); self.assertEqual(bv.vc._numero_em_grupos("<x>"), '<span class="lt-grupo">&lt;x&gt;</span>')

    def test_hero_letreiro_com_numero_de_conversa_a_faixa_mostra_o_whatsapp_como_texto(self):
        """v1.0: com número de conversa a faixa do letreiro diz "WhatsApp" e mostra o número, mas é texto: os botões de WhatsApp são só o do topo e o flutuante."""
        conf = json.loads(json.dumps(self.b)); conf["whatsapp"]["status"] = "confirmed"; conf["wa_contact"] = {"digits": conf["whatsapp"]["digits"], "display": conf["whatsapp"]["display"]}
        c = self.ctx(conf); self.assertFalse(c.nao_confirmado); self.assertTrue(c.tem_wa)
        h = bv.vc.hero_letreiro(c)
        self.assertIn('<div class="lt-fone lt-fone--wa" data-toque="numero">', h); self.assertIn("WhatsApp</span>", h)
        self.assertNotRegex(h, r"wa\.me|tel:|Tentar pelo WhatsApp|pode não ter WhatsApp|lt-linha--fone")

    def test_tema_letreiro_nao_repete_as_paletas_anteriores_nem_as_formulas_de_ia(self):
        t = bv.carregar_tema("letreiro")["tokens"]
        for outro in ("caderneta", "terrario", "sinalizacao", "chapa", "gondola", "dupla"):
            o = bv.carregar_tema(outro)["tokens"]
            for papel in ("folha", "musgo", "carimbo", "papel", "fonte-titulo"):
                self.assertNotEqual(t[papel].lower(), o[papel].lower(), f"{outro}/{papel}")
        self.assertNotRegex(json.dumps(t), r"(?i)terracota|#c1440e|#0f0f0f|#000000|neon")
        def matiz(h):
            r, g, b = (int(h.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)); mx, mn = max(r, g, b), min(r, g, b)
            if mx == mn: return 0
            d = mx - mn; m = ((g - b) / d) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
            return m * 60
        # o subtipo `geral` é o da caderneta (site 1): nem a ação nem o acento podem parecer os dela (verde-azulado e amarelo); e nenhuma ação repete o matiz de outro tema por menos de 25 graus
        cad = bv.carregar_tema("caderneta")["tokens"]
        for papel in ("musgo", "carimbo", "folha"):
            dist = abs(matiz(t[papel]) - matiz(cad[papel])); self.assertGreater(min(dist, 360 - dist), 25, papel)
        for outro in ("terrario", "sinalizacao", "chapa", "gondola", "dupla"):
            o = bv.carregar_tema(outro)["tokens"]; dist = abs(matiz(t["musgo"]) - matiz(o["musgo"])); self.assertGreater(min(dist, 360 - dist), 25, f"ação x {outro}")
        for arq in ("letreiro.vitrine.css", "letreiro.painel.css"):
            css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / arq).read_text(encoding="utf-8"), flags=re.S)
            self.assertNotRegex(css, r"text-transform: *uppercase|font-family:[^;]*mono|ui-monospace", arq)
            self.assertNotRegex(css, r"(?<![\w-])\.(nota|placa|chapa|anotacao)(?![\w-])", arq)
            self.assertNotRegex(css, r"(?i)\b(urgente|urgência|emergência|aberto agora|24 ?h)\b", arq)  # nenhum selo nem texto de funcionamento por enfeite
        css = re.sub(r"/\*.*?\*/", "", "".join((SKILL / "temas" / a).read_text(encoding="utf-8") for a in ("letreiro.vitrine.css", "letreiro.painel.css")), flags=re.S)
        for seletor, corpo in re.findall(r"([^{}]+)\{([^}]*gradient\([^}]*)\}", css):  # todo gradiente que carrega texto tem cor SÓLIDA por baixo
            decl = re.search(r"background:([^;]+);", corpo)
            self.assertIsNotNone(decl, seletor); self.assertRegex(decl.group(1).strip(), r"(#[0-9a-fA-F]{3,8}|var\(--[a-z-]+\))$", f"{seletor.strip()}: gradiente sem cor sólida por baixo")
        # todo elemento colorido por `background:` na faixa leva cor sólida (o teste de contraste mede contra background-color)
        self.assertIn("background-color: var(--musgo)", css)

    def test_toda_marca_de_tema_tem_o_icone_no_painel_e_o_simbolo_na_vitrine(self):
        """Um tema novo sem o ícone da marca em painel/js/ui.js cairia em silêncio na pata (o painel de um site com identidade própria mostraria a marca do site 1)."""
        ui = (SKILL / "painel" / "js" / "ui.js").read_text(encoding="utf-8")
        icones = set(re.findall(r"^    ([a-z]+): '", ui, re.M))
        for arq in sorted((SKILL / "temas").glob("*.json")):
            tema = json.loads(arq.read_text(encoding="utf-8")); marca = tema["ornamento"]["marca"]
            self.assertIn(marca, icones, f"tema {tema['nome']}: sem ícone '{marca}' em painel/js/ui.js")
            self.assertIn(marca, bv.vc.SIMBOLOS, f"tema {tema['nome']}: sem símbolo '{marca}' na vitrine")
            self.assertIn(marca, tema["ornamento"]["sprite"], f"tema {tema['nome']}: a marca não está no sprite")

    def test_regerar_por_cima_nao_perde_o_material_do_cliente(self):
        d = self.tmp / "material7"
        bv.gerar(SLUG7, saida=str(d))
        mat = d / "assets" / "material.js"
        mat.write_text(mat.read_text(encoding="utf-8").replace("galeria = [];", 'galeria = [{src: "assets/img/fachada.jpg", alt: "Fachada"}];'), encoding="utf-8")
        for kwargs in ({"vitrine": False}, {"gestao": False}, {}):
            bv.gerar(SLUG7, saida=str(d), **kwargs)
        self.assertIn("Fachada", mat.read_text(encoding="utf-8"))


class TestSite8AnimalInc(unittest.TestCase):
    """Site 8 (Animal Inc: clínica do Centro, um serviço, celular só listado, endereço firme, horário que diverge entre diretórios) nos três pacotes. Subtipo `geral`, tema `numero`."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="vet-build8-"))
        cls.premium = bv.gerar(SLUG8, saida=str(cls.tmp / "premium"))
        cls.basico = bv.gerar(SLUG8, gestao=False, saida=str(cls.tmp / "basico"))
        cls.essencial = bv.gerar(SLUG8, vitrine=False, saida=str(cls.tmp / "essencial"))
        cls.b = model.load_business(SLUG8)
        cls.c = cls.b["content"]
        cls.perfil = bv.carregar_perfil(SLUG8)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    PAGINAS = ("index.html", "sobre.html", "contato.html")

    def ler(self, pasta, rel):
        return (pasta / rel).read_text(encoding="utf-8")

    def arquivos_do_site(self, pasta, sufixos=(".html", ".js", ".css", ".json", ".svg")):
        return [a for a in pasta.rglob("*") if a.is_file() and a.suffix in sufixos]

    def ctx(self, b=None, gestao=True):
        return bv.vc.contexto(b or self.b, gestao, tema=bv.carregar_tema(self.perfil["tema"]), subtipo=bv.aplicar_opcoes(bv.carregar_subtipo(self.perfil["subtipo"]), self.perfil["opcoes"]), perfil=self.perfil)

    def hero(self, b=None):
        h = bv.vc.hero_numero(self.ctx(b))
        return h

    # ---- dados e honestidade ----
    def test_conteudo_e_vitrine_passam_nos_validadores_do_projeto(self):
        self.assertEqual(validate.check_content(self.b), [])
        for pasta in (self.premium, self.basico):
            self.assertEqual(validate.check_site(self.b, str(pasta)), [], pasta.name)

    def test_celular_listado_vira_o_botao_de_whatsapp(self):
        """v1.1 (PEDIDO_DESIGN_3, item F): sem Ligar; o celular listado é o número do único botão de WhatsApp (o flutuante, redondo, só o ícone)."""
        self.assertEqual(self.b["whatsapp"]["status"], "mobile-listed")
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            um_whatsapp_so_icone(self, html, "5515998507950", pagina)
            self.assertRegex(html, r'class="wa-flutuante" href="https://wa\.me/5515998507950[^"]*"[^>]*aria-label="Conversar no WhatsApp"')
            self.assertNotRegex(html, r"ligar-flutuante|tel:|Tentar pelo WhatsApp|pode não ter WhatsApp|Em caso de urgência", pagina)

    def test_telefone_que_so_a_receita_lista_fica_so_no_readme(self):
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in self.arquivos_do_site(pasta):
                self.assertNotRegex(arq.read_text(encoding="utf-8"), r"98818[\s\u00a0.-]?2202|988182202", f"{pasta.name}/{arq.relative_to(pasta)}")  # com espaço, ponto ou hífen
            self.assertIn("(15) 98818-2202", self.ler(pasta, "README.md"))
        self.assertEqual(self.ctx().fone_ligar["digits"], "5515998507950")
        conf = json.loads(json.dumps(self.b)); conf["whatsapp"]["status"] = "confirmed"
        self.assertFalse(self.ctx(conf).nao_confirmado)

    def test_horario_que_diverge_entre_diretorios_sai_com_a_fonte(self):
        """Dívida do site 8: a pesquisa diz "Horário diverge entre diretórios; usado o do Sorocaba Fácil" (sem a palavra "confirmar") e o horário saía sem dizer de onde veio."""
        self.assertTrue(bv.vc.horario_a_confirmar(self.b))
        for pagina in ("index.html", "contato.html"):
            self.assertIn("Das 9h às 19h, segundo o guia Sorocaba Fácil. Confirme os dias de atendimento pelo WhatsApp.", self.ler(self.premium, pagina))
        for pagina in self.PAGINAS:
            self.assertNotRegex(self.ler(self.premium, pagina), r"Das 9h às 19h\.")  # nenhum lugar com o horário sem a fonte
        self.assertIn("Horário a confirmar: o site mostra o horário com a fonte", self.ler(self.premium, "README.md"))
        self.assertIn("expediente da agenda do painel", self.ler(self.essencial, "README.md"))

    def test_regra_do_horario_a_confirmar_so_liga_com_horario_e_confirmar_ou_divergir(self):
        def b(*pend):
            x = json.loads(json.dumps(self.b)); x["research"]["pending"] = list(pend); return x
        h = bv.vc.horario_a_confirmar
        self.assertTrue(h(b("Horário diverge entre diretórios; usado o do Sorocaba Fácil.")))
        self.assertTrue(h(b("O horário diverge: 9h às 17h em um guia e 8h às 12h em outro.")))
        self.assertTrue(h(b("Confirmar o horário com o negócio.")))
        self.assertFalse(h(b("Telefone diverge entre diretórios.")))  # diverge, mas não é o horário
        self.assertFalse(h(b("O endereço diverge: Rua Monteiro Lobato, 273, Vila Hortência.")))  # "hor" no meio de "Hortência" não conta
        self.assertFalse(h(b("Diretórios listam outro endereço; mantido o do CSV.")))
        self.assertFalse(h(b()))
        for estranho in (None, "texto", 5, {"a": 1}):
            x = json.loads(json.dumps(self.b)); x["research"]["pending"] = estranho; self.assertFalse(h(x))
        # negação e entrada estranha (achados da revisão): "não diverge" não pede confirmação; pesquisa que não é objeto não derruba
        self.assertFalse(h(b("O horário não diverge entre as fontes."))); self.assertFalse(h(b("O horário nunca diverge.")))
        self.assertTrue(h(b("Horário diverge entre diretórios; usado o do Sorocaba Fácil.")))  # "usado o do guia" não é decisão que encerre a divergência: segue com a fonte
        for ruim in (None, "x", [], 5):
            x = json.loads(json.dumps(self.b)); x["research"] = ruim; self.assertFalse(h(x)); self.assertEqual(bv.vc.numeros_em_disputa(x), [])
        self.assertFalse(h(None)); self.assertEqual(bv.vc.numeros_em_disputa(None), [])
        # os 22 negócios de veterinária: a regra nova só mudou o que o site 8 precisava (o resultado dos outros 21 é o da regra antiga, CONGELADA aqui: o regex vivo mudaria junto com o código)
        ANTIGA = re.compile(r"(?i)\bhor[áa]rio|\bhoras?\b|\b24\s?h\b|\d\s?h\b|expediente|funcionamento")
        antiga = lambda x: any(isinstance(p, str) and "confirm" in p.lower() and ANTIGA.search(p) for p in (((x.get("research") or {}).get("pending")) or []))
        mudou = [s for s in (model.load_business(f.stem) for f in sorted((model.ROOT / "data" / "content" / "pet-veterinaria").glob("*.json")))
                 for s in [s["slug"]] if bv.vc.horario_a_confirmar(model.load_business(s)) != antiga(model.load_business(s))]
        self.assertEqual(mudou, [SLUG8])

    def test_endereco_firme_aparece_inteiro_e_o_outro_endereco_dos_diretorios_nao_entra(self):
        self.assertEqual(bv.vc.numeros_em_disputa(self.b), []); self.assertFalse(bv.vc.cep_a_confirmar(self.b))  # "mantido o do CSV, que bate com a Receita": decisão tomada
        for pagina in self.PAGINAS:
            self.assertIn("341", self.ler(self.premium, pagina))
        self.assertIn("18035-085", self.ler(self.premium, "contato.html"))
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in self.arquivos_do_site(pasta):
                self.assertNotRegex(arq.read_text(encoding="utf-8"), r"Monteiro Lobato|Prestes de Barros|(?<![\w.#-])273(?![\w.%-])", f"{pasta.name}/{arq.relative_to(pasta)}")  # o outro endereço, inclusive só o número
            self.assertIn("Rua Monteiro Lobato, 273", self.ler(pasta, "README.md"))
        ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', self.ler(self.premium, "index.html"), re.S).group(1))
        self.assertEqual(ld["address"]["streetAddress"], "R. Rodrigues Pacheco, 341"); self.assertEqual(ld["address"]["postalCode"], "18035-085")

    def test_nada_afirmado_alem_do_json_no_site_8(self):
        ctx = self.ctx()
        textos = [ctx.tagline, ctx.lead, ctx.meta, *ctx.about, ctx.endereco, ctx.hours["text"], self.c["hours"]["text"], *ctx.form["topic_options"], bv.vc.cnpj_ativo_desde(self.b)]  # v1.5: o CNPJ do hero vem da pesquisa, com a fonte
        for chave in ("services", "highlights", "how_to"):
            for item in getattr(ctx, chave):
                textos += [item["title"], item["text"]]
        for pagina in self.PAGINAS:
            resto = htmllib.unescape(visivel(self.ler(self.premium, pagina)))
            for t in sorted(textos, key=len, reverse=True):
                resto = resto.replace(t, " ")
            self.assertNotRegex(resto, r"(?i)\b24\b|plant[ãa]o|emerg[êe]ncia|urg[êe]ncia|interna|leito|\bUTI\b|exame|cirurgi|domic[ií]lio|banho|tosa|farm[áa]cia|medicament|vacin|ex[óo]tic|silvestre|melhor|refer[êe]ncia|premiad|"
                                       r"certific|aberto|desde \d{4}|\b20(0|1|2)\d\b|CRMV|conv[êe]nio|pre[çc]o|promo|pet ?shop|loja|agropet|ra[çc][ãa]o|facebook|instagram", f"{pagina}: texto sem fonte: {resto[:300]}")

    def test_nada_alem_do_json_e_da_interface_do_gerador_mundo_fechado(self):
        """Achado da revisão: a lista de palavras proibidas não pega "Atendemos cães e gatos." (mutante que sobrevivia). Aqui o que sobra depois de tirar o texto do cadastro e a interface do gerador
        (menus, rótulos, avisos) tem de ser vazio: qualquer frase nova no hero ou nas páginas reprova. O texto do cadastro também é conferido contra o JSON CRU (só a troca do canal e a fonte do
        ano do CNPJ podem mudá-lo)."""
        ctx = self.ctx()
        sw = lambda t: t  # v1.0: o celular listado é o número de conversa, então a copy do cadastro sai como está (sem troca de canal)
        self.assertEqual(ctx.lead, sw(self.c["lead"])); self.assertEqual(ctx.tagline, sw(self.c["tagline"])); self.assertEqual(ctx.meta, sw(self.c["meta_description"]))
        self.assertEqual(ctx.about[0], sw(self.c["about"][0]).replace("CNPJ aberto em 2014,", "CNPJ aberto em 2014 (segundo o GuiaPJ),")); self.assertEqual(ctx.about[1], sw(self.c["about"][1]))
        self.assertEqual([x["text"] for x in ctx.services], [sw(x["text"]) for x in self.c["services"]]); self.assertEqual([x["text"] for x in ctx.how_to], [sw(x["text"]) for x in self.c["how_to"]])
        textos = [ctx.tagline, ctx.lead, ctx.meta, *ctx.about, ctx.endereco, ctx.hours["text"]]
        for chave in ("services", "highlights", "how_to"):
            for item in getattr(ctx, chave):
                textos += [item["title"], item["text"]]
        interface = ["Animal Inc", "Ir para o conteúdo", "Ligar", "Início", "Serviços", "Sobre", "Contato", "341", "R. Rodrigues Pacheco", "Centro · Sorocaba", "(15) 99850-7950", "Como chegar", "Horário",
                     "4,9", "Google Maps", "Tentar pelo WhatsApp", "Este número pode não ter WhatsApp.", "Ver todos os serviços", "Como funciona", "Fale com a equipe", "Abrir no Google Maps", "Telefone", "Páginas",
                     "Acesso da equipe", "As informações deste site têm caráter informativo e não substituem a consulta com médico(a) veterinário(a).", "O que Animal Inc oferece", "Não encontrou o que procura?",
                     "Fale com a equipe para tirar dúvidas sobre o atendimento.", "Sobre Animal Inc", "Onde atendemos", "Endereço", "Avaliações", "nota 4,9 com 254 avaliações no Google Maps", "Ver no Google Maps",
                     "WhatsApp", "Ver serviços", "Onde fica", "Onde estamos", "Ver contatos", "Imagem ilustrativa", "criado por andremachado.design", "e mais",
                     "Empresa", "★", "254 avaliações no Google Maps", bv.vc.cnpj_ativo_desde(self.b), self.perfil["hero_servicos"]]  # v1.5: a faixa de abertura (o texto do perfil é o único fora do cadastro, e o README o pendencia)
        for pagina in self.PAGINAS:
            resto = htmllib.unescape(visivel(self.ler(self.premium, pagina)))
            for t in sorted(textos + interface, key=len, reverse=True):
                resto = resto.replace(t, " ")
            self.assertEqual(re.sub(r"[\s|·.,()?!:–-]+", "", resto), "", f"{pagina}: texto que não é do cadastro nem da interface do gerador: {resto.strip()[:200]}")

    def test_ano_do_cnpj_leva_a_fonte(self):
        sobre = self.ler(self.premium, "sobre.html")
        self.assertIn("com CNPJ aberto em 2014 (segundo o GuiaPJ)", sobre)

    # ---- README dos três pacotes ----
    def test_readme_dos_tres_pacotes(self):
        r = {n: self.ler(p, "README.md") for n, p in (("premium", self.premium), ("basico", self.basico), ("essencial", self.essencial))}
        for n, txt in r.items():
            for esperado in ("comércio varejista de medicamentos veterinários", "https://www.facebook.com/animalincinc", "pets silvestres e exóticos", "Quem apresenta".lower() if False else "Telefone: o pacote usa só o celular"):
                self.assertIn(esperado, txt, n)
        for n in ("premium", "basico"):
            self.assertIn("A placa afixada na imagem do início mostra o número da porta (341)", r[n])
        self.assertNotIn("A placa afixada", r["essencial"])  # o ESSENCIAL não tem vitrine
        self.assertNotIn("painel", r["basico"].split("## Pendências a confirmar")[1].split("\n## ")[0].lower())  # o BÁSICO nunca cita o painel nas pendências
        self.assertIn("subtipo clinica_loja", r["premium"]); self.assertIn("subtipo clinica_loja", r["essencial"]); self.assertNotIn("clinica_loja", r["basico"])

    def test_subtipo_geral_nao_acrescenta_nada_ao_painel(self):
        for pasta in (self.premium, self.essencial):
            cfg = self.ler(pasta, "assets/site-config.js")
            painel = re.search(r"^  painel: (\{.*\})$", cfg, re.M)
            self.assertEqual(set(json.loads(painel.group(1))), {"marca"})
            self.assertIn('"marca": "numero"', cfg)
            self.assertFalse((pasta / "painel/js/modulos/internacao.js").exists()); self.assertFalse((pasta / "painel/js/modulos/exames.js").exists())
        self.assertNotIn("painel", "".join(self.ler(self.basico, p) for p in self.PAGINAS).lower())

    def test_nenhuma_palavra_de_bastidor_nos_arquivos_do_cliente(self):
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in pasta.rglob("*"):
                if arq.is_file() and arq.suffix in {".html", ".js", ".css", ".md", ".svg"}:
                    achado = PROIBIDOS_CLIENTE.search(arq.read_text(encoding="utf-8"))
                    self.assertIsNone(achado, f"{pasta.name}/{arq.relative_to(pasta)}: {achado and achado.group(0)}")

    # ---- identidade: o tema numero e o hero ----
    def test_perfil_aplica_tema_numero_e_subtipo_geral(self):
        self.assertEqual((self.perfil["subtipo"], self.perfil["tema"], self.perfil["opcoes"], self.perfil["retirar_servicos"], self.perfil["pesquisa_pendente"]), ("geral", "numero", [], [], []))
        idx = self.ler(self.premium, "index.html")
        for simbolo in ("numero", "pata", "fone", "pino", "relogio"):
            self.assertIn(f"<symbol id='{simbolo}'", idx)
        for ausente in ("letreiro", "dupla", "mira", "escala", "cruz", "pena", "escama", "etiqueta", "seta"):
            self.assertNotIn(f"<symbol id='{ausente}'", idx)
        css = self.ler(self.premium, "assets/style.css")
        self.assertIn("tema numero", css); self.assertIn("numero", self.ler(self.premium, "painel/painel.css"))
        self.assertIn("#c8efc3", self.ler(self.premium, "assets/favicon.svg"))
        self.assertNotRegex(css, r"\.carimbo[^{]*\{[^}]*clip-path"); self.assertNotRegex(css, r"@import|url\(\s*[\"']?https?:"); self.assertIn("prefers-reduced-motion", css)
        self.assertEqual(re.findall(r"animation: ([a-z-]+) ", css.split("tema numero")[1]), ["nm-fixar"])  # uma única animação de entrada
        self.assertNotRegex(css.split("tema numero")[1], r"box-shadow: *\d")
        self.assertEqual(bv.carregar_tema("numero")["hero"], "numero"); self.assertIn("numero", bv.vc.HEROIS)
        self.assertIn("numero:", self.ler(self.premium, "painel/js/ui.js"))  # o ícone da marca no painel

    def test_hero_numero_a_faixa_de_abertura(self):
        """v1.5 (PEDIDO_DESIGN_4): a placa isolada virou a faixa de abertura de duas colunas, com a imagem ilustrativa legendada, a placa do número afixada nela e a nota do Google."""
        idx = self.ler(self.premium, "index.html")
        ini = idx.index('<section class="hero hero--numero">'); hero = idx[ini:idx.index("</section>", ini)]
        self.assertIn('<div class="nm-faixa"><div class="container nm-grade"><div class="nm-texto"><h1>Clínica veterinária no Centro de Sorocaba</h1>', hero)
        self.assertIn('<div class="nm-bloco" aria-hidden="true"><b class="nm-n nm-n--d3">341</b><span class="nm-rua">R. Rodrigues Pacheco</span><span class="nm-local">Centro · Sorocaba</span></div>', hero)
        self.assertRegex(hero, r'<a class="btn nm-botao" data-toque="servicos" href="#servicos"><svg[^>]*><use href="#pata"/></svg>Ver serviços</a>')
        self.assertRegex(hero, r'<a class="btn nm-botao nm-botao--onde" data-toque="onde" href="#localizacao"><svg[^>]*><use href="#pino"/></svg>Onde fica</a>')
        self.assertIn('<figure class="ilustra nm-foto" data-ilustrativa><img src="assets/ilustrativas/vet-caes-gatos.webp" alt="Um cachorro e um gato descansando sobre uma manta" width="1600" height="1067" loading="eager" decoding="async"><figcaption>Imagem ilustrativa</figcaption></figure>', hero)
        self.assertTrue((self.premium / "assets/ilustrativas/vet-caes-gatos.webp").is_file())
        self.assertIn('aria-label="Nota 4,9 com 254 avaliações no Google Maps"><b aria-hidden="true">4,9<span class="nm-estrela">★</span></b><span aria-hidden="true">254 avaliações no Google Maps</span></a>', hero)
        for valor in ("Atendimento veterinário para cães e gatos", "Das 9h às 19h, segundo o guia Sorocaba Fácil.", "R. Rodrigues Pacheco, 341 - Centro – Sorocaba, 18035-085", "CNPJ aberto em 2014 e ativo, segundo o GuiaPJ"):
            self.assertIn(valor, hero)
        self.assertNotRegex(hero, r"tel:|wa\.me|Tentar pelo WhatsApp|nm-placa|nm-linha"); self.assertEqual(hero.count("<h1>"), 1); self.assertLess(idx.index("hero--numero"), idx.index('id="servicos"'))
        # a ordem do DOM é a ordem visual: título, apresentação, atalhos, fatos, imagem (com a placa e a nota)
        ordem = [hero.index(x) for x in ("<h1>", 'class="destaque nm-lead"', 'data-toque="servicos"', 'data-toque="onde"', "nm-fato--servicos", "nm-fato--horario", "nm-fato--endereco", "nm-fato--empresa", "nm-foto", "nm-bloco", "nm-nota")]
        self.assertEqual(ordem, sorted(ordem))
        classes = {c for g in re.findall(r'class="([^"]+)"', hero) for c in g.split()}
        self.assertEqual({c for c in classes if not c.startswith("nm-")}, {"hero", "hero--numero", "container", "btn", "destaque", "ilustra"})
        self.assertFalse(classes & {"nota", "placa", "chapa", "anotacao", "viveiro", "ficha", "gd-etq", "dp-bloco", "lt-fone", "carimbo"})
        self.assertEqual(hero.count("341"), 2)  # a placa (decorativa, aria-hidden) e o endereço dos fatos
        self.assertNotIn("aria-hidden", re.sub(r"<svg[^>]*>", "", hero.split("nm-texto")[1].split("nm-vitrine")[0]))  # nada que se lê ou clica fica escondido do leitor de tela

    def test_linha_servicos_do_hero_so_vem_do_perfil_e_vira_pendencia(self):
        """"cães e gatos" não tem fonte: só entra porque o perfil traz `hero_servicos` (pedido do André) e o README dos pacotes com vitrine pede a confirmação."""
        self.assertEqual(self.perfil["hero_servicos"], "Atendimento veterinário para cães e gatos")
        sem = dict(self.perfil); sem["hero_servicos"] = None
        h = bv.vc.hero_numero(bv.vc.contexto(self.b, True, tema=bv.carregar_tema("numero"), subtipo=bv.carregar_subtipo("geral"), perfil=sem))
        self.assertIn('<span class="nm-valor">Atendimento veterinário</span>', h); self.assertNotRegex(h, r"c[ãa]es e gatos")
        for estranho in (5, "", "   ", ["x"], None):
            p = dict(self.perfil); p["hero_servicos"] = estranho
            self.assertIsNone(bv.vc.contexto(self.b, True, tema=bv.carregar_tema("numero"), perfil=p).hero_servicos)
        for pasta in (self.premium, self.basico):
            self.assertIn("NÃO tem fonte na pesquisa", self.ler(pasta, "README.md"))
        self.assertNotIn("cães e gatos", self.ler(self.essencial, "README.md"))
        for pasta in (self.essencial,):
            for arq in self.arquivos_do_site(pasta):
                self.assertNotIn("cães e gatos", arq.read_text(encoding="utf-8"), arq.name)

    def test_cnpj_ativo_desde_so_com_o_fato_e_a_fonte(self):
        f = bv.vc.cnpj_ativo_desde
        self.assertEqual(f(self.b), "CNPJ aberto em 2014 e ativo, segundo o GuiaPJ")
        def com(*fatos):
            x = json.loads(json.dumps(self.b)); x["research"]["facts"] = list(fatos); return x
        self.assertIsNone(f(com({"text": "Aberta em 10/03/2014.", "source": "https://guiapj.com.br/x"})))  # sem a situação ativa
        self.assertIsNone(f(com({"text": "Aberta em 10/03/2014, situação cadastral ativa."})))  # sem fonte
        self.assertIsNone(f(com({"text": "Situação cadastral ativa.", "source": "https://guiapj.com.br/x"})))  # sem o ano
        self.assertEqual(f(com({"text": "aberta em 2019, situação ativa", "source": "https://exemplo.com.br/a"})), "CNPJ aberto em 2019 e ativo, segundo o site exemplo.com.br")
        for ruim in (None, "x", 5, {"research": None}, {"research": {"facts": "x"}}, {"research": {"facts": [None, 3, {"text": 5}]}}):
            self.assertIsNone(f(ruim))

    def test_endereco_em_partes(self):
        f = bv.vc.endereco_em_partes
        self.assertEqual(f("R. Rodrigues Pacheco, 341 - Centro – Sorocaba, 18035-085"), {"rua": "R. Rodrigues Pacheco", "numero": "341", "bairro": "Centro", "cidade": "Sorocaba"})
        self.assertEqual(f("Av. Percito de Sousa Queiroz - Vila Barao – Sorocaba"), {"rua": "Av. Percito de Sousa Queiroz", "numero": "", "bairro": "Vila Barao", "cidade": "Sorocaba"})  # sem número (em disputa): só a rua
        self.assertEqual(f("Entrada pelo estacionamento lateral - Av. Ipanema, 4788 - Jardim Novo Horizonte – Sorocaba, 18070-180"), {"rua": "Av. Ipanema", "numero": "4788", "bairro": "Jardim Novo Horizonte", "cidade": "Sorocaba"})
        self.assertEqual(f("R. 7 de Setembro, 100 - Centro – Sorocaba, 18000-000")["rua"], "R. 7 de Setembro"); self.assertEqual(f("R. 7 de Setembro, 100 - Centro – Sorocaba, 18000-000")["numero"], "100")
        self.assertEqual(f("Rua das Flores, nº 94 - Jardim – Sorocaba")["numero"], "94")
        self.assertEqual(f("Rodovia SP 075, km 107 - Zona Rural – Sorocaba")["numero"], "")  # "km 107" não é número de porta
        self.assertEqual(f("Rua X, 1234567 - B – Sorocaba")["numero"], "")  # número fora do tamanho de porta
        self.assertEqual(f("Rua X, 12-B - B – Sorocaba")["numero"], "")  # colado a letra ou hífen: não é reconhecido (nada é cortado nem inventado)
        for estranho in ("Av. X, 1.234 - B – S", "Rua X, 245A - B – S", "Rua X, 245/247 - B – S", "Rua X, 245 B - B – S"):  # achado da revisão: antes devolviam "1" e "245" (cortados)
            self.assertEqual(f(estranho)["numero"], "", estranho); self.assertEqual(f(estranho)["bairro"], "B")
        self.assertEqual(f("R. X, 10 - Sala 3 - Centro – Sorocaba"), {"rua": "R. X", "numero": "10", "bairro": "Centro", "cidade": "Sorocaba"})  # a rua não é "Sala 3"
        self.assertEqual(f("Av. X, 245, Sala 01 - B – S")["numero"], "245")
        self.assertEqual(f("Av. X - Vila Barao – Sorocaba, 18035-085")["numero"], "")  # o CEP não é número
        for vazio in ("", None, "   "):
            self.assertEqual(f(vazio), {"rua": "", "numero": "", "bairro": "", "cidade": ""})
        self.assertEqual(f("<script>alert(1)</script>")["numero"], "")

    def test_hero_numero_sem_numero_mostra_so_a_rua_e_nunca_o_numero_em_disputa(self):
        b = json.loads(json.dumps(self.b)); b["research"]["pending"] = ["O número do endereço diverge: 227 em guias, 345 no CSV; confirmar com o negócio."]; b["address"] = "R. Rodrigues Pacheco, 345 - Centro – Sorocaba, 18035-085"
        b["content"]["lead"] = "Na R. Rodrigues Pacheco, 345, no Centro."
        h = self.hero(b)
        self.assertIn('class="nm-bloco nm-bloco--rua" aria-hidden="true"><span class="nm-rua nm-rua--so">R. Rodrigues Pacheco</span><span class="nm-local">Centro · Sorocaba</span>', h)
        self.assertNotRegex(h, r"\b345\b|\b227\b"); self.assertNotIn("nm-n ", h)
        # sem endereço que se leia, não há bloco: a placa vira uma coluna só
        s = json.loads(json.dumps(self.b)); s["address"] = ""
        h = self.hero(s); self.assertNotIn("nm-bloco", h); self.assertNotIn("nm-fato--endereco", h); self.assertIn("nm-foto", h)  # a imagem fica; sem placa nem linha de endereço
        # número de 4 e de 5 algarismos ganham a classe que diminui os algarismos; de 6 não é número de porta
        for n, cl in (("4788", "nm-n--d4"), ("12345", "nm-n--d5")):
            q = json.loads(json.dumps(self.b)); q["address"] = f"Av. X, {n} - Centro – Sorocaba"
            self.assertIn(f'<b class="nm-n {cl}">{n}</b>', self.hero(q))

    def test_numero_em_disputa_sem_algarismos_citados_tambem_some_do_hero_do_endereco_e_do_mapa(self):
        """Achado da revisão do site 8: "O número do endereço diverge entre as fontes; confirmar" (sem algarismos) ligava `numero_a_confirmar` mas `numeros_em_disputa` voltava vazia e o 341 saía em letras
        grandes no hero, no endereço e na consulta do mapa."""
        b = json.loads(json.dumps(self.b)); b["research"]["pending"] = ["O número do endereço diverge entre as fontes; confirmar com o negócio."]
        self.assertTrue(bv.vc.numero_a_confirmar(b)); self.assertEqual(bv.vc.numeros_em_disputa(b), ["341"])
        c = self.ctx(b)
        for onde in (c.endereco, c.maps_src, bv.vc.hero_numero(c)):
            self.assertNotRegex(onde, r"\b341\b")
        self.assertIn("nm-bloco--rua", bv.vc.hero_numero(c)); self.assertNotIn("18035", c.endereco)
        # sem número no cadastro, o CEP não é lido como número
        q = json.loads(json.dumps(b)); q["address"] = "Av. X - Centro – Sorocaba, 18035-085"
        self.assertEqual(bv.vc.numeros_em_disputa(q), [])

    def test_hero_numero_escapa_texto_de_dado_e_nao_inventa_o_que_nao_ha(self):
        b = json.loads(json.dumps(self.b)); b["address"] = '<script>alert(1)</script> & "x", 12 - <b>Bairro</b> – Sorocaba'; b["content"]["hours"] = {"text": "<img src=x onerror=1> Das 9h.", "source": "https://www.sorocabafacil.com.br/x"}
        b["content"]["tagline"] = "<b>negrito</b> Clínica"; b["phones"][0]["display"] = "(15) <i>9985</i>-7950"; b["research"]["pending"] = []; b["content"]["lead"] = "<u>lead</u> & mais"
        h = self.hero(b)
        self.assertNotRegex(h, r"<script|<img src=x|<b>negrito|<i>|<u>|<b>Bairro")  # a única <img> é a ilustrativa do tema
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;", h); self.assertIn("&lt;u&gt;lead&lt;/u&gt; &amp; mais", h)
        self.assertNotIn("9985", h)  # v1.0: o telefone não está mais no hero (nem como botão de ligar, nem com o aviso de WhatsApp)
        # o ramo COM número do bloco também escapa (o endereço acima termina em aspas e não chega a ele): rua, número e bairro hostis
        d = json.loads(json.dumps(self.b)); d["address"] = "Rua <img src=x onerror=1>X, 12 - <i>B</i>b – <u>S</u>"
        h2 = self.hero(d); self.assertIn("<b class=\"nm-n nm-n--d2\">12</b>", h2); self.assertNotRegex(h2, r"<img src=x|<i>|<u>"); self.assertIn("Rua &lt;img src=x onerror=1&gt;X", h2)
        self.assertEqual(bv.vc.fato_numero("pino", "endereco", "<i>T</i>", "<b>x</b>"), '<li class="nm-fato nm-fato--endereco"><span class="nm-rotulo"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#pino"/></svg><b>&lt;i&gt;T&lt;/i&gt;</b></span><span class="nm-valor">&lt;b&gt;x&lt;/b&gt;</span></li>')
        sem = json.loads(json.dumps(self.b)); sem["whatsapp"] = {"digits": None, "display": None, "status": "none"}; sem["wa_contact"] = None; sem["phones"] = []; sem["google"] = None; sem["content"]["hours"] = None
        h = self.hero(sem)
        for ausente in ("data-toque=\"fone\"", "nm-fato--horario", "nm-nota", "wa.me", "tel:"):
            self.assertNotIn(ausente, h)
        self.assertIn('data-toque="onde"', h); self.assertIn('data-toque="servicos"', h)  # os dois atalhos existem sempre
        nada = dict(self.perfil); nada["hero_servicos"] = None; v = json.loads(json.dumps(sem)); v["address"] = ""; v["content"]["services"] = []
        h = bv.vc.hero_numero(bv.vc.contexto(v, True, tema={"hero": "numero"}, perfil=nada)); self.assertIn("nm-grade--uma", h); self.assertNotIn("nm-vitrine", h)  # sem imagem, placa nem nota: uma coluna só

    def test_hero_numero_status_do_whatsapp_nao_muda_o_botao(self):
        conf = json.loads(json.dumps(self.b)); conf["whatsapp"]["status"] = "confirmed"
        c = self.ctx(conf); self.assertFalse(c.nao_confirmado)
        self.assertEqual(bv.vc.hero_numero(c), bv.vc.hero_numero(self.ctx()))
        self.assertNotRegex(bv.vc.hero_numero(c), r'data-toque="wa"|wa\.me|nm-linha--fone|Tentar pelo WhatsApp')

    def test_tema_numero_nao_repete_as_paletas_anteriores_nem_as_formulas_de_ia(self):
        t = bv.carregar_tema("numero")["tokens"]
        for outro in ("caderneta", "terrario", "sinalizacao", "chapa", "gondola", "dupla", "letreiro"):
            o = bv.carregar_tema(outro)["tokens"]
            for papel in ("folha", "musgo", "carimbo", "papel", "fonte-titulo"):
                self.assertNotEqual(t[papel].lower(), o[papel].lower(), f"{outro}/{papel}")
        self.assertNotRegex(json.dumps(t), r"(?i)terracota|#c1440e|#0f0f0f|#000000|neon")
        def matiz(h):
            r, g, b = (int(h.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)); mx, mn = max(r, g, b), min(r, g, b)
            if mx == mn: return 0
            d = mx - mn; m = ((g - b) / d) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
            return m * 60
        cad = bv.carregar_tema("caderneta")["tokens"]  # o subtipo `geral` é o da caderneta: nem a ação, nem o acento, nem o escuro podem parecer os dela
        for papel in ("musgo", "carimbo", "folha"):
            dist = abs(matiz(t[papel]) - matiz(cad[papel])); self.assertGreater(min(dist, 360 - dist), 25, papel)
        for outro in ("terrario", "sinalizacao", "chapa", "gondola", "dupla", "letreiro"):
            o = bv.carregar_tema(outro)["tokens"]; dist = abs(matiz(t["musgo"]) - matiz(o["musgo"])); self.assertGreater(min(dist, 360 - dist), 25, f"ação x {outro}")
        for arq in ("numero.vitrine.css", "numero.painel.css"):
            css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / arq).read_text(encoding="utf-8"), flags=re.S)
            self.assertNotRegex(css, r"text-transform: *uppercase|font-family:[^;]*mono|ui-monospace", arq)
            self.assertNotRegex(css, r"(?<![\w-])\.(nota|placa|chapa|anotacao)(?![\w-])", arq)
            self.assertNotRegex(css, r"(?i)\b(urgente|urgência|emergência|aberto agora|24 ?h)\b", arq)
        css = re.sub(r"/\*.*?\*/", "", "".join((SKILL / "temas" / a).read_text(encoding="utf-8") for a in ("numero.vitrine.css", "numero.painel.css")), flags=re.S)
        for seletor, corpo in re.findall(r"([^{}]+)\{([^}]*gradient\([^}]*)\}", css):  # todo gradiente tem cor SÓLIDA por baixo (o teste de contraste mede contra background-color)
            decl = re.search(r"background:([^;]+);", corpo)
            self.assertIsNotNone(decl, seletor); self.assertRegex(decl.group(1).strip(), r"(#[0-9a-fA-F]{3,8}|var\(--[a-z-]+\))$", f"{seletor.strip()}: gradiente sem cor sólida por baixo")

    def test_algarismos_do_numero_e_dos_passos_nao_usam_a_fonte_do_titulo(self):
        """O "1" do Gill Sans é uma haste lisa e se lê como "I": o número da porta e o número do primeiro passo vão na fonte do corpo."""
        css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / "numero.vitrine.css").read_text(encoding="utf-8"), flags=re.S)
        for seletor in (r"\.nm-n ", r"\.passos li::before "):
            corpo = re.search(seletor + r"\{([^}]*)\}", css).group(1)
            self.assertIn("var(--fonte-corpo)", corpo, seletor); self.assertNotIn("--fonte-titulo", corpo, seletor)

    def test_regerar_por_cima_nao_perde_o_material_do_cliente(self):
        d = self.tmp / "material8"
        bv.gerar(SLUG8, saida=str(d))
        mat = d / "assets" / "material.js"
        mat.write_text(mat.read_text(encoding="utf-8").replace("galeria = [];", 'galeria = [{src: "assets/img/fachada.jpg", alt: "Fachada"}];'), encoding="utf-8")
        for kwargs in ({"vitrine": False}, {"gestao": False}, {}):
            bv.gerar(SLUG8, saida=str(d), **kwargs)
        self.assertIn("Fachada", mat.read_text(encoding="utf-8"))


class TestSite9Ishizuka(unittest.TestCase):
    """Site 9 (Ishizuka: clínica de bairro, seis serviços só do Guia-se, telefone fixo, sem horário no cadastro) nos três pacotes. Subtipo `geral`, tema `registro`, hero `registro`."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="vet-build9-"))
        cls.premium = bv.gerar(SLUG9, saida=str(cls.tmp / "premium"))
        cls.basico = bv.gerar(SLUG9, gestao=False, saida=str(cls.tmp / "basico"))
        cls.essencial = bv.gerar(SLUG9, vitrine=False, saida=str(cls.tmp / "essencial"))
        cls.b = model.load_business(SLUG9)
        cls.c = cls.b["content"]
        cls.perfil = bv.carregar_perfil(SLUG9)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    PAGINAS = ("index.html", "sobre.html", "contato.html")
    FONE = "(15) 3233-3242"

    def ler(self, pasta, rel):
        return (pasta / rel).read_text(encoding="utf-8")

    def arquivos_do_site(self, pasta, sufixos=(".html", ".js", ".css", ".json", ".svg")):
        return [a for a in pasta.rglob("*") if a.is_file() and a.suffix in sufixos]

    def ctx(self, b=None, gestao=True):
        return bv.vc.contexto(b or self.b, gestao, tema=bv.carregar_tema(self.perfil["tema"]), subtipo=bv.aplicar_opcoes(bv.carregar_subtipo(self.perfil["subtipo"]), self.perfil["opcoes"]), perfil=self.perfil)

    def hero(self, b=None):
        return bv.vc.hero_registro(self.ctx(b))

    # ---- dados e honestidade ----
    def test_conteudo_e_vitrine_passam_nos_validadores_do_projeto(self):
        self.assertEqual(validate.check_content(self.b), [])
        for pasta in (self.premium, self.basico):
            self.assertEqual(validate.check_site(self.b, str(pasta)), [], pasta.name)

    def test_telefone_fixo_nao_vira_botao_nenhum(self):
        """Item F: telefone fixo nunca vira wa.me. O pacote não inventa número: o fixo é só texto (hero, contato, rodapé) e o README diz que não há botão de contato."""
        self.assertEqual(self.b["whatsapp"]["status"], "landline-unverified"); self.assertIsNone(self.b.get("wa_contact"))
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            self.assertNotRegex(html, r"wa\.me|wa-flutuante|ligar-flutuante|btn-topo|tel:|Tentar pelo WhatsApp|pode não ter WhatsApp|<form|Conversar no WhatsApp", pagina)
            self.assertNotRegex(html, r"(?i)whatsapp|api\.whatsapp|sms:|callto:|<button|class=\"fab\"", pagina)  # nenhum outro jeito de botão de contato (achado da revisão: um botão com outro nome sobrevivia)
            self.assertIn(self.FONE, html, pagina)
            self.assertIn('<meta name="format-detection" content="telephone=no">', html.split("</head>")[0], pagina)
            self.assertIn('<a href="https://andremachado.design" target="_blank" rel="noopener">criado por andremachado.design</a>', html, pagina)
        self.assertIn('"whatsapp": ""', self.ler(self.premium, "assets/site-config.js"))
        for pagina in self.PAGINAS:  # o BÁSICO também: nenhum contato por mensagem
            self.assertNotRegex(self.ler(self.basico, pagina), r"(?i)wa\.me|whatsapp|api\.whatsapp|sms:|callto:|tel:|<button|class=\"fab\"|<form", pagina)
        for pasta in (self.premium, self.basico):
            r = self.ler(pasta, "README.md")
            self.assertIn("sem celular: só telefone fixo (15) 3233-3242", r); self.assertIn("Botões de contato: nenhum.", r)
        # com um celular confirmado como WhatsApp o botão volta sozinho, e a linha do hero passa a se chamar WhatsApp
        conf = json.loads(json.dumps(self.b)); conf["whatsapp"] = {"digits": "5515998507950", "display": "(15) 99850-7950", "status": "confirmed"}
        conf["wa_contact"] = {"digits": "5515998507950", "display": "(15) 99850-7950"}
        self.assertIn('<a class="wa-flutuante" href="https://wa.me/5515998507950', bv.vc.pagina_index(self.ctx(conf)))
        h = self.hero(conf)
        self.assertIn('<span class="rg-rotulo"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#fone"/></svg><b>WhatsApp</b></span><span class="rg-valor">(15) 99850-7950</span>', h)

    def test_segundo_telefone_do_guia_so_no_readme(self):
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in self.arquivos_do_site(pasta):
                self.assertNotRegex(arq.read_text(encoding="utf-8"), r"3232[\s .-]?8162|55153232?8162", f"{pasta.name}/{arq.relative_to(pasta)}")
            self.assertIn("(15) 3232-8162", self.ler(pasta, "README.md"))
        self.assertEqual(self.ctx().fone_ligar["digits"], "551532333242")

    def test_sem_horario_no_cadastro_o_site_nao_mostra_horario_nem_24_horas(self):
        """A pesquisa tem "Aberto 24 horas" (Sorocaba Fácil) e horários inconsistentes (Lista Mais), mas o cadastro não tem `hours`: nada de horário, prazo ou plantão no site; só o README."""
        self.assertIsNone(self.c["hours"]); self.assertTrue(bv.vc.horario_a_confirmar(self.b))
        ctx = self.ctx()
        textos = [ctx.tagline, ctx.lead, ctx.meta, *ctx.about, ctx.endereco] + [i[k] for ch in ("services", "highlights", "how_to") for i in getattr(ctx, ch) for k in ("title", "text")]
        for pagina in self.PAGINAS:
            resto = htmllib.unescape(visivel(self.ler(self.premium, pagina)))
            for tx in sorted(textos, key=len, reverse=True):  # o passo "A equipe orienta sobre horários..." é texto do cadastro (sem afirmar horário nenhum)
                resto = resto.replace(tx, " ")
            self.assertNotRegex(resto, r"(?i)\b24\b|plant[ãa]o|hor[áa]rio|aberto|funcionamento|\bdas? \d{1,2}h|segunda|s[áa]bado|domingo", pagina)
            self.assertNotIn("nm-linha--horario", self.ler(self.premium, pagina)); self.assertNotIn("rg-linha--horario", self.ler(self.premium, pagina))
        for pasta in (self.premium, self.basico, self.essencial):
            r = self.ler(pasta, "README.md")
            self.assertIn("Aberto 24 horas", r); self.assertIn("plantão clínico 24 horas", r)

    def test_dados_estruturados_e_html_cru_nao_afirmam_horario_nem_prazo(self):
        """Achado da revisão: `visivel()` tira <script> e atributos, e um mutante que punha `openingHours` ou uma nota inventada nos dados estruturados sobrevivia. Aqui o JSON-LD tem EXATAMENTE as chaves
        dos dados que existem (nome, endereço, telefone), e o HTML cru (com atributos e meta) não tem horário, prazo nem plantão, fora o texto do cadastro."""
        ctx = self.ctx()
        textos = [ctx.tagline, ctx.lead, ctx.meta, *ctx.about, ctx.endereco] + [i[k] for ch in ("services", "highlights", "how_to") for i in getattr(ctx, ch) for k in ("title", "text")]
        for pasta in (self.premium, self.basico):
            for pagina in self.PAGINAS:
                html = self.ler(pasta, pagina)
                for bloco in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
                    ld = json.loads(bloco)
                    self.assertEqual(set(ld), {"@context", "@type", "name", "address", "telephone"}, f"{pasta.name}/{pagina}")
                    self.assertEqual(set(ld["address"]), {"@type", "streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"})
                    self.assertEqual(ld["telephone"], "+551532333242")
                cru = htmllib.unescape(html)
                for tx in sorted(textos, key=len, reverse=True):
                    cru = cru.replace(tx, " ")
                self.assertNotRegex(cru, r"(?i)openingHours|\b24\b|plant[ãa]o|hor[áa]rio|aberto|funcionamento|aggregateRating|ratingValue", f"{pasta.name}/{pagina}")

    def test_regra_da_acupuntura_so_casa_com_o_titulo_do_servico(self):
        """Achado da revisão: casando título + texto, o Acumed (sítio futuro) trocava a imagem de "Especialidades", "Reabilitação" e "Tratamentos complementares", cujo TEXTO cita acupuntura."""
        f = bv.vc.foto_servico
        self.assertEqual(f({"title": "Acupuntura veterinária", "text": "x"})[0], "vet-acupuntura")
        self.assertEqual(f({"title": "Acupuntura", "text": "x"})[0], "vet-acupuntura")
        self.assertNotEqual(f({"title": "Especialidades", "text": "Cardiologia, acupuntura, ortopedia."})[0], "vet-acupuntura")
        self.assertNotEqual(f({"title": "Tratamentos complementares", "text": "Acupuntura e fisioterapia."})[0], "vet-acupuntura")
        for arq in sorted((ROOT / "data" / "content" / "pet-veterinaria").glob("*.json")):  # nos 22 negócios: só um serviço cujo TÍTULO cita acupuntura recebe a imagem
            for s in json.loads(arq.read_text(encoding="utf-8")).get("services") or []:
                if f(s)[0] == "vet-acupuntura":
                    self.assertRegex(bv.vc._dobrar(s["title"]), r"acupunt", f"{arq.stem}: {s['title']}")

    def test_bairro_que_diverge_e_nome_do_guia_com_petshop_nao_viram_afirmacao(self):
        self.assertFalse(bv.vc.cep_a_confirmar(self.b)); self.assertEqual(bv.vc.numeros_em_disputa(self.b), [])  # "mantido o do CSV": decisão tomada; o CEP é o mesmo nas três fontes
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            self.assertIn("Jardim Emilia", html); self.assertIn("920", html)
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in [a for a in self.arquivos_do_site(pasta) if "painel" not in a.relative_to(pasta).parts]:  # o painel tem os dados de exemplo dele (estoque com "Ração")
                self.assertNotRegex(arq.read_text(encoding="utf-8"), r"Jardim Faculdade|(?i:\bpet ?shop\b)|(?i:agropet)|(?i:banho e tosa)|(?i:\bra[çc][ãa]o\b)", f"{pasta.name}/{arq.relative_to(pasta)}")
            r = self.ler(pasta, "README.md")
            self.assertIn("Jardim Faculdade", r); self.assertIn("ISHIZUKA - Clinica Veterinária e PetShop", r)

    def test_depoimentos_e_tempo_de_funcionamento_do_lista_mais_nao_entram(self):
        for pasta in (self.premium, self.basico):
            for arq in (pasta / p for p in self.PAGINAS):
                self.assertNotRegex(arq.read_text(encoding="utf-8"), r"(?i)\b17 anos|salvou|tradicional|h[áa] \d+ anos|desde \d{4}|depoimento|cliente[s]? (?:disse|diz|relata)", f"{pasta.name}/{arq.relative_to(pasta)}")

    def test_seis_servicos_cada_um_com_a_sua_imagem_ilustrativa_legendada(self):
        idx = self.ler(self.premium, "index.html")
        titulos = [s["title"] for s in self.c["services"]]
        self.assertEqual(titulos, ["Consulta clínica", "Cirurgia", "Internação", "Vacinação", "Acupuntura veterinária", "Atendimento em domicílio"])
        self.assertEqual(idx.count('<article class="servico '), 6)
        figuras = re.findall(r'<figure class="ilustra" data-ilustrativa><img src="assets/ilustrativas/([a-z-]+)\.webp" alt="([^"]+)"[^>]*><figcaption>Imagem ilustrativa</figcaption></figure>', idx)
        self.assertEqual([f[0] for f in figuras], ["vet-atendimento", "vet-cirurgia", "vet-internacao", "vet-vacina", "vet-acupuntura", "vet-domicilio"])  # nenhum card repete a imagem
        self.assertEqual(len(set(f[0] for f in figuras)), 6)
        for nome, alt in figuras:
            self.assertTrue((self.premium / "assets" / "ilustrativas" / f"{nome}.webp").is_file(), nome); self.assertNotRegex(alt, r"(?i)ishizuka|equipe|fachada|paciente")
        self.assertEqual(sorted(a.name for a in (self.premium / "assets" / "ilustrativas").iterdir()), sorted(f"{n}.webp" for n, _ in figuras))
        self.assertEqual(sorted(a.name for a in (self.basico / "assets" / "ilustrativas").iterdir()), sorted(f"{n}.webp" for n, _ in figuras))  # o BÁSICO leva as mesmas imagens do PREMIUM
        self.assertFalse((self.essencial / "assets" / "ilustrativas").exists())
        for n in ("vet-acupuntura",):  # a imagem nova: WEBP de 1600x1067, a mesma proporção das outras
            b = (SKILL / "ilustrativas" / f"{n}.webp").read_bytes()
            self.assertEqual((b[:4], b[8:12]), (b"RIFF", b"WEBP"))
        self.assertIn("vet-acupuntura.webp", self.ler(SKILL / "ilustrativas", "CREDITOS.md"))
        # a regra nova da acupuntura não mudou a imagem de nenhum outro site
        for slug in TODOS:
            if slug != SLUG9:
                self.assertNotIn("vet-acupuntura", bv.vc.fotos_usadas(bv.vc.contexto(model.load_business(slug), True)), slug)

    def test_gerador_apaga_o_resto_do_gerador_generico(self):
        """O site nasceu do gerador genérico, que deixa `assets/ilustrativa-servicos.webp`; a skill usa `assets/ilustrativas/` e não pode entregar o arquivo morto."""
        for nome, kwargs in (("premium", {}), ("basico", {"gestao": False}), ("essencial", {"vitrine": False})):
            d = self.tmp / f"resto-{nome}"; (d / "assets").mkdir(parents=True)
            (d / "assets" / "ilustrativa-servicos.webp").write_bytes(b"RIFFxxxxWEBP")
            bv.gerar(SLUG9, saida=str(d), **kwargs)
            self.assertEqual(list((d / "assets").glob("ilustrativa-*.webp")), [], nome)

    def test_nada_afirmado_alem_do_json_no_site_9(self):
        ctx = self.ctx()
        textos = [ctx.tagline, ctx.lead, ctx.meta, *ctx.about, ctx.endereco, *ctx.form["topic_options"]]
        for chave in ("services", "highlights", "how_to"):
            for item in getattr(ctx, chave):
                textos += [item["title"], item["text"]]
        for pagina in self.PAGINAS:
            resto = htmllib.unescape(visivel(self.ler(self.premium, pagina)))
            for t in sorted(textos, key=len, reverse=True):
                resto = resto.replace(t, " ")
            self.assertNotRegex(resto, r"(?i)\b24\b|plant[ãa]o|emerg[êe]ncia|urg[êe]ncia|leito|\bUTI\b|exame|banho|tosa|farm[áa]cia|medicament|ex[óo]tic|silvestre|melhor|refer[êe]ncia|premiad|"
                                       r"certific|aberto|desde \d{4}|\b20(0|1|2)\d\b|CRMV|conv[êe]nio|pre[çc]o|promo|pet ?shop|loja|agropet|ra[çc][ãa]o|facebook|instagram|equipe especializada|tecnologia", f"{pagina}: texto sem fonte: {resto[:300]}")

    def test_nada_alem_do_json_e_da_interface_do_gerador_mundo_fechado(self):
        """O que sobra depois de tirar o texto do cadastro e a interface do gerador (menus, rótulos, avisos) tem de ser vazio: qualquer frase nova no hero ou nas páginas reprova.
        O texto do cadastro também é conferido contra o JSON CRU: o canal não é trocado ("ligue" já é o que o cadastro diz) e nada leva fonte no texto (sem diferenciais nem CNPJ)."""
        ctx = self.ctx()
        self.assertEqual(ctx.lead, self.c["lead"]); self.assertEqual(ctx.tagline, self.c["tagline"]); self.assertEqual(ctx.meta, self.c["meta_description"])
        self.assertEqual(ctx.about, self.c["about"]); self.assertEqual([x["text"] for x in ctx.services], [x["text"] for x in self.c["services"]]); self.assertEqual([x["text"] for x in ctx.how_to], [x["text"] for x in self.c["how_to"]])
        textos = [ctx.tagline, ctx.lead, ctx.meta, *ctx.about, ctx.endereco]
        for chave in ("services", "highlights", "how_to"):
            for item in getattr(ctx, chave):
                textos += [item["title"], item["text"]]
        interface = ["Clínica Veterinária Ishizuka", "Ir para o conteúdo", "Início", "Serviços", "Sobre", "Contato", self.FONE, "Telefone", "Endereço", "Como chegar", "4,9", "Google Maps", "Ver serviços", "Onde fica",
                     "Como funciona", "Fale com a equipe", "Abrir no Google Maps", "Páginas", "Acesso da equipe", "As informações deste site têm caráter informativo e não substituem a consulta com médico(a) veterinário(a).",
                     "Sobre Clínica Veterinária Ishizuka", "Onde atendemos", "Avaliações", "nota 4,9 com 181 avaliações no Google Maps", "Ver no Google Maps", "Onde estamos", "Ver contatos", "Imagem ilustrativa",
                     "criado por andremachado.design", "Ver todos os serviços", "O que Clínica Veterinária Ishizuka oferece", "Não encontrou o que procura?", "Fale com a equipe para tirar dúvidas sobre o atendimento."]
        for pagina in self.PAGINAS:
            resto = htmllib.unescape(visivel(self.ler(self.premium, pagina)))
            for t in sorted(textos + interface, key=len, reverse=True):
                resto = resto.replace(t, " ")
            self.assertEqual(re.sub(r"[\s|·.,()?!:–-]+", "", resto), "", f"{pagina}: texto que não é do cadastro nem da interface do gerador: {resto.strip()[:200]}")

    # ---- identidade: o tema registro e o hero ----
    def test_perfil_aplica_tema_registro_e_subtipo_geral(self):
        self.assertEqual((self.perfil["subtipo"], self.perfil["tema"], self.perfil["opcoes"], self.perfil["retirar_servicos"], self.perfil["pesquisa_pendente"]), ("geral", "registro", [], [], []))
        idx = self.ler(self.premium, "index.html")
        for simbolo in ("registro", "pata", "fone", "pino", "relogio"):
            self.assertIn(f"<symbol id='{simbolo}'", idx)
        for ausente in ("numero", "letreiro", "dupla", "mira", "escala", "cruz", "pena", "escama", "etiqueta", "seta"):
            self.assertNotIn(f"<symbol id='{ausente}'", idx)
        css = self.ler(self.premium, "assets/style.css")
        self.assertIn("tema registro", css); self.assertIn("registro", self.ler(self.premium, "painel/painel.css"))
        self.assertIn("#d3e5f3", self.ler(self.premium, "assets/favicon.svg"))
        self.assertNotRegex(css, r"\.carimbo[^{]*\{[^}]*clip-path"); self.assertNotRegex(css, r"@import|url\(\s*[\"']?https?:"); self.assertIn("prefers-reduced-motion", css)
        tema_css = css.split("tema registro")[1]
        self.assertEqual(re.findall(r"animation(?:-name)?\s*:\s*([a-z-]+)", tema_css), ["rg-pender"])  # uma única animação de entrada (a fita)
        self.assertEqual(set(re.findall(r"@keyframes\s+([\w-]+)", tema_css)), {"rg-pender"}); self.assertNotRegex(tema_css, r"infinite|!important")  # nada em laço nem que vença o prefers-reduced-motion
        self.assertEqual(bv.carregar_tema("registro")["hero"], "registro"); self.assertIn("registro", bv.vc.HEROIS)
        self.assertIn("registro:", self.ler(self.premium, "painel/js/ui.js"))  # o ícone da marca no painel
        self.assertEqual(json.loads(re.search(r"^  painel: (\{.*\})$", self.ler(self.premium, "assets/site-config.js"), re.M).group(1)), {"marca": "registro"})

    def test_hero_registro_a_folha_e_a_ordem_de_leitura(self):
        idx = self.ler(self.premium, "index.html")
        ini = idx.index('<section class="hero hero--registro">'); hero = idx[ini:idx.index("</section>", ini)]
        self.assertEqual(hero.count("<h1>"), 1); self.assertLess(idx.index("hero--registro"), idx.index('id="servicos"'))
        self.assertIn('<span class="rg-fita" aria-hidden="true"></span>', hero)  # a fita é decoração
        self.assertIn('<a class="btn rg-botao" data-toque="servicos" href="#servicos">', hero); self.assertIn('<a class="btn rg-botao rg-botao--onde" data-toque="onde" href="#localizacao">', hero)
        self.assertIn('<div class="rg-linha rg-linha--numero" data-toque="numero">', hero)
        self.assertIn(f'<span class="rg-valor">{self.FONE}</span>', hero); self.assertIn('<span class="rg-valor">Av. Washington Luiz, 920 - Jardim Emilia – Sorocaba, 18031-000</span>', hero)
        self.assertNotRegex(hero, r"tel:|wa\.me|Tentar pelo WhatsApp|rg-linha--horario")
        self.assertEqual(re.findall(r'href="([^"]*)"', re.sub(r"<svg.*?</svg>", "", hero)), ["#servicos", "#localizacao", self.ctx().maps_link])  # os dois atalhos e a nota do Google: nenhum outro link
        # a ordem do DOM é a ordem visual: título, apresentação, atalhos, linhas, nota
        ordem = [hero.index(x) for x in ("<h1>", 'class="destaque rg-lead"', 'data-toque="servicos"', 'data-toque="onde"', "rg-linhas", "carimbo")]
        self.assertEqual(ordem, sorted(ordem))
        classes = {c for g in re.findall(r'class="([^"]+)"', hero) for c in g.split()}
        self.assertEqual({c for c in classes if not c.startswith("rg-")}, {"hero", "hero--registro", "container", "btn", "destaque", "carimbo"})
        self.assertFalse(classes & {"nota", "placa", "chapa", "anotacao", "viveiro", "ficha", "gd-etq", "dp-bloco", "lt-fone", "nm-placa"})
        self.assertNotIn("aria-hidden", re.sub(r"<svg[^>]*>", "", hero.split("rg-acoes")[1].split("rg-pe")[0]))  # nada que se lê ou clica fica escondido do leitor de tela

    def test_hero_registro_escapa_texto_de_dado_e_nao_inventa_o_que_nao_ha(self):
        b = json.loads(json.dumps(self.b)); b["address"] = '<script>alert(1)</script> & "x", 12 - <b>Bairro</b> – Sorocaba'; b["content"]["hours"] = {"text": "<img src=x onerror=1> Das 9h.", "source": "https://www.sorocabafacil.com.br/x"}
        b["content"]["tagline"] = "<b>negrito</b> Clínica"; b["phones"][0]["display"] = "(15) <i>3233</i>-3242"; b["content"]["lead"] = "<u>lead</u> & mais"
        h = self.hero(b)
        self.assertNotRegex(h, r"<script|<img src=x|<b>negrito|<i>|<u>|<b>Bairro")  # a única <img> é a ilustrativa do tema
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;", h); self.assertIn("&lt;u&gt;lead&lt;/u&gt; &amp; mais", h); self.assertIn("rg-linha--horario", h)
        self.assertEqual(bv.vc.linha_registro("pino", "endereco", "<i>T</i>", "<b>x</b>"), '<li><div class="rg-linha rg-linha--endereco"><span class="rg-rotulo"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#pino"/></svg><b>&lt;i&gt;T&lt;/i&gt;</b></span><span class="rg-valor">&lt;b&gt;x&lt;/b&gt;</span></div></li>')
        sem = json.loads(json.dumps(self.b)); sem["whatsapp"] = {"digits": None, "display": None, "status": "none"}; sem["wa_contact"] = None; sem["phones"] = []; sem["google"] = None; sem["content"]["hours"] = None
        h = self.hero(sem)
        for ausente in ("data-toque=\"numero\"", "rg-linha--horario", "carimbo", "wa.me", "tel:", "rg-pe"):
            self.assertNotIn(ausente, h)
        self.assertIn("rg-linha--endereco", h); self.assertIn('data-toque="servicos"', h); self.assertIn('data-toque="onde"', h)  # os dois atalhos existem sempre
        sem["address"] = ""; self.assertNotIn("rg-linhas\"><li>", self.hero(sem).replace("</ul>", "</ul>\n")) if False else self.assertNotIn("rg-linha--endereco", self.hero(sem))

    def test_tema_registro_nao_repete_as_paletas_anteriores_nem_as_formulas_de_ia(self):
        t = bv.carregar_tema("registro")["tokens"]
        outros = ("caderneta", "terrario", "sinalizacao", "chapa", "gondola", "dupla", "letreiro", "numero")
        for outro in outros:
            o = bv.carregar_tema(outro)["tokens"]
            for papel in ("folha", "musgo", "carimbo", "papel", "fonte-titulo"):
                self.assertNotEqual(t[papel].lower(), o[papel].lower(), f"{outro}/{papel}")
        self.assertNotRegex(json.dumps(t), r"(?i)terracota|#c1440e|#0f0f0f|#000000|neon")
        def matiz(h):
            r, g, b = (int(h.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)); mx, mn = max(r, g, b), min(r, g, b)
            if mx == mn: return 0
            d = mx - mn; m = ((g - b) / d) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
            return m * 60
        dist = lambda a, b: min(abs(matiz(a) - matiz(b)), 360 - abs(matiz(a) - matiz(b)))
        for outro in outros:  # a ação não se parece com a de nenhum tema anterior
            self.assertGreater(dist(t["musgo"], bv.carregar_tema(outro)["tokens"]["musgo"]), 25, f"ação x {outro}")
        for outro in ("caderneta", "letreiro", "numero"):  # o subtipo `geral` é o desses três: nem a ação, nem o acento, nem o escuro podem parecer os deles
            o = bv.carregar_tema(outro)["tokens"]
            for papel in ("musgo", "carimbo", "folha"):
                self.assertGreater(dist(t[papel], o[papel]), 25, f"{outro}/{papel}")
        # a ação é carmim: o perigo (excluir) não pode ter o mesmo matiz dela, ou excluir e salvar seriam a mesma cor no painel
        self.assertGreater(dist(t["musgo"], t["perigo"]), 25)
        self.assertNotRegex(t["fonte-titulo"], r"Iowan|Palatino")  # a serifa da caderneta (mesmo subtipo)
        for arq in ("registro.vitrine.css", "registro.painel.css"):
            css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / arq).read_text(encoding="utf-8"), flags=re.S)
            self.assertNotRegex(css, r"text-transform: *uppercase|font-family:[^;]*mono|ui-monospace", arq)
            self.assertNotRegex(css, r"(?<![\w-])\.(nota|placa|chapa|anotacao)(?![\w-])", arq)
            self.assertNotRegex(css, r"(?i)\b(urgente|urgência|emergência|aberto agora|24 ?h)\b", arq)
        css = re.sub(r"/\*.*?\*/", "", "".join((SKILL / "temas" / a).read_text(encoding="utf-8") for a in ("registro.vitrine.css", "registro.painel.css")), flags=re.S)
        for seletor, corpo in re.findall(r"([^{}]+)\{([^}]*gradient\([^}]*)\}", css):  # todo gradiente tem cor SÓLIDA por baixo (o teste de contraste mede contra background-color)
            decl = re.search(r"background:([^;]+);", corpo)
            self.assertIsNotNone(decl, seletor); self.assertRegex(decl.group(1).strip(), r"(#[0-9a-fA-F]{3,8}|var\(--[a-z-]+\))$", f"{seletor.strip()}: gradiente sem cor sólida por baixo")

    def test_link_pular_para_o_conteudo_tem_contorno_claro_visivel_sobre_o_topo_escuro(self):
        """Achado da revisão: o `.pular` (fundo da cor da tinta) aparecia sobre o topo escuro do tema (quase a mesma cor, razão 1,01) e o anel era da cor do topo: o link ficava sem forma.
        O chão liso agora lhe dá um contorno branco ao receber o foco (vale para todos os temas)."""
        base = (SKILL / "components" / "vitrine.base.css").read_text(encoding="utf-8")
        self.assertRegex(base, r"\.pular:focus \{[^}]*border: 3px solid #fff")
        self.assertNotRegex(base, r"\.pular:focus-visible")  # sem sombra no chão liso (o teste do chão neutro a proíbe)

    def test_excluir_no_painel_do_registro_e_contorno_e_nao_preenchimento(self):
        """A ação é carmim e o perigo, laranja-queimado de luminância parecida: para quem não distingue as cores, excluir é CONTORNO (a ação é cheia)."""
        css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / "registro.painel.css").read_text(encoding="utf-8"), flags=re.S)
        regra = re.search(r"\.btn-perigo \{([^}]*)\}", css).group(1)
        self.assertIn("background: var(--superficie)", regra); self.assertIn("color: var(--perigo)", regra)

    def test_o_numero_de_contato_nao_usa_a_fonte_do_titulo(self):
        """Georgia, a serifa de reserva do Charter, tem algarismos de texto (alguns descem da linha): o telefone e a nota ficam na fonte do corpo."""
        css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / "registro.vitrine.css").read_text(encoding="utf-8"), flags=re.S)
        regras = {}
        for sel, corpo in re.findall(r"([^{}]+)\{([^}]*)\}", css):
            regras.setdefault(sel.strip(), []).append(corpo)
        for seletor in (".rg-valor", ".rg-linha--numero .rg-valor", ".carimbo b", ".servico .icone::before", ".passos li::before"):
            self.assertIn(seletor, regras, seletor); self.assertNotIn("--fonte-titulo", "".join(regras[seletor]), seletor)
        self.assertIn("var(--fonte-corpo)", "".join(regras[".rg-valor"])); self.assertIn("var(--fonte-corpo)", "".join(regras[".carimbo b"]))  # achado da revisão: o corpo de `.rg-valor` não era conferido

    def test_nenhuma_palavra_de_origem_ou_etnia_nos_arquivos_do_site(self):
        """Regra estrita do André (PEDIDO_DESIGN_4): a referência de pedra e montanha do nome é só de forma e de cor; nenhum arquivo dos três pacotes (texto, README, CSS e seus comentários)
        fala de origem, país, etnia ou família, nem usa os nomes dessas técnicas."""
        proibido = re.compile(r"(?i)jap[aã]o|japon|nip[ôo]n|oriental|\boriente\b|ascend[eê]ncia|descend[eê]ncia|\betnia|[ée]tnic|imigra|nikkei|\bzen\b|karesansui|\bwashi\b|石|塚")  # "Washington Luiz" (a avenida) não conta
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in pasta.rglob("*"):
                if arq.is_file() and arq.suffix in {".html", ".js", ".css", ".md", ".svg", ".json"}:
                    achado = proibido.search(arq.read_text(encoding="utf-8"))
                    self.assertIsNone(achado, f"{pasta.name}/{arq.relative_to(pasta)}: {achado and achado.group(0)}")
        for arq in ("registro.vitrine.css", "registro.painel.css", "registro.json"):
            self.assertIsNone(proibido.search((SKILL / "temas" / arq).read_text(encoding="utf-8")), arq)

    def test_camadas_de_pedra_e_montanha_sao_decoracao_sutil(self):
        """v1.5: papel com fibra, camadas de montanha no pé do hero, círculos de areia no canto da folha e as linhas sob os títulos: tudo pseudo-elemento ou fundo, sem clique, quase
        transparente, sem animação nova, sem imagem nem texto no HTML (o HTML do hero não muda)."""
        css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / "registro.vitrine.css").read_text(encoding="utf-8"), flags=re.S)
        for seletor in (r"\.hero--registro::after ", r"\.rg-folha::after ", r"\.secao-cabeca h2::after "):
            corpo = re.search(seletor + r"\{([^}]*)\}", css).group(1)
            self.assertIn("pointer-events: none", corpo, seletor); self.assertIn("data:image/svg+xml", corpo, seletor)
            for opac in re.findall(r"(?:fill|stroke)-opacity='([\d.]+)'", corpo):
                self.assertLessEqual(float(opac), .5, seletor)
        self.assertRegex(css, r"body \{ background: url\(\"data:image/svg\+xml[^)]*feTurbulence[^;]*var\(--papel\); \}")  # a fibra do papel tem a cor sólida por baixo
        self.assertNotRegex(css, r"https?://(?!www\.w3\.org/2000/svg)")  # nenhum recurso externo
        idx = self.ler(self.premium, "index.html")
        hero = idx[idx.index('<section class="hero hero--registro">'):]; hero = hero[:hero.index("</section>")]
        self.assertNotIn("<img", hero); self.assertNotIn("<svg viewBox=\"0 0 1200", hero)

    def test_margem_e_fita_nao_cobrem_texto_nem_dependem_de_movimento(self):
        css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / "registro.vitrine.css").read_text(encoding="utf-8"), flags=re.S)
        for seletor in (r"\.rg-folha::before ", r"\.rg-fita ", r"\.ficha::before "):
            self.assertIn("pointer-events: none", re.search(seletor + r"\{([^}]*)\}", css).group(1), seletor)
        self.assertIn("body:has(.wa-flutuante)", css)  # a folga do botão flutuante só existe quando o botão existe: sem ele a linha usa a largura toda

    # ---- README dos três pacotes ----
    def test_readme_dos_tres_pacotes(self):
        r = {n: self.ler(p, "README.md") for n, p in (("premium", self.premium), ("basico", self.basico), ("essencial", self.essencial))}
        for n, txt in r.items():
            for esperado in ("Telefone: o pacote usa só o fixo (15) 3233-3242", "Horário e \"24 horas\"", "Nome do Guia-se", "Bairro e CEP", "Avaliações de clientes", "Redes e página própria"):
                self.assertIn(esperado, txt, n)
        for n in ("premium", "basico"):
            self.assertIn("Os seis serviços do site", r[n]); self.assertIn("a da acupuntura é uma bandeja com agulhas embaladas", r[n]); self.assertIn("vet-acupuntura.webp", r[n])
        self.assertNotIn("Os seis serviços do site", r["essencial"])  # o ESSENCIAL não tem vitrine
        self.assertNotIn("painel", r["basico"].split("## Pendências a confirmar")[1].split("\n## ")[0].lower())  # o BÁSICO nunca cita o painel nas pendências
        self.assertIn("subtipo hospital24h", r["premium"]); self.assertIn("subtipo hospital24h", r["essencial"]); self.assertNotIn("hospital24h", r["basico"])

    def test_subtipo_geral_nao_acrescenta_nada_ao_painel(self):
        for pasta in (self.premium, self.essencial):
            self.assertFalse((pasta / "painel/js/modulos/internacao.js").exists()); self.assertFalse((pasta / "painel/js/modulos/exames.js").exists())
        self.assertNotIn("painel", "".join(self.ler(self.basico, p) for p in self.PAGINAS).lower())

    def test_nenhuma_palavra_de_bastidor_nos_arquivos_do_cliente(self):
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in pasta.rglob("*"):
                if arq.is_file() and arq.suffix in {".html", ".js", ".css", ".md", ".svg"}:
                    achado = PROIBIDOS_CLIENTE.search(arq.read_text(encoding="utf-8"))
                    self.assertIsNone(achado, f"{pasta.name}/{arq.relative_to(pasta)}: {achado and achado.group(0)}")

    def test_regerar_por_cima_nao_perde_o_material_do_cliente(self):
        d = self.tmp / "material9"
        bv.gerar(SLUG9, saida=str(d))
        mat = d / "assets" / "material.js"
        mat.write_text(mat.read_text(encoding="utf-8").replace("galeria = [];", 'galeria = [{src: "assets/img/fachada.jpg", alt: "Fachada"}];'), encoding="utf-8")
        for kwargs in ({"vitrine": False}, {"gestao": False}, {}):
            bv.gerar(SLUG9, saida=str(d), **kwargs)
        self.assertIn("Fachada", mat.read_text(encoding="utf-8"))


from html.parser import HTMLParser  # noqa: E402


def textos_com_prazo(html: str, padrao: re.Pattern):
    """(texto, unidade) de cada trecho de TEXTO VISÍVEL que cita o prazo: `unidade` é o texto inteiro do elemento de texto mais próximo (p, li, article, dd, td, figure) que o contém. Serve para provar
    que o prazo nunca aparece sozinho: a unidade inteira tem de atribuir (segundo/divulga/se apresenta...)."""
    class P(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.pilha, self.achados, self.oculto = [], [], 0
        def handle_starttag(self, tag, attrs):
            if tag in ("script", "style"):
                self.oculto += 1
            if tag not in ("br", "img", "meta", "link", "input", "use", "path", "source"):
                self.pilha.append({"tag": tag, "texto": [], "filhos": []})
        def handle_endtag(self, tag):
            if tag in ("script", "style"):
                self.oculto -= 1
            if self.pilha and self.pilha[-1]["tag"] == tag:
                n = self.pilha.pop()
                if self.pilha:
                    self.pilha[-1]["filhos"].append(n)
                else:
                    self.raiz = n
        def handle_data(self, d):
            if self.pilha and not self.oculto:
                self.pilha[-1]["texto"].append(d)
    p = P(); p.feed(html)
    def todo(n):
        return " ".join(n["texto"]) + " " + " ".join(todo(f) for f in n["filhos"])
    saida = []
    def desce(n, ancestrais):
        proprio = " ".join(n["texto"])
        if padrao.search(proprio):
            unidade = next((a for a in reversed(ancestrais + [n]) if a["tag"] in ("p", "li", "article", "dd", "td", "figure")), None)
            saida.append((re.sub(r"\s+", " ", proprio).strip(), re.sub(r"\s+", " ", todo(unidade)).strip() if unidade else None))
        for f in n["filhos"]:
            desce(f, ancestrais + [n])
    if getattr(p, "raiz", None):
        desce(p.raiz, [])
    return saida


PRAZO = re.compile(r"(?i)\b24\s?-?\s?(?:horas?|hrs?|hs?)\b|\ba qualquer hora\b")
ATRIBUI_PRAZO = re.compile(r"(?i)\b(segundo|divulga|se apresenta|informa|registra|lista|cita)\b")


class TestRegra27PrazoSoComAFonte(unittest.TestCase):
    """Regra 27 (v1.4): enquanto o horário está a confirmar, o prazo ("24 horas", "24h", "a qualquer hora") nunca aparece solto na copy: nome com prazo no texto, título de serviço, apresentação."""

    FONTE = "a rede credenciada da Petlove"

    def test_fonte_entra_logo_depois_do_primeiro_prazo(self):
        f = bv.vc._com_a_fonte_depois_do_prazo
        self.assertEqual(f("A unidade tem atendimento 24 horas. Chame no WhatsApp.", self.FONTE), "A unidade tem atendimento 24 horas, segundo a rede credenciada da Petlove. Chame no WhatsApp.")
        self.assertEqual(f("Atendimento 24h todos os dias.", self.FONTE), "Atendimento 24h, segundo a rede credenciada da Petlove, todos os dias.")  # no meio da frase leva a vírgula dos dois lados
        self.assertEqual(f("Emergência a qualquer hora. Ligue.", "o Instagram do negócio"), "Emergência a qualquer hora, segundo o Instagram do negócio. Ligue.")
        self.assertEqual(f("24 horas, 24 horas.", self.FONTE).count("segundo"), 1)  # só depois do primeiro
        for igual in ("Sem prazo nenhum.", "O guia informa atendimento 24 horas.", "A unidade se apresenta como 24 horas.", "Divulga 24h.", "", "Segundo o guia, 24 horas."):
            self.assertEqual(f(igual, self.FONTE), igual, igual)  # já atribui ou não cita o prazo
        self.assertEqual(f("Atendimento 24 horas.", ""), "Atendimento 24 horas.")  # sem fonte, nada é inventado
        for nao_texto in (None, 5, ["24 horas"], {"a": "24 horas"}):
            self.assertEqual(f(nao_texto, self.FONTE), nao_texto)
        self.assertEqual(f("Atendimento 124 horas.", self.FONTE), "Atendimento 124 horas.")  # 124 não é 24

    def _b(self):
        return json.loads(json.dumps(model.load_business(SLUG10)))

    def test_nome_com_prazo_no_texto_titulo_de_servico_e_apresentacao(self):
        b = self._b(); c = b["content"]
        novo = bv.vc._prazo_so_com_a_fonte(c, b)
        self.assertEqual(c, self._b()["content"])  # a entrada não é alterada
        self.assertNotIn("Unidade Veterinária", " ".join(novo["about"])); self.assertIn("A Pilares atende na Av. Washington Luiz, 1887", novo["about"][0])  # o nome curto do cadastro (`display_name`), o mesmo da marca
        self.assertIn("com atendimento 24 horas, segundo a rede credenciada da Petlove. Chame no WhatsApp", novo["lead"])
        self.assertEqual([s["title"] for s in novo["services"]], ["Atendimento clínico e especializado", "Exames", "Internação", "Cirurgias", "Atendimento de emergência"])
        self.assertEqual(novo["form"]["topic_options"][-1], "Atendimento de emergência")
        self.assertIn("emergência 24h.", novo["about"][0])  # o parágrafo já atribui ("divulga"): não muda
        self.assertEqual(novo["about"][0].count("segundo"), 0)

    def test_so_liga_com_horario_a_confirmar_e_receita_com_fonte(self):
        """Pelo contexto: sem a pendência do horário ou sem a receita `horario_com_fonte`, a copy fica como está (os outros 9 sites não mudam)."""
        perfil = bv.carregar_perfil(SLUG10); tema = bv.carregar_tema("pilares")
        b = self._b(); sub = bv.carregar_subtipo("hospital24h")
        ligado = bv.vc.contexto(b, True, tema=tema, subtipo=sub, perfil=perfil)
        self.assertEqual(ligado.services[-1]["title"], "Atendimento de emergência")
        b2 = self._b(); b2["research"]["pending"] = ["Confirmar com o negócio qual é o WhatsApp."]
        solto = bv.vc.contexto(b2, True, tema=tema, subtipo=sub, perfil=perfil)
        self.assertEqual(solto.services[-1]["title"], "Atendimento de emergência 24h"); self.assertNotIn("segundo", solto.lead)
        sem_receita = json.loads(json.dumps(sub)); sem_receita["vitrine"]["horario_com_fonte"] = False  # a receita que liga a regra (todo subtipo a tem desde a 0.6)
        desligado = bv.vc.contexto(self._b(), True, tema=tema, subtipo=sem_receita, perfil=perfil)
        self.assertEqual(desligado.services[-1]["title"], "Atendimento de emergência 24h"); self.assertNotIn("segundo a rede credenciada", desligado.lead)
        self.assertEqual(bv.vc.contexto(self._b(), True, tema=tema, subtipo=bv.carregar_subtipo("geral"), perfil=perfil).services[-1]["title"], "Atendimento de emergência")  # `geral` também tem a receita

    def test_entrada_hostil_nao_derruba(self):
        b = self._b(); c = b["content"]
        c["lead"] = None; c["about"] = [None, 5, "A <b>Pilares - Unidade Veterinária 24h</b> atende 24 horas."]; c["services"] = [{"title": None, "text": 5}, {"title": "24 horas", "text": "x"}, {"title": "Plantão 24h", "text": "y"}]
        c["form"] = {"topic_options": [None, "24h", "Plantão 24 horas"]}
        novo = bv.vc._prazo_so_com_a_fonte(c, b)
        self.assertIsNone(novo["lead"]); self.assertEqual(novo["about"][:2], [None, 5])
        self.assertEqual([s["title"] for s in novo["services"]], [None, "24 horas", "Plantão"])  # título que só tem o prazo não vira vazio
        self.assertEqual(novo["form"]["topic_options"], [None, "24h", "Plantão"])
        self.assertEqual(novo["about"][2], "A <b>Pilares</b> atende 24 horas, segundo a rede credenciada da Petlove.")  # o nome inteiro do cadastro vira o nome curto e o prazo que sobra ganha a fonte (o escape é de quem escreve o HTML)
        b3 = self._b(); b3["content"]["about"] = ["A Pilares - Unidade atende."]
        self.assertEqual(bv.vc._prazo_so_com_a_fonte(b3["content"], b3)["about"], ["A Pilares - Unidade atende."])  # só o nome INTEIRO do cadastro é trocado
        sem_hours = self._b(); sem_hours["content"]["hours"] = None
        self.assertEqual(bv.vc._prazo_so_com_a_fonte(sem_hours["content"], sem_hours)["lead"], sem_hours["content"]["lead"])  # sem fonte do horário, a apresentação não ganha nada
        for ruim in ({}, {"services": None, "about": None, "form": None}):
            bv.vc._prazo_so_com_a_fonte(ruim, b)

    def test_ano_do_cnpj_aberto_desde_e_inicio_das_atividades(self):
        r = bv.vc._CNPJ_ANO
        self.assertEqual(r.search("com CNPJ aberto em 2014,").group(2), "2014")
        self.assertEqual(r.search("A empresa tem CNPJ aberto desde novembro de 2022 e").group(2), "2022")
        self.assertEqual(r.search("CNPJ aberto desde 2020").group(2), "2020")
        self.assertIsNone(r.search("CNPJ aberto desde novembro de 2022 (segundo o GuiaPJ)")); self.assertIsNone(r.search("CNPJ ativo desde 2022"))
        pesq = {"facts": [{"text": "Cadastrada na Receita Federal, início das atividades em 04/11/2022, situação cadastral ativa.", "source": "https://guiapj.com.br/consulta-cnpj/1"}]}
        self.assertEqual(bv.vc._fonte_do_ano_de_abertura(pesq, "2022"), "o GuiaPJ")
        self.assertEqual(bv.vc._fonte_do_ano_de_abertura(pesq, "2021"), "")  # outro ano não é sustentado
        self.assertEqual(bv.vc._fonte_do_ano_de_abertura({"facts": [{"text": "situação ativa desde 2022", "source": "https://guiapj.com.br/x"}]}, "2022"), "")

    def test_imagem_do_card_exames_so_pelo_titulo(self):
        f = bv.vc.foto_servico
        self.assertEqual(f({"title": "Exames", "text": "Exames para apoiar o atendimento do seu animal."})[0], "vet-laboratorio")
        self.assertEqual(f({"title": "Exame", "text": "x"})[0], "vet-laboratorio")
        self.assertNotEqual(f({"title": "Consulta clínica", "text": "Inclui o exame clínico completo."})[0], "vet-laboratorio")  # "exame clínico" no texto não é laboratório
        self.assertNotEqual(f({"title": "Exame clínico", "text": "x"})[0], "vet-laboratorio")
        self.assertEqual(f({"title": "Exames de imagem", "text": "Tomografia."})[0], "vet-tomografia")  # a regra mais específica vem antes

    def test_nome_de_fonte_do_pilares(self):
        self.assertEqual(bv.vc.nome_da_fonte("https://saude.petlove.com.br/rede-credenciada/sp/sorocaba/pilares-vet", site=True), "a rede credenciada da Petlove")
        self.assertEqual(bv.vc.nome_da_fonte("https://www.instagram.com/pilaresvet/", site=True), "o Instagram do negócio")

    def test_atribuicao_vale_na_frase_do_prazo_e_o_ano_do_cnpj_nao_atribui_o_prazo(self):
        """Achado da revisão do site 10: o parágrafo inteiro valia como "já atribui" (o "(segundo o GuiaPJ)" do ano do CNPJ, ou "lista" noutra frase, deixava o prazo solto)."""
        f = bv.vc._com_a_fonte_depois_do_prazo; F = self.FONTE; S = f", segundo {F}"
        self.assertEqual(f("A empresa tem CNPJ aberto desde novembro de 2022 (segundo o GuiaPJ) e atende 24 horas todos os dias.", F), f"A empresa tem CNPJ aberto desde novembro de 2022 (segundo o GuiaPJ) e atende 24 horas{S}, todos os dias.")
        self.assertEqual(f("Atendemos 24 horas. Veja a lista de serviços.", F), f"Atendemos 24 horas{S}. Veja a lista de serviços.")  # "lista" noutra frase não atribui
        self.assertEqual(f("Divulga fotos no Instagram. Atende 24h.", F), f"Divulga fotos no Instagram. Atende 24h{S}.")
        self.assertEqual(f("Atende 24 horas. Plantão 24 horas.", F), f"Atende 24 horas{S}. Plantão 24 horas{S}.")  # uma fonte por frase
        self.assertEqual(f("Atende 24 horas, todos os dias, 24 horas.", F).count("segundo"), 1)  # dois prazos na mesma frase: uma fonte só
        self.assertEqual(f("A unidade divulga atendimento clínico, exames e emergência 24h.", F), "A unidade divulga atendimento clínico, exames e emergência 24h.")  # a frase atribui
        self.assertEqual(f("Resultado dos exames em até 24 horas. Retorno dentro de 24 horas.", F), "Resultado dos exames em até 24 horas. Retorno dentro de 24 horas.")  # outro assunto
        self.assertEqual(f("Atendimento 24 horas", F), f"Atendimento 24 horas{S}")  # sem ponto final: sem vírgula a mais
        self.assertEqual(f("Atendimento (24 horas) todos os dias.", F), f"Atendimento (24 horas{S}) todos os dias.")
        self.assertEqual(f('O horário é "24 horas" mesmo.', F), f'O horário é "24 horas{S}" mesmo.')
        self.assertEqual(f("Atende 24 horas - com plantão.", F), f"Atende 24 horas{S} - com plantão.")  # travessão depois do prazo: sem vírgula
        for forma in ("vinte e quatro horas", "24/7", "H24", "dia e noite", "a qualquer hora"):
            self.assertIn("segundo", f(f"Atende {forma}. Ligue.", F), forma)
        self.assertEqual(f("Atende 124 horas.", F), "Atende 124 horas.")

    def test_titulo_com_traco_e_nome_com_travessao(self):
        self.assertEqual(bv.vc._sem_o_prazo("Emergência - 24h"), "Emergência"); self.assertEqual(bv.vc._sem_o_prazo("Atendimento 24 horas"), "Atendimento"); self.assertEqual(bv.vc._sem_o_prazo("24 horas"), "24 horas")
        self.assertEqual(bv.vc._sem_o_prazo(None), None); self.assertEqual(bv.vc._sem_o_prazo(7), 7)
        b = json.loads(json.dumps(model.load_business(SLUG10))); b["content"]["about"] = ["A Pilares – Unidade Veterinária 24h atende.", "A Pilares  -  Unidade Veterinária 24h tem."]  # travessão longo e espaços duplos
        novo = bv.vc._prazo_so_com_a_fonte(b["content"], b)["about"]
        self.assertEqual(novo, ["A Pilares atende.", "A Pilares tem."])

    def test_etapas_servico_sem_fonte_e_horario_sem_fonte(self):
        b = json.loads(json.dumps(model.load_business(SLUG10))); c = b["content"]
        c["how_to"] = [{"title": "Plantão 24 horas", "text": "Atendemos 24 horas: ligue antes de sair."}, {"title": "Venha", "text": "Sem prazo."}]
        c["services"] = [{"title": "Emergência", "text": "Atende a qualquer hora. Ligue."}]  # serviço sem `source`: usa a fonte do horário
        novo = bv.vc._servicos_com_a_fonte_do_prazo(bv.vc._prazo_so_com_a_fonte(c, b))
        self.assertEqual(novo["how_to"][0]["title"], "Plantão"); self.assertEqual(novo["how_to"][0]["text"], f"Atendemos 24 horas, segundo {self.FONTE}: ligue antes de sair.")
        self.assertEqual(novo["services"][0]["text"], f"Atende a qualquer hora, segundo {self.FONTE}. Ligue.")
        for sem in (None, "texto", 5, [], {"text": "Atendimento 24 horas."}, {"text": "Atendimento 24 horas.", "source": "sem endereço"}):  # fonte do horário ausente, que não é endereço, ou `hours` que nem é objeto: não derruba e nada é inventado
            x = json.loads(json.dumps(b)); x["content"]["hours"] = sem
            self.assertEqual(bv.vc._prazo_so_com_a_fonte(x["content"], x)["lead"], x["content"]["lead"])  # sem fonte, a apresentação fica como está (a trava é quem para o gerador)
            self.assertEqual(bv.vc._horario_com_fonte(x["content"]), x["content"])  # nenhum endereço de fonte: o horário não ganha nada

    def test_trava_para_o_gerador_quando_sobra_prazo_solto(self):
        """`conferir_prazo_com_a_fonte` (como `conferir_numero_fora`): sem a fonte do horário a regra não consegue atribuir, e o gerador PARA em vez de publicar o prazo solto."""
        perfil = bv.carregar_perfil(SLUG10); tema = bv.carregar_tema("pilares"); sub = bv.carregar_subtipo("hospital24h")
        b = json.loads(json.dumps(model.load_business(SLUG10))); b["content"]["hours"]["source"] = None
        with self.assertRaises(SystemExit) as e:
            bv.vc.contexto(b, True, tema=tema, subtipo=sub, perfil=perfil)
        self.assertIn("apresentação", str(e.exception)); self.assertIn("hours.source", str(e.exception))
        b = json.loads(json.dumps(model.load_business(SLUG10))); b["content"]["services"][0]["title"] = "24 horas"  # título que só tem o prazo não sai
        with self.assertRaises(SystemExit) as e:
            bv.vc.contexto(b, True, tema=tema, subtipo=sub, perfil=perfil)
        self.assertIn("título de serviço", str(e.exception))
        ok = json.loads(json.dumps(model.load_business(SLUG10))); bv.vc.contexto(ok, True, tema=tema, subtipo=sub, perfil=perfil)  # o Pilares passa
        c = {"lead": "Atendemos 24 horas, segundo o guia.", "about": ["Divulga 24h."], "services": [{"title": "Emergência", "text": "Plantão 24 horas, segundo o guia."}], "how_to": [], "form": {"topic_options": []}}
        bv.vc.conferir_prazo_com_a_fonte(c)  # tudo atribuído na frase do prazo: passa; cada um dos casos abaixo, sozinho, para o gerador
        for ruim in ({"lead": "Atendemos 24 horas."}, {"about": ["Atende 24h."]}, {"how_to": [{"title": "x", "text": "24 horas."}]}, {"form": {"topic_options": ["Plantão 24h"]}}):
            with self.assertRaises(SystemExit):
                bv.vc.conferir_prazo_com_a_fonte({"lead": "", "about": [], "services": [], "how_to": [], "form": {"topic_options": []}, **ruim})
        for passa in (None, 5, [], {"lead": None, "about": None, "services": None, "how_to": None, "form": None}, {}):
            bv.vc.conferir_prazo_com_a_fonte(passa if isinstance(passa, dict) else {})


class TestSite10Pilares(unittest.TestCase):
    """Site 10 (Pilares, hospital 24h: celular só listado, horário e serviços de fontes a confirmar) nos três pacotes. Subtipo `hospital24h`, tema `pilares`, hero `pilares`."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="vet-build10-"))
        cls.premium = bv.gerar(SLUG10, saida=str(cls.tmp / "premium"))
        cls.basico = bv.gerar(SLUG10, gestao=False, saida=str(cls.tmp / "basico"))
        cls.essencial = bv.gerar(SLUG10, vitrine=False, saida=str(cls.tmp / "essencial"))
        cls.b = model.load_business(SLUG10)
        cls.c = cls.b["content"]
        cls.perfil = bv.carregar_perfil(SLUG10)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    PAGINAS = ("index.html", "sobre.html", "contato.html")
    WA = "5515998009874"

    def ler(self, pasta, rel):
        return (pasta / rel).read_text(encoding="utf-8")

    def arquivos_do_site(self, pasta, sufixos=(".html", ".js", ".css", ".json", ".svg")):
        return [a for a in pasta.rglob("*") if a.is_file() and a.suffix in sufixos]

    def ctx(self, b=None, gestao=True):
        return bv.vc.contexto(b or self.b, gestao, tema=bv.carregar_tema(self.perfil["tema"]), subtipo=bv.aplicar_opcoes(bv.carregar_subtipo(self.perfil["subtipo"]), self.perfil["opcoes"]), perfil=self.perfil)

    def hero(self, b=None):
        return bv.vc.hero_pilares(self.ctx(b))

    # ---- dados e honestidade ----
    def test_conteudo_e_vitrine_passam_nos_validadores_do_projeto(self):
        self.assertEqual(validate.check_content(self.b), [])
        for pasta in (self.premium, self.basico):
            self.assertEqual(validate.check_site(self.b, str(pasta)), [], pasta.name)

    def test_celular_listado_vira_o_unico_botao_de_whatsapp(self):
        self.assertEqual(self.b["whatsapp"]["status"], "mobile-listed")
        for pasta in (self.premium, self.basico):
            for pagina in self.PAGINAS:
                html = self.ler(pasta, pagina)
                um_whatsapp_so_icone(self, html, self.WA, f"{pasta.name}/{pagina}")
                self.assertNotRegex(html, r"ligar-flutuante|tel:|Tentar pelo WhatsApp|<form|<button", pagina)
                self.assertIn("(15) 99800-9874", html)  # o número também como texto
        r = self.ler(self.premium, "README.md")
        self.assertIn("WhatsApp não confirmado", r); self.assertIn("Botão de contato: um só", r)

    def test_outro_celular_da_receita_fica_fora_do_pacote_inteiro(self):
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in self.arquivos_do_site(pasta):
                self.assertNotRegex(arq.read_text(encoding="utf-8"), r"99980[\s .-]?0987|999800987", f"{pasta.name}/{arq.relative_to(pasta)}")
            r = self.ler(pasta, "README.md")
            self.assertNotRegex(r, r"99980[\s\u00a0.-]?0987|999800987")  # nem no README: a página da Receita mistura o contato da empresa com dados de sócio pessoa física
            self.assertIn("https://guiapj.com.br/consulta-cnpj/48515234000106", r); self.assertIn("traz outro número de contato", r)
        self.assertEqual(self.ctx().wa_digits, self.WA)

    def test_o_prazo_nunca_aparece_solto_no_texto_da_vitrine(self):
        """Regra 27: toda unidade de texto (parágrafo, item de lista, card, dado) que cita "24 horas"/"24h"/"a qualquer hora" também atribui o prazo a uma fonte ou à própria unidade."""
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            achados = textos_com_prazo(html, PRAZO)
            if pagina in ("index.html", "sobre.html"):
                self.assertGreater(len(achados), 0, pagina)  # as duas páginas citam o prazo (com atribuição): o teste não pode passar vazio
            for atributo in re.findall(r'\b(?:alt|aria-label|title|content)="([^"]*)"', html):  # atributos também são lidos (leitor de tela, dica, buscador)
                self.assertNotRegex(atributo, PRAZO, f"{pagina}: prazo num atributo: {atributo[:120]}")
            for trecho, unidade in achados:
                self.assertIsNotNone(unidade, f"{pagina}: prazo fora de uma unidade de texto: {trecho}")
                self.assertRegex(unidade, ATRIBUI_PRAZO, f"{pagina}: o prazo aparece sem atribuição: {trecho!r} em {unidade[:200]!r}")
        # título, descrição e dados estruturados nunca citam o prazo (rege 12 e 17); o nome completo do cadastro só vive no README
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            cabeca = html.split("</head>")[0]
            self.assertNotRegex(cabeca, r"(?i)24\s?-?\s?h", pagina)
        for pasta in (self.premium, self.basico):
            for arq in self.arquivos_do_site(pasta):
                self.assertNotIn("Pilares - Unidade Veterinária 24h", arq.read_text(encoding="utf-8"), f"{pasta.name}/{arq.relative_to(pasta)}")
        self.assertIn("Pilares - Unidade Veterinária 24h", self.ler(self.premium, "README.md"))

    def test_o_prazo_aparece_nos_tres_lugares_com_a_fonte_certa(self):
        idx = self.ler(self.premium, "index.html")
        self.assertIn("com atendimento 24 horas, segundo a rede credenciada da Petlove.", idx)  # apresentação
        self.assertIn("Atendimento 24 horas, segundo a rede credenciada da Petlove.", idx)  # horário (hero e Onde estamos)
        self.assertIn("a qualquer hora, segundo o Instagram do negócio.", idx)  # texto do serviço de emergência
        self.assertIn("<h3>Atendimento de emergência</h3>", idx); self.assertNotIn("<h3>Atendimento de emergência 24h</h3>", idx)
        sobre = self.ler(self.premium, "sobre.html")
        self.assertIn("A Pilares atende na Av. Washington Luiz, 1887", sobre); self.assertNotIn("Unidade Veterinária", sobre)
        self.assertIn("CNPJ aberto desde novembro de 2022 (segundo o GuiaPJ)", sobre)

    def test_json_ld_e_titulos_usam_o_nome_curto_e_nao_trazem_horario(self):
        for pagina in self.PAGINAS:
            html = self.ler(self.premium, pagina)
            for bloco in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
                ld = json.loads(bloco)
                self.assertEqual(ld["name"], "Pilares"); self.assertNotIn("openingHours", ld); self.assertNotIn("aggregateRating", ld)
            self.assertRegex(re.search(r"<title>(.*?)</title>", html).group(1), r"^(Pilares \| Unidade veterinária em Sorocaba|Sobre \| Pilares|Contato \| Pilares)$")

    def test_cinco_servicos_com_cinco_imagens_ilustrativas_legendadas(self):
        idx = self.ler(self.premium, "index.html")
        self.assertEqual(idx.count('<article class="servico '), 5)
        figuras = re.findall(r'<figure class="ilustra" data-ilustrativa><img src="assets/ilustrativas/([a-z-]+)\.webp" alt="([^"]+)"[^>]*><figcaption>Imagem ilustrativa</figcaption></figure>', idx)
        self.assertEqual([f[0] for f in figuras], ["vet-atendimento", "vet-laboratorio", "vet-internacao", "vet-cirurgia", "vet-emergencia"])
        self.assertEqual(len({f[0] for f in figuras}), 5)
        for nome, alt in figuras:
            self.assertNotRegex(alt, r"(?i)pilares|equipe|fachada|paciente")
        self.assertEqual(sorted(a.name for a in (self.premium / "assets" / "ilustrativas").iterdir()), sorted(f"{n}.webp" for n, _ in figuras))
        self.assertEqual(sorted(a.name for a in (self.basico / "assets" / "ilustrativas").iterdir()), sorted(f"{n}.webp" for n, _ in figuras))

    def test_nada_alem_do_json_e_da_interface_do_gerador_mundo_fechado(self):
        ctx = self.ctx()
        textos = [ctx.tagline, ctx.lead, ctx.meta, *ctx.about, ctx.endereco, ctx.hours["text"], *ctx.form["topic_options"]]
        for chave in ("services", "highlights", "how_to"):
            for item in getattr(ctx, chave):
                textos += [item["title"], item["text"]]
        textos += [self.c["services"][-1]["title"], self.c["hours"]["text"]]  # o título do cadastro (com o prazo) não aparece, mas o texto cru do horário sim, atribuído
        interface = ["Pilares", "Ir para o conteúdo", "Início", "Serviços", "Sobre", "Contato", "(15) 99800-9874", "WhatsApp", "Telefone", "Endereço", "Horário", "Como chegar", "4,6", "Google Maps", "Ver serviços",
                     "Onde fica", "Como funciona", "Fale com a equipe", "Abrir no Google Maps", "Páginas", "Acesso da equipe", "As informações deste site têm caráter informativo e não substituem a consulta com médico(a) veterinário(a).",
                     "Sobre Pilares", "Onde atendemos", "Avaliações", "nota 4,6 com 123 avaliações no Google Maps", "Ver no Google Maps", "Onde estamos", "Ver contatos", "Imagem ilustrativa", "criado por andremachado.design",
                     "Diferenciais", "Instagram", "@pilaresvet", "Ver no Instagram", "e mais", "I", "II", "III", "IV", "V"]
        for pagina in self.PAGINAS:
            resto = htmllib.unescape(visivel(self.ler(self.premium, pagina)))
            for tx in sorted(textos + interface, key=len, reverse=True):
                resto = resto.replace(tx, " ")
            self.assertEqual(re.sub(r"[\s|·.,()?!:–-]+", "", resto), "", f"{pagina}: texto que não é do cadastro nem da interface do gerador: {resto.strip()[:300]}")

    # ---- identidade: o tema pilares e o hero ----
    def test_perfil_aplica_tema_pilares_e_subtipo_hospital24h(self):
        self.assertEqual((self.perfil["subtipo"], self.perfil["tema"], self.perfil["opcoes"], self.perfil["retirar_servicos"], self.perfil["pesquisa_pendente"]), ("hospital24h", "pilares", [], [], []))
        idx = self.ler(self.premium, "index.html")
        for simbolo in ("pilares", "pata", "fone", "pino", "relogio"):
            self.assertIn(f"<symbol id='{simbolo}'", idx)
        for ausente in ("registro", "numero", "letreiro", "dupla", "mira", "escala", "cruz", "pena", "escama", "etiqueta", "seta"):
            self.assertNotIn(f"<symbol id='{ausente}'", idx)
        css = self.ler(self.premium, "assets/style.css")
        self.assertIn("tema pilares", css); self.assertIn("pilares", self.ler(self.premium, "painel/painel.css"))
        self.assertIn("#ffcdbd", self.ler(self.premium, "assets/favicon.svg"))
        self.assertNotRegex(css, r"\.carimbo[^{]*\{[^}]*clip-path"); self.assertNotRegex(css, r"@import|url\(\s*[\"']?https?:"); self.assertIn("prefers-reduced-motion", css)
        tema_css = css.split("tema pilares")[1]
        self.assertEqual(re.findall(r"animation(?:-name)?\s*:\s*([a-z-]+)", tema_css), ["pl-erguer"])  # uma única animação de entrada (as colunas se erguem)
        self.assertEqual(set(re.findall(r"@keyframes\s+([\w-]+)", tema_css)), {"pl-erguer"}); self.assertNotRegex(tema_css, r"infinite|!important")
        self.assertEqual(bv.carregar_tema("pilares")["hero"], "pilares"); self.assertIn("pilares", bv.vc.HEROIS)
        self.assertIn("pilares:", self.ler(self.premium, "painel/js/ui.js"))  # o ícone da marca no painel
        for pasta in (self.premium, self.essencial):  # hospital24h: telas de internação e plantão no painel; a recepção NÃO vê leitos (a opção não está ligada)
            self.assertTrue((pasta / "painel/js/modulos/internacao.js").exists())
            self.assertNotIn("recepcao_ve_leitos", self.ler(pasta, "assets/site-config.js"))

    def test_hero_pilares_a_fachada_e_a_ordem_de_leitura(self):
        idx = self.ler(self.premium, "index.html")
        ini = idx.index('<section class="hero hero--pilares">'); hero = idx[ini:idx.index("</section>", ini)]
        self.assertEqual(hero.count("<h1>"), 1); self.assertLess(idx.index("hero--pilares"), idx.index('id="servicos"'))
        self.assertIn('<a class="btn pl-botao" data-toque="servicos" href="#servicos">', hero); self.assertIn('<a class="btn pl-botao pl-botao--onde" data-toque="onde" href="#localizacao">', hero)
        self.assertIn('<div class="pl-linha pl-linha--numero" data-toque="numero"><span class="pl-rotulo"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#fone"/></svg><b>WhatsApp</b></span><span class="pl-valor">(15) 99800-9874</span></div>', hero)
        self.assertIn('<span class="pl-valor">Av. Washington Luiz, 1887 - Jardim America – Sorocaba, 18046-700</span>', hero)  # o endereço do cadastro, sem nada a mais
        fixo = json.loads(json.dumps(self.b)); fixo["whatsapp"] = {"digits": "551532333242", "display": "(15) 3233-3242", "status": "landline-unverified"}; fixo["wa_contact"] = None; fixo["phones"] = [{"digits": "551532333242", "display": "(15) 3233-3242", "kind": "landline"}]
        self.assertIn('<b>Telefone</b></span><span class="pl-valor">(15) 3233-3242</span>', self.hero(fixo))  # só fixo: o degrau se chama Telefone (não WhatsApp)
        self.assertNotRegex(hero, r"tel:|wa\.me|Tentar pelo WhatsApp")
        self.assertEqual(re.findall(r'href="([^"]*)"', re.sub(r"<svg.*?</svg>", "", hero)), ["#servicos", "#localizacao", self.ctx().maps_link])
        colunata = re.search(r'<ol class="pl-colunas" style="--n:5" aria-hidden="true">(.*?)</ol>', hero, re.S).group(1)
        self.assertEqual(re.findall(r"<b>(.*?)</b>", colunata), ["Atendimento clínico e especializado", "Exames", "Internação", "Cirurgias", "Atendimento de emergência"])  # os títulos do cadastro, sem o prazo
        self.assertEqual(colunata.count('<li class="pl-coluna"'), 5)
        ordem = [hero.index(x) for x in ("<h1>", 'class="destaque pl-lead"', 'data-toque="servicos"', 'data-toque="onde"', "pl-colunas", "pl-degraus", "carimbo")]
        self.assertEqual(ordem, sorted(ordem))
        classes = {c for g in re.findall(r'class="([^"]+)"', hero) for c in g.split()}
        self.assertEqual({c for c in classes if not c.startswith("pl-")}, {"hero", "hero--pilares", "container", "btn", "destaque", "carimbo"})
        self.assertFalse(classes & {"nota", "placa", "chapa", "anotacao", "viveiro", "ficha", "gd-etq", "dp-bloco", "lt-fone", "nm-placa", "rg-folha"})
        self.assertNotIn("aria-hidden", re.sub(r"<svg[^>]*>", "", hero.split("pl-friso")[1].split("pl-colunas")[0]))  # o friso (título, texto, atalhos) é lido; só a colunata é decoração
        self.assertIn("segundo a rede credenciada da Petlove", hero)  # o horário e a apresentação levam a fonte

    def test_hero_pilares_escapa_texto_e_nao_inventa_o_que_nao_ha(self):
        b = json.loads(json.dumps(self.b)); b["address"] = '<script>alert(1)</script> & "x", 12 - <b>Bairro</b> – Sorocaba'; b["content"]["hours"] = {"text": "<img src=x onerror=1> Das 9h.", "source": "https://www.sorocabafacil.com.br/x"}
        b["content"]["tagline"] = "<b>negrito</b> Clínica"; b["content"]["lead"] = "<u>lead</u> & mais"; b["content"]["services"][0]["title"] = "<i>Serviço</i> & Cia"
        h = self.hero(b)
        self.assertNotRegex(h, r"<script|<img src=x|<b>negrito|<i>|<u>|<b>Bairro")  # a única <img> é a ilustrativa do tema
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;", h); self.assertIn("&lt;u&gt;lead&lt;/u&gt; &amp; mais", h); self.assertIn("&lt;i&gt;Serviço&lt;/i&gt; &amp; Cia", h)
        self.assertEqual(bv.vc.linha_pilares("pino", "endereco", "<i>T</i>", "<b>x</b>"), '<li class="pl-degrau"><div class="pl-linha pl-linha--endereco"><span class="pl-rotulo"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#pino"/></svg><b>&lt;i&gt;T&lt;/i&gt;</b></span><span class="pl-valor">&lt;b&gt;x&lt;/b&gt;</span></div></li>')
        # sem serviço nenhum não há colunata; com mais de 6, só as 6 primeiras colunas (a seção Serviços traz todos)
        sem = json.loads(json.dumps(self.b)); sem["content"]["services"] = []
        self.assertNotIn("pl-colunas", self.hero(sem))
        mui = json.loads(json.dumps(self.b)); mui["content"]["services"] = [{"title": f"Serviço {i}", "text": "x"} for i in range(9)]
        h = self.hero(mui); self.assertEqual(h.count('<li class="pl-coluna"'), 6); self.assertIn('style="--n:6"', h)
        vazio = json.loads(json.dumps(self.b)); vazio["whatsapp"] = {"digits": None, "display": None, "status": "none"}; vazio["wa_contact"] = None; vazio["phones"] = []; vazio["google"] = None; vazio["content"]["hours"] = None; vazio["address"] = ""
        vazio["content"]["lead"] = "Unidade veterinária."; vazio["content"]["about"] = ["Sem prazo."]; vazio["content"]["services"] = [{"title": "Consulta", "text": "x"}]; vazio["content"]["how_to"] = []  # sem `hours` a regra 27 não atribui: nada pode citar o prazo (a trava para o gerador, ver TestRegra27)
        h = self.hero(vazio)
        for ausente in ("data-toque=\"numero\"", "pl-linha--horario", "pl-linha--endereco", "carimbo", "wa.me", "tel:", "pl-pe"):
            self.assertNotIn(ausente, h)
        self.assertIn('data-toque="servicos"', h); self.assertIn('data-toque="onde"', h)

    def test_tema_pilares_nao_repete_as_paletas_anteriores_nem_as_formulas_de_ia(self):
        t = bv.carregar_tema("pilares")["tokens"]
        outros = ("caderneta", "terrario", "sinalizacao", "chapa", "gondola", "dupla", "letreiro", "numero", "registro")
        for outro in outros:
            o = bv.carregar_tema(outro)["tokens"]
            for papel in ("folha", "musgo", "carimbo", "papel", "fonte-titulo"):
                self.assertNotEqual(t[papel].lower(), o[papel].lower(), f"{outro}/{papel}")
        self.assertNotRegex(json.dumps(t), r"(?i)terracota|#c1440e|#0f0f0f|#000000|neon")
        def matiz(h):
            r, g, b = (int(h.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)); mx, mn = max(r, g, b), min(r, g, b)
            if mx == mn: return 0
            d = mx - mn; m = ((g - b) / d) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
            return m * 60
        dist = lambda a, b: min(abs(matiz(a) - matiz(b)), 360 - abs(matiz(a) - matiz(b)))
        for outro in outros:
            self.assertGreater(dist(t["musgo"], bv.carregar_tema(outro)["tokens"]["musgo"]), 25, f"ação x {outro}")
        for outro in ("sinalizacao", "dupla"):  # o subtipo `hospital24h` é o desses dois: nem a ação, nem o acento, nem o escuro podem parecer os deles
            o = bv.carregar_tema(outro)["tokens"]
            for papel in ("musgo", "carimbo", "folha"):
                self.assertGreater(dist(t[papel], o[papel]), 25, f"{outro}/{papel}")
        self.assertGreater(dist(t["musgo"], t["perigo"]), 25)  # excluir (vermelho) não pode ter o matiz da ação (violeta)
        self.assertTrue(254 <= matiz(t["musgo"]) <= 286, "o violeta é a vaga de matiz que sobrava (254 a 286°)")
        self.assertNotRegex(t["fonte-titulo"], r"Iowan|Palatino|Charter|Helvetica|Optima|Gill|Rockwell|Avenir|DIN|Arial Black")  # nenhuma fonte de título dos outros temas
        for arq in ("pilares.vitrine.css", "pilares.painel.css"):
            css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / arq).read_text(encoding="utf-8"), flags=re.S)
            self.assertNotRegex(css, r"text-transform: *uppercase|font-family:[^;]*mono|ui-monospace", arq)
            self.assertNotRegex(css, r"(?<![\w-])\.(nota|placa|chapa|anotacao)(?![\w-])", arq)
            self.assertNotRegex(css, r"(?i)\b(urgente|urgência|emergência|aberto agora|24 ?h)\b", arq)
        css = re.sub(r"/\*.*?\*/", "", "".join((SKILL / "temas" / a).read_text(encoding="utf-8") for a in ("pilares.vitrine.css", "pilares.painel.css")), flags=re.S)
        for seletor, corpo in re.findall(r"([^{}]+)\{([^}]*gradient\([^}]*)\}", css):  # todo gradiente tem cor SÓLIDA por baixo (o teste de contraste mede contra background-color)
            decl = re.search(r"background:([^;]+);", corpo)
            self.assertIsNotNone(decl, seletor); self.assertRegex(decl.group(1).strip(), r"(#[0-9a-fA-F]{3,8}|var\(--[a-z-]+\))$", f"{seletor.strip()}: gradiente sem cor sólida por baixo")

    def test_o_numero_de_contato_e_a_nota_nao_usam_a_fonte_do_titulo(self):
        css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / "pilares.vitrine.css").read_text(encoding="utf-8"), flags=re.S)
        regras = {}
        for sel, corpo in re.findall(r"([^{}]+)\{([^}]*)\}", css):
            regras.setdefault(sel.strip(), []).append(corpo)
        for seletor in (".pl-valor", ".pl-linha--numero .pl-valor", ".carimbo b", ".servico .icone::before", ".passos li::before", ".pl-fuste b::before"):
            self.assertIn(seletor, regras, seletor); self.assertNotIn("--fonte-titulo", "".join(regras[seletor]), seletor)
        self.assertIn("var(--fonte-corpo)", "".join(regras[".pl-valor"])); self.assertIn("var(--fonte-corpo)", "".join(regras[".carimbo b"]))

    def test_colunata_icones_indices_e_classe_das_muitas_colunas(self):
        h = self.hero()
        self.assertEqual(re.findall(r'<li class="pl-coluna" style="--i:(\d+)">', h), ["0", "1", "2", "3", "4"])  # o atraso da animação cresce com o índice
        self.assertRegex(h, r'data-toque="servicos" href="#servicos"><svg[^>]*><use href="#pilares"/></svg>Ver serviços</a>')
        self.assertRegex(h, r'data-toque="onde" href="#localizacao"><svg[^>]*><use href="#pino"/></svg>Onde fica</a>')
        self.assertRegex(h, r'<use href="#pino"/></svg><b>Endereço</b>'); self.assertRegex(h, r'<use href="#relogio"/></svg><b>Horário</b>'); self.assertRegex(h, r'<use href="#fone"/></svg><b>WhatsApp</b>')
        self.assertIn('<ol class="pl-colunas" style="--n:5"', h); self.assertNotIn("pl-colunas--muitas", h)
        mui = json.loads(json.dumps(self.b)); mui["content"]["services"] = [{"title": f"Serviço {i}", "text": "x"} for i in range(9)]
        self.assertIn('<ol class="pl-colunas pl-colunas--muitas" style="--n:6"', self.hero(mui))
        s = bv.vc.SIMBOLOS["pilares"]; self.assertEqual(s.count("<path"), 3); self.assertGreater(len(s), 100)

    def test_colunata_so_fica_lado_a_lado_a_partir_de_1100px_e_com_ate_cinco_colunas(self):
        """Achado da revisão: entre 900 e 1080px as colunas de 5 quebravam "Atendimento" e "especializado" no meio da palavra (a palavra mais longa mede uns 117px em Futura)."""
        css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / "pilares.vitrine.css").read_text(encoding="utf-8"), flags=re.S)
        grade = re.findall(r"@media \(min-width: (\d+)px\) \{(.*?)\n\}", css, re.S)
        lado = [(int(l), corpo) for l, corpo in grade if "grid-template-columns: repeat(var(--n" in corpo]
        self.assertEqual([l for l, _ in lado], [1100]); self.assertIn(":not(.pl-colunas--muitas)", lado[0][1])
        self.assertIn("minmax(0, 240px)", lado[0][1]); self.assertIn("justify-content: center", lado[0][1])  # com 1 ou 2 serviços a coluna não vira um bloco de 990px
        for l, corpo in grade:
            if l == 900:
                self.assertNotIn("grid-template-columns: repeat(var(--n", corpo)

    def test_foco_visivel_no_friso_escuro_e_na_animacao_unica(self):
        css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / "pilares.vitrine.css").read_text(encoding="utf-8"), flags=re.S)
        self.assertRegex(css, r"\.topo :focus-visible[^{]*\{ *outline-color: var\(--carimbo\)"); self.assertRegex(css, r"\.pl-friso :focus-visible[^{]*\{ *outline-color: var\(--carimbo\)|\.pl-friso :focus-visible, ")
        self.assertRegex(css, r"\.escuro :focus-visible, [^{]*\.pl-friso :focus-visible \{ outline-color: var\(--carimbo\); \}")
        self.assertNotRegex(css, r"animation-iteration-count|animation-fill-mode: *infinite")
        mov = (SKILL / "components" / "movimento.css").read_text(encoding="utf-8")
        self.assertRegex(mov, r"\.wa-flutuante:focus-visible \{[^}]*border-radius: 50%[^}]*outline: 3px solid var\(--tinta\)[^}]*box-shadow: 0 0 0 9px #fff")  # o botão redondo segue redondo e visível sobre o claro (anel escuro) e sobre o escuro (halo branco)

    def test_a_colunata_e_decoracao_e_nao_cobre_nem_recebe_clique(self):
        css = re.sub(r"/\*.*?\*/", "", (SKILL / "temas" / "pilares.vitrine.css").read_text(encoding="utf-8"), flags=re.S)
        self.assertIn("pointer-events: none", re.search(r"\.pl-friso::before \{([^}]*)\}", css).group(1))
        self.assertIn("body:has(.wa-flutuante)", css)

    # ---- README dos três pacotes ----
    def test_readme_dos_tres_pacotes(self):
        r = {n: self.ler(p, "README.md") for n, p in (("premium", self.premium), ("basico", self.basico), ("essencial", self.essencial))}
        for n, txt in r.items():
            for esperado in ("Telefone: o pacote usa só o celular (15) 99800-9874", "Instagram: o perfil @pilaresvet", "Tipo da unidade", "Dados da Petlove que ficaram de fora"):
                self.assertIn(esperado, txt, n)
        for n in ("premium", "basico"):
            self.assertIn("O prazo \"24 horas\" só aparece ao lado de uma atribuição", r[n]); self.assertIn("Nome com prazo:", r[n])
        self.assertNotIn("O prazo \"24 horas\" só aparece ao lado de uma atribuição", r["essencial"])  # o ESSENCIAL não tem vitrine
        self.assertNotRegex("\n".join(r.values()), r"[\w.+-]+@[\w-]+\.[\w.-]+")  # nenhum e-mail em README nenhum (o GuiaPJ mostra o do sócio)
        for n, txt in r.items():
            self.assertNotRegex(txt, r"Doc & Dog|CEDVET|Prime|Nutrimed|Del Vet|Animal Inc|Ishizuka|Família Vet|Espaço Veterinário", n)  # outro cliente (a pesquisa os lista como concorrentes) não é citado
        self.assertNotIn("painel", r["basico"].split("## Pendências a confirmar")[1].split("\n## ")[0].lower())  # o BÁSICO nunca cita o painel nas pendências
        self.assertIn("A recepção deste painel NÃO vê os leitos", r["premium"]); self.assertIn("A recepção deste painel NÃO vê os leitos", r["essencial"]); self.assertNotIn("recepcao_ve_leitos", r["basico"])

    def test_nenhuma_palavra_de_bastidor_nos_arquivos_do_cliente(self):
        for pasta in (self.premium, self.basico, self.essencial):
            for arq in pasta.rglob("*"):
                if arq.is_file() and arq.suffix in {".html", ".js", ".css", ".md", ".svg"}:
                    achado = PROIBIDOS_CLIENTE.search(arq.read_text(encoding="utf-8"))
                    self.assertIsNone(achado, f"{pasta.name}/{arq.relative_to(pasta)}: {achado and achado.group(0)}")

    def test_regerar_por_cima_nao_perde_o_material_do_cliente(self):
        d = self.tmp / "material10"
        bv.gerar(SLUG10, saida=str(d))
        mat = d / "assets" / "material.js"
        mat.write_text(mat.read_text(encoding="utf-8").replace("galeria = [];", 'galeria = [{src: "assets/img/fachada.jpg", alt: "Fachada"}];'), encoding="utf-8")
        for kwargs in ({"vitrine": False}, {"gestao": False}, {}):
            bv.gerar(SLUG10, saida=str(d), **kwargs)
        self.assertIn("Fachada", mat.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
