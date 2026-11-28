// src/domain/hyperparams.ts
import { VALLEY } from "./loss/presets";
import { etaRegime } from "./optim/gd";

export type Hyperparam = "learningRate" | "temperature" | "sampleSkew";

interface Spec {
  min: number;
  max: number;
  initial: number;
  /** Log scale for multiplicative quantities: a step from 0.001→0.01 should feel like 0.01→0.1. */
  scale: "log" | "linear";
  symbol: string;
  label: string;
}

export const HYPERPARAMS: Readonly<Record<Hyperparam, Spec>> = {
  learningRate: {
    // 0.01 already crawls on this terrain; 2/λ_max ≈ 0.254 sits inside the range, so
    // the player can find both sides of the stability edge with one dial.
    min: 0.01,
    max: 1,
    initial: 0.05,
    scale: "log",
    symbol: "η",
    label: "Learning rate",
  },
  temperature: {
    // Range is symmetric in log space around T = 1 (raw logits sit at slider centre).
    // T must stay > 0: softmax(z / T) is undefined at 0. T → 0 approaches argmax.
    min: 0.1,
    max: 10,
    initial: 1,
    scale: "log",
    symbol: "T",
    label: "Temperature",
  },
  sampleSkew: {
    // Deliberately NOT called "bias": in a network, b is a learned parameter.
    // Overloading the word is how students end up confused for a semester.
    min: 0,
    max: 1,
    initial: 0,
    scale: "linear",
    symbol: "skew",
    label: "Sample skew",
  },
};

export function clampHyperparam(p: Hyperparam, v: unknown): number {
  const { min, max, initial } = HYPERPARAMS[p];
  if (typeof v !== "number" || !Number.isFinite(v)) return initial;
  return Math.min(max, Math.max(min, v));
}

/** value → slider position in [0, 1] */
export function toSlider(p: Hyperparam, v: number): number {
  const { min, max, scale } = HYPERPARAMS[p];
  const c = clampHyperparam(p, v);
  return scale === "log"
    ? Math.log(c / min) / Math.log(max / min)
    : (c - min) / (max - min);
}

/** slider position in [0, 1] → value */
export function fromSlider(p: Hyperparam, t: number): number {
  const { min, max, scale } = HYPERPARAMS[p];
  const u = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const v = scale === "log" ? min * Math.pow(max / min, u) : min + u * (max - min);
  return clampHyperparam(p, v);
}

export function formatHyperparam(p: Hyperparam, v: number): string {
  switch (p) {
    case "learningRate":
      return v < 1e-2 ? v.toExponential(1) : v.toFixed(3);
    case "temperature":
      return v.toFixed(2);
    case "sampleSkew":
      return `${Math.round(v * 100)}%`;
  }
}

/**
 * One line telling the player what the dial is doing to the system right now.
 */
export function describeHyperparam(p: Hyperparam, v: number): string {
  switch (p) {
    case "learningRate":
      // PEDAGOGY: bands come from the terrain's real curvature, ηλ_max (see etaRegime).
      switch (etaRegime(v, VALLEY.lambdaMax)) {
        case "crawl":
          return "Barely moving. You'll get there, eventually.";
        case "smooth":
          return "Steady steps. Every one lowers the loss.";
        case "oscillate":
          return "In the steepest pocket, steps now bounce across the floor before settling.";
        case "diverge":
          return "Past 2/λ. In the sharp pocket each step overshoots and the loss climbs.";
      }
      break;
    case "temperature":
      if (v < 0.5) return "Near-greedy. The top token wins almost every time.";
      if (v < 0.9) return "Sharpened. Confident, a little repetitive.";
      if (v <= 1.1) return "Raw logits. The model's own odds.";
      if (v <= 2) return "Loosened. Long-tail words start getting picked.";
      return "Flattened. Close to a coin toss across the vocabulary.";
    case "sampleSkew":
      if (v === 0) return "Balanced sample. Every region gets its share.";
      if (v < 0.3) return "A slight tilt. Hard to notice from the inside.";
      if (v < 0.7) return "One group dominates the archive. The rest blur.";
      return "The model has barely seen anyone outside the majority.";
  }
  return "";
}
