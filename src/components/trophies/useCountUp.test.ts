import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountUp, __resetAnimateLatchForTests } from "./useCountUp";

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  // The "should this page load animate" decision is latched once per module
  // load — reset it so each test starts from a fresh, un-latched state.
  __resetAnimateLatchForTests();
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("useCountUp", () => {
  it("starts at 0 and reaches the target after its duration", () => {
    const { result } = renderHook(() => useCountUp(100, 0));
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(100);
  });

  it("stays at 0 until the delay has elapsed", () => {
    const { result } = renderHook(() => useCountUp(100, 200));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(100);
  });

  it("shows the target immediately when prefers-reduced-motion is set", () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useCountUp(100, 0));
    expect(result.current).toBe(100);
  });

  it("shows the target immediately after the first animation in the session", () => {
    sessionStorage.setItem("trophees-counters-animated", "1");
    const { result } = renderHook(() => useCountUp(100, 0));
    expect(result.current).toBe(100);
  });

  it("sets session flag unconditionally even when prefers-reduced-motion blocks animation", () => {
    // First mount: reduced-motion is true
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    const { result: result1 } = renderHook(() => useCountUp(100, 0));
    expect(result1.current).toBe(100); // Shows target because of reduced-motion

    // Second mount: reduced-motion is now false, but the session flag should
    // still be set from the first mount, so no animation should occur
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    const { result: result2 } = renderHook(() => useCountUp(100, 0));
    expect(result2.current).toBe(100); // Should show target immediately (no animation) because session flag was set
  });
});
