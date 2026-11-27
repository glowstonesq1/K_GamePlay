// src/components/hud/primitives.tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Chamfered glass plate: the HUD's single surface. One level deep, never nested. */
export function Plate({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={label} className={`plate pointer-events-auto ${className}`}>
      <div className="plate-in p-4">{children}</div>
    </section>
  );
}

/** A labelled numeric readout. The label is quiet; the number is the point. */
export function Readout({
  label,
  value,
  tone = "bone",
  size = "md",
}: {
  label: string;
  value: string;
  tone?: "bone" | "bio" | "signal" | "alarm";
  size?: "md" | "lg";
}) {
  const toneCls = { bone: "text-bone", bio: "text-bio", signal: "text-signal", alarm: "text-alarm" }[tone];
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ash">{label}</dt>
      <dd
        className={`font-mono tabular-nums leading-none ${toneCls} ${size === "lg" ? "mt-1 text-[34px]" : "mt-1.5 text-lg"}`}
      >
        {value}
      </dd>
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost"; pressed?: boolean };

export function Btn({ variant = "ghost", pressed, className = "", ...rest }: BtnProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 px-4 text-[15px] transition-[background-color,color,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-40";
  const look =
    variant === "primary"
      ? "bg-bio font-medium text-void hover:bg-bone active:bg-bio-dim"
      : "border border-line text-bone hover:border-bone hover:bg-bone/5 active:bg-bone/10 aria-pressed:border-bio aria-pressed:text-bio";
  return <button type="button" aria-pressed={pressed} className={`${base} ${look} ${className}`} {...rest} />;
}

export function LockIcon() {
  return (
    <svg aria-hidden width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="6" width="10" height="7" />
      <path d="M3 6V4a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function CheckIcon({ done }: { done: boolean }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" strokeWidth="1.5" className="shrink-0">
      <rect x="1.5" y="1.5" width="13" height="13" stroke="currentColor" />
      {done && <path d="M4.5 8.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="2" />}
    </svg>
  );
}
