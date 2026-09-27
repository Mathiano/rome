# DESIGN patch — the absence pillar and the holdings map

**Decided by Mathias, 2026-09-25.** Everything below is ✅ unless marked otherwise. CC integrates it into `docs/DESIGN.md` in place, keeps the marks, adds a change-log entry, and does not implement beyond what the sections say.

---

## A. New pillar — §2.11

**11. Absence costs opportunity, never assets.**

Nothing the player holds may be taken while they are away. Not resources, not population, not characters, not sites, not the top office. What absence costs is what the player *would have gained*: production above the storage cap, a Rome request that expired unanswered, a site a tribe claimed first, a marriage another house arranged.

Returning after a week is finding letters on the desk, not damage in the yard.

This pillar governs every other section. Where an older rule conflicts with it, this one wins and the older rule is amended.

### Consequences to apply

- **§3.3 is amended.** The idle round is removed. No political round runs without the player. Characters do not age, die, or lose office while the player is away, because ageing advances per round (§3.2) and no round runs unattended.
- **The world still moves.** While the player is away, tribes shift disposition, tribes claim *unclaimed* sites, Rome issues and expires requests, and rival houses form intentions. None of this removes anything the player holds. It rearranges the board around them.
- **The digest.** On return, the player is shown what happened as a short report — headline cards first, totals after — including what was lost to full stores, and which opportunities have closed. One report, not a stack of round cards.
- **Not an exploit.** A player who never convenes is not exploiting the game; they are not playing it. There is no punishment for absence, and none is to be added.

---

## B. §5 — The world map, rewritten

The colonia is the only city. Everything else on the map is a **holding**: a place the colony works, watches or garrisons. Holdings differ in kind, not only in yield, so the choice of which to take and which to defend is a real one.

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
| Troop field | militia | adds to the militia pool (§8.1) **without drawing on population** — the one way to grow the pool other than the castellum |
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

### 5.5 Claiming, holding and contest ✅

- **Claim:** a council action plus denarii, at the next round.
- **Hold:** a small denarii upkeep. Garrisoning draws from the militia pool (§8.1), which cannot cover everything.
- **Distance matters:** raid exposure rises with distance from the colonia and falls with a road connection (§5.4).

**The contest rule, which follows from §2.11:**

- An **unclaimed** site may be taken by a tribe at any time, including while the player is away. That is a missed opportunity and is permitted.
- A site the player **holds** can only change hands in a round the player is present for. A tribe may move against it, but the resolution — including the player's chance to allocate the militia pool against it — happens when the player next convenes.
- A holding is therefore never lost unattended. It may be lost in front of the player, badly, having been under-garrisoned. That is the player's decision and it stands.

### 5.6 Why one city ✅

The colonia is the only place that builds, houses population and holds a council. Holdings never become cities. This keeps the political layer singular — one council, one set of families, one seat to fight over — and prevents the game from turning into a management problem of many towns.

---

## C. Integration notes for CC

- Apply §A to `docs/DESIGN.md` §2 and amend §3.3 accordingly; remove the idle-round mechanic from the doc and from `data/config.json` if it has landed in code, and say what you removed.
- Replace the existing §5 with §B.
- Add a change-log entry recording that §2.11 is new, §3.3 is amended, and §5 is rewritten.
- Do not implement any of §B in this pass. The v0.1 map session comes after this patch is merged.
- Flag anything in here that contradicts code or doc as it now stands, rather than silently reconciling it.
