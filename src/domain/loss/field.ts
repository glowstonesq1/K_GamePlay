// src/domain/loss/field.ts
import type { CompiledLandscape, Vec2 } from "./landscape";

export interface FieldArrow {
  theta: Vec2;
  /** Unit vector of −∇L (the descent direction). */
  dir: Vec2;
  /** ‖∇L‖ at this point. */
  mag: number;
}

/**
 * Sample the descent direction −∇L on an n×n lattice.
 *
 * PEDAGOGY: Every arrow is what gradient descent would do from that exact spot. Arrows
 * converge on basins and split along ridges (watersheds): the field already contains
 * every possible GD run before any probe is dropped.
 */
export function gradientField(L: CompiledLandscape, n: number): FieldArrow[] {
  const e = L.spec.extent * 0.96;
  const out: FieldArrow[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = -e + (2 * e * j) / (n - 1);
      const z = -e + (2 * e * i) / (n - 1);
      const [gx, gz] = L.grad(x, z);
      const mag = Math.hypot(gx, gz);
      out.push({ theta: [x, z], dir: mag > 1e-12 ? [-gx / mag, -gz / mag] : [0, 0], mag });
    }
  }
  return out;
}
