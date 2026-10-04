import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayEditor } from "./DayEditor";
import type { TrackingProgramDay } from "@/lib/tracking/program";

const EMPTY_DAY: TrackingProgramDay = { dayOfWeek: 0, label: "Lundi", isRest: true, exercises: [] };
const DIPS_DAY: TrackingProgramDay = {
  dayOfWeek: 2,
  label: "Mercredi",
  isRest: false,
  exercises: [
    { ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12, restSeconds: null },
    { ordre: 1, name: "Pompes", unit: "reps", setsCount: 3, targetValue: 15, restSeconds: 120 },
  ],
};

function renderEditor(day: TrackingProgramDay, onSave = vi.fn(), suggestions: { name: string; unit: "reps" | "seconds" }[] = []) {
  render(<DayEditor day={day} globalRestSeconds={60} exerciseSuggestions={suggestions} saving={false} error={false} onSave={onSave} />);
  return onSave;
}

describe("DayEditor", () => {
  it("opens an empty rest day as a séance to compose", () => {
    renderEditor(EMPTY_DAY);
    expect(screen.getByRole("switch", { name: "Jour de repos" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Ajoute ton premier exercice ci-dessous.")).toBeInTheDocument();
  });

  it("adds an exercise with a 1:30 rest by default", async () => {
    const onSave = renderEditor(EMPTY_DAY);
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Tractions");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    expect(screen.getByText("Tractions")).toBeInTheDocument();
    expect(screen.getByText("3 × 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repos 1:30" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).toHaveBeenCalledWith(false, [{ name: "Tractions", unit: "reps", setsCount: 3, targetValue: 10, restSeconds: 90 }]);
  });

  it("sets the rest of a new exercise by 15 s steps, never below 15 s", async () => {
    const onSave = renderEditor(EMPTY_DAY);
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Dips");
    const plus = screen.getByRole("button", { name: "Repos plus 15 secondes" });
    await userEvent.click(plus);
    expect(screen.getByText("1:45")).toBeInTheDocument();
    const minus = screen.getByRole("button", { name: "Repos moins 15 secondes" });
    for (let i = 0; i < 10; i++) await userEvent.click(minus);
    expect(screen.getByText("0:15")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).toHaveBeenCalledWith(false, [expect.objectContaining({ restSeconds: 15 })]);
  });

  it("shows the global rest for an existing exercise without its own, and lets it be tuned", async () => {
    const onSave = renderEditor(DIPS_DAY);
    expect(screen.getByRole("button", { name: "Repos 2:00" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Repos 1:00" }));
    await userEvent.click(screen.getByRole("button", { name: "Dips : repos plus 15 secondes" }));
    expect(screen.getByRole("button", { name: "Repos 1:15" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).toHaveBeenCalledWith(false, [
      expect.objectContaining({ name: "Dips", restSeconds: 75 }),
      expect.objectContaining({ name: "Pompes", restSeconds: 120 }),
    ]);
  });

  it("caps an exercise rest at 10 minutes", async () => {
    renderEditor({ ...DIPS_DAY, exercises: [{ ...DIPS_DAY.exercises[0]!, restSeconds: 600 }] });
    await userEvent.click(screen.getByRole("button", { name: "Repos 10:00" }));
    await userEvent.click(screen.getByRole("button", { name: "Dips : repos plus 15 secondes" }));
    expect(screen.getByRole("button", { name: "Repos 10:00" })).toBeInTheDocument();
  });

  it("locks the unit to a known exercise's unit", async () => {
    renderEditor(EMPTY_DAY, vi.fn(), [{ name: "Planche", unit: "seconds" }]);
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Planche");
    expect(screen.getByText("Unité : secondes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    expect(screen.getByText("3 × 10 s")).toBeInTheDocument();
  });

  it("reorders and removes exercises", async () => {
    const onSave = renderEditor(DIPS_DAY);
    await userEvent.click(screen.getByRole("button", { name: "Descendre Dips" }));
    await userEvent.click(screen.getByRole("button", { name: "Retirer Pompes" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).toHaveBeenCalledWith(false, [expect.objectContaining({ name: "Dips" })]);
  });

  it("disables Enregistrer for a séance day with no exercise", () => {
    renderEditor(EMPTY_DAY);
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });

  it("saves the day as rest, keeping its exercises", async () => {
    const onSave = renderEditor(DIPS_DAY);
    await userEvent.click(screen.getByRole("switch", { name: "Jour de repos" }));
    expect(screen.getByText("Ce jour est un jour de repos.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).toHaveBeenCalledWith(true, [expect.objectContaining({ name: "Dips" }), expect.objectContaining({ name: "Pompes" })]);
  });

  it("keeps following the global rest when tuned back to it", async () => {
    const onSave = renderEditor(DIPS_DAY);
    await userEvent.click(screen.getByRole("button", { name: "Repos 1:00" }));
    await userEvent.click(screen.getByRole("button", { name: "Dips : repos plus 15 secondes" }));
    await userEvent.click(screen.getByRole("button", { name: "Dips : repos moins 15 secondes" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).toHaveBeenCalledWith(false, [
      expect.objectContaining({ name: "Dips", restSeconds: null }),
      expect.objectContaining({ name: "Pompes", restSeconds: 120 }),
    ]);
  });

  it("saves an exercise typed but not yet added", async () => {
    const onSave = renderEditor(DIPS_DAY);
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Squats");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).toHaveBeenCalledWith(false, [
      expect.objectContaining({ name: "Dips" }),
      expect.objectContaining({ name: "Pompes" }),
      { name: "Squats", unit: "reps", setsCount: 3, targetValue: 10, restSeconds: 90 },
    ]);
  });

  it("can save a new day from a typed exercise alone", async () => {
    const onSave = renderEditor(EMPTY_DAY);
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Squats");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).toHaveBeenCalledWith(false, [expect.objectContaining({ name: "Squats" })]);
  });
});
