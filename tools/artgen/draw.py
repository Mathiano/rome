#!/usr/bin/env python3
"""
artgen/draw.py — Claude-drawn building sprites in the style anchor's grammar.

Each building tier is composed as an isometric scene on an 8×8 ground plate,
emitted as SVG, rasterised with cairosvg, then pushed through tools/artgen's
keying/trim/anchor/scale pipeline like any other sprite. The plate assertion in
build.py therefore checks this module's own geometry: if a drawn plate is not a
true 2:1 diamond, the build fails rather than shipping a mis-anchored sprite.

Grammar (docs/DESIGN.md §10, tools/artgen/palette.json):
  * terracotta roofs, travertine and plaster walls, timber frames, ink outlines
  * light from the upper left: top faces lightest, left faces mid, right darkest
  * one structure per plate, standing on packed earth with paving and grass
  * tier reads at a glance: timber → stone, thatch → tile, added storeys, more
    stock in the yard

Scene coordinates are grid units on the plate: +x runs to the screen right and
down, +y to the screen left and down, +z up. The plate spans (0,0)..(8,8).
"""
import argparse
import json
import math
import os
import sys
import tempfile
from contextlib import contextmanager

import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build as artgen  # noqa: E402

ROOT = artgen.ROOT
PAL = json.load(open(os.path.join(HERE, "palette.json")))

TILE_W, TILE_H, Z_UNIT = 128.0, 64.0, 74.0
PLATE_N = 8
PLATE_EDGE = 0.10          # visible thickness of the ground slab, in z units
INK = PAL["ink"]
W_MAIN, W_DETAIL, W_HAIR = 5.0, 2.6, 1.6
VIEWBOX = (-640, -760, 1280, 1120)


# ----------------------------------------------------------------- geometry
def iso(gx, gy, gz=0.0):
    return ((gx - gy) * TILE_W / 2,
            (gx + gy) * TILE_H / 2 - gz * Z_UNIT - PLATE_N * TILE_H / 2)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def shade(col, f):
    r, g, b = (int(col[i:i + 2], 16) for i in (1, 3, 5))
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(c * f))) for c in (r, g, b))


MAT = {
    "plaster": ("plaster_light", "plaster_mid", "plaster_dark"),
    "stone": ("stone_light", "stone_mid", "stone_dark"),
    "timber": ("timber_light", "timber_mid", "timber_dark"),
    "timberdark": ("timber_mid", "timber_dark", "timber_deep"),
    "earth": ("earth_light", "earth_mid", "earth_dark"),
    "roof": ("roof_light", "roof_mid", "roof_dark"),
    "iron": ("iron", "iron", "iron"),
    "leaf": ("leaf_light", "leaf_mid", "leaf_dark"),
}


def faces(mat):
    a, b, c = MAT[mat]
    return PAL[a], PAL[b], PAL[c]


# ----------------------------------------------------------------- emitting
def pts(seq):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in seq)


def poly(seq, fill, w=W_MAIN, stroke=INK, extra=""):
    s = f' stroke="{stroke}" stroke-width="{w}" stroke-linejoin="round"' if w else ' stroke="none"'
    return f'<polygon points="{pts(seq)}" fill="{fill}"{s}{extra}/>'


def line(a, b, col=INK, w=W_DETAIL, extra=""):
    return (f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" '
            f'stroke="{col}" stroke-width="{w}" stroke-linecap="round"{extra}/>')


def polyline(seq, col=INK, w=W_DETAIL, fill="none", extra=""):
    return (f'<polyline points="{pts(seq)}" fill="{fill}" stroke="{col}" stroke-width="{w}" '
            f'stroke-linejoin="round" stroke-linecap="round"{extra}/>')


def ellipse(c, rx, ry, fill, w=W_DETAIL, stroke=INK, extra=""):
    s = f' stroke="{stroke}" stroke-width="{w}"' if w else ' stroke="none"'
    return f'<ellipse cx="{c[0]:.1f}" cy="{c[1]:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{fill}"{s}{extra}/>'


def circle(c, r, fill, w=W_DETAIL, stroke=INK, extra=""):
    s = f' stroke="{stroke}" stroke-width="{w}"' if w else ' stroke="none"'
    return f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r:.1f}" fill="{fill}"{s}{extra}/>'


class Scene:
    """Collects drawables and paints them back to front (painter's algorithm).

    Sorting by ground depth alone is wrong for a composite structure: a temple's
    podium has a nearer footprint than the colonnade standing on it, so it would
    paint over its own columns. `group()` gives every part one depth and paints
    them in the order the building draws them, which is the order the author
    knows to be right.
    """

    def __init__(self):
        self.items = []
        self.anims = []
        self._group = None

    def anim(self, kind, gx, gy, gz=0.0, scale=1.0):
        """Mark an animated feature (DESIGN §10, tier 3 only). Stored in viewBox
        coordinates; draw.py converts to anchor-relative sprite pixels once the
        sprite has been trimmed and scaled."""
        vx, vy = iso(gx, gy, gz)
        self.anims.append({"kind": kind, "vx": vx, "vy": vy, "scale": scale})

    @contextmanager
    def group(self, depth):
        prev, self._group = self._group, depth
        try:
            yield
        finally:
            self._group = prev

    def add(self, depth, svg, z=0.0):
        if self._group is not None:
            self.items.append((self._group, 0.0, len(self.items), svg))
        else:
            self.items.append((depth, z, len(self.items), svg))

    def svg(self):
        body = "\n".join(s for _, _, _, s in sorted(self.items, key=lambda t: (t[0], t[1], t[2])))
        x, y, w, h = VIEWBOX
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" '
                f'width="{w}" height="{h}">\n'
                f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#ffffff"/>\n'
                f'{body}\n</svg>\n')


# --------------------------------------------------------------- primitives
def box(sc, x0, y0, x1, y1, z0, z1, mat="plaster", top=True, depth=None, tint=1.0, w=W_MAIN):
    """An isometric cuboid. Visible faces: left (y=y1), right (x=x1), top."""
    lt, md, dk = (shade(c, tint) for c in faces(mat))
    N, E, S, W = (x0, y0), (x1, y0), (x1, y1), (x0, y1)
    b = {p: iso(p[0], p[1], z0) for p in (N, E, S, W)}
    t = {p: iso(p[0], p[1], z1) for p in (N, E, S, W)}
    d = x1 + y1 if depth is None else depth
    sc.add(d, poly([b[W], b[S], t[S], t[W]], md, w), z0)
    sc.add(d, poly([b[S], b[E], t[E], t[S]], dk, w), z0)
    if top:
        sc.add(d, poly([t[N], t[E], t[S], t[W]], lt, w), z1)
    return d


def wall_courses(sc, x0, y0, x1, y1, z0, z1, rows=4, depth=None, col=None):
    """Horizontal masonry courses on the two visible faces of a box."""
    col = col or shade(PAL["stone_dark"], 0.9)
    d = (x1 + y1 if depth is None else depth) + 0.001
    for i in range(1, rows):
        z = z0 + (z1 - z0) * i / rows
        sc.add(d, line(iso(x0, y1, z), iso(x1, y1, z), col, W_HAIR), z)
        sc.add(d, line(iso(x1, y1, z), iso(x1, y0, z), col, W_HAIR), z)


def stone_blocks(sc, x0, y0, x1, y1, z0, z1, rows=4, depth=None, col=None):
    """Staggered ashlar on the two visible faces."""
    col = col or shade(PAL["stone_dark"], 0.88)
    d = (x1 + y1 if depth is None else depth) + 0.001
    for i in range(rows):
        za, zb = z0 + (z1 - z0) * i / rows, z0 + (z1 - z0) * (i + 1) / rows
        if i:
            sc.add(d, line(iso(x0, y1, za), iso(x1, y1, za), col, W_HAIR), za)
            sc.add(d, line(iso(x1, y1, za), iso(x1, y0, za), col, W_HAIR), za)
        n = 4
        for j in range(1, n):
            t = (j + (0.5 if i % 2 else 0.0)) / n
            if t >= 1:
                continue
            gx = x0 + (x1 - x0) * t
            sc.add(d, line(iso(gx, y1, za), iso(gx, y1, zb), col, W_HAIR), za)
            gy = y0 + (y1 - y0) * t
            sc.add(d, line(iso(x1, gy, za), iso(x1, gy, zb), col, W_HAIR), za)


def plank_lines(sc, x0, y0, x1, y1, z0, z1, n=5, depth=None, col=None):
    """Vertical planking on the two visible faces."""
    col = col or PAL["timber_deep"]
    d = (x1 + y1 if depth is None else depth) + 0.001
    for i in range(1, n):
        t = i / n
        gx = x0 + (x1 - x0) * t
        sc.add(d, line(iso(gx, y1, z0), iso(gx, y1, z1), col, W_HAIR), z0)
        gy = y0 + (y1 - y0) * t
        sc.add(d, line(iso(x1, gy, z0), iso(x1, gy, z1), col, W_HAIR), z0)


def slope_texture(sc, a, b, c, d_, depth, rows=5, cols=12, col=None, z=0.0):
    """Tile grid across a roof slope. a-b is the eave, d_-c the ridge."""
    col = col or PAL["roof_deep"]
    for i in range(1, rows):
        t = i / rows
        sc.add(depth + 0.002, line(lerp(a, d_, t), lerp(b, c, t), col, W_HAIR), z)
    for j in range(1, cols):
        t = j / cols
        sc.add(depth + 0.002, line(lerp(a, b, t), lerp(d_, c, t), col, W_HAIR), z)


def gable(sc, x0, y0, x1, y1, z_eave, rise, axis="x", mat="roof", ov=0.28, depth=None, gable_mat=None):
    """Gabled roof. axis='x': ridge runs along +x, slopes face ±y."""
    lt, md, dk = faces(mat)
    X0, X1, Y0, Y1 = x0 - ov, x1 + ov, y0 - ov, y1 + ov
    zr = z_eave + rise
    d = (x1 + y1 if depth is None else depth) + 0.2
    if axis == "x":
        ym = (Y0 + Y1) / 2
        nA, nB = iso(X0, Y1, z_eave), iso(X1, Y1, z_eave)
        nC, nD = iso(X1, ym, zr), iso(X0, ym, zr)
        fA, fB = iso(X0, Y0, z_eave), iso(X1, Y0, z_eave)
        sc.add(d, poly([fA, fB, nC, nD], dk, W_MAIN), zr)
        slope_texture(sc, fA, fB, nC, nD, d, 4, 12, z=zr)
        sc.add(d, poly([nA, nB, nC, nD], lt, W_MAIN), zr)
        slope_texture(sc, nA, nB, nC, nD, d, 5, 14, z=zr)
        gm = gable_mat or "plaster"
        gl, gmd, gdk = faces(gm)
        sc.add(d, poly([iso(X0, Y0, z_eave), iso(X0, Y1, z_eave), nD], gmd, W_MAIN), zr)
        sc.add(d, poly([iso(X1, Y0, z_eave), iso(X1, Y1, z_eave), nC], gdk, W_MAIN), zr)
        sc.add(d, line(nD, nC, PAL["roof_deep"], W_DETAIL), zr)
    else:
        xm = (X0 + X1) / 2
        nA, nB = iso(X1, Y0, z_eave), iso(X1, Y1, z_eave)
        nC, nD = iso(xm, Y1, zr), iso(xm, Y0, zr)
        fA, fB = iso(X0, Y0, z_eave), iso(X0, Y1, z_eave)
        sc.add(d, poly([fA, fB, nC, nD], md, W_MAIN), zr)
        slope_texture(sc, fA, fB, nC, nD, d, 4, 12, z=zr)
        sc.add(d, poly([nA, nB, nC, nD], dk, W_MAIN), zr)
        slope_texture(sc, nA, nB, nC, nD, d, 5, 14, z=zr)
        gm = gable_mat or "plaster"
        gl, gmd, gdk = faces(gm)
        sc.add(d, poly([iso(X0, Y0, z_eave), iso(X1, Y0, z_eave), nD], gl, W_MAIN), zr)
        sc.add(d, poly([iso(X0, Y1, z_eave), iso(X1, Y1, z_eave), nC], gmd, W_MAIN), zr)
        sc.add(d, line(nD, nC, PAL["roof_deep"], W_DETAIL), zr)


def hip_roof(sc, x0, y0, x1, y1, z_eave, rise, mat="roof", ov=0.3, depth=None, inset=0.9):
    """Four-sided hipped roof with a short ridge."""
    lt, md, dk = faces(mat)
    X0, X1, Y0, Y1 = x0 - ov, x1 + ov, y0 - ov, y1 + ov
    zr = z_eave + rise
    cx0, cx1 = X0 + (X1 - X0) * 0.5 - inset / 2, X0 + (X1 - X0) * 0.5 + inset / 2
    cy = (Y0 + Y1) / 2
    d = (x1 + y1 if depth is None else depth) + 0.2
    R0, R1 = iso(cx0, cy, zr), iso(cx1, cy, zr)
    eN0, eN1 = iso(X0, Y0, z_eave), iso(X1, Y0, z_eave)
    eS0, eS1 = iso(X0, Y1, z_eave), iso(X1, Y1, z_eave)
    sc.add(d, poly([eN0, eN1, R1, R0], dk, W_MAIN), zr)          # far slope
    slope_texture(sc, eN0, eN1, R1, R0, d, 4, 11, z=zr)
    sc.add(d, poly([eN0, eS0, R0], md, W_MAIN), zr)              # left hip
    sc.add(d, poly([eN1, eS1, R1], shade(dk, 0.92), W_MAIN), zr)  # right hip
    sc.add(d, poly([eS0, eS1, R1, R0], lt, W_MAIN), zr)          # near slope
    slope_texture(sc, eS0, eS1, R1, R0, d, 5, 13, z=zr)
    sc.add(d, line(R0, R1, PAL["roof_deep"], W_DETAIL), zr)


def column(sc, gx, gy, z0, z1, r=0.16, mat="stone", flutes=True):
    lt, md, dk = faces(mat)
    w = r * TILE_W
    b, t = iso(gx, gy, z0), iso(gx, gy, z1)
    d = gx + gy + 0.05
    sc.add(d, poly([(b[0] - w, b[1]), (b[0] + w, b[1]), (t[0] + w, t[1]), (t[0] - w, t[1])], md, W_DETAIL), z0)
    sc.add(d, poly([(b[0], b[1]), (b[0] + w, b[1]), (t[0] + w, t[1]), (t[0], t[1])], dk, 0), z0)
    if flutes:
        for f in (-0.45, 0.1):
            sc.add(d + 0.001, line((b[0] + w * f, b[1] - 4), (t[0] + w * f, t[1] + 6), shade(md, 0.82), W_HAIR), z0)
    sc.add(d, ellipse(t, w * 1.05, w * 0.42, lt, W_DETAIL), z1)
    sc.add(d, poly([(t[0] - w * 1.3, t[1] - w * 0.2), (t[0] + w * 1.3, t[1] - w * 0.2),
                    (t[0] + w * 1.3, t[1] - w * 0.75), (t[0] - w * 1.3, t[1] - w * 0.75)], lt, W_DETAIL), z1)
    sc.add(d, poly([(b[0] - w * 1.25, b[1] + w * 0.2), (b[0] + w * 1.25, b[1] + w * 0.2),
                    (b[0] + w * 1.25, b[1] - w * 0.3), (b[0] - w * 1.25, b[1] - w * 0.3)], md, W_DETAIL), z0)


def arch_pts(xl, xr, y_spring, rise, seg=9):
    """Polyline approximation of a semicircular arch (no beziers, per CLAUDE.md)."""
    cx, rx = (xl + xr) / 2, (xr - xl) / 2
    out = []
    for i in range(seg + 1):
        a = math.pi * i / seg
        out.append((cx - rx * math.cos(a), y_spring - rise * math.sin(a)))
    return out


def archway(sc, gx, gy, z0, z1, width=0.7, depth_off=0.0, mat="stone", dark=None):
    """An arched opening seen on a face running along +x at constant y=gy."""
    lt, md, dk = faces(mat)
    a, b = iso(gx - width / 2, gy, z0), iso(gx + width / 2, gy, z0)
    spring = z0 + (z1 - z0) * 0.55
    ya = iso(gx, gy, spring)[1]
    rise = (iso(gx, gy, z1)[1] - ya) * 0.95
    top = arch_pts(a[0], b[0], ya, -rise)
    shape = [a, (a[0], ya)] + top + [(b[0], ya), b]
    d = gx + gy + 0.06 + depth_off
    sc.add(d, poly(shape, dark or PAL["timber_deep"], W_DETAIL), z0)
    sc.add(d + 0.001, polyline([(a[0], ya)] + top + [(b[0], ya)], shade(lt, 1.0), W_DETAIL), z0)


# -------------------------------------------------------------------- props
def barrel(sc, gx, gy, z=0.0, h=0.34, r=0.13):
    c = iso(gx, gy, z)
    t = iso(gx, gy, z + h)
    w = r * TILE_W
    d = gx + gy + 0.1
    body = [(c[0] - w * 0.82, c[1]), (c[0] - w, (c[1] + t[1]) / 2), (c[0] - w * 0.82, t[1]),
            (c[0] + w * 0.82, t[1]), (c[0] + w, (c[1] + t[1]) / 2), (c[0] + w * 0.82, c[1])]
    sc.add(d, poly(body, PAL["timber_light"], W_DETAIL), z)
    for f in (0.3, 0.7):
        yy = c[1] + (t[1] - c[1]) * f
        sc.add(d + 0.001, line((c[0] - w * 0.96, yy), (c[0] + w * 0.96, yy), PAL["iron"], W_HAIR), z)
    sc.add(d, ellipse(t, w * 0.82, w * 0.34, PAL["timber_mid"], W_DETAIL), z + h)


def amphora(sc, gx, gy, z=0.0, h=0.4):
    c = iso(gx, gy, z)
    w = 0.09 * TILE_W
    top = (c[0], c[1] - h * Z_UNIT)
    d = gx + gy + 0.1
    body = [(c[0], c[1]), (c[0] - w, c[1] - h * Z_UNIT * 0.45), (c[0] - w * 0.75, c[1] - h * Z_UNIT * 0.78),
            (c[0] - w * 0.3, top[1]), (c[0] + w * 0.3, top[1]),
            (c[0] + w * 0.75, c[1] - h * Z_UNIT * 0.78), (c[0] + w, c[1] - h * Z_UNIT * 0.45)]
    sc.add(d, poly(body, PAL["roof_mid"], W_DETAIL), z)
    for s in (-1, 1):
        sc.add(d + 0.001, polyline([(c[0] + s * w * 0.4, top[1] + 4),
                                    (c[0] + s * w * 1.1, c[1] - h * Z_UNIT * 0.72),
                                    (c[0] + s * w * 0.72, c[1] - h * Z_UNIT * 0.5)], PAL["roof_dark"], W_HAIR), z)


def crate(sc, gx, gy, z=0.0, s=0.3, h=0.26):
    box(sc, gx, gy, gx + s, gy + s, z, z + h, "timber", w=W_DETAIL)
    a, b = iso(gx, gy + s, z), iso(gx + s, gy + s, z + h)
    sc.add(gx + gy + s + 0.002, line(a, b, PAL["timber_deep"], W_HAIR), z)
    a2, b2 = iso(gx, gy + s, z + h), iso(gx + s, gy + s, z)
    sc.add(gx + gy + s + 0.002, line(a2, b2, PAL["timber_deep"], W_HAIR), z)


def sack(sc, gx, gy, z=0.0, s=1.0):
    c = iso(gx, gy, z)
    w, hh = 0.11 * TILE_W * s, 0.26 * Z_UNIT * s
    d = gx + gy + 0.1
    sc.add(d, poly([(c[0] - w, c[1]), (c[0] - w * 0.8, c[1] - hh), (c[0] - w * 0.25, c[1] - hh * 1.2),
                    (c[0] + w * 0.25, c[1] - hh * 1.2), (c[0] + w * 0.8, c[1] - hh),
                    (c[0] + w, c[1])], PAL["grain"], W_DETAIL), z)


def log_pile(sc, gx, gy, rows=3, per=4, z=0.0, r=0.11):
    """Stacked logs seen end-on, receding along +y."""
    w = r * TILE_W
    for row in range(rows):
        n = per - row
        for i in range(n):
            cx = gx + (i + row * 0.5) * r * 2.05
            cy = gy
            c = iso(cx, cy, z + row * r * 1.75)
            d = cx + cy + 0.12 + row * 0.01
            sc.add(d, poly([(c[0] - w, c[1] - w * 0.55), (c[0] - w * 0.55, c[1] - w * 1.15),
                            (c[0] + w * 0.55, c[1] - w * 1.15), (c[0] + w, c[1] - w * 0.55),
                            (c[0] + w * 0.55, c[1]), (c[0] - w * 0.55, c[1])], PAL["timber_light"], W_DETAIL),
                   z + row)
            sc.add(d + 0.001, ellipse((c[0], c[1] - w * 0.57), w * 0.42, w * 0.34, PAL["timber_mid"], W_HAIR),
                   z + row)


def pine(sc, gx, gy, z=0.0, h=1.5, tiers=4):
    c = iso(gx, gy, z)
    d = gx + gy + 0.15
    tw = 0.06 * TILE_W
    sc.add(d, poly([(c[0] - tw, c[1]), (c[0] + tw, c[1]),
                    (c[0] + tw * 0.7, c[1] - h * Z_UNIT * 0.35), (c[0] - tw * 0.7, c[1] - h * Z_UNIT * 0.35)],
                   PAL["timber_mid"], W_DETAIL), z)
    for i in range(tiers):
        f = i / tiers
        base_y = c[1] - h * Z_UNIT * (0.28 + 0.62 * f)
        half = 0.30 * TILE_W * (1 - f * 0.62)
        tip = base_y - h * Z_UNIT * 0.30 * (1 - f * 0.35)
        col = PAL["leaf_mid"] if i % 2 else PAL["leaf_light"]
        sc.add(d + i * 0.002, poly([(c[0] - half, base_y), (c[0] + half, base_y), (c[0], tip)], col, W_DETAIL), z)


def bush(sc, gx, gy, z=0.0, s=1.0):
    c = iso(gx, gy, z)
    d = gx + gy + 0.12
    r = 0.13 * TILE_W * s
    sc.add(d, circle((c[0], c[1] - r * 0.5), r, PAL["leaf_mid"], W_DETAIL), z)
    sc.add(d + 0.001, circle((c[0] - r * 0.6, c[1] - r * 0.2), r * 0.7, PAL["leaf_dark"], W_HAIR), z)
    sc.add(d + 0.001, circle((c[0] + r * 0.55, c[1] - r * 0.3), r * 0.62, PAL["leaf_light"], W_HAIR), z)


def tuft(sc, gx, gy, z=0.0):
    c = iso(gx, gy, z)
    d = gx + gy + 0.05
    for off, hh in ((-6, 13), (0, 18), (6, 12)):
        sc.add(d, line((c[0] + off, c[1]), (c[0] + off * 1.5, c[1] - hh), PAL["leaf_mid"], W_HAIR), z)


GROUND = -90.0


def paving(sc, x0, y0, x1, y1, z=0.0, nx=4, ny=4):
    """A patch of stone slabs laid on the plate."""
    d = GROUND
    sc.add(d, poly([iso(x0, y0, z), iso(x1, y0, z), iso(x1, y1, z), iso(x0, y1, z)],
                   PAL["stone_light"], W_DETAIL), z)
    for i in range(1, nx):
        t = i / nx
        sc.add(d + 0.001, line(iso(x0 + (x1 - x0) * t, y0, z), iso(x0 + (x1 - x0) * t, y1, z),
                               PAL["stone_dark"], W_HAIR), z)
    for j in range(1, ny):
        t = j / ny
        sc.add(d + 0.001, line(iso(x0, y0 + (y1 - y0) * t, z), iso(x1, y0 + (y1 - y0) * t, z),
                               PAL["stone_dark"], W_HAIR), z)


def road(sc, y0, y1, z=0.0):
    """A packed road crossing the plate along +x."""
    d = GROUND
    sc.add(d, poly([iso(0, y0, z), iso(8, y0, z), iso(8, y1, z), iso(0, y1, z)],
                   shade(PAL["stone_mid"], 1.06), W_DETAIL), z)
    for i in range(1, 9):
        sc.add(d + 0.001, line(iso(i, y0, z), iso(i, y1, z), PAL["stone_dark"], W_HAIR), z)


def furrows(sc, x0, y0, x1, y1, z=0.0, n=9, col=None):
    d = GROUND
    col = col or PAL["earth_dark"]
    sc.add(d, poly([iso(x0, y0, z), iso(x1, y0, z), iso(x1, y1, z), iso(x0, y1, z)],
                   PAL["earth_light"], W_DETAIL), z)
    for i in range(1, n):
        t = i / n
        sc.add(d + 0.001, line(iso(x0, y0 + (y1 - y0) * t, z), iso(x1, y0 + (y1 - y0) * t, z), col, W_HAIR), z)


def smoke_puffs(sc, gx, gy, z, n=3):
    c = iso(gx, gy, z)
    d = gx + gy + 0.3
    for i in range(n):
        r = 4.5 + i * 2.6
        sc.add(d, circle((c[0] + i * 7 - 4, c[1] - 10 - i * 17), r, PAL["smoke"], 0,
                         extra=f' fill-opacity="{0.62 - i * 0.14:.2f}"'), z + 9)


def plate(sc, paved=True):
    """The ground plate: an 8×8 slab of packed earth with a visible edge."""
    z = 0.0
    N, E, S, W = iso(0, 0, z), iso(8, 0, z), iso(8, 8, z), iso(0, 8, z)
    Nb, Eb, Sb, Wb = (iso(0, 0, -PLATE_EDGE), iso(8, 0, -PLATE_EDGE),
                      iso(8, 8, -PLATE_EDGE), iso(0, 8, -PLATE_EDGE))
    # The colony now draws one continuous floor under every plot
    # (src/render/environment.ts), so a plate outlined in ink turned the town
    # into a quilt of tiles. The plate keeps its geometry — the anchor is
    # measured from it — but reads as worked ground, not as a separate object.
    sc.add(-100, poly([W, S, Sb, Wb], shade(PAL["earth_mid"], 0.94), W_HAIR,
                      stroke=shade(PAL["earth_dark"], 0.9)), -1)
    sc.add(-100, poly([S, E, Eb, Sb], shade(PAL["earth_dark"], 0.9), W_HAIR,
                      stroke=shade(PAL["earth_dark"], 0.9)), -1)
    sc.add(-100, poly([N, E, S, W], PAL["earth_light"], W_HAIR,
                      stroke=shade(PAL["earth_mid"], 0.9)), -1)
    # mottling: a few faint patches of darker earth
    for gx, gy, r in ((2.2, 5.4, 1.1), (5.6, 2.4, 0.9), (4.0, 6.2, 0.7), (6.4, 5.6, 0.8)):
        c = iso(gx, gy, z)
        sc.add(-99, ellipse(c, r * TILE_W * 0.42, r * TILE_H * 0.42, shade(PAL["earth_mid"], 1.06), 0,
                              extra=' fill-opacity="0.35"'), -1)
    if paved:
        paving(sc, 0.35, 5.6, 2.1, 7.5, z, 3, 4)
    for gx, gy in ((0.5, 1.2), (7.4, 1.0), (1.0, 7.3), (7.6, 6.8), (7.7, 3.4), (0.4, 3.9), (3.2, 7.6), (6.0, 7.7)):
        tuft(sc, gx, gy)
    for gx, gy, s in ((0.7, 2.5, 0.8), (7.5, 5.2, 0.7)):
        bush(sc, gx, gy, 0, s)


# --------------------------------------------------------- larger furniture
def steps(sc, x0, y0, x1, y0b, n=3, z0=0.0, rise=0.14, mat="stone"):
    """A flight of steps climbing along -y toward the podium at y0b."""
    for i in range(n):
        t0 = y0 + (y0b - y0) * (i / n)
        t1 = y0 + (y0b - y0) * ((i + 1) / n)
        box(sc, x0, t1, x1, t0, z0, z0 + rise * (i + 1), mat, w=W_DETAIL, depth=x1 + t0)


def palisade(sc, x0, y0, x1, y1, z0=0.0, h=0.62, n=12, mat="timberdark"):
    """A run of pointed timber posts from (x0,y0) to (x1,y1)."""
    lt, md, dk = faces(mat)
    for i in range(n):
        t_ = (i + 0.5) / n
        gx, gy = x0 + (x1 - x0) * t_, y0 + (y1 - y0) * t_
        b, t = iso(gx, gy, z0), iso(gx, gy, z0 + h)
        w = 0.055 * TILE_W
        sc.add(gx + gy + 0.05, poly([(b[0] - w, b[1]), (b[0] + w, b[1]), (t[0] + w, t[1] + 5),
                                     (t[0], t[1] - 5), (t[0] - w, t[1] + 5)], md, W_DETAIL), z0)


def mound(sc, gx, gy, rx=2.0, ry=1.7, h=1.3, seg=18):
    """A grassed earth mound: silhouette is a dome over the footprint ellipse."""
    d = gx + gy + ry / 2
    base = iso(gx, gy, 0)
    hw, hh, H = rx * TILE_W / 2, ry * TILE_H / 2, h * Z_UNIT
    crest = [(base[0] - hw * math.cos(math.pi * i / seg), base[1] - H * math.sin(math.pi * i / seg))
             for i in range(seg + 1)]
    front = [(base[0] + hw * math.cos(math.pi * i / seg), base[1] + hh * math.sin(math.pi * i / seg))
             for i in range(seg + 1)]
    sc.add(d, poly(crest + front, shade(PAL["earth_light"], 1.07), W_MAIN), 0)
    # volume: a shaded crescent down the right flank, lit ground on the upper left
    right = [crest[i] for i in range(seg // 2, seg + 1)]
    inner = [(base[0] + (p[0] - base[0]) * 0.52, base[1] + (p[1] - base[1]) * 0.52) for p in reversed(right)]
    sc.add(d + 0.01, poly(right + inner, PAL["earth_dark"], 0,
                          extra=' fill-opacity="0.42"'), 0)
    sc.add(d + 0.01, ellipse((base[0] - hw * 0.34, base[1] - H * 0.58), hw * 0.4, hh * 0.62,
                             "#ffffff", 0, extra=' fill-opacity="0.22"'), 0)
    for i in range(1, seg, 2):
        p = crest[i]
        sc.add(d + 0.02, line((p[0], p[1] + 7), (p[0] + 5, p[1] - 10),
                              PAL["leaf_mid"] if i % 4 else PAL["leaf_dark"], W_HAIR), 0)


def crenels(sc, x0, y0, x1, y1, z, mat="stone", n=6):
    lt, md, dk = faces(mat)
    for i in range(n):
        t0, t1 = i / n, (i + 0.42) / n
        gx0, gx1 = x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1
        box(sc, gx0, y0, gx1, y1, z, z + 0.16, mat, w=W_DETAIL, depth=gx1 + y1 + 0.02)


def banner(sc, gx, gy, z, h=0.75, col=None):
    b, t = iso(gx, gy, z), iso(gx, gy, z + h)
    d = gx + gy + 0.4
    sc.add(d, line(b, t, PAL["timber_deep"], W_DETAIL), z + h)
    c = col or PAL["roof_dark"]
    sc.add(d, poly([(t[0], t[1]), (t[0] + 46, t[1] + 8), (t[0] + 40, t[1] + 34), (t[0], t[1] + 40)], c, W_DETAIL), z + h)


def statue(sc, gx, gy, z=0.0):
    box(sc, gx - 0.22, gy - 0.22, gx + 0.22, gy + 0.22, z, z + 0.36, "stone", w=W_DETAIL)
    c = iso(gx, gy, z + 0.36)
    d = gx + gy + 0.3
    sc.add(d, poly([(c[0] - 13, c[1]), (c[0] + 13, c[1]), (c[0] + 9, c[1] - 46), (c[0] - 9, c[1] - 46)],
                   PAL["plaster_light"], W_DETAIL), z + 0.5)
    sc.add(d, circle((c[0], c[1] - 56), 11, PAL["plaster_light"], W_DETAIL), z + 0.6)


def well(sc, gx, gy, z=0.0):
    box(sc, gx - 0.28, gy - 0.28, gx + 0.28, gy + 0.28, z, z + 0.26, "stone", w=W_DETAIL)
    c = iso(gx, gy, z + 0.26)
    d = gx + gy + 0.3
    sc.add(d, ellipse(c, 0.24 * TILE_W, 0.24 * TILE_H, PAL["timber_deep"], W_DETAIL), z + 0.3)
    for s in (-1, 1):
        p = iso(gx + s * 0.22, gy, z + 0.26)
        sc.add(d, line(p, (p[0], p[1] - 52), PAL["timber_mid"], W_DETAIL), z + 0.6)
    a, b = iso(gx - 0.22, gy, z + 0.26), iso(gx + 0.22, gy, z + 0.26)
    sc.add(d, line((a[0], a[1] - 52), (b[0], b[1] - 52), PAL["timber_mid"], W_DETAIL), z + 0.8)


def cart(sc, gx, gy, z=0.0):
    d = gx + gy + 0.25
    box(sc, gx, gy, gx + 0.9, gy + 0.5, z + 0.14, z + 0.4, "timber", w=W_DETAIL)
    for off in (0.08, 0.78):
        c = iso(gx + off, gy + 0.52, z + 0.16)
        sc.add(d + 0.01, circle(c, 17, PAL["timber_mid"], W_DETAIL), z)
        sc.add(d + 0.02, circle(c, 5, PAL["timber_deep"], W_HAIR), z)
    a = iso(gx + 0.9, gy + 0.25, z + 0.24)
    sc.add(d, line(a, (a[0] + 44, a[1] + 14), PAL["timber_mid"], W_DETAIL), z)


def crane(sc, gx, gy, z=0.0, h=1.5):
    """A timber lifting frame with a pulley and hook."""
    d = gx + gy + 0.4
    apex = iso(gx, gy, z + h)
    for dx, dy in ((-0.45, 0.35), (0.45, 0.35), (0.0, -0.5)):
        b = iso(gx + dx, gy + dy, z)
        sc.add(d, line(b, apex, PAL["timber_mid"], W_MAIN), z + h)
    sc.add(d, circle((apex[0], apex[1] + 10), 9, PAL["timber_light"], W_DETAIL), z + h)
    sc.add(d, line((apex[0], apex[1] + 16), (apex[0], apex[1] + 74), PAL["timber_deep"], W_HAIR), z + h)
    sc.add(d, polyline([(apex[0] - 8, apex[1] + 74), (apex[0], apex[1] + 88), (apex[0] + 8, apex[1] + 74)],
                       PAL["iron"], W_DETAIL), z + h)


def sawhorse(sc, gx, gy, z=0.0):
    d = gx + gy + 0.2
    a, b = iso(gx - 0.3, gy, z + 0.34), iso(gx + 0.3, gy, z + 0.34)
    sc.add(d, line(a, b, PAL["timber_light"], W_MAIN), z)
    for p in (a, b):
        sc.add(d, line(p, (p[0] - 16, p[1] + 26), PAL["timber_mid"], W_DETAIL), z)
        sc.add(d, line(p, (p[0] + 16, p[1] + 26), PAL["timber_mid"], W_DETAIL), z)
    sc.add(d + 0.01, poly([(a[0] + 10, a[1] - 20), (b[0] - 4, b[1] - 24), (b[0] - 4, b[1] - 16),
                           (a[0] + 10, a[1] - 12)], PAL["iron"], W_HAIR), z)


def kiln(sc, gx, gy, z=0.0, h=0.85, lit=True):
    d = gx + gy + 0.3
    b0, b1 = iso(gx - 0.62, gy, z), iso(gx + 0.62, gy, z)
    t0, t1 = iso(gx - 0.34, gy, z + h), iso(gx + 0.34, gy, z + h)
    sc.add(d, poly([b0, b1, t1, t0], PAL["roof_dark"], W_MAIN), z)
    for i in (1, 2, 3):
        t = i / 4
        sc.add(d + 0.001, line(lerp(b0, t0, t), lerp(b1, t1, t), PAL["roof_deep"], W_HAIR), z)
    sc.add(d, poly([(t0[0], t0[1]), (t1[0], t1[1]), (t1[0] - 4, t1[1] - 26), (t0[0] + 4, t0[1] - 26)],
                   PAL["stone_mid"], W_DETAIL), z + h)
    mouth = [(b0[0] + 34, b0[1] - 4)] + arch_pts(b0[0] + 34, b1[0] - 34, b0[1] - 32, 24) + [(b1[0] - 34, b1[1] - 4)]
    sc.add(d + 0.01, poly(mouth, PAL["fire"] if lit else PAL["timber_deep"], W_DETAIL), z)
    if lit:
        smoke_puffs(sc, gx, gy - 0.1, z + h + 0.3, 3)


def mine_mouth(sc, gx, gy, z=0.0):
    d = gx + gy + 0.3
    a, b = iso(gx - 0.5, gy, z), iso(gx + 0.5, gy, z)
    top = z + 0.72
    ta, tb = iso(gx - 0.5, gy, top), iso(gx + 0.5, gy, top)
    sc.add(d, poly([a, b, tb, ta], PAL["timber_deep"], W_MAIN), z)
    for p, q in ((a, ta), (b, tb)):
        sc.add(d + 0.01, poly([(p[0] - 9, p[1]), (p[0] + 9, p[1]), (q[0] + 9, q[1]), (q[0] - 9, q[1])],
                              PAL["timber_mid"], W_DETAIL), z)
    sc.add(d + 0.01, poly([(ta[0] - 12, ta[1] + 6), (tb[0] + 12, tb[1] + 6), (tb[0] + 12, tb[1] - 12),
                           (ta[0] - 12, ta[1] - 12)], PAL["timber_light"], W_DETAIL), z + top)


def rock_face(sc, gx, gy, z=0.0, w=2.2, h=1.0):
    d = gx + gy - 0.2
    c = iso(gx, gy, z)
    top = iso(gx, gy, z + h)
    hw = w * TILE_W / 2
    sc.add(d, poly([(c[0] - hw, c[1] + 18), (c[0] - hw * 0.8, top[1] + 10), (c[0] - hw * 0.3, top[1] - 16),
                    (c[0] + hw * 0.35, top[1] + 4), (c[0] + hw * 0.85, top[1] + 22), (c[0] + hw, c[1] + 22)],
                   PAL["stone_mid"], W_MAIN), z)
    for dx, dy in ((-0.35, 0.2), (0.25, 0.35), (0.0, 0.55)):
        sc.add(d + 0.01, line((c[0] + dx * hw, top[1] + dy * 80), (c[0] + dx * hw + 22, top[1] + dy * 80 + 40),
                              PAL["stone_dark"], W_HAIR), z)


def stall(sc, gx, gy, z=0.0, cloth=None):
    d = gx + gy + 0.3
    box(sc, gx, gy, gx + 0.8, gy + 0.45, z + 0.2, z + 0.34, "timber", w=W_DETAIL)
    for dx in (0.02, 0.78):
        p = iso(gx + dx, gy + 0.45, z + 0.2)
        sc.add(d, line(p, (p[0], p[1] + 30), PAL["timber_mid"], W_DETAIL), z)
    a, b = iso(gx, gy, z + 0.62), iso(gx + 0.8, gy, z + 0.62)
    c2, d2 = iso(gx + 0.8, gy + 0.5, z + 0.5), iso(gx, gy + 0.5, z + 0.5)
    sc.add(d + 0.02, poly([a, b, c2, d2], cloth or PAL["roof_light"], W_DETAIL), z + 0.7)
    for i in (1, 2, 3):
        t = i / 4
        sc.add(d + 0.03, line(lerp(a, b, t), lerp(d2, c2, t), shade(cloth or PAL["roof_light"], 0.86), W_HAIR), z + 0.7)


def drying_rack(sc, gx, gy, z=0.0, n=4):
    d = gx + gy + 0.25
    for i in range(n):
        gy2 = gy + i * 0.22
        a, b = iso(gx, gy2, z + 0.3), iso(gx + 0.9, gy2, z + 0.3)
        sc.add(d + i * 0.01, line(a, b, PAL["timber_mid"], W_DETAIL), z)
        for j in range(3):
            p = lerp(a, b, (j + 0.5) / 3)
            sc.add(d + i * 0.01, poly([(p[0] - 9, p[1] - 3), (p[0] + 9, p[1] - 3), (p[0] + 9, p[1] - 15),
                                       (p[0] - 9, p[1] - 15)], PAL["roof_mid"], W_HAIR), z)


def frame_shed(sc, x0, y0, x1, y1, z0, eave, posts=4, mat="timberdark"):
    """Open-sided shed: corner and intermediate posts carrying the eaves."""
    lt, md, dk = faces(mat)
    for i in range(posts):
        gx = x0 + (x1 - x0) * i / (posts - 1)
        for gy in (y0, y1):
            b, t = iso(gx, gy, z0), iso(gx, gy, eave)
            w = 0.055 * TILE_W
            sc.add(gx + gy + 0.06, poly([(b[0] - w, b[1]), (b[0] + w, b[1]), (t[0] + w, t[1]), (t[0] - w, t[1])],
                                        md if gy == y1 else dk, W_DETAIL), z0)
    a, b = iso(x0, y1, eave), iso(x1, y1, eave)
    sc.add(x1 + y1 + 0.1, line(a, b, dk, W_DETAIL), eave)


def ore_pile(sc, gx, gy, z=0.0, n=6):
    for i in range(n):
        a = i * 2.3
        c = iso(gx + 0.18 * math.cos(a) * (1 + i * 0.06), gy + 0.13 * math.sin(a), z)
        d = gx + gy + 0.12
        sc.add(d, circle((c[0], c[1] - 7 - (i % 3) * 9), 11, PAL["iron"], W_DETAIL), z)


def clay_pit(sc, gx, gy, z=0.0, r=1.3):
    c = iso(gx, gy, z)
    d = GROUND + 1
    sc.add(d, ellipse(c, r * TILE_W * 0.5, r * TILE_H * 0.5, PAL["roof_dark"], W_MAIN), z)
    sc.add(d + 0.01, ellipse((c[0], c[1] + 6), r * TILE_W * 0.34, r * TILE_H * 0.32, PAL["roof_deep"], W_DETAIL), z)
    for i, (ax, ay) in enumerate(((-0.5, 0.2), (0.45, -0.1), (0.1, 0.45))):
        p = iso(gx + ax * r, gy + ay * r, z)
        sc.add(d + 0.02, ellipse(p, 16, 9, PAL["roof_mid"], W_HAIR), z)


def orchard(sc, x0, y0, x1, y1, rows=3, per=3):
    for i in range(rows):
        for j in range(per):
            bush(sc, x0 + (x1 - x0) * (j + 0.5) / per, y0 + (y1 - y0) * (i + 0.5) / rows, 0, 0.9)


def tholos(sc, gx, gy, z=0.0, r=0.62, h=0.95):
    """A small round colonnaded pavilion with a conical roof."""
    n = 6
    for i in range(n):
        a = math.pi * (0.15 + i / n)
        column(sc, gx + r * math.cos(a), gy + r * math.sin(a), z, z + h, 0.11)
    top = iso(gx, gy, z + h + 0.5)
    d = gx + gy + 0.5
    ring = [iso(gx + r * 1.2 * math.cos(math.pi * 2 * i / 16), gy + r * 1.2 * math.sin(math.pi * 2 * i / 16), z + h)
            for i in range(16)]
    sc.add(d, poly(ring, PAL["stone_light"], W_DETAIL), z + h)
    for i in range(0, 16, 2):
        sc.add(d + 0.01, poly([ring[i], ring[(i + 2) % 16], top], PAL["roof_light"] if i % 4 else PAL["roof_mid"],
                              W_DETAIL), z + h + 0.5)



def scroll_rack(sc, gx, gy, z=0.0, shelves=3, per=4, w=1.0):
    """A pigeonhole case of scroll ends: the one thing that says library at a
    glance. Each hole is a dark square with a pale roll seen end-on."""
    d = box(sc, gx, gy - 0.16, gx + w, gy + 0.16, z, z + 0.24 + shelves * 0.34, "timber", w=W_DETAIL) + 0.01
    for r in range(shelves):
        zr = z + 0.2 + r * 0.34
        a, b = iso(gx, gy - 0.16, zr), iso(gx + w, gy - 0.16, zr)
        sc.add(d, line(a, b, PAL["timber_deep"], W_HAIR), zr)
        for c in range(per):
            q = lerp(a, b, (c + 0.5) / per)
            sc.add(d, poly([(q[0] - 7, q[1] - 2), (q[0] + 7, q[1] - 2), (q[0] + 7, q[1] - 22), (q[0] - 7, q[1] - 22)],
                           PAL["timber_deep"], W_HAIR), zr + 0.01)
            sc.add(d, circle((q[0], q[1] - 12), 4.5, PAL["plaster_light"], W_HAIR), zr + 0.02)


def lectern(sc, gx, gy, z=0.0, scroll=True):
    """A reading stand with an open roll on the slope."""
    d = gx + gy + 0.3
    c0 = iso(gx, gy, z)
    sc.add(d, line(c0, (c0[0], c0[1] - 40), PAL["timber_dark"], W_DETAIL), z)
    top = (c0[0], c0[1] - 40)
    sc.add(d, poly([(top[0] - 22, top[1] + 4), (top[0] + 22, top[1] - 6), (top[0] + 20, top[1] - 14),
                    (top[0] - 24, top[1] - 4)], PAL["timber_mid"], W_DETAIL), z + 0.6)
    if scroll:
        sc.add(d, poly([(top[0] - 18, top[1] - 2), (top[0] + 16, top[1] - 10), (top[0] + 15, top[1] - 15),
                        (top[0] - 19, top[1] - 7)], PAL["plaster_light"], W_HAIR), z + 0.7)


def apse(sc, gx, gy, z0, z1, r=1.05, mat="stone", seg=9):
    """A half-round niche pushed out of the back wall, with a semi-dome."""
    ring = [(gx + r * math.cos(math.pi * (0.5 + i / seg)), gy + r * math.sin(math.pi * (0.5 + i / seg)))
            for i in range(seg + 1)]
    lightf, midf, darkf = faces(mat)
    d = gx + gy - r
    base = [iso(x, y, z0) for x, y in ring]
    topr = [iso(x, y, z1) for x, y in ring]
    for i in range(seg):
        sc.add(d, poly([base[i], base[i + 1], topr[i + 1], topr[i]],
                       midf if i % 2 else darkf, W_HAIR), z0)
    sc.add(d, poly(topr + [iso(gx, gy, z1)], lightf, W_DETAIL), z1)
    crown = iso(gx, gy, z1 + r * 0.72)
    for i in range(seg):
        sc.add(d, poly([topr[i], topr[i + 1], crown], PAL["roof_mid"] if i % 2 else PAL["roof_dark"], W_HAIR), z1 + 0.2)


def sundial(sc, gx, gy, z=0.0):
    box(sc, gx - 0.2, gy - 0.2, gx + 0.2, gy + 0.2, z, z + 0.5, "stone", w=W_DETAIL)
    c = iso(gx, gy, z + 0.5)
    d = gx + gy + 0.3
    sc.add(d, ellipse(c, 0.26 * TILE_W, 0.26 * TILE_H, PAL["stone_light"], W_DETAIL), z + 0.6)
    sc.add(d, line(c, (c[0] + 4, c[1] - 20), PAL["iron"], W_DETAIL), z + 0.7)



# --------------------------------------------------------------- inhabitants
TUNIC = ("roof_mid", "leaf_mid", "plaster_light", "roof_dark", "leaf_dark")


def worker(sc, gx, gy, z=0.0, tunic=0, facing=1, carrying=None, s=1.15):
    """One inhabitant, drawn at about a fifth of a plate wide.

    A yard with nobody in it reads as a model rather than a place, and figures
    are the cheapest way to say a building is worked. They are deliberately
    plain: at this scale a face is two pixels, so the silhouette carries it.
    """
    d = gx + gy + 0.35
    c = iso(gx, gy, z)
    col = PAL[TUNIC[tunic % len(TUNIC)]]
    h = 34.0 * s
    w = 7.0 * s
    # tunic
    sc.add(d, poly([(c[0] - w, c[1]), (c[0] + w, c[1]), (c[0] + w * 0.78, c[1] - h * 0.52),
                    (c[0] - w * 0.78, c[1] - h * 0.52)], col, W_HAIR), z + 0.4)
    # legs, as one dark wedge so the figure keeps a silhouette at small sizes
    sc.add(d, poly([(c[0] - w * 0.5, c[1]), (c[0] + w * 0.5, c[1]), (c[0] + w * 0.3, c[1] - h * 0.18),
                    (c[0] - w * 0.3, c[1] - h * 0.18)], PAL["timber_dark"], 0), z + 0.3)
    # arm toward what is being carried or worked
    ax = c[0] + facing * w * 1.15
    sc.add(d, line((c[0] + facing * w * 0.6, c[1] - h * 0.44), (ax, c[1] - h * 0.3), col, W_HAIR * 1.6), z + 0.5)
    # head
    sc.add(d, circle((c[0], c[1] - h * 0.66), 4.6 * s, PAL["plaster_dark"], W_HAIR), z + 0.6)
    sc.add(d, poly([(c[0] - 4.6 * s, c[1] - h * 0.7), (c[0] + 4.6 * s, c[1] - h * 0.7),
                    (c[0] + 3.4 * s, c[1] - h * 0.82), (c[0] - 3.4 * s, c[1] - h * 0.82)],
                   PAL["timber_deep"], 0), z + 0.7)
    if carrying == "sack":
        sc.add(d, ellipse((ax + facing * 4, c[1] - h * 0.26), 7 * s, 8 * s, PAL["grain"], W_HAIR), z + 0.5)
    elif carrying == "plank":
        sc.add(d, poly([(ax - 26 * s, c[1] - h * 0.34), (ax + 26 * s, c[1] - h * 0.4),
                        (ax + 26 * s, c[1] - h * 0.28), (ax - 26 * s, c[1] - h * 0.22)],
                       PAL["timber_light"], W_HAIR), z + 0.5)


def plank_stack(sc, gx, gy, z=0.0, rows=4, w=1.1):
    """Sawn timber, stacked and stickered — the output side of a wood yard."""
    d = gx + gy + 0.3
    for i in range(rows):
        zz = z + i * 0.11
        box(sc, gx, gy, gx + w, gy + 0.42, zz, zz + 0.09, "timber", w=W_HAIR)


def chopping_block(sc, gx, gy, z=0.0):
    d = box(sc, gx - 0.18, gy - 0.18, gx + 0.18, gy + 0.18, z, z + 0.3, "timberdark", w=W_DETAIL)
    c = iso(gx, gy, z + 0.3)
    # an axe left standing in it
    sc.add(d + 0.01, line((c[0] + 2, c[1]), (c[0] + 11, c[1] - 26), PAL["timber_mid"], W_DETAIL), z + 0.5)
    sc.add(d + 0.01, poly([(c[0] + 9, c[1] - 26), (c[0] + 19, c[1] - 30), (c[0] + 20, c[1] - 23),
                           (c[0] + 11, c[1] - 21)], PAL["iron"], W_HAIR), z + 0.6)


def brushwood(sc, gx, gy, z=0.0, n=7):
    """Lopped branches in a heap: what a felling yard is actually full of."""
    d = gx + gy + 0.25
    c = iso(gx, gy, z)
    for i in range(n):
        a = math.pi * (0.15 + 0.7 * (i / max(1, n - 1)))
        sc.add(d, line((c[0] - 14 + i * 2, c[1]), (c[0] - 14 + i * 2 + math.cos(a) * 22,
                                                   c[1] - abs(math.sin(a)) * 16), PAL["timber_mid"], W_HAIR), z)
    sc.add(d, ellipse((c[0], c[1]), 20, 7, PAL["leaf_dark"], W_HAIR), z - 0.01)


def fire_pit(sc, gx, gy, z=0.0):
    d = gx + gy + 0.25
    c = iso(gx, gy, z)
    sc.add(d, ellipse(c, 15, 7, PAL["earth_dark"], W_DETAIL), z)
    for i in range(4):
        sc.add(d, line((c[0] - 9 + i * 6, c[1] + 2), (c[0] - 4 + i * 6, c[1] - 9),
                       PAL["timber_dark"], W_HAIR), z + 0.1)
    sc.add(d, ellipse((c[0], c[1] - 3), 7, 4, PAL["fire"], 0), z + 0.2)


# ------------------------------------------------------------- the buildings
# Each structure is drawn inside sc.group(depth) so its parts paint in author
# order: base, back walls, openings, columns, then roof last because it
# overhangs toward the viewer. Yard props stay outside the group and sort
# against the building by their own footprint.
def forum(sc, tier):
    paving(sc, 1.4, 3.6, 6.6, 7.2, 0, 6, 4)
    if tier == 1:
        with sc.group(6.4 + 3.4):
            box(sc, 2.0, 1.5, 6.4, 3.4, 0, 0.85, "plaster")
            stone_blocks(sc, 2.0, 1.5, 6.4, 3.4, 0, 0.85, 3)
            archway(sc, 4.2, 3.4, 0, 0.85, 0.7)
            gable(sc, 2.0, 1.5, 6.4, 3.4, 0.85, 0.55, "x")
        for i in range(5):
            column(sc, 2.2 + i * 1.05, 4.2, 0, 1.0)
        statue(sc, 4.0, 5.6)
        barrel(sc, 1.6, 6.2)
        amphora(sc, 6.4, 5.8)
    elif tier == 2:
        with sc.group(6.5 + 3.5):
            box(sc, 1.8, 1.2, 6.5, 3.5, 0, 1.35, "plaster")
            stone_blocks(sc, 1.8, 1.2, 6.5, 3.5, 0, 1.35, 5)
            for i in range(3):
                archway(sc, 2.8 + i * 1.5, 3.5, 0, 1.35, 0.85)
            gable(sc, 1.8, 1.2, 6.5, 3.5, 1.35, 0.78, "x")
        for i in range(6):
            column(sc, 1.9 + i * 0.96, 4.4, 0, 1.15)
        for i in range(3):
            column(sc, 6.7, 4.4 + i * 0.95, 0, 1.15)
        statue(sc, 3.8, 5.8)
        amphora(sc, 5.8, 6.2)
        amphora(sc, 6.1, 6.45)
        crate(sc, 1.5, 6.0)
    else:
        with sc.group(6.6 + 3.6):
            box(sc, 1.6, 0.9, 6.6, 3.6, 0, 2.15, "plaster")
            stone_blocks(sc, 1.6, 0.9, 6.6, 3.6, 0, 2.15, 8)
            for i in range(4):
                archway(sc, 2.3 + i * 1.25, 3.6, 0, 1.1, 0.78)
            for i in range(4):
                gx = 2.3 + i * 1.25
                p = iso(gx, 3.6, 1.45)
                sc.add(0, poly([(p[0] - 17, p[1]), (p[0] + 17, p[1]), (p[0] + 17, p[1] - 46),
                                (p[0] - 17, p[1] - 46)], PAL["timber_deep"], W_DETAIL))
            hip_roof(sc, 1.6, 0.9, 6.6, 3.6, 2.15, 0.82, inset=2.0)
        for i in range(7):
            column(sc, 1.7 + i * 0.85, 4.5, 0, 1.25)
        for i in range(3):
            column(sc, 6.8, 4.5 + i * 0.9, 0, 1.25)
            column(sc, 1.4, 4.5 + i * 0.9, 0, 1.25)
        statue(sc, 4.0, 5.9)
        banner(sc, 6.9, 1.6, 2.15, 0.95)
        sc.anim("flag", 6.9, 1.6, 3.1)
        amphora(sc, 2.5, 6.6)
        amphora(sc, 2.8, 6.85)
        crate(sc, 5.6, 6.5)


def castellum(sc, tier):
    """A fort drawn as a ring: back walls, courtyard, then front walls."""
    X0, Y0, X1, Y1 = 1.3, 1.3, 6.7, 6.7
    T = 0.45
    if tier == 1:
        with sc.group(X1 + Y1):
            box(sc, X0, Y0, X1, Y0 + T, 0, 0.5, "earth")
            box(sc, X0, Y0, X0 + T, Y1, 0, 0.5, "earth")
            palisade(sc, X0, Y0 + T / 2, X1, Y0 + T / 2, 0.5, 0.6, 12)
            palisade(sc, X0 + T / 2, Y0, X0 + T / 2, Y1, 0.5, 0.6, 12)
            box(sc, 2.6, 2.4, 5.4, 4.0, 0, 0.75, "timberdark")
            gable(sc, 2.6, 2.4, 5.4, 4.0, 0.75, 0.45, "x", gable_mat="timberdark")
            box(sc, X1 - T, Y0, X1, Y1, 0, 0.5, "earth")
            palisade(sc, X1 - T / 2, Y0, X1 - T / 2, Y1, 0.5, 0.6, 12)
            box(sc, X0, Y1 - T, X1, Y1, 0, 0.5, "earth")
            palisade(sc, X0, Y1 - T / 2, 3.3, Y1 - T / 2, 0.5, 0.6, 5)
            palisade(sc, 4.7, Y1 - T / 2, X1, Y1 - T / 2, 0.5, 0.6, 5)
            box(sc, 3.3, Y1 - T, 4.7, Y1, 0, 1.35, "timberdark")
            gable(sc, 3.3, Y1 - T, 4.7, Y1, 1.35, 0.3, "x", ov=0.18, gable_mat="timberdark")
        banner(sc, 4.0, 6.5, 1.65, 0.62)
        crate(sc, 1.6, 7.0)
    elif tier == 2:
        with sc.group(X1 + Y1):
            box(sc, X0, Y0, X1, Y0 + T, 0, 1.0, "stone")
            stone_blocks(sc, X0, Y0, X1, Y0 + T, 0, 1.0, 4)
            box(sc, X0, Y0, X0 + T, Y1, 0, 1.0, "stone")
            box(sc, 2.5, 2.2, 5.5, 4.2, 0, 0.95, "plaster")
            gable(sc, 2.5, 2.2, 5.5, 4.2, 0.95, 0.5, "x")
            box(sc, X1 - T, Y0, X1, Y1, 0, 1.0, "stone")
            stone_blocks(sc, X1 - T, Y0, X1, Y1, 0, 1.0, 4)
            crenels(sc, X1 - T, Y0, X1, Y1, 1.0, n=8)
            box(sc, X0, Y1 - T, X1, Y1, 0, 1.0, "stone")
            stone_blocks(sc, X0, Y1 - T, X1, Y1, 0, 1.0, 4)
            crenels(sc, X0, Y1 - T, 3.2, Y1, 1.0, n=3)
            crenels(sc, 4.8, Y1 - T, X1, Y1, 1.0, n=3)
            box(sc, 3.2, Y1 - T - 0.15, 4.8, Y1, 0, 1.65, "stone")
            stone_blocks(sc, 3.2, Y1 - T - 0.15, 4.8, Y1, 0, 1.65, 6)
            archway(sc, 4.0, Y1, 0, 1.05, 0.72)
            crenels(sc, 3.2, Y1 - 0.2, 4.8, Y1, 1.65, n=3)
        banner(sc, 3.4, 6.45, 1.85, 0.72)
        crate(sc, 1.5, 7.1)
    else:
        with sc.group(X1 + Y1):
            box(sc, X0, Y0, X1, Y0 + T, 0, 1.2, "stone")
            stone_blocks(sc, X0, Y0, X1, Y0 + T, 0, 1.2, 5)
            box(sc, X0, Y0, X0 + T, Y1, 0, 1.2, "stone")
            box(sc, X0 - 0.2, Y0 - 0.2, X0 + 0.75, Y0 + 0.75, 0, 2.0, "stone")
            box(sc, 2.4, 2.0, 5.6, 4.3, 0, 1.55, "plaster")
            stone_blocks(sc, 2.4, 2.0, 5.6, 4.3, 0, 1.55, 5)
            gable(sc, 2.4, 2.0, 5.6, 4.3, 1.55, 0.6, "x")
            box(sc, X1 - T, Y0, X1, Y1, 0, 1.2, "stone")
            stone_blocks(sc, X1 - T, Y0, X1, Y1, 0, 1.2, 5)
            crenels(sc, X1 - T, Y0, X1, Y1, 1.2, n=9)
            box(sc, X1 - 0.75, Y0 - 0.2, X1 + 0.2, Y0 + 0.75, 0, 2.0, "stone")
            crenels(sc, X1 - 0.75, Y0 + 0.5, X1 + 0.2, Y0 + 0.75, 2.0, n=3)
            box(sc, X0, Y1 - T, X1, Y1, 0, 1.2, "stone")
            stone_blocks(sc, X0, Y1 - T, X1, Y1, 0, 1.2, 5)
            crenels(sc, X0, Y1 - T, 3.1, Y1, 1.2, n=3)
            crenels(sc, 4.9, Y1 - T, X1, Y1, 1.2, n=3)
            for cx in (X0 - 0.2, X1 - 0.75):
                box(sc, cx, Y1 - 0.75, cx + 0.95, Y1 + 0.2, 0, 2.1, "stone")
                stone_blocks(sc, cx, Y1 - 0.75, cx + 0.95, Y1 + 0.2, 0, 2.1, 7)
                crenels(sc, cx, Y1 - 0.05, cx + 0.95, Y1 + 0.2, 2.1, n=3)
            box(sc, 3.1, Y1 - T - 0.15, 4.9, Y1, 0, 1.9, "stone")
            stone_blocks(sc, 3.1, Y1 - T - 0.15, 4.9, Y1, 0, 1.9, 7)
            archway(sc, 4.0, Y1, 0, 1.25, 0.8)
            crenels(sc, 3.1, Y1 - 0.2, 4.9, Y1, 1.9, n=4)
        banner(sc, 1.1, 7.0, 2.2, 0.95)
        banner(sc, 6.9, 7.0, 2.2, 0.95)
        sc.anim("flag", 1.1, 7.0, 3.15)
        sc.anim("flag", 6.9, 7.0, 3.15)


def warehouse(sc, tier):
    paving(sc, 2.4, 5.2, 6.0, 6.6, 0, 4, 2)
    if tier == 1:
        with sc.group(6.2 + 4.8):
            box(sc, 2.1, 1.8, 6.2, 4.8, 0, 0.9, "timberdark")
            plank_lines(sc, 2.1, 1.8, 6.2, 4.8, 0, 0.9, 8)
            archway(sc, 4.1, 4.8, 0, 0.9, 0.85)
            gable(sc, 2.1, 1.8, 6.2, 4.8, 0.9, 0.62, "x", gable_mat="timberdark")
        crate(sc, 1.3, 5.4)
        crate(sc, 1.7, 5.7, 0.26)
        barrel(sc, 6.4, 5.3)
    elif tier == 2:
        with sc.group(6.4 + 5.0):
            box(sc, 1.9, 1.5, 6.4, 5.0, 0, 0.34, "stone")
            box(sc, 1.9, 1.5, 6.4, 5.0, 0.34, 1.32, "plaster")
            stone_blocks(sc, 1.9, 1.5, 6.4, 5.0, 0.34, 1.32, 4)
            archway(sc, 4.1, 5.0, 0.34, 1.32, 1.0)
            for gx in (2.5, 5.7):
                p = iso(gx, 5.0, 1.05)
                sc.add(0, poly([(p[0] - 14, p[1]), (p[0] + 14, p[1]), (p[0] + 14, p[1] - 32),
                                (p[0] - 14, p[1] - 32)], PAL["timber_deep"], W_DETAIL))
            gable(sc, 1.9, 1.5, 6.4, 5.0, 1.32, 0.78, "x")
        crate(sc, 1.2, 5.6)
        crate(sc, 1.6, 5.9, 0.28)
        barrel(sc, 6.6, 5.4)
        amphora(sc, 6.2, 6.0)
    else:
        with sc.group(6.5 + 5.1):
            box(sc, 1.7, 1.3, 6.5, 5.1, 0, 0.42, "stone")
            box(sc, 1.7, 1.3, 6.5, 5.1, 0.42, 2.1, "plaster")
            stone_blocks(sc, 1.7, 1.3, 6.5, 5.1, 0.42, 2.1, 7)
            archway(sc, 4.1, 5.1, 0.42, 1.6, 1.05)
            for gx in (2.3, 3.2, 5.0, 5.9):
                p = iso(gx, 5.1, 1.85)
                sc.add(0, poly([(p[0] - 13, p[1]), (p[0] + 13, p[1]), (p[0] + 13, p[1] - 34),
                                (p[0] - 13, p[1] - 34)], PAL["timber_deep"], W_DETAIL))
            hip_roof(sc, 1.7, 1.3, 6.5, 5.1, 2.1, 0.82, inset=1.8)
        box(sc, 2.9, 5.1, 5.3, 5.9, 0, 0.42, "timber")
        crane(sc, 6.0, 5.7, 0.42, 1.55)
        sc.anim("swing", 6.0, 5.7, 1.97)
        crate(sc, 3.1, 6.1)
        crate(sc, 3.5, 6.4, 0.28)
        crate(sc, 3.2, 6.7, 0.24)
        barrel(sc, 1.4, 5.8)
        amphora(sc, 1.8, 6.4)


def granary(sc, tier):
    if tier == 1:
        with sc.group(5.9 + 4.8):
            for gx, gy in ((2.5, 2.3), (5.6, 2.3), (2.5, 4.5), (5.6, 4.5)):
                box(sc, gx - 0.17, gy - 0.17, gx + 0.17, gy + 0.17, 0, 0.45, "stone", w=W_DETAIL)
            box(sc, 2.2, 2.0, 5.9, 4.8, 0.45, 1.25, "timberdark")
            plank_lines(sc, 2.2, 2.0, 5.9, 4.8, 0.45, 1.25, 8)
            gable(sc, 2.2, 2.0, 5.9, 4.8, 1.25, 0.58, "x", gable_mat="timberdark")
            a = iso(4.0, 4.9, 0.0)
            sc.add(0, poly([(a[0] - 17, a[1]), (a[0] + 17, a[1]), (a[0] + 24, a[1] - 64),
                            (a[0] - 10, a[1] - 64)], PAL["timber_light"], W_DETAIL))
        sack(sc, 6.3, 5.4)
        sack(sc, 6.6, 5.7, 0.9)
        crate(sc, 1.4, 5.6)
    elif tier == 2:
        with sc.group(6.2 + 5.0):
            box(sc, 1.9, 1.7, 6.2, 5.0, 0, 1.45, "stone")
            stone_blocks(sc, 1.9, 1.7, 6.2, 5.0, 0, 1.45, 5)
            archway(sc, 4.0, 5.0, 0, 1.05, 0.85)
            for i in range(5):
                gx = 2.2 + i * 0.85
                p = iso(gx, 5.0, 1.2)
                sc.add(0, poly([(p[0] - 9, p[1]), (p[0] + 9, p[1]), (p[0] + 9, p[1] - 28),
                                (p[0] - 9, p[1] - 28)], PAL["timber_deep"], W_DETAIL))
            gable(sc, 1.9, 1.7, 6.2, 5.0, 1.45, 0.78, "x")
        sack(sc, 1.4, 5.5)
        sack(sc, 1.7, 5.8, 0.9)
        sack(sc, 6.5, 5.4, 1.0)
        crate(sc, 6.0, 6.0)
    else:
        with sc.group(6.4 + 5.2):
            box(sc, 1.7, 1.4, 6.4, 5.2, 0, 0.9, "stone")
            for i in range(4):
                archway(sc, 2.3 + i * 1.25, 5.2, 0, 0.9, 0.85)
            box(sc, 1.7, 1.4, 6.4, 5.2, 0.9, 2.2, "plaster")
            stone_blocks(sc, 1.7, 1.4, 6.4, 5.2, 0.9, 2.2, 5)
            for i in range(6):
                gx = 2.0 + i * 0.8
                p = iso(gx, 5.2, 1.85)
                sc.add(0, poly([(p[0] - 9, p[1]), (p[0] + 9, p[1]), (p[0] + 9, p[1] - 28),
                                (p[0] - 9, p[1] - 28)], PAL["timber_deep"], W_DETAIL))
            hip_roof(sc, 1.7, 1.4, 6.4, 5.2, 2.2, 0.85, inset=1.8)
        box(sc, 3.1, 5.2, 5.0, 6.0, 0, 0.44, "stone")
        cart(sc, 5.6, 6.0)
        sc.anim("flag", 1.7, 5.3, 1.0, 0.8)
        sack(sc, 3.3, 6.2)
        sack(sc, 3.6, 6.5, 0.95)
        sack(sc, 3.0, 6.6, 0.85)
        amphora(sc, 1.5, 6.0)


def cellars(sc, tier):
    if tier == 1:
        mound(sc, 4.0, 4.0, 2.7, 2.2, 1.95)
        with sc.group(4.0 + 5.4):
            a = iso(4.1, 5.2, 0.06)
            sc.add(0, poly([(a[0] - 40, a[1] - 2), (a[0] + 40, a[1] - 2), (a[0] + 30, a[1] - 30),
                            (a[0] - 30, a[1] - 30)], PAL["timber_mid"], W_MAIN))
            for f in (-0.45, 0.45):
                p = (a[0] + f * 58, a[1] - 16)
                sc.add(0, line((p[0], p[1] - 9), (p[0], p[1] + 7), PAL["iron"], W_HAIR))
        barrel(sc, 6.3, 5.4)
        barrel(sc, 6.6, 5.8, 0.3)
        crate(sc, 1.5, 5.6)
    elif tier == 2:
        mound(sc, 4.0, 3.8, 3.1, 2.5, 2.2)
        with sc.group(5.1 + 5.7):
            box(sc, 3.2, 4.9, 5.1, 5.7, 0, 1.0, "stone")
            stone_blocks(sc, 3.2, 4.9, 5.1, 5.7, 0, 1.0, 3)
            archway(sc, 4.15, 5.7, 0, 1.0, 0.8)
        barrel(sc, 6.3, 5.4)
        barrel(sc, 6.6, 5.8, 0.3)
        barrel(sc, 6.0, 6.0, 0.28)
        amphora(sc, 1.9, 5.6)
        amphora(sc, 2.2, 5.85)
    else:
        mound(sc, 4.0, 3.6, 3.5, 2.8, 2.45)
        with sc.group(5.9 + 5.9):
            box(sc, 2.4, 4.9, 5.9, 5.9, 0, 1.35, "stone")
            stone_blocks(sc, 2.4, 4.9, 5.9, 5.9, 0, 1.35, 4)
            archway(sc, 3.3, 5.9, 0, 1.35, 0.85)
            archway(sc, 5.0, 5.9, 0, 1.35, 0.85)
            for i in range(6):
                gx = 2.5 + i * 0.68
                p = iso(gx, 5.9, 1.35)
                sc.add(0, poly([(p[0] - 12, p[1]), (p[0] + 12, p[1]), (p[0] + 12, p[1] - 15),
                                (p[0] - 12, p[1] - 15)], PAL["stone_light"], W_HAIR))
        steps(sc, 3.9, 6.7, 4.7, 5.95, 3, 0.0, 0.1)
        sc.anim("glow", 3.3, 5.85, 0.5, 0.8)
        sc.anim("glow", 5.0, 5.85, 0.5, 0.8)
        amphora(sc, 1.6, 5.6)
        amphora(sc, 1.9, 5.85)
        barrel(sc, 6.5, 5.4)
        barrel(sc, 6.8, 5.8, 0.3)
        crate(sc, 6.2, 6.4)


def insulae(sc, tier):
    paving(sc, 1.8, 5.3, 6.4, 6.6, 0, 5, 2)
    if tier == 1:
        with sc.group(6.2 + 4.8):
            box(sc, 2.2, 2.0, 6.2, 4.8, 0, 1.05, "plaster")
            stone_blocks(sc, 2.2, 2.0, 6.2, 4.8, 0, 1.05, 3)
            archway(sc, 3.3, 4.8, 0, 1.05, 0.65)
            for gx in (4.6, 5.4):
                p = iso(gx, 4.8, 0.82)
                sc.add(0, poly([(p[0] - 13, p[1]), (p[0] + 13, p[1]), (p[0] + 13, p[1] - 30),
                                (p[0] - 13, p[1] - 30)], PAL["timber_deep"], W_DETAIL))
            gable(sc, 2.2, 2.0, 6.2, 4.8, 1.05, 0.58, "x")
        barrel(sc, 6.5, 5.3)
        crate(sc, 1.4, 5.6)
    elif tier == 2:
        with sc.group(6.3 + 5.0):
            box(sc, 2.0, 1.8, 6.3, 5.0, 0, 2.05, "plaster")
            stone_blocks(sc, 2.0, 1.8, 6.3, 5.0, 0, 2.05, 6)
            archway(sc, 3.1, 5.0, 0, 1.05, 0.65)
            for z in (0.75, 1.55):
                for gx in (4.3, 5.2):
                    p = iso(gx, 5.0, z + 0.3)
                    sc.add(0, poly([(p[0] - 13, p[1]), (p[0] + 13, p[1]), (p[0] + 13, p[1] - 32),
                                    (p[0] - 13, p[1] - 32)], PAL["timber_deep"], W_DETAIL))
            a, b = iso(2.0, 5.05, 0.0), iso(2.0, 5.05, 1.05)
            sc.add(0, poly([(a[0] - 8, a[1]), (a[0] + 46, a[1] - 10), (b[0] + 46, b[1] - 10),
                            (b[0] - 8, b[1])], PAL["timber_mid"], W_DETAIL))
            c, d2 = iso(2.0, 5.1, 1.05), iso(4.1, 5.1, 1.05)
            sc.add(0, line(c, d2, PAL["timber_light"], W_MAIN))
            gable(sc, 2.0, 1.8, 6.3, 5.0, 2.05, 0.65, "x")
        barrel(sc, 6.5, 5.4)
        crate(sc, 1.5, 5.7)
    else:
        with sc.group(6.4 + 5.2):
            box(sc, 1.8, 1.6, 6.4, 5.2, 0, 1.0, "stone")
            stone_blocks(sc, 1.8, 1.6, 6.4, 5.2, 0, 1.0, 3)
            for i in range(3):
                archway(sc, 2.5 + i * 1.35, 5.2, 0, 1.0, 0.82)
            box(sc, 1.8, 1.6, 6.4, 5.2, 1.0, 3.0, "plaster")
            stone_blocks(sc, 1.8, 1.6, 6.4, 5.2, 1.0, 3.0, 7)
            for z in (1.3, 2.15):
                for gx in (2.4, 3.3, 4.3, 5.2, 6.0):
                    p = iso(gx, 5.2, z + 0.32)
                    sc.add(0, poly([(p[0] - 13, p[1]), (p[0] + 13, p[1]), (p[0] + 13, p[1] - 33),
                                    (p[0] - 13, p[1] - 33)], PAL["timber_deep"], W_DETAIL))
            a, b = iso(1.85, 5.25, 2.1), iso(4.0, 5.25, 2.1)
            sc.add(0, line(a, b, PAL["timber_light"], W_MAIN))
            gable(sc, 1.8, 1.6, 6.4, 5.2, 3.0, 0.78, "x")
        for i in range(3):
            gx = 2.5 + i * 1.35
            a, b = iso(gx - 0.45, 5.2, 1.0), iso(gx + 0.45, 5.2, 1.0)
            sc.add(gx + 5.35, poly([a, b, (b[0] + 5, b[1] + 28), (a[0] - 5, a[1] + 28)],
                                   [PAL["roof_light"], PAL["gold"], PAL["leaf_mid"]][i], W_DETAIL), 1.0)
        sc.anim("smoke", 2.4, 1.9, 3.9, 0.8)
        crate(sc, 1.4, 6.0)
        barrel(sc, 6.6, 5.7)
        amphora(sc, 6.2, 6.3)


def market(sc, tier):
    paving(sc, 1.6, 3.4, 6.6, 7.0, 0, 5, 4)
    if tier == 1:
        stall(sc, 2.0, 1.9, 0, PAL["roof_light"])
        stall(sc, 3.6, 2.3, 0, PAL["gold"])
        stall(sc, 5.2, 2.7, 0, PAL["water"])
        amphora(sc, 2.3, 4.6)
        amphora(sc, 2.6, 4.85)
        crate(sc, 5.8, 4.8)
        barrel(sc, 6.3, 5.4)
        sack(sc, 4.2, 5.6)
    elif tier == 2:
        with sc.group(6.3 + 3.3):
            box(sc, 2.0, 1.6, 6.3, 3.3, 0, 1.15, "plaster")
            stone_blocks(sc, 2.0, 1.6, 6.3, 3.3, 0, 1.15, 4)
            for i in range(2):
                archway(sc, 3.0 + i * 1.9, 3.3, 0, 1.15, 0.8)
            gable(sc, 2.0, 1.6, 6.3, 3.3, 1.15, 0.6, "x")
        for i in range(6):
            column(sc, 2.1 + i * 0.86, 3.9, 0, 1.15, 0.13)
        stall(sc, 2.4, 4.8, 0, PAL["gold"])
        stall(sc, 4.4, 5.1, 0, PAL["roof_light"])
        amphora(sc, 6.3, 4.7)
        amphora(sc, 6.6, 4.95)
        crate(sc, 1.4, 5.5)
        barrel(sc, 6.4, 5.9)
    else:
        with sc.group(6.5 + 2.9):
            box(sc, 1.7, 1.3, 6.5, 2.9, 0, 1.25, "plaster")
            stone_blocks(sc, 1.7, 1.3, 6.5, 2.9, 0, 1.25, 4)
            for i in range(3):
                archway(sc, 2.5 + i * 1.5, 2.9, 0, 1.25, 0.85)
            gable(sc, 1.7, 1.3, 6.5, 2.9, 1.25, 0.65, "x")
        for i in range(7):
            column(sc, 1.8 + i * 0.79, 3.5, 0, 1.25, 0.13)
        for i in range(3):
            column(sc, 6.6, 3.5 + i * 1.0, 0, 1.25, 0.13)
            column(sc, 1.5, 3.5 + i * 1.0, 0, 1.25, 0.13)
        tholos(sc, 4.0, 5.2)
        sc.anim("flag", 1.9, 6.2, 0.68, 0.7)
        sc.anim("flag", 4.9, 6.4, 0.68, 0.7)
        stall(sc, 1.9, 6.2, 0, PAL["gold"])
        stall(sc, 4.9, 6.4, 0, PAL["water"])
        amphora(sc, 6.7, 5.5)
        amphora(sc, 7.0, 5.75)
        sack(sc, 3.0, 6.9)


def temple(sc, tier):
    if tier == 1:
        with sc.group(6.0 + 4.6):
            box(sc, 2.4, 2.0, 6.0, 4.6, 0, 0.38, "stone")
            stone_blocks(sc, 2.4, 2.0, 6.0, 4.6, 0, 0.38, 2)
            box(sc, 2.8, 2.2, 5.6, 3.5, 0.38, 1.25, "plaster")
            for i in range(5):
                column(sc, 2.95 + i * 0.68, 4.25, 0.38, 1.25, 0.15)
            gable(sc, 2.8, 2.2, 5.6, 4.35, 1.25, 0.55, "x")
        steps(sc, 3.3, 5.3, 5.1, 4.65, 2, 0.0, 0.19)
        box(sc, 6.0, 5.2, 6.6, 5.8, 0, 0.34, "stone", w=W_DETAIL)
        amphora(sc, 2.0, 5.4)
    elif tier == 2:
        with sc.group(6.2 + 4.9):
            box(sc, 2.1, 1.7, 6.2, 4.9, 0, 0.6, "stone")
            stone_blocks(sc, 2.1, 1.7, 6.2, 4.9, 0, 0.6, 2)
            box(sc, 2.6, 1.9, 5.8, 3.4, 0.6, 1.6, "plaster")
            for i in range(6):
                column(sc, 2.7 + i * 0.63, 4.5, 0.6, 1.6, 0.15)
            for i in range(2):
                column(sc, 2.7 + i * 3.15, 3.9, 0.6, 1.6, 0.15)
            gable(sc, 2.6, 1.9, 5.8, 4.6, 1.6, 0.65, "x")
        steps(sc, 3.1, 5.7, 5.3, 4.95, 3, 0.0, 0.2)
        box(sc, 6.0, 5.4, 6.7, 6.1, 0, 0.38, "stone", w=W_DETAIL)
        smoke_puffs(sc, 6.35, 5.7, 0.55, 2)
        amphora(sc, 1.8, 5.6)
        amphora(sc, 2.1, 5.85)
    else:
        with sc.group(6.4 + 5.1):
            box(sc, 1.8, 1.4, 6.4, 5.1, 0, 0.85, "stone")
            stone_blocks(sc, 1.8, 1.4, 6.4, 5.1, 0, 0.85, 3)
            box(sc, 2.4, 1.6, 6.0, 3.3, 0.85, 2.1, "plaster")
            for i in range(7):
                column(sc, 2.5 + i * 0.58, 4.7, 0.85, 2.1, 0.16)
            for i in range(3):
                column(sc, 2.5, 3.6 + i * 0.55, 0.85, 2.1, 0.16)
                column(sc, 5.98, 3.6 + i * 0.55, 0.85, 2.1, 0.16)
            gable(sc, 2.4, 1.6, 6.0, 4.8, 2.1, 0.82, "x")
        steps(sc, 2.9, 6.1, 5.5, 5.15, 4, 0.0, 0.21)
        box(sc, 6.1, 5.6, 6.9, 6.4, 0, 0.44, "stone", w=W_DETAIL)
        sc.anim("smoke", 6.5, 6.0, 0.62, 0.85)
        sc.anim("flag", 1.6, 4.9, 1.73)
        banner(sc, 1.6, 4.9, 0.85, 0.88)
        amphora(sc, 1.5, 5.8)
        amphora(sc, 1.8, 6.05)


def waystation(sc, tier):
    road(sc, 6.0, 7.2)
    if tier == 1:
        with sc.group(5.5 + 4.4):
            box(sc, 3.0, 2.4, 5.5, 4.4, 0, 0.9, "timberdark")
            plank_lines(sc, 3.0, 2.4, 5.5, 4.4, 0, 0.9, 6)
            archway(sc, 4.2, 4.4, 0, 0.9, 0.62)
            gable(sc, 3.0, 2.4, 5.5, 4.4, 0.9, 0.52, "x", gable_mat="timberdark")
        box(sc, 6.0, 4.8, 6.35, 5.15, 0, 0.66, "stone", w=W_DETAIL)
        a = iso(2.2, 5.0, 0)
        sc.add(2.2 + 5.0 + 0.2, line(a, (a[0], a[1] - 58), PAL["timber_mid"], W_MAIN), 0.5)
        sc.add(2.2 + 5.0 + 0.25, line((a[0] - 24, a[1] - 46), (a[0] + 24, a[1] - 50), PAL["timber_mid"], W_DETAIL), 0.6)
        barrel(sc, 5.9, 5.6)
    elif tier == 2:
        with sc.group(6.5 + 4.4):
            box(sc, 2.4, 2.0, 5.0, 4.2, 0, 1.15, "plaster")
            stone_blocks(sc, 2.4, 2.0, 5.0, 4.2, 0, 1.15, 4)
            archway(sc, 3.7, 4.2, 0, 1.15, 0.72)
            gable(sc, 2.4, 2.0, 5.0, 4.2, 1.15, 0.6, "x")
            box(sc, 5.2, 2.4, 6.5, 4.4, 0, 0.95, "timberdark")
            plank_lines(sc, 5.2, 2.4, 6.5, 4.4, 0, 0.95, 4)
            gable(sc, 5.2, 2.4, 6.5, 4.4, 0.95, 0.45, "y", gable_mat="timberdark")
        box(sc, 6.1, 4.9, 6.45, 5.25, 0, 0.7, "stone", w=W_DETAIL)
        cart(sc, 2.0, 5.2)
        barrel(sc, 6.6, 5.5)
        crate(sc, 4.6, 5.4)
    else:
        with sc.group(6.6 + 4.6):
            box(sc, 1.9, 1.5, 4.4, 3.8, 0, 1.4, "plaster")
            stone_blocks(sc, 1.9, 1.5, 4.4, 3.8, 0, 1.4, 4)
            archway(sc, 3.2, 3.8, 0, 1.4, 0.78)
            hip_roof(sc, 1.9, 1.5, 4.4, 3.8, 1.4, 0.62, inset=0.7)
            box(sc, 4.9, 1.7, 6.6, 4.6, 0, 1.1, "plaster")
            stone_blocks(sc, 4.9, 1.7, 6.6, 4.6, 0, 1.1, 3)
            for i in range(4):
                column(sc, 4.7, 2.0 + i * 0.85, 0, 1.1, 0.12)
            gable(sc, 4.9, 1.7, 6.6, 4.6, 1.1, 0.55, "y")
        box(sc, 6.2, 5.2, 6.55, 5.55, 0, 0.74, "stone", w=W_DETAIL)
        well(sc, 2.2, 4.9)
        sc.anim("flag", 6.38, 5.38, 0.78, 0.7)
        cart(sc, 3.5, 5.4)
        barrel(sc, 6.7, 5.7)
        crate(sc, 5.0, 5.6)
        amphora(sc, 1.5, 5.8)


def lumber_camp(sc, tier):
    """A felling camp. The standing wood is the point of the plot, so the trees
    are the scene rather than one token pine at the back."""
    if tier == 1:
        # the stand being worked: a wood, thinning toward the yard
        for gx, gy, h in ((7.4, 1.0, 1.7), (6.9, 2.0, 1.45), (7.5, 3.0, 1.55),
                          (6.4, 1.1, 1.3), (7.6, 4.2, 1.35), (5.9, 0.8, 1.2)):
            pine(sc, gx, gy, 0, h)
        with sc.group(6.2 + 4.2):
            frame_shed(sc, 3.2, 2.2, 6.2, 4.2, 0, 1.0)
            gable(sc, 3.2, 2.2, 6.2, 4.2, 1.0, 0.55, "x")
        log_pile(sc, 1.2, 4.6, 3, 4)
        log_pile(sc, 1.4, 6.0, 2, 3)
        plank_stack(sc, 2.6, 3.2, 0, 4, 1.0)
        sawhorse(sc, 4.2, 5.6)
        chopping_block(sc, 5.3, 5.1)
        brushwood(sc, 3.2, 6.6)
        worker(sc, 4.6, 5.0, 0, 0, 1)
        worker(sc, 2.3, 4.2, 0, 2, -1, "plank")
        barrel(sc, 6.7, 4.8)
        crate(sc, 2.2, 6.2)
        tuft(sc, 1.0, 2.2)
        tuft(sc, 6.2, 6.6)
    elif tier == 2:
        for gx, gy, h in ((7.5, 0.9, 1.8), (7.0, 1.9, 1.55), (7.6, 3.1, 1.6),
                          (6.5, 1.0, 1.35), (7.7, 4.4, 1.4)):
            pine(sc, gx, gy, 0, h)
        with sc.group(6.3 + 4.3):
            box(sc, 3.0, 2.0, 6.3, 4.3, 0, 0.35, "stone")
            frame_shed(sc, 3.0, 2.0, 6.3, 4.3, 0.35, 1.32, 4)
            gable(sc, 3.0, 2.0, 6.3, 4.3, 1.32, 0.62, "x")
        log_pile(sc, 1.0, 4.6, 3, 4)
        log_pile(sc, 1.2, 6.1, 3, 4)
        plank_stack(sc, 2.3, 3.0, 0, 5, 1.2)
        plank_stack(sc, 2.3, 3.6, 0, 3, 1.2)
        sawhorse(sc, 3.6, 5.8)
        chopping_block(sc, 5.0, 5.4)
        brushwood(sc, 6.4, 6.2)
        fire_pit(sc, 4.6, 6.6)
        worker(sc, 4.0, 5.2, 0, 1, 1)
        worker(sc, 5.6, 4.6, 0, 3, -1)
        worker(sc, 2.0, 4.0, 0, 0, 1, "plank")
        crane(sc, 5.7, 5.6, 0, 1.45)
        crate(sc, 2.0, 6.4)
        tuft(sc, 0.9, 2.0)
    else:
        with sc.group(6.4 + 4.4):
            box(sc, 2.8, 1.8, 6.4, 4.4, 0, 0.45, "stone")
            box(sc, 5.4, 1.8, 6.4, 4.4, 0.45, 1.6, "plaster")
            stone_blocks(sc, 5.4, 1.8, 6.4, 4.4, 0.45, 1.6, 4)
            frame_shed(sc, 2.8, 1.8, 5.4, 4.4, 0.45, 1.6, 4)
            gable(sc, 2.8, 1.8, 6.4, 4.4, 1.6, 0.72, "x")
            box(sc, 5.7, 2.0, 6.0, 2.4, 2.32, 2.9, "stone", w=W_DETAIL)
        sc.anim("smoke", 5.85, 2.2, 3.0)
        sc.anim("swing", 5.9, 5.8, 1.75, 0.9)
        for gx, gy, h in ((7.6, 0.8, 1.9), (7.1, 1.8, 1.6), (7.7, 3.0, 1.7), (7.8, 4.5, 1.45)):
            pine(sc, gx, gy, 0, h)
        plank_stack(sc, 1.9, 2.8, 0, 6, 1.3)
        plank_stack(sc, 1.9, 3.5, 0, 4, 1.3)
        chopping_block(sc, 4.8, 5.6)
        brushwood(sc, 6.6, 6.4)
        fire_pit(sc, 3.2, 6.8)
        worker(sc, 3.8, 5.4, 0, 1, 1)
        worker(sc, 5.2, 4.8, 0, 4, -1)
        worker(sc, 1.7, 3.9, 0, 2, 1, "plank")
        worker(sc, 6.0, 6.0, 0, 0, -1)
        log_pile(sc, 0.8, 4.8, 4, 5)
        sawhorse(sc, 3.4, 6.2)
        crane(sc, 5.9, 5.8, 0, 1.75)
        for gx, gy, h in ((7.3, 1.8, 1.65), (6.9, 1.1, 1.35), (7.6, 2.8, 1.5)):
            pine(sc, gx, gy, 0, h)
        crate(sc, 1.9, 6.4)
        crate(sc, 2.3, 6.7, 0.28)
        barrel(sc, 6.8, 5.0)


def clay_works(sc, tier):
    clay_pit(sc, 2.5, 5.2, 0, 1.7 + 0.35 * tier)
    if tier == 1:
        drying_rack(sc, 4.4, 2.2, 0, 4)
        drying_rack(sc, 5.6, 2.0, 0, 3)
        box(sc, 5.8, 3.4, 6.5, 4.3, 0, 0.6, "timberdark", w=W_DETAIL)
        a = iso(3.8, 4.4, 0)
        sc.add(3.8 + 4.4 + 0.2, line(a, (a[0] + 28, a[1] - 50), PAL["timber_mid"], W_DETAIL), 0.3)
        for i in range(4):
            amphora(sc, 6.2 + (i % 2) * 0.3, 5.4 + i * 0.26)
        crate(sc, 5.4, 6.0)
        crate(sc, 5.9, 6.5, 0.26)
        worker(sc, 3.4, 4.4, 0, 0, 1)
        worker(sc, 4.9, 3.3, 0, 1, -1)
        tuft(sc, 1.4, 2.6)
    elif tier == 2:
        kiln(sc, 5.2, 2.4, 0, 1.0)
        drying_rack(sc, 3.4, 1.9, 0, 4)
        drying_rack(sc, 4.5, 1.7, 0, 4)
        box(sc, 6.0, 3.8, 6.7, 4.7, 0, 0.62, "timberdark", w=W_DETAIL)
        for i in range(5):
            crate(sc, 5.9 + (i % 2) * 0.06, 5.0 + i * 0.34, 0.26)
        for i in range(4):
            amphora(sc, 4.4 + (i % 2) * 0.32, 6.0 + i * 0.24)
        worker(sc, 6.0, 2.9, 0, 1, -1)
        worker(sc, 3.0, 4.6, 0, 0, 1)
        worker(sc, 4.2, 5.4, 0, 3, -1, "sack")
        tuft(sc, 1.2, 2.4)
    else:
        with sc.group(4.6 + 3.6):
            box(sc, 2.4, 1.7, 4.6, 3.6, 0, 1.05, "plaster")
            stone_blocks(sc, 2.4, 1.7, 4.6, 3.6, 0, 1.05, 3)
            archway(sc, 3.5, 3.6, 0, 1.05, 0.68)
            gable(sc, 2.4, 1.7, 4.6, 3.6, 1.05, 0.55, "x")
        kiln(sc, 5.4, 2.2, 0, 1.1)
        kiln(sc, 6.5, 3.6, 0, 0.95)
        sc.anim("smoke", 5.4, 2.2, 1.5)
        sc.anim("glow", 5.4, 2.35, 0.15, 0.9)
        drying_rack(sc, 2.9, 4.0, 0, 5)
        for i in range(4):
            amphora(sc, 5.3 + (i % 2) * 0.36, 5.5 + i * 0.3)
        crate(sc, 1.7, 6.2)
        crate(sc, 2.1, 6.5, 0.28)


def iron_mine(sc, tier):
    rock_face(sc, 4.0, 1.8, 0, 3.4 + 0.45 * tier, 0.95 + 0.25 * tier)
    mine_mouth(sc, 4.0, 2.6, 0)
    if tier == 1:
        ore_pile(sc, 5.7, 4.4)
        a = iso(2.5, 4.2, 0)
        sc.add(2.5 + 4.2 + 0.2, line(a, (a[0] + 26, a[1] - 48), PAL["timber_mid"], W_DETAIL), 0.3)
        crate(sc, 2.3, 5.4)
        barrel(sc, 6.4, 5.2)
    elif tier == 2:
        crane(sc, 4.0, 4.1, 0, 1.55)
        for i in range(6):
            p0, p1 = iso(3.8, 3.3 + i * 0.5, 0), iso(4.2, 3.3 + i * 0.5, 0)
            sc.add(4.0 + 3.3 + i * 0.5, line(p0, p1, PAL["timber_deep"], W_HAIR), 0)
        cart(sc, 4.5, 5.5)
        ore_pile(sc, 2.3, 4.9)
        crate(sc, 6.3, 4.8)
        barrel(sc, 6.6, 5.4)
    else:
        crane(sc, 3.3, 4.1, 0, 1.8)
        for i in range(7):
            p0, p1 = iso(3.1, 3.3 + i * 0.5, 0), iso(3.5, 3.3 + i * 0.5, 0)
            sc.add(3.3 + 3.3 + i * 0.5, line(p0, p1, PAL["timber_deep"], W_HAIR), 0)
        kiln(sc, 6.1, 2.9, 0, 1.05)
        sc.anim("smoke", 6.1, 2.9, 1.45)
        sc.anim("swing", 3.3, 4.1, 1.8, 0.9)
        with sc.group(6.8 + 5.5):
            box(sc, 5.3, 4.4, 6.8, 5.5, 0, 0.9, "stone")
            stone_blocks(sc, 5.3, 4.4, 6.8, 5.5, 0, 0.9, 3)
            gable(sc, 5.3, 4.4, 6.8, 5.5, 0.9, 0.45, "y")
        cart(sc, 3.8, 5.9)
        ore_pile(sc, 2.1, 4.7)
        ore_pile(sc, 2.5, 5.7, n=5)
        crate(sc, 1.6, 6.3)
        worker(sc, 2.6, 5.4, 0, 3, 1)
        worker(sc, 4.4, 6.0, 0, 0, -1)

def farm(sc, tier):
    if tier == 1:
        furrows(sc, 0.7, 3.2, 6.8, 7.2, 0, 10)
        with sc.group(6.4 + 3.0):
            box(sc, 4.6, 1.6, 6.4, 3.0, 0, 0.85, "timberdark")
            plank_lines(sc, 4.6, 1.6, 6.4, 3.0, 0, 0.85, 5)
            archway(sc, 5.5, 3.0, 0, 0.85, 0.6)
            gable(sc, 4.6, 1.6, 6.4, 3.0, 0.85, 0.48, "x", gable_mat="timberdark")
        a = iso(2.8, 2.6, 0)
        sc.add(2.8 + 2.6 + 0.2, line(a, (a[0] + 22, a[1] - 52), PAL["timber_mid"], W_DETAIL), 0.3)
        for i in range(4):
            sack(sc, 4.0 + (i % 2) * 0.34, 2.4 + i * 0.22, 0.95)
        crate(sc, 1.6, 2.6)
        worker(sc, 3.0, 5.0, 0, 1, 1)
        worker(sc, 5.2, 5.6, 0, 0, -1, "sack")
        bush(sc, 1.2, 2.0, 0.9)
    elif tier == 2:
        furrows(sc, 0.7, 3.7, 6.9, 7.2, 0, 11)
        with sc.group(6.4 + 3.2):
            box(sc, 3.6, 1.5, 6.4, 3.2, 0, 1.1, "plaster")
            stone_blocks(sc, 3.6, 1.5, 6.4, 3.2, 0, 1.1, 3)
            archway(sc, 5.0, 3.2, 0, 1.1, 0.7)
            gable(sc, 3.6, 1.5, 6.4, 3.2, 1.1, 0.58, "x")
        for i in range(9):
            gx = 0.8 + i * 0.7
            box(sc, gx, 3.4, gx + 0.52, 3.58, 0, 0.28, "stone", w=W_HAIR, depth=gx + 3.6)
        cart(sc, 1.9, 2.3)
        sack(sc, 3.0, 2.8)
        sack(sc, 3.3, 3.0, 0.9)
        bush(sc, 6.8, 4.4)
    else:
        furrows(sc, 0.7, 4.4, 7.0, 7.3, 0, 12)
        with sc.group(6.7 + 3.7):
            box(sc, 1.8, 1.2, 4.3, 3.2, 0, 1.35, "plaster")
            stone_blocks(sc, 1.8, 1.2, 4.3, 3.2, 0, 1.35, 4)
            archway(sc, 3.1, 3.2, 0, 1.35, 0.75)
            hip_roof(sc, 1.8, 1.2, 4.3, 3.2, 1.35, 0.6, inset=0.7)
            box(sc, 4.8, 1.4, 6.7, 3.7, 0, 1.05, "timberdark")
            plank_lines(sc, 4.8, 1.4, 6.7, 3.7, 0, 1.05, 6)
            gable(sc, 4.8, 1.4, 6.7, 3.7, 1.05, 0.52, "y", gable_mat="timberdark")
        paving(sc, 2.2, 3.5, 4.2, 4.3, 0, 3, 2)
        for i in range(10):
            gx = 0.8 + i * 0.64
            box(sc, gx, 4.05, gx + 0.48, 4.22, 0, 0.3, "stone", w=W_HAIR, depth=gx + 4.25)
        orchard(sc, 4.6, 3.6, 6.9, 4.3, 1, 3)
        sc.anim("smoke", 2.2, 1.6, 2.1, 0.8)
        cart(sc, 4.4, 5.0)
        sack(sc, 2.5, 3.9)
        sack(sc, 2.8, 4.1, 0.9)
        well(sc, 1.4, 3.3)




def library(sc, tier):
    """Scrolls kept dry and copied. Roman libraries are a hall of pigeonholes
    with a portico in front; the tiers grow a storey, a colonnade and finally
    an apse with Minerva in it."""
    if tier == 1:
        with sc.group(5.8 + 4.5):
            box(sc, 2.6, 2.2, 5.8, 4.5, 0, 0.3, "stone")
            stone_blocks(sc, 2.6, 2.2, 5.8, 4.5, 0, 0.3, 1)
            box(sc, 2.9, 2.4, 5.5, 3.7, 0.3, 1.35, "plaster")
            wall_courses(sc, 2.9, 2.4, 5.5, 3.7, 0.3, 1.35, 3)
            archway(sc, 4.2, 3.7, 0.3, 1.15, 0.58)
            for i in range(3):
                column(sc, 3.15 + i * 1.1, 4.25, 0.3, 1.35, 0.14)
            gable(sc, 2.9, 2.4, 5.5, 4.4, 1.35, 0.5, "x")
        steps(sc, 3.5, 5.1, 4.9, 4.55, 2, 0.0, 0.16)
        scroll_rack(sc, 6.1, 3.0, 0.0, 2, 3, 0.9)
        lectern(sc, 2.1, 5.2)
        amphora(sc, 6.3, 5.0)
        tuft(sc, 1.6, 2.6)
        bush(sc, 6.6, 6.0, 0.9)
    elif tier == 2:
        with sc.group(6.1 + 4.9):
            box(sc, 2.2, 1.8, 6.1, 4.9, 0, 0.55, "stone")
            stone_blocks(sc, 2.2, 1.8, 6.1, 4.9, 0, 0.55, 2)
            # reading hall, with the copyists' storey above the cornice
            box(sc, 2.6, 2.0, 5.7, 3.6, 0.55, 1.75, "plaster")
            wall_courses(sc, 2.6, 2.0, 5.7, 3.6, 0.55, 1.75, 4)
            box(sc, 2.9, 2.2, 5.4, 3.4, 1.75, 2.35, "plaster", tint=1.04)
            for i in range(4):
                p = iso(3.1 + i * 0.7, 3.4, 2.0)
                sc.add(6.1 + 4.9, poly([(p[0] - 9, p[1]), (p[0] + 9, p[1]), (p[0] + 9, p[1] - 26),
                                        (p[0] - 9, p[1] - 26)], PAL["timber_deep"], W_HAIR), 2.0)
            archway(sc, 4.15, 3.6, 0.55, 1.5, 0.62)
            for i in range(5):
                column(sc, 2.75 + i * 0.72, 4.55, 0.55, 1.75, 0.15)
            for i in range(2):
                column(sc, 2.75 + i * 2.88, 3.95, 0.55, 1.75, 0.15)
            gable(sc, 2.6, 2.0, 5.7, 4.65, 1.75, 0.22, "x", ov=0.2, gable_mat="roof")
            gable(sc, 2.9, 2.2, 5.4, 4.65, 2.35, 0.6, "x")
        steps(sc, 3.2, 5.6, 5.1, 4.95, 3, 0.0, 0.18)
        scroll_rack(sc, 6.4, 2.6, 0.0, 3, 4, 1.0)
        scroll_rack(sc, 6.4, 4.1, 0.0, 2, 4, 0.9)
        lectern(sc, 1.9, 5.3)
        well(sc, 1.7, 3.3)
        amphora(sc, 6.6, 5.4)
        amphora(sc, 6.85, 5.65)
        crate(sc, 2.2, 6.2)
        bush(sc, 6.9, 6.2, 1.0)
        tuft(sc, 1.3, 2.3)
    else:
        with sc.group(6.4 + 5.2):
            box(sc, 1.8, 1.5, 6.4, 5.2, 0, 0.8, "stone")
            stone_blocks(sc, 1.8, 1.5, 6.4, 5.2, 0, 0.8, 3)
            # the hall proper, two storeys, with an apse behind it for Minerva
            apse(sc, 2.3, 2.6, 0.8, 2.0, 0.92)
            box(sc, 2.3, 1.7, 6.0, 3.5, 0.8, 2.3, "plaster")
            wall_courses(sc, 2.3, 1.7, 6.0, 3.5, 0.8, 2.3, 5)
            box(sc, 2.6, 1.9, 5.7, 3.3, 2.3, 3.1, "plaster", tint=1.05)
            for i in range(5):
                p = iso(2.85 + i * 0.66, 3.3, 2.62)
                sc.add(6.4 + 5.2, poly([(p[0] - 10, p[1]), (p[0] + 10, p[1]), (p[0] + 10, p[1] - 30),
                                        (p[0] - 10, p[1] - 30)], PAL["timber_deep"], W_HAIR), 2.62)
            archway(sc, 4.15, 3.5, 0.8, 2.0, 0.7)
            for i in range(6):
                column(sc, 2.45 + i * 0.7, 4.9, 0.8, 2.3, 0.16)
            for i in range(3):
                column(sc, 2.45, 3.75 + i * 0.58, 0.8, 2.3, 0.16)
                column(sc, 5.95, 3.75 + i * 0.58, 0.8, 2.3, 0.16)
            gable(sc, 2.3, 1.7, 6.0, 5.0, 2.3, 0.26, "x", ov=0.22, gable_mat="roof")
            gable(sc, 2.6, 1.9, 5.7, 5.0, 3.1, 0.78, "x")
        steps(sc, 2.9, 6.2, 5.4, 5.25, 4, 0.0, 0.2)
        statue(sc, 1.9, 6.5)
        scroll_rack(sc, 6.7, 2.3, 0.0, 3, 4, 1.05)
        scroll_rack(sc, 6.7, 3.8, 0.0, 3, 4, 1.05)
        lectern(sc, 1.5, 5.4)
        lectern(sc, 1.9, 6.0, scroll=False)
        sundial(sc, 6.5, 5.9)
        cart(sc, 2.6, 6.8)
        well(sc, 1.4, 3.1)
        sc.anim("flag", 1.45, 4.55, 2.25, 0.85)
        banner(sc, 1.45, 4.55, 1.4, 0.85)
        sc.anim("flag", 6.55, 4.55, 2.25, 0.85)
        banner(sc, 6.55, 4.55, 1.4, 0.85)
        bush(sc, 7.0, 6.5, 1.0)
        tuft(sc, 1.1, 2.1)


BUILDINGS = {
    "forum": forum, "castellum": castellum, "warehouse": warehouse, "granary": granary,
    "cellars": cellars, "insulae": insulae, "market": market, "temple": temple,
    "library": library, "waystation": waystation, "lumber-camp": lumber_camp,
    "clay-works": clay_works, "iron-mine": iron_mine, "farm": farm,
}
PAVED = {"forum", "market", "temple", "library", "waystation", "insulae", "warehouse"}


def compose(name, tier):
    sc = Scene()
    plate(sc, paved=name in PAVED)
    BUILDINGS[name](sc, tier)
    return sc.svg(), sc.anims


def anchor_relative(anims, entry):
    """viewBox coords -> sprite pixels relative to the plate anchor."""
    ox, oy = entry["trimOffset"]
    k = entry["sourceScale"]
    out = []
    for a in anims:
        px, py = a["vx"] - VIEWBOX[0], a["vy"] - VIEWBOX[1]
        out.append({
            "type": "anim",
            "kind": a["kind"],
            "x": round((px - ox) * k - entry["ax"], 2),
            "y": round((py - oy) * k - entry["ay"], 2),
            "scale": a["scale"],
        })
    return out


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("names", nargs="*", help="building ids; default all")
    p.add_argument("--tiers", default="1,2,3")
    p.add_argument("--svg-dir", default=os.path.join(ROOT, "assets", "src", "drawn"))
    p.add_argument("--out", default=os.path.join(ROOT, "assets", "buildings"))
    p.add_argument("--ppu", type=int, default=4)
    p.add_argument("--plate-tiles", type=float, default=1.75,
                   help="how many layout tiles wide a building plot is")
    p.add_argument("--svg-only", action="store_true")
    a = p.parse_args(argv)
    names = a.names or list(BUILDINGS)
    tiers = [int(t) for t in a.tiers.split(",")]
    os.makedirs(a.svg_dir, exist_ok=True)
    tile_w = int(round(artgen.tile_width_from_layout() * a.plate_tiles))
    entries = {}
    with tempfile.TemporaryDirectory() as td:
        for name in names:
            for tier in tiers:
                key = f"{name}-t{tier}"
                svg, anims = compose(name, tier)
                svg_path = os.path.join(a.svg_dir, f"{key}.svg")
                with open(svg_path, "w") as f:
                    f.write(svg)
                if a.svg_only:
                    print(f"{key}: svg")
                    continue
                png = os.path.join(td, f"{key}.png")
                cairosvg.svg2png(bytestring=svg.encode(), write_to=png)
                n, e = artgen.process(png, a.out, tile_w, a.ppu, 8, 232)
                if anims:
                    e["overlays"] = anchor_relative(anims, e)
                entries[n] = e
                print(f"{key}: {e['width']}×{e['height']}  anchor ({e['ax']}, {e['ay']})  "
                      f"slopes {e['slopes']['left']:+.3f}/{e['slopes']['right']:+.3f}  overhang {e['overhangPx']}")
    if entries:
        m = artgen.write_manifest(a.out, entries, tile_w, a.ppu)
        # Record how many layout tiles a plot spans. A plot wider than one tile
        # is what makes neighbouring plates meet instead of floating apart.
        with open(m) as f:
            data = json.load(f)
        data["plateTiles"] = a.plate_tiles
        with open(m, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        print(f"wrote {len(entries)} sprites and {os.path.relpath(m, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
