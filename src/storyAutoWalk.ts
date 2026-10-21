/** A bounded ground route for the optional Madsina walking aid. It never performs story actions. */
export type WalkPoint = { x: number; z: number };

export function planStoryWalk(start: WalkPoint, goal: WalkPoint, stopRadius: number,
                              clear: (x: number, z: number) => boolean,
                              ground: (x: number, z: number) => number): WalkPoint[] | null {
  const cell = 1, padding = 18;
  const minX = Math.floor(Math.min(start.x, goal.x) - padding);
  const minZ = Math.floor(Math.min(start.z, goal.z) - padding);
  const width = Math.ceil(Math.max(start.x, goal.x) + padding - minX) + 1;
  const depth = Math.ceil(Math.max(start.z, goal.z) + padding - minZ) + 1;
  if (width * depth > 60000) return null;
  const count = width * depth, costs = new Float32Array(count), parents = new Int32Array(count);
  const closed = new Uint8Array(count), pass = new Uint8Array(count);
  costs.fill(Infinity); parents.fill(-1);
  const index = (x: number, z: number) => z * width + x;
  const point = (i: number): WalkPoint => ({ x: minX + i % width * cell, z: minZ + Math.floor(i / width) * cell });
  const sx = Math.round(start.x - minX), sz = Math.round(start.z - minZ), first = index(sx, sz);
  const open: { i: number; score: number }[] = [];
  const put = (i: number, score: number) => {
    open.push({ i, score });
    for (let n = open.length - 1; n > 0;) {
      const p = (n - 1) >> 1;
      if (open[p].score <= open[n].score) break;
      [open[p], open[n]] = [open[n], open[p]]; n = p;
    }
  };
  const take = () => {
    const top = open[0], tail = open.pop()!;
    if (open.length) {
      open[0] = tail;
      for (let n = 0;;) {
        let c = n * 2 + 1;
        if (c >= open.length) break;
        if (c + 1 < open.length && open[c + 1].score < open[c].score) c++;
        if (open[n].score <= open[c].score) break;
        [open[n], open[c]] = [open[c], open[n]]; n = c;
      }
    }
    return top;
  };
  const walkable = (i: number) => {
    if (!pass[i]) { const p = point(i); pass[i] = clear(p.x, p.z) ? 1 : 2; }
    return pass[i] === 1;
  };
  costs[first] = 0; put(first, Math.hypot(start.x - goal.x, start.z - goal.z));
  let expanded = 0;
  while (open.length && expanded++ < 14000) {
    const current = take().i;
    if (closed[current]) continue;
    closed[current] = 1;
    const p = point(current);
    if (Math.hypot(p.x - goal.x, p.z - goal.z) <= stopRadius) {
      const route: WalkPoint[] = [];
      for (let at = current; at !== first && at >= 0; at = parents[at]) route.push(point(at));
      route.reverse();
      return route;
    }
    const ix = current % width, iz = Math.floor(current / width), y = ground(p.x, p.z);
    for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = ix + dx, nz = iz + dz;
      if (nx < 0 || nz < 0 || nx >= width || nz >= depth) continue;
      const next = index(nx, nz);
      if (closed[next] || !walkable(next)) continue;
      const np = point(next), ny = ground(np.x, np.z);
      if (!Number.isFinite(ny) || Math.abs(ny - y) > 0.78) continue;
      const cost = costs[current] + 1 + Math.abs(ny - y) * 0.5;
      if (cost >= costs[next]) continue;
      costs[next] = cost; parents[next] = current;
      put(next, cost + Math.hypot(np.x - goal.x, np.z - goal.z));
    }
  }
  return null;
}
