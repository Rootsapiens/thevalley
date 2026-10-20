import { describe, expect, it } from 'vitest';
import { NPC_MODEL_BY_ID, npcAnimationName, npcModelScale } from '../src/npcFigures';

describe('villager GLB role mapping and presentation', () => {
  it('uses fitting CC0 figures for farmer, priest, and anonymous square villagers', () => {
    expect(NPC_MODEL_BY_ID).toEqual({
      npc_farmer: 'poor.glb',
      npc_priest: 'clergyman.glb',
      npc_square_villager_1: 'guy.glb',
      npc_square_villager_2: 'lady.glb',
      npc_square_villager_3: 'woman.glb',
      npc_square_villager_4: 'a-normal-guy-with-dark-skin.glb',
    });
    expect(Object.values(NPC_MODEL_BY_ID)).not.toContain('fake_trader.glb');
    expect(Object.values(NPC_MODEL_BY_ID)).not.toContain('trader.glb');
    expect(Object.values(NPC_MODEL_BY_ID)).not.toContain('vezir.glb');
  });

  it('fits the pack’s reported 3.45–3.97 unit bounds to authored human heights, starting from 0.5 scale', () => {
    for (const [reportedHeight, targetHeight] of [[3.45, 1.76], [3.7, 1.74], [3.97, 1.75]]) {
      const scale = npcModelScale(reportedHeight, targetHeight);
      expect(scale).toBeCloseTo(0.5 * targetHeight / (reportedHeight * 0.5), 8);
      expect(reportedHeight * scale).toBeCloseTo(targetHeight, 8);
    }
    expect(npcModelScale(0, 1.75)).toBe(0.5);
  });

  it('selects Walk while moving, Speak while talking, otherwise Idle', () => {
    expect(npcAnimationName(0, false)).toBe('Idle');
    expect(npcAnimationName(0, true)).toBe('Speak');
    expect(npcAnimationName(0.08, true)).toBe('Speak');
    expect(npcAnimationName(0.081, true)).toBe('Walk');
  });
});
