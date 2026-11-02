---
name: deltadb-omniscient
description: Use when resuming work, needing context from previous agent sessions (Claude, Codex, Gemini, Grok), asking "why was this code written", or handing work off to another AI. Queries the local DeltaDB store via the deltadb MCP tools or CLI.
---
# DeltaDB Omniscient Context
- Search past work: MCP `deltadb_search` or `deltadb search "<termo>"`.
- Why a file changed: `deltadb_blame` / `deltadb blame <arquivo>`.
- Resume a thread: `deltadb show <thread-id>`; pending interventions are in the capsule.
- Hand off: `deltadb handoff <thread-id> --to claude|codex|gemini|grok [--terminal]`.
- Record important steps: `deltadb_record_delta`.
- Refresh index: `deltadb sync`. Studio: http://127.0.0.1:4777
