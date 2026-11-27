import { describe, it, expect } from "vitest";
import { oraclePath } from "@/domain/loss/oracle";
import { VALLEY } from "@/domain/loss/presets";
import type { Vec2 } from "@/domain/loss/landscape";

const CELL = 6 / 119;
const START: Vec2 = [-1.8, -1.3];
const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("oraclePath", () => {
  const res = oraclePath(VALLEY, START);
  const target = VALLEY.minima[0]!;

  it("returns a non-empty path from start to the global minimum", () => {
    expect(res.points.length).toBeGreaterThan(0);
    expect(dist(res.points[0]!, START)).toBeLessThanOrEqual(CELL);
    expect(dist(res.points.at(-1)!, target.theta)).toBeLessThanOrEqual(CELL);
    expect(res.target).toBe(target);
  });

  it("has finite length exceeding the planar straight-line distance", () => {
    expect(Number.isFinite(res.length)).toBe(true);
    expect(res.length).toBeGreaterThan(3 * dist(START, target.theta));
  });

  it("is 8-connected", () => {
    for (let i = 1; i < res.points.length; i++) {
      expect(dist(res.points[i - 1]!, res.points[i]!)).toBeLessThanOrEqual(Math.SQRT2 * CELL + 1e-9);
    }
  });

  it("is no longer than the straight theta-line over the surface", () => {
    const N = 400;
    let straight = 0;
    let prev: [number, number, number] | null = null;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = START[0] + t * (target.theta[0] - START[0]);
      const z = START[1] + t * (target.theta[1] - START[1]);
      const p: [number, number, number] = [3 * x, 1.4 * VALLEY.loss(x, z), 3 * z];
      if (prev) straight += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
      prev = p;
    }
    // 8-connected grid + snapped endpoints can exceed the continuous line by a hair; allow 2%.
    expect(res.length).toBeLessThanOrEqual(straight * 1.02);
  });

  it("is near zero length when starting at the global minimum", () => {
    const r = oraclePath(VALLEY, target.theta);
    expect(r.length).toBeLessThan(0.2);
  });

  it("is deterministic", () => {
    const a = oraclePath(VALLEY, START);
    const b = oraclePath(VALLEY, START);
    expect(a.points).toEqual(b.points);
    expect(a.length).toBe(b.length);
  });
});
