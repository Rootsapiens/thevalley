# Episode One story work queue — 2026-10-21

This is Razan's coordination snapshot, updated by Cyrex/Subzero at 01:25 CEST; it is not live telemetry. `/root` remains active for integration. Layla, Noor, Razan, Imad, Rajaie and Zurub delivered the reports below and finished their turns. Other names are **queued assignments**, not running workers. Refresh labels from actual worker reports before repeating them. Four concurrent slots include the coordinator.

## Shared boundaries

- Preserve the owner's binding order: Omar at café with Ravens → root attack and transformations → amnesiac escape → police find him near the mountain → cuffed transport to post [6] → Moreno assigns Elia → Elia appears on Day 2 and begins the girlfriend cover. Cuffs come off during the guarded medical check; later Elia meetings show Omar uncuffed.
- The farmer searches in the Prologue, then Lorenzo may speak with him. Maryam goes to the square only after confirming Joseph has not returned. Keep secondary roles unnamed, with stable internal IDs.
- Every `proposed` line remains a test draft pending Noor's final Arabic review. Do not record it. Do not assign the farmer/wife `[ref]` lines by inference or set café/school floor heights without scene geometry.
- The owner approved the Chapter 2 quarry route **south** to match `studio/world/regions/village.md`. The clue that motivates Lorenzo to take that route is still undecided. Do not invent the clue or alter the route in this story pass.
- Three.js + TypeScript is the shipping game. UE5 is paused. Preserve dirty work and do not update Team Studio. The owner subsequently authorized a GitHub update when work is solid; stage only reviewed story handoff files for that update.

## Assignments and dependencies

| ID | Owner and process status at snapshot | Deliverable | Depends on | Completion evidence |
|---|---|---|---|---|
| S01 | Layla — **completed report** | Episode One scene and dialogue gap pass in `studio/reports/layla-episode-one-story-pass.md`; no shared script edit. | Canon and NPC decisions; no new quarry clue. | Report traces P/Ch1–3, identifies Moreno gap, and confirms current Elia → Omar source gate. Treatment update remains queued. |
| S02 | Noor — **completed source audit** | Canon constraints and unresolved decisions in `studio/reports/noor-story-canon-review.md`; not a final Arabic line approval. | Current treatment and world sources. | Report separates binding facts, draft dialogue, and open decisions. Final Arabic line review remains queued. |
| S03 | Razan — **completed queue** | Evidence-based queue and ownership handoff in this file. | Actual agent status and reports. | Running and queued were separated, then completed status refreshed after handoff. |
| S04 | Cyrex/Subzero — **running**, one coordinator process | Integrate reviews, choose the next bounded implementation slice, check continuity and readiness, and keep handoff evidence current. | S01–S03; owner direction on new canon. | Diffs reviewed, objective/acceptance criteria recorded, unresolved choices visible. |
| S05 | Imad — **completed report** | `studio/reports/imad-story-causality-followup.md` audits current causality and gives three clearly proposed quarry clue alternatives. | S01 and S02. | Separated approved south direction from open motivation and identified the Hall footage contradiction. |
| S06 | Rajaie + Zurub — **completed bounded pass** | Rajaie's plan is `studio/reports/rajaie-story-implementation-plan.md`; Zurub's source review is `studio/reports/zurub-story-state-review.md`. Rajaie then gated Chapter 2 completion on Hall filming and carried the shot into campaign Chapter 3 in `src/villageMain.ts`. | S01/S02 and Imad's continuity finding. | Typecheck/build/diff check passed; changed chapter route still needs gameplay verification. Elia → Omar gate retained. Moreno presentation and broader persistence remain open. |
| S07 | Firas — **queued** | Verify a natural player route through the Prologue and Ch1, including farmer, Maryam, Omar's cuffs/medical check, Moreno, Day 2 Elia then Omar. Separately audit Ch2 and Ch3 route limits. | S06 and a runnable browser/test environment. | Test log names each completed route and each unverified section; never call Episode One complete from bounded probes. |
| S08 | Khaled — **queued** | Map ambience and sound cues to approved scene beats; no voice recording of `proposed` lines. | S01/S02 and event timing. | Cue list with event keys, source/license and no implied dialogue approval. |
| S09 | Aktham — **queued** | Provide art staging needs for Omar transport, post medical check, Maryam departure, and Elia cover while preserving the historical village; no scene geometry guesses. | S01 and Rajaie's staging constraints. | Shot/asset list with scale and unresolved set heights explicitly marked. |
| S10 | Nidal — **queued** | Source only licensed environment/NPC assets needed by S09; record provenance and actual download state. | S09 asset needs. | Manifest with source, license, format, intended use and whether files are present. |
| S11 | Tariq + Issa — **queued / UE5 paused** | Preserve Unreal NPC/interior notes for a future prototype; review Three.js narrative requirements when requested, without starting a parallel shipping implementation. | Owner's current engine direction. | Written compatibility notes only if dispatched. |

## Open decisions and review gates

1. **Quarry clue:** `studio/reviews/imad-quarry-clue.md` finds no authored village observation that motivates the quarry. Southward direction is approved; the **reason to go there** needs owner/Noor direction before writing new canon or a trigger.
2. **Omar arrival presentation:** the current build seeds café/attack/escape/find/transport as past events and shows him at post [6]. Decide whether to stage visible arrival or keep it explicitly off-screen; the current script must not imply it was playable.
3. **Moreno assignment:** current Day 2 seed marks the assignment without a player-visible beat. Noor must review any proposed Arabic line; implementation can expose the beat only after source/approval status is clear. The old Imad claim that Omar's Day 2 line can skip Elia is stale: `src/npcData.ts:245` and `src/villageMain.ts:570-573` now enforce the order.
4. **Hall footage:** current code requires Joseph/animals footage before Chapter 2 completion and campaign Chapter 3 upload. Battery depletion before the shot offers an R chapter restart; a shorter recovery remains a possible design improvement. This changed route has typecheck/build evidence, not a continuous browser playthrough. Direct `?chapter=3` remains a debug preview.
5. **Proposed Arabic and `[ref]`:** Noor's review is pending; farmer/wife attribution requires original `characters.md` references. Neither is an asset or engineering guess.
6. **Physical staging:** café upper floor and school heights await added scene geometry. Camera battery persistence and Chapter 3 climb fairness remain design and verification work, not canon.

## Evidence consulted

`studio/team.md`, `studio/handoff-log.md`, `studio/script/episode-one-gameplay.md`, `studio/reviews/imad-episode-one.md`, `studio/reviews/imad-quarry-clue.md`, `studio/world/npc-line-review.md`, and `studio/npc/README.md`. The older `imad-npc-order.md` is retained as historical review; the current treatment and handoff supersede several of its earlier runtime-gap claims.
