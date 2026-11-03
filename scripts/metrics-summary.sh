#!/usr/bin/env bash
# Usage: metrics-summary.sh [project]  -> per-step rows + totals per project
F="${METRICS_CSV:-$HOME/metrics/metrics.csv}"
python3 - "$F" "${1:-}" <<'PY'
import csv,sys,collections
rows=[r for r in csv.DictReader(open(sys.argv[1])) if not sys.argv[2] or r['project']==sys.argv[2]]
T=collections.defaultdict(lambda:[0,0.0,0])
print(f"{'project':28} {'step':28} {'agent':7} {'tokens':>11} {'cost':>7} {'min':>6}")
for r in rows:
  t=int(r['total_tokens'] or 0); c=float(r['cost_usd_if_reported'] or 0); d=int(r['duration_s'] or 0)
  print(f"{r['project'][:28]:28} {r['task/step'][:28]:28} {r['agent'][:7]:7} {t:>11,} {c:>7.2f} {d/60:>6.1f}")
  x=T[r['project']]; x[0]+=t; x[1]+=c; x[2]+=d
for p,(t,c,d) in T.items(): print(f"TOTAL {p}: {t:,} tokens, US$ {c:.2f}, {d/60:.1f} min (soma das etapas)")
PY
