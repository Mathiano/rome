# Overlays

Looping sprite-sheet animations for tier-3 buildings, written by `tools/artgen/loop.py`
from a still plus a short clip of the same frame. Each sheet is horizontal, at most
16 frames and 256 px tall, and its manifest entry is attached to the building sprite's
entry in `assets/buildings/manifest.json`, positioned relative to the plate anchor.

Empty for now: no clip has passed the pipeline's moving-region gate. See the
2026-09-18 addendum in `docs/CAPSULE-SESSION-2026-09-15.md`.
