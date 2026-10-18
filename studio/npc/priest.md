# Priest (unnamed)

**Role:** The village priest. Keeps the village calm and away from the mountain. Lets Lorenzo climb the bell tower.
**Canon:** characters.md "The priest [ref]" (no name in the canon).
**Scene:** Ch1 (Day 1, evening). Ch3 vigil (candles in the church windows).

**Position (m, +Y up; from src/villageMap.ts church and tower footprints)**
- Church nave: x 5..24, z 26.5..35, door on the south wall at x 9.5. Altar at the north end, about (14.5, 0, 28.5). Floor y = 0.
- Tower door: south wall at (2.5, 0, 30.0), tower base x 0..5, z 25..30.
- Priest's house: x 30.5..39.5, z 26.5..34, west door locked at z 30.

**Idle behaviour**
- Stands at the altar, lighting candles one by one. Stops when the player enters.
- At the tower door, stands with a key ring and waits for the player to ask.
- Ch3 vigil: kneels at the front pew.

**Dialogue triggers (press E)**
- Day 1, altar: "Go home. And stay away from the mountain." (characters.md [ref] line)
- Day 1, tower door: "The ladder is old. Mind the fourth flight." (proposed)
- Day 1, altar, after the posters: "The boy's mother came in this morning. She did not sit down." (proposed)

**Animation / pose needs**
- stand_at_altar_idle (hands clasped), light_candle (short loop), kneel_pew (Ch3), turn_to_player, hand_gesture_warning.

**Open questions**
- Name: none in the canon.
- Does he appear on Day 1 in the slice, or only from Ch3? characters.md says Ch1 (tower access).
