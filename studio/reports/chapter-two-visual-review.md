# Chapter 2 visual review — 2026-10-20

## Review scope
Six rendered browser views cover the mine portal, recorder depot, root crawlway, Bound Ravens' card room, Breakthrough Hall, and cave-mouth exit. Contact sheet: `ch2-contact-sheet.png`. The six source screenshots are the initial review captures, before the visual fixes described below.

## Findings and changes
- The mine path is an open cutaway trench. Side walls and the descending floor are visible; it reads as exposed to the sky. The route-ground samples descend from −2.58 m at x=258 to about −9.38 m at x=278, remain near −9.3 m through x=339, then climb to −2.21 m at x=376. Earlier state-based play reached the lower gallery from the portal and advanced through recorder, Hall, and cave-exit gates; the full route was not walked continuously in this visual pass.
- The depot screenshot faces into a wall and does not establish recorder readability. Added a warm local depot lamp and brighter recorder light. The recorder's placement and interaction gate were already state-verified.
- The root crawlway was too dark to read the hazard. Roots now have a restrained ember emissive and the crawlway has a small, shadow-free warm point light.
- The card-room and Hall captures have poor framing. The Hall capture shows the daylight shaft obscuring Joseph; narrowed and softened the shaft, increased Hall fill, and brightened Joseph's silhouette. Added a localized card-room light.
- The cave-mouth plane obscured the exit. Reduced its opacity and disabled depth writes; increased the mouth light.
- Chapter 2's menu/title card displayed a stale “CHAPTER 1 — ARRIVAL” label. It now displays “CHAPTER 2 — THE RAVENS’ ROAD”; verified in the local browser accessibility tree after reload.
- The Ch1 testimony toast overlapped the upper-right evidence ledger. It now appears below the objective in a compact, left-aligned dark plate, leaving the ledger clear.

## Verification
`npm run typecheck`, `npm run build` (83 modules), and `git diff --check` pass. The production build retains the known ~641 kB materials chunk warning. A post-fix visual recapture was not completed: the installed Playwright Chromium is absent and launching system Chrome headless stalled. The attached contact sheet therefore documents the defects before fixes, not a post-fix visual sign-off.

## Remaining
- Recapture the six views after the lighting/material changes and review at normal gameplay angles.
- Confirm visually that the animals and Joseph are distinct in the Hall and recorder is obvious at the depot.
- The trench is intentionally open-cut in this build; confirm that exposed cutaway presentation is acceptable for the game.
- Chapter 2 lower-gallery visuals and continuous walking route still need a full player-driven review.
