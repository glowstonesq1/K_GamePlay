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
import { RankMeter } from "./RankMeter";
import { Toasts } from "./Toasts";
import { ZoneStrip } from "./ZoneStrip";
import { AvatarCard } from "./omnis/AvatarCard";
import { CuriosityLab } from "./omnis/CuriosityLab";
import { EchoToggle } from "./omnis/EchoToggle";
import { SkillTreePanel } from "./omnis/SkillTreePanel";
import { UNIVERSES } from "@/domain/omnis/universes";
import { PORTALS } from "@/components/hub/MultiverseHub";
import { Btn, LockIcon } from "./primitives";

/** Keyboard: Space = descend/pause, R = reset, S = sample. Only when nothing has focus. */
function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== document.body || e.metaKey || e.ctrlKey || e.altKey) return;
      const g = gameStore.getState();
      const zone = g.currentZone;
      const s = sessionStore.getState();
      // Esc climbs one level: world → Observatory → Multiverse Hub.
      if (e.key === "Escape" && g.universe === "ai") {
        if (zone !== "hub") s.travel("hub");
        else s.travelUniverse("hub");
        return;
      }
      if (g.universe !== "ai") return;
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

/** One level up, always one press away. Esc does the same. */
function ReturnHome() {
  const zone = useGame((s) => s.currentZone);
  const universe = useGame((s) => s.universe);
  if (universe !== "ai") return null;
  const toMultiverse = zone === "hub";
  return (
    <Btn
      className="pointer-events-auto glass !rounded-full self-start"
      onClick={() => (toMultiverse ? sessionStore.getState().travelUniverse("hub") : sessionStore.getState().travel("hub"))}
    >
      <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M8.5 3 4.5 7l4 4" />
      </svg>
      {toMultiverse ? "Return to multiverse" : "Return to observatory"}
    </Btn>
  );
}

/** The portals as a list: the keyboard and screen-reader way through the same doors. */
function PortalList() {
  return (
    <nav aria-label="Universes" className="pointer-events-auto">
      <ul className="glass flex flex-wrap gap-1 rounded-2xl p-1.5">
        {PORTALS.map(({ u, pos }) => {
          const d = UNIVERSES[u];
          return (
            <li key={u}>
              <button
                type="button"
                disabled={!d.playable}
                title={d.playable ? d.tagline : "Sealed: blueprint drawn, not built yet"}
                aria-label={d.playable ? `Enter ${d.name}, ${d.subject}` : `${d.name}, ${d.subject}, sealed`}
                onClick={() => sessionStore.getState().travelUniverse(u, pos)}
                className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-[14px] text-bone transition-[background-color,color] duration-150 hover:bg-white/5 disabled:cursor-not-allowed disabled:text-ash/60"
              >
                <span aria-hidden className="size-2 rounded-full" style={{ background: d.accent, opacity: d.playable ? 1 : 0.35 }} />
                {!d.playable && <LockIcon />}
                <span>{d.subject}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Title card for the Multiverse Hub (AreaTitle covers zones inside the AI universe). */
function MultiverseTitle() {
  const u = UNIVERSES.hub;
  return (
    <header className="pointer-events-auto min-w-0 max-w-[26rem]">
      <p className="font-mono text-[12px] text-ash">OMNIS</p>
      <h1 className="mt-1 font-display text-4xl font-normal leading-[1.05] tracking-tight text-bone sm:text-5xl">{u.name}</h1>
      <p className="mt-2 text-[15px] text-ash">{u.subject}</p>
      <p className="mt-1 hidden text-[14px] leading-snug text-bone/70 sm:block">{u.tagline}</p>
    </header>
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
  const universe = useGame((s) => s.universe);
  const echo = useGame((s) => s.echo);
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

  const inMulti = universe === "hub";
  const curious = !inMulti && zone === "hub" && echo === "curiosity";

  return (
    <div data-world={inMulti ? "hub" : zone} className="pointer-events-none absolute inset-0 z-10 font-sans text-bone">
      <div data-ready={hydrated} className="hud-safe absolute inset-0 flex flex-col justify-between gap-3">
        <motion.div className="flex flex-col gap-3" initial={false} animate={away(-16)} transition={ease}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-4">
              {inMulti ? <MultiverseTitle /> : <AreaTitle />}
              {inMulti && <PortalList />}
              <ReturnHome />
            </div>
            {!inMulti && (
              <div className="hidden flex-1 flex-col items-center gap-2 pt-2 md:flex">
                {zone === "hub" && <EchoToggle />}
                {!curious && <ZoneStrip />}
              </div>
            )}
            <RankMeter />
          </div>
          {!inMulti && (
            <div className="flex flex-col gap-2 md:hidden">
              {zone === "hub" && <EchoToggle />}
              {!curious && <ZoneStrip />}
            </div>
          )}
          <Toasts />
        </motion.div>

        <motion.div
          className="flex flex-col-reverse gap-3 sm:flex-row sm:items-end sm:justify-between"
          initial={false}
          animate={away(20)}
          transition={ease}
        >
          {inMulti ? (
            <>
              <AvatarCard />
              <SkillTreePanel />
            </>
          ) : curious ? (
            <>
              <ObjectiveTracker />
              <CuriosityLab />
            </>
          ) : (
            <>
              <ObjectiveTracker />
              <Instrument />
            </>
          )}
        </motion.div>
      </div>
      {/* The debrief floats free of the corner stacks so it never shoves the controls
          off-screen: in the open floor between objectives and instrument on wide screens,
          under the title on narrower ones. */}
      {!inMulti && (
        <div className="pointer-events-none absolute inset-x-4 top-44 z-10 flex justify-center sm:top-36 lg:inset-x-auto lg:top-auto lg:right-[calc(25rem+3rem)] lg:bottom-6">
          <PedagogyNote />
        </div>
      )}
      <PortalVeil />
    </div>
  );
}
