import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const setPrenomAction = vi.fn();
vi.mock("@/lib/profile/actions", () => ({ setPrenomAction: (p: string) => setPrenomAction(p) }));

import { PrenomScreen } from "./PrenomScreen";

beforeEach(() => {
  refresh.mockClear();
  setPrenomAction.mockReset();
});

describe("PrenomScreen", () => {
  it("disables Continuer while the field is blank", async () => {
    render(<PrenomScreen />);
    expect(screen.getByText("Comment tu t'appelles ?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuer" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Prénom"), "   ");
    expect(screen.getByRole("button", { name: "Continuer" })).toBeDisabled();
  });

  it("saves the prénom then refreshes so the shell re-reads it from the DB", async () => {
    setPrenomAction.mockResolvedValue(undefined);
    render(<PrenomScreen />);
    await userEvent.type(screen.getByLabelText("Prénom"), "Léa");
    await userEvent.click(screen.getByRole("button", { name: "Continuer" }));
    expect(setPrenomAction).toHaveBeenCalledWith("Léa");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows an error and stays when saving fails", async () => {
    setPrenomAction.mockRejectedValue(new Error("boom"));
    render(<PrenomScreen />);
    await userEvent.type(screen.getByLabelText("Prénom"), "Léa");
    await userEvent.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(screen.getByText("Impossible d'enregistrer. Réessaie.")).toBeInTheDocument());
    expect(refresh).not.toHaveBeenCalled();
  });
});
