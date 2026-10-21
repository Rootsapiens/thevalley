# Firas — Chapter 2 chalk-arrow source audit (2026-10-21)

**Follow-up after this audit:** `setChapterTwoStage` now requires the existing `chalk` examination before advancing mine objectives. This keeps the arrow objective visible if Lorenzo walks toward the mine first and prevents the stage-5 Hall/exit route from completing without the clue. The physical road still awaits the separate southbound route change. This follow-up has only source/typecheck/build evidence, not browser proof.

Scope: source review only. No browser playthrough, render check, or runtime test.

## Findings

1. **The arrow exists in Chapter 2 and has a normal pick target.** `buildVillage(scene, renderer, CHAPTER_TWO_MODE)` always builds the barn (`src/villageMain.ts:77`, `src/villageScene.ts:1402`). Its tagged chalk plane is on the north door (`src/villageScene.ts:631-639`), the canvas texture draws the south-pointing arrow (`src/villageScene.ts:1162-1185`), and `EXAMINABLES` includes `chalk` at that door (`src/village.ts:480-488`). Village highlights are built for it (`src/villageScene.ts:1586-1587`). The look ray picks examinables within 3 m, subject to solid occlusion (`src/villageMain.ts:393-399`, `src/village.ts:584,602-622`). Thus it is wired for display and interaction; actual visibility and ease of aiming remain unverified without rendering.

2. **The clue objective is bypassable.** Chapter 2 starts with the arrow objective (`src/villageMain.ts:324-326`), but entering the mine by position advances stages 1–3 with no `chalk` check (`src/villageMain.ts:725-729`). Examining the recorder jumps to stage 4 and later stage 5 (`src/villageMain.ts:547-550,730`). Filming the Hall at stage 5 enables stage 6 and exit completion (`src/villageMain.ts:1165-1173,750-757`). None of those paths checks `vs.examined.includes('chalk')`. The stage 1 objective overwrites the clue objective if Lorenzo walks east first. The route is still opened by `eastValleyOpen: CHAPTER_TWO_MODE` (`src/villageMain.ts:85`); connector changes belong to the route owner.

3. **Examining the arrow does not directly disturb film or stage state.** It marks the ordinary evidence ledger and changes only objective text while `chapterTwoStage === 0` (`src/villageMain.ts:540-546`). Hall filming still depends on stage 5, recorder, framing, and battery (`src/villageMain.ts:547-550,1165-1173`). However, because the clue has no persistent chapter-specific flag and stage entry is independent, a late arrow inspection at stage 1+ cannot restore the clue objective or affect progression. Restart resets `vs` and stage (`src/villageMain.ts:870,877`).

## Minimal recommended fix

- In `villageMain.ts`, derive or track `chapterTwoClueSeen` from the existing `chalk` examination. Gate stage 1 progression on it, and guard the recorder's direct stage-4 promotion plus Chapter 2 completion against bypass. Keep the arrow interaction itself as the only clue and preserve the existing Hall footage requirement.
- Keep the clue objective visible until the arrow is examined. Once seen, show the approved Ravens-to-quarry objective; do not change route geometry or invent a new clue here. The route owner must coordinate the physical southbound connector before the directional objective is published.
- Verify in a real browser that the arrow can be seen and picked from the barn approach, that the mine cannot silently advance first, and that filming/exit still works after the clue. Source review alone does not establish those outcomes.
