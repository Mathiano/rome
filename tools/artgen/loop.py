#!/usr/bin/env python3
"""
artgen/loop.py — turns a still plus a short MP4 of the same frame into a looping
sprite-sheet overlay for one building sprite.

Steps
  1. Extract every frame with ffmpeg at --fps (default 12).
  2. Find the best loop window: for each start frame s and each N in
     [--n-min, --n-max] (default 12..18 = 1.0–1.5 s at 12 fps) score
     mean |frame[s] − frame[s+N]| and keep the lowest. The top three are printed.
  3. Register the still into frame space by matching ground-plate corners
     (falls back to a correlation search, or --identity when the still IS a
     frame of the clip). Compute the per-pixel difference envelope of the window
     frames against the registered still; moving = envelope > --threshold with
     a local-density filter so codec flicker on outlines does not count. Print
     the moving bounding box as a percentage of frame area and FAIL LOUDLY
     above --max-area (default 40%): that means the model re-rendered the whole
     frame instead of animating one region.
  4. Crop the window frames to the box plus padding, key the white background
     to alpha, write a horizontal sprite sheet (max --max-frames 16, max
     --max-height 256 px) to assets/overlays/, and add
     {type:"loop", x, y, width, height, frames, fps, file, licence, ...} to the
     sprite's entry in assets/buildings/manifest.json, positioned relative to
     the sprite's plate anchor in sprite pixels (same units as ax/ay).

`--selftest` runs the whole chain on synthetic frames without ffmpeg.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as artgen  # noqa: E402

ROOT = artgen.ROOT
DEFAULT_OUT = os.path.join(ROOT, "assets", "overlays")
DEFAULT_MANIFEST = os.path.join(ROOT, "assets", "buildings", "manifest.json")
DEFAULT_LICENCE = "Google Veo via Gemini — verify commercial terms and SynthID before ship; PoC only"


class LoopError(Exception):
    pass


# ------------------------------------------------------------------ ffmpeg
def find_ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    raise LoopError("ffmpeg not found: install ffmpeg or `pip install imageio-ffmpeg`")


def extract_frames(mp4: str, fps: int, workdir: str) -> list:
    exe = find_ffmpeg()
    pattern = os.path.join(workdir, "%05d.png")
    subprocess.run([exe, "-hide_banner", "-loglevel", "error", "-i", mp4, "-vf", f"fps={fps}", pattern], check=True)
    files = sorted(f for f in os.listdir(workdir) if f.endswith(".png"))
    if len(files) < 2:
        raise LoopError("ffmpeg produced fewer than two frames")
    return [np.asarray(Image.open(os.path.join(workdir, f)).convert("RGB")) for f in files]


# ------------------------------------------------------------------ loop window
def best_windows(frames: list, n_min: int, n_max: int, top: int = 3) -> list:
    """Return [(score, start, N)] sorted by score; score = mean abs grey difference."""
    grey = [f.mean(axis=2) if f.ndim == 3 else f.astype(float) for f in frames]
    T = len(grey)
    if T <= n_min:
        raise LoopError(f"clip has {T} frames, need more than {n_min}")
    out = []
    for s in range(0, T - n_min):
        for n in range(n_min, n_max + 1):
            if s + n >= T:
                break
            out.append((float(np.abs(grey[s] - grey[s + n]).mean()), s, n))
    out.sort()
    return out[:top]


# ------------------------------------------------------------------ registration
def plate_anchor(rgb: np.ndarray):
    """Plate corners (L, R, B) or None if they fail the 2:1 test."""
    alpha = artgen.key_background(rgb)
    try:
        L, R, B = artgen.plate_corners(alpha)
        artgen.check_slopes(L, R, B)
        return L, R, B
    except artgen.PlateError:
        return None


def register(still: np.ndarray, frame: np.ndarray, identity: bool = False):
    """Map frame pixels to still pixels: still_xy = (frame_xy − (ox, oy)) · k. Returns (k, ox, oy, how)."""
    if identity:
        return 1.0, 0.0, 0.0, "identity"
    ps, pf = plate_anchor(still), plate_anchor(frame)
    if ps and pf:
        (Ls, Rs, _), (Lf, Rf, _) = ps, pf
        k = (Rs[0] - Ls[0]) / (Rf[0] - Lf[0])
        return k, Lf[0] - Ls[0] / k, Lf[1] - Ls[1] / k, "plate corners"
    return register_by_correlation(still, frame)


def register_by_correlation(still: np.ndarray, frame: np.ndarray):
    """Brute-force scale + offset search on downscaled greys (normalised cross-correlation)."""
    fh, fw = frame.shape[:2]
    small = 200
    r = small / fw
    F = np.asarray(Image.fromarray(frame).convert("L").resize((small, int(fh * r)))).astype(float)
    F = (F - F.mean()) / (F.std() + 1e-6)
    best = None
    for k in np.arange(0.7, 1.45, 0.025):  # still px per frame px
        sw = max(8, int(round(still.shape[1] / k * r)))
        sh = max(8, int(round(still.shape[0] / k * r)))
        if sw > F.shape[1] * 1.5 or sh > F.shape[0] * 1.5:
            continue
        S = np.asarray(Image.fromarray(still).convert("L").resize((sw, sh))).astype(float)
        S = (S - S.mean()) / (S.std() + 1e-6)
        # slide S over F (both may overhang); coarse step then keep best
        for oy in range(-sh // 2, F.shape[0] - sh // 2, 4):
            for ox in range(-sw // 2, F.shape[1] - sw // 2, 4):
                y0, y1 = max(0, oy), min(F.shape[0], oy + sh)
                x0, x1 = max(0, ox), min(F.shape[1], ox + sw)
                if y1 - y0 < sh // 2 or x1 - x0 < sw // 2:
                    continue
                a = F[y0:y1, x0:x1]
                b = S[y0 - oy : y1 - oy, x0 - ox : x1 - ox]
                score = float((a * b).mean())
                if best is None or score > best[0]:
                    best = (score, k, ox / r, oy / r)
    if best is None:
        raise LoopError("could not register the still to the clip")
    _, k, ox, oy = best
    return k, ox, oy, "correlation search"


def still_in_frame_space(still: np.ndarray, k: float, ox: float, oy: float, size) -> np.ndarray:
    w, h = size
    sw, sh = max(1, int(round(still.shape[1] / k))), max(1, int(round(still.shape[0] / k)))
    canvas = Image.new("RGB", (w, h), (255, 255, 255))
    canvas.paste(Image.fromarray(still).resize((sw, sh), Image.LANCZOS), (int(round(ox)), int(round(oy))))
    return np.asarray(canvas)


# ------------------------------------------------------------------ moving region
def box_count(mask: np.ndarray, r: int) -> np.ndarray:
    """Number of true pixels in the (2r+1)² neighbourhood of each pixel."""
    h, w = mask.shape
    p = np.pad(mask.astype(np.int32), r + 1)
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    return c[k : k + h, k : k + w] - c[:h, k : k + w] - c[k : k + h, :w] + c[:h, :w]


def moving_region(window: list, still_fs: np.ndarray, threshold: int, density: float, radius: int = 4):
    env = np.zeros(still_fs.shape[:2], np.int16)
    ref = still_fs.astype(np.int16)
    for f in window:
        env = np.maximum(env, np.abs(f.astype(np.int16) - ref).max(axis=2))
    raw = env > threshold
    dense = raw & (box_count(raw, radius) >= density * (2 * radius + 1) ** 2)
    ys, xs = np.nonzero(dense)
    if len(xs) == 0:
        raise LoopError("nothing moves above the threshold; is this the right clip for this still?")
    bbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) / (env.shape[0] * env.shape[1])
    return env, dense, bbox, area


# ------------------------------------------------------------------ sheet
def make_sheet(window: list, bbox, pad: int, max_frames: int, max_height: int, white: int):
    x0, y0, x1, y1 = bbox
    H, W = window[0].shape[:2]
    x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    idx = list(range(len(window)))
    if len(idx) > max_frames:
        idx = [int(round(i * (len(window) - 1) / (max_frames - 1))) for i in range(max_frames)]
        idx = sorted(set(idx))
    crops = []
    for i in idx:
        c = window[i][y0:y1, x0:x1]
        a = artgen.key_background(c, white)
        crops.append(Image.fromarray(np.dstack([c, a]), "RGBA"))
    fw, fh = crops[0].size
    scale = min(1.0, max_height / fh)
    if scale < 1.0:
        fw, fh = max(1, round(fw * scale)), max(1, round(fh * scale))
        crops = [c.resize((fw, fh), Image.LANCZOS) for c in crops]
    sheet = Image.new("RGBA", (fw * len(crops), fh), (0, 0, 0, 0))
    for i, c in enumerate(crops):
        sheet.paste(c, (i * fw, 0))
    return sheet, (x0, y0, x1, y1), len(crops), fw, fh


# ------------------------------------------------------------------ manifest
def load_manifest(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def sprite_space(entry: dict):
    """Source-pixel → sprite-pixel transform for an artgen entry. Requires trimOffset/sourceScale."""
    if "trimOffset" not in entry or "sourceScale" not in entry:
        raise LoopError("sprite entry lacks trimOffset/sourceScale; regenerate it with the current tools/artgen/build.py")
    tx, ty = entry["trimOffset"]
    s = entry["sourceScale"]
    return lambda x, y: ((x - tx) * s - entry["ax"], (y - ty) * s - entry["ay"]), s


def run(still_path, mp4_path, name, sprite_key, out_dir, manifest_path, fps, n_min, n_max, threshold, density,
        max_area, pad, max_frames, max_height, white, licence, identity, frames=None, still_rgb=None, anchor=None):
    still = still_rgb if still_rgb is not None else np.asarray(Image.open(still_path).convert("RGB"))
    with tempfile.TemporaryDirectory() as td:
        if frames is None:
            frames = extract_frames(mp4_path, fps, td)
    print(f"{len(frames)} frames at {fps} fps, {frames[0].shape[1]}×{frames[0].shape[0]}")

    top = best_windows(frames, n_min, n_max)
    print("loop candidates (score, start, N):")
    for sc, s, n in top:
        print(f"  {sc:7.3f}  start {s:4d}  N {n:2d}  ({n / fps:.2f} s)")
    score, start, n = top[0]
    window = frames[start : start + n]

    k, ox, oy, how = register(still, frames[start], identity)
    print(f"registration: {how}; still px per frame px {k:.4f}, still origin at frame ({ox:.1f}, {oy:.1f})")
    still_fs = still_in_frame_space(still, k, ox, oy, (frames[0].shape[1], frames[0].shape[0]))

    env, dense, bbox, area = moving_region(window, still_fs, threshold, density)
    print(f"moving region (frame px): x {bbox[0]}..{bbox[2]}, y {bbox[1]}..{bbox[3]} = {area * 100:.1f}% of frame area "
          f"(threshold {threshold}, density {density}); dense moving pixels {dense.mean() * 100:.1f}%")
    if area > max_area:
        raise LoopError(
            f"moving region covers {area * 100:.1f}% of the frame, above the {max_area * 100:.0f}% limit: "
            f"the model re-rendered the whole frame rather than animating one region. Re-generate the clip."
        )

    sheet, crop, nframes, fw, fh = make_sheet(window, bbox, pad, max_frames, max_height, white)
    os.makedirs(out_dir, exist_ok=True)
    file = f"{name}.png"
    sheet.save(os.path.join(out_dir, file), optimize=True)
    out_fps = round(fps * nframes / n, 2)

    # Position relative to the plate anchor, in sprite pixels.
    manifest = load_manifest(manifest_path) if os.path.exists(manifest_path) else {"sprites": {}}
    if sprite_key:
        entry = manifest["sprites"].get(sprite_key)
        if not entry:
            raise LoopError(f"sprite '{sprite_key}' is not in {manifest_path}; run tools/artgen/build.py on its still first")
        to_sprite, s = sprite_space(entry)
        sx0, sy0 = to_sprite((crop[0] - ox) * k, (crop[1] - oy) * k)
        width, height = (crop[2] - crop[0]) * k * s, (crop[3] - crop[1]) * k * s
        anchor_how = f"sprite {sprite_key}"
    else:
        if anchor is None:
            pa = plate_anchor(frames[start])
            if pa:
                (L, R, _) = pa
                anchor = ((L[0] + R[0]) / 2, (L[1] + R[1]) / 2)
                anchor_how = "frame plate corners"
            else:
                raise LoopError("no --sprite and the frame's plate corners fail the 2:1 test; pass --anchor X,Y (frame px)")
        else:
            anchor_how = "given"
        sx0, sy0 = crop[0] - anchor[0], crop[1] - anchor[1]
        width, height = crop[2] - crop[0], crop[3] - crop[1]
    overlay = {
        "type": "loop",
        "file": file,
        "x": round(sx0, 2),
        "y": round(sy0, 2),
        "width": round(width, 2),
        "height": round(height, 2),
        "frames": nframes,
        "fps": out_fps,
        "frameWidth": fw,
        "frameHeight": fh,
        "licence": licence,
        "source": os.path.relpath(mp4_path, ROOT) if mp4_path else None,
        "window": {"start": start, "n": n, "score": round(score, 3)},
        "movingArea": round(area, 4),
        "anchor": anchor_how,
    }
    if sprite_key:
        entry.setdefault("overlays", [])
        entry["overlays"] = [o for o in entry["overlays"] if o.get("file") != file] + [overlay]
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
            f.write("\n")
        where = manifest_path
    else:
        where = os.path.join(out_dir, "manifest.json")
        standalone = load_manifest(where) if os.path.exists(where) else {"overlays": {}}
        standalone.setdefault("overlays", {})[name] = overlay
        with open(where, "w") as f:
            json.dump(standalone, f, indent=2)
            f.write("\n")
    print(f"wrote {file}: {nframes} frames {fw}×{fh} at {out_fps} fps; overlay at ({overlay['x']}, {overlay['y']}) "
          f"size {overlay['width']}×{overlay['height']} relative to the plate anchor ({anchor_how}); manifest {os.path.relpath(where, ROOT)}")
    return overlay


# ------------------------------------------------------------------ self-test
def synth_frames(still: np.ndarray, count: int, period: int, region=(560, 60, 660, 200), rerender=False):
    """Frames = still + a puff rising through `region` with an exact period; optionally global noise."""
    rng = np.random.default_rng(1)
    out = []
    x0, y0, x1, y1 = region
    for i in range(count):
        f = still.copy()
        t = (i % period) / period
        cy = y1 - 20 - t * (y1 - y0 - 40)
        cx = (x0 + x1) / 2 + 10 * np.sin(2 * np.pi * t)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        blob = ((xx - cx) ** 2 + (yy - cy) ** 2) < 18 ** 2
        patch = f[y0:y1, x0:x1]
        patch[blob] = (150, 150, 150)
        if rerender:
            f = np.clip(f.astype(int) + rng.integers(-60, 60, f.shape), 0, 255).astype(np.uint8)
        out.append(f)
    return out


def selftest() -> int:
    with tempfile.TemporaryDirectory() as td:
        still_path = os.path.join(td, "test-t3.jpg")
        artgen.synth_plate(still_path)
        name, entry = artgen.process(still_path, os.path.join(td, "sprites"), 64, 4, 8, 232)
        mpath = artgen.write_manifest(os.path.join(td, "sprites"), {name: entry}, 64, 4)
        still = np.asarray(Image.open(still_path).convert("RGB"))
        frames = synth_frames(still, 30, 12)
        common = dict(name="test-t3-smoke", out_dir=os.path.join(td, "overlays"), manifest_path=mpath, fps=12, n_min=12,
                      n_max=18, threshold=40, density=0.4, max_area=0.4, pad=8, max_frames=16, max_height=256, white=232,
                      licence="test", identity=False)
        ov = run(still_path, None, sprite_key=name, frames=frames, **common)
        assert ov["frames"] == 12 and ov["fps"] == 12, ov
        assert ov["window"]["n"] == 12 and ov["window"]["score"] < 0.05, ov["window"]
        assert ov["movingArea"] < 0.1, ov["movingArea"]
        # the overlay must sit where the puff is: region x 560..660 maps to sprite space
        to_sprite, s = sprite_space(entry)
        env = np.zeros(still.shape[:2], bool)
        for f in frames[:12]:
            env |= np.abs(f.astype(np.int16) - still.astype(np.int16)).max(axis=2) > 40
        ys, xs = np.nonzero(env)
        ex, ey = to_sprite(xs.min() - 8, ys.min() - 8)
        assert abs(ov["x"] - ex) <= 2 and abs(ov["y"] - ey) <= 2, (ov["x"], ov["y"], ex, ey)
        sheet = Image.open(os.path.join(td, "overlays", ov["file"]))
        assert sheet.mode == "RGBA" and sheet.size == (ov["frameWidth"] * ov["frames"], ov["frameHeight"])
        with open(mpath) as f:
            assert load_manifest(mpath)["sprites"][name]["overlays"][0]["file"] == ov["file"]
        # a whole-frame re-render must fail loudly
        try:
            run(still_path, None, sprite_key=name, frames=synth_frames(still, 30, 12, rerender=True), **common)
        except LoopError as e:
            assert "re-rendered the whole frame" in str(e), e
        else:
            raise AssertionError("whole-frame re-render was accepted")
        # identity registration path
        ov2 = run(still_path, None, sprite_key=None, frames=frames, still_rgb=frames[0], anchor=(450.0, 540.0),
                  **{**common, "identity": True, "name": "test-identity"})
        assert ov2["anchor"] == "given"
    print("loop selftest OK")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("still", nargs="?")
    p.add_argument("mp4", nargs="?")
    p.add_argument("--name", help="overlay name; default: mp4 stem")
    p.add_argument("--sprite", help="manifest key of the building sprite this overlay belongs to, e.g. lumber-camp-t3")
    p.add_argument("--anchor", help="X,Y plate anchor in frame px when no --sprite is given and the plate cannot be detected")
    p.add_argument("--out", default=DEFAULT_OUT)
    p.add_argument("--manifest", default=DEFAULT_MANIFEST)
    p.add_argument("--fps", type=int, default=12)
    p.add_argument("--n-min", type=int, default=12)
    p.add_argument("--n-max", type=int, default=18)
    p.add_argument("--threshold", type=int, default=40, help="max-channel difference counted as motion")
    p.add_argument("--density", type=float, default=0.4, help="fraction of a 9×9 neighbourhood that must also move")
    p.add_argument("--max-area", type=float, default=0.40)
    p.add_argument("--pad", type=int, default=8)
    p.add_argument("--max-frames", type=int, default=16)
    p.add_argument("--max-height", type=int, default=256)
    p.add_argument("--white", type=int, default=232)
    p.add_argument("--licence", default=DEFAULT_LICENCE)
    p.add_argument("--identity", action="store_true", help="the still is a frame of the clip: skip registration")
    p.add_argument("--selftest", action="store_true")
    a = p.parse_args(argv)
    if a.selftest:
        return selftest()
    if not a.still or not a.mp4:
        p.error("still and mp4 are required")
    anchor = tuple(float(v) for v in a.anchor.split(",")) if a.anchor else None
    try:
        run(a.still, a.mp4, a.name or os.path.splitext(os.path.basename(a.mp4))[0], a.sprite, a.out, a.manifest, a.fps,
            a.n_min, a.n_max, a.threshold, a.density, a.max_area, a.pad, a.max_frames, a.max_height, a.white, a.licence,
            a.identity, anchor=anchor)
    except LoopError as e:
        print(f"FAIL: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
