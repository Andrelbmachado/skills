#!/usr/bin/env bash
# Usage: inspect-skill.sh <skill-dir>  -> prints risk flags; exit 1 if any HIGH flag.
d="${1:?skill dir}"; bad=0
[ -f "$d/SKILL.md" ] || { echo "HIGH no SKILL.md"; exit 1; }
ls "$d" | grep -qiE '^licen[sc]e' || echo "WARN no LICENSE file (check upstream license)"
hit(){ if grep -rInE "$2" "$d" 2>/dev/null | grep -vE '/(LICENSE|SOURCE)' | head -5 | grep .; then echo "^^ $1"; [ "$3" = HIGH ] && bad=1; fi; }
hit "HIGH remote code piped to shell" 'curl[^|]*\|\s*(ba)?sh|wget[^|]*\|\s*(ba)?sh|base64 -d|eval "\$\(' HIGH
hit "HIGH paid/secret API keys required" '(OPENAI|ANTHROPIC|ELEVENLABS|STRIPE)_API_KEY' HIGH
hit "WARN runtime installs / process spawn" 'npm (i|install)|pip install|child_process|os\.system|subprocess' WARN
hit "WARN CDN script tags" '<script[^>]+src=.https?://' WARN
[ $bad = 0 ] && echo "OK: no HIGH flags (still read every file)" || { echo "SKIP candidate"; exit 1; }
