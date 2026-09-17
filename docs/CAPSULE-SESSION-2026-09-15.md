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

> **Confirmed by Mathias later the same day** except the town name, which stays open. All of it now lives in `docs/DESIGN.md` as ✅; this section is kept as the log of what was proposed. `Iulii` was renamed `Valerii` on his instruction.

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

---

## Addendum — 2026-09-16

- **Town named Arctown.** `data/config.json` `townName`; DESIGN §15.1 closed. Nothing else in the doc used the placeholder except the title.
- **CI.** `.github/workflows/ci.yml` runs `npm ci`, `npm test`, `npm run build` on every pull request and on push to `main`. Node 22.
- **Dev-only time control** (`src/dev.ts`, wired in `src/main.ts`). Active only with `?dev=1` in the URL.
  - The game clock becomes a virtual clock: real time × a multiplier (1, 10, 60, 600) plus skips of 1 h, 6 h, 24 h and 7 days. At 600× the 24 h calendar floor passes in 2.4 minutes, so multi-day politics fit in one sitting.
  - Dev mode plays in its own save slot (`rome.save.dev.v1`). The real colony (`rome.save.v1`) is never read or written with the flag on. This is why the multiplier can be honest about "never persisted into the save": a warped clock leaves future-dated timestamps behind, so the only clean guarantee is a separate slot.
  - Multiplier and virtual offset persist under `rome.dev.clock` so a reload in dev mode continues where it was. That key is not part of any save.
  - Without the flag there is no dev bar, no dev code path runs, and the save format has no dev fields (tested).
- **Verified** ✅ 90 tests. Headless Chromium: no dev bar on the normal URL; with `?dev=1` a 24 h skip runs the idle round and fills the stores; the 600× multiplier is covered by the unit test, not the browser run; the real save slot is byte-identical before and after; returning to the normal URL shows the unwarped colony.

---

## Addendum — 2026-09-17, real art through the pipeline and the loop tool

Inputs landed on the branch by upload: `assets/style/PROMPTS.md`, `assets/style/anchor-v1.jpg`, `assets/src/lumber-camp-t1.jpg`, `assets/src/lumber-camp-t3-trees.mp4`.

### artgen on real art ✅

| Input | Result |
|---|---|
| `lumber-camp-t1.jpg` | passes: slopes +0.513 / −0.528, sprite 262×177 px, anchor (130.6, 107.2). In the village. |
| `anchor-v1.jpg` | failed first: it sits on a painted grey checkerboard (140 / 195), not white. The keyer now also keys the neutral-grey band between the two dominant border greys and despeckles, so it passes: slopes +0.528 / −0.528. Output in `assets/style/`, not in the buildings manifest. |

`build.py` entries now record `trimOffset` and `sourceScale` so overlays can be mapped from source pixels into sprite space. Older entries without them are rejected by `loop.py` with a message to regenerate.

### `tools/artgen/loop.py` ✅ (spec from Mathias, 2026-09-17)

Frames via ffmpeg at 12 fps (system ffmpeg, else `imageio-ffmpeg`'s static build; the Playwright ffmpeg in this sandbox has no H.264 decoder). Best loop window over N = 12..18 by mean absolute grey difference, top three printed. Envelope of the window frames against the still registered into frame space (plate corners; correlation-search fallback; `--identity` when the still is a frame). Moving pixel = envelope > 40 (max channel) **and** at least 40% of its 9×9 neighbourhood also moves, so codec flicker on every outline does not count; without that filter the real clip measured 73% of the frame and would fail. Bounding box printed as % of frame area; `LoopError` above 40%. Crop + pad, border-connected keying, horizontal sheet ≤ 16 frames ≤ 256 px tall, manifest entry `{type:"loop", x, y, width, height, frames, fps, frameWidth, frameHeight, file, licence, source, window, movingArea}` positioned relative to the plate anchor in sprite pixels. `--selftest` covers the exact-period case, the position maths, the whole-frame re-render rejection and the identity path; CI runs it.

### The real clip 🟡

- **Loop:** best window start 49, N 12, score 1.88 (top three: 49/12, 49/13, 48/15).
- **Moving region:** trees and crane, x 734–1151, y 1–428 = **19.3%** of the frame. Passes.
- **Sheet:** `assets/overlays/lumber-camp-t3-trees.png`, 12 frames of 254×256 at 12 fps, 1.4 MB. Licence field as instructed.
- 🔴 **The clip is not an animation of a still we have.** It shows a tier-3 lumber camp (chimney, crane, three pines) and the only still in the repo is tier 1, a different building. There is no `lumber-camp-t3.jpg`. I ran the tool with the clip's own first frame as the still (`--identity`) and a manual anchor (`--anchor 634,445`, the plate's left-corner height and bottom-corner x). The overlay is therefore in a **standalone** `assets/overlays/manifest.json`, not attached to a sprite, and it does not render in the village. That is the honest state, not a bug.
- 🔴 **The t3 render will fail artgen as drawn.** The pines overhang the plate on the right, so the rightmost opaque pixel is a tree and the plate test fails (measured right slope −0.92 on the frame). Per PROMPTS.md, one structure on one plate: the trees need to stand inside the plate. Re-prompt before generating `lumber-camp-t3.jpg`.
- 🟡 The clip also has a low-amplitude wobble on every edge. The density filter hides it for detection, but the cropped sheet still carries static shed and log-pile pixels that will shimmer over the sprite. Acceptable for a PoC; a cleaner clip fixes it.

### Renderer ✅

`place()` resolves `overlays` on a sprite entry into scene units; `loopOverlay()` draws a nested `<svg>` clipped to one frame with the sheet stepping left via `steps(frames)`. Unit-tested with a synthetic entry; not yet seen with real art because no sprite carries an overlay.

### Verified ✅

56 tests; `npm run build`; both self-tests; headless render of the village with the real lumber camp sprite on its tile (screenshot sent).
