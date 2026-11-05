---
name: ml-cache
description: Use when a question, computation or generation is repeated or very similar to earlier work (same script, same boilerplate, same explanation) and tokens should be saved. Stores question→answer pairs with embeddings, looks them up before recomputing, and exports a 3D embedding graph. Also use to design reproducible ML/embedding pipelines and to review cache hit metrics.
---
# ml-cache

## When
- Before doing work you have likely done before (recurring report, same refactor pattern, same boilerplate, FAQ-type answer): **query first**.
- After producing a reusable result: **add** it.
- Never cache secrets, personal data, or answers that depend on changing state (dates, prices, repo contents).

## Commands (`scripts/mlcache.py`, stdlib only)
```bash
python3 scripts/mlcache.py query "how to X" --min 0.75   # exit 0 = hit (prints JSON answers), 1 = miss
python3 scripts/mlcache.py add "how to X" "answer…" --tag topic
python3 scripts/mlcache.py stats                          # entries, hit rate, est. tokens saved
python3 scripts/mlcache.py graph out.html                 # 3D graph of all embeddings (three.js)
```
Store: `~/.cache/ml-cache/store.jsonl`. On a hit, **verify the answer still fits** (cheap check), then reuse; on a near-miss (score 0.6–0.75) use it as a draft.

## Embeddings
Default = hashed word + char-trigram vectors (256-d, no dependencies, deterministic = reproducible). For better recall swap `embed()` for a real model (e.g. sentence-transformers `all-MiniLM-L6-v2`, or an embeddings API) and re-embed the store; keep the same JSONL schema. 3D layout is a fixed random projection (seed 7), so graphs are reproducible.

## Reproducible-ML checklist (when building a model/pipeline for a repetitive task)
Fix seeds; version data + code + config; record metrics in `~/metrics/metrics.csv`; split train/val before any feature work; baseline first (rules/TF-IDF) and only add a model if it beats the baseline on the metric; log tokens saved vs. cost of building.

## Metrics
`stats` hit rate × avg answer tokens = tokens saved. If hit rate < 10% after ~50 queries, the task is not repetitive enough: stop caching it.

## Lessons learned
(none yet — add cue / lesson / evidence / confidence)
