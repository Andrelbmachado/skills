#!/usr/bin/env bash
# Importa todas as skills deste repo para Claude Code, Codex e Gemini CLI (symlinks).
set -e; R="$(cd "$(dirname "$0")" && pwd)"; git -C "$R" pull -q 2>/dev/null || true
for T in ~/.claude/skills ~/.codex/skills ~/.gemini/skills; do mkdir -p "$T"; n=0
  for s in "$R"/skills/*/; do s=${s%/}; d="$T/$(basename "$s")"
    if [ -e "$d" ] && [ ! -L "$d" ]; then continue; fi; ln -sfn "$s" "$d"; n=$((n+1)); done
  echo "$T: $n linked (existing real folders kept)"; done
