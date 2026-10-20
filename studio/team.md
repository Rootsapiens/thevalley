# Omega Valley — Team (updated 2026-10-20 by Cyrex)

## Game work resumed — 2026-10-20

The owner resumed Omega Valley development after the Team Studio entry fix. The table below records current execution; the older roster further down describes roles and historical reports, not live worker activity. Four concurrent workers are available, including the coordinator.

| Execution | Member / role | Assigned deliverable |
|---|---|---|
| Active | Cyrex / Subzero coordination | Check the current game build, preserve existing work, integrate finished deliverables and maintain the next-work queue. |
| Active | Issa | Implement event-driven Unreal NPC staging, preserving the approved Omar/Elia chronology; document what still needs an Unreal runtime check. |
| Active | Khaled | Improve procedural village/barn ambience without recording unapproved dialogue. |
| Active | Nidal | Resume free village/NPC/environment asset research with source and license records; coordinate integration before changing shared files. |
| Queued | Rajaie + Zurub | Review playable chapter progression and NPC interactions; fix reproducible blockers and integrate completed audio/assets. |
| Queued | Noor + Layla + Imad | Reconcile Episode One treatment with current runtime and approved canon; keep proposed Arabic dialogue labeled as draft. |
| Queued | Tariq | Review Issa's Unreal staging integration and village room work when the Unreal work slot is free. |
| Queued | Aktham | Check downloaded models, materials, scale and placement for the village. |
| Queued | Firas | Verify the prologue-to-chapter route, Maryam's walk, Omar's cuff removal and Day 2 prerequisites. |
| Queued | Razan | Refresh the roster from actual worker reports; do not label queued roles as running. |

Agent definitions live in `~/.claude/agents/<name>.md`. A copy goes into every handoff zip under `agents/`.

| Agent | Role | Model | Status now |
|---|---|---|---|
| Cyrex | Lead/producer: gates, scope, final decisions, token budget | opus | Active (main session) |
| Noor | Creative director, world builder (canon, regions, NPC placement decisions) | opus | Idle, answered NPC questions |
| Rajaie | Senior game programmer: rendering, feel, perf, GoldSrc-style systems (max effort) | opus | **Working:** NPCs + talk + Lorenzo's camera, then interiors with furniture |
| Zurub | Engine/gameplay engineer, Rajaie's partner (data, tests, audio) | sonnet | **Done:** East Valley asset/collision review; cow GLB integration; flagged multi-material vegetation issue, now fixed |
| Imad | Narrative and puzzles | sonnet | Idle |
| Layla | Screenwriter: scenes, dialogue, trailer script (AR first, EN second) | sonnet | Updated Episode One status coverage; Noor Arabic dialogue approval still pending |
| Aktham | Art: ChatGPT key art, Blender textures/backdrops, models | opus | Done: 55 CC0 furniture GLBs (`public/models/`) |
| Khaled | Sound engineer and video editor (ElevenLabs capped at 6,000 credits) | sonnet | Idle |
| Tariq | Unreal Engine 5 engineer | opus | Done: barn + village in UE 5.8 (23 fps best on Iris Xe), `C:\Users\nadee\OVUnreal` |
| Nidal | Free asset researcher: finds licensed game assets, downloads and prepares livestock/environment models | — | **Done:** 16 CC0 animal/nature GLBs, license manifest and credits; horse/pig integrated into South Farmland |
| Issa | Unreal engineer and coder (Blueprints/C++, NPC setup in UE) | — | Idle |
| Firas | QA and tests (Playwright, mutation checks) | haiku | Idle |
| Razan | HR: hires and upgrades agents, checks agent files | haiku | Active (this update) |
| Subzero | Night coordinator: keeps work moving, no owner approvals, writes handoff | sonnet | **Done:** Ch1 recording tested in browser; 3/3 unique testimony pairs, duplicate ignored, bilingual lock cue added. Ch2 trench/Hall visual review remains open |

## How we work
- The owner speaks Arabic. Replies are short (caveman mode). Keep tokens low.
- "Small part, made perfect": proof by numbers (tests, fps, stills) before anything is called done.
- Ownership: Rajaie owns `src/` + `tests/`. Aktham owns `public/art`, `public/models`, `scripts/blender`. Tariq owns `unreal/` + `OVUnreal`. Noor owns `studio/world/`. Layla owns `studio/script/`.
- Handoff: newest entry at the top of `studio/handoff-log.md`, then `scripts/make-handoff.ps1` → `The Valley.zip` on the Desktop.
- Live game: https://rootsapiens.github.io/thevalley/. Repo: https://github.com/Rootsapiens/thevalley. Latest full backup branch: `backup-20261019-0645`.

## Changes since the last update
- Hired: Layla (screenwriter), Khaled (sound/video), Tariq (UE5), Issa (UE), Noor (creative).
- Upgraded: Rajaie (max effort, collaboration rules), Aktham (opus, Blender pipeline).
