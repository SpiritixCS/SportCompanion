import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LevelUpPrompt } from "./LevelUpPrompt";

const resolveLevelUpAction = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/programme/actions", () => ({
  resolveLevelUpAction: (...args: unknown[]) => resolveLevelUpAction(...args),
}));

describe("LevelUpPrompt", () => {
  it("shows the parcours and level in the copy", () => {
    render(<LevelUpPrompt parcours="intermediate" parcoursLabel="Intermédiaire" level={2} onResolved={() => {}} />);
    expect(screen.getByText("Intermédiaire · Niveau 3 terminé")).toBeInTheDocument();
  });

  it("advancing calls resolveLevelUpAction with advance and notifies onResolved", async () => {
    const onResolved = vi.fn();
    render(<LevelUpPrompt parcours="intermediate" parcoursLabel="Intermédiaire" level={2} onResolved={onResolved} />);
    await userEvent.click(screen.getByRole("button", { name: "Passer au niveau suivant" }));
    expect(resolveLevelUpAction).toHaveBeenCalledWith("advance", "intermediate", 2);
    expect(onResolved).toHaveBeenCalledOnce();
  });

  it("redoing calls resolveLevelUpAction with redo and notifies onResolved", async () => {
    const onResolved = vi.fn();
    render(<LevelUpPrompt parcours="intermediate" parcoursLabel="Intermédiaire" level={2} onResolved={onResolved} />);
    await userEvent.click(screen.getByRole("button", { name: "Refaire ce niveau" }));
    expect(resolveLevelUpAction).toHaveBeenCalledWith("redo", "intermediate", 2);
    expect(onResolved).toHaveBeenCalledOnce();
  });
});
