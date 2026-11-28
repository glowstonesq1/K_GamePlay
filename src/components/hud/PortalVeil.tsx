// src/components/hud/PortalVeil.tsx
"use client";

import { AnimatePresence, motion } from "motion/react";
import { WORLD_ACCENT } from "@/design/palette";
import { useSession } from "@/state/sessionStore";

/**
 * The cut. A radial flash in the destination's colour peaks exactly when the camera
 * reaches the node (end of the dive, ~950 ms) and hides the world swap underneath it.
 * It is timed to the dive, not to the store: the store flips to "emerge" at the bottom
 * of the dive and the veil's exit is the fade back to the new world.
 */
export function PortalVeil() {
  const portal = useSession((s) => s.portal);
  const diving = portal?.phase === "dive";
  const color = portal ? WORLD_ACCENT[portal.to].hi : "#000";

  return (
    <AnimatePresence>
      {diving && (
        <motion.div
          key="veil"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${color} 0%, color-mix(in srgb, ${color} 40%, #050508) 22%, #050508 70%)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1], transition: { duration: 0.95, times: [0, 0.55, 1], ease: "easeIn" } }}
          exit={{ opacity: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }}
        />
      )}
    </AnimatePresence>
  );
}
