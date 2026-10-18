# Village QA run (Firas) - 2026-10-18

Base: HEAD 4605a95, branch main. Project root is `C:\Users\nadee\Desktop\OmegaValley` (there is no `game/` subdirectory in this repo, so commands run from the root). No tests or src files were changed. Nothing committed or pushed.

## Exit codes

| Command | Exit | Result |
|---|---|---|
| `npm run check` (typecheck + vitest) | 0 | tsc clean; vitest 8/8 files, 87/87 tests passed |
| `npx playwright test tests/e2e/village-walkthrough.spec.ts` | 0 | 1 passed (54.2 s) |
| `npx playwright test tests/e2e/village-tour.spec.ts` | 1 | 1 failed, 1 passed (1.6 min) |
| `npx playwright test tests/e2e/warmup.spec.ts` | 0 | 1 passed (51.0 s) |

Logs: `C:\Users\nadee\AppData\Local\Temp\claude\firas-check.log`, `firas-vw.log`, `firas-vt.log`, `firas-wu.log`.

## First error

village-tour.spec.ts, test "village tour: gates, a locked door, the back gate, the stepping stones, the herd trail to the end card" (line 53), fails at line 68:

- `expect(locator('#sub-en')).toHaveText("Locked.")` timed out after 15 s.
- Received: "Day one. I came looking for a missing man... and everyone here wants to tell me about missing cows." The subtitle never changed, across 18 polls.
- After `useIt(page, 'locked-cafe')`. The expected string is `LOCKED_LINE.en` from `src/village.ts:302`, so this is not a typo in the test.
- Likely cause (not verified): the locked-door interaction did not fire, or its subtitle was overwritten. Trace: `node_modules\.cache\e2e-results\village-tour-village-tour--8570b--herd-trail-to-the-end-card-chromium\trace.zip`.

The second test in that file, "valley road south: Lorenzo turns back at the edge of the village", passed.

## Skipped or not run

- None. No `skip`, `fixme` or `only` markers in the three specs. Every test in each spec ran (4 tests total: 1 + 2 + 1).
- Not run: the three-times-in-a-row repeat, mutation checks and perf numbers. This task asked for one run each.
