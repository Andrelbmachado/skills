#!/usr/bin/env python3
"""Gera vitrine + painel de gestão de um site de veterinária a partir dos dados do slug.

Uso:
    python3 .claude/skills/site-veterinaria/build_vet_site.py <slug> [--sem-gestao | --sem-vitrine] [--saida DIR] [--tema NOME] [--subtipo NOME]

Pacotes (INSTRUCAO_PACOTES.md):
- (padrão)        PREMIUM:   vitrine + painel, toggle SITE_CONFIG.modules.gestao.
- --sem-gestao    BÁSICO:    só a vitrine; a pasta painel/ NÃO é gerada e o site-config.js sai com gestao:false.
- --sem-vitrine   ESSENCIAL: só o painel; sem index/servicos/sobre/contato públicos. O index.html da raiz leva direto ao login
                  (painel/) e o site-config.js sai com vitrine:false.

Tema e subtipo: cada site tem um perfil em perfis/<slug>.json ({"subtipo": ..., "tema": ...}); --tema e --subtipo sobrepõem.
O perfil também aceita (v0.7): "opcoes" (opções nomeadas do subtipo, ex.: recepcao_ve_leitos), "retirar_servicos" (serviço que a vitrine não mostra, com o motivo),
"pesquisa_pendente" (pendência que a pesquisa não registrou e que liga as regras do gerador, ex.: CEP em disputa), "pendencias" e "pendencias_gestao" (só README);
(v0.8) "pendencias_vitrine" (só README dos pacotes com vitrine: o ESSENCIAL não descreve a vitrine).
Sem perfil: subtipo "geral" e tema "caderneta". Tema = temas/<nome>.json (+ .vitrine.css/.painel.css); subtipo = subtipos/<nome>.json.

- Lê os JSONs do slug pelo `tools/model.py` (somente leitura; nada em tools/ ou data/ é alterado).
- Padrão de saída: sites/<segmento>/<slug>/. Antes de sobrescrever um site gerado pelo pipeline antigo, guarda a cópia
  em sites/_baseline-gerado/<segmento>/<slug>/ (só se ainda não existir).
- Preserva assets/img/ e o material do cliente (galeria/precos) em assets/material.js, que o gerador só cria e nunca sobrescreve.
Somente biblioteca padrão do Python.
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent
ROOT = SKILL.parents[2]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(SKILL / "components"))

import model  # noqa: E402  (tools/model.py, só leitura)
import vet_components as vc  # noqa: E402

VERSAO_SKILL = "1.5"


def _listar(pasta: str) -> str:
    return ", ".join(sorted(p.stem for p in (SKILL / pasta).glob("*.json")))


def carregar_tema(nome: str) -> dict:
    arq = SKILL / "temas" / f"{nome}.json"
    if not arq.is_file():
        sys.exit(f"tema inexistente: {nome} (disponíveis: {_listar('temas')})")
    tema = json.loads(arq.read_text(encoding="utf-8"))
    for chave in ("tokens", "pares_contraste", "hero", "ornamento"):
        if chave not in tema:
            sys.exit(f"tema {nome}: falta a chave '{chave}'")
    if tema["hero"] not in vc.HEROIS:
        sys.exit(f"tema {nome}: hero '{tema['hero']}' inexistente (disponíveis: {', '.join(vc.HEROIS)})")
    return tema


def css_do_tema(tema: dict, alvo: str) -> str:
    """CSS próprio do tema para 'vitrine' ou 'painel' (arquivo ao lado do JSON), ou '' se o tema não tem."""
    nome = (tema.get("css") or {}).get(alvo)
    if not nome:
        return ""
    arq = SKILL / "temas" / nome
    if not arq.is_file():
        sys.exit(f"tema {tema['nome']}: arquivo de CSS ausente: {nome}")
    return arq.read_text(encoding="utf-8")


def carregar_subtipo(nome: str) -> dict:
    arq = SKILL / "subtipos" / f"{nome}.json"
    if not arq.is_file():
        sys.exit(f"subtipo inexistente: {nome} (disponíveis: {_listar('subtipos')})")
    return json.loads(arq.read_text(encoding="utf-8"))


def _textos(v) -> list[str]:
    """Lista de textos não vazios, sem repetição e na ordem; qualquer outra coisa vira lista vazia (o que só vira texto de README não derruba o gerador)."""
    if not isinstance(v, list):
        return []
    vistos: list[str] = []
    for p in v:
        if isinstance(p, str) and p.strip() and p not in vistos:
            vistos.append(p)
    return vistos


def carregar_perfil(slug: str) -> dict:
    """Identidade fixada do site (tema + subtipo), para regerar sem trocar de visual. Sem arquivo: padrão do site 1.
    `pendencias` (opcional, lista de textos): pontos que o desenvolvedor achou ao montar ESTE site e que a pesquisa não registrou; vão para o README, nunca para o site.
    `pendencias_vitrine` (v0.8): o mesmo, mas só nos pacotes com vitrine (o ESSENCIAL não tem vitrine e não pode descrever galeria, título ou botão).
    `pendencias_gestao`: o mesmo, mas só nos pacotes com painel (o BÁSICO nunca cita o painel).
    `pesquisa_pendente`: pendência que a pesquisa NÃO registrou mas que o desenvolvedor confirmou (ex.: "CEP diverge: CSV ..., Receita ..."); entra na pesquisa EM MEMÓRIA
    (data/ não é tocado) e liga as regras do gerador que leem `research.pending` (CEP fora do site, horário a confirmar).
    `opcoes`: nomes de `opcoes` do subtipo a ligar (ex.: hospital24h → recepcao_ve_leitos).
    `retirar_servicos`: [{"titulo": ..., "motivo": ...}], serviço do cadastro que a vitrine não mostra enquanto a fonte não o sustenta.
    `mapa` (v1.0): "satelite" mostra o mapa do Google em satélite (t=k, z=18), com o pino centralizado no endereço (CEDVET, PEDIDO_DESIGN_3 item C).
    O que MUDA o comportamento do site (`opcoes`, `retirar_servicos`) é estrito: tipo errado, JSON quebrado ou título sem texto param o gerador com uma mensagem (falhar em silêncio
    deixaria o site sem a visão da recepção, ou com o serviço que o README diz ter tirado). O que só vira texto de README é tolerante."""
    arq = SKILL / "perfis" / f"{slug}.json"
    try:
        perfil = json.loads(arq.read_text(encoding="utf-8")) if arq.is_file() else {}
    except ValueError as e:
        sys.exit(f"perfil {arq.name}: JSON inválido ({e})")
    if not isinstance(perfil, dict):
        sys.exit(f"perfil {arq.name}: deveria ser um objeto JSON")
    opcoes, retirar = perfil.get("opcoes", []), perfil.get("retirar_servicos", [])
    if not isinstance(opcoes, list) or not all(isinstance(o, str) and o.strip() for o in opcoes):
        sys.exit(f"perfil {arq.name}: \"opcoes\" deve ser uma lista de nomes (texto)")
    if not isinstance(retirar, list) or not all(isinstance(r, dict) and isinstance(r.get("titulo"), str) and r["titulo"].strip() for r in retirar):
        sys.exit(f"perfil {arq.name}: \"retirar_servicos\" deve ser uma lista de objetos com \"titulo\" (texto) e, se quiser, \"motivo\"")
    return {"subtipo": perfil.get("subtipo", "geral"), "tema": perfil.get("tema", "caderneta"),
            "pendencias": _textos(perfil.get("pendencias")), "pendencias_vitrine": _textos(perfil.get("pendencias_vitrine")), "pendencias_gestao": _textos(perfil.get("pendencias_gestao")),
            "pesquisa_pendente": _textos(perfil.get("pesquisa_pendente")), "opcoes": _textos(opcoes), "retirar_servicos": retirar,
            "mapa": perfil.get("mapa") if perfil.get("mapa") in ("satelite",) else None,  # v1.0: "satelite" = mapa do Google em satélite, aproximado no pino
            # v1.5 (PEDIDO_DESIGN_4, Animal Inc): texto da linha "Serviços" do hero `numero` que o André autorizou e a pesquisa não traz; a pendência do README é obrigatória no próprio perfil
            "hero_servicos": perfil["hero_servicos"].strip() if isinstance(perfil.get("hero_servicos"), str) and perfil["hero_servicos"].strip() else None}


PERFIS_DO_PAINEL = {"dono", "veterinario", "recepcao"}


def conferir_servicos_retirados(b: dict, perfil: dict) -> None:
    """Todo título de `retirar_servicos` precisa casar com um serviço do cadastro; senão o gerador para (antes o site saía COM o serviço e o README dizia que ele estava fora)."""
    titulos = {str(s.get("title", "")).strip().lower() for s in (b.get("content") or {}).get("services") or []}
    for r in perfil.get("retirar_servicos") or []:
        if r["titulo"].strip().lower() not in titulos:
            sys.exit(f"perfil: \"retirar_servicos\" cita \"{r['titulo']}\", que não é título de nenhum serviço do cadastro (serviços: {', '.join(sorted(t for t in titulos if t)) or 'nenhum'})")


def aplicar_opcoes(subtipo: dict, nomes: list[str]) -> dict:
    """Liga as opções nomeadas do subtipo escolhidas pelo perfil do site (v0.7). Uma opção só pode mexer na MATRIZ de permissões do painel (`painel.matriz`), no texto
    `resumo_painel` e em `pendencias_gestao`; qualquer outra chave é recusada (uma opção que não faz nada em silêncio não ajuda ninguém). Devolve uma cópia sem a chave `opcoes`."""
    sub = json.loads(json.dumps(subtipo))
    disponiveis = sub.pop("opcoes", None) or {}
    for nome in dict.fromkeys(nomes):  # opção repetida vale uma vez (senão a pendência dela saía duplicada)
        op = disponiveis.get(nome)
        if not isinstance(op, dict):
            sys.exit(f"subtipo {subtipo.get('nome')}: opção '{nome}' inexistente (disponíveis: {', '.join(disponiveis) or 'nenhuma'})")
        extra = set(op) - {"descricao", "painel", "resumo_painel", "pendencias_gestao"} | set(op.get("painel") or {}) - {"matriz"}
        if extra:
            sys.exit(f"subtipo {subtipo.get('nome')}, opção '{nome}': chave não suportada: {', '.join(sorted(extra))}")
        matriz = (op.get("painel") or {}).get("matriz") or {}
        if not isinstance(matriz, dict):
            sys.exit(f"subtipo {subtipo.get('nome')}, opção '{nome}': painel.matriz deveria ser um objeto")
        for perfil_, telas in matriz.items():
            if perfil_ not in PERFIS_DO_PAINEL or not isinstance(telas, dict):
                sys.exit(f"subtipo {subtipo.get('nome')}, opção '{nome}': perfil '{perfil_}' desconhecido na matriz (valem {', '.join(sorted(PERFIS_DO_PAINEL))}) ou permissões que não são um objeto")
            for tela, permissao in telas.items():
                if not re.fullmatch(r"[a-z][a-z0-9]{0,31}", str(tela)) or permissao not in ("r", "rw", None):
                    sys.exit(f"subtipo {subtipo.get('nome')}, opção '{nome}': permissão inválida para '{perfil_}.{tela}' (valem \"r\", \"rw\" ou null)")
            sub.setdefault("painel", {}).setdefault("matriz", {}).setdefault(perfil_, {}).update(telas)
        if op.get("resumo_painel"):
            sub["resumo_painel"] = op["resumo_painel"]
        sub["pendencias_gestao"] = list(sub.get("pendencias_gestao") or []) + _textos(op.get("pendencias_gestao"))
    return sub


def com_pesquisa_do_perfil(b: dict, perfil: dict) -> dict:
    """Acrescenta à pesquisa, só na memória, as pendências que o perfil declara (`pesquisa_pendente`). O modelo (tools/model.py) e as regras do gerador as leem como se
    viessem de data/research; nada é gravado lá."""
    extras = perfil.get("pesquisa_pendente") or []
    if not extras:
        return b
    pesquisa = dict(b.get("research") or {})
    atuais = pesquisa.get("pending") if isinstance(pesquisa.get("pending"), list) else []
    novas = [p for p in dict.fromkeys(extras) if p not in atuais]
    pesquisa["pending"] = list(atuais) + novas
    return {**b, "research": pesquisa, "_pesquisa_do_perfil": list(dict.fromkeys(list(b.get("_pesquisa_do_perfil") or []) + novas))}  # a origem fica marcada: o README diz onde retirar


def css_tokens(tema: dict) -> str:
    linhas = "".join(f"  --{k}: {v};\n" for k, v in tema["tokens"].items())
    return f"/* Tokens do tema '{tema['nome']}'. */\n:root {{\n{linhas}}}\n"


MATERIAL = "assets/material.js"


def _lista_js(txt: str, inicio: int) -> str | None:
    """Devolve o literal de lista JS ('[...]', colchetes balanceados) que começa em txt[inicio:], respeitando textos e comentários.
    Aceita JS e não só JSON (aspas simples, chaves sem aspas, vírgula sobrando, várias linhas). None se não achar a lista inteira."""
    i = inicio
    while i < len(txt) and txt[i] in " \t\r\n":
        i += 1
    if i >= len(txt) or txt[i] != "[":
        return None
    prof, j, aspas = 0, i, None
    while j < len(txt):
        ch = txt[j]
        if aspas:
            if ch == "\\":
                j += 2
                continue
            if ch == aspas:
                aspas = None
        elif ch in "'\"`":
            aspas = ch
        elif txt.startswith("//", j):
            j = txt.find("\n", j)
            if j == -1:
                return None
            continue
        elif txt.startswith("/*", j):
            fim = txt.find("*/", j + 2)
            if fim == -1:
                return None
            j = fim + 2
            continue
        elif ch == "[":
            prof += 1
        elif ch == "]":
            prof -= 1
            if prof == 0:
                return txt[i:j + 1]
        j += 1
    return None


def material_js(galeria: str = "[]", precos: str = "[]") -> str:
    return f"""/* Material do cliente: fotos e tabela de valores.
   ESTE ARQUIVO É DO CLIENTE: o gerador nunca o sobrescreve nem o apaga (regerar o site não perde nada daqui).
   Só preencha com material que o cliente forneceu. Sem material, as seções "Fotos" e "Valores" não existem no site.
     galeria: lista de objetos com src (assets/img/arquivo.jpg), alt (descrição real da foto) e legenda (opcional)
     precos: lista de objetos com servico e valor (texto como o cliente informou) */
window.SITE_CONFIG = window.SITE_CONFIG || {{}};
window.SITE_CONFIG.galeria = {galeria};
window.SITE_CONFIG.precos = {precos};
"""


def garantir_material(out: Path, vitrine: bool) -> str:
    """O material do cliente (galeria e precos) vive em assets/material.js, que o gerador só CRIA quando não existe.
    Sites gerados antes da v0.3 guardavam as listas dentro de site-config.js (em linhas que o gerador relia como JSON estrito e, se não
    parseassem, zerava em silêncio): na primeira regeração elas são movidas, como estão, para material.js. Se não for possível ler
    uma lista por inteiro, o gerador PARA com uma mensagem em vez de apagar o material."""
    arq = out / MATERIAL
    if arq.is_file():
        return "material preservado"
    antigo = {"galeria": "[]", "precos": "[]"}
    cfg = out / "assets" / "site-config.js"
    if cfg.is_file():
        txt = cfg.read_text(encoding="utf-8")
        for nome in antigo:
            m = re.search(rf"^  {nome}:", txt, re.M)  # só a propriedade real (2 espaços); os exemplos do comentário têm mais
            if not m:
                continue
            lista = _lista_js(txt, m.end())
            if lista is None:
                sys.exit(f"não consegui ler '{nome}' em {cfg}: copie a lista à mão para {arq} (e apague a linha) e rode de novo. Nada foi alterado.")
            antigo[nome] = lista
    vazio = all(re.sub(r"\s+", "", v) == "[]" for v in antigo.values())
    if vitrine or not vazio:
        arq.parent.mkdir(parents=True, exist_ok=True)
        arq.write_text(material_js(antigo["galeria"], antigo["precos"]), encoding="utf-8")
        return "material criado" + ("" if vazio else " (movido de site-config.js)")
    return "sem material"


MODULOS_BASE = ["inicio", "agenda", "tutores", "prontuarios", "vacinas", "caixa", "estoque", "equipe", "config"]


def modulos_do_subtipo(subtipo: dict) -> list[str]:
    """Telas do painel, na ordem do menu: as 9 da clínica geral, ou a lista `painel.modulos` do subtipo (ex.: hospital24h acrescenta internacao)."""
    return list((subtipo.get("painel") or {}).get("modulos") or MODULOS_BASE)


def ajustar_modulos(painel: Path, subtipo: dict) -> list[str]:
    """Deixa em painel/ só os arquivos das telas do subtipo e escreve a lista deles em app.html (data-scripts).
    O modelo guarda todas as telas de todos os subtipos; um site de clínica geral não carrega nem recebe `internacao.js`."""
    mods = modulos_do_subtipo(subtipo)
    pasta = painel / "js" / "modulos"
    sem_arquivo = [m for m in mods if not (pasta / f"{m}.js").is_file()]
    if sem_arquivo:
        sys.exit(f"subtipo {subtipo.get('nome')}: tela(s) sem arquivo em painel/js/modulos: {', '.join(sem_arquivo)}")
    for arq in pasta.glob("*.js"):
        if arq.stem not in mods:
            arq.unlink()
    app = painel / "app.html"
    scripts = ",".join(["regras", "store", "auth", "seed", "ui", "app"] + [f"modulos/{m}" for m in mods] + ["iniciar"])
    texto, n = re.subn(r'data-scripts="[^"]*"', f'data-scripts="{scripts}"', app.read_text(encoding="utf-8"))
    if n != 1:
        sys.exit("painel/app.html: não achei o data-scripts do modelo")
    app.write_text(texto, encoding="utf-8")
    return mods


def exames_do_site(c: vc.Contexto) -> list[str]:
    """Nomes dos exames que o site público apresenta: só os serviços COM FONTE. O painel os oferece ao dono como ponto de partida do cadastro de exames."""
    return [s["title"] for s in c.services if s.get("source") and s.get("title")]


def config_painel(tema: dict, subtipo: dict, c: vc.Contexto | None = None) -> dict:
    """O que o painel lê em SITE_CONFIG.painel: receita do subtipo + ícone de marca do tema (só o que difere do padrão).
    `exameDosServicos` (receita do centro de diagnóstico) vira `exames`: a lista dos serviços com fonte, usada pelo painel como sugestão de cadastro."""
    cfg = dict(subtipo.get("painel") or {})
    if cfg.pop("exameDosServicos", False) and c is not None:
        cfg["exames"] = exames_do_site(c)
    if subtipo.get("nome") and subtipo["nome"] != "geral":
        cfg = {"subtipo": subtipo["nome"], **cfg}
    marca = (tema.get("ornamento") or {}).get("marca", "pata")
    if marca != "pata":
        cfg["marca"] = marca
    return cfg


def site_config_js(b: dict, c: vc.Contexto, gestao: bool, vitrine: bool = True, painel: dict | None = None) -> str:
    neg = {"slug": b["slug"], "nome": c.nome, "telefone": (c.fone_ligar or {}).get("display", ""),
           "whatsapp": c.wa_display or "", "endereco": c.endereco}  # v1.0: o número de conversa da vitrine (confirmado ou celular listado)
    linha_painel = f"\n  painel: {json.dumps(painel, ensure_ascii=False)}," if painel and gestao else ""  # sem gestão, nada do painel no pacote
    if not vitrine:
        notas = ("   modules.vitrine: false neste pacote (só gestão): a raiz do site leva direto ao login do painel.\n"
                 "   modules.gestao: só abre a gestão com true (qualquer outro valor, ou a falta deste arquivo, deixa a gestão fechada).")
    elif gestao:
        notas = ("   modules.gestao: só abre a gestão com true. false (ou qualquer outro valor) desliga: a vitrine remove o link ao carregar\n"
                 "   e painel/ informa \"não contratado\". Fotos e valores do cliente ficam em assets/material.js.")
    else:
        notas = "   modules.gestao: false neste pacote (só vitrine). Fotos e valores do cliente ficam em assets/material.js."
    return f"""/* Configuração do site.
{notas} */
window.SITE_CONFIG = {{
  modules: {{ vitrine: {str(vitrine).lower()}, gestao: {str(gestao).lower()} }},
  negocio: {json.dumps(neg, ensure_ascii=False)}{"," if linha_painel else ""}{linha_painel.rstrip(",")}
}};
"""


LISTA_DO_PAINEL_ESSENCIAL = ("Agenda de consultas, tutores e pets, prontuários, vacinas e lembretes de retorno, caixa, estoque de medicamentos e vacinas,\n"
                             "profissionais e serviços, configurações. Perfis: dono/gerente, veterinário e recepção.")
LISTA_DO_PAINEL_PREMIUM = ("agenda de consultas, tutores e pets, prontuários, vacinas e lembretes de retorno,\n"
                           "   caixa, estoque de medicamentos e vacinas, profissionais e serviços, configurações. Perfis: dono/gerente, veterinário e recepção.")


def lista_do_painel(subtipo: dict | None, essencial: bool = False) -> str:
    """O que a gestão tem, para o README: o texto da clínica geral (com as quebras de linha de sempre, para os READMEs dos sites 1 a 3 não mudarem) ou o
    `descricao_painel` do subtipo (centro de diagnóstico não tem prontuário nem vacinas)."""
    texto = (subtipo or {}).get("descricao_painel")
    if not texto:
        return LISTA_DO_PAINEL_ESSENCIAL if essencial else LISTA_DO_PAINEL_PREMIUM
    return texto[:1].upper() + texto[1:] if essencial else texto


def de_tipo(subtipo: dict | None) -> str:
    """"da clínica" ou, na receita, o tipo do negócio ("do centro")."""
    return ((subtipo or {}).get("vitrine") or {}).get("de_tipo_negocio", "da clínica")


LIMITE_DO_LOGIN = """### Limite do login (importante)
O login do painel é **uma barreira de interface, não segurança real**. O site é um arquivo estático: as contas e os dados ficam no
navegador do computador usado (localStorage), e qualquer pessoa com acesso ao navegador ou aos arquivos pode contorná-lo. Até a sessão e o
perfil de quem entrou ficam no armazenamento do navegador e podem ser alterados por quem sabe mexer nele.
As senhas são guardadas só como código de verificação (PBKDF2 com 100 mil repetições em páginas https ou localhost; fora delas, SHA-256
repetido, que é mais fraco). Não há limite de tentativas de senha nem recuperação automática (o dono redefine a senha dos funcionários em
Configurações; se o dono perder a senha, só limpando os dados do site no navegador, o que apaga o que foi cadastrado).
Por isso:
- use o painel em computadores {de} e não registre dados sensíveis além do necessário (tutores e pets são dados pessoais, LGPD);
- Configurações permite exportar, importar e apagar todos os dados (importar confere o arquivo por inteiro antes de qualquer troca e SUBSTITUI tudo: o grupo que o arquivo não traz, como acontece com
  um backup de uma versão mais antiga, fica vazio, e a tela avisa antes);
- o painel nasce vazio; o botão "Carregar dados de exemplo" cria dados **fictícios**, marcados como exemplo, que podem ser removidos.

Para uso real com vários computadores, a camada de dados (`painel/js/store.js`) troca de adaptador (localStorage, IndexedDB ou um servidor)
sem mexer nas telas. Autenticação e banco de dados em servidor entram quando a gestão for contratada de forma definitiva.
"""

def limite_do_login(subtipo: dict | None = None) -> str:
    return LIMITE_DO_LOGIN.replace("{de}", de_tipo(subtipo))


RECURSO_EXTERNO = """## Recursos externos
O único recurso externo do site é o mapa do Google incorporado na página Contato (acompanhado do link "Abrir no Google Maps").
Fontes, ícones e imagens decorativas são do próprio site; nenhuma outra página chama serviço de terceiros.
"""


# tipos de pendência de tools/model.py que só fazem sentido numa vitrine pública (botão Ligar, galeria, selo da nota, seção de horário, registro mostrado no site)
TIPOS_SO_DA_VITRINE = {"wa-unverified", "no-mobile", "no-phone", "no-rating", "registry", "hours", "gallery"}


def pendencias_do_negocio(b: dict, com_gestao: bool = True, c: vc.Contexto | None = None, extras: list[str] | None = None, vitrine: bool = True) -> list[str]:
    """O que os dados NÃO confirmam, para quem apresenta o site ao negócio. Vem de tools/model.pending_items (somente leitura) e de pesquisa/pending,
    mais o aviso de WhatsApp que o modelo só emite para fixo: celular só listado no Perfil do Google também não está verificado.
    `vitrine=False` (pacote ESSENCIAL, v0.8): o pacote não tem vitrine, então fica só o que vale para a gestão (os fatos da pesquisa, o expediente da agenda, o endereço do
    cadastro da clínica); nada que descreva botão, galeria, título, Sobre ou Contato. Antes o README do ESSENCIAL repetia esses itens (dívida do site 6)."""
    itens = [texto for tipo, texto in model.pending_items(b) if vitrine or tipo not in TIPOS_SO_DA_VITRINE]
    wa = b["whatsapp"]
    if vitrine:
        if wa["status"] == "mobile-listed":
            itens.insert(0, f"WhatsApp não confirmado: {wa['display']} é celular listado no Perfil do Google, sem confirmação de que tem WhatsApp. "
                            "Por ordem do André (pedido de design de 22/10/2026), o site usa esse celular no botão de WhatsApp (o flutuante, o único); "
                            "confirme com o negócio que o número tem WhatsApp antes de publicar. Se não tiver, registre na pesquisa e gere o site de novo.")
        if vc.prazo_tirado_dos_titulos(b):
            itens.insert(1 if wa["status"] == "mobile-listed" else 0,
                         "Horário a confirmar: o título e a descrição do site NÃO citam \"24 horas\" (a única fonte é um guia ou diretório, não o próprio negócio); o horário aparece só "
                         "com a fonte (\"segundo o guia ...\") na placa de horário, na lista de serviços, em Sobre e em Contato. Depois de confirmar com o negócio, retire a pendência da "
                         "pesquisa e gere o site de novo: o título original volta." + (" Ajuste também o expediente da agenda do painel em Configurações." if com_gestao else ""))
            if vc.nome_com_prazo(b):
                itens.insert(2 if wa["status"] == "mobile-listed" else 1,
                             f"Nome com prazo: o nome do negócio no Perfil do Google e nos guias é \"{b['name']}\". O prazo no nome é dado do próprio negócio, mas lido no topo, no título ou nos "
                             f"dados estruturados vira promessa de funcionamento que a pesquisa ainda não confirmou. Por isso o site usa \"{c.nome if c is not None else (b.get('content') or {}).get('display_name', b['name'])}\" no topo, nos títulos, "
                             "nos botões e nos dados estruturados, e só cita \"24 horas\" ao lado da fonte. Depois de confirmar o funcionamento com o negócio, retire a pendência da "
                             "pesquisa e gere o site de novo: os dados estruturados voltam ao nome completo (o nome do topo segue sendo o do cadastro do site).")
        original = ((b.get("content") or {}).get("hours") or {}).get("text", "")
        if c is not None and c.hours and c.receita.get("horario_com_fonte") and vc.horario_a_confirmar(b) and "segundo" in c.hours["text"] and "segundo" not in original:
            itens.append(f"Horário a confirmar: o site mostra o horário com a fonte (\"{c.hours['text']}\") porque a pesquisa não o confirmou com o negócio. "
                         "Depois de confirmar dias e horários, retire a pendência da pesquisa e gere o site de novo: o texto volta como está no cadastro." +
                         (" Ajuste também o expediente da agenda do painel em Configurações." if com_gestao else ""))
    elif com_gestao and vc.horario_a_confirmar(b):
        itens.append("Horário a confirmar: a pesquisa não o confirmou com o negócio. Depois de confirmar dias e horários, ajuste o expediente da agenda do painel em Configurações.")
    elif com_gestao and not (b.get("content") or {}).get("hours"):
        itens.append("Horário de atendimento não encontrado em fonte: a grade da agenda do painel vem do padrão (08:00 às 18:00). O dono ajusta o expediente em Configurações, Agenda, conforme o funcionamento real.")
    if vc.cep_a_confirmar(b):
        do_perfil = any(re.search(r"\bCEP\b", p) for p in b.get("_pesquisa_do_perfil") or [])  # a pendência veio do perfil do site, não de data/research
        onde = ("retire a linha do CEP de \"pesquisa_pendente\" no perfil do site (perfis/" + b["slug"] + ".json)") if do_perfil else "retire a pendência da pesquisa"
        if vitrine:
            itens.append("CEP fora do site: as fontes divergem e o endereço do site é mostrado sem CEP (rua, número, bairro e cidade seguem iguais). "
                         f"Depois de confirmar o CEP com o negócio, {onde} e gere o site de novo: o endereço volta como está no cadastro.")
        else:
            itens.append("CEP fora do cadastro: as fontes divergem e o endereço da clínica (Configurações do painel) vem sem CEP. "
                         f"Depois de confirmar o CEP com o negócio, {onde} e gere o pacote de novo, ou preencha o endereço em Configurações.")
    numeros = vc.numeros_em_disputa(b)
    if numeros:
        lista = " e ".join(numeros)
        como_chegar = ("o \"Como chegar\" usa o link do Perfil do Google" if c is None or "place_id" in str(c.maps_link) else "o \"Como chegar\" busca pelo nome da clínica e pela rua")
        if vitrine:
            itens.append(f"Número do endereço fora do site: as fontes divergem ({lista}) e o endereço do site é mostrado SEM número e sem CEP (o guia que traz outro número traz também outro CEP); rua, bairro e cidade seguem. "
                         f"O texto de Sobre e dos passos também sai sem o número, {como_chegar} e o mapa busca pelo nome da clínica. É a opção mais segura para quem vai até o endereço: "
                         "ninguém é mandado a um número que pode estar errado. Depois de confirmar o número com o negócio, retire a pendência da pesquisa e gere o site de novo: o endereço volta como está no cadastro." +
                         (" Em Configurações do painel o endereço da clínica também vem sem número; o dono pode preenchê-lo." if com_gestao else ""))
        else:
            itens.append(f"Número do endereço fora do cadastro: as fontes divergem ({lista}) e o endereço da clínica (Configurações do painel) vem SEM número e sem CEP. "
                         "Depois de confirmar o número com o negócio, retire a pendência da pesquisa e gere o pacote de novo, ou preencha o endereço em Configurações.")
    if vitrine:
        for ano in vc.cnpj_sem_fonte(b):
            itens.append(f"O texto de Sobre (e a descrição dela para buscadores) diz \"com CNPJ aberto em {ano}\" e a pesquisa não traz fonte para esse ano: o gerador não pôde atribuí-lo. "
                         "Confirmar com o negócio se quer manter a frase.")
        reg = (b.get("content") or {}).get("registry")
        if reg and c is not None and not c.registry:
            itens.append(f"Registro profissional fora do site: o cadastro traz \"{reg.get('label', '')}: {reg.get('value', '')}\" sem endereço de fonte, e um número de registro sem origem é o que mais "
                         "se confunde com um selo. O site só o mostra com a fonte. Obter a fonte (ou o comprovante com o negócio) e gerar de novo.")
        elif c is not None and c.registry:
            itens.append(f"Registro profissional mostrado no site: \"{c.registry['label']}: {c.registry['value']}\" (ficha da página Sobre e rodapé, sempre com a fonte, como informação e nunca como selo). "
                         "A fonte é um guia, não o conselho: o número não foi conferido no CRMV-SP. Confirmar com o negócio (e a consulta pública do conselho) antes de publicar.")
    itens.extend(extras or [])
    return itens


def secao_pendencias(b: dict, com_gestao: bool = True, c: vc.Contexto | None = None, extras: list[str] | None = None, vitrine: bool = True) -> str:
    itens = pendencias_do_negocio(b, com_gestao, c, extras, vitrine)
    if not itens:
        return ""
    lista = "\n".join(f"- {t}" for t in itens)
    apresenta = "quem apresenta o site ao negócio" if vitrine else "quem apresenta a gestão ao negócio"
    afirma = "O site não os afirma como fato" if vitrine else "A gestão não os trata como fato"
    return ("## Pendências a confirmar com o negócio antes de publicar\n"
            f"Pontos que os dados disponíveis não confirmam. {afirma}; esta lista serve para {apresenta}.\n\n"
            f"{lista}\n\n")


COMO_GERAR = """## Gerar os outros pacotes
O gerador `build_vet_site.py` (do projeto) refaz o site a partir dos dados do cadastro; o material do cliente
(`assets/material.js` e `assets/img/`) nunca é sobrescrito. Use `--saida <pasta>` para gerar em outro lugar.
- completo (vitrine + gestão, com o interruptor): `build_vet_site.py {slug}`
- só vitrine: `build_vet_site.py {slug} --sem-gestao`
- só gestão: `build_vet_site.py {slug} --sem-vitrine`
"""


def pendencias_extras(perfil: dict, subtipo: dict | None, com_gestao: bool, slug: str = "", vitrine: bool = True) -> list[str]:
    """Pendências que vêm do perfil do site e da receita do subtipo. `pendencias_gestao` (perfil e receita) só entra quando o pacote tem gestão: o BÁSICO não cita o painel.
    `pendencias_vitrine` e `retirar_servicos` só entram quando o pacote tem vitrine (o ESSENCIAL não tem)."""
    sub = subtipo or {}
    itens = list(perfil.get("pendencias") or []) + [p for p in (sub.get("pendencias") or []) if isinstance(p, str)]
    if vitrine:
        itens += list(perfil.get("pendencias_vitrine") or [])
        for r in perfil.get("retirar_servicos") or []:
            itens.append(f"Serviço fora da vitrine: \"{r['titulo'].strip()}\". {str(r.get('motivo') or 'A fonte do cadastro não sustenta a afirmação.').strip()} "
                         "O serviço consta no cadastro do site (data/content), mas a vitrine não o mostra nem o oferece no formulário. Depois de confirmar com o negócio, retire a entrada de "
                         f"\"retirar_servicos\" do perfil do site (perfis/{slug}.json) e gere de novo.")
    if com_gestao:
        itens += list(perfil.get("pendencias_gestao") or []) + [p for p in (sub.get("pendencias_gestao") or []) if isinstance(p, str)]
    return itens


def botoes_do_readme(c: vc.Contexto) -> str:
    """v1.1 (PEDIDO_DESIGN_3, item F): a regra de botões, dita para quem apresenta o site."""
    if c.tem_wa:
        return (f"Botão de contato: um só, o de WhatsApp ({c.wa_display}), flutuante e redondo no canto inferior direito, só com o ícone (\"Conversar no WhatsApp\" para leitores de tela). "
                "Não há botão de ligar nem formulário; os telefones aparecem como texto. O \"Como chegar\" fica no fim da página inicial e no rodapé.")
    return ("Botões de contato: nenhum. O negócio não tem celular nem WhatsApp nos dados (só telefone fixo ou nenhum), e o site não inventa número: "
            "o telefone aparece como texto. Para ligar o botão de WhatsApp (o flutuante), registre um celular/WhatsApp na pesquisa e gere de novo. "
            "O \"Como chegar\" fica no fim da página inicial e no rodapé.")


def ilustrativas_do_readme(c: vc.Contexto) -> str:
    """v1.0: lista das imagens ilustrativas (geradas; não são fotos da clínica) que a vitrine usa."""
    usadas = vc.fotos_usadas(c)
    if not usadas:
        return ""
    itens = "\n".join(f"- `assets/ilustrativas/{n}.webp`" for n in usadas)
    return ("\n### Imagens ilustrativas\nAs imagens dos serviços" + (" e do topo" if c.foto_hero else "") + " são **ilustrativas**, geradas por computador a pedido do André: "
            "não mostram a equipe, a fachada, os clientes nem os pacientes da clínica, e cada uma leva a legenda \"Imagem ilustrativa\" na página. "
            "Quando a clínica enviar fotos reais, elas entram no lugar.\n" + itens + "\n")


def readme(b: dict, c: vc.Contexto, gestao: bool, vitrine: bool = True, subtipo: dict | None = None, extras: list[str] | None = None) -> str:
    nome = c.nome
    extra_painel = (subtipo or {}).get("resumo_painel", "")
    extra_painel = f"\n   {extra_painel}" if extra_painel else ""
    if not vitrine:
        return f"""# {nome}: gestão {de_tipo(subtipo)}

Área de gestão em HTML, CSS e JavaScript puros (sem dependências nem serviços externos). Esta entrega contém **somente a gestão**:
não há site público; o `index.html` da raiz leva direto à tela de acesso (`painel/`).

## Como ver no computador
```
python3 -m http.server 8000
```
Abra `http://localhost:8000/`: a página leva ao login. Na primeira vez, o sistema pede para criar a conta do dono/gerente.

{secao_pendencias(b, True, c, extras, vitrine=False)}## O que a gestão tem
{lista_do_painel(subtipo, True)}{extra_painel}

{limite_do_login(subtipo)}
## Vitrine pública
Não faz parte desta entrega (`assets/site-config.js` está com `vitrine: false`). Para contratar o site público depois, gere a variante
completa (vitrine + gestão); a pasta `painel/` e os dados já cadastrados continuam como estão.

{COMO_GERAR.format(slug=b["slug"])}"""
    cabeca = f"""# {nome}: site {de_tipo(subtipo)}

Site estático (HTML, CSS e JavaScript puros, sem dependências nem serviços externos).

## Como ver no computador
```
python3 -m http.server 8000
```
Abra `http://localhost:8000/`. As páginas também abrem direto do arquivo, mas o mapa{" e o painel" if gestao else ""} funciona{"m" if gestao else ""} melhor por um servidor.

{secao_pendencias(b, gestao, c, extras)}## Páginas da vitrine
`index.html` (início, com a seção de serviços em `#servicos` — o item "Serviços" do menu rola até ela — e a seção "Onde estamos" com o mapa e o botão "Como chegar"), `sobre.html` e `contato.html`.
{botoes_do_readme(c)}
{ilustrativas_do_readme(c)}
O texto vem do cadastro do negócio e cada afirmação tem fonte nele; o que ainda depende de confirmação está na lista de pendências acima. Não há depoimentos, preços nem fotos inventados, e o horário só aparece quando o cadastro o traz (com a fonte, enquanto não foi confirmado).

## Material que o cliente pode enviar
O material do cliente fica em `assets/material.js`, um arquivo que o gerador **nunca sobrescreve**: regerar o site não perde nada dali.
- Fotos reais: coloque em `assets/img/` e liste em `galeria` no `assets/material.js`; a seção "Fotos" aparece sozinha. Sem foto, a seção não existe.
- Tabela de valores: liste em `precos` no mesmo arquivo; a seção "Valores" aparece na página inicial, logo depois dos serviços. Sem tabela, a seção não existe.
- Horário de atendimento e registro profissional (CRMV): entram na vitrine somente com a fonte ao lado (\"segundo o guia ...\") enquanto o negócio não os confirma; confirmados, a ressalva sai.

{RECURSO_EXTERNO}"""
    if not gestao:
        return cabeca + f"""
## Módulos
Esta entrega contém **somente a vitrine** (site público). A área de gestão não faz parte dela: `assets/site-config.js` está com
`gestao: false` e nenhuma página tem link de acesso. Para contratar a gestão depois, peça a variante completa (vitrine + gestão).

## Gerar de novo
O gerador `build_vet_site.py` (do projeto) refaz o site a partir dos dados do cadastro; `assets/material.js` e
`assets/img/` nunca são sobrescritos. Esta variante: `build_vet_site.py {b["slug"]} --sem-gestao`. Variante completa: `build_vet_site.py {b["slug"]}`.
"""
    return cabeca + f"""
## Módulos: vitrine e gestão
O site tem dois módulos:

1. **Vitrine** (público): as três páginas acima.
2. **Painel de gestão** (`painel/`, com login): {lista_do_painel(subtipo)}{extra_painel}

### Ligar e desligar a gestão
Edite `assets/site-config.js`:
```js
window.SITE_CONFIG = {{ modules: {{ vitrine: true, gestao: true }}, ... }};
```
- `gestao: true`: o rodapé da vitrine mostra "Acesso da equipe" e `painel/` abre a tela de login.
- Qualquer outro valor (`false`, `0`, texto, ou a falta do arquivo) mantém a gestão **fechada**: a vitrine remove o link ao carregar a página e
  `painel/` exibe "Módulo de gestão não contratado". Atenção: o HTML bruto desta variante ainda contém o link (só é removido quando a página
  carrega). Para um pacote em que nenhuma página sequer cita a gestão, gere a variante sem gestão.
- Para entregar só a vitrine, gere a variante sem gestão: a pasta `painel/` nem é criada e o link não existe no HTML.
  Só desligar o toggle esconde a interface; os arquivos de `painel/` continuam no servidor enquanto a pasta existir.

{COMO_GERAR.format(slug=b["slug"])}
{limite_do_login(subtipo)}"""


def garantir_baseline(slug: str, seg: str, out: Path) -> str:
    base = ROOT / "sites" / "_baseline-gerado" / seg / slug
    idx = out / "index.html"
    if base.exists() and any(base.iterdir()):
        return "baseline já existe"
    if idx.is_file() and not re.search(r'class="vet[" ]', idx.read_text(encoding="utf-8")):
        base.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(out, base)
        return "baseline copiado"
    return "sem site anterior para guardar"


# arquivos gerados que só existem na vitrine; saem quando o mesmo diretório é regerado como ESSENCIAL
ARQUIVOS_DA_VITRINE = ["servicos.html", "sobre.html", "contato.html", "assets/style.css", "assets/app.js"]


def copiar_ilustrativas(c: vc.Contexto, assets: Path) -> list[str]:
    """v1.0: copia para assets/ilustrativas/ só as imagens ilustrativas que a vitrine usa (pasta refeita a cada geração; nunca é material do cliente)."""
    destino = assets / "ilustrativas"
    shutil.rmtree(destino, ignore_errors=True)
    destino.mkdir(parents=True)
    usadas = vc.fotos_usadas(c)
    for nome in usadas:
        shutil.copyfile(SKILL / "ilustrativas" / f"{nome}.webp", destino / f"{nome}.webp")
    return usadas


def gerar(slug: str, gestao: bool = True, saida: str | None = None, tema_nome: str | None = None,
          vitrine: bool = True, subtipo_nome: str | None = None) -> Path:
    if not vitrine and not gestao:
        sys.exit("pacote sem vitrine e sem gestão não tem o que gerar (use --sem-gestao OU --sem-vitrine)")
    b = model.load_business(slug)
    if b["segment_slug"] != "pet-veterinaria":
        sys.exit(f"{slug} não é de pet-veterinaria ({b['segment_slug']})")
    if not b["content"]:
        sys.exit(f"{slug}: sem data/content; rode a pesquisa antes")
    padrao = ROOT / "sites" / b["segment_slug"] / slug
    out = Path(saida).resolve() if saida else padrao
    if out == padrao:
        print(garantir_baseline(slug, b["segment_slug"], out))
    perfil = carregar_perfil(slug)
    tema = carregar_tema(tema_nome or perfil["tema"])
    subtipo = aplicar_opcoes(carregar_subtipo(subtipo_nome or perfil["subtipo"]), perfil["opcoes"])
    conferir_servicos_retirados(b, perfil)
    b = com_pesquisa_do_perfil(b, perfil)
    c = vc.contexto(b, gestao, tema=tema, subtipo=subtipo, perfil=perfil)
    (out / "assets").mkdir(parents=True, exist_ok=True)
    assets = out / "assets"
    for resto in assets.glob("ilustrativa-*.webp"):  # v1.3: resto do gerador genérico (`ilustrativa-servicos.webp`, sem uso); a vitrine da skill usa assets/ilustrativas/
        resto.unlink()

    if vitrine:
        for arquivo, fn in vc.PAGINAS:
            (out / arquivo).write_text(fn(c), encoding="utf-8")
        estilo = (SKILL / "components" / "vitrine.base.css").read_text(encoding="utf-8")  # chão liso; o visual é do tema
        estilo += "\n" + (SKILL / "components" / "movimento.css").read_text(encoding="utf-8")  # v1.0: movimento comum (flutuante, revelação, toque)
        extra = css_do_tema(tema, "vitrine")
        if extra:
            estilo += f"\n/* ---- tema {tema['nome']} ---- */\n" + extra
        (assets / "style.css").write_text(estilo, encoding="utf-8")
        shutil.copyfile(SKILL / "components" / "vitrine.js", assets / "app.js")
        (out / "servicos.html").unlink(missing_ok=True)  # v1.0: Serviços virou a seção #servicos da página inicial
        copiar_ilustrativas(c, assets)
    else:
        (out / "index.html").write_text(vc.pagina_acesso(c), encoding="utf-8")
        for rel in ARQUIVOS_DA_VITRINE:
            (out / rel).unlink(missing_ok=True)
        shutil.rmtree(assets / "ilustrativas", ignore_errors=True)
    (assets / "tema.css").write_text(css_tokens(tema), encoding="utf-8")
    (assets / "favicon.svg").write_text(vc.favicon(tema), encoding="utf-8")
    garantir_material(out, vitrine)  # antes de reescrever site-config.js: migra listas antigas e nunca sobrescreve o material do cliente
    (assets / "site-config.js").write_text(
        site_config_js(b, c, gestao, vitrine=vitrine, painel=config_painel(tema, subtipo, c)), encoding="utf-8")
    (out / "README.md").write_text(readme(b, c, gestao, vitrine, subtipo, pendencias_extras(perfil, subtipo, gestao, slug, vitrine)), encoding="utf-8")

    painel = out / "painel"
    shutil.rmtree(painel, ignore_errors=True)  # pasta gerada: nunca deixa resto de build anterior
    if gestao:
        shutil.copytree(SKILL / "painel", painel)
        ajustar_modulos(painel, subtipo)
        extra = css_do_tema(tema, "painel")
        if extra:
            with open(painel / "painel.css", "a", encoding="utf-8") as f:
                f.write(f"\n/* ---- tema {tema['nome']} ---- */\n" + extra)
    return out


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("slug")
    pacote = ap.add_mutually_exclusive_group()
    pacote.add_argument("--sem-gestao", action="store_true", help="BÁSICO: só vitrine; não gera painel/ e deixa gestao:false")
    pacote.add_argument("--sem-vitrine", action="store_true", help="ESSENCIAL: só painel; a raiz leva ao login e vitrine:false")
    ap.add_argument("--saida", help="diretório de saída (padrão: sites/<segmento>/<slug>)")
    ap.add_argument("--tema", help="nome do tema (padrão: o do perfil do site, ou caderneta)")
    ap.add_argument("--subtipo", help="nome do subtipo (padrão: o do perfil do site, ou geral)")
    a = ap.parse_args(argv)
    out = gerar(a.slug, gestao=not a.sem_gestao, saida=a.saida, tema_nome=a.tema, vitrine=not a.sem_vitrine, subtipo_nome=a.subtipo)
    modo = "vitrine" if a.sem_gestao else "painel" if a.sem_vitrine else "vitrine + painel"
    print(f"ok: {out} ({modo}; skill {VERSAO_SKILL})")


if __name__ == "__main__":
    main()
