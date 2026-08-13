"use client";

import { useEffect } from "react";

type WakeLockSentinel = {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        sentinel = lock;
        // The browser can auto-release the lock on its own (e.g. tab
        // backgrounding on Chrome iOS) without this hook calling release() —
        // track that so handleVisibilityChange's `!sentinel` check reflects
        // the sentinel's real state, not just whether we released it.
        lock.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        // Request can be rejected (e.g. document not visible yet) — the
        // player still works without the lock, this is a comfort feature.
      }
    }

    acquire();

    function handleVisibilityChange() {
      // The browser releases the lock automatically when the tab goes to
      // background — notably on Chrome iOS (CLAUDE.md §3). Re-request on
      // return to foreground, or the screen can silently re-lock.
      if (document.visibilityState === "visible" && !sentinel) {
        acquire();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
