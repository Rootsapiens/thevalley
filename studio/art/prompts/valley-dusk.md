# valley-dusk (Blender, not ChatGPT)
Source: `scripts/blender/valley_dusk.py` (scene + render), `scripts/blender/encode-art.mjs` (crop, wrap blend, JPEG, numbers).
Rebuild: `blender -b --factory-startup -P scripts/blender/valley_dusk.py -- --mode both --samples 32` then `node scripts/blender/encode-art.mjs`.

Brief (owner): "draw a background, artistic, based on the story, more of a valley".
- Compass: sun 240 deg / 4 deg, ~2000 K orange; mountain, cave mouth at 45 deg (decisions-noor.md). Cold blue sky and valley mist.
- Geography (world-bible, regions/village.md): N-S valley, village on the west slope ~40 m above the floodplain, stream at the
  village's east edge, west ridge with the mast at ~290 deg, snow above ~+510 m, cave arch on the SW face 2.8 km out.
- Angular sizes match src/villageScene.ts silhouettes (cave arch 72 x 54 m at 2.8 km = 1.47 deg).
- Story beats in the key art: village core laid out from the region map, bell tower, a single-file herd walking NE to the
  mountain with a child (Joseph) behind, faint roots out of the arch, lit windows.
- "Artistic": compositor Bloom -> anisotropic Kuwahara (7 px at 1920, 5 px at 4224) -> cool-lift / warm-gain colour balance.
- No text, no teal, no blue-white light (reserved for electricity). Horizon level (camera pitch 0, framing by lens shift).

Outputs
- `public/art/valley-dusk-key.jpg` 1920x1080: title / loading key art.
- `public/art/valley-sky.jpg` 4096x2048 equirect: u = ((bearing - 270) mod 360) / 360 (W, N, E, S, W), horizon at v = 0.5,
  for three.js `EquirectangularReflectionMapping` + `SRGBColorSpace`. Geometry closer than 200 m is clipped (the game builds it).
