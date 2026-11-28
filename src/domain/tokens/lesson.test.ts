import { describe, expect, it } from "vitest";
import { COLD_T, HOT_T, LOGITS } from "./corpus";
import { batchError, forestLesson, nucleus, type Batch } from "./lesson";
import { softmax } from "./sampling";

describe("nucleus", () => {
  it("is the smallest rank-ordered set reaching top-p", () => {
    const p = softmax(LOGITS, 1);
    const n = nucleus(p, 0.9);
    const mass = n.reduce((a, i) => a + p[i]!, 0);
    expect(mass).toBeGreaterThanOrEqual(0.9);
    expect(mass - p[n[n.length - 1]!]!).toBeLessThan(0.9);
    expect(n[0]).toBe(0);
  });
  it("shrinks to one tree when cold and grows when hot", () => {
    expect(nucleus(softmax(LOGITS, 0.1))).toEqual([0]);
    expect(nucleus(softmax(LOGITS, 10)).length).toBeGreaterThan(7);
  });
});

describe("forestLesson", () => {
  it("stays quiet for a middling single draw", () => {
    expect(forestLesson({ kind: "single", T: 1, id: 1 })).toBeNull();
    expect(forestLesson(null)).toBeNull();
  });
  it("teaches cold and hot", () => {
    expect(forestLesson({ kind: "single", T: COLD_T, id: 1 })?.title).toMatch(/Cold/);
    expect(forestLesson({ kind: "single", T: HOT_T, id: 1 })?.title).toMatch(/Hot/);
  });
  it("judges a batch against the true height with the standard error in the copy", () => {
    const p0 = softmax(LOGITS, 1)[0]!;
    const near: Batch = { id: 1, T: 1, n: 100, counts: [Math.round(p0 * 100), 100 - Math.round(p0 * 100), 0, 0, 0, 0, 0, 0, 0, 0] };
    const far: Batch = { ...near, counts: [Math.round(p0 * 100) + 15, 100 - Math.round(p0 * 100) - 15, 0, 0, 0, 0, 0, 0, 0, 0] };
    expect(batchError(near).gapPts).toBeLessThan(1);
    expect(forestLesson({ kind: "batch", batch: near })?.title).toMatch(/found the heights/);
    const l = forestLesson({ kind: "batch", batch: far })!;
    expect(l.title).toMatch(/noisy/);
    expect(l.body).toContain(`±${batchError(far).sePts.toFixed(0)}`);
  });
});
