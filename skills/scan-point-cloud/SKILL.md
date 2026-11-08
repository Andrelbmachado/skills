---
name: scan-point-cloud
description: Melhorar, ajustar ou depurar o scan Point Cloud (nuvem de pontos) do app Planta — profundidade bruta do LiDAR com cor da câmera. Use para "melhorar a nuvem de pontos", "pontos voando", "nuvem com ruído", "nuvem duplicada", "point cloud noise", ou ao abrir PointCloudBuilder.swift, ModelCaptureController.swift (pointCloud), exports PLY/XYZ.
---

# Scan Point Cloud

`ScanKind.pointCloud` — "Nuvem de pontos com a profundidade bruta do LiDAR." Cada pixel de profundidade de cada
keyframe é desprojetado para o mundo com a cor da câmera e afinado numa grade de voxels
(1 cm se alcance ≤ 1,5 m, 2 cm acima). Alcance inicial 4 m.

## Arquivos
- `Sources/PlantaLiDAR/Model3D/PointCloudBuilder.swift` — `cloud(from:range:)`, voxel, dedupe.
- `Sources/PlantaLiDAR/Model3D/ModelCaptureController.swift` — `kind == .pointCloud` usa o builder em vez da malha.
- `Sources/PlantaLiDAR/Model3D/Model3DCapture.swift` — `CameraKeyframe` (profundidade, intrínsecos, pose).
- `Sources/PlantaLiDAR/Model3D/ModelExporter.swift` — só formatos de pontos para nuvem.
- `Sources/PlantaLiDAR/Model3D/Model3DStore.swift`, `Sources/PlantaLiDAR/Model3D/Model3DViewer.swift`.
- Dados: `~/PlantaRender/Models/<uuid>/model.json` + arquivo de pontos.

## Invariantes
- Pontos em coordenadas do mundo, metros, Y para cima; um ponto por voxel.
- Pontos além do alcance são descartados.
- Exportação da nuvem oferece só formatos de pontos (nunca malha falsa).

## Como medir
```bash
python3 -I scripts/scan_report.py ~/PlantaRender/Models/<uuid>
```
`vertexCount` = número de pontos; `sizeMeters` = caixa. Caixa muito maior que o objeto = pontos voando.

## Falhas conhecidas
- Profundidade de baixa confiança nas bordas cria "pontos voando" (franjas entre objetos e fundo).
- Vidro e superfícies escuras dão pontos falsos atrás da superfície.
- Deriva de tracking em varreduras longas gera camadas duplicadas (paredes "dobradas").

## Alavancas
- Filtrar por `confidenceMap` (só alta) em `Sources/PlantaLiDAR/Model3D/PointCloudBuilder.swift`.
- Tamanho do voxel por alcance e por `DeviceProfile`.
- Remoção de outliers (vizinhos por voxel) antes de salvar.
- Portão: caixa (p2–p98) da nuvem vs medida real.

## Verificar
Classes: `PointCloudModeTests`, `RoomPlanModeTests` (`testDepthBecomesColouredPointsInFrontOfCamera`,
`testPointsBeyondRangeAreDropped`, `testOverlappingKeyframesAreDeduplicated`, `testPointCloudExportsOnlyPointFriendlyFormats`), `ModelExportTests`.
```bash
xcodegen generate && xcodebuild test -scheme PlantaLiDAR \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:PlantaLiDARTests/PointCloudModeTests -only-testing:PlantaLiDARTests/ModelExportTests
```

## Depois de mudar
- Relatório antes/depois no mesmo scan; `vertexCount` não deve explodir.
- Atualize **Falhas conhecidas**.
- `~/skills-repo/scripts/publish-skill.sh .claude/skills/scan-point-cloud`.
