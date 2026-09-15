# CLAUDE.md — Rome III

Single-player Roman colony-building game. Year 0, Germania. Real-time village economy, turn-based politics with rival families, tribes and Rome. Built solo by Mathias (product owner, "vibe coder") with Claude Code as implementer.

## Read first

1. `docs/DESIGN.md` — the design source of truth. Marks: ✅ decided, 🟡 proposed, ❓ open.
2. `docs/CAPSULE-*.md` — session capsules; the newest one is the current state.
3. `data/*.json` — all balance and content. If a number or name lives in code, that is a bug.

Do not implement anything marked 🟡 or ❓ without Mathias confirming it in the session. Do not resolve an ❓ yourself.

## Pillars — never violate

From `docs/DESIGN.md` §2. Short form:

1. No real money, no energy bars, no pay-to-win.
2. Real-time for anything only the player does; turn-based for anything involving another actor.
3. Every timer can be finished early for denarii; price never exceeds what the colony earns in that time.
4. Buildings upgrade in place. No walking builders.
5. Single-player. Politics carry the tension.
6. Population is opportunity, not a chore.
7. Never unrecoverable. Research persists through everything.
8. Defer, don't drop — bank in `docs/DESIGN.md` §14.
9. Keep it real — Roman names, Roman gods, Roman practice.
10. PC first, landscape.

## Stack

- Vite + TypeScript. SVG rendering for village and map. No React unless a panel needs it — ask first.
- One state store, serialised to JSON. That JSON is the save file. localStorage + export/import in v0.
- Data in `data/`, game logic in `src/`, asset pipeline in `tools/isobuild/` (Python).
- GitHub → Vercel auto-deploy. No secrets in the repo.

## Repo layout

```
CLAUDE.md
docs/            DESIGN.md, CAPSULE-*.md, PALETTE-NOTES.md
data/            resources, buildings, research, requests, tribes, families, events (JSON)
src/
  state/         store, save/load, serialisation
  village/       clock, economy, construction, storage
  politics/      rounds, families, characters, posts, intrigue
  map/           hex grid, sites, scouting, claims
  combat/        abstract raid resolution, militia pool
  rome/          requests, rewards
  tribes/        disposition, envoys
  render/        SVG village view, map view, panels
tools/isobuild/  building SVG generator + palette pipeline
assets/          generated SVGs, portraits
```

## Conventions

- **Anchors:** buildings anchor at base-diamond centre (`data-ax` / `data-ay`). Never the south vertex — it floats half a tile.
- **SVG primitives only** in generated buildings. No bezier paths. Arches are polyline approximations.
- **Animation:** tier 3 only. CSS keyframes and the Web Animations API. viewBox 64×64.
- **Naming in code:** English. Latin only where the doc says so (`forum`, `castellum`).
- **Gods:** Roman names. Jupiter, not Zeus.
- **Assets:** generated or original only. Nothing copied from Rome II, Travian, Anno or any other game.

## Ways of working

- Mathias decides design; Claude proposes and implements. When a design gap appears, propose one option with a 🟡 and continue only after confirmation.
- Verify with assertions and tests, not by eye. Vision can be unreliable; a pixel or math check is the fallback.
- Small commits with descriptive messages. One feature per branch when it touches more than one `src/` module.
- Flag uncertainty with ✅ / 🟡 / 🔴 rather than projecting confidence.
- Mathias cross-checks proposals with Gemini. Gemini's art-direction instincts are sound; its codebase-specific claims need verification against this repo before acting on them.
- End every substantial session with a `docs/CAPSULE-SESSION-<date>.md`: what changed, what's verified, what's next, what's open.

## Do not

- Add a build queue, a fifth family, citizen tiers, offence, or any feature listed in `docs/DESIGN.md` §14 without being asked.
- Add Supabase, auth or any network dependency in v0.
- Introduce a visible village clock. Only the political round is visible time.
- Hard-code balance numbers.
