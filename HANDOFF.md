# Omega Valley — Handoff Index

Read this first. Anyone (human or AI) can continue from here. When you stop, follow **§5 Hand back**.

## 1. What this is
A first-person story game set in the world of the owner's ROOTSAPIENS movie, built in TypeScript + Three.js and run in the browser. A UE5 trial is in progress.
- Story canon (the source of truth): `studio/world/story-canon-ar.md`
- World, characters, regions and chapter plan: `studio/world/`
- Art direction: `studio/art/`. Reports: `studio/reports/`. Decisions: `studio/decisions.md`, `studio/world/decisions-noor.md`

## 2. Run it
```
npm ci
npm run dev        # http://localhost:5173  (?level=nightshift = old engine test level)
npm run check      # typecheck + unit tests
npm run build
npx playwright test   # e2e (tests/e2e)
```
Needs Node LTS. Blender 5.2 is used for art (`scripts/blender/`). UE5 lives in `unreal/` (see `unreal/README.md`).

## 3. Status (update on every handoff)
See `studio/handoff-log.md`. The newest entry at the top is the current truth.

## 4. The team (AI agents — definitions in `agents/` inside the handoff zip, install to `~/.claude/agents/`)
| Agent | Role | Model |
|---|---|---|
| Cyrex | Lead/producer: gates, scope, final call | opus |
| Noor | Creative director, world builder | opus |
| Rajaie | Senior game programmer (rendering, feel, perf) | opus |
| Zurub | Engine/gameplay engineer, Rajaie's partner (data, tests, audio) | sonnet |
| Imad | Narrative and puzzles | sonnet |
| Aktham | Art: ChatGPT images + Blender 3D/textures | opus |
| Tariq | Unreal Engine 5 engineer | opus |
| Firas | QA and tests | haiku |
| Razan | HR (creates and updates agents) | haiku |
| Subzero | Night coordinator (works without owner approval, with hard limits) | sonnet |

Owner preferences: reply in **Arabic**, keep tokens low, "small part but perfect", proof by numbers (tests, fps, stills).

## 5. Hand back (do this every time you stop)
1. Add a new entry at the **top** of `studio/handoff-log.md`: date, who, what was done, proof (commands + exit codes), what's next, open questions.
2. Run `powershell -File scripts/make-handoff.ps1`. It writes `OmegaValley-handoff-<date>.zip` to the Desktop, including the agents and prompts.
3. If a GitHub repo is set (`git remote -v`): `git add -A; git commit -m "handoff: <summary>"; git push`.
