# Kickoff — closing the gap to the vision

Written 2026-09-19, after the v0 slice and the art pipeline pivot. This is the
backlog of everything between the current build and `docs/DESIGN.md`. It is a
reference, not a commitment: `DESIGN.md` stays the source of truth for design,
and nothing here overrides a ✅ in it.

**How to read it.** Each item names the pillar or section it serves and whether
the gap is verified in code (✅), estimated (🟡), or a guess (🔴). The order in
§6 is the recommended build order, not the order of importance.

---

## 1. Politics does not yet carry tension

Pillar 5 says politics carry the tension. Today they mostly tick over.

| Gap | Detail | Status |
|---|---|---|
| Rivals have no goals | The Cornelii only obstruct, skim or leak, and only when unhappy *and* holding a post. They never ask for anything, never threaten, never weigh you against their own advancement. | ✅ |
| Stats never level | §9.2 says characters level by holding posts and by events. A treasurer with discipline 4 dies with discipline 4. | ✅ |
| Gravitas rank is inert | §9.2 makes rank a gate on posts and intrigue options. It is computed, displayed, and read by nothing. | ✅ |
| Rounds produce no report | A rival acts, a tribe raids, a man dies, and the only trace is a line in a log tab the player may never open. | ✅ |
| Events never ask anything | Nine flat outcomes, no choices. A dilemma with a cost either way is the cheapest tension in the genre. | ✅ |
| Lesser posts absent | §9.3 wants posts outside the council: less gravitas, less threat, somewhere to park a rival. | ✅ |
| Rome standing unused as a lever | §6 makes the loyalist family's standing move with Rome's favour. Declining a request nudges attitude and nothing else. | ✅ |

## 2. The daily session loop is thin

§12 targets a 15-minute session that extends to an hour.

- **No return digest.** Coming back after three days should say what happened: idle rounds, a raid repulsed, the granary finished. ✅
- **No reason to come back.** Nothing is scheduled, promised or threatened for tomorrow beyond timers running down. ✅
- **No opening beat.** First run drops the player into 17 plots with no orientation and no framing of the goal. ✅

## 3. Art and the village

- **37 of 39 building tiers have no sprite.** The first thing a playtester sees is labelled empty diamonds. ✅
- **Proposal, accepted 2026-09-19:** Claude draws the remaining tiers as layered SVG in the anchor's grammar — terracotta and travertine, ink linework, light from the top left, a 2:1 plate of packed earth with paving and grass at the edges — rasterises them, and pushes them through `tools/artgen/` so they obey the plate and anchor convention like any other sprite. 🟡 They will read as the same style family, not the same hand as `anchor-v1.jpg`. That is the right trade for a colony that can be played now.
- **Tier progression must read at a glance:** timber to stone, thatch to tile, an added storey, more stock in the yard.
- **Tier-3 animation** returns to the original §10 plan: hand-authored SVG overlays driven by CSS — smoke, a swinging sign, a crane arm. No shimmer, no licence question. The Veo route is parked, see the 2026-09-18 capsule addendum.
- **The ground is a flat CSS gradient.** It wants a drawn colony plate, a road to the waystation, the river the clay bank sits on, and site markers that look like a forest or a seam rather than a tinted diamond. ✅
- **Labels overlap and float.** Empty plots should read as surveyed ground, not as the words "empty plot". ✅
- **No portraits.** §10 wants monochrome ink busts, one accent colour per family. The Houses tab is currently a table. ✅

## 4. Systems that exist but are hollow

- **Rome favour** is a number with no effect. It should gate the unique rewards and Rome's willingness to back a political move. ✅
- **Research scrolls** accrue and cannot be spent. v0.2 by plan, but the player sees a currency that does nothing. ✅
- **Raids arrive unannounced and unopposed.** "Scouts report the Chatti massing" one round ahead, with pay-them-off or stand-and-fight, turns a number into a decision. ✅
- **Militia sinks** exist in the data model with nothing to allocate until sites arrive in v0.1. ✅
- **Tribe likes and hates** sit in `data/tribes.json`, unused until three tribes exist. ✅
- **Balance is untested.** Nobody has played ten rounds. Lifespan in rounds against a player who runs twenty rounds an evening is the first number to watch. 🟡

## 5. Foundation

- **No playtest telemetry**, even local. A per-session record in the save — rounds, raids, the denarii curve — would make playtest reports concrete. ✅
- **The panel re-renders as an HTML string every second.** Fine now; it will hurt when panels carry portraits and reports. ✅
- **Save migration is a stub.** The first real schema change needs it to work. ✅

## 6. Recommended order

> **Status 2026-09-19:** this whole list is done on `claude/colony-depth`, plus
> portraits, tier-3 animation, lesser offices, Rome favour, telemetry and a
> first balance pass. See `docs/CAPSULE-SESSION-2026-09-19.md`. Work then moved
> on to v0.1 (world map, site claims, three tribes) — see
> `docs/CAPSULE-SESSION-2026-09-19b.md`.


1. **Sprites and ground.** Everything else is judged through them, and a playtester cannot form opinions about a village of labelled diamonds.
2. **Round report and return digest.** Makes existing systems legible. Cheapest large gain.
3. **Rival ambitions.** The core of Pillar 5.
4. **Stat levelling and gravitas gates.** Specified, cheap, and they make posts matter.
5. **Choice events and raid foreshadowing.** Turns numbers into decisions.

Everything below that waits for a week of play: portraits, telemetry, Rome favour effects, lesser posts, the panel rewrite.

## 7. Branch note

This work began on `claude/art-pipeline-pivot` (PR #2) rather than `main`,
because every sprite depends on `tools/artgen/` and the manifest renderer that
lived there. PR #2 merged on 2026-09-19 and `claude/colony-depth` was rebased
onto `main`, so the stack is gone and future branches start from `main`.
