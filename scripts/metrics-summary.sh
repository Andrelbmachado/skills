#!/usr/bin/env bash
# Usage: metrics-summary.sh [project]  -> per-step rows + totals per project
# Plano (Claude/Codex por assinatura: cota semanal + janela de 5 h) = gasto em TOKENS.
# Dinheiro (US$) só conta em linhas de API paga: agent terminando em "-api".
F="${METRICS_CSV:-$HOME/metrics/metrics.csv}"
python3 - "$F" "${1:-}" <<'PY'
import csv,sys,collections
rows=[r for r in csv.DictReader(open(sys.argv[1])) if not sys.argv[2] or r['project']==sys.argv[2]]
T=collections.defaultdict(lambda:[0,0,0.0,0])
print(f"{'project':24} {'step':28} {'agent':10} {'tok plano':>13} {'tok API':>11} {'API US$':>8} {'min':>6}")
for r in rows:
  t=int(r['total_tokens'] or 0); d=int(r['duration_s'] or 0)
  api=r['agent'].endswith('-api'); c=float(r['cost_usd_if_reported'] or 0) if api else 0.0
  tp,ta=(0,t) if api else (t,0)
  print(f"{r['project'][:24]:24} {r['task/step'][:28]:28} {r['agent'][:10]:10} {tp:>13,} {ta:>11,} {c:>8.2f} {d/60:>6.1f}")
  x=T[r['project']]; x[0]+=tp; x[1]+=ta; x[2]+=c; x[3]+=d
for p,(tp,ta,c,d) in T.items(): print(f"TOTAL {p}: plano {tp:,} tokens · API {ta:,} tokens (US$ {c:.2f}) · {d/60:.1f} min (soma das etapas)")
PY
