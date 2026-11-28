// src/domain/loss/oracle.ts
import type { CompiledLandscape, Minimum, Vec2 } from "./landscape";

/**
 * The Oracle: shortest walkable route across the terrain from a start point to the
 * GLOBAL minimum, computed with full knowledge of the map (A* on a height grid).
 *
 * PEDAGOGY: This is what an optimiser does NOT have. Gradient descent sees one slope at
 * one point; the Oracle sees everything and may climb a ridge because the far side is
 * deeper. Showing it only after a run makes the gap visible: greedy-local vs global.
 *
 * Why A* and not a navmesh (Recast): Recast approximates arbitrary level geometry for
 * agents with radius and step height. This terrain is an exact function on a grid, so
 * A* over that grid is exact, deterministic, dependency-free and testable.
 */

export interface OracleResult {
  points: Vec2[];
  /** Surface length in world units. */
  length: number;
  target: Minimum;
}

export interface OracleOpts {
  n?: number;
  worldPerTheta?: number;
  worldPerLoss?: number;
}

const NEIGHBOURS: readonly [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Minimal binary min-heap keyed on f-score. */
class Heap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, key: number) {
    this.ids.push(id);
    this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p]! <= this.keys[i]!) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.ids[0]!;
    const lastId = this.ids.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.ids.length && this.keys[l]! < this.keys[m]!) m = l;
        if (r < this.ids.length && this.keys[r]! < this.keys[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b]!, this.ids[a]!];
    [this.keys[a], this.keys[b]] = [this.keys[b]!, this.keys[a]!];
  }
}

export function oraclePath(L: CompiledLandscape, start: Vec2, opts: OracleOpts = {}): OracleResult {
  const n = opts.n ?? 120;
  const sxy = opts.worldPerTheta ?? 3;
  const sy = opts.worldPerLoss ?? 1.4;
  const e = L.spec.extent;
  const h = (2 * e) / (n - 1);
  const target = L.minima[0]!;

  const idx = (i: number, j: number) => i * n + j;
  const cell = (t: number) => Math.max(0, Math.min(n - 1, Math.round((t + e) / h)));
  const thetaOf = (k: number): Vec2 => [-e + (k % n) * h, -e + Math.floor(k / n) * h];

  // World-space position per cell: (x, height, z).
  const height = new Float64Array(n * n);
  for (let k = 0; k < n * n; k++) {
    const [x, z] = thetaOf(k);
    height[k] = L.loss(x, z) * sy;
  }

  const s = idx(cell(start[1]), cell(start[0]));
  const g = idx(cell(target.theta[1]), cell(target.theta[0]));
  const gx = (g % n) * h * sxy;
  const gz = Math.floor(g / n) * h * sxy;
  // Admissible: straight-line 3D distance never exceeds any surface path.
  const heuristic = (k: number) => {
    const dx = (k % n) * h * sxy - gx;
    const dz = Math.floor(k / n) * h * sxy - gz;
    const dy = height[k]! - height[g]!;
    return Math.sqrt(dx * dx + dz * dz + dy * dy);
  };

  const gScore = new Float64Array(n * n).fill(Infinity);
  const came = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  gScore[s] = 0;
  const open = new Heap();
  open.push(s, heuristic(s));

  while (open.size > 0) {
    const k = open.pop();
    if (k === g) break;
    if (closed[k]) continue;
    closed[k] = 1;
    const i = Math.floor(k / n);
    const j = k % n;
    for (const [di, dj] of NEIGHBOURS) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const nk = idx(ni, nj);
      if (closed[nk]) continue;
      const planar = h * sxy * Math.hypot(di, dj);
      const dy = height[nk]! - height[k]!;
      const cand = gScore[k]! + Math.sqrt(planar * planar + dy * dy);
      if (cand < gScore[nk]!) {
        gScore[nk] = cand;
        came[nk] = k;
        open.push(nk, cand + heuristic(nk));
      }
    }
  }

  const points: Vec2[] = [];
  for (let k = g; k !== -1; k = came[k]!) points.push(thetaOf(k));
  points.reverse();
  return { points, length: gScore[g]!, target };
}
