# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright>=1.45", "pillow>=10", "numpy>=1.26"]
# ///
"""Craft Anything for Claude Code: website study (capture) and check (compare build vs original).

  uv run craft_web.py capture <url> <project>/capture [--widths 1440,768,390] [--max-pages 4] [--deep]
  uv run craft_web.py check <project> [--site <dir>] [--round N] [--good 90]

capture: visitor-view evidence (screenshots per width, noise masks, design tokens, layout per width,
         headings, links, forms, visible text, health, opened states, other same-origin pages).
check:   serves the build's static output, captures it the same way into checks/round-N/ and scores
         each width as 50 * (tile layout + luminance SSIM), plus blocking claims and advisory notes.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import json
import re
import shutil
import socketserver
import sys
import threading
import time
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin, urlparse

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
DEFAULT_WIDTHS = [1440, 768, 390]
MAX_H = 12000
TILE, TOL = 16, 24

# ---------------------------------------------------------------- image similarity (shared)

def _load(p):
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)


def tile_layout(a, b, mask=None, tile=TILE, tol=TOL):
    h, w = min(a.shape[0], b.shape[0]), min(a.shape[1], b.shape[1])
    a, b = a[:h, :w], b[:h, :w]
    m = None if mask is None else mask[:h, :w]
    ok = tot = 0
    for y in range(0, h - tile + 1, tile):
        for x in range(0, w - tile + 1, tile):
            if m is not None and m[y:y + tile, x:x + tile].mean() > 127:
                continue
            tot += 1
            d = np.abs(a[y:y + tile, x:x + tile].reshape(-1, 3).mean(0) - b[y:y + tile, x:x + tile].reshape(-1, 3).mean(0))
            ok += int((d <= tol).all())
    return ok / tot if tot else 1.0


def ssim_detail(a, b, mask=None, longest=512, win=8):
    h, w = min(a.shape[0], b.shape[0]), min(a.shape[1], b.shape[1])
    s = min(1.0, longest / max(h, w))
    size = (max(win, int(w * s)), max(win, int(h * s)))

    def lum(x):
        return np.asarray(Image.fromarray(x[:h, :w].astype(np.uint8)).convert("L").resize(size, Image.BILINEAR), dtype=np.float64)

    la, lb = lum(a), lum(b)
    lm = None
    if mask is not None:
        lm = np.asarray(Image.fromarray(mask[:h, :w].astype(np.uint8)).resize(size, Image.NEAREST), dtype=np.float64)
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    vals = []
    for y in range(0, la.shape[0] - win + 1, win):
        for x in range(0, la.shape[1] - win + 1, win):
            if lm is not None and lm[y:y + win, x:x + win].mean() > 127:
                continue
            p, q = la[y:y + win, x:x + win], lb[y:y + win, x:x + win]
            mp, mq = p.mean(), q.mean()
            vp, vq = p.var(), q.var()
            cov = ((p - mp) * (q - mq)).mean()
            vals.append(((2 * mp * mq + c1) * (2 * cov + c2)) / ((mp ** 2 + mq ** 2 + c1) * (vp + vq + c2)))
    return float(np.mean(vals)) if vals else 1.0


def similarity(pa, pb, mask_path=None):
    """Percent alike of two screenshots: 50 * (tile layout + SSIM detail), cropped to common area."""
    a, b = _load(pa), _load(pb)
    mask = None
    if mask_path and Path(mask_path).exists():
        mask = np.asarray(Image.open(mask_path).convert("L"), dtype=np.float32)
    lay, det = tile_layout(a, b, mask), ssim_detail(a, b, mask)
    return round(50 * (lay + max(0.0, det)), 1), round(lay * 100, 1), round(det * 100, 1)


def picture_similarity(pa, pb, size=(640, 360)):
    """App/game screenshot vs reference picture, both resized to 640x360."""
    a = np.asarray(Image.open(pa).convert("RGB").resize(size), dtype=np.float32)
    b = np.asarray(Image.open(pb).convert("RGB").resize(size), dtype=np.float32)
    return round(50 * (tile_layout(a, b) + max(0.0, ssim_detail(a, b))), 1)


def is_blank(p):
    g = np.asarray(Image.open(p).convert("L").resize((64, 36)), dtype=np.float32)
    return float(g.std()) < 2.0


def side_by_side(po, pb, prefix, band=1400, max_bands=8):
    """Original (left) | build (right) in horizontal bands, each scaled to <=1600px wide, readable by Read."""
    a, b = Image.open(po).convert("RGB"), Image.open(pb).convert("RGB")
    h = max(a.height, b.height)
    out = []
    for k, y in enumerate(range(0, h, band)):
        if k >= max_bands:
            break
        pa, pbb = a.crop((0, y, a.width, min(y + band, a.height))) if y < a.height else None, b.crop((0, y, b.width, min(y + band, b.height))) if y < b.height else None
        hh = max(p.height if p else 0 for p in (pa, pbb))
        canvas = Image.new("RGB", (a.width + b.width + 16, hh), (255, 0, 255))
        if pa:
            canvas.paste(pa, (0, 0))
        if pbb:
            canvas.paste(pbb, (a.width + 16, 0))
        if canvas.width > 1600:
            canvas = canvas.resize((1600, max(1, int(hh * 1600 / canvas.width))))
        p = Path(f"{prefix}-{k + 1}.png")
        canvas.save(p)
        out.append(p.name)
    return out


def noise_mask(shots, out):
    arrs = [_load(s) for s in shots]
    h = min(x.shape[0] for x in arrs)
    w = min(x.shape[1] for x in arrs)
    m = np.zeros((h, w), dtype=np.uint8)
    base = arrs[0][:h, :w]
    for o in arrs[1:]:
        o = o[:h, :w]
        for y in range(0, h, TILE):
            for x in range(0, w, TILE):
                d = np.abs(base[y:y + TILE, x:x + TILE].reshape(-1, 3).mean(0) - o[y:y + TILE, x:x + TILE].reshape(-1, 3).mean(0))
                if (d > TOL).any():
                    m[y:y + TILE, x:x + TILE] = 255
    Image.fromarray(m).save(out)
    return int((m > 0).mean() * 100)


# ---------------------------------------------------------------- in-page scripts

REVEAL_JS = """async () => {
  document.querySelectorAll('img[loading=lazy]').forEach(i => i.loading = 'eager');
  const step = Math.max(200, 0.8 * innerHeight), t0 = Date.now();
  for (let y = 0; y < document.documentElement.scrollHeight && Date.now() - t0 < 5000; y += step) {
    scrollTo(0, y); await new Promise(r => setTimeout(r, 120));
  }
  await Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 1500); })));
  scrollTo(0, 0); await new Promise(r => setTimeout(r, 200));
}"""

BLUEPRINT_JS = r"""(deep) => {
  const hex = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s)); if (p.length > 3 && p[3] === 0) return null;
    return '#' + p.slice(0,3).map(v => Math.round(v).toString(16).padStart(2,'0')).join(''); };
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const C = () => new Map(), inc = (m, k) => k && m.set(k, (m.get(k)||0) + 1);
  const bg = C(), fg = C(), fonts = C(), sizes = C(), spacing = C(), radii = C(), widths = C();
  const els = [...document.body.querySelectorAll('*')].slice(0, 6000);
  for (const e of els) { if (!vis(e)) continue; const s = getComputedStyle(e);
    inc(bg, hex(s.backgroundColor));
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
      inc(fg, hex(s.color)); inc(fonts, s.fontFamily.split(',')[0].replace(/["']/g,'').trim()); inc(sizes, s.fontSize); }
    for (const k of ['paddingTop','paddingBottom','paddingLeft','marginTop','marginBottom','gap'])
      { const v = s[k]; if (v && v !== '0px' && v !== 'normal') inc(spacing, v); }
    if (s.borderTopLeftRadius !== '0px') inc(radii, s.borderTopLeftRadius);
    if (s.maxWidth && s.maxWidth !== 'none' && s.maxWidth.endsWith('px')) inc(widths, s.maxWidth);
  }
  const top = (m, n=12) => [...m].sort((a,b) => b[1]-a[1]).slice(0,n).map(([value,count]) => ({value,count}));
  const sy = scrollY;
  const outline = [...document.querySelectorAll('header,nav,main,footer,section,article,aside,form,h1,h2,h3,ul,ol,img,video,button,input,select,textarea')]
    .filter(vis).slice(0, 400).map(e => { const r = e.getBoundingClientRect();
      return {tag: e.tagName.toLowerCase(), role: e.getAttribute('role'), x: Math.round(r.x), y: Math.round(r.y + sy), w: Math.round(r.width), h: Math.round(r.height)}; });
  const headings = [...document.querySelectorAll('h1,h2,h3')].filter(vis).slice(0,120).map(h => ({level: +h.tagName[1], text: h.innerText.trim().slice(0,200)}));
  const links = [...document.querySelectorAll('a[href]')].slice(0,400).map(a => ({text: a.innerText.trim().slice(0,80), href: a.href}));
  const forms = [...document.querySelectorAll('input,select,textarea')].filter(vis).slice(0,80).map(f => ({type: f.type || f.tagName.toLowerCase(), name: f.name, label: (f.labels && f.labels[0] ? f.labels[0].innerText.trim() : f.getAttribute('aria-label')) || null, placeholder: f.placeholder || null}));
  const images = [...document.images].filter(vis).slice(0,120).map(i => ({w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), alt: i.alt || null}));
  const a11y = {lang: document.documentElement.lang || null,
    unnamed_controls: [...document.querySelectorAll('button,a[href],input,select,textarea')].filter(vis).filter(e => !(e.innerText||'').trim() && !e.getAttribute('aria-label') && !e.getAttribute('title') && !(e.labels && e.labels.length)).length,
    images_without_alt: [...document.images].filter(vis).filter(i => !i.hasAttribute('alt')).length,
    landmarks: ['header','nav','main','footer'].filter(t => document.querySelector(t + ',[role=' + ({header:'banner',nav:'navigation',main:'main',footer:'contentinfo'})[t] + ']'))};
  const out = {title: document.title, tokens: {backgrounds: top(bg), text_colors: top(fg), fonts: top(fonts,6), font_sizes: top(sizes), spacing: top(spacing,16), radii: top(radii,8), content_widths: top(widths,8)},
    outline, headings, links, forms, images, a11y, text: document.body.innerText.slice(0, 30000)};
  if (deep) { out.stylesheets = [...document.styleSheets].map(s => s.href).filter(Boolean);
    out.scripts = [...document.scripts].map(s => s.src).filter(Boolean);
    out.breakpoints = [...new Set([...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } })
      .filter(r => r.media).map(r => r.media.mediaText))].slice(0, 40); }
  return out;
}"""

LAYOUT_JS = r"""() => {
  const hex = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s)); if (p.length > 3 && p[3] === 0) return null;
    return '#' + p.slice(0,3).map(v => Math.round(v).toString(16).padStart(2,'0')).join(''); };
  const px = v => Math.round(parseFloat(v) || 0);
  const size = sel => { const e = document.querySelector(sel); return e ? px(getComputedStyle(e).fontSize) : null; };
  const sy = scrollY, blocks = [];
  for (const e of document.querySelectorAll('header,nav,main,footer,section,article,aside')) {
    const r = e.getBoundingClientRect(); if (r.height < 24 || r.width <= 0) continue; const s = getComputedStyle(e);
    const kids = [...e.querySelectorAll(':scope > *, :scope > * > *')].filter(k => { const kr = k.getBoundingClientRect(); return kr.width >= Math.max(40, 0.15 * r.width) && kr.height > 0; });
    const rows = new Map(); for (const k of kids) { const t = Math.round(k.getBoundingClientRect().top / 2); rows.set(t, (rows.get(t)||0) + 1); }
    const h = e.querySelector('h1,h2,h3');
    let col = null; for (const k of e.querySelectorAll(':scope > *, :scope > * > *')) { const ks = getComputedStyle(k);
      if (ks.maxWidth && ks.maxWidth.endsWith('px')) { const kr = k.getBoundingClientRect(); col = {max_w: px(ks.maxWidth), x: Math.round(kr.x), w: Math.round(kr.width), pad: [px(ks.paddingLeft), px(ks.paddingRight)]}; break; } }
    blocks.push({tag: e.tagName.toLowerCase(), y: Math.round(r.top + sy), w: Math.round(r.width), h: Math.round(r.height),
      pad: [px(s.paddingTop), px(s.paddingRight), px(s.paddingBottom), px(s.paddingLeft)], per_row: Math.max(0, ...rows.values()),
      heading: h ? h.innerText.trim().slice(0, 80) : null, gap: s.gap !== 'normal' ? s.gap : null, background: hex(s.backgroundColor), column: col});
    if (blocks.length >= 60) break;
  }
  return {page_w: document.documentElement.scrollWidth, page_h: document.documentElement.scrollHeight,
    type: {h1: size('h1'), h2: size('h2'), h3: size('h3'), body: px(getComputedStyle(document.body).fontSize)}, blocks};
}"""

STATE_CANDIDATES_JS = r"""() => {
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.top < innerHeight * 3; };
  const sel = 'button[aria-expanded="false"],[aria-haspopup]:not([aria-haspopup="false"]),summary,[role=tab][aria-selected="false"],button[aria-controls]';
  const seen = new Set(), out = [];
  [...document.querySelectorAll(sel)].filter(vis).forEach((e, i) => {
    const label = (e.getAttribute('aria-label') || e.innerText || e.title || '').trim().replace(/\s+/g,' ').slice(0, 60) || ('control ' + i);
    const kind = e.tagName === 'SUMMARY' ? 'details' : (e.getAttribute('role') === 'tab' ? 'tab' : 'menu');
    if (seen.has(kind + label)) return; seen.add(kind + label);
    e.setAttribute('data-craft-state', String(out.length)); out.push({index: out.length, kind, label}); });
  return out.slice(0, 8);
}"""


# ---------------------------------------------------------------- capture

def _browser():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("playwright missing: run with `uv run` (inline deps) or `pip install playwright`")
    return sync_playwright


def _goto(page, url):
    try:
        page.goto(url, wait_until="load", timeout=45000)
    except Exception as e:  # noqa: BLE001
        print(f"  warn: load {url}: {e}".splitlines()[0])
    try:
        page.wait_for_load_state("networkidle", timeout=4000)
    except Exception:  # noqa: BLE001
        pass


def capture_page(ctx, url, out: Path, widths, deep=False, noise=True, settle=900):
    """Capture one URL at every width into out/. Returns capture dict."""
    out.mkdir(parents=True, exist_ok=True)
    health = {"console_errors": [], "failed_requests": []}
    page = ctx.new_page()
    page.on("console", lambda m: m.type == "error" and health["console_errors"].append(m.text[:300]))
    page.on("pageerror", lambda e: health["console_errors"].append(str(e)[:300]))
    page.on("requestfailed", lambda r: health["failed_requests"].append(urlparse(r.url).path))
    page.on("response", lambda r: r.status >= 400 and health["failed_requests"].append(urlparse(r.url).path))
    result = {"url": url, "widths": widths, "layouts": [], "mode": "deep" if deep else "clean"}
    for i, w in enumerate(widths):
        page.set_viewport_size({"width": w, "height": 900})
        _goto(page, url)
        page.wait_for_timeout(settle)
        page.evaluate(REVEAL_JS)
        if i == 0:
            result.update(page.evaluate(BLUEPRINT_JS, deep))
            if deep:
                (out / "page.html").write_text(page.content())
        lay = page.evaluate(LAYOUT_JS)
        lay["width"] = w
        result["layouts"].append(lay)
        h = min(lay["page_h"], MAX_H)
        shot = out / f"screenshot-{w}.png"
        page.screenshot(path=str(shot), full_page=True, clip={"x": 0, "y": 0, "width": w, "height": h})
        if noise:
            extra = []
            for k, wait in enumerate((900, 1300)):
                page.wait_for_timeout(wait)
                p = out / f".noise-{w}-{k}.png"
                page.screenshot(path=str(p), full_page=True, clip={"x": 0, "y": 0, "width": w, "height": h})
                extra.append(p)
            pct = noise_mask([shot, *extra], out / f"noise-{w}.png")
            for p in extra:
                p.unlink(missing_ok=True)
            lay["noise_pct"] = pct
    health["console_errors"] = sorted(set(health["console_errors"]))[:50]
    health["failed_requests"] = sorted(set(health["failed_requests"]))[:50]
    result["health"] = health
    page.close()
    return result


def capture_states(ctx, url, out: Path, width):
    out.mkdir(parents=True, exist_ok=True)
    page = ctx.new_page()
    page.set_viewport_size({"width": width, "height": 900})
    _goto(page, url)
    page.wait_for_timeout(600)
    try:
        cands = page.evaluate(STATE_CANDIDATES_JS)
    except Exception as e:  # noqa: BLE001
        page.close()
        return {"width": width, "states": [], "error": str(e)[:200]}
    states = []
    for c in cands:
        _goto(page, url)
        page.wait_for_timeout(400)
        page.evaluate(STATE_CANDIDATES_JS)
        try:
            page.locator(f'[data-craft-state="{c["index"]}"]').first.click(timeout=3000)
            page.wait_for_timeout(500)
            p = out / f"state-{c['index']}.png"
            page.screenshot(path=str(p))
            states.append({**c, "picture": p.name, "opened": True})
        except Exception as e:  # noqa: BLE001
            states.append({**c, "opened": False, "error": str(e).splitlines()[0][:160]})
    page.close()
    data = {"width": width, "states": states}
    (out / "states.json").write_text(json.dumps(data, indent=2))
    return data


def _slug(path):
    s = re.sub(r"[^a-z0-9]+", "-", path.lower()).strip("-")
    return s or "index"


def pick_routes(start, links, max_pages):
    host = urlparse(start).netloc
    start_path = urlparse(start).path.rstrip("/") or "/"
    seen, out = {start_path}, []
    if max_pages <= 0:
        return []
    for link in links:
        u = urlparse(link["href"])
        if u.scheme not in ("http", "https") or u.netloc != host:
            continue
        p = u.path.rstrip("/") or "/"
        last = p.rsplit("/", 1)[-1]
        if "." in last and not last.endswith((".html", ".htm")):
            continue
        if p in seen:
            continue
        seen.add(p)
        out.append({"path": p, "url": f"{u.scheme}://{u.netloc}{u.path}", "slug": _slug(p)})
        if len(out) >= max_pages:
            break
    return out


def write_readme(cap, out: Path, routes, states):
    t = cap["tokens"]
    fmt = lambda xs, n=6: ", ".join(f"{x['value']} ({x['count']})" for x in xs[:n]) or "-"
    lines = [f"# Capture of {cap['url']}", "", f"Mode: **{cap['mode']}** (clean = visitor view only).", f"Title: {cap.get('title')}", "",
             "## Design tokens (most used first)",
             f"- Backgrounds: {fmt(t['backgrounds'])}", f"- Text colours: {fmt(t['text_colors'])}", f"- Fonts: {fmt(t['fonts'])}",
             f"- Font sizes: {fmt(t['font_sizes'], 10)}", f"- Spacing: {fmt(t['spacing'], 12)}", f"- Corner radii: {fmt(t['radii'])}",
             f"- Content widths: {fmt(t['content_widths'])}", "", "## Layout per width"]
    for lay in cap["layouts"]:
        ty = lay["type"]
        lines.append(f"### {lay['width']} px: page {lay['page_w']}x{lay['page_h']}, h1 {ty['h1']} / h2 {ty['h2']} / body {ty['body']} px, animated area {lay.get('noise_pct', 0)}%")
        for b in lay["blocks"][:25]:
            col = f", column max {b['column']['max_w']}px" if b.get("column") else ""
            lines.append(f"- `{b['tag']}` y={b['y']} h={b['h']} pad={b['pad']} per_row={b['per_row']} bg={b['background']}{col}" + (f" — \"{b['heading']}\"" if b['heading'] else ""))
    lines += ["", "## Headings"] + [f"{'  ' * (h['level'] - 1)}- h{h['level']}: {h['text']}" for h in cap["headings"][:60]]
    lines += ["", f"## Health: {len(cap['health']['console_errors'])} console errors, {len(cap['health']['failed_requests'])} failed requests; landmarks {cap['a11y']['landmarks']}"]
    if states:
        lines += ["", "## Opened states"] + [f"- {w}px: " + ", ".join(f"{s['kind']} '{s['label']}'" + ("" if s["opened"] else " (failed)") for s in d["states"]) for w, d in states.items()]
    if routes:
        lines += ["", "## Other pages (rebuild each at the same path)"] + [f"- {r['path']} → routes/{r['slug']}/" for r in routes]
    lines += ["", "Open every screenshot-<w>.png with Read and look closely. White squares in noise-<w>.png animate and are not compared."]
    (out / "README.md").write_text("\n".join(lines) + "\n")


def cmd_capture(a):
    out = Path(a.out)
    if out.exists():
        shutil.rmtree(out)
    widths = [int(x) for x in a.widths.split(",")]
    with _browser()() as p:
        br = p.chromium.launch()
        ctx = br.new_context(device_scale_factor=1)
        print(f"capture {a.url} at {widths}")
        cap = capture_page(ctx, a.url, out, widths, deep=a.deep)
        phone = min(widths)
        states = {}
        if not a.no_states:
            states[max(widths)] = capture_states(ctx, a.url, out / "states", max(widths))
            if phone < 768:
                states[phone] = capture_states(ctx, a.url, out / f"states-{phone}", phone)
        routes = pick_routes(a.url, cap["links"], a.max_pages)
        for r in routes:
            print(f"  route {r['path']}")
            try:
                rc = capture_page(ctx, r["url"], out / "routes" / r["slug"], widths, deep=False, noise=True)
                (out / "routes" / r["slug"] / "capture.json").write_text(json.dumps(rc, indent=1))
                r["ok"] = True
            except Exception as e:  # noqa: BLE001
                r["ok"], r["error"] = False, str(e).splitlines()[0][:200]
        br.close()
    (out / "routes.json").write_text(json.dumps(routes, indent=2))
    (out / "capture.json").write_text(json.dumps(cap, indent=1))
    write_readme(cap, out, routes, states)
    print(f"done → {out}/README.md ({len(routes)} extra pages, {sum(len(d['states']) for d in states.values())} states)")


# ---------------------------------------------------------------- check

def find_site(app: Path):
    for d in ("dist", "out", "build"):
        if (app / d / "index.html").exists():
            return app / d
    if (app / "index.html").exists():
        return app
    return None


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(directory):
    handler = functools.partial(_Quiet, directory=str(directory))
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def words(text):
    return Counter(w for w in re.findall(r"[\w']+", (text or "").lower()) if len(w) >= 2)


def dice(a: Counter, b: Counter):
    tot = sum(a.values()) + sum(b.values())
    return 100.0 if tot == 0 else round(200 * sum((a & b).values()) / tot, 1)


def compare_pages(orig, build, odir: Path, bdir: Path, label):
    """Return per-page result with widths scores, claims, advice."""
    res = {"page": label, "widths": [], "claims": [], "advice": [], "unknowns": []}
    for w in orig["widths"]:
        po, pb = odir / f"screenshot-{w}.png", bdir / f"screenshot-{w}.png"
        if not (po.exists() and pb.exists()):
            res["unknowns"].append(f"{label} at {w}px could not be compared")
            continue
        s, lay, det = similarity(po, pb, odir / f"noise-{w}.png")
        ho, hb = Image.open(po).height, Image.open(pb).height
        ratio = min(ho, hb) / max(ho, hb)
        if ratio < 0.9:  # comparing only the shared top would reward a page that is too short or too long
            s = round(s * ratio / 0.9, 1)
            res["advice"].append(f"{w}px: page height {hb}px, original {ho}px (score scaled down; add or remove content)")
        res["widths"].append({"width": w, "score": s, "layout": lay, "detail": det, "height_ratio": round(ratio, 2)})
        side_by_side(po, pb, bdir / f"side-{w}")
    lo = {l["width"]: l for l in orig["layouts"]}
    lb = {l["width"]: l for l in build["layouts"]}
    for w, l in lo.items():
        b = lb.get(w)
        if not b:
            continue
        if l["page_w"] <= w + 1:
            res["claims"].append({"claim": f"doesn't scroll sideways at {w}px", "ok": b["page_w"] <= w + 1, "detail": f"build page width {b['page_w']}"})
        for k in ("h1", "h2", "body"):
            if l["type"].get(k) and b["type"].get(k) and abs(l["type"][k] - b["type"][k]) > 2:
                res["advice"].append(f"{w}px: {k} size {b['type'][k]}px, original {l['type'][k]}px")
        bb = list(b["blocks"])
        for ob in l["blocks"]:
            m = next((x for x in bb if x["tag"] == ob["tag"] and x["heading"] == ob["heading"]), None) or next((x for x in bb if x["tag"] == ob["tag"]), None)
            if not m:
                continue
            bb.remove(m)
            name = f"{ob['tag']}" + (f" \"{ob['heading'][:40]}\"" if ob["heading"] else "")
            if any(abs(x - y) > 4 for x, y in zip(ob["pad"], m["pad"])):
                res["advice"].append(f"{w}px: {name} padding {m['pad']}, original {ob['pad']}")
            if ob["tag"] not in ("nav", "header") and ob["per_row"] and ob["per_row"] != m["per_row"]:
                res["advice"].append(f"{w}px: {name} shows {m['per_row']} cards/columns side by side, original {ob['per_row']}")
            if ob.get("column") and (not m.get("column") or abs(ob["column"]["max_w"] - m["column"]["max_w"]) > 8):
                res["advice"].append(f"{w}px: {name} content column max {m['column']['max_w'] if m.get('column') else 'missing'}, original {ob['column']['max_w']}px")
    oh, bh = orig["health"], build["health"]
    new_err = [e for e in bh["console_errors"] if e not in oh["console_errors"]]
    res["claims"].append({"claim": "logs no errors the original doesn't", "ok": not new_err, "detail": "; ".join(new_err[:3])})
    new_fail = [p for p in bh["failed_requests"] if p not in oh["failed_requests"]]
    res["claims"].append({"claim": "loads every file it asks for", "ok": not new_fail, "detail": ", ".join(new_fail[:5])})
    if "a11y" in orig and "a11y" in build:
        miss = [x for x in orig["a11y"]["landmarks"] if x not in build["a11y"]["landmarks"]]
        res["claims"].append({"claim": "has the original's landmarks", "ok": not miss, "detail": "missing " + ", ".join(miss) if miss else ""})
    if "text" in orig and "text" in build:
        ow, bw = words(orig["text"]), words(build["text"])
        res["text_alike"] = dice(ow, bw)
        missing_h = [h["text"] for h in orig["headings"] if h["text"] and h["text"].lower() not in build["text"].lower()][:8]
        if missing_h:
            res["advice"].append("missing headings: " + " | ".join(missing_h))
        mw = [w for w, _ in (ow - bw).most_common(12)]
        if mw:
            res["advice"].append("most frequent missing words: " + ", ".join(mw))
        ot, bt = orig["tokens"], build["tokens"]

        def near(c, pool):
            return any(c and p and all(abs(int(c[i:i + 2], 16) - int(p[i:i + 2], 16)) <= 3 for i in (1, 3, 5)) for p in pool)

        for key in ("backgrounds", "text_colors"):
            pool = [x["value"] for x in bt[key]]
            miss = [x["value"] for x in ot[key][:6] if not near(x["value"], pool)]
            if miss:
                res["advice"].append(f"{key} absent in build: {', '.join(miss)}")
        if ot["fonts"] and bt["fonts"]:
            of = re.sub(r"^__|_[0-9a-f]+$|_Fallback.*", "", ot["fonts"][0]["value"])
            bf = re.sub(r"^__|_[0-9a-f]+$|_Fallback.*", "", bt["fonts"][0]["value"])
            if of.lower() != bf.lower():
                res["advice"].append(f"main font {bf}, original {of}")
        for key in ("font_sizes", "spacing"):
            pool = {x["value"] for x in bt[key]}
            miss = [x["value"] for x in ot[key][:8] if x["value"] not in pool]
            if miss:
                res["advice"].append(f"{key} absent in build: {', '.join(miss)}")
    res["score"] = round(float(np.mean([x["score"] for x in res["widths"]])), 1) if res["widths"] else None
    return res


def compare_states(cap_dir: Path, chk_dir: Path):
    claims = []
    for sub in sorted(p.name for p in cap_dir.glob("states*") if p.is_dir()):
        of = cap_dir / sub / "states.json"
        bf = chk_dir / sub / "states.json"
        if not of.exists():
            continue
        o = json.loads(of.read_text())
        b = json.loads(bf.read_text()) if bf.exists() else {"states": []}
        for s in o["states"]:
            if not s.get("opened"):
                continue
            m = next((x for x in b["states"] if x["kind"] == s["kind"] and x["label"].lower() == s["label"].lower() and x.get("opened")), None) \
                or next((x for x in b["states"] if x["kind"] == s["kind"] and x.get("opened")), None)
            detail = ""
            if m:
                sc, _, _ = similarity(cap_dir / sub / s["picture"], chk_dir / sub / m["picture"])
                detail = f"{sc}% alike"
            claims.append({"claim": f"the '{s['label']}' {s['kind']} opens in the build at {o['width']}px", "ok": bool(m), "detail": detail})
    return claims


def cmd_check(a):
    proj = Path(a.project)
    cap_dir = proj / "capture"
    app = proj / "app"
    site = Path(a.site) if a.site else find_site(app)
    if not site or not (site / "index.html").exists():
        sys.exit("NO BUILD: no index.html in app/dist, app/out, app/build or app/. Build first (static output), then check.")
    rounds = sorted(int(p.name.split("-")[1]) for p in (proj / "checks").glob("round-*")) if (proj / "checks").exists() else []
    n = a.round or ((rounds[-1] + 1) if rounds else 1)
    out = proj / "checks" / f"round-{n}"
    if out.exists():
        shutil.rmtree(out)
    orig = json.loads((cap_dir / "capture.json").read_text())
    routes = json.loads((cap_dir / "routes.json").read_text()) if (cap_dir / "routes.json").exists() else []
    widths = orig["widths"]
    srv, base = serve(site)
    pages = []
    try:
        with _browser()() as p:
            br = p.chromium.launch()
            ctx = br.new_context(device_scale_factor=1)
            b = capture_page(ctx, base + "/", out, widths, deep=False, noise=False, settle=1200)
            (out / "capture.json").write_text(json.dumps(b, indent=1))
            pages.append(compare_pages(orig, b, cap_dir, out, "start page"))
            state_claims = []
            if not a.no_states:
                for sub in [d for d in cap_dir.glob("states*") if d.is_dir()]:
                    w = int(sub.name.split("-")[1]) if "-" in sub.name else max(widths)
                    capture_states(ctx, base + "/", out / sub.name, w)
                state_claims = compare_states(cap_dir, out)
            for r in routes:
                if not r.get("ok"):
                    continue
                rdir = cap_dir / "routes" / r["slug"]
                rorig = json.loads((rdir / "capture.json").read_text())
                path = r["path"] if r["path"].endswith((".html", ".htm")) else r["path"].rstrip("/") + "/"
                rb = capture_page(ctx, base + path, out / "routes" / r["slug"], widths, noise=False, settle=1200)
                pages.append(compare_pages(rorig, rb, rdir, out / "routes" / r["slug"], r["path"]))
            br.close()
    finally:
        srv.shutdown()
    scores = [pg["score"] for pg in pages if pg["score"] is not None]
    overall = round(float(np.mean(scores)), 1) if scores else None
    claims = [c for pg in pages for c in pg["claims"]] + state_claims
    unknowns = [u for pg in pages for u in pg["unknowns"]]
    failed = [c for c in claims if not c["ok"]]
    good = overall is not None and overall >= a.good and not failed and not unknowns
    report = {"round": n, "similarity": overall, "good_enough": a.good, "pass": good, "pages": pages,
              "claims": claims, "unknowns": unknowns}
    (out / "report.json").write_text(json.dumps(report, indent=2))
    L = [f"# Check round {n}: {overall}% alike (needs {a.good}%), {len(claims) - len(failed)} of {len(claims)} claims hold", ""]
    for pg in pages:
        L.append(f"## {pg['page']}: {pg['score']}%  (text {pg.get('text_alike', '-')}% alike)")
        L += [f"- {w['width']}px: {w['score']}% (layout {w['layout']}, detail {w['detail']})" for w in pg["widths"]]
        if pg["advice"]:
            L += ["Advice (fix with these exact values):"] + [f"  - {x}" for x in pg["advice"][:25]]
        L.append("")
    if failed:
        L += ["## These must hold before it can pass"] + [f"- ✗ {c['claim']} {('— ' + c['detail']) if c['detail'] else ''}" for c in failed] + [""]
    if unknowns:
        L += ["## Not compared, so it can't pass yet"] + [f"- {u}" for u in unknowns] + [""]
    L.append("Side-by-side bands (original left | build right): side-<width>-<n>.png in this folder; open them with Read.")
    L.append("This would pass." if good else "Not good enough yet: open the side-by-side bands with Read, fix the biggest differences first, rebuild, check again.")
    (out / "report.md").write_text("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nreport → {out}/report.md")
    sys.exit(0 if good else 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    c = sp.add_parser("capture")
    c.add_argument("url")
    c.add_argument("out")
    c.add_argument("--widths", default=",".join(map(str, DEFAULT_WIDTHS)))
    c.add_argument("--max-pages", type=int, default=4)
    c.add_argument("--deep", action="store_true", help="also save page.html, stylesheets, scripts, breakpoints")
    c.add_argument("--no-states", action="store_true")
    k = sp.add_parser("check")
    k.add_argument("project")
    k.add_argument("--site")
    k.add_argument("--round", type=int)
    k.add_argument("--good", type=float, default=90.0)
    k.add_argument("--no-states", action="store_true")
    a = ap.parse_args()
    {"capture": cmd_capture, "check": cmd_check}[a.cmd](a)


if __name__ == "__main__":
    main()
