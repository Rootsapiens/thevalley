# Maryam (مريم) — id: npc_maryam

**Role:** Joseph's mother. Searches for her son in Ch1. Lives in house [7], the last house before the stream.
**Canon:** story-canon-ar.md (Prologue, Ch4 names her); characters.md "Maryam".
**Scene:** Ch1 (Day 1), Ch4 (Day 8, the only villager left in [7]).
**Decision (owner, 2026-10-18):** yes, she goes to the square, after Joseph is late and she confirms he has not come back. Before he disappears she stays in the house and its yard.

**Position (m, +Y up, +Z south; from src/villageMap.ts MARYAM_YARD and the house footprint)**
- Ch1 idle: inside the kitchen, just inside the south door, at (74.0, -3.9, 12.0). Door at x=74 on the south wall (z=14.5).
- Yard floor: y = -3.9 (MARYAM_YARD.y). Kitchen floor = yard pad + 0.02.
- Yard gate (back): (77.5, -3.9, 22.5). Back steps: x 92.75..95.27, z 6.4..8.6.
- Square: walk target to be placed on the square cobbles (not yet in the NPC data).

**Idle behaviour**
- Ch1, before the trigger: stands at the kitchen table, turns to the door when the player comes near, then turns back. Hands twist a cloth.
- Ch1, after the trigger (Joseph late, she checks): walks from the kitchen to the square once, at slow pace, then stands and looks toward the path. Does not walk back on her own.
- Ch4: alone, sits by the stove. Does not leave.

**Dialogue triggers (press E)**
- Ch1, at the door: "Have you seen my son? He had the cow's rope with him." (proposed, not in canon; needs Noor's line)
- Ch1, after the posters: "I put those up myself. Nobody has called." (proposed)
- Ch4, at the gate: "I am not leaving until he comes back." (proposed)

**Animation / pose needs**
- idle_stand_worried (weight shift, hand to chest), talk_small_gesture, turn_head_to_player, walk_slow, sit_chair (Ch4).

**Open questions**
- Exact square target point and the trigger flag that sends her there (story flag, to set with Noor).
- Her Ch1 line text: Noor to write (AR and EN).
