// src/components/scene/fx/PostFX.tsx
"use client";

import { useEffect, useState } from "react";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

/**
 * Lens stack. Bloom only catches what is meant to glow (toneMapped={false} accents above
 * the threshold): probe, oracle route, particles, beams. Terrain stays below it so the
 * frame never washes out. Grain uses premultiplied ADD: SOFT_LIGHT's formula goes negative
 * on HDR (>1) pixels and turned overlapping particles purple in testing. No chromatic aberration: it split small glowing particles into
 * magenta/blue fringes in testing, costing legibility for no teaching value.
 */
export function PostFX() {
  const [rich, setRich] = useState(false);
  useEffect(() => {
    const small = window.matchMedia("(max-width: 639px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRich(!small && !reduce);
  }, []);

  const effects = [
    <Bloom key="bloom" mipmapBlur luminanceThreshold={0.72} luminanceSmoothing={0.2} intensity={0.85} radius={0.7} />,
    <Noise key="noise" premultiply opacity={0.06} blendFunction={BlendFunction.ADD} />,
    <Vignette key="vig" offset={0.32} darkness={0.72} />,
  ].filter((e): e is React.JSX.Element => e !== null);

  // Keyed on `rich` so the composer rebuilds its passes when the effect list changes.
  return (
    <EffectComposer key={rich ? "rich" : "lean"} multisampling={rich ? 4 : 0}>
      {effects}
    </EffectComposer>
  );
}
