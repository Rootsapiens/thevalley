# Furniture manifest (CC0, ready-made)

All files: `public/models/*.glb`, meters, +Y up, origin at bottom-centre of the footprint (exceptions in the description), front faces +Z (Poly Haven convention, check once in game).
Only the base-colour texture is kept (256 or 512 px JPEG, no normal/ORM maps) to stay under the 6 MB cap; roughness/metalness are constants.
Rebuild: `node scripts/models/fetch-polyhaven.mjs <ids>`, then `blender -b -P scripts/models/convert.py -- <repo_root>`, then `node scripts/models/make-manifest.mjs`.
Raw downloads (untrusted data, never executed): `art-src/models/polyhaven/`, `art-src/models/kenney/`.
Sources: Poly Haven (CC0, https://polyhaven.com/license) and Kenney Furniture Kit 2.0 (CC0, https://kenney.nl/assets/furniture-kit). No attribution is required; CREDITS.md credits the authors anyway.
Known gap: no ready-made CC0 stone fireplace or bed with mattress was found; use stove_masonry / stove_barrel and bed_old_frame (+ rug/pillow boxes). vintage_wooden_drawer_01 (Poly Haven) has a broken accessor and was skipped.

Total: 55 files, 5669776 bytes (5.41 MiB).

| file | what it is | source URL | license | triangles | bytes | footprint w x d x h (m) | suggested room |
|---|---|---|---|---|---|---|---|
| table_kitchen_long.glb | long painted kitchen/dining table | https://polyhaven.com/a/painted_wooden_table | CC0 | 600 | 48948 | 2.406x1.137x0.959 | house/kitchen |
| table_plain.glb | small plain wooden table | https://polyhaven.com/a/wooden_table_02 | CC0 | 196 | 43696 | 1.134x0.706x0.8 | house/kitchen |
| chair_wood_a.glb | painted wooden chair | https://polyhaven.com/a/painted_wooden_chair_01 | CC0 | 724 | 80276 | 0.432x0.54x0.956 | house/kitchen |
| chair_wood_b.glb | painted wooden chair, tall back | https://polyhaven.com/a/painted_wooden_chair_02 | CC0 | 1246 | 78832 | 0.639x0.662x1.264 | house/cafe |
| stool_wood.glb | painted wooden stool | https://polyhaven.com/a/painted_wooden_stool | CC0 | 676 | 60384 | 0.385x0.406x0.579 | house/kitchen |
| stool_rustic.glb | rustic round stool | https://polyhaven.com/a/wooden_stool_01 | CC0 | 1499 | 99344 | 0.425x0.442x0.438 | barn/house |
| nightstand.glb | bedside table | https://polyhaven.com/a/painted_wooden_nightstand | CC0 | 470 | 52108 | 0.505x0.509x0.616 | house |
| wardrobe.glb | tall painted wardrobe (rescaled to 2.0 m) | https://polyhaven.com/a/painted_wooden_cabinet_02 | CC0 | 966 | 74792 | 0.776x0.562x2 | house |
| cupboard.glb | painted cupboard / dresser | https://polyhaven.com/a/painted_wooden_cabinet | CC0 | 2227 | 128172 | 1.195x0.617x1.182 | house/kitchen |
| shelf_small.glb | small painted shelf unit | https://polyhaven.com/a/painted_wooden_shelves | CC0 | 524 | 46088 | 0.511x0.367x1.125 | house/kitchen |
| shelf_tall_worn.glb | tall worn bookshelf (put jars/books on it) | https://polyhaven.com/a/wooden_bookshelf_worn | CC0 | 3000 | 144132 | 1.374x0.581x2.063 | house/church |
| shelf_display.glb | wooden display shelves | https://polyhaven.com/a/wooden_display_shelves_01 | CC0 | 2494 | 131444 | 0.372x1.078x1.556 | house/cafe |
| bed_old_frame.glb | old iron bed frame (add a mattress) | https://polyhaven.com/a/old_bed_frame | CC0 | 3000 | 301036 | 0.912x2.002x1.204 | house |
| daybed.glb | vintage day bed | https://polyhaven.com/a/vintage_day_bed | CC0 | 2715 | 133516 | 1.973x0.855x1.127 | house |
| sideboard_long.glb | long wooden sideboard | https://polyhaven.com/a/modern_wooden_cabinet | CC0 | 2499 | 218792 | 2.44x0.52x0.68 | cafe/house |
| chest_wood.glb | wooden treasure/storage chest | https://polyhaven.com/a/treasure_chest | CC0 | 2995 | 181484 | 0.949x0.527x0.624 | house/barn |
| stove_barrel.glb | barrel wood stove | https://polyhaven.com/a/barrel_stove | CC0 | 2500 | 126664 | 0.593x0.59x0.857 | house/barn |
| stove_masonry.glb | masonry heater / tiled stove | https://polyhaven.com/a/scandinavian_masonry_heater | CC0 | 3000 | 234184 | 1.167x1.331x2.361 | house/kitchen |
| jug.glb | painted ceramic jug | https://polyhaven.com/a/jug_01 | CC0 | 1200 | 39380 | 0.276x0.168x0.211 | kitchen |
| pot_clay.glb | clay cooking pot | https://polyhaven.com/a/ceramic_pot | CC0 | 1998 | 66444 | 0.656x0.502x0.372 | kitchen |
| jar_ceramic.glb | ceramic jar / vase | https://polyhaven.com/a/ceramic_vase_02 | CC0 | 1200 | 57668 | 0.217x0.222x0.308 | kitchen/house |
| bucket_wood.glb | wooden bucket | https://polyhaven.com/a/wooden_bucket_01 | CC0 | 1798 | 84772 | 0.367x0.341x0.552 | kitchen/barn |
| basket_wicker.glb | wicker basket with lid | https://polyhaven.com/a/wicker_basket_02 | CC0 | 1498 | 64932 | 0.347x0.255x0.201 | kitchen/house |
| bowl_wood.glb | wooden bowl | https://polyhaven.com/a/wooden_bowl_01 | CC0 | 800 | 32728 | 0.313x0.31x0.094 | kitchen |
| pot_enamel.glb | enamel pot | https://polyhaven.com/a/pot_enamel_01 | CC0 | 998 | 41948 | 0.263x0.182x0.178 | kitchen |
| pot_brass.glb | brass pot | https://polyhaven.com/a/brass_pot_01 | CC0 | 1500 | 54632 | 0.301x0.3x0.291 | kitchen |
| cutting_board.glb | wooden cutting board | https://polyhaven.com/a/wooden_cutting_board | CC0 | 799 | 41712 | 0.45x0.247x0.041 | kitchen |
| broom.glb | wooden broom | https://polyhaven.com/a/wooden_broom | CC0 | 1498 | 172864 | 0.488x0.104x1.455 | house/barn |
| bottles_wine.glb | row of wine bottles | https://polyhaven.com/a/wine_bottles_01 | CC0 | 1499 | 177892 | 0.678x0.082x0.333 | kitchen/cafe |
| lamp_oil.glb | vintage oil lamp (emissive flame) | https://polyhaven.com/a/vintage_oil_lamp | CC0 | 2499 | 92408 | 0.22x0.22x0.802 | house/kitchen |
| lantern_wood.glb | wooden lantern (glass is 25% alpha) | https://polyhaven.com/a/wooden_lantern_01 | CC0 | 1998 | 108208 | 0.221x0.233x0.528 | house/barn |
| lantern_brass.glb | brass storm lantern | https://polyhaven.com/a/Lantern_01 | CC0 | 1498 | 76140 | 0.123x0.098x0.293 | house/barn |
| chandelier_lantern.glb | lantern chandelier (origin = top, hang from ceiling) | https://polyhaven.com/a/lantern_chandelier_01 | CC0 | 2500 | 137728 | 0.58x0.575x0.878 | cafe/church |
| candlestick.glb | turned wooden candlestick | https://polyhaven.com/a/wooden_candlestick | CC0 | 2129 | 104072 | 0.098x0.099x0.22 | house/church |
| candleholders_brass.glb | brass candelabra set | https://polyhaven.com/a/brass_candleholders | CC0 | 1998 | 180340 | 1.058x0.367x0.835 | church |
| barrel_wood.glb | wooden barrel | https://polyhaven.com/a/barrel_03 | CC0 | 1473 | 74816 | 0.634x0.639x0.93 | barn/cafe |
| barrel_wine.glb | wine barrel | https://polyhaven.com/a/wine_barrel_01 | CC0 | 2497 | 182764 | 0.742x0.756x0.872 | barn/cafe |
| crate_small.glb | wooden crate (long) | https://polyhaven.com/a/wooden_crate_01 | CC0 | 1498 | 97204 | 0.821x0.408x0.348 | barn/house |
| crate_large.glb | wooden crate (large) | https://polyhaven.com/a/wooden_crate_02 | CC0 | 1498 | 99076 | 0.529x1.165x0.464 | barn |
| cafe_table_round.glb | round cafe table | https://polyhaven.com/a/round_wooden_table_02 | CC0 | 2499 | 116308 | 0.796x0.796x0.746 | cafe |
| cafe_table_low.glb | low cafe table | https://polyhaven.com/a/gallinera_table | CC0 | 1999 | 127392 | 0.828x0.518x0.487 | cafe |
| cafe_chair.glb | cafe chair | https://polyhaven.com/a/gallinera_chair | CC0 | 2500 | 155864 | 0.58x0.602x1.034 | cafe |
| cafe_barstool.glb | bar stool | https://polyhaven.com/a/bar_chair_round_01 | CC0 | 2000 | 179956 | 0.49x0.491x0.752 | cafe |
| stool_folding.glb | folding wooden stool | https://polyhaven.com/a/folding_wooden_stool | CC0 | 1500 | 82052 | 0.527x0.546x0.441 | cafe/house |
| side_table.glb | side table | https://polyhaven.com/a/side_table_01 | CC0 | 2000 | 110128 | 0.55x0.45x0.551 | house/cafe |
| bench_church.glb | painted bench (church pew) | https://polyhaven.com/a/painted_wooden_bench | CC0 | 630 | 53840 | 1.165x0.497x0.889 | church |
| mirror_ornate.glb | ornate wall mirror (origin = back face) | https://polyhaven.com/a/ornate_mirror_01 | CC0 | 2000 | 90696 | 0.486x0.026x0.744 | house |
| clock_wall.glb | wall clock (origin = back face) | https://polyhaven.com/a/wall_clock | CC0 | 1498 | 82616 | 0.321x0.047x0.322 | house/cafe |
| spinning_wheel.glb | spinning wheel | https://polyhaven.com/a/spinning_wheel_01 | CC0 | 3499 | 220224 | 0.49x1.025x0.968 | house |
| rug_rect.glb | rug, rectangular (flat colour, Kenney) | https://kenney.nl/assets/furniture-kit | CC0 | 28 | 3564 | 2.512x1.472x0.016 | house |
| rug_round.glb | rug, round (flat colour, Kenney) | https://kenney.nl/assets/furniture-kit | CC0 | 188 | 10860 | 1.472x1.472x0.016 | house/cafe |
| table_cloth.glb | table with cloth (Kenney) | https://kenney.nl/assets/furniture-kit | CC0 | 144 | 10080 | 1.683x0.895x0.653 | cafe/house |
| kitchen_counter.glb | kitchen counter module (Kenney, recoloured wood) | https://kenney.nl/assets/furniture-kit | CC0 | 114 | 11124 | 0.903x0.945x0.945 | kitchen |
| kitchen_sink.glb | kitchen sink module (Kenney, recoloured wood) | https://kenney.nl/assets/furniture-kit | CC0 | 318 | 24728 | 0.903x0.945x1.029 | kitchen |
| bar_counter.glb | bar counter: long sideboard scaled to 1.05 m height | https://polyhaven.com/a/modern_wooden_cabinet | CC0 | 2499 | 218724 | 3.767x0.803x1.05 | cafe |
