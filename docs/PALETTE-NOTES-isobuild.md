> Retired 2026-09-16 with isobuild (DESIGN §10). Kept for the UI colour tokens in `src/render/style.css`, which still use these values.

# Palette notes

First-pass Roman palette for the isobuild pipeline. Lives in `tools/isobuild/palette.json`; this file explains the choices.

**Status: 🟡 placeholder.** DESIGN §10 says the palette is re-derived from a Roman reference image the way the earlier one was derived from Stonehaven. No reference image and no earlier pipeline exist in this repo (it was started from an empty README), so these values were picked by hand around three materials. Swap them when the reference image is chosen; every sprite regenerates with `npm run assets`.

| Family | Values | Used for |
|---|---|---|
| Ink | `#2a2118` | every outline, doors, window voids, UI text |
| Travertine / plaster | `#e3d6b4` `#c4b58e` `#a89a74` | lit wall, shaded wall, deep shade |
| Stone | `#cfc7b2` `#a9a08a` `#857c68` | castellum, podiums, columns, road |
| Terracotta | `#c96a47` `#a34d33` `#7e3a26` | roof tiles, near slope lighter than far slope |
| Timber | `#a67c4e` `#7d5a36` `#5b3f25` | granary, market roof, cranes, gates |
| Ground | `#9c8a62` `#7a6a48` | base diamond, furrows |
| Green | `#8a9a4c` `#6c7a3a` `#5f7a3a` `#44582a` | grass, leaves |
| Accents | clay `#b8674a`, iron `#6e6f72`, gold `#c9a24a`, grain `#d4b45a`, smoke `#bcb5a8`, water `#6f8f9c` | site markers, flags, animation |

Rules the generator follows:

- Light comes from the upper right: the south-east face is the light face, the south-west face is dark, roofs are lighter on the near slope.
- One ink weight for everything (1.1 px at 64×64), thinner strokes (0.5–0.8) only for interior detail so outlines read at 100% zoom.
- Tier is expressed by height, then by ornament (columns, windows, towers), then by animation. A tier-3 building should be recognisable as the same building at tier 1.
- UI colours in `src/render/style.css` reuse the same values so the panel and the map read as one object.
