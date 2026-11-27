// src/domain/optim/gd.ts
import type { CompiledLandscape, Vec2 } from "../loss/landscape";

export type ProbeStatus = "idle" | "running" | "converged" | "diverged";

export interface GdState {
  theta: Vec2;
  loss: number;
  gradNorm: number;
  step: number;
  status: ProbeStatus;
  /** Steps on which the loss went UP. Small-η GD never does this (descent lemma). */
  rises: number;
}

/** ‖∇L‖ below this counts as "at a stationary point". */
export const GRAD_TOL = 1e-3;

export function initGd(L: CompiledLandscape, theta: Vec2): GdState {
  const [gx, gz] = L.grad(theta[0], theta[1]);
  return {
    theta,
    loss: L.loss(theta[0], theta[1]),
    gradNorm: Math.hypot(gx, gz),
    step: 0,
    status: "idle",
    rises: 0,
  };
}

/**
 * One step of vanilla (full-batch, deterministic) gradient descent:
 *
 *     θ ← θ − η · ∇L(θ)
 *
 * PEDAGOGY: This is the *only* information the optimiser uses: the local slope at
 * the current point. No lookahead, no map. Contrast with the Oracle path (Module 3),
 * which is computed with full knowledge of the terrain and is shown only afterwards.
 *
 * Divergence is declared when θ leaves twice the domain or the loss goes non-finite.
 * Leaving the rendered domain alone is not divergence: the bowl may still pull it back.
 */
export function gdStep(L: CompiledLandscape, s: GdState, eta: number): GdState {
  if (s.status === "converged" || s.status === "diverged") return s;
  const [gx, gz] = L.grad(s.theta[0], s.theta[1]);
  const x = s.theta[0] - eta * gx;
  const z = s.theta[1] - eta * gz;
  const loss = L.loss(x, z);
  const [nx, nz] = L.grad(x, z);
  const gradNorm = Math.hypot(nx, nz);
  const bound = 2 * L.spec.extent;

  let status: ProbeStatus = "running";
  if (!Number.isFinite(loss) || !Number.isFinite(gradNorm) || Math.abs(x) > bound || Math.abs(z) > bound) {
    status = "diverged";
  } else if (gradNorm < GRAD_TOL) {
    status = "converged";
  }
  // PEDAGOGY: For η < 2/λ (λ = local curvature) every step lowers the loss. A rise means
  // the step overshot the valley floor. With a sharp well and a big η the probe gets
  // ejected and lands in a flatter basin: large learning rates avoid sharp minima.
  const rises = s.rises + (loss > s.loss + 1e-12 ? 1 : 0);
  return { theta: [x, z], loss, gradNorm, step: s.step + 1, status, rises };
}

/** Stability regime of GD near the sharpest point of the landscape. */
export type EtaRegime = "crawl" | "smooth" | "oscillate" | "diverge";

/**
 * On a quadratic with curvature λ, GD's error along that direction scales by |1 − ηλ|
 * per step: monotone for ηλ < 1, oscillating-but-convergent for 1 < ηλ < 2,
 * divergent for ηλ > 2. We evaluate against λ_max, the sharpest curvature on the map.
 * Non-quadratic terrain makes this a local criterion, which the copy says.
 */
export function etaRegime(eta: number, lambdaMax: number): EtaRegime {
  const r = eta * lambdaMax;
  if (r < 0.02) return "crawl";
  if (r <= 1) return "smooth";
  if (r <= 2) return "oscillate";
  return "diverge";
}
