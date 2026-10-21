# Firas — Maryam Day 1 resume review (2026-10-21)

Source-only review. No runtime browser playthrough or tests were run.

## Normal reload

- The first Maryam question starts an eight-second gameplay timer (`src/villageMain.ts:628-631`, `:746-751`). Only the second question after `maryam_waited_without_joseph` can select `maryam_confirmed_missing`; that line starts her square walk, saves `confirmed-moving`, and opens her yard gate (`:640-650`). This preserves the approved cause before departure.
- Campaign records hold `home`, `waited`, `confirmed-moving`, or `square`; the reader bounds the waypoint and coordinates (`src/campaignProgress.ts:9-40`). On page reload, `restoreMaryamSearch` validates a moving position against the route and restores position, floor, stage, motion flag, and facing (`src/npcTalk.ts:135-160`). The Day 1 bootstrap restores heard lines, confirmation flags, objective, and the open gate for a moving walk (`src/villageMain.ts:410-427`). At the square, the tick saves the endpoint (`:925-939`).
- Maryam is in `MOVING_ACTORS` even while standing (`src/villageMain.ts:147-151`). Moving collision boxes and NPC picks sync each simulation step (`:234-240`, `:925-942`); there is no stale static Maryam box on ordinary page reload.

## In-page restart correction

The initial audit mistook `R` for a resume command. It is a **chapter restart**: `src/villageMain.ts:959-966` resets the earned Day 1 record to `newCampaignProgress().day1` and saves it before clearing the live state. `ACTOR_STARTS` captures Maryam's home baseline before campaign walk restoration (`:142-146`), and the actor reset returns her there (`:991-997`). The saved and live states therefore both restart at home; a later reload should not resurrect the walk. No Maryam route or chronology defect is established from this path.

One UI defect remains: `restart()` did not reset the Day 1 objective after clearing progress. The final card could still direct Lorenzo to Omar while Maryam and other Day 1 beats had restarted. The same reset path could leave the Day 2 objective hidden after Omar's completed line. Restore the chapter's opening objective and visibility on `R`. Browser playthrough remains unverified.
