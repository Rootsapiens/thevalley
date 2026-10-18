// Village PBR texture manifest. Made by scripts/blender/village_textures.py, encoded to public/art by encode-art.mjs.
// Files: public/art/<name>.jpg (albedo), <name>_normal.jpg (green down, see NORMAL_Y) and <name>_rough.jpg only where flagged.
// base = albedo mean the village palette expects (studio/art/prompts/village-textures.md): the linear-light mean, as sRGB hex.
/** Green direction of the shipped normal maps: -1 = green points down the image (DirectX style). village_textures.py
 *  flips rows and then saves through Blender's bottom-up pixel buffer, so every map lands upside down. Materials put
 *  this in normalScale.y; tests/villageTextures.test.ts measures it. Set 1 if the maps are re-baked green-up. */
export const NORMAL_Y = -1;
export const VILLAGE_TEX = {
  'dirt-road': { base: '#4B352D', normal: true, rough: true },
  'grass-dry': { base: '#6A5C46', normal: false, rough: false },
  'wood-planks-barn': { base: '#7D685F', normal: true, rough: false },
  'roof-tiles-red': { base: '#973B24', normal: true, rough: false },
  'stone-wall': { base: '#98897E', normal: true, rough: false },
  'hay': { base: '#B1805F', normal: false, rough: false },
  'fence-wood': { base: '#6E3B25', normal: false, rough: false },
} as const satisfies Record<string, { base: string; normal: boolean; rough: boolean }>;
export type VillageTexName = keyof typeof VILLAGE_TEX;
