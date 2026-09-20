# Sprite prompts — Rome III

Every building sprite is an **edit of the style anchor**, never a fresh generation. Style is decided by `anchor-v1.jpg`; prompts below only change the subject.

Validated 2026-09-16: anchor (villa) and first derived sprite (lumber camp tier 1) measured at 2:1 isometric within 5%, plates symmetric within 2%, style consistent.

## Anchor prompt (used once, for `anchor-v1.jpg`)

> Roman colonia building, isometric 2:1, light from top-left, painterly with ink linework, terracotta and travertine palette, transparent background, nothing copied from any game.

Generator: Gemini image model. Output was a JPG with a painted checkerboard; the pipeline (`tools/artgen/`) keys the background. Do not use third-party "transparent" conversions — they crop.

## Edit template (every derived sprite)

Attach `anchor-v1.jpg`, then:

> Same style, same angle, same lighting, same ground plate. **A single {BUILDING}: {DESCRIPTION}.** One structure only, on one plate. Plain white background.

Rules that stay constant:
- One structure per image. No compounds, no second building on the plate.
- The ground plate is always present and is the base diamond the game aligns on. Keep it the same style (packed earth, some paving, a little grass at the edges).
- Plain white background, not a checkerboard, not "transparent".
- Nothing from Travian, Anno, Rome II or any other game.

## Tier edits

Tier 2 and 3 are edits of the tier-1 image of the same building, not of the anchor:

> Same building, same style, same angle, same plate. **Upgraded: {TIER CHANGES}.** Plain white background.

Tier changes should be visible at a glance: added storey, portico, tiled roof replacing thatch, stone replacing timber, more stock in the yard. Tier 3 gets one animatable feature that the overlay system can drive: a chimney (smoke), a flag, a crane, a water wheel.

## Building descriptions — tier 1

Validated:
- **Lumber camp:** one open timber shed with a tiled roof, a log pile, a sawhorse.

To generate (edit freely before running):
- **Clay works:** a clay pit dug into the plate, a drying rack of clay bricks, a small kiln, shovels.
- **Iron mine:** a timber-framed mine entrance cut into a low rock face, an ore cart, a pile of ore.
- **Farm:** ploughed rows with a low drystone wall, a small tool shed, an ox yoke.
- **Warehouse:** a plain rectangular storehouse, timber doors, crates and amphorae outside.
- **Granary:** a raised timber granary on stone stilts, grain sacks, a ladder.
- **Cellars:** a low stone vault entrance set into a mound, an iron-bound door, barrels.
- **Insulae:** a two-storey timber-and-plaster tenement, external stair, washing line.
- **Market:** an open stall row with awnings, tables of goods, amphorae, a scale.
- **Temple:** a small podium temple, four columns, steps, an altar in front.
- **Waystation:** a roadside post with a milestone, a covered stable, a cart.
- **Forum:** a colonnaded court with a basilica at the back, statue plinth in the centre.
- **Castellum:** a square timber-and-earth fort, palisade, gate tower, a standard.

## Naming

`assets/src/{building}-t{tier}.jpg` (as generated) → pipeline → `assets/buildings/{building}-t{tier}.png` + entry in `manifest.json` (plate corners, anchor = plate centre, scale).

---

## Base map — the country the colony stands in

**Status: 🟡 proposed, not yet generated.** Approved as a single experiment
(2026-09-20): one painted terrain asset behind the drawn environment, to judge
painted-versus-drawn on real evidence before anything is decided about the
building sprites. Claude cannot generate this; it has to be produced and
committed to `assets/src/`, and it is wired in behind the `.env` group.

### Geometry, which is not negotiable

The village SVG's viewBox is `-330 -190 660 360` — **aspect exactly 11:6
(1.8333)**. Generate at **1980 × 1080** (3×). The centre of the world, where
the forum stands, is the pixel at **(990, 570)**.

The wall is an isometric circle, so on screen it is an axis-aligned ellipse
centred on that point with **semi-axes 835 × 417 px**. Everything inside that
ellipse is the town and is drawn in code — the painted map must not compete
with it.

### What the image must contain

Everything *outside* the wall, in the 2:1 isometric projection the sprites use,
**lit from the upper left** like every building:

- grass, with real variation — worn patches, tracks, tonal drift
- a **river** running down the east and south-east, past where the clay banks
  are (right of frame, roughly x 1450–1750 at 3×)
- a **wood** across the north and north-east (top of frame)
- **ploughed strips** to the south-west and south (bottom left)
- **rock outcrops** at the south-east, where the iron is

### What the image must NOT contain

The wall, the towers, the gate, the town floor, the roads, the square, any
building, any figure, any text or watermark. All of those are drawn, and a
painted copy would double them.

Inside the wall ellipse, paint flat packed earth (`#cfa278`) — it is covered by
the drawn town floor, and matching the colour hides any seam.

### Palette

Match `tools/artgen/palette.json` or the seam at the wall will read as two
different worlds: grass `#8d9a5f`, leaf mid `#6e7d48`, leaf dark `#4d5a36`,
water `#7d94a0`, earth light `#cfa278`, stone mid `#ad8c75`, grain `#d9b969`.

### Edges

The viewport letterboxes with `xMidYMid meet`, so the frame's own edges show
against a `#8d9a5f` background. Keep the outermost ~40px grass so the join is
invisible.

### Delivery

`assets/src/base-map-v1.jpg` (or `.png`), ideally under 600 KB. Claude wires it
in as an `<image>` at the bottom of the `.env` group and removes the drawn
grass, river, wood, fields and rocks — the wall, floor, roads and square stay.
