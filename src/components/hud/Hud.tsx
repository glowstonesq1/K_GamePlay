// src/components/hud/Hud.tsx
"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { gameStore, useGame } from "@/state/gameStore";
import { selectTransitioning, sessionStore, useSession } from "@/state/sessionStore";
import { forge } from "@/workers/forgeClient";
import { AreaTitle } from "./AreaTitle";
import { Instrument } from "./Instrument";
import { ObjectiveTracker } from "./ObjectiveTracker";
import { PedagogyNote } from "./PedagogyNote";
import { PortalVeil } from "./PortalVeil";
import { Btn } from "./primitives";
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
      if (e.key === "Escape" && zone !== "hub") {
        s.travel("hub");
        return;
      }
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

/** Escape hatch, always one press from home. Esc does the same. */
function ReturnHome() {
  const zone = useGame((s) => s.currentZone);
  if (zone === "hub") return null;
  return (
    <Btn className="pointer-events-auto glass !rounded-full self-start" onClick={() => sessionStore.getState().travel("hub")}>
      <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M8.5 3 4.5 7l4 4" />
      </svg>
      Return to observatory
    </Btn>
  );
}

/**
 * HUD layout, anchored to the corners. Root ignores pointer events so the scene stays
 * orbitable through empty space; each cluster opts back in. data-world retints every
 * accent token in the tree to the current world's glow.
 *
 * While a portal jump runs, the top clusters lift away and the bottom ones sink, so the
 * frame belongs to the camera; they return on the far side with the new world's copy.
 */
export function Hud() {
  const hydrated = useGame((s) => s.hydrated);
  const zone = useGame((s) => s.currentZone);
  const transitioning = useSession(selectTransitioning);
  const reduce = useReducedMotion();
  useHotkeys();

  useEffect(() => {
    void gameStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    // After hydration, otherwise rehydrate would overwrite the fresh completion.
    if (hydrated) sessionStore.getState().award("hub.boot");
  }, [hydrated]);

  const away = (dy: number) =>
    transitioning || !hydrated ? { opacity: 0, y: reduce ? 0 : dy, filter: reduce ? "none" : "blur(4px)" } : { opacity: 1, y: 0, filter: "blur(0px)" };
  const ease = { duration: transitioning ? 0.35 : 0.7, delay: transitioning ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div data-world={zone} className="pointer-events-none absolute inset-0 z-10 font-sans text-bone">
      <div data-ready={hydrated} className="hud-safe absolute inset-0 flex flex-col justify-between gap-3">
        <motion.div className="flex flex-col gap-3" initial={false} animate={away(-16)} transition={ease}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-4">
              <AreaTitle />
              <ReturnHome />
            </div>
            <div className="hidden flex-1 justify-center pt-2 md:flex">
              <ZoneStrip />
            </div>
            <RankMeter />
          </div>
          <div className="md:hidden">
            <ZoneStrip />
          </div>
          <Toasts />
        </motion.div>

        <motion.div
          className="flex flex-col-reverse gap-3 sm:flex-row sm:items-end sm:justify-between"
          initial={false}
          animate={away(20)}
          transition={ease}
        >
          <ObjectiveTracker />
          <Instrument />
        </motion.div>
      </div>
      {/* The debrief floats free of the corner stacks so it never shoves the controls
          off-screen: in the open floor between objectives and instrument on wide screens,
          under the title on narrower ones. */}
      <div className="pointer-events-none absolute inset-x-4 top-44 z-10 flex justify-center sm:top-36 lg:inset-x-auto lg:top-auto lg:right-[calc(25rem+3rem)] lg:bottom-6">
        <PedagogyNote />
      </div>
      <PortalVeil />
    </div>
  );
}
