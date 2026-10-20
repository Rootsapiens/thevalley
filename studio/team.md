# Omega Valley — Current team execution

Snapshot: 2026-10-21, second story review wave. `/root` is coordinating story integration. Layla, Noor, Razan, Imad, Rajaie, Zurub, Firas, Khaled, Aktham, Issa and Nidal delivered bounded reports, source fixes or asset intake; their turns are complete. Refresh live state from actual processes, not this snapshot. The older visual worker snapshot below is historical. Named roles are assignments in Codex, not claims that every historical worker is live.

Current story coordination: [story work queue](reports/story-work-queue.md), [Layla's Episode One pass](reports/layla-episode-one-story-pass.md), [Noor's canon audit](reports/noor-story-canon-review.md), [Imad's causality pass](reports/imad-story-causality-followup.md), [Rajaie's implementation plan](reports/rajaie-story-implementation-plan.md), [Zurub's state review](reports/zurub-story-state-review.md), [Firas's acceptance map](reports/firas-episode-one-acceptance.md), [Khaled's sound map](reports/khaled-episode-one-sound-map.md), [Aktham's staging map](reports/aktham-episode-one-staging.md), [Issa's NPC audit](reports/issa-episode-one-npc-staging.md), and [Nidal's animal sources](reports/nidal-hall-animal-sources.md). Moreno's assignment presentation and the quarry clue remain unresolved. The owner authorized a GitHub update when reviewed work is ready.

## Earlier visual work snapshot — historical

The owner requests a modern cinematic open-world visual direction, with GTA6 as an aspiration. Three.js + TypeScript remains the shipping engine. UE5 is paused. Existing work, historical village identity and approved story chronology must be preserved. Current work excludes Team Studio, route/quarry changes, commits and publishing.

| Status at snapshot | Role | Live process | Current deliverable |
|---|---|---|---|
| Running | Cyrex / Subzero | `/root` | Coordinate bounded visual work, inspect delivered diffs, decide the next useful assignments and maintain the 15-minute coordination heartbeat. Both names describe one coordinator process. |
| Completed | Aktham | `/root/aktham_realism_assets` | Character base and UAL rig audit saved in `studio/reports/aktham-lorenzo-realism.md`; same 65 joint names, different bind poses, so direct clip reuse is unsafe. |
| Interrupted: usage limit | Nidal | `/root/nidal_character_sources` | Licensed clothing and character source research remains queued; no shortlist was delivered. |
| Interrupted: usage limit | Razan | `/root/razan_work_queue` | Drafted the current roster and work queue before interruption. Cyrex/Subzero corrected the live statuses here. |
| Completed; next task queued | Rajaie | Previous `/root/rajaie_trail_materials` | Trail PBR and checks delivered: geometry unchanged at 150 vertices/444 indices, 3.8 m width preserved, finite 2 m UVs; existing texture tests 5/5 plus typecheck/build/diff check passed. Next: bounded bind-pose-aware Lorenzo retarget prototype. |

There are four concurrency slots, including coordination, but account usage is currently preventing further worker runs. All other roles have useful queued work in [the visual work queue](reports/visual-work-queue.md); queued does not mean running. The `omega-valley-team-coordination` heartbeat is active for checks every 15 minutes, but future runs may also fail while usage is limited. This file is a dated snapshot, not live telemetry. At each refresh, replace statuses from actual worker reports and tools; do not carry Running forward without evidence.

Browser verification is currently blocked by the Work setting that disables browser use. Structural checks and reports can continue; rendered quality, animation appearance and frame rate remain unverified until permitted browser access is available. The previous browser results in the history apply only to their recorded changes.

## Historical record — preserved from before the current snapshot

Everything below is historical context, including wording such as “current,” “Active,” “Working,” model names and staffing restrictions. It does not describe present execution; use the snapshot and work queue above.

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
