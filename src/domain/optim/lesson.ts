// src/domain/optim/lesson.ts
import type { CompiledLandscape } from "../loss/landscape";
import { etaRegime } from "./gd";
import type { GdState } from "./gd";

export type LessonKind = "global" | "local" | "zigzag" | "diverged";

export interface Lesson {
  kind: LessonKind;
  title: string;
  body: string;
  /** The one number worth remembering from this run. */
  figure: { label: string; value: string };
}

/**
 * What a finished descent should teach, chosen from what actually happened, never from
 * what the player intended. Returns null while the run is still going.
 *
 * PEDAGOGY: the update rule is the same four symbols in every branch, θ ← θ − η∇L. The
 * outcome changes because of η relative to the curvature (stability needs η < 2/λ_max)
 * and because of where θ started. Copy here must not imply the probe "looked for" the
 * minimum: it only ever read the slope under itself.
 */
export function valleyLesson(L: CompiledLandscape, s: GdState | null, eta: number): Lesson | null {
  if (!s || (s.status !== "converged" && s.status !== "diverged")) return null;
  const crit = 2 / L.lambdaMax;
  const g = L.minima[0]!;

  if (s.status === "diverged") {
    return {
      kind: "diverged",
      title: "The step outgrew the valley",
      body: `η = ${eta.toPrecision(2)} is past 2/λ_max. On the steep walls each step overshoots by more than it corrects, since |1 − ηλ| > 1. The bowl kept the probe on the map, but ${s.rises} of its ${s.step} steps went uphill: it was bouncing, not descending. Nothing about the slope was wrong. The stride was.`,
      figure: { label: "Stable below", value: `η < ${crit.toFixed(3)}` },
    };
  }

  const gap = s.loss - g.loss;
  if (gap > 0.05) {
    return {
      kind: "local",
      title: "A floor, not the floor",
      body: `The slope under the probe reached zero after ${s.step} steps, so it stopped. Gradient descent only ever reads the ground it stands on; it had no way to know a deeper basin sat ${gap.toFixed(2)} lower. Reveal the route to see what full knowledge would have done.`,
      figure: { label: "Left on the table", value: `ΔL = ${gap.toFixed(2)}` },
    };
  }

  if (s.rises > 0 || etaRegime(eta, L.lambdaMax) === "oscillate") {
    return {
      kind: "zigzag",
      title: "Down, the hard way",
      body: `It reached the bottom, but ${s.rises} of its steps went uphill first. With η close to 2/λ_max the probe ricochets across the valley walls and the bounces only shrink slowly. A little less η usually arrives sooner.`,
      figure: { label: "Uphill steps", value: String(s.rises) },
    };
  }

  return {
    kind: "global",
    title: "Settled on the true floor",
    body: `${s.step} steps, each one moving η times the local slope downhill. The probe never saw this floor. It arrived because, from where you dropped it, every downhill step led here.`,
    figure: { label: "Final loss", value: s.loss.toFixed(3) },
  };
}
