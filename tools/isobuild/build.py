#!/usr/bin/env python3
"""
isobuild — parametric isometric building generator for Rome III.

Reads data/buildings.json and writes assets/buildings/<id>_t<tier>.svg.
Conventions (CLAUDE.md):
  * viewBox 64x64; the base diamond is centred at (32,48), half-width 28, half-height 14.
  * Root <svg> carries data-ax / data-ay = base-diamond centre. Renderers place that point on the tile.
  * SVG primitives only: polygon, rect, circle, ellipse, line, polyline. No <path>.
  * Tier 3 animates via CSS @keyframes inside the file. Animated classes are prefixed
    "anim-" and the keyframes are identical across files so inlining several is safe.
Deterministic: same data -> same bytes.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data", "buildings.json")
OUT = os.path.join(ROOT, "assets", "buildings")
PAL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "palette.json")))

AX, AY = 32, 48   # anchor: base-diamond centre
HW, HH = 28, 14   # base diamond half extents
INK = PAL["ink"]
STROKE = f'stroke="{INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"'


def pts(seq):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in seq)


def poly(seq, fill, extra=""):
    return f'<polygon points="{pts(seq)}" fill="{fill}" {STROKE} {extra}/>'


def polyline(seq, extra=""):
    return f'<polyline points="{pts(seq)}" fill="none" {STROKE} {extra}/>'


def line(x1, y1, x2, y2, extra=""):
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" {STROKE} {extra}/>'


def circle(cx, cy, r, fill, extra=""):
    return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" {STROKE} {extra}/>'


def ellipse(cx, cy, rx, ry, fill, extra=""):
    return f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{fill}" {STROKE} {extra}/>'


def rect(x, y, w, h, fill, extra=""):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{fill}" {STROKE} {extra}/>'


# Isometric helpers. A "box" has footprint scale s (0..1 of the base diamond) and height h.
def diamond(cx, cy, hw, hh):
    return [(cx - hw, cy), (cx, cy + hh), (cx + hw, cy), (cx, cy - hh)]


def box(cx, cy, hw, hh, h, light, dark, top, roof=None):
    """Walls of an iso box. Returns svg string. Base diamond centred (cx,cy)."""
    W, S, E, N = diamond(cx, cy, hw, hh)  # west, south, east, north corners
    out = []
    out.append(poly([W, S, (S[0], S[1] - h), (W[0], W[1] - h)], dark))   # left (south-west) face
    out.append(poly([S, E, (E[0], E[1] - h), (S[0], S[1] - h)], light))  # right (south-east) face
    if roof is None:
        out.append(poly([(W[0], W[1] - h), (S[0], S[1] - h), (E[0], E[1] - h), (N[0], N[1] - h)], top))
    return "\n".join(out)


def gable_roof(cx, cy, hw, hh, h, ridge, light, dark, edge):
    """Terracotta gable roof: ridge runs west-east across the top of the box, raised by `ridge`."""
    W, S, E, N = diamond(cx, cy, hw, hh)
    top = lambda p: (p[0], p[1] - h)
    Wt, St, Et, Nt = map(top, (W, S, E, N))
    R1 = (Wt[0] + 4, cy - h - ridge)
    R2 = (Et[0] - 4, cy - h - ridge)
    out = []
    out.append(poly([Nt, Et, R2, R1], dark))    # far slope
    out.append(poly([Wt, St, Et, R2, R1], light))  # near slope (front)
    # tile courses on the near slope as polylines
    for i in range(1, 4):
        t = i / 4
        a = (Wt[0] + (R1[0] - Wt[0]) * t, Wt[1] + (R1[1] - Wt[1]) * t)
        b = (Et[0] + (R2[0] - Et[0]) * t, Et[1] + (R2[1] - Et[1]) * t)
        m = (St[0] + ((R1[0] + R2[0]) / 2 - St[0]) * t, St[1] + ((R1[1] + R2[1]) / 2 - St[1]) * t)
        out.append(polyline([a, m, b], f'stroke="{edge}" stroke-width="0.7"'))
    return "\n".join(out)


def columns(cx, cy, hw, hh, h, n, fill):
    """A row of columns along the south-east face (the front)."""
    W, S, E, N = diamond(cx, cy, hw, hh)
    out = []
    for i in range(n):
        t = (i + 0.5) / n
        x = S[0] + (E[0] - S[0]) * t
        y = S[1] + (E[1] - S[1]) * t
        out.append(rect(x - 1.4, y - h + 1, 2.8, h - 1, fill, 'rx="0.6"'))
        out.append(rect(x - 2.0, y - h + 0.2, 4.0, 1.6, fill))
    return "\n".join(out)


def windows(cx, cy, hw, hh, h, n, fill):
    W, S, E, N = diamond(cx, cy, hw, hh)
    out = []
    for i in range(n):
        t = (i + 0.5) / n
        x = S[0] + (E[0] - S[0]) * t
        y = S[1] + (E[1] - S[1]) * t
        out.append(rect(x - 1.2, y - h * 0.65, 2.4, 3.2, fill, 'stroke-width="0.6"'))
    return "\n".join(out)


def crenellations(cx, cy, hw, hh, h, fill):
    W, S, E, N = diamond(cx, cy, hw, hh)
    out = []
    for i in range(5):
        t = (i + 0.5) / 5
        x = S[0] + (E[0] - S[0]) * t
        y = S[1] + (E[1] - S[1]) * t - h
        out.append(poly([(x - 1.5, y), (x + 1.5, y - 0.75), (x + 1.5, y - 3.2), (x - 1.5, y - 2.45)], fill))
        x2 = W[0] + (S[0] - W[0]) * t
        y2 = W[1] + (S[1] - W[1]) * t - h
        out.append(poly([(x2 - 1.5, y2 - 0.75), (x2 + 1.5, y2), (x2 + 1.5, y2 - 2.45), (x2 - 1.5, y2 - 3.2)], fill))
    return "\n".join(out)


def tree(cx, cy, s=1.0):
    return "\n".join([
        rect(cx - 0.8 * s, cy - 6 * s, 1.6 * s, 6 * s, PAL["timber_dark"]),
        circle(cx, cy - 8 * s, 4.2 * s, PAL["leaf"]),
        circle(cx - 2.2 * s, cy - 6.5 * s, 2.8 * s, PAL["leaf_dark"]),
        circle(cx + 2 * s, cy - 6.2 * s, 2.6 * s, PAL["leaf"]),
    ])


def ground(fill=PAL["earth"]):
    return poly(diamond(AX, AY, HW, HH), fill, 'stroke-opacity="0.6"')


# ---------------------------------------------------------------- animation
KEYFRAMES = """
@keyframes anim-smoke { 0% { transform: translate(0,0); opacity: .9 } 100% { transform: translate(2px,-14px); opacity: 0 } }
@keyframes anim-flag { 0%,100% { transform: skewY(0deg) } 50% { transform: skewY(-6deg) } }
@keyframes anim-sway { 0%,100% { transform: rotate(-2deg) } 50% { transform: rotate(2deg) } }
@keyframes anim-glow { 0%,100% { opacity: .35 } 50% { opacity: .9 } }
@keyframes anim-hammer { 0%,100% { transform: rotate(0deg) } 40% { transform: rotate(-35deg) } }
@keyframes anim-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1.5px) } }
.anim-smoke { animation: anim-smoke 2.6s linear infinite; transform-box: fill-box; }
.anim-smoke.d1 { animation-delay: -0.9s } .anim-smoke.d2 { animation-delay: -1.8s }
.anim-flag { animation: anim-flag 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: 0% 50%; }
.anim-sway { animation: anim-sway 3s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
.anim-glow { animation: anim-glow 1.6s ease-in-out infinite; }
.anim-hammer { animation: anim-hammer 1.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 100% 100%; }
.anim-bob { animation: anim-bob 2s ease-in-out infinite; transform-box: fill-box; }
""".strip()


def smoke(x, y):
    return "\n".join(
        circle(x, y, 1.6 + 0.3 * i, PAL["smoke"], f'class="anim-smoke d{i}" stroke-width="0.5"' if i else 'class="anim-smoke" stroke-width="0.5"')
        for i in range(3)
    )


def flag(x, y, colour):
    return (rect(x - 0.4, y - 12, 0.8, 12, PAL["timber_dark"]) +
            poly([(x, y - 12), (x + 7, y - 10.5), (x, y - 9)], colour, 'class="anim-flag"'))


# ---------------------------------------------------------------- buildings
def draw(bid, tier):
    P = PAL
    parts = [ground()]
    anim = tier == 3

    if bid == "forum":
        h = [10, 16, 22][tier - 1]
        parts.append(box(AX, AY, HW * 0.9, HH * 0.9, h, P["wall_light"], P["wall_dark"], P["stone_light"], roof=True))
        parts.append(gable_roof(AX, AY, HW * 0.9, HH * 0.9, h, 5 + tier, P["terracotta_light"], P["terracotta_dark"], P["terracotta_shadow"]))
        parts.append(columns(AX, AY, HW * 0.9, HH * 0.9, h, 3 + tier * 2, P["stone_light"]))
        if tier >= 2:
            parts.append(windows(AX - 14, AY - 7, HW * 0.9, HH * 0.9, h, 3, P["ink"]))
        if anim:
            parts.append(flag(AX + 20, AY - 8 - h - 8, P["terracotta_dark"]))

    elif bid == "castellum":
        h = [12, 18, 24][tier - 1]
        parts.append(box(AX, AY, HW * 0.85, HH * 0.85, h, P["stone_light"], P["stone_dark"], P["stone_shadow"]))
        parts.append(crenellations(AX, AY, HW * 0.85, HH * 0.85, h, P["stone_light"]))
        if tier >= 2:  # corner tower
            parts.append(box(AX + 18, AY - 9, 7, 3.5, h + 8, P["stone_light"], P["stone_dark"], P["stone_shadow"]))
            parts.append(crenellations(AX + 18, AY - 9, 7, 3.5, h + 8, P["stone_light"]))
        if tier >= 3:
            parts.append(box(AX - 18, AY - 9, 7, 3.5, h + 8, P["stone_light"], P["stone_dark"], P["stone_shadow"]))
            parts.append(crenellations(AX - 18, AY - 9, 7, 3.5, h + 8, P["stone_light"]))
        # gate
        parts.append(poly([(AX + 2, AY + 11), (AX + 8, AY + 8), (AX + 8, AY + 8 - 7), (AX + 5, AY + 8 - 9), (AX + 2, AY + 11 - 7)], P["ink"]))
        if anim:
            parts.append(flag(AX + 18, AY - 9 - h - 8, P["terracotta_light"]))

    elif bid in ("warehouse", "granary"):
        h = [8, 12, 16][tier - 1]
        light, dark = (P["wall_light"], P["wall_dark"]) if bid == "warehouse" else (P["timber_light"], P["timber_dark"])
        parts.append(box(AX, AY, HW * 0.85, HH * 0.85, h, light, dark, P["stone_light"], roof=True))
        parts.append(gable_roof(AX, AY, HW * 0.85, HH * 0.85, h, 4 + tier, P["terracotta_light"], P["terracotta_dark"], P["terracotta_shadow"]))
        # door / vents
        parts.append(rect(AX + 6, AY + 4 - h * 0.6, 4, h * 0.6, P["ink"], 'stroke-width="0.6"'))
        for i in range(tier - 1):
            parts.append(rect(AX - 16 + i * 5, AY - 2 - h * 0.6, 3, 2, P["ink"], 'stroke-width="0.5"'))
        if bid == "granary":
            parts.append(poly([(AX - 24, AY + 2), (AX - 18, AY + 5), (AX - 18, AY - 2), (AX - 24, AY - 5)], P["grain"]))
        if anim and bid == "granary":
            parts.append(ellipse(AX - 21, AY - 6, 3, 1.5, P["grain"], 'class="anim-bob"'))
        if anim and bid == "warehouse":
            parts.append(rect(AX + 14, AY - 4 - h - 6, 1.2, h + 6, P["timber_dark"]))
            parts.append(line(AX + 14, AY - 4 - h - 6, AX + 24, AY - 4 - h - 2, 'class="anim-sway"'))

    elif bid == "cellars":
        h = [4, 6, 8][tier - 1]
        parts.append(box(AX, AY, HW * 0.6, HH * 0.6, h, P["earth"], P["earth_dark"], P["grass"]))
        # hatch
        parts.append(poly([(AX + 4, AY + 6), (AX + 12, AY + 2), (AX + 12, AY - 1), (AX + 4, AY + 3)], P["timber_dark"]))
        for i in range(tier):
            parts.append(ellipse(AX - 14 + i * 5, AY + 8 - i * 2, 2.2, 1.4, P["clay"], 'stroke-width="0.6"'))
        if anim:
            parts.append(circle(AX + 8, AY + 1, 1.2, P["gold"], 'class="anim-glow" stroke-width="0.4"'))

    elif bid == "insulae":
        h = [10, 16, 22][tier - 1]
        parts.append(box(AX, AY, HW * 0.85, HH * 0.85, h, P["wall_light"], P["wall_dark"], P["terracotta_dark"]))
        parts.append(windows(AX, AY, HW * 0.85, HH * 0.85, h, 2 + tier, P["ink"]))
        if tier >= 2:
            parts.append(windows(AX, AY, HW * 0.85, HH * 0.85, h * 0.5, 2 + tier, P["ink"]))
        if tier >= 3:
            parts.append(windows(AX, AY, HW * 0.85, HH * 0.85, h * 1.4, 2 + tier, P["ink"]))
        # balcony
        parts.append(line(AX, AY + 12 - h * 0.55, AX + 24, AY - h * 0.55, f'stroke="{P["timber_dark"]}"'))
        if anim:
            parts.append(smoke(AX - 6, AY - h - 5))

    elif bid == "market":
        h = [6, 9, 12][tier - 1]
        parts.append(box(AX, AY, HW * 0.8, HH * 0.8, h, P["wall_light"], P["wall_dark"], P["stone_light"], roof=True))
        parts.append(gable_roof(AX, AY, HW * 0.8, HH * 0.8, h, 3, P["timber_light"], P["timber_dark"], P["timber_shadow"]))
        parts.append(columns(AX, AY, HW * 0.8, HH * 0.8, h, 2 + tier, P["timber_light"]))
        # stalls
        for i in range(tier + 1):
            x = AX - 22 + i * 7
            parts.append(poly([(x, AY + 12 - i * 3), (x + 5, AY + 9.5 - i * 3), (x + 5, AY + 5 - i * 3), (x, AY + 7.5 - i * 3)], [P["terracotta_light"], P["gold"], P["river"] if "river" in P else P["water"], P["grass"]][i % 4]))
        if anim:
            parts.append(poly([(AX + 20, AY - 2 - h), (AX + 26, AY - 5 - h), (AX + 26, AY - 1 - h), (AX + 20, AY + 2 - h)], P["gold"], 'class="anim-flag"'))

    elif bid == "temple":
        h = [10, 14, 18][tier - 1]
        # podium
        parts.append(box(AX, AY, HW * 0.9, HH * 0.9, 3, P["stone_light"], P["stone_dark"], P["stone_light"]))
        parts.append(box(AX, AY - 3, HW * 0.7, HH * 0.7, h, P["wall_light"], P["wall_dark"], P["stone_light"], roof=True))
        parts.append(gable_roof(AX, AY - 3, HW * 0.7, HH * 0.7, h, 4 + tier, P["terracotta_light"], P["terracotta_dark"], P["terracotta_shadow"]))
        parts.append(columns(AX, AY - 3, HW * 0.7, HH * 0.7, h, 2 + tier * 2, P["stone_light"]))
        # altar
        parts.append(rect(AX + 16, AY + 2, 4, 3, P["stone_dark"]))
        if anim:
            parts.append(smoke(AX + 18, AY))

    elif bid == "waystation":
        h = [8, 11, 14][tier - 1]
        parts.append(box(AX + 4, AY - 2, HW * 0.6, HH * 0.6, h, P["wall_light"], P["wall_dark"], P["stone_light"], roof=True))
        parts.append(gable_roof(AX + 4, AY - 2, HW * 0.6, HH * 0.6, h, 4, P["terracotta_light"], P["terracotta_dark"], P["terracotta_shadow"]))
        # road
        parts.append(poly([(AX - 28, AY), (AX - 8, AY + 10), (AX - 2, AY + 7), (AX - 22, AY - 3)], P["stone_dark"], 'stroke-width="0.7"'))
        # milestone
        parts.append(rect(AX - 14, AY - 6, 2.5, 7, P["stone_light"]))
        if tier >= 2:
            parts.append(rect(AX - 24, AY - 8, 2, 8, P["timber_dark"]))
            parts.append(rect(AX - 24, AY - 8, 6, 2.5, P["timber_light"]))
        if anim:
            parts.append(poly([(AX - 24, AY - 8), (AX - 18, AY - 7), (AX - 18, AY - 5.5), (AX - 24, AY - 5.5)], P["gold"], 'class="anim-flag"'))

    elif bid == "lumber_camp":
        for i in range(tier + 1):
            parts.append(tree(AX - 18 + i * 6, AY - 6 + (i % 2) * 6, 0.9 + 0.15 * i))
        # log pile
        for i in range(2 + tier):
            parts.append(ellipse(AX + 10 + (i % 3) * 5, AY + 8 - (i // 3) * 3.5, 2.6, 1.8, P["timber_light"], 'stroke-width="0.7"'))
        if tier >= 2:
            parts.append(box(AX + 12, AY - 4, 9, 4.5, 6, P["timber_light"], P["timber_dark"], P["timber_shadow"]))
        if anim:
            parts.append(line(AX + 14, AY + 2, AX + 18, AY - 5, 'class="anim-hammer"'))

    elif bid == "clay_works":
        parts.append(ellipse(AX - 8, AY + 3, 14, 7, P["clay"], 'stroke-width="0.8"'))
        parts.append(ellipse(AX - 8, AY + 3, 9, 4.5, P["terracotta_shadow"], 'stroke-width="0.6"'))
        for i in range(tier + 1):
            parts.append(ellipse(AX + 12 + i * 4, AY - 2 + (i % 2) * 4, 2, 2.6, P["terracotta_light"], 'stroke-width="0.6"'))
        if tier >= 2:  # kiln
            parts.append(box(AX + 14, AY - 8, 6, 3, 7, P["stone_light"], P["stone_dark"], P["stone_shadow"]))
            parts.append(circle(AX + 16, AY - 4, 1.5, P["ink"], 'stroke-width="0.4"'))
        if anim:
            parts.append(smoke(AX + 14, AY - 16))

    elif bid == "iron_mine":
        parts.append(poly([(AX - 24, AY + 2), (AX - 4, AY + 12), (AX + 20, AY - 2), (AX + 4, AY - 14), (AX - 14, AY - 10)], P["stone_dark"]))
        parts.append(poly([(AX - 6, AY + 8), (AX + 2, AY + 4), (AX + 2, AY - 4), (AX - 2, AY - 6), (AX - 6, AY - 0)], P["ink"]))
        parts.append(rect(AX - 6.5, AY - 1, 1.5, 9, P["timber_light"]))
        parts.append(rect(AX + 1.5, AY - 5, 1.5, 9, P["timber_light"]))
        for i in range(tier):
            parts.append(circle(AX + 10 + i * 4, AY + 6 - i * 1.5, 2, P["iron"], 'stroke-width="0.6"'))
        if tier >= 2:
            parts.append(rect(AX - 22, AY - 12, 2, 10, P["timber_dark"]))
            parts.append(line(AX - 21, AY - 12, AX - 10, AY - 8))
        if anim:
            parts.append(rect(AX - 16, AY - 12, 3, 3, P["timber_light"], 'class="anim-bob"'))

    elif bid == "farm":
        W, S, E, N = diamond(AX, AY, HW, HH)
        parts.append(poly(diamond(AX, AY, HW * 0.95, HH * 0.95), P["grass"], 'stroke-width="0.6"'))
        for i in range(1, 5 + tier):
            t = i / (5 + tier)
            a = (W[0] + (N[0] - W[0]) * t, W[1] + (N[1] - W[1]) * t)
            b = (S[0] + (E[0] - S[0]) * t, S[1] + (E[1] - S[1]) * t)
            parts.append(line(a[0], a[1], b[0], b[1], f'stroke="{P["earth_dark"]}" stroke-width="0.8"'))
        if tier >= 2:
            parts.append(box(AX + 16, AY - 8, 7, 3.5, 6, P["wall_light"], P["wall_dark"], P["terracotta_dark"]))
        if tier >= 3:
            for i in range(3):
                parts.append(ellipse(AX - 16 + i * 6, AY + 4 - i * 3, 2.6, 2, P["grain"], 'stroke-width="0.5"'))
        if anim:
            parts.append(ellipse(AX - 6, AY - 6, 3, 1.4, P["grain"], 'class="anim-sway" stroke-width="0.5"'))

    else:
        parts.append(box(AX, AY, HW * 0.8, HH * 0.8, 8 * tier, P["wall_light"], P["wall_dark"], P["stone_light"]))

    style = f"<style>{KEYFRAMES}</style>\n" if anim else ""
    body = "\n".join(parts)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" '
            f'data-building="{bid}" data-tier="{tier}" data-ax="{AX}" data-ay="{AY}">\n{style}{body}\n</svg>\n')


def main():
    data = json.load(open(DATA))
    os.makedirs(OUT, exist_ok=True)
    n = 0
    for b in data["buildings"]:
        for tier in range(1, len(b["tiers"]) + 1):
            svg = draw(b["id"], tier)
            assert "<path" not in svg, f"bezier/path in {b['id']} t{tier}"
            with open(os.path.join(OUT, f"{b['id']}_t{tier}.svg"), "w") as f:
                f.write(svg)
            n += 1
    print(f"wrote {n} sprites to {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
