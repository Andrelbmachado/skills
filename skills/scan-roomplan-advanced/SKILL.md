---
name: scan-roomplan-advanced
description: Melhorar, ajustar ou depurar o scan RoomPlan Advanced do app Planta — a planta exata com textura de parede e piso e os móveis em 3D tirados da filmagem. Use para "melhorar o RoomPlan Advanced", "textura da parede errada", "piso borrado", "móvel 3D do RoomPlan feio", "skin", "render avançado", ou ao abrir skin/skin.json, skin/objects.json, RoomSkin.swift, RoomSkinStore.swift, FurniturePhotogrammetry.swift, WallLook.swift.
---

# Scan RoomPlan Advanced

`ScanKind.roomPlanAdvanced` — "A planta exata com a textura das paredes e do piso e os móveis em 3D, tirados da filmagem."
Mesma captura do RoomPlan (`RoomScanRequest(advanced: true)`), mais o "skin" feito da gravação.
Para paredes perdidas ou pilares falsos, use a skill `scan-roomplan`.

## Arquivos
- `Sources/PlantaLiDAR/RoomScan/RoomScanController.swift`, `Sources/PlantaLiDAR/RoomScan/RoomFrameRecorder.swift` — captura + `recording/frames.jsonl`.
- `Sources/PlantaLiDAR/Beta/RoomSkin.swift` — projeta os quadros nas paredes retas e no piso.
- `Sources/PlantaLiDAR/Beta/RoomSkinStore.swift` — texturas e móveis assados (`skin/skin.json`, `face_*`, `tile_*`, `floor_main.png`, `furn_*_front/side.png`).
- `Sources/PlantaLiDAR/Beta/WallLook.swift` — material da parede (branca lisa, tijolo…) a partir de uma foto frontal.
- `Sources/PlantaLiDAR/Beta/FurnitureVision.swift` — Apple Vision no melhor quadro de cada objeto (`skin/obj_*.jpg`).
- `Sources/PlantaLiDAR/Beta/ApplianceSkin.swift` — aparelhos (geladeira, fogão).
- `Sources/PlantaLiDAR/Model3D/FurniturePhotogrammetry.swift` — modelo 3D texturizado de cada móvel reconhecido.
- `Sources/PlantaLiDAR/RoomScan/FurnitureGroups.swift`, `Sources/PlantaLiDAR/RoomScan/OrbitCoverage.swift` — conjuntos (mesa + cadeiras) e quanto do giro foi visto.
- `Sources/PlantaLiDAR/UI/Plan3DView.swift` — vista 3D que usa o skin.
- Render no Mac: `Sources/PlantaLiDAR/Render/RenderLink.swift`, `Sources/PlantaRender/RenderServer.swift`.

## Invariantes
- Poses dos quadros: 16 floats column-major em `frames.jsonl` (`pose`, `fx`, `fy`, `cx`, `cy`, `t`, `file`).
- Textura só em parede reta do plano final; o skin nunca altera a geometria do plano.
- Sem dados pessoais nem chaves em `skin/` (vai para o Mac).

## Como medir
```bash
python3 -I scripts/scan_report.py ~/PlantaRender/Scans/<uuid>     # frames, cobertura, skin: true/false
ls ~/PlantaRender/Scans/<uuid>/skin | sed 's/_[0-9].*//' | sort | uniq -c
```
- `frames.count` baixo ou `seconds` curto → poucas vistas por parede.
- `coverage.ratio` muito abaixo de 1 → piso mal visto → `floor_main.png` com buracos.
- Compare `objects_raw` (RoomPlan) com os `furn_*` gerados.

## Falhas conhecidas
- Herda todas as falhas de `scan-roomplan` (paredes soltas, pilar falso, casa como um cômodo).
- Quadros borrados ou com exposição ruim mancham a textura; parede vista de lado estica o tile.
- Móvel encostado em outro (conjunto) recebe foto do vizinho; `OrbitCoverage` baixo = lados sem foto.
- Paredes brancas sem textura enganam o `WallLook` com sombras.

## Alavancas
- Escolha de quadro por parede (ângulo, distância, nitidez) em `Sources/PlantaLiDAR/Beta/RoomSkin.swift`.
- Tamanho do tile / atlas por `DeviceProfile` (Parte A, Task 1).
- Limiar de material em `Sources/PlantaLiDAR/Beta/WallLook.swift`.
- Encaixe guiado por profundidade e dizimação no `Sources/PlantaLiDAR/Model3D/FurniturePhotogrammetry.swift`.

## Verificar
Classes: `RoomSkinTests`, `RoomSkinStoreTests`, `SkinAccumulatorTests`, `WallLookTests`, `ApplianceSkinTests`,
`FurnitureGroupTests`, `OrbitCoverageTests`, `RoomPlanModeTests`, `RenderLinkTests`.
```bash
xcodegen generate && xcodebuild test -scheme PlantaLiDAR \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:PlantaLiDARTests/RoomSkinTests -only-testing:PlantaLiDARTests/WallLookTests
```

## Depois de mudar
- Rode o relatório e abra o skin no `PlantaRender` (Mac) para comparar visualmente antes/depois.
- Atualize **Falhas conhecidas**.
- `~/skills-repo/scripts/publish-skill.sh .claude/skills/scan-roomplan-advanced`.
