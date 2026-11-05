#!/usr/bin/env bash
# Usage: ensure-skill.sh <slug> [<slug>...]
# Auto-download: guarantees each skill is installed for Claude/Codex/Gemini.
# 1) already installed -> ok. 2) in shared repo -> pull + sync. 3) absent -> exit 2 (manager must run skill-manager discovery).
set -u
R="$HOME/skills-repo"; rc=0
for slug in "$@"; do
  if [ -f "$HOME/.claude/skills/$slug/SKILL.md" ]; then echo "ok        $slug"; continue; fi
  git -C "$R" pull -q --rebase 2>/dev/null || true
  if [ -f "$R/skills/$slug/SKILL.md" ]; then
    "$R/sync.sh" >/dev/null 2>&1; echo "installed $slug (from repo)"
  else
    echo "MISSING   $slug -> invoke skill-manager to find/vet/install it"; rc=2
  fi
done
exit $rc
