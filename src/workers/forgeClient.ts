// src/workers/forgeClient.ts
"use client";

import { parseFromWorker, type ToWorker } from "@/domain/nn/protocol";
import { gameStore } from "@/state/gameStore";
import { sessionStore } from "@/state/sessionStore";

/**
 * Owns the trainer worker. Created on first entry to the Forge, kept alive after so
 * returning to the zone keeps the trained network. One instance per page.
 */
let worker: Worker | null = null;
let unsubLr: (() => void) | null = null;

function send(msg: ToWorker) {
  worker?.postMessage(msg);
}

export function ensureForgeWorker(): void {
  if (worker || typeof window === "undefined") return;
  worker = new Worker(new URL("./trainer.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent) => {
    const msg = parseFromWorker(e.data);
    if (!msg) return; // drop anything that doesn't match the contract
    if (msg.type === "dataset") sessionStore.getState().setForgeData({ X: msg.X, Y: msg.Y });
    else sessionStore.getState().setForge(msg);
  };
  send({ type: "init", seed: 1, lr: gameStore.getState().learningRate });
  // η is shared across zones: the Forge reads the same dial the Valley taught.
  unsubLr = gameStore.subscribe((s, prev) => {
    if (s.learningRate !== prev.learningRate) send({ type: "lr", lr: s.learningRate });
  });
}

export const forge = {
  run(running: boolean) {
    send({ type: "run", running });
    sessionStore.getState().setForgeRunning(running);
  },
  step() {
    forge.run(false);
    send({ type: "step" });
  },
  reset() {
    sessionStore.getState().setForgeRunning(false);
    send({ type: "reset", seed: 1 + Math.floor(Math.random() * 1e6) });
  },
  dispose() {
    unsubLr?.();
    worker?.terminate();
    worker = null;
  },
};
