# Maryam (مريم) — id: npc_maryam

**Role:** Joseph's mother. Searches for her son in Ch1. Lives in house [7], the last house before the stream.
**Canon:** story-canon-ar.md (Prologue, Ch4 names her); characters.md "Maryam".
**Scene:** Ch1 (Day 1), Ch4 (Day 8, the only villager left in [7]).
**Decision (owner, 2026-10-18):** yes, she goes to the square, after Joseph is late and she confirms he has not come back. Before he disappears she stays in the house and its yard.

**Position (m, +Y up, +Z south; from src/villageMap.ts MARYAM_YARD and the house footprint)**
- Ch1 idle: inside the kitchen, just inside the south door, at (74.0, -3.9, 12.0). Door at x=74 on the south wall (z=14.5).
- Yard floor: y = -3.9 (MARYAM_YARD.y). Kitchen floor = yard pad + 0.02.
- Yard gate (back): (77.5, -3.9, 22.5). Back steps: x 92.75..95.27, z 6.4..8.6.
- Square target: (43.5, 0, 43.0), on the east edge of the square, clear of the fountain, bench and villagers.

**Idle behaviour**
- Ch1, before the trigger: stands at the kitchen table, turns to the door when the player comes near, then turns back. Hands twist a cloth.
- Ch1: after Lorenzo's first question, she waits 8 game seconds. Her next line confirms she checked and Joseph did not return; only then does she open the yard gate and walk to the square. She stays there.
- Ch4: alone, sits by the stove. Does not leave.

**Dialogue triggers (press E)**
- Ch1, first talk at home: "Have you seen my son, Joseph? His bed was empty this morning." (proposed)
- Ch1, after 8 game seconds: "I waited, then checked the house. He has not come back." (proposed; hearing it starts her walk to the square)
- Ch1, after the posters: "I put those up myself. Nobody has called." (proposed)
- Ch4, at the gate: "I am not leaving until he comes back." (proposed)

**Animation / pose needs**
- idle_stand_worried (weight shift, hand to chest), talk_small_gesture, turn_head_to_player, walk_slow, sit_chair (Ch4).

**Implementation note**
- The runtime uses `maryam_waited_without_joseph` after the 8-second wait and `joseph_late_confirmed` after her confirmation line. Dialogue is still proposed and needs Noor's final Arabic review.

**Open questions**
- Review the chosen square target against a running scene capture.
- Noor's final Arabic/English dialogue approval.

**Story draft:** `studio/script/prologue-arrival-draft.md` sets her move after both conditions hold: Joseph is late and she has confirmed he did not return. A day change alone must not move her.
