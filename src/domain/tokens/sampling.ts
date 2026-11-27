// src/domain/tokens/sampling.ts
//
// PEDAGOGY: An LLM's last layer emits one logit zₖ per vocabulary token. Sampling with
// temperature T draws the next token from
//
//     pₖ = exp(zₖ / T) / Σⱼ exp(zⱼ / T)
//
// T → 0 collapses onto argmax (greedy); T = 1 is the model's raw distribution;
// T → ∞ approaches uniform. Temperature rescales logits; it never reorders them.

export function softmax(logits: readonly number[], temperature: number): number[] {
  if (!(temperature > 0)) throw new RangeError("temperature must be > 0");
  // Subtract the max before exp: mathematically identical, numerically stable.
  let m = -Infinity;
  for (const z of logits) if (z > m) m = z;
  const e = logits.map((z) => Math.exp((z - m) / temperature));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}

/** Shannon entropy in bits. 0 = certain; log₂(K) = uniform over K tokens. */
export function entropyBits(p: readonly number[]): number {
  let h = 0;
  for (const q of p) if (q > 0) h -= q * Math.log2(q);
  return h;
}

/**
 * Inverse-CDF categorical draw. `u` ∈ [0, 1) is injected so tests are deterministic.
 */
export function sampleIndex(p: readonly number[], u: number): number {
  let acc = 0;
  for (let i = 0; i < p.length; i++) {
    acc += p[i]!;
    if (u < acc) return i;
  }
  return p.length - 1; // floating-point remainder
}
