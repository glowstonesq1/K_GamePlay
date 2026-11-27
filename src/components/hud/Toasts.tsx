// src/components/hud/Toasts.tsx
"use client";

import { useSession } from "@/state/sessionStore";

/** XP gain banners, top-centre under the zone strip. Announced politely to screen readers. */
export function Toasts() {
  const toasts = useSession((s) => s.toasts);
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="anim-toast plate pointer-events-auto">
          <div className="plate-in flex items-baseline gap-3 px-4 py-2.5">
            <span className="font-mono text-lg tabular-nums text-bio">+{t.xp} xp</span>
            <span className="text-[15px] text-bone">{t.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
