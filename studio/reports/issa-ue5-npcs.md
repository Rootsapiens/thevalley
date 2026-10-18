# Issa: UE5 village NPCs (2026-10-18, engine not installed; nothing run in Unreal)
- 15 NPCs exported, 5 floor_to_confirm (omar, elia, moreno, officer_2, farmers_wife), exit 0: `node scripts/export-npcs.ts` (vite-node not in node_modules; Node 24 strips TS types)
- JSON ids = src/npcData.ts NpcId union, 15/15 match: `diff <(grep -oE "npc_[a-z_0-9]+" ...) <(node -e "...npcs.forEach(n=>console.log(n.id))")`
- py_compile place_npcs.py + test_place_npcs.py, exit 0 (Python 3.13 bundled with Blender 5.2; no system Python): `blender -b --factory-startup --python-exit-code 1 --python-expr "py_compile.compile(..., doraise=True)"`
- Pure test 5/5 OK, exit 0 (shrine (22.55, 0, -37.3) m -> (2255, -3730, 0) cm; npc_farmer -> (-1250, 850, 0) cm, yaw -90): `blender -b --factory-startup --python-exit-code 1 --python unreal/scripts/test_place_npcs.py`
- ov_units self-test, exit 0: `blender -b --factory-startup --python-exit-code 1 --python unreal/scripts/ov_units.py`
- run_npcs.ps1 / run_trial.ps1: 0 parse errors (`[Parser]::ParseFile`); find_engine.ps1: no UE 5.x found (expected)
- `npm run check`: exit 0, 87 tests in 8 files; `npm run build`: exit 0
- Not verified (needs UE): actor spawn, folder/tags, idempotent re-run, commandlet level load. Open: Maryam y -3.88 m puts her at Z -388 cm, under the flat ground proxy.
- After installing UE 5.x: `powershell -ExecutionPolicy Bypass -File unreal\scripts\run_npcs.ps1`
