# NPC event order review (Imad, 2026-10-18)
Checked: studio/npc/README.md vs studio/slice-design.md vs studio/world/chapter-plan.md.

## Contradictions
1. slice-design.md is the old Night Shift slice (locker room, breakers, Drifters). It has no village walkthrough, no NPC, no Omar/Elia step, no flag. The binding order is unverified against any walkthrough. chapter-plan s4 marks this file REPLACE.
2. Day 2 has no chapter. chapter-plan: Ch1 = Day 1, Ch2 = Day 3. README puts Elia's balcony debut on Day 2, so the player never stands there on Day 2.
3. chapter-plan says Omar and Elia are told "in the village (Ch1 and Ch3: the café balcony, overheard lines)". README says Elia is absent from Ch1. Balcony in Ch1 is wrong, or the README is. Ch3 (Day 3 night to Day 4) is the first slot that fits.
4. chapter-plan Ch1 canon beat "Police bring in Omar" is Day 1. README has found, post [6] and cuffs on Day 1, but Moreno's assignment on Day 2. The assignment has no on-screen slot in Ch1.
5. README table lists npc_omar "Day 1 café" before the attack. The player (Lorenzo) arrives Day 1 after the attack (the prologue is Night 0). It is not stated whether café, attack and escape are shown or only reported.

## Missing triggers (no flag name exists for any of these)
cafe_seen, root_attack, omar_escaped, omar_found, omar_at_post6, elia_assigned, elia_on_balcony. Count of set/read sites: 0 each (no code yet). Maryam's square flag is already listed as open.

## Red herring and lock problems
- Post [6] and Moreno are on stage in Ch1 and reachable. Omar must be hidden there until omar_found, so post [6] needs a gate or a timed state. Without it, an empty cell or an early Omar breaks the order.
- The café balcony is visible all of Day 1 but Elia only arrives on Day 2. An empty balcony reads as a locked or broken spot. It needs a fail line ("nobody there") or a visible reason.
- Moreno assigns Elia: the player needs a clue (overheard line or note) before the balcony meeting. Currently the assignment is off-screen, so Elia's cover has no in-world reason for the player.
- Cuffs on Omar then off during the medical check: two visual states with no trigger between them.
- Farmer then Lorenzo sequence and the Maryam square trigger can fire before found. Their order against omar_found is not stated.

## Needed
Add a village walkthrough and a flag table to slice-design.md, and decide the Day 2 slot (Ch1 end or Ch2 start). Owner decision needed on items 2 to 4.
