# Base map v2 — geometry for the town grid

The brief for the painted country under the town (DESIGN §10: "regenerated in the new style, after the grid and zones exist, so it is painted to the layout rather than the layout fitted to it"). Style, palette and lighting come from §10 and `anchor-v2`; this document fixes **where things are** and **what must not be painted**.

Regenerated 2026-09-28 for the resource biomes, the fixed praetorium and the organic clearing (Mathias). Nothing has been generated. Every pixel here is computed from `data/layout.json` and the village projection by `tools/basemap/` (`npm run basemap:spec`), which also draws `docs/basemap-v2-geometry.svg`: the same geometry at the same size, with the three slots of every biome marked, to hand to the image model as a layout guide. It is a wireframe, not art. `tests/basemap-spec.test.ts` fails if either file differs from what the script writes.

## 1. The frame, which is not negotiable

- **Image: 4224 × 2640 px, aspect 16:10 exactly** (1.6). At another resolution keep 16:10 and scale every coordinate by the same factor.
- **Scene units to image pixels:** `px = 2 · (sx + 1084)`, `py = 2 · (sy + 652)`. The image covers scene x -1084 to 1028 and y -652 to 668.
- **Grid cells to scene units:** `sx = 56 · (x − y)`, `sy = 28 · (x + y)`. One cell is a 2:1 diamond, **224 × 112 px** in the image. +x runs down-right, +y down-left; up is north.
- **Grid origin:** cell corner (0, 0) is at **(2168, 1304)**.
- **Why this size:** at its widest the view shows the whole scene — image px 690 … 3534 by 361 … 2281 — and letterboxes it to the stage. The frame's bleed keeps painted country behind it for any stage aspect from 1.08:1 to 2.20:1. Keep the outermost ~60 px ordinary country.

## 2. The clearing and the grid under it

The town stands in a **clearing with an organic, irregular edge** — packed earth and trodden grass, flat, no marks. The logical grid under it stays square: a rectangle of cells whose wall is drawn in code. The clearing must hold the **9×9 enclosure at wall tier III** with margin, so the edge wanders freely but only inside a band:

- **never nearer** than 0.5 cell beyond the tier-III wall: (2168, 800) (3344, 1388) (2224, 1948) (1048, 1360) (top, right, bottom, left);
- **never further** than 1.5 cells beyond it: (2168, 688) (3456, 1332) (2112, 2004) (824, 1360).

On the river side the clearing runs down to the water (§4). Everything the band encloses is flat; everything outside it is country and the biomes (§5).

## 3. The wall, at most hinted

The wall is drawn in code at every tier — a ditch and bank, a palisade, stone, a crenellated circuit — and its line moves as the town grows. **Never paint it as a structure.** At most, the tier-III line may be hinted in the terrain: a low bank, scattered stones, faint enough to vanish under the drawn wall. Its corners and gate for reference:

| Wall tier | Cells | Top | Right (river end) | Bottom | Left | Gate opening (drawn) |
|---|---|---|---|---|---|---|
| 0 | 6×6 | (2280, 1136) | (2952, 1472) | (2280, 1808) | (1608, 1472) | (1944, 1640)–(2056, 1696) |
| 1 | 7×7 | (2280, 1024) | (3064, 1416) | (2280, 1808) | (1496, 1416) | (1832, 1584)–(1944, 1640) |
| 2 | 8×8 | (2168, 968) | (3064, 1416) | (2168, 1864) | (1272, 1416) | (1720, 1640)–(1832, 1696) |
| 3 | 9×9 | (2168, 856) | (3176, 1360) | (2168, 1864) | (1160, 1360) | (1608, 1584)–(1720, 1640) |

The river edge is the lower-right side, the same line at every tier. The gate is the middle cell of the lower-left side and moves as the town grows; paint no road to it.

## 4. The riverbank and the river

A strip one cell deep runs outside the lower-right wall, as long as the enclosure, reserved for the harbour (not built yet) and drawn in code. Paint it as level bank — dry earth and gravel, fit for a quay. At tier III its corners are (3176, 1360) (3288, 1416) (2280, 1920) (2168, 1864).

The river runs the whole frame, parallel to that edge, from the upper right down to the lower left:

- **near bank** (grid x = 6, flush with the strip): enters at **(4224, 948)** and leaves at **(840, 2640)**;
- **far bank** (grid x = 8.4, 2.4 cells of water): **(4224, 1217)** to **(1378, 2640)**;
- **deep channel** (x 6.7 to 7.7): enters between **(4224, 1026)** and **(4224, 1138)**, leaves between **(997, 2640)** and **(1221, 2640)**;
- beyond the far bank: the other shore, grass and scrub, less worked than ours.

✅ *Mathias, 2026-09-28:* the river is painted in exactly this band, and the river the game draws now is removed when v2 is wired in. A painted bank more than ~10 px off these lines leaves the riverbank strip floating.

## 5. The four biomes and their slots

Outside the clearing lie the four resource biomes (DESIGN §4.5 C.2, ✅ Mathias 2026-09-28). **Paint each biome as terrain**, with room for its three slots. Each slot is a 224 × 112 px ground plate where the game draws the resource building and its yard: paint the plate as flat ground in the biome's own material, and the terrain around it.

| Biome | Where | Paint it as |
|---|---|---|
| wood | north and north-west | forest, with stumps and log piles |
| clay | north-east | a red clay excavation |
| iron | the cliffs by the river, at the town’s south end | rocky cliffs above the river |
| grain | south-west | open field strips |

| Slot | Cell (x, y) | Plate centre | Plate corners: top, right, bottom, left |
|---|---|---|---|
| wood1 | -7, -3 | (1720, 800) | (1720, 744) (1832, 800) (1720, 856) (1608, 800) |
| wood2 | -7, 0 | (1384, 968) | (1384, 912) (1496, 968) (1384, 1024) (1272, 968) |
| wood3 | -7, -6 | (2056, 632) | (2056, 576) (2168, 632) (2056, 688) (1944, 632) |
| clay1 | 3, -7 | (3288, 1136) | (3288, 1080) (3400, 1136) (3288, 1192) (3176, 1136) |
| clay2 | 1, -7 | (3064, 1024) | (3064, 968) (3176, 1024) (3064, 1080) (2952, 1024) |
| clay3 | -2, -7 | (2728, 856) | (2728, 800) (2840, 856) (2728, 912) (2616, 856) |
| iron1 | 5, 7 | (1944, 2032) | (1944, 1976) (2056, 2032) (1944, 2088) (1832, 2032) |
| iron2 | 3, 8 | (1608, 1976) | (1608, 1920) (1720, 1976) (1608, 2032) (1496, 1976) |
| iron3 | 5, 9 | (1720, 2144) | (1720, 2088) (1832, 2144) (1720, 2200) (1608, 2144) |
| grain1 | -3, 7 | (1048, 1584) | (1048, 1528) (1160, 1584) (1048, 1640) (936, 1584) |
| grain2 | -1, 7 | (1272, 1696) | (1272, 1640) (1384, 1696) (1272, 1752) (1160, 1696) |
| grain3 | -5, 7 | (824, 1472) | (824, 1416) (936, 1472) (824, 1528) (712, 1472) |

The strategic resources — stone, marble, salt — come only from the map (DESIGN §4.1): paint no quarry, marble or salt works here.

## 6. Nothing built, anywhere

**No buildings anywhere in the painting.** No central building, no villa, no temple, no huts; no fence ring or palisade round the clearing; no wall, tower or gate; no roads, tracks to the gate, bridges or jetties; no figures, animals, carts, text or watermark. Everything built is drawn by the game, and a painted copy doubles it.

The **praetorium** stands at the centre of the grid, fixed (DESIGN §4.4): cells (2168, 1304) (2392, 1416) (2168, 1528) (1944, 1416). Paint only the clearing's ground there.

## 7. Occlusion: the painting is always behind

Every sprite and every piece of wall is drawn over the painting, so anything painted with height reads as *behind* whatever is drawn over it.

- **Nothing tall directly below a slot:** no tree, rock or cliff face in a plate's diamond or in the cell below it (112 px under its bottom corner). Tall things above a plate read as behind the building, which is right.
- **Nothing tall within 112 px below the tier-III wall's two lower sides**: the drawn wall stands up to ~70 px high with its towers.

## 8. Light, palette, edges, delivery

- **Light** from the upper left, as on every sprite and on the drawn wall.
- **Palette:** re-derived from `anchor-v2` per §10; until then match `tools/artgen/palette.json` so the seam with the drawn town holds — grass `#8d9a5f`, leaf mid `#6e7d48`, leaf dark `#4d5a36`, water `#7d94a0`, water deep `#5d7682`, earth light `#cfa278`, stone light `#d7b791`, grain `#d9b969`.
- **Delivery:** `assets/src/base-map-v2.jpg`, 4224 × 2640 (or any 16:10), ideally under 2 MB.
- **Wiring,** a later session: `createGround` places the image at exactly scene (-1084, -652), 2112 × 1320 units, with no clearing-fit (`MAP_FIT` goes); the drawn river is removed (§4); 🟡 the drawn town floor shows only in build mode, like the grid, so the painted clearing's edge is what the player sees; the check is a pixel assertion that the painted near bank sits on grid x = 6.
