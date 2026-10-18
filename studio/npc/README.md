# Village NPCs (Ch1 slice prep, Issa, 2026-10-18; updated with owner decisions)

Data only. Positions are in metres, +Y up, +Z south, from `src/village.ts` and `src/villageMap.ts`. No engine code yet. UE5 stays paused (`studio/decisions.md`).

## Decided by the owner (2026-10-18)
- **Farmer:** on stage in Ch1 (prologue searching), then Lorenzo can talk to him later. Sequence, not parallel.
- **Unnamed roles stay unnamed.** Farmer, farmer's wife, priest, officers, villagers use fixed internal IDs only. No story names are invented.
- **Omar:** starts at the café before the root attack. After he escapes (memory lost), police find him near the mountain and take him to post [6]. He is cuffed on that first transport (known gang leader). Cuffs come off during the medical check under guard. Not cuffed at Elia's meetings.
- **Elia:** not on stage Day 1. Appears Day 2, after Omar is found and Moreno assigns her the cover mission.
- **Maryam:** goes to the square after Joseph is late and she confirms he has not returned. Before that she stays in the house and yard.
- **Floor heights** (café upstairs, school interior): not decided by geometry yet. Zero is a temporary value for testing only. Set real heights when the buildings are added to `src/`, then fix feet, navigation and seat positions.
- **"proposed" dialogue lines** are drafts until Noor approves the final AR text. They can be used for testing, not for voice recording.

## Event order that binds Omar and Elia
Café and raven activity → root attack and gang turns → Omar escapes, loses memory → found near the mountain → taken to post [6] → Moreno assigns Elia the cover → Elia appears on the balcony (Day 2).
Do not show Omar at post [6] before the found event, and do not start Elia's cover before the assignment.

## NPC list and IDs

| ID | Spec file | Role | Scene |
|---|---|---|---|
| npc_maryam | maryam.md | Joseph's mother, house [7] | Ch1 (square after trigger), Ch4 |
| npc_omar | omar.md | Former Raven leader, memory lost | Day 1 café → post [6]; Day 2+ café |
| npc_elia | elia.md | Undercover officer, Omar's cover girlfriend | Day 2+ (café balcony) |
| npc_moreno | moreno.md | Police chief, post [6] | Ch1; assigns Elia on Day 2 |
| npc_officer_1, npc_officer_2 | police-officers.md | 2 officers under Moreno (unnamed) | Ch1 |
| npc_priest | priest.md | Village priest (unnamed) | Ch1, Ch3 vigil |
| npc_farmer | farmer.md | Farmer, barn [1] and farmhouse [2] (unnamed) | Ch1 (on stage) |
| npc_farmers_wife | farmers-wife.md | Farmer's wife, TV in farmhouse (unnamed) | Ch1 |
| npc_square_villager_1..6 | square-villagers.md | 6 background villagers in the square (unnamed) | Ch1 |

**Not NPCs in this slice:** Joseph and Lorenzo (player characters), Sal, Kira, Thomas (later chapters or not in the village), Sal's parents (no names in canon, not in the village), Ravens "Bound" (Ch2+ enemies), agency patrols (Ch4), the dog (gone).

## Still open (need the owner or Noor)
1. Which of the two `[ref]` lines in `characters.md` belongs to the farmer and which to his wife. Not guessed; do not move a line between them.
2. Floor heights of the café upstairs room and the school interior (see above).
3. Noor's approval and the AR text for every "proposed" line.
4. Exact square target points for Maryam and the story flag that sends her there.
