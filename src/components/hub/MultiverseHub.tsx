// src/components/hub/MultiverseHub.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, PresentationControls } from "@react-three/drei";
import * as THREE from "three";
import { AVATAR_IDS, AVATARS, type AvatarId } from "@/domain/omnis/avatars";
import { UNIVERSES, type UniverseId } from "@/domain/omnis/universes";
import { gameStore, useGame } from "@/state/gameStore";
import { sessionStore } from "@/state/sessionStore";
import { fx } from "@/fx/bus";
import { Avatar } from "./Avatar";

type V3 = [number, number, number];
type PortalUniverse = Exclude<UniverseId, "hub">;

/* ------------------------------------------------------------------ layout */

const PEDESTAL_TOP = 0.42;
const SIDE_SLOTS: readonly V3[] = [
  [-2.5, 0, 0.9],
  [2.5, 0, 0.9],
];
const PORTAL_ORDER: readonly PortalUniverse[] = ["cybersec", "dsa", "ai", "creative", "literacy"];
const PORTAL_R = 7.2;
/** Portals on an arc behind the pedestal, each turned to face the camera. */
export const PORTALS: ReadonlyArray<{ u: PortalUniverse; pos: V3; yaw: number }> = PORTAL_ORDER.map((u, i) => {
  const a = THREE.MathUtils.degToRad(-52 + i * 26);
  return { u, pos: [Math.sin(a) * PORTAL_R, 2.5 + (i === 2 ? 0.35 : 0), -Math.cos(a) * PORTAL_R + 1.2], yaw: -a };
});

/* ------------------------------------------------------------------ spring */

// Same integrator as the Observatory nodes: fixed 1/240 s, ζ ≈ 0.4 for one visible overshoot.
const K = 240;
const C = 2 * 0.4 * Math.sqrt(K);
function stepSpring(s: { x: number; v: number }, target: number, dt: number) {
  for (let t = 0; t < Math.min(dt, 0.1); t += 1 / 240) {
    s.v += (-K * (s.x - target) - C * s.v) / 240;
    s.x += s.v / 240;
  }
}

/* --------------------------------------------------------------- pedestal */

function Pedestal({ flash }: { flash: React.RefObject<number> }) {
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.4;
    flash.current = Math.max(0, flash.current - dt * 1.8);
    const f = flash.current;
    if (ringMat.current) ringMat.current.color.setRGB(0.75 + 2.2 * f, 0.85 + 2.2 * f, 1.4 + 2 * f);
    if (beam.current) beam.current.opacity = 0.07 + 0.25 * f;
  });
  return (
    <group>
      <mesh position={[0, PEDESTAL_TOP / 2, 0]}>
        <cylinderGeometry args={[1.05, 1.2, PEDESTAL_TOP, 64]} />
        <meshStandardMaterial color="#14151d" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, PEDESTAL_TOP + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1.0, 96]} />
        <meshBasicMaterial ref={ringMat} toneMapped={false} />
      </mesh>
      {/* Holographic column: the "projector" the avatar stands in. */}
      <mesh position={[0, PEDESTAL_TOP + 1.2, 0]}>
        <cylinderGeometry args={[0.9, 0.95, 2.4, 48, 1, true]} />
        <meshBasicMaterial ref={beam} color="#c9d4ff" transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring} position={[0, PEDESTAL_TOP + 2.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.7, 0.008, 6, 96]} />
        <meshBasicMaterial color={new THREE.Color("#c9d4ff").multiplyScalar(1.6)} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------------------------- avatars */

/** The chosen explorer, on the pedestal. Re-keyed per avatar so every pick replays the snap. */
function Featured({ id, flash }: { id: AvatarId; flash: React.RefObject<number> }) {
  const gear = useGame((s) => s.equipped);
  const g = useRef<THREE.Group>(null);
  const s = useRef({ x: 0.55, v: 0 });
  const hop = useRef({ x: 0.5, v: 0 });
  useEffect(() => {
    flash.current = 1;
    fx.emit({ kind: "rise", at: [0, PEDESTAL_TOP + 0.2, 0], color: AVATARS[id].trim, count: 28 });
  }, [id, flash]);
  useFrame((_, dt) => {
    // BANG: underdamped scale + hop land the pick with one overshoot.
    stepSpring(s.current, 1, dt);
    stepSpring(hop.current, 0, dt);
    if (g.current) {
      g.current.scale.set(s.current.x * (2 - s.current.x) ** 0.25, s.current.x, s.current.x * (2 - s.current.x) ** 0.25);
      g.current.position.y = PEDESTAL_TOP + Math.max(0, hop.current.x);
    }
  });
  return (
    <PresentationControls global={false} cursor snap speed={1.4} polar={[0, 0]} azimuth={[-Math.PI, Math.PI]}>
      <group ref={g}>
        <Avatar def={AVATARS[id]} gear={gear} />
      </group>
    </PresentationControls>
  );
}

function Waiting({ id, pos, active }: { id: AvatarId; pos: V3; active: boolean }) {
  const [hover, setHover] = useState(false);
  const g = useRef<THREE.Group>(null);
  const s = useRef({ x: 1, v: 0 });
  useFrame((_, dt) => {
    stepSpring(s.current, hover && active ? 1.08 : 1, dt);
    g.current?.scale.setScalar(s.current.x * 0.9);
  });
  const pick = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    gameStore.getState().chooseAvatar(id);
  };
  return (
    <group position={pos}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.45, 0.5, 0.12, 40]} />
        <meshStandardMaterial color="#14151d" metalness={0.5} roughness={0.4} />
      </mesh>
      <group
        ref={g}
        position={[0, 0.12, 0]}
        rotation={[0, pos[0] < 0 ? 0.5 : -0.5, 0]}
        onClick={pick}
        onPointerOver={(e) => {
          if (!active) return;
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <Avatar def={AVATARS[id]} gear={[]} />
        <mesh position={[0, AVATARS[id].height / 2, 0]} visible={false}>
          <boxGeometry args={[0.7, AVATARS[id].height, 0.6]} />
        </mesh>
      </group>
    </group>
  );
}

/* ----------------------------------------------------------------- portals */

function makeSwirl(color: string, sealed: boolean, radius: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: Math.random() * 10 },
      uColor: { value: new THREE.Color(color) },
      uSealed: { value: sealed ? 1 : 0 },
      uR: { value: radius },
      uHover: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      uniform float uR;
      void main() { vP = position.xy / uR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSealed, uHover;
      uniform vec3 uColor;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float a = atan(vP.y, vP.x);
        float speed = mix(1.6, 0.25, uSealed) * (1.0 + uHover);
        float s = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uTime * speed);
        float core = smoothstep(1.1, 0.0, r);
        vec3 c = mix(uColor * 0.18, uColor * (1.5 + uHover), s * core);
        float grey = dot(c, vec3(0.333));
        c = mix(c, vec3(grey) * 0.55, uSealed * 0.75);
        gl_FragColor = vec4(c, 0.92);
      }`,
  });
}

/** Each universe's doorway has its own shape language, legible before you read its name. */
function PortalFrame({ u, color }: { u: PortalUniverse; color: THREE.Color }) {
  const mat = <meshBasicMaterial color={color} toneMapped={false} />;
  if (u === "ai")
    return (
      <mesh>
        <torusGeometry args={[1.15, 0.05, 12, 96]} />
        {mat}
      </mesh>
    );
  if (u === "cybersec")
    return (
      <mesh rotation={[0, 0, Math.PI / 6]}>
        <ringGeometry args={[1.12, 1.24, 6]} />
        {mat}
      </mesh>
    );
  if (u === "dsa") {
    const cubes: V3[] = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const t = -1.1 + (2.2 * i) / n;
      cubes.push([t, 1.1, 0], [t, -1.1, 0]);
      if (i > 0 && i < n) cubes.push([1.1, t, 0], [-1.1, t, 0]);
    }
    return (
      <>
        {cubes.map((p, i) => (
          <mesh key={i} position={p}>
            <boxGeometry args={[0.2, 0.2, 0.2]} />
            {mat}
          </mesh>
        ))}
      </>
    );
  }
  if (u === "creative")
    return (
      <>
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.18, Math.sin(a) * 1.18, 0]} rotation={[0, 0, a + 0.4]}>
              <planeGeometry args={[0.34, 0.12]} />
              <meshBasicMaterial color={color} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </>
    );
  // literacy: an arch, the shape of every library doorway
  const pts: V3[] = [[-0.95, -1.2, 0], [-0.95, 0.15, 0]];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI - (i / 24) * Math.PI;
    pts.push([Math.cos(a) * 0.95, 0.15 + Math.sin(a) * 0.95, 0]);
  }
  pts.push([0.95, -1.2, 0]);
  return <Line points={pts} color={color} lineWidth={3} toneMapped={false} />;
}

function portalDisc(u: PortalUniverse) {
  if (u === "cybersec") return new THREE.CircleGeometry(1.14, 6).rotateZ(Math.PI / 6);
  if (u === "dsa") return new THREE.PlaneGeometry(2.1, 2.1);
  if (u === "literacy") {
    const s = new THREE.Shape();
    s.moveTo(-0.95, -1.2);
    s.lineTo(-0.95, 0.15);
    s.absarc(0, 0.15, 0.95, Math.PI, 0, true);
    s.lineTo(0.95, -1.2);
    s.closePath();
    return new THREE.ShapeGeometry(s, 24);
  }
  return new THREE.CircleGeometry(1.12, 64);
}

function Portal({ u, pos, yaw, active }: { u: PortalUniverse; pos: V3; yaw: number; active: boolean }) {
  const def = UNIVERSES[u];
  const sealed = !def.playable;
  const [hover, setHover] = useState(false);
  const geom = useMemo(() => portalDisc(u), [u]);
  const swirl = useMemo(() => makeSwirl(def.accent, sealed, 1.2), [def.accent, sealed]);
  const frameColor = useMemo(
    () => new THREE.Color(def.accent).multiplyScalar(sealed ? 0.55 : 2.1),
    [def.accent, sealed],
  );
  const g = useRef<THREE.Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const s = useRef({ x: 1, v: 0 });
  useEffect(() => () => (geom.dispose(), swirl.dispose()), [geom, swirl]);

  useFrame((_, dt) => {
    swirl.uniforms.uTime!.value += dt;
    swirl.uniforms.uHover!.value += ((hover && active ? 1 : 0) - swirl.uniforms.uHover!.value) * Math.min(1, dt * 6);
    stepSpring(s.current, hover && active ? 1.1 : 1, dt);
    g.current?.scale.setScalar(s.current.x);
    // Read the portal per frame (never subscribe): see CosmicHub for the removeChild story.
    if (label.current) {
      label.current.style.visibility = active ? "" : "hidden";
      label.current.style.opacity = sessionStore.getState().portal ? "0" : "";
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    if (sealed) {
      s.current.v -= 7;
      return;
    }
    sessionStore.getState().travelUniverse(u, pos);
  };

  return (
    <group position={pos} rotation={[0, yaw, 0]}>
      <group
        ref={g}
        onClick={onClick}
        onPointerOver={(e) => {
          if (!active) return;
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = sealed ? "not-allowed" : "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <mesh geometry={geom} material={swirl} />
        <PortalFrame u={u} color={frameColor} />
      </group>
      <Html center position={[0, -1.75, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div ref={label} className="w-max max-w-[14rem] text-center transition-[opacity] duration-300">
          <p className="font-display text-xl leading-tight text-bone" style={{ color: sealed ? undefined : def.accent }}>
            {def.name}
          </p>
          <p className="mt-0.5 text-[12px] text-ash">
            {def.subject}
            {sealed ? " · sealed" : ""}
          </p>
          <p
            className={`mt-1 text-[12px] leading-snug text-bone/80 transition-[opacity] duration-200 ${hover ? "opacity-100" : "opacity-0"}`}
          >
            {sealed ? "Blueprint drawn. Not built yet." : def.tagline}
          </p>
        </div>
      </Html>
    </group>
  );
}

/* --------------------------------------------------------------------- hub */

/**
 * The Multiverse Hub. Neutral on purpose: graphite floor, starlight trim, no world colour,
 * so each portal's colour is the only saturated thing in frame and reads as a promise.
 *
 * Like the Observatory it stays mounted for the session and hides when you leave, which
 * keeps its <Html> labels out of React 19's mid-commit unmount path.
 */
export function MultiverseHub({ active }: { active: boolean }) {
  const avatarId = useGame((s) => s.avatarId);
  const flash = useRef(0);
  const centre: AvatarId = avatarId ?? "atlas";
  const waiting = AVATAR_IDS.filter((id) => id !== centre);

  return (
    <group visible={active}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[12, 96]} />
        <meshStandardMaterial color="#0b0c12" roughness={0.9} />
      </mesh>
      {[3.2, 5.6, 8.4].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <ringGeometry args={[r, r + 0.015, 128]} />
          <meshBasicMaterial color="#2a2e44" />
        </mesh>
      ))}
      <hemisphereLight args={["#c9d4ff", "#050508", 0.5]} />
      <directionalLight position={[4, 8, 6]} intensity={1.1} color="#eef0ff" />
      <pointLight position={[0, 3.2, 1.6]} intensity={6} distance={6} color="#c9d4ff" />

      <Pedestal flash={flash} />
      {active && <Featured key={centre} id={centre} flash={flash} />}
      {waiting.map((id, i) => (
        <Waiting key={id} id={id} pos={SIDE_SLOTS[i]!} active={active} />
      ))}
      {PORTALS.map((p) => (
        <Portal key={p.u} u={p.u} pos={p.pos} yaw={p.yaw} active={active} />
      ))}
    </group>
  );
}
