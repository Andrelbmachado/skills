---
name: heatmap-scale-integrity
description: Use quando revisar um mapa de calor ou dashboard quantitativo e precisar evitar fronteiras artificiais, problemas de daltonismo e distorção pelo domínio da escala.
---

# Integridade de escala e cor em heatmaps

## Fluxo
1. Identificar os dados representados e o domínio da legenda. Conferir se a visualização usa, por exemplo, 90–100 ou 0–100; não confundir uma diferença de escala com mudança nos dados.
2. Procurar fronteiras percebidas que venham da paleta arco-íris, especialmente o salto de brilho no amarelo, e não de uma descontinuidade real dos valores.
3. Para uma grandeza ordenada, comparar a versão atual com uma escala sequencial claro→escuro de uma cor, ou viridis, mantendo os mesmos dados.
4. Conferir a leitura considerando daltonismo e se a legenda deixa claro o domínio adotado. Não impor 0–100 universalmente: a obrigação é não esconder o recorte da escala.
5. Entregar o diagnóstico distinguindo mudança de paleta, mudança de domínio e mudança real nos dados. Mostrar a comparação com os mesmos valores.

## Limites
- Não interpretar uma fronteira visual como resultado estatístico sem evidência nos dados.
- Não tratar contraste de texto como prova de boa escala quantitativa; são verificações diferentes.
- Não inventar cores, limites numéricos ou dados só para deixar o mapa mais dramático.
