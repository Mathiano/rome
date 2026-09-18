# Style anchor

`anchor-v1.jpg` is the reference every building render is prompted against; `PROMPTS.md` holds the prompts. Run `python3 tools/artgen/build.py assets/style/anchor-v1.jpg --out assets/style` to check the anchor itself passes the plate test.

`anchor-v1.png` and `manifest.json` here are that check's output (2026-09-17: slopes 0.528 / −0.528). The anchor is a style reference, not a building sprite; it is not in `assets/buildings/manifest.json`.
