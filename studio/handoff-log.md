# Handoff log (newest first)

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
