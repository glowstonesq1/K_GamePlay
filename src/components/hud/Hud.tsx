// src/components/hud/Hud.tsx
"use client";

import { useEffect } from "react";
import { gameStore, useGame } from "@/state/gameStore";
import { sessionStore } from "@/state/sessionStore";
import { forge } from "@/workers/forgeClient";
import { AreaTitle } from "./AreaTitle";
import { Instrument } from "./Instrument";
import { ObjectiveTracker } from "./ObjectiveTracker";
import { RankMeter } from "./RankMeter";
import { Toasts } from "./Toasts";
import { ZoneStrip } from "./ZoneStrip";

/** Keyboard: Space = descend/pause, R = reset, S = sample. Only when nothing has focus. */
function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== document.body || e.metaKey || e.ctrlKey || e.altKey) return;
      const zone = gameStore.getState().currentZone;
      const s = sessionStore.getState();
      if (zone === "loss-valley" && e.code === "Space") {
        e.preventDefault();
        s.setRunning(!s.running);
      } else if (zone === "loss-valley" && e.key.toLowerCase() === "r") {
        s.resetProbe();
      } else if (zone === "backprop-forge" && e.code === "Space") {
        e.preventDefault();
        forge.run(!s.forgeRunning);
      } else if (zone === "backprop-forge" && e.key.toLowerCase() === "n") {
        forge.step();
      } else if (zone === "token-dunes" && e.key.toLowerCase() === "s") {
        s.sampleToken();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * HUD layout, anchored to the four corners and top-centre. Root ignores pointer events so
 * the scene stays orbitable through empty space; each cluster opts back in.
 */
export function Hud() {
  const hydrated = useGame((s) => s.hydrated);
  useHotkeys();

  useEffect(() => {
    void gameStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    // After hydration, otherwise rehydrate would overwrite the fresh completion.
    if (hydrated) sessionStore.getState().award("hub.boot");
  }, [hydrated]);

  return (
    <div
      data-ready={hydrated}
      className="hud-safe pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-3 font-sans text-bone opacity-0 transition-opacity duration-500 data-[ready=true]:opacity-100"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <AreaTitle />
          <div className="hidden flex-1 justify-center pt-2 md:flex">
            <ZoneStrip />
          </div>
          <RankMeter />
        </div>
        <div className="md:hidden">
          <ZoneStrip />
        </div>
        <Toasts />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ObjectiveTracker />
        <Instrument />
      </div>
    </div>
  );
}
