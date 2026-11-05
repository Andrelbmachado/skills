#!/usr/bin/env python3
"""Compare prompt-improver ON vs CONTROL. Usage: pi-summary.py
Layer 1: prompt-level (chars/tokens before vs after, Haiku cost, latency).
Layer 2: session-level (real tokens + turns per session from ~/.claude/projects jsonl), ON vs control.
Verdict needs >= 10 sessions per group; otherwise says 'insufficient data'."""
import csv, glob, json, os, statistics as st, collections

H = os.path.expanduser("~")
rows = list(csv.DictReader(open(f"{H}/metrics/prompt-improver.csv"))) if os.path.exists(f"{H}/metrics/prompt-improver.csv") else []
if not rows:
    raise SystemExit("no data yet")
ok = [r for r in rows if r["status"] == "ok"]
print(f"prompts logged: {len(rows)} | improved ok: {len(ok)} | rejected: {sum(r['status']=='rejected' for r in rows)} "
      f"| errors: {sum(r['status'].startswith('error') for r in rows)} | control: {sum(r['status']=='control' for r in rows)}")
if ok:
    o = sum(int(r["orig_tok_est"]) for r in ok); i = sum(int(r["improved_tok_est"]) for r in ok)
    cost = sum(float(r["haiku_cost_usd"] or 0) for r in ok)
    lat = [float(r["latency_s"]) for r in ok]
    print(f"prompt tokens est: {o} -> {i} ({(i-o)/o*100:+.1f}%) | Haiku cost ${cost:.4f} | latency avg {st.mean(lat):.1f}s p95 {sorted(lat)[int(len(lat)*.95)-1]:.1f}s")
    print("NOTE: original prompt still enters context; improved text is ADDED. Net input effect = +improved tokens; "
          "real savings must show up in layer 2 (fewer turns / less rework).")

def session_stats(sid):
    for f in glob.glob(f"{H}/.claude/projects/*/{sid}.jsonl"):
        tin = tout = turns = 0
        for line in open(f, errors="ignore"):
            try:
                d = json.loads(line)
            except Exception:
                continue
            m = d.get("message") or {}
            if d.get("type") == "assistant" and isinstance(m, dict) and m.get("usage"):
                u = m["usage"]; turns += 1
                tin += u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
                tout += u.get("output_tokens", 0)
        return tin, tout, turns
    return None

groups = collections.defaultdict(dict)
for r in rows:
    if r["group"] in ("on", "control") and r["status"] in ("ok", "control"):
        groups[r["group"]][r["session"]] = 1
res = {}
for g, sess in groups.items():
    vals = [s for s in (session_stats(x) for x in sess) if s and s[2] > 0]
    res[g] = vals
for g, vals in res.items():
    if vals:
        print(f"[{g}] sessions={len(vals)} avg fresh-in={st.mean(v[0] for v in vals):.0f} out={st.mean(v[1] for v in vals):.0f} turns={st.mean(v[2] for v in vals):.1f}")
if all(len(res.get(g, [])) >= 10 for g in ("on", "control")):
    a = st.mean(v[0] + v[1] for v in res["on"]); b = st.mean(v[0] + v[1] for v in res["control"])
    print(f"VERDICT: tokens/session ON {a:.0f} vs control {b:.0f} ({(a-b)/b*100:+.1f}%) -> {'KEEP' if a < b else 'DIAGNOSE (see SKILL.md)'}")
else:
    print("VERDICT: insufficient data (need >=10 sessions in each group; set mode=ab in ~/metrics/pi-config.json)")
