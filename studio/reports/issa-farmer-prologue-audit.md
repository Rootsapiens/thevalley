# Issa — farmer Prologue chronology audit (2026-10-21)

Source inspection only. No runtime edit, test, browser playthrough, or visual proof.

## Current implementation

- The approved order is farmer searching for animals in Joseph's Prologue, then Lorenzo may speak to him in Chapter 1 (`studio/script/episode-one-gameplay.md:25,42,83,185`). The farmer retains the role ID `npc_farmer`; farmer/wife `[ref]` attribution remains unresolved.
- `?prologue=1` builds Joseph's cow, roots and Hall route, sets `story.prologue`, and constructs NPC actors from that story (`src/villageMain.ts:64,123-152`). `npcsAtDay` returns only `npc_farmer` in this slice with stage `prologue-search` and `talkable: false`. Normal Chapter 1 returns him as `post-prologue`, `talkable: true` (`src/npcData.ts:111-143`). `nextLine` also refuses a non-talkable NPC (`src/npcTalk.ts:40-49`); the Prologue farmer is excluded from NPC talk picks (`src/villageMain.ts:156-160`).
- The farmer's existing position is beside the barn trough at `(-12.5, 0, 8.5)` (`src/npcData.ts:343-355`). His search route goes around the barn to the pasture opening, pauses facing the mountain, and returns. It stops when Joseph comes near (`src/npcTalk.ts:113-119,214-255`). `tickActor` runs on the fixed clock; moving collision boxes and the figure update follow the actor (`src/villageMain.ts:147-151,921-941,1260-1261`). The figure has a distinct `prologue-search` arm pose, and walk weight selects the Walk animation (`src/npcFigures.ts:35-36,78,426-430`). These sources establish an intended searching performance, not its rendered visibility from Joseph's route.
- After the Prologue, Chapter 1's opening objective explicitly asks Lorenzo to investigate the farm and speak to the farmer (`src/villageMain.ts:328-333`). His current line is tagged `proposed` (`src/npcData.ts:353-355`); no `[ref]` should be assigned to him or his wife by inference. The Prologue E2E route follows Joseph and the cow but does not assert farmer visibility or animation (`tests/e2e/prologue-route.spec.ts`).

## Minimum safe implementation option

Keep the single stable farmer ID and the existing stage switch. Make his search legible to Joseph through an in-world sightline or short nonverbal cue along the **existing** trough-to-pasture route; do not introduce a Prologue conversation or new dialogue. Check his model, walk animation, feet, path clearance and visibility from the real Joseph spawn/route in a browser before calling the beat complete. Preserve the separate, later Chapter 1 talk gate and `proposed` line status. If the existing path is obstructed, adjust only against measured scene geometry; do not guess a new floor height or `[ref]` assignment.

No source-level fix is justified from this audit alone: the stage and motion hooks already exist. What remains unverified is whether the player actually **sees** the farmer search during the playable Prologue.
