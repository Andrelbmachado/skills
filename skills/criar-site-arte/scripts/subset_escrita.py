#!/usr/bin/env python3
"""Subset an ancient-script font (Noto Sans Cuneiform, Egyptian Hieroglyphs, etc.) to woff2.

Keeps only the signs the kit actually uses, so the font stays a few KB.

Usage:
  python subset_escrita.py --font NotoSansCuneiform-Regular.ttf --out dashboard/esagila/fonts/cuneiform.woff2 \
      --text "𒁹𒌋𒐕" [--text-file signs.txt] [--codepoints U+12079,U+1230B]

Prints sha256 of source and output (record both in credits/manifest) and copies nothing else;
ship the font's OFL.txt next to the woff2 yourself.
Requires: fontTools + brotli (pip install fonttools brotli) — use ~/Developer/.venvs/design-master.
"""
import argparse
import hashlib
import sys
from pathlib import Path


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--font", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--text", default="")
    ap.add_argument("--text-file", type=Path)
    ap.add_argument("--codepoints", default="", help="comma list, e.g. U+13000,U+1302F")
    a = ap.parse_args()

    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError:
        print("fontTools missing: pip install fonttools brotli", file=sys.stderr)
        return 2

    chars = set(a.text)
    if a.text_file:
        chars |= set(a.text_file.read_text(encoding="utf-8"))
    cps = {ord(c) for c in chars if not c.isspace()}
    for tok in filter(None, (t.strip() for t in a.codepoints.split(","))):
        cps.add(int(tok.upper().removeprefix("U+"), 16))
    if not cps:
        print("no signs given (--text / --text-file / --codepoints)", file=sys.stderr)
        return 2

    font = TTFont(a.font)
    cmap = font.getBestCmap()
    missing = sorted(c for c in cps if c not in cmap)
    if missing:
        print("WARNING not in font:", ", ".join(f"U+{c:04X}" for c in missing), file=sys.stderr)

    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=sorted(cps))
    sub.subset(font)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(a.out)

    print(f"signs={len(cps) - len(missing)} missing={len(missing)} bytes={a.out.stat().st_size}")
    print(f"source_sha256={sha(a.font)}")
    print(f"output_sha256={sha(a.out)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
