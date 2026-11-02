#!/usr/bin/env bash
# Importa todas as skills: symlinks para Claude/Gemini, copias reais (rsync) para Codex.
set -e; R="$(cd "$(dirname "$0")" && pwd)"; git -C "$R" pull -q 2>/dev/null || true
for T in ~/.claude/skills ~/.gemini/skills; do mkdir -p "$T"; n=0
  for s in "$R"/skills/*/; do s=${s%/}; d="$T/$(basename "$s")"
    if [ -e "$d" ] && [ ! -L "$d" ]; then continue; fi; ln -sfn "$s" "$d"; n=$((n+1)); done
  echo "$T: $n linked"; done
C=~/.codex/skills; mkdir -p "$C"; n=0
for s in "$R"/skills/*/; do s=${s%/}; d="$C/$(basename "$s")"; [ -L "$d" ] && rm "$d"
  rsync -a "$s/" "$d/"; n=$((n+1)); done; echo "$C: $n copied"
