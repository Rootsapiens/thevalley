# Moreno (مورينو)

**Role:** Local police chief. Runs the case against the Ravens and later tries to get warnings out about the people still inside the mountain.
**Canon:** story-canon-ar.md (police find Omar; Moreno knows him); characters.md "Moreno".
**Scene:** Ch1 (Day 1) at police post [6], with 2 officers (see police-officers.md). Day 2: assigns Elia her cover mission as Omar's girlfriend (see elia.md).

**Position (m, +Y up; from src/villageMap.ts school footprint and village.md [6])**
- Interim, until [6] has an interior: outside the school east door, south side, (-9.4, 0, 49.4), facing east. Floor y = 0.
- Target once the interior exists: inside the school (x -19.5..-10.5, z 40.5..54.5), at his table with maps, about (-15.5, 0, 45.0).
- Outside: stands at the police car at (-7.2, 0, 44.2) when he arrives or leaves.

**Idle behaviour**
- Stands at the table, reads a map, taps it with a pen.
- Looks up when Omar is brought in, then looks at Omar for a long beat.
- Walks to the door when the player approaches and steps back when the player leaves.

**Dialogue triggers (press E)**
- Day 1, table: "You're the reporter who was asking about Joseph. What do you want from me?" (proposed)
- Day 1, table, after seeing Omar: "Did he say anything when they brought him in?" (proposed)
- Ch3+ (not in this slice): "There are people inside. Write that in your report." (characters.md Moreno line, marked [new])

**Animation / pose needs**
- stand_at_table_idle (leaning, reading), tap_map_gesture, look_up_to_door, turn_and_walk_to_door, talk_small.

**Open questions**
- Exact table and chair position inside [6]: not in src yet.
- Does Moreno question the player (Lorenzo) on Day 1, or only watch?
