# Aktham: village texture art check (2026-10-18)
Scope: the 7 albedo maps in `public/art/` vs `src/villageTextures.ts` (base hex), `studio/art/prompts/village-textures.md` and `studio/art/style-guide.md`. Read-only: no image, no `src/` file changed. Measured with sharp (pngjs not installed) via three scratch scripts: `vtex.mjs` (means, dE, halves, profiles), `seam.mjs` (wrap seam vs JPEG block edges, 2x2 tiles), `band.mjs` (banding, blemishes).

## Albedo mean vs the manifest hex
The manifest says `base` is the linear-light mean written as sRGB hex, so the mean is taken in linear light. All 7 are 1024x1024 sRGB JPEG, 3 channels, no alpha.

| file | base (ts) | measured mean | CIE76 dE | lin ratio R/G/B | nearest palette token, dE |
|---|---|---|---|---|---|
| dirt-road | #4B352D | #4C352D | 0.58 | 1.016/0.989/1.013 | concreteDark 15.28 |
| grass-dry | #6A5C46 | #6A5C45 | 0.33 | 1.001/1.000/0.984 | concreteDark 16.95 |
| wood-planks-barn | #7D685F | #7D685E | 0.55 | 1.004/1.005/0.985 | concrete 15.55 |
| roof-tiles-red | #973B24 | #973B24 | 0.37 | 0.997/0.993/1.023 | rust 12.43 |
| stone-wall | #98897E | #97897E | 0.48 | 0.993/1.006/0.997 | concrete 7.26 |
| hay | #B1805F | #B1805F | 0.11 | 1.000/0.997/0.994 | rust 22.00 |
| fence-wood | #6E3B25 | #6E3B25 | 0.35 | 0.995/1.013/1.008 | rust 12.38 |

- All 7 match the manifest hex. The largest gap is dirt-road at dE 0.58. If you average the gamma-encoded values instead, stone-wall reads #93857A (dE 1.71) and hay #AE7D5C (dE 1.21). So any check must use the same linear-light mean.
- Palette (style guide, dE <= 25 to a token): all pass. **Worst image: hay, dE 22.00 to rust**, 3.0 under the limit. The prompt file already says COL.hay itself was dE 28.8 off-palette.
- Normal and roughness flags in the ts file match the files on disk: the normal maps for dirt, planks, roof and stone exist, and only dirt-road has `_rough`.

## Tiling and seams
- I measured the wrap edge (the seam between column 1023 and column 0, and between row 1023 and row 0) against the 127 interior 8-px JPEG block edges. No file has a seam above the 95th percentile of its own block edges. Hay y: 11.15 against p95 11.73. Fence-wood y: 5.97 against p95 7.96. Stone x: 2.04 against p95 3.83. Every other wrap edge is at or below the median. I also viewed 2x2 tiles at real size and saw no seam lines.
- Repeated blemishes show in 2x2. These are small dark spots that come back every tile at the same place:
  - grass-dry: darkest 16 px block 68.9 against a mean of 93.5 (z -5.3), at (560,176); 4 dark specks per tile.
  - fence-wood: knots, darkest block 35.2 against 71.1 (z -4.5); 2 per tile.
  - dirt-road: pebble cluster, brightest block 82.8 against 58.0 (z +4.7), at (944,880).
  - In-game these become a visible grid every 2 m (TILE_M).

## Measured problems
1. **wood-planks-barn: plank seams. Known, not fixed.**
   - There are dark grooves at x = 63, 192, 319, 447, 576, 703, 832 and 960. That is a pitch of 128 px, which is 0.25 m at 2 m per tile.
   - Groove columns average 43.6 to 46.0 luma against a 107.3 mean, so they are 59% darker. The column-profile sd is 10.98, against 1.08 for rows.
   - `studio/reports/rajaie-village-textures.md` line 5 already lists this as "Not fixed (design)": world-UV boards are 0.19 to 0.29 m wide, so about 90% of boards show a false seam. The texture is built as specified (8 boards per tile, per the prompt). The mismatch is with the geometry, not a bake fault.
2. **hay: noisiest file.**
   - Luma sd is 24.91, and the interior neighbour difference across rows is 8.38, which is 2.5x stone and 6x planks. 16 px blocks span 123.4 to 149.4 in 128 px block means. The row-profile range is 41.0, from horizontal streaking.
   - It is also the largest albedo file at 243,220 B, 5.6x dirt-road.
   - It breaks "low noise, soft local contrast" (style guide, Pillar 2).
3. **stone-wall: high contrast**, luma sd 32.01. The mortar rows at y = 73, 218, 364, 512, 659, 804 and 953 drop to 53.6 to 80.2 luma against a 135.2 mean. That gives 7 courses, which matches the prompt. The courses are strong but read as intended, so this is not a fault.
4. **dirt-road: faint vertical banding.** The column-profile range is 10.2 luma on a 58.0 mean, with darker streaks at x of about 36 to 126 and 291 to 332, and they are visible in 2x2. The centre quarter is +2.7 luma over the mean. The left/right and top/bottom halves differ by at most 1.4, so there is no baked directional light.
5. **Baked light:** the largest half-to-half difference is wood L/R at 4.31 and stone T/B at 4.14. Both come from board and stone tone, not a gradient. No file clips: 0.000% of pixels are at or below 2, and 0.000% at or above 253.
6. **Process gaps:**
   - `scripts/check-art.mjs` only reads `*.png` (line 43), so none of these 7 JPEGs, or the 2 village backdrops, are measured by the project gate.
   - The style guide's texture rule says "sRGB PNG". The village set ships as JPEG through encode-art.mjs, and that exception is not written down in the style guide.
   - The guide's palette tokens and moon-light rules are still the dam/night set. The village colours are derived from them (see the prompt file), and there is no village palette.

Not checked: text contrast (none of these textures carry text), stills and polygons (no scene change), and normal-map sign (Rajaie already measured it).
