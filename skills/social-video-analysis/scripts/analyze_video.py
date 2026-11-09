#!/usr/bin/env python3
"""Download a social-media video, extract frames + audio, transcribe.

Usage: analyze_video.py <url|local.mp4> [-o OUTDIR] [--fps 1] [--max-frames 40]
                        [--whisper-model base] [--lang auto] [--no-transcribe]
Outputs in OUTDIR: video.mp4, audio.wav, frames/f_0001.jpg, contact_sheet.jpg,
transcript.txt, transcript.json, meta.json  (meta.json lists everything).
Download order: yt-dlp -> Playwright headless (extracts mp4 URL, needed for Threads).
Deterministic; the visual/audio *analysis* is done afterwards by the agent (see SKILL.md).
"""
import argparse, glob, json, os, re, shutil, subprocess, sys, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
VENV = os.path.expanduser("~/.cache/social-video-analysis/venv")

PW_SNIPPET = r'''
import sys, re, json, glob, os
from playwright.sync_api import sync_playwright
url = sys.argv[1]; ua = sys.argv[2]
with sync_playwright() as p:
    kw = {}
    c = glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell")) + \
        glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell"))
    if c: kw["executable_path"] = sorted(c)[-1]
    b = p.chromium.launch(**kw)
    pg = b.new_page(user_agent=ua)
    pg.goto(url, wait_until="networkidle", timeout=60000)
    html = pg.content(); out = {"final_url": pg.url, "video": None, "caption": None}
    m = re.search(r'"video_versions":\[\{"type":\d+,"url":"(.*?)"', html)
    if m: out["video"] = json.loads('"' + m.group(1) + '"')
    if not out["video"]:
        m = re.search(r'og:video(?::secure_url)?" content="([^"]+)"', html)
        if m: out["video"] = m.group(1).replace("&amp;", "&")
    m = re.search(r'og:description" content="([^"]*)"', html)
    if m: out["caption"] = m.group(1)
    print("@@JSON@@" + json.dumps(out)); b.close()
'''

def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)

def dl_ytdlp(url, out):
    r = sh(["yt-dlp", "--no-playlist", "-f", "mp4/bv*+ba/b", "--merge-output-format", "mp4",
            "-o", os.path.join(out, "video.%(ext)s"), "--write-info-json", url])
    vids = glob.glob(os.path.join(out, "video.*"))
    vids = [v for v in vids if v.endswith((".mp4", ".mkv", ".webm", ".mov"))]
    return (vids[0] if vids else None), r.stderr[-300:]

def ensure_pw_python():
    for py in (sys.executable, os.path.join(VENV, "bin", "python")):
        if os.path.exists(py) and sh([py, "-c", "import playwright"]).returncode == 0:
            return py
    os.makedirs(os.path.dirname(VENV), exist_ok=True)
    subprocess.run([sys.executable, "-m", "venv", VENV], check=True)
    subprocess.run([os.path.join(VENV, "bin", "pip"), "-q", "install", "playwright"], check=True)
    if not glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium_headless_shell-*")):
        subprocess.run([os.path.join(VENV, "bin", "playwright"), "install", "chromium-headless-shell"], check=True)
    return os.path.join(VENV, "bin", "python")

def dl_playwright(url, out):
    py = ensure_pw_python()
    r = sh([py, "-c", PW_SNIPPET, url, UA], timeout=150)
    m = re.search(r"@@JSON@@(.*)", r.stdout)
    if not m: return None, {}, r.stderr[-300:]
    info = json.loads(m.group(1))
    if not info.get("video"): return None, info, "no video url found in page"
    dest = os.path.join(out, "video.mp4")
    req = urllib.request.Request(info["video"], headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as resp, open(dest, "wb") as f:
        shutil.copyfileobj(resp, f)
    return dest, info, ""

def probe(path):
    r = sh(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path])
    d = json.loads(r.stdout or "{}")
    v = next((s for s in d.get("streams", []) if s["codec_type"] == "video"), {})
    a = next((s for s in d.get("streams", []) if s["codec_type"] == "audio"), None)
    return {"duration_s": float(d.get("format", {}).get("duration", 0)), "width": v.get("width"),
            "height": v.get("height"), "fps": v.get("r_frame_rate"), "has_audio": a is not None}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("-o", "--out", default=None)
    ap.add_argument("--fps", type=float, default=1.0); ap.add_argument("--max-frames", type=int, default=40)
    ap.add_argument("--whisper-model", default="base"); ap.add_argument("--lang", default="auto")
    ap.add_argument("--no-transcribe", action="store_true")
    a = ap.parse_args()
    out = os.path.abspath(a.out or "analysis_out"); os.makedirs(out, exist_ok=True)
    meta = {"source": a.src, "out": out, "download": None, "caption": None}

    if os.path.exists(a.src):
        video = os.path.join(out, "video" + os.path.splitext(a.src)[1])
        if os.path.abspath(a.src) != video: shutil.copy(a.src, video)
        meta["download"] = "local"
    else:
        video, err = dl_ytdlp(a.src, out); meta["download"] = "yt-dlp"
        if not video:
            print(f"[yt-dlp failed: {err.strip()[-120:]}] -> Playwright fallback", file=sys.stderr)
            video, info, err = dl_playwright(a.src, out); meta["download"] = "playwright"
            meta["caption"] = info.get("caption"); meta["final_url"] = info.get("final_url")
        else:
            ij = glob.glob(os.path.join(out, "video.info.json"))
            if ij:
                d = json.load(open(ij[0])); meta["caption"] = d.get("description") or d.get("title")
                meta["uploader"] = d.get("uploader")
        if not video: sys.exit(f"DOWNLOAD FAILED: {err}")
    meta["video"] = video; meta.update(probe(video))

    fdir = os.path.join(out, "frames"); os.makedirs(fdir, exist_ok=True)
    for f in glob.glob(os.path.join(fdir, "f_*.jpg")): os.remove(f)
    fps = min(a.fps, a.max_frames / max(meta["duration_s"], 1))
    sh(["ffmpeg", "-y", "-i", video, "-vf", f"fps={fps:.4f},scale='min(720,iw)':-2", "-q:v", "3",
        os.path.join(fdir, "f_%04d.jpg")])
    frames = sorted(glob.glob(os.path.join(fdir, "f_*.jpg")))
    meta["frames"] = frames; meta["frame_interval_s"] = round(1 / fps, 3)
    if frames:  # contact sheet: 4 cols
        rows = (len(frames) + 3) // 4
        sh(["ffmpeg", "-y", "-framerate", "1", "-i", os.path.join(fdir, "f_%04d.jpg"),
            "-vf", f"scale=320:-2,tile=4x{rows}", "-frames:v", "1", os.path.join(out, "contact_sheet.jpg")])

    if meta["has_audio"] and not a.no_transcribe:
        wav = os.path.join(out, "audio.wav")
        sh(["ffmpeg", "-y", "-i", video, "-vn", "-ac", "1", "-ar", "16000", wav])
        meta["audio"] = wav
        vd = sh(["ffmpeg", "-i", wav, "-af", "volumedetect", "-f", "null", "-"]).stderr
        mv = re.search(r"max_volume: (-?[\d.]+) dB", vd)
        meta["max_volume_db"] = float(mv.group(1)) if mv else None
        w = shutil.which("whisper")
        if meta["max_volume_db"] is not None and meta["max_volume_db"] < -50:
            meta["transcript"] = ""; meta["transcript_note"] = "audio track silent (no speech/music); whisper skipped"
        elif w:
            cmd = [w, wav, "--model", a.whisper_model, "--output_dir", out, "--output_format", "all", "--fp16", "False"]
            if a.lang != "auto": cmd += ["--language", a.lang]
            r = sh(cmd)
            if os.path.exists(os.path.join(out, "audio.txt")):
                os.replace(os.path.join(out, "audio.txt"), os.path.join(out, "transcript.txt"))
                if os.path.exists(os.path.join(out, "audio.json")):
                    os.replace(os.path.join(out, "audio.json"), os.path.join(out, "transcript.json"))
                meta["transcript"] = open(os.path.join(out, "transcript.txt")).read().strip()
            else: meta["transcript_error"] = r.stderr[-300:]
        else: meta["transcript_error"] = "whisper CLI not found (pip install openai-whisper)"
    json.dump(meta, open(os.path.join(out, "meta.json"), "w"), ensure_ascii=False, indent=2)
    print(json.dumps({k: v for k, v in meta.items() if k != "frames"}, ensure_ascii=False, indent=2))
    print(f"frames: {len(frames)} in {fdir}; contact sheet: {out}/contact_sheet.jpg")

if __name__ == "__main__":
    main()
