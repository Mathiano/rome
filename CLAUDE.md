# CLAUDE.md — Rome III

Single-player Roman colony-building game. Year 0, Germania. Real-time village economy, turn-based politics with rival families, tribes and Rome. Built solo by Mathias (product owner, "vibe coder") with Claude Code as implementer.

## Read first

1. `docs/DESIGN.md` — the design source of truth. Marks: ✅ decided, 🟡 proposed, ❓ open.
2. `VISION.md` — what the game is and which way to lean when DESIGN.md doesn't say. Where the two disagree, DESIGN.md wins and the disagreement is flagged to Mathias.
3. `docs/CAPSULE-*.md` — session capsules; the newest one is the current state.
4. `data/*.json` — all balance and content. If a number or name lives in code, that is a bug.

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
9. Keep it real — mythic Rome. Roman names, Roman gods, Roman practice; the gods act — no wizards, spells or mana.
10. PC first, landscape.
11. Absence costs opportunity, never assets: nothing the player holds is taken while they are away; absence costs only what they would have gained. No round runs unattended — a player who never convenes is not playing, not exploiting (§2.11, §3.3).

## Stack

- Vite + TypeScript. SVG rendering for village and map. No React unless a panel needs it — ask first.
- One state store, serialised to JSON. That JSON is the save file. localStorage + export/import in v0.
- Data in `data/`, game logic in `src/`, asset pipeline in `tools/artgen/` (Python).
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
tools/artgen/    source render → keyed, trimmed, anchored PNG sprite + manifest (Python)
assets/          style/ (anchor, prompts), src/ (renders), buildings/ (sprites + manifest), portraits
```

## Conventions

- **Anchors:** buildings anchor at the ground-plate centre, the midpoint of the plate's left and right corners (`data-ax` / `data-ay`, and `ax` / `ay` in `assets/buildings/manifest.json`). Never the south vertex — it floats half a tile.
- **Sprites:** PNG with alpha. The ground plate is the base diamond. One structure per sprite. A plate is one cell of the town grid: `plateTiles` in the manifest equals `cellTiles` in `data/layout.json` (1.75 layout tiles), and a 2×2 building's sprite is scaled to its footprint. `tools/artgen/` enforces the plate's 2:1 edges and writes the manifest; `npm run assets:stills` places the new-style stills listed in `assets/src/stills.json`, and `tools/artgen/draw.py` draws the tiers that have no still.
- **The town grid** (`docs/DESIGN.md` §4.5 C.1): a rectangle of cells inside a rectangular wall, sized by the wall's tier and growing away from the river, so nothing placed ever ends up outside it. `src/village/grid.ts` owns the cells, footprints and placement; a town slot exists only once something is placed on it. The praetorium is fixed at its centre (`placement: "fixed"`), never placed by the player. The grid's lines show only in build mode. Resource sites are fixed outside the wall in four biomes, three slots each (`data/layout.json` `biomes`); a slot takes only its biome's resource building. One edge is the riverbank, reserved for buildings placed only there (the harbour, not yet built).
- **The colony around them:** the country is one painted image (`assets/src/base-map-*.jpg`), made for the old round wall and due to be regenerated to the grid from `docs/BASEMAP-V2-SPEC.md` and its guide SVG, both written by `npm run basemap:spec` (`tools/basemap/`) — rerun it after any layout change. `src/render/environment.ts` draws the town floor, its cell lines, the bank and the river flat on top of it.
- **The wall has depth:** it is not scenery behind the plots. It runs on the grid lines round the enclosure, so `createWall` emits one piece per cell of edge, plus the towers and the gate, as `ScenePiece`s. Each piece's depth is x + y, the measure a building's centre sorts by, and the village merges them into one depth sort. Anything else draws a building through the near wall.
- **The wall is its own building, not the castellum** (`docs/DESIGN.md` §4.4, ✅ 2026-09-22). The `wall` tier decides what the circuit is made of: a bank with none raised, then a palisade, coursed stone, and a crenellated circuit that flies a standard over the gate. It stands on the wall slot `w1` at the gate — no cell, no ground plate — and counts as a building for concurrency. Its tier also sets the size of the enclosure. The castellum garrisons the colony from the centre and its tier drives only its own sprite. The v0 building list in §4.4 is ✅ confirmed, so any further addition to it is Mathias's call.
- **The wall is lit like everything else:** from the top left. `wallLight(edge)` lights the faces that look down and to the left and shades the ones that look right, the same split the sprites' boxes use.
- **A yard is not a building:** a resource plot carries the stock, tools and clutter of its trade, and people working it. One tree in a lumber camp is a bug, not a style.
- **Animation:** tier 3 only. SVG overlays on the PNG sprite, CSS keyframes and the Web Animations API, positioned from the same anchor.
- **Naming in code:** English. Latin only where the doc says so (`praetorium`, `forum`, `castellum`).
- **Gods:** Roman names. Jupiter, not Zeus.
- **Assets:** generated or original only. Nothing copied from Rome II, Travian, Anno or any other game.

## Ways of working

- Mathias decides design; Claude proposes and implements. When a design gap appears, propose one option with a 🟡 and continue only after confirmation.
- Verify with assertions and tests, not by eye. Vision can be unreliable; a pixel or math check is the fallback.
- Small commits with descriptive messages. One feature per branch when it touches more than one `src/` module.
- Every change lands through a pull request with CI green; branch protection on `main` enforces it. **Merging:** Mathias reviews the preview and says "merge"; Claude then merges main into the PR, waits for CI to pass on that head, merges, and confirms the merge commit by reading the PR back as merged. Mathias does not merge by hand: his manual merges failed silently three times (Mathias, 2026-10-04). Branch off `main`, and stack a branch on another only when it depends on it. At most two pull requests open at once. Session capsules are the exception: they go straight to `main`.
- Flag uncertainty with ✅ / 🟡 / 🔴 rather than projecting confidence.
- Mathias cross-checks proposals with Gemini. Gemini's art-direction instincts are sound; its codebase-specific claims need verification against this repo before acting on them.
- End every substantial session with a `docs/CAPSULE-SESSION-<date>.md`: what changed, what's verified, what's next, what's open.
- In an unattended session, a ❓ may be resolved only as a data-file default, listed in the session capsule for confirmation. Never in code.
- **Saves:** Before 1.0, a save-format change bumps saveVersion and resets older saves instead of migrating them. The ring-to-grid migration (migrateRingsToGrid, 2026-09-27) is a kept one-off; don't add another without asking. After 1.0, ask first. *(Mathias, 2026-09-28. In code: `deserialise` refuses an older format with `SaveTooOld`, and the load sets the old save aside under `rome.save.v1.retired.v<n>` rather than letting the new colony overwrite it.)*

## Do not

- Add a build queue, a fifth family, citizen tiers, offence, or any feature listed in `docs/DESIGN.md` §14 without being asked.
- Add Supabase, auth or any network dependency in v0.
- Restore the idle round, a calendar floor, or any mechanic that runs a round without the player (§2.11, §3.3). A replacement needs Mathias's sign-off first.
- Introduce a visible village clock. Only the political round is visible time.
- Hard-code balance numbers.
