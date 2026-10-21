# Imad — Omar's arrival and Day 1 post state (source review, 2026-10-21)

## Binding sequence

The owner's order in `studio/npc/README.md` is café/Ravens activity → root attack and gang transformation → Omar's amnesiac escape → police find him near the mountain → cuffed transport to post [6] → Moreno assigns Elia the cover off-screen → Elia appears on Day 2. Omar's cuffs come off during a guarded medical check; he is uncuffed at later meetings. Lorenzo need not witness the earlier events. Proposed dialogue remains draft pending Noor's Arabic approval. The café upstairs floor and Omar's exact mountain-find spot must not be guessed.

## What this build actually does

- `src/npcTalk.ts` seeds `CH1_DAY1.events` with the first five `ORDER` events. `src/villageMain.ts` uses that prefix on Day 1, so Omar starts already at post [6], cuffed. The café, attack, escape, discovery and transport are not playable or shown in this slice.
- `src/npcData.ts` gates Omar on the find event and labels the five-event state `police-post`. It also defines `mountain-found` for a four-event prefix, but his position remains the post coordinate and `src/npcPlacement.ts` has no stage-specific mountain placement. That label is data, not a staged discovery scene.
- Lorenzo's Day 1 conversation with Omar starts a guarded-check timer. On completion `src/villageMain.ts` removes the cuff state and plays its cue; after the existing Moreno skepticism line, the game moves to Day 2. That line does not announce Moreno's secret assignment. Day 2 seeds the sixth event, shows Elia on the built balcony and leaves Omar uncuffed at the post because the café upstairs room is not built. The objective card only asks Lorenzo to speak with Elia.
- The campaign save tracks Omar heard, medical check complete and Moreno heard. A mid-Day-1 reload does not restore Omar's live conversation/check state; the current objective intentionally sends the player back to his first interaction. Source inspection only; this report is not a browser or full-route verification.

## Source-grounded implementation options

1. **Keep the earlier arrival off-screen for this slice.** Retain the five-event Day 1 prefix and describe the post encounter as Lorenzo arriving after police transport. Restore the conversation/check states on reload so cuffs, objective and Moreno gate agree. This needs no new dialogue, scene geometry, or revealed assignment. Do not label the slice as a playable discovery/transport.
2. **Stage discovery and escorted arrival later, after direction is settled.** Start the relevant Day 1 state before the find, advance the ordered prefix only at a police-find trigger, then at a cuffed transport/post-arrival trigger, and only then spawn Omar at post [6]. Use the existing car, door and post as potential anchors; exact near-mountain placement and route must be selected from built geometry. Keep Moreno's assignment off-screen and Elia gated to Day 2. This is additional production work, not present proof.

## Owner direction still needed

- Choose whether discovery/transport should be visible or remain off-screen in the final playable Day 1. The current build uses the off-screen slice.
- If visible, approve the specific near-mountain find location and escorted path after a geometry review. No position should be inferred from the `mountain-found` label.

No new line, flashback, source recording, or on-screen Moreno assignment is proposed here.
