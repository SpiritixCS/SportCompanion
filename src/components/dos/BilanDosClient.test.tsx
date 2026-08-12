import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BilanDosClient } from "./BilanDosClient";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("BilanDosClient", () => {
  it("binds seanceId, forwards reserves/gêne to completeAction, then shows the results", async () => {
    const completeAction = vi.fn().mockResolvedValue([
      { arbre: "A", nom: "Charnière & ischios", message: "Cran suivant débloqué : Good morning élastique" },
    ]);
    render(
      <BilanDosClient
        seanceId={42}
        arbres={[{ arbre: "A", nom: "Hip hinge au bâton" }]}
        completeAction={completeAction}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "0" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider la séance" }));

    expect(completeAction).toHaveBeenCalledWith(42, 0, { A: 0 });
    expect(await screen.findByText("Cran suivant débloqué : Good morning élastique")).toBeInTheDocument();
  });

  it("navigates home when Terminer is pressed on the results view", async () => {
    const completeAction = vi.fn().mockResolvedValue([
      { arbre: "A", nom: "Charnière & ischios", message: "Rester à ce cran. Viser le haut de la fourchette au RPE cible." },
    ]);
    render(
      <BilanDosClient
        seanceId={42}
        arbres={[{ arbre: "A", nom: "Hip hinge au bâton" }]}
        completeAction={completeAction}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "0" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider la séance" }));
    await userEvent.click(await screen.findByRole("button", { name: "Terminer" }));

    expect(push).toHaveBeenCalledWith("/");
  });
});
