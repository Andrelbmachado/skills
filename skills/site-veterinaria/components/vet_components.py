"""Componentes HTML da vitrine de veterinária (Python stdlib).

Cada função recebe o contexto `c` (ver `contexto()`) e devolve um trecho de HTML.
Regras que vivem aqui: só dado real (tudo vem do contexto), seção sem dado não é gerada,
WhatsApp só com número confirmado, link do painel só quando a gestão está contratada.
A identidade visual vem do tema (`temas/<nome>.json`): ornamento (símbolos), variante do hero e CSS próprio.
A receita do subtipo (`subtipos/<nome>.json`) liga componentes extras, como o quadro de espécies.
"""
import html
import json
import re
import unicodedata
from urllib.parse import quote, urlparse

# "Serviços" é a seção da página inicial (v1.0, PEDIDO_DESIGN_2): rolagem suave até #servicos, sem página própria
NAV = [("index.html", "Início"), ("index.html#servicos", "Serviços"), ("sobre.html", "Sobre"), ("contato.html", "Contato")]
CREDITO = '<a href="https://andremachado.design" target="_blank" rel="noopener">criado por andremachado.design</a>'
SAUDACAO = "Olá! Vim pelo site e gostaria de mais informações."
AVISO = "As informações deste site têm caráter informativo e não substituem a consulta com médico(a) veterinário(a)."

WA_PATH = ("M16 3C9 3 3.4 8.6 3.4 15.5c0 2.4.7 4.7 1.9 6.6L3 29l7.1-2.2c1.8 1 3.8 1.5 5.9 1.5 7 0 12.6-5.6 12.6-12.5S23 3 16 3z"
           "m0 22.6c-1.9 0-3.7-.5-5.3-1.5l-.4-.2-4.2 1.3 1.4-4-.3-.4a10 10 0 0 1-1.6-5.4C5.6 9.9 10.3 5.4 16 5.4s10.4 4.5 10.4 10.1"
           "S21.7 25.6 16 25.6zm5.7-7.5c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.300 8.300 0 0 1-4.100-3.600c-.3-.5.3-.5.9-1.600"
           ".1-.2 0-.4 0-.5l-1-2.300c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1.100 1.100-1.100 2.600 1.100 3 1.300 3.200 2.200 3.400 5.400 4.700c2 .8 2.800.9"
           " 3.800.7.6-.1 1.800-.7 2.100-1.500s.3-1.300.2-1.500-.3-.2-.6-.4z")
WA_SVG = f"<svg viewBox='0 0 32 32' aria-hidden='true' focusable='false'><path d='{WA_PATH}'/></svg>"
FONE_SVG = ("<svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'><path d='M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25"
            "c1.1.4 2.3.6 3.6.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.3.2 2.5.6 3.6a1 1 0 0 1-.25 1z'/></svg>")

# Símbolos do ornamento (viewBox 64x64, preenchidos com currentColor). O tema escolhe quais entram no sprite (`ornamento.sprite`).
SIMBOLOS = {
    "pata": ("<path d='M32 31c-8 0-15 8-15 15 0 6 5 9 10 8 2-.4 3.500-1 5-1s3 .6 5 1c5 1 10-2 10-8 0-7-7-15-15-15z'/>"
             "<ellipse cx='14' cy='27' rx='5.500' ry='7.500' transform='rotate(-20 14 27)'/><ellipse cx='25.500' cy='15.500' rx='5.500' ry='8'/>"
             "<ellipse cx='38.500' cy='15.500' rx='5.500' ry='8'/><ellipse cx='50' cy='27' rx='5.500' ry='7.500' transform='rotate(20 50 27)'/>"),
    # pena: folha com a nervura central vazada (evenodd)
    "pena": "<path fill-rule='evenodd' d='M10 58C8 30 28 10 54 8C56 34 40 56 10 58ZM13.8 54.7L50.8 12.7L49.2 11.3L12.2 53.3Z'/>",
    # escama: hexágono em anel
    "escama": "<path fill-rule='evenodd' d='M32 4L56 18V46L32 60L8 46V18ZM32 15L46.500 23.500V40.500L32 49L17.500 40.500V23.500Z'/>",
    # sinalização (tema "sinalizacao"): cruz, seta de direção, fone, pino de mapa e relógio
    "cruz": "<path d='M24 6h16v18h18v16H40v18H24V40H6V24h18z'/>",
    "seta": "<path d='M6 26h28L24 16l6-6 24 22-24 22-6-6 10-10H6z'/>",
    "fone": "<path transform='scale(2.6667)' d='M6.600 10.800a15.100 15.100 0 0 0 6.600 6.600l2.200-2.200a1 1 0 0 1 1-.25c1.100.4 2.300.6 3.600.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.500a1 1 0 0 1 1 1c0 1.300.2 2.500.6 3.600a1 1 0 0 1-.25 1z'/>",
    "pino": "<path fill-rule='evenodd' d='M32 4C20 4 12 13 12 24c0 15 20 36 20 36s20-21 20-36C52 13 44 4 32 4zm0 28a8 8 0 1 1 0-16 8 8 0 0 1 0 16z'/>",
    "relogio": "<path fill-rule='evenodd' d='M32 4a28 28 0 1 0 0 56 28 28 0 0 0 0-56zm0 8a20 20 0 1 1 0 40 20 20 0 0 1 0-40zM29 20h6v14l9 5-3 5-12-7z'/>",
    # chapa de exame (tema "chapa"): mira (anel com retículo que atravessa o anel) e escala (régua com marcas longas e curtas)
    "mira": ("<path fill-rule='evenodd' d='M32 8a24 24 0 1 0 0 48 24 24 0 0 0 0-48zm0 6a18 18 0 1 1 0 36 18 18 0 0 1 0-36z'/>"
             "<path d='M30 2h4v18h-4zM30 44h4v18h-4zM2 30h18v4H2zM44 30h18v4H44z'/>"),
    # etiqueta de preço (tema "gondola"): corte no canto e furo para o fio; vazada em evenodd
    "etiqueta": "<path fill-rule='evenodd' d='M10 6h30l18 18v34H10zM22 14a6 6 0 1 0 0 12 6 6 0 0 0 0-12z'/>",
    # dupla (tema "dupla"): dois anéis que se cruzam: o "&" de Doc & Dog como forma, sem letra
    "dupla": ("<path fill-rule='evenodd' d='M4 32a19 19 0 1 0 38 0 19 19 0 1 0-38 0zM11 32a12 12 0 1 0 24 0 12 12 0 1 0-24 0z'/>"
              "<path fill-rule='evenodd' d='M22 32a19 19 0 1 0 38 0 19 19 0 1 0-38 0zM29 32a12 12 0 1 0 24 0 12 12 0 1 0-24 0z'/>"),
    # letreiro (tema "letreiro"): a placa de fachada: moldura vazada sobre dois postes (a marca do tema)
    "letreiro": ("<path fill-rule='evenodd' d='M5 8h54v32H5zM11 14v20h42V14z'/><path d='M14 40h8v18h-8zM42 40h8v18h-8z'/><path d='M18 20h28v4H18zM18 27h18v4H18z'/>"),
    # numero (tema "numero"): a placa do número da porta: moldura vazada, dois parafusos e três algarismos em barras (a marca do tema)
    "numero": ("<path fill-rule='evenodd' d='M10 12h44a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6zm0 5a1 1 0 0 0-1 1v28a1 1 0 0 0 1 1h44a1 1 0 0 0 1-1V18a1 1 0 0 0-1-1z'/>"
               "<path fill-rule='evenodd' d='M12 32a3 3 0 1 0 6 0 3 3 0 1 0-6 0zM46 32a3 3 0 1 0 6 0 3 3 0 1 0-6 0z'/><path d='M23 23h4v18h-4zM30 23h4v18h-4zM37 23h4v18h-4z'/>"),
    # registro (tema "registro"): a folha do livro de registro: moldura vazada, a margem dupla, três linhas de lançamento e a fita marcadora que sai pelo topo (a marca do tema)
    "registro": ("<path fill-rule='evenodd' d='M12 6h40a4 4 0 0 1 4 4v44a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4zm0 5a1 1 0 0 0-1 1v40a1 1 0 0 0 1 1h40a1 1 0 0 0 1-1V12a1 1 0 0 0-1-1z'/>"
                 "<path d='M19 11h3v42h-3zM24.500 11h3v42h-3z'/><path d='M33 33h14v3H33zM33 41h14v3H33zM33 49h8v3H33z'/><path d='M38 2h11v24l-5.500-5L38 26z'/>"),
    # pilares (tema "pilares"): o frontão sobre três colunas e o degrau (a marca do tema; o nome do negócio é a ideia, não um serviço)
    "pilares": "<path d='M32 5L59 20H5z'/><path d='M11 25h9v27h-9zM27.500 25h9v27h-9zM44 25h9v27h-9z'/><path d='M5 55h54v6H5z'/>",
    "escala": ("<path d='M12 4h6v56h-6z'/><path d='M18 8h30v4H18zM18 20h30v4H18zM18 32h30v4H18zM18 44h30v4H18zM18 56h30v4H18z'/>"
               "<path d='M18 14h16v3H18zM18 26h16v3H18zM18 38h16v3H18zM18 50h16v3H18z'/>"),
}


def sprite(ids) -> str:
    simbolos = "".join(f"<symbol id='{i}' viewBox='0 0 64 64'>{SIMBOLOS[i]}</symbol>" for i in ids)
    return f"<svg width='0' height='0' style='position:absolute' aria-hidden='true' focusable='false'>{simbolos}</svg>"


PATA_SIMBOLO = sprite(["pata"])  # sprite da identidade "caderneta" (compatibilidade)
ORNAMENTO_PADRAO = {"marca": "pata", "servico": "pata", "sprite": ["pata"], "faixa": "pegadas"}


def icone_svg(simbolo: str, extra: str = "") -> str:
    return f'<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"{extra}><use href="#{simbolo}"/></svg>'


def esc(s) -> str:
    return html.escape(str(s), quote=True)


def wa_link(digits: str, texto: str = SAUDACAO) -> str:
    return f"https://wa.me/{digits}?text=" + quote(texto, safe="")


def nota_br(v: float) -> str:
    return f"{v:.1f}".replace(".", ",")


# v1.0 (PEDIDO_DESIGN_2/3): imagem ilustrativa por tipo de serviço, gerada (não é foto da clínica). Primeira regra que casa com título + texto vence.
# Arquivos em ilustrativas/ (pasta da skill); o gerador copia só as usadas para assets/ilustrativas/ do site. Legenda "Imagem ilustrativa" sempre visível.
FOTOS_SERVICO = [
    (r"tomograf|fistulograf|linfangiograf|ultrass|ecograf", "vet-tomografia", "Aparelho de exame de imagem em uma sala clara e vazia"),
    (r"laborat|raio", "vet-laboratorio", "Microscópio, tubos de coleta e lâminas sobre a bancada de um laboratório"),
    # 4º item "titulo": a regra casa só com o TÍTULO do serviço (v1.3: o Acumed cita acupuntura no TEXTO de "Especialidades", "Reabilitação" e "Tratamentos complementares", que não são acupuntura;
    # v1.4: o card "Exames" do Pilares não tem palavra nenhuma no texto que o ligue ao laboratório, e "exame clínico" no texto de uma consulta não é laboratório)
    (r"acupunt", "vet-acupuntura", "Bandeja de inox com agulhas de acupuntura em embalagens fechadas, um pote de algodão e uma toalha dobrada", "titulo"),
    (r"^exames?$", "vet-laboratorio", "Microscópio, tubos de coleta e lâminas sobre a bancada de um laboratório", "titulo"),
    (r"silvestre|exotic", "vet-silvestres", "Calopsita e jabuti sobre galhos e folhas"),
    (r"caes e gatos", "vet-caes-gatos", "Um cachorro e um gato descansando sobre uma manta"),
    (r"emerg|urgen|plant", "vet-emergencia", "Sala de procedimentos veterinários vazia, com mesa e monitor desligado"),
    (r"cirurg", "vet-cirurgia", "Sala de cirurgia veterinária vazia, com mesa de inox e foco cirúrgico"),
    (r"intern", "vet-internacao", "Baias de internação limpas, com mantas e potes de água"),
    (r"vacin", "vet-vacina", "Frascos de vacina, seringa embalada e carteirinha de vacinação em branco"),
    (r"banho|tosa", "vet-banho-tosa", "Mesa de banho e tosa com secador, escovas e toalhas"),
    (r"domicil", "vet-domicilio", "Maleta veterinária aberta no chão de uma sala, com uma caminha ao fundo"),
    (r"medicament|produto|farmac|racao|artigo", "vet-produtos", "Prateleiras com sacos de ração sem marca, petiscos e brinquedos"),
    (r".", "vet-atendimento", "Mesa de exame de inox com estetoscópio e termômetro em um consultório claro"),
]


def foto_servico(servico: dict) -> tuple[str, str]:
    """(arquivo sem extensão, texto alternativo) da imagem ilustrativa de um serviço; sempre devolve uma (a última regra casa com tudo)."""
    titulo = _dobrar(str(servico.get("title", "")))
    texto = _dobrar(f"{servico.get('title', '')} {servico.get('text', '')}")
    for padrao, arquivo, alt, *so_titulo in FOTOS_SERVICO:
        if re.search(padrao, titulo if so_titulo else texto):
            return arquivo, alt
    return FOTOS_SERVICO[-1][1], FOTOS_SERVICO[-1][2]


def figura_ilustrativa(arquivo: str, alt: str, classe: str = "ilustra", carregar: str = "lazy") -> str:
    """<figure> da imagem ilustrativa com a legenda sempre visível. `carregar="eager"` só para a imagem do hero (a primeira coisa que se vê)."""
    return (f'<figure class="{classe}" data-ilustrativa><img src="assets/ilustrativas/{arquivo}.webp" alt="{esc(alt)}" width="1600" height="1067" '
            f'loading="{carregar}" decoding="async"><figcaption>Imagem ilustrativa</figcaption></figure>')


def fotos_usadas(c) -> list[str]:
    """Arquivos de ilustrativas/ que as páginas desta vitrine usam (o gerador copia só estes)."""
    usadas = [foto_servico(s)[0] for s in c.services]
    if c.foto_hero:
        usadas.append(c.foto_hero[0])
    return list(dict.fromkeys(usadas))


class Contexto(dict):
    """dict com acesso por atributo; montado por `contexto()`."""
    __getattr__ = dict.get


# Status de WhatsApp que NÃO foram verificados: fixo (pode não ter WhatsApp) e celular só listado no Perfil do Google ("mobile-listed", 106 dos 155 leads).
# Só "confirmed" (research.whatsapp com fonte) autoriza o botão "Chamar no WhatsApp" como ação principal.
NAO_CONFIRMADOS = {"landline-unverified", "mobile-listed"}

# Texto dos dados que manda "chamar/falar no WhatsApp" vira telefone enquanto o número não é confirmado (nada é inventado: só troca o canal).
_SEM_WA = [
    (re.compile(r"\bChame no WhatsApp para\b"), "Ligue para"),
    (re.compile(r"\bchame no WhatsApp para\b"), "ligue para"),
    (re.compile(r"\bChame no WhatsApp\b"), "Ligue para {quem}"),
    (re.compile(r"\bchame no WhatsApp\b"), "ligue para {quem}"),
    (re.compile(r"\b(pelo|no) WhatsApp\b"), "pelo telefone"),
]


_DUPLO = re.compile(r"\bpelo telefone ou (?:pelo )?telefone\b")


def sem_whatsapp(texto, quem: str = "a clínica"):
    """Troca as instruções 'no/pelo WhatsApp' por telefone. Texto sem a palavra volta igual; só usado quando o número não está confirmado.
    `quem` é o destino da ligação ("a clínica"; a receita `vitrine.quem_atende` troca, por exemplo, por "o centro")."""
    if not isinstance(texto, str):
        return texto
    for padrao, novo in _SEM_WA:
        texto = padrao.sub(novo.replace("{quem}", quem), texto)
    return _DUPLO.sub("pelo telefone", texto)  # "pelo WhatsApp ou pelo telefone" virava "pelo telefone ou pelo telefone"


def _copy_sem_wa(c: dict, quem: str = "a clínica") -> dict:
    """Cópia da copy do site com o canal trocado por telefone (o JSON em data/content nunca é alterado)."""
    c = json.loads(json.dumps(c))
    for k in ("lead", "tagline", "meta_description"):
        c[k] = sem_whatsapp(c.get(k), quem)
    c["about"] = [sem_whatsapp(t, quem) for t in c.get("about", [])]
    for chave in ("services", "highlights", "how_to"):
        for item in c.get(chave) or []:
            item["text"] = sem_whatsapp(item.get("text"), quem)
            if chave == "how_to":
                item["title"] = sem_whatsapp(item.get("title"), quem)
    if c.get("hours"):
        c["hours"]["text"] = sem_whatsapp(c["hours"].get("text"), quem)
    return c


_PEDE_HORARIO = re.compile(r"(?i)\bhor[áa]rio|\bhoras?\b|\b24\s?h\b|\d\s?h\b|expediente|funcionamento")


_DIVERGE = re.compile(r"(?i)(?<!n[ãa]o )(?<!nunca )\bdiverg\w*")  # "o horário NÃO diverge" não pede confirmação


def horario_a_confirmar(b: dict) -> bool:
    """A pesquisa pede para confirmar o horário com o negócio (fonte antiga ou de diretório) OU registra que o horário DIVERGE entre as fontes (v0.9, site 8: "Horário diverge entre
    diretórios; usado o do Sorocaba Fácil" não tem a palavra "confirmar", e o horário saía sem dizer de onde veio). Pendência que só tem "hor" no meio de uma palavra
    ("Vila Hortência") não conta (a regra antiga olhava a sequência "hor"). Entrada que não é lista de textos não derruba."""
    pend = _pendencias(b)
    return any(("confirm" in p.lower() or _DIVERGE.search(p)) and _PEDE_HORARIO.search(p) for p in pend)


_PRAZO_NO_TITULO = re.compile(r"\s*\b24\s?-?\s?(?:horas?|hrs?|hs?)\b", re.I)  # "24 horas", "24h", "24hs", "24 hrs", "24-horas", "24Horas"


def prazo_tirado_dos_titulos(b: dict) -> bool:
    """O gerador está tirando o "24 horas" do título e da descrição deste negócio (há prazo no JSON e o horário está a confirmar)?"""
    c = b.get("content") or {}
    return horario_a_confirmar(b) and any(_PRAZO_NO_TITULO.search(c.get(k) or "") for k in ("tagline", "meta_description"))


def _copy_sem_prazo_nos_titulos(c: dict) -> dict:
    """Título (h1, <title>) e descrição do site não afirmam funcionamento de "24 horas" enquanto o horário depende de confirmação: o texto isolado do
    título não leva a fonte ("segundo o diretório") e é o que mais se lê. O horário continua nos textos do JSON que citam a fonte (placa de horário,
    "Sobre", diferencial). Quando a pesquisa deixar de pedir a confirmação, o título original volta sozinho. O JSON em data/content não é alterado."""
    c = json.loads(json.dumps(c))
    for k in ("tagline", "meta_description"):
        if isinstance(c.get(k), str):
            c[k] = _PRAZO_NO_TITULO.sub("", c[k])
    return c


_PRAZO_NO_TEXTO = re.compile(_PRAZO_NO_TITULO.pattern + r"|\s*\ba qualquer hora\b|\s*\bvinte e quatro horas\b|\s*\b24\s?/\s?7\b|\s*\bh24\b|\s*\bdia e noite\b", re.I)  # no TEXTO, estas formas também são prazo
_PRAZO_DE_OUTRO_ASSUNTO = re.compile(r"(?i)\b(?:até|ate|dentro de|após|apos|a cada)\s*$")  # "resultado dos exames em até 24 horas" não é o funcionamento da unidade
_FRASE = re.compile(r"(?<=[.!?])\s+(?=[A-ZÀ-Ý])")
_SEGUNDO_ENTRE_PARENTESES = re.compile(r"\(segundo [^)]*\)")  # "(segundo o GuiaPJ)" do ano do CNPJ atribui o ANO, não o prazo da mesma frase


def _prazos_do_texto(texto: str):
    """Os prazos do texto que dizem respeito ao funcionamento (o "até 24 horas" de um resultado de exame fica de fora)."""
    return [m for m in _PRAZO_NO_TEXTO.finditer(texto) if not _PRAZO_DE_OUTRO_ASSUNTO.search(texto[:m.start()])]


def _frase_do(texto: str, pos: int) -> tuple[int, int]:
    cortes = [0] + [m.end() for m in _FRASE.finditer(texto)] + [len(texto)]
    for ini, fim in zip(cortes, cortes[1:]):
        if ini <= pos < fim:
            return ini, fim
    return 0, len(texto)


def _atribui(trecho: str) -> bool:
    return bool(_JA_ATRIBUI.search(_SEGUNDO_ENTRE_PARENTESES.sub("", trecho)))


def _prazo_sem_atribuicao(texto) -> bool:
    """O texto cita o prazo numa frase que não atribui (segundo/informa/divulga/se apresenta... NA MESMA FRASE; "(segundo X)" do ano do CNPJ não conta)?"""
    if not isinstance(texto, str):
        return False
    return any(not _atribui(texto[slice(*_frase_do(texto, m.start()))]) for m in _prazos_do_texto(texto))


def _com_a_fonte_depois_do_prazo(texto: str, nome_fonte: str) -> str:
    """Insere ", segundo <fonte>" logo depois de cada prazo cuja FRASE não atribui ("com atendimento 24 horas." -> "com atendimento 24 horas, segundo a rede credenciada da Petlove."); no meio da frase leva uma
    vírgula também; um segundo prazo na mesma frase não ganha outra fonte. Frase que atribui (segundo/informa/divulga/se apresenta..., na própria frase) e "até 24 horas" ficam como estão; sem fonte, nada é inventado."""
    if not isinstance(texto, str) or not nome_fonte:
        return texto
    pecas, ultimo, feitas = [], 0, set()
    for m in _prazos_do_texto(texto):
        frase = _frase_do(texto, m.start())
        if frase in feitas:
            continue
        feitas.add(frase)
        if _atribui(texto[slice(*frase)]):
            continue
        pontua = re.match(r"""\s*(?:[.,;:!?)"'”’–—-]|$)""", texto[m.end():])
        pecas.append(texto[ultimo:m.end()] + f", segundo {nome_fonte}" + ("" if pontua else ","))
        ultimo = m.end()
    pecas.append(texto[ultimo:])
    return "".join(pecas)


def _sem_o_prazo(titulo):
    """Título sem o prazo ("Atendimento de emergência 24h" -> "Atendimento de emergência", "Emergência - 24h" -> "Emergência"); título que só tem o prazo não vira vazio."""
    if not isinstance(titulo, str):
        return titulo
    return _PRAZO_NO_TITULO.sub("", titulo).strip(" -–—") or titulo


def _prazo_so_com_a_fonte(c: dict, b: dict) -> dict:
    """Regra 27 (v1.4, site 10: Pilares): enquanto o horário está a confirmar, o prazo ("24 horas", "24h", "a qualquer hora"...) não aparece solto em lugar nenhum da copy. O Pilares (o nome do cadastro leva
    "24h" e o JSON cita o prazo no título de um serviço, na apresentação e no sobre) mostrou o que as regras 12, 17 e 19 não cobriam: (a) o NOME COM PRAZO escrito dentro do texto ("A Pilares - Unidade
    Veterinária 24h atende...") volta ao nome curto do cadastro (`display_name`, o mesmo que a regra 17 usa na marca); (b) o prazo no TÍTULO de um serviço, da etapa "Como funciona" e na lista de assuntos sai
    do título (o texto do serviço continua e leva a fonte, regra 19); (c) a APRESENTAÇÃO, os parágrafos do SOBRE e o texto das etapas cujas FRASES citam o prazo sem atribuir ganham a fonte do horário logo depois
    dele. O título em negrito do diferencial segue como na regra 23 (a frase ao lado atribui). O JSON em data/content nunca é alterado. `conferir_prazo_com_a_fonte` PARA o gerador se sobrar prazo solto."""
    c = json.loads(json.dumps(c))
    h = (b.get("content") or {}).get("hours")
    fonte = nome_da_fonte(h.get("source"), site=True) if isinstance(h, dict) else ""
    nome, curto = b.get("name") or "", c.get("display_name") or ""
    achar_nome = None
    if nome and curto and curto != nome and nome_com_prazo(b):  # o nome inteiro, com o traço do cadastro ou outro travessão e qualquer espaço
        achar_nome = re.compile(re.escape(nome).replace(r"\-", "[-–—]").replace(r"\ ", r"\s+"))

    def texto_livre(x):
        if not isinstance(x, str):
            return x
        if achar_nome:
            x = achar_nome.sub(curto, x)
        return _com_a_fonte_depois_do_prazo(x, fonte)
    c["lead"] = texto_livre(c.get("lead"))
    c["about"] = [texto_livre(x) for x in c.get("about") or []]
    for s in c.get("services") or []:
        if isinstance(s, dict):
            s["title"] = _sem_o_prazo(s.get("title"))
    for e in c.get("how_to") or []:
        if isinstance(e, dict):
            e["title"] = _sem_o_prazo(e.get("title")); e["text"] = texto_livre(e.get("text"))
    form = c.get("form") or {}
    if isinstance(form.get("topic_options"), list):
        form["topic_options"] = [_sem_o_prazo(o) for o in form["topic_options"]]
    return c


def conferir_prazo_com_a_fonte(c: dict) -> None:
    """Trava da regra 27 (como `conferir_numero_fora`): se, depois da troca, ainda sobra o prazo numa frase que não atribui (apresentação, Sobre, serviços, etapas) ou num título de serviço, de etapa ou de assunto,
    o gerador PARA e diz onde. O título em negrito do diferencial (regra 23) fica de fora; a fonte do horário que falta (`hours.source` ausente ou sem endereço) é o caso mais comum."""
    unidades = [("apresentação", c.get("lead"))] + [(f"Sobre, parágrafo {i + 1}", x) for i, x in enumerate(c.get("about") or [])]
    unidades += [(f"texto do serviço «{s.get('title')}»", s.get("text")) for s in c.get("services") or [] if isinstance(s, dict)]
    unidades += [(f"texto da etapa «{e.get('title')}»", e.get("text")) for e in c.get("how_to") or [] if isinstance(e, dict)]
    onde = [nome for nome, texto in unidades if _prazo_sem_atribuicao(texto)]
    titulos = [("título de serviço", s.get("title")) for s in c.get("services") or [] if isinstance(s, dict)] + [("título de etapa", e.get("title")) for e in c.get("how_to") or [] if isinstance(e, dict)]
    titulos += [("assunto do formulário", o) for o in (c.get("form") or {}).get("topic_options") or []]
    onde += [f"{nome} «{x}»" for nome, x in titulos if isinstance(x, str) and _prazos_do_texto(x)]
    if onde:
        raise SystemExit("o prazo (24 horas...) ainda aparece sem atribuição em: " + "; ".join(onde) + ". A regra 27 precisa de `hours.source` (um endereço) para atribuir, ou o texto do cadastro precisa dizer de quem é a afirmação.")


def nome_com_prazo(b: dict) -> bool:
    """O NOME do negócio no cadastro (Perfil do Google) carrega o prazo ("... - 24Horas") e o horário ainda está a confirmar. O nome é dado do negócio, mas escrito no topo, no
    título ou nos dados estruturados lê-se como promessa de funcionamento: enquanto a pesquisa pedir a confirmação, o site usa o nome curto do cadastro (`display_name`)
    e só cita o prazo ao lado da fonte. Quando a pesquisa tirar a pendência, os dados estruturados voltam ao nome completo."""
    return horario_a_confirmar(b) and bool(_PRAZO_NO_TITULO.search(b.get("name") or ""))


def _servicos_com_a_fonte_do_prazo(c: dict) -> dict:
    """Receita `horario_com_fonte` (v0.7): o texto de um SERVIÇO que cita o prazo ("Consultas emergenciais em plantão 24 horas.") é lido sozinho, na lista de serviços, sem a fonte.
    Enquanto o horário está a confirmar, a fonte do próprio serviço entra LOGO DEPOIS do prazo ("... 24 horas, segundo o guia nool. Em caso de ..."; no meio da frase leva uma
    vírgula também: "... 24 horas, segundo o guia nool, com o Dr. Silva."): antes entrava no fim da frase e "Dr." era lido como fim ("... com o Dr, segundo o guia nool. Silva").
    v1.4: o serviço SEM fonte própria usa a do horário; "a qualquer hora" também é prazo; a atribuição conta na FRASE do prazo. O JSON em data/content nunca é alterado."""
    c = json.loads(json.dumps(c))
    h = c.get("hours")
    do_horario = nome_da_fonte(h.get("source")) if isinstance(h, dict) else ""
    for s in c.get("services") or []:
        if not isinstance(s, dict) or not isinstance(s.get("text"), str):
            continue
        url = s.get("source")
        nome = (nome_da_fonte(url) if isinstance(url, str) else "") or do_horario
        if nome:
            s["text"] = _com_a_fonte_depois_do_prazo(s["text"], nome)
    return c


def _sem_servicos(c: dict, retirar) -> dict:
    """Perfil do site (`retirar_servicos`, v0.7): serviço que consta no cadastro mas cuja fonte não sustenta a afirmação (ex.: internamento visto só em resumo de busca) sai da
    vitrine e da lista de assuntos do formulário, e vai para a lista de pendências do README. Compara o título sem maiúsculas. O JSON em data/content nunca é alterado."""
    titulos = {str(r.get("titulo", "")).strip().lower() for r in (retirar or []) if isinstance(r, dict)} - {""}
    if not titulos:
        return c
    c = json.loads(json.dumps(c))
    c["services"] = [s for s in c.get("services") or [] if str(s.get("title", "")).strip().lower() not in titulos]
    form = c.get("form") or {}
    if isinstance(form.get("topic_options"), list):
        form["topic_options"] = [o for o in form["topic_options"] if str(o).strip().lower() not in titulos]
    return c


def cep_a_confirmar(b: dict) -> bool:
    """A pesquisa registra que o CEP diverge entre as fontes e NINGUÉM decidiu qual vale: o endereço do site sai sem CEP (o CEP é o dado em disputa; rua, número, bairro e
    cidade seguem). Pendência que já diz "mantido" (o site 3: "CEP diverge: CSV ..., Receita ...; mantido o do CSV") é decisão tomada e não liga a regra. `\\bCEP\\b` em
    maiúsculas: "recepção" tem "cep" no meio."""
    return any(re.search(r"\bCEP\b", p) and "diverg" in p.lower() and "mantid" not in p.lower() for p in ((b.get("research") or {}).get("pending") or []))


_CEP_NO_FIM = re.compile(r"\s*,\s*\d{5}-?\d{3}\s*$")


def endereco_sem_cep(endereco: str) -> str:
    """'... – Sorocaba, 18070-180' -> '... – Sorocaba'. Sem CEP no fim, volta igual."""
    return _CEP_NO_FIM.sub("", endereco)


# ---------- número do endereço em disputa (v0.8, site 7) ----------
_PEDE_NUMERO = re.compile(r"(?i)\bn(?:[úu]mero|[º°]|o\.)\s+(?:d[oa]|n[oa])\s+endere[cç]o\b|\bendere[cç]o\b[^;.]{0,30}\bn[úu]mero\s+diverg")
_DECIDIDA = re.compile(r"(?i)diverg.{0,160}mantid")  # "diverge ...; mantido o do CSV": a decisão foi tomada


def _pendencias(b) -> list[str]:
    pesquisa = b.get("research") if isinstance(b, dict) else None
    pend = pesquisa.get("pending") if isinstance(pesquisa, dict) else None  # pesquisa que não é objeto (texto, lista, número) não derruba
    return [p for p in (pend if isinstance(pend, list) else []) if isinstance(p, str)]


def _pendencia_do_numero(p: str) -> bool:
    return bool(_PEDE_NUMERO.search(p)) and "diverg" in p.lower() and not _DECIDIDA.search(p)


def numero_a_confirmar(b: dict) -> bool:
    """A pesquisa registra que o NÚMERO do endereço diverge entre as fontes ("O número do endereço diverge: 227 em guias, 245 no CSV e na Receita Federal; confirmar") e
    ninguém decidiu qual vale: o endereço do site sai SEM o número (e sem o CEP, que anda junto: o guia que traz o outro número traz também outro CEP). Quem vai ao endereço
    errado é o custo real; o telefone, o "Como chegar" (Perfil do Google) e o mapa (que busca pelo nome da clínica) levam ao lugar certo sem o número. A frase tem de falar do
    "número do endereço" (ou "nº do endereço"): "o número do telefone diverge" e "o endereço diverge" (rua ou bairro) não ligam. Se depois de "diverge" a pendência diz "mantido",
    é decisão tomada e não liga (mesma lógica do CEP). Rua, bairro e cidade seguem."""
    return any(_pendencia_do_numero(p) for p in _pendencias(b))


def numeros_em_disputa(b: dict) -> list[str]:
    """Os números citados DEPOIS de "diverge" na pendência (datas e anos não contam) mais o do endereço do cadastro; só vale quando `numero_a_confirmar`.
    v0.9 (achado da revisão do site 8): uma pendência que diz "O número do endereço diverge entre as fontes; confirmar" SEM citar algarismos também desliga o número do cadastro
    (antes a lista voltava vazia e o número saía no endereço, no mapa e no hero `numero`); e o número do cadastro vem de `endereco_em_partes`, não de uma regex solta que lia o CEP
    ("Sorocaba, 18035") como número quando o endereço não tinha número."""
    achados: list[str] = []
    for p in _pendencias(b):
        if _pendencia_do_numero(p):
            trecho = re.split(r"(?i)diverg\w*", p, maxsplit=1)[1].split(";")[0]
            trecho = re.sub(r"\d{1,2}/\d{1,2}(?:/\d{2,4})?", " ", trecho)
            achados += [n for n in re.findall(r"(?<![\d-])\d{1,5}(?![\d-])", trecho) if not re.fullmatch(r"(?:19|20)\d\d", n)]
    if not numero_a_confirmar(b):
        return []
    cadastro = endereco_em_partes((b or {}).get("address"))["numero"] if isinstance(b, dict) else ""
    if cadastro:
        achados.append(cadastro)
    return sorted(dict.fromkeys(achados))


def rua_do_endereco(endereco) -> str:
    """'Av. Percito de Sousa Queiroz, 245 - Vila Barao – Sorocaba, 18061-240' -> 'Av. Percito de Sousa Queiroz' ('' se o endereço não tem o formato 'rua, número')."""
    m = re.match(r"([^,]*[^\W\d_]),\s*(?:n[º°]\s*)?\d{1,5}\b", str(endereco or ""))
    return m.group(1).strip() if m else ""


def endereco_sem_numero(endereco: str, numeros) -> str:
    """'Av. X, 245 - Vila Barao – Sorocaba, 18061-240' -> 'Av. X - Vila Barao – Sorocaba' (o CEP sai junto). Sem os números do cadastro, só tira o CEP."""
    texto = endereco_sem_cep(str(endereco))
    for n in numeros or []:
        texto = re.sub(rf"(?<=[^\W\d_]),\s*(?:n[º°]\s*)?{re.escape(str(n))}\b(?![-\d])", "", texto)
    return texto


def _texto_sem_numero(texto, numeros, rua: str = ""):
    """O número logo depois do NOME DA RUA do cadastro ("Av. X, 245, na Vila" -> "Av. X, na Vila"). Só a rua do endereço do cadastro conta: "Sorocaba, 22 anos", telefone, nota e ano
    nunca mudam, mesmo que o número em disputa coincida com eles. Rua com outra grafia no texto fica como está e `conferir_numero_fora` para o gerador."""
    if not isinstance(texto, str) or not rua:
        return texto
    for n in numeros:
        texto = re.sub(rf"({re.escape(rua)}),\s*(?:n[º°]\s*)?{re.escape(str(n))}\b(?![-\d])", r"\1", texto)
    return texto


def _copy_sem_numero(c: dict, numeros, rua: str = "") -> dict:
    """Cópia da copy do site sem o número do endereço em disputa (o JSON em data/content nunca é alterado): título, lead, descrição, Sobre, passos, serviços, diferenciais e horário."""
    c = json.loads(json.dumps(c))
    for k in ("lead", "tagline", "meta_description"):
        c[k] = _texto_sem_numero(c.get(k), numeros, rua)
    c["about"] = [_texto_sem_numero(t, numeros, rua) for t in c.get("about", [])]
    for chave in ("services", "highlights", "how_to"):
        for item in c.get(chave) or []:
            item["text"] = _texto_sem_numero(item.get("text"), numeros, rua)
            item["title"] = _texto_sem_numero(item.get("title"), numeros, rua)
    if c.get("hours"):
        c["hours"]["text"] = _texto_sem_numero(c["hours"].get("text"), numeros, rua)
    return c


def _textos_da_copy(c: dict):
    for k in ("lead", "tagline", "meta_description"):
        yield k, c.get(k)
    for i, t in enumerate(c.get("about") or []):
        yield f"about[{i}]", t
    for chave in ("services", "highlights", "how_to"):
        for i, item in enumerate(c.get(chave) or []):
            yield f"{chave}[{i}].text", item.get("text")
            yield f"{chave}[{i}].title", item.get("title")
    yield "hours", (c.get("hours") or {}).get("text")


def conferir_numero_fora(c: dict, numeros, endereco: str, consulta: str = "") -> None:
    """O gerador PARA em vez de publicar o número em disputa. A conferência é MAIS LARGA que a troca (a primeira versão usava a mesma regex e deixava passar "Rua X 245", "nº 245" e
    "Rua 7, 245"): no endereço e na consulta do mapa, o número solto (um dígito colado não conta, "245-B" conta); na copy, o número depois de vírgula, de "nº" ou de um nome de via."""
    for n in numeros:
        solto = re.compile(rf"(?<!\d){re.escape(str(n))}(?!\d)")
        copia = re.compile(rf"(?:,|\bn[º°]\.?|\bn[úu]mero)\s*{re.escape(str(n))}(?!\d)|\b(?:av|avenida|rua|r|rod|rodovia|estrada)\.?\s[^;]{{0,60}}?(?<!\d){re.escape(str(n))}(?![\d-])", re.I)
        onde = [nome for nome, texto in (("endereço", endereco), ("consulta do mapa", consulta)) if isinstance(texto, str) and solto.search(texto)]
        onde += [nome for nome, texto in _textos_da_copy(c) if isinstance(texto, str) and copia.search(texto)]
        if onde:
            raise SystemExit(f"número do endereço em disputa ({n}) ainda aparece em: {', '.join(onde)}. O gerador não reconheceu o formato do endereço ou do texto; ajuste endereco_sem_numero/_texto_sem_numero antes de publicar.")


# Nome com que um diretório aparece ao lado do horário. Sem entrada aqui, vale o endereço do site (nada é inventado).
NOMES_DE_FONTE = {"sorocabafacil.com.br": "o guia Sorocaba Fácil", "guiamaispratico.com.br": "o guia Mais Prático", "nool.com.br": "o guia nool",
                  "portalltb.com.br": "o guia Portal LTB", "solutudo.com.br": "o Solutudo", "guiapj.com.br": "o GuiaPJ",  # v0.8: Portal LTB (CRMV do site 7), Solutudo e GuiaPJ (ano de abertura do CNPJ)
                  "saude.petlove.com.br": "a rede credenciada da Petlove", "instagram.com": "o Instagram do negócio"}  # v1.4 (site 10): o horário do Pilares vem da Petlove e os serviços, do Instagram


def _horario_com_fonte(c: dict) -> dict:
    """Receita `vitrine.horario_com_fonte` (v0.5): enquanto a pesquisa pede para confirmar o horário, o texto do JSON que não diz de onde veio ganha a fonte
    ("Das 9h às 17h, segundo o guia Sorocaba Fácil. Confirme ..."). Ele é lido sozinho (placa do hero, Contato, ficha) e, sem a fonte, parece confirmado.
    Texto que já diz "segundo" não muda; o JSON em data/content nunca é alterado."""
    h = c.get("hours")
    if not isinstance(h, dict) or not isinstance(h.get("text"), str) or not h["text"] or re.search(r"\bsegundo\b", h["text"], re.I):
        return c  # (v1.4: `hours` que não é objeto não derruba o gerador)
    host = (urlparse(h.get("source") or "").hostname or "").removeprefix("www.")
    if not host:
        return c
    nome = NOMES_DE_FONTE.get(host, host)
    c = json.loads(json.dumps(c))
    texto = c["hours"]["text"]
    # a fonte entra no fim da primeira frase (ponto seguido de maiúscula; "Seg. a sex." não conta) ou do texto
    fim = re.search(r"\.(?=\s+[A-ZÀ-Ý])", texto) or re.search(r"\.\s*$", texto)
    c["hours"]["text"] = texto[:fim.start()] + f", segundo {nome}" + texto[fim.start():] if fim else f"{texto}, segundo {nome}"
    return c


# ---------- fonte no próprio texto (v0.8) ----------
_JA_ATRIBUI = re.compile(r"(?i)\b(segundo|conforme|de acordo com|informa|informam|registra|registram|lista|listam|cita|citam|consta|constam|se apresenta|divulga|anuncia|afirma|declara)\b")


def _host(url) -> str:
    return (urlparse(url).hostname or "").removeprefix("www.") if isinstance(url, str) else ""


def nome_da_fonte(url, site: bool = False) -> str:
    """'https://www.portalltb.com.br/...' -> 'o guia Portal LTB' (NOMES_DE_FONTE) ou o próprio endereço do site. '' se a fonte não é um endereço. Com `site=True` o endereço sem nome
    conhecido sai como 'o site <endereço>' (nos diferenciais e no ano do CNPJ; o horário e o prazo seguem com o endereço cru, como desde a 0.5)."""
    host = _host(url)
    if not host:
        return ""
    return NOMES_DE_FONTE.get(host) or (f"o site {host}" if site else host)


def _destaques_com_a_fonte(c: dict) -> dict:
    """v0.8 (dívida do site 6): o diferencial "Cartões e dinheiro" ("A clínica aceita pagamento em dinheiro e cartões...") era mostrado sem dizer de onde vem, embora o JSON traga a
    fonte. Todo diferencial com fonte cujo texto não a atribui (segundo/informa/registra/lista/cita...) recebe ", segundo <fonte>" no fim da frase. Os que já atribuem ("O guia nool
    registra...", "O Waze lista...") não mudam, nem o que não tem fonte. O JSON em data/content nunca é alterado."""
    c = json.loads(json.dumps(c))
    for h in c.get("highlights") or []:
        texto, nome = h.get("text"), nome_da_fonte(h.get("source"), site=True)
        if not isinstance(texto, str) or not texto.strip() or not nome or _JA_ATRIBUI.search(texto):
            continue
        fim = texto.rstrip()
        if fim.endswith(".") and not fim.endswith(".."):
            h["text"] = fim[:-1] + f", segundo {nome}."
        elif fim.endswith(("?", "!", "…", "..")):
            h["text"] = f"{fim} (segundo {nome})"  # "Pergunta?, segundo X" e "...., segundo X." ficavam errados
        else:
            h["text"] = f"{fim}, segundo {nome}"
    return c


_CNPJ_ANO = re.compile(r"(CNPJ aberto (?:em|desde(?: [a-zçãé]+ de)?) (\d{4}))(?!\s*\(segundo)")  # v1.4: "aberto em 2014", "aberto desde 2022" e "aberto desde novembro de 2022"


def _fonte_do_ano_de_abertura(research, ano: str) -> str:
    """Nome da fonte do fato da pesquisa que diz que a empresa foi aberta naquele ano ("aberta em 24/09/2019"); '' se não houver."""
    fatos = (research or {}).get("facts") if isinstance(research, dict) else None
    for f in fatos if isinstance(fatos, list) else []:
        if isinstance(f, dict) and isinstance(f.get("text"), str) and re.search(rf"(?i)\b(?:aberta|aberto|abertura|fundad[ao]|in[ií]cio das atividades)\s+em\s+(?:\d{{1,2}}/\d{{1,2}}/)?{ano}\b", f["text"]):
            nome = nome_da_fonte(f.get("source"), site=True)
            if nome:
                return nome
    return ""


def _cnpj_com_a_fonte(c: dict, research) -> dict:
    """v0.8 (dívida do site 6): "com CNPJ aberto em 2016" saía sem fonte no texto (Sobre e a descrição dela). Quando a pesquisa tem o fato com a fonte (cadastro da Receita lido por
    guia), o ano ganha "(segundo o Solutudo)"; quando não tem, o texto não muda e `cnpj_sem_fonte` entra na lista de pendências do README."""
    c = json.loads(json.dumps(c))

    def troca(m):
        nome = _fonte_do_ano_de_abertura(research, m.group(2))
        return f"{m.group(1)} (segundo {nome})" if nome else m.group(0)
    c["about"] = [_CNPJ_ANO.sub(troca, t) if isinstance(t, str) else t for t in c.get("about") or []]
    return c


def cnpj_ativo_desde(b: dict) -> str | None:
    """v1.5 (PEDIDO_DESIGN_4, hero da Animal Inc): "CNPJ aberto em 2014 e ativo, segundo o GuiaPJ" quando UM fato da pesquisa, com fonte, diz o ano de abertura ("aberta em dd/mm/AAAA") e a
    situação ativa ("situação cadastral ativa"). Sem os dois no mesmo fato, ou sem fonte, devolve None (o hero não mostra a linha; nada é inventado)."""
    pesquisa = b.get("research") if isinstance(b, dict) else None
    fatos = pesquisa.get("facts") if isinstance(pesquisa, dict) else None
    for f in fatos if isinstance(fatos, list) else []:
        texto = f.get("text") if isinstance(f, dict) else None
        if not isinstance(texto, str):
            continue
        ano = re.search(r"(?i)\b(?:aberta|aberto)\s+em\s+(?:\d{1,2}/\d{1,2}/)?(\d{4})\b", texto)
        nome = nome_da_fonte(f.get("source"), site=True)
        if ano and nome and re.search(r"(?i)situa[çc][ãa]o(?: cadastral)? ativa", texto):
            return f"CNPJ aberto em {ano.group(1)} e ativo, segundo {nome}"
    return None


def cnpj_sem_fonte(b: dict) -> list[str]:
    """Anos de abertura do CNPJ que o texto afirma e que a pesquisa não sustenta com fonte (viram pendência no README)."""
    anos = []
    for t in (b.get("content") or {}).get("about") or []:
        for m in _CNPJ_ANO.finditer(t if isinstance(t, str) else ""):
            if not _fonte_do_ano_de_abertura(b.get("research"), m.group(2)):
                anos.append(m.group(2))
    return list(dict.fromkeys(anos))


def registro_com_a_fonte(reg) -> dict | None:
    """v0.8 (site 7, o primeiro com `registry`): o registro profissional (CRMV-SP) é mostrado na ficha e no rodapé SEMPRE com a fonte ("..., segundo o guia Portal LTB"), como informação
    e nunca como selo de qualidade. Sem fonte (endereço) não é mostrado: um número de registro solto, sem origem, é o que mais se confunde com um selo."""
    if not isinstance(reg, dict) or not isinstance(reg.get("label"), str) or not isinstance(reg.get("value"), str) or not reg["label"].strip() or not reg["value"].strip():
        return None
    nome = nome_da_fonte(reg.get("source"), site=True)
    if not nome:
        return None
    return {"label": reg["label"].strip(), "value": f"{reg['value'].strip()}, segundo {nome}", "source": reg["source"]}


def contexto(b: dict, gestao: bool, cta_label: str = "Chamar no WhatsApp", tema: dict | None = None,
             subtipo: dict | None = None, perfil: dict | None = None) -> Contexto:
    """Valores derivados de um negócio fundido (tools/model.load_business) usados pelas páginas.
    `tema` (temas/<nome>.json) define ornamento e hero; `subtipo` (subtipos/<nome>.json) define a receita da vitrine; `perfil` (perfis/<slug>.json) traz o que é só
    deste site (`retirar_servicos`)."""
    tema = tema or {}
    subtipo = subtipo or {}
    perfil = perfil or {}
    c = b["content"]
    # v1.0 (PEDIDO_DESIGN_3): número de conversa = tools/model.wa_contact (WhatsApp confirmado ou listado, ou o celular listado); fixo nunca vira wa.me.
    # Com número, o site tem UM botão de WhatsApp (o flutuante, v1.1); sem número, nenhum. Não há mais "Tentar pelo WhatsApp" nem Ligar.
    wa = b.get("wa_contact") or {"digits": None, "display": None}
    tem_wa = bool(wa["digits"])
    nao_confirmado = False
    receita = subtipo.get("vitrine") or {}
    numeros = numeros_em_disputa(b)  # v0.8: número do endereço que as fontes não confirmam
    if numeros:
        c = _copy_sem_numero(c, numeros, rua_do_endereco(b["address"]))
    c = _cnpj_com_a_fonte(_destaques_com_a_fonte(c), b.get("research"))  # v0.8: a fonte no próprio texto (diferenciais e ano do CNPJ)
    if not tem_wa:
        c = _copy_sem_wa(c, receita.get("quem_atende", "a clínica"))  # sem número de conversa, a copy não manda chamar no WhatsApp
    if horario_a_confirmar(b):
        c = _copy_sem_prazo_nos_titulos(c)
        if receita.get("horario_com_fonte"):
            c = _servicos_com_a_fonte_do_prazo(_horario_com_fonte(c))
    c = _sem_servicos(c, perfil.get("retirar_servicos"))
    if horario_a_confirmar(b) and receita.get("horario_com_fonte"):
        c = _prazo_so_com_a_fonte(c, b)  # regra 27 (v1.4)
        conferir_prazo_com_a_fonte(c)
    google = b["google"]
    consulta = endereco_sem_numero(b["maps_query"], numeros) if numeros else endereco_sem_cep(b["maps_query"]) if cep_a_confirmar(b) else b["maps_query"]  # o CEP/número em disputa também fica fora do link sem place_id
    endereco = endereco_sem_numero(b["address"], numeros) if numeros else endereco_sem_cep(b["address"]) if cep_a_confirmar(b) else b["address"]
    if numeros:
        conferir_numero_fora(c, numeros, endereco, consulta)
    satelite = perfil.get("mapa") == "satelite"  # v1.0 (CEDVET): mapa em satélite, pino no endereço
    maps_link = (google or {}).get("maps_url") or (
        "https://www.google.com/maps/search/?api=1&query=" + quote(f"{b['name']} {consulta}", safe=""))
    telefones = b["phones"]
    fone_ligar = next((p for p in telefones if p["kind"] == "landline"), telefones[0] if telefones else None)  # só o telefone das Configurações do painel
    return Contexto(
        b=b, c=c, slug=b["slug"], nome=c["display_name"], nome_completo=b["name"], tagline=c["tagline"], lead=c["lead"],
        nome_nos_dados=c["display_name"] if nome_com_prazo(b) else b["name"],  # JSON-LD: o nome com "24Horas" só volta quando o horário for confirmado
        about=c["about"], services=c["services"], highlights=c.get("highlights") or [], how_to=c["how_to"],
        form=c["form"], meta=c["meta_description"], hours=c.get("hours"), registry=registro_com_a_fonte(c.get("registry")),
        endereco=endereco, maps_link=maps_link,
        maps_src="https://www.google.com/maps?q=" + quote((f"{b['name']}, " if numeros else "") + consulta, safe="") + ("&t=k&z=18" if satelite else "") + "&output=embed",  # sem o número, o mapa busca pelo NOME (o pino do negócio, não um ponto qualquer da avenida)
        tem_wa=tem_wa, nao_confirmado=nao_confirmado, wa_digits=wa["digits"], wa_display=wa["display"],
        telefones=telefones, fone_ligar=fone_ligar, instagram=b["instagram"],
        nota=nota_br(google["rating"]) if google else None, avaliacoes=google["reviews"] if google else None,
        gestao=gestao, cta_label=cta_label,
        tema=tema, hero_variante=tema.get("hero", "ficha"), ornamento=tema.get("ornamento") or ORNAMENTO_PADRAO,
        subtipo=subtipo, receita=receita, mapa_satelite=satelite,
        foto_hero=(tema.get("foto_hero") or None) and (tema["foto_hero"]["arquivo"], tema["foto_hero"]["alt"]),
        hero_servicos=perfil.get("hero_servicos") if isinstance(perfil.get("hero_servicos"), str) and perfil["hero_servicos"].strip() else None,  # v1.5: texto autorizado no perfil
    )


# ---------- peças pequenas ----------
def botao(classe: str, href: str, rotulo: str, externo: bool = False, icone: str = "") -> str:
    rel = ' target="_blank" rel="noopener"' if externo else ""
    return f'<a class="{classe}" href="{esc(href)}"{rel}>{icone}{esc(rotulo)}</a>'


PIN_SVG = "<svg viewBox='0 0 64 64' aria-hidden='true' focusable='false'><use href='#pino'/></svg>"


def botoes_cta(c) -> str:
    """Botões do hero (v1.0, PEDIDO_DESIGN_2/3): levam aos serviços (e ao Instagram). O WhatsApp é só o flutuante (v1.1); o Como chegar, no fim da
    página inicial (#localizacao) e no rodapé. Nenhum botão de ligar."""
    out = [botao("btn", "#servicos", "Ver serviços")]
    if c.instagram:
        out.append(botao("btn btn-fantasma", c.instagram["url"], "Ver no Instagram", True))
    return f'<div class="linha-botoes">{"".join(out)}</div>'


def resumo_servicos(c) -> str:
    """Texto curto do atalho "Serviços" dos heroes: os títulos, até três."""
    titulos = [s["title"] for s in c.services]
    texto = ", ".join(titulos[:3])
    return texto + (f" e mais {len(titulos) - 3}" if len(titulos) > 3 else "")


PATA_TAM = 150  # v1.1 (PEDIDO_DESIGN_3, item G): 5x a pata de antes (30px)
PASSO_PATA = 210  # distância entre uma pegada e a seguinte, medida no caminho
LADO_PATA = 58  # meio passo de largura: pata esquerda e direita de cada lado do caminho


# pontos de passagem do caminho em S (frações da tela): sai do canto superior esquerdo, vai à direita descendo, volta à esquerda, faz a curva de baixo, sobe um
# pouco e desce até o canto inferior direito (item H: "sobem, descem, vão para um lado e para o outro")
TRAJETO_S = [(0, 0), (.34, .06), (.8, .18), (.88, .36), (.58, .46), (.2, .5), (.08, .7), (.34, .86), (.7, .7), (1, 1)]


def _trajeto_s(larg: float, alt: float, escala: float = 1.0) -> list[tuple[float, float]]:
    """Pontos do caminho em S (item H), curva suave (Catmull-Rom) pelos pontos de TRAJETO_S na tela de `larg` x `alt`. Amostra fina; quem usa reamostra pelo comprimento."""
    m = PATA_TAM * .45 + LADO_PATA * escala  # margem: a pata, com o desvio de lado, fica dentro da tela, inclusive nos dois cantos
    ps = [(m + x * (larg - 2 * m), m + y * (alt - 2 * m)) for x, y in TRAJETO_S]
    ps = [ps[0]] + ps + [ps[-1]]
    pts = []
    for k in range(1, len(ps) - 2):
        (x0, y0), (x1, y1), (x2, y2), (x3, y3) = ps[k - 1:k + 3]
        for n in range(60):
            t = n / 60
            t2, t3 = t * t, t * t * t
            pts.append((.5 * (2 * x1 + (x2 - x0) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (3 * x1 - x0 - 3 * x2 + x3) * t3),
                        .5 * (2 * y1 + (y2 - y0) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (3 * y1 - y0 - 3 * y2 + y3) * t3)))
    pts.append(ps[-2])
    return pts


def _pegadas_no_trajeto(pts: list[tuple[float, float]], escala: float = 1.0) -> list[tuple[float, float, float]]:
    """(x, y, ângulo) de cada pegada: uma a cada PASSO_PATA * escala no caminho, alternando esquerda e direita (LADO_PATA * escala), girada na direção do caminho.
    No retrato a escala é menor: a tela estreita pede passos mais curtos para o S se ler (com 210 eram 7 patas)."""
    import math
    total = sum(math.hypot(x1 - x0, y1 - y0) for (x0, y0), (x1, y1) in zip(pts, pts[1:]))
    passo = total / max(1, round(total / (PASSO_PATA * escala))) - 1e-6  # passo ajustado para a última pegada cair no fim do caminho (canto inferior direito)
    saida, acumulado, alvo, n = [], 0.0, 0.0, 0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        while seg and acumulado + seg >= alvo:
            f = (alvo - acumulado) / seg
            x, y = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
            ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
            lado = (LADO_PATA if n % 2 else -LADO_PATA) * escala  # normal à esquerda do sentido de marcha para a pata esquerda
            nx, ny = -math.sin(math.radians(ang)), math.cos(math.radians(ang))
            saida.append((x + nx * lado, y + ny * lado, ang + 90))  # a pata do sprite aponta para cima (-y)
            n += 1
            alvo += passo
        acumulado += seg
    return saida


def pegadas(c=None) -> str:
    """Rastro de um cachorro andando pela TELA (v1.1, PEDIDO_DESIGN_3 itens G e H): patas 5x maiores num caminho em S, do canto superior esquerdo ao inferior
    direito, alternadas e orientadas no sentido do caminho. Camada fixa atrás do conteúdo, só decoração (aria-hidden). Duas versões, paisagem e retrato, para o S
    caber na tela sem deformar a pata (preserveAspectRatio slice); o CSS do tema mostra uma ou outra."""
    if c is not None and c.ornamento.get("faixa") != "pegadas":
        return ""
    svgs = []
    for forma, (larg, alt, escala) in (("paisagem", (1280, 800, 1.0)), ("retrato", (390, 844, .5))):
        h = PATA_TAM / 2
        usos = "".join(f'<use href="#pata" width="{PATA_TAM}" height="{PATA_TAM}" transform="translate({x - h:.0f} {y - h:.0f}) rotate({a:.0f} {h:.0f} {h:.0f})" style="--passo:{i}"/>'
                       for i, (x, y, a) in enumerate(_pegadas_no_trajeto(_trajeto_s(larg, alt, escala), escala)))
        svgs.append(f'<svg class="pegadas-{forma}" viewBox="0 0 {larg} {alt}" preserveAspectRatio="xMidYMid slice" focusable="false">{usos}</svg>')
    return '<div class="pegadas" aria-hidden="true">' + "".join(svgs) + "</div>"


def carimbo(c) -> str:
    if not c.nota:
        return ""
    return (f'<a class="carimbo" href="{esc(c.maps_link)}" target="_blank" rel="noopener" '
            f'aria-label="Nota {c.nota} com {c.avaliacoes} avaliações no Google Maps"><b aria-hidden="true">{c.nota}</b>'
            f'<span aria-hidden="true">Google Maps</span></a>')


def _numeros(c) -> list[tuple[str, str]]:
    """WhatsApp e telefones como TEXTO (v1.0): o único botão de contato é o WhatsApp flutuante (v1.1)."""
    itens = [("WhatsApp", esc(c.wa_display))] if c.tem_wa else []
    itens += [("Telefone", esc(p["display"])) for p in c.telefones if not c.tem_wa or p["digits"] != c.wa_digits]
    return itens


def ficha(c, titulo: str, tag: str = "h2", com_carimbo: bool = True) -> str:
    itens = _numeros(c)
    itens.append(("Endereço", esc(c.endereco)))
    if c.hours:
        itens.append(("Horário", esc(c.hours["text"])))
    if c.registry:
        itens.append((esc(c.registry["label"]), esc(c.registry["value"])))
    if c.nota:
        itens.append(("Avaliações", f'nota {c.nota} com {c.avaliacoes} avaliações no Google Maps<br>'
                                    f'<a href="{esc(c.maps_link)}" target="_blank" rel="noopener">Ver no Google Maps</a>'))
    linhas = "".join(f'<div class="item"><dt>{k}</dt><dd>{v}</dd></div>' for k, v in itens)
    return (f'<aside class="ficha">{carimbo(c) if com_carimbo else ""}<{tag}>{esc(titulo)}</{tag}><dl>{linhas}</dl></aside>')


def servicos_lista(c, limite: int | None = None) -> str:
    itens = c.services[:limite] if limite else c.services
    out = []
    for s in itens:
        foto = figura_ilustrativa(*foto_servico(s))
        out.append(f'<article class="servico servico--foto revela">{foto}<span class="icone" aria-hidden="true"><svg viewBox="0 0 64 64"><use href="#{c.ornamento["servico"]}"/></svg></span>'
                   f'<h3>{esc(s["title"])}</h3><div class="servico-corpo"><p>{esc(s["text"])}</p></div></article>')
    return f'<div class="servicos servicos--fotos" style="--n:{len(out)}">{"".join(out)}</div>'  # --n: com um serviço só, o card deita (imagem ao lado do texto)


def passos(c) -> str:
    li = "".join(f"<li><strong>{esc(p['title'])}</strong><span>{esc(p['text'])}</span></li>" for p in c.how_to)
    return f'<ol class="passos" style="--n:{len(c.how_to)}">{li}</ol>'


def cabeca(titulo: str, tag: str = "h2", texto: str | None = None) -> str:
    p = f"<p>{esc(texto)}</p>" if texto else ""
    return f'<div class="secao-cabeca"><{tag}>{esc(titulo)}</{tag}>{p}</div>'


def faixa_contato(c, titulo: str = "Fale com a equipe", texto: str | None = None) -> str:
    texto_html = f"<p>{esc(texto)}</p>" if texto else ""
    return (f'<section class="faixa escuro" id="contato-rapido"><div class="container"><h2>{esc(titulo)}</h2>{texto_html}'
            f'<p class="faixa-endereco">{esc(c.endereco)}</p><div class="linha-botoes">{botao("btn", "contato.html", "Ver contatos")}</div></div></section>')


def secao_localizacao(c) -> str:
    """Fim da página inicial (v1.0, PEDIDO_DESIGN_2): endereço, horário, mapa e o botão Como chegar, que saiu do topo."""
    itens = [("Endereço", esc(c.endereco))]
    if c.hours:
        itens.append(("Horário", esc(c.hours["text"])))
    linhas = "".join(f'<div class="item"><dt>{k}</dt><dd>{v}</dd></div>' for k, v in itens)
    return (f'<section class="secao localizacao" id="localizacao"><div class="container">{cabeca("Onde estamos")}<div class="localizacao-grade">'
            f'<div class="localizacao-info"><dl class="contatos">{linhas}</dl>'
            f'<div class="linha-botoes">{botao("btn", c.maps_link, "Como chegar", True, PIN_SVG)}</div></div>{mapa(c, com_link=False)}</div></div></section>')


_SIGLAS_COM_PONTO = {"av", "dr", "dra", "sr", "sra", "cel", "prof", "profa", "ten", "cap", "gen", "eng", "pça", "tv", "al", "est", "rod", "jd", "vl", "pq", "ltda", "nº", "sta", "sto", "ap", "apt", "esq", "dep"}


def _fim_de_frase_de_verdade(corte: str, pos: int) -> bool:
    """O ponto em corte[pos] encerra uma frase? Não encerra se a palavra antes dele é uma sigla de endereço ou de título ("Av.", "R.", "Dra.", "Cel.") ou tem uma letra só ("R.", "J.").
    Antes (0.7) a descrição cortava em "... que atende na Av." (a atribuição da 0.8 alongou o texto e o corte caiu na sigla)."""
    palavra = re.search(r"([^\W\d_]+)$", corte[:pos])
    if not palavra:
        return True
    p = palavra.group(1)
    return not (len(p) == 1 or p.lower() in _SIGLAS_COM_PONTO)


def resumo_meta(texto: str, limite: int = 155) -> str:
    """Descrição para buscadores: o texto inteiro se couber; senão até o último fim de frase dentro do limite (sem cortar em "Av.", "R.", "Dra."); senão corta na última palavra com reticências.
    Antes cortava no caractere 155 e deixava frases pela metade ("Segundo o diretório Cylex, o")."""
    if len(texto) <= limite:
        return texto
    corte = texto[:limite]
    for m in reversed(list(re.finditer(r"[.!?] ", corte))):
        if m.start() >= 60 and (m.group(0)[0] != "." or _fim_de_frase_de_verdade(corte, m.start())):
            return corte[:m.start() + 1]
    return corte[:corte.rfind(" ")].rstrip(",;:") + "…"


def pagina_topo(titulo: str, texto: str | None = None) -> str:
    p = f"<p>{esc(texto)}</p>" if texto else ""
    return f'<section class="pagina-topo"><div class="container"><h1>{esc(titulo)}</h1>{p}</div></section>'


def _dobrar(texto: str) -> str:
    """minúsculas sem acento, para casar palavras da receita com o texto dos serviços."""
    return unicodedata.normalize("NFKD", texto.lower()).encode("ascii", "ignore").decode()


def especies_atendidas(c) -> list[dict]:
    """Espécies citadas nos serviços COM FONTE, na ordem da receita. Cada item: rotulo, icone, servico (título onde consta).
    Nada é inferido: se a palavra não está no título ou no texto de um serviço com fonte, a espécie não aparece."""
    cfg = c.receita.get("quadro_especies")
    if not cfg:
        return []
    servicos = [s for s in c.services if s.get("source")]
    achadas = []
    for item in cfg["itens"]:
        padrao = re.compile(r"(?<![a-z])(?:" + "|".join(re.escape(t) for t in item["busca"]) + r")(?![a-z])")
        for s in servicos:
            if padrao.search(_dobrar(s["title"] + " " + s["text"])):
                achadas.append({"rotulo": item["rotulo"], "icone": item["icone"], "servico": s["title"],
                                "destaque": s is servicos[0]})
                break
    return achadas


def quadro_especies(c) -> str:
    """Faixa 'Quem atendemos': uma célula por espécie citada nos serviços com fonte; a célula diz de qual serviço veio.
    As células do primeiro serviço (o principal do negócio) ficam em destaque escuro."""
    itens = especies_atendidas(c)
    if not itens:
        return ""
    cfg = c.receita["quadro_especies"]
    li = "".join(
        f'<li class="especie{" especie--destaque" if i["destaque"] else ""}">{icone_svg(i["icone"])}'
        f'<strong>{esc(i["rotulo"])}</strong><span>{esc(cfg.get("rotulo_servico", ""))}{esc(i["servico"])}</span></li>' for i in itens)
    return (f'<section class="quadro" aria-labelledby="quadro-titulo"><div class="container"><h2 id="quadro-titulo">{esc(cfg["titulo"])}</h2>'
            f'<ul class="quadro-lista">{li}</ul></div></section>')


def hero_ficha(c) -> str:
    """Hero da identidade 'caderneta': texto à esquerda, ficha com carimbo à direita, pegadas embaixo."""
    return (f'<section class="hero"><div class="container hero-grade"><div><h1>{esc(c.tagline)}</h1>'
            f'<p class="destaque">{esc(c.lead)}</p>{botoes_cta(c)}</div>{ficha(c, c.nome, "h2")}</div></section>')  # v1.1: as pegadas saíram da faixa do hero e andam pela tela (pegadas, no fim do <body>)


def hero_viveiro(c) -> str:
    """Hero da identidade 'terrário': texto à esquerda; à direita o arco do terrário de onde pende a etiqueta (a ficha)."""
    return (f'<section class="hero hero--viveiro"><div class="container hero-grade"><div><h1>{esc(c.tagline)}</h1>'
            f'<p class="destaque">{esc(c.lead)}</p>{botoes_cta(c)}</div>'
            f'<div class="viveiro"><div class="viveiro-arco"><div class="pendulo">{ficha(c, c.nome, "h2")}</div></div></div></div></section>')


def hero_cruz(c) -> str:
    """Hero da identidade 'sinalizacao' (hospital/plantão), v1.2 (PEDIDO_DESIGN_3, item I, refeito do zero): "cruz de plantão". O "+" da marca vira a janela
    por onde se vê a imagem ilustrativa (`foto_hero` do tema, legendada), com um "+" amarelo deslocado atrás, como placa de sinalização; a nota do Google fica
    no canto da janela. À esquerda, título, texto e os dois CTAs do primeiro toque (Ver serviços e Onde fica; `data-toque`). No pé, um trilho com serviços,
    endereço e o horário (este só se o JSON trouxer horário, com as palavras e a fonte do JSON). Nada liga nem abre o WhatsApp: ele é o botão flutuante."""
    ctas = (f'<a class="btn cz-cta" data-toque="servicos" href="#servicos">{icone_svg("cruz")}Ver serviços</a>'
            f'<a class="btn cz-cta" data-toque="onde" href="#localizacao">{icone_svg("pino")}Onde fica</a>')
    dados = [("servicos", "cruz", "Serviços", resumo_servicos(c)), ("onde", "pino", "Endereço", c.endereco)]
    if c.hours:
        dados.append(("horario", "relogio", "Horário", c.hours["text"]))
    trilho = "".join(f'<li class="cz-dado cz-dado--{k}"><b>{icone_svg(s)}{esc(r)}</b><span>{esc(t)}</span></li>' for k, s, r, t in dados)
    foto = figura_ilustrativa(*c.foto_hero, classe="ilustra cz-foto", carregar="eager") if c.foto_hero else ""
    return (f'<section class="hero hero--cruz"><div class="container cz-grade">'
            f'<div class="cz-texto"><h1>{esc(c.tagline)}</h1><p class="destaque">{esc(c.lead)}</p><div class="cz-acoes">{ctas}</div></div>'
            f'<div class="cz-janela"><span class="cz-sinal" aria-hidden="true"></span>{foto}{carimbo(c)}</div>'
            f'<ul class="cz-trilho">{trilho}</ul></div></section>')


def anotacao_chapa(simbolo: str, toque: str, titulo: str, texto: str, href: str | None = None, externo: bool = False) -> str:
    """Uma anotação da chapa (como o texto gravado no canto de uma radiografia): marcador com pictograma, rótulo e dado. É link quando tem `href`.
    `data-toque` marca as anotações do primeiro toque no celular (telefone e rota), que o teste confere sem rolar."""
    interno = (f'<span class="anotacao-marca">{icone_svg(simbolo)}</span>'
               f'<span class="anotacao-texto"><b>{esc(titulo)}</b><span>{esc(texto)}</span></span>')
    if not href:
        return f'<li><div class="anotacao anotacao--{toque}">{interno}</div></li>'
    rel = ' target="_blank" rel="noopener"' if externo else ""
    return f'<li><a class="anotacao anotacao--{toque}" data-toque="{toque}" href="{esc(href)}"{rel}>{interno}</a></li>'


def hero_chapa(c) -> str:
    """Hero da identidade 'chapa' (centro de diagnóstico por imagem): título e texto à esquerda; à direita uma chapa sobre a mesa de luz, com régua nas bordas e
    as anotações do que o tutor precisa no primeiro toque: ligar, como chegar e o horário (este só se o JSON trouxer horário com fonte). Não há botões soltos:
    as anotações SÃO os botões. Nada é afirmado além dos dados; o horário sai com as palavras do JSON (e a fonte, se a receita pedir)."""
    notas = [anotacao_chapa("mira", "servicos", "Serviços", resumo_servicos(c), "#servicos"),
             anotacao_chapa("pino", "onde", "Onde fica", c.endereco, "#localizacao")]
    if c.hours:
        notas.append(anotacao_chapa("relogio", "horario", "Horário", c.hours["text"]))
    pe = f'<div class="chapa-pe">{carimbo(c)}</div>' if c.nota else ""
    return (f'<section class="hero hero--chapa"><div class="container hero-grade"><div class="hero-texto"><h1>{esc(c.tagline)}</h1>'
            f'<p class="destaque">{esc(c.lead)}</p></div>'
            f'<div class="chapa"><span class="chapa-regua chapa-regua--topo" aria-hidden="true"></span><span class="chapa-regua chapa-regua--lado" aria-hidden="true"></span>'
            f'<ul class="chapa-notas">{"".join(notas)}</ul>{pe}</div></div></section>')


def etiqueta_gondola(simbolo, toque: str, titulo: str, texto: str, href: str | None = None, externo: bool = False, icone_html: str | None = None) -> str:
    """Uma etiqueta pendurada na parede de ganchos: fio, furo, marca com pictograma, rótulo e dado. É link quando tem `href`. `data-toque` marca as etiquetas do
    primeiro toque no celular (telefone e rota), que o teste confere sem rolar. Todas as classes levam o prefixo `gd-` (uma colisão de nome com o chão liso já custou caro)."""
    marca = icone_html if icone_html is not None else icone_svg(simbolo)
    interno = (f'<span class="gd-furo" aria-hidden="true"></span><span class="gd-etq-marca">{marca}</span>'
               f'<span class="gd-etq-texto"><b>{esc(titulo)}</b><span>{esc(texto)}</span></span>')
    if not href:
        return f'<li><div class="gd-etq gd-etq--{toque}">{interno}</div></li>'
    rel = ' target="_blank" rel="noopener"' if externo else ""
    return f'<li><a class="gd-etq gd-etq--{toque}" data-toque="{toque}" href="{esc(href)}"{rel}>{interno}</a></li>'


def hero_gondola(c) -> str:
    """Hero da identidade 'gondola' (clínica com venda de produtos): título e texto à esquerda; à direita uma parede de ganchos (painel perfurado de loja) com as etiquetas do
    que o tutor precisa no primeiro toque: ligar, como chegar e o horário (este só se o JSON trouxer horário, com a fonte). As etiquetas SÃO os botões. A faixa de
    prateleira no pé leva a nota do Google. Nada é afirmado além dos dados: sem preço, marca nem catálogo; a única imagem é ilustrativa e diz isso na legenda."""
    etiquetas = [etiqueta_gondola("etiqueta", "servicos", "Serviços", resumo_servicos(c), "#servicos"),
                 etiqueta_gondola("pino", "onde", "Onde fica", c.endereco, "#localizacao")]
    if c.hours:
        etiquetas.append(etiqueta_gondola("relogio", "horario", "Horário", c.hours["text"]))
    pe = f'<div class="gd-prateleira">{carimbo(c)}</div>' if c.nota else ""
    # v1.0 (PEDIDO_DESIGN_3, item B): com `foto_hero` no tema, o painel perfurado de fundo é a imagem ilustrativa (com a legenda); as etiquetas penduram por cima
    foto = figura_ilustrativa(*c.foto_hero, classe="ilustra gd-foto", carregar="eager") if c.foto_hero else ""
    parede = "gd-parede gd-parede--foto" if foto else "gd-parede"
    return (f'<section class="hero hero--gondola"><div class="container hero-grade"><div class="hero-texto"><h1>{esc(c.tagline)}</h1>'
            f'<p class="destaque">{esc(c.lead)}</p></div>'
            f'<div class="{parede}">{foto}<ul class="gd-etiquetas">{"".join(etiquetas)}</ul>{pe}</div></div></section>')


def bloco_dupla(simbolo, toque: str, titulo: str, texto: str, href: str | None = None, externo: bool = False, icone_html: str | None = None) -> str:
    """Uma célula do balcão do hero 'dupla': rótulo com pictograma e o dado. É link quando tem `href`. `data-toque` marca as células do primeiro toque no celular (telefone e rota),
    que o teste confere sem rolar. Todas as classes levam o prefixo `dp-`."""
    marca = icone_html if icone_html is not None else icone_svg(simbolo)
    interno = f'<span class="dp-rotulo">{marca}<b>{esc(titulo)}</b></span><span class="dp-valor">{esc(texto)}</span>'
    if not href:
        return f'<li><div class="dp-bloco dp-bloco--{toque}">{interno}</div></li>'
    rel = ' target="_blank" rel="noopener"' if externo else ""
    return f'<li><a class="dp-bloco dp-bloco--{toque}" data-toque="{toque}" href="{esc(href)}"{rel}>{interno}</a></li>'


def hero_dupla(c) -> str:
    """Hero da identidade 'dupla' (hospital/plantão, site 6: Doc & Dog): o nome como cartaz (as duas metades do nome em duas cores, o '&' entre elas) e, em faixa que vai de
    uma borda à outra, o balcão com o que o tutor precisa no primeiro toque: ligar, como chegar e o horário (este só se o JSON trouxer horário, com a fonte). As células SÃO os
    botões. A nota do Google e o WhatsApp ficam no pé da faixa. Nada é afirmado além dos dados: sem foto, sem selo de urgência, sem relógio de funcionamento nem luz acesa.
    Estrutura: topo (nome + título), faixa (balcão) e texto de apresentação, nessa ordem no celular; no desktop o texto sobe para junto do título (grade da seção)."""
    partes = [p.strip() for p in re.split(r"\s+&\s+", c.nome, maxsplit=1)]
    if len(partes) == 2 and all(partes):
        nome = (f'<p class="dp-nome" aria-hidden="true"><span class="dp-metade">{esc(partes[0])}</span><span class="dp-e">&amp;</span>'
                f'<span class="dp-metade dp-metade--2">{esc(partes[1])}</span></p>')
    else:
        nome = f'<p class="dp-nome" aria-hidden="true"><span class="dp-metade">{esc(c.nome)}</span></p>'
    blocos = [bloco_dupla("dupla", "servicos", "Serviços", resumo_servicos(c), "#servicos"),
              bloco_dupla("pino", "onde", "Onde fica", c.endereco, "#localizacao")]
    if c.hours:
        blocos.append(bloco_dupla("relogio", "horario", "Horário", c.hours["text"]))
    pe = f'<div class="dp-pe">{carimbo(c)}</div>' if c.nota else ""
    return (f'<section class="hero hero--dupla"><div class="container dp-topo">{nome}<h1>{esc(c.tagline)}</h1></div>'
            f'<div class="dp-faixa"><div class="container"><ul class="dp-balcao" style="--n:{len(blocos)}">{"".join(blocos)}</ul>{pe}</div></div>'
            f'<div class="container dp-lead"><p class="destaque">{esc(c.lead)}</p></div></section>')


def _numero_em_grupos(display: str) -> str:
    """'(15) 3346-9536' -> o DDD e o resto em dois grupos que não se quebram por dentro: se o número não couber numa linha, quebra entre o DDD e o resto, nunca no meio dos dígitos."""
    m = re.match(r"^\s*(\(\d{2}\))\s*(\S.*?)\s*$", str(display))
    if m:
        return f'<span class="lt-grupo">{esc(m.group(1))}</span> <span class="lt-grupo">{esc(m.group(2))}</span>'
    return f'<span class="lt-grupo">{esc(display)}</span>'


def linha_letreiro(simbolo, toque: str, titulo: str, texto: str, href: str | None = None, externo: bool = False) -> str:
    """Uma linha do letreiro (abaixo da faixa do telefone): rótulo com pictograma e o dado. É link quando tem `href`. `data-toque` marca as linhas do primeiro toque no celular.
    Todas as classes levam o prefixo `lt-`."""
    interno = f'<span class="lt-rotulo">{icone_svg(simbolo)}<b>{esc(titulo)}</b></span><span class="lt-valor">{esc(texto)}</span>'
    if not href:
        return f'<li><div class="lt-linha lt-linha--{toque}">{interno}</div></li>'
    rel = ' target="_blank" rel="noopener"' if externo else ""
    return f'<li><a class="lt-linha lt-linha--{toque}" data-toque="{toque}" href="{esc(href)}"{rel}>{interno}</a></li>'


def hero_letreiro(c) -> str:
    """Hero da identidade 'letreiro' (clínica de bairro, site 7: Del Vet): o TELEFONE é o letreiro. Uma faixa pintada de uma borda à outra leva o número em letras enormes (é o
    link de Ligar); abaixo, em linhas de letreiro, Como chegar e o horário (este só se o JSON trouxer horário, com a fonte) e, ao lado no desktop, o texto de apresentação. É
    uma coluna só: a ordem do DOM é a ordem visual no celular e no desktop (a `dupla` não consegue isso). Com número CONFIRMADO a faixa é o WhatsApp e o Ligar vira uma linha.
    Nada é afirmado além dos dados: sem foto, sem selo de urgência, sem relógio, sem área de atendimento. Todas as classes levam o prefixo `lt-`."""
    # v1.0: o número continua sendo o letreiro, mas como TEXTO (sem tel: nem wa.me); o toque leva ao WhatsApp flutuante
    faixa = ""
    if c.tem_wa:
        faixa = (f'<div class="lt-fone lt-fone--wa" data-toque="numero"><span class="lt-chamada">{WA_SVG}WhatsApp</span>'
                 f'<span class="lt-numero">{_numero_em_grupos(c.wa_display)}</span></div>')
    elif c.fone_ligar:
        faixa = (f'<div class="lt-fone" data-toque="numero"><span class="lt-chamada">{FONE_SVG}Telefone</span>'
                 f'<span class="lt-numero">{_numero_em_grupos(c.fone_ligar["display"])}</span></div>')
    linhas = [linha_letreiro("pata", "servicos", "Serviços", resumo_servicos(c), "#servicos"),
              linha_letreiro("pino", "onde", "Onde fica", c.endereco, "#localizacao")]
    if c.hours:
        linhas.append(linha_letreiro("relogio", "horario", "Horário", c.hours["text"]))
    pe = f'<div class="container lt-pe">{carimbo(c)}</div>' if c.nota else ""
    return (f'<section class="hero hero--letreiro"><div class="container lt-topo"><h1>{esc(c.tagline)}</h1></div>'
            + (f'<div class="lt-faixa"><div class="container">{faixa}</div></div>' if faixa else "")
            + f'<div class="container lt-corpo"><ul class="lt-linhas">{"".join(linhas)}</ul><p class="destaque lt-lead">{esc(c.lead)}</p></div>{pe}</section>')


# o número de porta só vale inteiro: "245A", "245/247", "245 B", "1.234" e "12-B" não são lidos (o hero mostra só a rua; nada é cortado nem inventado)
_RUA_NUMERO = re.compile(r"^(?P<rua>.*?[^\W\d_])\s*,\s*(?:n[º°]\s*)?(?P<n>\d{1,5})(?=\s*(?:,|$))")


def endereco_em_partes(endereco) -> dict:
    """'R. Rodrigues Pacheco, 341 - Centro – Sorocaba, 18035-085' -> {rua, numero, bairro, cidade}; o que o endereço não traz vem vazio (nada é inventado). Sem o número (cadastro sem número
    ou número em disputa, regra 21) `numero` é vazio: o hero `numero` mostra só a rua. Observação de entrada ("Entrada pelo estacionamento lateral - Av. Ipanema, 4788") não é rua."""
    texto = str(endereco or "").strip()
    texto = re.sub(r",\s*\d{5}-?\d{3}$", "", texto)
    esq, sep, cidade = texto.rpartition(" – ")
    if not sep:
        esq, cidade = texto, ""
    rua_num, sep2, bairro = esq.rpartition(" - ")
    if not sep2:
        rua_num, bairro = esq, ""
    # o trecho "rua, número" é o último que tem número ("Entrada pelo estacionamento lateral - Av. Ipanema, 4788", "R. X, 10 - Sala 3 - Centro"); sem nenhum, o último trecho
    pecas = [x.strip() for x in rua_num.split(" - ") if x.strip()] or [rua_num.strip()]
    m = None
    for peca in reversed(pecas):
        m = _RUA_NUMERO.match(peca)
        if m:
            break
    rua, numero = (m.group("rua").strip(), m.group("n")) if m else (pecas[-1].split(",")[0].strip(), "")
    return {"rua": rua, "numero": numero, "bairro": bairro.strip(), "cidade": cidade.strip().split(",")[0].strip()}


def fato_numero(simbolo, toque: str, titulo: str, texto: str) -> str:
    """Um fato da faixa do hero `numero` (v1.5): rótulo com pictograma e o dado, como TEXTO (não é link). Prefixo `nm-`."""
    return (f'<li class="nm-fato nm-fato--{toque}"><span class="nm-rotulo">{icone_svg(simbolo)}<b>{esc(titulo)}</b></span>'
            f'<span class="nm-valor">{esc(texto)}</span></li>')


def nota_numero(c) -> str:
    """A nota do Google do hero `numero` (v1.5): plaquinha que é link para o Perfil, com "4,9 ★" e "254 avaliações no Google Maps" visíveis e o aria-label no formato da regra 3."""
    if not c.nota:
        return ""
    return (f'<a class="nm-nota" href="{esc(c.maps_link)}" target="_blank" rel="noopener" aria-label="Nota {c.nota} com {c.avaliacoes} avaliações no Google Maps">'
            f'<b aria-hidden="true">{c.nota}<span class="nm-estrela">★</span></b><span aria-hidden="true">{c.avaliacoes} avaliações no Google Maps</span></a>')


def hero_numero(c) -> str:
    """Hero da identidade 'numero' (clínica do Centro, site 8: Animal Inc). v1.5 (PEDIDO_DESIGN_4): o André achou que a placa isolada da 0.9 parecia um modal solto; o hero virou uma FAIXA DE
    ABERTURA de uma borda à outra (a parede verde-garrafa com o rejunte), em duas colunas: à esquerda o título, a apresentação, os atalhos Ver serviços e Onde fica (`data-toque`) e os fatos do
    cadastro como texto (serviços, horário com a fonte, endereço e, se a pesquisa sustenta com fonte, o CNPJ aberto e ativo); à direita a imagem ilustrativa (`foto_hero` do tema, legendada) com
    a placa esmaltada do NÚMERO DA PORTA afixada no canto (decorativa, aria-hidden: o endereço está nos fatos) e a nota do Google. Sem número no cadastro (ou com o número em disputa) a placa
    mostra só a rua; sem endereço que se leia, não há placa. A ordem do DOM (título, apresentação, atalhos, fatos, imagem) é a ordem visual no celular e no desktop (o `e2e_vitrine` mede). A linha
    "Serviços" usa `hero_servicos` do perfil quando o André autorizou um texto (com a pendência no README); senão, os títulos dos serviços do cadastro. Todas as classes levam o prefixo `nm-`."""
    p = endereco_em_partes(c.endereco)
    local = " · ".join(x for x in (p["bairro"], p["cidade"]) if x)
    bloco = ""
    if p["numero"]:
        digitos = "nm-n--d" + str(min(len(p["numero"]), 5))
        bloco = (f'<div class="nm-bloco" aria-hidden="true"><b class="nm-n {digitos}">{esc(p["numero"])}</b><span class="nm-rua">{esc(p["rua"])}</span>'
                 + (f'<span class="nm-local">{esc(local)}</span>' if local else "") + '</div>')
    elif p["rua"]:
        bloco = (f'<div class="nm-bloco nm-bloco--rua" aria-hidden="true"><span class="nm-rua nm-rua--so">{esc(p["rua"])}</span>'
                 + (f'<span class="nm-local">{esc(local)}</span>' if local else "") + '</div>')
    ctas = (f'<a class="btn nm-botao" data-toque="servicos" href="#servicos">{icone_svg("pata")}Ver serviços</a>'
            f'<a class="btn nm-botao nm-botao--onde" data-toque="onde" href="#localizacao">{icone_svg("pino")}Onde fica</a>')  # v1.0: sem Ligar nem WhatsApp no hero
    fatos = [fato_numero("pata", "servicos", "Serviços", c.hero_servicos or resumo_servicos(c))] if (c.hero_servicos or c.services) else []
    if c.hours:
        fatos.append(fato_numero("relogio", "horario", "Horário", c.hours["text"]))
    if c.endereco:
        fatos.append(fato_numero("pino", "endereco", "Endereço", c.endereco))
    cnpj = cnpj_ativo_desde(c.b) if c.b else None
    if cnpj:
        fatos.append(fato_numero("numero", "empresa", "Empresa", cnpj))
    lista = f'<ul class="nm-fatos">{"".join(fatos)}</ul>' if fatos else ""
    foto = figura_ilustrativa(*c.foto_hero, classe="ilustra nm-foto", carregar="eager") if c.foto_hero else ""
    vitrine = f'<div class="nm-vitrine">{foto}{bloco}{nota_numero(c)}</div>' if (foto or bloco or c.nota) else ""
    sem = "" if vitrine else " nm-grade--uma"
    return (f'<section class="hero hero--numero"><div class="nm-faixa"><div class="container nm-grade{sem}"><div class="nm-texto"><h1>{esc(c.tagline)}</h1>'
            f'<p class="destaque nm-lead">{esc(c.lead)}</p><div class="nm-acoes">{ctas}</div>{lista}</div>{vitrine}</div></div></section>')


def linha_registro(simbolo, toque: str, titulo: str, texto: str) -> str:
    """Uma linha de lançamento do hero `registro`: rótulo com pictograma e o dado, como TEXTO (não é link nem botão). `data-toque="numero"` marca a linha do número de contato (como no
    `letreiro`). Todas as classes levam o prefixo `rg-`."""
    marca = ' data-toque="numero"' if toque == "numero" else ""
    return (f'<li><div class="rg-linha rg-linha--{toque}"{marca}><span class="rg-rotulo">{icone_svg(simbolo)}<b>{esc(titulo)}</b></span>'
            f'<span class="rg-valor">{esc(texto)}</span></div></li>')


def hero_registro(c) -> str:
    """Hero da identidade 'registro' (clínica de bairro com seis serviços e só telefone fixo, site 9: Ishizuka): UMA folha de livro de registro (margem dupla à esquerda e a fita marcadora que sai
    pelo topo) com o título, a apresentação, os dois atalhos do primeiro toque (Ver serviços e Onde fica, `data-toque`) e, em linhas de lançamento, o número de contato como TEXTO, o endereço e o
    horário (este só se o JSON trouxer horário, com as palavras e a fonte do JSON). Sem número de conversa não há botão de contato: o telefone é a linha. A ordem do DOM (título, apresentação, atalhos,
    linhas, nota) é a ordem visual no celular e no desktop (no desktop, título | apresentação e depois atalhos | linhas; o `e2e_vitrine` mede). Sem foto, sem selo de urgência, sem relógio
    de funcionamento, sem área de atendimento. Todas as classes levam o prefixo `rg-`."""
    ctas = (f'<a class="btn rg-botao" data-toque="servicos" href="#servicos">{icone_svg("registro")}Ver serviços</a>'
            f'<a class="btn rg-botao rg-botao--onde" data-toque="onde" href="#localizacao">{icone_svg("pino")}Onde fica</a>')
    linhas = []
    if c.tem_wa:
        linhas.append(linha_registro("fone", "numero", "WhatsApp", c.wa_display))
    elif c.fone_ligar:
        linhas.append(linha_registro("fone", "numero", "Telefone", c.fone_ligar["display"]))
    if c.endereco:
        linhas.append(linha_registro("pino", "endereco", "Endereço", c.endereco))
    if c.hours:
        linhas.append(linha_registro("relogio", "horario", "Horário", c.hours["text"]))
    pe = f'<div class="rg-pe">{carimbo(c)}</div>' if c.nota else ""
    return (f'<section class="hero hero--registro"><div class="container"><div class="rg-folha"><span class="rg-fita" aria-hidden="true"></span>'
            f'<h1>{esc(c.tagline)}</h1><p class="destaque rg-lead">{esc(c.lead)}</p><div class="rg-acoes">{ctas}</div>'
            f'<ul class="rg-linhas">{"".join(linhas)}</ul>{pe}</div></div></section>')


def linha_pilares(simbolo, toque: str, titulo: str, texto: str) -> str:
    """Um degrau do hero `pilares`: rótulo com pictograma e o dado, como TEXTO (não é link nem botão). `data-toque="numero"` marca o degrau do número de contato. Prefixo `pl-`."""
    marca = ' data-toque="numero"' if toque == "numero" else ""
    return (f'<li class="pl-degrau"><div class="pl-linha pl-linha--{toque}"{marca}><span class="pl-rotulo">{icone_svg(simbolo)}<b>{esc(titulo)}</b></span>'
            f'<span class="pl-valor">{esc(texto)}</span></div></li>')


def hero_pilares(c) -> str:
    """Hero da identidade 'pilares' (hospital 24h, site 10: Pilares): o NOME do negócio é a ideia. Uma fachada de templo, simples e geométrica: o frontão (triângulo) sobre o friso escuro com o título, a
    apresentação e os dois atalhos do primeiro toque (Ver serviços e Onde fica, `data-toque`); abaixo, uma coluna por serviço do cadastro (até 6; só o título, que a seção Serviços repete por inteiro; a
    colunata é decorativa e `aria-hidden`); e, nos degraus, o número de contato como TEXTO, o endereço e o horário (este só se o JSON trouxer, com as palavras e a fonte do JSON). No celular as colunas
    viram UMA coluna de tambores empilhados. A ordem do DOM (friso, colunas, degraus, nota) é a ordem visual nos dois tamanhos (o `e2e_vitrine` mede). Sem selo de urgência, relógio, luz acesa nem
    foto da unidade. Todas as classes levam o prefixo `pl-`."""
    ctas = (f'<a class="btn pl-botao" data-toque="servicos" href="#servicos">{icone_svg("pilares")}Ver serviços</a>'
            f'<a class="btn pl-botao pl-botao--onde" data-toque="onde" href="#localizacao">{icone_svg("pino")}Onde fica</a>')
    titulos = [s["title"] for s in c.services][:6]
    colunas = "".join(f'<li class="pl-coluna" style="--i:{i}"><span class="pl-capitel"></span><span class="pl-fuste"><b>{esc(x)}</b></span><span class="pl-base"></span></li>' for i, x in enumerate(titulos))
    muitas = " pl-colunas--muitas" if len(titulos) > 5 else ""  # com mais de 5 colunas a palavra não cabe lado a lado: ficam sempre empilhadas
    colunata = f'<ol class="pl-colunas{muitas}" style="--n:{len(titulos)}" aria-hidden="true">{colunas}</ol>' if titulos else ""
    degraus = []
    if c.tem_wa:
        degraus.append(linha_pilares("fone", "numero", "WhatsApp", c.wa_display))
    elif c.fone_ligar:
        degraus.append(linha_pilares("fone", "numero", "Telefone", c.fone_ligar["display"]))
    if c.endereco:
        degraus.append(linha_pilares("pino", "endereco", "Endereço", c.endereco))
    if c.hours:
        degraus.append(linha_pilares("relogio", "horario", "Horário", c.hours["text"]))
    pe = f'<div class="pl-pe">{carimbo(c)}</div>' if c.nota else ""
    return (f'<section class="hero hero--pilares"><div class="container"><div class="pl-fachada"><div class="pl-friso"><h1>{esc(c.tagline)}</h1><p class="destaque pl-lead">{esc(c.lead)}</p>'
            f'<div class="pl-acoes">{ctas}</div></div>{colunata}<ul class="pl-degraus">{"".join(degraus)}</ul>{pe}</div></div></section>')


HEROIS = {"ficha": hero_ficha, "viveiro": hero_viveiro, "cruz": hero_cruz, "chapa": hero_chapa, "gondola": hero_gondola, "dupla": hero_dupla, "letreiro": hero_letreiro, "numero": hero_numero,
          "registro": hero_registro, "pilares": hero_pilares}


def hero(c) -> str:
    """Hero conforme `tema.hero`; com a receita de espécies, o quadro 'Quem atendemos' vem logo depois."""
    return HEROIS[c.hero_variante](c) + quadro_especies(c)


def contatos(c) -> str:
    itens = _numeros(c)
    if c.instagram:
        itens.append(("Instagram", f'<a href="{esc(c.instagram["url"])}" target="_blank" rel="noopener">@{esc(c.instagram["handle"])}</a>'))
    itens.append(("Endereço", esc(c.endereco)))
    if c.hours:
        itens.append(("Horário", esc(c.hours["text"])))
    if c.nota:
        itens.append(("Avaliações", f'nota {c.nota} com {c.avaliacoes} avaliações no Google Maps'))
    linhas = "".join(f'<div class="item"><dt>{k}</dt><dd>{v}</dd></div>' for k, v in itens)
    return f'<dl class="contatos">{linhas}</dl>'


def mapa(c, com_link: bool = True) -> str:
    link = f'<a href="{esc(c.maps_link)}" target="_blank" rel="noopener">Abrir no Google Maps</a>' if com_link else ""
    vista = " em satélite" if c.mapa_satelite else ""
    return (f'<div class="mapa"><iframe title="Mapa{vista} com o endereço de {esc(c.nome)}" src="{esc(c.maps_src)}" loading="lazy" '
            f'referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>{link}</div>')


# ---------- estrutura comum das páginas ----------
def cabecalho(c, atual: str) -> str:
    links = "".join(f'<a href="{f}"' + (' aria-current="page"' if f == atual else "") + f">{r}</a>" for f, r in NAV)
    # v1.1 (PEDIDO_DESIGN_3, item F): o topo não tem botão nenhum, só a marca e o menu; o único WhatsApp é o flutuante
    return (f'<header class="topo"><div class="container topo-grade"><a class="marca" href="index.html">'
            f'<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#{c.ornamento["marca"]}"/></svg>{esc(c.nome)}</a>'
            f'<nav class="menu" aria-label="Principal">{links}</nav></div></header>')


def rodape(c) -> str:
    fones = "".join(f'<li>{esc(p["display"])}</li>' for p in c.telefones)  # texto: nenhum botão de ligar (v1.0)
    col_fone = f"<div><h2>Telefone</h2><ul>{fones}</ul></div>" if fones else "<div></div>"
    paginas = "".join(f'<li><a href="{f}">{r}</a></li>' for f, r in NAV)
    acesso = '<li data-modulo="gestao"><a class="acesso" href="painel/">Acesso da equipe</a></li>' if c.gestao else ""
    extra = f'<p>{esc(c.registry["label"])}: {esc(c.registry["value"])}</p>' if c.registry else ""
    return (f'<footer class="rodape"><div class="container rodape-grade"><div><a class="marca" href="index.html">'
            f'<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#{c.ornamento["marca"]}"/></svg>{esc(c.nome)}</a>'
            f'<p>{esc(c.endereco)}</p>{extra}<a class="rodape-rota" href="{esc(c.maps_link)}" target="_blank" rel="noopener">{PIN_SVG}Como chegar</a></div>'
            f'{col_fone}<div><h2>Páginas</h2><ul>{paginas}{acesso}</ul></div><p class="aviso">{AVISO}</p>'
            f'<p class="credito">{CREDITO}</p></div></footer>')


def flutuantes(c) -> str:
    """O ÚNICO botão de WhatsApp da página (v1.1, PEDIDO_DESIGN_3 item F): flutuante no canto inferior direito, redondo, só o ícone, com aria-label. Sem número de conversa, nenhum."""
    if not c.tem_wa:
        return ""
    return (f'<a class="wa-flutuante" href="{esc(wa_link(c.wa_digits))}" target="_blank" rel="noopener" '
            f'aria-label="Conversar no WhatsApp">{WA_SVG}</a>')


def endereco_estruturado(endereco: str) -> dict:
    """'Av. Brasil, 931 - Vila Santa Francisca – Sorocaba, 18060-105' -> rua, cidade e CEP separados (schema.org PostalAddress).
    O CEP é opcional (some quando as fontes divergem). A cidade vem depois do ÚLTIMO travessão longo ("–"), o bairro depois do último " - " do que sobra, e a rua é o resto
    (v0.6: 'Entrada pelo estacionamento lateral - Av. Ipanema, 4788 - Jardim Novo Horizonte – Sorocaba' dava a cidade errada). Fora do padrão, mantém o texto inteiro
    em streetAddress (nada é inventado nem cortado)."""
    texto = endereco.strip()
    cep = None
    m = re.search(r",\s*(\d{5}-?\d{3})$", texto)
    if m:
        cep, texto = m.group(1), texto[:m.start()]
    esq, sep, cidade = texto.rpartition(" – ")
    rua, sep2, bairro = esq.rpartition(" - ")
    if not sep or not sep2 or not rua.strip() or not bairro.strip() or not cidade.strip() or "," in cidade:
        return {"@type": "PostalAddress", "streetAddress": endereco, "addressLocality": "Sorocaba", "addressRegion": "SP", "addressCountry": "BR"}
    rua = rua.rpartition(" - ")[2].strip() or rua.strip()  # "Entrada pelo estacionamento lateral - Av. Ipanema, 4788": a observação de entrada não é rua
    out = {"@type": "PostalAddress", "streetAddress": rua, "addressLocality": cidade.strip(), "addressRegion": "SP"}
    if cep:
        out["postalCode"] = cep
    out["addressCountry"] = "BR"
    return out


def json_ld(c) -> str:
    d = {"@context": "https://schema.org", "@type": "VeterinaryCare", "name": c.nome_nos_dados,
         "address": endereco_estruturado(c.endereco)}
    if c.telefones:
        d["telephone"] = "+" + c.telefones[0]["digits"]
    return json.dumps(d, ensure_ascii=False).replace("<", "\\u003c")


def pagina(c, arquivo: str, titulo: str, descricao: str, principal: str) -> str:
    """Documento HTML completo. `arquivo` marca o item atual do menu."""
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="format-detection" content="telephone=no">
<title>{esc(titulo)}</title>
<meta name="description" content="{esc(descricao)}">
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<link rel="stylesheet" href="assets/tema.css">
<link rel="stylesheet" href="assets/style.css">
<script type="application/ld+json">{json_ld(c)}</script>
</head>
<body class="vet">
{sprite(list(dict.fromkeys(list(c.ornamento['sprite']) + ['pino'])))}
<a class="pular" href="#conteudo">Ir para o conteúdo</a>
{cabecalho(c, arquivo)}
<main id="conteudo">
{principal}
</main>
{rodape(c)}
{pegadas(c) if arquivo == 'index.html' else ''}{flutuantes(c)}
<script src="assets/site-config.js"></script>
<script src="assets/material.js"></script>
<script src="assets/app.js" defer></script>
</body>
</html>
"""


# ---------- páginas ----------
def pagina_index(c) -> str:
    principal = "\n".join([
        hero(c),
        f'<section class="secao secao--clara" id="servicos"><div class="container">{cabeca("Serviços")}{servicos_lista(c)}</div></section>',
        '<div data-slot="precos"></div>',
        '<div data-slot="galeria"></div>',
        f'<section class="secao" id="como-funciona"><div class="container">{cabeca("Como funciona")}{passos(c)}</div></section>',
        secao_localizacao(c),
    ])
    return pagina(c, "index.html", f"{c.nome} | {c.tagline}", c.meta, principal)


def pagina_sobre(c) -> str:
    paragrafos = "".join(f"<p>{esc(p)}</p>" for p in c.about)
    destaques = ""
    if c.highlights:
        li = "".join(f"<li><strong>{esc(h['title'])}.</strong> {esc(h['text'])}</li>" for h in c.highlights)
        destaques = f'<h2 style="margin:36px 0 16px;font-size:1.6rem">Diferenciais</h2><ul class="lista-simples">{li}</ul>'
    principal = "\n".join([
        pagina_topo(f"Sobre {c.nome}"),
        f'<section class="secao"><div class="container duas-colunas"><div class="texto">{paragrafos}{destaques}</div>'
        f'{ficha(c, "Onde atendemos", "h2")}</div></section>',
        faixa_contato(c),
    ])
    return pagina(c, "sobre.html", f"Sobre | {c.nome}", resumo_meta(c.about[0]), principal)


def pagina_contato(c) -> str:
    principal = "\n".join([
        pagina_topo("Fale com a equipe"),
        f'<section class="secao"><div class="container">{contatos(c)}{mapa(c)}</div></section>',
    ])
    return pagina(c, "contato.html", f"Contato | {c.nome}",
                  f"Contato de {c.nome} em Sorocaba/SP: endereço, telefone e WhatsApp." if c.tem_wa else f"Contato de {c.nome} em Sorocaba/SP: endereço e telefone.", principal)


def pagina_acesso(c) -> str:
    """index.html do pacote ESSENCIAL (só gestão): não há vitrine; a raiz leva direto ao login do painel."""
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="format-detection" content="telephone=no">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=painel/">
<title>Gestão | {esc(c.nome)}</title>
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<link rel="stylesheet" href="assets/tema.css">
<style>
*, *::before, *::after {{ box-sizing: border-box; }}
body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 20px; background: var(--folha); color: #fff; font: 1rem/1.6 var(--fonte-corpo); }}
main {{ width: min(100%, 420px); text-align: center; }}
h1 {{ margin: 0 0 8px; font: 800 2rem/1.1 var(--fonte-titulo); }}
p {{ margin: 0 0 18px; color: var(--claro-sobre-escuro); }}
a {{ display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 10px 24px; border-radius: 999px; background: var(--carimbo); color: var(--carimbo-tinta); font-weight: 700; text-decoration: none; }}
a:focus-visible {{ outline: 3px solid #fff; outline-offset: 3px; }}
footer {{ position: fixed; left: 0; right: 0; bottom: 12px; text-align: center; font-size: .85rem; }}
.credito a {{ display: inline; min-height: 0; padding: 0; border-radius: 0; background: none; color: #fff; text-decoration: underline; font-weight: 400; }}
</style>
</head>
<body class="vet acesso">
<main id="conteudo">
<h1>{esc(c.nome)}</h1>
<p>Abrindo a área de gestão.</p>
<a href="painel/">Entrar na gestão</a>
</main>
<footer><p class="credito">{CREDITO}</p></footer>
<script>location.replace('painel/');</script>
</body>
</html>
"""


PAGINAS = [("index.html", pagina_index), ("sobre.html", pagina_sobre), ("contato.html", pagina_contato)]

FAVICON = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#f3f6f2'/>"
           "<g fill='#14705a'><path d='M32 31c-8 0-15 8-15 15 0 6 5 9 10 8 2-.4 3.5-1 5-1s3 .6 5 1c5 1 10-2 10-8 0-7-7-15-15-15z'/>"
           "<ellipse cx='14' cy='27' rx='5.5' ry='7.5' transform='rotate(-20 14 27)'/><ellipse cx='25.5' cy='15.5' rx='5.5' ry='8'/>"
           "<ellipse cx='38.5' cy='15.5' rx='5.5' ry='8'/><ellipse cx='50' cy='27' rx='5.5' ry='7.5' transform='rotate(20 50 27)'/></g></svg>")


def favicon(tema: dict | None = None) -> str:
    """Favicon do tema; sem `favicon` no tema, o padrão da identidade 'caderneta'."""
    f = (tema or {}).get("favicon")
    if not f:
        return FAVICON
    return (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='{f['fundo']}'/>"
            f"<g fill='{f['cor']}'>{SIMBOLOS[f['simbolo']]}</g></svg>")
