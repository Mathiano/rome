# DESIGN patch — the stylised pivot

**Decided by Mathias, 2026-09-27.** ✅ unless marked. Applies on top of `DESIGN-patch-2026-09-25-holdings.md`; apply that one first. CC integrates in place, keeps marks, adds a change-log entry, and does not implement beyond what the sections say.

---

## A. Pillar 9 amended — mythic Rome

**9. Keep it real — mythic Rome.** Roman names, Roman gods, Roman practice. The gods act: a sacrifice is answered, a temple has power, the cult of Augustus is the state cult with real effect. No wizards, no spells, no mana. Anachronisms are flagged, not silently adopted.

The tone is cozy and adventurous. The politics keep their edge — assassination, coups and secession stay — but the game should reach for festivals, games, dedications and rivalries before it reaches for the knife. 🟡 Festivals as a council action, proposed for v0.2.

---

## B. §4.4 — Buildings

### B.1 The seat 🟡 (confirm)

- **Praetorium** — the governor's residence and the seat of the player's family. Its tier is the colony's tier. It is the centre of the town. Footprint 2×2. Unique.
- **Forum** — the civic and market building: basilica, curia and market stalls. Trade with tribes and Rome happens here; the council convenes here. Footprint 2×2. Unique. **The separate Market building is removed**; its role folds into the Forum.

The building count stays at fourteen.

### B.2 Repeatable and unique buildings ✅

Buildings are no longer one-each.

| Unique (one per colony) | Repeatable (as many as plots allow) |
|---|---|
| Praetorium, Forum, Castellum, Wall, Temple, Library, Waystation | Insulae, Warehouse, Granary, Cellars, Farm, Lumber camp, Clay works, Iron mine |

Repeatables are where the colony's shape is decided: more farms is a trade colony, more barracks-adjacent buildings is a military one, more libraries later a learned one. Costs may rise per copy 🟡 (`_tuning`). Resource buildings still require their site (§4.5).

### B.3 Footprints ✅

Every building has a footprint in grid cells. 🟡 starting values: Praetorium, Forum, Castellum, Temple 2×2; Harbour 2×1 on a coast edge (arrives with the harbour drop); everything else 1×1. In `data/buildings.json`.

---

## C. §4.5 — Layout, rewritten

The concentric rings are replaced.

### C.1 The town grid ✅

- The town is a **rectangular grid of cells inside a rectangular wall** — the Roman colonial plan: streets on a grid, gates on the axes. The circular wall and ring slots are gone.
- **Free placement:** the player places any building on any free cells that fit its footprint. Placement is a decision, not a menu.
- The number of cells is finite and always fewer than the player would like. 🟡 Starting values (`_tuning`): wall tier 0 (ditch and bank) 6×6 = 36 cells; tier I 7×7; tier II 8×8; tier III 9×9 = 81. One of every building costs about 23 cells, so tier 0 leaves room for roughly a dozen extras and no more.
- **The wall's tier grows the enclosure.** Raising the wall is how the town gets bigger. This ties expansion to defence and gives the Wall building its second purpose.

### C.2 Three zones ✅

1. **Inside the wall:** buildings on the grid.
2. **Immediately outside the wall:** resource sites on the terrain — fields, clay bank, iron seam, forest — each with its resource building on it. These are placed by the map, not the player, and are the first things a raid reaches.
3. **The hex map beyond:** holdings (§5).

### C.3 Adjacency ❓

Free placement exists so that placement can matter. Adjacency effects — a granary beside farms, a temple beside insulae, a warehouse beside the forum — are the intended source of supply-chain skill and are **deferred until the grid exists**. ❓ Rules and numbers in a later patch. In-town roads 🟡 likewise.

### C.4 View ✅

The town view zooms, to roughly 3× its current extent at most. The wall and grid are drawn in code; buildings are painted sprites (§10).

---

## D. §10 — Art direction, rewritten

- **Style:** stylised, hand-painted, exaggerated — chunky proportions, oversized roof tiles, thick walls, heavy warm outlines, saturated terracotta against cool cream stone, painted texture on every surface, lively clutter (vines, lanterns, awnings, crates). Cozy and adventurous. The register of a hand-painted MMO building, not a historical illustration.
- **Anchor:** `assets/style/anchor-v2.jpg` (the stylised praetorium). Every building sprite is an edit of it. `anchor-v1.jpg` and every sprite derived from it are retired.
- **Content stays Roman.** Eagles, red-and-gold vexilla, oil-lamp and brazier flame, Latin inscriptions. Nothing from any game's heraldry, palette or magic. Nothing lifted from Warcraft, Rome II, Travian, Anno or any other game.
- **Palette:** re-sampled from anchor-v2; the design-system tokens are re-derived from it.
- **Base map:** regenerated in the new style, after the grid and zones exist, so it is painted to the layout rather than the layout fitted to it.
- **Sprites, plates, anchors, tier-3 animation and the pipeline:** unchanged from the previous §10.

---

## E. §9.8 — Gods, direction

The gods act. Each temple dedication gives a standing effect and an answered sacrifice — Mars a defence blessing, Ceres a harvest, Mercury a trade windfall, Venus fertility for the house, Jupiter gravitas, the cult of Augustus Roman favour. Piety governs how often and how well. ❓ Contents, costs and cooldowns in a later patch; this section records only that magic in Rome III means the gods, and nothing else.

---

## F. §14 — Banked

Add: *two great factions in a cold war, later* (the Alliance/Horde idea, to be designed fresh under its own name when the time comes) · in-town roads · adjacency rules (❓, see C.3) · festivals as a council action 🟡.

---

## G. Integration notes for CC

- Apply A–F in place. Mark B.1 🟡 until Mathias confirms it in-session.
- **Invalidated by this patch, do not delete yet, list them:** `layout.json` rings, the circular wall geometry, `anchor-v1.jpg`, `lumber-camp-t1/t3`, the base map, the design-system palette sample. They are replaced by later sessions, not this one.
- Do not implement C or D in this pass. The grid session comes after this patch and the holdings patch are both merged.
- Flag anything here that contradicts code or doc as it now stands.
