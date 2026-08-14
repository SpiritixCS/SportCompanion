import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingScreen } from "./TrackingScreen";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const startTrackingSeanceAction = vi.fn();
const deleteTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  startTrackingSeanceAction: (...args: unknown[]) => startTrackingSeanceAction(...args),
  deleteTrackingSeanceAction: (...args: unknown[]) => deleteTrackingSeanceAction(...args),
}));

// Module-level mocks (vi.mock hoisting) otherwise accumulate implementations
// across tests in this file — reset between tests so each test controls its
// own resolve/reject behaviour.
beforeEach(() => {
  vi.clearAllMocks();
});

describe("TrackingScreen", () => {
  it("shows the empty state with no history", () => {
    render(<TrackingScreen state={{ activeSeanceId: null, seances: [] }} />);
    expect(screen.getByText("Aucune séance enregistrée pour l'instant.")).toBeInTheDocument();
  });

  it("lists completed seances with their total reps", () => {
    render(
      <TrackingScreen
        state={{
          activeSeanceId: null,
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
          activeSeanceId: null,
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
          activeSeanceId: null,
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
          activeSeanceId: null,
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
          activeSeanceId: null,
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
          activeSeanceId: null,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Supprimer la séance" }));
    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a resume banner when a seance is already active", () => {
    render(<TrackingScreen state={{ activeSeanceId: 7, seances: [] }} />);
    expect(screen.getByText("Séance interrompue")).toBeInTheDocument();
  });

  it("starts a seance and navigates to it on button click", async () => {
    startTrackingSeanceAction.mockResolvedValue(9);
    render(<TrackingScreen state={{ activeSeanceId: null, seances: [] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer une séance" }));
    expect(startTrackingSeanceAction).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/tracking/9");
  });

  it("shows an error affordance instead of navigating when startTrackingSeanceAction fails", async () => {
    startTrackingSeanceAction.mockRejectedValueOnce(new Error("boom"));
    render(<TrackingScreen state={{ activeSeanceId: null, seances: [] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer une séance" }));
    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
