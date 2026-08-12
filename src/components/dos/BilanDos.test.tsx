import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BilanDos } from "./BilanDos";

const ARBRES = [
  { arbre: "A" as const, nom: "Nordic curl excentrique assisté" },
  { arbre: "B" as const, nom: "Pont fessier bilatéral" },
];

describe("BilanDos", () => {
  it("disables Valider until every arbre has a reserve answer", async () => {
    const onValidate = vi.fn();
    render(<BilanDos arbres={ARBRES} onValidate={onValidate} />);
    expect(screen.getByRole("button", { name: "Valider la séance" })).toBeDisabled();

    await userEvent.click(screen.getAllByRole("button", { name: "0" })[0]!);
    expect(screen.getByRole("button", { name: "Valider la séance" })).toBeDisabled();

    await userEvent.click(screen.getAllByRole("button", { name: "3" })[1]!);
    expect(screen.getByRole("button", { name: "Valider la séance" })).not.toBeDisabled();
  });

  it("calls onValidate with the chosen reserves and gêne", async () => {
    const onValidate = vi.fn();
    render(<BilanDos arbres={ARBRES} onValidate={onValidate} />);

    const zeroButtons = screen.getAllByRole("button", { name: "0" });
    await userEvent.click(zeroButtons[0]!); // A → 0
    const fiveOrMoreButtons = screen.getAllByRole("button", { name: "5 ou +" });
    await userEvent.click(fiveOrMoreButtons[1]!); // B → 5

    const plusButtons = screen.getAllByRole("button", { name: "+" });
    await userEvent.click(plusButtons[0]!);
    await userEvent.click(plusButtons[0]!);

    await userEvent.click(screen.getByRole("button", { name: "Valider la séance" }));

    expect(onValidate).toHaveBeenCalledWith({ A: 0, B: 5 }, 2);
  });

  it("shows all 6 reserve options per arbre", () => {
    render(<BilanDos arbres={[ARBRES[0]!]} onValidate={() => {}} />);
    for (const label of ["0", "1", "2", "3", "4", "5 ou +"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
