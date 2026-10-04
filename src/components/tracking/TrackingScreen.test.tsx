// src/components/tracking/TrackingScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingScreen } from "./TrackingScreen";
import type { TrackingProgramDay } from "@/lib/tracking/program";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const deleteTrackingSeanceAction = vi.fn();
const saveDayAction = vi.fn();
const advanceProgramDayAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  deleteTrackingSeanceAction: (...args: unknown[]) => deleteTrackingSeanceAction(...args),
  saveDayAction: (...args: unknown[]) => saveDayAction(...args),
  advanceProgramDayAction: (...args: unknown[]) => advanceProgramDayAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const REST_DAYS: TrackingProgramDay[] = WEEKDAY_LABELS.map((label, dayOfWeek) => ({ dayOfWeek, label, isRest: true, exercises: [] }));
const REST_DAY = REST_DAYS[0]!;
const EMPTY_STATE = { programDay: REST_DAY, programEmpty: false, activeSeance: null, seances: [] };
const WED: TrackingProgramDay = {
  dayOfWeek: 2,
  label: "Mercredi",
  isRest: false,
  exercises: [
    { ordre: 0, name: "Tractions", unit: "reps", setsCount: 4, targetValue: 8, restSeconds: 120, pyramid: null },
    { ordre: 1, name: "Gainage", unit: "seconds", setsCount: 3, targetValue: 45, restSeconds: null, pyramid: null },
  ],
};
const BASE = { days: REST_DAYS, exerciseSuggestions: [], globalRestSeconds: 90 };

describe("TrackingScreen", () => {
  it("shows the empty state with no history", () => {
    render(<TrackingScreen {...BASE} state={EMPTY_STATE} />);
    expect(screen.getByText("Aucune séance enregistrée pour l'instant.")).toBeInTheDocument();
  });

  it("lists completed seances with their total reps", () => {
    render(
      <TrackingScreen
        {...BASE}
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3, pyramid: null }],
        }}
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("3 exercices")).toBeInTheDocument();
  });

  it("shows a seconds total alongside the reps total when a seance has both", () => {
    render(
      <TrackingScreen
        {...BASE}
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 90, exerciseCount: 4, pyramid: null }],
        }}
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("90 s")).toBeInTheDocument();
  });

  it("shows only the seconds total when a seance is seconds-only", () => {
    render(
      <TrackingScreen
        {...BASE}
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 0, totalSeconds: 60, exerciseCount: 1, pyramid: null }],
        }}
      />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("60 s")).toBeInTheDocument();
  });

  it("links a history row to its séance detail", () => {
    render(
      <TrackingScreen
        {...BASE}
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3, pyramid: null }],
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /42/ })).toHaveAttribute("href", "/tracking/5");
  });

  it("deletes a seance and refreshes the list on click", async () => {
    render(
      <TrackingScreen
        {...BASE}
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3, pyramid: null }],
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
        {...BASE}
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3, pyramid: null }],
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
        {...BASE}
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
        {...BASE}
        state={{
          ...EMPTY_STATE,
          activeSeance: { id: 7, dayOfWeek: null, dayLabel: null, plannedExercises: null, loggedExercises: [] },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /Reprendre/ })).toHaveAttribute("href", "/tracking/7");
  });

  it("shows the week as 7 days with their exercise count or rest", () => {
    const days = REST_DAYS.map((d) => (d.dayOfWeek === 2 ? WED : d));
    render(<TrackingScreen {...BASE} days={days} state={{ ...EMPTY_STATE, programDay: WED }} />);
    expect(screen.getByRole("button", { name: "Lundi, repos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mercredi, 2 exercices · prochaine séance" })).toBeInTheDocument();
  });

  it("invites to compose Monday when the programme is empty", async () => {
    render(<TrackingScreen {...BASE} state={{ ...EMPTY_STATE, programEmpty: true }} />);
    expect(screen.getByText("Ta semaine est vide")).toBeInTheDocument();
    expect(screen.queryByText(/prochaine séance/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Composer lundi" }));
    expect(screen.getByRole("dialog", { name: "Modifier le jour · Lundi" })).toBeInTheDocument();
  });

  it("shows the next séance with each exercise's rest and starts it", () => {
    const days = REST_DAYS.map((d) => (d.dayOfWeek === 2 ? WED : d));
    render(<TrackingScreen {...BASE} days={days} state={{ ...EMPTY_STATE, programDay: WED }} />);
    expect(screen.getByText("Prochaine séance")).toBeInTheDocument();
    expect(screen.getByText("Repos 2:00")).toBeInTheDocument();
    expect(screen.getByText("Repos 1:30")).toBeInTheDocument();
    expect(screen.getByText("3 × 45 s")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Commencer la séance" })).toHaveAttribute("href", "/player/tracking?day=2");
  });

  it("moves past a rest day with Jour suivant", async () => {
    render(<TrackingScreen {...BASE} state={EMPTY_STATE} />);
    await userEvent.click(screen.getByRole("button", { name: "Jour suivant" }));
    expect(advanceProgramDayAction).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalled();
  });

  it("edits a day from the week and saves it", async () => {
    const days = REST_DAYS.map((d) => (d.dayOfWeek === 2 ? WED : d));
    render(<TrackingScreen {...BASE} days={days} state={{ ...EMPTY_STATE, programDay: WED }} />);
    await userEvent.click(screen.getByRole("button", { name: /^Mercredi/ }));
    await userEvent.click(screen.getByRole("button", { name: "Retirer Gainage" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(saveDayAction).toHaveBeenCalledWith(2, false, [
      { name: "Tractions", unit: "reps", setsCount: 4, targetValue: 8, restSeconds: 120, pyramid: null },
    ]);
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no freeform séance button", () => {
    render(<TrackingScreen {...BASE} state={EMPTY_STATE} />);
    expect(screen.queryByRole("button", { name: "Enregistrer une séance libre" })).not.toBeInTheDocument();
  });

  it("names a pyramid exercise by its shape in the next séance", () => {
    const pyr: TrackingProgramDay = {
      ...WED,
      exercises: [{ ordre: 0, name: "Pull ups", unit: "reps", setsCount: 9, targetValue: 5, restSeconds: null, pyramid: { shape: "classic", peak: 5 } }],
    };
    render(<TrackingScreen {...BASE} days={REST_DAYS.map((d) => (d.dayOfWeek === 2 ? pyr : d))} state={{ ...EMPTY_STATE, programDay: pyr }} />);
    expect(screen.getByText("Pyramide 1→5→1")).toBeInTheDocument();
    expect(screen.getByText("Repos auto")).toBeInTheDocument();
  });
});
