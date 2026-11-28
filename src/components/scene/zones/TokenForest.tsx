// src/components/scene/zones/TokenForest.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { LOGITS, PROMPT, TOKENS } from "@/domain/tokens/corpus";
import { softmax } from "@/domain/tokens/sampling";
import { nucleus } from "@/domain/tokens/lesson";
import { mulberry32 } from "@/domain/rng";
import { gameStore, useGame } from "@/state/gameStore";
import { useSession } from "@/state/sessionStore";
import { fx } from "@/fx/bus";
import { PALETTE } from "@/design/palette";

/** World height of a tree holding 100 % of the probability mass. */
const H_MAX = 7;
const K = TOKENS.length;
const SKY_Y = 11;
const SEED_FALL_S = 0.55;
const MAX_SEEDS = 128;

/**
 * Golden-angle spiral by rank, as in the old dunes: the likeliest word stands in the
 * middle, the long tail winds outward. Position encodes rank; height encodes probability.
 */
const SITES: readonly [number, number][] = TOKENS.map((_, k) => {
  const r = 1.9 * Math.sqrt(k + 0.6);
  const a = k * 2.39996;
  return [r * Math.cos(a), r * Math.sin(a)];
});

const VIOLET = new THREE.Color(PALETTE.violet);
const VIOLET_DIM = new THREE.Color(PALETTE.violetDim);

/* ------------------------------------------------------------------ seeds */

interface Seed {
  tree: number;
  t: number; // seconds since release (negative = still waiting in the stagger)
  x0: number;
  z0: number;
}

/**
 * Falling seeds share one InstancedMesh. Each falls from the sky above its tree under
 * an ease-in curve (gravity-like), lands on the canopy and pops a small burst. Positions
 * are a pure function of t, so a slow frame never loses a seed.
 */
function Seeds({ heights, onLand }: { heights: Float32Array; onLand: (tree: number) => void }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const seeds = useRef<Seed[]>([]);
  const single = useSession((s) => s.samples[0]);
  const batch = useSession((s) => s.batch);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const rng = useMemo(() => mulberry32(7), []);

  const release = (tree: number, delay: number) => {
    if (seeds.current.length >= MAX_SEEDS) seeds.current.shift();
    seeds.current.push({ tree, t: -delay, x0: (rng() - 0.5) * 3, z0: (rng() - 0.5) * 3 });
  };

  useEffect(() => {
    if (single) release(single.index, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single?.id]);

  useEffect(() => {
    if (!batch) return;
    // 100 seeds over ~0.8 s: fast enough to feel like one shake, slow enough to read.
    let k = 0;
    batch.counts.forEach((c, tree) => {
      for (let j = 0; j < c; j++) release(tree, (k++ / batch.n) * 0.8);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.id]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const alive: Seed[] = [];
    let n = 0;
    for (const s of seeds.current) {
      s.t += Math.min(dt, 0.1);
      if (s.t < 0) {
        alive.push(s);
        continue;
      }
      const u = Math.min(1, s.t / SEED_FALL_S);
      if (u >= 1) {
        onLand(s.tree);
        continue;
      }
      const [tx, tz] = SITES[s.tree]!;
      const top = heights[s.tree]! + 0.9;
      const e = u * u; // ease-in: accelerating, like falling
      tmp.position.set(THREE.MathUtils.lerp(tx + s.x0, tx, e), THREE.MathUtils.lerp(SKY_Y, top, e), THREE.MathUtils.lerp(tz + s.z0, tz, e));
      tmp.scale.setScalar(0.09 + 0.05 * (1 - u));
      tmp.updateMatrix();
      m.setMatrixAt(n++, tmp.matrix);
      alive.push(s);
    }
    seeds.current = alive;
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_SEEDS]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshBasicMaterial color={new THREE.Color(PALETTE.signal).multiplyScalar(2.2)} toneMapped={false} />
    </instancedMesh>
  );
}

/* ----------------------------------------------------------------- forest */

/**
 * PEDAGOGY: tree height = softmax(logits / T)[i]. The canopy lights up (crosses the bloom
 * threshold) only for trees inside the top-p = 0.9 nucleus, so the glowing set is what a
 * nucleus sampler would actually consider. Heating the forest moves height from the
 * centre into the tail; Σ heights stays fixed, and no tree ever changes rank.
 *
 * The mist sits at height H_MAX / K: the uniform-distribution line. A tree above the mist
 * is likelier than a blind guess.
 */
export function TokenForest() {
  const T = useGame((s) => s.temperature);
  const target = useMemo(() => softmax(LOGITS, T), [T]);
  const lit = useMemo(() => new Set(nucleus(target)), [target]);
  const last = useSession((s) => s.samples[0]);
  const batch = useSession((s) => s.batch);

  const shown = useMemo(() => Float32Array.from(softmax(LOGITS, gameStore.getState().temperature)), []);
  const heights = useMemo(() => new Float32Array(K), []);
  const trunks = useRef<(THREE.Mesh | null)[]>([]);
  const crowns = useRef<(THREE.Mesh | null)[]>([]);
  const crownMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const piles = useRef<(THREE.Mesh | null)[]>([]);
  const labels = useRef<(THREE.Group | null)[]>([]);
  const glow = useRef(new Float32Array(K));
  const pileShown = useRef(new Float32Array(K));
  const pulse = useRef(new Float32Array(K));

  const onLand = (tree: number) => {
    pulse.current[tree] = 1;
    const [x, z] = SITES[tree]!;
    fx.emit({ kind: "rise", at: [x, heights[tree]! + 0.9, z], color: PALETTE.signal, count: 6 });
  };

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    // Ease toward the target so a temperature change reads as the forest growing.
    const k = 1 - Math.exp(-step * 5);
    for (let i = 0; i < K; i++) {
      shown[i] = shown[i]! + (target[i]! - shown[i]!) * k;
      const h = 0.15 + shown[i]! * H_MAX;
      heights[i] = h;

      const trunk = trunks.current[i];
      if (trunk) {
        trunk.scale.y = h;
        trunk.position.y = h / 2;
      }
      const crown = crowns.current[i];
      if (crown) {
        crown.position.y = h + 0.35;
        // Canopy size follows height a little, so a giant reads as a giant from above.
        crown.scale.setScalar(0.45 + 0.9 * Math.sqrt(shown[i]!));
        crown.rotation.y += step * 0.15;
      }

      const wantGlow = lit.has(i) ? 1 : 0;
      glow.current[i] = glow.current[i]! + (wantGlow - glow.current[i]!) * k;
      pulse.current[i] = Math.max(0, pulse.current[i]! - step * 2.5);
      const mat = crownMats.current[i];
      if (mat) {
        // HDR emissive above the 0.72 bloom threshold only inside the nucleus.
        mat.emissive.copy(VIOLET_DIM).lerp(VIOLET, glow.current[i]!);
        mat.emissiveIntensity = 0.25 + 1.9 * glow.current[i]! + 2.5 * pulse.current[i]!;
      }

      const want = batch ? (batch.counts[i]! / batch.n) * H_MAX : 0;
      pileShown.current[i] = pileShown.current[i]! + (want - pileShown.current[i]!) * (1 - Math.exp(-step * 3));
      const pile = piles.current[i];
      if (pile) {
        const ph = Math.max(0.001, pileShown.current[i]!);
        pile.visible = ph > 0.01;
        pile.scale.y = ph;
        pile.position.y = ph / 2;
      }
      const g = labels.current[i];
      if (g) g.position.y = h + 1.35 + 0.9 * Math.sqrt(shown[i]!);
    }
  });

  return (
    <group>
      {/* Clearing floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[11, 96]} />
        <meshStandardMaterial color="#0a0912" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[10.6, 10.75, 128]} />
        <meshBasicMaterial color={PALETTE.violetDim} />
      </mesh>

      {/* Chance mist at 1/K: above it, likelier than a blind guess. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, H_MAX / K + 0.15, 0]}>
        <circleGeometry args={[10.5, 96]} />
        <meshBasicMaterial color={PALETTE.star} transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <hemisphereLight args={[PALETTE.violet, PALETTE.void, 0.55]} />
      <directionalLight position={[6, 12, 4]} intensity={0.9} color={PALETTE.star} />

      {TOKENS.map((tok, i) => {
        const [x, z] = SITES[i]!;
        return (
          <group key={tok.text} position={[x, 0, z]}>
            <mesh ref={(m) => void (trunks.current[i] = m)}>
              <cylinderGeometry args={[0.07, 0.12, 1, 8]} />
              <meshStandardMaterial color="#2a2440" roughness={0.8} />
            </mesh>
            {/* Low-poly crown: faceted reads as "crafted", and costs 20 faces. */}
            <mesh ref={(m) => void (crowns.current[i] = m)}>
              <icosahedronGeometry args={[0.7, 0]} />
              <meshStandardMaterial
                ref={(m) => void (crownMats.current[i] = m)}
                color={PALETTE.violetDim}
                emissive={PALETTE.violet}
                flatShading
                roughness={0.6}
              />
            </mesh>
            {/* Seed pile: empirical frequency on the same scale as the tree. */}
            <mesh ref={(m) => void (piles.current[i] = m)} position={[0.45, 0, 0]} visible={false}>
              <boxGeometry args={[0.22, 1, 0.22]} />
              <meshBasicMaterial color={new THREE.Color(PALETTE.signal).multiplyScalar(0.9)} transparent opacity={0.85} />
            </mesh>
            <group ref={(g) => void (labels.current[i] = g)}>
              <Html center distanceFactor={20} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
                <div
                  data-hit={last?.token === tok.text}
                  className="whitespace-nowrap rounded-full border border-white/10 bg-black/50 px-2.5 py-0.5 font-mono text-[14px] text-bone backdrop-blur-sm data-[hit=true]:border-signal data-[hit=true]:text-signal"
                >
                  {tok.text} <span className="text-ash">{(target[i]! * 100).toFixed(target[i]! < 0.01 ? 2 : 0)}%</span>
                  {batch && <span className="text-signal"> · {batch.counts[i]}</span>}
                </div>
              </Html>
            </group>
          </group>
        );
      })}

      <Seeds heights={heights} onLand={onLand} />

      {/* The prompt hangs in the sky; each draw is a candidate next star. */}
      <group position={[0, 9.6, -7]}>
        <Html center distanceFactor={22} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <p className="whitespace-nowrap font-display text-4xl text-bone/90">
            {PROMPT} <span className="text-violet">{last?.token ?? "…"}</span>
          </p>
        </Html>
      </group>
    </group>
  );
}
