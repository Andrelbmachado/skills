# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright>=1.45"]
# ///
"""Craft Anything contracts for a WEB game. Copy to app/tools/game.py and adapt the marked parts.

  uv run app/tools/game.py --screenshot out.png   # draws ~120 frames (demo/autopilot), saves the picture, exits
  uv run app/tools/game.py --self-test out.json   # plays with real key presses, writes {"version":1,"steps":[...]}

The game must expose a read-only test hook (keep it tiny, it is not used by the game itself):

  window.__craft = {
    state: {mode, frames, score, player: {x, y}, ...},   // updated every frame/tick, plain JSON
    setup(opts) { ... }                                  // optional: fixed seed/level for deterministic tests
  }
and accept `?demo=1` (autopilot, so the screenshot shows real play, not a blank menu).

Run from checks with an ABSOLUTE path:
  uv run <skill>/scripts/check_program.py screenshot <projeto> -- uv run <projeto>/app/tools/game.py
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent           # app/
INDEX = (ROOT / "index.html")                           # ADAPT: dist/index.html if there is a build step
VIEW = {"width": 1280, "height": 800}                    # ADAPT: the game's natural size
S = "window.__craft.state"


def _open(p, query=""):
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    page = b.new_page(viewport=VIEW)
    page.goto(INDEX.as_uri() + query)
    page.wait_for_function("window.__craft && window.__craft.state", timeout=20000)
    return b, page


def screenshot(out: str) -> None:
    with sync_playwright() as p:
        b, page = _open(p, "?demo=1")
        page.wait_for_function(f"{S}.frames >= 120", timeout=30000)
        page.screenshot(path=out)
        b.close()


def self_test(out: str) -> None:
    steps, errors = [], []

    def rec(name, ok, detail):
        steps.append({"step": name, "passed": bool(ok), "detail": detail})

    with sync_playwright() as p:
        b, page = _open(p)
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.on("pageerror", lambda e: errors.append(str(e)))
        st = lambda: page.evaluate(S)  # noqa: E731
        try:
            page.keyboard.press("Enter")                       # ADAPT: how a player starts
            page.wait_for_timeout(300)

            # move: the player moves when driven by input (measure from the game's own state)
            a = st()["player"]
            page.keyboard.down("ArrowRight"); page.wait_for_timeout(600); page.keyboard.up("ArrowRight")   # ADAPT
            bpos = st()["player"]
            dist = ((bpos["x"] - a["x"]) ** 2 + (bpos["y"] - a["y"]) ** 2) ** 0.5
            rec("move", dist > 0, f"player moved {dist:.1f} units")

            # act: the main action works (shoot/jump/eat/place...). ADAPT the trigger and the measured effect.
            s0 = st()
            page.keyboard.press("Space")
            page.wait_for_timeout(500)
            s1 = st()
            rec("act", s1["score"] != s0["score"] or s1.get("actions", 0) > s0.get("actions", 0),
                f"score {s0['score']} → {s1['score']}")

            # hud: on-screen info is drawn (DOM text, or the game reports it drew the HUD this frame)
            hud = page.evaluate(f"{S}.hudDrawn === true || !!document.querySelector('[data-hud]')")   # ADAPT
            rec("hud", hud, "HUD drawn")

            # extra steps become claims too (rules: collisions, game over, pause, levels...)
        except Exception as e:  # noqa: BLE001
            rec("harness", False, f"self-test crashed: {e}")
        rec("no_errors", not errors, "; ".join(errors[:3]) or "no console errors")
        b.close()
    Path(out).write_text(json.dumps({"version": 1, "steps": steps}, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--screenshot")
    ap.add_argument("--self-test")
    a = ap.parse_args()
    if a.screenshot:
        screenshot(a.screenshot)
    if a.self_test:
        self_test(a.self_test)
