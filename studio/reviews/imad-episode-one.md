# Imad review — Episode One gameplay treatment

**Scope:** Narrative and gameplay review of `studio/script/episode-one-gameplay.md` against `studio/world/chapter-plan.md`, `studio/world/story-canon-ar.md`, `studio/world/characters.md`, `studio/world/regions/*`, `studio/npc/README.md`, owner decisions, and Subzero's current-build report.

**Status:** Review only. These notes do not change canon, approve dialogue, or claim Noor's approval. “Fact” means supported by the cited project source or the current-build report; “Recommendation” is a proposed repair.

**Follow-up (2026-10-20):** The current treatment was revised after the initial review. The Ch2 Hall route, Omar/Lorenzo POV separation, cuff sequence, and evidence ledger findings below are resolved in the treatment and/or current bounded build evidence. See “Current-sequence recheck” at the end for remaining mismatches; older findings are retained as history, not current claims.

## Critical continuity and build mismatches

| Finding | Evidence / problem | Precise repair |
|---|---|---|
| **Resolved in current treatment:** Ch2 omits the Hall discovery. | Earlier text contradicted `chapter-plan.md` and `regions/mountain-caves.md`. Current treatment now routes through breakthrough → Hall → film Joseph/herd → exit via mouth; newest handoff confirms bounded progression through Hall and exit. | No text correction remains. Full visual run and hazard-timing review remain open; see current evidence below. |
| **Resolved in current treatment:** Omar's café start was assigned to Lorenzo. | The current binding-order section correctly assigns the Night 0 café/activity to Omar and starts Lorenzo on Day 1 after those events. | Keep any presentation of past Ravens activity out of Lorenzo's POV unless a sourced recording/first-person scene is approved. The runtime still seeds past Omar events instead of playing them. |
| **Still open in runtime:** Omar's transport was described as playable. | Current treatment now says police find/transport Omar without claiming Lorenzo witnessed it. Current `src/villageMain.ts` seeds the first five `ORDER` events at Ch1 start and places Omar at post [6]; no discovery or transport scene is present. | Keep it explicitly off-screen in the treatment, or implement a distinct visible arrival after the mountain find. Do not imply an arrival the player can miss. |
| **Resolved:** Omar's cuff sequence was contradictory. | Current treatment now says cuffs remain through guarded medical check and come off afterward. The Ch1 Day 1 runtime starts him cuffed, starts the check after Omar's line, and removes the prop at completion. | Preserve this sequence; Day 2 uses `medicalCheckComplete` and uncuffed Omar. |
| **Resolved in runtime:** Ch1 photo/testimony loop was not tracked. | Newest handoff and `studio/reports/ch1-testimony-proof.png` document four distinct family-photo role IDs, three distinct NPC+line testimonies, and duplicate suppression. The treatment classifies this ledger as optional. | Keep evidence goals optional unless owner changes progression; preserve the interaction path without battery/recording. |
| The route to the Ch2 entrance is not motivated by an authored clue chain. | The treatment says Lorenzo resumes “based on farm and village evidence” and follows quarry traces, but does not state which already-supported clue leads him there. `chapter-plan.md` only says he follows clues. | Add a legible handoff: the journal points to an observed route/landmark already present in the region plans. Do not invent an NPC confession, map, or mine entrance key to bridge the gap. Noor/owner should resolve any new clue source. |

## Gameplay gates, loops, and recovery

- **Prologue follow loop — partial:** Current handoff reports out-of-bounds recovery to a grounded safe snapshot and restored cow position (checkpoint 23 in the browser probe). This replaces the earlier concern that recovery was absent. Full route behavior at the cow's 24 m pause boundary, fixed authored checkpoint expectations, and persistent-save behavior remain unverified; test those transitions before calling the follow loop complete.
- **Fence traversal — evidence needed:** `chapter-plan.md` calls for crouching under rails, while `regions/village.md` says the 1.2 m rail fence cannot be jumped but does not locate a passage on Joseph's route. Choose and build a specific opening/under-rail gap in level geometry; do not present it as already authored.
- **Ch1 gates — partial:** Photo/testimony tracking is implemented and verified as optional. The scripted Omar discovery/transport is still absent. The Day 1 runtime gate is Omar's line → guarded medical timer → Moreno's doubt line → Day 2; however, no authored line/scene actually communicates Moreno assigning Elia. See current-sequence recheck.
- **Ch2 puzzle loop — partial:** Code and bounded probe now cover portal/depot recorder/Hall/exit progression; an exit is possible with the optional Hall footage missed. The route still needs continuous visual play. The wiring objective should use visible cable continuity/landmarks and clear branch feedback; do not add a breaker-fuel puzzle (the depot fuel is empty and Ch2 has no power-restoration goal). The latest visual review reports open-cut trench presentation, unverified full walk, and no post-fix recapture.
- **Maryam — fact plus recovery recommendation:** The 8-second wait, second conversation, confirmation flag, gate opening, and one-way walk match the owner decision and current code. Keep her interaction available if the player leaves and returns. Add a route recovery if NPC collision or a blocked gate prevents her reaching the square; live route review is still open.
- **Camera battery — legibility risk, not a proven softlock:** Ch2 Hall footage is optional and the newest bounded probe completed the chapter with footage missed. The camera light still depends on recording and may be unavailable if the five-minute battery drains; the darkness route needs alternate visual cues or a verified recharge/reset. No evidence currently proves a hard progression lock from battery depletion.
- **Root hazards — recovery detail:** The 0.6 s creak/dust tell is specified in the region plan, but the treatment does not say how a checkpoint resets the hazard, whether the route stays open, or how repeated hits avoid a loop. Give each safe point a stable respawn, reset the lash tell on respawn, preserve evidence, and leave one readable path forward. These are design requirements, not canon facts.
- **Chapter timer — unverified fairness:** `src/villageMain.ts` starts Chapter 3 at 05:05 with a 300-second deadline; the timer runs while the player talks to the priest and climbs. One interrupted upload resets progress for one retry; a second interruption fails. Handoff proves a bounded top/upload/seizure state probe, not a natural climb or a guaranteed full retry window. Measure a natural climb and decide whether the intended failure on a second interruption matches the chapter design before calling the timer fair.

## Chronology and motivation repairs

1. Keep the owner's order explicit in both the playable timeline and saved flags: Omar café/activity → root attack/transformations → Omar escapes with amnesia → police find him near mountain → cuffed transport → Moreno assignment → Elia appears on Day 2 and starts the cover. The current Day 1 seed represents those earlier events without showing them; the treatment must not imply Lorenzo witnessed them.
2. Separate Joseph's Night 0 events from Lorenzo's Day 1 investigation. The farmer's prologue search followed by Lorenzo's later conversation is correct. The first-person rule does not permit a free-floating omniscient view of Omar's pre-attack café activity.
3. Give Lorenzo a short, concrete reason for each investigation step: family-funded missing-person job/photo → observable farm or village evidence → clue to the quarry → Hall footage. The draft states the endpoints but leaves the evidence-to-next-objective connection vague. Use existing world clues and do not make him infer the roots' origin.
4. The owner requires Moreno's assignment after Omar is found; the treatment makes the medical exam a prerequisite to the briefing. That extra dependency is not fixed by canon. Recommendation: keep the assignment after the find and place it at the end of the Day 1 beat only if the exam timing supports it; otherwise separate the assignment from the exam-completion gate. Ask Noor/owner before treating the dependency as a story fact.
5. Chapter 3 must leave room for upload → footage spread → agencies arrive at 05:10. The draft jumps from upload completion to vehicles with no elapsed beat. Add a short wait/time transition after upload, without naming a platform or claiming an exact spread interval unsupported by canon.

## Story inventions that need evidence or explicit design labeling

These are not approved canon merely because they appear in the treatment. Keep them labeled **design proposal** until supported by a source or approved by Noor/owner:

- Lorenzo starts in the café and receives the father's photograph directly from the family there. The chapter plan supports a photo objective and the canon supports the family's funding, but not this exact handoff/location.
- Lorenzo sees/hears Night 0 Ravens activity, or receives a pre-recorded briefing about it. No source, recording, or Lorenzo access to that event is established. Prefer observable aftermath; any retrospective scene needs approval and must not break first-person framing.
- **Resolved:** The earlier Prologue Hall treatment/build placed transformed Ravens in a side gallery without canon support. Current `src/prologueHall.ts` no longer includes them, and `src/chapterTwo.ts` places the four Bound at the documented Ravens card table. Keep this placement unless canon is revised.
- A specific player-return radius, automatic checkpoints at barn/stream/mouth, and the claim that the player cannot be trapped by any cave route. These are recovery mechanics that need implementation and playthrough evidence, not story facts.
- The exact rail-fence opening/crouch location, mine entrance clue, camera recharge point, and chapter-boundary battery reset. Build these as level/system choices and record them as such; do not invent an in-world object or NPC fact to justify them.
- “Eight seconds” before Maryam can confirm, the exact square target, and proposed poster placement are runtime decisions in the current implementation. The sequence itself is owner-locked; the dialogue remains `proposed`, and the exact route still needs live visual review.
- Four agencies' vehicles/floodlights are supported by `regions/village.md`; specific agents zip-tying Lorenzo, exactly when the footage spreads, and when the agency arrives relative to upload are treatment details needing implementation/timing proof. Keep agents unnamed as specified.
- A camera recharge at end of day/safe point, the evidence-log interface, optional-vs-required testimonies, and retry clock behavior are UX/system designs, not canon.

## Current-sequence recheck (2026-10-20)

### Supported sequence

- **Binding order:** `src/npcData.ts` defines the seven locked events in order. `src/villageMain.ts` starts Ch1 with `ORDER.slice(0, 5)`, so the pre-day-1 café, attack, escape, find and cuffed transport are treated as past events. Ch1 runtime places Omar cuffed at post [6]; his line starts the guarded check, which removes the cuff prop. This preserves chronology but does not stage the earlier scenes.
- **Elia timing:** Ch1 day transition is gated on Omar conversation, check completion, and Moreno's `moreno_said`; `?day=2` seeds `ORDER.slice(0, 6)`, so the mission assignment is logically before Elia's appearance. Elia is withheld before event 6, and Omar is uncuffed on Day 2.
- **Chapter 2:** The current script correctly follows breakthrough → Hall/Joseph footage → cave-mouth exit. Handoff reports bounded browser-state progression through recorder, Hall and exit. The full visual route and post-lighting recapture remain open.
- **Chapter 3:** The treatment and code both use a 05:05 start/05:10 deadline, 20-second hold, and first-person seizure. The current code allows one interrupted upload retry and fails after the second interruption. Natural climb duration remains unmeasured.

### Remaining mismatch: Moreno's assignment is only seeded, not communicated

**Evidence:** In `src/npcData.ts`, Moreno's Day 1 available lines are `moreno_reporter` and `moreno_said`; the latter only doubts Omar's amnesia. In `src/villageMain.ts`, this line plus the completed medical check causes `?day=2`. The Day 2 load then sets `story.events` to `ORDER.slice(0, 6)`, which silently marks “Moreno assigns Elia” as complete. There is no assignment dialogue or shown moment in that transition. The script currently says Moreno's briefing “opens the Elia assignment,” which overstates what the player hears.

**Code-path reproduction (source inspection; not a live playthrough):** Start `?day=1`; talk to Omar and wait for `GUARDED MEDICAL CHECK COMPLETE`; speak with Moreno until `moreno_said` plays. The game fades to `?day=2`, and the event prefix now includes the assignment even though the heard line is only about his suspicion. In Day 2, Elia appears on the balcony. Separately, `omar_watcher` is already allowed as soon as Day 2 starts; speaking to Omar before hearing Elia's `elia_photos` line still schedules `?chapter=2` after the short fade. Thus the intended Elia → Omar playable bridge can be skipped by visiting Omar first.

**Recommendation:** Add an explicit, still-proposed assignment beat or a clear first-person handoff between the suspicion line and Day 2; do not turn the current doubt line into assignment without Noor's Arabic approval. Gate the Day 2 transition on Elia's photo line before accepting Omar's watcher line as the next required step, while keeping both conversations available if the player walks away. This is a design repair; owner/Noor approval is required for new dialogue.

### Reproduction/open-work notes

- The transport, mountain find, and Omar's pre-attack café activity remain off-screen in runtime. Ch1 initial event-prefix seeding is consistent with “after the events,” but it is not evidence those scenes are playable or witnessed.
- The optional Ch1 photo/testimony ledger has bounded proof (four distinct photo roles, three unique statements, duplicate suppression). The design intent is therefore represented; a full natural run and objective behavior under interruptions remain unverified.
- The Prologue has a bounded out-of-bounds recovery/cow-progress probe. It does not prove the full cow route, fence traversal, or every recovery boundary in a continuous playthrough.
- The Ch2 root hazard timing and post-fix normal-angle visuals remain open per `studio/reports/chapter-two-visual-review.md`; current evidence is bounded/state-based, not a full manual playthrough.
- All proposed Arabic dialogue remains unapproved for recording; the farmer/wife `[ref]` assignment remains unresolved. No Noor approval is inferred here.

This is a source/handoff QA follow-up, not a claim of a full build or playtest.
