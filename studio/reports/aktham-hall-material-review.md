# Aktham — Chapter 2 livestock material review

Source inspection only; no rendered or gameplay verification.

- `public/models/animals/cow.glb` has three materials; `sheep.glb` has two. All five use `alphaMode: MASK`, `alphaCutoff: 0.5`, and `baseColorFactor` alpha `0`. Neither GLB contains textures. A conforming glTF renderer therefore discards every surface of both animals.
- The uncommitted change in `src/chapterTwo.ts` runs only on the loaded cow and sheep scenes, before cloning. It changes materials with `opacity === 0` and `alphaTest > 0` to opacity `1` and alpha test `0`. This directly addresses the all-zero-alpha MASK import state shown above. It does not modify the GLB files or other loaded assets.
- No texture alpha or mixed per-material opacity exists in these two current GLBs, so there is no visible cutout detail for this correction to erase. It makes all five currently masked surfaces opaque. If the GLBs are later replaced with intentional zero-opacity masked materials, this heuristic could expose those surfaces; revisit it when assets change.
- Visibility, shading, scale, ground contact, and frame cost remain unverified until rendered in the game.
