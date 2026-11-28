import { describe, it, expect } from "vitest";
import { gradientField } from "@/domain/loss/field";
import { VALLEY } from "@/domain/loss/presets";

describe("gradientField", () => {
  const arrows = gradientField(VALLEY, 9);

  it("returns n*n arrows", () => {
    expect(arrows).toHaveLength(81);
  });

  it("has unit or zero directions", () => {
    for (const a of arrows) {
      const len = Math.hypot(a.dir[0], a.dir[1]);
      if (a.dir[0] === 0 && a.dir[1] === 0) continue;
      expect(Math.abs(len - 1)).toBeLessThan(1e-9);
    }
  });

  it("points along -grad", () => {
    for (const a of arrows) {
      const [gx, gz] = VALLEY.grad(a.theta[0], a.theta[1]);
      const m = Math.hypot(gx, gz);
      if (m < 1e-12) continue;
      expect(a.dir[0] * (-gx / m) + a.dir[1] * (-gz / m)).toBeCloseTo(1, 9);
    }
  });

  it("is a descent direction", () => {
    for (const a of arrows) {
      if (a.dir[0] === 0 && a.dir[1] === 0) continue;
      const [x, z] = a.theta;
      const after = VALLEY.loss(x + 1e-3 * a.dir[0], z + 1e-3 * a.dir[1]);
      expect(after).toBeLessThan(VALLEY.loss(x, z));
    }
  });
});
