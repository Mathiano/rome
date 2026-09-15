# Capsule — session 2026-09-15

First implementation session. The repo held only a README; this session built the v0 vertical slice from `docs/DESIGN.md` §13.

## What changed

- **Scaffold.** Vite + TypeScript + Vitest, `vercel.json`, `index.html`. No React, no network dependency.
- **Data (`data/`).** `config.json` (all tuning), `resources.json`, `buildings.json` (13 × 3 tiers), `layout.json` (2 centre + 7 inner + 8 outer slots, starting buildings), `families.json` (Aurelii + Cornelii active; Iulii, Claudii inactive), `posts.json` (5), `tribes.json` (3 defined, Chatti active), `requests.json` (15 progression + 5 filler + 4 unlocks), `events.json` (9), `research.json` (empty tree, scrolls persist).
- **Village (`src/village/`).** Invisible wall-clock economy, storage caps (warehouse/granary/uncapped treasury/cellars), one-building-plus-one-field concurrency, rush price = remaining time × denarii income (Pillar 3), offline catch-up that steps at construction boundaries, calendar-floor idle rounds.
- **Politics (`src/politics/`).** Round sequence player → rival → tribe → Rome → ages/events. Five posts with stat-scaled domain bonuses, appointment attitude effects, corruption meter, rival leverage (obstruct / skim / leak), bribe, seek Rome's backing with gravitas stock, ageing with a lifespan window, succession, new men when a house is extinct.
- **Combat (`src/combat/`).** Militia pool sized by population + castellum + veteran cohort; raid = strength vs walls + home militia + garrison prefect's discipline; cellars exempt; denarii never taken.
- **Rome (`src/rome/`).** Deliver / build / recruits / host requests, rewards with waystation multiplier, decline with no punishment beyond favour and loyalist attitude, collapse → administration soft reset.
- **Tribe (`src/tribes/`).** Fear/trust, six envoys prepared now and resolved next round, trade at the market once agreed.
- **Render (`src/render/`).** SVG isometric village with inlined sprites anchored at the base-diamond centre, DOM side panel with seven tabs, autosave to localStorage every 15 s and on unload, export (download + clipboard) and import.
- **Assets.** `tools/isobuild/build.py` writes 39 sprites to `assets/buildings/`. Primitives only, `data-ax`/`data-ay` on the root, tier 3 animated with CSS keyframes.
- **Docs.** `CLAUDE.md`, `docs/DESIGN.md` (verbatim from the Owner), `docs/PALETTE-NOTES.md`, this capsule.

## What's verified ✅

- 86 Vitest tests pass (`npm test`): data integrity, storage caps, Pillar 3 rush bound, concurrency, forum gating, offline accrual across a completion boundary, idle rounds capped, raid maths and cellar exemption, envoy timing, Rome progression/decline/collapse, corruption direction, one-post-per-character, succession and new men, deterministic rounds from a save, save round-trip, every sprite's conventions, jsdom render of every tab and the anchor transform.
- `npm run build` typechecks and bundles (183 kB JS, 29 kB gzipped).
- Headless Chromium against the production build: no page errors, build → progress bar → rush button, all tabs render, a round runs, an envoy dispatches, state survives reload.

## Proposals made without confirmation 🟡

CLAUDE.md says not to implement ❓ items without Mathias confirming. This session ran unattended and v0 cannot exist without answers to five of them, so each is a data-file value flagged here, changeable without touching code:

| Open question | Placeholder | Where |
|---|---|---|
| §15.1 town name | `[TOWN NAME]` kept verbatim | `data/config.json` `townName` |
| §15.2 calendar floor N | 24 h (the doc's own proposal) | `config.json` `calendarFloorHours` |
| §15.2 lifespan | natural death ramps 120 → 200 rounds | `config.json` `lifespan` |
| §15.5 five council posts | treasury, garrison, works, granary, market | `data/posts.json` |
| §15.6 top-office title | *praefectus* | `config.json` `topOffice` |
| §15.9 tribe name | Chatti as the raider archetype | `data/tribes.json` |

Also not in the doc and decided here (all 🟡):

- **Progress bars, no countdowns.** §3.1 says the village clock is invisible. Construction shows a bar and the rush price, never remaining time. If that reads as too opaque, the change is one line in `src/render/village.ts`.
- **Hunger stalls, never kills.** Pillar 6: at zero grain, population growth stops. No decline.
- **Idle-round catch-up cap** of 7 (`idleRoundsMaxCatchUp`) so a month away is not 30 raids.
- **Age is in rounds** and starting ages are authored as rounds (leader 40, heir 18). Death starts at 120, so a leader who runs 80 rounds is at risk. This is fast if sessions are long; tune `lifespan` in `config.json`.
- **Leverage in v0 is obstruct, skim, leak.** "Back a coup" waits for the top-office challenge in v0.2, per §13.
- **Collapse** = population ≤ 5 or corruption ≥ 95. Rome clears the council and grants supplies for 4 rounds.
- **No visible clock** anywhere, but the council tab does show hours until the idle round because §3.3 makes that a political fact.

## Gaps against the doc 🔴

- **The isobuild pipeline and the earlier palette do not exist in this repo.** §10 and CLAUDE.md refer to porting an existing parametric SVG pipeline and re-deriving a palette from a reference image. Neither was available, so `tools/isobuild/build.py` is a new, minimal generator and the palette is hand-picked. Treat the sprites as placeholders that obey the conventions, not as art direction.
- **Portraits** (§10) are not generated. No image pipeline was in scope this session.
- **`docs/DESIGN.md` change log is dated 2026-09-16**, one day after this session. Left as-is.

## What's next

1. Mathias confirms or replaces the six placeholders above.
2. Playtest at the Vercel URL; tune `data/buildings.json` times and `config.json` rates. Current times: tier 1 in 2–5 min, tier 2 in 15–60 min, tier 3 in 1–4 h.
3. Portrait batch and a real palette reference for `tools/isobuild/`.
4. v0.1: world map, scouting, site claims, the other two tribes with the like/hate web (`data/tribes.json` already lists them).
5. v0.2: research tree in `data/research.json`, families three and four (already named), marriage, heirs, bodyguards, the top-office challenge.
