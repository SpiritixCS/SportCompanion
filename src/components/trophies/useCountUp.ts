"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 600;
const TICK_MS = 20;
const SESSION_KEY = "trophees-counters-animated";

// Latched once per module load (i.e. once per page load), not once per hook
// instance. React fires child effects before parent effects, so if every
// useCountUp call independently read-then-wrote sessionStorage in its own
// effect, whichever component's effect ran first would "consume" the flag
// and every other instance on the same page would see it as already set.
// Deciding once, on first read, keeps every instance on the page in
// agreement regardless of effect firing order.
let animateThisLoad: boolean | null = null;

function shouldAnimate(): boolean {
  if (animateThisLoad === null) {
    animateThisLoad =
      sessionStorage.getItem(SESSION_KEY) !== "1" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sessionStorage.setItem(SESSION_KEY, "1");
  }
  return animateThisLoad;
}

// Test-only: the latch above is memoized for the lifetime of the module,
// which in a browser means "for the page load" but in a test file means
// "for every test that imports this module". Tests reset it between cases.
export function __resetAnimateLatchForTests(): void {
  animateThisLoad = null;
}

// Seeded at 0 (not the target) so SSR and hydration agree — same pattern
// as PlayerScreen's useElapsedSeconds. The real value lands a tick later,
// client-side only, via the effect below.
export function useCountUp(target: number, delayMs: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!shouldAnimate()) {
      setValue(target);
      return;
    }

    const startAt = Date.now() + delayMs;
    const endAt = startAt + DURATION_MS;

    const id = setInterval(() => {
      const now = Date.now();
      if (now < startAt) return;
      const progress = Math.min(1, (now - startAt) / DURATION_MS);
      setValue(Math.round(target * progress));
      if (now >= endAt) clearInterval(id);
    }, TICK_MS);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
}
