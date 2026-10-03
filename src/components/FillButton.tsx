"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Accent } from "./Pastille";

const SWEEP_MS = 420;

const FILL: Record<Accent, string> = { cobalt: "bg-cobalt", sage: "bg-sage", brass: "bg-brass" };
const BASE: Record<Accent, string> = { cobalt: "bg-cobalt", sage: "bg-sage-strong", brass: "bg-brass" };

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Balayage d'accent de gauche à droite, puis l'action (spec § Mouvement 6).
function useSweep() {
  const [sweeping, setSweeping] = useState(false);
  const busy = useRef(false);
  function run(action: () => void) {
    if (busy.current) return;
    if (prefersReducedMotion()) return action();
    busy.current = true;
    setSweeping(true);
    setTimeout(() => {
      busy.current = false;
      setSweeping(false);
      action();
    }, SWEEP_MS);
  }
  return { sweeping, run };
}

function classes(accent: Accent, base: "ink" | "accent", extra = "") {
  return `relative overflow-hidden h-14 w-full rounded-pill flex items-center justify-center font-body text-15 font-semibold text-paper disabled:opacity-40 ${
    base === "ink" ? "bg-ink" : BASE[accent]
  } ${extra}`.trim();
}

function Fill({ accent, base, sweeping }: { accent: Accent; base: "ink" | "accent"; sweeping: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-0 origin-left transition-transform duration-[420ms] ease-[cubic-bezier(.7,0,.2,1)] ${
        base === "ink" ? FILL[accent] : "bg-ink/25"
      } ${sweeping ? "scale-x-100" : "scale-x-0"}`}
    />
  );
}

export function FillButton({
  children,
  onClick,
  accent = "cobalt",
  base = "ink",
  disabled = false,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: Accent;
  base?: "ink" | "accent";
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const { sweeping, run } = useSweep();
  return (
    <button type="button" disabled={disabled} aria-label={ariaLabel} onClick={() => run(onClick)} className={classes(accent, base)}>
      <Fill accent={accent} base={base} sweeping={sweeping} />
      <span className="relative">{children}</span>
    </button>
  );
}

export function FillLink({
  href,
  children,
  accent = "cobalt",
  base = "ink",
}: {
  href: string;
  children: React.ReactNode;
  accent?: Accent;
  base?: "ink" | "accent";
}) {
  const router = useRouter();
  const { sweeping, run } = useSweep();
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.preventDefault();
        run(() => router.push(href));
      }}
      className={classes(accent, base)}
    >
      <Fill accent={accent} base={base} sweeping={sweeping} />
      <span className="relative">{children}</span>
    </Link>
  );
}
