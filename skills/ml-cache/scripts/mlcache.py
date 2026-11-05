#!/usr/bin/env python3
"""ml-cache: semantic cache for repeated answers. Stdlib only.
  mlcache.py add   "<question>" "<answer>" [--tag t]   store (embeds question)
  mlcache.py query "<question>" [--min 0.75] [--k 3]   nearest stored answers (exit 0 hit / 1 miss)
  mlcache.py stats                                     entries, hits, est. tokens saved
  mlcache.py graph [out.html]                          3D graph (three.js) of all embeddings
Store: ~/.cache/ml-cache/store.jsonl  (override MLCACHE_DIR). Embedding = hashed word+char-trigram
vector (256-d, L2-normalised), 3D layout = fixed random projection. Swap embed() for a real model
(e.g. sentence-transformers) without changing the rest.
"""
import hashlib, json, math, os, random, re, sys

D = os.environ.get("MLCACHE_DIR", os.path.expanduser("~/.cache/ml-cache"))
STORE, HITS = f"{D}/store.jsonl", f"{D}/hits.json"
DIM = 256


def embed(text):
    t = re.sub(r"\s+", " ", text.lower().strip())
    feats = t.split() + [t[i:i + 3] for i in range(max(0, len(t) - 2))]
    v = [0.0] * DIM
    for f in feats:
        h = int(hashlib.md5(f.encode()).hexdigest(), 16)
        v[h % DIM] += 1 if (h >> 100) & 1 else -1
    n = math.sqrt(sum(x * x for x in v)) or 1
    return [x / n for x in v]


def load():
    if not os.path.exists(STORE):
        return []
    return [json.loads(l) for l in open(STORE) if l.strip()]


def cos(a, b):
    return sum(x * y for x, y in zip(a, b))


def est_tok(s):
    return max(1, round(len(s) / 3.5))


def main(a):
    os.makedirs(D, exist_ok=True)
    if not a:
        return print(__doc__)
    cmd = a[0]
    opt = {a[i]: a[i + 1] for i in range(len(a) - 1) if a[i].startswith("--")}
    pos = [x for i, x in enumerate(a[1:], 1) if not x.startswith("--") and not a[i - 1].startswith("--")]
    if cmd == "add":
        q, ans = pos[0], pos[1]
        open(STORE, "a").write(json.dumps({"q": q, "a": ans, "tag": opt.get("--tag", ""), "v": embed(q)}) + "\n")
        print("stored")
    elif cmd == "query":
        q, k, mn = pos[0], int(opt.get("--k", 3)), float(opt.get("--min", 0.75))
        qv = embed(q)
        scored = sorted(((cos(qv, e["v"]), e) for e in load()), key=lambda x: -x[0])[:k]
        hit = [s for s in scored if s[0] >= mn]
        for s, e in hit:
            print(json.dumps({"score": round(s, 3), "q": e["q"], "a": e["a"], "tag": e["tag"]}, ensure_ascii=False))
        h = json.load(open(HITS)) if os.path.exists(HITS) else {"queries": 0, "hits": 0, "tok_saved": 0}
        h["queries"] += 1
        if hit:
            h["hits"] += 1
            h["tok_saved"] += est_tok(hit[0][1]["a"])
        json.dump(h, open(HITS, "w"))
        sys.exit(0 if hit else 1)
    elif cmd == "stats":
        h = json.load(open(HITS)) if os.path.exists(HITS) else {"queries": 0, "hits": 0, "tok_saved": 0}
        print(json.dumps({"entries": len(load()), **h}))
    elif cmd == "graph":
        out = pos[0] if pos else f"{D}/graph.html"
        rnd = random.Random(7)
        P = [[rnd.gauss(0, 1) for _ in range(DIM)] for _ in range(3)]
        pts = [{"x": cos(p, e["v"]) * 40, "y": cos(P[1], e["v"]) * 40, "z": cos(P[2], e["v"]) * 40,
                "q": e["q"][:80], "tag": e["tag"]} for e in load() for p in [P[0]]]
        html = HTML.replace("__PTS__", json.dumps(pts, ensure_ascii=False))
        open(out, "w").write(html)
        print(out)


HTML = """<!doctype html><meta charset=utf-8><title>ML Cache Graph</title>
<style>body{margin:0;background:#0b0d12;color:#cde;font:13px system-ui}#t{position:fixed;top:8px;left:8px}</style>
<div id=t>ML Cache - drag to rotate, scroll to zoom</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
const P=__PTS__,s=new THREE.Scene(),c=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,1000),
r=new THREE.WebGLRenderer({antialias:true});r.setSize(innerWidth,innerHeight);document.body.appendChild(r.domElement);
const g=new THREE.Group();s.add(g);const col={};const m=(t)=>col[t]||(col[t]=new THREE.Color().setHSL(Object.keys(col).length*.17%1,.7,.6));
P.forEach(p=>{const o=new THREE.Mesh(new THREE.SphereGeometry(.8,12,12),new THREE.MeshBasicMaterial({color:m(p.tag)}));o.position.set(p.x,p.y,p.z);g.add(o)});
for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const d=Math.hypot(P[i].x-P[j].x,P[i].y-P[j].y,P[i].z-P[j].z);
if(d<14){g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(P[i].x,P[i].y,P[i].z),new THREE.Vector3(P[j].x,P[j].y,P[j].z)]),new THREE.LineBasicMaterial({color:0x335577})))}}
c.position.z=90;let dn=0,px=0,py=0;addEventListener('mousedown',e=>{dn=1;px=e.x;py=e.y});addEventListener('mouseup',()=>dn=0);
addEventListener('mousemove',e=>{if(dn){g.rotation.y+=(e.x-px)*.01;g.rotation.x+=(e.y-py)*.01;px=e.x;py=e.y}});
addEventListener('wheel',e=>{c.position.z=Math.max(20,Math.min(300,c.position.z+e.deltaY*.1))});
(function a(){requestAnimationFrame(a);r.render(s,c)})();
</script>"""

if __name__ == "__main__":
    main(sys.argv[1:])
