# Point-picking aid for the artwork panel.
#   python3 tools/art-grid.py grid   → motion-capture/art-grid.png  (each painting with a labelled 10×10 grid: read u,v off it)
#   python3 tools/art-grid.py check  → motion-capture/art-check.png (points.json markers + the sampled swatches)
# Pick points by eye (grid cell 4.5,2.0 → u 0.45, v 0.20), then `python3 tools/art-pick.py` writes src/art.js.
# Automatic "most saturated pixel" searches drift onto neighbouring strokes — keep picks manual and check the sheet.
from PIL import Image, ImageDraw
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'assets/art'); OUT = os.path.join(ROOT, 'motion-capture'); os.makedirs(OUT, exist_ok=True)
spec = json.load(open(os.path.join(ART, 'points.json')))
mode = sys.argv[1] if len(sys.argv) > 1 else 'grid'
tiles = []
for key, a in spec.items():
    im = Image.open(os.path.join(ART, a['file'])).convert('RGB'); W, H = im.size
    w = 560; h = round(H * w / W); sm = im.resize((w, h)); d = ImageDraw.Draw(sm)
    if mode == 'grid':
        for i in range(1, 10):
            x, y = w * i / 10, h * i / 10
            d.line((x, 0, x, h), fill='white'); d.line((0, y, w, y), fill='white')
            d.text((x + 2, 2), str(i), fill='white'); d.text((2, y + 2), str(i), fill='white')
    else:
        for i, p in enumerate(a['points']):
            r = int(W * p.get('r', 0.01))
            c = im.crop((int(p['u'] * W) - r, int(p['v'] * H) - r, int(p['u'] * W) + r, int(p['v'] * H) + r)).resize((1, 1), Image.BOX).getpixel((0, 0))
            X, Y = p['u'] * w, p['v'] * h
            d.ellipse((X - 8, Y - 8, X + 8, Y + 8), outline='white', width=3); d.text((X + 10, Y - 5), str(p['hue']), fill='white')
            d.rectangle((4 + i * 44, h - 42, 42 + i * 44, h - 4), fill=c, outline='white')
    d.text((6, 6 if mode != 'grid' else h - 14), key, fill='white')
    tiles.append(sm)
TH = 420
row = [t.resize((round(t.width * TH / t.height), TH)) for t in tiles]
cols = 3; rows = [row[i:i + cols] for i in range(0, len(row), cols)]
sheet = Image.new('RGB', (max(sum(t.width + 8 for t in r) for r in rows), len(rows) * (TH + 8)))
for j, r in enumerate(rows):
    x = 0
    for t in r: sheet.paste(t, (x, j * (TH + 8))); x += t.width + 8
f = os.path.join(OUT, 'art-grid.png' if mode == 'grid' else 'art-check.png'); sheet.save(f); print(f)
