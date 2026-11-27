// src/domain/loss/landscape.test.ts
import { describe, expect, it } from "vitest";
import { eig2 } from "./landscape";
import { VALLEY } from "./presets";
import { etaRegime, gdStep, initGd, type GdState } from "../optim/gd";
import { entropyBits, sampleIndex, softmax } from "../tokens/sampling";
import { LOGITS } from "../tokens/corpus";

const pts: [number, number][] = [
  [0.3, -1.1],
  [1.25, 0.85],
  [-1.0, 1.5],
  [2.4, -2.2],
];

describe("analytic derivatives", () => {
  const h = 1e-5;
  it.each(pts)("∇L matches central differences at (%f, %f)", (x, z) => {
    const [gx, gz] = VALLEY.grad(x, z);
    expect(gx).toBeCloseTo((VALLEY.loss(x + h, z) - VALLEY.loss(x - h, z)) / (2 * h), 5);
    expect(gz).toBeCloseTo((VALLEY.loss(x, z + h) - VALLEY.loss(x, z - h)) / (2 * h), 5);
  });

  it.each(pts)("∇²L matches differences of ∇L at (%f, %f)", (x, z) => {
    const [h11, h12, h22] = VALLEY.hessian(x, z);
    expect(h11).toBeCloseTo((VALLEY.grad(x + h, z)[0] - VALLEY.grad(x - h, z)[0]) / (2 * h), 4);
    expect(h12).toBeCloseTo((VALLEY.grad(x, z + h)[0] - VALLEY.grad(x, z - h)[0]) / (2 * h), 4);
    expect(h22).toBeCloseTo((VALLEY.grad(x, z + h)[1] - VALLEY.grad(x, z - h)[1]) / (2 * h), 4);
  });

  it("eig2 is correct on a known matrix", () => {
    const [a, b] = eig2([2, 1, 2]);
    expect(a).toBeCloseTo(3);
    expect(b).toBeCloseTo(1);
  });
});

describe("landscape structure", () => {
  it("has three distinct minima with the global one at L = 0", () => {
    expect(VALLEY.minima.length).toBe(3);
    expect(VALLEY.minima[0]!.loss).toBeCloseTo(0, 6);
    for (const m of VALLEY.minima) {
      const [l1, l2] = eig2(VALLEY.hessian(m.theta[0], m.theta[1]));
      expect(l2).toBeGreaterThan(0); // positive definite → a true minimum, not a saddle
      expect(l1).toBeLessThanOrEqual(VALLEY.lambdaMax + 1e-9);
    }
  });

  it("puts the divergence threshold 2/λ_max inside the η slider range", () => {
    const etaCrit = 2 / VALLEY.lambdaMax;
    expect(etaCrit).toBeGreaterThan(1e-3);
    expect(etaCrit).toBeLessThan(1);
  });
});

function run(theta: [number, number], eta: number, maxSteps = 50_000): GdState {
  let s = initGd(VALLEY, theta);
  for (let k = 0; k < maxSteps && s.status !== "converged" && s.status !== "diverged"; k++) {
    s = gdStep(VALLEY, s, eta);
  }
  return s;
}

describe("gradient descent behaviour", () => {
  it("small η converges with monotonically non-increasing loss", () => {
    const s = run([0.2, -0.6], 0.2 / VALLEY.lambdaMax);
    expect(s.status).toBe("converged");
    expect(s.rises).toBe(0);
  });

  it("is sensitive to initialisation: different starts, different basins", () => {
    const eta = 0.5 / VALLEY.lambdaMax;
    const a = run([1.6, 1.2], eta);
    const b = run([-1.8, -1.3], eta);
    expect(a.status).toBe("converged");
    expect(b.status).toBe("converged");
    expect(a.loss).toBeLessThan(b.loss); // b got stuck in the local minimum
  });

  it("η above 2/λ in the sharp well makes the loss rise", () => {
    const sharp = VALLEY.minima.reduce((best, m) =>
      eig2(VALLEY.hessian(...m.theta))[0] > eig2(VALLEY.hessian(...best.theta))[0] ? m : best,
    );
    const lam = eig2(VALLEY.hessian(...sharp.theta))[0];
    let s = initGd(VALLEY, [sharp.theta[0] + 0.02, sharp.theta[1] - 0.02]);
    for (let k = 0; k < 50; k++) s = gdStep(VALLEY, s, 2.4 / lam);
    expect(s.rises).toBeGreaterThan(0);
  });

  it("classifies η against λ_max", () => {
    const L = VALLEY.lambdaMax;
    expect(etaRegime(0.01 / L, L)).toBe("crawl");
    expect(etaRegime(0.5 / L, L)).toBe("smooth");
    expect(etaRegime(1.5 / L, L)).toBe("oscillate");
    expect(etaRegime(3 / L, L)).toBe("diverge");
  });
});

describe("temperature sampling", () => {
  it("is a distribution at every T and keeps the ranking", () => {
    for (const T of [0.1, 0.5, 1, 2, 10]) {
      const p = softmax(LOGITS, T);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      for (let i = 1; i < p.length; i++) expect(p[i]!).toBeLessThanOrEqual(p[i - 1]!);
    }
  });

  it("entropy rises monotonically with T", () => {
    const hs = [0.1, 0.5, 1, 2, 10].map((T) => entropyBits(softmax(LOGITS, T)));
    for (let i = 1; i < hs.length; i++) expect(hs[i]!).toBeGreaterThan(hs[i - 1]!);
    expect(hs[hs.length - 1]!).toBeLessThan(Math.log2(LOGITS.length) + 1e-9);
  });

  it("survives huge logits without overflow", () => {
    const p = softmax([1000, 999, -1000], 0.1);
    expect(p.every(Number.isFinite)).toBe(true);
  });

  it("inverse-CDF sampling hits the right bucket", () => {
    expect(sampleIndex([0.5, 0.3, 0.2], 0.0)).toBe(0);
    expect(sampleIndex([0.5, 0.3, 0.2], 0.79)).toBe(1);
    expect(sampleIndex([0.5, 0.3, 0.2], 0.99)).toBe(2);
  });
});
