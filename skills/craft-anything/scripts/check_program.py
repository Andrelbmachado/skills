# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=10", "numpy>=1.26", "playwright>=1.45"]
# ///
"""Checks for app and game rebuilds (Craft Anything contracts).

  uv run check_program.py screenshot <project> -- <cmd ...>      # runs cmd --screenshot checks/round-N/screenshot.png
  uv run check_program.py selftest   <project> -- <cmd ...>      # runs cmd --self-test checks/round-N/self-test.json
  uv run check_program.py mechanics  <project>                   # every non-estimated number in app/mechanics.json is a literal in app/
  uv run check_program.py runs       <project> --orig "<cmd>" --build "<cmd>"   # console: '', --help, --version
  uv run check_program.py picture    <a.png> <b.png>             # % alike at 640x360

Exit code 0 = pass, 1 = fail. Each prints a short report.
"""
from __future__ import annotations

import argparse
import json
import re
import shlex
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from craft_web import is_blank, picture_similarity  # noqa: E402

SKIP_DIRS = {"target", "node_modules", "build", "dist", "bin", "obj", "library", "temp", "shots", "addons",
             "binaries", "intermediate", "saved", "deriveddatacache", ".git", ".godot"}


def round_dir(proj: Path, n=None, fresh_if_exists=None):
    """Latest checks/round-N, or a new round-(N+1) when `fresh_if_exists` is already in the latest one."""
    checks = proj / "checks"
    rounds = sorted(int(p.name.split("-")[1]) for p in checks.glob("round-*")) if checks.exists() else []
    if not n:
        n = rounds[-1] if rounds else 1
        if rounds and fresh_if_exists and (checks / f"round-{n}" / fresh_if_exists).exists():
            n += 1
    d = checks / f"round-{n}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def run(cmd, timeout):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired as e:
        return "still running", ((e.stdout or b"").decode(errors="ignore") if isinstance(e.stdout, bytes) else (e.stdout or ""))
    except FileNotFoundError as e:
        return "not found", str(e)


def cmd_screenshot(a):
    proj = Path(a.project)
    out = round_dir(proj, a.round, "screenshot.png") / "screenshot.png"
    out.unlink(missing_ok=True)
    cmd = a.cmd + (["--"] if a.godot else []) + ["--screenshot", str(out.resolve())]
    code, log = run(cmd, 90)
    if not out.exists():
        print(f"FAIL: no picture written (exit {code}). Last output:\n{log[-1500:]}")
        sys.exit(1)
    try:
        blank = is_blank(out)
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: unreadable PNG: {e}")
        sys.exit(1)
    if blank:
        print(f"FAIL: picture is blank (one flat colour): {out}")
        sys.exit(1)
    refs = sorted([*(proj / "reference").glob("*.png"), *(proj / "reference").glob("*.jp*g"), *(proj / "capture").glob("window.png")])
    best = max(((picture_similarity(out, r), r.name) for r in refs), default=None)
    print(f"PASS: {out}" + (f" — {best[0]}% alike {best[1]} (advisory)" if best else ""))
    print("Open it with Read and compare with each reference picture.")


def cmd_selftest(a):
    proj = Path(a.project)
    out = round_dir(proj, a.round, "self-test.json") / "self-test.json"
    out.unlink(missing_ok=True)
    cmd = a.cmd + (["--"] if a.godot else []) + ["--self-test", str(out.resolve())]
    code, log = run(cmd, 120)
    if not out.exists():
        print(f"FAIL: no self-test file (exit {code}). Last output:\n{log[-1500:]}")
        sys.exit(1)
    try:
        steps = {s["step"]: s for s in json.loads(out.read_text())["steps"]}
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: bad self-test JSON: {e}")
        sys.exit(1)
    ok = True
    for name in ["move", "act", "hud", *[k for k in steps if k not in ("move", "act", "hud")][:17]]:
        s = steps.get(name)
        passed = bool(s and s.get("passed"))
        ok &= passed
        print(f"{'✓' if passed else '✗'} {name}: {s.get('detail', '') if s else 'not tested'}")
    print("PASS: plays the core loop" if ok else "FAIL: fix the failing steps")
    sys.exit(0 if ok else 1)


def _norm(v):
    return f"{abs(float(v)):.7g}"


def cmd_mechanics(a):
    app = Path(a.project) / "app"
    f = app / "mechanics.json"
    if not f.exists():
        print("FAIL: app/mechanics.json missing")
        sys.exit(1)
    try:
        vals = json.loads(f.read_text())["values"]
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: unreadable mechanics.json: {e}")
        sys.exit(1)
    if not vals:
        print("FAIL: mechanics.json has no values")
        sys.exit(1)
    found, total = set(), 0
    num = re.compile(r"-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?")
    for p in app.rglob("*"):
        if not p.is_file() or p.name == "mechanics.json" or p.suffix.lower() == ".md" or any(part.lower() in SKIP_DIRS for part in p.relative_to(app).parts):
            continue
        size = p.stat().st_size
        if size > 2_000_000 or total > 32_000_000:
            continue
        total += size
        try:
            text = p.read_text(errors="ignore")
        except Exception:  # noqa: BLE001
            continue
        for m in num.findall(text):
            try:
                found.add(_norm(m))
            except ValueError:
                pass
    ok = True
    claims = [v for v in vals if not v.get("estimated") and isinstance(v.get("value"), (int, float))][:60]
    weak = 0
    for v in claims:
        hit = _norm(v["value"]) in found
        trivial = float(v["value"]).is_integer() and abs(v["value"]) <= 10
        weak += trivial
        ok &= hit
        print(f"{'✓' if hit else '✗'} {v['name']} = {v['value']}{(' ' + v['unit']) if v.get('unit') else ''}{'  (small integer: weak evidence)' if trivial else ''}")
    est = sum(1 for v in vals if v.get("estimated"))
    print(f"{'PASS' if ok else 'FAIL'}: {len(claims)} numbers checked ({weak} weak), {est} estimated — coverage {len(claims)}/{len(vals)}")
    sys.exit(0 if ok else 1)


def _words(t, names):
    for n in names:
        t = t.replace(n, "program")
    return Counter(w for w in re.findall(r"[\w']+", t.lower()) if len(w) >= 2)


def cmd_runs(a):
    out = round_dir(Path(a.project), a.round, "runs") / "runs"
    out.mkdir(parents=True, exist_ok=True)
    orig, build = shlex.split(a.orig), shlex.split(a.build)
    names = [Path(orig[0]).name, Path(build[0]).name]
    ok = True
    for args in ([], ["--help"], ["--version"]):
        label = " ".join(args) or "no arguments"
        oc, ot = run(orig + args, 8)
        bc, bt = run(build + args, 8)
        wo, wb = _words(ot, names), _words(bt, names)
        tot = sum(wo.values()) + sum(wb.values())
        d = 100.0 if tot == 0 else round(200 * sum((wo & wb).values()) / tot, 1)
        same_exit = oc == bc
        ok &= same_exit and d >= 80
        print(f"{label}: exit {'✓' if same_exit else '✗'} ({bc} vs {oc}), words {d}% {'✓' if d >= 80 else '✗'}")
        (out / f"{label.replace(' ', '_').strip('-')}.json").write_text(json.dumps(
            {"arguments": args, "orig": {"exit": oc, "lines": ot.splitlines()[:200]}, "build": {"exit": bc, "lines": bt.splitlines()[:200]}}, indent=1))
    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="sub", required=True)
    for name in ("screenshot", "selftest"):
        s = sp.add_parser(name)
        s.add_argument("project")
        s.add_argument("--round", type=int)
        s.add_argument("--godot", action="store_true", help="pass options after --")

    m = sp.add_parser("mechanics")
    m.add_argument("project")
    r = sp.add_parser("runs")
    r.add_argument("project")
    r.add_argument("--orig", required=True)
    r.add_argument("--build", required=True)
    r.add_argument("--round", type=int)
    pc = sp.add_parser("picture")
    pc.add_argument("a")
    pc.add_argument("b")
    argv = sys.argv[1:]
    cmd = []
    if "--" in argv:
        i = argv.index("--")
        argv, cmd = argv[:i], argv[i + 1:]
    a = ap.parse_args(argv)
    a.cmd = cmd
    if a.sub in ("screenshot", "selftest") and not a.cmd:
        sys.exit("give the program command after --")
    if a.sub == "picture":
        print(f"{picture_similarity(a.a, a.b)}% alike")
        return
    {"screenshot": cmd_screenshot, "selftest": cmd_selftest, "mechanics": cmd_mechanics, "runs": cmd_runs}[a.sub](a)


if __name__ == "__main__":
    main()
