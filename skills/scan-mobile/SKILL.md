---
name: scan-mobile
description: Melhorar, ajustar ou depurar o Scan Mobile v2 do app Planta — um móvel (armário, pia, estante…) com captura própria em dois passes (fechado/aberto), caixa AR com gizmos, detecção de portas, gavetas, puxadores, dobradiças e itens, rig de abrir/fechar e camadas. Use para "melhorar o scan mobile", "altura do armário cortada", "porta aberta virou lateral", "painel fora da caixa", "prateleira duplicada", "móvel inclinado", "quadros borrados", "dobradiça errada", "furniture scan", ou ao abrir poses.jsonl, keyframes/, parts.jsonl, photos.json, layers.json, model.json com furniture.parametric, FurnitureCapture.swift, BoxGizmo.swift, FurnitureFit.swift, PartDetector.swift, DoorRig.swift.
---

# Scan Mobile v2 (captura própria)

`ScanKind.furniture`. Fluxo (`FurnitureDraft.Step`): **pick** (`PieceKind`) → **frame** (caixa AR: primeira detecção da
Apple + nossos gizmos) → **closed** (passe com portas fechadas) → **open** (portas/gavetas abertas, só se o tipo tem)
→ **interior** → **building** (encaixe, detecção, rig, texturas). Colocar num scan RoomPlan é opcional, depois de salvar.
O Object Capture da Apple saiu da UI do Scan Mobile (`ObjectCaptureStep` segue só no modo Fotos). Ainda marcados
`INTEGRATION(T26)` no código em 3e03f48: reconstrução a partir dos passes (`FurnitureScanFlow.swift`), detectores dentro
do `FurnitureAssembly`, tela de consentimento do `PartLabeler` — procure `INTEGRATION(T26)` antes de mexer.

## Arquivos
- Fluxo e rascunho: `Sources/PlantaLiDAR/Furniture/FurnitureScanFlow.swift`, `Sources/PlantaLiDAR/Furniture/FurnitureDraft.swift` (`state.json` v2: `pieceKind`, `box` = BoxRecord, `closedPassFolder`/`openPassFolder`, `FurnitureAssembly`), `Sources/PlantaLiDAR/Furniture/PieceKind.swift`.
- Caixa: `Sources/PlantaLiDAR/Furniture/BoxEditor.swift` ("Subir até o topo", "Redefinir"), `Sources/PlantaLiDAR/Furniture/BoxGizmo.swift` (`EditableBox`, `raisedTop`, `reanchored`).
- Captura: `Sources/PlantaLiDAR/Furniture/FurnitureCapture.swift` (`Pass`, `PassResult`, `FrameQuality`), `Sources/PlantaLiDAR/Furniture/FurnitureCaptureView.swift`, `Sources/PlantaLiDAR/Furniture/CaptureControls.swift`, `Sources/PlantaLiDAR/Furniture/LensControl.swift`.
- Marcas e fotos: `Sources/PlantaLiDAR/Furniture/PartMarks.swift` (`parts.jsonl`), `Sources/PlantaLiDAR/Furniture/QuickAddRing.swift`, `Sources/PlantaLiDAR/Furniture/UserPhotos.swift` (`photos.json`, `PhotoIntent`).
- Interior e encaixe: `Sources/PlantaLiDAR/Furniture/InteriorCaptureController.swift`, `Sources/PlantaLiDAR/Furniture/FurnitureInterior.swift`, `Sources/PlantaLiDAR/Furniture/FurnitureFit.swift` (`FurnitureBox`, `FurnitureAssemblyRules`), `Sources/PlantaLiDAR/Furniture/FurnitureLayout.swift` (`clipped(to:)`, `mergingShelves`).
- Detecção: `Sources/PlantaLiDAR/Furniture/PartDetector.swift`, `Sources/PlantaLiDAR/Furniture/ItemDetector.swift`, `Sources/PlantaLiDAR/Furniture/PartLabeler.swift` (API só com consentimento).
- Peça paramétrica e rig: `Sources/PlantaLiDAR/Furniture/ParametricFurniture.swift`, `Sources/PlantaLiDAR/Furniture/ParametricFurniture+Scene.swift`, `Sources/PlantaLiDAR/Furniture/DoorRig.swift`.
- Camadas, itens, texturas: `Sources/PlantaLiDAR/Furniture/LayersSidebar.swift` (`layers.json`), `Sources/PlantaLiDAR/Furniture/ItemLibrary.swift`, `Sources/PlantaLiDAR/Furniture/TextureMaps.swift`, `Sources/PlantaLiDAR/Furniture/FurnitureViewer.swift`.

**No disco.** Rascunho `Application Support/FurnitureDraft/<uuid>/`: `state.json`, `interior.json`, `exterior_points.bin`,
`parts.jsonl`, `photos.json` e um diretório por passe `closed/` e `open/` com `video.mov`, `poses.jsonl`
(`{"i","t","m":[16],"blurry"}`), `depth/NNNNNN.depth`, `keyframes/NNNNNN.jpg` (só quadros nítidos), `photos/photo-NNN.{jpg,json}` (`intent`).
Peça salva `~/PlantaRender/Models/<uuid>/`: `model.json` (`furniture.layout`, `furniture.parametric`: portas, gavetas,
puxadores, ornamentos, itens), `model.usdz`, `furniture/{interior.json,exterior_points.bin,layers.json}`.
Ainda não chegam ao Mac: poses, depth e fotos dos passes (Part D).

## Invariantes
- **Sistema do móvel destro**: y para cima, z da frente (0) para trás, **x = y × z**; +x à **esquerda** de quem olha de frente. **Desenhos de frente espelham x.** Faces da caixa: left = +x, front = −z, top = +y.
- **Transformações: 16 floats column-major** (`poses.jsonl.m`, `modelToLayout`, `placement.transform`, `PlacedItem.transform`).
- `FurniturePanel.min/max` = os dois outros eixos em ordem x, y, z sem o `axis`.
- Nada fora da caixa: `clipped(to:)` com folga 1 cm; plano > 5 cm fora = móvel vizinho (descartado).
- Altura nunca vem da prateleira mais larga; vem da caixa ou do LiDAR externo (2–98 %).
- Porta guarda o contorno (`Door.outline`), não só min/max; abre > 90°.
- Quadro borrado nunca vira keyframe; um passe nunca termina com zero keyframes.
- Chaves de API só após consentimento por scan, com os quadros listados antes do envio.

## Como medir
```bash
python3 -I scripts/scan_report.py ~/PlantaRender/Models/<uuid>        # peça salva
python3 -I scripts/scan_report.py <FurnitureDraft>/<uuid>              # rascunho (state.json)
```
Bloco furniture: tamanho, painéis por papel, **painéis fora da caixa**, **cantos < 0**, **prateleiras < 1,5 cm**,
tamanho/`sizeMeters`, tamanho/pontos LiDAR e **ALTURA CORTADA** (layout < 0,7 × altura do LiDAR externo).
Bloco `scan_mobile_v2`: por passe quadros, borrados (fração), keyframes, depth, fotos por intenção, vídeo;
`parts.jsonl` por tipo e itens marcados; `photos.json`; camadas ocultas; caixa vs altura do layout;
paramétrico (portas com eixo da dobradiça, `y±` = vertical; gavetas; itens por tipo).
Referência: `~/PlantaRender/Models/90BD16D1-C563-481B-8FD7-097735E70E69` (v1, ALTURA CORTADA 1,067 vs 1,847 m).

## Falhas conhecidas (vídeo do armário, Findings 1–11)
1. Cristaleira/buffet de dois corpos; portas abertas em ângulos diferentes.
2. **Altura parou no balcão** (1,07 m; LiDAR ~1,85 m).
3. **Painéis fora da caixa**: 10 de 12; fundo −0,11…1,76 × −0,79…1,59; cantos até y = −0,79.
4. **Prateleiras duplicadas**: 0,687/0,694 (0,7 cm) são uma tábua.
5. **Tralha** (canecas, copos, potes, pipoqueira) não separada do móvel.
6. **Vidro/verniz** engana a profundidade em ângulo rasante.
7. **Interior escuro**: melhores quadros com tocha.
8. **Borrado** (72–142 s) e perto demais dos copos; potes translúcidos viram fantasmas.
9. **Armário vizinho vaza** na caixa.
10. Portas > 90° e travessa curva: porta nem sempre retângulo.
11. Ferragens pequenas e escuras: precisam de fotos de perto e presets.

**Causas achadas (Part D):** `clipToBoards` cortava a altura na prateleira mais larga; **porta aberta lida como lateral**
(+0,41 m de profundidade); **modelo inclinado 9°** sem nivelar (`FurnitureFit` só resolve yaw + translação);
**origem do interior no balcão** (y −0,77…1,08) → **re-ancorar** o layout ao chão externo:
`translated(by:)` com yaw relativo < 3° (senão quarto de volta), v1: floorY = min(p2 de y dos pontos, menor canto);
ordem: nivelar 9° → re-ancorar → `openDoors` → `clipped` → `mergingShelves` → `FurnitureFit.align`.

## Alavancas
- **Borrado**: `FrameQuality.threshold` = 60 (fixo) em `FurnitureCapture.swift`; parede branca lisa pode virar toda "borrada" → relativo (0,5 × mediana dos últimos 30, piso 15).
- **"Subir até o topo"**: `BoxGizmo.raisedTop(inset: 0.01, maxGap: 0.15)`; inset de ~5 cm atrás e guarda de `reanchored` com câmera olhando para baixo.
- **Altura**: `FurnitureAssemblyRules.taller` = 0,05 (LiDAR externo > caixa + 5 cm e caixa não editada).
- **Prateleiras**: `mergingShelves(tolerance: 0.015)` e `PartDetector.shelfMerge` = 0,015.
- **Porta aberta**: `doorFront` = 0,05 (borda 5 cm à frente) e `doorDepth` = 0,10 (10 cm além do fundo).
- **Caixa**: `FurnitureLayout.clipSlack` 0,01, `foreignPlane` 0,05, `minFaceShare` 0,01.
- **Detectores** (`PartDetector`): `handleMaxSize` 0,15, `darkThreshold` 0,5, `hingeReach` 0,03, `hingeMaxSize` 0,10, `drawerTravel` 0,35, `drawerMaxHeight` 0,45; `ItemDetector.minConfidence` 0,3, `otherConfidence` 0,5, `boxSlack` 0,05. Vidro/PET sem LiDAR → profundidade da prateleira.
- Lente: zoom é recorte do preview; "Alcance" = janela de profundidade (`LensControl.swift`).
- Portões: zero painéis fora, zero cantos < 0, sem ALTURA CORTADA, sem prateleiras < 1,5 cm, borrados < 30 % por passe.

## Verificar
Classes: `FurnitureV2FlowTests`, `FurnitureCaptureTests`, `BoxGizmoTests`, `FurnitureFitTests`, `DoorRigTests`,
`PartDetectorTests`, `PartMarksTests`, `UserPhotosTests`, `LayersTests`, `TextureMapsTests`, `LensControlTests`, `PieceKindTests`.
```bash
xcodegen generate && xcodebuild test -scheme PlantaLiDAR \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:PlantaLiDARTests/FurnitureFitTests -only-testing:PlantaLiDARTests/FurnitureCaptureTests \
  -only-testing:PlantaLiDARTests/FurnitureV2FlowTests
python3 -I scripts/test_scan_report.py
```
Demos: `-screen box-demo [-boxRaised]`, `-rigOpen <f>`.

## Depois de mudar
- Relatório antes/depois no armário de referência e numa peça v2 (painéis fora, cantos, prateleiras, altura, borrados).
- Atualize **Falhas conhecidas** com o que foi provado.
- `~/skills-repo/scripts/publish-skill.sh .claude/skills/scan-mobile` (o gerente publica depois do merge).
