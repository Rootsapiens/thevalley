# Characters manifest (multiplayer bodies)

All GLB: meters, +Y up, skinned (one armature, root node "Root" carries the scale), flat material colours (no textures),
no logos. Total 4.43 MB (limit 8 MB). Rebuild: `blender -b -P scripts/models/chars_convert.py -- <repo>` (6 people),
`blender -b -P scripts/models/chars_ual.py -- <repo>` (mannequin). Check: `node scripts/models/chars_preview.mjs`
-> `art-src/models/characters/sheet-three.png` (three.js line-up, heights read from the posed skin).

| file | source URL | license | tris | bytes | height m | clips |
|---|---|---|---|---|---|---|
| public/models/characters/soldier_male.glb | https://opengameart.org/content/animated-characters-pack (Quaternius, Soldier_Male) | CC0 | 2994 | 463088 | 1.85 | idle walk run shoot death hit punch walk_carry |
| public/models/characters/soldier_female.glb | same (Soldier_Female) | CC0 | 7066 | 675452 | 1.72 | same |
| public/models/characters/soldier_male_operator.glb | Soldier_Male + original tactical gear from `scripts/models/upgrade-operators.py` | CC0 body; original gear |  |  |  | source clips retained |
| public/models/characters/soldier_female_operator.glb | Soldier_Female + original tactical gear from `scripts/models/upgrade-operators.py` | CC0 body; original gear |  |  |  | source clips retained |
| public/models/characters/worker_male.glb | same (Worker_Male) | CC0 | 2524 | 424648 | 1.78 | same |
| public/models/characters/worker_female.glb | same (Worker_Female) | CC0 | 5856 | 610844 | 1.66 | same |
| public/models/characters/cowboy_male.glb | same (Cowboy_Male) | CC0 | 3176 | 475388 | 1.80 | same |
| public/models/characters/oldclassy_female.glb | same (OldClassy_Female, elder) | CC0 | 7008 | 675372 | 1.62 | same |
| public/models/characters/mannequin.glb | https://opengameart.org/content/universal-animation-library (Quaternius UAL Standard, Godot GLB) | CC0 | 13743 | 1101708 | 1.82 | idle walk run sprint aim shoot death hit crouch |

Source zips (not shipped): `art-src/models/characters/quaternius-uacp/pack.zip` sha256 0295062c...09da (48.4 MB),
`art-src/models/characters/quaternius-ual/pack.zip` sha256 18ff1a72...c2 (14.5 MB). Neither zip has a licence file for the
character pack; CC0 is as stated on the OpenGameArt page (the UAL zip has License.txt = CC0 1.0).

## Unreal-only villager cast

`art-src/models/characters/quaternius-rpg-character-pack/` contains the free Quaternius RPG Character Pack source FBXs and
matching textures downloaded on 2026-10-20. It includes Cleric, Monk, Ranger, Rogue, Warrior and Wizard, all rigged and
animated. The pack is CC0 and is imported only into the Unreal trial at
`/Game/OmegaValley/Characters/Villagers/RPGCharacterPack`; it is not used by the web build. Source:
https://quaternius.com/packs/rpgcharacters.html.

## Honest notes
- The original six people are stylised low-poly "chibi" figures (big head, short legs). The operator variants add
  lightweight tactical silhouette gear but keep that source body style; they are not photorealistic models.
- The pack has no run clip: `run` = `walk` keys compressed 1.6x (0.79 s vs 1.29 s). `shoot` is one-handed (pistol-like),
  14 frames at 24 fps (0.58 s), not looping. `death` 2.54 s, hold last pose. `hit` 0.67 s.
- The original skin was near-black; skin tones were set in `chars_convert.py` (TARGET table). The eye shapes ("Face"
  material, near-white) are kept as in the pack.
- Original FBX scale was about 3.2 m tall; each model is scaled via the "Root" node to the height listed.
- Face material has no pupils; do not zoom the camera closer than ~1 m.

## Team tints (set `material.color`, or multiply, on the named materials; clone the material per player)
Ravens (dark/red): torso/jacket `#2b2b30`, trousers/limbs `#1b1b1f`, accent (scarf/vest/belt) `#8c1c1c`, hat/helmet `#26262b`.
Village (earth): torso `#7a5a3a`, trousers `#4a3b2a`, accent `#b0893f`, hat `#8a6d3b`.

| file | torso (Ravens / Village) | legs | accent | headgear |
|---|---|---|---|---|
| soldier_male / soldier_female | `Main` | `DarkGreen` | `Black` (keep) | `Helmet` / `Hair` |
| worker_male / worker_female | `Shirt` | `Pants` | `Vest` | `Hat` |
| cowboy_male | `Jacket` (+`Top`) | `Pants` | `Scarf` | `HatBrown`, `HatLightBrown` |
| oldclassy_female | `Shirt` | `Pants` | `Detail`, `Belt` | `Hat` |
| mannequin | `M_Main` (whole body) | - | `M_Joints` | - |
Never tint `Skin` or `Face`. Suggested: Ravens = soldier_* + mannequin; Village = worker_*, cowboy_male, oldclassy_female.
