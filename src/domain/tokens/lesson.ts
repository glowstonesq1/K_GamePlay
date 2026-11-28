// src/domain/tokens/lesson.ts
import type { Lesson } from "../optim/lesson";
import { COLD_T, HOT_T, LOGITS, TOKENS } from "./corpus";
import { entropyBits, softmax } from "./sampling";

/** Tokens whose cumulative mass (in rank order) first reaches `topP`: the nucleus. */
export function nucleus(p: readonly number[], topP = 0.9): number[] {
  const order = p.map((_, i) => i).sort((a, b) => p[b]! - p[a]!);
  const out: number[] = [];
  let acc = 0;
  for (const i of order) {
    out.push(i);
    acc += p[i]!;
    if (acc >= topP) break;
  }
  return out;
}

export interface Batch {
  id: number;
  T: number;
  n: number;
  counts: number[];
}

/**
 * PEDAGOGY: one standard error of an empirical frequency after n draws is √(p(1−p)/n).
 * At n = 100 and p ≈ 0.4 that's ±4.9 points, so "within 5 points" passes about two
 * times in three. Missing it is luck, not a bug, and the debrief says so with the number.
 */
export function batchError(b: Batch, index = 0) {
  const p = softmax(LOGITS, b.T)[index]!;
  const seen = b.counts[index]! / b.n;
  return { p, seen, gapPts: Math.abs(seen - p) * 100, sePts: Math.sqrt((p * (1 - p)) / b.n) * 100 };
}

export const BATCH_TOLERANCE_PTS = 5;

export type ForestEvent = { kind: "single"; T: number; id: number } | { kind: "batch"; batch: Batch };

/**
 * The forest's debrief, chosen from the last thing the player did. A single draw at a
 * middling T teaches nothing new on its own, so it returns null rather than nag.
 */
export function forestLesson(e: ForestEvent | null): Lesson | null {
  if (!e) return null;
  const top = TOKENS[0]!.text;

  if (e.kind === "batch") {
    const { p, seen, gapPts, sePts } = batchError(e.batch);
    const close = gapPts <= BATCH_TOLERANCE_PTS;
    return {
      kind: "global",
      title: close ? "The piles found the heights" : "A hundred draws, still noisy",
      body: close
        ? `Tree height is the probability; each seed pile is what ${e.batch.n} draws actually did. "${top}" was ${(p * 100).toFixed(0)}% likely and caught ${(seen * 100).toFixed(0)}% of the seeds. The model never picks a word: it hands the sampler a distribution, and enough draws trace its shape.`
        : `"${top}" was ${(p * 100).toFixed(0)}% likely but caught ${(seen * 100).toFixed(0)}% of the seeds. That's luck: at ${e.batch.n} draws the typical miss is about ±${sePts.toFixed(0)} points. Shake again and the piles will wander around the true heights.`,
      figure: { label: `"${top}": likely vs caught`, value: `${(p * 100).toFixed(0)}% / ${(seen * 100).toFixed(0)}%` },
    };
  }

  const p = softmax(LOGITS, e.T);
  if (e.T <= COLD_T) {
    return {
      kind: "global",
      title: "Cold: one giant tree",
      body: `At T = ${e.T.toFixed(2)} the logits are divided by a small number, so their gaps grow and softmax piles ${(p[0]! * 100).toFixed(0)}% onto "${top}". Low temperature is close to always picking the top word: safe, and repetitive.`,
      figure: { label: `P("${top}")`, value: `${(p[0]! * 100).toFixed(1)}%` },
    };
  }
  if (e.T >= HOT_T) {
    const H = entropyBits(p);
    const Hmax = Math.log2(p.length);
    return {
      kind: "global",
      title: "Hot: a level grove",
      body: `At T = ${e.T.toFixed(1)} the gaps between logits shrink and the forest flattens to ${H.toFixed(2)} of a possible ${Hmax.toFixed(2)} bits. Unlikely words now get real chances. That's where both surprise and nonsense come from. The order of the trees never changed.`,
      figure: { label: "Entropy", value: `${H.toFixed(2)} bits` },
    };
  }
  return null;
}
