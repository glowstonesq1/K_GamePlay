// src/state/sessionStore.ts
import { createStore, useStore } from "zustand";
import { OBJECTIVES, type ObjectiveId } from "@/domain/objectives";
import { initGd, type GdState } from "@/domain/optim/gd";
import type { Vec2 } from "@/domain/loss/landscape";
import { VALLEY } from "@/domain/loss/presets";
import { oraclePath, type OracleResult } from "@/domain/loss/oracle";
import { COLD_T, HOT_T, LOGITS, TOKENS } from "@/domain/tokens/corpus";
import { sampleIndex, softmax } from "@/domain/tokens/sampling";
import { runArchive, type ArchiveRun } from "@/domain/bias/archive";
import type { Snapshot } from "@/domain/nn/protocol";
import { fx } from "@/fx/bus";
import { gameStore } from "./gameStore";

/*
 * Transient, per-visit simulation state, one slice per zone. Never persisted: a
 * half-finished descent is not progress. Progress lives in gameStore and changes only
 * through award(), which also fires the reward VFX and the XP toast.
 *
 * Hot loops (R3F useFrame, the trainer worker) write here at ≤ 20 Hz, never per frame.
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
  index: number;
  temperature: number;
}

/** Thresholds for the archive objectives, in accuracy percentage points. */
export const GAP_DETECT_PTS = 12;
export const GAP_FIXED_PTS = 5;
/** Feature-space x above which the avatar is standing in group B's region. */
export const REGION_B_X = 0.4;

interface SessionState {
  // Loss Valley
  probe: GdState | null;
  probeStart: Vec2 | null;
  running: boolean;
  speed: Speed;
  ballSeq: number;
  ballStart: Vec2 | null;
  showField: boolean;
  oracle: OracleResult | null;

  // Token Dunes
  samples: Sample[];
  sampledCold: boolean;
  sampledHot: boolean;

  // Backprop Forge
  forge: Snapshot | null;
  forgeData: { X: number[][]; Y: number[] } | null;
  forgeRunning: boolean;
  /** Incremented on every manual step so the scene replays the backward pulse. */
  forgePulse: number;

  // Skew Archive
  archive: ArchiveRun;
  avatarInB: boolean;

  toasts: Toast[];
}

interface SessionActions {
  placeProbe: (theta: Vec2) => void;
  setProbe: (s: GdState) => void;
  setRunning: (r: boolean) => void;
  setSpeed: (s: Speed) => void;
  resetProbe: () => void;
  dropBall: () => void;
  toggleField: () => void;
  revealOracle: () => void;

  sampleToken: (u?: number) => number;

  setForge: (s: Snapshot) => void;
  setForgeData: (d: { X: number[][]; Y: number[] }) => void;
  setForgeRunning: (r: boolean) => void;

  setAvatarInB: (inB: boolean) => void;

  award: (id: ObjectiveId) => void;
  dismissToast: (id: number) => void;
}

export type SessionStore = SessionState & SessionActions;

let nextId = 1;
const MAX_SAMPLES = 10;
const TOAST_MS = 3600;

function checkArchive(get: () => SessionStore) {
  const { archive, avatarInB, award } = get();
  if (avatarInB && archive.gapPts >= GAP_DETECT_PTS) award("archive.skew-detected");
  // Rebalancing only counts after the player has seen the failure.
  if (gameStore.getState().completed["archive.skew-detected"] && archive.gapPts < GAP_FIXED_PTS) {
    award("archive.rebalance");
  }
}

export const sessionStore = createStore<SessionStore>()((set, get) => ({
  probe: null,
  probeStart: null,
  running: false,
  speed: 10,
  ballSeq: 0,
  ballStart: null,
  showField: false,
  oracle: null,

  samples: [],
  sampledCold: false,
  sampledHot: false,

  forge: null,
  forgeData: null,
  forgeRunning: false,
  forgePulse: 0,

  archive: runArchive(gameStore.getState().sampleSkew),
  avatarInB: false,

  toasts: [],

  /* ----------------------------------------------------------- Loss Valley */

  placeProbe: (theta) => {
    const e = VALLEY.spec.extent;
    const t: Vec2 = [Math.max(-e, Math.min(e, theta[0])), Math.max(-e, Math.min(e, theta[1]))];
    set({ probe: initGd(VALLEY, t), probeStart: t, running: false, oracle: null });
  },
  setProbe: (s) => set({ probe: s }),
  setRunning: (r) => {
    const p = get().probe;
    if (r && (!p || p.status === "converged" || p.status === "diverged")) return;
    set({ running: r });
  },
  setSpeed: (speed) => set({ speed }),
  resetProbe: () => {
    const start = get().probeStart;
    set({ probe: start ? initGd(VALLEY, start) : null, running: false, oracle: null });
  },
  dropBall: () => {
    const start = get().probeStart;
    set((s) => ({ ballSeq: s.ballSeq + 1, ballStart: start ?? [2.2, -2.2] }));
  },
  toggleField: () => set((s) => ({ showField: !s.showField })),
  revealOracle: () => {
    const { probe, probeStart } = get();
    if (!probe || !probeStart || (probe.status !== "converged" && probe.status !== "diverged")) return;
    set({ oracle: oraclePath(VALLEY, probeStart) });
    // PEDAGOGY: the trap objective needs both halves: a run that stopped short of the
    // global floor, and the player looking at what full knowledge would have done.
    if (probe.status === "converged" && probe.loss - VALLEY.minima[0]!.loss > 0.05) {
      get().award("valley.local-trap");
    }
  },

  /* ----------------------------------------------------------- Token Dunes */

  sampleToken: (u = Math.random()) => {
    const T = gameStore.getState().temperature;
    const index = sampleIndex(softmax(LOGITS, T), u);
    set((s) => ({
      samples: [{ id: nextId++, token: TOKENS[index]!.text, index, temperature: T }, ...s.samples].slice(0, MAX_SAMPLES),
      sampledCold: s.sampledCold || T <= COLD_T,
      sampledHot: s.sampledHot || T >= HOT_T,
    }));
    if (get().sampledCold && get().sampledHot) get().award("dunes.temperature-sweep");
    return index;
  },

  /* -------------------------------------------------------- Backprop Forge */

  setForge: (snap) => {
    set((s) => ({ forge: snap, forgePulse: snap.manual ? s.forgePulse + 1 : s.forgePulse }));
    if (snap.manual) get().award("forge.chain-rule");
    if (snap.accuracy >= 0.97) get().award("forge.fit");
  },
  setForgeData: (d) => set({ forgeData: d }),
  setForgeRunning: (r) => set({ forgeRunning: r }),

  /* ---------------------------------------------------------- Skew Archive */

  setAvatarInB: (inB) => {
    if (get().avatarInB === inB) return;
    set({ avatarInB: inB });
    checkArchive(get);
  },

  /* --------------------------------------------------------------- Rewards */

  award: (id) => {
    const xp = gameStore.getState().completeObjective(id);
    if (xp <= 0) return;
    const toast = { id: nextId++, xp, label: OBJECTIVES[id].label };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    fx.emit({ kind: "reward" });
    setTimeout(() => get().dismissToast(toast.id), TOAST_MS);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Retrain the archive model whenever the skew dial moves (≈10 ms, synchronous is fine).
gameStore.subscribe((s, prev) => {
  if (s.sampleSkew === prev.sampleSkew) return;
  sessionStore.setState({ archive: runArchive(s.sampleSkew) });
  checkArchive(sessionStore.getState);
});

export function useSession<T>(selector: (s: SessionStore) => T): T {
  return useStore(sessionStore, selector);
}
