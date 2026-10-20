# Quaternius Deer — incoming source

- Creator: Quaternius. [Individual listing](https://poly.pizza/m/T6Cs7tmMHJ) says FBX/glTF, animated, Public Domain (CC0). [Creator pack](https://quaternius.com/packs/ultimateanimatedanimals.html) confirms glTF, CC0 and free commercial use. No login needed.
- Direct GLB from listing preview metadata: https://static.poly.pizza/4b6c2a41-43c7-404c-ae37-e8c4645ff93b.glb
- Downloaded 2026-10-21 as `quaternius-deer.glb`. SHA-256: `FABF360B22EACCCCD056EE99D698A9562D15AA245821F96E4FBAD6DB3751604E`.
- File: 1,007,564 bytes; valid GLB v2; 1 mesh / 7 triangle primitives; 2,096 triangles; 7 materials; 0 textures; 1 skin / 46 joints; 26 animation clips including duplicated `AnimalArmature|` prefixed names. Candidate clips: `Idle`, `Walk`, `Eating`, `Gallop`. No required extensions.
- Static scene-node-transformed POSITION accessor bounds: min `(-0.729, -0.013, -1.642)` m, max `(0.729, 4.261, 2.755)` m; size about `1.459 × 4.274 × 4.397` m. This is a rest-pose box estimate, not animated bounds. Scale is unusually large relative to current livestock; rendered calibration required.
- Incoming review only. No public asset/Hall placement. Check silhouette, hoof contact, clip meaning and skinning with GLTFLoader; use SkeletonUtils clone for independent animation instances.
