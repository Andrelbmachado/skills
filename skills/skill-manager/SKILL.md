---
name: skill-manager
description: Discovers, vets and installs new free skills for every AI (Claude Code, Codex, Gemini CLI, Grok) based on what the user actually asks about. Syncs the shared skills repo, has each AI research its own history separately, merges and dedupes the findings, searches free skill sources, inspects each candidate, installs and publishes the safe ones, and writes a report. Use when asked to "manage skills", "find new skills", "update skills for all AIs", or on a periodic skills review.
---

# skill-manager

Shared repo: `~/skills-repo` (github.com/Andrelbmachado/skills, private). Works with `skills-synchronizer` (publish + sync rules).

## Security rules (non-negotiable)
- Inspect EVERY file of a candidate before install (`scripts/inspect-skill.sh <dir>` flags risks; still read SKILL.md and scripts).
- SKIP anything that fetches or executes remote code (curl|sh, runtime npm/pip install, CDN scripts loaded by shipped templates, spawning unknown binaries), needs paid API keys/subscriptions, or has an unclear/non-commercial license.
- Never commit secrets (.env, tokens, keys). Keep each skill's LICENSE and add `SOURCE.md` (upstream URL + license).
- Clone sources to `/tmp` or `~/sm-run/src`, never into `~/Documents`.
- Install only free, reputable (official orgs / well-known MIT or Apache repos), non-duplicate skills. Cap ~40 per run; prefer quality.

## Steps
1. **Ensure repo + sync all AIs** — `scripts/ensure-repo.sh`: `gh repo view Andrelbmachado/skills` (create private with `gh repo create` if missing), clone/pull, run `sync.sh`. Claude (`~/.claude/skills`) and Gemini (`~/.gemini/skills`) get symlinks; Codex (`~/.codex/skills`) gets REAL copies, never symlinks. Grok keeps its copies at `/home/box/agent-data/workflows/<slug>/SKILL.md` (Grok does that itself — tell it to pull and copy).
2. **Separate per-AI research (run in parallel).** Each AI analyzes ONLY its own history and searches skill sources itself, writing a findings file:
   - Claude Code: only `~/.claude/projects` -> `~/sm-run/findings-claude.md`
   - Codex: only `~/.codex` (history.jsonl, sessions) -> `~/sm-run/findings-codex.md`
   - Gemini: only `~/.gemini` -> `~/sm-run/findings-gemini.md`
   - Grok: topics come from Grok itself -> `~/sm-run/findings-grok.md`
   Also use `gh repo list Andrelbmachado` and DeltaDB (`deltadb` CLI / `~/.deltadb`) for project evidence. `scripts/history-report.py claude|codex|gemini` gives keyword counts. Format: topics with evidence counts, then table `name | source URL | topic | free? | why`. End each file with a line `DONE`.
3. **Wait** for all findings files to end with `DONE` (poll every 2 min, up to 40 min). If one never arrives (e.g. auth failure), proceed and note it in the report.
4. **Merge + rank + dedupe** into one ranked topic list and candidate list; drop anything already in `skills/` (compare slugs and descriptions).
5. **Search free sources**: anthropics/skills, openai/skills (.curated), obra/superpowers, google-labs-code/stitch-skills, vercel-labs/agent-skills, skills.sh / find-skills, awesome-*-skills lists (VoltAgent, ComposioHQ), Gemini extensions. Shallow-clone (`git clone --depth 1`) into `~/sm-run/src`.
6. **Inspect** each candidate (rules above). Record skips with reasons.
7. **Install + publish**: `scripts/install-skill.sh <skill-dir> <upstream-url> <license>` (adds SOURCE.md, runs `~/skills-repo/scripts/publish-skill.sh`). Then `~/skills-repo/sync.sh` and verify with `ls` in all CLI skill dirs.
8. **Report**: write `reports/skill-manager-<date>.md` (topics, installed table slug | source | topic, skipped table name | reason, commit hash) and commit it.
