---
name: planta-scan-improve
description: Hub para melhorar, ajustar ou depurar qualquer scan do app Planta (iOS LiDAR). Use quando pedirem "melhorar o scan", "o scan saiu errado", "parede sumiu", "medida errada", "móvel torto", "modelo 3D feio", "improve the scan", "scan quality", ou citarem ~/PlantaRender/Scans, ~/PlantaRender/Models, scan.json, roomplan_raw.json, model.json, events.jsonl, scan_report.py. Roteia pelo sintoma para a skill do tipo de scan (scan-roomplan, scan-roomplan-advanced, scan-mobile, scan-lidar, scan-lidar-advanced, scan-point-cloud, scan-photos, scan-truedepth, scan-classic-plan).
---

# Planta: melhorar scans (hub)

Os 9 tipos vêm de `enum ScanKind` em `Sources/PlantaLiDAR/RoomScan/RoomPlanBuilder.swift`.
O ciclo é sempre: **relatório → hipótese → mudança → teste → novo relatório**
(detalhes em `docs/claude-code-scan-improvement.md`).

## Arquivos
- Tipos e títulos: `Sources/PlantaLiDAR/RoomScan/RoomPlanBuilder.swift` (`ScanKind`).
- Entrada de cada tipo: `Sources/PlantaLiDAR/UI/HomeView.swift` (`open(_:)`).
- Relatório: `scripts/scan_report.py` (+ `scripts/test_scan_report.py`, fixtures em `scripts/fixtures/`).
- Dados reais (somente leitura): `~/PlantaRender/Scans/<uuid>/` e `~/PlantaRender/Models/<uuid>/`.

## Roteamento por sintoma
| Sintoma | Skill |
|---|---|
| parede sumiu, parede a mais, pilar falso, casa inteira virou um cômodo | `scan-roomplan` |
| textura da parede/piso errada, móvel 3D do RoomPlan feio | `scan-roomplan-advanced` |
| móvel (armário, pia…) com altura errada, painéis fora da caixa, prateleira dupla | `scan-mobile` |
| malha 3D com buracos, cor errada, objeto cortado pelo alcance | `scan-lidar` |
| detalhe fino perdido de perto, poucas fotos | `scan-lidar-advanced` |
| nuvem de pontos com ruído, pontos voando | `scan-point-cloud` |
| Object Capture falhou, modelo de fotos torto ou sem escala | `scan-photos` |
| rosto/objeto pequeno com câmera frontal | `scan-truedepth` |
| planta antiga (LiDAR puro, cantos por toque) | `scan-classic-plan` |

## Invariantes
- Unidades em metros, y para cima. Transformações: 16 floats column-major.
- Móvel (Scan Mobile): sistema destro, y para cima, z da frente (0) para trás, x = y × z (+x à esquerda de quem olha); desenhos espelham x.
- Chaves de API nunca em logs, `events.jsonl`, exports ou testes.
- Nunca editar os dados em `~/PlantaRender`; copiar para fixture antes de mexer.

## Como medir
```bash
python3 -I scripts/scan_report.py ~/PlantaRender/Scans/<uuid>          # resumo
python3 -I scripts/scan_report.py ~/PlantaRender/Models/<uuid> --json   # JSON completo
ls -t ~/PlantaRender/Scans | head -5                                     # mais recentes
```
O relatório traz paredes raw vs plano (`wall_loss`, `wall_split`), cobertura do `floor_grid.json`,
quadros (`recording/frames.jsonl`), erros/avisos do `recording/events.jsonl`, âncoras de malha e,
para móveis, painéis fora da caixa, cantos abaixo de y=0, prateleiras a < 1,5 cm e tamanho vs pontos LiDAR.

## Falhas conhecidas (entre tipos)
- RoomPlan solta paredes nas atualizações ao vivo (`WallMemory`, corrigido em 2026-11-06, commit 6ab2451).
- Heurística de pilar (`ProDrawing.detectingPillars`) come paredes curtas.
- Scan Mobile: altura parou no balcão (1,07 m para um móvel de ~1,85 m), painéis fora da caixa.

## Alavancas (modelos 3D, todos os tipos)
- Encaixe guiado por profundidade: ajustar a saída do Object Capture à profundidade LiDAR (`Sources/PlantaLiDAR/Furniture/FurnitureFit.swift`).
- Dizimação de malha e bake de normais na exportação (`Sources/PlantaLiDAR/Model3D/ModelExporter.swift`).
- Seleção de fotos por nitidez (descartar borradas) em `Sources/PlantaLiDAR/Model3D/ObjectPhotoSet.swift`.
- Tamanho do atlas de textura por `DeviceProfile` (Parte A, Task 1; iPad M1 aguenta atlas maior).
- Portão de regressão: tamanho do modelo vs tamanho medido pelo LiDAR (`size_vs_lidar_points` no relatório) e paredes raw vs plano.

## Verificar
```bash
python3 -I scripts/test_scan_report.py
xcodegen generate && xcodebuild test -scheme PlantaLiDAR \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:PlantaLiDARTests/<Classe>
```
Rode o relatório de novo no mesmo scan e compare com o anterior.

## Depois de mudar
- Atualize **Falhas conhecidas** da skill do tipo com o que foi provado.
- `~/skills-repo/scripts/publish-skill.sh .claude/skills/<skill>` (depois do merge).
- Registre métricas: `~/skills-repo/scripts/log-metrics.sh planta <etapa> ...` (tokens, sem US$).
