// src/components/tracking/ProgrammeScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgrammeScreen } from "./ProgrammeScreen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const setDayRestAction = vi.fn();
const setDayExercisesAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  setDayRestAction: (...args: unknown[]) => setDayRestAction(...args),
  setDayExercisesAction: (...args: unknown[]) => setDayExercisesAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const REST_DAYS = WEEKDAY_LABELS.map((label, dayOfWeek) => ({ dayOfWeek, label, isRest: true, exercises: [] }));

describe("ProgrammeScreen", () => {
  it("lists all 7 weekdays as rest by default", () => {
    render(<ProgrammeScreen days={REST_DAYS} exerciseSuggestions={[]} />);
    for (const label of WEEKDAY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("switches a day to séance and back to repos", async () => {
    setDayRestAction.mockResolvedValue({ dayOfWeek: 0, label: "Lundi", isRest: false, exercises: [] });
    render(<ProgrammeScreen days={REST_DAYS} exerciseSuggestions={[]} />);
    const seanceButtons = screen.getAllByRole("button", { name: "Séance" });
    await userEvent.click(seanceButtons[0]!);
    expect(setDayRestAction).toHaveBeenCalledWith(0, false);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the exercise count and a Modifier button for a séance day", () => {
    const days = REST_DAYS.map((d, i) =>
      i === 0 ? { ...d, isRest: false, exercises: [{ ordre: 0, name: "Dips", unit: "reps" as const, setsCount: 3, targetValue: 12 }] } : d,
    );
    render(<ProgrammeScreen days={days} exerciseSuggestions={[]} />);
    expect(screen.getByText("1 exercice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modifier" })).toBeInTheDocument();
  });

  it("opens the day editor prefilled with its exercises on Modifier", async () => {
    const days = REST_DAYS.map((d, i) =>
      i === 0 ? { ...d, isRest: false, exercises: [{ ordre: 0, name: "Dips", unit: "reps" as const, setsCount: 3, targetValue: 12 }] } : d,
    );
    render(<ProgrammeScreen days={days} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Modifier" }));
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
  });

  it("saves the edited exercise list for the right day and refreshes", async () => {
    setDayExercisesAction.mockResolvedValue({ dayOfWeek: 2, label: "Mercredi", isRest: false, exercises: [] });
    const days = REST_DAYS.map((d, i) => (i === 2 ? { ...d, isRest: false, exercises: [] } : d));
    render(<ProgrammeScreen days={days} exerciseSuggestions={[]} />);
    const modifierButtons = screen.getAllByRole("button", { name: "Modifier" });
    await userEvent.click(modifierButtons[0]!);
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Dips");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(setDayExercisesAction).toHaveBeenCalledWith(2, [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 10 }]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows an error affordance when toggling a day fails", async () => {
    setDayRestAction.mockRejectedValueOnce(new Error("boom"));
    render(<ProgrammeScreen days={REST_DAYS} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Séance" })[0]!);
    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
  });
});
