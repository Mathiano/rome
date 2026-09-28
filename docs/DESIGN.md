# Arctown — Design Document v0.1

Working title: Rome III (repo `Mathiano/rome`). The shipped name will be different — "Rome II" is a Total War title. ✅ The town is Arctown (`data/config.json` `townName`).

**Marks:** ✅ decided · 🟡 proposed by Claude, awaiting Owner confirmation · ❓ open question

**How to use this document:** it is the single source of truth for design. Code follows the doc; if the code needs to diverge, the doc changes first. Claude Code reads it via `CLAUDE.md`. Numbers in tuning sections are starting points, not commitments.

---

## 1. Premise ✅

- **When and where.** Year 0, Augustan era. A Roman colonia founded from nothing in Germania between the Rhine and the Elbe, far to the north and beyond reliable reach of the legions. Real region, fictional town. The historical model is Waldgirmes, a civilian Roman town east of the Rhine (✅ it existed, with a forum; 🟡 founded c. 4 BC, abandoned after Teutoburg in AD 9).
- **Who you are.** A Roman family (gens): a party leader and heirs. Rome's appointee in charge of the colony. Three other noble families sit on the council; they are companions and rivals at once (Rome II model). You can keep one family friendly throughout while the others plot, obstruct or revolt.
- **The two outside actors.** Rome, an institution rather than a face — benevolent, sets goals, rewards success, can order actions, steps in if the colony collapses. Three tribes, hand-authored, with their own likes and hates toward each other and toward you.
- **What you are trying to do.** Build the colonia through tiers; keep the other families satisfied while placing your own people in the key posts; keep your family alive across generations. There is no fixed end. The game is "completed" when all content is achieved; the post-game runs indefinitely and content is added over time.
- **Losing.** You can lose badly — a coup, citizens leaving, raids getting through, the top office taken from you — but never completely. Research persists through any collapse. If everything falls apart, Rome steps in and administers the colony until you are back on your feet. If every member of your family dies, you choose a new character and continue.
- **Scale.** Significantly bigger than Dream Acres, reached through versioned content drops rather than a large v0 (see §13).

---

## 2. Pillars — design rules ✅

These are not up for negotiation inside a session. Changing one is an Owner decision recorded here.

1. **No real money, no energy bars, no pay-to-win.** Hired help costs denarii only.
2. **Real-time for anything only you do. Turn-based for anything involving another actor.**
3. **Every timer can be finished early for denarii, and the price never exceeds what the colony earns in that time.**
4. **Buildings upgrade in place.** No builders walking around. Each tier makes the structure visibly more sophisticated; the top tier animates.
5. **Politics carry the tension.** Single-player. Rivals, tribes and Rome are simulated, never human.
6. **Population is opportunity, not a chore.** More people means more posts, income and militia. No sickness, overpopulation or Farthest Frontier-style micromanagement.
7. **Never unrecoverable.** Setbacks are hard. Total loss is impossible. Research survives everything.
8. **Defer, don't drop.** Features that don't fit the current version are banked in §14, not deleted.
9. **Keep it real — mythic Rome.** ✅ *Amended 2026-09-27.* Roman names, Roman gods, Roman practice (adoption, patrilineal families, the castellum). The gods act: a sacrifice is answered, a temple has power, the cult of Augustus is the state cult with real effect. No wizards, no spells, no mana. Anachronisms are flagged, not silently adopted.

    The tone is cozy and adventurous. The politics keep their edge — assassination, coups and secession stay — but the game should reach for festivals, games, dedications and rivalries before it reaches for the knife. 🟡 Festivals as a council action, proposed for v0.2.
10. **PC first, landscape.** Mobile is a later decision.
11. **Absence costs opportunity, never assets.** ✅ *2026-09-25.* Nothing the player holds may be taken while they are away. Not resources, not population, not characters, not sites, not the top office. What absence costs is what the player *would have gained*: production above the storage cap, a Rome request that expired unanswered, a site a tribe claimed first, a marriage another house arranged.

    Returning after a week is finding letters on the desk, not damage in the yard.

    This pillar governs every other section. Where an older rule conflicts with it, this one wins and the older rule is amended.

---

## 3. Time model

Two clocks. The player sees only one.

### 3.1 The village clock — real time, invisible ✅

Resource accrual, construction timers, site yields and research progress run on wall-clock time, including while the game is closed. Offline accrual is capped by storage capacity (§4.2), not by a time cap. A job under way shows its progress, the time left in rounded words, and the rush price. There is still no ticking clock and no second-by-second countdown, and the village clock itself is never displayed. ✅

*Amended 2026-09-20*, after the first playtest. This read "No countdowns. Construction shows progress and the rush price… No other time is displayed" and was ✅ from 2026-09-15. The playtest overturned it — *"you should be able to see the minutes remaining here"* — on the grounds that hiding the wait did not make the colony feel calm, it left the player unable to plan around it. What survives is the intent: time is stated once, in words, rounded to what a player can act on ("about 40 minutes left", "about 2.5 hours left"), and never counted down.

*Ruled 2026-09-25:* the "Since you were last here" strip on the Village tab (what the village clock did while the player was gone, as amounts) is anchored to when the player last saw the colony: `lastSeen` is stamped when the strip is put away and while the player is in the game with no strip up, and the next strip counts from that stamp. It shows only when the gap exceeds `returnStrip.minGapMinutes` (`data/config.json`, 30, a tuning default), so a reload a minute later shows nothing. `lastSeen` is part of the save, so it survives export and import, and an imported colony is judged by its own stamp. A save with no stamp (older than this, or damaged) is stamped at the time it is loaded, never zero, and shows no strip that once. ✅

*Ruled 2026-09-24:* **no time estimates, anywhere, ever.** The game never projects when something will happen at the colony's rate — when a cost will be met, a store will fill, a population or a tier will be reached. The time it states is the one above: a job under way. ✅ A job's own length stated before it starts (the plot card, the colony overview, the Library) is a property of the job and an input to the decision to build, not a projection, and stays. ✅ *Mathias, 2026-09-24.*

### 3.2 The political clock — rounds ✅

A **round** is triggered when the player makes a political move. Sequence within a round:

1. Player acts.
2. Each rival family acts or passes.
3. Each tribe acts or passes.
4. Rome acts or passes.
5. Ages advance (§9.2); round-based events resolve.

Rome's first letter is the one thing another actor does outside a round: it is part of the founding, standing at round 0 before any round has run (§6). Every later letter comes at step 4. ✅ *2026-09-24.*

A round the player calls always answers: when it brings no news, a short card says the council met and nothing was decided (`data/config.json` `quietRound`), so the one button that advances the world never appears to do nothing. ✅ *2026-09-24.*

Any number of rounds may run per day. Political actions can be **prepared** at any time (queue an intrigue, dispatch an envoy, send scouts) and **resolve** at the next round. Preparation fills a session; resolution stays turn-based.

### 3.3 Absence ✅

*Amended 2026-09-25 by §2.11, the absence pillar, which is the reason for everything in this section.* **The idle round is removed.** No political round runs without the player. Characters do not age, die or lose office while the player is away, because ageing advances per round (§3.2) and no round runs unattended. The dev clock's multiplier and skip buttons scale the village clock only and never advance a round.

- **The world still moves.** While the player is away, tribes shift disposition, tribes claim *unclaimed* sites, Rome issues and expires requests, and rival houses form intentions. None of this removes anything the player holds. It rearranges the board around them.
- **The digest.** On return, the player is shown what happened as a short report — headline cards first, totals after — including what was lost to full stores, and which opportunities have closed. One report, not a stack of round cards.
- **Not an exploit.** A player who never convenes is not exploiting the game; they are not playing it. There is no punishment for absence, and none is to be added.

**Do not restore it.** No idle round, calendar floor, catch-up or other mechanic that advances the council without the player replaces this; any such proposal needs Mathias's sign-off before it is built.

This section read, from 2026-09-15: *"If no round has run in N real hours, an idle round runs automatically: opponents act, the player does not."* It ran up to 7 rounds on load (`calendarFloorHours` 24, `idleRoundsMaxCatchUp` 7) to close what was then called the exploit of never convening.

⚠ *Code, since #13 (merged 2026-09-28):* the idle round, `calendarFloorHours`, `idleRoundsMaxCatchUp` and every surface that spoke of them are removed. A save loaded after any absence is at the round it was left at; old saves drop the idle round's bookkeeping on load, and rounds that already ran without the player keep their mark in Reports. Of the world that still moves, only one part is built (2026-09-28, §5.5): tribes take unclaimed sites on the village clock. Tribes' dispositions, Rome's requests and houses' intentions do not yet move while the player is away, and there is no return digest of world events — only the Village tab's return strip of what the village clock did (§3.1). *Doc, flagged not reconciled:* "the world still moves" has tribes, Rome and the houses acting outside a round, where Pillar 2 and §3.2 make every act by another actor turn-based (Rome's founding letter is the one recorded exception); and a Rome request that expires has no counterpart in §6, which gives requests no term, or in `data/requests.json` and `src/rome/`, which have none.

### 3.4 Tuning

- ✅ Age is counted in rounds and advances by one per round. Starting ages are authored in rounds (`data/families.json`). Natural death has zero chance below 120 rounds and ramps linearly to certainty at 200 (`data/config.json` `lifespan`), so a leader who politicks hard burns through his life faster than one who delegates.
- ❓ Whether a flavour calendar (months, years) is displayed at all, and if so whether it counts rounds or real days.

---

## 4. Economy

### 4.1 Resources ✅

Anno-lite: some processing chains, none longer than two steps, and many raw resources usable as-is (Travian).

**v0 — five:** wood, clay, iron, grain, denarii.

**Planned content drops** (each brings its buildings): stone, marble, salt; processed — bricks, tools, pottery, ❓ wine, ❓ bread/food as a grain refinement. Final list is open; the mechanism (a resource arrives with its producer building and its consumers) is decided.

### 4.2 Storage — Travian model ✅

| Store | Holds | Notes |
|---|---|---|
| Warehouse | all non-food resources | capacity per tier; overflow is lost |
| Granary | grain and food | capacity per tier; overflow is lost |
| Treasury | denarii | uncapped |
| Cellars | a fixed amount of each resource | hidden from raids (Travian's cranny) |

Storage capacity is what caps offline accrual (§3.1) and is what raids target (§8), so the warehouse tier is a genuine strategic choice: bigger stores, bigger target.

### 4.3 Population ✅

One number. Needs housing and grain upkeep. Grows with buildings. More population means more posts can be filled, more denarii income and a larger militia pool (§8.1). No citizen tiers in v0 (banked). No sickness, no overpopulation penalties. ✅ Hunger stalls, never kills: at zero grain, population growth stops; it does not decline.

### 4.4 Buildings ✅

- Three visible tiers each. Tier 3 animates (§10).
- Construction is timed. Finishing early costs denarii per Pillar 3.
- **Concurrency:** one building and one resource field may be under construction at the same time — Travian's actual Roman-faction rule ✅. No build queue beyond that. (A holding may also be under construction, §5.3.)
- Resource buildings sit on their site: the clay works on the clay bank, the mine on the iron seam (§4.5 C.2).
- **The wall is a building of its own, not the castellum.** ✅ 2026-09-22, decided by Mathias. They are two things. The castellum garrisons the colony — militia pool, bodyguards — and its tier drives only its own sprite. The **Wall** is the circuit, raised separately; it counts as a building for the concurrency rule above, so the colony chooses between raising its walls and raising anything else. Its tier is the *walls* term of §8.2 defence strength and, since 2026-09-27, also the size of the enclosure (§4.5 C.1). The circuit at each tier: **none** is the ditch and bank a colonia throws up on arrival; **I** a timber palisade on that bank; **II** coursed stone with towers; **III** the full crenellated circuit, which flies the colony's standard over the gate as its §10 tier-3 animation.

#### The seat ✅ *(confirmed by Mathias in session, 2026-09-27)*

- **Praetorium** — the governor's residence and the seat of the player's family. Its tier is the colony's tier. It is the centre of the town. Footprint 2×2. Unique.
- **Forum** — the civic and market building: basilica, curia and market stalls. Trade with tribes and Rome happens here; the council convenes here. Footprint 2×2. Unique. **The separate Market building is removed**; its role folds into the Forum.

The building count stays at fourteen.

*Built 2026-09-28* (overnight, item 0). The praetorium stands at the founding on the cells the forum used to take, at tier I, and `colonyTier()` reads it; every tier's gate is `requiresColonyTier` (renamed from `requiresForumTier`), and the praetorium alone is exempt. It takes over the old forum's tiers — costs, times and gravitas per round — so the founding colony is as strong as before. The forum takes over the market's tiers — tax and trade rate — as a unique 2×2 building that is not standing at the founding; trade with the tribes needs it, as it needed the market. The Market is gone from data, sprites and code. The praetorium draws a placeholder at every tier until its still passes artgen; the market's still stays in `assets/src/`, unplaced. The Aedile *of the market* keeps his title: the post runs the market held in the forum. Save format 3 (building ids changed): under the save rule, every older save resets.

#### Repeatable and unique buildings ✅

Buildings are no longer one-each.

| Unique (one per colony) | Repeatable (as many as plots allow) |
|---|---|
| Praetorium, Forum, Castellum, Wall, Temple, Library, Waystation | Insulae, Warehouse, Granary, Cellars, Barracks, Farm, Lumber camp, Clay works, Iron mine |

Repeatables are where the colony's shape is decided: more farms is a trade colony, more barracks-adjacent buildings is a military one, more libraries later a learned one. Costs may rise per copy 🟡 (`_tuning`). Resource buildings still require their site (§4.5).

*Built 2026-09-28:* each further copy of a repeatable building costs (1 + `repeatables.costGrowthPerCopy`)ⁿ of the first, on every tier, n its copy number from 0 — fixed when it is first built, so a later copy never re-prices an earlier one. 🟡 **0.25**, Claude's first pass: the fourth warehouse costs about twice the first. Unique buildings never scale. The Place row says how much dearer the next one is.

#### Footprints ✅

Every building has a footprint in grid cells. 🟡 starting values: Praetorium, Forum, Castellum, Temple 2×2; Harbour 2×1 on a coast edge (arrives with the harbour drop); everything else 1×1. In `data/buildings.json`.

✅ *2026-09-27, Mathias:* one edge of the town grid is reserved as a **riverbank** for the future harbour — 2×1, placed only on that edge (§4.5 C.1). No harbour building yet.

**Building list** (roles; the 2026-09-16 v0 list as amended 2026-09-22 and 2026-09-27):

| Building | Kind | Role |
|---|---|---|
| Praetorium | unique | seat of the player's family; its tier is the colony's tier |
| Forum (basilica, curia, market) | unique | the council convenes here; trade with tribes and Rome |
| Castellum | unique | garrison, militia pool, bodyguard pool |
| Wall | unique | the circuit; its tier is the walls term of §8.2 and the size of the enclosure |
| Temple | unique | gods (§9.8), piety, gravitas |
| Library | unique | research (§4.6); its tier gates how far the tree opens |
| Waystation | unique | Rome requests; road link |
| Warehouse | repeatable | storage |
| Granary | repeatable | storage |
| Cellars | repeatable | hidden storage |
| Insulae (housing) | repeatable | population cap |
| Barracks | repeatable | the military counterpart to farms: each one adds to the militia pool (§8.1). ✅ *Added by Mathias, 2026-09-27.* 1×1; costs and militia per tier are `_tuning` defaults in `data/buildings.json` |
| Lumber camp | repeatable | wood site |
| Clay works | repeatable | clay site |
| Iron mine | repeatable | iron site |
| Farm | repeatable | grain site |

⚠ *Flagged 2026-09-27, not reconciled:* the patch says "the building count stays at fourteen", but its own unique/repeatable table lists fifteen — the list above, Library included (sixteen with the Barracks). The Harbour appears only as a footprint. *Resolved the same day:* the Barracks is on the list (Mathias). *Code:* the Forum is the seat — `forumTier()` is the colony's tier and 46 tiers in `data/buildings.json` carry `requiresForumTier`. The Market is a building that trade reads (`src/tribes/envoys.ts`: no Market, no trade; its tier sets the trade rate). There is no Praetorium. None of this is changed in this pass. *Since the grid (2026-09-27, below):* buildings are unique or repeatable and placed on the grid; `data/buildings.json` holds sixteen — the fourteen of the old list, the Wall and the Barracks — with the Market still separate and no Praetorium, because the seat change (B.1) is not yet built.

### 4.5 Layout ✅

*Rewritten 2026-09-27.* The concentric rings are replaced.

#### C.1 The town grid ✅

- The town is a **rectangular grid of cells inside a rectangular wall** — the Roman colonial plan: streets on a grid, gates on the axes. The circular wall and ring slots are gone.
- **Free placement:** the player places any building on any free cells that fit its footprint. Placement is a decision, not a menu.
- The number of cells is finite and always fewer than the player would like. 🟡 Starting values (`_tuning`): wall tier 0 (ditch and bank) 6×6 = 36 cells; tier I 7×7; tier II 8×8; tier III 9×9 = 81. One of every building costs about 23 cells, so tier 0 leaves room for roughly a dozen extras and no more.
- **The wall's tier grows the enclosure.** Raising the wall is how the town gets bigger. This ties expansion to defence and gives the Wall building its second purpose.
- **The riverbank ✅** *(2026-09-27, Mathias).* One edge of the grid runs along the river. Beyond it is a strip of bank, outside the wall, kept for a building placed only there — the harbour, 2×1 along the bank (§4.4). No harbour building yet.

*Built 2026-09-27* (`src/village/grid.ts`, `data/layout.json`). The cells are integer (x, y) on the isometric grid, each one sprite plate across. The enclosure is the tier's size in cells, and it grows **away from the river**: the river edge is fixed and each larger size adds a column on the land side and a row, alternately, north and south. So every size contains the one before it, nothing placed ever falls outside, and the bank never moves. 🟡 *Claude's first pass, for confirmation:* the river edge is the south-east (bottom right on screen, where the painted river runs); the bank is one cell deep; the gate stands at the middle of the south-west edge, where the road comes in. Placing a building is a mode of the village view: every place it fits is marked, and a click there puts it down and starts tier I. There is no moving or demolishing. A unique building stands once, a repeatable one as long as there are cells. A save from the ring layout loads onto the grid with every building kept by its id and tier, the forum on its founding cells and the rest set down nearest the centre. An empty plot, or a castellum the ring layout pinned but nobody raised, holds nothing and is dropped.

#### C.2 Three zones ✅

1. **Inside the wall:** buildings on the grid.
2. **Immediately outside the wall:** resource sites on the terrain — fields, clay bank, iron seam, forest — each with its resource building on it. These are placed by the map, not the player, and are the first things a raid reaches.
3. **The hex map beyond:** holdings (§5).

#### C.3 Adjacency ❓

Free placement exists so that placement can matter. Adjacency effects — a granary beside farms, a temple beside insulae, a warehouse beside the forum — are the intended source of supply-chain skill and are **deferred until the grid exists**. ❓ Rules and numbers in a later patch. In-town roads 🟡 likewise.

*Scaffolding built 2026-09-28, with no rule defined.* A building may declare `adjacency` in `data/buildings.json`: a list of `{ beside, effects }`, each effect gained once for every standing neighbour of kind `beside` that shares an edge with its cells (diagonals do not count; a neighbour still rising gives nothing). `sumEffect` applies them, so anything that reads an effect picks them up; the plot card and the placing card state them in words. Which buildings gain what beside what remains ❓ — no content was invented.

#### C.4 View ✅

The town view zooms, to roughly 3× its current extent at most. The wall and grid are drawn in code; buildings are painted sprites (§10).

*Built 2026-09-27:* the view opens on the whole country — the largest enclosure, its bank and the river, and every site — and the wheel zooms in about the pointer as far as the old frame (660 units across). The wall runs on the grid lines, one piece per cell of edge. Each piece sorts by depth with the buildings, so the far edges stand behind the town and the near edges and the gate in front of it, lit from the top left like the sprites. A 2×2 building's sprite is scaled to its footprint.

⚠ *Flagged 2026-09-27:* repeatable resource buildings "still require their site" (§4.4), but the sites outside the wall are placed by the map (C.2), so the number of farms, camps and mines is bounded by how many sites the map gives — not by plots. *Code, 2026-09-27:* C.1, C.2 and C.4 are built (above); C.3 is not. The painted country (`base-map-v1.jpg`) was made for the round wall and is laid under the grid until it is regenerated (§10), and the river beside the bank is drawn in code.

### 4.6 Research ✅ (system) / ❓ (contents)

A research system driven by three inputs: denarii (pay for experiments), research scrolls (earned from Rome rewards, ruins on the map, and trade), and the Library building. The tree is data-driven (`data/research.json`). Research is never lost, even through collapse and Rome's intervention. ❓ Tree contents — first pass in v0.2.

Built 2026-09-20 (`src/village/research.ts`). A study runs on the village clock like a construction — real time, no political round — and can be finished early for denarii at the same Pillar 3 price. One study at a time. A node costs denarii and scrolls, needs a Library of its own rank, and needs whatever it stands on. Research and buildings share one vocabulary of effects, so anything already reading a building effect picks research up unchanged.

🟡 **Tree contents, first pass, 2026-09-20.** Eleven nodes in three ranks, written as a data-file default in an unattended session (CLAUDE.md, *Ways of working*) and listed in `docs/CAPSULE-SESSION-2026-09-20.md` for confirmation. §15.11 stays open until Mathias ratifies or replaces them.

---

## 5. World map — holdings ✅

*Rewritten 2026-09-25 (decided by Mathias; applied 2026-09-27).* The colonia is the only city. Everything else on the map is a **holding**: a place the colony works, watches or garrisons. Holdings differ in kind, not only in yield, so the choice of which to take and which to defend is a real one.

### 5.1 Structure ✅

- Hex grid, 21 across.
- Terrain is visible from the start. **Sites are hidden as "?"** until scouted. A scouted "?" resolves to a site, a treasure, or a barbarian camp that punishes the scout.
- Tribal villages are never shown. Tribes are present through envoys, raids and contested holdings.
- The map is a top-level view, not a panel tab.

### 5.2 Site kinds ✅

A holding is defined by what it gives, and the kinds are deliberately unlike each other.

| Kind | Gives | Notes |
|---|---|---|
| Forest | wood | plain yield |
| Clay bank | clay | plain yield |
| Iron seam | iron | plain yield |
| Farmland | grain | plain yield |
| Quarry | stone | arrives with the stone content drop (§4.1); until then it is scoutable and claimable but idle 🟡 |
| Salt spring | salt | as above |
| Troop field | militia | adds to the militia pool (§8.1) **without drawing on population** — the one way to grow the pool other than the castellum (and, since 2026-09-27, the Barracks, §4.4) |
| Watchtower | warning | reveals a ring of hexes around it, and raids against anything inside that ring are telegraphed one round earlier |
| Ford / junction | movement | envoys and trade resolve faster; the trade effect applies at the market |
| Shrine | gravitas | a small standing gravitas income to the house holding the post of temple |
| Ruin | research scrolls | a **one-time** yield when first claimed, then inert. It is a prize, not an income |

All yields, costs, upkeep and probabilities live in `data/map.json`, flagged `_tuning`.

### 5.3 Holding tiers ✅

Every holding has three tiers of its own — camp, station, fort — on the same model as buildings: built in place, each tier visibly more substantial, each raising yield and defence.

**Holdings are drawn in SVG on the hex grid, not as painted isometric sprites.** This is deliberate: the map's whole progression costs no generated art. A camp is a mark, a station is a walled mark, a fort is a walled mark with a tower.

Holding construction uses the same concurrency rule as the colony (§4.4): one holding may be under construction at a time, in addition to the one building and one field.

### 5.4 Roads ✅

Roads are the colony's long-term project and the connective tissue of the map.

- Built **segment by segment**, hex to hex, from the colonia outward. Each segment is timed and costs resources.
- A holding connected to the colonia by an unbroken road: **raid exposure falls**, **envoys and trade resolve faster**, and **its yield rises**.
- 🟡 **Cost in v0:** denarii and wood, since stone is not a v0 resource (§4.1). When the stone drop lands, a **paved** road upgrade costs stone and improves the same three effects further. CC to propose starting numbers as `_tuning`.
- Roads are visible on the map as a growing network. This is the thing a player builds toward over weeks.

*Built 2026-09-28 (overnight item 3).* One segment is under construction at a time (Mathias, overnight brief), in a **road lane of its own** beside the colony's lanes and the holding lane (🟡 Claude's call: §4.4's concurrency rule names no road lane, and sharing the holding lane would make roads and holdings compete). A segment goes only on a hex beside the colonia or a road that reaches it, so the network never has a gap by construction; a gap can arise only if a road is lost, and then everything beyond it counts as unconnected. Numbers in `data/map.json` `roads`, all `_tuning`: a segment 30 denarii and 40 wood over 15 minutes; a connected holding's raid chance × 0.5 and its yield × 1.25; the trade rate sharpened by 0.1 while any holding is connected. ❓ **Envoys resolve faster** has nothing to shorten in v0 — an envoy's road is one round — so it waits, like the ford's (§5.2). Drawn on the map as solid lines between laid hexes and a dashed line to the segment being laid. Save format 6.

### 5.5 Claiming, holding and contest ✅

- **Claim:** a council action plus denarii, at the next round.
- **Hold:** a small denarii upkeep. Garrisoning draws from the militia pool (§8.1), which cannot cover everything.
- **Distance matters:** raid exposure rises with distance from the colonia and falls with a road connection (§5.4).

**The contest rule, which follows from §2.11:**

- An **unclaimed** site may be taken by a tribe at any time, including while the player is away. That is a missed opportunity and is permitted.
- A site the player **holds** can only change hands in a round the player is present for. A tribe may move against it, but the resolution — including the player's chance to allocate the militia pool against it — happens when the player next convenes.
- A holding is therefore never lost unattended. It may be lost in front of the player, badly, having been under-garrisoned. That is the player's decision and it stands.

*Built 2026-09-28, overnight item 2* (`src/map/contest.ts`). **Unclaimed sites:** for every whole real hour on the village clock, a 🟡 0.02 chance that a tribe not allied to the colony takes one unclaimed site, until tribes hold 🟡 30% of the map's sites. The dice are the clock's own — thrown from the map seed and the hour, never from the game's RNG — so the same hour always throws the same however often the clock is called, and a week away does not reshuffle the rounds. A site a tribe took cannot be claimed; the map marks it; the return strip names it among what closed while the player was away, if the player knew what stood there. **Held sites:** a tribe's move is *declared* in a round, with its strength stated against the holding's defence, and *decided* in a later round the player convenes (🟡 one round later; a held watchtower in sight adds one), after the player's own move in that round — so men sent then count. No round runs unattended (§3.3), so a simulated week away leaves every holding standing and every threat waiting. A held watchtower that sees the colonia also warns of a raid on the colony a round sooner. **Garrisons** come from the militia pool and never exceed it: a move that asks for more than are spare is refused, and when the pool shrinks under them (citizens lost, a troop field given up) the farthest garrisons come home first, then bodyguards, at the end of the round. The claim remains a council action plus denarii, applied as the player's move in the round it runs (not queued to the round after), with its denarii upkeep and its exposure rising with distance as before. Save format 5.

### 5.6 Why one city ✅

The colonia is the only place that builds, houses population and holds a council. Holdings never become cities. This keeps the political layer singular — one council, one set of families, one seat to fight over — and prevents the game from turning into a management problem of many towns.

*Built 2026-09-28, overnight item 1 (§5.1–5.3).* The map is 21 hexes across and a top-level view: the stage switches between Town and Country, and the panel follows to its Country tab. Terrain shows from the start; a site shows as "?" until scouted, and scouting is prepared and resolves at the next round. A "?" turns out to be a site to hold, a **hoard** (paid in denarii when the scouts reach it, leaving nothing to hold) or a camp that punishes the scouts. Every kind of §5.2 is in `data/map.json`, its numbers `_tuning`:
- the four yields (ids kept from v0.1: `timber` is the Forest, `meadow` the Farmland);
- quarry and salt spring, claimable and idle until their resource exists (🟡 as written);
- the **troop field**, adding 3 / 6 / 10 men as camp, station and fort without drawing on the people;
- the **watchtower**, which on being held shows every hex within 2 — known without a scout, a seen war band never walked into, a seen hoard still waiting for the scouts;
- the **ford**, its trade rate sharpened at the forum;
- the **shrine**, 1 gravitas a round — to the player's house, because DESIGN names "the post of temple" and v0 has no such post (❓);
- the **ruin**, paying 2 scrolls once, when it is first held, and nothing to the scouts.

Holdings are camp, station and fort (§5.3), built in place on the village clock in a third lane of their own, finishable early at the Pillar 3 price; each tier raises the yield (×1, ×1.5, ×2) and adds to the defence (0, 8, 20), all `_tuning`. They are drawn in SVG: a mark, a walled mark, a walled mark with a tower. ❓ *Left for item 2:* a watchtower's raid seen a round sooner needs raids declared before they land, which the contest rule brings. ❓ *Not yet meaningful:* a ford's "envoys resolve faster" — an envoy's road is one round in v0, so the ford's `envoyRoundsSaved` has nothing to shorten until envoys travel longer. Save format 4.

---

## 6. Rome ✅

An institution, not a person. Rome wants the colony to succeed and is not abusive or demanding.

- **Requests:** deliver resources, host a garrison, build a road or waystation, send recruits, host a visiting official. ❓ Ordering an attack on a tribe — banked until offence exists (§8.3). A hand-authored progression of ~15 requests plus random filler. ✅ *2026-09-24:* the first request of the progression stands at the founding, so a new colony opens with Rome's letter already on the Rome tab; the rest arrive at Rome's step of a round (§3.2). The first letter asks for 80 of the founding 120 wood, the same wood the castellum wants: an opening decision on purpose, not a balance fault. Declining is free, so it cannot soft-lock the colony. Watch it in playtest; do not pre-tune it. ✅ *2026-09-24.*
- **Rewards:** both unique items (catapult, engineer, veteran cohort) and unlocks (permission to build baths or an aqueduct, citizenship grants for characters, research scrolls).
- **Ignoring Rome:** no punishment. You forgo aid you will sorely miss, and the loyalist family's regard for you falls — its attitude toward you (§9.1), not its standing, which is the sum of its gravitas and does not move. ✅ *2026-09-24:* declining moves no favour at all; the report names the aid forgone and the loyalist house's fall in regard, and nothing else. This line read "standing falls" until 2026-09-24; the code has always moved attitude.
- **Gravitas as currency:** Rome's backing for a political action can be bought with gravitas (§9.2).
- **Intervention:** on collapse, Rome administers the colony until the player recovers (§1). ✅ Collapse is population ≤ 5 or corruption ≥ 95 (`data/config.json` `collapse`). Rome clears the council, zeroes corruption, grants supplies and administers for 4 rounds. Research and the family survive.

Rome's role is deliberately narrow in v0 and expands later.

---

## 7. Tribes ✅

- Three, hand-authored, with distinct personalities. ✅ Archetypes: the trader, the raider, the wary. ✅ Names — real Germanic peoples of the period (the Cherusci, Chatti and Sugambri were all active around the Rhine at this time). ✅ v0: the Chatti are the raider. 🟡 v0.1: the Cherusci as the wary, the Sugambri as the trader, as listed inactive in `data/tribes.json`.
- **Disposition on two axes:** fear and trust.
- **Tribes have likes and hates toward each other** (Rome: Total War diplomacy model). Allying with one shifts the others.
- **Envoy menu:** demand tribute, offer trade, propose alliance, ask for hostages, warn of a raid, invite to a festival.
- Tribes can be weakened or won over — bribes, marriage, Roman action — and a tribe can become a **client** as a late-game state.

---

## 8. Combat — abstract in v0 ✅

No units on the map. Strength against strength, resolved at council.

### 8.1 The militia pool ✅

One pool of men-at-arms, sized by population, the Castellum tier and every Barracks standing (§4.4, 2026-09-27), with three sinks: **home defence**, **site garrisons** (§5.3), **bodyguards** (§9.6). Every allocation is a trade-off.

### 8.2 Raids ✅

Defence strength (walls — the Wall building's tier, §4.4 — plus home militia and the garrison post-holder's discipline) versus raid strength → a percentage of stored goods lost. Cellars are exempt. Raids on a distant site follow the same formula against that site's garrison.

Death by raid (§9.2) built 2026-09-23: a raid that reaches the stores has crossed the wall, and the garrison prefect was on it. He has a small chance of dying there (`raid.holderDeathChance`), eased by his discipline and by nothing else — bodyguards stand over a man in his house, not on the rampart. A repelled raid never kills. First-pass numbers, flagged for tuning.

### 8.3 Offence — banked ✅

Defence only in v0. Offensive actions (punitive raids for loot, retaking a site, Rome-ordered attacks) come with a later version. The catapult is a defence bonus now and an offensive unlock later.

---

## 9. Politics

### 9.1 Families ✅

Four: the player's and three rivals. **All four run on identical character rules** — same ageing, mortality, stats and heirs. Each family has: standing (the sum of its members' gravitas), attitude toward the player, and size (number of living members — which is also its voting weight, §9.5).

### 9.2 Characters ✅

- **Stats (five):** authority (drives gravitas gain), discipline (order, defence, corruption resistance), craft (works and economy), connections (intrigue and trade), piety (temples and gods).
- **Levelling:** by holding posts and by events. Both.
- **Gravitas:** per character, cumulative to family standing. Both a **rank** (thresholds unlock intrigue options and posts) and a **spendable stock** (paid to Rome for backing, spent on favours). Rank and stock are tracked as separate numbers.
- **Ageing:** advances per political round (§3.2).
- **Death:** age, assassination, illness and raid events.
- **Heirs — three routes:**
  - *Birth.* Requires a marriage; the child becomes an adult after ❓ N rounds. Starting families is critical to the family's survival.
  - *Adoption.* Of an adult, from another family or from the new men. ✅ Standard Roman practice (Caesar adopted Octavian; Augustus adopted Tiberius).
  - *New men.* A pool of veterans, freedmen and tribal nobles who can be raised into the family. No fifth family emerges in v0.
- **Children belong to the father's family** ✅ (patrilineal, historically correct). A daughter married out gives her children to the other family; a son married in keeps them.

Adoption built 2026-09-23 (`src/politics/adoption.ts`). Both routes: a **new man** — veteran, freedman or tribal noble — raised into the house for denarii, priced by the size of the household so that a purse cannot buy the council (§9.5) outright, and running no round since nobody else is party to it (§3.2, the footing bodyguards stand on); and a **grown man from another house**, which that house grants only if it thinks well enough of you and would not be left with nobody, for denarii and a round. He keeps his post and his marriage; his vote and his standing go with him; the giving house warms and forgets a grievance. He takes the name Rome would have recorded — the adopter's nomen, the birth nomen kept as a cognomen in *-anus* (Gaius Octavius → Gaius Julius Caesar Octavianus). The rival houses adopt new men on the same rule when they fall below a floor (§9.1, identical rules). Heirs by birth still wait on §15.7; an adopted adult needs no such number. Costs, floors and the consent threshold are first-pass defaults in `data/config.json` `adoption`, flagged for tuning.
- **Bodyguards:** allocated per character from the militia pool. Guarding one leaves another exposed; you can guard everyone until the family outgrows the pool.

### 9.3 Posts and the council ✅

- **Major posts** (the council — Game of Thrones small council): temple, market, garrison, works, lands/granary, treasury, tribal relations. ✅ v0 has five: treasury, garrison, works, granary, market (`data/posts.json`). Temple and tribal relations arrive with their versions.
- **Lesser posts** outside the council: less gravitas, less threat.
- **The top office** — the lord of the colony. ✅ Title: *praefectus*. Separate from the council posts.
- **Appointment effect — both:** a bonus to the post's domain scaled by the holder's relevant stat; that family's standing rises and the others' fall; **and** the family gains leverage in that domain (§9.4).
- Rival families without any posts grow angry. Rival families with too many grow dangerous. The player's job is the balance.

### 9.4 Leverage and corruption ✅

An unhappy family holding a post can: **obstruct** (its domain underperforms), **skim** (corruption rises), **leak** (tribes learn the size of your stores), **back a coup**. ✅ v0 has obstruct, skim and leak; backing a coup arrives with the top-office challenge in v0.2 (§13).

**Corruption** is one colony-wide meter. It raises construction costs and drains denarii. It rises with the number of rival-family post-holders weighted by how poorly they regard you. It falls when your own family holds the treasury, with good relations, and with the treasurer's discipline stat.

### 9.5 The top office ✅

- No calendar election. A rival family that judges itself strong enough can **call a challenge** and force a vote.
- **Electorate:** every living member of all four families, one vote each. Members vote for their own family's candidate; when their family has no candidate, they vote for whichever candidate they like more. Rival families usually prefer the player in office over another rival, unless strong enough to take it themselves.
- **So:** a bigger family and members who like you more than their peers is the defence.
- **Losing** the office is not game over. The player continues as the family out of power and must win the office back. Losing it is very much not ideal.

Built 2026-09-20 (`src/politics/challenge.ts`). A rival calls only when it has soured on the player (attitude ≤ `challenge.callerAttitudeCeiling`) **and** a simulated count says it would carry the council — not on a gravitas comparison, which whoever holds the office always wins. Houses with no standing put nobody up and become the swing vote, which is where "members who like you more than their peers" bites. A tie leaves the office where it is. Out of power the council's business (appointments, dismissals, claims) is closed to the player; the houses, the tribes, Rome and intrigue are not (Pillar 7). The player wins it back by calling a vote themselves at `challenge.playerCallCost` and rank `challenge.playerCallMinRank`; either way the vote falls `challenge.roundsToVote` rounds later, and that round is the campaign.

### 9.6 Intrigue ✅

Menu: bribe, expose, marry, exile, promote, demote, denounce to Rome, assassinate.

- **Assassination** is in, and the player can order one. It is rare, blocked by bodyguards, and generates large grievances from **all** families — nobody takes it lightly.
- **Marriage** between families strengthens relations and produces heirs under the patrilineal rule (§9.2). Marriage with tribal nobles is also in, and shifts that tribe's disposition.

Built 2026-09-20 (`src/politics/intrigue.ts`). In: bribe, expose, denounce to Rome, marry (house or tribe), exile, assassinate, and bodyguards. Promote and demote are the appointment and dismissal of §9.3 rather than separate moves. Every one of them runs a political round and is remembered as a grievance; an exile also empties the man's post and takes his vote out of §9.5. Heirs by birth still wait on §15.7, so a marriage binds the houses without yet producing children. Bodyguards are the militia pool's third sink (§8.1): `bodyguard.maxPerCharacter` each, `bodyguard.blockPerGuard` off an attempt, and every guard is a man off the walls. Standing men over your own kin runs no round — it is household business, not a move against another actor (§3.2).

### 9.7 Failure states ✅

Coup (the office taken by force), secession (a family or a share of citizens leaves), denunciation to Rome (Rome intervenes — a soft reset, not a loss), assassination of the leader (an heir takes over). Each is a hard setback; none is terminal (Pillar 7).

Secession built 2026-09-23 (`src/politics/secession.ts`), on a mechanism confirmed in session. A rival house that has been slighted enough (`secession.grievances`) and loathes you enough (`secession.attitude`) for enough consecutive rounds (`secession.rounds`) leaves the colony — never while it holds the office, since a house in power has no reason to go. It warns the round before. When it goes its members are away, not dead: their posts fall vacant, their votes leave the council (§9.5), a share of the citizens goes with them (`populationShare`) and Rome thinks the less of the colony (`romeFavour`). Its regard neither sours nor mellows while it is away; a bribe still reaches it. It hears terms again after `awayRounds` if its regard has been mended to `returnAttitude`, and comes home regardless by `maxAwayRounds` — Pillar 7 forbids a permanent loss, and §14 does not bank a house vanishing. On its return its grievances are forgotten. All numbers are first-pass defaults, flagged for tuning.

### 9.8 Gods ✅

Roman pantheon, as a colonia in year 0 would have it. Each god maps to a domain:

| God | Domain in play |
|---|---|
| Jupiter | authority and gravitas |
| Mars | defence |
| Venus | family, marriage, heirs |
| Mercury | trade |
| Ceres | grain |
| The cult of Augustus | Roman favour |

❓ One temple with a chosen dedication, or a temple per god (more buildings, more art). Piety stat governs the effect.

**The gods act** *(direction, 2026-09-27)*. Each temple dedication gives a standing effect and an answered sacrifice — Mars a defence blessing, Ceres a harvest, Mercury a trade windfall, Venus fertility for the house, Jupiter gravitas, the cult of Augustus Roman favour. Piety governs how often and how well. ❓ Contents, costs and cooldowns in a later patch; this section records only that magic in Rome III means the gods, and nothing else (Pillar 9). The ❓ above — one temple or one per god — stays open, as does §15.8.

---

## 10. Art direction ✅ *(rewritten 2026-09-27, the pivot)*

- **Style:** stylised, hand-painted, exaggerated — chunky proportions, oversized roof tiles, thick walls, heavy warm outlines, saturated terracotta against cool cream stone, painted texture on every surface, lively clutter (vines, lanterns, awnings, crates). Cozy and adventurous. The register of a hand-painted MMO building, not a historical illustration.
- **Anchor:** `assets/style/anchor-v2.jpg` (the stylised praetorium). Every building sprite is an edit of it. `anchor-v1.jpg` and every sprite derived from it are retired.
- **Content stays Roman.** Eagles, red-and-gold vexilla, oil-lamp and brazier flame, Latin inscriptions. Nothing from any game's heraldry, palette or magic. Nothing lifted from Warcraft, Rome II, Travian, Anno or any other game.
- **Palette:** re-sampled from anchor-v2; the design-system tokens are re-derived from it.
- **Base map:** regenerated in the new style, after the grid and zones exist, so it is painted to the layout rather than the layout fitted to it.
- **Sprites, plates, anchors, tier-3 animation and the pipeline:** unchanged from the previous §10, kept below.
  - **Sprites:** raster PNG with alpha, processed by `tools/artgen/` (key the white background, trim, find the ground plate, anchor, scale, manifest); prompts in `assets/style/PROMPTS.md`. Each sprite is one structure standing on its ground plate, the base diamond; the anchor is the plate centre, the midpoint of the plate's left and right corners. isobuild is retired for buildings. SVG remains for the world map, the UI and animated overlays. ✅ 2026-09-16.
  - **Animation:** tier 3 only. A small reusable set (smoke, a moving crane, a water wheel, a swinging sign) drawn as SVG overlays on top of the PNG sprite, via CSS keyframes and the Web Animations API, positioned from the same anchor. ✅ 2026-09-16.
- **Portraits:** monochrome ink-and-wash busts, one accent colour per family. Generated as a batch from one fixed style prompt and committed to the repo. Unchanged.
- **World map:** SVG hex grid in the same palette. Unchanged.

⚠ *Flagged 2026-09-27:* `assets/style/anchor-v2.jpg` does not exist in the repo. The upload that carried this patch added `docs/rome_anchor_1.jpg`, a 2760×1504 stylised Roman complex whose pediment inscription reads, to the eye, *FORVM COL. FELICIS* — a forum by its lettering, where this section calls the anchor the praetorium (🟡 read by eye, not verified). It has not been moved, renamed or processed — that belongs to the art session. The old sentence "the plate's width equals the tile width" is dropped: since the plot-size change a plate is `plateTiles` (1.75) layout tiles wide (CLAUDE.md, Conventions), and §4.5's footprints (1×1 to 3×3 cells) will redefine it again. `tools/artgen/palette.json` and `docs/PALETTE-NOTES-isobuild.md` hold the palette the re-sample replaces.

*Tier-1 stills, 2026-09-27.* Mathias's new-style tier-1 stills are in `assets/src/`, mapped to sprites in `assets/src/stills.json` and placed by `npm run assets:stills`. Every still that passes the plate assertion is placed, and a building without one keeps its drawn sprite. Placed: castellum, forum, barracks, cellars, clay works (from `clay_pit`, 🟡), farm, granary, insulae, iron mine, lumber camp, market, temple (from `shrine`, 🟡), warehouse and waystation. The warehouse render carries a 15×112 px black bar on its top-right edge; the pipeline crops it before keying, and the file is not edited. **Fails the plate assertion, not placed:** `library_t1.jpg`, slopes +0.548 / −0.553 against a tolerance of ±0.45–0.55. The assertion was not loosened. Tiers II and III keep their drawn sprites, so a colony mixes the two styles until those stills exist. The Barracks' tiers II and III are drawn placeholders.

---

## 11. Tech ✅

- **Stack:** Vite + TypeScript, modular. SVG rendering throughout (village and map). React only if the panel UI grows heavy enough to want it — decided when the first complex panel exists.
- **State:** one store, serialised to JSON. That JSON is the save file.
- **Persistence:** v0 — localStorage plus JSON export/import (the Owner plays across three devices). v0.x — Supabase sync behind magic-link auth. Vercel hosts the app; it does not hold player state.
- **Data-driven balance:** `data/resources.json`, `data/buildings.json`, `data/research.json`, `data/requests.json`, `data/tribes.json`, `data/families.json`, `data/events.json`. Game logic reads data; it never hard-codes a cost or a name.
- **Asset pipeline:** `tools/isobuild/` (Python) generates building SVGs from the building table.
- **Deploy:** GitHub → Vercel auto-deploy, stable URL for playtesting.

---

## 12. Session design ✅

- Target: a 15-minute daily session, extendable to an hour by choice.
- A 15-minute session: collect, set one construction, prepare a political action, resolve one round, leave.
- An hour: multiple rounds, scouting, intrigue, marriage negotiations, site claims.

---

## 13. Versions

| Version | Scope |
|---|---|
| **v0 — vertical slice** | Village, five resources, ~12 buildings, storage, timed construction with hired help, Rome requests, one tribe with envoys and raids, two families (yours + one rival), five council posts, gravitas, basic intrigue (bribe, promote, demote), abstract raids, localStorage save with export/import. No world map. |
| **v0.1** | World map with scouting and "?" sites, site claiming and garrisons, all three tribes with the like/hate web. |
| **v0.2** | Research system and Library ✅. Families three and four ✅. Marriage ✅, heirs by birth and adoption (§15.7 open), bodyguards ✅, assassination ✅. Top-office challenge ✅. |
| **v0.3** | First content drop: stone, marble, salt and their buildings; first processed goods. Temples per god. Supabase sync. |
| **later** | Offence and Rome-ordered attacks. Citizen tiers. Mobile. Latin UI names. Traits. The Teutoburg event. |

---

## 14. Banked ✅ (defer, don't drop)

Processed goods beyond the first drop · citizen tiers · mobile layout · Latin building names with English tooltips (the forum is always the forum) · offensive combat · Rome ordering attacks on tribes · character traits (Rome II style) · a fifth family emerging · a Teutoburg-scale late-game event · weather · named events for real Germanic leaders · counsel beyond the opening, a standing "what matters now" card (2026-09-24, "not for now") · milestones, the colony's firsts as a reward-free record (2026-09-24) · two great factions in a cold war, later — the Alliance/Horde idea, to be designed fresh under its own name when the time comes (2026-09-27) · in-town roads (2026-09-27) · adjacency rules, ❓ see §4.5 C.3 (2026-09-27) · festivals as a council action 🟡 (2026-09-27, Pillar 9) · the **Blacksmith**, the **Iron works** and the **Stables** (2026-09-27, Mathias): their tier-1 stills are in `assets/src/` and stay unplaced until they have a place in the economy.

---

## 15. Open questions ❓

1. ~~Town name.~~ ✅ Resolved 2026-09-16: Arctown.
2. ~~Calendar floor interval N (§3.3) and the age-per-round lifespan (§3.4).~~ ✅ Resolved 2026-09-15: N = 24 hours; lifespan 120 → 200 rounds. The calendar floor itself was removed 2026-09-25 (§2.11, §3.3).
3. Whether a flavour calendar is displayed and what it counts.
4. Final resource list beyond v0 and the two-step chains.
5. ~~Which five council posts are in v0.~~ ✅ Resolved 2026-09-15: treasury, garrison, works, granary, market.
6. ~~Title of the top office.~~ ✅ Resolved 2026-09-15: *praefectus*.
7. Rounds from birth to adulthood.
8. One temple or a temple per god. (Direction recorded in §9.8, 2026-09-27: the gods act; still open.)
9. ~~Tribe names and personalities.~~ ✅ Resolved 2026-09-15 for v0: the Chatti, raider. The other two are 🟡 pending v0.1 (§7).
10. ~~Map size.~~ ✅ Resolved 2026-09-25 by §5.1: 21 hexes across. (`data/map.json` still has radius 12, 25 across; changed in the map session.)
11. Research tree contents. 🟡 First pass in `data/research.json` 2026-09-20 — eleven nodes, three ranks. Awaiting confirmation.
12. Whether Rome's request to attack a tribe can exist before offence does (recommend no).

---

*Change log:* v0.1 — 2026-09-16 — first codification from two design interviews. Same day: all 🟡 proposals confirmed by the Owner and marked ✅.
v0.1.1 — 2026-09-15 — first implementation session. Open questions 2, 5, 6 and 9 resolved; seven implementation defaults from `docs/CAPSULE-SESSION-2026-09-15.md` confirmed by the Owner and recorded as ✅ in §3.1, §3.3, §3.4, §4.3, §6, §9.4. Inactive family Iulii renamed Valerii (the Iulii are the imperial gens in year 0).
v0.1.2 — 2026-09-16 — town named Arctown (§15.1). CI on every pull request. Dev-only time control documented in the session capsule, not here: it is tooling, not design.
v0.1.3 — 2026-09-16 — §10 art pipeline pivot: buildings are raster PNG sprites from a style anchor via `tools/artgen/`; SVG kept for map, UI and animated overlays; isobuild retired.
v0.1.4 — 2026-09-20 — §9.5 and §9.6 built: the top-office challenge with a live vote count, losing and winning back power, and the full intrigue menu with bodyguards. All four houses (§9.1) and all three tribes (§7) are awake.
v0.2.0 — 2026-09-20 — §4.6 built: the Library, an eighth inner plot to stand it on, and a first-pass research tree (🟡, §15.11).
v0.2.1 — 2026-09-20 — first playtest. §10: the village draws a walled colony with country around it rather than plots on a gradient, and the resource yards carry their trade's clutter and the people working it. Pillar 3: haste is priced against everything the colony produces in the hour, not its tax take alone, which had let any job under eight minutes cost one denarius. §4.1: grain upkeep raised to 0.35 a head an hour, so feeding a growing colony is the constraint it was meant to be.
v0.2.2 — 2026-09-20 — §3.1 amended: a job under way states the time left in rounded words. The no-countdown rule stood from 2026-09-15 until the first playtest overturned it.
v0.2.3 — 2026-09-22 — §10: the country is a painted image (`assets/src/base-map-v1.jpg`) with the roads, square and wall drawn over it. The wall now carries depth and sorts with the buildings — it used to be painted behind them, so a building on the south edge was drawn through it — and it shows the castellum's tier, since §4.4 already calls that "garrison and walls": a bank with no castellum, then a palisade, stone, and a crenellated circuit.
v0.2.4 — 2026-09-22 — §4.4: the castellum is the wall, recorded as a design rule. §10: the wall is shaded by each arc's facing against the top-left light, coursed at tiers II and III, posted at tier I, and the finished circuit flies a standard over the gate.
v0.2.5 — 2026-09-22 — §4.4 **reverses v0.2.4**: the wall is *not* the castellum. Mathias's decision. Wall is a new ✅ building on its own perimeter slot (§4.5 `w1`, at the gate), counting for construction concurrency, and its tier is the walls term of §8.2. The castellum keeps the garrison, the militia pool and the bodyguards, and its tier now drives only its own sprite. Costs, times and per-tier defence are first-pass defaults in `data/buildings.json`, flagged there for a balance pass; the old `raid.wallStrengthPerCastellumTier` is gone, since the wall carries its defence as an effect like every other building.
v0.2.6 — 2026-09-22 — §10: with no wall raised the gate draws no marker at rest and lights only under the pointer, so an unbuilt perimeter slot does not stand as a box in the fields. The Village panel now opens on an index of everything pinned to a slot, raised or not, each entry selecting it — the wall stands at the gate rather than on a plot in a ring, so it was the one building that had to be hunted for.
v0.2.7 — 2026-09-23 — §9.2: heirs by adoption, both routes. A new man for the player's house runs no round; a man taken from another house runs one, and the giving house must consent. Rival houses adopt on the same rule below a floor.
v0.2.8 — 2026-09-23 — §8.2, §9.2: death by raid. The garrison prefect can fall when a raid gets through; discipline eases it, guards do not.
v0.2.9 — 2026-09-23 — §9.7: secession. A slighted, hostile house out of office leaves the colony with a share of the citizens, and comes home once its regard is mended or by a hard limit.
v0.2.10 — 2026-09-23 — §4.4, §4.5, §3.1, §12: the Village panel opens on the colony overview — every building with its tier, the next tier's effect as now → next, cost, time in words and either the action or every gate it fails (the Forum first, then the lane and the shortfall); the two construction lanes at the top, never a queue; what the next Forum tier opens, derived from `requiresForumTier`; Rome's build request marked on its row; and a ledger per resource showing the working behind the header. Placement stays on the map. The plot card gains the same effect words, the build time before you commit, and a way back. Effect words live in `data/effects.json`.
v0.2.11 — 2026-09-23 — §12 built as UX: the opening counsel. A finite line of steps in `data/advisor.json` (🟡 content, first pass) read off the colony rather than stored, shown one at a time on a card that points at the plot, hex or tab and states any shortfall in units; "Enough counsel" puts it away per save. The founding card says who you are from the same file (§1), and the round report ends on "Before you go" — what is under way, who is massing, what is asked, and the hours to the idle round, each once in rounded words (§3.1).
v0.2.12 — 2026-09-23 — §3.2, §3.3, §8.2, §11 built as UX: the reports archive. Every raid, site raid, scout, envoy, vote and letter from Rome is written as a record beside its log line by the same call (`state.reports`, capped by `config.reports.max` 🟡), and every round keeps its before → after ledger (`state.history`, `config.history.max` 🟡). The raid report shows the four named terms of §8.2 with their multipliers folded in and no roll; fear is the observed change. The Log tab is labelled Reports (its id stays `log`): rounds newest first, a folder per kind derived from the report kinds, the log lines inside each round. The round card carries the ledger and the cards; the away digest stacks the rounds with one tally line. Rome's +5 favour and +3 loyalist regard on a completed request move from code to `config.rome` 🟡, values unchanged.
v0.2.13 — 2026-09-23 — §12, §3.1, §4.2, §4.4, §4.5 as UX: the town-and-loop surfaces. The Village tab opens on a Due block — every job under way with its time left, everything landing at the next round, everything at a named round, and the hours to the idle round, each once in rounded words and each a link — from one collector the round card's "Before you go" footer shares. A summary card under it: the Forum's tier as the colony's, the wall, plots raised of eighteen (the wall named, not counted, per §4.5), population from its founding number, holdings with their yield, sites seen, the four houses' standing with the player's marked, Rome, the Library, and the walls against the strongest tribe; no tier total and no chart. The header's muted line gains the wall, the plots and the holdings. A player who returns finds a strip of what the village clock did — amounts, a tier that now stands, a study known, citizens gained — and what full stores turned away, counted in `overflowSinceSeen` and stated on the round card until Continue resets it; no elapsed duration is printed. Tab badges mark a duty and never a spend: Houses (a demand, a house talking of leaving, one ready to return), Tribe (massing), Council (a vote pending; 🟡 not merely out of office), Rome (a letter unanswered).
v0.2.14 — 2026-09-24 — rulings on the Tribal Wars patch. §6: declining a request moves no favour (it had cost 5, against "no punishment"); the report names the aid forgone and the loyalist house's regard. §3.1: no time estimates, ever — horizon times are refused, not banked. §14: counsel beyond the opening and milestones banked. §6 says the loyalist house's regard falls, not its standing (§9.1). §3.1: a job's own length before it starts stays.
v0.2.15 — 2026-09-24 — §6, §3.2: Rome's first letter stands at the founding, issued at round 0; the first round no longer brings it. The one act by another actor outside a round, as part of the founding. Its 80 wood against the castellum's is kept as an opening decision. A round the player calls that brings no news raises a short card saying the council met and nothing was decided.
v0.3.0 — 2026-09-25, applied 2026-09-27 — the holdings patch (`docs/DESIGN-patch-2026-09-25-holdings.md`). §2.11 is new: absence costs opportunity, never assets, and it governs every other section. §3.3 is amended: the idle round and the calendar floor are gone *because of* §2.11 — a later session must not restore them, and a replacement needs Mathias's sign-off; a player who never convenes is not playing, not exploiting. §3.1, §3.2 and §15.2 lose their idle-round mentions. §5 is rewritten as holdings: 21 hexes across and a top-level view, site kinds that differ in kind, three holding tiers drawn in SVG with one holding under construction alongside the colony's lanes, roads, and the contest rule — a held site changes hands only in a round the player convenes (§15.10 resolved). Doc only — none of §5 is implemented, and the idle round's removal from code and `data/config.json` is in PR #13, not in this change. Flags recorded in §3.3 and §5, not reconciled.
v0.3.1 — 2026-09-27 — the pivot patch (`docs/DESIGN-patch-2026-09-27-pivot.md`). Pillar 9 amended: mythic Rome — the gods act; no wizards, spells or mana; festivals 🟡. §4.4: the Praetorium is the seat and its tier is the colony's; the Forum absorbs the Market — ✅ confirmed by Mathias in session, 2026-09-27; unique and repeatable buildings; footprints. §4.5 rewritten: the town grid, three zones, adjacency ❓, a zooming view. §10 rewritten: stylised hand-painted art from `anchor-v2`, content still Roman, palette and base map re-derived; sprites, plates, anchors, animation and pipeline unchanged. §9.8: the gods act, contents ❓. §14: two great factions in a cold war, in-town roads, adjacency rules and festivals banked. Doc only — none of §4.4's seat change, §4.5 or §10 is implemented. **Invalidated by this patch, listed and not deleted** (later sessions replace them): the rings and perimeter slot `w1` in `data/layout.json`; the circular wall geometry in `src/render/environment.ts` (`createWall`, its isometric circle, `wallLight`); `assets/style/anchor-v1.jpg` and `anchor-v1.png`; the 43 building sprites in `assets/buildings/` derived from anchor-v1; `assets/src/lumber-camp-t1.jpg`, `lumber-camp-t3.jpg` and `lumber-camp-t3-trees.mp4`; the base map `assets/src/base-map-v1.jpg`; and the palette sample, which is `tools/artgen/palette.json` 🟡 (identified by this session, not named by the patch). Flags recorded in §4.4, §4.5 and §10, not reconciled: the building count (fourteen stated, fifteen listed), barracks and the Harbour, the Forum as seat and the Market as trade in code, repeatable resource buildings bounded by map sites, and `anchor-v2.jpg` missing from the repo.
v0.3.2 — 2026-09-25, merged 2026-09-28 (#13) — §3.3 reversed: no round runs unattended. The idle round, its two config values and every surface that spoke of it are gone; a save loaded after any absence is at the round it was left at, and the dev multiplier scales the village clock only. The UI no longer redraws on the village tick: header, panel, dev bar and news card are patched in place, so the tick never replaces the element under the pointer, the button being clicked or the section being scrolled.
v0.3.3 — 2026-09-26, merged 2026-09-28 (#14) — §3.3: the absence pillar (§2.11) recorded as the reason the idle round is gone; the 'exploit' ruled not an exploit; no replacement mechanic without Mathias's sign-off. §3.1: the "Since you were last here" strip is anchored to when the player last saw the colony (`lastSeen`) and shows only after `returnStrip.minGapMinutes` (30, a tuning default).
v0.3.4 — 2026-09-27, merged 2026-09-28 — the grid session. §4.5 C.1, C.2 and C.4 built. The town is a grid of cells inside a rectangular wall. Its size follows the wall's tier (🟡 6/7/8/9) and it grows away from the river. Buildings are placed on free cells by footprint (🟡 2×2 for the forum, castellum and temple), unique or repeatable, and resource sites stay fixed outside the wall. The view zooms in to the old frame. §4.4 and §4.5, Mathias: the **Barracks** is added, a repeatable 1×1 building and the military counterpart to farms, each one adding to the militia pool (§8.1; §5.2's troop field is no longer the only other way to grow it). One edge of the grid is a **riverbank** reserved for a future harbour, 2×1 and placed only there; no harbour building yet. 🟡 The river edge, the bank's depth and the gate's side are Claude's first pass. §14: the Blacksmith, Iron works and Stables are banked, and their stills stay unplaced. §10: every new-style tier-1 still that passes the plate assertion is placed; the library's fails and keeps its drawn sprite. Saves from the ring layout load onto the grid, and `saveVersion` is now 2.
v0.3.5 — 2026-09-28 — overnight item 0. §4.4: the Praetorium is the seat and its tier the colony's (B.1, built); the Forum takes the Market's role and the Market is removed; costs rise per copy of a repeatable building (🟡 0.25 a copy). §4.5 C.3: adjacency scaffolding, no rules. Save format 3; older saves reset under the save rule.
v0.3.6 — 2026-09-28 — overnight item 1. §5.1–5.3 built: a 21-hex top-level map; "?" resolves to a site, a hoard or a camp; every §5.2 kind (troop field, watchtower, ford, shrine, one-shot ruin, idle quarry and salt spring); camp, station and fort in a third lane, drawn in SVG. Shrine gravitas to the player's house (❓ no temple post); a ford's envoy speed waits for longer envoy roads (❓). Save format 4.
v0.3.7 — 2026-09-28 — overnight item 2. §5.5 built: tribes take unclaimed sites on the village clock (away or not), up to a share of the map; a held site changes hands only in a round the player convenes, its threat declared a round before and decided after the player's move; garrisons never exceed the militia pool. §3.3's code note updated. Save format 5.
v0.3.8 — 2026-09-28 — overnight item 3. §5.4 built: roads laid hex by hex outward from the colonia, one segment at a time in a road lane of its own (🟡), for denarii and wood; a holding joined by an unbroken road is harder to raid, yields more, and eases trade; envoy speed waits (❓). Save format 6.
