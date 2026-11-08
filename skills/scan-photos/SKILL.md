---
name: scan-photos
description: Melhorar, ajustar ou depurar o scan Fotos do app Planta — fotos em volta de um objeto e modelo texturizado pelo Apple Object Capture (fotogrametria no iPhone). Use para "melhorar o scan de fotos", "Object Capture falhou", "modelo de fotos torto", "modelo sem escala", "textura borrada", "photogrammetry", ou ao abrir PhotoCaptureView.swift, ObjectCaptureStep.swift, ObjectPhotoSet.swift, FurniturePhotogrammetry.swift, pastas Images/ e Checkpoints/.
---

# Scan Fotos (Object Capture)

`ScanKind.photos` — "Fotos em volta de um objeto, modelo texturizado (Object Capture)." A sessão guiada da Apple
tira as fotos com o anel pontilhado; a fotogrametria roda no iPhone e gera um USDZ texturizado salvo como Modelo 3D.
O mesmo passo é o "Por fora" do Scan Mobile v1 (ver `scan-mobile`).

## Arquivos
- `Sources/PlantaLiDAR/Model3D/PhotoCaptureView.swift` — tela do modo Fotos, chama o passo e a fotogrametria.
- `Sources/PlantaLiDAR/Furniture/ObjectCaptureStep.swift` — passo Object Capture (`Images/`, `Checkpoints/`, régua, flash).
- `Sources/PlantaLiDAR/Model3D/ObjectPhotoSet.swift` — quadros gravados (`recording/frames.jsonl`: JPEG, pose column-major, intrínsecos).
- `Sources/PlantaLiDAR/Model3D/FurniturePhotogrammetry.swift` — fotogrametria por objeto (também usada pelo RoomPlan Advanced).
- `Sources/PlantaLiDAR/RoomScan/OrbitCoverage.swift` — quanto do giro foi coberto.
- `Sources/PlantaLiDAR/Model3D/Model3DStore.swift`, `Sources/PlantaLiDAR/Model3D/Model3DViewer.swift`.
- Dados: `~/PlantaRender/Models/<uuid>/{model.json,model.usdz}`.

## Invariantes
- Fotos ficam em `<pasta>/Images`, checkpoints em `<pasta>/Checkpoints`; um rascunho com fotos é reaproveitado.
- Poses em 16 floats column-major.
- O modelo final é métrico (Object Capture com LiDAR); `sizeMeters` precisa bater com o objeto.

## Como medir
```bash
python3 -I scripts/scan_report.py ~/PlantaRender/Models/<uuid>
ls <rascunho>/Images | wc -l       # quantas fotos entraram
```
`sizeMeters` vs fita métrica; `vertexCount`/`faceCount`; `usdz_bytes`.

## Falhas conhecidas
- Objetos brilhantes, transparentes ou sem textura (vidro, branco liso) quebram a fotogrametria.
- Fotos borradas ou com pouca luz viram textura manchada.
- Objeto encostado em outro (parede, móvel vizinho) mistura as duas malhas.
- O Object Capture não dá controle de zoom nem de lente; por isso a v2 do Scan Mobile (Parte C) troca por captura própria.

## Alavancas
- Seleção de fotos por nitidez antes da fotogrametria (`Sources/PlantaLiDAR/Model3D/ObjectPhotoSet.swift`).
- Detalhe da fotogrametria (reduced/medium/full) por `DeviceProfile`.
- Encaixe guiado por profundidade: escalar/alinhar o resultado com a profundidade LiDAR.
- Dizimação e bake de normais (`Sources/PlantaLiDAR/Model3D/ModelExporter.swift`).

## Verificar
Classes: `ObjectPhotoSetTests`, `OrbitCoverageTests`, `FurnitureGroupTests`, `CaptureTests`, `Model3DCaptureTests`.
```bash
xcodegen generate && xcodebuild test -scheme PlantaLiDAR \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:PlantaLiDARTests/ObjectPhotoSetTests -only-testing:PlantaLiDARTests/OrbitCoverageTests
```
Object Capture só roda em aparelho; no simulador teste a lógica (seleção de fotos, cobertura).

## Depois de mudar
- Relatório antes/depois; gate: `sizeMeters` dentro de 2 % da medida real.
- Atualize **Falhas conhecidas**.
- `~/skills-repo/scripts/publish-skill.sh .claude/skills/scan-photos`.
