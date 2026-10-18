# Chapter 1 "Night Shift" - Slice Design

Sources: src/nightshift.ts, src/facility.ts, src/main.ts (events, fall damage), src/physics.ts (tuning), studio/game-brief.md.
Tuning facts used: stand 1.8 m, crouch 1.0 m, step 0.45 m, jump apex about 1.16 m (6.8 m/s, g 20), use range 1.8 m (must face target, dot >= 0.5), fall damage above 12 m/s landing speed, RUPTURE_AT = 7 s.

## 1. Walkthrough (player actions)

1. Spawn in the locker room (0, 5), facing -Z. At 0.6 s the intercom says the test begins in ten seconds.
2. Walk north through the doorway (z = 0) into the maintenance tunnel. Trigger `t-tunnel` fires `enter-tunnel`. No line is defined for it.
3. At 7 s (wherever the player is) the rupture fires. Screen shake and a rumble. The intercom orders an evacuation via the spillway. A teal light comes on far down the canyon. One Drifter spawns at (0, 1.3, -20).
4. Walk past the crates at z = -6 and z = -21 (both hug the east wall, so they are not obstacles).
5. At z = -12 a fallen pipe blocks the full tunnel width with a 1.15 m gap. Crouch (Ctrl or C) and pass under. Jumping cannot clear it.
6. At z = -26 pick up the nail driver. Before this the player has only the wrench.
7. Fight or avoid the tunnel Drifter. Killing it is not required.
8. Cross the doorway at z = -30. `t-control` fires `enter-control`. The intercom says to restore power at three breakers.
9. Take ammo-1 at (-8, -31.5).
10. Breaker A: west wall near z = -34. Press E at it, 1.8 m or closer and facing it. HUD shows "BREAKER ON 1/3".
11. Breaker B: west wall near z = -46. Two Drifters are in the room (-6, -46) and (2, -47). Press E. 2/3.
12. Take health-1 at (-2, 1.15, -40). It floats above the desk, so jump onto the desk.
13. Breaker C: east wall gantry, (9.8, 3.8, -46.5). Climb the 6 stairs at x = 8, z about -34 to -38 (0.4 m rises), then walk north along the gantry. Ammo-2 is on the way. A Shard at (7, 3.2, -47.3) covers the breaker. Press E. 3/3.
14. `door-open` fires. The floodgate slides up and the intercom says the gate is opening.
15. Walk through the gate at z = -50 onto the door platform, then onto the catwalk (z = -56 to -60).
16. Step on the middle catwalk (z = -60 to -70). `t-catwalk` (z = -63 to -61) fires `collapse`. The catwalk-mid solid is removed and the player drops 6 m. Landing is about 15.5 m/s, so about 14 damage.
17. `t-spillway` fires `land-spillway`. The intercom says the exit is at the far end, up the stairs.
18. Cross the canyon. Two Drifters (5, -74) and (-4, -86) and a Shard (-8, -84) are here. Pickups: ammo-3 (7, -66), health-2 (-7, -88). The rust blocks at (-5, -70) and (5, -82) are cover.
19. Climb the 15 exit stairs (z = -80 to -90), then the exit platform. `t-exit` (z = -94) fires `finish`. The end card shows time and kills.

## 2. Lock / key table

| Lock | Key / trigger | Where | Opens |
|---|---|---|---|
| Fallen pipe (1.15 m gap) | Crouch | Tunnel z = -12 | Route to the nail driver and the control room |
| Breaker A | E, in range and facing | Control room west wall, z = -34 | breakers[0] |
| Breaker B | E, in range and facing | Control room west wall, z = -46 | breakers[1] |
| Breaker C | Stairs, then E | Gantry east wall, z = -46.5 | breakers[2] |
| Floodgate solid | All 3 breakers on | z = -50.25 | Door platform and catwalk |
| Catwalk-mid | Walk into `t-catwalk` | z = -62 | One-way drop into the spillway |
| Desk (health-1) | Jump (apex 1.16 m > 1.0 m desk) | Control room | Optional pickup |
| Exit stairs | Step height 0.4 (< 0.45) | Spillway z = -80 to -90 | Exit platform |
| `finish` | Enter `t-exit` | z = -94 | End of chapter |
| Rupture | Timer, 7 s | Global | Spawns the tunnel Drifter and the teal light |

Every trigger is one-shot, tracked in `facility.fired`.

## 3. Red-herring audit

| Item / prop / line | Suggests | Reality | Verdict |
|---|---|---|---|
| Exit door mesh (0, 0, -95.9) | A door to open | Decor. `t-exit` fires before reaching it | Keep. Reached only at the end |
| Far catwalk (z = -70 to -80) | A second route over the canyon | Unreachable after the drop and it does nothing | Fix. Cut it, or make it a visible wreck |
| Ceiling pipes in the tunnel | Climbable or breakable | Decor inside the wall line | Keep |
| Hazard-yellow crates in the tunnel | Pushable or lootable | Static solids, no pickup | Fix. Put ammo on or near one, or cut them |
| Control desk | A terminal to use | Static. It only carries health-1 | Keep. Consider a screen showing the breaker count |
| Crate covers at (3.5, -44) and (-6, -36) | Cover | Valid cover vs Drifters and the Shard | Keep |
| Lockers and bench in the locker room | Searchable | Static, no use | Fix. Add one readable or pickup, or accept |
| Rust blocks in the spillway | Cover or a climb route | Cover only, 1.4 m is above jump height | Keep |
| Teal rupture light at z = -70 | Points at the way out | Right direction, and a decent beacon | Keep |
| `enter-tunnel` event | A scripted beat | No LINES entry, no handler | Fix. Add a line or drop the trigger |
| Alarm lights (tunnel, control room) | Danger | Mood only. Off until the rupture | Keep |
| `breaker-on` HUD text | Progress | Accurate. It shows N/3 | Keep |

## 4. Softlock and blocker risks

1. Crouch is never taught in game. The pipe at z = -12 is a hard gate and the only hint is the brief's controls list. Severity: blocker for new players. Fix: add a sign, an intercom line, or a lowered pipe visible from the tunnel entry. `enter-tunnel` is the natural carrier.
2. The pipe gap (1.15 m) is only 0.15 m above the crouch height (1.0 m). A crouched player under a Drifter's lunge push could get stuck. Raise the pipe or lower it with a clear gap.
3. The nail driver is behind the crouch gate. A player who stands up under the pipe is blocked but not stuck. Standing is refused while `blocked()` is true, which is fine.
4. The rupture is timer-based at 7 s, not position-based. A player who idles in the locker room gets the Drifter spawned ahead in the tunnel. It is not a softlock, but the surprise is blunted. Consider tying it to `t-tunnel`.
5. health-1 floats at y = 1.15 above the desk (top 1.0). A grab radius under about 0.2 m may require a jump onto the desk. It is optional and not a blocker, but it needs a manual check.
6. Breaker C is guarded by a Shard 2 m away on a narrow gantry. The player has no cover on the stairs. It is difficult but passable, and enemy kills are not required. Check ammo: wrench-only players can melee it.
7. The collapse is one-way and the canyon walls are 6 m high with no return. This is intended. Nothing the player needs is left behind except unclaimed pickups. Fall damage is about 14, so it is not lethal.
8. The player can jump off the platform edge to skip the catwalk. `land-spillway` still fires, so this is harmless.
9. Quick-load restores `facility` and `storyTime` (save.ts). Confirm `fired` and `doorOpen` are re-applied through `rebuildWorld()`. If not, a load after the floodgate or collapse could leave stale solids. I did not run this.
10. No other hard blockers found. All three breakers, the floodgate, and the exit stairs are reachable in order.
