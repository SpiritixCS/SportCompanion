// src/components/today/TrackingCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingCard } from "./TrackingCard";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const advanceProgramDayAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  advanceProgramDayAction: (...args: unknown[]) => advanceProgramDayAction(...args),
}));

const REST_STATE: TrackingScreenState = {
  programDay: { dayOfWeek: 0, label: "Lundi", isRest: true, exercises: [] },
  activeSeance: null,
  seances: [],
};

describe("TrackingCard", () => {
  it("shows Repos and advances the pointer on Jour suivant when today is a rest day", async () => {
    advanceProgramDayAction.mockResolvedValue(1);
    render(<TrackingCard state={REST_STATE} />);
    expect(screen.getByText("Lundi · Repos")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Jour suivant" }));
    expect(advanceProgramDayAction).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the day's name, exercises and a Commencer link into the guided player on a séance day", () => {
    render(
      <TrackingCard
        state={{
          ...REST_STATE,
          programDay: {
            dayOfWeek: 0,
            label: "Lundi",
            isRest: false,
            exercises: [{ ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }],
          },
        }}
      />,
    );
    expect(screen.getByText("Lundi")).toBeInTheDocument();
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Commencer" })).toHaveAttribute("href", "/player/tracking?day=0");
  });

  it("shows Reprendre linking to the guided player when a seance is active for a day", () => {
    render(
      <TrackingCard
        state={{
          ...REST_STATE,
          activeSeance: { id: 7, dayOfWeek: 3, dayLabel: "Jeudi", plannedExercises: [], loggedExercises: [] },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/player/tracking?day=3");
  });

  it("shows Reprendre linking to the freeform journal for a legacy active seance with no day", () => {
    render(
      <TrackingCard
        state={{
          ...REST_STATE,
          activeSeance: { id: 7, dayOfWeek: null, dayLabel: null, plannedExercises: null, loggedExercises: [] },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/tracking/7");
  });

  it("shows the day's planned exercises for an active seance", () => {
    render(
      <TrackingCard
        state={{
          ...REST_STATE,
          activeSeance: {
            id: 7,
            dayOfWeek: 0,
            dayLabel: "Lundi",
            plannedExercises: [
              { ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 },
              { ordre: 1, name: "Gainage", unit: "seconds", setsCount: 2, targetValue: 45 },
            ],
            loggedExercises: [{ name: "Dips", unit: "reps", setsCount: 2, totalValue: 24 }],
          },
        }}
      />,
    );
    expect(screen.getByText("Lundi")).toBeInTheDocument();
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
    expect(screen.getByText("Gainage")).toBeInTheDocument();
    expect(screen.getByText("2 × 45 s")).toBeInTheDocument();
  });

  it("shows exercises logged so far for a legacy active freeform seance (no day)", () => {
    render(
      <TrackingCard
        state={{
          ...REST_STATE,
          activeSeance: {
            id: 7,
            dayOfWeek: null,
            dayLabel: null,
            plannedExercises: null,
            loggedExercises: [
              { name: "Dips", unit: "reps", setsCount: 2, totalValue: 24 },
              { name: "Gainage", unit: "seconds", setsCount: 1, totalValue: 45 },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("45 s")).toBeInTheDocument();
  });
});
