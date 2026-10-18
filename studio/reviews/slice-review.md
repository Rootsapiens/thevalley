# Village slice gate review (Cyrex, 2026-10-18, HEAD 4605a95 + working tree)
**Decision: FIX.** The build is healthy, but the gate is not proven: no QA report from Firas, a guardrail grep that is not 0, and done-criteria that describe a different slice.
## Done-criteria (roadmap.md M3, verbatim) -> proof -> result
- "Full slice playable start to end. Firas runs the walkthrough e2e 3x green." -> `studio/reports/M3-qa.md`: MISSING. **FAIL.** (zurub-village-e2e.md 3/3 ran at 07:43, before the textures; rajaie-village-textures.md L10 ran 2x after them, not by Firas.)
- "Cyrex grep audit of the banned terms returns 0." -> `grep -rniE "broken sword|templar|clown|goat|manuscript|tripod|paris caf" src public CREDITS.md studio` -> 2 matches: `studio/world/world-bible.md:33` and `studio/world/regions/mountain-caves.md:33` ("goats", livestock). **FAIL as written.**
- Credits: 16 images in public/art = 16 lines in CREDITS.md, one per file. **PASS.**
- Context only, not gate proof: `npm run check` on the dirty tree -> EXIT=0, 87/87 tests.
## Blockers
1. Firas: write `studio/reports/M3-qa.md` from a clean `npm ci` (untracked `tests/zurub-engine.test.ts` included or removed), with the exit code of `npm run check` and village-walkthrough 3x on the textured build.
2. Guardrail: the owner rules "goats" a false positive (narrow the term to `\bgoat\b`) or Noor rewords it. Also, brief §1 lists Valve terms, not this list. Fix the brief so the audit list has one source.
3. game-brief.md, roadmap.md and style-guide.md still describe Night Shift (Dara, desert dam, teal). The village has no done-criteria and no style guide, and docs/workflow.md does not exist. studio/stills/ dates from 07:38, before the textures; still-fix.png is only in a scratchpad.
4. tests/e2e/slice-walkthrough.spec.ts is still red (decisions.md L5). Delete it or retarget it.
5. NPCs are data only. imad-npc-order.md lists 5 order contradictions (Day 2 has no chapter; no flags exist).
## Open owner decisions
- Plank UV seams: per-board UVs or a grain-only map. About 90% of boards show a false seam (rajaie-village-textures.md L5).
- Floor heights for the cafe upstairs room and the school (npc/README.md L11, L36). Zero is test-only.
- Which `[ref]` line in characters.md is the farmer's and which is his wife's (README L35).
- Proposed dialogue: Noor approves the AR text before any voice work (README L12, L37). Also Maryam's square flag (L38) and the Day 2 slot (Imad items 2-4).
## Pre-mortem, next gate
1. The SwiftShader walkthrough is flaky under load (1.1-2.2 min) -> Firas pastes all 3 run times and exit codes.
2. A clean checkout differs from the dirty tree -> run `git status --short` before `npm ci` and paste it.
3. NPC code breaks the Omar/Elia order -> a unit test counts set/read sites for each flag in Imad's list.
## Cut ranking (cut from the bottom)
1. Examinables and hoofprint trail: prove the investigate loop. 2. Lorenzo's camera verb: proves the player verb. 3. NPC dialogue: proves the story happens in the world. 4. Plank seam fix and normal maps: look only. 5. Equirect sky backdrop: mood only.
