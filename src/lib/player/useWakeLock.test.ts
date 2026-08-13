import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWakeLock } from "./useWakeLock";

const requestMock = vi.fn();

beforeEach(() => {
  requestMock.mockReset();
});

afterEach(() => {
  // @ts-expect-error test-only cleanup of a property this test suite adds
  delete navigator.wakeLock;
});

describe("useWakeLock", () => {
  it("requests a screen wake lock when enabled and supported", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    requestMock.mockResolvedValue({ release });
    Object.defineProperty(navigator, "wakeLock", { value: { request: requestMock }, configurable: true });

    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalledWith("screen"));
  });

  it("releases the lock on unmount", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    requestMock.mockResolvedValue({ release });
    Object.defineProperty(navigator, "wakeLock", { value: { request: requestMock }, configurable: true });

    const { unmount } = renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalled());
    unmount();
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
  });

  it("does not request a lock when disabled", () => {
    Object.defineProperty(navigator, "wakeLock", { value: { request: requestMock }, configurable: true });
    renderHook(() => useWakeLock(false));
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("does not throw when navigator.wakeLock is unsupported", () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
    expect(requestMock).not.toHaveBeenCalled();
  });
});
