# Omega Valley — Game Index

**Play:** https://rootsapiens.github.io/thevalley/ · **Repo:** https://github.com/Rootsapiens/thevalley · Continue the work from `HANDOFF.md`.

## 1. The game
A first-person story game set in the world of the ROOTSAPIENS movie. A mountain village, animals walking into the caves, living roots that preserve whatever they touch, the Ravens gang, and electricity as the only thing that pushes the roots back.
- **Canon story:** `studio/world/story-canon-ar.md` · **World:** `studio/world/world-bible.md` · **Characters:** `studio/world/characters.md`

## 2. Chapters (`studio/world/chapter-plan.md`) — about 115 minutes
| # | Chapter | Player | Status |
|---|---|---|---|
| P | Same Direction (اتجاه واحد) | Joseph | planned |
| 1 | Arrival (الوصول) | Lorenzo | **in build**: village, barn, church, NPCs in progress |
| 2 | The Ravens' Road (طريق الغربان) | Lorenzo | planned |
| 3 | Signal (الإشارة) | Lorenzo | planned |
| 4 | Cordon (الطوق) | Sal | planned |
| 5 | Live Wire (السلك الحي) | Sal | planned (the old Night Shift level gets reskinned here) |
| 6 | Shifting Rock (الصخر المتحرك) | Sal + father | planned |
| 7 | The Hall (القاعة) | Sal | planned |
| 8 | Strike (الضربة) | Sal | planned |
| E | Elsewhere (في مكان آخر) | Kira | planned |

## 3. What is playable now
- **Village (default):** the barn opening, the full village, a church with stained glass, Michelangelo drawings and photos, lanterns, doors, a bell rope, pushable props, and footsteps that change with the surface.
- **Old engine test:** `?level=nightshift` (combat, breakers, collapse).

## 4. Controls
WASD move · mouse look (drag inside the in-app browser) · Shift jog · Space jump · Ctrl/C crouch · E examine/use/talk · RMB film (Lorenzo, in progress) · F3 debug · F5/F9 quick save/load (Night Shift).
**Secret:** type `sinafly` to ride the flying carpet (Space up, Ctrl down; type it again to land).

## 5. Code map (`src/`)
| File | What |
|---|---|
| `villageMain.ts` | Village game loop, input, HUD, carpet |
| `village.ts` / `villageMap.ts` | Barn slice data / whole-village map |
| `villageScene.ts` / `villageTown.ts` | Rendering: barn, lights / town, church |
| `villageTextures.ts`, `materials.ts` | Textures and materials |
| `entities.ts` | GoldSrc-style doors, bell rope, pushables |
| `npcData.ts`, `npcPlacement.ts`, `npcTalk.ts`, `npcFigures.ts` | NPC lines, positions, talk, figures |
| `physics.ts` | Movement and collision (Quake-style) |
| `nightshift*.ts`, `combat.ts`, `facility.ts`, `save.ts` | Old test level, combat, save/load |

## 6. Assets and other tools
- Art: `public/art/` (Blender textures, valley sky) and `public/art/photos/`. Models: `public/models/` (55 CC0 pieces, `studio/art/furniture-manifest.md`). Credits: `CREDITS.md`.
- Unreal 5.8 version: `unreal/` (scripts) + `C:\Users\nadee\OVUnreal` (project). Run with `unreal/scripts/play.ps1`.

## 7. Build and test
`npm ci` · `npm run dev` · `npm run check` (unit tests) · `npx playwright test` (e2e) · `npm run build`.

## 8. Team and process
`studio/team.md` (13 agents) · `studio/decisions.md` · `studio/handoff-log.md` · reports in `studio/reports/` · stills in `studio/stills/`.
