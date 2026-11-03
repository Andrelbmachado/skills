#!/usr/bin/env bash
# Usage: log-metrics.sh project step agent model in_tok out_tok cost_usd start_iso end_iso
# Appends to ~/metrics/metrics.csv (date,project,task/step,agent,model,input_tokens,output_tokens,total_tokens,cost_usd_if_reported,start,end,duration_s)
set -euo pipefail
F="${METRICS_CSV:-$HOME/metrics/metrics.csv}"; mkdir -p "$(dirname "$F")"
[ -s "$F" ] || echo "date,project,task/step,agent,model,input_tokens,output_tokens,total_tokens,cost_usd_if_reported,start,end,duration_s" > "$F"
p=$1 s=$2 a=$3 m=$4 i=${5:-0} o=${6:-0} c=${7:-} st=$8 en=$9
ts(){ date -j -f "%Y-%m-%dT%H:%M:%S" "${1%%[.Z+]*}" +%s 2>/dev/null || date -d "$1" +%s; }
d=$(( $(ts "$en") - $(ts "$st") ))
q(){ printf '"%s"' "${1//\"/\"\"}"; }
echo "$(date +%F),$(q "$p"),$(q "$s"),$a,$m,$i,$o,$((i+o)),$c,$st,$en,$d" >> "$F"
