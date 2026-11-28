// src/components/hub/Avatar.tsx
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AvatarDef } from "@/domain/omnis/avatars";
import type { AccessoryId } from "@/domain/omnis/skills";
import { PALETTE } from "@/design/palette";

/**
 * A stylised explorer built from capsules and spheres. Proportions carry identity
 * (height, shoulder width, hair silhouette); faces are two eyes and nothing else,
 * which reads as friendly at any distance and never as uncanny.
 *
 * Origin is at the feet. Total height ≈ def.height scene units.
 */
export function Avatar({ def, gear, idle = true }: { def: AvatarDef; gear: readonly AccessoryId[]; idle?: boolean }) {
  const body = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * 10);
  const H = def.height;
  const W = def.build;
  const legH = H * 0.42;
  const torsoH = H * 0.3;
  const headR = H * 0.085;
  const headY = legH + torsoH + headR * 1.15;
  const has = (a: AccessoryId) => gear.includes(a);

  useFrame((_, dt) => {
    t.current += dt;
    if (!body.current || !idle) return;
    // Breathing and a slow weight shift: alive, never fidgety.
    body.current.scale.y = 1 + Math.sin(t.current * 1.6) * 0.008;
    body.current.rotation.z = Math.sin(t.current * 0.5) * 0.015;
  });

  const skin = <meshStandardMaterial color={def.skin} roughness={0.7} />;
  const cloth = <meshStandardMaterial color={def.outfit} roughness={0.85} />;
  const trimMat = <meshStandardMaterial color={def.trim} emissive={def.trim} emissiveIntensity={0.6} roughness={0.4} />;
  const hairMat = <meshStandardMaterial color={def.hair} roughness={0.9} />;

  return (
    <group ref={body}>
      {/* legs */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.085 * W, legH / 2, 0]}>
          <capsuleGeometry args={[0.065 * W, legH - 0.13 * W, 4, 10]} />
          <meshStandardMaterial color="#15161f" roughness={0.9} />
        </mesh>
      ))}
      {/* torso */}
      <mesh position={[0, legH + torsoH / 2, 0]}>
        <capsuleGeometry args={[0.15 * W, torsoH - 0.2, 6, 14]} />
        {cloth}
      </mesh>
      {/* trim stripe: the avatar's own accent */}
      <mesh position={[0, legH + torsoH * 0.62, 0]}>
        <torusGeometry args={[0.152 * W, 0.012, 6, 32]} />
        {trimMat}
      </mesh>
      {/* arms, relaxed and slightly out */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.2 * W, legH + torsoH * 0.86, 0]} rotation={[0, 0, s * 0.12]}>
          <mesh position={[0, -torsoH * 0.45, 0]}>
            <capsuleGeometry args={[0.048 * W, torsoH * 0.78, 4, 10]} />
            {cloth}
          </mesh>
          <mesh position={[0, -torsoH * 0.92, 0]}>
            <sphereGeometry args={[0.05 * W, 12, 10]} />
            {skin}
          </mesh>
        </group>
      ))}
      {/* neck + head */}
      <mesh position={[0, legH + torsoH + 0.02, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.08, 10]} />
        {skin}
      </mesh>
      <mesh position={[0, headY, 0]}>
        <sphereGeometry args={[headR, 24, 18]} />
        {skin}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * headR * 0.38, headY + headR * 0.08, headR * 0.9]}>
          <sphereGeometry args={[headR * 0.11, 8, 6]} />
          <meshBasicMaterial color="#14121c" />
        </mesh>
      ))}

      {/* hair */}
      {def.hairStyle === "crop" && (
        <mesh position={[0, headY + headR * 0.25, -headR * 0.05]} scale={[1.06, 0.8, 1.06]}>
          <sphereGeometry args={[headR, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          {hairMat}
        </mesh>
      )}
      {def.hairStyle === "beanie" && (
        <>
          <mesh position={[0, headY + headR * 0.3, 0]}>
            <sphereGeometry args={[headR * 1.08, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            {hairMat}
          </mesh>
          <mesh position={[0, headY + headR * 0.3, 0]}>
            <torusGeometry args={[headR * 1.06, headR * 0.12, 6, 28]} />
            {trimMat}
          </mesh>
        </>
      )}
      {def.hairStyle === "long" && (
        <>
          <mesh position={[0, headY + headR * 0.2, -headR * 0.05]} scale={[1.1, 0.85, 1.1]}>
            <sphereGeometry args={[headR, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            {hairMat}
          </mesh>
          <mesh position={[0, headY - headR * 0.9, -headR * 0.55]}>
            <capsuleGeometry args={[headR * 0.75, headR * 1.6, 4, 10]} />
            {hairMat}
          </mesh>
        </>
      )}

      {/* ---------------- gear: one piece per owned skill node ---------------- */}
      {has("lattice-visor") && (
        <mesh position={[0, headY + headR * 0.08, headR * 0.82]}>
          <boxGeometry args={[headR * 1.7, headR * 0.32, headR * 0.25]} />
          <meshBasicMaterial color={new THREE.Color(PALETTE.cyan).multiplyScalar(1.8)} toneMapped={false} transparent opacity={0.85} />
        </mesh>
      )}
      {has("orbit-rings") && <OrbitRings y={headY} r={headR * 2} />}
      {has("halo") && (
        <mesh position={[0, headY + headR * 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[headR * 0.9, headR * 0.09, 8, 40]} />
          <meshBasicMaterial color={new THREE.Color(PALETTE.gold).multiplyScalar(2)} toneMapped={false} />
        </mesh>
      )}
      {has("cosmic-aura") && (
        <mesh position={[0, H * 0.55, 0]} scale={[0.55 * W, H * 0.62, 0.45 * W]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color={PALETTE.rose} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {has("shadow-hood") && (
        <mesh position={[0, headY + headR * 0.1, -headR * 0.1]} scale={[1.25, 1.25, 1.3]}>
          <sphereGeometry args={[headR, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial color="#0d0d14" roughness={1} side={THREE.DoubleSide} />
        </mesh>
      )}
      {has("prism-crown") &&
        Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * headR * 0.75, headY + headR * 1.05, Math.sin(a) * headR * 0.75]}>
              <coneGeometry args={[headR * 0.16, headR * 0.5, 4]} />
              <meshBasicMaterial color={new THREE.Color("#ff9f43").multiplyScalar(1.6)} toneMapped={false} />
            </mesh>
          );
        })}
    </group>
  );
}

function OrbitRings({ y, r }: { y: number; r: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.9;
  });
  return (
    <group ref={g} position={[0, y, 0]}>
      {[0.35, -0.5].map((tilt, i) => (
        <mesh key={i} rotation={[Math.PI / 2 + tilt, 0, 0]}>
          <torusGeometry args={[r * (1 + i * 0.15), 0.006, 6, 64]} />
          <meshBasicMaterial color={new THREE.Color(PALETTE.violet).multiplyScalar(1.8)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
