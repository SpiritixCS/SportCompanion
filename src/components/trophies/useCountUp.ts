"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 600;
const TICK_MS = 20;
const SESSION_KEY = "trophees-counters-animated";

// Seeded at 0 (not the target) so SSR and hydration agree — same pattern
// as PlayerScreen's useElapsedSeconds. The real value lands a tick later,
// client-side only, via the effect below.
export function useCountUp(target: number, delayMs: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      setValue(target);
      return;
    }
    sessionStorage.setItem(SESSION_KEY, "1");

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
