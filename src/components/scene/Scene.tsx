"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BioGrid } from "./BioGrid";

export function Scene() {
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [8, 6, 8], fov: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#05070a"]} />
        <fog attach="fog" args={["#05070a", 12, 40]} />
        <BioGrid />
        <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}
