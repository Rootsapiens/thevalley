import { expect, type Page, type ConsoleMessage, type Request, type Response } from '@playwright/test';

// Shape of the window.__game test hook (src/main.ts). Only read-side fields are typed here.
export interface GameState {
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  health: number;
  crouched: boolean;
  onGround: boolean;
  weapon: 'wrench' | 'nailer';
  hasNailer: boolean;
  mag: number;
  reserve: number;
  storyTime: number;
  kills: number;
  facility: { breakers: boolean[]; doorOpen: boolean; fired: string[]; finished: boolean };
  enemies: { id: number; kind: string; pos: { x: number; y: number; z: number }; health: number; mode: string }[];
}

// Known, accepted console noise. Anything else fails the test.
const ALLOWED_CONSOLE: RegExp[] = [
  // Headless Chromium cannot grant pointer lock; main.ts falls back to drag-to-look.
  /SecurityError[\s\S]*pointer ?lock|pointer ?lock[\s\S]*SecurityError|requestPointerLock/i,
  // SwiftShader (playwright.config.ts) never exposes KHR_parallel_shader_compile, so three's compileAsync warns once and
  // polls instead; the real GPU exposes it. Environment noise, not a game fault.
  /^THREE\.WebGLRenderer: KHR_parallel_shader_compile extension not supported\.$/,
];

/**
 * Subscribes to console (error and warning), pageerror and requestfailed, plus HTTP >= 400 responses.
 * Returns a live array; the caller asserts it is empty at the end of the test.
 */
export function watchPage(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return;
    const text = msg.text();
    const loc = msg.location().url;
    if (/favicon\.ico$/.test(loc) && /404|Not Found/.test(text)) return; // index.html ships no favicon
    if (ALLOWED_CONSOLE.some(r => r.test(text))) return;
    problems.push(`console.${msg.type()}: ${text}${loc ? ` (${loc})` : ''}`);
  });
  page.on('pageerror', err => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req: Request) =>
    problems.push(`requestfailed: ${req.method()} ${req.url()} ${req.failure()?.errorText ?? ''}`));
  page.on('response', (res: Response) => {
    if (res.status() >= 400 && !/favicon\.ico$/.test(res.url())) problems.push(`http ${res.status()}: ${res.url()}`);
  });
  return problems;
}

export async function expectNoProblems(problems: string[]): Promise<void> {
  expect(problems, problems.join('\n')).toEqual([]);
}

export async function waitForGame(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  // polling: 'raf' stalls under software GL, so poll on a timer instead.
  await page.waitForFunction(() => typeof (window as unknown as { __game?: unknown }).__game === 'object', undefined, { polling: 200, timeout: 60_000 });
  await expect(page.locator('#app canvas')).toBeVisible();
}

export async function readState(page: Page): Promise<GameState> {
  return page.evaluate(() => (window as unknown as { __game: { state: () => unknown } }).__game.state()) as Promise<GameState>;
}

/** Real mouse click at the viewport centre: starts play (overlay) or fires, depending on state. */
export async function clickCentre(page: Page): Promise<void> {
  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width / 2, vp.height / 2);
}

export async function startPlay(page: Page): Promise<void> {
  await clickCentre(page);
  await expect(page.locator('#overlay')).toBeHidden();
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// Last mouse position per page. Under pointer lock every mouse move changes the view, so the
// cursor is never moved back without a button held; the closed loop corrects any residual.
const mousePos = new WeakMap<Page, { x: number; y: number }>();

/**
 * Aims the view at yaw/pitch with real right-button drags on the canvas. Right drag does not fire
 * (only button 0 fires). Closed loop on state().yaw and state().pitch.
 * Mouse conventions (src/main.ts): yaw -= movementX*0.0022, pitch -= movementY*0.0022.
 */
export async function lookTo(page: Page, yaw: number, pitch = 0, tol = 0.02): Promise<void> {
  const vp = page.viewportSize()!;
  const cx = vp.width / 2, cy = vp.height / 2;
  for (let i = 0; i < 80; i++) {
    const s = await readState(page);
    const dYaw = wrap(yaw - s.yaw), dPitch = pitch - s.pitch;
    if (Math.abs(dYaw) < tol && Math.abs(dPitch) < tol) return;
    const from = mousePos.get(page) ?? { x: cx, y: cy };
    const px = Math.max(-400, Math.min(400, -dYaw / 0.0022));
    const py = Math.max(-300, Math.min(300, -dPitch / 0.0022));
    // Under pointer lock, moves past the viewport edge still deliver movementX/Y (verified), so the
    // cursor is never recentred. That keeps every drag a pure view change.
    const toX = from.x + px, toY = from.y + py;
    await page.mouse.move(from.x, from.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(toX, toY, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    mousePos.set(page, { x: toX, y: toY });
  }
  const s = await readState(page);
  const dom = await page.evaluate(() => ({
    pointerLocked: !!document.pointerLockElement,
    overlay: getComputedStyle(document.getElementById('overlay')!).display,
  }));
  throw new Error(
    `lookTo: target yaw ${yaw.toFixed(3)} pitch ${pitch.toFixed(3)}, stuck at yaw ${s.yaw.toFixed(3)} pitch ${s.pitch.toFixed(3)} ` +
    `(pointerLocked=${dom.pointerLocked}, overlay=${dom.overlay}, mouse=${JSON.stringify(mousePos.get(page))})`,
  );
}

/** Aims the view at a world point from the player's eye (closed-loop yaw and pitch). */
export async function aimAt(page: Page, t: { x: number; y: number; z: number }): Promise<void> {
  const s = await readState(page);
  const eyeY = s.pos.y + (s.crouched ? 1.0 : 1.8) - 0.16;
  const dx = t.x - s.pos.x, dy = t.y - eyeY, dz = t.z - s.pos.z;
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  await lookTo(page, yaw, pitch);
}

const dist2 = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Fights living enemies within `range` metres with real clicks. Uses the nail driver when held,
 * the wrench otherwise. Each target is aimed once (closed loop), then fired in a burst at the weapon
 * cooldown, re-reading state between shots, so the bot reacts within a shot instead of re-aiming each time.
 * Returns the number of shots fired when no living enemy is in range or the budget is spent.
 */
export async function engageNearby(page: Page, range = 14, budgetMs = 40_000): Promise<number> {
  const deadline = Date.now() + budgetMs;
  let shots = 0;
  for (;;) {
    let s = await readState(page);
    if (s.health <= 0) throw new Error('player died during engagement');
    const alive = s.enemies.filter(e => e.mode !== 'dead' && dist2(e.pos, s.pos) <= range);
    if (alive.length === 0 || Date.now() > deadline) return shots;
    if (s.hasNailer && s.weapon !== 'nailer') await page.keyboard.press('Digit2');
    if (s.hasNailer && s.mag === 0) { await page.keyboard.press('KeyR'); await page.waitForTimeout(1600); continue; }
    const target = alive.reduce((a, b) => (dist2(a.pos, s.pos) <= dist2(b.pos, s.pos) ? a : b));

    // Burst: fire while the same target lives and we are alive.
    for (let burst = 0; burst < 6; burst++) {
      // Re-aim before every shot: at close range a drifter moves enough to make a stale aim miss.
      const cur = (await readState(page)).enemies.find(e => e.id === target.id);
      if (!cur || cur.mode === 'dead') break;
      await aimAt(page, { x: cur.pos.x, y: cur.pos.y, z: cur.pos.z });
      await clickCentre(page);
      shots++;
      await page.waitForTimeout(150);
      s = await readState(page);
      const t = s.enemies.find(e => e.id === target.id);
      console.log(`FIGHT target=${target.id} shot=${shots} me=${s.health} mag=${s.mag} enemies=${s.enemies.filter(e => e.mode !== "dead").map(e => `${e.id}:${e.kind}:${e.mode}:${e.health}@${dist2(e.pos, s.pos).toFixed(1)}`).join(" ")} pos=(${s.pos.x.toFixed(1)},${s.pos.z.toFixed(1)})`);
      if (s.health <= 0 || !t || t.mode === 'dead') break;
      if (s.weapon === 'nailer' && s.mag === 0) break;
    }
  }
}

/** Frame-time percentile from rAF intervals returned by __game.frameTimes(). */
export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

/** Fights if a living enemy is within 14 m. Used before any non-walking action (look, use). */
export async function engageIfThreat(page: Page): Promise<void> {
  const s = await readState(page);
  if (s.enemies.some(e => e.mode !== 'dead' && dist2(e.pos, s.pos) <= 14)) await engageNearby(page);
}

export interface Waypoint {
  x: number;
  z: number;
  /** Arrival radius in metres (xz). Default 0.6. */
  tol?: number;
  /** Ends this waypoint early, e.g. once a trigger has fired. */
  until?: (s: GameState) => boolean;
}

/**
 * Walks a list of xz waypoints with real W presses. Heading is closed-loop: when the view is more than
 * 0.3 rad off the bearing to the waypoint, W is released and the view is turned with real drags first.
 * Poll latency under software GL can stall for ~1 s (about 6 m of run), so every waypoint re-plans from the
 * measured position instead of assuming a fixed overshoot. Threats within 14 m are fought first.
 */
export async function walkPath(page: Page, points: Waypoint[], timeoutMs = 90_000): Promise<void> {
  for (const wp of points) {
    const deadline = Date.now() + timeoutMs;
    let down = false, walk = false;
    try {
      for (;;) {
        const s = await readState(page);
        if (s.health <= 0) throw new Error(`player died walking to (${wp.x}, ${wp.z}) from (${s.pos.x.toFixed(2)}, ${s.pos.z.toFixed(2)})`);
        if (wp.until?.(s)) break; // next waypoint (break, not return: return would skip the rest of the path)
        const dx = wp.x - s.pos.x, dz = wp.z - s.pos.z;
        if (Math.hypot(dx, dz) <= (wp.tol ?? 0.6)) break;
        if (Date.now() > deadline) throw new Error(`walkPath timed out heading to (${wp.x}, ${wp.z}) at (${s.pos.x.toFixed(2)}, ${s.pos.y.toFixed(2)}, ${s.pos.z.toFixed(2)})`);
        if (s.enemies.some(e => e.mode !== 'dead' && dist2(e.pos, s.pos) <= 14)) {
          if (down) { await page.keyboard.up('KeyW'); down = false; }
          await engageNearby(page);
          continue;
        }
        const desired = Math.atan2(-dx, -dz);
        if (Math.abs(wrap(desired - s.yaw)) > 0.3) {
          if (down) { await page.keyboard.up('KeyW'); down = false; }
          await lookTo(page, desired, 0);
          continue;
        }
        // Close in: release W and let the player stop, then re-plan from the measured position.
        if (Math.hypot(dx, dz) <= 0.6 && Math.hypot(s.vel.x, s.vel.z) > 0.25) {
          if (down) { await page.keyboard.up('KeyW'); down = false; }
          await settle(page);
          continue;
        }
        // Within 2 m of the target, walk (Shift, 3 m/s) instead of run (6 m/s): coasting after W is released is about v/friction.
        if (!walk && Math.hypot(dx, dz) < 2.0) { await page.keyboard.down('ShiftLeft'); walk = true; }
        if (!down) { await page.keyboard.down('KeyW'); down = true; }
        await page.waitForTimeout(40);
      }
    } finally {
      if (down) await page.keyboard.up('KeyW');
      if (walk) await page.keyboard.up('ShiftLeft');
    }
  }
}

/** Turns to face a yaw, after a threat check. Used before pressing E. */
export async function face(page: Page, yaw: number): Promise<void> {
  await settle(page);
  await engageIfThreat(page);
  await lookTo(page, yaw, 0);
}

/** Waits until the player has stopped (horizontal speed < 0.25 m/s), so E is pressed from where we stand. */
export async function settle(page: Page, maxMs = 3000): Promise<void> {
  const deadline = Date.now() + maxMs;
  for (;;) {
    const s = await readState(page);
    if (Math.hypot(s.vel.x, s.vel.z) < 0.25 || Date.now() > deadline) return;
    await page.waitForTimeout(40);
  }
}
