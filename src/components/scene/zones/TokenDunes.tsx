// src/components/scene/zones/TokenDunes.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { LOGITS, TOKENS } from "@/domain/tokens/corpus";
import { softmax } from "@/domain/tokens/sampling";
import { gameStore, useGame } from "@/state/gameStore";
import { useSession } from "@/state/sessionStore";
import { createGridGeometry, createTerrainMaterial } from "../terrainMaterial";
import { fx } from "@/fx/bus";
import { PALETTE } from "@/design/palette";

const N = 120;
const SIZE = 20;
const DUNE_SIGMA = 1.15;
/** World height of a dune holding 100% of the probability mass. */
const H_MAX = 7;

/**
 * Golden-angle spiral by rank: the likeliest token sits nearest the centre, the long
 * tail winds outward. Position encodes rank; height encodes probability.
 */
const SITES: readonly [number, number][] = TOKENS.map((_, k) => {
  const r = 1.9 * Math.sqrt(k + 0.6);
  const a = k * 2.39996;
  return [r * Math.cos(a), r * Math.sin(a)];
});

/**
 * PEDAGOGY: Terrain height = Σₖ pₖ · bumpₖ(x, z), with p = softmax(z / T). The sand is
 * conserved (Σp = 1): heating the field doesn't add sand, it moves it from the tall
 * dune into the tail. Every dune keeps its rank at every T.
 */
export function TokenDunes() {
  const T = useGame((s) => s.temperature);
  const target = useMemo(() => softmax(LOGITS, T), [T]);
  const last = useSession((s) => s.samples[0]);

  const sim = useMemo(() => {
    const v = N + 1;
    // Precompute each token's bump on the grid once; per frame is a weighted sum.
    const basis = SITES.map(([cx, cz]) => {
      const b = new Float32Array(v * v);
      for (let i = 0; i < v; i++) {
        const z = -SIZE / 2 + (i * SIZE) / N;
        for (let j = 0; j < v; j++) {
          const x = -SIZE / 2 + (j * SIZE) / N;
          b[i * v + j] = Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * DUNE_SIGMA ** 2));
        }
      }
      return b;
    });
    const heights = new Float32Array(v * v);
    const values = new Float32Array(v * v);
    const geometry = createGridGeometry(N, SIZE, heights, values);
    const material = createTerrainMaterial({ valueMax: H_MAX * 0.6, contourStep: 0.35, low: PALETTE.violet, line: PALETTE.violetDim });
    material.uniforms.uInvert!.value = 1; // here, high = likely = bright
    const shown = softmax(LOGITS, gameStore.getState().temperature);
    return { basis, geometry, material, shown, dirty: { v: true } };
  }, []);
  useEffect(() => () => (sim.geometry.dispose(), sim.material.dispose()), [sim]);

  const labels = useRef<(THREE.Group | null)[]>([]);

  // A sampled word lifts off its dune: correct-outcome VFX at the exact site sampled.
  useEffect(() => {
    if (!last) return;
    const [x, z] = SITES[last.index]!;
    fx.emit({ kind: "rise", at: [x, sim.shown[last.index]! * H_MAX + 0.3, z], color: PALETTE.signal, count: 20 });
  }, [last, sim]);

  useFrame((_, dt) => {
    // Ease displayed probabilities toward the target so a T change reads as sand moving.
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 6);
    let moved = sim.dirty.v;
    for (let i = 0; i < sim.shown.length; i++) {
      const d = target[i]! - sim.shown[i]!;
      if (Math.abs(d) > 1e-5) moved = true;
      sim.shown[i] = sim.shown[i]! + d * k;
    }
    if (!moved) return;
    sim.dirty.v = false;

    const pos = sim.geometry.getAttribute("position") as THREE.BufferAttribute;
    const val = sim.geometry.getAttribute("aValue") as THREE.BufferAttribute;
    const p = pos.array as Float32Array;
    const vals = val.array as Float32Array;
    for (let vi = 0; vi < vals.length; vi++) {
      let h = 0;
      for (let t = 0; t < sim.basis.length; t++) h += sim.shown[t]! * sim.basis[t]![vi]!;
      vals[vi] = h * H_MAX;
      p[vi * 3 + 1] = h * H_MAX;
    }
    pos.needsUpdate = true;
    val.needsUpdate = true;
    sim.geometry.computeVertexNormals();

    labels.current.forEach((g, i) => {
      if (g) g.position.y = sim.shown[i]! * H_MAX + 0.6;
    });
  });

  return (
    <group>
      <mesh geometry={sim.geometry} material={sim.material} />
      {TOKENS.map((tok, i) => (
        <group
          key={tok.text}
          ref={(g) => {
            labels.current[i] = g;
          }}
          position={[SITES[i]![0], 0, SITES[i]![1]]}
        >
          <Html center distanceFactor={24} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
            <div
              data-hit={last?.token === tok.text}
              className="dune-label whitespace-nowrap rounded-full border border-white/10 bg-black/50 px-2.5 py-0.5 backdrop-blur-sm font-mono text-[14px] text-bone data-[hit=true]:border-signal data-[hit=true]:text-signal"
            >
              {tok.text} <span className="text-ash">{(target[i]! * 100).toFixed(target[i]! < 0.01 ? 2 : 0)}%</span>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
