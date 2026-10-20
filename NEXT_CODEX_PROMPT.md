# Omega Valley — prompt for the next Codex

Continue the existing Omega Valley game project. Do not reset, discard, or replace current work. The owner wants the full game finished, with NPCs and story progression matching the approved chronology. Work from this repository and keep the work reviewable.

## Project links

- Repository: https://github.com/Rootsapiens/thevalley
- Published game: https://rootsapiens.github.io/thevalley/
- Team Studio: https://rootsapiens.github.io/thevalley/team.html
- Current shared conversation: https://chatgpt.com/s/cx_6ad7793692748191880b6ee5e9c01d5b
- Local game workspace: `C:\Users\nadee\Desktop\OmegaValley`

## Read first

1. `studio/team.md`
2. `studio/handoff-log.md`
3. `studio/script/episode-one-gameplay.md`
4. `studio/reviews/imad-episode-one.md`
5. `studio/reviews/imad-quarry-clue.md`
6. `studio/reports/issa-game-resume.md`, `studio/audio/khaled-game-resume.md`, and `studio/art/free-assets-manifest.md`

These documents contain current implementation status and open story decisions. Treat approved owner decisions as binding. Names of secondary characters stay role-based; `[ref]` assignments stay unresolved; `proposed` dialogue stays draft until Noor approves it; do not guess building floor elevations.

## Work already saved

- The browser game has a playable Joseph prologue route, village NPC conversations, Maryam's delayed confirmation and walk to the square, Omar's guarded medical/cuff sequence, Day 2 Elia content, Chapter 2 cave route, and Chapter 3 upload/seizure sequence. Several are bounded probes, not full continuous playthroughs. Do not claim the episode or full game is complete without broad runtime evidence.
- Free assets, furniture, nature and animal GLBs are under `public/models/`; nine CC0 Ottoman villagers and license notes are recorded in `studio/art/free-assets-manifest.md`.
- The first three villager models are mapped in `src/npcFigures.ts` (farmer, priest, one square villager); procedural characters remain the fallback. Animation and visual fit still need a live game review.
- Barn ambience is integrated in `src/villageAudio.ts` / `src/villageMain.ts`.
- Unreal scripts and data are in `unreal/`; the binary Unreal `Content/` is intentionally excluded from Git. Unreal editor/runtime staging still needs verification.
- Current local changes include existing work from multiple contributors. The latest `npm run typecheck` and `npm run build` passed; Vite reports the existing large materials-chunk warning.

## Immediate story work

- `src/npcData.ts` now gates Omar's Day 2 “girlfriend” line behind Elia's photo conversation (`elia_cover_introduced`). `src/villageMain.ts` explains Moreno's assignment in the Day 2 objective card; it is UI text, not recorded dialogue. Inspect this transition in the live game and improve it if needed while keeping the approved sequence.
- Required Omar/Elia chronology: Omar at the café before the root attack → gang transformation → Omar escapes with amnesia → police find him near the mountain → cuffed transport to the post → Moreno assigns Elia → Elia appears on Day 2 and starts her cover. Omar is uncuffed after the guarded medical check and during later Elia meetings.
- Quarry clue is unresolved: source village clues point toward the mountain, the Chapter 2 objective starts at the quarry without a clue trigger, and the source map's quarry direction conflicts with the runtime eastbound route. `studio/reviews/imad-quarry-clue.md` records evidence. Get Noor/owner direction before inventing a clue or changing canon.
- Omar's find/transport scene is not staged as a playable scene. Preserve the chronology and do not imply Lorenzo witnessed it unless you implement a visible, recoverable arrival beat.

## Team Studio issue to fix

The owner reports that workers do not appear seated at their desks. In the current page screenshot, one worker appears near the center in a T-pose while desks and name tags cluster at the right. Inspect `assets/team-office.js` in the GitHub Pages worktree. The desk actor is offset from its chair, and the GLB worker assets are skinned; `gltf.scene.clone(true)` may fail to clone their skeleton correctly. The utility `assets/team-office/utils/SkeletonUtils.js` exports `clone`, and all four worker GLBs contain an `idle` animation. Correct desk/chair/actor alignment, use proper skinned cloning, arrange the camera/desk rows so workers visibly sit at their own workstations, then inspect the live page. Keep the room status refresh at five minutes and publish room changes to `gh-pages`.

## How to continue

- Inspect `git status` before editing. Preserve every existing change and asset.
- Focus on the next playable story slice and one concrete NPC/room improvement at a time.
- Run the project checks that fit the change and report precisely what was and was not verified in the browser/Unreal editor.
- Keep public releases on the correct branch: game source on `main`; Team Studio files on `gh-pages`.
- Keep `team-status.json` evidence-based and refresh the room every five minutes; queued people must not be shown as actively working.
- Update `studio/handoff-log.md` with the newest work at the top after meaningful game changes.
- The whole game is still unfinished. Keep going until each episode has a coherent playable route and the end state is verified in runtime.
