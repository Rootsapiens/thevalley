## 2026-10-20 — Subzero: NPC staging and next Day 2 gate
**Integrated status:** Committed baseline is `5810e49` (following `b886893`); Chapter 2 visuals, optional Ch1 evidence, Prologue recovery, outdoor connectors, and the initial six NPC figure mappings are committed. The shared working tree retains Layla's treatment update in `studio/script/episode-one-gameplay.md` and this handoff edit.
**Evidence:** Issa's `studio/reports/issa-game-resume.md` documents a UE editor staging utility that validates the approved event-order prefix for all 15 stable NPC IDs, hides Omar/Elia until their approved scene stages, handles cuff state only at transport/post, and gates Maryam's move on both Joseph-late and confirmation flags. The report records 8 `test_npc_story_state.py` tests passed, placement test passed, Python compile and PowerShell parsing passed, and the NPC data export completed with 15/15 IDs and zero unknown-floor entries. It explicitly has no Unreal Editor/commandlet runtime proof; Omar café/mountain anchors and escort route remain unauthored. Commits `b886893`/`5810e49` map CC0 figures to the farmer, priest, and four anonymous square-villager IDs, and update the mapping test to exclude trader/vezir assets. This coordination pass has not confirmed test execution or browser appearance; an Unreal editor runtime pass is also absent.
**Story coordination:** Layla's treatment identifies a confirmed Day 2 skip path: Omar's existing `omar_watcher` can complete before Lorenzo hears Elia's existing `elia_photos`. Next web gameplay change should gate the Day 2 transition on Elia's photo line while preserving Omar's interaction and objective if reached early. The assignment event remains pre-seeded and communicated by the objective card; no separate assignment scene or new dialogue is needed for this gate. Proposed Arabic lines remain draft pending Noor. Ch2's reason for following the east road still needs a visible, already-established clue; do not invent one.
**Next:** Keep Issa's GLB audit isolated to the NPC renderer and tests. Assign Rajaie/Zurub the Day 2 sequencing gate when available, then have Firas verify both arrival orders and the resulting chapter transition. Maintain the ordered Omar discovery/transport chain; Unreal staging is not a packaged runtime controller. Ch2 post-fix visual screenshots and a continuous player-driven route review remain open, as noted below.

## 2026-10-20 — Subzero: Chapter 2 visual pass and HUD fixes
**Done:** Reviewed six existing browser captures (mine portal, recorder depot, root crawlway, Bound Ravens' card room, Breakthrough Hall, cave exit) and built `studio/reports/ch2-contact-sheet.png`; details in `studio/reports/chapter-two-visual-review.md`. Fixed observed visual issues in `src/chapterTwo.ts`: added restrained warm lights at depot/crawlway/card-room/Hall, made the roots readable in darkness, narrowed and softened the Hall shaft so it no longer dominates the view, improved Joseph contrast, and reduced cave-mouth plane opacity/depth blocking. Repositioned the Ch1 testimony toast below the objective in `index.html`; it no longer occupies the evidence ledger corner. Fixed stale Chapter 1 end/title-card label on Chapter 2 direct start; browser AX after reload shows `CHAPTER 2 — THE RAVENS’ ROAD`.
**Proof:** `npm run typecheck`, `npm run build` (83 modules), and `git diff --check` pass; existing materials chunk warning remains (~641 kB). Initial captures show an open cutaway mine depression; route ground falls from −2.58 m at x=258 to roughly −9.3 m at x=278–339 and rises to −2.21 m by x=376. Earlier state-driven play reached the lower gallery, recorder gate, Hall and exit; this pass did not continuously walk the route.
**Limit:** Contact sheet screenshots are the before-fix captures. A post-fix visual recapture is still needed; Playwright's bundled browser is absent and installed Chrome stalled in headless launch. The trench currently reads as open to the sky; confirm that cutaway look. Whole episode remains incomplete.
# Handoff log (newest first)

## 2026-10-20 — Subzero: Ch1 evidence and Prologue recovery pass
**Done:** Added the optional Ch1 evidence ledger with Arabic-first bilingual labels. Press P while aiming at a farmer, farmer's wife, priest, police officer, or villager to show the neutral family-photo card; it counts four distinct internal role IDs. The camcorder log counts three distinct NPC+line testimony pairs. Both remain optional and do not gate the Omar/Maryam story. The amber focus brackets now show a visible bilingual FRAME LOCKED status after one simulated second of steady recording. Prologue objective now changes from finding the cow to following the cow/hoofprints. Added rolling safe snapshots while Joseph is grounded, fall/out-of-bounds recovery, and restored cow trail position at the matching saved point.
**Proof:** `npm run typecheck`, `npm run build` (83 modules), and `git diff --check` pass. Ch3 after priest/ladder/upload: `uploaded=true`, `uploadHold=20.00833333333284`; after `seekEnd(12)` and a rendered frame, `seized=true`, `endT=12.1`, ending title visible: `SIGNAL · CAMERA SEIZED · LORENZO DETAINED`. Browser state proved Prologue cow objective, progress 0.4118, and out-of-bounds recovery `respawns=1` to `(0,0,1.8)` with cow checkpoint 23. Four unique square-villager photo shows reached `photoCount=4`; card was visible in a rendered frame. A rendered browser probe recorded three distinct testimonies: `npc_square_villager_1:npc_square_villager_1_animals`, `npc_square_villager_2:npc_square_villager_2_animals`, and `npc_square_villager_3:npc_square_villager_3_animals`; each reached `film.held=1.4`, displayed `TESTIMONY — VILLAGER`, and raised the ledger to `3/3`. Replaying villager 1 left the log/count at 1. The lock status read `إطار ثابت · FRAME LOCKED`. Screenshot: `studio/reports/ch1-testimony-proof.png`. Ch2 sampler heights along x=258/278/300/339/376 at z≈40 were −2.58/−9.38/−9.33/−9.30/−2.21 m; player walked from portal to x=276.8,y=−9.11 in 6 game seconds, recorder E interaction advanced stage 3→4, lower gallery/Hall reached stage 5, and cave exit at x=374 advanced stage 6 with `complete=true` even with optional footage missed.
**Open:** The camera path was verified in a rendered browser; earlier short probes stopped below its one-second simulated lock threshold. Review the Ch2 trench/Hall visuals in-browser. The episode remains incomplete: further Ch2 depth/detail and other authored game scope remain open; proposed dialogue is still draft pending Noor.

## 2026-10-20 — Subzero: South Farmland connector and region render fix
**Done:** Added a walkable South Farmland cell connected to the existing valley road at (37.5, 118), without moving village coordinates. It has a terrain-sampled 4.2 m dirt trail, deterministic CC0 scatter (15 trees, 18 bushes, 18 rocks, 20 grass clumps), an open-gate livestock paddock with 7 idle models (3 cows, 2 sheep, 1 horse, 1 pig), and collision for trees/bushes/rocks/fence. Repeated foliage and the paddock fence use instancing; each loaded cow/sheep clone plays its idle clip through a light per-region mixer tick. The region is available in the regular village and later chapters; the prologue keeps its south boundary. Fixed East Valley's multi-material GLB loading so grouped tree/bush meshes no longer disappear while their colliders remain.
**Proof:** `npm run typecheck`, `npm run build` and `git diff --check` pass; Vite transformed 83 modules. The build retains the existing 641 kB materials chunk warning. South Farmland counts: 1 outdoor cell, 71 nature placements, 7 livestock models/idle mixers. State-based Chapter 3 check proves priest conversation advances stage 0→1, ladder climb reaches stage 5 at y=20 m, and holding E for 20 s sets `uploaded=true`. Camera seizure/end card was not verified visually.
**Open:** Root should visually inspect the road seam, paddock gate, and multi-material trees. Confirm Ch3 camera seizure/end card in the live browser. The whole episode remains incomplete; Ch1 evidence tracking and Prologue cow objective/last-safe-point recovery are still open.

## 2026-10-20 — Subzero: East Valley connector blockout
**Done:** Added a separate East Valley outdoor cell (x=125–225, z=−20–110) that lays a low-poly dirt trail toward the east from the village herd-path seam without moving village coordinates. Scatters Nidal's CC0 tree, bush, rock and grass GLBs with deterministic seeds; repeated models use instancing, the travel corridor stays clear, and larger props have collision. One `villageTerrainHeight` sampler now drives terrain visuals, player physics, trail placement, and prop colliders. After the Day 2 Omar watcher dialogue, the game fades into the Day 3 Chapter 2 state; Lorenzo spawns at the village and can cross the stream stepping stones to enter East Valley. Only Ch2 opens the seam wall and suppresses the Ch1 capture/end zones; Prologue and Ch1 gates remain intact. Removed the unapproved transformed-Ravens silhouettes from Joseph's Hall reveal. Asset sources/conversions are in `studio/art/free-assets-manifest.md` and `CREDITS.md`.
**Proof:** `npm run typecheck` and `npm run build` pass; build retains the existing 641 kB materials chunk warning. No visual playthrough in this turn.
**Open:** This adds a walkable outdoor connector, not the full Ch2: quarry details, mine gate/tunnels, warned root hazard, recorder, Hall footage, and cave-mouth exit remain unbuilt. Root should inspect visuals and Zurub review GLB fit/performance. Cow GLB integration is pending Zurub's loader/axis check.

## 2026-10-20 — Subzero: Day 2 objective follows Elia/Omar dialogue
**Done:** Day 2 objective now advances after Lorenzo hears Elia's photo line: it asks him to return to Omar. Hearing Omar's existing `omar_watcher` line clears the objective and marks the playable beat complete. No new dialogue was added; the approved event order and proposed-text labels remain unchanged.
**Proof:** `npm run typecheck` passes. No browser playthrough performed in this turn.
**Next:** Coordinate the connected valley expansion with the free-asset researcher before any map edits; preserve the village's existing coordinates/routes. Continue with authored story beats and verify the cave, stairs, and Day 2 run in a browser when available.
**Open:** Whole game remains incomplete. Hall/cave is still a visual reveal, later chapter content is not playable, and proposed Arabic dialogue awaits Noor's review.

## 2026-10-20 — Subzero: cow-led path and cave Hall reveal
**Done:** Joseph starts in the barn aisle with the objective «اتبع آثار الحوافر نحو الجبل». A visible low-poly cow follows the existing hoofprint spline toward the mountain and has a moving collision box. At the path boundary, roots rise for 1.8 seconds while Joseph still has control. The ending fades into an authored Hall: the herd faces the Well, hoofprints stop beneath them, Joseph reaches toward the bell cow, roots bind him, and three root-bound figures are visible in a side gallery as the Ravens' transformation cue. R continues as Lorenzo. For Ch1, Lorenzo can talk to Omar, then Moreno; Omar's line starts a guarded medical-check interval at the police post's new cot, and a separate cuff prop visibly disappears at completion. Only after that check and the Omar conversation can Moreno's briefing trigger Day 2. Day 2 places Elia on the built café balcony, reachable by new stairs, and keeps Omar uncuffed at the post. Omar stays there until café upstairs geometry exists; its floor is not guessed. No new dialogue or story names added.
**Proof:** `npm run typecheck`, `npm run build` and `git diff --check` pass after the NPC sequence update. Build warns the materials chunk is 641 kB. Playwright browser launch was unavailable because the local Chromium binary is not installed; CUA browser preview is unavailable in this subagent. Root can inspect the local preview; visual balance and playthrough remain unverified here.
**Open:** Runtime review of cow/Hall, Omar/Elia placement and stair navigation; implement playable Ravens tunnels and later cave exploration. Maryam route still needs a live visual review. Proposed Arabic lines still need Noor's approval before recording.

## 2026-10-20 — Subzero: playable prologue entry + Unreal room build
**Earlier state:** The first-run menu/prologue link and Unreal room build were completed before the cow and Hall reveal were added. Unreal proof remains as recorded below.

## 2026-10-20 — Cyrex: NPC continuity + story draft
**Done:** Added `studio/script/prologue-arrival-draft.md`, an Arabic-first working sequence from the farmer's prologue search through Lorenzo's arrival, Maryam's conditional search, and Omar/Elia's ordered beats. Implemented Maryam's 8-second wait, confirmation dialogue gate, yard-gate opening, moving collision/pick positions and one-way path to (43.5, 0, 43.0) in `src/npcData.ts`, `src/npcTalk.ts` and `src/villageMain.ts`. Her dialogue stays proposed; the farmer/wife `[ref]` speaker was not guessed.
**Proof:** `git diff --check` clean for the edited files. No automated tests or browser run in this turn.
**Next:** Inspect Maryam's route in the running scene and continue the playable Joseph prologue. Noor must approve final Arabic dialogue before recording.
**Open:** Visual review of Maryam's square target; Noor's text approval; playable Joseph prologue.

## 2026-10-19 — Rajaie, commits e64bbee..0b974de (pushed to origin/main, deployed to gh-pages)
**Done (queue 1-4, each green before the next):**
1. `e64bbee` village-tour e2e: the locked café rattle now says "Locked." in the use prompt at once. The old subtitle copy was dropped while the intro line was up (the SwiftShader sim runs at ~0.1x real time). `village-tour.spec.ts` 2/2.
2. `8131845` church ("no drawing"): the 5 pictures and 8 glass panes were inside the 0.45 m walls (the south 4 panes mirrored through the world origin, 2 pictures in the door gap), and the drawings were stretched to 16:9. Now one `churchLayout` (visuals + collision): pictures on the inner walls under the windows at true aspect, each with a picture lamp; stained glass in the 7 real windows; columns at the piers; pews face the altar; pews, columns and altar solid; warm light baked. Lanterns and street lamp lights sit on real fixtures. The sinafly carpet is rebuilt (weave texture, compiled in the warm-up): summon hitch 517 ms + 2 late programs -> 33 ms + 0. `church.spec` NCC 0.89-0.97 (mirror <= 0.85, upside down <= 0.49); `carpet.spec`. Stills: `studio/stills/church-*.png`, `lamps-*.png`, `carpet-flying.png`.
3. `4d28497` plank seams: per-board UVs. Boards crossing a texture gap 367/400 -> 0/400 (`tests/planks.test.ts`); `planks-before/after.png`.
4. `0b974de` GoldSrc: `src/entities.ts` (doors, a bell-rope button in the tower base, a pushable barn pail and stool), landing shake (trauma squared), town footsteps by surface, NPC placement prep (`src/npcPlacement.ts`, F3 markers).
**Proof:** `npm run check` exit 0 (110 tests); `npm run build` exit 0; e2e green: boot, warmup, village-tour, village-walkthrough, church (2), carpet, entities; 0 console errors. Iris Xe D3D11 (Playwright, `--use-angle=d3d11`, vsync, 4 views, n=2-3): p95 16.7-16.8 ms at every step; draw calls at spawn 30 -> 21, programs 22 -> 21.
**For Noor/Issa (not guessed):** the priest spec says "altar at the north end", but the altar is at the east end (x 21.4-22.4). officer_1 (-8, 44.6) overlaps the police car. Moreno, officer_2 and the farmer's wife stand inside blocks with no interior. Day 1: 9/13 NPCs placeable.
**Left uncommitted on purpose:** Tariq's lines in `CREDITS.md` and `studio/decisions.md`, his handoff entry and `unreal/`.
**Next:** build step 2: place the 9 ready NPCs, dialogue, Lorenzo's camera verb. SwiftShader e2e runs ~3x slower while UnrealEditor is open.

## 2026-10-19 — Tariq (UE5), barn trial + playable + village blockout
**Done:**
- The UE project is now the mirror `%USERPROFILE%\OVUnreal\unreal\OmegaValley`. The repo keeps the text side only; sync it with `unreal/scripts/sync_mirror.ps1`. `Content/` is gitignored.
- The barn is lit at dusk (sun 240°/4°, `valley-sky.jpg` sky with the painted mountain and cave at 45°, cold blue fog, 7 barn lanterns and 1 at the farmhouse) and uses Aktham's textures and normals.
- Stills are in `studio/stills/ue-*.png`; the dolly frames are `ue-dolly-*.jpg`.
- Playable first person (engine FP template): `unreal/scripts/play.ps1`. The opening dolly auto-plays first. The packaged Shipping build is 432 MB at `unreal/build/Windows/OmegaValley.exe`.
- Village blockout map from the new export (`village-town.json` + terrain `.glb`). Shrine, tower and terrain checks are all at 0 cm error.
- Report: `studio/reports/tariq-ue-trial.md`. Iris Xe at 1080p: Epic 10.2 fps, High 67 % 23.4 fps. That fails 60 fps.

**Open:**
1. 60 fps needs a discrete GPU run (`run_trial.ps1 -SkipExport -SkipBuild -SkipStills`).
2. The village town has no lanterns or materials per building yet, and no gable roofs on lean/pyramid roofs.
3. `wall-painted.png` is not used (it is the Night Shift wall).
4. The owner decides what to port.

## 2026-10-18 (evening) — Issa/Rajaie, commit 4605a95
**Done:** Commit 4605a95 (pushed to origin/main): village stone/barn PBR textures (`src/villageTextures.ts`, normals green-down), warm-up waits up to 4 s for textures before compileAsync (+ warmup e2e), NPC data layer `src/npcData.ts` (15 NPCs, 32 trigger lines: 30 proposed, 2 canon, 1 cuffed = Omar). Proof in `studio/reports/issa-npc-data.md`: `npm run check` exit 0, 78 tests at that time (87 now, after Zurub's `tests/zurub-engine.test.ts`).
**Agent reports since the commit (uncommitted):** Cyrex gate = FIX (`studio/reviews/slice-review.md`); Firas QA: walkthrough + warmup pass, `village-tour.spec.ts` FAILS at line 68 (locked café line stays on the Day-one subtitle) (`firas-qa-village.md`); Imad: Day 2 has no chapter slot, 7 undefined flags (`studio/reviews/imad-npc-order.md`); Noor: 17 proposed lines = keep 7, change 9, cut 1 (`studio/world/npc-line-review.md`); Aktham: all 7 albedos match, hay worst at dE 22, check-art.mjs skips JPEGs (`aktham-village-art-check.md`); Tariq: UE5 not installed (`tariq-ue5-status.md`); Khaled: ambience plan, ElevenLabs ledger file missing (`studio/audio/village-ambience-plan.md`); Razan: 12/12 agent files pass; Issa: `studio/npc/wiring-plan.md` (12 steps).
**Owner decisions (`studio/decisions.md`):** farmer on stage Ch1; unnamed roles keep fixed IDs; Omar starts in café, cuffed on first transport to post [6]; Elia appears Day 2; Maryam goes to square after Joseph is late; ALL agents active again; UE5 stays paused.
**Issa's files:** `studio/npc/*.md` (README + 10 role specs), `studio/agents/issa-codex.md`, `src/npcData.ts`, `tests/npcData.test.ts`, reports `issa-npc-{data,logic,prep}.md`.
**Open items (5):**
1. Plank UV seams: texture seams every 0.25 m vs boards 0.19-0.29 m, ~90% of boards show a false seam; needs per-board UVs or a grain-only map (`rajaie-village-textures.md`).
2. Floor heights unknown: 5 NPCs forced to y=0 (omar, elia, moreno, officer_2, farmers_wife); placeholders for Omar/Elia/Moreno until geometry is final.
3. Two `[ref]` lines in `characters.md`: which is farmer, which is wife. Not guessed; do not move them.
4. Proposed trigger lines need the owner to accept Noor's review (17 reviewed in the spec files; 30 counted in npcData.ts).
5. UE5 paused; `unreal/` trial resumes only if the owner says so.
**Next:** resolve 1-4, then build step 2 (NPC placement, dialogue, Lorenzo's camera verb). Fix the `village-tour.spec.ts` failure. Owner to decide the Day 2 chapter slot.

## 2026-10-18 (late) — Cyrex, handoff at 90% usage
**Done since last entry:** Aktham Blender art (valley-dusk key + 360° sky, 7 village textures, `studio/reports/aktham-blender.md`). Tariq UE5 trial prepared in `unreal/` (UE5 PAUSED by Cyrex decision, see `studio/decisions.md`). New agents: Khaled (sound/video; ElevenLabs capped at 6,000 credits, ledger `studio/audio/elevenlabs-ledger.md`), Tariq (UE5). Git repo initialized (branch main, 1+ commits); NOT pushed yet.
**In progress:** Rajaie full village blockout (`src/village*.ts`). At handoff 3 tests in `tests/village.test.ts` were failing (mid-edit; e.g. "stuck at (1.37,-8.80)"). Check `studio/reports/rajaie-village-full.md`; if missing, run `npm run check` and fix first.
**Next (in order):**
1. Make `npm run check` green; run `npx playwright test tests/e2e/village-walkthrough.spec.ts` 3×.
2. Wire Aktham's .jpg textures + `_normal`/`_rough` in `src/materials.ts` (see aktham-blender.md §6); use `valley-sky.jpg` as equirect backdrop.
3. GoldSrc-style gameplay plan (decisions.md): entity system, scripted sequences, physical feedback, Blender-baked lighting.
4. Build step 2: village NPCs + dialogue + Lorenzo's camera verb.
5. Push to GitHub: create repo `TheValley` (owner's account), `git remote add origin <url>; git push -u origin main`.
**Owner open questions:** Sal's father path into the mountain; when Sal arrives; light vs electricity vs roots.


## 2026-10-18 — Cyrex (Claude Code, owner's machine)
**Done**
- Engine: movement, combat, save and load, facility logic (M0–M2). The Night Shift test level still runs via `?level=nightshift`.
- Canon world written by Noor (`studio/world/`).
- Village barn slice (Lorenzo, Ch1 opening) polished: 60 fps (p95 16.7 ms on Iris Xe), 44/44 unit tests, e2e walkthrough 3/3 green, 0 console errors.
- Agents hired: Noor, Rajaie, Tariq, Subzero.

**Proof:** `npm run check` exit 0; `npm run build` exit 0; `npx playwright test tests/e2e/village-walkthrough.spec.ts` 3/3.

**In progress (may have finished; check `studio/reports/`)**
- Rajaie + Zurub: full village blockout, reported in `rajaie-village-full.md`.
- Aktham: Blender valley backdrop and village textures, reported in `aktham-blender.md`.
- Tariq: UE5 trial prep in `unreal/`. The owner must sign in to the Epic Launcher and install UE 5.x.

**Next**
1. Build step 2: village NPCs, dialogue and Lorenzo's camera verb (`studio/world/chapter-plan.md` §5).
2. Run the UE5 barn trial (2 weeks; success = 60 fps, a Lumen dusk shot, one cinematic).

**Open questions for the owner:** how Sal's father gets from kidnapped to inside the mountain; when Sal arrives; whether light or electricity pushes back the roots (`studio/world/world-bible.md` §7).
