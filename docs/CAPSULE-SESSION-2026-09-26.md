# Session capsule — 2026-09-26

Mathias's rulings on the three open decisions from 25 September. One
PR, #14, stacked on #13. Both are open with CI green, so two PRs: merge
#13 first.

## Blocked: the holdings patch

`docs/DESIGN-patch-2026-09-25-holdings.md` was to be applied per its
integration notes, with §B left unimplemented. It isn't in the repo on
any branch, on this machine, or in any issue or PR. **Nothing of it is
applied**, including §2.11's full text. Waiting on Mathias to commit or
share it.

## Done (#14)

- **Pillar 11, absence.** It's in CLAUDE.md in short form, in Mathias's
  words, with a "Do not" line against restoring the idle round. DESIGN
  §3.3 names §2.11 as the reason the idle round is gone. §2.11's own
  text comes with the patch.
- **Not an exploit.** Recorded in §3.3: a player who never convenes is
  not playing. No replacement mechanic without Mathias's sign-off.
- **"Since you were last here"** is anchored to a saved `lastSeen`
  stamp and snapshot. It is stamped when the strip is put away, and on
  each save while no strip is up. The strip shows only past
  `returnStrip.minGapMinutes` (30, a tuning default). The on-save stamp
  is my addition: without it, a session where the strip never showed
  would leave an old stamp, and the next strip would count play you
  watched.

## Verified

- ✅ 434 tests, build, CI green on #14.
- ✅ Headed Chromium: a reload shows nothing, two hours away shows the
  strip, it's still owed after a reload, and a tab change then reload
  shows nothing.

## Next

Apply the holdings patch once it's available: §2.11's text, then its
integration notes. §B waits for a go-ahead.
