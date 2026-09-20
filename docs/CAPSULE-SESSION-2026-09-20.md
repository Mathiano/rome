# Session capsule — 2026-09-20

Branch `claude/colony-depth`, continuing from `CAPSULE-SESSION-2026-09-19b.md`.
This session finished the political half of the vision: the top office can now
be lost and won back, and the whole intrigue menu of DESIGN §9.6 is playable.

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

- 184 tests pass, `tsc --noEmit` clean, `npm run build` clean.
- Headless Chromium against the built app, with saves injected per context:
  challenge card renders with a two-row tally and the correct verdict; three
  intrigue menus with target, marriage and guard controls; guards move without
  a round; exposing a house runs one; out of office all five appointment
  buttons are disabled and the call-a-challenge button is live; calling it
  leaves a challenge standing with the vote still ahead. **No page errors.**
- Bodyguards measurably work: the same target reads 63% bare and 12% behind
  three guards.

## What is next

- **Task 16, the research system and the Library** is the last item on the
  v0.2 kickoff list that is not blocked on playtesting. It needs a Library
  sprite, an eighth inner layout slot, and a first-pass tree in
  `data/research.json`.
- Then: playtest. Everything else on the list wants Mathias's hands on it.

## Open for Mathias

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
