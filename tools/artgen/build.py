#!/usr/bin/env python3
"""
artgen — turns rendered building images into game sprites.

Input:  assets/src/<name>.jpg (or explicit paths). A single structure on a
        plain white background, standing on an isometric ground plate drawn as
        a 2:1 diamond.
Output: <out>/<name>.png (RGBA) and <out>/manifest.json.

Conventions (CLAUDE.md):
  * The ground plate is the base diamond.
  * Anchor = plate centre = midpoint of the plate's left and right corners.
  * Plate width in the scene equals the tile width (data/layout.json). Pixels
    are exported at `ppu` pixels per scene unit so the sprite keeps resolution;
    the renderer divides by ppu.
  * One structure per sprite.

Steps: key white background to alpha (only background connected to the image
border, so cream walls and highlights survive) → trim with padding → find the
plate's left, right and bottom corners as the extreme opaque pixels → assert
the plate edges slope within 10% of ±0.5 → anchor → scale → write.

`--selftest` synthesises a plate and checks the maths without any source art.
"""
import argparse
import json
import os
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_SRC = os.path.join(ROOT, "assets", "src")
DEFAULT_OUT = os.path.join(ROOT, "assets", "buildings")
LAYOUT = os.path.join(ROOT, "data", "layout.json")

SLOPE = 0.5
SLOPE_TOL = 0.10  # ±10 % of 0.5


class PlateError(Exception):
    pass


# ------------------------------------------------------------------ keying
def background_candidates(rgb: np.ndarray, white: int, tol: int = 18) -> np.ndarray:
    """Pixels that could be background: near-white, or, when the border is a painted
    checkerboard, any neutral grey between its two dominant greys (± tol)."""
    near = rgb.min(axis=2) >= white
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(np.int32)
    neutral_border = border[(border.max(axis=1) - border.min(axis=1)) <= 24]
    if len(neutral_border) < 0.5 * len(border):
        return near
    lum = neutral_border.mean(axis=1)
    q = (lum // 16).astype(np.int32)
    keys, counts = np.unique(q, return_counts=True)
    dominant = [k * 16 + 8 for k, c in zip(keys, counts) if c >= 0.10 * len(border)]
    if not dominant:
        return near
    lo, hi = min(dominant) - tol, max(dominant) + tol
    if lo >= white:
        return near
    mx, mn = rgb.max(axis=2).astype(np.int32), rgb.min(axis=2).astype(np.int32)
    band = ((mx - mn) <= 24) & (mn >= lo) & (mx <= hi)
    return near | band


def despeckle(opaque: np.ndarray, r: int = 2, keep: int = 8) -> np.ndarray:
    """Drop opaque pixels with fewer than `keep` opaque neighbours in a (2r+1)² window."""
    h, w = opaque.shape
    p = np.pad(opaque.astype(np.int32), r + 1)
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    count = c[k : k + h, k : k + w] - c[:h, k : k + w] - c[k : k + h, :w] + c[:h, :w]
    return opaque & (count >= keep)


def key_background(rgb: np.ndarray, white: int = 232) -> np.ndarray:
    """Return alpha (uint8). Background = background-coloured pixels connected to the border."""
    near = background_candidates(rgb, white)
    h, w = near.shape
    bg = np.zeros_like(near)
    bg[0, :] = near[0, :]
    bg[-1, :] = near[-1, :]
    bg[:, 0] = near[:, 0]
    bg[:, -1] = near[:, -1]
    # Propagate from the border through near-white pixels (4-connected flood fill).
    while True:
        grown = bg.copy()
        grown[1:, :] |= bg[:-1, :]
        grown[:-1, :] |= bg[1:, :]
        grown[:, 1:] |= bg[:, :-1]
        grown[:, :-1] |= bg[:, 1:]
        grown &= near
        if np.array_equal(grown, bg):
            break
        bg = grown
    bg |= ~despeckle(~bg)
    alpha = np.full((h, w), 255, dtype=np.uint8)
    alpha[bg] = 0
    # Soften the 1-px rim so anti-aliased outlines do not get a white halo.
    rim = np.zeros_like(bg)
    rim[1:, :] |= bg[:-1, :]
    rim[:-1, :] |= bg[1:, :]
    rim[:, 1:] |= bg[:, :-1]
    rim[:, :-1] |= bg[:, 1:]
    rim &= ~bg
    lum = rgb.astype(np.int32).min(axis=2)
    ramp = np.clip((255 - lum) * 255 // max(1, 255 - white + 40), 0, 255).astype(np.uint8)
    alpha[rim] = np.maximum(ramp[rim], 64)
    return alpha


# ------------------------------------------------------------------ geometry
def _column_extremes(alpha: np.ndarray):
    """For every column holding opaque pixels, the y of its lowest opaque pixel."""
    opaque = alpha > 128
    h = opaque.shape[0]
    xs = np.nonzero(opaque.any(axis=0))[0]
    if len(xs) == 0:
        raise PlateError("no opaque pixels after keying")
    ybottom = h - 1 - np.argmax(opaque[::-1, :], axis=0)
    return xs.astype(float), ybottom[xs].astype(float)


def _theil_sen(x: np.ndarray, y: np.ndarray, max_pairs: int = 40000, seed: int = 0):
    """Median-of-pairwise-slopes line fit. Robust to the ~30% of points that are not the edge."""
    n = len(x)
    if n < 8:
        raise PlateError("too few silhouette points to fit a plate edge")
    if n * (n - 1) // 2 > max_pairs:
        rng = np.random.default_rng(seed)
        i, j = rng.integers(0, n, max_pairs), rng.integers(0, n, max_pairs)
        keep = x[i] != x[j]
        i, j = i[keep], j[keep]
    else:
        i, j = np.triu_indices(n, 1)
        keep = x[i] != x[j]
        i, j = i[keep], j[keep]
    slope = float(np.median((y[j] - y[i]) / (x[j] - x[i])))
    return slope, float(np.median(y - slope * x))


def plate_corners(alpha: np.ndarray, tol_frac: float = 0.006):
    """Left, right and bottom corners of the ground plate.

    The bottom corner is the lowest opaque pixel. The side corners are the
    extreme opaque pixels *that lie on the plate's own bottom edge*: each edge
    is fitted robustly to the bottom silhouette, then the corner is the furthest
    point still on that line. Taking the plain extreme pixel instead puts the
    corner on anything that overhangs the plate — a tree, an eave, a crane arm.
    """
    xs, yb = _column_extremes(alpha)
    ymax = yb.max()
    xbottom = float(np.median(xs[yb == ymax]))
    width = float(alpha.shape[1])
    tol = max(3.0, tol_frac * width)
    margin = max(3.0, 0.01 * width)

    def side(is_left: bool):
        mask = (xs < xbottom - margin) if is_left else (xs > xbottom + margin)
        sx, sy = xs[mask], yb[mask]
        if len(sx) < 8:
            # Too little edge to fit: fall back to the plain extreme pixel.
            ex = xs.min() if is_left else xs.max()
            return float(ex), float(yb[xs == ex].max())
        m, b = _theil_sen(sx, sy)
        on = np.abs(sy - (m * sx + b)) <= tol
        if not on.any():
            ex = sx.min() if is_left else sx.max()
            return float(ex), float(sy[sx == ex][0])
        cand = sx[on]
        cx = cand.min() if is_left else cand.max()
        return float(cx), float(sy[sx == cx][0])

    return side(True), side(False), (xbottom, float(ymax))


def check_slopes(left, right, bottom):
    (xl, yl), (xr, yr), (xb, yb) = left, right, bottom
    if xb == xl or xb == xr:
        raise PlateError("bottom corner coincides with a side corner")
    s_left = (yb - yl) / (xb - xl)
    s_right = (yb - yr) / (xb - xr)
    lo, hi = SLOPE * (1 - SLOPE_TOL), SLOPE * (1 + SLOPE_TOL)
    ok = lo <= s_left <= hi and -hi <= s_right <= -lo
    if not ok:
        raise PlateError(
            f"plate edges are not 2:1 isometric: left→bottom slope {s_left:+.3f}, "
            f"right→bottom slope {s_right:+.3f}; expected within ±10% of ±{SLOPE}. "
            f"Corners L={left} R={right} B={bottom}. Is the leftmost/rightmost pixel really the plate?"
        )
    return s_left, s_right


# ------------------------------------------------------------------ pipeline
def process(path: str, out_dir: str, tile_width: int, ppu: int, pad: int, white: int) -> dict:
    name = os.path.splitext(os.path.basename(path))[0]
    img = Image.open(path).convert("RGB")
    rgb = np.asarray(img)
    alpha = key_background(rgb, white)

    ys, xs = np.nonzero(alpha > 0)
    x0, x1 = max(0, xs.min() - pad), min(rgb.shape[1], xs.max() + 1 + pad)
    y0, y1 = max(0, ys.min() - pad), min(rgb.shape[0], ys.max() + 1 + pad)
    rgb = rgb[y0:y1, x0:x1]
    alpha = alpha[y0:y1, x0:x1]

    left, right, bottom = plate_corners(alpha)
    s_left, s_right = check_slopes(left, right, bottom)
    ys_all, xs_all = np.nonzero(alpha > 128)
    overhang = [round(float(left[0] - xs_all.min()), 1), round(float(xs_all.max() - right[0]), 1)]
    ax = (left[0] + right[0]) / 2
    ay = (left[1] + right[1]) / 2
    plate_px = right[0] - left[0]

    scale = (tile_width * ppu) / plate_px
    rgba = np.dstack([rgb, alpha])
    sprite = Image.fromarray(rgba, "RGBA")
    w = max(1, round(sprite.width * scale))
    h = max(1, round(sprite.height * scale))
    sprite = sprite.resize((w, h), Image.LANCZOS)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{name}.png")
    sprite.save(out_path, optimize=True)

    entry = {
        "file": f"{name}.png",
        "width": w,
        "height": h,
        "ax": round(ax * scale, 2),
        "ay": round(ay * scale, 2),
        "ppu": ppu,
        "plateWidth": tile_width,
        "source": os.path.relpath(path, ROOT),
        "trimOffset": [int(x0), int(y0)],
        "sourceScale": round(scale, 6),
        "slopes": {"left": round(s_left, 4), "right": round(s_right, 4)},
        "overhangPx": overhang,
    }
    return name, entry


def write_manifest(out_dir: str, entries: dict, tile_width: int, ppu: int):
    mpath = os.path.join(out_dir, "manifest.json")
    manifest = {"tileWidth": tile_width, "ppu": ppu, "sprites": {}}
    if os.path.exists(mpath):
        with open(mpath) as f:
            old = json.load(f)
        if old.get("tileWidth") == tile_width and old.get("ppu") == ppu:
            manifest["sprites"] = old.get("sprites", {})
    manifest["sprites"].update(entries)
    manifest["sprites"] = dict(sorted(manifest["sprites"].items()))
    with open(mpath, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    return mpath


def tile_width_from_layout() -> int:
    with open(LAYOUT) as f:
        return int(json.load(f)["tile"]["w"])


# ------------------------------------------------------------------ self-test
def synth_plate(path: str, skew: float = 0.0, size=(900, 700), plate_w=600, box_h=200):
    """White image with a 2:1 diamond plate (optionally skewed) and a box on it."""
    img = Image.new("RGB", size, (255, 255, 255))
    d = ImageDraw.Draw(img)
    cx, cy = size[0] // 2, size[1] - 260
    hw = plate_w // 2
    hh = int(hw * (0.5 + skew))
    L, S, E, N = (cx - hw, cy), (cx, cy + hh), (cx + hw, cy), (cx, cy - hh)
    d.polygon([L, S, E, N], fill=(160, 140, 100), outline=(40, 30, 20))
    # a box: front faces plus a light (cream) roof to test that interior near-white survives keying
    d.polygon([L, S, (S[0], S[1] - box_h), (L[0], L[1] - box_h)], fill=(200, 180, 140), outline=(40, 30, 20))
    d.polygon([S, E, (E[0], E[1] - box_h), (S[0], S[1] - box_h)], fill=(230, 215, 180), outline=(40, 30, 20))
    d.polygon([(L[0], L[1] - box_h), (S[0], S[1] - box_h), (E[0], E[1] - box_h), (N[0], N[1] - box_h)], fill=(248, 244, 236), outline=(40, 30, 20))
    img.save(path, quality=95)
    return (L, E, S)


def selftest() -> int:
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, "test-t1.jpg")
        L, E, S = synth_plate(src)
        name, e = process(src, os.path.join(td, "out"), tile_width=64, ppu=4, pad=8, white=232)
        assert name == "test-t1"
        assert e["width"] > 0 and e["height"] > 0
        # plate width maps to tile width × ppu
        expected_scale = (64 * 4) / (E[0] - L[0])
        # anchor: midpoint of L and E, moved by the trim offset (plate left − pad) then scaled
        trim_x = L[0] - 8
        exp_ax = ((L[0] + E[0]) / 2 - trim_x) * expected_scale
        assert abs(e["ax"] - exp_ax) <= 1.5, (e["ax"], exp_ax)
        assert abs(e["ax"] - e["width"] / 2) <= 1.5, "anchor x must sit at the sprite's horizontal centre"
        assert abs(abs(e["slopes"]["left"]) - 0.5) <= 0.05 and abs(abs(e["slopes"]["right"]) - 0.5) <= 0.05
        # the cream roof must not have been keyed out
        png = np.asarray(Image.open(os.path.join(td, "out", e["file"])).convert("RGBA"))
        top = png[: png.shape[0] // 3, :, 3]
        assert top.max() == 255, "interior near-white was keyed to alpha"
        # a skewed plate must fail loudly
        bad = os.path.join(td, "bad-t1.jpg")
        synth_plate(bad, skew=0.12)
        try:
            process(bad, os.path.join(td, "out2"), 64, 4, 8, 232)
        except PlateError as err:
            assert "not 2:1" in str(err)
        else:
            raise AssertionError("skewed plate was accepted")
        m = write_manifest(os.path.join(td, "out"), {name: e}, 64, 4)
        with open(m) as f:
            assert json.load(f)["sprites"]["test-t1"]["ax"] == e["ax"]
        # A silhouette overhanging its plate (foliage, an eave) must not drag the corner out.
        over = os.path.join(td, "over-t1.jpg")
        Lo, Eo, So = synth_plate(over)
        img = Image.open(over)
        dd = ImageDraw.Draw(img)
        dd.ellipse([Eo[0] + 40, Eo[1] - 220, Eo[0] + 150, Eo[1] - 110], fill=(70, 100, 60), outline=(40, 30, 20))
        img.save(over, quality=95)
        a_over = key_background(np.asarray(Image.open(over).convert("RGB")), 232)
        L2, R2, B2 = plate_corners(a_over)
        assert abs(R2[0] - Eo[0]) <= 6, f"overhang pulled the right corner to {R2} (plate corner {Eo})"
        assert abs(L2[0] - Lo[0]) <= 6, (L2, Lo)
        check_slopes(L2, R2, B2)
    print("artgen selftest OK")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("inputs", nargs="*", help="source images; default assets/src/*.jpg")
    p.add_argument("--out", default=DEFAULT_OUT)
    p.add_argument("--tile-width", type=int, default=None, help="default: data/layout.json tile.w")
    p.add_argument("--ppu", type=int, default=4, help="exported pixels per scene unit")
    p.add_argument("--pad", type=int, default=8)
    p.add_argument("--white", type=int, default=232, help="min channel value counted as background")
    p.add_argument("--selftest", action="store_true")
    a = p.parse_args(argv)
    if a.selftest:
        return selftest()
    tile_width = a.tile_width or tile_width_from_layout()
    inputs = a.inputs or sorted(
        os.path.join(DEFAULT_SRC, f) for f in os.listdir(DEFAULT_SRC) if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ) if os.path.isdir(DEFAULT_SRC) else a.inputs
    if not inputs:
        print("no inputs", file=sys.stderr)
        return 2
    entries = {}
    for path in inputs:
        try:
            name, e = process(path, a.out, tile_width, a.ppu, a.pad, a.white)
        except PlateError as err:
            print(f"FAIL {path}: {err}", file=sys.stderr)
            return 1
        entries[name] = e
        print(f"{name}: {e['width']}×{e['height']} px, anchor ({e['ax']}, {e['ay']}), slopes {e['slopes']}")
    m = write_manifest(a.out, entries, tile_width, a.ppu)
    print(f"wrote {len(entries)} sprite(s) and {os.path.relpath(m, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
