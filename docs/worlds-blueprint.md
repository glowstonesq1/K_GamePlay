# Worlds 2–4: Cosmic rebuild blueprints

All three worlds already run and are tested, so these blueprints are **upgrades, not greenfield builds**. Each one keeps the domain math that ships today, which is covered by unit tests under `src/domain`, and replaces the scene, the interaction and the debrief. To run one, say "Execute World N blueprint". Everything needed is on this page.

## Shared contract

These apply to every world.

- **Entry.** The player arrives by portal from the hub node (`sessionStore.travel(zone, nodePos)`). The world's establishing shot lives in `VIEWS` in `src/components/scene/Scene.tsx`.
- **Accent.** Each world has one glow colour from `WORLD_ACCENT` in `src/design/palette.ts`, mirrored as `--color-<name>` in `globals.css`. The HUD retints itself, so no colour literals are allowed in HUD code.
- **Glow budget.** Only `toneMapped={false}` materials with colour above 1.0 reach bloom (threshold 0.72). Terrain and props stay below it, so at most three things glow in any frame.
- **Debrief.** A pure `xxxLesson(state) → Lesson | null` lives in `src/domain/<topic>/lesson.ts` with a unit test for every branch. `PedagogyNote` renders it. The lesson is chosen from what happened, never from what the player meant.
- **Objectives.** Add them to `src/domain/objectives.ts`. XP is derived from completed objectives and never stored.
- **Stays as is.** The sky (`CosmicHub` keeps it mounted), the particles bus (`fx.emit`), and the reduced-motion and phone-width rules.
- **Code rules.** Write `// PEDAGOGY:` comments wherever the code encodes a claim about ML. If the claim is wrong, the code is wrong.

---

## World 2: The Token Forest (violet)

```json
{
  "id": "token-dunes",
  "concept": "Next-token sampling: softmax over logits, temperature, entropy",
  "keepsDomain": ["src/domain/tokens/sampling.ts", "src/domain/tokens/corpus.ts"],
  "replacesScene": "src/components/scene/zones/TokenDunes.tsx -> TokenForest.tsx"
}
```

**Environment**
- **The forest.** A circular clearing on a dark violet floor holds one luminous tree per candidate token: 12 trees, the same `TOKENS` list as today.
- **Height carries probability.** Tree height is `softmax(LOGITS / T)[i]`. Canopy brightness is the same value, mapped so that only the top-p trees, with cumulative p ≤ 0.9, cross the bloom threshold.
- **Where trees stand.** Trees keep the spiral layout from today's dunes, so the most likely token sits in the centre.
- **The prompt.** `PROMPT` floats overhead as a constellation of words. Each sampled token is appended as a new star.
- **Ground fog.** A fog layer sits at height `1/12`, the uniform-distribution line. Trees that poke above it are better than chance.

**Core mechanic: shake the canopy**
- **Sampling.** A press of "Sample" drops a seed from the sky, and it lands on tree *i* with probability *pᵢ*. Use inverse-CDF sampling on one uniform *u*; `sampleIndex` already does this. The landing tree pulses and its word joins the sentence.
- **Temperature.** The dial (log scale, 0.1–10) reshapes the forest live. Low T grows one giant and shrinks the rest; high T levels the canopy into a flat grove.
- **Entropy readout.** Show H(p) in bits beside a meter running from 0 to log₂12 ≈ 3.58.

**UI**
- **Instrument:** the T dial, the Sample button, an entropy readout, and the last 10 samples as chips (already built).
- **New:** a "Sample 100" button that fires 100 seeds in 0.8 s and leaves a histogram of fallen seeds at each trunk's base, so the player can compare empirical frequency with height.

**Objectives**
- `dunes.temperature-sweep`: sample at T ≤ COLD_T and at T ≥ HOT_T. Already exists.
- **New** `forest.law-of-large-numbers` (+80 XP): run "Sample 100" and land within 5 points of p on the tallest tree.

**Debrief** (`tokenLesson`):
- **Cold:** "At T = 0.2 the tallest tree took 98 % of seeds. Sampling at low T is nearly argmax: safe, repetitive."
- **Hot:** "At T = 6 the forest is almost flat (H ≈ 3.4 of 3.58 bits). Unlikely words get real chances; that's where both creativity and nonsense come from."
- **Histogram:** "Heights are probabilities; the seed piles are what one run of luck actually did. 100 samples, ±5 points."

**What the player should take away:** the model never picks a word. It outputs a distribution, and a sampler picks. Temperature divides the logits before the softmax, so it changes the shape of the distribution, never the order of the trees.

**Guard rails**
- Never call T "creativity" in UI copy.
- T must stay above 0; the dial clamp already enforces this.
- Don't show raw logits as probabilities anywhere.

---

## World 3: The Mirror Realm (rose)

```json
{
  "id": "skew-archive",
  "concept": "Dataset bias: a model learns the sample, not the world",
  "keepsDomain": ["src/domain/bias/archive.ts"],
  "replacesScene": "src/components/scene/zones/SkewArchive.tsx -> MirrorRealm.tsx"
}
```

**Environment**
- **Two floors.** A black-glass floor reflects everything; the reflection is the model's view of the world.
- **The real world.** Above the floor stand two populations, A and B, as 300 soft glowing pillars each. The true rule is the V shape `y > 0.7|x| − 0.6`.
- **The reflection.** Below the floor sits the model's mirror image. Pillars it classifies correctly reflect cleanly; misclassified ones reflect as cracked, rose-tinted shards.
- **Two boundaries.** The model's linear boundary is drawn as a thin rose line on the mirror. The true V is a dashed starlight line above it.

**Core mechanic: tilt the mirror**
- **The dial.** `sampleSkew` (0–1) sets how unrepresentative the training sample is. The minority share is `0.5(1−s) + 0.01s`, and N_train is 400; both are already implemented.
- **Retraining.** Moving the dial retrains logistic regression (about 10 ms, synchronous). The mirror's crack pattern updates live.
- **Walking.** The player walks the surveyor avatar into group B's region by clicking the floor (spring motion already built). Near the avatar, perception radius 3.4, the mirror shows what the model "sees" of the people nearby.

**UI**
- **Instrument:** the skew dial, accuracy for A and accuracy for B as two large readouts, and the gap in points with alarm tone at 12 or more (already built).
- **New:** a small "training sample" strip showing the 400 training dots, coloured by group. As skew rises, B's dots visibly vanish, so the cause stays on screen next to the effect.

**Objectives**
- `archive.skew-detected` and `archive.rebalance`. Both already exist.
- **New** `mirror.same-model` (+60 XP): with skew at 1, toggle "Evaluate on B only" and watch overall accuracy stay high while B's collapses.

**Debrief** (`mirrorLesson`):
- **Detected:** "Overall accuracy is 91 %. For group B it's 52 %, a coin flip. The model isn't malicious; it saw 4 people from B out of 400 and fit everyone else."
- **Rebalanced:** "Same algorithm, same features, balanced sample: the gap closed to 3 points. The fix was in the data."
- **Averages:** "A single accuracy number averaged B away. Always break metrics down by group."

**What the player should take away:** bias here comes from the training sample, not from the people and not from the avatar. An aggregate metric can hide a subgroup failure. More data from the under-sampled group fixes it in this setup. In real systems that is necessary but not always enough, and the debrief says so in one line.

**Guard rails**
- The skew control must never be called "bias" (`b` is a learned parameter).
- Never suggest that group B is inherently harder; the true rule is equally simple for both.

---

## World 4: The Neural Core (gold)

```json
{
  "id": "backprop-forge",
  "concept": "Backpropagation: forward pass, loss, chain rule, gradient step",
  "keepsDomain": ["src/domain/nn/mlp.ts", "src/domain/nn/protocol.ts", "src/workers/trainer.worker.ts"],
  "replacesScene": "src/components/scene/zones/BackpropForge.tsx -> NeuralCore.tsx"
}
```

**Environment**
- **The core.** A gold, star-like core floats in space. It is the 2-8-8-1 MLP (tanh, tanh, sigmoid, BCE) drawn as three concentric shells of neurons with 2, 8 and 8 nodes plus a single bright output at the centre.
- **Edges.** Weights are filaments whose thickness is |w| and whose hue encodes sign: warm gold for w > 0, cool starlight for w < 0.
- **The data disc.** Below the core is the two-moons dataset on a disc. The disc's own colour is the network's live decision field: a 40×40 grid streamed from the worker, with the 0.5 iso-line drawn bright (shader already built).

**Core mechanic: one step by hand, then many**
- **Step once.** "Step once" plays a full training step in slow motion:
  1. Forward: light travels outward from the inputs to the output, about 0.6 s.
  2. Loss: the output flares by BCE size.
  3. Backward: a gold pulse travels inward along every filament, brightness ∝ |∂L/∂w|. Edge brightness at each layer is the product of local derivatives, which is the chain rule made visible.
  4. Update: filaments thicken or thin by −η·∂L/∂w.
- **Train.** "Train" streams steps from the Web Worker at 25 steps per 50 ms tick and dims the pulse to a shimmer.
- **Learning rate.** The η dial is shared with the Loss Valley. A deliberate echo: the same knob, now on 145 parameters instead of 2.

**UI**
- **Instrument:** Step once, Train or Pause, the η dial, loss and accuracy readouts, and per-layer gradient-norm bars (already built).
- **New:** a "vanishing gradient" toggle that swaps tanh for sigmoid in the hidden layers. The worker needs to accept `{type:"act", act:"sigmoid"|"tanh"}`, validated in `parseToWorker`. The per-layer bars then show the first layer's gradient shrinking.

**Objectives**
- `forge.chain-rule` and `forge.fit` (accuracy ≥ 97 %). Both already exist.
- **New** `core.vanishing` (+100 XP): train with sigmoid hidden layers and watch the layer-1 gradient norm fall below 10 % of layer 3's.

**Debrief** (`coreLesson`):
- **Chain rule:** "That pulse was ∂L/∂w for all 145 weights, computed in one backward sweep by multiplying local slopes along each path. The same rule as the Loss Valley, θ ← θ − η∇L, just with 145 dimensions."
- **Fit:** "97 % on two moons. A straight line can't separate them; the two hidden layers bent the plane until one could."
- **Vanishing:** "Sigmoid's slope is at most 0.25, and each layer multiplies another one in. Three layers deep the first layer barely hears the error. That's why modern nets use ReLU-family activations and careful initialisation."

**What the player should take away:** backprop is the chain rule applied efficiently, not a separate learning algorithm. The optimiser is the same gradient descent the player already ran in the Loss Valley. Depth plus nonlinearity is what lets the boundary bend.

**Guard rails**
- The gradient check already holds (relative error 5.6e-9), and any new activation needs its own gradient-check test.
- Worker messages stay schema-validated on both sides.
- No `eval`, and no transferring unvalidated buffers.

---

## Build order

1. **World 2 first.** It is the cheapest: no worker changes, and the domain is done. The forest also fixes the current mismatch between the world's name and its dune visuals.
2. **World 4 next.** It needs one worker protocol change, the activation switch.
3. **World 3 last.** Its new evaluation toggle touches the archive domain and its tests.
