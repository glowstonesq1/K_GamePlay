// src/physics/heightfield.ts
import type { CompiledLandscape } from "@/domain/loss/landscape";

/** θ-space → world XZ. θ ∈ [-3, 3] maps to world ∈ [-9, 9]. */
export const WORLD_PER_THETA = 3;
/** loss units → world Y. */
export const WORLD_PER_LOSS = 1.4;

export const thetaToWorld = (t: number) => t * WORLD_PER_THETA;
export const worldToTheta = (w: number) => w / WORLD_PER_THETA;
export const lossToWorldY = (l: number) => l * WORLD_PER_LOSS;

export interface TerrainGrid {
  /** Subdivisions along each axis; the vertex grid is (n+1)². */
  n: number;
  /** World width = depth. */
  size: number;
  /** Row-major (i = z row, j = x column) world heights, length (n+1)². Mesh layout. */
  heights: Float32Array;
  /** Raw loss per vertex, same layout. Fed to the shader for contours. */
  loss: Float32Array;
}

/**
 * Sample L on a regular grid. Vertex (i, j) sits at
 *   x = -size/2 + j·size/n,  z = -size/2 + i·size/n.
 */
export function sampleTerrain(L: CompiledLandscape, n: number): TerrainGrid {
  const size = 2 * thetaToWorld(L.spec.extent);
  const v = n + 1;
  const heights = new Float32Array(v * v);
  const loss = new Float32Array(v * v);
  for (let i = 0; i < v; i++) {
    const z = -size / 2 + (i * size) / n;
    for (let j = 0; j < v; j++) {
      const x = -size / 2 + (j * size) / n;
      const l = L.loss(worldToTheta(x), worldToTheta(z));
      loss[i * v + j] = l;
      heights[i * v + j] = lossToWorldY(l);
    }
  }
  return { n, size, heights, loss };
}

/**
 * Rapier heightfields take a COLUMN-major (nrows+1)×(ncols+1) matrix where rows run
 * along Z and columns along X, centred on the body origin and spanning `scale.x × scale.z`.
 * Getting this transposed gives a terrain mirrored across the diagonal: invisible on a
 * symmetric map, wrong on ours. heightfield.test.ts drops spheres to prove the layout.
 */
export function toRapierHeightfield(g: TerrainGrid) {
  const v = g.n + 1;
  const colMajor = new Float32Array(v * v);
  for (let i = 0; i < v; i++) {
    for (let j = 0; j < v; j++) {
      colMajor[j * v + i] = g.heights[i * v + j]!;
    }
  }
  return {
    nrows: g.n,
    ncols: g.n,
    heights: colMajor,
    scale: { x: g.size, y: 1, z: g.size },
  };
}
