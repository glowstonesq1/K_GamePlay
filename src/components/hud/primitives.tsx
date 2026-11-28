// src/components/hud/primitives.tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Glass pane: the HUD's single surface. One level deep, never nested. */
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
    <section aria-label={label} className={`glass pointer-events-auto p-4 ${className}`}>
      {children}
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
  tone?: "bone" | "accent" | "signal" | "alarm";
  size?: "md" | "lg";
}) {
  const toneCls = { bone: "text-bone", accent: "text-accent", signal: "text-signal", alarm: "text-alarm" }[tone];
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
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] transition-[background-color,color,border-color,box-shadow,filter] duration-150 disabled:cursor-not-allowed disabled:opacity-40";
  const look =
    variant === "primary"
      ? "bg-accent font-medium text-void shadow-[0_0_24px_-4px_var(--world-accent)] hover:brightness-110 active:brightness-90"
      : "border border-white/10 text-bone hover:border-white/25 hover:bg-white/5 active:bg-white/10 aria-pressed:border-accent aria-pressed:text-accent";
  return <button type="button" aria-pressed={pressed} className={`${base} ${look} ${className}`} {...rest} />;
}

export function LockIcon() {
  return (
    <svg aria-hidden width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="10" height="7" rx="2.5" />
      <path d="M3 6V4a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function CheckIcon({ done }: { done: boolean }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" strokeWidth="1.5" className="shrink-0">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" fill={done ? "var(--color-accent-soft)" : "none"} />
      {done && <path d="M5 8.2l2.1 2.1 3.9-4.3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
