// src/components/scene/zones/LossValley.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { BallCollider, HeightfieldCollider, Physics, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { VALLEY } from "@/domain/loss/presets";
import { gdStep, type GdState } from "@/domain/optim/gd";
import { PALETTE } from "@/design/palette";
import {
  lossToWorldY,
  sampleTerrain,
  thetaToWorld,
  toRapierHeightfield,
  worldToTheta,
} from "@/physics/heightfield";
import { gameStore } from "@/state/gameStore";
import { sessionStore, useSession } from "@/state/sessionStore";
import { createGridGeometry, createTerrainMaterial } from "../terrainMaterial";

const GRID_N = 160;
const PROBE_R = 0.22;
const TRAIL_MAX = 4000;
const BASE_STEPS_PER_SEC = 12;
const STORE_HZ = 20;

function Terrain() {
  const { geometry, material, hf } = useMemo(() => {
    const grid = sampleTerrain(VALLEY, GRID_N);
    return {
      geometry: createGridGeometry(grid.n, grid.size, grid.heights, grid.loss),
      material: createTerrainMaterial({ valueMax: VALLEY.lossMax, contourStep: 0.25 }),
      hf: toRapierHeightfield(grid),
    };
  }, []);
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // that was an orbit drag, not a click
    e.stopPropagation();
    sessionStore.getState().placeProbe([worldToTheta(e.point.x), worldToTheta(e.point.z)]);
  };

  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh geometry={geometry} material={material} onClick={onClick} />
      <HeightfieldCollider
        args={[hf.nrows, hf.ncols, Array.from(hf.heights), hf.scale]}
        friction={0.9}
      />
    </RigidBody>
  );
}

/**
 * The GD probe. Pure math, not physics: it moves only by θ ← θ − η∇L, rendered on the
 * surface. The loop runs here (not in React state) and mirrors to the store at ~20 Hz.
 */
function Probe() {
  const mesh = useRef<THREE.Mesh>(null);
  const sim = useRef<GdState | null>(null);
  const lastWritten = useRef<GdState | null>(null);
  const acc = useRef(0);
  const sinceWrite = useRef(0);

  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    g.setDrawRange(0, 0);
    const m = new THREE.LineBasicMaterial({ color: PALETTE.signal, transparent: true, opacity: 0.85 });
    return { line: new THREE.Line(g, m), count: { n: 0 } };
  }, []);
  useEffect(() => () => (trail.line.geometry.dispose(), (trail.line.material as THREE.Material).dispose()), [trail]);

  const pushTrail = (s: GdState) => {
    const attr = trail.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    if (trail.count.n >= TRAIL_MAX) {
      arr.copyWithin(0, 3); // drop the oldest point
      trail.count.n = TRAIL_MAX - 1;
    }
    const k = trail.count.n * 3;
    arr[k] = thetaToWorld(s.theta[0]);
    arr[k + 1] = lossToWorldY(s.loss) + 0.04;
    arr[k + 2] = thetaToWorld(s.theta[1]);
    trail.count.n++;
    attr.needsUpdate = true;
    trail.line.geometry.setDrawRange(0, trail.count.n);
  };

  useFrame((_, dt) => {
    const session = sessionStore.getState();
    const external = session.probe;

    // Placed or reset from outside the loop: adopt it and restart the trail.
    if (external !== lastWritten.current) {
      sim.current = external;
      lastWritten.current = external;
      trail.count.n = 0;
      if (external) pushTrail(external);
      else trail.line.geometry.setDrawRange(0, 0);
    }

    const s0 = sim.current;
    if (mesh.current) mesh.current.visible = s0 !== null;
    if (!s0) return;

    if (session.running) {
      const eta = gameStore.getState().learningRate;
      acc.current += Math.min(dt, 0.1) * BASE_STEPS_PER_SEC * session.speed;
      let s = s0;
      let n = Math.min(Math.floor(acc.current), 2000);
      acc.current -= n;
      while (n-- > 0 && (s.status === "running" || s.status === "idle")) {
        s = gdStep(VALLEY, s, eta);
        pushTrail(s);
      }
      sim.current = s;

      sinceWrite.current += dt;
      const ended = s.status === "converged" || s.status === "diverged";
      if (ended || sinceWrite.current > 1 / STORE_HZ) {
        sinceWrite.current = 0;
        lastWritten.current = s;
        session.setProbe(s);
        if (ended) session.setRunning(false);
        if (s.status === "converged") session.award("valley.first-descent");
        if (s.rises > 0) session.award("valley.diverge");
      }
    }

    const s = sim.current!;
    mesh.current?.position.set(
      thetaToWorld(s.theta[0]),
      lossToWorldY(s.loss) + PROBE_R,
      thetaToWorld(s.theta[1]),
    );
  });

  return (
    <>
      <primitive object={trail.line} />
      <mesh ref={mesh} visible={false}>
        <sphereGeometry args={[PROBE_R, 24, 16]} />
        <meshBasicMaterial color={PALETTE.signal} toneMapped={false} />
      </mesh>
    </>
  );
}

/**
 * A real rolling ball, simulated by Rapier, released from the probe's start point.
 *
 * PEDAGOGY: A ball rolling under gravity with friction is NOT plain gradient descent. It
 * carries velocity, which is gradient descent with *momentum* (Polyak's heavy ball):
 *     v ← βv − η∇L,  θ ← θ + v      (friction ↔ 1 − β)
 * It coasts through shallow dips that would trap the GD probe, and overshoots basins
 * that GD would settle into. Racing the two is the point.
 * (Caveat: on a steep surface the physical ball follows the surface, not the θ-plane
 * gradient exactly; on these gentle slopes the analogy holds.)
 */
function HeavyBall() {
  const seq = useSession((s) => s.ballSeq);
  const start = useSession((s) => s.ballStart);
  if (seq === 0 || !start) return null;
  const x = thetaToWorld(start[0]);
  const z = thetaToWorld(start[1]);
  return (
    <RigidBody
      key={seq}
      position={[x, lossToWorldY(VALLEY.loss(start[0], start[1])) + 1.2, z]}
      colliders={false}
      ccd
      linearDamping={0.25}
      angularDamping={0.4}
    >
      <BallCollider args={[0.3]} friction={0.9} restitution={0.05} />
      <mesh>
        <sphereGeometry args={[0.3, 24, 16]} />
        <meshBasicMaterial color={PALETTE.bone} />
      </mesh>
    </RigidBody>
  );
}

export function LossValley() {
  return (
    <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
      <Terrain />
      <HeavyBall />
      <Probe />
    </Physics>
  );
}
