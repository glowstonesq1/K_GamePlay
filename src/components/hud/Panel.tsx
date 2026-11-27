// src/components/hud/Panel.tsx
import type { ReactNode } from "react";

/**
 * Brutalist panel primitive: hard 1px rule, square corners, a stamped index tag
 * hanging off the top edge. Everything in the HUD sits inside one of these so the
 * overlay reads as a single instrument, not a pile of widgets.
 */
export function Panel({
  tag,
  label,
  children,
  className = "",
}: {
  tag: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`pointer-events-auto relative border border-bone/70 bg-panel/85 backdrop-blur-[2px] ${className}`}
    >
      <header className="flex items-stretch border-b border-bone/70 text-[10px] uppercase tracking-[0.2em]">
        <span className="bg-bone px-2 py-1 font-bold text-void">{tag}</span>
        <span className="px-2 py-1 text-ash">{label}</span>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}
