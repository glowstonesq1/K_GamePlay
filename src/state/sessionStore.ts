// src/state/sessionStore.ts
import { createStore, useStore } from "zustand";
import { OBJECTIVES, type ObjectiveId } from "@/domain/objectives";
import { initGd, type GdState } from "@/domain/optim/gd";
import type { Vec2 } from "@/domain/loss/landscape";
import { VALLEY } from "@/domain/loss/presets";
import { COLD_T, HOT_T, LOGITS, TOKENS } from "@/domain/tokens/corpus";
import { sampleIndex, softmax } from "@/domain/tokens/sampling";
import { gameStore } from "./gameStore";

/*
 * Transient, per-visit simulation state. Never persisted: a half-finished descent is
 * not progress. Progress lives in gameStore and only changes through award().
 *
 * Write frequency: the R3F loop updates `probe` at most ~20 Hz (see LossValley), so the
 * HUD readouts re-render at that rate, not at 60–120 Hz.
 */

export type Speed = 1 | 10 | 100;

export interface Toast {
  id: number;
  xp: number;
  label: string;
}

export interface Sample {
  id: number;
  token: string;
  temperature: number;
}

interface SessionState {
  probe: GdState | null;
  running: boolean;
  speed: Speed;
  /** Incremented to request a fresh physics ball at the probe's start point. */
  ballSeq: number;
  ballStart: Vec2 | null;

  samples: Sample[];
  sampledCold: boolean;
  sampledHot: boolean;

  toasts: Toast[];
}

interface SessionActions {
  placeProbe: (theta: Vec2) => void;
  setProbe: (s: GdState) => void;
  setRunning: (r: boolean) => void;
  setSpeed: (s: Speed) => void;
  resetProbe: () => void;
  dropBall: () => void;
  sampleToken: (u?: number) => number;
  award: (id: ObjectiveId) => void;
  dismissToast: (id: number) => void;
}

let nextId = 1;
const MAX_SAMPLES = 10;
const TOAST_MS = 3600;

export const sessionStore = createStore<SessionState & SessionActions>()((set, get) => ({
  probe: null,
  running: false,
  speed: 10,
  ballSeq: 0,
  ballStart: null,
  samples: [],
  sampledCold: false,
  sampledHot: false,
  toasts: [],

  placeProbe: (theta) => {
    const e = VALLEY.spec.extent;
    const t: Vec2 = [Math.max(-e, Math.min(e, theta[0])), Math.max(-e, Math.min(e, theta[1]))];
    set({ probe: initGd(VALLEY, t), running: false });
  },
  setProbe: (s) => set({ probe: s }),
  setRunning: (r) => {
    const p = get().probe;
    if (r && (!p || p.status === "converged" || p.status === "diverged")) return;
    set({ running: r });
  },
  setSpeed: (speed) => set({ speed }),
  resetProbe: () => {
    const p = get().probe;
    set({ probe: p ? initGd(VALLEY, p.theta) : null, running: false });
  },
  dropBall: () => {
    const p = get().probe;
    set((s) => ({ ballSeq: s.ballSeq + 1, ballStart: p ? p.theta : [2.2, -2.2] }));
  },

  sampleToken: (u = Math.random()) => {
    const T = gameStore.getState().temperature;
    const idx = sampleIndex(softmax(LOGITS, T), u);
    set((s) => ({
      samples: [{ id: nextId++, token: TOKENS[idx]!.text, temperature: T }, ...s.samples].slice(0, MAX_SAMPLES),
      sampledCold: s.sampledCold || T <= COLD_T,
      sampledHot: s.sampledHot || T >= HOT_T,
    }));
    if (get().sampledCold && get().sampledHot) get().award("dunes.temperature-sweep");
    return idx;
  },

  award: (id) => {
    const xp = gameStore.getState().completeObjective(id);
    if (xp <= 0) return;
    const toast = { id: nextId++, xp, label: OBJECTIVES[id].label };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    setTimeout(() => get().dismissToast(toast.id), TOAST_MS);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useSession<T>(selector: (s: SessionState & SessionActions) => T): T {
  return useStore(sessionStore, selector);
}
