// src/physics/heightfield.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { VALLEY } from "@/domain/loss/presets";
import { lossToWorldY, sampleTerrain, thetaToWorld, toRapierHeightfield } from "./heightfield";

beforeAll(async () => {
  await RAPIER.init();
});

describe("Rapier heightfield matches the analytic loss surface", () => {
  // Asymmetric probe points: a transposed matrix would put them on the wrong height.
  const probes: [number, number][] = [
    [1.6, -0.4],
    [-2.0, 0.7],
    // θx = 0.3 → world 0.9 lies exactly on grid column 88; Rapier's heightfield raycast
    // misses on exact cell edges, so nudge 1e-3 off it. Physics contacts are unaffected.
    [0.301, 2.2],
    [-0.9, -2.4],
  ];

  it.each(probes)("ray down at θ=(%f, %f) hits L(θ)", (tx, tz) => {
    const grid = sampleTerrain(VALLEY, 160);
    const hf = toRapierHeightfield(grid);
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(
      RAPIER.ColliderDesc.heightfield(hf.nrows, hf.ncols, hf.heights, hf.scale),
    );
    world.step();

    const x = thetaToWorld(tx);
    const z = thetaToWorld(tz);
    const ray = new RAPIER.Ray({ x, y: 100, z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(ray, 200, true);
    expect(hit).not.toBeNull();
    const yHit = 100 - hit!.timeOfImpact;
    // Piecewise-linear interpolation error on a 0.11-unit grid stays well under 2 cm.
    expect(yHit).toBeCloseTo(lossToWorldY(VALLEY.loss(tx, tz)), 1);
    world.free();
  });

  it("a dropped sphere settles into a basin, not through the floor", () => {
    const grid = sampleTerrain(VALLEY, 160);
    const hf = toRapierHeightfield(grid);
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(
      RAPIER.ColliderDesc.heightfield(hf.nrows, hf.ncols, hf.heights, hf.scale).setFriction(0.8),
    );
    const r = 0.3;
    const [mx, mz] = VALLEY.minima[0]!.theta;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(thetaToWorld(mx) + 0.6, 6, thetaToWorld(mz) - 0.4)
        .setLinearDamping(0.6)
        .setAngularDamping(0.6)
        .setCcdEnabled(true),
    );
    world.createCollider(RAPIER.ColliderDesc.ball(r).setFriction(0.8), body);
    for (let k = 0; k < 60 * 15; k++) world.step();

    const p = body.translation();
    const floor = lossToWorldY(VALLEY.loss(p.x / 3, p.z / 3));
    expect(p.y).toBeGreaterThan(floor); // never tunnelled
    expect(p.y - floor).toBeLessThan(r * 1.6); // resting on the surface
    // Ended in the global basin it was dropped into.
    expect(Math.hypot(p.x - thetaToWorld(mx), p.z - thetaToWorld(mz))).toBeLessThan(1.5);
    world.free();
  });
});
