// src/domain/zones.ts
import type { ObjectiveId } from "./objectives";
import type { Hyperparam } from "./hyperparams";

export const ZONE_IDS = [
  "hub",
  "loss-valley",
  "backprop-forge",
  "token-dunes",
  "skew-archive",
] as const;

export type ZoneId = (typeof ZONE_IDS)[number];

export interface ZoneDef {
  id: ZoneId;
  code: string;
  name: string;
  /** The real concept this zone teaches. Shown in the HUD; keep it accurate. */
  concept: string;
  /** One line of player-facing copy. */
  brief: string;
  /** Which dials the HUD exposes here. Anything else is hidden, not disabled. */
  controls: readonly Hyperparam[];
  /** Objective that opens this zone. null = open from the start. */
  unlockedBy: ObjectiveId | null;
}

export const ZONES: Readonly<Record<ZoneId, ZoneDef>> = {
  hub: {
    id: "hub",
    code: "Z0",
    name: "The Grid",
    concept: "Parameter space",
    brief: "Every point on this floor is a different model. Pick a direction.",
    controls: [],
    unlockedBy: null,
  },
  "loss-valley": {
    id: "loss-valley",
    code: "Z1",
    name: "Loss Valley",
    // PEDAGOGY: Height = L(θ). The player's ball only knows the local slope, so
    // it follows −∇L. It does not know where the global minimum is (Module 3 Oracle
    // path is revealed only after the run).
    concept: "Gradient descent",
    brief: "You can only feel the slope under your feet. Trust it, or don't.",
    controls: ["learningRate"],
    unlockedBy: "hub.boot",
  },
  "backprop-forge": {
    id: "backprop-forge",
    code: "Z2",
    name: "Backprop Forge",
    // PEDAGOGY: Error at the output flows backward; each edge's share is
    // the product of local derivatives along the path (chain rule).
    concept: "Backpropagation",
    brief: "Blame travels backward. Every wire gets its share.",
    controls: ["learningRate"],
    unlockedBy: "valley.first-descent",
  },
  "token-dunes": {
    id: "token-dunes",
    code: "Z3",
    name: "Token Dunes",
    // PEDAGOGY: Dune height = softmax(logits / T). Low T sharpens one peak,
    // high T flattens the field. The terrain literally is the sampling distribution.
    concept: "Next-token sampling",
    brief: "The tallest dune is the likeliest word. Temperature moves the sand.",
    controls: ["temperature"],
    unlockedBy: "forge.chain-rule",
  },
  "skew-archive": {
    id: "skew-archive",
    code: "Z4",
    name: "Skew Archive",
    // PEDAGOGY: Bias lives in the data, not the body. sampleSkew controls how
    // unrepresentative the training sample is; the avatar's *perception* of the
    // world degrades for under-sampled regions. The avatar itself moves normally.
    concept: "Dataset bias",
    brief: "The model learned from a lopsided archive. Go see what it can't see.",
    controls: ["sampleSkew"],
    unlockedBy: "dunes.temperature-sweep",
  },
};

export function isZoneUnlocked(
  zone: ZoneId,
  completed: Partial<Record<ObjectiveId, true>>,
): boolean {
  const gate = ZONES[zone].unlockedBy;
  return gate === null || completed[gate] === true;
}

export function isZoneId(v: unknown): v is ZoneId {
  return typeof v === "string" && (ZONE_IDS as readonly string[]).includes(v);
}
