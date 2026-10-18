# Omar (عمر) — id: npc_omar

**Role:** Former leader of the Ravens (الغربان). Lost his memory on Night 0. The only Raven who escaped.
**Canon:** story-canon-ar.md (escapes, memory gap); characters.md "Omar".
**Decisions (owner, 2026-10-18):** see README "Decided".

**Timeline (binding order, with Elia):**
1. Café, before the root attack: Omar is at the café (Day 1, scripted, not on the police stage).
2. Root attack: the Ravens turn. Omar escapes and loses his memory.
3. Found near the mountain by police, Day 1.
4. Carried to post [6] in handcuffs (he is a known gang leader). Cuffs come off during the medical check under guard.
5. Day 2+: lives in the upstairs room of the café with Elia. Not cuffed at her meetings (cover needs it).

**Position (m, +Y up; from src/villageTown.ts POLICE_CAR, src/villageMap.ts school and door)**
- Found: near the mountain, position not yet placed (to set with the Ch1 scene).
- Transport in: police car at (-7.2, 0, 44.2), yaw 0.12. Walks to the school east door at (-10.5, 0, 47.5), then inside, cuffed.
- Seated at the post: inside [6] (school x -19.5..-10.5, z 40.5..54.5), chair by Moreno's table at about (-15.0, 0, 47.5). Floor y = 0 (temporary, to confirm).
- Day 2+ upstairs room: x 0.5..19.5, z 60.5..69.5. Floor height not in src yet.

**Idle behaviour**
- Ch1, seated and cuffed: sits, head down, hands loose between his knees. Looks up only when someone says "Ravens" or "mountain".
- Ch1, near the window: stands and looks at the mountain (north-east), bearing 45 deg.

**Dialogue triggers (press E)**
- Ch1, seated: "They say I know this mountain. I don't even know my name the way they say it." (characters.md Omar line, marked [new]; owner to approve)
- Day 2+, after Elia's cover starts: "Who is that woman who keeps looking at me?" (proposed; Elia cover story)

**Animation / pose needs**
- seated_cuffed_idle_head_down, stand_up_slow, walk_escorted_cuffed (car to post), uncuff_under_guard (medical check), look_to_window, talk_small.

**Open questions**
- Exact placement where he is found near the mountain (for the Ch1 scene).
- Floor height of the café upstairs room (not in src yet).
