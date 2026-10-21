# Khaled — Episode One sound follow-up

**Status:** source-only audit, 2026-10-21. No audio implementation or listening pass in this review. Compared `src/villageMain.ts`, `src/npcTalk.ts`, and `src/villageAudio.ts` with `studio/reports/khaled-episode-one-sound-map.md`.

## Current call sites

- Maryam's `maryam_confirmed_missing` line starts her route and auto-opens her yard gate through `use(gateIndex)`. That entity path already produces the normal latch and creak. Her walk is animated in `tickMaryamSearch`, but no footsteps are emitted for her. Player footsteps are emitted separately; they must not be mistaken for Maryam's.
- Omar's guarded medical check now calls `audio.play('cuffrelease')` when the timer completes and `NPCF.setCuffed` removes the visible cuffs. This closes the sound-map's older “no dedicated sound call” gap. His mountain discovery and transport remain off-screen; no local transport sounds should be added to Day 1 entry.
- The Chapter 2 Hall shot completes with a `chime`; REC start/stop uses `rec`. The suggested Hall stillness and animal detail are still unwired. Cave acoustics and mix have not been heard in a browser.

## One bounded improvement for Rajaie / Zurub

Give **Maryam's actual walk** quiet, distance-attenuated dirt/stone footsteps using the existing `step` voice. In `src/villageMain.ts`, schedule alternating steps only while `a === maryam`, `a.maryamMoving`, `a.walkWeight` is above the movement threshold, and her route position is close enough to Lorenzo to hear. Derive timing from `walkPhase` or a separate cadence timestamp; cap events across fixed-step/frame catch-up so a resumed walk cannot burst sounds. Use `surfaceAt(a.x, a.z)` for the existing step material and scale `k` by listener distance. Stop immediately when Maryam pauses to speak, reaches `maryam-square`, or the route is reset. Do not trigger on the first question, the eight-second wait, or a saved `confirmed-moving` state until she actually advances. Reuse the gate's existing latch/creak rather than playing a second latch.

This is a source-grounded cue for the owner-approved Maryam-to-square gate, with no new dialogue, sample, or voice credits. Before calling it finished, listen through the natural Day 1 walk and reload mid-route; the present review cannot verify loudness or audibility.
