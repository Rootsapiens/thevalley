# Square villagers (6, unnamed)

**Role:** Six background villagers in the square on Day 1. They react to the search and the police. No names, no canon lines.
**Canon:** village.md Ch1 state: "6 villagers are in the square."
**Scene:** Ch1 (Day 1).

**Position (m, +Y up; from src/villageTown.ts SQUARE, FOUNTAIN, BENCH)**
- Square: x -9.5..50, z 35.5..60. Floor y = 0.
- Fountain [4] at (22.5, 0.62, 47.5), radius 1.7 m. Bench at (22.5, 0, 51.6).
- Spots: V1 (19.0, 0, 46.0), V2 (26.0, 0, 46.0), V3 (21.0, 0, 52.5), V4 (24.5, 0, 53.0), V5 (6.0, 0, 58.0) by the café tables, V6 (-3.0, 0, 42.0) near the police car.

**Idle behaviour**
- Stand in small groups of two or three. Talk to each other with small gestures. Look toward the mountain (north-east) now and then.
- V6 turns to watch the player when the police car is near.
- No walking loops in Ch1 except one villager (V3) who walks to the bench and sits.

**Dialogue triggers (press E)**
- Any villager: "Have you seen the animals? They just walked up the hill." (proposed; generic, one line only)
- Any villager, after Omar is brought in: "Is that him? The one from the Ravens?" (proposed)

**Animation / pose needs**
- stand_group_idle (two-person loop, 3 variants), talk_gesture_small, look_to_mountain, sit_bench (V3 only), walk_short.

**Open questions**
- Do the six need distinct appearances or clothing? Canon is silent. Owner to decide.
- Does any of them speak on the player's Day 1 walk, or only when E is pressed?
