import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TropheesScreen } from "./TropheesScreen";
import type { TropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
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
    { id: "squats", module: "programme", name: "Squats", movementFamily: "squat", videoId: null, total: 300, firstAt: "2026-01-01T10:00:00.000Z", lastAt: "2026-08-01T10:00:00.000Z", seanceCount: 8 },
    { id: "A", module: "dos", name: "Charnière & ischios", movementFamily: "arbre-A", videoId: null, total: 120, firstAt: "2026-02-01T10:00:00.000Z", lastAt: "2026-08-05T10:00:00.000Z", seanceCount: 2, byCran: [{ cran: 1, nom: "Hip hinge au bâton", total: 120 }] },
  ],
};

describe("TropheesScreen", () => {
  it("shows the header total and activity summary", async () => {
    render(<TropheesScreen state={STATE} />);
    expect(await screen.findByText("420")).toBeInTheDocument();
    expect(screen.getByText(/10 séances/)).toBeInTheDocument();
    expect(screen.getByText(/9 jours/)).toBeInTheDocument();
  });

  it("shows every card by default", () => {
    render(<TropheesScreen state={STATE} />);
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("Charnière & ischios")).toBeInTheDocument();
  });

  it("filters to the Dos module only", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TropheesScreen state={STATE} />);
    await user.click(screen.getByRole("button", { name: "Dos" }));
    expect(screen.queryByText("Squats")).not.toBeInTheDocument();
    expect(screen.getByText("Charnière & ischios")).toBeInTheDocument();
  });

  it("shows the empty state when there are no cards", () => {
    render(<TropheesScreen state={{ totalReps: 0, seanceCount: 0, joursActivite: 0, cards: [] }} />);
    expect(screen.getByText(/première séance/)).toBeInTheDocument();
  });
});
