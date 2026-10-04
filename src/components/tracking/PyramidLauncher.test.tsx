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
  return render(<PyramidLauncher suggestions={["Pull ups", "Push ups", "Australian pull ups", "Dips", "Élévations"]} lastPeaks={{ "pull ups": 7 }} activeHref={null} {...props} />);
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

  it("narrows the exercise list as letters are typed, names starting with them first", async () => {
    renderLauncher();
    const input = screen.getByPlaceholderText("Nom de l'exercice");
    await userEvent.type(input, "pu");
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Pull ups", "Push ups", "Australian pull ups"]);
    await userEvent.type(input, "l");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Pull ups", "Australian pull ups"]);
  });

  it("ignores accents and case while narrowing", async () => {
    renderLauncher();
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "elev");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Élévations"]);
  });

  it("fills the name when a suggestion is chosen, and closes the list", async () => {
    renderLauncher();
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "pul");
    await userEvent.click(screen.getByRole("option", { name: "Pull ups" }));
    expect(screen.getByPlaceholderText("Nom de l'exercice")).toHaveValue("Pull ups");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("49 reps · 13 marches")).toBeInTheDocument();
  });
});
