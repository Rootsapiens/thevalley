# Farmer's wife (unnamed) — id: npc_farmers_wife

**Role:** The farmer's wife. Keeps the light on for her husband. Watches the TV in the farmhouse.
**Canon:** characters.md "The farmer [ref] and his wife [ref]" (no name in the canon). village.md landmark [2].
**Scene:** Ch1 (Day 1) through the farmhouse window. Evacuated in Ch4 (not on stage).

**Position (m, +Y up; from src/village.ts FARMHOUSE)**
- Inside farmhouse [2] (x -25..-15, z -5..5), seated in front of the black-and-white TV at about (-21.0, 0, 0.0), facing east toward the window.
- Floor y = 0 (to confirm inside the farmhouse).
- Visible from the farmyard through the east window. The TV light is the only light in the window.

**Idle behaviour**
- Sits and watches the TV. The screen flickers (shader or emissive, no audio beyond the TV hiss).
- Looks up at the window now and then, as if listening for someone outside.
- Gets up when the player knocks, then sits again if the player does not come in.

**Dialogue triggers (press E, through the door or the window)**
- Day 1, at the door: "He'll come back. He always does." (proposed)
- Day 1, at the door: "The cow was the first one to go. She walked up the hill." (proposed)

**Animation / pose needs**
- sit_chair_idle_watching_tv, look_up_to_window, stand_from_chair, walk_to_door_knock, talk_seated.

**Open questions**
- Is she visible from the outside only, or can the player enter? village.md says "her TV can be seen through the window".
- Which of the two [ref] lines is hers (not decided; do not move a line from the farmer by guess).
