// src/components/scene/zones/SkewArchive.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { predictProb } from "@/domain/bias/archive";
import { PALETTE } from "@/design/palette";
import { fx } from "@/fx/bus";
import { REGION_B_X, sessionStore, useSession } from "@/state/sessionStore";

/*
 * PEDAGOGY — bias embodied in PERCEPTION, never in the body.
 * The surveyor walks normally everywhere. What changes is what it sees: within its
 * perception radius every person's cap shows the model's prediction. In group A's region
 * the caps match reality. Skew the training sample and walk east into group B's region:
 * caps start disagreeing with the pillars (red, flickering). The people didn't change;
 * the model's view of them did. Pillar HEIGHT is the true label, so truth is always
 * readable without colour.
 */

const S = 2.4; // feature unit → world unit
const toWorld = (x: number, y: number) => new THREE.Vector3(x * S, 0, -(y - 0.5) * S);
const toFeature = (X: number, Z: number) => [X / S, 0.5 - Z / S] as const;
const PERCEPTION_R = 3.4;
const TALL = 0.95;
const SHORT = 0.45;

function People() {
  const world = useSession((s) => s.archive.world);
  const bodies = useMemo(
    () =>
      new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.11, 0.13, 1, 8),
        new THREE.MeshStandardMaterial({ color: PALETTE.ridge, roughness: 0.6 }),
        world.length,
      ),
    [world.length],
  );
  const caps = useMemo(
    () =>
      new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.15, 12, 8),
        new THREE.MeshBasicMaterial({ toneMapped: false }),
        world.length,
      ),
    [world.length],
  );
  useEffect(
    () => () => {
      bodies.geometry.dispose();
      caps.geometry.dispose();
    },
    [bodies, caps],
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cYes = useMemo(() => new THREE.Color(PALETTE.rose), []);
  const cNo = useMemo(() => new THREE.Color(PALETTE.signal), []);
  const cWrong = useMemo(() => new THREE.Color(PALETTE.alarm), []);
  const cFar = useMemo(() => new THREE.Color(PALETTE.ridge), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const tmp2 = useMemo(() => new THREE.Color(), []);

  // Body layout only changes with the world (fixed seed), not per frame.
  useEffect(() => {
    world.forEach((p, i) => {
      const h = p.label === 1 ? TALL : SHORT;
      dummy.position.copy(toWorld(p.x, p.y)).setY(h / 2);
      dummy.scale.set(1, h, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
    });
    bodies.instanceMatrix.needsUpdate = true;
  }, [world, bodies, dummy]);

  useFrame(({ clock }) => {
    const { archive } = sessionStore.getState();
    const avatar = avatarPos;
    const t = clock.elapsedTime;
    world.forEach((p, i) => {
      const pos = toWorld(p.x, p.y);
      const h = p.label === 1 ? TALL : SHORT;
      const dist = Math.hypot(pos.x - avatar.x, pos.z - avatar.z);
      const seen = THREE.MathUtils.clamp((PERCEPTION_R - dist) / 0.8, 0, 1);
      const pred = predictProb(archive.model, p.x, p.y) > 0.5 ? 1 : 0;
      const wrong = pred !== p.label;
      // Deterministic flicker (no Math.random in the render path).
      const flick = wrong ? 0.75 + 0.25 * Math.sin(t * 22 + i * 1.7) : 1;
      dummy.position.copy(pos).setY(h + 0.12);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar((0.55 + 0.45 * seen) * (wrong ? flick : 1));
      dummy.updateMatrix();
      caps.setMatrixAt(i, dummy.matrix);
      tmp.copy(wrong ? cWrong : pred === 1 ? cYes : cNo);
      tmp2.copy(tmp);
      caps.setColorAt(i, tmp.lerpColors(cFar, tmp2, seen));
    });
    caps.instanceMatrix.needsUpdate = true;
    if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <primitive object={bodies} />
      <primitive object={caps} />
    </>
  );
}

/** The model's single line vs the true V, drawn on the floor. */
function Boundaries() {
  const model = useSession((s) => s.archive.model);
  const truth = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let x = -3.4; x <= 3.4001; x += 0.1) pts.push(toWorld(x, 0.7 * Math.abs(x) - 0.6).setY(0.02));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color: PALETTE.bone, dashSize: 0.25, gapSize: 0.18 }));
    line.computeLineDistances();
    return line;
  }, []);
  const fit = useMemo(() => {
    // Logistic boundary: w0 + w1·(x/2) + w2·(y/2) = 0  →  y = −2(w0 + w1·x/2)/w2
    const [w0, w1, w2] = model.w as [number, number, number];
    const pts: THREE.Vector3[] = [];
    if (Math.abs(w2) > 1e-6) {
      for (const x of [-3.6, 3.6]) {
        const y = THREE.MathUtils.clamp((-2 * (w0 + (w1 * x) / 2)) / w2, -3, 4);
        pts.push(toWorld(x, y).setY(0.03));
      }
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: PALETTE.rose, toneMapped: false }));
  }, [model]);
  useEffect(() => () => fit.geometry.dispose(), [fit]);
  useEffect(() => () => truth.geometry.dispose(), [truth]);

  return (
    <>
      <primitive object={truth} />
      <primitive object={fit} />
      <Html position={toWorld(-3.3, 0.7 * 3.3 - 0.6).setY(0.3).toArray()} center distanceFactor={18} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <span className="whitespace-nowrap text-[14px] text-bone/80">True rule, same for everyone</span>
      </Html>
    </>
  );
}

function Floor({ onWalk }: { onWalk: (p: THREE.Vector3) => void }) {
  const bx = REGION_B_X * S;
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          onWalk(e.point);
        }}
      >
        <planeGeometry args={[20, 16]} />
        <meshStandardMaterial color={PALETTE.void} roughness={0.95} />
      </mesh>
      {/* Region divide: a thin lit seam, labelled in words on both sides. */}
      <mesh position={[bx, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.04, 15]} />
        <meshBasicMaterial color={PALETTE.roseDim} />
      </mesh>
      <Html position={[bx - 4, 0.2, -6.6]} center distanceFactor={18} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <span className="whitespace-nowrap text-[15px] text-bone">Group A region</span>
      </Html>
      <Html position={[bx + 4, 0.2, -6.6]} center distanceFactor={18} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <span className="whitespace-nowrap text-[15px] text-bone">Group B region</span>
      </Html>
    </group>
  );
}

/** Shared avatar position (world), read by People's perception test every frame. */
const avatarPos = new THREE.Vector3(-4.2, 0, 0.5);

/**
 * The Surveyor. Spring-driven locomotion (critically damped, so it never overshoots
 * the click), anticipation lean into acceleration, squash on stopping, eased facing.
 */
function Surveyor({ target }: { target: React.MutableRefObject<THREE.Vector3> }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const vel = useRef(new THREE.Vector3());
  const facing = useRef(Math.PI / 2);
  const squash = useRef(0);
  const prevSpeed = useRef(0);

  const toT = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, rawDt) => {
    // Fixed 1/120 s substeps: the spring stays stable AND real time is honoured, so a
    // slow device walks at the same speed as a fast one (a clamped dt would slow-mo it).
    const dt = Math.min(rawDt, 0.25);
    const k = 18; // stiffness
    const c = 2 * Math.sqrt(k); // critical damping
    const maxV = 4.2;
    const H = 1 / 120;
    for (let tLeft = dt; tLeft > 1e-6; tLeft -= H) {
      const h = Math.min(H, tLeft);
      toT.copy(target.current).sub(avatarPos).setY(0).multiplyScalar(k).addScaledVector(vel.current, -c);
      vel.current.addScaledVector(toT, h);
      if (vel.current.length() > maxV) vel.current.setLength(maxV);
      avatarPos.addScaledVector(vel.current, h);
    }

    const speed = vel.current.length();
    // Squash when decelerating hard (stop), recover with a damped bounce.
    if (prevSpeed.current - speed > 2.2 * dt * 10 && speed < 0.6) squash.current = 1;
    prevSpeed.current = speed;
    squash.current *= Math.exp(-dt * 7);
    const sq = squash.current * Math.cos((1 - squash.current) * 9);

    if (speed > 0.15) {
      let d = Math.atan2(vel.current.x, vel.current.z) - facing.current;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      facing.current += d * (1 - Math.exp(-dt * 9));
    }
    const t = clock.elapsedTime;
    if (root.current) {
      root.current.position.copy(avatarPos);
      root.current.rotation.y = facing.current;
    }
    if (body.current) {
      const step = Math.min(1, speed / maxV);
      body.current.position.y = 0.55 + Math.abs(Math.sin(t * 11)) * 0.08 * step;
      body.current.rotation.x = step * 0.28; // lean into motion (anticipation)
      body.current.scale.set(1 + sq * 0.12, 1 - sq * 0.16, 1 + sq * 0.12);
    }
    if (ring.current) ring.current.position.set(avatarPos.x, 0.02, avatarPos.z);

    const [fxX] = toFeature(avatarPos.x, avatarPos.z);
    sessionStore.getState().setAvatarInB(fxX > REGION_B_X);
  });

  return (
    <>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[PERCEPTION_R - 0.06, PERCEPTION_R, 64]} />
        <meshBasicMaterial color={PALETTE.rose} transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <group ref={root}>
        <group ref={body}>
          <mesh>
            <capsuleGeometry args={[0.24, 0.5, 6, 16]} />
            <meshStandardMaterial color={PALETTE.bone} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.2, 20, 14]} />
            <meshStandardMaterial color={PALETTE.bone} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.52, 0.17]}>
            <boxGeometry args={[0.26, 0.07, 0.05]} />
            <meshBasicMaterial color={PALETTE.rose} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </>
  );
}

export function SkewArchive() {
  const target = useRef(avatarPos.clone());
  const gapDetected = useSession((s) => s.archive.gapPts >= 12 && s.avatarInB);
  useEffect(() => {
    if (gapDetected) fx.emit({ kind: "shock", at: avatarPos.toArray(), color: PALETTE.alarm, radius: PERCEPTION_R });
  }, [gapDetected]);

  return (
    <>
      <hemisphereLight args={[PALETTE.bone, PALETTE.void, 0.9]} />
      <directionalLight position={[-4, 10, 6]} intensity={1.2} />
      <Floor onWalk={(p) => target.current.set(p.x, 0, p.z)} />
      <Boundaries />
      <People />
      <Surveyor target={target} />
    </>
  );
}
