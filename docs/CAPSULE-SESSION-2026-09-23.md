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
