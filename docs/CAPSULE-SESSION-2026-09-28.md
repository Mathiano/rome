# Session capsule — 2026-09-28 (overnight)

## Branches, in merge order

| # | Branch | PR | Base | CI (`test-and-build`) | State | Summary |
|---|---|---|---|---|---|---|
| 1 | `design/pivot-2026-09-27` | #15 | main | ✅ green | merged `8f9a926` | The holdings and pivot design patches (DESIGN v0.3.0–v0.3.1). |
| 2 | `claude/steady-ui-no-idle-rounds` | #13 | main | ✅ green | merged `3398d9d` | No round runs unattended; the UI stops redrawing what the player is using. |
| 3 | `claude/absence-pillar-return-strip` | #14 | main | ✅ green | merged `6153e5c` | The return strip is anchored to when the colony was last seen. |
| 4 | `claude/town-grid` | #16 | main | ✅ green | merged `28256e9` | Town grid, Barracks, riverbank edge, tier-1 stills, the save rule, and the Barracks in SPRITE_QUEUE. |
| 5 | `claude/praetorium-seat` | #17 | main | ✅ green | draft | Item 0: the praetorium is the seat, the forum absorbs the market, cost rises per copy, adjacency scaffolding with no rules. |
| 6 | `claude/holdings-map` | #18 | #17 | ✅ green | draft | Item 1: a 21-hex Country view; "?" resolves to a site, a hoard or a camp; every §5.2 kind; camp, station and fort drawn in SVG. |
| 7 | `claude/holdings-contest` | #19 | #18 | ✅ green | draft | Item 2: tribes take unclaimed sites on the clock; held sites change hands only in a convened round; garrisons stay within the pool. |
| 8 | `claude/roads` | #20 | #19 | ✅ green | draft | Item 3: roads laid hex by hex from the colonia; a connected holding is harder to raid, yields more, and eases trade. |
| 9 | `claude/basemap-spec` | #21 | #20 | ✅ green | draft | Item 4: the base map v2 geometry spec in pixels, a wireframe guide, and a drift test. |

**Merging the stack:** merge #17 first. GitHub moves #18's base to main only if `claude/praetorium-seat` is deleted on merge; otherwise set it by hand. Repeat down the stack. Each PR bumps `saveVersion` (3, 4, 5, 6). **Merging #17 resets every existing save, production's included**, under the save rule. The later bumps reset only saves made between merges.

CI runs on stacked PRs as they are. The workflow's `pull_request` trigger has no branch filter, which I confirmed on #18, so the night's first commit (a trigger change) wasn't needed.

## Verified

- ✅ Every item has passing `tsc --noEmit`, the full suite and `vite build` locally. The suite went from 457 tests on main to 504 on #21.
- ✅ Every item has a headed Chromium check (xvfb, 1920×1080) with screenshots. They are in the session scratchpad, which is not in the repo.
  - **Item 0:** the founding and the town view, with the praetorium standing as the seat.
  - **Item 1:** the Country view, "?" marks, holding marks and the raise lane.
  - **Item 2:** a threat declared, the player's move, and the threat decided in the round.
  - **Item 3:** 5 segments laid and 1 being laid, then rushed; "on the road"; wood income +46 → +50/h; the next segment offered; the round unchanged.
  - **Item 4:** the diagram laid over the live game. The rendered floor and bank polygons equal the spec's tier-0 rows pixel for pixel.
- ✅ Item 3's browser check caught two things the tests hadn't. Both are fixed:
  - the hex being laid offered a disabled "Build road" (now a test);
  - the segment being laid was indistinguishable from built road (a colour change; checked by eye on a zoomed crop, not by a test).
- ✅ Contest rule (§5.5, §2.11), both halves:
  - an unclaimed site can go to a tribe while the player is away, on the village clock;
  - a held site never changes hands without a round the player convened.

  `tests/contest.test.ts` covers both, each with a simulated week away. In the first, tribes take unclaimed sites up to their share and no round runs. In the second, a threatened holding stands and its threat waits for the next convened round.

## `_tuning` defaults set tonight (all Claude's first pass, all in `data/`)

**Item 0: `data/config.json`**
- `repeatables.costGrowthPerCopy` **0.25**. Each further copy of a repeatable costs ×1.25ⁿ, so the fourth warehouse costs about twice the first. Unique buildings never scale.

**Item 1: `data/map.json`**
- `radius` **10** (21 across is ✅ in §5.1; it was 12).
- `siteCount` **30** (was 34).
- **Site weights:**
  - timber 10, clay_bank 8, iron_seam 7, meadow 8;
  - quarry 4, salt_spring 3;
  - troop_field 4, watchtower 4, ford 5, shrine 4, ruins 4;
  - treasure 3, camp 6.
- **Yields unchanged:** wood 16, clay 16, iron 10, grain 18.
- `troop_field.militiaPerTier` **[3, 6, 10]**.
- `watchtower.revealRadius` **2**.
- `ruins.claimReward` **2 scrolls**, paid once on claim (it was 1 scroll, paid at scouting).
- `treasure.reward` **60 denarii**.
- **Holding tiers:**

  | Tier | Yield | Defence | Cost | Time |
  |---|---|---|---|---|
  | Camp | ×1 | 0 | — | — |
  | Station | ×1.5 | 8 | 120 wood, 60 clay, 40 denarii | 30 min |
  | Fort | ×2 | 20 | 320 wood, 200 clay, 80 iron, 120 denarii | 2 h |

**Item 2: `data/map.json` `contest`**
- `tribeTakeChancePerHour` **0.02** (about three sites a week).
- `maxTribeHeldShare` **0.3**.
- `noticeRounds` **1**.
- `watchtowerExtraRounds` **1**.

**Item 3: `data/map.json` `roads`**
- `segmentCost` **30 denarii + 40 wood**.
- `segmentSeconds` **900**.
- `exposureCut` **0.5**.
- `yieldBonus` **0.25**.
- `tradeRate` **−0.1**.

**Item 4: `docs/BASEMAP-V2-SPEC.md`**
- Frame **3520 × 2200 (16:10) at 2 px per scene unit**, placed at scene (−908, −542).

## ❓ and 🟡 decided tonight, for confirmation

- 🟡 **Roads get their own lane.** §4.4's concurrency rule doesn't mention roads, and sharing the holding lane would make roads and holdings compete.
- 🟡 **A claim is applied as the player's move,** not deferred to the next round. §5.5 says claiming is a council action. It costs the action and denarii, and holding is decided in rounds.
- ❓ **A shrine's gravitas goes to the player's house.** DESIGN names "the post of temple", which v0 doesn't have.
- ❓ **"Envoys resolve faster" (the ford and roads) is a no-op.** An envoy takes one round in v0, so there is nothing to shorten. It waits for longer envoy journeys.
- 🟡 **Quarry and salt spring can be claimed but yield nothing** until the stone and salt drop (per §5.2).
- 🟡 **A ruin pays once, on claim,** and not at scouting, so a scout alone can't farm it.
- 🟡 **Base map v2:** the river is painted in the exact band, and the drawn river is retired on wiring. The ground between the tier-0 and tier-3 walls is cleared and low in contrast. No roads are painted.
- 🟡 **The contest's hourly roll hashes the map seed and the hour.** It does not draw on the game's RNG, so the clock never shifts other outcomes.

## Not started, as instructed

Gravitas as an action budget, dedications, festivals, gods' effects, research contents, tier 2–3 art, adjacency rules. Nothing art-related was generated or placed.

## What I'd do differently

- **Typecheck everything from the start.** I filtered `tsc` output to `src/` to cut noise, which hid errors in test files. The build then failed, and one browser check ran against a stale bundle. Now I run a full `tsc --noEmit` before every browser check.
- **Bump `saveVersion` once for the whole stack,** not once per PR. Four bumps mean four resets for anyone playing between merges, for no benefit while the stack merges together.
- **Write the in-progress UI state into the tests first.** Both road UI bugs were in the "segment being laid" state, which the tests only covered from the model side.
- **Commit the diagram's generator.** `docs/basemap-v2-geometry.svg` was computed by a throwaway script. The drift test catches a changed layout, but regenerating the diagram is by hand.
- **Watch loop bounds.** A contest test hung because its loop bound read `lastTick`, which the loop advances. Bounds should be fixed values.
- **Don't use `pgrep -f` or `pkill -f`** with a pattern that appears in the calling shell's own command line. It killed my shell twice.

## Next

1. Mathias reviews #17 → #21 and merges in order.
2. Confirm or change the 🟡 and ❓ above, and the `_tuning` numbers.
3. Take `docs/BASEMAP-V2-SPEC.md` and the guide SVG to the image model. When `base-map-v2.jpg` lands, wire it as the spec's §7 says.
