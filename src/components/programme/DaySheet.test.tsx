import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DaySheet } from "./DaySheet";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

const setCurrentPositionAction = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/programme/actions", () => ({
  setCurrentPositionAction: (...args: unknown[]) => setCurrentPositionAction(...args),
}));

beforeEach(() => {
  refresh.mockClear();
  push.mockClear();
  setCurrentPositionAction.mockClear();
});

describe("DaySheet", () => {
  it("lists the day's exercises with their dose", () => {
    render(<DaySheet parcours="beginner" level={0} dayIndex={0} onClose={() => {}} />);
    expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();
    expect(screen.getByText("Push ups on knees negatives")).toBeInTheDocument();
  });

  it("Démarrer ce jour links straight to the player without touching position", () => {
    render(<DaySheet parcours="beginner" level={0} dayIndex={0} onClose={() => {}} />);
    expect(screen.getByRole("link", { name: "Démarrer ce jour" })).toHaveAttribute(
      "href", "/player?parcours=beginner&level=0&day=0",
    );
    expect(setCurrentPositionAction).not.toHaveBeenCalled();
  });

  it("Reprendre ici asks for confirmation before moving the position", async () => {
    render(<DaySheet parcours="beginner" level={0} dayIndex={0} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Reprendre ici" }));
    expect(setCurrentPositionAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Confirmer/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(setCurrentPositionAction).toHaveBeenCalledWith("beginner", 0, 0);
    expect(push).toHaveBeenCalledWith("/player?parcours=beginner&level=0&day=0");
  });
});
