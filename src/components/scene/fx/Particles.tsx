// src/components/scene/fx/Particles.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { mulberry32 } from "@/domain/rng";
import { PALETTE } from "@/design/palette";
import { fx, type FxEvent } from "@/fx/bus";

/*
 * Event-driven VFX. Gameplay emits on the fx bus; this layer owns the look.
 *  - rise:  glowing tokens drifting up and fading (a correct outcome: convergence,
 *           a sampled word, a fitted network, XP)
 *  - shock: an expanding ring on the ground (an error event: the loss went up, blame
 *           leaving the output layer, the model failing a group)
 * Pools are fixed-size and allocation-free in the frame loop. Spawn jitter comes from a
 * seeded RNG, so the same event always produces the same burst.
 */

const MAX_P = 480;
const MAX_RINGS = 8;

interface P {
  life: number; // remaining seconds; ≤ 0 = free
  max: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
}

interface Ring {
  life: number;
  max: number;
  radius: number;
  mesh: THREE.Mesh;
}

export function Particles() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const rand = useRef(mulberry32(1337));
  const reduce = useRef(false);

  const pool = useMemo<P[]>(
    () =>
      Array.from({ length: MAX_P }, () => ({
        life: 0,
        max: 1,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        color: new THREE.Color(),
      })),
    [],
  );

  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.1, 0),
      new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_P,
    );
    m.frustumCulled = false;
    m.setColorAt(0, new THREE.Color());
    return m;
  }, []);

  const rings = useMemo<Ring[]>(
    () =>
      Array.from({ length: MAX_RINGS }, () => {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.9, 1, 64),
          new THREE.MeshBasicMaterial({
            toneMapped: false,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.visible = false;
        return { life: 0, max: 0.8, radius: 1, mesh: ring };
      }),
    [],
  );
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      rings.forEach((r) => (r.mesh.geometry.dispose(), (r.mesh.material as THREE.Material).dispose()));
    },
    [mesh, rings],
  );

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spawnRise = (at: readonly number[], color: string, count: number) => {
      const c = new THREE.Color(color);
      let made = 0;
      for (const p of pool) {
        if (made >= count) break;
        if (p.life > 0) continue;
        const r = rand.current;
        const a = r() * Math.PI * 2;
        const s = 0.4 + r() * 1.1;
        p.pos.set(at[0]! + Math.cos(a) * 0.15, at[1]!, at[2]! + Math.sin(a) * 0.15);
        p.vel.set(Math.cos(a) * s, 1.6 + r() * 2.2, Math.sin(a) * s);
        p.max = p.life = 1.1 + r() * 0.9;
        p.color.copy(c);
        made++;
      }
    };
    const spawnShock = (at: readonly number[], color: string, radius: number) => {
      const ring = rings.find((r) => r.life <= 0) ?? rings[0]!;
      ring.life = ring.max = 0.85;
      ring.radius = radius;
      ring.mesh.position.set(at[0]!, at[1]! + 0.05, at[2]!);
      (ring.mesh.material as THREE.MeshBasicMaterial).color.set(color);
      ring.mesh.visible = true;
    };
    return fx.on((e: FxEvent) => {
      if (reduce.current) return; // reduced motion: outcomes still show in the HUD, without bursts
      if (e.kind === "rise") spawnRise(e.at, e.color, e.count ?? 24);
      else if (e.kind === "shock") spawnShock(e.at, e.color, e.radius ?? 1.5);
      else if (e.kind === "reward") {
        const t = controls?.target ?? new THREE.Vector3();
        spawnRise([t.x, t.y + 0.5, t.z], PALETTE.bio, 40);
      }
    });
  }, [pool, rings, controls]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const black = useMemo(() => new THREE.Color(0, 0, 0), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    pool.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt;
        p.vel.multiplyScalar(Math.exp(-dt * 1.6)); // drag
        p.vel.y -= 0.6 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const k = Math.max(0, p.life / p.max);
        dummy.position.copy(p.pos);
        dummy.rotation.set(p.life * 3, p.life * 5, 0);
        dummy.scale.setScalar(0.4 + k * 0.9);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, tmp.copy(p.color).multiplyScalar(k * 1.6)); // fades to black (additive → invisible)
      } else {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, black);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    for (const r of rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const u = 1 - Math.max(0, r.life) / r.max;
      const e = 1 - Math.pow(1 - u, 3); // fast out, slow settle
      r.mesh.scale.setScalar(0.05 + e * r.radius);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.9;
      if (r.life <= 0) r.mesh.visible = false;
    }
  });

  return (
    <>
      <primitive object={mesh} />
      {rings.map((r, i) => (
        <primitive key={i} object={r.mesh} />
      ))}
    </>
  );
}
