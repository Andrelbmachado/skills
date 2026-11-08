---
name: scan-truedepth
description: Melhorar, ajustar ou depurar o scan TrueDepth do app Planta — câmera frontal, rosto ou objeto pequeno bem de perto. Use para "melhorar o scan TrueDepth", "scan do rosto", "câmera frontal", "malha do rosto sem detalhe", "face scan", "Este iPhone não tem câmera TrueDepth", ou ao abrir ModelCaptureController.swift (isFace, ARFaceTrackingConfiguration, faceAnchor), Model3DCaptureView.swift.
---

# Scan TrueDepth

`ScanKind.trueDepth` — "Câmera frontal: rosto ou objeto pequeno bem de perto." Usa `ARFaceTrackingConfiguration`;
ao terminar, a malha salva é a geometria do `ARFaceAnchor` (topologia fixa do rosto da Apple). Alcance 0,6 m.

## Arquivos
- `Sources/PlantaLiDAR/Model3D/ModelCaptureController.swift` — `isFace`, `configuration()`, ramo `faceAnchor` na finalização,
  sem recorte por alcance e sem `sampleQuality` para rosto.
- `Sources/PlantaLiDAR/Model3D/Model3DCaptureView.swift` — UI (ramo `c.isFace`).
- `Sources/PlantaLiDAR/Recording/MeshExporter.swift` — `MeshExporter.Mesh` (vértices, faces, transform).
- `Sources/PlantaLiDAR/Model3D/Model3DStore.swift`, `Sources/PlantaLiDAR/Model3D/ModelExporter.swift`, `Sources/PlantaLiDAR/Model3D/Model3DViewer.swift`.
- Dados: `~/PlantaRender/Models/<uuid>/{model.json,model.usdz}`.

## Invariantes
- Sem câmera TrueDepth → mensagem "Este iPhone não tem…" e nada de sessão (`supported`).
- A malha do rosto vem no espaço do anchor com o `transform` dele; nunca misturar com malha LiDAR.
- Não grava fotos do rosto em `events.jsonl` nem manda para API sem consentimento (dado pessoal).

## Como medir
```bash
python3 -I scripts/scan_report.py ~/PlantaRender/Models/<uuid>
```
`vertexCount` fixo (topologia da Apple) indica que só o rosto foi salvo; `sizeMeters` ~0,15–0,25 m.

## Falhas conhecidas
- "Objeto pequeno" não funciona de fato: só o `ARFaceAnchor` vira malha, então um objeto sem rosto sai vazio.
- A malha do rosto não tem cabelo, orelhas nem pescoço, e a cor não é projetada.
- Sem `ARFaceAnchor` no momento de terminar → modelo vazio.

## Alavancas
- Para objetos: usar a profundidade TrueDepth (`capturedDepthData`) e o `PointCloudBuilder` em vez do anchor.
- Projetar a cor da câmera frontal nos vértices do rosto.
- Acumular várias poses do rosto (girar a cabeça) antes de salvar.

## Verificar
Classes: `Model3DCaptureTests`, `RoomPlanModeTests` (`testScanMenuHasEveryMode`), `ModelExportTests`, `MeshExporterTests`.
```bash
xcodegen generate && xcodebuild test -scheme PlantaLiDAR \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:PlantaLiDARTests/Model3DCaptureTests -only-testing:PlantaLiDARTests/MeshExporterTests
```
TrueDepth só roda em aparelho.

## Depois de mudar
- Relatório antes/depois; confira `vertexCount` e `sizeMeters`.
- Atualize **Falhas conhecidas**.
- `~/skills-repo/scripts/publish-skill.sh .claude/skills/scan-truedepth`.
