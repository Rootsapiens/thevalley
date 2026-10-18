# Police officers (2, unnamed)

**Role:** Two officers under Moreno. Guard the police car and the post [6] on Day 1.
**Canon:** village.md (Ch1: "Moreno and 2 officers are at [6]"). No names in the canon, so none are given here.
**Scene:** Ch1 (Day 1).

**Position (m, +Y up; from src/villageTown.ts POLICE_CAR and the school door)**
- Officer A: at the police car door, (-8.0, 0, 44.6), facing the square.
- Officer B: inside the school doorway, (-11.5, 0, 47.5), facing out.
- Floor y = 0.

**Idle behaviour**
- Officer A: stands by the car, hands behind back, shifts weight. Looks at the player when near.
- Officer B: stands in the doorway. Turns to look at Omar when he comes in.
- Neither moves far from their spot.

**Dialogue triggers (press E)**
- Officer A, at the car: "Step back from the car, please." (proposed)
- Officer B, at the door: "The chief is busy. Wait out here." (proposed)

**Animation / pose needs**
- stand_idle_hands_behind, turn_head_to_player, step_aside (for player to pass), walk_to_car (escort of Omar).

**Open questions**
- Names and count: the canon gives neither. Two is the village.md number; confirm.
- Do they need uniforms or a second material set? Owner to decide (Rajaie's textures).
