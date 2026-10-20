# Free Game Assets — Nidal

Research and conversion date: 2026-10-20. All assets shipped in the game's runtime (`public/models/animals/` and `public/models/nature/`) have a verified CC0 license. A separate Yo Frankie! mountain source was downloaded for visual review only; it is CC-BY 3.0, is not converted or shipped, and is documented below.

## Downloaded and converted

| Asset | Source, creator, license | Local files | Prepared for the web game |
| --- | --- | --- | --- |
| Quaternius Farm Animals: cow, sheep, horse, and pig | [OpenGameArt pack page](https://opengameart.org/content/lowpoly-animated-farm-animal-pack), Quaternius, CC0 1.0. The downloaded archive includes `License.txt` with the same CC0 dedication. Official pack page: [Quaternius Farm Animal Pack](https://quaternius.com/packs/farmanimal.html). | Source archive and extracted FBX/Blend/OBJ: `art-src/models/quaternius-farm-animals/`. | Four self-contained +Y-up GLBs in `public/models/animals/`: cow 401,152 B / 796 source triangles / 1.55 m / idle-walk-run-jump-death; sheep 168,408 B / 612 triangles / 0.95 m / idle-jump; horse 366,800 B / 690 source triangles / 1.65 m / idle-walk-run-jump-death; pig 167,924 B / 562 source triangles / 0.78 m / idle-jump. Floor-centered origins. South Farmland now uses all four: three cows, two sheep, one horse, and one pig in the paddock, with idle clips. |
| Quaternius LowPoly Nature Pack Vol. 3 | [OpenGameArt pack page](https://opengameart.org/content/lowpoly-nature-pack), Quaternius, CC0. Source includes FBX, Blend and OBJ formats. | Archive and extracted source: `art-src/models/quaternius-simple-nature/`. | 12 static GLBs in `public/models/nature/`: four broadleaf trees (390–752 tris, 4.5 m), three bushes (86–214 tris, 1.2 m), three rocks (28–34 tris, 1.5 m), two grass clusters (172–184 tris, 0.75 m). Total exported nature set: 189,064 bytes. Converted from source Blend files in Blender 5.2.2 with flat colors preserved. |

## Source checksums and reports

- Farm animal source zip SHA-256: `9FF42B7E2445EAF259E4734C08172637DB92E4B59A6145909AC56D946152C39B`.
- Nature source zip SHA-256: `7BF32888A521E93C94D82FC2CEBDA482DE52C014CDE9D406DC62DA1575F9070D`.
- Farm-animal conversion statistics: `art-src/models/quaternius-farm-animals/conversion-report.json`.
- Horse/pig conversion statistics: `art-src/models/quaternius-farm-animals/conversion-report-extra.json`.
- Nature conversion statistics: `art-src/models/quaternius-simple-nature/conversion-report.json`.
- Conversion scripts: `art-src/models/quaternius-farm-animals/convert_animals.py`, `art-src/models/quaternius-farm-animals/convert_extra_animals.py`, and `art-src/models/quaternius-simple-nature/convert_nature.py`.
- GLB checks used Three.js `GLTFLoader` to inspect the models, dimensions, triangle counts and animal animation clips. Contact sheet: `studio/reports/nidal-assets-contact.png`. No full game or performance test was run.

## Roots and mountain view

The current game already grows story roots in `src/prologueRoots.ts` and draws a distant mountain ring in `src/villageScene.ts`. I did not add a photoreal root or mountain asset: a Poly Haven tree-stump/root scan is substantially more realistic than the game's low-poly palette, while a photo HDRI would fight the existing parallax mountain view. The downloaded low-poly rocks, trees, bushes and grass are suitable additions around the trail or future valley zones; placement should be instanced and kept outside existing movement routes.

### Ridge candidate reviewed, not promoted

Inspected Blender Foundation's Yo Frankie! mountain meshes (submitted to OpenGameArt by Lamoot): [OpenGameArt source page](https://opengameart.org/content/low-poly-mountains), CC-BY 3.0. Source download: `art-src/models/yofrankie-mountains/mountains.blend` (SHA-256 `D621B2D95D98357DD4CC1ABB1DDDC65BF26D9DC6B80DD8F66160AE94E05BFA40`). The blend contains ten cliff meshes (828–1,330 triangles each), two grass-capped mountains (984/1,034 triangles), and two small rocks. Source preview: `studio/reports/yofrankie-mountain-source-preview.png`. The blue-grey cliffs and vivid green caps do not closely match Omega Valley's muted palette, and the CC-BY source needs attribution if shipped. Kept as a reviewed reference only; no converted GLB or runtime credit added. Recommendation: retain the procedural mountain ring unless the art direction approves recolored cliff meshes.

### Other free packs reviewed, not added

| Pack | Official/source page and license | Fit decision |
| --- | --- | --- |
| Kenney Nature Kit | [Official Kenney page](https://kenney.nl/assets/nature-kit): 330 3D assets, CC0. | Preview has bright cyan/orange block colors that clash with the muted village palette. It also overlaps the existing Quaternius foliage/rock set, so it was not downloaded. |
| Quaternius Medieval Village MegaKit | [Official Quaternius page](https://quaternius.com/packs/medievalvillagemegakit.html): 304 models; FBX, OBJ, Blend and glTF; CC0. | Modular walls, roofs, floors, stairs, doors and windows duplicate the authored village/interiors. Not downloaded to avoid adding a second conflicting building style. |
| Kenney 3D Road Tiles | [Official Kenney page](https://kenney.nl/assets/3d-road-tiles): 300 3D files, CC0. | A modular tile-road set does not match the hand-shaped, muted dirt tracks already built into the valley. Existing roads connect the regions, so this pack was not downloaded. |

The existing open-world surroundings are already implemented in the web game; no third canon region or village-coordinate changes are proposed here. `src/villageMain.ts` loads `src/eastValley.ts` and `src/southFarmland.ts` over the shared terrain sampler. East Valley spans x=`125..225`, z=`-20..110`, and joins the village trail at `(123.5,12.5)` before continuing toward the Chapter 2 quarry road. South Farmland spans x=`-22..115`, z=`122..246`, joins the south road near `(37.5,118)`, and currently has 71 nature placements and a seven-animal paddock. The village grid in `src/villageMap.ts` remains authoritative.

## Coordinate-safe expansion proposal

Keep all current village geometry and route coordinates fixed. The 5 m village grid uses origin `(-75,-20)` and covers approximately x=`-75..125`, z=`-20..110`. The existing trail seam is x=`120.5..124.6`, z=`10.6..14.4`; the south road is x=`34..41`, z=`106.5..110`.

1. East Valley, x=`125..225`, z=`-20..110`, exists in `src/eastValley.ts`. Its trail joins the current herd/cave/mountain seam, and the module scatters low-poly props deterministically. Subzero reports typecheck and build pass; visual review is pending.
2. South Farmland is implemented in `src/southFarmland.ts`. It connects from the existing south road near `(37.5,118)` and has 71 environment placements plus livestock. The authored village grid and routes remain fixed.
3. Later region recommendation: add a Quarry/Ridge as a separate zone off the East Valley. Keep its entrance on the east region side so village paths do not move; define its own route, terrain, and placement bounds before adding props.

Treat `src/villageMap.ts` coordinates as authoritative. Keep future exterior props in region-local placement data, use deterministic scatter seeds, and leave margins around roads, gates, the square, houses and story actors. No original village coordinates were moved for the East Valley connector.

## Additional character research (2026-10-20)

| Pack | Source and license | Free files and fit | Decision |
| --- | --- | --- | --- |
| Quaternius Universal Base Characters | [Official pack](https://quaternius.com/packs/universalbasecharacters.html), Quaternius, CC0 1.0; optional credit. Also [official Itch download page](https://quaternius.itch.io/universal-base-characters). | The free Standard ZIP is 122 MB and includes two base characters (male/female) plus five hairstyles; rigged glTF is included, according to the Standard preview and distribution listing. The free models are shown in underwear, without villager clothing; the full 6-model/20-hair selection and Source assets are not all in the free subset. | Strong rig compatibility, but not a ready villager skin. Skip import for now: the models need clothes and the 122 MB archive is large beside existing sub-1.2 MB runtime GLBs. Reconsider if paired with a verified free outfit set. |
| Quaternius Modular Character Outfits - Fantasy | [Official pack](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html), Quaternius, CC0 1.0; optional credit. [Official Itch listing](https://quaternius.itch.io/modular-character-outfits-fantasy). | Humanoid-rigged, glTF/FBX; 12 outfits / 62 parts and three color variants are advertised for the full pack. The page states only 60–70% of the pack is free; Standard archive is 280 MB. Exact free outfit subset is not identified on the pack page. | Best visual direction for a costume pass, but do not assume all outfits are included in Standard. Not downloaded: large archive and the free subset requires the Itch download flow; inspect its exact contents before integration. |
| Quaternius Universal Animation Library | [Official pack](https://quaternius.com/packs/universalanimationlibrary.html), Quaternius, CC0 1.0; optional credit. [Official Itch listing](https://quaternius.itch.io/universal-animation-library). | Standard download is 15 MB and includes compatible humanoid GLB/retargetable animation files; page advertises 120+ clips across tiers, so not all are necessarily in Standard. Existing project already has UAL-derived `mannequin.glb` and CC0 character clips. | Good rig source, but overlaps the project library. No duplicate downloaded. |
| Quaternius Ultimate Nature Pack | [Official pack](https://quaternius.com/packs/ultimatenature.html), Quaternius, CC0 1.0; 150 models, FBX/OBJ/Blend, June 2019. | Broad foliage/terrain-prop collection, but no GLB advertised; existing 12-model low-poly nature library already covers trees, shrubs, rocks and grass. | Not downloaded: likely conversion work and overlap; no proven gap filled. |

### Character pack inspected, not promoted

Downloaded the free CC0 post [OpenGameArt 3D Character Pack](https://opengameart.org/content/3d-character-pack) by byzmod3d for review: `art-src/models/characters/opengameart-3d-character-pack-2026/bravos_game_br_part_3.zip` (9,449,609 bytes; SHA-256 `92A94951C7BCD31739FB46EF441F4CED5B10EC30FCF73A0D5E5B75F6EF7A4544`). The archive nests multiple ZIP/Blend sources and has no ready GLB; the contents are not a coherent, immediately usable village-NPC set. Keep it as source-review material only; no model was converted or shipped. CC0 does not require credit, but the page identifies byzmod3d as uploader/author.

**Current recommendation:** keep the existing Quaternius CC0 low-poly villagers and animal/environment sets. The best next NPC path is a small, verified subset from Modular Character Outfits - Fantasy after its free Standard contents are inspected; no assets from these new candidates are integrated into runtime.

## Focused NPC and world-set review (2026-10-20)

### Best ready-clothed villager source already in the library

The most useful CC0 source is the existing [Quaternius Animated Characters Pack on OpenGameArt](https://opengameart.org/content/animated-characters-pack), by Quaternius: the source page states CC0, 50+ animated characters, and FBX/OBJ/Blend. Its already-downloaded archive is `art-src/models/characters/quaternius-uacp/pack.zip` (48,430,012 bytes; SHA-256 `0295062CBC72DA52EE804F39AC38694901A40458011F9B2638FC7EF13ED509DA`). Local inspection confirms fully clothed source variants such as `OldClassy_Male/Female`, `Worker_Male/Female`, `Cowboy_Male/Female`, `Kimono_Male/Female`, `Chef_Male/Female`, doctors, and several casual variants. This pack is already partially represented by the runtime character GLBs; any further work should select only unused matching character FBX files from this archive and convert through the existing pipeline. No archive was downloaded again.

Quaternius's separate [Animated Men](https://quaternius.com/packs/animatedmen.html) and [Animated Women](https://quaternius.com/packs/animatedwomen.html) packs each list four models, CC0, and FBX/OBJ/Blend. Quaternius's [original men release note](https://www.patreon.com/quaternius/posts/free-animated-24703403) and [women release note](https://www.patreon.com/quaternius/posts/free-animated-25029311) state low-poly plus smooth variants and clips including idle, walk, run, attacks, death, jump and sitting. Preview imagery is casual/formal modern clothing, so these are less suitable as historical village residents; separate direct archives were not added because the project already contains overlapping Quaternius characters and no demonstrated costume gap.

### Open-world packs checked

| Pack | Verified source, license, formats and size | Fit decision |
| --- | --- | --- |
| KayKit Medieval Hexagon | [Creator page](https://kaylousberg.itch.io/kaykit-medieval-hexagon), Kay Lousberg, CC0 1.0; 200+ low-poly models in FBX/GLTF/OBJ; free Standard archive 33 MB. Free contents include hex road/river/coast tiles, buildings, trees, rocks, hills and mountains. | Verified, but the set is built around bright, raised hex tiles for RTS/village-builder maps and duplicates village structures. It does not join naturally to the existing free-form terrain or preserve an external valley silhouette. No download/import. |
| Quaternius Stylized Nature MegaKit | [Official page](https://quaternius.com/packs/stylizednaturemegakit.html), Quaternius, CC0 1.0; 116 models in FBX/OBJ/Blend/glTF; includes trees, plants/flowers, rocks, grass and bushes. | Most of the content duplicates existing tree/shrub/rock/grass props; no coherent terrain or landscape chunk set is advertised. Its Ghibli-inspired art direction may clash with the muted valley. No import. |
| ambientCG 3D Terrains (GDevelop pack) | [GDevelop source page](https://gdevelop.io/asset-store/free/3d-terrains-3d-terrains), ambientCG, CC0; ten ready-to-use textured terrain objects, including green hills, farmland, forest floor and mountains. | Terrain content fills a real geometry category, but the distributed objects are tied to GDevelop and use textured/normal-mapped surfaces unlike the game's simple low-poly palette. Conversion and restyling would be needed; no import. |
| Free Modular Islands | [Creator page](https://marina-sunny-girl.itch.io/free-modular-islands-pack), Marina_sunny_girl, CC0 1.0; 55 models in GLB plus Blend/OBJ/FBX/DAE; ZIP 4.9 MB. | The island/coast shapes do not fit a landlocked valley and appear unrelated to the current region seams. No import. |

The existing world already uses procedural connected East Valley and South Farmland terrain, with low-poly nature props and a procedural mountain ring. A later independent-source review found Fertile Soil Productions' CC0 Modular Terrain OBJ set, which provides hill/path/cliff geometry but needs palette and scene-fit review before use. No new terrain has been integrated. For villagers, the already-downloaded Quaternius clothed character source pack remains the immediately usable path; see the focused NPC reviews below for other free-tier candidates and limitations.

## Second independent-source pass (2026-10-20)

### Terrain candidate inspected, source only

[Modular Terrain](https://opengameart.org/content/modular-terrain), by Keith at Fertile Soil Productions, is marked CC0 on OpenGameArt. The source listing describes three collections (Hilly, Cliff, Beach), formatted as OBJ files for Asset Forge or other OBJ importers; it lists 511.3 KB. Downloaded archive: `art-src/models/fertile-soil-modular-terrain/modular_terrain_collections.zip` (511,263 bytes; SHA-256 `79915A60BF2C74F23AEF7175134B19AD949DDD07D56D3B3BB9AA3374DFC5BA4D`). Extracted source: `art-src/models/fertile-soil-modular-terrain/source/`, with 132 `.obj` meshes and 132 `.mtl` files. It contains hill and slope pieces, path curves/joins, cliff faces, steps, waterfalls, and beach/dock pieces, plus foliage and other props. Sample material values are flat shaded grass green `Kd 0.1333 0.5451 0.1333` and pale grey rock `Kd 0.6314 0.6235 0.6118`. The modular terrain geometry fills a category absent from the existing props, but the strong green/grey colors need review against the muted Omega Valley palette; the included tree, bush, rock, and beach contents overlap or do not fit the current valley. Do not place directly into the map without recoloring and scene-fit review. No runtime assets or coordinates were changed.

### Clothed NPC leads

| Pack | Verified source, free contents and license | Fit / status |
| --- | --- | --- |
| Low Poly 15th Century Ottoman Character Pack | [Plewr itch.io listing](https://plewr.itch.io/low-poly-15th-century-ottoman-character-pack), CC0 per creator statement; page says no generative AI. | Verified source archive `art-incoming/nidal-village-npcs/plewr-ottoman-glb-files.zip` (1,148,462 bytes; SHA-256 `C0CA6BCD8877D47E777ADCBFF6F74A92D16243ED91B06A5318EBCDA3B05AD9BB`); nine extracted GLBs copied to `public/models/ottoman-npcs/` (1,146,888 bytes total). Three.js GLTFLoader parsed all nine; Idle/Speak/Walk clips, 25,900 triangles total, rigid node animation, no SkinnedMesh. | Ready for scene integration review. Apparent heights 3.45–3.97 units vs existing worker GLBs 1.68–1.81; try scale 0.5 and verify feet, animation, interaction, and navigation before use. Staged in public only; no runtime references/behavior added. |
| Low Poly Villager Man | [3DAssets.dev asset page](https://3dassets.dev/assets/low-poly-character-figures-villager-man-bfcdf400): creator site states CC0 1.0, commercial use, no attribution; self-contained GLB; 60.4 KB; 1,221 triangles; +Y up, +Z forward, 1.76 m tall; plain tunic, belt and boots. | Immediately loadable static crowd figure; no rig, skinning, animation, collision, or navigation. The page reports AI generation (Claude Opus 5, contributor-reported), so treat provenance as a caveat and prefer the non-AI Ottoman pack if its archive can be inspected. No GLB downloaded or runtime change made. |
| LOWPO: Villager NPC – free tier | [Standout 7's itch.io listing](https://standout7.itch.io/villagernpc), CC0 1.0; page explicitly says no generative AI. Free archive `Villager NPC Free.zip` is 318 KB and contains Blacksmith, Hunter, Child, plus forging hammer, hunting knife, and small stick. Free subset is FBX only. The paid $3.99 archive is 5.8 MB and adds Farmer, Woodcutter, Elder, Merchant, Axe and Hoe; the listing reserves GLB/GLTF for the paid pack. | Best free range of human roles so far and the shared texture/rigged humanoid design may fit village crowd use. It has no baked animations; FBX would need conversion for the current Three.js GLB pipeline. Crucially, the advertised free archive is not GLB; do not mistake the paid GLB content for free-tier files. No files downloaded or runtime changes made. |

The terrain source remains review-only. The Ottoman character pack has since been downloaded, parsed, and promoted as nine GLBs under `public/models/ottoman-npcs/`; this only places files in the public asset directory and does not add runtime references or gameplay behavior.
