// src/components/tracking/TemplateEditor.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateEditor } from "./TemplateEditor";

describe("TemplateEditor", () => {
  it("prompts to add the first exercise when starting empty", () => {
    render(
      <TemplateEditor initialNom="" initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText("Ajoute ton premier exercice ci-dessous.")).toBeInTheDocument();
  });

  it("adds an exercise to the draft list from the form", async () => {
    render(
      <TemplateEditor initialNom="" initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={() => {}} />,
    );
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Dips");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("3 × 10")).toBeInTheDocument();
  });

  it("locks the unit to a known exercise's unit", async () => {
    render(
      <TemplateEditor
        initialNom=""
        initialExercises={[]}
        exerciseSuggestions={[{ name: "Planche", unit: "seconds" }]}
        saving={false}
        error={false}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Planche");
    expect(screen.getByText("Unité : secondes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    expect(screen.getByText("3 × 10 s")).toBeInTheDocument();
  });

  it("reorders exercises with the up/down controls", async () => {
    render(
      <TemplateEditor
        initialNom="Push"
        initialExercises={[
          { name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 },
          { name: "Pompes", unit: "reps", setsCount: 3, targetValue: 15 },
        ]}
        exerciseSuggestions={[]}
        saving={false}
        error={false}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Descendre Dips" }));
    const rows = screen.getAllByText(/Dips|Pompes/);
    expect(rows[0]).toHaveTextContent("Pompes");
    expect(rows[1]).toHaveTextContent("Dips");
  });

  it("removes an exercise from the draft", async () => {
    render(
      <TemplateEditor
        initialNom="Push"
        initialExercises={[{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]}
        exerciseSuggestions={[]}
        saving={false}
        error={false}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retirer Dips" }));
    expect(screen.queryByText("Dips")).not.toBeInTheDocument();
  });

  it("calls onSave with the name and the draft exercise list", async () => {
    const onSave = vi.fn();
    render(
      <TemplateEditor
        initialNom="Push"
        initialExercises={[{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]}
        exerciseSuggestions={[]}
        saving={false}
        error={false}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le modèle" }));
    expect(onSave).toHaveBeenCalledWith("Push", [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);
  });

  it("disables Enregistrer until a name and at least one exercise are present", () => {
    render(
      <TemplateEditor initialNom="" initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Enregistrer le modèle" })).toBeDisabled();
  });

  it("calls onCancel from the Annuler button", async () => {
    const onCancel = vi.fn();
    render(
      <TemplateEditor initialNom="" initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
