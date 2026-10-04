/**
 * docs/BASEMAP-V2-SPEC.md, written from the layout: the prose is here, every
 * figure comes from geometry.ts. `npm run basemap:spec` writes it;
 * tests/basemap-spec.test.ts fails if the committed file differs.
 */
import { layout } from '../../src/data';
import {
  ASPECT, banks, biomeSlots, CLEARING, clearing, corners, fmt, FRAME, H, K, lineThroughFrame, px, riverX, scenePx, seat, tiers, W,
} from './geometry';
import { BIOME_LOOK } from './guide';

/** "− 5" for 5, "+ 5" for −5: subtracting the frame's origin, written plainly. */
const off = (v: number) => (v < 0 ? `+ ${-v}` : `− ${v}`);
const row = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
const c4 = (r: { x0: number; y0: number; x1: number; y1: number }) => corners(r).map(fmt);

export function renderSpec(): string {
  const ts = tiers();
  const t3 = ts[ts.length - 1];
  const sc = scenePx();
  const cl = clearing();
  const near = lineThroughFrame(riverX);
  const far = lineThroughFrame(riverX + 2.4);
  const deepA = lineThroughFrame(riverX + 0.7);
  const deepB = lineThroughFrame(riverX + 1.7);
  const cellW = Math.round(layout.tile.w * layout.cellTiles * K);
  const cellH = Math.round(layout.tile.h * layout.cellTiles * K);
  const L: string[] = [];
  L.push(`# Base map v2 — geometry for the town grid

The brief for the painted country under the town (DESIGN §10: "regenerated in the new style, after the grid and zones exist, so it is painted to the layout rather than the layout fitted to it"). Style, palette and lighting come from §10 and \`anchor-v2\`; this document fixes **where things are** and **what must not be painted**.

Regenerated 2026-09-28 for the resource biomes, the fixed praetorium and the organic clearing (Mathias). Nothing has been generated. Every pixel here is computed from \`data/layout.json\` and the village projection by \`tools/basemap/\` (\`npm run basemap:spec\`), which also draws \`docs/basemap-v2-geometry.svg\`: the same geometry at the same size, with the three slots of every biome marked, to hand to the image model as a layout guide. It is a wireframe, not art. \`tests/basemap-spec.test.ts\` fails if either file differs from what the script writes.

## 1. The frame, which is not negotiable

- **Image: ${W} × ${H} px, aspect 16:10 exactly** (${ASPECT}). At another resolution keep 16:10 and scale every coordinate by the same factor.
- **Scene units to image pixels:** \`px = ${K} · (sx ${off(FRAME.x)})\`, \`py = ${K} · (sy ${off(FRAME.y)})\`. The image covers scene x ${FRAME.x} to ${FRAME.x + FRAME.w} and y ${FRAME.y} to ${FRAME.y + FRAME.h}.
- **Grid cells to scene units:** \`sx = ${cellW / K / 2} · (x − y)\`, \`sy = ${cellH / K / 2} · (x + y)\`. One cell is a 2:1 diamond, **${cellW} × ${cellH} px** in the image. +x runs down-right, +y down-left; up is north.
- **Grid origin:** cell corner (0, 0) is at **${fmt(px(0, 0))}**.
- **Why this size:** at its widest the view shows the whole scene — image px ${sc.x} … ${sc.x + sc.w} by ${sc.y} … ${sc.y + sc.h} — and letterboxes it to the stage. The frame's bleed keeps painted country behind it for any stage aspect from ${sc.aspects.min.toFixed(2)}:1 to ${sc.aspects.max.toFixed(2)}:1. Keep the outermost ~60 px ordinary country.

## 2. The clearing and the grid under it

The town stands in a **clearing with an organic, irregular edge** — packed earth and trodden grass, flat, no marks. The logical grid under it stays square: a rectangle of cells whose wall is drawn in code. The clearing must hold the **${t3.n}×${t3.n} enclosure at wall tier ${['0', 'I', 'II', 'III'][t3.tier]}** with margin, so the edge wanders freely but only inside a band:

- **never nearer** than ${CLEARING.inner} cell beyond the tier-III wall: ${c4(cl.inner).join(' ')} (top, right, bottom, left);
- **never further** than ${CLEARING.outer} cells beyond it: ${c4(cl.outer).join(' ')}.

On the river side the clearing runs down to the water (§4). Everything the band encloses is flat; everything outside it is country and the biomes (§5).

## 3. The wall, at most hinted

The wall is drawn in code at every tier — a ditch and bank, a palisade, stone, a crenellated circuit — and its line moves as the town grows. **Never paint it as a structure.** At most, the tier-III line may be hinted in the terrain: a low bank, scattered stones, faint enough to vanish under the drawn wall. Its corners and gate for reference:

| Wall tier | Cells | Top | Right (river end) | Bottom | Left | Gate opening (drawn) |
|---|---|---|---|---|---|---|
${ts.map((t) => row([t.tier, `${t.n}×${t.n}`, ...c4(t.rect), `${fmt(t.gate[0])}–${fmt(t.gate[1])}`])).join('\n')}

The river edge is the lower-right side, the same line at every tier. The gate is the middle cell of the lower-left side and moves as the town grows; paint no road to it.

## 4. The riverbank and the river

A strip one cell deep runs outside the lower-right wall, as long as the enclosure, reserved for the harbour (not built yet) and drawn in code. Paint it as level bank — dry earth and gravel, fit for a quay. At tier III its corners are ${c4(banks()[banks().length - 1].rect).join(' ')}.

The river runs the whole frame, parallel to that edge, from the upper right down to the lower left:

- **near bank** (grid x = ${riverX}, flush with the strip): enters at **${fmt(near[0])}** and leaves at **${fmt(near[1])}**;
- **far bank** (grid x = ${riverX + 2.4}, 2.4 cells of water): **${fmt(far[0])}** to **${fmt(far[1])}**;
- **deep channel** (x ${riverX + 0.7} to ${riverX + 1.7}): enters between **${fmt(deepA[0])}** and **${fmt(deepB[0])}**, leaves between **${fmt(deepA[1])}** and **${fmt(deepB[1])}**;
- beyond the far bank: the other shore, grass and scrub, less worked than ours.

✅ *Mathias, 2026-09-28:* the river is painted in exactly this band, and the river the game draws now is removed when v2 is wired in. A painted bank more than ~10 px off these lines leaves the riverbank strip floating.

## 5. The four biomes and their slots

Outside the clearing lie the four resource biomes (DESIGN §4.5 C.2, ✅ Mathias 2026-09-28). **Paint each biome as terrain**, with room for its three slots. Each slot is a ${cellW} × ${cellH} px ground plate where the game draws the resource building and its yard: paint the plate as flat ground in the biome's own material, and the terrain around it.

| Biome | Where | Paint it as |
|---|---|---|
${biomeSlots().map((b) => row([b.id, b.where, BIOME_LOOK[b.id].terrain])).join('\n')}

| Slot | Cell (x, y) | Plate centre | Plate corners: top, right, bottom, left |
|---|---|---|---|
${biomeSlots().flatMap((b) => b.slots.map((s) => row([s.id, `${s.x}, ${s.y}`, fmt(s.centre), s.plate.map(fmt).join(' ')]))).join('\n')}

The strategic resources — stone, marble, salt — come only from the map (DESIGN §4.1): paint no quarry, marble or salt works here.

## 6. Nothing built, anywhere

**No buildings anywhere in the painting.** No central building, no villa, no temple, no huts; no fence ring or palisade round the clearing; no wall, tower or gate; no roads, tracks to the gate, bridges or jetties; no figures, animals, carts, text or watermark. Everything built is drawn by the game, and a painted copy doubles it.

The **praetorium** stands at the centre of the grid, fixed (DESIGN §4.4): cells ${c4(seat()).join(' ')}. Paint only the clearing's ground there.

## 7. Occlusion: the painting is always behind

Every sprite and every piece of wall is drawn over the painting, so anything painted with height reads as *behind* whatever is drawn over it.

- **Nothing tall directly below a slot:** no tree, rock or cliff face in a plate's diamond or in the cell below it (${cellH} px under its bottom corner). Tall things above a plate read as behind the building, which is right.
- **Nothing tall within ${cellH} px below the tier-III wall's two lower sides**: the drawn wall stands up to ~70 px high with its towers.

## 8. Light, palette, edges, delivery

- **Light** from the upper left, as on every sprite and on the drawn wall.
- **Palette:** re-derived from \`anchor-v2\` per §10; until then match \`tools/artgen/palette.json\` so the seam with the drawn town holds — grass \`#8d9a5f\`, leaf mid \`#6e7d48\`, leaf dark \`#4d5a36\`, water \`#7d94a0\`, water deep \`#5d7682\`, earth light \`#cfa278\`, stone light \`#d7b791\`, grain \`#d9b969\`.
- **Delivery:** \`assets/src/base-map-v2.jpg\`, ${W} × ${H} (or any 16:10), ideally under 2 MB.
- **Wiring,** a later session: \`createGround\` places the image at exactly scene (${FRAME.x}, ${FRAME.y}), ${FRAME.w} × ${FRAME.h} units, with no clearing-fit (\`MAP_FIT\` goes); the drawn river is removed (§4); 🟡 the drawn town floor shows only in build mode, like the grid, so the painted clearing's edge is what the player sees; the check is a pixel assertion that the painted near bank sits on grid x = ${riverX}.
`);
  return L.join('\n');
}
