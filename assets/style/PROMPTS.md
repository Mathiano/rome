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
