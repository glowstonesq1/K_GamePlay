// src/design/palette.ts
//
// WebGL can't read CSS custom properties, so the 3D layer mirrors the tokens in
// globals.css here. Change a colour in both places or neither.
import type { ZoneId } from "@/domain/zones";

export const PALETTE = {
  void: "#050508",
  bone: "#eef0ff",
  signal: "#ffb020",
  alarm: "#ff3b4a",
  ridge: "#12131f",
  star: "#c9d4ff",
  cyan: "#5ee7ff",
  cyanDim: "#1d6f80",
  violet: "#a78bfa",
  violetDim: "#4b3a8a",
  rose: "#ff5c8a",
  roseDim: "#7a2843",
  gold: "#ffc857",
  goldDim: "#7a5a1c",
} as const;

/** One glow per world. The hub's constellation nodes and each world's accents read from here. */
export const WORLD_ACCENT: Readonly<Record<ZoneId, { hi: string; dim: string }>> = {
  hub: { hi: PALETTE.star, dim: "#3a4270" },
  "loss-valley": { hi: PALETTE.cyan, dim: PALETTE.cyanDim },
  "token-dunes": { hi: PALETTE.violet, dim: PALETTE.violetDim },
  "skew-archive": { hi: PALETTE.rose, dim: PALETTE.roseDim },
  "backprop-forge": { hi: PALETTE.gold, dim: PALETTE.goldDim },
};
