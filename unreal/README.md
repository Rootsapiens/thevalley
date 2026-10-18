# Omega Valley: UE5 trial (barn slice)

A two-week trial, approved by the owner on Noor's recommendation. It rebuilds the approved Chapter 1 barn slice in Unreal Engine 5.
**Success means:** 60 fps, a Lumen dusk shot, and one short Sequencer cinematic.
The Three.js web build stays the shipping target. Nothing in `unreal/` is part of the web build, and `src/` is only read, never changed.

## 1. Owner steps: install the engine (only you do this)
Claude never signs in, never accepts a licence and never clicks Install for you.

1. Open the **Epic Games Launcher** and sign in.
2. In the left sidebar, click **Unreal Engine**. Then open the **Library** tab at the top.
3. Next to **ENGINE VERSIONS**, click **+**. A new slot appears. Choose the **latest 5.x** in its version drop-down.
4. Click **Install**. Leave the location at the default, `C:\Program Files\Epic Games`. The engine will land in
   **`C:\Program Files\Epic Games\UE_5.x`**, for example `UE_5.7`.
5. In the install dialog, click **Options** before you confirm. Afterwards you can still reach it from the slot's drop-down arrow under **Options**. Set:
   | Component | Setting |
   |---|---|
   | Core Components | on (required) |
   | Starter Content | **off** |
   | Templates and Feature Packs | **on** |
   | Engine Source | **off** |
   | Editor symbols for debugging | **off** (saves tens of GB) |
   | Target Platforms | **all off** (Windows is always included; Android, iOS, Linux and the rest stay off) |
6. Click **Apply** and then **Install**. Accept the EULA when the Launcher asks. That step is yours.
7. Launch the engine once from the Launcher. This lets it finish its first-run setup (prerequisites). Then close it.

You do not need Visual Studio, a C++ toolchain or a system Python. The project uses no C++, and the Python editor plugin ships with the engine.

## 2. Run the trial (one command)
From the repo root, in PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File unreal\scripts\run_trial.ps1
```
The script does these steps in order:
1. `find_engine.ps1` finds the newest UE 5.x install and writes `EngineAssociation` into `OmegaValley.uproject`.
2. `node scripts/export-village-json.mjs` reads `src/village.ts` and writes `unreal/data/village-barn.json`.
3. `UnrealEditor-Cmd ... -run=pythonscript -script=build_barn_level.py` builds `/Game/OmegaValley/Maps/BarnSlice`, its materials and `LS_OpeningDolly`.
4. A warm-up `-game` run compiles the shaders. Then it does one measured run each at scalability **Epic (3)** and **High (2)**.
   Each measured run turns VSync off, captures a CSV over `-csvCaptureFrames`, runs `stat unit`, and takes a screenshot with `HighResShot`.
   All runs look through `OV_OpeningCam`, which shows the web build's opening shot.
5. It writes the report to `studio/reports/tariq-ue-trial.md` (numbers only) and the screenshot to `studio/stills/ue-trial-barn-dusk.png`.

Useful switches:
- `-SkipBuild` and `-SkipWarmup` skip those steps on re-runs.
- `-Scalability 2` measures only one level.
- `-ScreenPercentage 67` renders at 67% and upscales with TSR.
- `-Package` also runs `RunUAT BuildCookRun` to get the shipping build size. The output goes to `unreal/build/`, which is gitignored.
- `-Npcs` also places the village NPCs (step 2b below) before the game runs.

## 2b. Village NPCs (one command)
```powershell
powershell -ExecutionPolicy Bypass -File unreal\scripts\run_npcs.ps1
```
1. `node scripts/export-npcs.ts` reads `src/npcData.ts` and writes `unreal/data/village-npcs.json` (15 NPCs, game metres).
2. `UnrealEditor-Cmd ... -run=pythonscript -script=place_npcs.py` places one placeholder (BasicShapes Cylinder, 50 x 50 x 180 cm) per NPC in BarnSlice, building the level first if it is missing.
   Label = NPC id, outliner folder `NPCs`, tags `OV_NPC`, `spawnDay:<n>`, `cuffed:<bool>`, `floorKnown:<bool>`. NPCs whose floor is not decided stand at Z = 0 with the tag `floor_to_confirm`.
   Re-runs replace the actors tagged `OV_NPC`; a barn rebuild does not touch them. Result: `Saved/ov_npcs_result.json`.
3. Without the engine: `python unreal/scripts/test_place_npcs.py` checks the JSON and the conversion.

**Expect this on this laptop (Intel Iris Xe, 16 GB):**
- The first shader compile takes about 20–40 minutes. The warm-up has a 40-minute cap.
- Lumen at 1080p Epic will most likely miss 60 fps on an iGPU. That is why the report measures both High and Epic. Also try `-ScreenPercentage 67`.
- A discrete GPU is the real test of the 60 fps target.

## 3. Files
| Path | What |
|---|---|
| `OmegaValley/OmegaValley.uproject` | Blank-template-compatible project. Plugins: PythonScriptPlugin, EditorScriptingUtilities, SequencerScripting, MovieRenderPipeline. Windows only. |
| `OmegaValley/Config/DefaultEngine.ini` | Lumen GI and reflections (software), Virtual Shadow Maps, Nanite, auto exposure off, ACES filmic tonemapper to sRGB, TSR, DX12 SM6 |
| `OmegaValley/Config/DefaultGame.ini` | Project info and packaging (Shipping, IoStore, only BarnSlice cooked) |
| `data/village-barn.json` | Barn slice exported from `src/village.ts`: boxes by group, examinables, hoofprint trail, spawn, sun, landmarks and self-checks. Units are game metres. |
| `scripts/ov_units.py` | Converts m to cm and +Y up to +Z up (UE X = east, Y = south, Z = up; yaw = bearing − 90). Self-test: `python ov_units.py` |
| `scripts/build_barn_level.py` | Builds the level from the JSON. Safe to re-run: it deletes only actors tagged `OV_AUTO`, so hand-placed actors stay. |
| `scripts/make_opening_dolly.py` | Sequencer stub: 8 s at 30 fps, a 3 m dolly with a 6° pan toward the cave mouth, plus a camera-cut track |
| `scripts/import_art.py` | Imports `public/art/*` and `public/models/*.glb` into `/Game/OmegaValley/Art`. Only files logged in `CREDITS.md` are imported. Nanite is turned on for meshes. |
| `scripts/find_engine.ps1`, `scripts/run_trial.ps1` | Engine discovery and the one-command trial |
| `data/village-npcs.json`, `scripts/place_npcs.py`, `scripts/run_npcs.ps1`, `scripts/test_place_npcs.py` | Village NPCs: data exported from `src/npcData.ts`, the placer, its one-command runner and its pure test |

## 4. Rules this project keeps
- **Units:** the game uses metres with +Y up. UE uses centimetres with +Z up. Only `ov_units.py` converts between them.
  - Landmark test: the shrine at (22.55, −37.3) m maps to (2255, −3730) cm. This is checked in Node, in Python and in the editor after the build.
- **Light** (`studio/world/decisions-noor.md`):
  - Sun at bearing 240° and elevation 4°, about 2000 K. The DirectionalLight gets pitch −4 and yaw −30, so shadows point ENE.
  - SkyAtmosphere, and a cold blue ExponentialHeightFog (`fogHaze` #2A3440).
  - The mountain and the cave mouth sit at 45°. The mountain face should be the brightest surface.
  - The knobs are at the top of `build_barn_level.py`: `SUN_LUX`, `EXPOSURE_BIAS`, `FOG_*`.
- **Originality:** no Valve or Half-Life content. Fab or Marketplace assets are allowed only if they are free or owned, and each must be logged in `CREDITS.md`. The current level uses only engine BasicShapes and our own data.
- **Git:** `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/` and `unreal/build/` are ignored. Commit `Content/` (use Git LFS for `.uasset`/`.umap` if it grows).

## 5. Trial checklist (2 weeks)
- [ ] `run_trial.ps1` passes. The report shows fps at Epic and High, and the landmark check reads OK.
- [ ] Dusk shot:
  - Open BarnSlice and tune `SUN_LUX`, `EXPOSURE_BIAS` and the fog so the mountain face is the brightest surface.
  - Render a still with Movie Render Queue. Use at least 64 warm-up frames so Lumen settles. The automatic shot is taken at frame 1.
- [ ] Cinematic: render `LS_OpeningDolly` with Movie Render Queue (Window > Cinematics > Movie Render Queue).
- [ ] Optional: run `import_art.py` and swap the blockout colours for Aktham's textures. Sculpt a Landscape if the slice leaves the flat barn corner (the export shows the ground is flat: 0..0 m).
- [ ] Compare against the web build on numbers: fps, visual quality, build size (`-Package`) and iteration time (level rebuild seconds). The owner then decides what to port.
