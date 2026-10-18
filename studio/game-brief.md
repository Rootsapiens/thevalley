# Omega Valley — Game Brief

Decided by Cyrex, 2026-10-17.

## 1. Pitch and originality
A first-person shooter in the spirit of 1998-era story FPS games: one unbroken first-person story with no cutscenes, scripted events happening around the player, combat mixed with physics and environment puzzles, and a research facility that goes wrong.

Setting: **Omega Valley**, a remote dam-and-reactor complex in a desert canyon. A test of a gravity-well generator ruptures. Pieces of the valley start falling *upward*, and creatures from the rupture move in.

Player: **Dara Haddad**, a night-shift maintenance engineer. She is not a soldier. She starts with a pipe wrench.

**Originality rule (hard):** nothing from Half-Life or any Valve game. Banned in code, assets, text and credits: Half-Life, Black Mesa, Gordon, Freeman, Xen, HEV, Combine, headcrab, crowbar, G-Man, Lambda, Barney, Vortigaunt, resonance cascade, Valve. We copy the *feel* (pacing, scripted moments, a light HUD, quick saves), never the content.

## 2. Pillars
1. **Never leave first person.** All story happens in the world, while the player still has control.
2. **The facility is a character.** Signs, intercoms, machines. Players solve problems using the facility itself.
3. **Fast, readable combat.** Few enemy types, each with one clear behaviour.

## 3. Engine and stack (decided)
- TypeScript (strict) + **Three.js**, built with Vite. Runs in a browser, nothing to install.
- Physics: our own capsule-vs-AABB collision for M0–M1. Add `cannon-es` only if the puzzles need it.
- Audio: synthesized with Web Audio (same approach as The Seventh Bell).
- Tests: Vitest for the logic, Playwright 1.56.1 for e2e through a `window.__game` hook.
- Art: low-poly, flat-shaded geometry first. Textures come from ChatGPT images later (Aktham's route).

## 4. Controls
WASD to move, mouse to look (pointer lock), Space to jump, Ctrl to crouch, Shift to walk, E to use, LMB primary fire, RMB secondary fire, R to reload, 1–3 to switch weapons, F5 to quick-save, F9 to quick-load.

## 5. First slice scope ("Night Shift", ~10 min)
- 1 level: maintenance tunnels → control room → spillway.
- Weapons: pipe wrench (melee) and nail driver (semi-auto).
- Enemies: **Drifter** (slow floater that lunges) and **Shard** (a ranged turret-like crystal).
- 1 environment puzzle: re-route power with breakers to open the floodgate.
- 2 scripted events: the rupture as the opening, and a catwalk collapse.
- HUD: health, suit charge, and ammo only.
