import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('studio/stills/root-review', { recursive: true });
const browser = await chromium.launch({ headless: true, args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const issues = [];
page.on('pageerror', e => issues.push(e.message));
await page.goto('http://127.0.0.1:4180/?prologue=1');
await page.waitForFunction(() => !!window.__game, null, { timeout: 90000, polling: 250 });
const at = await page.evaluate(async () => {
  const { TRAIL_END } = await import('/src/villageMap.ts');
  const g = window.__game;
  const x = (TRAIL_END.x0 + TRAIL_END.x1) / 2, z = (TRAIL_END.z0 + TRAIL_END.z1) / 2;
  g.start(); g.teleport(x, g.ground(x, z) + 0.01, z); g.look(0, -0.02);
  g.advance(0.05);
  return { x, z, state: g.state().prologue };
});
for (const t of [0.8, 1.5, 2.4]) {
  await page.evaluate(seconds => window.__game.advance(seconds), t === 0.8 ? 0.75 : t === 1.5 ? 0.7 : 0.9);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `studio/stills/root-review/roots-${t}.png`, timeout: 120000 });
}
console.log(JSON.stringify({ at, issues }));
await browser.close();
