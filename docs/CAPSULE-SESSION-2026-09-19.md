# Capsule — session 2026-09-19

Branch `claude/colony-depth`, off `claude/art-pipeline-pivot` (PR #2), because
every sprite depends on `tools/artgen/` which has not merged to `main` yet.

Backlog banked in `docs/KICKOFF-v0.2.md`. This session took the first five items
in the recommended order.

## 1. All 39 building tiers drawn ✅

`tools/artgen/draw.py` composes each tier as an isometric scene on an 8×8 plate,
rasterises it with cairosvg and pushes it through the existing keying, trim,
anchor and scale pipeline. The plate assertion in `build.py` therefore checks
this module's own geometry: every tier reports slopes of +0.499/−0.499.

- **Palette** `tools/artgen/palette.json` is derived from `assets/style/anchor-v1.jpg`
  by k-means over non-background pixels, with the greens sampled from the lumber
  camp render. That is the re-derivation DESIGN §10 asks for.
- **Two real bugs found by looking at the output.** Ground decals (paving, road,
  furrows) painted over colonnades, and a composite sorted by its footprint hid
  its own columns behind its podium. Both fixed by `Scene.group()`: parts of one
  structure share a depth and paint in author order, which the building's author
  knows and a depth sort cannot.
- 🟡 **A plot is 1.75 layout tiles wide** (`plateTiles` in the manifest) so
  neighbouring plates meet instead of floating apart. This changes the CLAUDE.md
  convention that the plate equals the tile; the convention is updated and the
  test now checks the declared multiple.
- Village ground, survey stakes on unbuilt plots, per-site glyphs, and names
  moved to a hover layer above every plot so touching plates cannot cover them.

## 2. Round report and away digest ✅

Log entries carry ids, so one mechanism serves three things: the colony's
opening beat on a new game, a report after each round, and a digest of the
rounds that ran while the game was closed. v1 saves are migrated.

## 3. Rival ambitions ✅

The Cornelii now want things. A house below an attitude ceiling asks for a named
post or for denarii, with a three-round deadline. Granting it seats them and
buys real goodwill; refusing costs attitude and is remembered; **ignoring costs
more than refusing**. Grievances accumulate, they make every leverage action
more likely and harder-biting, and at three grievances the house stops sulking
and writes to Rome (DESIGN §9.7), which costs favour and raises corruption. A
house that has just been ignored does not ask again in the same turn.

## 4. Stat levelling and gravitas gates ✅

Both were specified in DESIGN §9.2 and inert in code. A post-holder's relevant
stat now grows while he serves, capped; the office holder gains authority.
Gravitas rank gates the treasury and the garrison, a bribe, and Rome's backing.
🟡 Gates are set so three posts are fillable at founding and two unlock as the
leader earns standing, rather than deadlocking the opening council.

## 5. Choice events and raid foreshadowing ✅

`data/events.json` is rewritten around a bag of deltas applied by one function,
so a new outcome never needs a new branch in code. Five events now stop and ask,
each with a cost either way: deserters, a rival's debt, the augurs, an escaped
hostage, a short granary. An unanswered choice blocks further events and keeps
its card up.

Raids are announced a round before they land, with the tribe's strength against
your defence, and can be bought off. Paying raises their trust and **lowers
their fear of you**: they learn that you pay.

## Verified ✅

- 113 tests. `npm run build` clean. Every sprite passes the 2:1 plate assertion.
- Headless Chromium: 24 rounds driven through the real UI with no page errors;
  demands, the massing warning and the choice card all reached the player and
  resolved. A unit test confirms a choice event fires within 60 rounds.

## Next

From `docs/KICKOFF-v0.2.md`, in order: portraits, Rome favour with actual
effects, lesser posts, local playtest telemetry, and the panel rewrite. None of
it should start before a week of play against these five.

## Open 🔴

- PR #2 is still unmerged, so this branch stacks on it.
- Balance is still untested by a human. The numbers most likely to be wrong:
  demand frequency, grievance escalation, and the appeasement price.
