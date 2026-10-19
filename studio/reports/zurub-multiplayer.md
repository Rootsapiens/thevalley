# Multiplayer v0 (Zurub, 2026-10-19)
- Works: `mp.html` (also `?net=local` for two tabs). Host makes a 5-char room code (PeerJS id `omegavalley-CODE`), joiners type it. 6 seats, 3 v 3, bots fill empty seats and take over when a player leaves.
- Rules: Ravens vs Village, freeze 5 s, round 2:00 (timeout goes to Village), first to 8, dead players spectate. Pistol hitscan (34 dmg, head x2.5), host-authoritative at 60 Hz sim and 20 Hz snapshots, client predicts its own body.
- Code: `src/net/{protocol,room,transport}.ts`, `src/mp/{sim,session,main}.ts`, `mp.html`, `vite.config.ts` (two entries; `--base=./` still works).
- Proof: `npm run check` exit 0 (180 tests, 36 new); `vite build --base=./` exit 0; e2e `mp-duel` (two tabs, kill, score 1:0, 0 console errors) and `mp-peer` (real PeerJS relay, reached from this machine) pass.
- How to play: open `/mp.html`, Host game, send the code; Join with the code; Solo vs bots needs no network. Click the canvas to capture the mouse.
- Known limits: no TURN server, so some NAT pairs cannot connect; the public relay sees connection setup only; the host leaving ends the match; map is a placeholder box arena, not the real village; pistol only; no bot tiers; start-screen button in `index.html` is not added (Rajaie's file).
- Not done: p95 frame time with 6 players (step 7), HANDOFF/GAME-INDEX updates, push.
