import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const output = 'studio/stills/room-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const issues = [];
page.on('pageerror', e => issues.push(e.message));
page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) issues.push(`${r.status()} ${r.url()}`); });
await page.goto('http://127.0.0.1:4180/?chapter=1');
await page.waitForFunction(() => window.__game?.furniture().models > 0, null, { timeout: 90000, polling: 250 });
const rooms = await page.evaluate(async () => (await import('/src/villageMap.ts')).BUILDINGS
  .filter(b => b.hollow && ['house', 'school', 'cafe'].includes(b.kind))
  .map(b => ({ id: b.id, x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, floor: b.floor, door: b.doors[0] })));
await page.evaluate(() => window.__game.start());
for (const b of rooms) {
  const d = b.door;
  const [x, z, yaw] = d.face === 'n' ? [d.at, b.z0 + 1.8, Math.PI]
    : d.face === 's' ? [d.at, b.z1 - 1.8, 0]
      : d.face === 'e' ? [b.x1 - 1.8, d.at, Math.PI / 2]
        : [b.x0 + 1.8, d.at, -Math.PI / 2];
  await page.evaluate(({ x, z, y, yaw }) => { window.__game.teleport(x, y + 0.01, z); window.__game.look(yaw, -0.08); },
    { x, z, y: b.floor, yaw });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${output}/${b.id}.png`, timeout: 120000, animations: 'disabled' });
  console.log(`${b.id}: floor ${b.floor.toFixed(2)} at ${x.toFixed(1)}, ${z.toFixed(1)}`);
}
console.log(`rooms=${rooms.length} issues=${JSON.stringify(issues)}`);
await browser.close();
