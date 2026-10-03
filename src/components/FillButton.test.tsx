import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { FillButton, FillLink } from "./FillButton";

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduce && q.includes("reduce"),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers();
  push.mockClear();
  mockReducedMotion(false);
});
afterEach(() => vi.useRealTimers());

describe("FillButton", () => {
  it("sweeps the fill then runs the action", () => {
    const onClick = vi.fn();
    render(<FillButton onClick={onClick}>Série terminée</FillButton>);
    fireEvent.click(screen.getByRole("button", { name: "Série terminée" }));
    expect(onClick).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(420));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("runs the action immediately when motion is reduced", () => {
    mockReducedMotion(true);
    const onClick = vi.fn();
    render(<FillButton onClick={onClick}>Valider</FillButton>);
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("never runs when disabled, and ignores double taps during the sweep", () => {
    const onClick = vi.fn();
    const { rerender } = render(<FillButton onClick={onClick} disabled>Valider</FillButton>);
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    act(() => vi.advanceTimersByTime(500));
    expect(onClick).not.toHaveBeenCalled();
    rerender(<FillButton onClick={onClick}>Valider</FillButton>);
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    act(() => vi.advanceTimersByTime(500));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("FillLink", () => {
  it("is a real link that navigates after the sweep", () => {
    render(<FillLink href="/player?day=4">Commencer la séance</FillLink>);
    const link = screen.getByRole("link", { name: "Commencer la séance" });
    expect(link).toHaveAttribute("href", "/player?day=4");
    fireEvent.click(link);
    act(() => vi.advanceTimersByTime(420));
    expect(push).toHaveBeenCalledWith("/player?day=4");
  });
});
