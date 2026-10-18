import { test, expect } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame } from './helpers';

// Shader warm-up guard (studio/reports/rajaie-village-textures.md): every village program (the vBake patch) links in
// the compileAsync warm-up, none after the first frame starts. A texture set bound after the warm-up relinks its
// program inside the game loop and shows up here. The shadow depth program is outside compileAsync and not checked.
test('village: no village program links after the first frame', async ({ page }) => {
  const problems = watchPage(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __late: string[]; __raf0: number | null };
    w.__late = []; w.__raf0 = null;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(t => { if (w.__raf0 === null) w.__raf0 = performance.now(); cb(t); });
    for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
      const link = C.prototype.linkProgram;
      C.prototype.linkProgram = function (this: WebGLRenderingContext, p: WebGLProgram) {
        if (w.__raf0 !== null) {
          const src = (this.getAttachedShaders(p) ?? []).map(s => this.getShaderSource(s)).join('\n');
          if (src.includes('vBake')) w.__late.push(`${Math.round(performance.now() - w.__raf0)} ms${/#define USE_MAP\b/.test(src) ? ' USE_MAP' : ''}`);
        }
        link.call(this, p);
      };
    }
  });
  await waitForGame(page, '/');
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __late: string[]; __game: { info: () => { buckets: Record<string, number> } } };
    return { late: w.__late, msTex: w.__game.info().buckets['ms:tex'] };
  });
  expect(r.late, `village programs linked after frame 1 starts (texture wait ${r.msTex} ms)`).toEqual([]);
  expect(r.msTex, 'texture wait hit the 4 s timeout').toBeLessThan(4000);
  await expectNoProblems(problems);
});
