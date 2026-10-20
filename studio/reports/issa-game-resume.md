# Issa — Unreal NPC staging resume (2026-10-20)

## Implemented in source
- Added `unreal/scripts/npc_story_state.py`: pure validator and per-NPC stage mapping. Requires all 15 stable IDs and the exact approved event-order prefix; rejects out-of-order events, premature medical completion, premature transport, and Maryam confirmation before Joseph is late.
- Added `unreal/scripts/apply_npc_story_state.py` + `run_npc_story_state.ps1`: applies a supplied chapter/day/event snapshot to the placed actors, updates visibility, location where explicitly specified, and story-stage/talk/cuff tags, then saves the current Unreal level. It is editor authoring/staging, not a packaged runtime controller.
- Omar and Elia start hidden in the base placement. Omar is café-stage before attack, hidden during attack/escape, mountain-found only at a named level anchor, cuffed only during explicit transport or at the post until medical completion. Elia is shown Day 2 only after Moreno's assignment and the medical check. Maryam moves to the approved square endpoint only when both late and confirmation flags are supplied.
- Missing Omar scene anchors keep him hidden and are returned as warnings; exact café/mountain positions were not invented. Added Day 1 post and Day 2 assignment sample state files.
- Fixed the Node 24 exporter invocation with a small extension resolver; refreshed `unreal/data/village-npcs.json` from current `src/npcData.ts` (15 stable IDs, current source hash `0a043f70a4d4905f`, zero unknown-floor entries). Updated the Unreal Farmer facing assertion to the approved mountain bearing.

## Verification
- `unreal/scripts/test_npc_story_state.py`: 8 tests passed (event order, visibility gates, transport cuffs, medical release, Elia assignment/day gate, Maryam condition, unresolved anchors).
- `unreal/scripts/test_place_npcs.py`: passed; unit conversion and existing placement checks remain green.
- Python 3.11 `py_compile` passed for the touched Python modules. PowerShell parser passed for both NPC runners. `git diff --check -- unreal` reported no whitespace errors.
- Export command passed: `node --experimental-strip-types --experimental-loader ./unreal/scripts/ts_extension_loader.mjs scripts/export-npcs.ts unreal/data/village-npcs.json`.

## Not runtime-proven / open
- No Unreal Editor or commandlet was launched for this task. The script-to-actor API, viewport visibility, saved level result, and visual placements need an editor pass.
- Omar's exact café and mountain discovery coordinates are still unset. Add level actors `OV_StoryAnchor_OmarCafe` and `OV_StoryAnchor_OmarMountain` only when those positions are authored; otherwise the validator safely leaves Omar hidden there.
- Transport is a staged location snapshot at the documented police-car point; there is no escort animation/route, visible handcuff prop, or in-game conversation controller in this editor utility. The `storyCuffed`/`storyTalkable` values are actor tags for review and future runtime wiring.
- To preview after authored anchors exist: run `run_npcs.ps1`, then `run_npc_story_state.ps1 -StateFile unreal/data/npc-story-states/day1-post-transport.json` or `...day2-elia-assigned.json`. The level changes only after that explicit editor run.
