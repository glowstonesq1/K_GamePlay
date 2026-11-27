// src/fx/bus.ts
//
// Gameplay → VFX event bus. Game logic says WHAT happened and WHERE; the particle layer
// decides how it looks. Keeps sim code free of rendering and lets VFX be swapped or muted.

export type Vec3 = readonly [number, number, number];

export type FxEvent =
  /** Converged / correct: upward glowing tokens. */
  | { kind: "rise"; at: Vec3; color: string; count?: number }
  /** Error flowing backwards / loss went up: expanding ring. */
  | { kind: "shock"; at: Vec3; color: string; radius?: number }
  /** XP awarded anywhere: burst at the camera's focus. */
  | { kind: "reward" };

type Listener = (e: FxEvent) => void;
const listeners = new Set<Listener>();

export const fx = {
  emit(e: FxEvent) {
    listeners.forEach((l) => l(e));
  },
  on(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
