---
name: camera-handheld-realista
description: Use ao animar uma câmera em cena 3D (three.js, PlayCanvas, Gaussian Splatting, motion-code) que precisa parecer filmada por uma pessoa andando com celular, não um voo de drone.
---

# Câmera de mão realista (pedestre com celular)

Gatilho: a cena 3D ou o render precisa parecer um vídeo gravado no celular por alguém andando.

## Passos
1. Defina a velocidade de caminhada (ex.: 1,2 m/s) e derive dela a cadência dos passos.
2. Modele a marcha: dois picos de oscilação vertical por passo, balanço lateral a cada passada e um pequeno impacto no calcanhar.
3. Modele a cabeça: alterne o olhar entre o caminho à frente e pontos de interesse (vitrines, placas, grafite), girando com uma mola amortecida.
4. Prenda a câmera/celular à cabeça com uma mola mais rígida, para que siga com leve atraso.
5. Aplique a cadeia de lente e sensor: tempo de exposição (ex.: 1/80 s, com desfoque de movimento), rolling shutter (~16 ms de leitura), distorção de barril, aberração cromática, halation nas luzes altas, nitidez de celular, vinheta e ruído de sensor na resolução final (ex.: 1080p).
6. Trave o fps (ex.: 30 fixos) para o movimento ficar consistente.
7. Som: um passo por pisada, sincronizado com a marcha, mais ambiente/eco do local, passado por uma cadeia que simule microfone de celular.
8. Colisões: se a câmera encostar na geometria (num splat a cena se desfaz em pontos), aplique folga ou colisão.
9. Teste o desempenho no aparelho de destino (principalmente celular) antes de entregar.

## Limites
- Os valores acima são pontos de partida, não regras; ajuste olhando o resultado.
- Skills relacionadas: threejs-loaders (carregar splats), threejs-postprocessing (efeitos), motion-code (render de vídeo).

Fonte: @brmetaverso, https://www.instagram.com/brmetaverso/reel/DfiI7Lrub5X/ (câmera de Will Eastcott, PlayCanvas).
