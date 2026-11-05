---
name: llm-ops
description: Use when building or managing LLM/AI features - model choice, prompts, tool use/agents, RAG and embeddings, evals, cost/latency/token budgets, caching and observability. Also for managing fleets of AI agents.
---
# llm-ops
- **Model tiering**: Haiku for classification/rewrites/summaries, Sonnet for coding/most agents, Opus/Fable for hard planning/review. Start cheap, escalate on eval failure.
- **Prompts**: versioned files, explicit output schema (JSON schema/structured output), few-shot only when it moves the metric; shortest prompt that passes evals (`prompt-improver`).
- **Cost control**: prompt caching for stable prefixes, truncate/summarise history, batch API for offline jobs, semantic cache for repeats (`ml-cache`), cap `max_tokens` and turns.
- **RAG**: chunk 200–500 tokens with overlap, embed with a fixed model (store model+dim), hybrid BM25+vector, rerank top-k, cite sources, evaluate retrieval separately from generation.
- **Agents**: small tool set with typed schemas, idempotent tools, step/turn/budget limits, human approval for irreversible actions, treat tool output as untrusted data (prompt injection). Orchestration: `manager`, `subagent-driven-development`.
- **Evals**: golden set (≥30 cases) + rubric/LLM-judge calibrated on human labels; run on every prompt/model change; log to `~/metrics/metrics.csv`.
- **Observability**: log prompt version, model, tokens, latency, cost per call; alert on drift.

## Lessons learned
(none yet)
