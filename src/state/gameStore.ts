// src/state/gameStore.ts
import { createStore, useStore } from "zustand";
import { createJSONStorage, persist, type PersistStorage } from "zustand/middleware";
import { isObjectiveId, OBJECTIVES, xpFromCompleted, type ObjectiveId } from "@/domain/objectives";
import { isZoneId, isZoneUnlocked, ZONES, type ZoneId } from "@/domain/zones";
import { clampHyperparam, HYPERPARAMS, type Hyperparam } from "@/domain/hyperparams";

/*
 * SCHEMA RULES
 * 1. Store only facts. playerXP and unlocked zones are DERIVED (selectors below);
 *    storing them would let them disagree with `completed`.
 * 2. Every write goes through a validating action. Nothing calls setState directly.
 * 3. Persisted data is untrusted (localStorage is user-editable). It is sanitized on
 *    rehydrate, never spread into state raw.
 * 4. Hot paths (R3F useFrame) read `gameStore.getState()` imperatively; they never
 *    subscribe via the hook, so a slider drag doesn't re-render the scene graph.
 */

export interface GameState {
  /** Set of completed objectives. The single source of truth for progression. */
  completed: Partial<Record<ObjectiveId, true>>;
  currentZone: ZoneId;
  learningRate: number;
  temperature: number;
  sampleSkew: number;
  /** False until localStorage has been read. Not persisted. */
  hydrated: boolean;
}

export interface GameActions {
  /** Idempotent. Returns XP actually awarded (0 if already done), so VFX can react to the delta. */
  completeObjective: (id: ObjectiveId) => number;
  /** Returns false (and does nothing) if the zone is locked. */
  travelTo: (zone: ZoneId) => boolean;
  setHyperparam: (p: Hyperparam, value: number) => void;
  resetProgress: () => void;
}

export type GameStore = GameState & GameActions;

type Persisted = Pick<
  GameState,
  "completed" | "currentZone" | "learningRate" | "temperature" | "sampleSkew"
>;

const STORAGE_KEY = "cogniterra:v1";
const STORAGE_VERSION = 1;

function initialState(): GameState {
  return {
    completed: {},
    currentZone: "hub",
    learningRate: HYPERPARAMS.learningRate.initial,
    temperature: HYPERPARAMS.temperature.initial,
    sampleSkew: HYPERPARAMS.sampleSkew.initial,
    hydrated: false,
  };
}

/** Turn arbitrary JSON into a valid Persisted, dropping anything unrecognised. */
export function sanitizePersisted(raw: unknown): Persisted {
  const base = initialState();
  const obj = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const completed: Partial<Record<ObjectiveId, true>> = {};
  const rawCompleted = obj.completed;
  if (rawCompleted !== null && typeof rawCompleted === "object") {
    for (const [k, v] of Object.entries(rawCompleted)) {
      if (isObjectiveId(k) && v === true) completed[k] = true;
    }
  }

  const zone = isZoneId(obj.currentZone) ? obj.currentZone : base.currentZone;

  return {
    completed,
    // A tampered save can't drop you into a zone you haven't earned.
    currentZone: isZoneUnlocked(zone, completed) ? zone : "hub",
    learningRate: clampHyperparam("learningRate", obj.learningRate),
    temperature: clampHyperparam("temperature", obj.temperature),
    sampleSkew: clampHyperparam("sampleSkew", obj.sampleSkew),
  };
}

export function createGameStore(storage?: PersistStorage<Persisted>) {
  // Late-bound self reference: the rehydrate callback runs long after creation, and on a
  // storage error zustand passes it `undefined` and skips onFinishHydration listeners.
  // Closures below run after this const is assigned, so the self-reference is safe.
  const self = createStore<GameStore>()(
    persist(
      (set, get) => ({
        ...initialState(),

        completeObjective: (id) => {
          if (!isObjectiveId(id) || get().completed[id]) return 0;
          set((s) => ({ completed: { ...s.completed, [id]: true } }));
          return OBJECTIVES[id].xp;
        },

        travelTo: (zone) => {
          if (!isZoneId(zone) || !isZoneUnlocked(zone, get().completed)) return false;
          if (get().currentZone !== zone) set({ currentZone: zone });
          return true;
        },

        setHyperparam: (p, value) => {
          if (!(p in HYPERPARAMS)) return;
          const v = clampHyperparam(p, value);
          if (get()[p] !== v) set({ [p]: v } as Pick<GameState, Hyperparam>);
        },

        resetProgress: () => set({ ...initialState(), hydrated: true }),
      }),
      {
        name: STORAGE_KEY,
        version: STORAGE_VERSION,
        storage: storage ?? createJSONStorage<Persisted>(() => localStorage),
        // Next.js renders on the server first. Rehydrating at module load would make
        // the client's first render differ from the HTML → hydration mismatch.
        // <Hud /> calls persist.rehydrate() in an effect instead.
        skipHydration: true,
        partialize: (s): Persisted => ({
          completed: s.completed,
          currentZone: s.currentZone,
          learningRate: s.learningRate,
          temperature: s.temperature,
          sampleSkew: s.sampleSkew,
        }),
        // Future schema changes land here. Unknown versions fall back to sanitize.
        migrate: (persisted) => sanitizePersisted(persisted) as unknown as GameStore,
        merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
        onRehydrateStorage: () => (_state, error) => {
          if (error) console.warn("[cogniterra] save data unreadable, starting fresh");
          self.setState({ hydrated: true });
        },
      },
    ),
  );
  return self;
}

export const gameStore = createGameStore();

/* ------------------------------------------------------------------ selectors */

export const selectPlayerXP = (s: GameState): number => xpFromCompleted(s.completed);
export const selectZone = (s: GameState) => ZONES[s.currentZone];
export const selectIsUnlocked = (zone: ZoneId) => (s: GameState) =>
  isZoneUnlocked(zone, s.completed);

/* ---------------------------------------------------------------------- hook */

export function useGame<T>(selector: (s: GameStore) => T): T {
  return useStore(gameStore, selector);
}
