// src/domain/nn/mlp.ts
import { gaussian, mulberry32 } from "../rng";

/*
 * A multilayer perceptron from scratch. No autograd, no library: every derivative is
 * written out so the Backprop Forge can show exactly what flows where.
 *
 *   hidden layers: aₗ = tanh(Wₗ aₗ₋₁ + bₗ)
 *   output:        p  = σ(W_L a_{L−1} + b_L)          (binary classifier)
 *   loss:          BCE(p, y) = −[y log p + (1−y) log(1−p)]
 *
 * PEDAGOGY (the chain rule, layer by layer):
 *   output delta  δ_L = ∂BCE/∂z_L = p − y            (σ and BCE derivatives cancel neatly)
 *   hidden delta  δₗ  = (W_{l+1}ᵀ δ_{l+1}) ⊙ (1 − aₗ²) (tanh′ = 1 − tanh²)
 *   weight grad   ∂L/∂Wₗ = δₗ · aₗ₋₁ᵀ,   ∂L/∂bₗ = δₗ
 * Blame starts at the output and is passed backwards, scaled by each weight it crosses
 * and each activation's slope. Small slopes (saturated tanh) choke it: vanishing gradients.
 */

export interface Mlp {
  sizes: number[];
  /** W[l] maps layer l → l+1, row-major [out][in]. */
  W: Float64Array[];
  b: Float64Array[];
}

export interface Grads {
  W: Float64Array[];
  b: Float64Array[];
}

export function initMlp(sizes: number[], seed: number): Mlp {
  const rand = mulberry32(seed);
  const W: Float64Array[] = [];
  const b: Float64Array[] = [];
  for (let l = 0; l < sizes.length - 1; l++) {
    const nin = sizes[l]!;
    const nout = sizes[l + 1]!;
    // Xavier/Glorot normal: keeps tanh pre-activations O(1) at init.
    const std = Math.sqrt(2 / (nin + nout));
    const w = new Float64Array(nin * nout);
    for (let i = 0; i < w.length; i++) w[i] = gaussian(rand) * std;
    W.push(w);
    b.push(new Float64Array(nout));
  }
  return { sizes: [...sizes], W, b };
}

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));

/** Forward pass. Returns every layer's activation (acts[0] = input, last = [p]). */
export function forward(net: Mlp, x: readonly number[]): Float64Array[] {
  const acts: Float64Array[] = [Float64Array.from(x)];
  const L = net.W.length;
  for (let l = 0; l < L; l++) {
    const nin = net.sizes[l]!;
    const nout = net.sizes[l + 1]!;
    const a = acts[l]!;
    const out = new Float64Array(nout);
    const W = net.W[l]!;
    for (let o = 0; o < nout; o++) {
      let z = net.b[l]![o]!;
      for (let i = 0; i < nin; i++) z += W[o * nin + i]! * a[i]!;
      out[o] = l === L - 1 ? sigmoid(z) : Math.tanh(z);
    }
    acts.push(out);
  }
  return acts;
}

export function predict(net: Mlp, x: readonly number[]): number {
  return forward(net, x).at(-1)![0]!;
}

const EPS = 1e-12;
export const bce = (p: number, y: number) => -(y * Math.log(p + EPS) + (1 - y) * Math.log(1 - p + EPS));

export function zeroGrads(net: Mlp): Grads {
  return {
    W: net.W.map((w) => new Float64Array(w.length)),
    b: net.b.map((b) => new Float64Array(b.length)),
  };
}

/**
 * Mean loss and gradients over a batch. Also returns the mean |δ| per layer, which the
 * Forge uses to show how much blame reaches each layer.
 */
export function lossAndGrads(
  net: Mlp,
  X: readonly (readonly number[])[],
  Y: readonly number[],
): { loss: number; grads: Grads; deltaMag: number[] } {
  const g = zeroGrads(net);
  const L = net.W.length;
  const deltaMag = new Array<number>(L).fill(0);
  let loss = 0;

  for (let k = 0; k < X.length; k++) {
    const acts = forward(net, X[k]!);
    const p = acts[L]![0]!;
    loss += bce(p, Y[k]!);

    let delta = new Float64Array([p - Y[k]!]); // δ_L
    for (let l = L - 1; l >= 0; l--) {
      const nin = net.sizes[l]!;
      const nout = net.sizes[l + 1]!;
      const aPrev = acts[l]!;
      const W = net.W[l]!;
      let mag = 0;
      for (let o = 0; o < nout; o++) {
        const d = delta[o]!;
        mag += Math.abs(d);
        g.b[l]![o]! += d;
        for (let i = 0; i < nin; i++) g.W[l]![o * nin + i]! += d * aPrev[i]!;
      }
      deltaMag[l]! += mag / nout;
      if (l === 0) break;
      const next = new Float64Array(nin);
      for (let i = 0; i < nin; i++) {
        let s = 0;
        for (let o = 0; o < nout; o++) s += W[o * nin + i]! * delta[o]!;
        const a = aPrev[i]!;
        next[i] = s * (1 - a * a); // tanh′
      }
      delta = next;
    }
  }

  const n = X.length;
  for (const w of g.W) for (let i = 0; i < w.length; i++) w[i]! /= n;
  for (const b of g.b) for (let i = 0; i < b.length; i++) b[i]! /= n;
  return { loss: loss / n, grads: g, deltaMag: deltaMag.map((m) => m / n) };
}

/** SGD with classical momentum: v ← μv − η∇, θ ← θ + v. Mutates net and velocity. */
export function sgdMomentumStep(net: Mlp, grads: Grads, vel: Grads, lr: number, mu: number): void {
  for (let l = 0; l < net.W.length; l++) {
    const W = net.W[l]!;
    const vW = vel.W[l]!;
    const gW = grads.W[l]!;
    for (let i = 0; i < W.length; i++) {
      vW[i] = mu * vW[i]! - lr * gW[i]!;
      W[i]! += vW[i]!;
    }
    const b = net.b[l]!;
    const vb = vel.b[l]!;
    const gb = grads.b[l]!;
    for (let i = 0; i < b.length; i++) {
      vb[i] = mu * vb[i]! - lr * gb[i]!;
      b[i]! += vb[i]!;
    }
  }
}

/** Two interleaving half-moons: the classic "not linearly separable" toy set. */
export function twoMoons(n: number, noise: number, seed: number): { X: number[][]; Y: number[] } {
  const rand = mulberry32(seed);
  const X: number[][] = [];
  const Y: number[] = [];
  for (let i = 0; i < n; i++) {
    const cls = i % 2;
    const t = Math.PI * rand();
    const x = cls === 0 ? Math.cos(t) : 1 - Math.cos(t);
    const y = cls === 0 ? Math.sin(t) : 0.5 - Math.sin(t);
    // Centre on the origin so inputs are roughly zero-mean.
    X.push([x - 0.5 + noise * gaussian(rand), y - 0.25 + noise * gaussian(rand)]);
    Y.push(cls);
  }
  return { X, Y };
}
