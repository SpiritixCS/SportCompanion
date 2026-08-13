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
  movementFamily: "squat",
  videoId: "404727865",
  total: 340,
  firstAt: "2026-01-01T10:00:00.000Z",
  lastAt: "2026-08-01T10:00:00.000Z",
  seanceCount: 12,
};

const DOS_CARD: TrophyCardData = {
  id: "A",
  module: "dos",
  name: "Charnière & ischios",
  movementFamily: "arbre-A",
  videoId: null,
  total: 80,
  firstAt: "2026-01-01T10:00:00.000Z",
  lastAt: "2026-08-01T10:00:00.000Z",
  seanceCount: 8,
  byCran: [{ cran: 1, nom: "Hip hinge au bâton", total: 80 }],
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

  it("renders no image for a Dos card", () => {
    render(<TrophyCard card={DOS_CARD} index={0} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
