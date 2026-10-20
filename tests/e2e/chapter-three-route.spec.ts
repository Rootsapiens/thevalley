import { test, expect } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame, startPlay } from './helpers';

interface ChapterThreeState {
  chapterThree: { stage: number; climbing: boolean; deadline: number; uploadHold: number; uploaded: boolean; failed: boolean; seized: boolean };
  pos: { x: number; y: number; z: number };
  endingTitleVisible: boolean;
}

type Game = {
  state: () => ChapterThreeState;
  look: (yaw: number, pitch: number) => void;
  advance: (seconds: number) => void;
  npcs: () => { id: string; x: number; y: number; z: number }[];
  usables: () => { id: string; pos: { x: number; y: number; z: number }; open: number }[];
  useTarget: () => string | null;
  solidsAt: (x: number, z: number) => { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }[];
};

test('Chapter 3: walk to the priest, climb the tower, upload, and reach detention', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 640, height: 360 });
  const problems = watchPage(page);
  await waitForGame(page, '/?chapter=3');
  await startPlay(page);

  const walkTo = async (x: number, z: number, stopWhen?: (s: ChapterThreeState) => boolean) => {
    await page.keyboard.down('KeyW');
    let result: ChapterThreeState;
    try {
      result = await page.evaluate(({ x, z, stopForClimb }) => {
        const g = (window as unknown as { __game: Game }).__game;
        let s = g.state();
        for (let i = 0; i < 700; i++) {
          if (stopForClimb && s.chapterThree.climbing) break;
          if (Math.hypot(s.pos.x - x, s.pos.z - z) < 0.85) break;
          g.look(Math.atan2(-(x - s.pos.x), -(z - s.pos.z)), -0.03);
          g.advance(0.12);
          const next = g.state();
          if (Math.hypot(next.pos.x - s.pos.x, next.pos.z - s.pos.z) < 0.015 && i > 12) break;
          s = next;
        }
        return g.state();
      }, { x, z, stopForClimb: !!stopWhen });
    } finally { await page.keyboard.up('KeyW'); }
    const reached = stopWhen?.(result) ?? Math.hypot(result.pos.x - x, result.pos.z - z) < 1.0;
    if (!reached) {
      const boxes = await page.evaluate(({ x, z }) => (window as unknown as { __game: Game }).__game.solidsAt(x, z), result.pos);
      throw new Error(`blocked at ${JSON.stringify(result.pos)} before (${x}, ${z}); nearby boxes: ${JSON.stringify(boxes)}`);
    }
  };
  const openDoor = async (id: string) => {
    const position = await page.evaluate(id => (window as unknown as { __game: Game }).__game.usables().find(d => d.id === id)!.pos, id);
    const current = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state().pos);
    const eye = { x: current.x, y: current.y + 1.64, z: current.z };
    await page.evaluate(({ target, eye }) => {
      const g = (window as unknown as { __game: Game }).__game;
      const dx = target.x - eye.x, dy = target.y - eye.y, dz = target.z - eye.z;
      g.look(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
    }, { target: position, eye });
    await expect.poll(() => page.evaluate(() => (window as unknown as { __game: Game }).__game.useTarget()),
      { timeout: 10_000, intervals: [100, 250, 500] }).toBe(id); // wait for the normal prompt/render pass
    await page.keyboard.press('KeyE');
    await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(1));
    const open = await page.evaluate(id => (window as unknown as { __game: Game }).__game.usables().find(d => d.id === id)!.open, id);
    expect(open, `${id} did not open from the player E interaction`).toBeGreaterThan(0.98);
  };

  // Open both doors with E, as a player must; the chapter controller never teleports through closed doors.
  await walkTo(9.5, 36.5);
  await openDoor('door-church');
  await walkTo(9.5, 33.8);
  await walkTo(9.25, 33.8); // thread the narrow west-side gap beside the first pew row
  await walkTo(9.25, 30.75); // enter the central aisle before crossing the pew rows
  await walkTo(18.5, 30.75);
  await walkTo(18.5, 31.0);
  const priest = await page.evaluate(() => (window as unknown as { __game: Game }).__game.npcs().find(n => n.id === 'npc_priest')!);
  await page.evaluate(({ priest, pos }) => {
    const g = (window as unknown as { __game: Game }).__game;
    g.look(Math.atan2(-(priest.x - pos.x), -(priest.z - pos.z)), 0);
  }, { priest, pos: (await page.evaluate(() => (window as unknown as { __game: Game }).__game.state().pos)) });
  await page.keyboard.press('KeyE');
  let state = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state());
  expect(state.chapterThree.stage).toBe(1);

  await walkTo(18.5, 30.75);
  await walkTo(9.25, 30.75);
  await walkTo(9.25, 33.8);
  await walkTo(9.5, 36.5);
  await walkTo(2.5, 36.5); // go around the church exterior wall, not through the nave
  await walkTo(2.5, 31.5);
  await openDoor('door-tower');
  await walkTo(2.5, 31.2);
  await walkTo(2.5, 25.6, s => s.chapterThree.climbing); // pass the climb trigger before waypoint tolerance ends the walk
  state = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state());
  expect(state.chapterThree.climbing).toBe(true);

  await page.keyboard.down('KeyW');
  try { await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(18)); }
  finally { await page.keyboard.up('KeyW'); }
  state = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state());
  expect(state.chapterThree.stage).toBe(5);
  expect(state.pos.y).toBeGreaterThan(19.9);
  expect(state.chapterThree.deadline).toBeGreaterThan(200);

  // Releasing Use resets the hold but must leave the upload available until 05:10.
  await page.keyboard.down('KeyE');
  try { await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(8)); }
  finally { await page.keyboard.up('KeyE'); }
  await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(0.12));
  state = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state());
  expect(state.chapterThree.uploaded).toBe(false);
  expect(state.chapterThree.failed).toBe(false);
  expect(state.chapterThree.uploadHold).toBe(0);

  await page.keyboard.down('KeyE');
  try { await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(22)); }
  finally { await page.keyboard.up('KeyE'); }
  state = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state());
  expect(state.chapterThree.uploaded).toBe(true);
  expect(state.chapterThree.deadline).toBeGreaterThan(150);
  await expect(page.locator('#objective-en')).toContainText('agencies arrive at 05:10');

  await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(12));
  state = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state());
  expect(state.chapterThree.seized).toBe(false);
  expect(state.endingTitleVisible).toBe(false);
  const untilFiveTen = state.chapterThree.deadline;
  await page.evaluate(seconds => (window as unknown as { __game: Game }).__game.advance(seconds), untilFiveTen + 15);
  state = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state());
  expect(state.chapterThree.seized).toBe(true);
  expect(state.endingTitleVisible).toBe(true);
  await expectNoProblems(problems);
});
