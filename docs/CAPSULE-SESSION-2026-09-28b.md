# Session capsule — 2026-09-28 (b): the overnight stack merged; biomes and the fixed seat

## Merged (step 0)

Each PR was retargeted to main and had main merged into it, then merged once CI was green on that head.

| Order | PR | Branch | Merge commit |
|---|---|---|---|
| 1 | #17 | `claude/praetorium-seat` | `b202986` |
| 2 | #18 | `claude/holdings-map` | `a1770ef` |
| 3 | #19 | `claude/holdings-contest` | `0c7d5b4` |
| 4 | #20 | `claude/roads` | `dc88bb8` |
| 5 | #21 | `claude/basemap-spec` | `5e9dcbf` |

Before merging #21, these changes went onto it:

- "Envoys resolve faster" is removed from §5.2 and §5.4. The ford's effect is a trade bonus at the forum, and its unused `envoyRoundsSaved` is gone from data and `SiteDef`.
- Recorded as ✅: roads have their own build lane; the shrine's gravitas goes to the player's house until a temple post exists; the river is painted in the base map, and the drawn river is removed when it lands.
- The wireframe generator is committed under `tools/basemap/`. The original was a throwaway script, so this is a rebuild. It reproduced the committed SVG byte for byte, and a test asserted that.

## Open: PR #22 (`claude/tender-faraday-68c706`)

One branch off main, save format 7.

1. **Resource biomes ✅.** Four biomes with three slots each (`data/layout.json` `biomes`, `_tuning`). Slot ids name their biome (`wood1` … `grain3`). A slot takes only its biome's resource building. DESIGN §4.1, §4.4 and §4.5 C.2 are amended.
2. **The praetorium is fixed** at anchor (0,0), `placement: "fixed"`. The player never places or moves it.
3. **The grid's lines show only in build mode.**
4. **The base-map spec and guide are regenerated** by `npm run basemap:spec`. Both files are checked against the generator by a test.
5. **§14 banks** a base map that changes as the town grows.

## Decisions taken in session (Mathias)

- **Praetorium:** placed at the centre of the tier-III grid (anchor 0,0, half a cell off the true centre), not the founding centre.
- **Iron:** on our bank where the river passes the town's south end, with grain moved further west. The river fills the south-east on our side, so "south-east by the river" can't be met on land without crossing the water.

## `_tuning` and 🟡 set this session

- **Slot cells:**

  | Biome | Slots |
  |---|---|
  | Wood | (-7,-3), (-7,0), (-7,-6) |
  | Clay | (3,-7), (1,-7), (-2,-7) |
  | Iron | (5,7), (3,8), (5,9) |
  | Grain | (-3,7), (-1,7), (-5,7) |

  Three per biome.
- **Clearing band:** 0.5–1.5 cells beyond the tier-III wall (`tools/basemap/geometry.ts` `CLEARING`). wood3 and the iron slots were moved outward to clear it.
- **Frame:** 4224 × 2640 px. It is derived from the scene bounds and changes whenever the layout does.
- 🟡 **Drawn town floor:** it still shows at rest; only the cell lines hide. The spec proposes floor-only-in-build-mode once v2 is painted.
- 🟡 **Tier-III wall line:** the one line the painting may hint at, because it's the outermost.

## Verified

- ✅ #22: `tsc --noEmit`, 512 tests and `vite build` pass locally.
- ✅ Headed Chromium at 1920 × 1080 and 1280 × 800, with the same results at both widths:
  - the grid is hidden at rest, shown in build mode (32 cells for a warehouse), and hidden after Esc;
  - the praetorium has no Place row;
  - with the guide laid over the live game, the town floor equals the spec's tier-0 row, and all 12 slot centres equal the spec's plate centres.
- 🟡 The v1 painting still shows fields and rocks where the new biomes stand. That is expected until v2 is painted.

## Next

1. Mathias reviews and merges #22.
2. Take `docs/BASEMAP-V2-SPEC.md` and `docs/basemap-v2-geometry.svg` to the image model.
3. When `base-map-v2.jpg` lands, wire it as spec §8 describes:
   - an exact frame;
   - the drawn river removed;
   - the floor decision above.

### Follow-ups set by Mathias for the next session (2026-09-28, not done yet)

1. **Hide the town floor at rest when base map v2 is wired in.** Do it in the same change as the wiring, not before, because the v1 painting under it doesn't match the grid. This settles the 🟡 above: in build mode the floor shows with the grid; at rest the painted clearing is what shows.
2. **Say in the spec that its pixel size is a target, not a requirement.** The painting will come back smaller, and possibly 3:2 or 16:9. The pipeline scales it uniformly, fits the clearing to the spec, and extends or crops the edges, as it did for v1 (`MAP_FIT` and the edge-colour flood). Its pixel size must not be held against it.
   - What still matters is the relative geometry: the biomes and slots where the guide puts them, and the river parallel to the town's river edge.
   - A uniform scale and shift fitted to the clearing only puts the painted river on grid x = 6 if those proportions were kept. The wiring's pixel check on the near bank is where a miss shows.
   - Put this in `tools/basemap/spec.ts` and rerun `npm run basemap:spec`; the spec test requires the generated file to match.

## Open

- ❓ Adjacency rules, gods' effects, research contents: unchanged, still Mathias's.
- The ring-to-grid migration has been unreachable since format 3: `deserialise` applies it only while the current format is 2. It is kept per the save rule and still tested.
