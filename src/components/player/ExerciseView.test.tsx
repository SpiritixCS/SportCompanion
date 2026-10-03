import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseView } from "./ExerciseView";
import type { Exercise } from "@/lib/workout/types";

const EXERCISE: Exercise = {
  id: "push-ups",
  name: "Push ups",
  movementFamily: "push",
  countsInStats: true,
  videoId: null,
  sets: 3,
  target: { unit: "reps", value: 12, maxEffort: false, eachSide: false },
};

function renderView(overrides: Partial<React.ComponentProps<typeof ExerciseView>> = {}) {
  return render(
    <ExerciseView
      exercise={EXERCISE}
      exerciseIndex={1}
      totalExercises={4}
      setNumber={2}
      elapsedSeconds={65}
      onCompleteSet={() => {}}
      onSkipExercise={() => {}}
      onQuit={() => {}}
      {...overrides}
    />,
  );
}

describe("ExerciseView", () => {
  it("shows the exercise name, progress, elapsed time, and formatted target", () => {
    renderView();
    expect(screen.getByText("Push ups")).toBeInTheDocument();
    expect(screen.getByText("Exercice 2 / 4")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
  });

  it("calls onQuit when the exit button is pressed", async () => {
    const onQuit = vi.fn();
    renderView({ onQuit });
    await userEvent.click(screen.getByRole("button", { name: "Quitter la séance" }));
    expect(onQuit).toHaveBeenCalledOnce();
  });

  it("opens the RepsSheet prefilled on the target and confirms through to onCompleteSet", async () => {
    const onCompleteSet = vi.fn();
    renderView({ setNumber: 1, onCompleteSet });
    await userEvent.click(screen.getByRole("button", { name: "Série terminée" }));
    expect(screen.getByText("12")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onCompleteSet).toHaveBeenCalledWith(12);
  });

  it("calls onSkipExercise from the secondary action", async () => {
    const onSkipExercise = vi.fn();
    renderView({ onSkipExercise });
    await userEvent.click(screen.getByText("Passer l'exercice"));
    expect(onSkipExercise).toHaveBeenCalledOnce();
  });

  it("shows the exercise's glyph instead of a photo, and the next exercise", () => {
    const { container } = renderView({ nextExerciseName: "Squats" });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-testid="exercise-hero"] svg')).not.toBeNull();
    expect(screen.getByText("Série 2 / 3")).toBeInTheDocument();
    expect(screen.getByText("Puis Squats")).toBeInTheDocument();
  });

  it("shows the exercise's initial on a jade tile in a Tracking session", () => {
    renderView({ accent: "sage", exercise: { ...EXERCISE, id: "day-0-0", name: "Muscle ups", movementFamily: "other" } });
    expect(screen.getByTestId("exercise-hero")).toHaveTextContent("M");
  });

  it("one bar per set: done, current, upcoming", () => {
    renderView();
    const bars = screen.getAllByTestId("set-bar");
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveAttribute("data-state", "done");
    expect(bars[1]).toHaveAttribute("data-state", "current");
    expect(bars[2]).toHaveAttribute("data-state", "upcoming");
  });

  it("names the reps sheet after the unit, with no separate Ajuster button", async () => {
    renderView({ exercise: { ...EXERCISE, target: { unit: "seconds", value: 60, maxEffort: false, eachSide: false } } });
    expect(screen.queryByRole("button", { name: "Ajuster les reps" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Série terminée" }));
    expect(screen.getByText("Secondes tenues")).toBeInTheDocument();
  });
});
