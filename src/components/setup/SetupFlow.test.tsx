import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupFlow } from "./SetupFlow";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const setCurrentPositionAction = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/programme/actions", () => ({
  setCurrentPositionAction: (...args: unknown[]) => setCurrentPositionAction(...args),
}));

beforeEach(() => {
  refresh.mockClear();
  setCurrentPositionAction.mockClear();
});

describe("SetupFlow", () => {
  it("starts on the parcours step and walks all 4 steps through to confirmation", async () => {
    const onClose = vi.fn();
    render(<SetupFlow onClose={onClose} />);

    expect(screen.getByText("Étape 1 / 4")).toBeInTheDocument();
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Débutant"));
    expect(screen.getByText("Étape 2 / 4")).toBeInTheDocument();
    expect(screen.getByText("Choisis ton niveau")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Niveau 1"));
    expect(screen.getByText("Étape 3 / 4")).toBeInTheDocument();
    expect(screen.getByText("Choisis ton jour")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Jour 1"));
    expect(screen.getByText("Étape 4 / 4")).toBeInTheDocument();
    expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "C'est parti" }));
    expect(setCurrentPositionAction).toHaveBeenCalledWith("beginner", 0, 0);
    expect(onClose).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("Retour goes back one step without losing later choices", async () => {
    render(<SetupFlow onClose={() => {}} />);
    await userEvent.click(screen.getByText("Débutant"));
    await userEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
  });

  it("Annuler on the first step closes without writing a position", async () => {
    const onClose = vi.fn();
    render(<SetupFlow onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(setCurrentPositionAction).not.toHaveBeenCalled();
  });

  it("disables rest days in the day-picker step", async () => {
    render(<SetupFlow onClose={() => {}} />);
    await userEvent.click(screen.getByText("Débutant"));
    await userEvent.click(screen.getByText("Niveau 1"));
    expect(screen.getByRole("button", { name: /^2/ })).toBeDisabled();
  });
});
