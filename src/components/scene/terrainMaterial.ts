// src/components/scene/terrainMaterial.ts
import * as THREE from "three";
import { PALETTE } from "@/design/palette";

/**
 * Contour-line terrain shader shared by Loss Valley and Token Dunes.
 *
 * PEDAGOGY: Contour lines are level sets of L. The gradient is always perpendicular to
 * them and its size is inversely proportional to their spacing: tight lines = steep.
 * Reading contours is reading ∇L, which is exactly what the optimiser does.
 *
 * Vertex attribute `aValue` is the scalar field (loss, or probability mass) per vertex.
 */
export function createTerrainMaterial(opts: {
  valueMax: number;
  contourStep: number;
  low: string;
  line: string;
  /** Colour the top of the range bleeds into. Omit for no peak tint. */
  peak?: string;
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uValueMax: { value: opts.valueMax },
      uStep: { value: opts.contourStep },
      uLow: { value: new THREE.Color(opts.low) },
      uHigh: { value: new THREE.Color(PALETTE.ridge) },
      uLine: { value: new THREE.Color(opts.line) },
      uPeak: { value: new THREE.Color(opts.peak ?? PALETTE.ridge) },
      uPeakAmt: { value: opts.peak ? 1 : 0 },
      uFog: { value: new THREE.Color(PALETTE.void) },
      uFogNear: { value: 18 },
      uFogFar: { value: 46 },
      uInvert: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aValue;
      varying float vValue;
      varying vec3 vNormal;
      varying float vDepth;
      void main() {
        vValue = aValue;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uValueMax, uStep, uFogNear, uFogFar, uInvert, uPeakAmt;
      uniform vec3 uLow, uHigh, uLine, uFog, uPeak;
      varying float vValue;
      varying vec3 vNormal;
      varying float vDepth;

      float contour(float v, float stepSize, float width) {
        float f = v / stepSize;
        float d = abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-4);
        return 1.0 - clamp(d / width, 0.0, 1.0);
      }

      void main() {
        float t = clamp(vValue / uValueMax, 0.0, 1.0);
        t = mix(t, 1.0 - t, uInvert);
        vec3 base = mix(uLow * 0.55, uHigh, pow(t, 0.55));
        float diffuse = 0.35 + 0.65 * max(dot(normalize(vNormal), normalize(vec3(0.35, 1.0, 0.25))), 0.0);
        vec3 col = base * diffuse;

        // High loss reads as heat: ridges warm toward the peak colour, floors stay cold.
        col = mix(col, uPeak * (0.45 + 0.55 * diffuse), uPeakAmt * smoothstep(0.62, 1.0, t) * 0.6);

        // Basin floors glow: the eye should find low loss before the HUD tells it.
        col += uLow * exp(-t * 7.0) * 0.45;

        // No contour at level 0: a flat plain sitting exactly at 0 would light up whole.
        float above = step(0.5 * uStep, vValue);
        float minor = contour(vValue, uStep, 1.0) * above;
        float major = contour(vValue, uStep * 4.0, 1.4) * above;
        col = mix(col, uLine, minor * 0.55);
        col = mix(col, uLow, major * 0.7);

        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Indexed grid geometry, vertex (i, j) at x = -s/2 + j·s/n, z = -s/2 + i·s/n. */
export function createGridGeometry(n: number, size: number, heights: Float32Array, values: Float32Array) {
  const v = n + 1;
  const pos = new Float32Array(v * v * 3);
  for (let i = 0; i < v; i++) {
    for (let j = 0; j < v; j++) {
      const k = i * v + j;
      pos[k * 3] = -size / 2 + (j * size) / n;
      pos[k * 3 + 1] = heights[k]!;
      pos[k * 3 + 2] = -size / 2 + (i * size) / n;
    }
  }
  const idx = new Uint32Array(n * n * 6);
  let o = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * v + j;
      const b = a + 1;
      const c = a + v;
      const d = c + 1;
      // CCW seen from +Y so normals point up.
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aValue", new THREE.BufferAttribute(values, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
