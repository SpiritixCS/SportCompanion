import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const addExtraRepsAction = vi.fn();
const deleteExtraRepsAction = vi.fn();
vi.mock("@/lib/extraReps/actions", () => ({
  addExtraRepsAction: (...a: unknown[]) => addExtraRepsAction(...a),
  deleteExtraRepsAction: (...a: unknown[]) => deleteExtraRepsAction(...a),
}));

import { ExtraRepsSection } from "./ExtraRepsSection";

beforeEach(() => {
  vi.clearAllMocks();
  addExtraRepsAction.mockResolvedValue(undefined);
  deleteExtraRepsAction.mockResolvedValue(undefined);
});

const ENTRIES = [{ id: 4, amount: 15, loggedAt: "2026-10-03T09:00:00.000Z" }];

describe("ExtraRepsSection", () => {
  it("adds reps from the sheet, Ajouter disabled until a positive number is typed", async () => {
    render(<ExtraRepsSection cardId="squats" unit="reps" entries={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Ajouter des reps" }));
    const add = screen.getByRole("button", { name: "Ajouter" });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Nombre de reps"), "0");
    expect(add).toBeDisabled();
    await userEvent.clear(screen.getByLabelText("Nombre de reps"));
    await userEvent.type(screen.getByLabelText("Nombre de reps"), "12");
    await userEvent.click(add);
    expect(addExtraRepsAction).toHaveBeenCalledWith("squats", 12);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("speaks in seconds for a timed exercise", async () => {
    render(<ExtraRepsSection cardId="tracking-3" unit="seconds" entries={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Ajouter des secondes" }));
    expect(screen.getByLabelText("Nombre de secondes")).toBeInTheDocument();
  });

  it("lists hors-séance entries and deletes one after confirmation", async () => {
    render(<ExtraRepsSection cardId="squats" unit="reps" entries={ENTRIES} />);
    expect(screen.getByText("Hors séance")).toBeInTheDocument();
    expect(screen.getByText("+15")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Supprimer +15" }));
    expect(deleteExtraRepsAction).not.toHaveBeenCalled();
    expect(screen.getByText("Retirer 15 reps du total ?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retirer" }));
    expect(deleteExtraRepsAction).toHaveBeenCalledWith(4);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows no Hors séance section when there is no entry", () => {
    render(<ExtraRepsSection cardId="squats" unit="reps" entries={[]} />);
    expect(screen.queryByText("Hors séance")).not.toBeInTheDocument();
  });

  it("keeps the sheet open with a message when saving fails", async () => {
    addExtraRepsAction.mockRejectedValue(new Error("boom"));
    render(<ExtraRepsSection cardId="squats" unit="reps" entries={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Ajouter des reps" }));
    await userEvent.type(screen.getByLabelText("Nombre de reps"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(await screen.findByText("Impossible d'enregistrer. Réessaie.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
