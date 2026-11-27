import { describe, it, expect } from "vitest";
import {
  runArchive,
  minorityShare,
  trueLabel,
  trainLogistic,
  predictProb,
  samplePeople,
} from "@/domain/bias/archive";
import { mulberry32 } from "@/domain/rng";

describe("minorityShare", () => {
  it("has endpoints", () => {
    expect(minorityShare(0)).toBeCloseTo(0.5, 12);
    expect(minorityShare(1)).toBeCloseTo(0.01, 12);
  });
  it("is monotonically decreasing", () => {
    for (let i = 1; i <= 10; i++) {
      expect(minorityShare(i / 10)).toBeLessThan(minorityShare((i - 1) / 10));
    }
  });
  it("clamps outside [0,1]", () => {
    expect(minorityShare(-5)).toBe(minorityShare(0));
    expect(minorityShare(7)).toBe(minorityShare(1));
  });
});

describe("trueLabel", () => {
  it("follows the V rule", () => {
    expect(trueLabel(0, 1)).toBe(1);
    expect(trueLabel(2, 0)).toBe(0);
  });
});

describe("runArchive", () => {
  for (const seed of [7, 11, 23]) {
    it(`bias grows with skew (seed ${seed})`, () => {
      expect(Math.abs(runArchive(0, seed).gapPts)).toBeLessThan(3);
      expect(runArchive(1, seed).gapPts).toBeGreaterThan(30);
      expect(runArchive(0.9, seed).gapPts).toBeGreaterThan(runArchive(0.3, seed).gapPts);
    });
  }

  it("is deterministic", () => {
    const a = runArchive(0.6, 7);
    const b = runArchive(0.6, 7);
    expect(a.gapPts).toBe(b.gapPts);
    expect(a.model.w).toEqual(b.model.w);
  });

  it("has the expected world and train shapes", () => {
    const r = runArchive(0.5, 7);
    expect(r.world).toHaveLength(600);
    expect(r.world.filter((p) => p.group === 0)).toHaveLength(300);
    expect(r.world.filter((p) => p.group === 1)).toHaveLength(300);
    expect(r.train).toHaveLength(400);
    expect(r.train.filter((p) => p.group === 1)).toHaveLength(Math.round(400 * minorityShare(0.5)));
  });
});

describe("trainLogistic", () => {
  it("fits group 0 alone with >90% accuracy", () => {
    const data = samplePeople(200, 0, mulberry32(5));
    const m = trainLogistic(data);
    const ok = data.filter((p) => (predictProb(m, p.x, p.y) > 0.5 ? 1 : 0) === p.label).length;
    expect(ok / data.length).toBeGreaterThan(0.9);
  });
});
