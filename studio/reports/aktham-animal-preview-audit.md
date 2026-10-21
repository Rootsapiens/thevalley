# Animal preview audit — 2026-10-21

## What the image establishes

`aktham-hall-animal-fit.png` is an offline display render. The cow, sheep and horse plinths are empty. Goat, deer and dog are visible; the dog's feet appear above its plinth. This does not show the animals' placement or draw cost in the game Hall. I found no checked-in script that generates this specific preview, so its import, scaling and placement steps cannot be audited directly.

## File evidence and likely cause

- `public/models/animals/cow.glb`, `sheep.glb` and `horse.glb` exist. Their GLB JSON contains mesh primitives, so missing files or empty meshes do not explain the blank plinths.
- **Every material in those three GLBs has `alphaMode: "MASK"` and a base-colour alpha of `0`.** Under glTF's default mask cutoff of 0.5, their surfaces are discarded. This is a strong file-based explanation for why all three disappear in a standard GLB render. The repository's `scripts/models/chars_convert.py` independently notes that FBX import can leave base-colour alpha at zero and make glTF masks discard geometry. The exact preview importer is unavailable, so this is a diagnosis from asset data, not a reproduced render fix.
- The dog GLB is present and has a skinned mesh, 16 joints, a mesh-node rotation of about −90° on X and a 100× node scale. Its raw mesh bounds therefore cannot be used as floor coordinates without applying node transforms and skinning. The image shows an offset, but the missing preview script prevents identifying whether the cause is the model's bind pose, importer transform, preview placement or a combination.

## Next art check

In an isolated preview, correct the cow/sheep/horse material alpha to 1 **on preview copies**, then rerender the same six plinths. For the dog, inspect the evaluated skinned world bounds and set plinth placement from the lowest visible paw, then compare a rest pose and an idle frame. Keep source GLBs and runtime Hall unchanged until those comparisons are rendered and reviewed. No browser/gameplay or performance check was performed here.
