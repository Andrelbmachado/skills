#!/usr/bin/env bash
# Usage: publish-skill.sh <skill-dir | path/to/SKILL.md>
# Copies skill into repo skills/<slug>/, commits, pushes, then runs sync.sh.
set -euo pipefail
[ $# -eq 1 ] || { echo "usage: $0 <skill-dir-or-SKILL.md>" >&2; exit 2; }
R="$(cd "$(dirname "$0")/.." && pwd)"
in="$1"
if [ -f "$in" ]; then dir="$(cd "$(dirname "$in")" && pwd)"; else dir="$(cd "$in" && pwd)"; fi
slug="$(basename "$dir")"
# normalize skill.md -> SKILL.md (two-step for case-insensitive FS)
if [ -f "$dir/skill.md" ] && [ ! -f "$dir/SKILL.md" ]; then mv "$dir/skill.md" "$dir/SKILL.md"; fi
f="$dir/SKILL.md"; [ -f "$f" ] || { echo "no SKILL.md in $dir" >&2; exit 1; }
[ "$(head -1 "$f")" = "---" ] || { echo "SKILL.md missing frontmatter" >&2; exit 1; }
fm="$(awk 'NR==1{next} /^---[[:space:]]*$/{exit} {print}' "$f")"
grep -Eq '^description:[[:space:]]*[^[:space:]]' <<<"$fm" || { echo "frontmatter missing description" >&2; exit 1; }
if ! grep -Eq '^name:[[:space:]]*[^[:space:]]' <<<"$fm"; then
  sed -i.bak "1a\\
name: $slug
" "$f" && rm -f "$f.bak"
elif ! grep -Eq "^name:[[:space:]]*['\"]?$slug['\"]?[[:space:]]*$" <<<"$fm"; then
  sed -i.bak -E "1,/^---[[:space:]]*\$/{s/^name:.*/name: $slug/;}" "$f" && rm -f "$f.bak"
fi
dest="$R/skills/$slug"; mkdir -p "$dest"
if [ "$dir" != "$dest" ]; then rsync -a --exclude .git --exclude .DS_Store "$dir/" "$dest/"; fi
cd "$R"
git add "skills/$slug"
if ! git diff --cached --quiet -- "skills/$slug"; then
  if git ls-tree -r HEAD --name-only | grep -q "^skills/$slug/"; then verb=update; else verb=add; fi
  git commit -q -m "skill: $verb $slug" -- "skills/$slug"
fi
git pull -q --rebase
git push -q
"$R/sync.sh"
echo "published $slug"
