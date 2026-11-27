// src/components/scene/zones/LossValley.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { BallCollider, HeightfieldCollider, Physics, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { VALLEY } from "@/domain/loss/presets";
import { gradientField } from "@/domain/loss/field";
import { gdStep, type GdState } from "@/domain/optim/gd";
import { PALETTE } from "@/design/palette";
import { fx } from "@/fx/bus";
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
const TRAIL_MAX = 4000;
const BASE_STEPS_PER_SEC = 12;
const STORE_HZ = 20;

const surface = (tx: number, tz: number, lift = 0) =>
  new THREE.Vector3(thetaToWorld(tx), lossToWorldY(VALLEY.loss(tx, tz)) + lift, thetaToWorld(tz));

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
      <HeightfieldCollider args={[hf.nrows, hf.ncols, Array.from(hf.heights), hf.scale]} friction={0.9} />
    </RigidBody>
  );
}

/* ------------------------------------------------------------------ Guide */

const LINES = {
  idle: "Drop me anywhere. I only feel the slope under my feet.",
  running: "Steepest way down is this way. That's all I know.",
  rising: "That step overshot. The ground came up to meet me.",
  global: "Flat in every direction, and nothing lower anywhere. Lucky.",
  local: "Flat in every direction. This must be the bottom… right?",
  diverged: "I've lost the map entirely.",
} as const;

/**
 * The Gradient Guide: an NPC that IS the gradient-descent probe. Its only sense is the
 * local slope: the heading cone points along −∇L and grows with ‖∇L‖. It never looks
 * ahead. Movement is the sim loop's θ ← θ − η∇L, rendered with eased facing and a bob.
 */
function Guide() {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const cone = useRef<THREE.Mesh>(null);
  const sim = useRef<GdState | null>(null);
  const lastWritten = useRef<GdState | null>(null);
  const acc = useRef(0);
  const sinceWrite = useRef(0);
  const lastShock = useRef(-10);
  const lastStatus = useRef<string>("idle");
  const heading = useRef(0);
  const probe = useSession((s) => s.probe);

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
      arr.copyWithin(0, 3);
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

  useFrame(({ clock }, dt) => {
    const session = sessionStore.getState();
    const external = session.probe;
    if (external !== lastWritten.current) {
      sim.current = external;
      lastWritten.current = external;
      trail.count.n = 0;
      if (external) pushTrail(external);
      else trail.line.geometry.setDrawRange(0, 0);
    }
    const s0 = sim.current;
    if (root.current) root.current.visible = s0 !== null;
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
      const t = clock.elapsedTime;
      if (s.rises > s0.rises && t - lastShock.current > 0.6) {
        lastShock.current = t;
        fx.emit({ kind: "shock", at: surface(s.theta[0], s.theta[1], 0.05).toArray(), color: PALETTE.alarm, radius: 1.6 });
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
      if (s.status === "converged" && lastStatus.current !== "converged") {
        fx.emit({ kind: "rise", at: surface(s.theta[0], s.theta[1], 0.3).toArray(), color: PALETTE.bio, count: 36 });
      }
      lastStatus.current = s.status;
    }

    const s = sim.current!;
    const [gx, gz] = VALLEY.grad(s.theta[0], s.theta[1]);
    const mag = Math.hypot(gx, gz);
    if (mag > 1e-6) {
      // Face −∇L. Shortest-arc eased turn so it never snaps.
      const target = Math.atan2(-gx, -gz);
      let d = target - heading.current;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      heading.current += d * (1 - Math.exp(-dt * 10));
    }
    root.current!.position.copy(surface(s.theta[0], s.theta[1]));
    root.current!.rotation.y = heading.current;
    if (cone.current) {
      const len = Math.min(1.6, 0.25 + Math.sqrt(mag) * 0.7);
      cone.current.scale.set(1, len, 1);
      cone.current.position.z = 0.25 + len * 0.25;
      cone.current.visible = s.status !== "converged";
    }
    if (body.current) {
      const moving = session.running ? 1 : 0;
      const t = clock.elapsedTime;
      body.current.position.y = 0.32 + moving * Math.abs(Math.sin(t * 9)) * 0.06;
      body.current.rotation.x = moving * 0.18; // lean into the walk
    }
  });

  const line = !probe
    ? LINES.idle
    : probe.status === "diverged"
      ? LINES.diverged
      : probe.status === "converged"
        ? probe.loss - VALLEY.minima[0]!.loss > 0.05
          ? LINES.local
          : LINES.global
        : probe.rises > 0
          ? LINES.rising
          : probe.status === "running"
            ? LINES.running
            : LINES.idle;

  return (
    <>
      <primitive object={trail.line} />
      <group ref={root} visible={false} scale={1.8}>
        <group ref={body}>
          <mesh position={[0, 0, 0]}>
            <capsuleGeometry args={[0.16, 0.26, 6, 14]} />
            <meshStandardMaterial color={PALETTE.ridge} roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.3, 0.02]}>
            <sphereGeometry args={[0.15, 20, 14]} />
            <meshStandardMaterial color={PALETTE.ridge} roughness={0.4} metalness={0.4} />
          </mesh>
          {/* Visor: the guide's single sense organ, facing downhill. */}
          <mesh position={[0, 0.31, 0.13]}>
            <boxGeometry args={[0.2, 0.06, 0.04]} />
            <meshBasicMaterial color={PALETTE.signal} toneMapped={false} />
          </mesh>
        </group>
        <mesh ref={cone} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.06, 0.4]}>
          <coneGeometry args={[0.09, 0.5, 12]} />
          <meshBasicMaterial color={PALETTE.signal} toneMapped={false} transparent opacity={0.9} />
        </mesh>
        {/* Html ignores parent visibility, so only mount the bubble once the guide exists. */}
        {probe && (
          <Html position={[0, 1.0, 0]} center distanceFactor={11} zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
            <p className="w-[17rem] border border-line bg-panel/85 px-3 py-2 text-center text-[15px] leading-snug text-bone">
              {line}
            </p>
          </Html>
        )}
      </group>
    </>
  );
}

/* ------------------------------------------------------------- Slope field */

/**
 * Arrows of −∇L across the map. Long and bright = steep; short and dim = nearly flat.
 * They converge on basins and part along ridges (watersheds).
 */
function SlopeField() {
  const show = useSession((s) => s.showField);
  const mesh = useMemo(() => {
    const arrows = gradientField(VALLEY, 17);
    const geo = new THREE.ConeGeometry(0.07, 0.5, 8);
    geo.rotateX(Math.PI / 2); // point along +Z
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.9 });
    const m = new THREE.InstancedMesh(geo, mat, arrows.length);
    const maxMag = Math.max(...arrows.map((a) => a.mag));
    const dummy = new THREE.Object3D();
    const lo = new THREE.Color(PALETTE.bioDim);
    const hi = new THREE.Color(PALETTE.bio);
    arrows.forEach((a, i) => {
      dummy.position.copy(surface(a.theta[0], a.theta[1], 0.12));
      dummy.rotation.set(0, Math.atan2(a.dir[0], a.dir[1]), 0);
      const k = Math.sqrt(a.mag / maxMag);
      dummy.scale.setScalar(0.4 + 1.2 * k);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, lo.clone().lerp(hi, k));
    });
    return m;
  }, []);
  useEffect(() => () => (mesh.geometry.dispose(), (mesh.material as THREE.Material).dispose()), [mesh]);
  return <primitive object={mesh} visible={show} />;
}

/* ------------------------------------------------------------------ Oracle */

/** The full-knowledge route, drawn on the surface after the run, growing from the start. */
function OracleRoute() {
  const oracle = useSession((s) => s.oracle);
  const reveal = useRef(0);
  const built = useMemo(() => {
    if (!oracle) return null;
    const pts = oracle.points.map(([x, z]) => surface(x, z, 0.08));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    g.setDrawRange(0, 0);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: PALETTE.bio, toneMapped: false }));
    return { line, count: pts.length, end: pts.at(-1)! };
  }, [oracle]);
  useEffect(() => {
    reveal.current = 0;
    return () => {
      built?.line.geometry.dispose();
      (built?.line.material as THREE.Material | undefined)?.dispose();
    };
  }, [built]);

  useFrame((_, dt) => {
    if (!built) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reveal.current = reduce ? 1 : Math.min(1, reveal.current + dt / 1.4);
    built.line.geometry.setDrawRange(0, Math.ceil(built.count * reveal.current));
  });

  if (!built) return null;
  return (
    <>
      <primitive object={built.line} />
      <mesh position={built.end} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.45, 40]} />
        <meshBasicMaterial color={PALETTE.bio} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/* -------------------------------------------------------------- Heavy ball */

/**
 * A real rolling ball, simulated by Rapier, released from the guide's start point.
 *
 * PEDAGOGY: A ball rolling under gravity with friction is NOT plain gradient descent. It
 * carries velocity, which is gradient descent with *momentum* (Polyak's heavy ball):
 *     v ← βv − η∇L,  θ ← θ + v      (friction ↔ 1 − β)
 * It coasts through shallow dips that would trap the guide, and overshoots basins the
 * guide would settle into. Racing the two is the point.
 */
function HeavyBall() {
  const seq = useSession((s) => s.ballSeq);
  const start = useSession((s) => s.ballStart);
  if (seq === 0 || !start) return null;
  const p = surface(start[0], start[1], 1.2);
  return (
    <RigidBody key={seq} position={p.toArray()} colliders={false} ccd linearDamping={0.25} angularDamping={0.4}>
      <BallCollider args={[0.3]} friction={0.9} restitution={0.05} />
      <mesh>
        <sphereGeometry args={[0.3, 24, 16]} />
        <meshStandardMaterial color={PALETTE.bone} roughness={0.35} metalness={0.1} />
      </mesh>
    </RigidBody>
  );
}

export function LossValley() {
  return (
    <>
      <hemisphereLight args={[PALETTE.bone, PALETTE.void, 0.9]} />
      <directionalLight position={[6, 12, 4]} intensity={1.4} />
      <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
        <Terrain />
        <HeavyBall />
      </Physics>
      <SlopeField />
      <OracleRoute />
      <Guide />
    </>
  );
}
