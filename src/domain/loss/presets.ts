// src/domain/loss/presets.ts
import { compileLandscape, type LandscapeSpec } from "./landscape";

/**
 * Loss Valley terrain. Three basins of different depth:
 *   - a deep, wide global minimum (north-east),
 *   - a shallower local minimum (south-west) that traps careless starts,
 *   - a narrow, steep pocket (north-west) that sets λ_max and so the divergence threshold.
 *
 * PEDAGOGY: Where you drop the probe decides which basin you end in. Same rule,
 * same η, different answer. That is initialisation sensitivity, not a bug.
 */
export const VALLEY_SPEC: LandscapeSpec = {
  id: "valley-v1",
  bowl: 0.12,
  extent: 3,
  wells: [
    { mu: [1.25, 0.85], amp: 3.0, sigma: 0.75 },
    { mu: [-1.35, -0.95], amp: 1.9, sigma: 0.6 },
    { mu: [-1.05, 1.55], amp: 1.1, sigma: 0.38 },
  ],
};

export const VALLEY = compileLandscape(VALLEY_SPEC);
