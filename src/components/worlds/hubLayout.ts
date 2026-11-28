// src/components/worlds/hubLayout.ts
import type { ZoneId } from "@/domain/zones";

export type Vec3 = [number, number, number];

/**
 * Layout: the Loss Valley sits front and centre because it is the only door open on a
 * fresh save. The edges trace the unlock graph, so the sky doubles as the course map:
 * valley → forest → mirror, and valley → core.
 */
export const HUB_NODES: ReadonlyArray<{ zone: Exclude<ZoneId, "hub">; pos: Vec3 }> = [
  { zone: "loss-valley", pos: [0, 0.9, 1.2] },
  { zone: "token-dunes", pos: [-5, 2.1, -2.2] },
  { zone: "skew-archive", pos: [-2.6, 4.1, -6.4] },
  { zone: "backprop-forge", pos: [5, 2.1, -2.2] },
];
export const EDGES: ReadonlyArray<[number, number]> = [
  [0, 1],
  [1, 2],
  [0, 3],
];
