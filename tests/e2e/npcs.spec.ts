import { test, expect, type Page } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame, startPlay } from './helpers';
import { NPCS, type NpcId } from '../../src/npcData';
import { CAST } from '../../src/npcTalk';

// Build step 2 end to end: talk to three NPCs with the real E key (their lines in order, AR over EN, under the
// speaker's role), then film one with the real right mouse button (REC, the shot logged, the battery drawn down).
// Positioning uses window.__game (teleport/look). Small viewport: software GL is slow and dt is capped per frame.
test.use({ viewport: { width: 320, height: 180 } });

interface NState { npc: string | null; talked: { npc: string; line: string }[]; film: { rec: boolean; battery: number; log: { npc: string; line: string | null }[] } }
interface Npc { id: string; x: number; y: number; z: number; seated: boolean }
const st = (page: Page) => page.evaluate(() => (window as unknown as { __game: { state: () => NState } }).__game.state());

type G = { npcs: () => Npc[]; teleport: (x: number, y: number, z: number) => void; ground: (x: number, z: number) => number; look: (y: number, p: number) => void };
/** Stands at (x, z) on the ground and aims at the NPC's chest until the talk prompt targets it. */
async function face(page: Page, id: NpcId, x: number, z: number) {
  await page.evaluate(([x, z]) => { const g = (window as unknown as { __game: G }).__game; g.teleport(x, g.ground(x, z) + 0.01, z); }, [x, z] as const);
  let seen = false;
  for (let k = 0; k < 60 && !seen; k++) {
    await page.evaluate(([id, x, z]) => {
      const g = (window as unknown as { __game: G }).__game, a = g.npcs().find(n => n.id === id)!, fy = g.ground(x, z);
      const dx = a.x - x, dz = a.z - z, cy = a.y + (a.seated ? 0.9 : 1.3);
      g.look(Math.atan2(-dx, -dz), Math.atan2(cy - (fy + 1.64), Math.hypot(dx, dz)));
    }, [id, x, z] as const);
    await page.waitForTimeout(100);
    seen = (await st(page)).npc === id;
  }
  expect(seen, `talk prompt on ${id}`).toBe(true);
  await expect(page.locator('#prompt-en')).toHaveText(CAST[id].label.en);
}

/** Presses the real E key and checks the subtitle: the NPC's next line (AR and EN) under its role. */
async function talk(page: Page, id: NpcId, lineId: string) {
  const t = NPCS[id].triggers.find(l => l.id === lineId)!;
  await page.keyboard.press('KeyE');
  await expect(page.locator('#sub-en')).toHaveText(t.line);
  await expect(page.locator('#sub-ar')).toHaveText(t.ar);
  await expect(page.locator('#sub-who-en')).toHaveText(CAST[id].label.en);
  await expect(page.locator('#sub-who-ar')).toHaveText(CAST[id].label.ar);
  expect((await st(page)).talked.at(-1)).toMatchObject({ npc: id, line: lineId });
}

test('NPCs: talk to three with E (lines in order), film one with RMB', async ({ page }) => {
  test.setTimeout(300_000);
  const problems = watchPage(page);
  await waitForGame(page, '/');
  await startPlay(page);

  // The priest at the altar, from the aisle: his canon line first, then the ladder.
  await face(page, 'npc_priest', 18.6, 30.75);
  await talk(page, 'npc_priest', 'priest_altar');
  await talk(page, 'npc_priest', 'priest_ladder');
  // A villager on the square: the Ravens, then (Omar is at the post) the question about him, then that again.
  await face(page, 'npc_square_villager_1', 19, 44);
  await talk(page, 'npc_square_villager_1', 'npc_square_villager_1_animals');
  await talk(page, 'npc_square_villager_1', 'npc_square_villager_1_omar');
  await talk(page, 'npc_square_villager_1', 'npc_square_villager_1_omar');
  // The officer by the police car.
  await face(page, 'npc_officer_1', -3.4, 44.2);
  await talk(page, 'npc_officer_1', 'officer_1_car');

  // Film him: hold the real right button with him in frame; the camera records, logs the shot, then stands by again.
  await expect(page.locator('#rec-label')).toHaveText('STBY');
  await page.mouse.move(160, 90);
  await page.mouse.down({ button: 'right' });
  await expect(page.locator('#rec')).toHaveClass(/live/);
  await expect(page.locator('#rec-label')).toHaveText('REC');
  await expect.poll(async () => (await st(page)).film.log.map(e => e.npc), { timeout: 90_000, intervals: [250] }).toContain('npc_officer_1');
  await page.mouse.up({ button: 'right' });
  await expect(page.locator('#rec-label')).toHaveText('STBY');
  const s = await st(page);
  expect(s.film.rec).toBe(false);
  expect(s.film.battery).toBeLessThan(1);
  expect(s.film.battery).toBeGreaterThan(0.9);

  await expectNoProblems(problems);
});
