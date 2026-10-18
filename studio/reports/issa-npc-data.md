# Issa: NPC data layer (2026-10-18)
- Files: src/npcData.ts (pure TS, no three import), tests/npcData.test.ts (6 tests).
- `npm run check` exit code: 0 (tsc + vitest, 78 tests passed in 7 files).
- `npx vitest run tests/npcData.test.ts`: 6 passed; NPCS has 15 entries (test "exactly 15").
- Trigger lines at runtime: 32 total, 30 proposed, 2 canon (`node --experimental-strip-types -e "...Object.values(NPCS).flatMap(n=>n.triggers)..."`).
- Cuffed NPCs: 1, npc_omar (test "marks only npc_omar").
- y=0 forced by floorKnown=false: 5 (omar, elia, moreno, officer_2, farmers_wife).
- Placeholders: npc_omar (-15.0, 0, 47.5), npc_elia (y=0, balcony height), npc_moreno (-15.5, 0, 45.0).
- Not committed. villageScene.ts, village.ts, materials.ts untouched.
