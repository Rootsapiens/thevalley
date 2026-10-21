# Firas — campaign state source audit (2026-10-21)

**Follow-up after audit:** The Prologue completion path now writes the legacy marker only after a successful campaign-record write; `index.html` accepts the earned record if that marker cannot be written. The bug below describes the earlier committed state. This correction has source/typecheck/build evidence only, without a browser run.

Scope: committed `src/campaignProgress.ts`, `src/villageMain.ts`, and the menu's use of the prologue marker in `index.html`. Source review only; no browser run, tests, or runtime edits.

## Confirmed, conditional bug

1. **A failed campaign save can still unlock the Day 1 menu.** At `src/villageMain.ts:468-470`, finishing the prologue writes `ov-prologue-complete` even when `writeCampaignProgress(newCampaignProgress())` fails. The menu checks only that marker (`index.html:211`), so a subsequent Day 1 entry skips the prologue but is classified as a preview because `readCampaignProgress()` returns null (`src/villageMain.ts:65-68`). It cannot earn later chapter phases. This requires the campaign record write to fail while the separate marker write succeeds (for example a storage quota edge case). Couple marker creation to a successful campaign write, or have the menu check the validated campaign record.

## Possible issues / follow-up

1. **The Chapter 3 missing-footage objective is mostly unreachable in a normal campaign.** `readCampaignProgress()` rejects `ch3` without `ch2.hallFootage` (`src/campaignProgress.ts:34-35`), and campaign entry requires matching phase (`src/villageMain.ts:66-71`). Thus the defensive objective/gate at `src/villageMain.ts:340-345, 803, 807, 1111-1112` primarily protects an in-memory state that normal loading cannot create. This is harmless defensive code; its user-facing recovery text does not itself provide a Chapter 2 return control. Keep it if future resume paths may produce this state.
2. **A storage failure after a chapter beat downgrades the run to preview while local state keeps advancing.** `saveCampaignProgress()` changes `entryKind` to preview (`src/villageMain.ts:72-77`); the scene still schedules Day 2/Chapter 2 navigation (`src/villageMain.ts:675-689`) and Chapter 3 gameplay. This is intentionally fail-open for playability, and the warning is displayed, but the end screens do not repeat that progress was not earned. Verify the warning is visible long enough during actual play; do not count the preview ending as persisted completion.

## Checked gates

- Phase and prerequisite validation rejects out-of-order stored records (`src/campaignProgress.ts:27-35`).
- Direct chapter URLs are previews unless phase matches; Chapter 3 additionally requires `from=hall` (`src/villageMain.ts:66-71`). Preview upload is allowed for debug play, but only a campaign run can write the `ended` phase (`src/villageMain.ts:648-650`).
- Chapter 2 requires a local Hall recording before completion (`src/villageMain.ts:782-792`), and the campaign record is marked when the Hall shot succeeds (`src/villageMain.ts:1211-1219`). Restart clears local filming state and the campaign Hall flag (`src/villageMain.ts:894-924`).

Rendered behavior and the continuous Episode One route remain unverified.
