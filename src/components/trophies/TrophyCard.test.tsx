import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrophyCard } from "./TrophyCard";
import type { TrophyCard as TrophyCardData } from "@/lib/trophies/computeTrophies";

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true, // reduced motion: skip animation timing in these tests
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

const PROGRAMME_CARD: TrophyCardData = {
  id: "squats",
  module: "programme",
  name: "Squats",
  unit: "reps",
  total: 340,
  firstAt: "2026-01-01T10:00:00.000Z",
  lastAt: "2026-08-01T10:00:00.000Z",
  movementFamily: "squat",
};

const TRACKING_CARD: TrophyCardData = {
  id: "tracking-1",
  module: "tracking",
  name: "Fentes",
  unit: "reps",
  total: 80,
  firstAt: "2026-01-01T10:00:00.000Z",
  lastAt: "2026-08-01T10:00:00.000Z",
  movementFamily: "other",
};

describe("TrophyCard", () => {
  it("shows the name, the all-time total, and links to the detail page", () => {
    render(<TrophyCard card={PROGRAMME_CARD} index={0} />);
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/trophees/squats");
  });

  it("shows a palier mark when a threshold has been reached", () => {
    render(<TrophyCard card={PROGRAMME_CARD} index={0} />);
    expect(screen.getByText(/Palier 100/)).toBeInTheDocument();
  });

  it("shows no palier mark below the first threshold", () => {
    render(<TrophyCard card={{ ...PROGRAMME_CARD, total: 42 }} index={0} />);
    expect(screen.queryByText(/Palier/)).not.toBeInTheDocument();
  });

  it("renders no image for a Tracking card", () => {
    render(<TrophyCard card={TRACKING_CARD} index={0} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows a family icon in place of a photo for a Tracking card", () => {
    render(<TrophyCard card={TRACKING_CARD} index={0} />);
    expect(screen.getByTestId("exercise-family-icon")).toBeInTheDocument();
  });

  it("shows no family icon while the Programme photo is displayed", () => {
    render(<TrophyCard card={PROGRAMME_CARD} index={0} />);
    expect(screen.queryByTestId("exercise-family-icon")).not.toBeInTheDocument();
  });

  it("falls back to the family icon when the Programme photo fails to load", () => {
    render(<TrophyCard card={PROGRAMME_CARD} index={0} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByTestId("exercise-family-icon")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows no palier and an 's' suffix for a seconds card, regardless of total", () => {
    render(<TrophyCard card={{ ...PROGRAMME_CARD, id: "tracking-1", module: "tracking", unit: "seconds", total: 900, movementFamily: "other" }} index={0} />);
    expect(screen.getByText("s")).toBeInTheDocument();
    expect(screen.queryByText(/Palier/)).not.toBeInTheDocument();
  });
});
