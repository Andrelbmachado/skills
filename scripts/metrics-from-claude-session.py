#!/usr/bin/env python3
"""Usage: metrics-from-claude-session.py <session.jsonl> project step  -> appends row (retroactive)."""
import json,sys,subprocess,os
f,proj,step=sys.argv[1:4]; i=o=0; cost=''; ts=[]; model=''
for l in open(f):
  try: j=json.loads(l)
  except: continue
  if j.get('timestamp'): ts.append(j['timestamp'])
  m=j.get('message') or {}
  if j.get('type')=='assistant' and isinstance(m,dict) and m.get('usage'):
    u=m['usage']; model=m.get('model',model)
    i+=u.get('input_tokens',0)+u.get('cache_read_input_tokens',0)+u.get('cache_creation_input_tokens',0); o+=u.get('output_tokens',0)
# sessão do Claude Code roda no plano (cota semanal / janela de 5 h): gasto é em tokens, sem US$
ts.sort()
subprocess.run([os.path.expanduser('~/skills-repo/scripts/log-metrics.sh'),proj,step,'claude',model or 'sonnet',str(i),str(o),cost,ts[0][:19],ts[-1][:19]],check=True)
