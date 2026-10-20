# Farmer (unnamed) — id: npc_farmer

**Role:** The farmer whose herd walked to the mountain. Owner of barn [1] and farmhouse [2].
**Canon:** characters.md "The farmer [ref]" (no name in the canon). Prologue: he is out searching at dusk.
**Scene:** Ch1 (Day 1). **Decision (owner, 2026-10-18):** he is on stage in Ch1, searching in the prologue. Lorenzo can talk to him later, after the prologue events (sequence, not parallel).

**Position (m, +Y up; from src/village.ts BARN, FARMHOUSE, TROUGH)**
- Barn [1]: x -10..10, z -10..10. Doors on the north side, 4 m wide.
- Farmhouse [2]: x -25..-15, z -5..5. Trough at x -14..-12, z 6.0..6.7.
- Ch1 spot: beside the trough at (-12.5, 0, 8.5), holding an unlit lantern.
- Floor y = 0.

**Idle behaviour**
- Searching: walks slowly between the trough and the pasture gate, stops to look at the mountain.
- At the trough: fills a bucket, then stops and stares at the empty pasture.
- Stops when the player is within 4 m, turns to face the player.

**Dialogue triggers (press E)**
- Day 1, trough, after the prologue: "They didn't break out. They walked out." (characters.md [ref] line, speaker attribution to confirm)
- Day 1, trough: "My wife keeps the light on for me. I'm going back out." (proposed)

**Browser runtime wiring**
- Stable runtime ID: `npc_farmer`; no story name.
- `?prologue=1` stages only this NPC as `prologue-search` and disables interaction. He walks slowly from the trough around the barn's west side, passes through the north pasture opening, pauses facing the mountain, then returns. The low-poly figure has a basic walking gait.
- The default Valley slice starts after the prologue, where he is `post-prologue` and talkable at the trough. This remains an NPC preview route, not a playable Joseph prologue; the current browser slice still starts as Lorenzo.
- Story order and draft scene beats: `studio/script/prologue-arrival-draft.md`. The search appearance is before the later Lorenzo conversation; do not move the `[ref]` line to him until its source attribution is known.

**Animation / pose needs**
- stand_idle_tired (hands on hips), walk_slow_searching, look_to_mountain (head up to NE), talk_small, fill_bucket (short loop).

**Open questions**
- Which of the two [ref] lines belongs to him and which to his wife (not decided; do not move one to the other by guess).
