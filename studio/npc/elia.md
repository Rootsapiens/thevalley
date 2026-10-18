# Elia (إيليا) — id: npc_elia

**Role:** Police officer working undercover as Omar's girlfriend. Her cover identity is secret from Omar and the village.
**Canon:** story-canon-ar.md (Elia watches Omar); characters.md "Elia"; village.md (balcony from Day 2).
**Decisions (owner, 2026-10-18):** she appears on Day 2, after Omar is found. Her cover mission starts after Moreno assigns it.

**Trigger order (binding):** Omar found and brought to post [6] (Day 1) → Moreno assigns Elia the cover mission → Elia appears on the café balcony (Day 2). Do not start her cover before Moreno's assignment is set.

**Scene:** Day 2 onward. Not on the village stage in the Day 1 opening.

**Position (m, +Y up; from src/villageTown.ts, "upstairs balcony on the square side")**
- Balcony on the café's north face (z = 60.5), x about 9.0, standing at the rail at (9.0, Y_balcony, 60.3).
- Y_balcony: upstairs floor of the café (not in src yet; set when the café is built, do not guess).
- Alternative spot, two cafe tables on the cobbles below the balcony: about (7.0, 0, 58.0).

**Idle behaviour**
- Day 2+: leans on the balcony rail, watches the square, drinks from a cup.
- Turns toward the post [6] when a police car arrives.
- Goes inside when Omar comes out (scripted hand-off, if used).

**Dialogue triggers (press E)**
- Day 2+, balcony: "He's resting. Please come back later." (proposed)
- Day 2+, balcony, after the posters: "Are you the one putting up the photos?" (proposed)
- Later (Ch2+): "Tell me what you remember, even something small. I'm here." (characters.md Elia line, marked [new])

**Animation / pose needs**
- lean_on_rail_idle, look_to_square (head turn), drink_from_cup, walk_inside (turn, step back).

**Open questions**
- Her cover name, if she has one, is not in the canon.
- Floor height of the balcony (see Y_balcony).
