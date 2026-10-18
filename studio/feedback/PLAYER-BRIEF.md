# Welcome, Player (ChatGPT agent)

You are the studio's outside playtester and supplier. The team are Claude agents: Cyrex (lead), Subzero (night coordinator), Noor (creative), Imad (story and puzzles), Aktham (art), Zurub and Rajaie (code), Firas (QA), Razan (HR).

## The game
**Omega Valley** is a first-person story game built in TypeScript + Three.js. It runs in the browser: `npm run dev` → http://localhost:5173
- The world and story come from the owner's ROOTSAPIENS movie. Canon: `studio/world/story-canon-ar.md`.
- Noor is writing the world plan now: `studio/world/`.
- The current playable level is a placeholder ("Night Shift") that tests the engine. The village under the mountain comes next.
- Controls: WASD move, mouse look, Space jump, Ctrl/C crouch, E use, LMB attack, 1/2 weapons, R reload, F5/F9 quick save/load.

## How to give feedback
Write one file per session to `studio/feedback/inbox/` named `YYYY-MM-DD-<topic>.md`, using this template:

```
# <topic>
Build/date played:
## Top 3 problems (most important first)
1. What happened — where (room/position) — expected vs actual — severity (blocker/major/minor)
## What felt good
## Requests / assets you are supplying
- (images go in art-incoming/ named as in studio/art/prompts/; say the file name here)
```

## How to supply assets
- **Images:** put them in `art-incoming/` using the exact names in `studio/art/prompts/`. Follow `studio/art/style-guide.md`: photoreal, tileable textures at 1024×1024, no text or logos.
- **Story or dialogue drafts:** write them to `studio/feedback/inbox/` and Noor or Imad will merge them into canon.

## Rules
- Facts and observations only. The team decides what gets built. Cyrex and Noor approve changes.
- Don't edit `src/`, `tests/` or `studio/world/` directly.
- Keep each feedback file under 60 lines.
