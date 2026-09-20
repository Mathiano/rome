# Capsule — session 2026-09-19 (continued): v0.1

Branch `claude/colony-depth`, now rebased onto `main` (PR #2 merged). The v0.2
kickoff list in `docs/KICKOFF-v0.2.md` is finished, so this stretch is **v0.1
from `docs/DESIGN.md` §13**: the world map, site claiming and garrisons, and all
three tribes with the like/hate web.

## The world map ✅ (DESIGN §5)

- **469 hexes, and the save carries none of them.** Terrain and site placement
  are a pure function of a map seed fixed at founding, so the save records only
  what the player did: where scouts have been, what is held, who garrisons it.
  The map seed is separate from the game RNG, which advances every round.
- Terrain is generated in patches rather than noise (a hex often inherits a
  neighbour's), so forests and marshes read as regions.
- Terrain is visible from the start; a hex that holds something shows a **?**
  until scouts report, exactly as §5.1 asks. 34 sites in a 25-across map.
- **Scouting** is prepared like an envoy and resolves at the next round. A ?
  turns out to be a yield, a ford, a shrine, ruins worth a research scroll, or a
  war band that kills part of the party.
- 🟡 Map size is ❓ in §15.10. `data/map.json` uses radius 12 = 25 across, the
  doc's own proposal, flagged in the file.
- **Sites whose resources do not exist yet are deferred, not dropped**: §5.2
  lists a quarry and a salt spring, which need stone and salt from a later
  content drop (§4.1). Noted in `data/map.json`.

## Claiming and holding ✅ (DESIGN §5.3, §8.1)

- A claim is a council action plus denarii that rise with distance; holding
  costs upkeep that rises with distance too. A holding that cannot be paid for
  is abandoned rather than held for free.
- **Garrisons draw on the militia pool**, which finally gives §8.1 its second
  sink. Raid exposure rises with each ring out, and only men answer it. An
  ungarrisoned far holding is overrun; a strong one is not. Both are tested.
- A held yield feeds production; a ford sharpens the trade rate; a shrine adds
  gravitas each round.

## Three tribes ✅ (DESIGN §7)

- All three are awake, each with its own fear, trust, strength, envoys, trade
  agreement, massing warning and raids.
- **The like/hate web is live.** The Cherusci hate the Chatti and the Sugambri;
  the Sugambri lean to the Chatti. Warming to one cools those who hate it and
  warms its friends, and an alliance moves the web hardest — so there is no way
  to be everyone's friend. A leak reaches all of them; an event's fear or trust
  reaches all of them; the strongest tribe not sworn to you is the one that
  comes for your far holdings.
- Single-tribe saves migrate: the old `tribe` becomes `tribes[id]` and the other
  two wake with their starting disposition.

## Panel performance ✅

The side panel used to rebuild its HTML string every tick and usually throw it
away. It now rebuilds only when a fingerprint of what it shows has moved.
Measured in the browser with a MutationObserver: six idle seconds used to mean
six rebuilds and now means **zero**.

## Verified ✅

- 158 tests, clean build, no page errors driving the real UI.
- The hex maths is tested for the properties that matter rather than by eye:
  the count of hexes inside a radius, neighbours exactly one ring out, and
  neighbouring centres a hex-width apart so the grid cannot gap or overlap.
- Browser: 469 hexes drawn, 34 unknown markers, a scout dispatched and resolved
  through a real round, three tribe cards with independent envoys.

## Still open 🔴

- Research scrolls still cannot be spent: the tree is ❓ in §15.11 and CLAUDE.md
  forbids resolving an open question unasked. Scouting ruins now *pays* in
  scrolls, which makes the dead end more visible, not less.
- Nobody has played any of this. The map numbers — scout cost, claim cost,
  upkeep, exposure per ring — are one model's judgement.
- `claude/art-pipeline-pivot` and `claude/tender-faraday-68c706` are merged but
  still on the remote; this session's token cannot delete branches.
