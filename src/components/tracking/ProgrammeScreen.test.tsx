// src/components/tracking/ProgrammeScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgrammeScreen } from "./ProgrammeScreen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const createTemplateAction = vi.fn();
const updateTemplateAction = vi.fn();
const deleteTemplateAction = vi.fn();
const setRotationAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  createTemplateAction: (...args: unknown[]) => createTemplateAction(...args),
  updateTemplateAction: (...args: unknown[]) => updateTemplateAction(...args),
  deleteTemplateAction: (...args: unknown[]) => deleteTemplateAction(...args),
  setRotationAction: (...args: unknown[]) => setRotationAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const PUSH = {
  id: 1,
  nom: "Push",
  createdAt: "2026-08-14T00:00:00.000Z",
  exercises: [{ ordre: 0, name: "Dips", unit: "reps" as const, setsCount: 3, targetValue: 12 }],
};
const PULL = { id: 2, nom: "Pull", createdAt: "2026-08-14T00:00:00.000Z", exercises: [] };

describe("ProgrammeScreen", () => {
  it("shows an empty state with no templates", () => {
    render(<ProgrammeScreen templates={[]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    expect(screen.getByText("Aucun modèle pour l'instant.")).toBeInTheDocument();
  });

  it("opens the editor on Nouveau modèle, creates a template and refreshes on save", async () => {
    createTemplateAction.mockResolvedValue(PUSH);
    render(<ProgrammeScreen templates={[]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Nouveau modèle" }));
    await userEvent.type(screen.getByPlaceholderText("Nom du modèle"), "Push");
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Dips");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le modèle" }));
    expect(createTemplateAction).toHaveBeenCalledWith("Push", [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 10 }]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("opens the editor prefilled with a template's data when clicked", async () => {
    render(<ProgrammeScreen templates={[PUSH]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByText("Push"));
    expect(screen.getByDisplayValue("Push")).toBeInTheDocument();
    expect(screen.getByText("Dips")).toBeInTheDocument();
  });

  it("deletes a template and refreshes", async () => {
    render(<ProgrammeScreen templates={[PUSH]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Supprimer Push" }));
    expect(deleteTemplateAction).toHaveBeenCalledWith(1);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("adds a template to the rotation", async () => {
    render(<ProgrammeScreen templates={[PUSH]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Ajouter à la rotation" }));
    expect(setRotationAction).toHaveBeenCalledWith([1]);
  });

  it("removes a template from the rotation", async () => {
    render(
      <ProgrammeScreen
        templates={[PUSH]}
        rotation={{ entries: [{ templateId: 1, nom: "Push", position: 0 }], pointerTemplateId: 1 }}
        exerciseSuggestions={[]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dans la rotation" }));
    expect(setRotationAction).toHaveBeenCalledWith([]);
  });

  it("swaps two templates' order via the reorder controls", async () => {
    render(
      <ProgrammeScreen
        templates={[PUSH, PULL]}
        rotation={{
          entries: [
            { templateId: 1, nom: "Push", position: 0 },
            { templateId: 2, nom: "Pull", position: 1 },
          ],
          pointerTemplateId: 1,
        }}
        exerciseSuggestions={[]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Descendre Push dans la rotation" }));
    expect(setRotationAction).toHaveBeenCalledWith([2, 1]);
  });

  it("shows an error affordance when an action fails", async () => {
    deleteTemplateAction.mockRejectedValueOnce(new Error("boom"));
    render(<ProgrammeScreen templates={[PUSH]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Supprimer Push" }));
    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
  });
});
