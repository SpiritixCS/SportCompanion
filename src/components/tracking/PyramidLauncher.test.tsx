import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PyramidLauncher } from "./PyramidLauncher";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const startPyramidAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  startPyramidAction: (...args: unknown[]) => startPyramidAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  startPyramidAction.mockResolvedValue(undefined);
});

function renderLauncher(props: Partial<React.ComponentProps<typeof PyramidLauncher>> = {}) {
  return render(<PyramidLauncher suggestions={["Pull ups", "Dips"]} lastPeaks={{ "pull ups": 7 }} activeHref={null} {...props} />);
}

describe("PyramidLauncher", () => {
  it("starts at peak 5 with a live total", () => {
    renderLauncher();
    expect(screen.getByText("25 reps · 9 marches")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lancer" })).toBeDisabled();
  });

  it("prefills the last peak used for the exercise", async () => {
    renderLauncher();
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Pull ups");
    expect(screen.getByText("49 reps · 13 marches")).toBeInTheDocument();
  });

  it("follows the shape and the peak", async () => {
    renderLauncher();
    await userEvent.click(screen.getByRole("button", { name: "Forme : Classique" }));
    expect(screen.getByText("29 reps · 9 marches")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sommet moins" }));
    expect(screen.getByText("19 reps · 7 marches")).toBeInTheDocument();
  });

  it("launches the pyramid and opens the player", async () => {
    renderLauncher();
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Dips");
    await userEvent.click(screen.getByRole("button", { name: "Lancer" }));
    expect(startPyramidAction).toHaveBeenCalledWith({ exerciseName: "Dips", shape: "classic", peak: 5 });
    expect(push).toHaveBeenCalledWith("/player/pyramide");
  });

  it("offers to resume the séance already in progress instead", () => {
    renderLauncher({ activeHref: "/player/tracking?day=2" });
    expect(screen.queryByRole("button", { name: "Lancer" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reprendre ta séance en cours" })).toHaveAttribute("href", "/player/tracking?day=2");
  });
});
