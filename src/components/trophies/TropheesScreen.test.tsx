import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TropheesScreen } from "./TropheesScreen";
import { __resetAnimateLatchForTests } from "./useCountUp";
import type { TropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockMatchMedia(true);
  // The animate-this-load decision is latched once per module load — reset
  // it so each test starts from a fresh, un-latched state.
  __resetAnimateLatchForTests();
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

const STATE: TropheesScreenState = {
  totalReps: 420,
  seanceCount: 10,
  joursActivite: 9,
  cards: [
    { id: "squats", module: "programme", name: "Squats", unit: "reps", total: 300, firstAt: "2026-01-01T10:00:00.000Z", lastAt: "2026-08-01T10:00:00.000Z", movementFamily: "squat" },
    { id: "tracking-1", module: "tracking", name: "Fentes", unit: "reps", total: 120, firstAt: "2026-02-01T10:00:00.000Z", lastAt: "2026-08-05T10:00:00.000Z", movementFamily: "other" },
  ],
};

describe("TropheesScreen", () => {
  it("shows the header total and activity summary", () => {
    render(<TropheesScreen state={STATE} />);
    expect(screen.getByText("420")).toBeInTheDocument();
    expect(screen.getByText(/10 séances/)).toBeInTheDocument();
    expect(screen.getByText(/9 jours/)).toBeInTheDocument();
  });

  it("shows every card by default", () => {
    render(<TropheesScreen state={STATE} />);
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("Fentes")).toBeInTheDocument();
  });

  it("filters to the Tracking module only", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<TropheesScreen state={STATE} />);
    await user.click(screen.getByRole("button", { name: "Tracking" }));
    vi.useFakeTimers();
    expect(screen.queryByText("Squats")).not.toBeInTheDocument();
    expect(screen.getByText("Fentes")).toBeInTheDocument();
  });

  it("shows the empty state when there are no cards", () => {
    render(
      <TropheesScreen state={{ totalReps: 0, seanceCount: 0, joursActivite: 0, cards: [] }} />,
    );
    expect(screen.getByText(/première séance/)).toBeInTheDocument();
  });

  it("animates the header total from 0 when reduced motion is off (regression: effect ordering race)", () => {
    mockMatchMedia(false);
    const { container } = render(<TropheesScreen state={STATE} />);
    const headerTotal = container.querySelector(".text-44");
    expect(headerTotal).toHaveTextContent("0");
    expect(headerTotal).not.toHaveTextContent("420");
  });

  it("offers Tous, Programme and Tracking filters, never Dos", () => {
    render(<TropheesScreen state={{ cards: [], totalReps: 0, seanceCount: 0, joursActivite: 0 }} />);
    for (const name of ["Tous", "Programme", "Tracking"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Dos" })).not.toBeInTheDocument();
  });
});
