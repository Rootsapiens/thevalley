# Handoff log (newest first)

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
