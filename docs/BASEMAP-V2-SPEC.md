# Base map v2 — geometry for the town grid

The brief for the painted country under the rectangular town (DESIGN §10: "regenerated in the new style, after the grid and zones exist, so it is painted to the layout rather than the layout fitted to it"). It replaces the round-wall geometry in `assets/style/PROMPTS.md` (base map v1, `-330 -190 660 360`, ellipse 835 × 417). Style, palette and lighting come from §10 and `anchor-v2`; this document fixes only **where things are**.

Written 2026-09-28 (overnight item 4). Nothing has been generated. Every pixel below is computed from `data/layout.json` and the projection in `src/render/environment.ts`. `tests/basemap-spec.test.ts` recomputes them and fails if the layout changes without this file changing too.

`docs/basemap-v2-geometry.svg` draws the same numbers at the same size, and can go to the image model as a layout guide. It is a wireframe, not art.

## 1. The frame, which is not negotiable

- **Image: 3520 × 2200 px, aspect 16:10 exactly.** Any other resolution must keep 16:10. Then every coordinate here scales by the same factor; for example, at 1760 × 1100, halve them all.
- **The mapping from the game's scene units to image pixels:**

  `px = 2 · (sx + 908)` and `py = 2 · (sy + 542)`.

  The image covers scene x −908 … 852 and y −542 … 558, at 2 px per scene unit.
- **The projection from grid cells to scene units:**

  `sx = 56 · (x − y)` and `sy = 28 · (x + y)`.

  One cell is a 2:1 diamond 112 units wide (`tile` 64 × `cellTiles` 1.75), so it is **224 × 112 px** in the image. +x runs down-right and +y runs down-left.
- **Grid origin:** cell corner (0, 0) is at **(1816, 1084)**. The largest town's centre is at **(1816, 1140)**.
- **Why 16:10:** at its widest zoom the view shows the whole scene, which is scene x −739 … 683 and y −388 … 404, or image px 338 … 3182 by 309 … 1893. It scales that to fit the stage and letterboxes it. The frame's bleed keeps painted country, not a flat colour, behind a stage of any aspect from 1.29:1 to 2.22:1. The outermost ~60 px should be ordinary country so the join to the edge-colour flood beyond the frame doesn't show.

## 2. The enclosure and its wall, per tier

The town is a rectangle of cells inside a rectangular wall. The wall's tier sets its size: 6, 7, 8 or 9 cells a side (`grid.sizeByWallTier`, 🟡 _tuning). The river edge is fixed and the town grows away from it, so every tier contains the one before. On screen, each enclosure is a diamond. Its corners, in image px:

| Wall tier | Cells | Top | Right (river end) | Bottom | Left | Gate opening, along the lower-left edge |
|---|---|---|---|---|---|---|
| 0 | 6×6 | (1928, 916) | (2600, 1252) | (1928, 1588) | (1256, 1252) | (1592, 1420)–(1704, 1476) |
| 1 | 7×7 | (1928, 804) | (2712, 1196) | (1928, 1588) | (1144, 1196) | (1480, 1364)–(1592, 1420) |
| 2 | 8×8 | (1816, 748) | (2712, 1196) | (1816, 1644) | (920, 1196) | (1368, 1420)–(1480, 1476) |
| 3 | 9×9 | (1816, 636) | (2824, 1140) | (1816, 1644) | (808, 1140) | (1256, 1364)–(1368, 1420) |

- **The river edge is the lower-right side,** from Right to Bottom. It is the same line at every tier; only its length changes.
- **The gate** is the middle cell of the lower-left side, facing the viewer's left, so it moves as the town grows. The wall, its towers, the gate and the standard over it are all drawn in code. **Paint none of them, and no road to any gate:** roads and in-town roads are drawn or banked (§14).
- **Inside the tier-0 diamond** the drawn town floor always covers the painting at 92% opacity. Paint flat packed earth there (`earth light`, as in v1), with no marks.
- **Between the tier-0 and tier-3 diamonds** is country at a low wall tier and town at a high one. The floor covers it at 92%, so 8% of the painting shows through. Paint cleared ground there: short grass and worn earth, low in contrast. No trees, rocks, water, fields, tracks or anything with height.

## 3. The riverbank, per tier

A strip one cell deep (`grid.riverbankDepth`) runs outside the lower-right wall, as long as the enclosure. It is reserved for the harbour, which is not built yet, and is drawn in code in a stone tone. Its corners in px:

| Wall tier | Top | Right | Bottom | Left |
|---|---|---|---|---|
| 0 | (2600, 1252) | (2712, 1308) | (2040, 1644) | (1928, 1588) |
| 1 | (2712, 1196) | (2824, 1252) | (2040, 1644) | (1928, 1588) |
| 2 | (2712, 1196) | (2824, 1252) | (1928, 1700) | (1816, 1644) |
| 3 | (2824, 1140) | (2936, 1196) | (1928, 1700) | (1816, 1644) |

Under the tier-3 strip, paint flat bank: dry earth and gravel, level, fit for a quay. The strip's outer edge is the water's edge.

## 4. The river

The river runs the whole frame, parallel to the town's river edge: from the upper right down to the lower left.

- **Near bank** (grid x = 6, flush with the riverbank strip's outer edge): enters the right edge at **(3520, 904)**, passes **(2488, 1420)**, and leaves the bottom edge at **(928, 2200)**.
- **Far bank** (grid x = 8.4, 2.4 cells of water): enters the right edge at **(3520, 1173)** and leaves the bottom edge at **(1465, 2200)**.
- **Deep channel** (x 6.7 to 7.7): a darker band down the middle. It enters the right edge between **(3520, 982)** and **(3520, 1094)** and leaves the bottom between **(1084, 2200)** and **(1308, 2200)**.
- **Beyond the far bank** (the lower-right corner of the frame): the other shore. Grass and scrub, less worked than the colony's side.

🟡 v1 painted a river and the game now draws one flat over the painting (`createGround`). The proposal is that v2 paints it in exactly this band, and the drawn river is retired when v2 is wired in. If the painted band misses these lines by more than ~10 px, the riverbank strip will float off the water.

## 5. The resource sites, outside the wall

Eight fixed sites (`data/layout.json` `sites`), each one cell. The game draws a sprite on each: the building and its yard, standing on a 224 × 112 px ground plate centred on the point below. Paint each plate as flat ground matching its trade. The setting around it is what the painting gives.

| Slot | Site | Cell (x, y) | Plate centre | Plate corners: top, right, bottom, left | Setting to paint around it |
|---|---|---|---|---|---|
| o1 | forest | -7, -3 | (1368, 580) | (1368, 524) (1480, 580) (1368, 636) (1256, 580) | standing wood behind (above) it |
| o2 | forest | -7, 0 | (1032, 748) | (1032, 692) (1144, 748) (1032, 804) (920, 748) | standing wood behind (above) it |
| o3 | clay_bank | 3, -7 | (2936, 916) | (2936, 860) (3048, 916) (2936, 972) (2824, 916) | clay bank toward the river |
| o4 | clay_bank | 1, -7 | (2712, 804) | (2712, 748) (2824, 804) (2712, 860) (2600, 804) | clay bank toward the river |
| o5 | iron_seam | -2, -7 | (2376, 636) | (2376, 580) (2488, 636) (2376, 692) (2264, 636) | rock outcrops behind it |
| o6 | farmland | 4, 7 | (1480, 1756) | (1480, 1700) (1592, 1756) (1480, 1812) (1368, 1756) | ploughed strips around it |
| o7 | farmland | -2, 7 | (808, 1420) | (808, 1364) (920, 1420) (808, 1476) (696, 1420) | ploughed strips around it |
| o8 | farmland | -5, 7 | (472, 1252) | (472, 1196) (584, 1252) (472, 1308) (360, 1252) | ploughed strips around it |

The broad layout is unchanged from v1: wood to the west and north-west, clay by the river upstream, rock to the north, fields to the south-west and south.

## 6. Occlusion: the painting is always behind

Every sprite and every piece of wall is drawn over the painting. So anything painted with height looks as if it stands *behind* whatever is drawn over it, even where it should be in front.

- **Nothing tall directly below a plate.** No tree, rock or standing object in each plate's diamond, or in a band one cell (112 px) below its bottom corner. Tall things above a plate are fine: they read as behind the building, which is correct.
- **Nothing tall within 112 px below the tier-3 wall's two lower sides.** The tier-3 wall stands up to ~70 px high with its towers, and a tree painted just below it would be cut off by it.
- **Nothing in the painting may read as a building, wall, tower, gate, road, bridge, figure, text or watermark.** All of those are drawn, and a painted copy would double them.

## 7. Light, palette, edges, delivery

- **Light** from the upper left, as on every sprite and on the drawn wall (`wallLight`).
- **Palette:** re-derived from `anchor-v2` per §10. Until that lands, match `tools/artgen/palette.json` so the seam with the drawn floor and bank holds: grass `#8d9a5f`, leaf mid `#6e7d48`, leaf dark `#4d5a36`, water `#7d94a0`, water deep `#5d7682`, earth light `#cfa278`, stone light `#d7b791`, grain `#d9b969`.
- **Edges:** see §1. Plain country at the border, with no strong feature cut by the frame.
- **Delivery:** `assets/src/base-map-v2.jpg`, 3520 × 2200 (or any 16:10), ideally under 1.5 MB.
- **Wiring,** a later session and not this spec:
  - `createGround` places the image at exactly scene x −908, y −542, 1760 × 1100 units, with no clearing-fit (`MAP_FIT` goes);
  - the frame numbers move to `data/layout.json`;
  - the drawn river retires if §4's proposal is taken;
  - the check is a pixel assertion that the painted near bank sits on grid x = 6.
