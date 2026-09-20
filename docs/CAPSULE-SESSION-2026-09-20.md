# Session capsule — 2026-09-20

Branch `claude/colony-depth`, continuing from `CAPSULE-SESSION-2026-09-19b.md`.
This session finished the political half of the vision and then the last
unblocked item on the v0.2 list: the top office can be lost and won back, the
whole intrigue menu of DESIGN §9.6 is playable, and the Library researches.

## What changed

### The top office (DESIGN §9.5) — `src/politics/challenge.ts`, council tab

- A rival calls a challenge when two things are true at once: it has soured on
  you (`challenge.callerAttitudeCeiling`) **and** a simulated count says it would
  carry the council. The trigger counts votes rather than comparing gravitas,
  because gravitas is dominated by whoever already holds the office — which is
  why no challenge ever fired before this fix.
- Every living, unexiled member of every house casts one vote. Houses with no
  standing put nobody up and become the swing vote: they prefer you to another
  rival unless they have come to loathe you. A tie leaves the office where it is.
- **The council card shows the count as it stands**, updated every round, with
  the verdict spelled out. The round before the vote is the campaign: grant a
  demand, hand out a post, pay for regard.
- Out of power, appointments, dismissals and claims are closed (`requireOffice`)
  and the panel disables them rather than throwing. Everything else — the houses,
  the tribes, Rome, intrigue — stays open. Pillar 7 holds: losing is a setback.
- The player calls a vote back at 150 denarii and gravitas rank 2.

### Intrigue and bodyguards (DESIGN §9.6) — `src/politics/intrigue.ts`, Houses tab

- Expose, denounce to Rome, marry (a house or a tribe), exile and assassinate
  are wired to actions and to a per-house menu that carries every cost, gate and
  consequence in the button's own line. Promote and demote are the appointment
  and dismissal of §9.3, not separate moves.
- Assassination shows the real odds per target, including the target's guards.
  Bodyguards come off the same militia pool as the walls and the far holdings,
  so guarding your heir thins the ditch — `guards 2/4` with +/− on your own kin.
- Arranging your own household runs **no** political round; every move against
  another house does (DESIGN §3.2).

### Bugs found and fixed

- **A player-called challenge resolved in the same round it was called.**
  `runRound` increments the round before `resolveChallenge`, so `voteRound =
  round + 1` was already due. The player got none of the round §9.5 promises
  them. `callChallenge` now takes the round the council hears the call in.
- **`appease` reached the store without its tribe id.** The catch-all
  `data-political` branch in `bindPanel` matched first, so paying off a massing
  tribe threw instead of paying. Every id-carrying action is now matched ahead
  of the catch-all, with a comment saying why the order matters.
- **The intrigue menu slammed shut on every panel rebuild**, i.e. every round.
  Open menus are remembered across rebuilds.

### Balance guards re-derived

`tests/balance.test.ts` had two guards written against one tribe and no
challenge mechanic. Measured over 12 seeds × 40 rounds:

| policy | raids/colony | repelled | lost the office |
|---|---|---|---|
| idle | 11.8 | 3% | 12/12 |
| walls only | 11.2 | 42% | 12/12 |
| politics only | 9.6 | 16% | 0/12 |
| both | 8.8 | 89% | 0/12 |

That is the shape the game should have: **walls are the lever, holding the
office is the multiplier**, because a colony out of power is obstructed by its
rivals. The guards now assert against a colony that does both, and the
walls-only arm is held to the margin over idle rather than an absolute bar.

## Verified

- 202 tests pass, `tsc --noEmit` clean, `npm run build` clean.
- Headless Chromium against the built app, with saves injected per context:
  challenge card renders with a two-row tally and the correct verdict; three
  intrigue menus with target, marriage and guard controls; guards move without
  a round; exposing a house runs one; out of office all five appointment
  buttons are disabled and the call-a-challenge button is live; calling it
  leaves a challenge standing with the vote still ahead. **No page errors.**
- Bodyguards measurably work: the same target reads 63% bare and 12% behind
  three guards.
- The Library likewise, in the browser: the sprite stands on `i8`, the tab
  lists all eleven nodes with four takeable at a Library II, taking one up runs
  no round, the rush button finishes it, and it appears under *Known*. No page
  errors. The nine tabs fit one row of the 380px panel at 12px with 2px to
  spare, measured rather than eyeballed.
- Research effects were checked against the systems they claim: build time,
  grain, materials, defence and population cap all move when the tree is
  completed, and a building effect and a research effect of the same name add
  up rather than one shadowing the other.

### Research and the Library (DESIGN §4.6) — `src/village/research.ts`, Library tab

- **The Library** is a new inner-ring building in three tiers, drawn for
  `tools/artgen/draw.py` in the house style: a plastered reading hall on a
  stone podium at tier 1, a copyists' storey and a second rack of pigeonholes
  at tier 2, and at tier 3 a two-storey travertine hall with an apse, a
  colonnade on two sides, Minerva in the forecourt and a cart at the gate.
  Three new drawing primitives came with it: `scroll_rack`, `lectern`, `apse`
  and `sundial`. 42/42 building tiers now have art.
- **An eighth inner plot** (`i8`) was added to `data/layout.json` to stand it
  on. It sits in the inner ring's widest gap, due north, 58px from its nearest
  neighbour — exactly the ring's existing tightest spacing, which a new test
  now guards. Old saves gain the plot as empty ground rather than losing theirs.
- **A study** costs denarii and scrolls, needs a Library of its own rank and
  whatever it stands on, runs on the village clock (real time, no political
  round) and can be finished early at the Pillar 3 price. One at a time.
- **Effects** share one vocabulary with buildings: `sumEffect` folds research in,
  so everything that already read a building effect picks research up unchanged.
  The three that are not summed that way — build speed, the yield multipliers
  and defence — are wired explicitly.
- **Nothing is lost.** A test drives a colony through a save round-trip and then
  a full collapse with Rome administering, and asserts the research is still
  there (Pillar 7).

## What is next

Everything on the v0.2 list that does not need Mathias's hands is done. What
remains is the playtest, and the four questions below.

## Open for Mathias

- 🟡 **The research tree is mine, not yours.** §15.11 was ❓, so under CLAUDE.md's
  unattended rule the eleven nodes in `data/research.json` are a data-file
  default and nothing more. Three ranks, one per Library tier:
  | rank | nodes |
  |---|---|
  | I | the surveyor's groma (build 6% faster) · two-field rotation (+12% grain) · charcoal burning (+10% materials) |
  | II | opus caementicium (build 9% faster) · raised granaries (+180 grain kept, +6% grain) · the tapped bloomery (+13% materials) · the double ledger (+10% tax, corruption falls 0.4 a round) |
  | III | torsion engines (+16 defence) · the colonial census (+14 population, +2 militia) · via munita (+0.15 trade rate, +10% from Rome) · the archives (+2 gravitas a round, +40 hidden per resource) |
  The whole tree is about 18 hours of real time at a Library III, roughly 26
  without one. Ratify, reprice or replace it — the code reads the file.
- 🟡 **Bodyguard allocation runs no round.** It is household business, not a
  move against another actor, so §3.2 says no round. The cost is real (a guard
  is a man off the walls), but it means guards can be shuffled freely between
  rounds while site garrisons cannot. Say the word and it becomes a round.
- ❓ **§15.7 (rounds from birth to adulthood)** still blocks heirs by birth, so
  a marriage currently binds two houses and produces nobody. Nothing was
  invented in code for it.
- ❓ §15.8 (one temple or one per god), §15.3 (flavour calendar), §15.4 (final
  resource list) remain yours.
- 🟡 §15.10 map size is still the data-file default (radius 12, 25 across) and
  wants ratifying.
