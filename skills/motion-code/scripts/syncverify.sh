#!/bin/zsh
# uso (na pasta do projeto): ~/.claude/skills/motion-code/scripts/syncverify.sh final.mp4
# MP4 -> wav 16k -> whisper (SYNC_MODEL=base padrão, ~1 min; medium estoura 10 min) (com ffmpeg-static no PATH, pois o do Homebrew pode quebrar) -> tools/syncverify.mjs
set -e
MP4="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"   # caminho absoluto: funciona de qualquer pasta
[ -f tools/syncverify.mjs ] || { [ -f projeto/tools/syncverify.mjs ] && cd projeto; }   # aceita rodar da pasta do post
SK="$(cd "$(dirname "$0")" && pwd)"; FF="$SK/node_modules/ffmpeg-static/ffmpeg"
D=$(mktemp -d); mkdir "$D/bin"; ln -s "$FF" "$D/bin/ffmpeg"
"$FF" -y -loglevel error -i "$MP4" -vn -ac 1 -ar 16000 "$D/f.wav"
PATH="$D/bin:$PATH" timeout ${SYNC_TIMEOUT:-150} whisper "$D/f.wav" --model ${SYNC_MODEL:-base} --language pt --word_timestamps True --output_format json --output_dir "$D" >/dev/null 2>&1
[ -f "$D/f.json" ] || { echo "whisper falhou/timeout (ffmpeg no PATH? tente SYNC_TIMEOUT=400)"; exit 1; }
node tools/syncverify.mjs "$D/f.json"
"$FF" -i "$D/f.wav" -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
rm -rf "$D"
