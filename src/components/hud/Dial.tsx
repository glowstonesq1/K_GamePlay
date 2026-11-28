// src/components/hud/Dial.tsx
"use client";

import { useId } from "react";
import {
  describeHyperparam,
  formatHyperparam,
  fromSlider,
  HYPERPARAMS,
  toSlider,
  type Hyperparam,
} from "@/domain/hyperparams";
import { gameStore, useGame } from "@/state/gameStore";

const STEPS = 1000;

/**
 * Hyperparameter dial. `mark` draws a tick on the track at a meaningful value
 * (η = 2/λ_max, T = 1) so the player sees where the regime changes before crossing it.
 */
export function Dial({ param, mark }: { param: Hyperparam; mark?: { value: number; label: string } }) {
  const id = useId();
  const value = useGame((s) => s[param]);
  const spec = HYPERPARAMS[param];
  const readout = formatHyperparam(param, value);
  // PEDAGOGY: η and T are log-scaled because their effects are multiplicative.
  const pos = Math.round(toSlider(param, value) * STEPS);
  const markPct = mark ? toSlider(param, mark.value) * 100 : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] text-ash">
          {spec.label} <span className="font-mono text-bone">{spec.symbol}</span>
          {spec.scale === "log" && <span className="ml-1.5 text-accent/60">log scale</span>}
        </label>
        <output htmlFor={id} className="font-mono text-xl tabular-nums text-accent">
          {readout}
        </output>
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={0}
          max={STEPS}
          step={1}
          value={pos}
          aria-valuetext={`${spec.label} ${readout}`}
          onChange={(e) =>
            gameStore.getState().setHyperparam(param, fromSlider(param, Number(e.currentTarget.value) / STEPS))
          }
          className="dial relative z-10 w-full"
        />
        {markPct !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-4 w-px -translate-y-1/2 bg-signal"
            style={{ left: `calc(7px + (100% - 14px) * ${markPct / 100})` }}
          />
        )}
      </div>
      {mark && (
        <p className="-mt-1 text-[13px] text-signal">
          {mark.label} <span className="font-mono">{formatHyperparam(param, mark.value)}</span>
        </p>
      )}
      <p className="mt-1.5 text-[14px] leading-snug text-bone/85">{describeHyperparam(param, value)}</p>
    </div>
  );
}
