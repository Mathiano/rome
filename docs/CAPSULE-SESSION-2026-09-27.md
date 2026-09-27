# Session capsule — 2026-09-27

The two design patches applied to DESIGN.md, doc only. Branch cleanup
and the repository setting were asked for; the proxy blocks both.

## Done: PR #15 (`design/pivot-2026-09-27`), CI green

- **Holdings patch → v0.3.0.** §2.11, the absence pillar, is new.
  §3.3 is amended to say the idle round is gone *because of* §2.11 and
  must not come back without Mathias's sign-off. §5 is replaced by
  holdings. §15.10 is resolved at 21 across.
- **Pivot patch → v0.3.1.** Pillar 9 now reads mythic Rome. §4.4 gets
  the seat: B.1 is ✅, confirmed in session (the Praetorium is the seat,
  the Forum absorbs the Market), plus repeatables and footprints. §4.5
  is rewritten as the town grid. §10 is rewritten as stylised art from
  anchor-v2. §9.8 records that the gods act. §14 banks four items.
- **CLAUDE.md** has Pillar 9 amended and Pillar 11 added.
- **Not implemented:** holdings §B, pivot §C and pivot §D.
- **The branch.** The rename was done by pushing `Mathiano-patch-1`'s
  commit as `design/pivot-2026-09-27`, because renaming is
  proxy-blocked. The upload commit also carries both patch files and
  `docs/rome_anchor_1.jpg`, left as uploaded.

## Flags, recorded in DESIGN.md, not reconciled

- §3.3, "the world still moves": other actors act outside rounds,
  against Pillar 2 and §3.2. Rome requests expire, but §6 and the code
  have no expiry. Nothing in code moves the world while the player is
  away.
- §4.4: "fourteen" buildings, but fifteen are listed. Barracks and the
  Harbour are dangling. In code the seat is the Forum (`forumTier`,
  `requiresForumTier`), and trade reads the Market (`envoys.ts`).
- §4.5: repeatable resource buildings are bounded by map sites. The
  rings, the circular wall and `w1` remain in code and in CLAUDE.md's
  Conventions.
- §5: the code differs on size, view, site kinds, tiers, roads and
  militia allocation.
- §10: `anchor-v2.jpg` doesn't exist. The upload's pediment reads
  FORVM (🟡 by eye), not praetorium.

## Invalidated, listed in v0.3.1, not deleted

- `layout.json`'s rings and `w1`
- the circular wall in `environment.ts`
- `anchor-v1.*` and the 43 sprites derived from it
- the `lumber-camp-*` sources
- `base-map-v1.jpg`
- `tools/artgen/palette.json` 🟡

## Blocked: needs Mathias

- **Branch deletion.** `git push --delete` and the REST ref delete both
  return 403 from the session proxy. Nothing was deleted. To delete:
  - `claude/tender-faraday-68c706`
  - `claude/art-pipeline-pivot`
  - `claude/heirs-by-adoption`
  - `claude/death-on-the-wall`
  - `claude/secession`
  - `claude/capsule-2026-09-23`
  - `claude/tribal-wars-patch`
  - `claude/rome-decline-forgone`
  - `claude/rome-writes-at-founding`
  - `claude/away-catch-up`
  - `claude/news-card-steady`
  - `Mathiano-patch-1`
  - `claude/colony-depth`, which has no PR but is fully contained in
    main (0 ahead). Mathias's call.
- **"Automatically delete head branches."** The settings write is
  proxy-blocked (`delete_branch_on_merge` is false).

## Next

1. Merge #15 first.
2. Then I merge main into #13 and #14 and resolve DESIGN §3.1/§3.3,
   the change log (renumbered after v0.3.1) and CLAUDE.md pillar 11 in
   §2.11's favour.
3. Then the grid session (§4.5) and the v0.1 map session (§5).

Three PRs are open (#13, #14, #15). That is one over the limit of two,
because of this request.
