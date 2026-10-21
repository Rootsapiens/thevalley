# Quarry and mine clue audit

## Decision after this audit — 2026-10-21

The owner selected the existing Ravens chalk arrow on the barn door as Lorenzo's lead to the southbound quarry route. The findings below record the earlier gap, before that decision. Chapter 2 now starts with an inspect-arrow objective; the route/connector is being handled separately and has not been verified by a continuous playthrough. This choice gives the arrow a new investigative purpose without changing its south-pointing geometry or adding dialogue.

## Finding

The current village clues do **not** lead Lorenzo from the village to the quarry or mine. The build transitions him into Chapter 2 and displays “Follow the road east toward the quarry,” but the story has no established observation or event that motivates that route. The script itself flags this gap.

## Evidence: authored story and world sources

- `studio/world/regions/village.md` §1 map (line 34) places the stone bridge and quarry track **400 m south**. The map states north is up; its bottom row marks the valley road south.
- `studio/world/regions/village.md` §“Environmental story, told without words: barn [1]” (lines 67–72) says the hoofprints bend **north-east toward the cave mouth** and the chalk arrow points **south, the wrong way**. These direct the player toward the mountain/cave or explicitly misdirect; neither points to the quarry.
- `studio/world/regions/village.md` §“Three landmarks seen from a distance” (lines 56–58) names the bell tower as visible from the quarry and places the cave mouth north-east of the village. It does not identify a village-to-quarry clue.
- `studio/world/regions/ravens-tunnels.md` §“Player goal” (line 50) starts Lorenzo at the tunnels and asks him to follow the string-light cable to the lower level. §“Three landmarks seen from a distance” (lines 57–58) says the quarry terraces are visible from the village square and stone bridge, and the rusted conveyor descends from the portal. These are authored landmarks suitable for orientation, but the source does not say Lorenzo notices them or that they cause him to investigate.
- `studio/world/chapter-plan.md` §episode sequence (line 222) says on Day 3 Lorenzo “follows clues into the caves,” without specifying which clue.
- `studio/script/episode-one-gameplay.md` §Chapter 2, “Mountain exploration,” step 1 (line 304) explicitly records that no established story clue explains why Lorenzo follows the east road. Its open decisions (lines 372, 378) leave the clue selection to the owner; no approved clue source is named.

## Evidence: current runtime

- `src/village.ts` `EXAMINABLES` (lines 477–483) implements the barn chalk clue (“arrow pointing south, back to the village; every print goes the other way”) and hoofprints (“heading for the mountain”). `TRAIL_END_ZONE` / `zoneEvents` (lines 441, 631) end the prologue trail at the mountain route. These runtime clues reinforce the mountain trail, not the quarry.
- `src/villageMain.ts` (lines 294–300) loads the Day 2 Elia objective, while Chapter 2 mode sets the objective “Follow the road east toward the quarry” (line 300). `setChapterTwoStage` (lines 311–314) then advances to “Find the Ravens' mine gate” and “Follow the string-light cable inside.” No intervening village clue triggers the quarry objective; it appears with the Chapter 2 mode.
- `src/eastValley.ts` (lines 11–19) defines an `EAST` connector and a route extending from x=123.5 to x=222. `src/chapterTwo.ts` (around lines 78–90) places the quarry track at x=240 and portal at x=258. Thus runtime delivers the player east to the quarry, while `village.md` places the quarry track south. This is a world-direction mismatch requiring a map/coordinate decision.
- `src/chapterTwo.ts` `ch2-mine-gate` examinable (around line 246) says the open gate’s cable runs deeper inside. That clue correctly directs exploration **after** the player reaches the portal; it cannot explain the village-to-portal journey.

## Recommendation and decision needed

**Design recommendation:** keep the already-authored barn evidence about the cave as a separate clue chain. For the quarry route, use the documented quarry terraces/conveyor as a visible orientation landmark only after the owner/Noor confirms that Lorenzo is meant to notice and follow it. Then expose the selected clue before the road objective is treated as motivated, and gate the objective on that observation if needed. Do not add dialogue, a map, a confession, or a new clue source without approval.

**Owner/Noor decision required:** confirm whether the quarry track is south (as the village region map says) or east (as the current Chapter 2 connector and objective implement), then identify/approve the clue that causes Lorenzo to investigate it. Until those choices are made, the exact direction and narrative motivation are unresolved. No runtime change is recommended before that decision.
