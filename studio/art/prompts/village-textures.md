# Village tileable PBR set (Blender procedural, not ChatGPT)
Source: `scripts/blender/village_textures.py` -> `art-src/tex/`, then `node scripts/blender/encode-art.mjs` -> `public/art/`.
Method: procedural node materials (4D noise / voronoi sampled on a torus so u and v wrap; integer cell counts per tile),
EMIT-baked to 1024^2; normal = wrap-around Sobel of the baked height (OpenGL, +Y up); albedo mean normalised to the
palette-derived colour villageScene.ts already uses for that surface. 1 tile = TILE_M = 2 m.

| name | albedo mean (sRGB) | from | normal | rough |
|---|---|---|---|---|
| dirt-road | #4B352D | COL.mud | yes | yes (puddles 0.22, dry 0.86-0.96) |
| grass-dry | #6A5C46 | (COL.grassA + COL.grassB) / 2 | baked, not shipped | - |
| wood-planks-barn | #7D685F | COL.timber, 8 vertical boards/tile (25 cm) | yes | - |
| roof-tiles-red | #973B24 | mix(rust, emergencyRed, 0.3) x 0.8, 8 x 10 barrel tiles | yes | - |
| stone-wall | #98897E | COL.stone, 7 dry-stone courses, 4-6 stones each | yes | - |
| hay | #B1805F | mix(sodium, concrete, 0.55) x 0.75 (COL.hay is dE 28.8 off-palette) | baked, not shipped | - |
| fence-wood | #6E3B25 | COL.timberDark, grain along u (rails) | baked, not shipped | - |

Canon note: the village bible says slate roofs; roof-tiles-red is for the barn/red trim the slice already shows.
