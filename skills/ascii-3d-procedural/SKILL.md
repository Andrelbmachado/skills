---
name: ascii-3d-procedural
description: Use quando precisar desenhar um objeto ou cena 3D (girando, iluminada, animada) só com caracteres ASCII, no terminal ou exportado como vídeo/GIF.
---

# 3D procedural em ASCII

## Passos
1. Fixe a semente (`np.random.default_rng(N)`) para o resultado ser reproduzível.
2. Defina a silhueta com funções simples (ex.: `envelope(y)` = raio por altura), sem malha.
3. Monte o objeto como nuvem de pontos por partes, com regras procedurais (camadas, galhos deslocados 0,618 de volta entre camadas, jitter). Formas redondas por Fibonacci/ângulo dourado: `y = 1 - 2i/n`, `r = √(1-y²)`, `θ = π(3-√5)i`.
4. Guarde os atributos de cada ponto (posição, normal, cor, tipo, tempo de aparição, fase, brilho) num contêiner que concatena em arrays numpy, sem loop por ponto a cada frame.
5. Luz barata nos atributos: escureça pontos internos (fator tipo oclusão) e destaque onde a normal aponta para cima.
6. A cada frame, em ritmo fixo (~30 fps): gire, projete em perspectiva corrigindo a proporção da célula, use z-buffer, sombreie por normal·luz, escolha o caractere por escala de densidade e aplique cor ANSI truecolor.
7. Anime pelos atributos: montagem progressiva pelo tempo de aparição e luzes piscando pela fase.
8. Confira com contadores (caracteres, luzes, ângulo, fps) e alguns frames salvos antes de exportar.

## Referência de implementação
O script `/workspace/ascii-tree/agac.py` funciona de verdade e está documentado no `README.md` da mesma pasta. Ele faz render no terminal e também exporta mp4/GIF. Lições da recriação da árvore:
- **Proporção da célula:** a célula do vídeo mede 7×12 px, o que dá cerca de 154 colunas por 104 linhas em 1080 px de largura. No terminal, use uma proporção perto de 0,5. Calcule a distância focal em linhas e divida o x pela proporção da célula.
- **z-buffer rápido:** junte célula e profundidade numa chave inteira só, `(cell << 32) | z.view(int32)`, faça um `argsort` e fique com o primeiro ponto de cada célula. Partes que são simétricas em torno do eixo de rotação, como um chão em disco, podem ser projetadas uma vez só e guardadas em cache. Isso deixou o frame cerca de 5x mais rápido.
- **Caracteres:** use a rampa `" .:-=+*#%@"` e limite as agulhas e o chão até `%`. Deixe `@` e `#` para o que brilha: luzes, estrela e o flash de quando um ponto aparece. Raios e linhas decorativas entram como sobreposição 2D na grade, depois do z-buffer.
- **Montagem:** cada ponto aparece no seu `t0` com um flash branco de uns 0,25 s e depois esfria até a cor final. É isso que cria a frente branca que sobe pela árvore.
- **Aparência de vídeo:** o export compõe os glifos com um atlas em numpy, superamostrado 2x. Depois aplica bloom só nos pixels quentes e um bloom suave e largo em tudo, o que dá o halo verde e dourado. Tire um pouco da saturação dos verdes.
- **Validação:** monte um PNG lado a lado com o original em vários instantes e compare estrutura, cores, densidade e HUD. A ferramenta Read guarda imagens em cache pelo caminho, então salve cada iteração com um nome novo.

## Limites
- A proporção da célula muda entre terminais e fontes.
- Se ficar denso demais, reduza pontos antes de aumentar a resolução.

Fonte: @999.2006.01.19, árvore de Natal 3D em ASCII. O script não foi publicado; parte do código foi lida da tela e o resto foi reconstruído em `/workspace/ascii-tree/agac.py`.
