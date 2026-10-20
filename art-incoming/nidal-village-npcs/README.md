# Plewr Ottoman NPC candidate — Omega Valley

## Source and license

- Source: https://plewr.itch.io/low-poly-15th-century-ottoman-character-pack
- Creator: Plewr
- License: CC0 1.0, per the creator's itch.io description (free to use). The listing says no generative AI was used.
- Source archive: `plewr-ottoman-glb-files.zip` (1,148,462 bytes)
- SHA-256: `C0CA6BCD8877D47E777ADCBFF6F74A92D16243ED91B06A5318EBCDA3B05AD9BB`
- Downloaded file set: `GLB_FILES.zip` (listing says 1 MB). No account, purchase, or paid file used.

## Included files and inspection

The archive contains nine self-contained GLBs in `plewr-ottoman-glb-files/`: `a-normal-guy-with-dark-skin.glb`, `clergyman.glb`, `fake_trader.glb`, `guy.glb`, `lady.glb`, `poor.glb`, `trader.glb`, `vezir.glb`, and `woman.glb`.

Parsed all nine using the project's Three.js GLTFLoader. Together they are 1,146,888 bytes and about 25,900 triangles. Each GLB has three clips named `Idle`, `Speak`, and `Walk` (2.58, 2.58, and 2.79 seconds; 24 animation tracks each). Models are animated with rigid node transforms; inspection found no `SkinnedMesh`. They are therefore animated but do not expose a conventional skinned humanoid skeleton for retargeting.

## Fit and integration notes

These are low-poly, historical-costume characters and visually fit the setting better than generic modern office characters. Suggested initial role matches for review: `clergyman` → priest, `poor` → farmer/country resident, `lady`/`woman` → village women, `trader`/`fake_trader` → market roles; the remaining male variants can diversify villagers. These are visual suggestions only; they do not assign story names or canon identities.

Three.js world-space bounds measured from the imported GLBs show floor origins near Y=0, but apparent heights are about 3.45–3.97 game units. Existing project worker models are about 1.68–1.81 units. Start visual integration at scale 0.5 and check feet, capsule height, talk distance, interaction, and navmesh against the real scene. Bounds vary by outfit, so verify each role. Clips parse, but no in-game animation playback or placement test has been done.

## Preparation and limitations

- Files retained in their original GLB format; no conversion or edits applied.
- Web runtime use needs no format conversion; reference each GLB through `GLTFLoader` and scale/animate through `AnimationMixer`.
- Keep archive and this source/license record with the project if promoting any file into `public/models/characters/`.
- These assets are staged only under `art-incoming/nidal-village-npcs/`; no runtime source, credits, or shared manifest was modified.