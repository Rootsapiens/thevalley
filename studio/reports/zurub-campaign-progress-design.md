# Zurub — minimal campaign progress contract (2026-10-21)

**Later owner decisions:** the existing Ravens chalk arrow at the barn is Lorenzo's quarry lead; Moreno assigns Elia off-screen. Earlier statements in this report treating those choices as open are historical. This is still a design proposal, not implemented progress persistence.

Design only; no code or test run. This can be built without choosing the quarry clue, inventing Moreno dialogue, or changing approved NPC chronology. The current Hall footage gap in `studio/reports/imad-story-causality-followup.md:13` describes an earlier build: `src/villageMain.ts:747-755` now requires the Hall shot before Chapter 2 completion, and `:64-67,769-775` requires its session marker for the campaign Chapter 3 upload. The direct `?chapter=3` route is intentionally a debug preview. A continuous changed-route playthrough remains unverified (`studio/handoff-log.md:19`; `studio/script/episode-one-gameplay.md:360`).

## Storage and entry rule

Use one versioned `sessionStorage` JSON record, `ov-campaign-v1`, scoped to the browser tab. Do not treat a query string as proof of progress. Parse with schema validation; bad JSON, unknown version, invalid enum, NaN/out-of-bounds coordinates, or an impossible event prefix falls back to **preview** with no earned gates. Keep current `ov-prologue-complete` and `ov-hall-footage` keys temporarily for old menu/tests, but make the new record authoritative for campaign causality.

Exact persisted shape:

```ts
type Progress = {
  version: 1;
  phase: 'prologue' | 'day1' | 'day2' | 'ch2' | 'ch3' | 'ended';
  prologueComplete: boolean;
  day1: {
    omarHeard: boolean;
    medicalCheckComplete: boolean;
    morenoHeard: boolean;
    maryam: {
      stage: 'home' | 'waited' | 'confirmed-moving' | 'square';
      waypoint: number; x: number; z: number;
    };
  };
  day2: { eliaPhotosHeard: boolean; omarWatcherHeard: boolean };
  ch2: { hallFootage: boolean };
};
```

`phase` is earned progress, not the current URL. The Omar event prefix remains the existing `ORDER` source (`src/npcData.ts:87-100`); do not persist seven duplicated event strings. `day1.omarHeard`, medical completion and `morenoHeard` are transition evidence, not a newly staged Omar discovery/transport. On an **earned campaign load**, derive `story.events` from the approved phase and existing runtime mapping; on a **preview load**, preserve current direct-link seed behavior but never write a higher earned phase. This preserves `tests/e2e/day-two-handoff.spec.ts:41-45,68-70`, which enters `?day=2` directly, and `tests/e2e/chapter-three-route.spec.ts:24`, which enters `?chapter=3` directly. Expose `entryKind: 'campaign' | 'preview'` in the test hook beside `src/villageMain.ts:1238`; the current hook reports state but cannot distinguish the two.

At startup, parse URL (`src/villageMain.ts:60-67,106,120-129`) and the record before creating actors. Matching `phase` grants a campaign load; a higher chapter/day URL without earned phase is preview. The legacy `ov-prologue-complete` key may still let the menu start Day 1 (`index.html:210-215`) for existing tests, but a legacy key alone must not imply earned Day 2 or later. No record and no prologue completion follows the current menu path to the Prologue. A completed saved phase may resume at its canonical URL from the menu; a direct earlier chapter is a replay/preview unless the player explicitly starts a new campaign.

## Write points

1. **Prologue → Day 1:** At `src/villageMain.ts:453-457`, after the finished title's R input, atomically save `prologueComplete=true`, `phase='day1'`, then navigate to the base URL. Do not write it at prologue start or root attack onset. Keep the legacy key during transition.
2. **Day 1 beats:** Set `day1.omarHeard` on the existing `omar_mountain` talk (`src/villageMain.ts:580-583`); set `medicalCheckComplete` only when cuffs actually come off (`:635-640`); set `morenoHeard` on `moreno_said` (`:595-597` in current source neighborhood). Before `location.search='?day=2'` at `:642-647`, require all three and persist `phase='day2'`. The existing Day 2 `ORDER.slice(0,6)` seed is a statement that Moreno's assignment happened off screen, not that Lorenzo heard it; do not add an unapproved witnessed line.
3. **Maryam:** Write `stage='waited'` at the eight-second condition (`src/villageMain.ts:657-659`) and `stage='confirmed-moving'` immediately after the second line starts her route (`:572-579`). While moving, periodically save a bounded `{waypoint,x,z}` snapshot after `tickMaryamSearch` (`src/npcTalk.ts:245-270`), not every rendered frame. On square arrival (`src/villageMain.ts:828-829`), write `stage='square'` and the existing endpoint `(43.5,43.0)` (`src/npcTalk.ts:120-129`). Restore before placing the actor/collision box, with `y=groundY(x,z)` and `maryamMoving=true` only for confirmed-moving. Reapply the confirmation/reached flags and objective from the stage. Never restore Maryam to home after confirmed movement, and never infer confirmation from time alone on reload.
4. **Day 2 → Chapter 2:** Write `eliaPhotosHeard` at the existing flag set (`src/villageMain.ts:584-587`), `omarWatcherHeard` only at the gated watcher line (`:588-591`), then save `phase='ch2'` before navigation at `:649-653`. Preserve the current source gate in `src/npcData.ts:245`; old skip-path reports are stale.
5. **Chapter 2 → Chapter 3:** Record `ch2.hallFootage=true` only when the Hall shot is held (`src/villageMain.ts:1162-1169`), but advance `phase='ch3'` only on the filmed cave exit (`:747-755`) before R navigates to `?chapter=3&from=hall` (`:453-458`). Campaign Chapter 3 upload must read this record; the existing `ov-hall-footage` marker can remain as compatibility but cannot by itself certify a campaign entry. Preserve the direct Chapter 3 preview route.
6. **Ending:** Set `phase='ended'` only after the successful upload/spread/detention branch reaches its title (`src/villageMain.ts:769-806,623-629`); an upload failure/replay must not earn completion. This is session progress, not a new canon ending.

## Reset and failure rules

- `restart()` currently clears in-memory flags and rewinds Maryam/Omar actors (`src/villageMain.ts:853-884`). A chapter restart must reset this chapter's corresponding record fields **before** reconstructing state: Day 1 Maryam/Omar/check/Moreno, Day 2 Elia/Omar dialogue, Chapter 2 Hall shot. Preserve completed earlier phases. A deliberate **New Game** clears the whole record plus legacy keys; a plain refresh never does.
- A reload during Maryam's walk resumes from the last valid segment snapshot; clamp waypoint to `0..MARYAM_SEARCH_ROUTE.length`, ensure the coordinate is near that segment, recalculate `y`, and resume toward the next waypoint. If the snapshot is invalid, recover to the last confirmed safe waypoint or square state, never reset to an unconfirmed home state. A reload after square arrival restores her there and keeps the reached flag.
- `?day=2` in a new tab remains the old direct preview for E2E/debug, with Elia present and Omar uncuffed, but UI/test diagnostics should label it preview. It must not silently set the campaign's Day 1 medical/assignment evidence. A direct `?chapter=2` or `?chapter=3` likewise cannot advance earned progress without its prior phase. Query `?chapter=3&from=hall` alone is insufficient; require earned `phase='ch3'` and Hall footage in the record.
- If storage is unavailable or a write fails, keep the scene playable as preview, warn through a small existing-style UI message, and do not promise resumable progress. If a stored phase and URL conflict, prefer explicit preview rather than silently fast-forwarding canon. Never turn an invalid payload into a longer `ORDER` prefix.

Implementation can proceed independently of the quarry clue and the presentation choice for Moreno's assignment. Natural campaign, refresh, direct-preview, and restart tests should be added by the implementing owner; this report does not claim those checks have run.
