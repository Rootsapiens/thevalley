# Multiplayer mode (same link, new mode) — spec v0, 2026-10-19

Owner: "same OmegaValley link, but add multiplayer", Counter-Strike-style rounds. Style = game genre only. No Valve names, assets, sounds or likenesses (brief §1).

## Where
- Same site: https://rootsapiens.github.io/thevalley/ . Mode flag `?mode=multiplayer`, plus a "Multiplayer" button on the start screen. Default stays the Ch1 village.
- Same repo: `Rootsapiens/thevalley`. No new repo.

## Why not a server
GitHub Pages is static, so no game server. Use serverless WebRTC DataChannel, host-authoritative:
- One player hosts, up to 7 join (8 total). Join by room code: host's offer and joiner's answer are copied and pasted (no third-party signaling service, no data leaves the players).
- Host runs the simulation at a fixed step (reuse `src/physics.ts`, deterministic), sends snapshots 20-30 Hz. Clients send inputs, predict their own movement, interpolate others.
- Limits to say out loud: NAT can block some pairs (no TURN server), so some players cannot connect. A real server would remove this; out of scope.

## Rules (CS-style round mode)
- Teams: **Ravens** vs **Village** (own names, not Valve's).
- Round 2:00, freeze time 5 s, first team to 8 round wins. Eliminated players spectate until round end.
- Economy-lite: fixed loadouts per round (pistol start; rifle, SMG, shotgun unlocked by round win streak). No buy menu in v1.
- Objective v1: elimination, plus "ring the church bell" (existing bell-rope entity) as a village objective for the Village team. v2: plant/defuse style.
- Empty slots filled by bots (the root-bot AI from the arena work), tiers Easy/Medium/Hard.
- Weapons: our own designs from Rajaie's arena work (hitscan, spread, recoil, ammo, reload). Models: CC0 Quaternius pack in `unreal/assets/guns/` converted to GLB for the web build, credited in CREDITS.md.
- Map: the village square and surroundings (walled playable area), spawns for both teams.

## Build order (each step: tests, `npm run check` exit 0, `npm run build` exit 0)
1. Arena weapons + bots land first (Rajaie, in progress). Multiplayer builds on them.
2. `src/net/protocol.ts`: pure message types + (de)serialisation + tests (round trip, version check, bad packet rejected).
3. `src/net/room.ts`: pure round state machine (freeze, live, end, score) + tests.
4. `src/net/webrtc.ts`: copy/paste signaling, DataChannel, host/client roles. Loopback transport for tests.
5. Wire into `src/villageMain.ts` behind `?mode=multiplayer`; remote player figures reuse `src/npcFigures.ts`.
6. e2e: two Playwright pages connect through a loopback or in-page signaling, one kills the other, round ends, scores update; zero console errors.
7. Measure p95 frame time with 8 players and bots on the owner's machine (Iris Xe).
8. Update HANDOFF.md, GAME-INDEX.md, then push to `main` (owner confirms the push).

## Not decided (owner)
- Is a copy/paste room code OK, or do you accept a free third-party signaling relay (easier to use, but a third party sees connection setup)?
- Max players: 8 total OK?
- Keep Lorenzo's story separate from multiplayer? (this spec assumes yes)
