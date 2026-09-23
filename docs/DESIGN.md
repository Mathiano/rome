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
9. **Keep it real.** Roman names, Roman gods, Roman practices (adoption, patrilineal families, the castellum). Anachronisms are flagged, not silently adopted.
10. **PC first, landscape.** Mobile is a later decision.

---

## 3. Time model

Two clocks. The player sees only one.

### 3.1 The village clock — real time, invisible ✅

Resource accrual, construction timers, site yields and research progress run on wall-clock time, including while the game is closed. Offline accrual is capped by storage capacity (§4.2), not by a time cap. A job under way shows its progress, the time left in rounded words, and the rush price; the council tab shows hours until the idle round. There is still no ticking clock and no second-by-second countdown, and the village clock itself is never displayed. ✅

*Amended 2026-09-20*, after the first playtest. This read "No countdowns. Construction shows progress and the rush price… No other time is displayed" and was ✅ from 2026-09-15. The playtest overturned it — *"you should be able to see the minutes remaining here"* — on the grounds that hiding the wait did not make the colony feel calm, it left the player unable to plan around it. What survives is the intent: time is stated once, in words, rounded to what a player can act on ("about 40 minutes left", "about 2.5 hours left"), and never counted down.

### 3.2 The political clock — rounds ✅

A **round** is triggered when the player makes a political move. Sequence within a round:

1. Player acts.
2. Each rival family acts or passes.
3. Each tribe acts or passes.
4. Rome acts or passes.
5. Ages advance (§9.2); round-based events resolve.

Any number of rounds may run per day. Political actions can be **prepared** at any time (queue an intrigue, dispatch an envoy, send scouts) and **resolve** at the next round. Preparation fills a session; resolution stays turn-based.

### 3.3 Calendar floor ✅

If no round has run in N real hours, an **idle round** runs automatically: opponents act, the player does not. This closes the exploit where a player never opens the council and therefore never ages, is never raided and never faces a challenge. ✅ N = 24 hours (`data/config.json` `calendarFloorHours`). ✅ After a long absence at most 7 idle rounds run (`idleRoundsMaxCatchUp`), so a month away is not thirty raids.

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

- ~12 buildings in v0, three visible tiers each (36 sprites). Tier 3 animates (§10).
- Construction is timed. Finishing early costs denarii per Pillar 3.
- **Concurrency:** one building and one resource field may be under construction at the same time — Travian's actual Roman-faction rule ✅. No build queue beyond that.
- Resource buildings sit on their site: the clay works on the clay bank, the mine on the iron seam.
- **The wall is a building of its own, not the castellum.** ✅ 2026-09-22, decided by Mathias. They are two things. The castellum stays in the centre and garrisons the colony — militia pool, bodyguards — and its tier drives only its own sprite. The **Wall** is the circuit, and it is raised separately: it stands on a **perimeter slot**, which belongs to no ring and sits at the gate, and it counts as a building for the concurrency rule above, so the colony chooses between raising its walls and raising anything else. Its tier is the *walls* term of §8.2 defence strength. The circuit at each tier: **none** is the ditch and bank a colonia throws up on arrival; **I** a timber palisade on that bank; **II** coursed stone with towers; **III** the full crenellated circuit, which flies the colony's standard over the gate as its §10 tier-3 animation. Adding it to the list below needed this decision because that list is ✅ confirmed.

**v0 building list ✅** — confirmed 2026-09-16; edit freely as the doc evolves:

| Building | Ring | Role |
|---|---|---|
| Forum (with basilica) | centre | seat of the council; its tier is the colony's tier |
| Castellum | centre | garrison, militia pool, bodyguard pool |
| Wall | perimeter | the circuit; its tier is the walls term of §8.2 defence strength |
| Warehouse | inner | storage |
| Granary | inner | storage |
| Cellars | inner | hidden storage |
| Insulae (housing) | inner | population cap |
| Market | inner | trade with tribes and Rome |
| Temple | inner | gods (§9.8), piety, gravitas |
| Waystation | inner | Rome requests; road link |
| Lumber camp | outer | wood site |
| Clay works | outer | clay site |
| Iron mine | outer | iron site |
| Farm | outer | grain site |

Wall ✅ added 2026-09-22 (see the rule above). Library (research, §4.6). ✅ Built 2026-09-20: inner ring, three tiers, and an eighth inner plot added to §4.5's layout to stand on. Its tier is the gate on how far the tree opens, and it reads faster at each tier.

### 4.5 Layout ✅

Three fixed rings, expanding outward as the colony grows:

1. **Centre:** Forum and Castellum, side by side.
2. **Inner ring:** buildings. Fixed slots; the player chooses which building fills which slot.
3. **Outer ring:** fields, mines, lumber. Fixed slots tied to resource sites.

Outside the three rings there is one **perimeter slot**, `w1`, pinned to the Wall ✅ 2026-09-22. It is not a plot: it carries no ground plate, it stands on the circuit itself at the gate, and it exists so the wall can be selected and raised like any other building.

This is Travian's fixed-slot model with player-chosen placement, and it preserves the concentric-rings idea from the earlier castle-builder design.

### 4.6 Research ✅ (system) / ❓ (contents)

A research system driven by three inputs: denarii (pay for experiments), research scrolls (earned from Rome rewards, ruins on the map, and trade), and the Library building. The tree is data-driven (`data/research.json`). Research is never lost, even through collapse and Rome's intervention. ❓ Tree contents — first pass in v0.2.

Built 2026-09-20 (`src/village/research.ts`). A study runs on the village clock like a construction — real time, no political round — and can be finished early for denarii at the same Pillar 3 price. One study at a time. A node costs denarii and scrolls, needs a Library of its own rank, and needs whatever it stands on. Research and buildings share one vocabulary of effects, so anything already reading a building effect picks research up unchanged.

🟡 **Tree contents, first pass, 2026-09-20.** Eleven nodes in three ranks, written as a data-file default in an unattended session (CLAUDE.md, *Ways of working*) and listed in `docs/CAPSULE-SESSION-2026-09-20.md` for confirmation. §15.11 stays open until Mathias ratifies or replaces them.

---

## 5. World map

### 5.1 Structure

- Hex grid. ❓ Size — proposed ~25 across.
- The player's town map is fully visible. World-map terrain is visible from the start; **sites are hidden as "?"** until scouted. A scouted "?" resolves to treasure, a bonus site, or a barbarian camp that punishes the scout.
- Tribal villages are never shown on the map. Tribes are present through envoys, raids and contested sites.

### 5.2 Sites ✅

All of these are in, arriving over versions: forest, quarry, clay bank, iron seam, salt spring, river ford (trade route — non-resource effect), shrine (gravitas — non-resource effect), ruins (research scrolls).

### 5.3 Claiming and holding ✅

- **Claim:** a council action plus denarii.
- **Hold:** a small denarii upkeep. Defending a site is the expensive part: garrisoning it draws from the militia pool (§8.1). The player is meant to be forced to prioritise which sites get real protection.
- **Distance matters:** exposure to raids rises with distance from the colonia.
- **Lose:** a tribal raid on the site, or a contest at council.

---

## 6. Rome ✅

An institution, not a person. Rome wants the colony to succeed and is not abusive or demanding.

- **Requests:** deliver resources, host a garrison, build a road or waystation, send recruits, host a visiting official. ❓ Ordering an attack on a tribe — banked until offence exists (§8.3). A hand-authored progression of ~15 requests plus random filler.
- **Rewards:** both unique items (catapult, engineer, veteran cohort) and unlocks (permission to build baths or an aqueduct, citizenship grants for characters, research scrolls).
- **Ignoring Rome:** no punishment. You forgo aid you will sorely miss, and the loyalist family's standing falls.
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

One pool of men-at-arms, sized by population and the Castellum tier, with three sinks: **home defence**, **site garrisons** (§5.3), **bodyguards** (§9.6). Every allocation is a trade-off.

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

---

## 10. Art direction ✅

- **Buildings:** ✅ 2026-09-16 — raster PNG sprites with alpha, generated from a style anchor (`assets/style/anchor-v1.jpg`; prompts in `assets/style/PROMPTS.md`) and processed by `tools/artgen/` (key the white background, trim, find the ground plate, anchor, scale, manifest). Each sprite is one structure standing on its ground plate, the base diamond; the anchor is the plate centre, the midpoint of the plate's left and right corners; the plate's width equals the tile width. Roman grammar as before: rectangular footprints, columns and porticos, terracotta roofs. isobuild is retired for buildings. SVG remains for the world map, the UI and animated overlays.
- **Animation:** tier 3 only. A small reusable set (smoke, a moving crane, a water wheel, a swinging sign) drawn as SVG overlays on top of the PNG sprite, via CSS keyframes and the Web Animations API, positioned from the same anchor. ✅ 2026-09-16.
- **Portraits:** monochrome ink-and-wash busts, one accent colour per family. Generated as a batch from one fixed style prompt and committed to the repo.
- **World map:** SVG hex grid in the same palette.
- **Nothing lifted** from Rome II, Travian, Anno or any other game. Reference, never copy.

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

Processed goods beyond the first drop · citizen tiers · mobile layout · Latin building names with English tooltips (the forum is always the forum) · offensive combat · Rome ordering attacks on tribes · character traits (Rome II style) · a fifth family emerging · a Teutoburg-scale late-game event · weather · named events for real Germanic leaders.

---

## 15. Open questions ❓

1. ~~Town name.~~ ✅ Resolved 2026-09-16: Arctown.
2. ~~Calendar floor interval N (§3.3) and the age-per-round lifespan (§3.4).~~ ✅ Resolved 2026-09-15: N = 24 hours; lifespan 120 → 200 rounds.
3. Whether a flavour calendar is displayed and what it counts.
4. Final resource list beyond v0 and the two-step chains.
5. ~~Which five council posts are in v0.~~ ✅ Resolved 2026-09-15: treasury, garrison, works, granary, market.
6. ~~Title of the top office.~~ ✅ Resolved 2026-09-15: *praefectus*.
7. Rounds from birth to adulthood.
8. One temple or a temple per god.
9. ~~Tribe names and personalities.~~ ✅ Resolved 2026-09-15 for v0: the Chatti, raider. The other two are 🟡 pending v0.1 (§7).
10. Map size.
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
