# Extração visual: da imagem para a interface

## Fase 3 — Inspeção (por imagem)
Abra a imagem em resolução cheia (Read no arquivo). Responda:
1. **É o que diz ser?** Item, sítio, museu, período batem com o que se vê? Etiqueta de museu, capa, desenho moderno → descarta.
2. **Licença confere** na página de origem? 3D photo → copyright do fotógrafo (BY/BY-SA exige atribuição).
3. **Resolução útil** para o uso pretendido (textura ≥ 1600 px de superfície limpa; hero ≥ 2400 px lado maior).
4. **Uso**: hero / textura / forma / ícone / escrita / cor / referência só.

## Fase 4 — As 8 camadas

Para cada imagem aprovada, descreva o que se vê com precisão de designer (arquivo + região do recorte em px):

1. **Texturas / materiais** — superfície, grão, porosidade, juntas, desgaste, brilho (fosco/vitrificado/metálico). Onde há área limpa recortável? Repetição natural (tijolo, tessela) ou orgânica (pedra)?
2. **Cores** — pigmentos reais, não "cores do tema": amostre com `sample_palette.py` + bandas HLS; anote qual cor é fundo, qual é destaque, qual é rara/preciosa (lápis, ouro).
3. **Formas** — silhuetas (pirâmide, zigurate, arco, coluna), proporções, cantos (vivo, almofadado, lascado), ritmo (degraus, registros, fiadas).
4. **Escrita / tipografia** — sistema (hieróglifo, cuneiforme, grego…), direção, alinhamento em colunas/registros, técnica (entalhe rebaixado, cunha, pintura), signos legíveis e o que dizem (procure tradução publicada). Letreiro existente vira referência de peso/espaçamento.
5. **Ornamentos / padrões** — rosetas, frisos, meandros, guilhoches, ameias, faixas. Módulo de repetição e espaçamento.
6. **Objetos / figuras icônicas** — o que qualquer pessoa reconhece (Esfinge, leão de Babilônia, bisão). Candidatos a assinatura e a ícone.
7. **Palavras / nomes / conceitos** — nomes próprios, títulos, cargos, unidades, estações, cidades, deuses, fórmulas: vão para a copy do app (seções, métricas, labels).
8. **Luz e profundidade** — relevo alto/baixo/rebaixado, direção da luz, sombras, como o material reage à luz → bisel, normal map, efeito de interação.

Grave em `Styles/<F>/research/vocabulario.json` (esqueleto em `scripts/vocabulario_template.json`). Cada entrada: `camada, descricao, arquivo, recorte, uso_ui, licenca`.

## Fase 5 — Tradução para componentes

### Botões
- Face = textura real recortada (PBR albedo + normal/AO em bake), bisel do material **assado na imagem** (não filtro SVG de luz — risco Safari).
- Forma vem da arquitetura: Egito → seta-pirâmide para navegação direcional, bloco de calcário para ação; Mesopotâmia → pedra na sidebar, aba em degrau; Paleolítico → seixo.
- Estados: hover = luz do período intensifica (sol, tocha, esmalte); pressed = afunda no relevo; foco = anel de 2 px em cor de contraste ≥ 3:1 seguindo a forma.
- Hierarquia: primário = material precioso/destacado; secundário = entalhe/sulco; quieto = traço.

### Tipografia
- Três papéis: **display** (eco do período, fonte de qualidade do sistema/OFL), **corpo** (legível, neutra), **escrita antiga** (signos reais, subset via `scripts/subset_escrita.py`).
- Escrita antiga entra onde é decorativa-com-sentido: KPIs (numerais do período + arábico), títulos de seção (signo + palavra), cartuchos/selos de identidade, divisores. Nunca no corpo de texto nem como única pista de leitura (aria-label/legenda latina sempre).

### Formas e layout
- Base: dashboard em retângulo deitado, grid de cards.
- Substituições temáticas permitidas quando a função segue óbvia: abas em degrau, barras-zigurate/obelisco, chevron-pirâmide, molduras em arco/pilone, registros horizontais.
- Cards = material de apoio (tábua de argila, laje, pergaminho) com zona interna calma para texto.

### Gráficos
- Forma do gráfico tirada de uma forma do período (barras em degraus, roseta radial, pirâmide fiada a fiada, área pintada com cena).
- Cores só da paleta amostrada; textura do material como fill (ver memória `dashboard-chart-theming`).

### Ícones
- Desenhados (SVG computado, CC0) a partir dos símbolos do período — emblemas, signos, pictogramas — traço ≥ 1.5 px.

### Copy
- Nomes de seções/métricas/datas com o vocabulário da camada 7 (estações egípcias, ano de reinado babilônico, nomes de templos). Mantenha clareza: o rótulo funcional pode vir como subtítulo.

### Assinaturas
- 1–3, visíveis em repouso: fundo/hero, vinheta da sidebar, cena no gráfico, card especial. Interação só intensifica.
