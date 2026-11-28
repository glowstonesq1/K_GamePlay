// src/components/scene/Scene.tsx
"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraShake, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { ZoneId } from "@/domain/zones";
import { PALETTE } from "@/design/palette";
import { useGame } from "@/state/gameStore";
import { sessionStore, useSession, type Place } from "@/state/sessionStore";
import { MultiverseHub } from "@/components/hub/MultiverseHub";
import { CosmicHub } from "@/components/worlds/CosmicHub";
import { Particles } from "./fx/Particles";
import { PostFX } from "./fx/PostFX";
import { BackpropForge } from "./zones/BackpropForge";
import { LossValley } from "./zones/LossValley";
import { SkewArchive } from "./zones/SkewArchive";
import { TokenForest } from "./zones/TokenForest";

type V3 = [number, number, number];
const VIEWS: Record<ZoneId, { pos: V3; target: V3 }> = {
  hub: { pos: [0, 3.4, 13], target: [0, 1.6, -1.5] },
  "loss-valley": { pos: [13, 13, 15], target: [0, 1.5, 0] },
  "backprop-forge": { pos: [0, 7.5, 12.5], target: [0, 1.6, -1.5] },
  "token-dunes": { pos: [0, 11, 22], target: [0, 3.2, -1] },
  "skew-archive": { pos: [0, 14, 12], target: [0, 0, 0.5] },
};

/** The Multiverse Hub: eye level with the avatar, portals arcing behind it. */
const MULTIVERSE_VIEW = { pos: [0, 2.6, 9.4] as V3, target: [0, 1.15, -1.5] as V3 };

/**
 * Establishing shot for a place at this aspect ratio. Portrait screens see less sideways,
 * so the hubs dolly back along their view axis until the outer nodes / portals fit.
 */
function viewFor(place: Place, aspect: number) {
  const isMulti = place.universe === "hub";
  const v = isMulti ? MULTIVERSE_VIEW : VIEWS[place.zone];
  const pos = new THREE.Vector3(...v.pos);
  const target = new THREE.Vector3(...v.target);
  const wide = isMulti || place.zone === "hub";
  if (wide && aspect < 1.3) pos.sub(target).multiplyScalar(Math.min(2.4, 1.3 / aspect)).add(target);
  return { pos, target };
}

const FOV = 50;
const WARP_FOV = 86;
const DIVE_MS = 950;
const EMERGE_MS = 1300;

const easeInCubic = (u: number) => u * u * u;
const easeOutQuint = (u: number) => 1 - Math.pow(1 - u, 5);

/**
 * The portal, in two shots.
 *
 * DIVE: ease-in toward the node (accelerating: you are being pulled, not driving), FOV
 * widening 50° → 86° so the periphery streaks. Going home there is no node to aim at,
 * so the camera rises and pulls back along its own view axis instead.
 * EMERGE: the world switches under a full-screen flash (drawn by the HUD), then the camera
 * starts 35 % further out at warp FOV and eases out onto the establishing shot.
 *
 * All motion is a pure function of elapsed time, so a dropped frame costs smoothness, never
 * position. With reduced motion both shots take 0 ms: the flash cross-fade is all you see.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const zone = useGame((s) => s.currentZone);
  const universe = useGame((s) => s.universe);
  const portal = useSession((s) => s.portal);
  const shot = useRef<{
    t0: number;
    dur: number;
    fromPos: THREE.Vector3;
    fromTgt: THREE.Vector3;
    toPos: THREE.Vector3;
    toTgt: THREE.Vector3;
    fov0: number;
    fov1: number;
    ease: (u: number) => number;
    done: () => void;
  } | null>(null);

  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // First paint and plain zone changes (e.g. a restored save): a short settle, no portal.
  useEffect(() => {
    if (sessionStore.getState().portal) return;
    const v = viewFor({ universe, zone }, camera.aspect);
    shot.current = {
      t0: performance.now(),
      dur: reduce() ? 0 : 1100,
      fromPos: camera.position.clone(),
      fromTgt: controls?.target.clone() ?? new THREE.Vector3(),
      toPos: v.pos,
      toTgt: v.target,
      fov0: camera.fov,
      fov1: FOV,
      ease: easeOutQuint,
      done: () => {},
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, universe, controls]);

  useEffect(() => {
    if (!portal) return;
    const fromPos = camera.position.clone();
    const fromTgt = controls?.target.clone() ?? new THREE.Vector3();

    if (portal.phase === "dive") {
      let toPos: THREE.Vector3;
      let toTgt: THREE.Vector3;
      if (portal.at) {
        const node = new THREE.Vector3(...portal.at);
        // Stop just short of the core so the halo fills the frame at the cut.
        toPos = node.clone().add(fromPos.clone().sub(node).setLength(0.55));
        toTgt = node;
      } else {
        const back = fromPos.clone().sub(fromTgt).multiplyScalar(0.9);
        toPos = fromPos.clone().add(back).add(new THREE.Vector3(0, 6, 0));
        toTgt = fromTgt.clone().add(new THREE.Vector3(0, 4, 0));
      }
      shot.current = {
        t0: performance.now(),
        dur: reduce() ? 0 : DIVE_MS,
        fromPos,
        fromTgt,
        toPos,
        toTgt,
        fov0: camera.fov,
        fov1: WARP_FOV,
        ease: easeInCubic,
        done: () => sessionStore.getState().commitPortal(),
      };
    } else {
      const v = viewFor(portal.to, camera.aspect);
      const toPos = v.pos;
      const toTgt = v.target;
      const start = toTgt.clone().add(toPos.clone().sub(toTgt).multiplyScalar(1.35));
      camera.position.copy(start);
      controls?.target.copy(toTgt);
      shot.current = {
        t0: performance.now(),
        dur: reduce() ? 0 : EMERGE_MS,
        fromPos: start,
        fromTgt: toTgt.clone(),
        toPos,
        toTgt,
        fov0: WARP_FOV,
        fov1: FOV,
        ease: easeOutQuint,
        done: () => sessionStore.getState().endPortal(),
      };
    }
  }, [portal, camera, controls]);

  useFrame(() => {
    const s = shot.current;
    if (!s) return;
    const u = s.dur === 0 ? 1 : Math.min(1, (performance.now() - s.t0) / s.dur);
    const e = s.ease(u);
    camera.position.lerpVectors(s.fromPos, s.toPos, e);
    controls?.target.lerpVectors(s.fromTgt, s.toTgt, e);
    camera.fov = THREE.MathUtils.lerp(s.fov0, s.fov1, e);
    camera.updateProjectionMatrix();
    controls?.update();
    if (u >= 1) {
      shot.current = null;
      s.done();
    }
  }, -1);

  return null;
}

/** Handheld tremor that builds through the dive and is gone by the time you land. */
function PortalShake() {
  const ref = useRef<{ setIntensity: (n: number) => void } | null>(null);
  const t0 = useRef(0);
  useFrame(() => {
    const p = sessionStore.getState().portal;
    if (!ref.current) return;
    if (!p) {
      t0.current = 0;
      ref.current.setIntensity(0);
      return;
    }
    if (t0.current === 0) t0.current = performance.now();
    const k = Math.min(1, (performance.now() - t0.current) / DIVE_MS);
    ref.current.setIntensity(p.phase === "dive" ? k * k * 0.6 : Math.max(0, 0.6 - k));
  });
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return null;
  return (
    <CameraShake
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      intensity={0}
      maxYaw={0.03}
      maxPitch={0.03}
      maxRoll={0.04}
      yawFrequency={6}
      pitchFrequency={7}
      rollFrequency={5}
    />
  );
}

export function Scene() {
  const universe = useGame((s) => s.universe);
  const echo = useGame((s) => s.echo);
  const inAi = universe === "ai";
  // Outside the AI universe no world is mounted; the Observatory just hides (see CosmicHub).
  const zone = useGame((s) => (s.universe === "ai" ? s.currentZone : "hub"));
  const transitioning = useSession((s) => s.portal !== null);

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: VIEWS.hub.pos, fov: FOV }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[PALETTE.void]} />
        <fog attach="fog" args={[PALETTE.void, zone === "hub" ? 40 : 18, zone === "hub" ? 120 : 48]} />
        {!inAi ? null : zone === "loss-valley" ? (
          <Suspense fallback={null}>
            <LossValley />
          </Suspense>
        ) : zone === "token-dunes" ? (
          <TokenForest />
        ) : zone === "backprop-forge" ? (
          <BackpropForge />
        ) : zone === "skew-archive" ? (
          <SkewArchive />
        ) : null}
        {/* Curiosity mode borrows the Observatory's sky but none of its doors. */}
        <CosmicHub active={inAi && zone === "hub" && echo === "architect"} />
        <MultiverseHub active={universe === "hub"} />
        <Particles />
        <PostFX />
        <OrbitControls
          makeDefault
          enabled={!transitioning && universe !== "hub"}
          enableDamping
          maxPolarAngle={zone === "hub" ? Math.PI * 0.62 : Math.PI / 2.15}
          minDistance={zone === "hub" ? 0.3 : 6}
          maxDistance={zone === "hub" ? 34 : 38}
        />
        <CameraRig />
        <PortalShake />
      </Canvas>
    </div>
  );
}
