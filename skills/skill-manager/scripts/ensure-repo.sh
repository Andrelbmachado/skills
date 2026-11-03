#!/usr/bin/env bash
# Ensure the shared skills repo exists, is current, and is synced to all AIs.
set -euo pipefail
R=~/skills-repo; SLUG=Andrelbmachado/skills
if ! gh repo view "$SLUG" >/dev/null 2>&1; then gh repo create "$SLUG" --private --description "Shared AI skills"; fi
[ -d "$R/.git" ] || gh repo clone "$SLUG" "$R"
git -C "$R" pull -q --rebase || true
"$R/sync.sh"
echo "Grok: copies live at /home/box/agent-data/workflows/<slug>/SKILL.md (Grok syncs itself)."
