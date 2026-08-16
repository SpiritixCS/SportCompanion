// src/components/tracking/TrackingScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingScreen } from "./TrackingScreen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const deleteTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  deleteTrackingSeanceAction: (...args: unknown[]) => deleteTrackingSeanceAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const REST_DAY = { dayOfWeek: 0, label: "Lundi", isRest: true, exercises: [] };
const EMPTY_STATE = { programDay: REST_DAY, activeSeance: null, seances: [] };

describe("TrackingScreen", () => {
  it("shows the empty state with no history", () => {
    render(<TrackingScreen state={EMPTY_STATE} />);
    expect(screen.getByText("Aucune séance enregistrée pour l'instant.")).toBeInTheDocument();
  });

  it("lists completed seances with their total reps", () => {
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
        }}
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("3 exercices")).toBeInTheDocument();
  });

  it("shows a seconds total alongside the reps total when a seance has both", () => {
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 90, exerciseCount: 4 }],
        }}
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("90 s")).toBeInTheDocument();
  });

  it("shows only the seconds total when a seance is seconds-only", () => {
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 0, totalSeconds: 60, exerciseCount: 1 }],
        }}
      />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("60 s")).toBeInTheDocument();
  });

  it("links a history row to its séance detail", () => {
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /42/ })).toHaveAttribute("href", "/tracking/5");
  });

  it("deletes a seance and refreshes the list on click", async () => {
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Supprimer la séance" }));
    expect(deleteTrackingSeanceAction).toHaveBeenCalledWith(5);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows an error affordance when deleteTrackingSeanceAction fails", async () => {
    deleteTrackingSeanceAction.mockRejectedValueOnce(new Error("boom"));
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Supprimer la séance" }));
    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a resume banner pointing at the guided player when a seance is active for a day", () => {
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          activeSeance: { id: 7, dayOfWeek: 3, dayLabel: "Jeudi", plannedExercises: [], loggedExercises: [] },
        }}
      />,
    );
    expect(screen.getByText("Séance interrompue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Reprendre/ })).toHaveAttribute("href", "/player/tracking?day=3");
  });

  it("shows a resume banner pointing at the freeform journal for a legacy active seance with no day", () => {
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          activeSeance: { id: 7, dayOfWeek: null, dayLabel: null, plannedExercises: null, loggedExercises: [] },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /Reprendre/ })).toHaveAttribute("href", "/tracking/7");
  });

  it("links to the programme management screen", () => {
    render(<TrackingScreen state={EMPTY_STATE} />);
    expect(screen.getByRole("link", { name: "Mon programme" })).toHaveAttribute("href", "/tracking/programme");
  });

  it("has no freeform séance button", () => {
    render(<TrackingScreen state={EMPTY_STATE} />);
    expect(screen.queryByRole("button", { name: "Enregistrer une séance libre" })).not.toBeInTheDocument();
  });
});
