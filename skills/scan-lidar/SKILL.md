---
name: scan-lidar
description: Melhorar, ajustar ou depurar o scan LiDAR (Modelo 3D) do app Planta — malha 3D com cor de tudo ao redor, vídeo Full HD. Use para "melhorar o scan LiDAR", "malha com buracos", "cor da malha errada", "objeto cortado pelo alcance", "modelo 3D LiDAR", "mesh holes", ou ao abrir model.json com kind lidar, model.usdz, ModelCaptureController.swift, Model3DCapture.swift, ModelExporter.swift, ScanQuality.swift.
---

# Scan LiDAR (Modelo 3D)

`ScanKind.lidar` — "Malha 3D com cor de tudo ao redor, vídeo Full HD." Malha do ARKit (`sceneReconstruction = .mesh`)
desenhada como mapa de calor por distância, recortada pelo alcance; keyframes 480 px (máx. 80) dão a cor dos vértices.
Modos: Objeto (1 m), Ambiente (5 m), Pessoa (2 m); alcance entre 0,5 e 5 m.

## Arquivos
- `Sources/PlantaLiDAR/Model3D/ModelCaptureController.swift` — sessão, mapa de calor (shader `pl_range`), `KeyframeRecorder`, finalização.
- `Sources/PlantaLiDAR/Model3D/Model3DCapture.swift` — `CaptureMode`, `CameraKeyframe`, paleta.
- `Sources/PlantaLiDAR/Model3D/Model3DCaptureView.swift` — UI (modo, alcance, gravar/pausar/terminar).
- `Sources/PlantaLiDAR/Model3D/ScanQuality.swift` — voxels de 5 cm vistos com confiança → cor ao vivo.
- `Sources/PlantaLiDAR/Model3D/Mesh3D.swift` — malha (metros, Y para cima, cor por vértice).
- `Sources/PlantaLiDAR/Model3D/Model3DStore.swift` — `<uuid>/model.json` + malha.
- `Sources/PlantaLiDAR/Model3D/ModelExporter.swift` — USDZ/OBJ/PLY…
- `Sources/PlantaLiDAR/Model3D/Model3DViewer.swift` — visualizador, tamanho, altitude, AR.
- `Sources/PlantaLiDAR/RoomScan/RoomPlanBuilder.swift` — `ScanKind` (`keyframeWidth`, `maxKeyframes`, `defaultRange`).
- Dados: `~/PlantaRender/Models/<uuid>/{model.json,model.usdz}` (`kind: lidar`).

## Invariantes
- Malha em coordenadas do mundo ARKit, metros, Y para cima; escala de `Calibration.shared.factor` aplicada ao salvar.
- Faces fora do alcance de todas as câmeras são descartadas (`within(range:of:)`).
- `model.json`: `sizeMeters`, `vertexCount`, `faceCount`, `range`, `mode`, `altitude`.

## Como medir
```bash
python3 -I scripts/scan_report.py ~/PlantaRender/Models/<uuid>
```
- `sizeMeters` vs fita métrica (anote a medida real no commit); `vertexCount`/`faceCount`; `usdz_bytes`.
- Sem gravação (`recording/`) neste tipo: o relatório fica parcial, isso é esperado.

## Falhas conhecidas
- Alcance curto demais corta o objeto; longo demais junta o chão e a parede.
- Superfícies pretas, brilhantes ou vidro dão buracos (LiDAR não volta).
- 80 keyframes de 480 px deixam a cor borrada em objetos grandes.

## Alavancas
- Alcance padrão por modo em `Sources/PlantaLiDAR/Model3D/Model3DCapture.swift`.
- Número/largura de keyframes por `ScanKind` e por `DeviceProfile` (iPad M1 aguenta mais).
- Dizimação e bake de normais na exportação (`Sources/PlantaLiDAR/Model3D/ModelExporter.swift`).
- Limiar de confiança do `Sources/PlantaLiDAR/Model3D/ScanQuality.swift`.

## Verificar
Classes: `Model3DCaptureTests`, `Model3DRealScanTests`, `ModelExportTests`, `ModelV4Tests`, `ScanQualityTests`,
`LiveMeshColourTests`, `MeshExporterTests`.
```bash
xcodegen generate && xcodebuild test -scheme PlantaLiDAR \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:PlantaLiDARTests/Model3DCaptureTests -only-testing:PlantaLiDARTests/ModelExportTests
```

## Depois de mudar
- Relatório antes/depois no mesmo modelo; gate: `sizeMeters` dentro de 2 % da medida real.
- Atualize **Falhas conhecidas**.
- `~/skills-repo/scripts/publish-skill.sh .claude/skills/scan-lidar`.
