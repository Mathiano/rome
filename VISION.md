# Vision — Arctown

*What this game is, and which way to lean when DESIGN.md doesn't say. DESIGN.md is the rulebook; this is the reason behind it. Where they disagree, DESIGN.md wins and the disagreement is flagged to Mathias.*

*Drafted by Claude from Mathias's decisions, 2026-09-27. Mathias approves it before it is binding.*

---

## The game in one breath

You are a Roman family governing a colony on the Germanic frontier in year 0. You build the town, work the land around it, stake claims across a map of holdings, and hold your seat against three rival houses who are your allies and your threat at once. It is cozy and adventurous to look at, sharp underneath, and it never punishes you for having a life.

## What it is

- **A town you shape.** One city inside a rectangular wall, never enough room. Where you place things, and which things you build more of, decides what kind of colony you run — trade, military or learned.
- **A map you grow into.** Holdings, not cities: forests, quarries, troop fields, watchtowers, shrines, fords. Connected by roads you build segment by segment over weeks.
- **A table of rivals.** Four families on the same rules. Posts, gravitas, marriages, heirs, dedications, coups. The politics carry the tension.
- **Mythic Rome.** The gods answer. Magic means Mars, Ceres, Mercury, Venus, Jupiter and the cult of Augustus acting through temples and piety — nothing else.
- **Fifteen minutes a day, or an hour if you like.** Collect, place, decide, convene, leave.

## What it is not

- Not a mobile builder with the monetisation removed. No premium queue, no energy, no timers-as-gameplay, no daily-login obligation.
- Not a fantasy game. No wizards, spells, mana, elves, glowing runes.
- Not a many-city management game. One city, one council, one seat.
- Not a clicker. More levels of the same building is not depth.

## The feel gate

Every feature passes these before it ships:

1. **Absence costs opportunity, never assets.** Coming back after a week is letters on the desk, not damage in the yard.
2. **Cozy first, knife second.** Festivals, games and dedications before assassination. The knife is still there.
3. **A decision, not a number.** A feature earns its place by adding a real choice with a cost. A bigger number is not a feature.
4. **Legible.** A rival's motive, a raid's strength, a building's effect — shown before you commit, in words.

## Where skill lives

Skill in this game is **allocation under scarcity, with the threat shown in advance.** Several scarce things compete for the same moments:

- **Plots inside the wall** — every extra farm is a barracks you didn't build.
- **The militia pool** — home, holdings and bodyguards share one number that never covers everything.
- **Political actions** — gravitas spent on one move is not spent on another.
- **Storage** — what you fill before you log off shapes what you come back to.
- **Placement** — once adjacency exists, where a building stands matters as much as whether it exists.

A skilled player reads the board and concedes the cheapest loss. An unskilled one upgrades whatever is next.

## Where depth lives

In layers that cost no new art wherever possible: research, tier-3 specialisation, the dynasty across generations, the holdings map and its roads, and content drops that each bring a new resource with its buildings. **Not** in more tiers per building.

## Art

Stylised, hand-painted, chunky and warm; Roman in every detail. Every building is an edit of `anchor-v2`. Art is the slowest resource in the project, so when two designs are equal, choose the one that needs fewer new images.

---

## When unsure, lean this way

For Claude Code, in order:

1. **Read DESIGN.md first.** If it answers the question, follow it. If it contradicts this document, follow DESIGN.md and flag the contradiction.
2. **Never cross the feel gate.** No punishment for absence, no visible clock beyond §3.1, no shape that resembles pay-to-win.
3. **Default in data, flag in the capsule.** A missing number or rule becomes a `_tuning` default in `data/`, listed in the capsule for Mathias. Never a hard-coded guess.
4. **Don't invent content.** Names, gods' effects, adjacency rules, tribe personalities: propose, don't decide.
5. **Choose the option that creates a decision** over one that adds a modifier.
6. **Choose data over code, and no-art over new art.**
7. **Choose Roman over convenient,** and flag any anachronism.
8. **Choose smaller.** One feature per PR. Stop at the scope given, even with time left.
9. **Ask rather than guess on anything irreversible** — save formats after 1.0, deleted systems, pillar changes.

## Not now

Offence and attacks on tribes · the two-factions idea · citizen tiers · mobile · weather · named historical Germanic leaders · a Teutoburg event. All banked in DESIGN §14; none to be started without Mathias.
