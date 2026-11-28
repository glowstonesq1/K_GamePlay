// src/components/worlds/CosmicHub.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Float, Html, Line, Sparkles, Stars } from "@react-three/drei";
import * as THREE from "three";
import { isZoneUnlocked, ZONES, type ZoneId } from "@/domain/zones";
import { OBJECTIVES } from "@/domain/objectives";
import { PALETTE, WORLD_ACCENT } from "@/design/palette";
import { useGame } from "@/state/gameStore";
import { sessionStore } from "@/state/sessionStore";

import { EDGES, HUB_NODES, type Vec3 } from "./hubLayout";

/* ------------------------------------------------------------------ spring */

/**
 * Damped spring, integrated semi-implicitly at a fixed 1/240 s so the feel does not
 * change with frame rate. ζ ≈ 0.45: one visible overshoot on hover — the "bang" — then
 * it settles in ~0.4 s. Critically damped (ζ = 1) felt dead in testing; ζ < 0.3 wobbles.
 */
const K = 260;
const C = 2 * 0.45 * Math.sqrt(K);
const H = 1 / 240;
function stepSpring(s: { x: number; v: number }, target: number, dt: number) {
  for (let t = 0; t < Math.min(dt, 0.1); t += H) {
    s.v += (-K * (s.x - target) - C * s.v) * H;
    s.x += s.v * H;
  }
}

/* ------------------------------------------------------------ halo sprite */

let haloTex: THREE.Texture | null = null;
/** Radial falloff drawn once on a canvas; additive sprites stack into a soft corona. */
function getHalo() {
  if (haloTex) return haloTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.18, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.12)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  return haloTex;
}

/* --------------------------------------------------------------- nebula */

/** Back-faced sky sphere with two octaves of value noise: dim colour, never detail. */
function Nebula() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uA: { value: new THREE.Color(PALETTE.violetDim) },
          uB: { value: new THREE.Color(PALETTE.cyanDim) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uA, uB;
          varying vec3 vDir;
          float hash(vec3 p) { return fract(sin(dot(p, vec3(17.1, 113.7, 41.3))) * 43758.5453); }
          float noise(vec3 p) {
            vec3 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
              mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
              f.z);
          }
          void main() {
            vec3 p = vDir * 2.2 + vec3(uTime * 0.004, 0.0, uTime * 0.003);
            float n = noise(p) * 0.65 + noise(p * 2.7) * 0.35;
            float band = exp(-pow(vDir.y * 2.6 - 0.35, 2.0));     // a loose galactic band
            vec3 col = mix(uA, uB, smoothstep(0.35, 0.75, noise(p * 0.8 + 3.0)));
            float a = smoothstep(0.42, 0.95, n) * band * 0.26;
            gl_FragColor = vec4(col * a, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useFrame((_, dt) => {
    mat.uniforms.uTime!.value += dt;
  });
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[90, 48, 24]} />
    </mesh>
  );
}

/* ----------------------------------------------------------------- node */

function ConstellationNode({ zone, pos, index, active }: { zone: Exclude<ZoneId, "hub">; pos: Vec3; index: number; active: boolean }) {
  const completed = useGame((s) => s.completed);
  const open = isZoneUnlocked(zone, completed);
  const def = ZONES[zone];
  const accent = WORLD_ACCENT[zone];
  const [hover, setHover] = useState(false);

  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const scale = useRef({ x: 1, v: 0 });
  const t = useRef(index * 1.7);

  const done = useMemo(
    () => Object.entries(OBJECTIVES).filter(([id, o]) => o.zone === zone && completed[id as keyof typeof OBJECTIVES]).length,
    [completed, zone],
  );
  const total = useMemo(() => Object.values(OBJECTIVES).filter((o) => o.zone === zone).length, [zone]);
  const label = useRef<HTMLDivElement>(null);

  // HDR colour: >1 so the core clears the bloom threshold; locked nodes stay under it.
  const hot = useMemo(() => new THREE.Color(accent.hi).multiplyScalar(open ? 2.4 : 0.5), [accent.hi, open]);

  // Portal state is read per frame, never subscribed: a React re-render of these Html
  // labels in the same commit that unmounts the hub makes React 19 throw removeChild.
  useFrame((_, dt) => {
    const portal = sessionStore.getState().portal;
    const diving = portal?.to === zone && portal.phase === "dive";
    if (label.current) {
      label.current.style.opacity = portal ? "0" : "";
      label.current.style.visibility = active ? "" : "hidden";
    }
    t.current += dt;
    stepSpring(scale.current, diving ? 1.9 : hover && open ? 1.35 : 1, dt);
    const s = Math.max(0.2, scale.current.x);
    group.current?.scale.setScalar(s);
    // Hover pulse: a 2 Hz breath on top of the spring, so a held hover still feels alive.
    const pulse = hover && open ? 0.5 + 0.5 * Math.sin(t.current * 4 * Math.PI) : 0;
    if (core.current) core.current.color.copy(hot).multiplyScalar(1 + 0.6 * pulse);
    if (halo.current) halo.current.opacity = (open ? 0.75 : 0.25) + 0.25 * pulse;
    if (ring.current) ring.current.rotation.z += dt * (hover ? 1.4 : 0.35);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    if (!open) {
      scale.current.v -= 9; // a refusal shudder: the spring dips and recovers
      return;
    }
    sessionStore.getState().travel(zone, pos);
  };

  return (
    <Float speed={1.1} rotationIntensity={0} floatIntensity={0.6} floatingRange={[-0.12, 0.12]}>
      <group position={pos}>
        <group
          ref={group}
          onClick={onClick}
          onPointerOver={(e) => {
            if (!active) return;
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = open ? "pointer" : "not-allowed";
          }}
          onPointerOut={() => {
            if (!active && !hover) return;
            setHover(false);
            document.body.style.cursor = "";
          }}
        >
          {/* Generous invisible hit sphere: the glowing core alone is a small target. */}
          <mesh visible={false}>
            <sphereGeometry args={[0.9, 12, 8]} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.32, 32, 16]} />
            <meshBasicMaterial ref={core} toneMapped={false} />
          </mesh>
          <sprite scale={[3.4, 3.4, 1]}>
            <spriteMaterial
              ref={halo}
              map={getHalo()}
              color={accent.hi}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
          <mesh ref={ring} rotation={[Math.PI / 2.3, 0, 0]}>
            <torusGeometry args={[0.62, 0.008, 6, 96]} />
            <meshBasicMaterial color={open ? accent.hi : accent.dim} transparent opacity={open ? 0.7 : 0.35} toneMapped={false} />
          </mesh>
        </group>

        <Html center position={[0, -1.05, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <div ref={label} className="w-max max-w-[12rem] text-center transition-[opacity] duration-300 sm:max-w-none">
            <div className={`transition-[opacity,transform] duration-300 ${hover ? "-translate-y-1 opacity-100" : "opacity-80"}`}>
            <p className="font-display text-xl leading-none whitespace-nowrap" style={{ color: open ? accent.hi : PALETTE.bone }}>
              {def.name}
            </p>
            <p className="mx-auto mt-1 max-w-[11rem] text-[12px] leading-snug text-ash sm:max-w-none sm:whitespace-nowrap">
              {open ? `${def.concept} · ${done} of ${total}` : `Opens after: ${OBJECTIVES[def.unlockedBy!].label.toLowerCase()}`}
            </p>
            </div>
          </div>
        </Html>
      </group>
    </Float>
  );
}

/* --------------------------------------------------------- constellation */

function Edges() {
  const completed = useGame((s) => s.completed);
  return (
    <>
      {EDGES.map(([a, b]) => {
        const A = HUB_NODES[a]!;
        const B = HUB_NODES[b]!;
        const lit = isZoneUnlocked(B.zone, completed);
        return (
          <Line
            key={`${a}-${b}`}
            points={[A.pos, B.pos]}
            color={lit ? WORLD_ACCENT[B.zone].hi : PALETTE.star}
            lineWidth={1}
            transparent
            opacity={lit ? 0.45 : 0.12}
            dashed={!lit}
            dashSize={0.18}
            gapSize={0.14}
          />
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ hub */

/**
 * The observatory stays mounted for the whole session and is hidden, not removed, when you
 * leave (its sky stays visible behind every world). Unmounting it tore down four drei <Html> roots inside the same React 19 commit
 * that mounted the next world, which throws removeChild. Hidden, it costs one boolean
 * check per frame; the sky is also already there when you come home.
 */
export function CosmicHub({ active }: { active: boolean }) {
  const sky = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    // ~1 revolution per 20 minutes: felt, never watched.
    if (sky.current) sky.current.rotation.y += dt * 0.005;
  });

  return (
    <>
      {/* The sky stays up in every world: one continuous cosmos, not five black rooms. */}
      <group ref={sky}>
        <Nebula />
        <Stars radius={60} depth={40} count={5000} factor={3.2} saturation={0} fade speed={0.4} />
      </group>
      <group visible={active}>
      <Sparkles count={90} scale={[18, 8, 14]} position={[0, 2, -2]} size={1.6} speed={0.18} opacity={0.5} color={PALETTE.star} />
      <Edges />
      {HUB_NODES.map((n, i) => (
        <ConstellationNode key={n.zone} zone={n.zone} pos={n.pos} index={i} active={active} />
      ))}
      </group>
    </>
  );
}
