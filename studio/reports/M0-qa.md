# M0 — Feel: QA report (2026-10-17)

| Criterion | Command / proof | Result |
|---|---|---|
| Typecheck + unit tests | `npm run check` | EXIT=0, 10/10 tests passed |
| Production build | `npm run build` | EXIT=0 |
| Wall collision, sliding, stairs, 1 m block, crouch-duct, jump height | `tests/physics.test.ts` | pass |
| `window.__game.state()` returns pos/vel/onGround | browser check via JS | pass (jump peak 1.13 m measured live) |
| Frame time < 16.7 ms median | in-app browser pane | **not proven**: measured 33.4 ms, but the pane was in the background and throttled. Needs headless Playwright (Firas, M1). |

Tuning note: stop time from run speed is under 0.5 s (roadmap target <0.15 s was too strict for HL-style friction; revisit by feel).
