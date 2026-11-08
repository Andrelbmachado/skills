---
name: scan-mobile
description: Melhorar, ajustar ou depurar o Scan Mobile do app Planta — um móvel (armário, pia, estante…) por fora (Object Capture) e por dentro (LiDAR), com medidas e "planta do móvel". Use para "melhorar o scan mobile", "altura do armário errada", "painel fora da caixa", "prateleira duplicada", "móvel do vizinho entrou", "cantos abaixo do chão", "furniture scan", ou ao abrir model.json com furniture, furniture/interior.json, exterior_points.bin, FurnitureFit.swift, FurnitureInterior.swift, FurnitureScanFlow.swift.
---

# Scan Mobile (móvel por fora e por dentro)

`ScanKind.furniture` — "Um móvel por fora e por dentro, com medidas exatas". Fluxo v1: Object Capture (fora) →
filmagem LiDAR do interior → layout (painéis, compartimentos) → encaixe → colocação opcional num scan RoomPlan.
**A v2 (Parte C do plano 2026-11-08) troca o Object Capture por captura própria** (caixa AR com gizmos, passes
fechado/aberto, zoom); reescreva esta skill quando a v2 entrar (Task 26).

## Arquivos
- `Sources/PlantaLiDAR/Furniture/FurnitureScanFlow.swift` — fluxo em tela cheia.
- `Sources/PlantaLiDAR/Furniture/ObjectCaptureStep.swift` — passo Object Capture (sai na v2).
- `Sources/PlantaLiDAR/Furniture/InteriorCaptureController.swift`, `Sources/PlantaLiDAR/Furniture/InteriorCaptureView.swift` — "Por dentro".
- `Sources/PlantaLiDAR/Furniture/FurnitureInterior.swift` — pontos LiDAR → painéis/compartimentos.
- `Sources/PlantaLiDAR/Furniture/FurnitureFit.swift` — encaixa o modelo externo no layout.
- `Sources/PlantaLiDAR/Furniture/FurnitureLayout.swift` — `FurniturePanel`, `FurnitureLayout`, sistema de coordenadas.
- `Sources/PlantaLiDAR/Furniture/FurnitureDraft.swift` — rascunho, `interior.json`, `exterior_points.bin`.
- `Sources/PlantaLiDAR/Furniture/FurnitureDrawing.swift`, `Sources/PlantaLiDAR/Furniture/FurnitureViewer.swift` — desenho 2D e visualizador.
- `Sources/PlantaLiDAR/Furniture/FurniturePlacement.swift`, `Sources/PlantaLiDAR/Furniture/ScannedFurnitureSwap.swift` — colocar no cômodo.
- Dados: `~/PlantaRender/Models/<uuid>/{model.json,model.usdz,furniture/interior.json,furniture/exterior_points.bin,furniture/interior/video.mov}`.

## Invariantes
- **Sistema do móvel destro**: y para cima, z da frente (0) para trás, **x = y × z**; +x vai para a **esquerda** de quem olha de frente. Origem no canto inferior-frontal de menor x. **Desenhos de frente espelham x.**
- **Transformações: 16 floats column-major** (`modelToLayout`, `placement.transform`, `interior.json.transform`).
- `FurniturePanel.min/max` = os dois outros eixos em ordem x, y, z sem o `axis` (x → (y, z); y → (x, z); z → (x, y)).
- `layout.size` = largura, altura, profundidade; deve bater com `model.json.sizeMeters`.
- Nenhum painel ou canto sai da caixa externa; nada abaixo de y = 0.
- `exterior_points.bin`: Float32 xyz little-endian, já no sistema do móvel.

## Como medir
```bash
python3 -I scripts/scan_report.py ~/PlantaRender/Models/<uuid>
```
Mostra: tamanho externo, painéis por papel, **painéis que saem da caixa** (> 2 cm, listados), **cantos abaixo de y=0**,
**prateleiras a menos de 1,5 cm** (pares), razão tamanho/`sizeMeters` e **tamanho vs pontos LiDAR** (p2–p98).
Peça de referência: `~/PlantaRender/Models/90BD16D1-C563-481B-8FD7-097735E70E69` (Armário · Cozinha).

## Falhas conhecidas (vídeo do armário, 2026-11-08, Findings 1–11)
1. Peça real é uma cristaleira/buffet com dois corpos; portas abertas em ângulos diferentes no vídeo.
2. **Altura parou no balcão**: layout 1,37 × 1,07 × 0,80 m; pontos LiDAR dão ~1,85 m de altura (layout/pontos y = 0,58). A caixa veio da primeira detecção e a filmagem do interior não a estendeu.
3. **Painéis fora da caixa**: 10 de 12 painéis saem; fundo −0,11…1,76 × −0,79…1,59 m; lateral começa em −0,83; cantos até y = −0,79. O recorte da v1 foi aplicado às caixas, não às extensões ajustadas.
4. **Prateleiras duplicadas**: y 0,687 e 0,694 são uma tábua (0,7 cm); 0,357 e 0,461 a conferir. Mesclar < 1,5 cm.
5. **Tralha domina**: canecas, copos, pratos, potes, pipoqueira e liquidificador em cima; nada separado do móvel.
6. **Vidro**: portas de vidro e copos são transparentes/reflexivos; verniz engana a profundidade em ângulo rasante.
7. **Interior escuro**: os melhores quadros são com lanterna/luz do teto.
8. **Borrado** (72–142 s): muitos quadros com movimento ou perto demais dos copos; potes translúcidos viram fantasmas.
9. **Armário vizinho vaza**: o vizinho pintado encosta à direita e a malha dele entra na caixa.
10. Portas abrem além de 90° e a de vidro tem travessa curva: porta não é sempre retângulo (guardar o contorno).
11. Ferragens pequenas e escuras (puxadores de argola, trinco, dobradiças): precisam de fotos de perto e presets.

## Alavancas
- Estender a caixa com os pontos do interior/exterior (altura) em `Sources/PlantaLiDAR/Furniture/FurnitureFit.swift`.
- Recortar extensões dos painéis à caixa e rejeitar geometria fora dela em `Sources/PlantaLiDAR/Furniture/FurnitureInterior.swift`.
- Mesclar tábuas < 1,5 cm (mesma lógica, `FurnitureInterior.swift`).
- Filtro de nitidez e distância mínima nos quadros em `Sources/PlantaLiDAR/Furniture/InteriorCaptureController.swift`; tocha (`Sources/PlantaLiDAR/UI/TorchButton.swift`).
- Separar itens (tralha) do móvel: classes de objeto do Vision / CoreML (Parte C).
- Portão de regressão: `size_vs_lidar_points` perto de 1 em cada eixo; zero painéis fora; zero cantos < 0.

## Verificar
Classes: `FurnitureFitTests`, `FurnitureInteriorTests`, `InteriorCaptureTests`, `FurnitureFlowTests`,
`FurnitureDrawingTests`, `FurnitureModelTests`, `FurnitureRoomTests`, `ScanMobileIntegrationTests`.
```bash
xcodegen generate && xcodebuild test -scheme PlantaLiDAR \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:PlantaLiDARTests/FurnitureFitTests -only-testing:PlantaLiDARTests/FurnitureInteriorTests
python3 -I scripts/test_scan_report.py
```

## Depois de mudar
- Rode o relatório no armário de referência e compare (painéis fora, cantos < 0, prateleiras, razão de altura).
- Atualize **Falhas conhecidas** com o que foi provado.
- `~/skills-repo/scripts/publish-skill.sh .claude/skills/scan-mobile`.
