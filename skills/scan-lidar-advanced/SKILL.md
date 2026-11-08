---
name: scan-lidar-advanced
description: Melhorar, ajustar ou depurar o scan LiDAR Advanced do app Planta — mais de perto, Full HD, mais fotos para detalhes e profundidade suavizada. Use para "melhorar o LiDAR Advanced", "detalhe fino perdido", "quina arredondada", "poucas fotos no modelo", "smoothed depth", ou ao abrir model.json com kind lidarAdvanced, ModelCaptureController.swift (lidarAdvanced, smoothedSceneDepth, keyframeWidth 640).
---

# Scan LiDAR Advanced

`ScanKind.lidarAdvanced` — "Mais de perto, Full HD e mais fotos para detalhes." Igual ao `scan-lidar`, mas:
alcance inicial 1,0 m (máx. 2 m ao trocar de modo), `smoothedSceneDepth` ligado, keyframes de 640 px (máx. 160).

## Arquivos
- `Sources/PlantaLiDAR/Model3D/ModelCaptureController.swift` — `configuration()` (`.smoothedSceneDepth` só aqui), alcance inicial.
- `Sources/PlantaLiDAR/RoomScan/RoomPlanBuilder.swift` — `keyframeWidth` 640, `maxKeyframes` 160, `defaultRange` 1,5.
- `Sources/PlantaLiDAR/Model3D/Model3DCapture.swift`, `Sources/PlantaLiDAR/Model3D/ScanQuality.swift`, `Sources/PlantaLiDAR/Model3D/Mesh3D.swift`.
- `Sources/PlantaLiDAR/Model3D/Model3DStore.swift`, `Sources/PlantaLiDAR/Model3D/ModelExporter.swift`, `Sources/PlantaLiDAR/Model3D/Model3DViewer.swift`.
- Dados: `~/PlantaRender/Models/<uuid>/{model.json,model.usdz}` (`kind: lidarAdvanced`).

## Invariantes
- Mesmas do `scan-lidar` (mundo ARKit, metros, Y para cima, calibração aplicada).
- Advanced nunca usa alcance acima de 2 m (perde o sentido de "de perto").
- Profundidade suavizada só em `lidarAdvanced`; os outros tipos usam `sceneDepth` cru.

## Como medir
```bash
python3 -I scripts/scan_report.py ~/PlantaRender/Models/<uuid>
```
Compare com um scan `lidar` do mesmo objeto: `vertexCount`, `faceCount`, `sizeMeters`, `usdz_bytes`.
Advanced deve ter mais vértices por m² e a mesma medida.

## Falhas conhecidas
- Profundidade suavizada arredonda quinas e apaga frestas finas (portas, gavetas).
- 160 keyframes de 640 px pesam na memória do iPhone; o arquivo USDZ cresce muito.
- Muito perto (< 25 cm) o LiDAR satura e some com a superfície.

## Alavancas
- `smoothedSceneDepth` vs `sceneDepth` (testar os dois no mesmo objeto).
- Orçamento de keyframes por `DeviceProfile` (Parte A, Task 1–2: iPad M1 com 8/16 GB).
- Seleção de keyframes por nitidez antes de colorir a malha.
- Atlas de textura por dispositivo; dizimação na exportação.

## Verificar
Classes: `Model3DCaptureTests`, `Model3DRealScanTests`, `ModelExportTests`, `ScanQualityTests`, `RecordingResolutionTests`.
```bash
xcodegen generate && xcodebuild test -scheme PlantaLiDAR \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:PlantaLiDARTests/Model3DCaptureTests -only-testing:PlantaLiDARTests/Model3DRealScanTests
```

## Depois de mudar
- Relatório antes/depois; gate: mesma `sizeMeters` (±2 %) e mais detalhe que o `lidar`.
- Atualize **Falhas conhecidas**.
- `~/skills-repo/scripts/publish-skill.sh .claude/skills/scan-lidar-advanced`.
