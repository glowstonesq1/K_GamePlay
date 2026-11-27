// src/components/scene/Scene.tsx
"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { ZoneId } from "@/domain/zones";
import { PALETTE } from "@/design/palette";
import { useGame } from "@/state/gameStore";
import { BioGrid } from "./BioGrid";
import { LossValley } from "./zones/LossValley";
import { TokenDunes } from "./zones/TokenDunes";

const VIEWS: Record<ZoneId, { pos: [number, number, number]; target: [number, number, number] }> = {
  hub: { pos: [8, 6, 8], target: [0, 0, 0] },
  "loss-valley": { pos: [13, 13, 15], target: [0, 1.5, 0] },
  "backprop-forge": { pos: [8, 6, 8], target: [0, 0, 0] },
  "token-dunes": { pos: [0, 14, 17], target: [0, 1.5, 0] },
  "skew-archive": { pos: [8, 6, 8], target: [0, 0, 0] },
};

/** Glide the camera to each zone's establishing shot; the player can orbit freely after. */
function CameraRig({ zone }: { zone: ZoneId }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const anim = useRef<number | null>(null);

  useEffect(() => {
    const view = VIEWS[zone];
    const fromPos = camera.position.clone();
    const fromTgt = controls?.target.clone() ?? new THREE.Vector3();
    const toPos = new THREE.Vector3(...view.pos);
    const toTgt = new THREE.Vector3(...view.target);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = reduce ? 0 : 1100;
    const t0 = performance.now();

    const tick = () => {
      const u = dur === 0 ? 1 : Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - u, 3); // ease-out cubic
      camera.position.lerpVectors(fromPos, toPos, e);
      controls?.target.lerpVectors(fromTgt, toTgt, e);
      controls?.update();
      if (u < 1) anim.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (anim.current) cancelAnimationFrame(anim.current);
    };
  }, [zone, camera, controls]);

  return null;
}

export function Scene() {
  const zone = useGame((s) => s.currentZone);

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [8, 6, 8], fov: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[PALETTE.void]} />
        <fog attach="fog" args={[PALETTE.void, 18, 48]} />
        {zone === "loss-valley" ? (
          <Suspense fallback={null}>
            <LossValley />
          </Suspense>
        ) : zone === "token-dunes" ? (
          <TokenDunes />
        ) : (
          <BioGrid />
        )}
        <OrbitControls
          makeDefault
          enableDamping
          maxPolarAngle={Math.PI / 2.15}
          minDistance={6}
          maxDistance={38}
        />
        <CameraRig zone={zone} />
      </Canvas>
    </div>
  );
}
