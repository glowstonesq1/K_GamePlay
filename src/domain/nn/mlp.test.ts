import { describe, it, expect } from "vitest";
import {
  initMlp,
  forward,
  predict,
  lossAndGrads,
  sgdMomentumStep,
  zeroGrads,
  twoMoons,
  bce,
} from "@/domain/nn/mlp";

describe("gradient check", () => {
  it("analytic gradients match central differences for every parameter", () => {
    const net = initMlp([2, 8, 8, 1], 3);
    const { X, Y } = twoMoons(40, 0.1, 1);
    const { grads } = lossAndGrads(net, X, Y);
    const h = 1e-5;
    const check = (params: Float64Array, analytic: Float64Array) => {
      for (let i = 0; i < params.length; i++) {
        const orig = params[i]!;
        params[i] = orig + h;
        const lp = lossAndGrads(net, X, Y).loss;
        params[i] = orig - h;
        const lm = lossAndGrads(net, X, Y).loss;
        params[i] = orig;
        const num = (lp - lm) / (2 * h);
        const an = analytic[i]!;
        const rel = Math.abs(num - an) / Math.max(1e-8, Math.abs(num) + Math.abs(an));
        expect(rel).toBeLessThan(1e-6);
      }
    };
    for (let l = 0; l < net.W.length; l++) {
      check(net.W[l]!, grads.W[l]!);
      check(net.b[l]!, grads.b[l]!);
    }
  });
});

describe("forward", () => {
  it("returns one activation array per layer with bounded values", () => {
    const net = initMlp([2, 8, 8, 1], 3);
    const acts = forward(net, [0.4, -0.7]);
    expect(acts).toHaveLength(net.sizes.length);
    const out = acts.at(-1)![0]!;
    expect(out).toBeGreaterThan(0);
    expect(out).toBeLessThan(1);
    expect(predict(net, [0.4, -0.7])).toBe(out);
    for (const a of [acts[1]!, acts[2]!]) for (const v of a) {
      expect(v).toBeGreaterThan(-1);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("initMlp", () => {
  it("is deterministic per seed and differs across seeds", () => {
    const a = initMlp([2, 8, 8, 1], 5);
    const b = initMlp([2, 8, 8, 1], 5);
    const c = initMlp([2, 8, 8, 1], 6);
    expect(a.W.map((w) => Array.from(w))).toEqual(b.W.map((w) => Array.from(w)));
    expect(Array.from(a.W[0]!)).not.toEqual(Array.from(c.W[0]!));
  });
});

describe("training", () => {
  it("learns two moons", () => {
    const net = initMlp([2, 8, 8, 1], 1);
    const { X, Y } = twoMoons(200, 0.12, 42);
    const vel = zeroGrads(net);
    const initial = lossAndGrads(net, X, Y).loss;
    for (let i = 0; i < 1500; i++) {
      const { grads } = lossAndGrads(net, X, Y);
      sgdMomentumStep(net, grads, vel, 0.05, 0.9);
    }
    const final = lossAndGrads(net, X, Y).loss;
    const acc = X.filter((x, i) => (predict(net, x) > 0.5 ? 1 : 0) === Y[i]).length / X.length;
    expect(final).toBeLessThan(initial);
    expect(final).toBeLessThan(0.05);
    expect(acc).toBeGreaterThanOrEqual(0.97);
  });
});

describe("bce", () => {
  it("matches ln 2 at p=0.5 and stays finite at extremes", () => {
    expect(bce(0.5, 1)).toBeCloseTo(Math.LN2, 9);
    for (const [p, y] of [[0, 1], [1, 0], [0, 0], [1, 1]] as const) {
      expect(Number.isFinite(bce(p, y))).toBe(true);
    }
  });
});

describe("deltaMag", () => {
  it("has one finite non-negative entry per layer", () => {
    const net = initMlp([2, 8, 8, 1], 3);
    const { X, Y } = twoMoons(40, 0.1, 1);
    const { deltaMag } = lossAndGrads(net, X, Y);
    expect(deltaMag).toHaveLength(3);
    for (const d of deltaMag) {
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(0);
    }
  });
});
