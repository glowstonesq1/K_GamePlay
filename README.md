# Cogniterra

Walk the math. A playable atlas of how machines learn.

**Play:** https://glowstonesq1.github.io/K_GamePlay/

## The Multiverse Hub (OMNIS)

The site opens on The Multiverse Hub. The player picks one of three stylised explorers, Nova, Atlas or Sage, who stand beside a holographic pedestal. Drag the chosen explorer to turn it. Five portals arc behind the pedestal:

- The Cosmic Observatory (AI and machine learning). This portal is playable and holds all of the Cogniterra content below.
- The Neon Citadel (cybersecurity)
- The Voxel Foundry (data structures and algorithms)
- The Paper Atelier (creative coding)
- The Lantern Library (everyday tech literacy)

The four sealed universes have blueprints in `docs/omnis-blueprints.md`. A keyboard-accessible "Universes" list in the HUD opens the same portals.

### Resonance

Resonance is the player-facing name for XP. It comes only from completed objectives. Skill nodes spend it, so available Resonance is earned minus spent. There is no way to add Resonance directly.

### Skill tree

The skill tree is a glass panel in the hub. It has four paths:

- Logic. Tier 1 is gated by "Settle into a minimum". Tier 2 is gated by "Train until the network separates both moons".
- Ethics. Tier 1 is gated by the shortcut objective in Curiosity mode. Tier 2 is gated by "Rebalance the sample until the gap closes".
- Stealth and Creativity. Both stay sealed until their universes exist.

A node needs its gate and enough unspent Resonance. Each node grants a wearable accessory: Lattice visor, Orbit rings, Fair halo, Cosmic aura, Shadow hood or Prism crown. Accessories appear on the 3D avatar and are toggled in the "Your explorer" card.

### Saves

Saves are now version 2. Version 1 saves load with defaults. A hand-edited save cannot grant skills the player has not earned.

## Cogniterra

The Cosmic Observatory is the hub for the worlds below. It is a deep-space starfield with a slowly rotating nebula. Four glowing constellation nodes are the doors to the worlds. Clicking an unlocked node starts a portal jump: the camera accelerates into the node while the field of view widens, a flash in the world's colour hides the switch, and the camera eases out onto the world. Press Esc to go up one level, or use "Return to observatory" to return from a world. Esc from the Observatory returns to the Multiverse Hub. The sky stays visible behind every world.

The ECHO toggle at the Observatory switches between two modes:

- Architect mode runs the four simulation worlds in the table below.
- Curiosity mode, "Train the cat/dog AI", has the player sort animal cards into Cat and Dog bins. Drag a card to a bin, or tap a card and then a bin. A small naive Bayes classifier trains on those labels. The starter deck is deliberately skewed: every cat is orange and every dog is brown. The AI learns that orange means cat, so it calls a Shiba Inu a cat. Adding two more varied examples corrects it. Curiosity mode has two objectives, worth 50 Resonance each. A fun-fact strip serves facts from a local list, because the site's content security policy blocks outside requests.

| World | Concept | What you do |
|---|---|---|
| The Cosmic Observatory | Hub | Start here. The four constellation nodes are the doors to the worlds. |
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
- OMNIS code lives in `src/domain/omnis/` (universes, skills, avatars, Curiosity mode, fun facts), `src/components/hub/` (the hub scene and avatar) and `src/components/hud/omnis/` (skill tree, Curiosity lab, ECHO toggle, explorer card).

## Develop

```bash
npm install
npm run dev
npm test
```

`npm test` runs the 95-test suite.

Static build for GitHub Pages: `STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/K_GamePlay npm run build` writes `./out`.
Deploys run from `.github/workflows/pages.yml`.
