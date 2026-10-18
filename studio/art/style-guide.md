# Omega Valley — Art Style Guide
Palette source of truth: `studio/art/palette.json`. Measured by `scripts/check-art.mjs`.

## Pillars
1. **Tired industrial, then wrong.** Late-90s desert dam: painted concrete, steel, hazard tape. The rupture adds one alien colour (teal) and nothing else.
2. **Readable at 640x360.** Big shapes, strong value steps, low-noise surfaces. Detail lives in silhouette, not grain.
3. **Light tells the story.** Orange = safe/human, red = alarm, teal = rupture/enemy. Never mix more than two in one frame.
4. **Original.** No Valve/Half-Life content or likeness (see game-brief section 1).

## Mood
Night shift, empty, humming. Cold desert night outside, warm tired lamps inside. Dread comes from scale (canyon, spillway) and from teal light that falls the wrong way.

## Lighting rules
- **Key (moon) direction:** cold moon from upper-left, canyon side, elevation ~55 deg. Shadows fall toward lower-right in every image. Moon colour is a pale `fogHaze`-tinted white, low intensity. No sun disc visible. Interior art uses the same upper-left bias for highlights.
- **Practicals:** sodium orange (`sodium`) from overhead caged lamps, pooling downward; emergency red (`emergencyRed`) wall-mounted, rim light only; rupture teal (`ruptureTeal`) emissive and volumetric, only from creatures and the rupture, never from fixtures.
- **Horizon:** flat, at 50% frame height in all canyon/skybox art. Canyon walls rise above it; no tilt.
- **Fog/sky:** `skyNight` at zenith to `fogHaze` at horizon.

## Palette tokens
| Token | Hex | Use |
|---|---|---|
| ink | #07090C | darkest UI/background |
| skyNight | #0B1220 | sky zenith |
| fogHaze | #2A3440 | fog, horizon |
| concrete | #8A8B86 | floors, spillway |
| concreteDark | #4A4C4B | wet/shadow concrete |
| wallPaint | #6F8277 | institutional wall green |
| metal | #5B6670 | steel, grating, panels |
| hazardYellow | #E8B820 | stripes, handrails |
| hazardBlack | #16181A | stripe black, vents |
| rust | #8C4A2A | pipes, corrosion |
| sodium | #FF9A3C | warm practical light |
| emergencyRed | #D62828 | alarm light |
| ruptureTeal | #2FE0C8 | rupture, Drifter, Shard |
| hudAmber | #FFB000 | HUD text/icons |

HUD text: `hudAmber` on `ink` or `skyNight` only. Body >= 4.5:1, large >= 3:1.

## Texture rules
- 1024x1024, seamless on both axes, sRGB PNG, no alpha.
- Low noise, soft local contrast; no feature larger than 1/4 of the tile (repetition shows otherwise).
- Flat even lighting baked in: no directional shadows, no vignette, no lens effects.
- No text, numbers, logos, watermarks. Hazard stripes at 45 deg, 8 stripes per tile.
- Top-down orthographic unless the prompt says otherwise.
- Average colour within CIE76 dE 25 of a palette token. Record the worst image.

## ChatGPT faults checklist (tick for every image)
- [ ] **Stray text**: letters, numbers, signatures, fake logos, tiny panel labels.
- [ ] **Wrong hands**: extra/missing fingers, mirrored grip. Viewmodel: exactly 5 fingers per visible hand, right hand on the grip.
- [ ] **Horizon drift**: horizon not at 50% height, tilted, or different between canyon images.
- [ ] **Lighting mismatch**: key not from upper-left, shadows falling left, visible sun, warm light outside where cold is required.
- [ ] **Non-tileable seams**: offset 50% on both axes; no visible seam, no repeated hero blemish.
- [ ] **Palette drift**: `check-art.mjs` dE within limit.
- [ ] **Likeness**: nothing resembling Valve/Half-Life designs (orange hazard suit, lambda, crowbar, headcrab shapes).
- [ ] **Transparency**: real alpha, no baked checkerboard, no halo (semi-transparent edge pixels <= 2%).
- [ ] **Size/aspect** exactly as stated; save uncropped to `art-incoming/`.
