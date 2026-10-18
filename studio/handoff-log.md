# Handoff log (newest first)

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
