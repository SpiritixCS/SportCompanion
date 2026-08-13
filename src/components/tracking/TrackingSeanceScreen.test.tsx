import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingSeanceScreen } from "./TrackingSeanceScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const logTrackingSetAction = vi.fn();
const completeTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  logTrackingSetAction: (...args: unknown[]) => logTrackingSetAction(...args),
  completeTrackingSeanceAction: (...args: unknown[]) => completeTrackingSeanceAction(...args),
}));

describe("TrackingSeanceScreen", () => {
  it("prompts to add the first exercise when the seance is empty", () => {
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);
    expect(screen.getByText("Ajoute ton premier exercice ci-dessous.")).toBeInTheDocument();
  });

  it("groups initial sets by exercise", () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[
          { id: 1, seanceId: 1, exerciseId: 10, exerciseName: "Squats", exerciseOrder: 0, setNumber: 1, repsActual: 12, completedAt: "2026-08-13T10:00:00.000Z" },
          { id: 2, seanceId: 1, exerciseId: 10, exerciseName: "Squats", exerciseOrder: 0, setNumber: 2, repsActual: 10, completedAt: "2026-08-13T10:01:00.000Z" },
        ]}
        exerciseSuggestions={["Squats"]}
      />,
    );
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("12 · 10")).toBeInTheDocument();
  });

  it("adds a set immediately on Ajouter la série, using the server's authoritative record", async () => {
    logTrackingSetAction.mockResolvedValue({
      id: 5, seanceId: 1, exerciseId: 20, exerciseName: "Fentes", exerciseOrder: 0, setNumber: 1, repsActual: 10, completedAt: "2026-08-13T10:02:00.000Z",
    });
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);

    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Fentes");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter la série" }));

    expect(logTrackingSetAction).toHaveBeenCalledWith({ seanceId: 1, exerciseName: "Fentes", repsActual: 10 });
    expect(await screen.findByText("Fentes")).toBeInTheDocument();
  });

  it("completes the seance and navigates back to the list", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[
          { id: 1, seanceId: 1, exerciseId: 10, exerciseName: "Squats", exerciseOrder: 0, setNumber: 1, repsActual: 12, completedAt: "2026-08-13T10:00:00.000Z" },
        ]}
        exerciseSuggestions={["Squats"]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Terminer la séance" }));
    expect(completeTrackingSeanceAction).toHaveBeenCalledWith(1);
    expect(push).toHaveBeenCalledWith("/tracking");
  });

  it("hides the entry form and the finish button once the seance is completed", () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed
        initialSets={[
          { id: 1, seanceId: 1, exerciseId: 10, exerciseName: "Squats", exerciseOrder: 0, setNumber: 1, repsActual: 12, completedAt: "2026-08-13T10:00:00.000Z" },
        ]}
        exerciseSuggestions={["Squats"]}
      />,
    );
    expect(screen.queryByPlaceholderText("Nom de l'exercice")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminer la séance" })).not.toBeInTheDocument();
  });
});
