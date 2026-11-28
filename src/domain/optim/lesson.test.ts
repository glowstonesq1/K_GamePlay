import { describe, expect, it } from "vitest";
import { VALLEY } from "../loss/presets";
import { gdStep, initGd, type GdState } from "./gd";
import { valleyLesson } from "./lesson";

function run(theta: [number, number], eta: number, max = 20000): GdState {
  let s = initGd(VALLEY, theta);
  for (let i = 0; i < max && (s.status === "idle" || s.status === "running"); i++) s = gdStep(VALLEY, s, eta);
  return s;
}

describe("valleyLesson", () => {
  it("is silent while the run is unfinished", () => {
    expect(valleyLesson(VALLEY, initGd(VALLEY, [0, 0]), 0.05)).toBeNull();
    expect(valleyLesson(VALLEY, null, 0.05)).toBeNull();
  });

  it("calls a start in the global basin a true floor", () => {
    const g = VALLEY.minima[0]!.theta;
    const l = valleyLesson(VALLEY, run([g[0] + 0.4, g[1] - 0.3], 0.05), 0.05);
    expect(l?.kind).toBe("global");
  });

  it("calls the south-west basin a local trap", () => {
    const l = valleyLesson(VALLEY, run([-1.6, -1.2], 0.05), 0.05);
    expect(l?.kind).toBe("local");
  });

  it("explains divergence past 2/λ_max", () => {
    const eta = 1;
    const l = valleyLesson(VALLEY, run([-1.05, 1.4], eta), eta);
    expect(l?.kind).toBe("diverged");
    expect(l?.figure.value).toContain((2 / VALLEY.lambdaMax).toFixed(3));
  });

  it("calls a bounded but endless bounce unstable instead of running forever", () => {
    // 0.5 > 2/λ_max ≈ 0.254: the bowl catches the probe, so it never leaves the map.
    for (const start of [[0, 0], [2.2, -2.2]] as [number, number][]) {
      const s = run(start, 0.5);
      expect(s.status).toBe("diverged");
      expect(s.step).toBeLessThan(2000);
    }
  });

  it("never calls a stable run unstable", () => {
    for (const eta of [0.01, 0.05, 0.2]) {
      const s = run([2.2, -2.2], eta, 200_000);
      expect(s.status).toBe("converged");
    }
  });
});
