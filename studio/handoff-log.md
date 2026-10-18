# Handoff log (newest first)

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
