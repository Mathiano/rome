# Sprite queue — Arctown, stylised

45 sprites: 15 buildings × 3 tiers (entries 43–45, the Barracks, were added after the rest and sit at the end of their phases). The wall is drawn in code and has no sprite.

**How to use.** One Gemini chat per phase is fine; re-attach the images every time anyway. Copy the whole prompt block — it restates the style and specs on purpose, because Gemini drifts when it relies on the attachment alone. Save each result under its exact file name and upload to `assets/src/` on a `design/…` or `mathiano-…` branch.

**Attachments.** The first image is always `anchor-v2.jpg`, the style reference. For tiers 2 and 3 the second image is the previous tier of the same building. Never attach the old WoW reference or anchor-v1.

**Reject and regenerate if:**
- anything overhangs the plate, or the plate is cut off by the frame;
- the plate isn't a flat diamond about twice as wide as tall, or the angle differs from the anchor;
- more than one structure, or scenery beyond the plate;
- any heraldry other than the eagle, any blue-and-gold, any green/blue/purple glow, runes or crystals;
- the background is a checkerboard instead of plain white;
- held beside the anchor, it looks more realistic or flatter — that's drift; add *"more exaggerated, chunkier, heavier outlines"* and retry.

Expect about half to be rejected. `artgen` will bounce some more for plate geometry; that's the check working.

## Phase 1 — the praetorium

### 1. [ ] `praetorium-t3.jpg` — Praetorium, tier 3 (the anchor, reframed)
Attach: `anchor-v2.jpg`

```
Redraw the attached image identically, the same building with the same details and style, but zoomed out so that the whole building and its whole ground plate sit inside the frame with a clear white margin on every side. Change the inscription over the main door to PRAETORIVM. Keep both red-and-gold eagle banners on the roof clearly visible and unobstructed; the game animates them.

Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 2. [ ] `praetorium-t1.jpg` — Praetorium, tier 1
Attach: `anchor-v2.jpg`

```
The attached image is this building at its grandest. Draw the same building as it was at its founding, far humbler, on the same plate.

Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

The governor's residence at the founding: a timber-framed house with a tiled roof around a small packed-earth courtyard, a modest gate, a single eagle standard on a pole, a water trough and a few crates.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 3. [ ] `praetorium-t2.jpg` — Praetorium, tier 2
Attach: `anchor-v2.jpg` + `praetorium-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

The governor's residence grown: a stone-footed two-storey house around a paved courtyard, a short colonnade on one side, a balcony with an awning, red-and-gold banners and two braziers.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

**Checkpoint:** lay t1, t2 and t3 side by side. Same footprint, clear progression? Only then continue.

## Phase 2 — tier 1 of every other building

### 4. [ ] `forum-t1.jpg` — Forum, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

The market and meeting place at the founding: an open square of packed earth with a row of timber stalls under cloth awnings, a small raised speaker's platform, amphorae, grain sacks and a set of scales.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 5. [ ] `castellum-t1.jpg` — Castellum, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is trampled earth with a gravel yard. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

A square timber fort: an earth rampart topped with a palisade of sharpened stakes, one timber gate tower, a few leather tents inside, a single standard.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 6. [ ] `temple-t1.jpg` — Temple, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

An open-air shrine: a stone altar on a low platform inside a timber fence, a sacred tree, offerings of bread and flowers, a small statue niche.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 7. [ ] `library-t1.jpg` — Library, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

A small timber reading room with a tiled roof, an open door showing shelves of scrolls, a bench and a writing desk outside.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 8. [ ] `waystation-t1.jpg` — Waystation, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth with a stretch of Roman road paving across it. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

A roadside post: a stone milestone, a small timber shelter with a tiled roof, a hitching rail and a two-wheeled cart.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 9. [ ] `insulae-t1.jpg` — Insulae, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

A small timber-and-plaster house with a tiled roof, a vegetable patch and a washing line.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 10. [ ] `warehouse-t1.jpg` — Warehouse, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

A timber storehouse with wide doors, crates and sacks outside, and a handcart.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 11. [ ] `granary-t1.jpg` — Granary, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

A small timber granary raised on stone stilts, grain sacks and a ladder.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 12. [ ] `cellars-t1.jpg` — Cellars, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth rising into a grassy mound. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

A low turf mound with a timber door set into it, and barrels outside.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 13. [ ] `farm-t1.jpg` — Farm, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is ploughed farmland soil with grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

A small plot of ploughed rows with young green wheat, a wattle fence, a tiny tool shed and a scarecrow.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 14. [ ] `lumber-camp-t1.jpg` — Lumber camp, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is a forest floor of needles and bark, with two pines standing inside its back corner. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

An open timber shed with a tiled roof, a log pile and a sawhorse.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 15. [ ] `clay-works-t1.jpg` — Clay works, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is a wet reddish clay bank. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

A clay pit dug into the plate, a drying rack of bricks, a small kiln and shovels.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 16. [ ] `iron-mine-t1.jpg` — Iron mine, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is a grey rock outcrop with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

A timber-framed mine entrance cut into a low rock face, an ore cart on rails and a pile of ore.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

*The Barracks was added 2026-09-27, after this queue was written: a repeatable 1×1 building, the military counterpart to farms. A tier-1 still already exists (`assets/src/barracks_t1.jpg`, placed); regenerate it from entry 43 only if it fails the Phase 2 checkpoint beside the others.*

### 43. [ ] `barracks-t1.jpg` — Barracks, tier 1
Attach: `anchor-v2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 1 of 3: the humble founding version. Timber, wattle and packed earth, small and simple, few decorations.

A military yard: a long, low timber barracks hall with a tiled roof along the back of the plot, and in front of it a packed-earth drill yard with three wooden training posts and a rack of spears and shields.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

**Checkpoint:** all fourteen tier-1s plus the praetorium on one screen. Regenerate any outlier before starting tier 2 — every later tier inherits it.

## Phase 3 — tier 2

### 17. [ ] `forum-t2.jpg` — Forum, tier 2
Attach: `anchor-v2.jpg` + `forum-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

A paved square with a stone colonnade along two sides, market stalls sheltering under it, a small basilica hall with a tiled roof at the back, and a statue plinth in the centre.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 18. [ ] `castellum-t2.jpg` — Castellum, tier 2
Attach: `anchor-v2.jpg` + `castellum-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is trampled earth with a gravel yard. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

Stone lower walls with a timber parapet above, two corner towers, a barracks block with a tiled roof inside, weapon racks and shields.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 19. [ ] `temple-t2.jpg` — Temple, tier 2
Attach: `anchor-v2.jpg` + `temple-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

A small podium temple with four columns and a tiled roof, steps up to it, an altar in front, and two sacred trees beside it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 20. [ ] `library-t2.jpg` — Library, tier 2
Attach: `anchor-v2.jpg` + `library-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

A stone library with a portico of two columns, scroll niches visible through the open doors, and a small garden.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 21. [ ] `waystation-t2.jpg` — Waystation, tier 2
Attach: `anchor-v2.jpg` + `waystation-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth with a stretch of Roman road paving across it. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

A small stone inn and stable for couriers, a milestone, a cart and a saddle rack.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 22. [ ] `insulae-t2.jpg` — Insulae, tier 2
Attach: `anchor-v2.jpg` + `insulae-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

A two-storey timber-and-plaster house with an outside stair, shuttered windows and a small shop front on the ground floor.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 23. [ ] `warehouse-t2.jpg` — Warehouse, tier 2
Attach: `anchor-v2.jpg` + `warehouse-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

A stone-footed storehouse with a raised loading platform, a small hoist and stacked amphorae.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 24. [ ] `granary-t2.jpg` — Granary, tier 2
Attach: `anchor-v2.jpg` + `granary-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

A larger raised granary with a tiled roof and ventilation slits, and a threshing floor beside it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 25. [ ] `cellars-t2.jpg` — Cellars, tier 2
Attach: `anchor-v2.jpg` + `cellars-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth rising into a grassy mound. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

A stone vault entrance set into a mound, an iron-bound door, a lantern and stacked barrels.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 26. [ ] `farm-t2.jpg` — Farm, tier 2
Attach: `anchor-v2.jpg` + `farm-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is ploughed farmland soil with grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

Rows of ripe golden wheat, a timber barn with a tiled roof, and a low drystone wall.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 27. [ ] `lumber-camp-t2.jpg` — Lumber camp, tier 2
Attach: `anchor-v2.jpg` + `lumber-camp-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is a forest floor of needles and bark, with two pines standing inside its back corner. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

A larger timber hall on stone footings, a saw pit and bigger log stacks.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 28. [ ] `clay-works-t2.jpg` — Clay works, tier 2
Attach: `anchor-v2.jpg` + `clay-works-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is a wet reddish clay bank. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

A larger pit with timber steps, two kilns, stacked tiles and bricks, and a covered drying shed.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 29. [ ] `iron-mine-t2.jpg` — Iron mine, tier 2
Attach: `anchor-v2.jpg` + `iron-mine-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is a grey rock outcrop with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

A reinforced mine entrance with a timber headframe, rails and a small smelting furnace.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 44. [ ] `barracks-t2.jpg` — Barracks, tier 2
Attach: `anchor-v2.jpg` + `barracks-t1.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 2 of 3. The second attached image is tier 1 of this same building. Upgrade it: same footprint, layout still recognisable, now with stone footings, a tiled roof, an extra storey or wing, paving and more clutter.

The same military yard grown: the barracks hall on stone footings with plastered walls and a row of arched doorways, a short wing at one side, a paved drill yard with training posts and two weapon racks.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

## Phase 4 — tier 3

### 30. [ ] `forum-t3.jpg` — Forum, tier 3
Attach: `anchor-v2.jpg` + `forum-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A grand colonnaded forum: a two-storey basilica at the back, a curia with a pediment and the Latin inscription FORVM over its door, a bronze statue on a plinth, busy market stalls with striped awnings.

It must include one tall red-and-gold banner on the basilica roof, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 31. [ ] `castellum-t3.jpg` — Castellum, tier 3
Attach: `anchor-v2.jpg` + `castellum-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is trampled earth with a gravel yard. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A stone fort with four corner towers, crenellated walls, a gatehouse, and a principia headquarters building inside with a tiled roof.

It must include a large red-and-gold vexillum banner flying from the gatehouse, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 32. [ ] `temple-t3.jpg` — Temple, tier 3
Attach: `anchor-v2.jpg` + `temple-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: a large 2x2 plot, a big square plate with a substantial complex filling it. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A grand podium temple with six columns, a carved pediment, bronze roof ornaments, broad steps, and a large stone altar before it.

It must include a burning offering on the altar with a rising column of smoke, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 33. [ ] `library-t3.jpg` — Library, tier 3
Attach: `anchor-v2.jpg` + `library-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A two-storey library with a colonnaded front, scroll racks visible inside, a statue of a seated scholar, and lanterns at the upper windows.

It must include lanterns glowing warm orange in the upper windows, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 34. [ ] `waystation-t3.jpg` — Waystation, tier 3
Attach: `anchor-v2.jpg` + `waystation-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth with a stretch of Roman road paving across it. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A larger courier station with a courtyard stable, a signpost with carved Latin distances, and a courier's standard.

It must include a hanging wooden sign over the door that can swing, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 35. [ ] `insulae-t3.jpg` — Insulae, tier 3
Attach: `anchor-v2.jpg` + `insulae-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A three-storey brick-and-plaster tenement with balconies, flower boxes and a tavern sign on the ground floor.

It must include a chimney with smoke rising from it, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 36. [ ] `warehouse-t3.jpg` — Warehouse, tier 3
Attach: `anchor-v2.jpg` + `warehouse-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A large stone warehouse with buttressed walls and a loading platform.

It must include a timber crane on the loading platform lifting a crate, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 37. [ ] `granary-t3.jpg` — Granary, tier 3
Attach: `anchor-v2.jpg` + `granary-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A stone granary with buttressed walls, ventilation louvres and grain carts beside it.

It must include a pulley hoist lifting a grain sack to the upper door, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 38. [ ] `cellars-t3.jpg` — Cellars, tier 3
Attach: `anchor-v2.jpg` + `cellars-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth rising into a grassy mound. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

An arched stone entrance with steps leading down, twin iron-bound doors and a strongbox.

It must include a burning torch on each side of the doors, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 39. [ ] `farm-t3.jpg` — Farm, tier 3
Attach: `anchor-v2.jpg` + `farm-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is ploughed farmland soil with grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

Rich golden fields around a stone farmhouse and barn, a well and an ox yoke.

It must include a farmhouse chimney with smoke rising from it, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 40. [ ] `lumber-camp-t3.jpg` — Lumber camp, tier 3
Attach: `anchor-v2.jpg` + `lumber-camp-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is a forest floor of needles and bark, with two pines standing inside its back corner. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A big timber sawing hall on stone footings with large log stacks.

It must include a timber crane hoisting a log, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 41. [ ] `clay-works-t3.jpg` — Clay works, tier 3
Attach: `anchor-v2.jpg` + `clay-works-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is a wet reddish clay bank. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A brick and tile works: a large domed kiln, stacked terracotta roof tiles, and a potter's wheel under an awning.

It must include the kiln chimney with smoke rising from it, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 42. [ ] `iron-mine-t3.jpg` — Iron mine, tier 3
Attach: `anchor-v2.jpg` + `iron-mine-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is a grey rock outcrop with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A stone-faced mine entrance with a large timber headframe and winch, and a bloomery furnace with bellows.

It must include the furnace glowing orange with smoke rising from its chimney, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```

### 45. [ ] `barracks-t3.jpg` — Barracks, tier 3
Attach: `anchor-v2.jpg` + `barracks-t2.jpg`

```
Style: match the first attached image exactly. A stylised, hand-painted game building: chunky, exaggerated proportions, roof tiles about three times real size, thick walls, oversized doors and windows. Heavy dark-brown outlines on every edge. Saturated warm terracotta roofs, cool cream stone and warm brown timber, with bold painted highlights on edges facing the light. Hand-painted texture on every surface, slightly wonky hand-drawn edges. Cozy and lived-in. A hand-painted MMO building, not a historical illustration.

Setting: a Roman colony on the Germanic frontier, year 0. Roman in every detail: red-and-gold banners bearing a golden eagle, oil lamps and braziers with ordinary orange flame, terracotta, travertine and timber.

Camera and framing: isometric 2:1, the same angle as the first image. Light from the top left; shadows fall down and to the right. One structure only, on one flat ground plate: a square plot seen in isometric, a flat diamond exactly twice as wide as it is tall. Footprint: one building plot, a compact building on a small plate. The plate is packed earth and paving stones with a little grass at the edges. The whole building and the whole plate sit inside the frame with a clear white margin on every side; nothing overhangs the edge of the plate. Plain flat white background: no checkerboard, no scenery beyond the plate.

Tier 3 of 3. The second attached image is tier 2 of this same building. Upgrade it to its grandest form: same footprint, layout still recognisable, now stone and plaster, colonnades and rich detail.

A stone barracks hall, two storeys of coursed stone and plaster with arched doorways and a tiled roof, a wing at one side, and a paved drill yard with a row of training posts and weapon racks.

It must include a red-and-gold standard bearing a golden eagle on a tall pole at the front corner of the drill yard, clearly visible and unobstructed, because the game animates it.

Do not include: people, animals, emblems or heraldry other than the Roman eagle, blue-and-gold colour schemes, green, blue or purple fire or glow, runes, crystals, magic effects, or any text except where stated. Nothing copied from any existing game.
```
