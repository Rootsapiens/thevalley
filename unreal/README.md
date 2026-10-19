# Omega Valley: UE5 trial (barn slice + village blockout)

A two-week trial, approved by the owner on Noor's recommendation. It rebuilds the approved Chapter 1 barn slice in Unreal Engine 5.
**Success means:** 60 fps, a Lumen dusk shot, and one short Sequencer cinematic.
The Three.js web build stays the shipping target. Nothing in `unreal/` is part of the web build, and `src/` is only read, never changed.

## 0. Where the project lives (read this first)
Unreal cannot save packages under `Desktop` on this machine ("Could not open for writing ...Saved\*.tmp").
So there are two copies:

| Copy | Path | Role |
|---|---|---|
| **Mirror (canonical UE project)** | `%USERPROFILE%\OVUnreal\unreal\OmegaValley` (data `..\data`, scripts `..\scripts`) | The project Unreal opens, builds and saves. `Content\` binaries live only here. |
| Git repo | `Desktop\OmegaValley\unreal\` | Source of truth for git: scripts, data JSON, Config, `.uproject`, this README. Never `Content\`, `Saved\`, `Intermediate\`, `DerivedDataCache\`. |

- Every runner dot-sources `scripts\ov_env.ps1`. It finds the repo (`$env:OV_REPO`, else `Desktop\OmegaValley`) and the project (`$env:OV_UPROJECT`, else the mirror).
- If you launch a runner from the repo copy, it first copies that copy's scripts, data and Config to the mirror. The copy you launch is the copy that runs.
- After working in the mirror, copy the text files back: `powershell -ExecutionPolicy Bypass -File %USERPROFILE%\OVUnreal\unreal\scripts\sync_mirror.ps1`. Add `-ToMirror` for the other direction, after a `git pull`.
- `Content\` is rebuilt from the repo's data and art by the scripts. It is gitignored.

## 1. Owner steps: install the engine (only you do this)
Claude never signs in, never accepts a licence and never clicks Install for you.
1. In the **Epic Games Launcher**, open **Unreal Engine > Library** and add an engine slot with **+**. Pick the latest 5.x (installed now: **5.8.3** at `C:\Program Files\Epic Games\UE_5.8`).
2. Under **Options**, turn on Core Components and **Templates and Feature Packs**; the first-person character comes from them. Turn off Starter Content, Engine Source, debug symbols and every extra target platform.
3. Install it and accept the EULA (that step is yours). Launch the engine once, then close it.

You do not need Visual Studio or a system Python. The project has no C++, and the Python plugin ships with the engine.

## 2. One-command runners (PowerShell, from `%USERPROFILE%\OVUnreal\unreal\scripts`)
| Command | What it does |
|---|---|
| `run_trial.ps1` | Export JSON (node, read-only on `src\`), copy the engine's First Person template, build `BarnSlice` (commandlet), render the MRQ stills and dolly, then run perf at Epic/High × 100/67 %. Writes `studio\reports\tariq-ue-trial.md` and `studio\stills\ue-*.png`. |
| `play.ps1` | **Play** the barn: the 8 s opening dolly, then first person. WASD moves, the mouse looks, Space jumps, Alt+F4 quits. The default is High at 67 %, 1600×900; `-Quality 3 -ScreenPercentage 100` gives Epic. `-Packaged` runs the packaged build instead. |
| `render_mrq.ps1 [-Jobs stills\|dolly]` | Movie Render Queue only (for look iteration). MRQ waits for every shader, so it also serves as the warm-up. |
| `run_village.ps1` | Builds the full-village blockout map `/Game/OmegaValley/Maps/Village`: terrain, town, trees, stream and the barn slice. Then `render_mrq.ps1 -Jobs village` renders `studio/stills/ue-village-*.png`. |
| `run_npcs.ps1` | Places the 15 NPC placeholders in BarnSlice, from `src/npcData.ts`. |
| `run_trial.ps1 -SkipExport -SkipBuild -SkipStills -SkipPerf -Package` | `RunUAT BuildCookRun` Win64 Shipping into `unreal\build\` (gitignored), for the build size. |

Re-run switches on `run_trial.ps1`: `-SkipExport`, `-SkipBuild`, `-SkipStills`, `-SkipPerf`, and `-Configs 2:67,3:100` (scalability:screen %).
Numbers from earlier steps are kept in `Saved\ov_trial_state.json`, so the report stays complete when you skip steps.

**Look knobs:** these are the upper-case constants at the top of `scripts\build_barn_level.py`: `SUN_LUX`, `SKY_INTENSITY`, `EXPOSURE_BIAS`, `AE_MIN_EV`/`AE_MAX_EV`, `FOG_*` and `LANTERN_CD`.
To override them without editing the script, put the values in `data\look.json`, for example `{"EXPOSURE_BIAS": 0.5}`. Then run `run_trial.ps1 -SkipExport -SkipPerf -MrqJobs stills`.

**Measured on this laptop (Iris Xe, 16 GB, 2 other UE editors open), barn slice at 1080p:**
| Setting | fps | p50 / p95 ms |
|---|---|---|
| Epic 100 % | 10.2 | 82 / 93 |
| Epic 67 % | 15.7 | 49 / 59 |
| High 100 % | 11.4 | 66 / 76 |
| High 67 % | 23.4 | 31 / 34 |

That is why `play.ps1` defaults to High 67 %. The 60 fps target needs a discrete GPU.
Other numbers:
- Rebuild from JSON: 10 s script, about 1 min with the commandlet.
- MRQ stills and dolly: 7 to 14 min. The first time it also compiles the shaders.
- Package: 228 s, 432 MB.

**Engine quirks seen on 5.8.3 (the scripts handle them):**
- `-ExecutePythonScript` quits the editor as soon as the script returns. `render_mrq.py` sets `EditorPythonScripting.set_keep_python_script_alive(True)`.
- Freshly imported textures render as the checker placeholder in MRQ. The scripts run `Editor.AsyncTextureCompilationFinishAll` first.
- Packaging a content-only project: the editor plugins carry `TargetAllowList: ["Editor"]` in the `.uproject`. Without it UAT wants a C++ game target. `/MovieRenderPipeline` is in `DirectoriesToNeverCook`. UAT also gets `-unrealexe=UnrealEditor-Cmd.exe`.
- `-game` runs write `Saved\` (CSV, screenshots) to `%LOCALAPPDATA%\UnrealEngine\5.8\Saved`, not to the project.
- `-csvExitOnCompletion` does not quit the game. The runner stops the game once the CSV is written.

## 3. Files
| Path | What |
|---|---|
| `OmegaValley/OmegaValley.uproject` | Plugins: PythonScriptPlugin, EditorScriptingUtilities, SequencerScripting, MovieRenderPipeline. Windows only. |
| `OmegaValley/Config/DefaultEngine.ini` | Lumen GI and reflections (software), VSM, Nanite, TSR, DX12 SM6, and the FP template game mode. |
| `OmegaValley/Config/DefaultInput.ini` | Enhanced Input defaults, copied from the FP template. |
| `OmegaValley/Config/DefaultGame.ini` | Packaging: Shipping, IoStore, and it cooks BarnSlice plus `/Game/OmegaValley`, `/Game/FirstPerson` and `/Game/Input`. |
| `data/village-barn.json` | The barn slice exported from `src/village.ts`, in game metres. |
| `data/village-town.json`, `data/village-terrain.glb` | The full village: 16 buildings, 523 town solids, trees and the stream. The terrain is a 1 m grid with a 400 m skirt. The `.glb` is gitignored and regenerated by the export. |
| `scripts/ov_env.ps1`, `ov_paths.py` | Path rules: mirror vs repo. Shared `Invoke-Engine` (hard timeout). |
| `scripts/ov_units.py` | m → cm and +Y up → +Z up (UE X east, Y south, Z up; yaw = bearing − 90). The only place that converts. |
| `scripts/ov_materials.py` | `M_OV_Base` (flat), `M_OV_Tex` (Aktham's textures and normals, world-planar 2 m tiles like `src/materials.ts`, tint = palette / texture mean) and `M_OV_Sky` (`valley-sky.jpg` equirect, unlit IsSky). |
| `scripts/import_art.py` | `public/art/*` → `/Game/OmegaValley/Art/Textures`. It imports only files logged in `CREDITS.md`, and skips files already present unless `OV_REIMPORT=1`. |
| `scripts/build_barn_level.py` | BarnSlice from the JSON: geometry, lighting, lanterns, cameras, `LS_OpeningDolly` and `LS_Stills`. Safe to re-run: it only replaces actors tagged `OV_AUTO`. |
| `scripts/build_village.py` | The Village map. It reuses the barn builders. |
| `scripts/make_opening_dolly.py`, `make_stills.py` | Sequencer. The dolly is 8 s at 30 fps: 3 m forward with a 6° pan to the cave. It auto-plays at BeginPlay with input locked, then hands the view back to the player. The stills sequence holds each camera for 45 frames. |
| `scripts/render_mrq.py` | MRQ through the PIE executor. It switches off the dolly's auto-play in memory first. |
| `scripts/install_fp_template.ps1` | Copies the engine's `TP_FirstPersonBP` (Blueprints, Anims, Input, Characters) into `Content/`. |

## 4. Rules this project keeps
- **Units:** the game uses metres with +Y up; UE uses centimetres with +Z up. Only `ov_units.py` (and the JS check in the exporter) converts. Landmark tests:
  - The shrine at (22.55, −37.3) m must land at (2255, −3730) cm. The build checks this.
  - The church tower centre at (2.5, 27.5) m must land at (250, 2750) cm. The village build checks this, and it also checks the terrain bounds against the export.
- **Light** (`studio/world/decisions-noor.md`): the sun sits at bearing 240° and elevation 4°, about 2000 K. That gives the DirectionalLight pitch −4 and yaw −30, so shadows point ENE.
  - The mountain and the cave mouth are at 45°.
  - The fog is a cold blue ExponentialHeightFog (`#2A3440`).
  - The sky is Aktham's `valley-sky.jpg`, painted with the same sun and mountain. It replaces SkyAtmosphere and feeds the real-time SkyLight.
  - The barn has 7 warm lanterns (about 1900 K) and the farmhouse has 1.
  - Exposure: histogram auto exposure, clamped from EV100 −1 to 3.5, with local exposure on to lift the shadows.
- **Originality:** no Valve or Half-Life content. The only third-party content is the engine's own First Person template (Epic, UE EULA, logged in `CREDITS.md`). Everything else is engine BasicShapes, our data and Aktham's art.
- **Git:** `Content/`, `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/`, `unreal/build/` and `data/*.glb` are ignored.

## 5. Trial checklist
- [x] Level rebuild from JSON, landmark check OK
- [x] Lumen dusk stills via MRQ (`studio/stills/ue-*.png`)
- [x] Cinematic: `LS_OpeningDolly` rendered by MRQ, and it auto-plays in game
- [x] Playable first person (`play.ps1`). Packaged build: `unreal/build/Windows/OmegaValley.exe` (`play.ps1 -Packaged`).
- [x] Village blockout map: terrain, 16 buildings and trees. Landmark checks: shrine, tower, terrain bounds, all at 0 cm error.
- [ ] 60 fps on the target GPU (the Iris Xe numbers are in `studio/reports/tariq-ue-trial.md`)
- [ ] Owner decision: what to port (fps, look, build size, iteration time are in the report)
