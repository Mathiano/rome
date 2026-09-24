# Session capsule — 2026-09-24

A short morning after the Tribal Wars patch (PR #8, capsule of 21–23
September on that branch). Mathias ruled on the patch's open items and
set three process rules. Two branches carry the rulings; neither is on
`main` yet.

## Rulings

- **A declined Rome request costs no favour** (§6, "no punishment"). The
  code had taken 5; `declineFavour` is gone from `data/config.json`. The
  loyalist house's regard still falls, and the report names the aid
  forgone and the house by name.
- **No time estimates, anywhere, ever** (§3.1). The game never projects
  when a cost is met, a store fills or a target is reached. Horizon
  times are refused, not banked.
- **No counsel beyond the opening, for now** — banked in §14.
- **Rome's first letter waits at the founding** — built. The one act by
  another actor outside a round (§3.2, §6).
- **Milestones** — banked in §14.

## Process (now in CLAUDE.md)

- Branch off `main`; stack a branch on another only when it depends on it.
- At most two pull requests open at once.
- Session capsules go straight to `main` (this one is the first).

## Branches, not yet pull requests

| Branch | What | Tests |
|---|---|---|
| `claude/rome-decline-forgone` | the decline ruling; §3.1, §6, §14 and CLAUDE.md | 396 |
| `claude/rome-writes-at-founding` | the founding letter; §3.2, §6 | 399 |

Both are stacked on `claude/tribal-wars-patch`, because the declined
card and the badges they touch live there. Their pull requests wait
until #8 merges, so the two-PR limit holds; #3–#7 close with #8. The
two branches meet on the DESIGN change log (v0.2.14 and v0.2.15); the
second to merge needs `main` merged in, keeping both lines in order.

## Verified

- ✅ `tsc`, `vitest` and `vite build` on each branch, and 400 tests with
  both combined.
- ✅ Headless Chromium on both combined: the founding card carries
  "Rome asks: Survey the road"; Rome and Reports badge from the start;
  declining from the Rome tab leaves favour at 20, drops the Cornelii's
  regard by 8, and the round card reads "You forgo 60 denarii" with no
  favour row. No page errors.

## Open for Mathias

- 🟡 **A job's own length before it starts** (the plot card, the
  overview, the Library) is read as the job's time, not an estimate, so
  it stays under the new §3.1 rule. Overrule if you meant those too.
- 🟡 **§6 says "standing", the code means regard.** Declining lowers the
  loyalist house's attitude toward you; "standing" in the code is a
  house's summed gravitas, which does not move. The card says "regard".
- 🟡 **Rome's first letter asks for 80 wood**, out of 120 at the
  founding — the same 80 the counsel's castellum step wants. Balance is
  yours; nothing was changed.
- 🟡 **A quiet first convene raises no round card.** A round whose only
  line is "Round N." has never raised one; round 1 always used to carry
  Rome's letter, so this was never seen. The round is still in Reports.
- The rest of #8's 🟡 list stands as written in its description.

## Next: art

Mathias is generating the tier-1 stills into `assets/src/` on a branch.
`tools/artgen/build.py` reads `assets/src/<name>.jpg`: one structure on
white, on a 2:1 ground-plate diamond, named as the manifest does
(`iron-mine-t1.jpg`, `clay-works-t1.jpg`). Fourteen buildings take a
sprite (the wall is drawn in code) and `lumber-camp-t1.jpg` is already
there, so **thirteen** tier-1 stills remain, not twelve — worth saying
which one waits, if one does.

## Second rulings, later the same morning

- **A job's own length before it starts stays** ✅ — a property of the job
  and an input to the decision to build. §3.1 marked settled.
- **"Time left" on a job under way: queried, not changed.** Mathias asked
  for the number to go and the progress bar to stay, reading §3.1 as
  "progress and rush price, no countdowns". That is the text his own
  2026-09-20 amendment replaced after the playtest ("you should be able
  to see the minutes remaining here"); §3.1 today says a job shows its
  progress, *the time left in rounded words*, and the rush price.
  **Settled: time left stays** ✅ — Mathias, "my mistake on §3.1".
- **§6 says regard, not standing** ✅ — §9.1 defines standing as summed
  gravitas; declining moves attitude. Fixed on `claude/rome-decline-forgone`.
- **The wood clash stays** ✅ — the first letter's 80 wood against the
  castellum's is an opening decision, and declining is free, so it cannot
  soft-lock. Recorded in §6 so it is not tuned away. Watch in playtest.
- **A quiet convene answers** ✅ — built on `claude/rome-writes-at-founding`:
  a round the player calls that brings no news raises a short card, "The
  council met, and nothing was decided." (text in `data/config.json`
  `quietRound`), with Before you go and no ledger. Idle rounds while away
  stay silent. Tests 403; checked in Chromium.
- **The fourteenth sprite is the Library.** The §4.4 table has thirteen
  buildings beside the wall; the Library is listed under it, built
  2026-09-20 (v0.2.0, §4.6), and already has three drawn tiers. So v0's
  thirteen minus the painted lumber camp is the twelve Mathias counted,
  and the Library makes it thirteen stills. Not v0.2 arriving early: it
  arrived on 20 September.

| Branch | Head | Tests |
|---|---|---|
| `claude/rome-decline-forgone` | decline, §3.1, §6 regard, §14, CLAUDE.md | 396 |
| `claude/rome-writes-at-founding` | founding letter, quiet card, wood clash kept | 403 |

## Landed

All of it is on `main`: #8 (the patch, which closed #3–#7 with it),
#9 (the rulings) and #10 (the founding letter and the quiet card), each
merged with CI green. 404 tests on `main`.

## Next

Art. Thirteen tier-1 stills into `assets/src/` on a branch — the twelve
v0 buildings still unpainted, plus the Library — named as the manifest
does (`iron-mine-t1.jpg`), one structure on white on a 2:1 plate.

## Evening: coming back after days away (PR #11)

Mathias returned to prod after several days and saw a stack of round
cards. Reproduced 4 out of 4 times in Chromium:

- **The pile:** an event choice fired during the idle rounds, and
  `pendingNews` checked for a choice before an absence. A "Round 8" card
  carrying every line of the absence came first. Then the digest, with
  seven expanded rounds, each with its own ledger.
- **Fixed:** the absence comes first, on one summary card. It holds the
  tally, one ledger across the absence, and the rounds' lines as one
  list, with any choice asked on it. Each round stays under Reports.
- **The cap had held.** Round 8 was a round-1 save plus 7 idle rounds.
  It is now tested for a week, 10 days and a month away. A week at a
  24-hour floor is exactly 7, so only the longer gaps can catch a
  missing cap. Mutation-checked.
- ✅ 408 tests, CI green on #11, Chromium: one card, choice in place,
  scrolls, real click reaches Continue. Waiting on Mathias to merge.
