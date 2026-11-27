# Cogniterra

Walk the math. A playable atlas of how machines learn.

**Play:** https://glowstonesq1.github.io/K_GamePlay/

| Zone | Concept | What you do |
|---|---|---|
| Z1 Loss Valley | Gradient descent | Drop a probe on a real loss surface, tune η against the stability edge 2/λ_max, race it against a rolling ball (momentum). |
| Z3 Token Dunes | Next-token sampling | Dune height is softmax(logits / T). Change temperature and sample the next word. |
| Z2, Z4 | Backprop, dataset bias | Coming in later modules. |

## Develop

```bash
npm install
npm run dev
npm test
```

Static build for GitHub Pages: `STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/K_GamePlay npm run build` writes `./out`.
Deploys run from `.github/workflows/pages.yml`.
