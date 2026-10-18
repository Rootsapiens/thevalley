# M2 — Facility: QA report (2026-10-17)

| Criterion | Proof | Result |
|---|---|---|
| Typecheck + all tests | `npm run check` | EXIT=0, 32/32 |
| Level "Night Shift" built: locker → tunnel → control room → catwalk → spillway → exit | `src/nightshift.ts` | done |
| Crouch under fallen pipe (bug found: gap was 1.0 m = crouch height; fixed to 1.15 m) | nightshift.test | pass |
| 3 breakers → floodgate opens; door blocks until then | nightshift.test | pass |
| Gantry stairs climbable | nightshift.test | pass |
| Catwalk collapse drops player to the spillway | nightshift.test | pass |
| Exit stairs → chapter finish | nightshift.test | pass |
| All enemies and pickups spawn outside solids | nightshift.test | pass |
| Shard enemy + bolts, rupture event, intercom subtitles, fall damage, end screen | code in main.ts | built; not yet play-tested live |

Not verified: a live in-browser play-through (the pane renders no frames while the ChatGPT desktop window covers it).
