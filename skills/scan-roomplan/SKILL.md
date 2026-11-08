---
name: scan-roomplan
description: Melhorar, ajustar ou depurar o scan RoomPlan (arquitetura) do app Planta — paredes, portas, janelas, escadas e cantos travados por toque. Use para "melhorar o scan RoomPlan", "parede sumiu", "parede curta virou pilar", "casa inteira virou um cômodo", "wall loss", "RoomPlan dropped walls", ou ao abrir roomplan_raw.json, scan.json, floor_grid.json, WallMemory.swift, RoomScanController.swift, ProDrawing.swift.
---

# Scan RoomPlan (arquitetura)

`ScanKind.roomPlan` — "Paredes, portas, janelas e escadas com medida exata. Toque nos cantos para travar."
Abre por `HomeView.open(.roomPlan)` → `RoomScanRequest(advanced: false)`.

## Arquivos
- `Sources/PlantaLiDAR/RoomScan/RoomScanController.swift` — sessão RoomPlan, salva `roomplan_raw.json`, `floor_grid.json`, world map.
- `Sources/PlantaLiDAR/RoomScan/RoomScanView.swift` — UI ao vivo.
- `Sources/PlantaLiDAR/RoomScan/RoomPlanBuilder.swift` — `CapturedRoom` → `FloorPlan` (paredes, aberturas, escadas).
- `Sources/PlantaLiDAR/RoomScan/WallMemory.swift` — memória das paredes que o RoomPlan mostrou e depois soltou.
- `Sources/PlantaLiDAR/RoomScan/LiveWall.swift`, `Sources/PlantaLiDAR/RoomScan/LiveFloor.swift` — desenho ao vivo, pisos rebaixados.
- `Sources/PlantaLiDAR/RoomScan/HouseData.swift` — espessura nas ombreiras, dados da casa.
- `Sources/PlantaLiDAR/RoomScan/RoomFrameRecorder.swift` — `recording/frames.jsonl` + JPEGs 1440×1080.
- `Sources/PlantaLiDAR/UI/ProDrawing.swift` — desenho técnico, `detectingPillars`.
- `Sources/PlantaLiDAR/Model/ScanStore.swift`, `Sources/PlantaLiDAR/Model/FloorPlan.swift` — `scan.json` (`plan.walls`, `pillars`, `openings`).
- Dados: `~/PlantaRender/Scans/<uuid>/{scan.json,roomplan_raw.json,floor_grid.json,recording/events.jsonl}`.

## Invariantes
- `roomplan_raw.json` é o `CapturedRoom` cru (walls/doors/windows/openings/objects/floors/sections, `transform` 16 floats column-major). Nunca reescrever.
- `scan.json` → `plan.walls` em XZ (metros, `start`/`end` com `x`,`z`); y para cima.
- Toda parede que o RoomPlan mostrou pelo menos uma vez continua no resultado (WallMemory), a menos que o modelo final a substitua.
- Cantos travados por toque ganham da estimativa automática.

## Como medir
```bash
python3 -I scripts/scan_report.py ~/PlantaRender/Scans/<uuid>
```
- `walls raw → plan`: `wall_loss > 0` = paredes perdidas entre RoomPlan e plano; `wall_split > 0` = paredes partidas.
- `pillars` > 0 com `wall_loss` > 0: suspeite da heurística de pilar.
- `sections` com um só rótulo numa casa inteira = tudo virou um cômodo.
- `events`: `finalModel` (`ok`, `walls`, `seconds`), `roomplanEnded` (`error`), `walls`, `jambFail`.
- Ferramentas antigas: `scripts/analyze_session.py`, `scripts/compare_plans.py`, `scripts/pull_session.sh`.

## Falhas conhecidas
- **RoomPlan solta paredes durante as atualizações ao vivo**: o modelo ao vivo "repensa" a sala e paredes já vistas somem. Corrigido em 2026-11-06 (commit 6ab2451) com `WallMemory` + uso do modelo final e tela de carregamento até escanear de verdade.
- **Heurística de pilar come paredes curtas**: `ProDrawing.detectingPillars(maxWidth: 0.7, maxStub: 0.5, gap: 0.3)` vira pilar qualquer parede ≤ 70 cm com as duas pontas livres e toco ≤ 50 cm encostado em outra parede. Paredes curtas reais (mureta, ombreira, nicho) somem do plano.
- **Casa inteira escaneada como um cômodo**: um só `sections` e um polígono de piso enorme; portas internas viram aberturas soltas.
- Ombreira sem pontos suficientes → evento `jambFail` e espessura padrão.

## Alavancas
- Limiares do pilar (`maxWidth`, `maxStub`, `gap`) em `Sources/PlantaLiDAR/UI/ProDrawing.swift`; exigir altura total ou evidência de seção quadrada antes de virar pilar.
- Critério de esquecimento e casamento de paredes em `Sources/PlantaLiDAR/RoomScan/WallMemory.swift`.
- Esquadro / regularização em `Sources/PlantaLiDAR/RoomScan/RoomPlanBuilder.swift`.
- Divisão por cômodo: usar `sections` e portas para separar a casa (`Sources/PlantaLiDAR/RoomScan/HouseData.swift`).

## Verificar
Classes: `WallMemoryTests`, `ScanStartupTests`, `HallPillarTests`, `ProDrawingTests`, `RoomPlanModeTests`,
`RoomPlanV2Tests`, `RoomPlanV3Tests`, `SquaringTests`, `HouseDataTests`, `JambClusterTests`, `WallRulesTests`.
```bash
xcodegen generate && xcodebuild test -scheme PlantaLiDAR \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:PlantaLiDARTests/WallMemoryTests -only-testing:PlantaLiDARTests/HallPillarTests
```
Gate: `wall_loss == 0` nos scans reais usados como fixture, sem aumentar `wall_split`.

## Depois de mudar
- Rode o relatório de novo nos mesmos scans; anote antes/depois na mensagem do commit.
- Atualize **Falhas conhecidas** acima com o que foi provado.
- `~/skills-repo/scripts/publish-skill.sh .claude/skills/scan-roomplan`.
