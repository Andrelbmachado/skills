---
name: scan-classic-plan
description: Melhorar, ajustar ou depurar o scan Planta clássica do app Planta — o escaneamento de planta antigo, LiDAR puro (sem RoomPlan) com RANSAC, grade de alturas e cantos por toque. Use para "melhorar a planta clássica", "scan antigo", "cantos errados", "parede dobrada", "planta torta", "classic plan", ou ao abrir ScanView.swift, ScanCoordinator.swift, ARFrameSource.swift, PlanBuilder.swift, WallMapper.swift, GridPlanner.swift, frames.jsonl de sessão.
---

# Scan Planta clássica

`ScanKind.classicPlan` — "O escaneamento de planta que o app já tinha." `HomeView.startScan()` abre uma `ScanSession`;
o `ScanCoordinator` puxa quadros do `ARFrameSource` (world tracking + `sceneDepth`) e roda o pipeline de geometria:
planos verticais (RANSAC) → candidatos de parede → plano regularizado; cantos por toque no retículo.

## Arquivos
- `Sources/PlantaLiDAR/UI/ScanView.swift` — tela do scan.
- `Sources/PlantaLiDAR/Scan/ScanCoordinator.swift` — pipeline num worker serial, cantos por toque (janela 7×7 de profundidade).
- `Sources/PlantaLiDAR/Scan/ARFrameSource.swift`, `Sources/PlantaLiDAR/Scan/FrameSource.swift`, `Sources/PlantaLiDAR/Scan/MockFrameSource.swift`, `Sources/PlantaLiDAR/Scan/SyntheticRoom.swift`.
- `Sources/PlantaLiDAR/Scan/SemanticCollector.swift` — rótulos semânticos do ARKit (porta, mesa, assento).
- `Sources/PlantaLiDAR/Geometry/RANSAC.swift`, `Sources/PlantaLiDAR/Geometry/WallMapper.swift` — planos → candidatos de parede (linha n·p = c em XZ).
- `Sources/PlantaLiDAR/Geometry/GridPlanner.swift`, `Sources/PlantaLiDAR/Geometry/GridPlanner+Rules.swift` — colunas de 3 cm × faixas de 4 cm.
- `Sources/PlantaLiDAR/Geometry/PlanBuilder.swift`, `Sources/PlantaLiDAR/Geometry/Regularizer.swift` — plano limpo, esquadro.
- `Sources/PlantaLiDAR/Geometry/CornerTracker.swift`, `Sources/PlantaLiDAR/Geometry/CornerRefiner.swift` — cantos estáveis.
- `Sources/PlantaLiDAR/Recording/SessionRecorder.swift` — `frames.jsonl` da sessão.
- Ferramentas: `scripts/reprocess_session.py`, `scripts/analyze_session.py`, `scripts/compare_plans.py`, `scripts/pull_session.sh`.

## Invariantes
- Pipeline nunca roda na main thread; UI recebe só estado publicado.
- Metros, y para cima, plano em XZ; poses 16 floats column-major.
- Canto tocado pelo usuário ganha do canto estimado.
- `MockFrameSource`/`SyntheticRoom` reproduzem a sessão sem aparelho (base dos testes).

## Como medir
```bash
python3 -I scripts/scan_report.py ~/PlantaRender/Scans/<uuid>     # paredes do plano, quadros, eventos
python3 -I scripts/reprocess_session.py <sessão>                  # rerodar o pipeline offline
```
Sem `roomplan_raw.json` neste tipo: `walls.raw` fica nulo e o relatório é parcial (esperado). Compare `walls.plan`
com a contagem real de paredes e use `scripts/compare_plans.py` contra uma referência.

## Falhas conhecidas
- Móveis altos encostados viram parede (o grid vê uma coluna cheia).
- Paredes brancas lisas em ângulo rasante dão poucos pontos; RANSAC parte a parede em duas.
- Deriva de tracking em casas grandes entorta o esquadro.
- Superado pelo RoomPlan na maioria dos casos; mantido como alternativa.

## Alavancas
- Limiares de RANSAC e de suporte mínimo (`Sources/PlantaLiDAR/Geometry/WallMapper.swift`).
- Regras do grid (altura mínima de parede, vão de porta) em `Sources/PlantaLiDAR/Geometry/GridPlanner+Rules.swift`.
- Tolerância do esquadro em `Sources/PlantaLiDAR/Geometry/Regularizer.swift`.
- Estabilidade de cantos em `Sources/PlantaLiDAR/Geometry/CornerTracker.swift`.

## Verificar
Classes: `PipelineTests`, `GeometryTests`, `GeometryV2Tests`, `GridPlannerTests`, `CoordinatorV2Tests`,
`ScanWiringTests`, `SemanticCollectorTests`, `SceneHintsTests`, `RecordingTests`, `AccuracyReportTests`.
```bash
xcodegen generate && xcodebuild test -scheme PlantaLiDAR \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:PlantaLiDARTests/PipelineTests -only-testing:PlantaLiDARTests/GridPlannerTests
```

## Depois de mudar
- Reprocesse as mesmas sessões e compare os planos antes/depois.
- Atualize **Falhas conhecidas**.
- `~/skills-repo/scripts/publish-skill.sh .claude/skills/scan-classic-plan`.
