# Episode One canon review — source audit, not Noor approval

**Date:** 2026-10-21. **Scope:** `studio/world/story-canon-ar.md`, `chapter-plan.md`, `regions/village.md`, `characters.md`, `studio/npc/README.md`, `studio/script/episode-one-gameplay.md`, and Imad's current reviews. This report records existing decisions for the writing team. It does not approve dialogue, invent story facts, or certify a playable route.

## Binding story and presentation

- The owner's Arabic `story-canon-ar.md` has priority over old game briefs and the Night Shift prototype. The valley is a present-day mountain village. The threat is biological roots, not a reactor rupture or floating creatures.
- Episode One covers Joseph's prologue and Lorenzo's Chapters 1–3. Joseph follows the farmer's cow and is preserved with the herd. Lorenzo comes to investigate Sal's kidnapped father, reaches the mountain, films Joseph and the animals, uploads the footage, and is detained after it spreads. Joseph and Lorenzo have no combat in this episode. Keep first-person viewpoint; do not add omniscient scenes as though Lorenzo witnessed events he did not.
- Secondary villagers remain role-based: farmer, farmer's wife, priest, two officers, villagers. Use the fixed NPC IDs from `studio/npc/README.md`; do not invent story names. Proposed Arabic dialogue remains test copy until Noor reviews and approves final wording for recording. Do not assign the farmer/wife `[ref]` lines by guess.
- Preserve the world compass: cave mouth and herd trail north-east; village road to the quarry exits south. The owner has approved moving the Chapter 2 route south. This resolves the runtime route direction, **not** the clue that motivates Lorenzo to choose the quarry. `world-bible.md` describes the broader quarry as south-east; distinguish the village's southbound exit from the quarry's regional location.

## Event order the episode must honor

1. **Night 0, prologue:** farmer searches for animals; Joseph follows the cow and herd toward the cave; roots preserve him. The farmer's later conversation with Lorenzo is a subsequent event.
2. **Parallel Omar line:** Omar begins at the café before the root attack. Roots attack and transform Ravens; Omar escapes with amnesia. Do not make this a Lorenzo flashback without an established source.
3. **Day 1:** police find Omar near the mountain and transport him cuffed to post [6]. Cuffs come off during guarded medical examination. Omar must not appear at the post before the find and transport events in world chronology. Moreno doubts the amnesia.
4. **After Omar is found:** Moreno assigns Elia the undercover girlfriend role. Elia first appears on Day 2, after that assignment. Omar is uncuffed in later meetings with her. The assignment need not occur after the medical check as a matter of canon; that dependency is only a current implementation choice.
5. **Maryam:** before she verifies Joseph has not returned, she stays near the house. Only after that confirmation does she move to the square. The current eight-second/two-conversation interaction is an owner-approved runtime decision, not new lore.
6. **Day 3 to 05:10 Day 4:** Lorenzo follows evidence through the Ravens' tunnels and breakthrough to the Hall, films Joseph and the animals, exits the cave mouth, climbs the bell tower, uploads the footage, and is detained after it spreads. The first three chapters remain without combat.

## Concrete writing and integration issues

| Priority | Issue | Safe next action |
|---|---|---|
| 1 | `studio/reviews/imad-quarry-clue.md` finds no authored village observation that motivates Lorenzo's quarry investigation. The south route is approved, but the clue remains open. | Layla and Imad can draft clearly labeled alternatives using existing visible quarry terraces/conveyor and established observations. Ask owner/Noor to choose before one becomes canon or a required objective. Do not add a confession, map, or new clue as fact. |
| 2 | Day 2 seeds Moreno's Elia assignment and states it on an objective card, but the player does not hear or see a distinct assignment beat. An older Imad review says Omar's interaction can skip Elia; current `src/npcData.ts` gates `omar_watcher` on `elia_cover_introduced`, set by `elia_photos` in `src/villageMain.ts`, so that review finding is stale. | Preserve the current Elia-then-Omar gate. A new first-person assignment scene or line remains proposed until reviewed. |
| 3 | Omar's café/attack/escape/finding/transport are seeded before Day 1 in current code, not staged. | Treat them as off-screen history in Episode One copy unless a distinct scene is authored and built. Never describe the current build as showing the transport. |
| 4 | Omar and Elia are planned in an upstairs café room, but current Omar post position is temporary; café/school floor elevations and seated foot placement await scene geometry. | Script dialogue without relying on a specific unbuilt room elevation. Move actor placements only after geometry is measured. |
| 5 | Prologue farmer search, Joseph's whole route, Maryam's walk to the square, Chapter 2 hazards, and natural bell-tower timing lack full continuous visual play evidence. | Write beats as targets, and keep implementation claims tied to bounded tests/reviews. Avoid saying the complete episode is playable until natural runs prove it. |
| 6 | Several older documents conflict with locked timing (`npc-line-review.md` notes Day 2 gap and older Day 1 café wording). | Use the owner NPC README and the current episode treatment for sequence. Keep older text as review history, not instructions to change the approved order. |

## Decisions still open

- Noor's final Arabic pass on every line marked `proposed`; recording approval is **not** granted by this audit.
- Original `[ref]` attribution between farmer and farmer's wife, after checking `characters.md` and its underlying references.
- The particular quarry clue Lorenzo observes and its presentation before Chapter 2's road objective.
- Whether Omar's discovery and cuffed transport are shown to the player or remain off-screen, while preserving their order.
- Café upstairs and school interior heights from built geometry; camera recharge/persistence and full-route recovery details are implementation design questions.

## Suggested collaboration handoff

- **Imad:** prepare 2–3 labeled clue alternatives rooted in existing landmarks, and audit causal flow between Day 1, Day 2, and Chapter 2.
- **Layla:** polish the playable Episode One treatment and draft Arabic-first candidate dialogue, each line tagged `proposed` with speaker ID and event gate; no voice-recording claim.
- **Rajaie/Zurub:** implement only settled event-order gates and investigate route/recovery gaps without converting a draft line or clue into canon.
- **Noor/owner:** select the quarry clue and review final Arabic text and any new assignment beat. A worker report cannot substitute for that approval.
