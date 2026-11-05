---
name: prompt-improver
description: Runs automatically on every user prompt (UserPromptSubmit hook). Haiku at medium effort fixes spelling/grammar, tightens the prompt and injects the improved version as context, with metrics (ON vs control) to prove it saves tokens. Use when asked to tune, audit, disable or measure the prompt improver, or when its metrics look bad.
---
# prompt-improver

## How it works
Hook `scripts/improve.py` (registered in `~/.claude/settings.json` → `UserPromptSubmit`):
1. Skips prompts starting with `/`, `!`, `#`, `raw:` and prompts under `min_chars` (80).
2. Calls `claude -p --model haiku --effort medium` (isolated: no tools/MCP/settings, recursion guard `PROMPT_IMPROVER_ACTIVE=1`).
3. Rejects output that is empty, >130% or <20% of the original length (intent-loss guard).
4. Injects `PROMPT MELHORADO: …` as `additionalContext`. Original prompt wins on conflict.
5. Fails open: any error → the prompt goes through untouched.

**Hard limit:** Claude Code hooks cannot replace the prompt, only add context. So the original still enters context and the improved text is added: per-prompt input goes UP. Savings must come from fewer turns/less rework/shorter replies — that is what the metrics test.

## Config / control
`~/metrics/pi-config.json`: `{"mode":"on|off|ab","min_chars":80,"ab_ratio":0.5,"timeout":25}`
- `ab` = per-session random split (sha1 of session id): `on` vs `control` (control gets no injection, still logged).
- Quick off: `PROMPT_IMPROVER=off`. Prefix a prompt with `raw:` to bypass once.

## Metrics
Log `~/metrics/prompt-improver.csv`; report `python3 scripts/pi-summary.py` (prompt-level tokens, Haiku cost, latency; session-level tokens/turns ON vs control; verdict at ≥10 sessions each).

## If it is not working → diagnose in this order
1. Many `rejected`/`error` rows → loosen guard or raise `timeout`; check `claude -p` still runs headless.
2. Prompt tokens barely shrink → prompts already terse; raise `min_chars`.
3. Haiku cost + latency > saved tokens → raise `min_chars` (e.g. 300) or restrict to long prompts.
4. Control wins on turns → improver dropped intent; inspect `rejected`/shrink >50% rows, tighten `SYSTEM`.
5. Write each proven finding below (cue, lesson, evidence, confidence).

## Lessons learned
- Headless `claude -p` without `--strict-mcp-config --setting-sources ""` hung >90 s (loads hooks/MCP); isolated it takes ~5 s, ≈US$0.0004/prompt. (2026-11-05, high)
