# Cogniterra

Walk the math. A playable atlas of how machines learn.

**Play:** https://glowstonesq1.github.io/K_GamePlay/

| Zone | Concept | What you do |
|---|---|---|
| Z0 The Grid | Parameter space | Start here. Every point on the floor is a different model. |
| Z1 Loss Valley | Gradient descent | Drop a Gradient Guide on a real loss surface, tune η against the stability edge 2/λ_max, show the slope field, race it against a rolling ball (momentum), then reveal the Oracle's full-knowledge route. |
| Z2 Backprop Forge | Backpropagation | Train a from-scratch neural network in a Web Worker. Step once to watch blame flow backwards; train until it separates two moons. |
| Z3 Token Dunes | Next-token sampling | Dune height is softmax(logits / T). Change temperature and sample the next word. |
| Z4 Skew Archive | Dataset bias | Skew the training sample, walk into the under-represented region and see the model's errors; rebalance to close the gap. |

## How it's built

- Next.js 16 static export, React Three Fiber, Rapier physics, Zustand, Tailwind 4.
- All maths is analytic or from scratch: closed-form gradients and Hessians, A* for the Oracle, a hand-written MLP with a finite-difference gradient check.
- Builds use webpack (`next build --webpack`) because the trainer Web Worker must be bundled.

## Develop

```bash
npm install
npm run dev
npm test
```

Static build for GitHub Pages: `STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/K_GamePlay npm run build` writes `./out`.
Deploys run from `.github/workflows/pages.yml`.
