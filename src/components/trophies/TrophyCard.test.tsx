import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("shows the progress toward the next palier", () => {
    render(<TrophyCard card={PROGRAMME_CARD} index={0} />);
    expect(screen.getByText("Vers 500")).toBeInTheDocument();
    expect(screen.getByText("60 %")).toBeInTheDocument();
  });

  it("aims for the first palier below 100", () => {
    render(<TrophyCard card={{ ...PROGRAMME_CARD, total: 42 }} index={0} />);
    expect(screen.getByText("Vers 100")).toBeInTheDocument();
    expect(screen.getByText("42 %")).toBeInTheDocument();
  });

  it("says every palier is reached past 25 000", () => {
    render(<TrophyCard card={{ ...PROGRAMME_CARD, total: 26000 }} index={0} />);
    expect(screen.getByText("Tous atteints")).toBeInTheDocument();
  });

  it("shows the exercise picto for a Programme card, never a photo", () => {
    render(<TrophyCard card={PROGRAMME_CARD} index={0} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByTestId("initial-tile")).not.toBeInTheDocument();
  });

  it("shows the initial on a jade tile for a Tracking card", () => {
    render(<TrophyCard card={TRACKING_CARD} index={0} />);
    expect(screen.getByTestId("initial-tile")).toHaveTextContent("F");
  });

  it("shows no palier and an 's' suffix for a seconds card, regardless of total", () => {
    render(<TrophyCard card={{ ...PROGRAMME_CARD, id: "tracking-1", module: "tracking", unit: "seconds", total: 900, movementFamily: "other" }} index={0} />);
    expect(screen.getByText("s")).toBeInTheDocument();
    expect(screen.queryByText(/Vers/)).not.toBeInTheDocument();
  });
});
