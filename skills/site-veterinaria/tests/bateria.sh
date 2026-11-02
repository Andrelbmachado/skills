#!/bin/zsh
# Bateria de navegador de UM site, nos três pacotes (v0.9). Uso, a partir de qualquer pasta:
#   .claude/skills/site-veterinaria/tests/bateria.sh <slug> [pasta-de-logs]
# Gera BÁSICO e ESSENCIAL em pasta temporária (o PREMIUM é o que está em sites/pet-veterinaria/<slug>) e roda, UM comando por vez, um log por comando
# (prefixo = slug INTEIRO: com `cut` dois slugs colidiram em `clinica-vete-*`). Resumo em <logs>/<slug>-resumo.log. Cerca de 15 minutos por site.
# NÃO rode duas baterias ao mesmo tempo nem `pkill` no meio: dois Chromes de teste derrubam um ao outro.
# Os testes de unidade (node --test tests/unit.test.mjs) e do gerador (python3 tests/test_build.py) NÃO estão aqui: rode-os antes, são rápidos.
set -u
ROOT=${0:A:h:h:h:h:h}
cd "$ROOT" || exit 1
SLUG=${1:?uso: bateria.sh <slug> [pasta-de-logs]}
L=${2:-$ROOT/tmp/bateria-logs}
T=.claude/skills/site-veterinaria/tests
G=.claude/skills/site-veterinaria/build_vet_site.py
PRE=sites/pet-veterinaria/$SLUG
[ -d "$PRE" ] || { echo "site não encontrado: $PRE (gere antes com o gerador)"; exit 1; }
W=$(mktemp -d /tmp/bateria-$SLUG-XXXXXX)
mkdir -p "$L"
: > "$L/$SLUG-resumo.log"
python3 $G $SLUG --sem-gestao --saida $W/basico > "$L/$SLUG-gera-basico.log" 2>&1 || { echo "falhou gerar o BÁSICO"; exit 1; }
python3 $G $SLUG --sem-vitrine --saida $W/essencial > "$L/$SLUG-gera-essencial.log" 2>&1 || { echo "falhou gerar o ESSENCIAL"; exit 1; }
run() { nome=$1; shift; echo "== $nome $(date +%H:%M:%S)" >> "$L/$SLUG-resumo.log"; "$@" > "$L/$SLUG-$nome.log" 2>&1; echo "   fim $nome codigo=$? $(date +%H:%M:%S)" >> "$L/$SLUG-resumo.log"; }
run vitrine-premium node $T/e2e_vitrine.mjs $PRE sim
run vitrine-basico node $T/e2e_vitrine.mjs $W/basico nao
run painel-premium node $T/e2e_painel.mjs $PRE
run painel-essencial node $T/e2e_painel.mjs $W/essencial
run essencial node $T/e2e_essencial.mjs $W/essencial
run contraste-premium node $T/contraste.mjs $PRE
run contraste-essencial node $T/contraste.mjs $W/essencial
run revisao-premium node $T/e2e_revisao.mjs $PRE
run revisao-essencial node $T/e2e_revisao.mjs $W/essencial
echo "BATERIA COMPLETA $(date +%H:%M:%S)" >> "$L/$SLUG-resumo.log"
rm -rf "$W"
# a bateria passou se todo "codigo=0" do resumo for zero:  grep -c 'codigo=[1-9]' "$L/$SLUG-resumo.log"   (deve imprimir 0)
