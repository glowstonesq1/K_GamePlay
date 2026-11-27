// src/components/hud/Hud.tsx
"use client";

import { useEffect } from "react";
import { gameStore, useGame } from "@/state/gameStore";
import { HyperparamPanel } from "./HyperparamPanel";
import { XpBlock } from "./XpBlock";
import { ZoneHeader } from "./ZoneHeader";
import { ZoneRail } from "./ZoneRail";

/**
 * Overlay layer. The root ignores pointer events so the canvas stays orbitable
 * through empty space; each Panel opts back in.
 */
export function Hud() {
  const hydrated = useGame((s) => s.hydrated);

  useEffect(() => {
    void gameStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    // Award after hydration, otherwise rehydrate would overwrite the fresh completion.
    if (hydrated) gameStore.getState().completeObjective("hub.boot");
  }, [hydrated]);

  return (
    <div
      data-ready={hydrated}
      className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-3 p-3 font-mono text-bone opacity-0 transition-opacity duration-300 data-[ready=true]:opacity-100 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <ZoneHeader />
        <XpBlock />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <HyperparamPanel />
        <ZoneRail />
      </div>
    </div>
  );
}
