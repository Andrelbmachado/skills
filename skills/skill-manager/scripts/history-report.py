#!/usr/bin/env python3
"""Usage: history-report.py claude|codex|gemini  -> keyword topic counts from that AI's OWN user prompts."""
import sys,os,glob,json,re,collections
KW={'UX/UI design':r'\b(ux|ui|design|figma|layout|tipografia)\b','websites':r'\b(site|website|html|css|landing)\b','game dev':r'\b(three\.?js|jogo|game|sprite)\b','animation/motion':r'\b(anima|motion|gsap|framer|remotion)\b','apps iOS/macOS':r'\b(swift|swiftui|xcode|ios|macos)\b','video':r'\b(ffmpeg|v[ií]deo|render)\b','3D':r'\b(blender|3d|mesh)\b','art/art history':r'\b(arte|art history|barroco|bauhaus|cores?)\b','agents/automation':r'\b(workflow|agente|agent|mcp|skill)\b','devops/IT':r'\b(docker|ssh|servidor|deploy|linux)\b','project mgmt':r'\b(plano|roadmap|sprint|tarefa|planejamento)\b','data':r'\b(planilha|xlsx|csv|dashboard)\b'}
def texts(ai):
    h=os.path.expanduser('~')
    if ai=='claude':
        for f in glob.glob(h+'/.claude/projects/*/*.jsonl'):
            for l in open(f,errors='ignore'):
                if '"type":"user"' not in l[:200]: continue
                try: c=json.loads(l).get('message',{}).get('content')
                except Exception: continue
                if isinstance(c,list): c=' '.join(x.get('text','') for x in c if isinstance(x,dict))
                if isinstance(c,str) and not c.startswith('<'): yield c
    elif ai=='codex':
        f=h+'/.codex/history.jsonl'
        if os.path.exists(f):
            for l in open(f,errors='ignore'):
                try: yield json.loads(l).get('text','')
                except Exception: pass
    elif ai=='gemini':
        for f in glob.glob(h+'/.gemini/tmp/*/logs.json'):
            try:
                for m in json.load(open(f)):
                    if m.get('type')=='user': yield m.get('message','')
            except Exception: pass
c=collections.Counter(); n=0
for t in texts(sys.argv[1]):
    n+=1; t=t.lower()
    for k,r in KW.items():
        if re.search(r,t): c[k]+=1
print(n,'prompts'); [print(f'{k}: {v}') for k,v in c.most_common()]
