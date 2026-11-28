"use client";

import { useRef, type KeyboardEvent } from "react";
import { gameStore, useGame, type Echo } from "@/state/gameStore";

const OPTIONS: { id: Echo; icon: string; label: string; sub: string }[] = [
  { id: "architect", icon: "🧠", label: "Architect mode", sub: "The full simulations" },
  { id: "curiosity", icon: "✨", label: "Curiosity mode", sub: "Hands-on, no maths" },
];

export function EchoToggle() {
  const echo = useGame((s) => s.echo);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const choose = (i: number) => {
    const n = (i + OPTIONS.length) % OPTIONS.length;
    gameStore.getState().setEcho(OPTIONS[n]!.id);
    refs.current[n]?.focus();
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); choose(i + 1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); choose(i - 1); }
  };

  return (
    <div className="pointer-events-auto">
      <div id="echo-label" className="mb-1.5 text-[13px] text-ash">Mode</div>
      <div role="radiogroup" aria-labelledby="echo-label" className="glass flex gap-1 p-1">
        {OPTIONS.map((o, i) => {
          const on = echo === o.id;
          return (
            <button
              key={o.id}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => gameStore.getState().setEcho(o.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`flex min-h-11 flex-1 items-center gap-2 rounded-xl px-3 py-1.5 text-left transition-[background-color,color,box-shadow] duration-150 ${
                on ? "bg-accent-soft text-bone shadow-[inset_0_0_0_1px_var(--world-accent)]" : "text-ash hover:bg-white/5 hover:text-bone"
              }`}
            >
              <span aria-hidden className="text-lg">{o.icon}</span>
              <span className="min-w-0">
                <span className="block text-[15px] leading-tight">{o.label}</span>
                <span className="block text-[13px] leading-tight text-ash">{o.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
