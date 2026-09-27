# Session capsule — 2026-09-27

The two design patches applied to DESIGN.md, doc only. Branch cleanup
and the repository setting were asked for; the proxy blocks both.

## Done: PR #15 (`design/pivot-2026-09-27`), CI green

- **Holdings patch → v0.3.0.** §2.11, the absence pillar, is new.
  §3.3 is amended to say the idle round is gone *because of* §2.11 and
  must not come back without Mathias's sign-off. §5 is replaced by
  holdings. §15.10 is resolved at 21 across.
- **Pivot patch → v0.3.1.** Pillar 9 now reads mythic Rome. §4.4 gets
  the seat: B.1 is ✅, confirmed in session (the Praetorium is the seat,
  the Forum absorbs the Market), plus repeatables and footprints. §4.5
  is rewritten as the town grid. §10 is rewritten as stylised art from
  anchor-v2. §9.8 records that the gods act. §14 banks four items.
- **CLAUDE.md** has Pillar 9 amended and Pillar 11 added.
- **Not implemented:** holdings §B, pivot §C and pivot §D.
- **The branch.** The rename was done by pushing `Mathiano-patch-1`'s
  commit as `design/pivot-2026-09-27`, because renaming is
  proxy-blocked. The upload commit also carries both patch files and
  `docs/rome_anchor_1.jpg`, left as uploaded.

## Flags, recorded in DESIGN.md, not reconciled

- §3.3, "the world still moves": other actors act outside rounds,
  against Pillar 2 and §3.2. Rome requests expire, but §6 and the code
  have no expiry. Nothing in code moves the world while the player is
  away.
- §4.4: "fourteen" buildings, but fifteen are listed. Barracks and the
  Harbour are dangling. In code the seat is the Forum (`forumTier`,
  `requiresForumTier`), and trade reads the Market (`envoys.ts`).
- §4.5: repeatable resource buildings are bounded by map sites. The
  rings, the circular wall and `w1` remain in code and in CLAUDE.md's
  Conventions.
- §5: the code differs on size, view, site kinds, tiers, roads and
  militia allocation.
- §10: `anchor-v2.jpg` doesn't exist. The upload's pediment reads
  FORVM (🟡 by eye), not praetorium.

## Invalidated, listed in v0.3.1, not deleted

- `layout.json`'s rings and `w1`
- the circular wall in `environment.ts`
- `anchor-v1.*` and the 43 sprites derived from it
- the `lumber-camp-*` sources
- `base-map-v1.jpg`
- `tools/artgen/palette.json` 🟡

## Blocked: needs Mathias

- **Branch deletion.** `git push --delete` and the REST ref delete both
  return 403 from the session proxy. Nothing was deleted. To delete:
  - `claude/tender-faraday-68c706`
  - `claude/art-pipeline-pivot`
  - `claude/heirs-by-adoption`
  - `claude/death-on-the-wall`
  - `claude/secession`
  - `claude/capsule-2026-09-23`
  - `claude/tribal-wars-patch`
  - `claude/rome-decline-forgone`
  - `claude/rome-writes-at-founding`
  - `claude/away-catch-up`
  - `claude/news-card-steady`
  - `Mathiano-patch-1`
  - `claude/colony-depth`, which has no PR but is fully contained in
    main (0 ahead). Mathias's call.
- **"Automatically delete head branches."** The settings write is
  proxy-blocked (`delete_branch_on_merge` is false).

## Next

1. Merge #15 first.
2. Then I merge main into #13 and #14 and resolve DESIGN §3.1/§3.3,
   the change log (renumbered after v0.3.1) and CLAUDE.md pillar 11 in
   §2.11's favour.
3. Then the grid session (§4.5) and the v0.1 map session (§5).

Three PRs are open (#13, #14, #15). That is one over the limit of two,
because of this request.

## Later: tier-1 stills through artgen (`claude/tier1-sprites`, no PR yet)

This work is on `claude/tier1-sprites`, stacked on `Mathiano-tier1-art`.

**Placed as tier-1 sprites (12).** Each one passes the plate assertion:

- castellum
- forum
- cellars
- clay works, from `clay_pit` 🟡
- farm
- granary
- insulae
- iron mine
- lumber camp
- market
- temple, from `shrine` 🟡
- waystation

Tiers II and III keep their old drawn sprites, so every colony now
mixes the two styles.

**Failed the plate assertion.** The assertion was not changed.

- `library_t1.jpg`: slopes +0.548 / −0.553. The tolerance is ±0.45…0.55.
- `rome_anchor_1.jpg` (the praetorium): slopes +0.286 / −0.294. There
  is no praetorium building to place it on anyway.

**Passed but not placed.**

- `warehouse_t1.jpg` has a 15×112 px black bar at its top-right edge,
  which is in the source image.
- `barracks_t1`, `blacksmith_t1`, `iron_works_t1` and `stables_t1`
  have no building in `data/buildings.json`.

**Art reaching the frame edge.** Most of the stills touch the top or
bottom of the frame. Where the bottom tip of the plate is cut off, the
anchor is unaffected, because it is computed from the side corners
only. Where the top is cut off, a roof or plume may be clipped.

**Tool fixes** in `tools/artgen/build.py`:

- `path=key` names a sprite separately from its file name.
- The default tile width now includes the manifest's `plateTiles`. A
  plain `npm run assets` used to wipe the manifest.
- Rewriting the manifest keeps `plateTiles`.
- A batch reports every failing plate before it exits.
- The selftest covers all of the above.

**PR.** Not opened: #13, #14 and #15 are already open, over the limit
of two.

## Later still: the town grid (`claude/town-grid`, pushed, no PR)

This branch stacks on `design/pivot-2026-09-27` (#15, for the §4.5
text it implements) and merges `claude/tier1-sprites` into it.
`claude/tier1-sprites` is superseded by it.

### Built

- **§4.5 C.1, C.2 and C.4.**
  - The town is a grid of cells inside a rectangular wall. Its size
    follows the wall tier (🟡 6/7/8/9).
  - The grid grows away from the river, so nothing placed ever falls
    outside the wall.
  - Buildings have 🟡 footprints: 2×2 for the forum, castellum and
    temple, 1×1 for everything else.
  - Buildings are unique or repeatable.
  - Placing is a mode of the village view: every place a building
    fits is marked, and a click puts it down.
  - The wall is drawn one piece per cell of edge, sorted by depth with
    the buildings.
  - The wheel zooms in as far as the old frame.
- **Barracks.** A repeatable 1×1 building; each one adds `militiaBonus`
  to the pool. Costs are `_tuning`. Tier I uses the still; tiers II and
  III are drawn placeholders.
- **Riverbank.** A strip one cell deep beyond the south-east edge,
  outside the wall, for buildings placed only there. There is no
  harbour building; a test builds a 2×1 one from data to prove the
  rule.
- **Stills.** `npm run assets:stills` reads `assets/src/stills.json`
  and places every still that passes. The library fails (+0.548 /
  −0.553) and keeps its drawn sprite. The warehouse's black bar is
  cropped in the pipeline.
- **Saves.** Saves from the ring layout load onto the grid, with
  buildings kept by id and tier. `saveVersion` is now 2.

### Docs

- **DESIGN:** §4.4, §4.5, §5.2, §8.1, §10 and §14, and change log
  v0.3.2.
- **CLAUDE.md:** the Conventions now describe the grid.

### Verified

- `npm test` (421 tests), the build and the artgen selftest pass
  locally. CI has not run: there is no PR.
- In headed Chromium at 1920×1080, I placed the castellum and 13 more
  buildings through the UI, raised the wall to III and zoomed. There
  were no page errors.

### Open, for Mathias

- 🟡 **Grid choices made by Claude:**
  - the river edge (south-east);
  - the bank's depth (1);
  - the gate's side (south-west);
  - the site positions outside the wall.
- 🟡 **Still-to-building mappings:** clay pit → clay works, and
  shrine → temple I.
- **Code differs from the doc** (B.1 is not built):
  - there is no praetorium;
  - the market is still separate;
  - there are sixteen buildings in data.
- **Art:**
  - The base map was painted for the round wall and letterboxes; it
    is due to be regenerated.
  - The river is drawn in code.
- **No PR opened.** #13, #14 and #15 are open, over the limit of two.
  - Merge order: #15, then this branch.
  - #13 and #14 will need main merged in: the village view, the
    overview and the village tests all changed here.
