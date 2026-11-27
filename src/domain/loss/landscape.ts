// src/domain/loss/landscape.ts
//
// PEDAGOGY: The terrain in Loss Valley IS a loss function L(θ) over a 2-parameter model
// θ = (θ₁, θ₂). Everything is analytic: value, gradient and Hessian are closed-form, so
// what the player sees is exactly what gradient descent sees. No noise is mixed into L;
// noise would make ∇L meaningless and the lesson unverifiable.
//
//   L(θ) = b·‖θ‖² − Σᵢ aᵢ·exp(−‖θ − μᵢ‖² / 2σᵢ²) + c
//
// The quadratic bowl keeps L bounded below and pushes divergent runs back into view;
// each Gaussian well is a basin of attraction (a local or global minimum).

export interface Well {
  mu: readonly [number, number];
  amp: number;
  sigma: number;
}

export interface LandscapeSpec {
  id: string;
  bowl: number;
  wells: readonly Well[];
  /** θ domain is [-extent, extent]². */
  extent: number;
}

export type Vec2 = readonly [number, number];
/** Symmetric 2×2 as [h11, h12, h22]. */
export type Sym2 = readonly [number, number, number];

export interface Minimum {
  theta: Vec2;
  loss: number;
}

export interface CompiledLandscape {
  spec: LandscapeSpec;
  /** Shift so the global minimum sits at L = 0. */
  offset: number;
  loss(x: number, z: number): number;
  grad(x: number, z: number): Vec2;
  hessian(x: number, z: number): Sym2;
  /** max over the domain of the Hessian's largest eigenvalue (sampled). */
  lambdaMax: number;
  /** Max loss on the domain. Used for colour ramps and divergence detection. */
  lossMax: number;
  /** Sorted ascending by loss; [0] is the global minimum. */
  minima: readonly Minimum[];
}

function rawLoss(s: LandscapeSpec, x: number, z: number): number {
  let l = s.bowl * (x * x + z * z);
  for (const w of s.wells) {
    const dx = x - w.mu[0];
    const dz = z - w.mu[1];
    l -= w.amp * Math.exp(-(dx * dx + dz * dz) / (2 * w.sigma * w.sigma));
  }
  return l;
}

function rawGrad(s: LandscapeSpec, x: number, z: number): Vec2 {
  let gx = 2 * s.bowl * x;
  let gz = 2 * s.bowl * z;
  for (const w of s.wells) {
    const dx = x - w.mu[0];
    const dz = z - w.mu[1];
    const s2 = w.sigma * w.sigma;
    const k = (w.amp * Math.exp(-(dx * dx + dz * dz) / (2 * s2))) / s2;
    // ∇(−a·g) = a·g·d/σ²
    gx += k * dx;
    gz += k * dz;
  }
  return [gx, gz];
}

function rawHessian(s: LandscapeSpec, x: number, z: number): Sym2 {
  let h11 = 2 * s.bowl;
  let h12 = 0;
  let h22 = 2 * s.bowl;
  for (const w of s.wells) {
    const dx = x - w.mu[0];
    const dz = z - w.mu[1];
    const s2 = w.sigma * w.sigma;
    const k = (w.amp * Math.exp(-(dx * dx + dz * dz) / (2 * s2))) / s2;
    // ∇²(−a·g) = (a·g/σ²)·(I − d·dᵀ/σ²)
    h11 += k * (1 - (dx * dx) / s2);
    h12 += k * (-(dx * dz) / s2);
    h22 += k * (1 - (dz * dz) / s2);
  }
  return [h11, h12, h22];
}

/** Eigenvalues of a symmetric 2×2, descending. */
export function eig2([a, b, c]: Sym2): [number, number] {
  const m = (a + c) / 2;
  const r = Math.sqrt(((a - c) / 2) ** 2 + b * b);
  return [m + r, m - r];
}

const SAMPLE_N = 161;

export function compileLandscape(spec: LandscapeSpec): CompiledLandscape {
  const { extent } = spec;
  const stepSize = (2 * extent) / (SAMPLE_N - 1);

  let lambdaMax = -Infinity;
  let rawMin = Infinity;
  let rawMax = -Infinity;
  for (let i = 0; i < SAMPLE_N; i++) {
    for (let j = 0; j < SAMPLE_N; j++) {
      const x = -extent + j * stepSize;
      const z = -extent + i * stepSize;
      const l = rawLoss(spec, x, z);
      if (l < rawMin) rawMin = l;
      if (l > rawMax) rawMax = l;
      const [l1] = eig2(rawHessian(spec, x, z));
      if (l1 > lambdaMax) lambdaMax = l1;
    }
  }

  // Locate every basin floor: tiny-step GD from each well centre and the origin,
  // then dedupe. Polishing with GD (not a grid argmin) gives sub-grid precision.
  const seeds: Vec2[] = [[0, 0], ...spec.wells.map((w) => w.mu)];
  const found: Minimum[] = [];
  const eta = 0.5 / lambdaMax;
  for (const seed of seeds) {
    let x = seed[0];
    let z = seed[1];
    for (let k = 0; k < 20_000; k++) {
      const [gx, gz] = rawGrad(spec, x, z);
      if (Math.hypot(gx, gz) < 1e-10) break;
      x -= eta * gx;
      z -= eta * gz;
    }
    if (!found.some((m) => Math.hypot(m.theta[0] - x, m.theta[1] - z) < 1e-3)) {
      found.push({ theta: [x, z], loss: rawLoss(spec, x, z) });
    }
  }
  found.sort((a, b) => a.loss - b.loss);
  const offset = -Math.min(rawMin, found[0]?.loss ?? rawMin);

  return {
    spec,
    offset,
    loss: (x, z) => rawLoss(spec, x, z) + offset,
    grad: (x, z) => rawGrad(spec, x, z),
    hessian: (x, z) => rawHessian(spec, x, z),
    lambdaMax,
    lossMax: rawMax + offset,
    minima: found.map((m) => ({ theta: m.theta, loss: m.loss + offset })),
  };
}
