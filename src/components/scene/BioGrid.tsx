"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import * as THREE from "three";

const SECTION_COLOR = "#39ffb0";

export function BioGrid() {
  const ref = useRef<THREE.Mesh>(null);
  const base = useRef(new THREE.Color(SECTION_COLOR));

  useFrame(({ clock }) => {
    const material = ref.current?.material as THREE.ShaderMaterial | undefined;
    const uniform = material?.uniforms?.sectionColor;
    if (!uniform) return;
    const k = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 1.2);
    (uniform.value as THREE.Color).copy(base.current).multiplyScalar(k);
  });

  useEffect(() => {
    const material = ref.current?.material as THREE.ShaderMaterial | undefined;
    const uniform = material?.uniforms?.sectionColor;
    if (uniform) (uniform.value as THREE.Color).copy(base.current);
  }, []);

  return (
    <Grid
      ref={ref}
      infiniteGrid
      cellSize={0.5}
      sectionSize={2.5}
      cellThickness={0.6}
      sectionThickness={1.2}
      cellColor="#1a7a55"
      sectionColor={SECTION_COLOR}
      fadeDistance={35}
      fadeStrength={1.5}
      followCamera={false}
    />
  );
}
