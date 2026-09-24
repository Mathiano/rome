# Session capsule — 2026-09-21 to 23

Three days, one session. It began on `main` and ended with a process change:
everything from 22 Sep 14:00 onward went through a branch and a pull request,
with CI green before Mathias merges. Six commits landed on `main` before that
rule; four pull requests were open when this capsule was written. **Nothing in
the pull-request half is on `main` yet** — see the table at the end before
reading any of it as shipped.

## What the playtest said

Mathias played the production build and filed a second round of notes in the
[playtest log](https://claude.ai/artifact/1z9K1zBTY7zkh1JZjr5kwo). The gameplay
verdict was that the slow opening is fine — hours of production going nowhere
until you build your way up is the point — but that the colony did not look
like one: the buildings were "Temu", the lumber camp had one tree, and the
references were Travian and Tribal Wars. That set the order of work: fix the
things that made playtesting tedious, then put the colony on painted ground and
see whether polygon buildings survive on it, then decide what art comes next.

## What changed on `main` (six commits, `062d53c` → `7c7f081`)

### Time left, in words (DESIGN §3.1 amended)

A job under way now says how long is left — "about 40 minutes left", on the
plot card, on the plot's own label, and on a study in the library. §3.1 had
forbidden any countdown since 15 Sep; the playtest overturned it, and the doc
records that rather than pretending it never stood. The intent survives: time
is stated once, rounded to what a player can act on, never ticked down.

### Five UI faults from one screenshot

The tab bar wrapped on a tablet (three ragged rows; now a fixed 5+4 grid), the
founding card re-popped on every build (any unread log line raised the overlay;
now only non-village lines do, and the opening is remembered as seen), the forum
read as a mud pit (three translucent road underlays compounding; painted once,
opaquely), hover took up to a second to answer (it was on the village tick; now
immediate), and the Village panel's intrigue menus slammed shut on every rebuild.

### Painted ground (DESIGN §10)

The country is one painted image, `assets/src/base-map-v1.jpg`, generated from a
brief in `assets/style/PROMPTS.md` and fitted so the wall lands on its clearing.
`src/render/environment.ts` draws only the roads, the square and the wall on
top of it; the drawn floor, grass, river, wood, fields and rocks are gone. The
fit was measured against the painting — my colour threshold caught the ploughed
fields, Mathias's figure was the flat inner area, and drawing the wall ellipse
back onto the source settled it.

**The experiment's verdict:** polygon buildings survive painted ground better
than expected. What looked wrong afterwards was the drawn wall, not the
sprites. That reordered the art queue.

### The wall has depth, and it is lit

The wall used to be one ring painted behind every plot, so a building on the
south edge was drawn through it. On this projection the ring's depth runs from
−8.7 due north to +8.7 due south and the plots' from −7 to +7, so they
interleave. `createWall` now emits 24 arcs, the towers and the gate as
`ScenePiece`s and the village merges them into the same depth sort as the
buildings — SVG paints in document order, so append order is the whole fix.

Each arc takes its own tone from its facing against the top-left light:
`wallLight(t) = −(0.448 cos t + 0.894 sin t)`, derived from the world normal
dotted with the tile-space vector that projects to screen (−1, −1). Stone
courses at II–III, palisade posts with a shadow side at I, and the finished
circuit flies a standard over the gate, waved by the same keyframes the sprite
overlays use so there is one flag in the game and not two.

### The wall is a building — a reversal recorded honestly (DESIGN §4.4)

On 22 Sep I read "garrison and walls" in the castellum's role and made the
circuit the castellum's tier, then recorded that as a ✅ rule. Mathias reversed
it the same day: **the wall is not the castellum; they are two buildings.**
`7c7f081` adds `wall` to `data/buildings.json` on a perimeter slot `w1` that
belongs to no ring and sits at the gate (grid x = y = 4.36, so its depth is a
whisker in front of the gate piece and its hit area paints over it). It counts
as a building for construction concurrency, and its tier is the *walls* term of
§8.2 — carried as a `defence` effect like every other building, so
`raid.wallStrengthPerCastellumTier` is gone. The castellum keeps the garrison,
the militia pool and the bodyguards; its tier drives only its own sprite.

Both the rule and its reversal are in the change log (v0.2.4, v0.2.5). A
reader of the doc should be able to see that the wrong reading existed for a
day and why it was wrong.

The balance guards were re-measured: walls-alone fell from 42% → 34% repelled
and both-arms 89% → 86%, because the circuit and the castellum now compete for
the one-building-at-a-time slot. The comments in `tests/balance.test.ts` carry
the new numbers rather than loosened thresholds.

## What is in the four open pull requests

| PR | branch | what | new tests |
|---|---|---|---|
| [#3](https://github.com/Mathiano/rome/pull/3) | `claude/tender-faraday-68c706` | the gate marker draws nothing at rest and lights on hover; the Village panel opens on an index of everything pinned to a slot, each entry selecting it; a regression test for the save migration that had dropped `fixedBuilding` | 5 |
| [#4](https://github.com/Mathiano/rome/pull/4) | `claude/heirs-by-adoption` | **heirs by adoption (§9.2)**, both routes — see below | 18 |
| [#5](https://github.com/Mathiano/rome/pull/5) | `claude/death-on-the-wall` | **death by raid (§9.2)**: the garrison prefect can fall when a raid gets through | 6 |
| [#6](https://github.com/Mathiano/rome/pull/6) | `claude/secession` | **secession (§9.7)**: a slighted, hostile house out of office leaves the colony and comes home once courted or by a hard limit | 12 |

#3 also carries a commit of Mathias's from 17 Sep (`Add files via upload`, two
reference images in `docs/`) that was sitting unmerged on the same branch. It
was rebased forward rather than discarded; whether those images belong on
`main` is his call, and the PR says so.

### Adoption (#4)

§9.2 lists three routes to an heir. Birth waits on §15.7 (rounds to adulthood),
which is Mathias's to answer. The 20 Sep session parked adoption behind the
same question, but an adopted *adult* needs no such number, and §9.2 marks it ✅
as Roman practice.

- **A new man** — veteran, freedman or tribal noble — raised into the house for
  denarii, priced by household size (`150 × (1 + 0.25 × living)`) because a
  house is its voting weight (§9.5). Nobody else is party to it, so it runs no
  round (§3.2), the footing bodyguards stand on.
- **From another house** — that house consents only above attitude 30 and only
  if it keeps at least two; never its head, never a daughter. He keeps his post
  and his marriage; his vote and standing move; they warm +12. It runs a round.
  He takes the name Rome would have recorded: *Publius Cornelius Rufus the
  Younger* → *Publius Aurelius Rufus the Younger Cornelianus*.
- Rival houses adopt new men below three living, on the same rule.

### Death by raid (#5)

A raid that reaches the stores has crossed the wall, and the garrison prefect
was on it: `0.08 × (1 − 0.06 × discipline)`. Guards do not help — they stand
over a man in his house, not on the rampart. A repelled raid never kills.

### Secession (#6)

Grievances ≥ 4 **and** attitude ≤ −40 for three consecutive rounds, never while
in office, and the house says so the round before. It leaves: posts vacant,
votes gone, a tenth of the citizens with it, Rome's favour −8. Away, its
attitude is frozen but a bribe still reaches it. It hears terms after six
rounds if attitude ≥ −20, and comes home regardless by twelve (Pillar 7). On
return its grievances are forgotten.

Structurally: `livingMembers` now means *alive and here*; `aliveMembers` is the
wider set and succession runs on it, so a head who dies abroad is followed by
one of those who left, not by a new man raised into an absent house.

### Merging them

Each PR appends its own line to the DESIGN change log at the same anchor, so
**the second merge onwards will conflict there**, and #4 and #6 both touch
`characters.ts`, `panel.ts` and `types.ts`. The conflicts are mechanical; the
log runs oldest to newest, and the version numbers (v0.2.6 → v0.2.9) are
already assigned in merge order #3, #4, #5, #6. I resolve each as the previous
lands.

## Verified

- `main`: 224 tests, `tsc --noEmit` clean, build clean.
- Each PR green on its own head at time of writing: 229, 242, 230 and 236
  tests respectively. All four were also driven through the real panel in
  headless Chromium — the gate lights on hover and reads `Wall`; both adoptions
  went through with the right costs, round counts and the renamed man on the
  roster; the Cornelii warned, left on the next convene (population 20 → 18,
  favour −8), and had only *Bribe* left in their menu.
- The migration test in #3 was checked against the bug it guards by reverting
  the fix: two of three assertions fail.
- The wall's lighting is asserted, not eyeballed: NW arcs > 0.9, SE < −0.9,
  opposite points sum to zero.

## Open for Mathias

- 🟡 **Rivals adopt only new men**, never from each other or from you. The
  rules are otherwise identical (§9.1). Bless or reject.
- 🟡 **A house in office never secedes.** The alternative invents where the
  office goes; I'd rather not.
- 🟡 **The 12-round hard return limit** exists for Pillar 7. One number, set
  high, if a house should be able to stay out until courted.
- 🟡 **The tier-0 gate marker** is now invisible at rest. If a first-time
  player can't find the wall, the colony index in the Village panel is the
  answer #3 gives; a painted gateway asset would be the better one.
- 🟡 **The art queue**, in order: the wall reads worse than the sprites on
  painted ground, so a heavier drawn pass on the wall came first (done); the
  sprites themselves next, which parks on the licensing question from the Veo
  session.
- **Untouched and unchanged:** §15.7 heirs by birth, §15.8 temples, §15.3
  calendar, §15.4 resource list, §15.10 map size, §15.11 the research tree
  (🟡 first pass still awaiting ratification), whether bodyguards should cost a
  round, an advisor for "what next". 23 of the 31 playtest items are unjudged,
  the whole political half among them.

## Process

- I pushed `7c7f081` straight to `main` across five modules. Mathias's
  correction: every session on a fresh branch, PR, CI green, he merges, with
  branch protection to enforce it. Everything after that message followed it.
- Two design corrections in one day, both mine to absorb: §14 banks a fifth
  *family*, not buildings (the reason a wall building needed sign-off is that
  the §4.4 list is ✅ confirmed); and the wall is not the castellum. The doc
  records both.
- The base-map brief, the artifact log and the playtest list are the pattern
  that worked: Mathias plays, writes verdicts, I act on the verdicts and not on
  my own theory of what's wrong.

---

## Addendum, 23 Sep evening — the Tribal Wars patch

One integration branch, `claude/tribal-wars-patch`: `main` + PRs #3–#7 merged,
then four units built in isolated worktrees by a design panel → implementers →
adversarial reviewers workflow, merged by hand. Mathias's brief: *"base it more
like Tribal Wars for this patch"*, read as the **shape** of a Tribal Wars town
(headquarters overview, quest line, reports inbox, a due list, a growing-town
feel) and none of its mechanics — troops, attacking and countdowns collide with
Pillar 5, §8.3, §14 and §3.1 as amended. 395 tests, up from 265 on the base.

### What changed

| Unit | DESIGN | What |
|---|---|---|
| Effect vocabulary | v0.2.10 | `data/effects.json`: noun, unit and percent flag for every effect key in buildings and research; a data test keeps it complete and unused-free. |
| Headquarters overview | v0.2.10 | `src/render/overview.ts`. The Village tab opens on the colony: the two lanes, every building grouped centre → inner → outer → perimeter with tier, now → next effect, cost, time in words and either the action or every gate it fails; unplaced buildings with a plot link; open plots by site; a ledger per resource that sums to the header. `BuildCheck` gained `reasons`, `gates`, `short`. |
| The opening counsel | v0.2.11 | `data/advisor.json`, `src/render/advisor.ts`. Five steps (iron seam → castellum → scouts → curator of works → Rome has written) read off the colony, one card between the tabs and the tab body on every tab, "Show me" selects the plot, hex or tab, "Enough counsel" puts it away per save. The founding card's prose is data. The round report ends on "Before you go". |
| Reports archive | v0.2.12 | `src/state/reports.ts`, `src/render/reports.ts`. A `Report` record beside its log line for every raid, site raid, scout, envoy, vote and letter from Rome; `defenceBreakdown()` whose parts sum to `defenceStrength()` (tested, with research and obstruction); each round's before → after ledger in `state.history`. The Log tab is labelled Reports (id `log` unchanged): rounds newest first as folds, seven kind filters, the raw lines inside each round, an unread count on the tab. Rome's +5 favour / +3 loyalist regard moved from code to `config.rome`. |
| Town and loop | v0.2.13 | `src/render/due.ts`, `src/village/away.ts`, `src/render/summary.ts`. A Due block at the top of the Village tab from one collector the report footer shares; the colony summary card (counts, never a score); the header's muted line gains wall, plots and holdings; a return strip of what the village clock changed, amounts only; `overflowSinceSeen` counted in `accrue()` and told as waste on the strip and the round card; duty-only tab badges lifted into `tabBadge()`. |

### Decisions taken at the merge, mine, reversible

- **No pulse on the counsel's plot** (`691b074`). The design pass excluded it; the plot wears the selected look, still.
- **Continue on the founding card lands on the overview, not on the plot card** (`d4875c2`). The advisor unit's landing predated the overview and hid it at first sight.
- **A rising tier-0 plot shows no tier and no zero yield** on its row (`e88114c`).
- **Village block order is counsel → return strip → Due → summary → lanes → overview.** The contract said strip → counsel → Due; the counsel card sits above every tab's body (Mathias: keep it on every tab), so the strip goes under it.
- **The Reports tab's folders and filter reset with the colony** (`d9f73a3`), the one unfixed review finding that was a bug.
- Both units track `<details data-menu>` state: the panel's `openMenus` and the reports module's own map. Harmless duplication, kept because reports.ts must not import panel.ts.

### Verified

- ✅ `tsc --noEmit`, 395 tests, `vite build`, at `0b4c737`.
- ✅ Headless Chromium on the built app, no page errors: the founding card; the overview with lanes, rings and ledger; the counsel card advancing iron seam → castellum and its plot marked; the plot card and its way back; "Enough counsel" clearing the mark on every tab; a convened round's "Before you go"; the Due block with a job and a massing tribe; the summary card and the header line; the raid card's four terms summing to Defence with no roll and no multiplier printed; the Reports tab's folders, filters and count badge, no clock anywhere in it; a six-hour gap with a full store → the return strip (amounts only, no duration) and the waste line on the next round card.
- 🟡 Not exercised in the browser: scout, envoy, challenge and collapse report cards (unit-tested only); the away digest with several idle rounds (unit-tested only).

### Open for Mathias — first-pass defaults in data

Every number below lives in `data/*.json` with a `_comment`; none is in code.

- `config.reports.max` 60 records kept; `config.history.max` 100 rounds; `config.history.tableEvery` 10 for the Save tab's table.
- `config.rome.completeFavour` 5, `config.rome.completeLoyalistAttitude` 3 (were literals; values unchanged).
- The counsel's content and voice (`data/advisor.json`, `_voice` note): five steps, "Counsel" with no speaker, step 3 spends 25 of the founding 80 denarii, step 4 names a post without saying an appointment hands that house leverage; terminal condition `romeAnswered`.
- Effect words (`data/effects.json`): a first-pass vocabulary.

### Open for Mathias — curation and tone

- Which actors get a report record: raids, site raids, scouts, envoys, votes, Rome, a collapse do; rival-house moves, intrigue, events and deaths by age stay prose.
- The raid card lists Rome's engines and the lesser office as rows only when non-zero, because the parts must sum; the wall term folds research in. Fear is shown as the observed change, never the rule. The site-raid roll is folded into one attack total.
- The declined-request card prints "Rome's favour −5" where §6 says no punishment and the prose says Rome says nothing.
- The challenge card shows whom each house voted for, which reveals the swing house.
- The ledger snapshot is taken at the top of the round, so the player's own step-1 cost sits outside before → after; the card says so.
- The Due block: the idle-hours line appears there as well as on the Council tab (§3.1 names the Council tab); the massing line prints live strengths and the appease price, not the figures logged when the warning fired; "Nothing under way." as the empty state; Rome's open request deliberately not listed as due (§6: no due date).
- Summary card: houses unranked with yours marked; "4 of 18 plots raised" with the wall named beside the count, never counted (§4.5); a "Wall" row (the building's tier) and a "Walls" row (the defence figure) side by side.
- Return strip: zero threshold (any whole-unit change shows it); the overflow window is "since the last card was acknowledged", so a full store shows the strip on every reload until the next Continue; a store already over its cap (Rome's grant on a full store) is not counted as waste.
- Badges: Council lights only for a pending vote, not for being out of office; "!" means a duty asking for an answer, plus the counsel's tab; Reports carries a count.
- §3.1: a build's duration is stated *before* it starts (plot card, rows, Library). One sentence in §3.1 would make that explicit.

### Not built — the four the panel sent back

- **Horizon times** ("enough for this in about 2 hours"): a coarse countdown unless §3.1 is amended to allow it.
- **Counsel beyond the opening**: always-on UI overlapping the report, the digest, the Due block and the badges.
- **Rome's first letter waiting at founding**: Rome acting outside a round (§3.2, Pillar 2), and r01's 80 wood is the castellum step's wood.
- **Milestones**: not in DESIGN; content, a save field and a record.

### Process

- Four units, two waves, each unit a worktree branch off the integration branch with its own reviewer; the reviewers fixed nine bugs before I saw the code (an alliance refused for *too much* fear reported as too little; the stale round ledger on later cards; dead buttons on the news overlay; the return strip counting overflow the player had watched as loss while away; Rome's mark outliving the tier it asked for; the founding Continue reading a stale card).
- The workflow cuts worktrees from `main`; every unit begins with `git checkout -B <branch> claude/tribal-wars-patch` and a HEAD check. The first attempt skipped that and had to be stopped and relaunched.
- PRs #3–#7 were still open, unmerged, when this addendum was written. The patch branch contains all five; merge them first and the patch PR shrinks to the patch.
