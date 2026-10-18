# M1 — Fight: QA report (2026-10-17)

| Criterion | Proof | Result |
|---|---|---|
| Typecheck + unit tests | `npm run check` | EXIT=0, 25/25 passed (10 movement, 15 combat/save) |
| Build | `npm run build` | EXIT=0, `dist` = 549,799 bytes |
| Wrench (melee, range 1.7 m, 25 dmg) | `tests/combat.test.ts` › wrench | pass |
| Nail driver (semi-auto, 12 dmg, mag 12, auto + manual reload) | combat tests | pass |
| Walls stop nails / LOS | combat tests | pass |
| Drifter idle → chase → windup → lunge → recover, 15 dmg once per lunge, dodgeable, no wall clipping | combat tests | pass |
| Player damage + death screen | live browser run: ledge Drifter hit player 100 → 70, killed by nails | pass |
| Quick save/load round trip | unit test (deep-equal) + live F5/F9 | pass |
| Unknown save version refused | unit test | pass |
| Banned-term audit (src, index.html) | `grep -rniE` over the brief §1 list | 0 matches |

Open items:
- Frame time in headless Playwright is still not measured (the in-app pane throttles). Firas to add `@playwright/test` e2e.
- Live aim test used 17 nails for 4 hits. Drifters move a lot during the lunge. Check the feel by hand; maybe widen the nail hit radius slightly.
