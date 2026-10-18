# Omega Valley — Chapter Plan

## 1. Who the player is
**Recommendation: Sal (سال) is the main FPS protagonist and plays Chapters 4–8, which are every combat chapter.** Lorenzo (لورينزو) plays Act I. Joseph (جوزيف) plays a short Prologue and Kira (كيرا) a short Epilogue. Every chapter stays in first person, and its title card names who the player is.

Why Sal:
1. The canon's only usable weapon against the roots, electricity, is **his** discovery. The main gameplay verb belongs to the main character.
2. He has the longest arc inside the mountain (Day 8 to the strike), and he wants something simple and strong: get his father out.
3. He is not a soldier. A hatchet, a nail driver and a stun prod fit a civilian, which keeps the late-90s "ordinary person in over their head" feel.

Why Lorenzo plays Act I: the canon makes him the witness. His camera is how the world learns about Joseph. His chapters happen in the village, which the owner wants built first, and they need no combat AI. That means the village can ship and be tested before the enemies are reskinned.

## 2. Chapters (10 in total: Prologue, Chapters 1–8, Epilogue. About 115 minutes)
| # | Title | Player | Day | Canon beat | Region | Teaches | Min |
|---|---|---|---|---|---|---|---|
| P | Same Direction (اتجاه واحد) | Joseph | Night 0, 16:40 | The animals walk to the mountain. Joseph follows a cow and is preserved | Village → stepping stones → cave mouth → Hall | Look, walk, use doors and gates, jump 1.0 m walls, crouch under fence rails. No HUD | 8 |
| 1 | Arrival (الوصول) | Lorenzo | Day 1 | Lorenzo looks for the missing man. Maryam searches. Police bring in Omar | Village | Talk (E on NPC), film (hold RMB, battery), read places | 12 |
| 2 | The Ravens' Road (طريق الغربان) | Lorenzo | Day 3 | Follows the clues into the mountain. Finds Joseph and the animals and films them | Quarry → Ravens' tunnels → breakthrough → Hall → mouth | Moving in the dark with the camera light. Reading root-lash warnings (creak plus dust, 0.6 s). Crouch timing. No weapon | 15 |
| 3 | Signal (الإشارة) | Lorenzo | Day 3 night → Day 4, 05:10 | The footage spreads. Agencies detain Lorenzo and take his footage | Village, bell tower | Ladder climbing. Hold-use for 20 s under a timer. The detention plays in first person: hands zip-tied, camera taken | 6 |
| 4 | Cordon (الطوق) | Sal | Day 8 | Sal follows his father, whom the agencies have taken into the mountain with the team | Evacuated village → stream → quarry camp | Stealth, hatchet, prod used on fuse boxes. Maryam shows him the stepping stones | 12 |
| 5 | Live Wire (السلك الحي) | Sal | Day 8 night | The father is attacked among the remains. Sal finds that an electric shock forces the roots back | Ravens' tunnels (reskinned Night Shift) | First combat: Bound and Knot. Nail driver, breakers, and the prod discovery | 15 |
| 6 | Shifting Rock (الصخر المتحرك) | Sal, with his father | Day 9 | The passages change and the safe way out is cut | Breakthrough → caves | Laying cable from the reel. Managing prod charge. Escort: the father carries the reel. Moreno's warnings come over the radio | 18 |
| 7 | The Hall (القاعة) | Sal | Day 9 → 10 | With Kira and Thomas. The strike is ordered | Hall, the Well | Defending a point: power 4 floodlight towers and hold for 3 minutes. Sal sees Joseph | 15 |
| 8 | Strike (الضربة) | Sal | Day 10 | The strike while they are trapped. Sal may lose his father after reaching him | Hall → Well → the Deep | Everything under pressure: collapses every 40–90 s, power fails at minute 6. The ending is left open and stays in first person | 12 |
| E | Elsewhere (في مكان آخر) | Kira | Unknown | Kira wakes in an unknown forest | Unknown forest | Walk only, no HUD. An animal turns its head toward her | 4 |

Act I is Chapters P–3 (about 41 min, no combat). Act II is Chapters 4–6. Act III is Chapters 7, 8 and E.
Omar and Elia are never playable. Their story runs alongside Sal's and is told in the village (Ch1 and Ch3: the café balcony, overheard lines) and over Moreno's radio (Ch6–8).

## 3. How the current engine mechanics map to the canon
| Engine mechanic (already built) | Becomes | Where |
|---|---|---|
| Walk, crouch, jump | Same. Crouch under root crawlways (1.0–1.2 m) and fallen timber sets (1.15 m). Jump 1.0 m dry-stone walls | All chapters |
| Melee (pipe wrench) | **Olive-pruning hatchet**: cuts tendrils up to 10 cm, which grow back in 60 s | Ch4–8 |
| Nail-type ranged weapon (nail driver) | **Nail driver** from the Ravens' timber-shoring bench. Pins a lash for 2 s. Main weapon against the Bound | Ch5–8 |
| HUD "suit charge" | **Prod charge**: a 100% battery. Each shock costs 20%. Recharges at generators | Ch4–8 |
| *(new, small)* | **Stun prod**: the farmer's cattle prod from barn 1. Clears a 3 m cone of roots for 8 s | Ch4 pickup, Ch5 discovery |
| Use key on panels (breakers) | Generator breakers, gate winch, fuse boxes, cable-reel sockets. A powered circuit keeps a 2 m corridor clear while it runs | Ch2 (dead), Ch5–8 |
| Doors | Barn doors, house doors, church door, steel mine gate | All chapters |
| Scripted collapses | Night Shift's catwalk collapse becomes the timber bridge in Ch5. Passages that shift (Ch6), and the strike (Ch8) | Ch5, 6, 8 |
| Triggers | Story beats: the herd turns, Omar arrives, agency vehicles, the discovery | All chapters |
| Intercom subtitles | Phone calls (Sal's mother), Moreno's police radio, agency loudspeaker, spoken NPC lines | All chapters |
| Lunging floating enemy (Drifter AI: idle → chase → windup → lunge) | **Bound**: a Raven anchored to the wall by a root cord with 6 m reach, so the floating movement is clamped to the leash. The windup is the 0.6 s creak warning | Ch5–8 |
| Stationary turret enemy (Shard) | **Knot**: a fixed root cluster that throws wooden splinters. It needs generator power or 60 damage | Ch5–8 |
| Quick-save / quick-load | Same | All chapters |

## 4. Current placeholder content that must be replaced
**REPLACE**
- `src/nightshift.ts`: all `LINES`, including "Gravity Well Two", "containment fault", "evacuate via the spillway", "CHAPTER 1 COMPLETE — NIGHT SHIFT". The rupture light tag and the teal light. The room names (locker room, control room, spillway).
- `src/main.ts`: the `RUPTURE_AT` timer and the 'rupture' event name. The "NAIL DRIVER… still loaded" line can stay. The teal enemy materials.
- `index.html`: "Chapter 1: Night Shift".
- `studio/game-brief.md` §1 (setting, player, rupture) and §5 (slice), `studio/slice-design.md`, and the `studio/roadmap.md` M2 wording.
- `studio/art/style-guide.md`: desert dam, teal, "facility". Also `palette.json` `ruptureTeal`.
- Art prompts `sky-canyon-night`, `concrete-spillway-wet`, `concept-drifter`, `concept-shard`, `title-key-art`, `loading-screen`, `concept-viewmodel` (the wrench).

**KEEP and reskin**
- The Night Shift layout becomes the Ch5 blockout. Each part maps as follows:

  | Night Shift | Ch5 |
  |---|---|
  | Locker room | Bunk room |
  | Tunnel and pipe | Gallery with a fallen timber set |
  | Control room and 3 breakers | Generator hall |
  | Floodgate | Steel gate |
  | Catwalk collapse | Timber bridge collapse |
  | Spillway | Underground stream channel |
  | Exit stairs | Winze ladder |

- Code identifiers (`Drifter`, `Shard`) can stay inside the code. Player-facing names must change.

**KEEP as is**
- The engine, controls, quick-save, the originality rule and the pillars. Pillar 2 is reworded (see `conflicts.md`).

## 5. Build order
1. **Village blockout**, following the `regions/village.md` grid, with the Prologue state. Only movement, use and triggers are needed. No enemies.
2. **Ch1 village state:** NPCs with subtitle lines, and the camera verb.
3. **Ch5 reskin of Night Shift:** Bound, Knot, prod. This is the first combat slice.
4. Then Ch2, Ch3, Ch4, Ch6, Ch7, Ch8, E.
