---
name: ui-dimensional-handoff
description: Use quando documentar um componente existente para handoff e precisar de uma prancha com medidas reais de padding, gaps, raios, camadas e posição.
---

# Prancha dimensional verificável de UI

## Fluxo
1. Identificar o componente a documentar, por exemplo um card ou diálogo, e o material disponível para medi-lo. Documentar o componente existente, sem redesenhá-lo.
2. Levantar padding, gaps, raios, camadas e posição na tela a partir das evidências disponíveis. Para qualquer valor que não possa ser medido, escrever `TBD`; não inventar uma medida visualmente plausível.
3. Montar uma folha técnica de uma página, em cinzas, com o componente e suas medidas rotuladas. Priorizar a leitura das relações de espaço e das camadas.
4. Conferir cada rótulo com a evidência usada na medição. Manter os desconhecidos visíveis e distingui-los dos valores confirmados.
5. Entregar a prancha e a lista de `TBD` que impedem um handoff completo.

## Limites
- Não converter estimativa de screenshot em pixel exato sem base verificável.
- Não acrescentar uma segunda receita de motion. Se pedirem a prancha animada, usar motion-code.
- A prancha não substitui o design system nem altera o componente original.
