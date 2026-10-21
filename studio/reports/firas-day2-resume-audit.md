# Day 2 campaign reload audit — Firas, 2026-10-21

Source review only; no browser playthrough or runtime edit.

## Findings

1. **Saved Elia photo beat is not restored into the live story.** `src/villageMain.ts` saves `campaignProgress.day2.eliaPhotosHeard` after `elia_photos`, but Day 2 initialization always sets the objective to speak with Elia. It never adds `elia_cover_introduced` to `story.flags` or `elia_photos` to `heard` from the saved bit. After reload, Omar's `omar_watcher` line remains gated by the missing flag (`src/npcData.ts`), so the player must repeat Elia's introductory lines to regain the Omar path.
2. **Saved Omar watcher beat does not resume the chapter transition.** The talk callback saves `omarWatcherHeard` and schedules `chapterTwoTransitionAt` in memory. A reload creates `chapterTwoTransitionAt = -1`; no Day 2 initialization requeues it. If both Day 2 bits were saved before navigation, the resumed page still shows the Elia objective and needs the conversations repeated before Chapter 2 starts.
3. **The campaign record itself preserves order.** `src/campaignProgress.ts` rejects `omarWatcherHeard` without `eliaPhotosHeard`, and Day 2 requires the earlier Moreno beat. The persistence defect is the missing reconstruction of in-memory `heard`, `story.flags`, objective, and pending transition in `src/villageMain.ts`, rather than an invalid record schema.

## Bounded repair suggestion

On campaign Day 2 entry, restore `elia_cover_introduced` and mark Elia's completed introductory lines heard when `eliaPhotosHeard` is true; show the Omar objective. If `omarWatcherHeard` is true, mark his watcher line heard and resume the Chapter 2 transition after a short delay, without replaying dialogue or exposing Moreno's off-screen assignment. Keep direct URL previews separate from earned campaign restoration. Verify the three reload points: before Elia, after Elia, and after Omar; a browser playthrough is still required when permitted.
