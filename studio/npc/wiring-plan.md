# NPC wiring plan (Issa, 2026-10-18)

Goal: place the 15 NPCs from `src/npcData.ts` in the village scene. Owner: Issa for data and tests. `src/villageScene.ts` is owned by Rajaie, so every step touching it needs Rajaie.

## Visibility rules (from studio/npc/README.md)
- **Day 1:** Maryam (house [7]; square only after Joseph is late), Omar (café before the attack, then found near the mountain, then cuffed at post [6]), Moreno, officer_1, officer_2, priest, farmer, farmer's wife, square villagers 1-6. Elia is hidden.
- **Day 2:** Maryam, Omar (café upstairs, uncuffed at Elia's meetings), Elia (café balcony, only after Moreno's assignment), Moreno (assigns Elia). The day-2 list in `npcsAtDay` drops the others; the README does not say so, so confirm with the owner.
- Omar and Elia are gated by the ordered event list (`ORDER`), not by day alone.

## Steps
1. **Baseline.** Run `npm run check`. Files: none. Test: existing `tests/npcData.test.ts` (10 tests). Check: exit 0.
2. **Maryam gate.** `npcsAtDay(1)` shows Maryam with no story flag, but the README hides her until Joseph is late. Add an option `maryamSquare` (or a flag). File: `src/npcData.ts` (Issa). Test: Maryam absent from the square unless the flag is set. Check: `npx vitest run tests/npcData.test.ts`.
3. **Event gate tests.** Add tests that Omar is absent with `events = []` and that Elia is absent on Day 2 without `ORDER[5]`. File: `tests/npcData.test.ts` (Issa). Check: vitest run.
4. **Placement helper.** Add `npcPlacements(day, options)` returning id, position, yaw, cuffed, stage. File: `src/npcData.ts` (Issa). Test: positions match `NPCS` for every day. Check: vitest run.
5. **Floor heights (blocked).** Floors for café upstairs, school interior and farmhouse are open. Files: `src/villageTown.ts`, `src/villageMap.ts` (needs Rajaie). Test: `floorKnown` true for all NPCs with a real floor. Check: owner decision, then `npm run check`.
6. **NPC group in scene.** Add an `npcGroup` with placeholder capsules at each position. File: `src/villageScene.ts` (needs Rajaie). Test: e2e counts 15 NPC meshes on Day 1. Check: `npx playwright test tests/e2e/village-walkthrough.spec.ts`.
7. **Visibility switch.** Add `setNpcVisibility(day, events)` calling `npcsAtDay`. File: `src/villageScene.ts` (needs Rajaie). Test: Day 1 hides Elia; Day 2 shows her only after `ORDER[5]`. Check: e2e plus vitest for the pure list.
8. **Cuffs and transport.** Omar is cuffed at post [6] and uncuffed after `medicalCheckComplete`. File: `src/villageScene.ts` (needs Rajaie). Test: `cuffed` flips on the medical check flag. Check: vitest and one e2e run.
9. **Dialogue triggers.** Connect each trigger id to the interaction prompt, showing only the line text. Files: `src/villageMain.ts` (needs Rajaie), `src/npcData.ts` (Issa, if a trigger lookup is needed). Test: every `proposed` trigger is tagged as draft in the UI. Check: vitest; manual e2e.
10. **Unit conversion (deferred).** Meters, +Y up to centimeters, +Z up in Unreal. Only when the owner resumes UE5. File: `unreal/` (Issa). Test: one known landmark (the church altar at 21.9, 30.75) converts correctly. Check: landmark printed in the report.
11. **Report.** Write `studio/reports/issa-npc-wiring.md` (12 lines max) with the command for each number. File: that report (Issa). Check: the commands rerun cleanly.
12. **Final gate.** Run `npm run check` and `npm run build`. Files: none. Check: both exit 0 before the task counts as done.

## Open items
- Maryam's square flag name and Joseph-late trigger (owner).
- Day 2 presence of officers and villagers (owner).
- Floor heights and "proposed" lines (owner, Noor).
