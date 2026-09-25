# Session capsule — 2026-09-25

Two top-priority prod bugs, one branch, PR #13 (CI green, waiting on
Mathias). #11 and #12 closed: #12's commit is inside #13, and #11's away
card has nothing left to report.

## What changed

- **No round runs unattended** (DESIGN §3.3 reversed by Mathias). A new
  `?dev=1` save reached round 4 untouched. Cause: the village tick ran
  the calendar floor's idle round, and the dev clock scales that time,
  so 600× gives 24 virtual hours per 144 real seconds. Reproduced on
  `main`'s build: round 1 and the leader aged by t=160 s. Removed from
  config, code, state, UI and DESIGN (the full list is in #13).
  `Game.act` is the only caller of `runRound`. Fixed build: 200 s at
  600× stays at round 0.
- **The tick no longer redraws what the player uses.** It rewrote the
  header every second and the panel whenever its key moved. That
  replaced hovered elements, their tooltips and the scrolled section,
  which snapped back to the top. Reproduced headed at 1920×1080 under
  Xvfb with a real pointer and wheel. `render/patch.ts` now patches in
  place. After: 0 rewrites, no snaps, and figures still move on the
  same node.

## Verified

- ✅ 427 tests, build, and CI green on #13.
- ✅ Headed Chromium under Xvfb and headless Chromium, before and after,
  on the builds of `main` and #13.
- ✅ Mutation checks on the tooltip test and the cap-free absence tests.

## Open for Mathias

- 🟡 **The exploit §3.3 closed is open again.** A player who never
  convenes never ages, is never raided and never faces a challenge,
  while the colony keeps producing. Accepted by the ruling; worth
  watching in playtest.
- 🟡 **§2 and CLAUDE.md have no "absence pillar"** yet. The rule lives
  in §3.3. Adding it as pillar 11 is Mathias's call.
- 🟡 **The return strip reappears on reload.** "Since you were last
  here" is computed from the gap at each load, so reloading a minute
  after dismissing it can show "+1 wood". A zero threshold was the
  2026-09-23 default; a minimum gap would be a new number in data.
