// src/workers/trainer.worker.ts
//
// Trains the Forge's MLP off the main thread. The render loop never waits on math: the
// worker steps as fast as its budget allows and posts a snapshot at most ~20 Hz.

import {
  initMlp,
  lossAndGrads,
  predict,
  sgdMomentumStep,
  twoMoons,
  zeroGrads,
  type Grads,
  type Mlp,
} from "@/domain/nn/mlp";
import { GRID, NET_SIZES, parseToWorker, type DatasetMsg, type Snapshot } from "@/domain/nn/protocol";

const MOMENTUM = 0.9;
const BATCH_STEPS_PER_TICK = 25;
const TICK_MS = 50;
const SPAN = 1.6;

let net: Mlp;
let vel: Grads;
let lr = 0.05;
let step = 0;
let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const data = twoMoons(200, 0.12, 42);

function accuracy(): number {
  let ok = 0;
  for (let k = 0; k < data.X.length; k++) ok += (predict(net, data.X[k]!) > 0.5 ? 1 : 0) === data.Y[k] ? 1 : 0;
  return ok / data.X.length;
}

function snapshot(loss: number, grads: Grads, deltaMag: number[], manual: boolean): void {
  const grid = new Float32Array(GRID * GRID);
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const x = -SPAN + (2 * SPAN * j) / (GRID - 1);
      const y = -SPAN + (2 * SPAN * i) / (GRID - 1);
      grid[i * GRID + j] = predict(net, [x, y]);
    }
  }
  const W = net.W.map((w) => Float32Array.from(w));
  const gW = grads.W.map((g) => Float32Array.from(g, Math.abs));
  const msg: Snapshot = { type: "snapshot", step, loss, accuracy: accuracy(), W, gW, deltaMag, grid, manual };
  (self as unknown as Worker).postMessage(msg, [grid.buffer, ...W.map((a) => a.buffer), ...gW.map((a) => a.buffer)]);
}

function trainStep() {
  const r = lossAndGrads(net, data.X, data.Y);
  sgdMomentumStep(net, r.grads, vel, lr, MOMENTUM);
  step++;
  return r;
}

function tick() {
  timer = null;
  if (!running) return;
  let last = trainStep();
  for (let k = 1; k < BATCH_STEPS_PER_TICK; k++) last = trainStep();
  snapshot(last.loss, last.grads, last.deltaMag, false);
  timer = setTimeout(tick, TICK_MS);
}

function reset(seed: number) {
  net = initMlp([...NET_SIZES], seed);
  vel = zeroGrads(net);
  step = 0;
  const r = lossAndGrads(net, data.X, data.Y);
  snapshot(r.loss, r.grads, r.deltaMag, false);
}

self.onmessage = (e: MessageEvent) => {
  const msg = parseToWorker(e.data);
  if (!msg) return; // drop malformed input silently
  switch (msg.type) {
    case "init": {
      lr = msg.lr;
      const ds: DatasetMsg = { type: "dataset", X: data.X, Y: data.Y };
      (self as unknown as Worker).postMessage(ds);
      reset(msg.seed);
      break;
    }
    case "reset":
      running = false;
      reset(msg.seed);
      break;
    case "lr":
      lr = msg.lr;
      break;
    case "step": {
      if (!net) return;
      const r = trainStep();
      snapshot(r.loss, r.grads, r.deltaMag, true);
      break;
    }
    case "run":
      running = msg.running;
      if (running && !timer) tick();
      break;
  }
};
