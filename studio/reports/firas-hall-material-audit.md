# Firas — Hall cow/sheep material source audit

Source review only, 2026-10-21. The uncommitted `src/chapterTwo.ts` change has not been checked in a rendered scene.

## Findings

- **No blocking issue in the scoped alpha repair.** Both bundled GLBs use `alphaMode: MASK` and every material has `baseColorFactor` alpha `0` (three cow materials, two sheep materials). The installed `GLTFLoader` maps that alpha to `material.opacity` and MASK to `alphaTest` (default `0.5`). Thus the new `opacity === 0 && alphaTest > 0` condition matches these assets and does not alter unrelated materials. Setting opacity to `1` and alpha test to `0` should stop the all-fragment discard. It also removes masking, which is appropriate for these materials because the GLBs contain no base-color alpha textures.
- **Clone sharing is intentional here.** `SkeletonUtils.clone()` clones the object and skeleton hierarchy, while mesh materials remain shared references. Repairing loaded scene materials *before* cloning therefore reaches every cow and sheep instance without repeating work. The shared reference would matter only if a later feature wanted per-animal material changes; that feature would need to clone its material first.
- **Load failure is contained, with an existing visual gap.** Either failed `loadAsync()` resolves to `null`; cow instances then use opaque sphere fallbacks. Sheep have no fallback and remain absent if their GLB fails. This is pre-existing behavior, not caused by the alpha edit. If an asset loads but contains unexpected material alpha values, the narrow guard leaves it unchanged rather than repairing it.
- **Static limitation:** the cast to `MeshStandardMaterial` is a TypeScript assertion, not a runtime check. The current GLBs use standard PBR materials, so the fields are present. A future replacement with custom materials should be reviewed before reusing this repair. Visibility, feet placement, lighting, and frame rate still require an actual rendered check.

Reviewed: `src/chapterTwo.ts`, the local cow/sheep GLB JSON chunks, and installed Three.js `GLTFLoader`/`SkeletonUtils` source. No runtime files or assets changed in this audit.
