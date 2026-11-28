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
import { BATCH_TOLERANCE_PTS, batchError, type Batch, type ForestEvent } from "@/domain/tokens/lesson";
import type { Snapshot } from "@/domain/nn/protocol";
import { fx } from "@/fx/bus";
import { gameStore } from "./gameStore";
import { isZoneUnlocked, type ZoneId } from "@/domain/zones";

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

/**
 * A portal jump between worlds. The camera owns the timing (it knows when it has reached
 * the node), the store owns the facts. Phases:
 *   dive   — camera accelerates into the target node (or pulls away, going home)
 *   emerge — the world has switched; camera settles onto its establishing shot
 */
export interface Portal {
  from: ZoneId;
  to: ZoneId;
  /** World-space point to dive into (a hub node). null = pull back instead. */
  at: [number, number, number] | null;
  phase: "dive" | "emerge";
}

interface SessionState {
  portal: Portal | null;

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
  /** Last "Sample 100" result; the forest draws seed piles from it. */
  batch: Batch | null;
  /** Last forest action, for the debrief. */
  forestEvent: ForestEvent | null;

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
  /** Start a portal jump. Returns false if locked, already there, or mid-jump. */
  travel: (to: ZoneId, at?: [number, number, number] | null) => boolean;
  /** Called by the camera at the bottom of the dive: switch worlds, begin emerging. */
  commitPortal: () => void;
  endPortal: () => void;

  placeProbe: (theta: Vec2) => void;
  setProbe: (s: GdState) => void;
  setRunning: (r: boolean) => void;
  setSpeed: (s: Speed) => void;
  resetProbe: () => void;
  dropBall: () => void;
  toggleField: () => void;
  revealOracle: () => void;

  sampleToken: (u?: number) => number;
  /** n independent draws at the current T. `rand` injectable for tests. */
  sampleBatch: (n?: number, rand?: () => number) => Batch;

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
  portal: null,

  travel: (to, at = null) => {
    const g = gameStore.getState();
    if (get().portal || g.currentZone === to || !isZoneUnlocked(to, g.completed)) return false;
    set({ portal: { from: g.currentZone, to, at, phase: "dive" }, running: false });
    return true;
  },
  commitPortal: () => {
    const p = get().portal;
    if (!p || p.phase !== "dive") return;
    gameStore.getState().travelTo(p.to);
    set({ portal: { ...p, phase: "emerge" } });
  },
  endPortal: () => set({ portal: null }),

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
  batch: null,
  forestEvent: null,

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
    set({ forestEvent: { kind: "single", T, id: nextId++ } });
    if (get().sampledCold && get().sampledHot) get().award("dunes.temperature-sweep");
    return index;
  },
  sampleBatch: (n = 100, rand = Math.random) => {
    const T = gameStore.getState().temperature;
    const p = softmax(LOGITS, T);
    const counts = new Array<number>(p.length).fill(0);
    for (let k = 0; k < n; k++) counts[sampleIndex(p, rand())]! += 1;
    const batch: Batch = { id: nextId++, T, n, counts };
    set({ batch, forestEvent: { kind: "batch", batch } });
    if (batchError(batch).gapPts <= BATCH_TOLERANCE_PTS) get().award("forest.law-of-large-numbers");
    return batch;
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

/** The HUD's single question about the portal. */
export const selectTransitioning = (s: SessionStore) => s.portal !== null;

export function useSession<T>(selector: (s: SessionStore) => T): T {
  return useStore(sessionStore, selector);
}
