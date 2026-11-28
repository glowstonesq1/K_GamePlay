// src/domain/bias/archive.ts
import { gaussian, mulberry32 } from "../rng";

/*
 * PEDAGOGY — representation bias, from mechanism, not metaphor.
 *
 * One true rule covers everyone: label = 1 iff y > 0.7·|x| − 0.6 (a V).
 * Two groups live in different parts of feature space: group A around x ≈ −1.6, group B
 * around x ≈ +1.6. Inside A's region the rule is a straight line sloping down; the bend
 * only shows up where B lives. A model can only learn the bend from B's data.
 *
 * The model is a single logistic regression on [1, x, y]: one straight line for everyone.
 * It cannot represent the V, so training must trade accuracy between the groups, and the
 * loss weighs each group by how many of its examples are in the sample. Balanced data → a
 * compromise line that is equally (im)perfect for both. Skewed data → the line tilts toward
 * the majority's slope: A's accuracy rises, B's falls, overall accuracy (dominated by A)
 * still looks fine. Nothing about B is "harder"; B was out-voted in the loss. That gap is
 * the bias, and it grows smoothly with skew, which is how it shows up in real deployments.
 */

export type Group = 0 | 1; // 0 = A (majority), 1 = B (minority)

export interface Person {
  x: number;
  y: number;
  group: Group;
  label: 0 | 1;
}

const CENTRES: Record<Group, number> = { 0: -1.6, 1: 1.6 };

export const trueLabel = (x: number, y: number): 0 | 1 => (y > 0.7 * Math.abs(x) - 0.6 ? 1 : 0);

export function samplePeople(n: number, group: Group, rand: () => number): Person[] {
  const out: Person[] = [];
  for (let i = 0; i < n; i++) {
    const x = CENTRES[group] + 0.6 * gaussian(rand);
    const y = 0.5 + 0.9 * gaussian(rand);
    out.push({ x, y, group, label: trueLabel(x, y) });
  }
  return out;
}

/** Fraction of group B in the training sample: 50% at skew 0, 1% at skew 1. */
export function minorityShare(skew: number): number {
  const s = Math.min(1, Math.max(0, skew));
  return 0.5 * (1 - s) + 0.01 * s;
}

export const features = (x: number, y: number): number[] => [1, x / 2, y / 2];

export interface Model {
  w: number[];
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function predictProb(m: Model, x: number, y: number): number {
  const f = features(x, y);
  let z = 0;
  for (let i = 0; i < f.length; i++) z += m.w[i]! * f[i]!;
  return sigmoid(z);
}

/** Full-batch gradient descent on mean binary cross-entropy + L2 (bias term unregularised). */
export function trainLogistic(data: readonly Person[], iters = 800, lr = 1.5, l2 = 2e-3): Model {
  const d = 3;
  const w = new Array<number>(d).fill(0);
  const X = data.map((p) => features(p.x, p.y));
  for (let it = 0; it < iters; it++) {
    const g = new Array<number>(d).fill(0);
    for (let k = 0; k < data.length; k++) {
      const f = X[k]!;
      let z = 0;
      for (let i = 0; i < d; i++) z += w[i]! * f[i]!;
      const err = sigmoid(z) - data[k]!.label; // ∂BCE/∂z
      for (let i = 0; i < d; i++) g[i]! += err * f[i]!;
    }
    for (let i = 0; i < d; i++) {
      const reg = i === 0 ? 0 : l2 * w[i]!;
      w[i] = w[i]! - lr * (g[i]! / data.length + reg);
    }
  }
  return { w };
}

export interface ArchiveRun {
  model: Model;
  train: Person[];
  /** Balanced held-out population the player walks among. */
  world: Person[];
  accA: number;
  accB: number;
  /** accA − accB, in percentage points. */
  gapPts: number;
}

export const TRAIN_N = 400;
export const WORLD_PER_GROUP = 300;

/** Deterministic for a given (skew, seed): same slider position, same world. */
export function runArchive(skew: number, seed = 7): ArchiveRun {
  const rand = mulberry32(seed);
  const nB = Math.round(TRAIN_N * minorityShare(skew));
  const train = [...samplePeople(TRAIN_N - nB, 0, rand), ...samplePeople(nB, 1, rand)];
  const model = trainLogistic(train);

  const worldRand = mulberry32(seed + 1000);
  const world = [...samplePeople(WORLD_PER_GROUP, 0, worldRand), ...samplePeople(WORLD_PER_GROUP, 1, worldRand)];
  const acc = (g: Group) => {
    const ps = world.filter((p) => p.group === g);
    const ok = ps.filter((p) => (predictProb(model, p.x, p.y) > 0.5 ? 1 : 0) === p.label).length;
    return ok / ps.length;
  };
  const accA = acc(0);
  const accB = acc(1);
  return { model, train, world, accA, accB, gapPts: (accA - accB) * 100 };
}
