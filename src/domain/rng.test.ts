import { describe, it, expect } from "vitest";
import { mulberry32, gaussian } from "@/domain/rng";

describe("mulberry32", () => {
  it("is reproducible per seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it("differs across seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it("stays in [0,1)", () => {
    const r = mulberry32(99);
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("gaussian", () => {
  it("has mean ~0 and variance ~1", () => {
    const r = mulberry32(2024);
    const N = 20000;
    const xs: number[] = [];
    for (let i = 0; i < N; i++) xs.push(gaussian(r));
    const mean = xs.reduce((s, x) => s + x, 0) / N;
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / N;
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(variance - 1)).toBeLessThan(0.05);
  });
});
