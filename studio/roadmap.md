# Omega Valley — Roadmap

Each milestone passes only on proof: command output, exit codes and stills.

## M0 — Feel (movement prototype)
Done when:
- `npm run check` (typecheck + vitest) exits 0.
- A test room loads in the browser. Pointer-lock mouse look works. WASD, jump and crouch work with collision against walls and floors (no clipping through, verified by unit test).
- `window.__game.state()` returns the player's position, velocity and onGround status.
- Frame time is below 16.7 ms median in headless Chromium for 5 s.

## M1 — Fight
- Wrench + nail driver, hitscan and melee, ammo and reload, HUD.
- Drifter AI (idle → chase → lunge). Damage and death for player and enemy.
- Quick-save/load round trip test.

## M2 — Facility
- The "Night Shift" level blockout, breaker puzzle, doors, buttons, intercom lines.
- Shard enemy. Scripted rupture and catwalk collapse.

## M3 — Slice gate
- Full slice playable start to end. Firas runs the walkthrough e2e 3× green.
- Cyrex grep audit of the banned terms returns 0. Slice review: Go / Fix / Rethink.

## Pre-mortem (Cyrex)
1. **Movement feels floaty** → check: tune accel/friction against a written target (ground speed 6 m/s, stop in <0.15 s), and test it.
2. **Scope creep in the level** → check: blockout first, with no art until M2 passes.
3. **Perf collapse in browser** → check: frame-time test from M0, draw calls logged.

## Cut order (bottom goes first)
1. Shard enemy (the Drifter alone proves combat)
2. Catwalk collapse (the rupture alone proves scripted events)
3. Secondary fire
