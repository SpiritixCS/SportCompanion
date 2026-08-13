import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingSeanceScreen } from "./TrackingSeanceScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const logTrackingSetAction = vi.fn();
const updateTrackingSetAction = vi.fn();
const deleteTrackingSetAction = vi.fn();
const completeTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  logTrackingSetAction: (...args: unknown[]) => logTrackingSetAction(...args),
  updateTrackingSetAction: (...args: unknown[]) => updateTrackingSetAction(...args),
  deleteTrackingSetAction: (...args: unknown[]) => deleteTrackingSetAction(...args),
  completeTrackingSeanceAction: (...args: unknown[]) => completeTrackingSeanceAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const SQUATS_SET = {
  id: 1, seanceId: 1, exerciseId: 10, exerciseName: "Squats", exerciseUnit: "reps" as const,
  exerciseOrder: 0, setNumber: 1, valeurActual: 12, completedAt: "2026-08-13T10:00:00.000Z",
};

describe("TrackingSeanceScreen", () => {
  it("prompts to add the first exercise when the seance is empty", () => {
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);
    expect(screen.getByText("Ajoute ton premier exercice ci-dessous.")).toBeInTheDocument();
  });

  it("groups initial sets by exercise, showing each value as its own tap target", () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[SQUATS_SET, { ...SQUATS_SET, id: 2, setNumber: 2, valeurActual: 10 }]}
        exerciseSuggestions={[{ name: "Squats", unit: "reps" }]}
      />,
    );
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
  });

  it("shows a seconds suffix on a seconds exercise's set values", () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[{ ...SQUATS_SET, id: 3, exerciseName: "Planche", exerciseUnit: "seconds", valeurActual: 30 }]}
        exerciseSuggestions={[{ name: "Planche", unit: "seconds" }]}
      />,
    );
    expect(screen.getByRole("button", { name: "30 s" })).toBeInTheDocument();
  });

  it("locks the unit picker to a known exercise's unit and hides the reps/seconds toggle", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[]}
        exerciseSuggestions={[{ name: "Planche", unit: "seconds" }]}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Planche");
    expect(screen.getByText("Unité : secondes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reps" })).not.toBeInTheDocument();
  });

  it("keeps the unit locked for an exercise added earlier in this same session, even though it isn't in the initial suggestions", async () => {
    logTrackingSetAction.mockResolvedValue([
      { ...SQUATS_SET, id: 30, exerciseName: "Planche", exerciseUnit: "seconds", valeurActual: 40 },
    ]);
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);

    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Planche");
    await userEvent.click(screen.getByRole("button", { name: "Secondes" }));
    await userEvent.click(screen.getByRole("button", { name: "Ajouter la série" }));
    await screen.findAllByText("Planche");

    await userEvent.clear(screen.getByPlaceholderText("Nom de l'exercice"));
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Planche");

    expect(screen.getByText("Unité : secondes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reps" })).not.toBeInTheDocument();
  });

  it("shows the reps/seconds toggle, defaulting to reps, for an unknown exercise name", async () => {
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Fentes bulgares");
    expect(screen.getByRole("button", { name: "Reps" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Secondes" })).toBeInTheDocument();
  });

  it("adds count separate sets in one call, using the server's authoritative records", async () => {
    logTrackingSetAction.mockResolvedValue([
      { ...SQUATS_SET, id: 21, exerciseName: "Fentes", setNumber: 1 },
      { ...SQUATS_SET, id: 22, exerciseName: "Fentes", setNumber: 2 },
    ]);
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);

    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Fentes");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter une série au lot" }));
    await userEvent.click(screen.getByRole("button", { name: "Ajouter la série" }));

    expect(logTrackingSetAction).toHaveBeenCalledWith({ seanceId: 1, exerciseName: "Fentes", unit: "reps", valeurActual: 10, count: 2 });
    expect(await screen.findAllByText("Fentes")).toHaveLength(1);
  });

  it("edits a set's value through the reuse sheet, calling updateTrackingSetAction", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[SQUATS_SET]}
        exerciseSuggestions={[{ name: "Squats", unit: "reps" }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "12" }));
    expect(screen.getByText("Ajuster les reps")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(updateTrackingSetAction).toHaveBeenCalledWith(1, 13);
    expect(await screen.findByRole("button", { name: "13" })).toBeInTheDocument();
  });

  it("deletes a set through the sheet, calling deleteTrackingSetAction", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[SQUATS_SET]}
        exerciseSuggestions={[{ name: "Squats", unit: "reps" }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "12" }));
    await userEvent.click(screen.getByRole("button", { name: "Supprimer la série" }));
    expect(deleteTrackingSetAction).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("button", { name: "12" })).not.toBeInTheDocument();
  });

  it("keeps the entry form and edit/delete available on an already-completed seance", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed
        initialSets={[SQUATS_SET]}
        exerciseSuggestions={[{ name: "Squats", unit: "reps" }]}
      />,
    );
    expect(screen.getByPlaceholderText("Nom de l'exercice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminer la séance" })).not.toBeInTheDocument();
  });

  it("completes the seance and navigates back to the list", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[SQUATS_SET]}
        exerciseSuggestions={[{ name: "Squats", unit: "reps" }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Terminer la séance" }));
    expect(completeTrackingSeanceAction).toHaveBeenCalledWith(1);
    expect(push).toHaveBeenCalledWith("/tracking");
  });

  it("re-enables Ajouter la série and shows an error affordance when logTrackingSetAction fails", async () => {
    logTrackingSetAction.mockRejectedValueOnce(new Error("boom"));
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);

    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Fentes");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter la série" }));

    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter la série" })).not.toBeDisabled();
  });
});
