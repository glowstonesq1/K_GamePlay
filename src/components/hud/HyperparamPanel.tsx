// src/components/hud/HyperparamPanel.tsx
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
import { gameStore, selectZone, useGame } from "@/state/gameStore";
import { Panel } from "./Panel";

const STEPS = 1000;

function Dial({ param }: { param: Hyperparam }) {
  const id = useId();
  const value = useGame((s) => s[param]);
  const spec = HYPERPARAMS[param];
  const readout = formatHyperparam(param, value);
  // PEDAGOGY: η and T are log-scaled. Their effects are multiplicative, so a linear
  // slider would cram every interesting value into the first 2% of travel.
  const pos = Math.round(toSlider(param, value) * STEPS);

  return (
    <div className="border-t border-rule pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[10px] uppercase tracking-[0.2em] text-ash">
          <span className="mr-2 font-display text-base normal-case tracking-normal text-bone">{spec.symbol}</span>
          {spec.label}
          {spec.scale === "log" && <span className="ml-2 text-bio-dim">log</span>}
        </label>
        <output htmlFor={id} className="font-display text-xl font-bold tabular-nums text-bio">
          {readout}
        </output>
      </div>
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
        className="mt-2 h-6 w-full cursor-pointer"
      />
      <p className="mt-1 text-xs leading-snug text-bone/80">{describeHyperparam(param, value)}</p>
    </div>
  );
}

export function HyperparamPanel() {
  const { controls } = useGame(selectZone);

  return (
    <Panel tag="CTRL" label="Hyperparameters" className="w-full sm:max-w-[22rem]">
      {controls.length === 0 ? (
        <p className="text-xs text-ash">No dials on the Grid. Pick a zone to get your hands on one.</p>
      ) : (
        <div className="space-y-3">
          {controls.map((p) => (
            <Dial key={p} param={p} />
          ))}
        </div>
      )}
    </Panel>
  );
}
