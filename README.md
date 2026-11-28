# Cogniterra

Walk the math. A playable atlas of how machines learn.

**Play:** https://glowstonesq1.github.io/K_GamePlay/

The Observatory is the hub. It is a deep-space starfield with a slowly rotating nebula. Four glowing constellation nodes are the doors to the worlds. Clicking an unlocked node starts a portal jump: the camera accelerates into the node while the field of view widens, a flash in the world's colour hides the switch, and the camera eases out onto the world. Press Esc or "Return to observatory" to go home. The sky stays visible behind every world.

| World | Concept | What you do |
|---|---|---|
| The Observatory | Hub | Start here. The four constellation nodes are the doors to the worlds. |
| The Loss Valley (cyan, `loss-valley`) | Gradient descent | Drop a Gradient Guide on a real loss surface and tune the learning rate η (0.01 to 1.0, log scale, default 0.05) against the stability edge 2/λ_max ≈ 0.254. Show the slope field, race it against a rolling ball (momentum), then reveal the Oracle's full-knowledge route. |
| The Token Forest (violet, `token-dunes`) | Next-token sampling | One tree per candidate word; height is softmax(logits / T). Only trees inside the top-p 0.9 nucleus glow. Sample one word, or shake 100 seeds and compare each seed pile with its tree's height. |
| The Mirror Realm (rose, `skew-archive`) | Dataset bias | Skew the training sample, walk into the under-represented region and see the model's errors; rebalance to close the gap. |
| The Neural Core (gold, `backprop-forge`) | Backpropagation | Train a from-scratch neural network in a Web Worker. Step once to watch blame flow backwards; train until it separates two moons. |

Internal zone ids are unchanged in the code and shown in backticks above.

## Loss Valley notes

- Past the stability edge the probe does not fly off. The bowl keeps it on the map.
- A run is called "Unstable" once more than 30% of its steps went uphill after 400 steps.
- The objective "Settle on the true floor, not just a floor" (+75 XP) is awarded when a converged run ends in the global basin.
- After every finished run, a "What just happened" debrief explains the outcome (true floor, local floor, zigzag or unstable) with the update θ ← θ − η∇L.

## How it's built

- Next.js 16 static export, React Three Fiber, Rapier physics, Zustand, Tailwind 4, Motion for HUD animation.
- All maths is analytic or from scratch: closed-form gradients and Hessians, A* for the Oracle, a hand-written MLP with a finite-difference gradient check. The Loss Valley lesson rules live in `src/domain/optim/lesson.ts`.
- HUD panels are dark glass (bg-black/40, blur, white/10 hairline). World names use Instrument Serif, body text uses Geist and numbers use JetBrains Mono. Every HUD accent retints to the current world's colour.
- HUD animations respect `prefers-reduced-motion`.
- Builds use webpack (`next build --webpack`) because the trainer Web Worker must be bundled.

## Develop

```bash
npm install
npm run dev
npm test
```

`npm test` runs the 83-test suite.

Static build for GitHub Pages: `STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/K_GamePlay npm run build` writes `./out`.
Deploys run from `.github/workflows/pages.yml`.
