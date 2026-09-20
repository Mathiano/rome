# Session capsule — 2026-09-20 (b)

Branch `main`, continuing after the merge. This session is the first one driven
by a playtest rather than by the backlog: Mathias played the production build
and filed eight verdicts in the playtest log, and everything below either comes
from those notes or was found while acting on them.

## What the playtest said

Eight items judged. Three were fine as they stand (the storage cap, the tab bar,
finding your next move), and the rest named real problems:

| note | what it turned out to be |
|---|---|
| "laughable now with the price being 1 denarii" | a real bug, not a placeholder |
| "did not feel like grain was a constraint" | correct: 1/hour of upkeep against a farm's 35 |
| "you should be able to see the minutes remaining" | **contradicts DESIGN §3.1, still open** |
| "still only a textbox and no real intro" | fixed |
| "there should probably be an advisor here" | banked, not built |

## What changed

### The colony reads as a town (DESIGN §10)

The strongest feedback was visual: the buildings looked "Temu", the lumber camp
had one tree, and the reference was Travian or Tribal Wars. The per-sprite
fidelity was the second problem. The first was that seventeen isolated plates on
a CSS gradient cannot read as a town however well each one is drawn, because
nothing encloses them.

- `src/render/environment.ts` draws a masonry wall ring with towers and a south
  gate, one continuous earth floor inside it, a ring road and a gate road
  meeting at a paved square, and country outside: the river past the clay banks,
  a wood behind the timber sites, ploughed strips beyond the farms, rock at the
  iron. Fixed seed, drawn once, never touched again.
- The wall is four strokes rather than a polygon per segment, because an
  isometric circle projects to an axis-aligned ellipse. The merlons are a dashed
  stroke: seventy little rectangles read as scattered debris.
- The plates lost their ink outline and now tone into the town floor. They keep
  their geometry — the anchor is measured from them — and all 42 sprites still
  pass the 2:1 assertion, with anchors moving under a fifth of a screen pixel.

### The yards are worked

- Four new primitives (`scroll_rack` was last session; this one adds
  `plank_stack`, `chopping_block`, `brushwood`, `fire_pit`) and, more
  importantly, `worker()`.
- The lumber camp now has six trees and a stand being felled, plank stacks, a
  block with the axe left in it, brushwood and a fire; the clay works, the farm
  and the iron mine are thickened the same way.
- People are drawn at the scale the geometry implies — about a third of a
  one-storey building, which is four pixels on screen. The first pass used pale
  plaster tunics and vanished against packed earth; they are terracotta and
  green now and carry their own contrast.

### Motion instead of cuts

The village and the map cross-fade with a slight scale rather than swapping with
`display:none`, and the outgoing stage keeps drawing for the length of the fade.
Outside that window only the visible stage updates — the map is 469 hexes. A tab
change plays one short rise; the news card arrives; the founding card has its
own longer entrance. All off under `prefers-reduced-motion`.

### Two balance bugs the playtest found by feel

- **Haste cost one denarius.** The price was indexed to the tax take alone, so
  `ceil(8 × hours)` hit the floor for any job under about eight minutes. It is
  now priced against everything the colony produces in that hour — values per
  resource in `data/resources.json` — with the floor at 5. A castellum's first
  tier quotes 5 against a purse of 80; the forum's second quotes 51.
- **Grain guarded nothing.** Upkeep is now 0.35 a head an hour rather than 0.05.
  A founding colony still eats comfortably; one that grows past a single farm —
  the moment insulae allow it — has to farm in earnest. Pillar 6 holds: a colony
  with nothing growing stalls and nobody starves, now asserted.

## Verified

- 210 tests, `tsc --noEmit` clean, build clean.
- Four new environment tests, including one that asserts the wall actually
  encloses every plot and one that fails on any `NaN` or `undefined` coordinate,
  since a single bad number silently drops a shape.
- Headless Chromium: the cross-fade measured mid-transition at 0.72/0.42, the
  hidden stage takes no clicks, the panel swap animates, the founding card
  carries its own class. No page errors.
- The rush and grain curves were measured across the colony's whole range
  rather than eyeballed, and both are now guarded.

## Open for Mathias

- ❓ **Minutes remaining on construction.** Your note asks for it; DESIGN §3.1,
  which you ratified on 2026-09-15, forbids it — *"No countdowns… No other time
  is displayed."* Nothing was changed. Say the word and I will show minutes and
  amend §3.1 to match; I am not overturning a ✅ on my own.
- 🟡 **Painted sprites.** `draw.py` emits flat vector polygons. The composition
  is now right, and the yards are dense, but those references are hand-painted
  and polygons will not reach that bar. The route to it is generated sprites
  from the style anchor — which parks on the licensing question from the Veo
  session.
- 🟡 An advisor for "what next", from your note on the opening. Not built.
- Still open from before: §15.7 heirs, §15.11 the research tree, whether
  bodyguards should cost a round, §15.8, §15.3, §15.4, §15.10.
