# Lorenzo character asset and animation audit — 2026-10-21

Scope: read-only inspection of existing assets and film stills, with this report as the only new file. GTA VI is the owner's visual quality reference. The inspected Quaternius base is a **stylized prototype resource**, not a photorealistic character or a claim of matching GTA VI. Shipping engine remains Three.js + TypeScript.

## Available sources

All project paths below are relative to `C:\Users\nadee\Desktop\OmegaValley`.

- Male base: `art-incoming/nidal-office-npcs/quaternius-universal-base-characters-standard/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf`, with its adjacent `.bin` and texture images. Parsed: 14,318 triangles, one skin, 65 joints, seven texture references, no animations. It has underwear, no suitable village outfit. The female counterpart has 15,060 triangles and the same joint count.
- Base license: `art-incoming/nidal-office-npcs/quaternius-universal-base-characters-standard/Universal Base Characters[Standard]/License_Standard.txt`, explicitly CC0 1.0. Project source record: `studio/art/free-assets-manifest.md`; recorded official listing: https://quaternius.com/packs/universalbasecharacters.html.
- Animation source audited: `art-incoming/nidal-office-npcs/quaternius-animation-library-2-standard/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb`. Its parent folder contains `License.txt` (CC0 1.0) and `README.txt`. README identifies this variant as root motion disabled; the separate `_RM` file has root motion enabled.
- Existing alternative animation source: `art-src/models/characters/quaternius-ual/x/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb`. License: the adjacent parent `License.txt`, recorded as CC0 in `studio/art/characters-manifest.md`. This audit inspected its clip names/durations, not its skeleton compatibility.
- Viewed approved appearance references: `C:\Users\nadee\Desktop\rootsapiens the movie\image.png (220).png` and `image.png (221).png`. Lorenzo wears a navy field jacket, brown zip sweater, pale collared shirt, and has short dark hair with gray temples and a mature face. Current procedural model: `src/lorenzoPlayerModel.ts`.

## Skeleton comparison: male base versus UAL2

Both assets have 65 uniquely matching joint names and identical parent names, including `root`, `pelvis`, `spine_01`, `neck_01`, `Head`, and finger joints. Both scene roots are identity `Armature` nodes. Name matching is straightforward, but their bind/rest poses are different:

- 64 of 65 local and world rest matrices differ at maximum element tolerance `1e-5`.
- 62 local joint translations differ by more than `1e-5` scene units. The greatest distance is approximately **0.05230** at each thigh; the neck differs by **0.04220**. These are about 5.23 cm and 4.22 cm if the original meter scale is retained.
- 62 local rotations differ by more than **0.01 degrees**, measured with normalized quaternions. Maximum difference: **17.07068 degrees** at `neck_01`.
- Local scales agree within `1e-5`; 64 inverse bind matrices differ at `1e-4` maximum element tolerance.
- All 43 UAL2 clips animate all 65 joints, with **195 channels per clip**: translation, rotation, and scale. No target joint names are missing from the base.
- Concrete mismatch: the base pelvis rest translation is `[0, 0.04299998, 0.94910002]`; the first UAL2 `A_TPose` translation is `[0, 0.05010005, 0.91670001]`. A direct clip assignment would overwrite the base pelvis offset, and similarly overwrite other limb offsets. These are local rig coordinates, not world-space foot heights.

**Conclusion:** direct name-based binding is possible, but raw clip transfer is not a reliable finished animation pipeline. Retarget with bind/rest-pose compensation and preserve the target's limb lengths. Adjust hips/root displacement deliberately. Simply dropping translation tracks would still leave the measured rotational rest differences. Preserve the base's inverse bind matrices; copying the source skeleton/bind matrices would invalidate its skinning assumptions.

## Measured candidate clips

Durations below come from animation input time accessors, rounded to three decimals. UAL2 has 43 clips, spanning 0.433–4.333 seconds.

| Library | Clip | Duration | Appropriate use / limitation |
| --- | --- | ---: | --- |
| UAL2 | `A_TPose` | 2.500 s | Calibration only; never a gameplay idle. |
| UAL2 | `Idle_FoldArms_Loop` | 2.500 s | NPC standing pose; requires outfit intersection review. |
| UAL2 | `Idle_No_Loop` | 2.500 s | Name suggests a negative gesture; visual meaning unverified. |
| UAL2 | `Yes` | 2.500 s | Candidate acknowledgement; visual meaning unverified. |
| UAL2 | `Walk_Carry_Loop` | 2.000 s | Carrying movement; not an ordinary free-arm walk. |
| UAL2 | `Idle_TalkingPhone_Loop` | 2.933 s | Phone posture; unsuitable as generic conversation without review. |
| UAL1 | `Idle_Loop` | 2.500 s | Better neutral-idle candidate; skeleton compatibility pending. |
| UAL1 | `Walk_Loop` | 1.333 s | Better ordinary-walk candidate; skeleton compatibility pending. |
| UAL1 | `Idle_Talking_Loop` | 2.933 s | Better dialogue candidate; skeleton compatibility pending. |

No generic `Walk_Loop`, `Idle_Loop`, or `Idle_Talking_Loop` exists in this UAL2 file. Zombie and weapon poses should not stand in for ordinary village behavior.

## Practical next character task

Make one **clothed Lorenzo prototype** before replacing other NPCs: shape the existing base toward the film silhouette, add and skin a navy field jacket over brown knit and a pale collar, plus trousers/boots; remove covered body geometry only in a derived export. Retarget a neutral idle, ordinary walk, and conversation clip after checking UAL1's rest pose. Export one derived GLB with bounded textures, retain source/license records, and keep the current model available until the prototype passes review.

Review front/back silhouette against the two film stills, feet on the actual scene floor, knees/elbows, hand and jacket intersections, transitions, head direction, and draw-call/frame cost on the target device. Skeleton clones need independent skeleton state. A successful metadata audit alone does not establish valid animation or likeness.

Verification: local glTF/GLB JSON, binary animation accessors, skeleton transforms, inverse bind matrices and licenses inspected with Node.js and the project's installed Three.js; reference stills viewed. No model conversion, runtime animation playback, browser review, game tests, source changes, downloads, commits, or publication performed for this report.
