// src/components/scene/zones/BackpropForge.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GRID, NET_SIZES } from "@/domain/nn/protocol";
import { PALETTE } from "@/design/palette";
import { fx } from "@/fx/bus";
import { sessionStore, useSession } from "@/state/sessionStore";
import { ensureForgeWorker } from "@/workers/forgeClient";

/*
 * PEDAGOGY — three views of one network, all driven by the worker's real numbers:
 *  1. Floor: the decision surface p(x, y) the network computes right now, with its 0.5
 *     iso-line. This is what "learning" looks like from the data's point of view.
 *  2. Graph: every weight as a beam. Thickness = |w|, colour = sign. Training visibly
 *     re-wires it.
 *  3. Backward pulse (manual step): red light travels output → input, layer by layer,
 *     each beam lit in proportion to its actual |∂L/∂w|. That is backpropagation.
 */

const SPAN = 1.6; // input square half-width (matches the worker)
const FLOOR = 8; // world size of the decision floor
const toWorld = (x: number, y: number) => new THREE.Vector3((x / SPAN) * (FLOOR / 2), 0.06, -(y / SPAN) * (FLOOR / 2));

/** Node world positions: layers march left→right above the floor, behind it. */
const NODE_POS: THREE.Vector3[][] = NET_SIZES.map((n, l) =>
  Array.from({ length: n }, (_, i) => new THREE.Vector3(-4.5 + l * 3, 2.4 + (i - (n - 1) / 2) * 0.62, -5.5)),
);

function DecisionFloor() {
  const { tex, mat } = useMemo(() => {
    const data = new Uint8Array(GRID * GRID).fill(128);
    const t = new THREE.DataTexture(data, GRID, GRID, THREE.RedFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uP: { value: t },
        uA: { value: new THREE.Color(PALETTE.signal) },
        uB: { value: new THREE.Color(PALETTE.bio) },
        uBase: { value: new THREE.Color(PALETTE.void) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uP; uniform vec3 uA, uB, uBase; varying vec2 vUv;
        void main() {
          float p = texture2D(uP, vUv).r;
          vec3 cls = mix(uA, uB, step(0.5, p));
          float conf = abs(p - 0.5) * 2.0;           // 0 at the boundary, 1 when certain
          vec3 col = mix(uBase, cls * 0.55, 0.25 + 0.6 * conf);
          float f = (p - 0.5) / max(fwidth(p), 1e-4);  // distance to the p = 0.5 iso-line, in px
          col = mix(col, vec3(1.0), (1.0 - clamp(abs(f) / 1.5, 0.0, 1.0)) * 0.9);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    return { tex: t, mat: m };
  }, []);
  useEffect(() => () => (tex.dispose(), mat.dispose()), [tex, mat]);

  useEffect(
    () =>
      sessionStore.subscribe((s, prev) => {
        if (!s.forge || s.forge === prev.forge) return;
        const d = tex.image.data as Uint8Array;
        const g = s.forge.grid;
        for (let i = 0; i < g.length; i++) d[i] = Math.round(g[i]! * 255);
        tex.needsUpdate = true;
      }),
    [tex],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat}>
      <planeGeometry args={[FLOOR, FLOOR]} />
    </mesh>
  );
}

function DataPoints() {
  const data = useSession((s) => s.forgeData);
  const mesh = useMemo(() => {
    if (!data) return null;
    const m = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.07, 10, 8),
      new THREE.MeshBasicMaterial({ toneMapped: false }),
      data.X.length,
    );
    const d = new THREE.Object3D();
    const a = new THREE.Color(PALETTE.signal);
    const b = new THREE.Color(PALETTE.bio);
    data.X.forEach(([x, y], i) => {
      d.position.copy(toWorld(x!, y!)).setY(0.12);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, data.Y[i] === 1 ? b : a);
    });
    return m;
  }, [data]);
  useEffect(() => () => mesh?.geometry.dispose(), [mesh]);
  return mesh ? <primitive object={mesh} /> : null;
}

interface Edge {
  layer: number;
  index: number; // flat index into W[layer]
  from: THREE.Vector3;
  to: THREE.Vector3;
}

function Network() {
  const edges = useMemo<Edge[]>(() => {
    const out: Edge[] = [];
    for (let l = 0; l < NET_SIZES.length - 1; l++) {
      const nin = NET_SIZES[l]!;
      for (let o = 0; o < NET_SIZES[l + 1]!; o++)
        for (let i = 0; i < nin; i++) out.push({ layer: l, index: o * nin + i, from: NODE_POS[l]![i]!, to: NODE_POS[l + 1]![o]! });
    }
    return out;
  }, []);

  const beams = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2); // unit beam along +Z from origin
    return new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false }), edges.length);
  }, [edges]);

  const nodes = useMemo(() => {
    const all = NODE_POS.flat();
    const m = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.17, 16, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.ridge, emissive: PALETTE.bioDim, emissiveIntensity: 0.6 }),
      all.length,
    );
    const d = new THREE.Object3D();
    all.forEach((p, i) => {
      d.position.copy(p);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    return m;
  }, []);
  useEffect(() => () => (beams.geometry.dispose(), nodes.geometry.dispose()), [beams, nodes]);

  const pulse = useRef({ t: -1, seq: 0 });
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cPos = useMemo(() => new THREE.Color(PALETTE.bio), []);
  const cNeg = useMemo(() => new THREE.Color(PALETTE.signal), []);
  const cHot = useMemo(() => new THREE.Color(PALETTE.alarm), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    const { forge, forgePulse } = sessionStore.getState();
    if (!forge) return;
    if (forgePulse !== pulse.current.seq) {
      pulse.current = { t: 0, seq: forgePulse };
      fx.emit({ kind: "shock", at: NODE_POS.at(-1)![0]!.toArray(), color: PALETTE.alarm, radius: 1.2 });
    }
    const L = NET_SIZES.length - 1;
    const PULSE_DUR = 1.6;
    if (pulse.current.t >= 0) pulse.current.t += dt;
    if (pulse.current.t > PULSE_DUR + 0.6) pulse.current.t = -1;

    // Normalise |∂L/∂w| per layer so every layer's beams are readable.
    const gMax = forge.gW.map((g) => g.reduce((m, v) => Math.max(m, v), 1e-12));

    edges.forEach((e, k) => {
      const w = forge.W[e.layer]![e.index]!;
      const thick = 0.012 + Math.min(0.09, Math.abs(w) * 0.035);
      const len = e.from.distanceTo(e.to);
      dummy.position.copy(e.from);
      dummy.lookAt(e.to);
      dummy.scale.set(thick, thick, len);
      dummy.updateMatrix();
      beams.setMatrixAt(k, dummy.matrix);

      tmp.copy(w >= 0 ? cPos : cNeg).multiplyScalar(0.35 + Math.min(0.65, Math.abs(w) * 0.3));
      if (pulse.current.t >= 0) {
        // The pulse front starts at the output layer and moves one layer per PULSE_DUR/L.
        const front = L - 1 - (pulse.current.t / PULSE_DUR) * L;
        const glow = Math.max(0, 1 - Math.abs(e.layer - front) * 1.3);
        const g = forge.gW[e.layer]![e.index]! / gMax[e.layer]!;
        tmp.lerp(cHot, Math.min(1, glow * (0.25 + 0.75 * g)) * 1.0).multiplyScalar(1 + glow * 1.5);
      }
      beams.setColorAt(k, tmp);
    });
    beams.instanceMatrix.needsUpdate = true;
    if (beams.instanceColor) beams.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <primitive object={beams} />
      <primitive object={nodes} />
    </>
  );
}

export function BackpropForge() {
  useEffect(() => ensureForgeWorker(), []);
  const fit = useSession((s) => (s.forge?.accuracy ?? 0) >= 0.97);
  useEffect(() => {
    if (fit) fx.emit({ kind: "rise", at: [0, 0.4, 0], color: PALETTE.bio, count: 48 });
  }, [fit]);

  return (
    <>
      <hemisphereLight args={[PALETTE.bone, PALETTE.void, 0.8]} />
      <pointLight position={[0, 5, -3]} intensity={18} color={PALETTE.bio} />
      <DecisionFloor />
      <DataPoints />
      <Network />
    </>
  );
}
