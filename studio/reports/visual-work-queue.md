# Omega Valley — Visual work queue

Snapshot: 2026-10-21 01:15 CEST (Europe/Paris).
Evidence: fresh `collaboration.list_agents` returned `/root` as the only running process. Rajaie and Aktham completed their reports; Nidal and Razan stopped on the account usage limit. Older roster reports are historical evidence only.

## Scope and decision owners

Cyrex and Subzero are the decision roles of the single coordinator process. They choose work, resolve conflicts and review delivery. Razan tracks evidence and queues. The owner approved continued game development and requests a modern cinematic open-world look, using GTA6 as an aspiration; this is not a fidelity or performance claim.

Use Three.js + TypeScript. Preserve existing uncommitted changes, film references, historical village identity and approved story canon. UE5 remains paused. Do not work on Team Studio, route/quarry direction or geometry, commit, push or publish in this pass. Draft Arabic dialogue stays draft pending Noor's review. Do not guess character references, building elevations or narrative clues.

## Current work

| ID | Role / process | Status at snapshot | Deliverable and completion evidence |
|---|---|---|---|
| V-C01 | Cyrex / Subzero — `/root` | Running | Review worker diffs and fresh reports, own scope decisions and dispatch the next useful work. Record what is verified and what is blocked. |
| V-R01 | Rajaie — previous `/root/rajaie_trail_materials` | Completed | Trail PBR delivered; 150 vertices/444 indices match HEAD on flat/sloped terrain, 3.8 m width preserved, finite 2 m UVs; existing texture tests 5/5, typecheck/build/diff check passed. Fresh coordinator report at 01:13 CEST. Rendered appearance remains open. |
| V-A01 | Aktham — `/root/aktham_realism_assets` | Completed | Compatibility report in `studio/reports/aktham-lorenzo-realism.md`: same 65 joints and hierarchy, different rest/bind transforms; direct clip sharing would overwrite proportions. UAL1 neutral clip compatibility remains open. |
| V-Q03 | Nidal — `/root/nidal_character_sources` | Interrupted: usage limit; coordinator completed research handoff | `studio/reports/nidal-realistic-character-options.md` records three verified free character/garment sources and a bounded prototype path. Nidal did not download or integrate an asset. |
| V-Z01 | Razan — `/root/razan_work_queue` | Interrupted: usage limit | Drafted `studio/team.md` and this queue; the coordinator corrected stale Running rows after the interruption. |

## Pending assignments for every other role

These are planned assignments, not dispatched or active workers. Only the coordinator can change them to Running after starting an actual worker.

| ID | Role | Status | Useful deliverable | Dependencies and boundaries |
|---|---|---|---|---|
| V-Q01 | Zurub | Queued | Read-only review of trail material loading, texture reuse/disposal, draw-call implications and fallback behavior; list concrete regressions or confirm no findings. | Wait for V-R01 report. Inspect existing diff, do not repeat its build without a reason. |
| V-Q02 | Firas | Queued | Review the changed visual code against terrain/door/NPC collision invariants and record a bounded rendered acceptance checklist for desktop/mobile. Run the rendered check only when browser use becomes available. | V-R01; current browser block. Do not call a checklist a passed test. |
| V-Q04 | Issa | Queued | Audit existing web NPC clone, animation, scale and foot-placement paths against V-A01; propose a specific bounded fix with file/line evidence. | V-A01 and existing NPC data. Read-only first; web scope while UE5 is paused. Do not invent floor heights. |
| V-Q05 | Tariq | Queued | Review the existing Three.js lighting, exposure, shadow and quality-tier configuration; propose one measurable low-cost cinematic improvement suitable for the owner's hardware. | Coordinate with V-R01/V-Q01 so the same renderer changes are not reviewed twice. UE5 work stays paused. |
| V-Q06 | Noor | Queued | Review proposed realistic NPC appearance and environment changes against existing character references and historical village canon; record allowed changes and unresolved references. | V-A01 or V-Q03 findings. Do not assign unknown farmer/wife references or modify quarry canon. |
| V-Q07 | Layla | Queued | Compare existing Episode One scenes and dialogue presentation with current implementation; list visual storytelling and staging gaps using existing lines and scenes. | Existing script/reviews plus Noor's constraints. Keep Arabic drafts marked proposed; no new canon. |
| V-Q08 | Imad | Queued | Audit event-gated visibility and presentation of Omar/Elia/Maryam from existing data and latest test evidence; identify gaps with concrete file references. | Existing story state and reports. Exclude Chapter 2 route/quarry scope; no invented clues. |
| V-Q09 | Khaled | Queued | Audit existing village/barn ambient sound triggers, levels and scene transitions to identify one low-cost cinematic sound improvement. | Read current sound code and inventory. No paid credits or recording unapproved dialogue. |
| V-Q10 | Rajaie, with Zurub review | Queued | Create a bounded bind-pose-aware Lorenzo retarget prototype from existing compatible licensed assets; document pose conversion and animation limitations. Zurub reviews after V-Q01. | Wait for final V-A01 report and a free slot. Preserve shipping model until permitted rendered preview. Distinct prototype file ownership assigned at dispatch; no direct sharing of incompatible clips. |

## Rotation and refresh policy

1. Every 15 minutes, the existing `omega-valley-team-coordination` heartbeat inspects actual process state, reports and file changes. The coordinator recorded this automation as created; do not create a duplicate. Refresh evidence timestamps and statuses only from current observations.
2. Keep at most four concurrent processes including the coordinator. Fill available slots with the highest-priority useful ready task. After current reports finish, prioritize V-Q10 and V-Q01 with distinct ownership; V-Q02/V-Q04 provide review and acceptance work. Adjust priority when evidence identifies a blocker.
3. A completion report is not a new active task. Review its exact diff/findings, then either assign the next bounded task to that available worker or record it as finished and dispatch a queued role. Named roles can rotate through slots; the roster does not imply fourteen simultaneous processes.
4. Give every dispatch a task ID, exact file ownership, dependency, completion condition and explicit scope. Sequence writers on shared files. Use read-only reports when another worker owns the code. Do not duplicate research, builds or tests already supported by fresh applicable evidence.
5. Record Running only after a live process starts; record Waiting when a dependency prevents progress; record Done only with reviewed evidence; record Blocked with the exact external restriction. Keep the dispatch time, completion/report time and evidence path with each status change.
6. When a task finishes, choose the next useful pending task. Do not fabricate activity or generate busywork to occupy a role. If no safe useful task is ready, document the dependency and report only a meaningful change or required user action.
7. Keep browser refresh publishing and Team Studio disabled. This heartbeat coordinates game development; it does not publish status JSON or touch gh-pages. Do not commit or publish without the owner's explicit request.

## Verification limits and next checkpoint

Browser use is currently disabled by the Work setting. No browser automation workaround should be used to bypass that restriction. Current visual composition, NPC appearance and performance remain unverified in a rendered view. Historical route tests remain evidence for their recorded revisions only.

The next checkpoint is the V-Q10 clothed/retargeted prototype and a rendered visual check. V-A01 and the V-Q03 research handoff are complete, and the coordinator reviewed V-R01. Account usage is currently blocking new workers, so do not mark queued work as running until an actual process starts. The whole game remains incomplete.
