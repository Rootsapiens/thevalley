// Bot navigation: a waypoint graph laid over the walkable part of the play area. Nodes sit on a coarse grid wherever a
// player-sized circle is clear of solids; two neighbouring nodes are linked only if every sample along the segment is
// clear too, so following the path never rubs a wall. Pure (no DOM, no Three.js).
import { TUNING, type Box } from '../physics';

export interface Pt { x: number; z: number }
export interface Nav { nodes: Pt[]; adj: number[][] }
export interface Area { x0: number; x1: number; z0: number; z1: number }

const CLEAR = 0.6;   // body radius .35 plus a margin

/** True when a body standing at (x, z) is not inside anything it cannot step over or duck under. */
export function isFree(solids: Box[], ground: (x: number, z: number) => number, x: number, z: number, clear = CLEAR): boolean {
  const g = ground(x, z);
  for (const b of solids) {
    if (b.max.y <= g + TUNING.stepHeight || b.min.y >= g + TUNING.standHeight) continue;
    if (x > b.min.x - clear && x < b.max.x + clear && z > b.min.z - clear && z < b.max.z + clear) return false;
  }
  return true;
}

function segmentFree(solids: Box[], ground: (x: number, z: number) => number, a: Pt, b: Pt): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / 0.4));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!isFree(solids, ground, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.5)) return false;
  }
  return true;
}

export function buildNav(solids: Box[], ground: (x: number, z: number) => number, area: Area, spacing = 3): Nav {
  const nodes: Pt[] = [], index = new Map<string, number>();
  const nx = Math.floor((area.x1 - area.x0) / spacing), nz = Math.floor((area.z1 - area.z0) / spacing);
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const p = { x: area.x0 + 1.5 + i * spacing, z: area.z0 + 1.5 + j * spacing };
    if (p.x > area.x1 - 1 || p.z > area.z1 - 1) continue;
    if (isFree(solids, ground, p.x, p.z)) { index.set(i + ',' + j, nodes.length); nodes.push(p); }
  }
  const adj: number[][] = nodes.map(() => []);
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const a = index.get(i + ',' + j);
    if (a === undefined) continue;
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const b = index.get((i + di) + ',' + (j + dj));
      if (b === undefined) continue;
      if (segmentFree(solids, ground, nodes[a], nodes[b])) { adj[a].push(b); adj[b].push(a); }
    }
  }
  return { nodes, adj };
}

export function nearestNode(nav: Nav, p: Pt): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < nav.nodes.length; i++) {
    const d = (nav.nodes[i].x - p.x) ** 2 + (nav.nodes[i].z - p.z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** A* over the graph. Returns waypoints from the node nearest `from` to the node nearest `to`, or null if unreachable. */
export function findPath(nav: Nav, from: Pt, to: Pt): Pt[] | null {
  const s = nearestNode(nav, from), g = nearestNode(nav, to);
  if (s < 0 || g < 0) return null;
  const h = (i: number) => Math.hypot(nav.nodes[i].x - nav.nodes[g].x, nav.nodes[i].z - nav.nodes[g].z);
  const cost = new Map<number, number>([[s, 0]]), prev = new Map<number, number>(), open = new Set<number>([s]), done = new Set<number>();
  while (open.size) {
    let cur = -1, bf = Infinity;
    for (const i of open) { const f = cost.get(i)! + h(i); if (f < bf) { bf = f; cur = i; } }
    if (cur === g) {
      const out: Pt[] = [];
      for (let n: number | undefined = g; n !== undefined; n = prev.get(n)) out.push(nav.nodes[n]);
      return out.reverse();
    }
    open.delete(cur); done.add(cur);
    for (const nb of nav.adj[cur]) {
      if (done.has(nb)) continue;
      const c = cost.get(cur)! + Math.hypot(nav.nodes[nb].x - nav.nodes[cur].x, nav.nodes[nb].z - nav.nodes[cur].z);
      if (c < (cost.get(nb) ?? Infinity)) { cost.set(nb, c); prev.set(nb, cur); open.add(nb); }
    }
  }
  return null;
}
