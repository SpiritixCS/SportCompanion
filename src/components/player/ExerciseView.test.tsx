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

describe("ExerciseView", () => {
  it("shows the exercise name, progress, and formatted target", () => {
    render(
      <ExerciseView
        exercise={EXERCISE}
        exerciseIndex={1}
        totalExercises={4}
        setNumber={2}
        onCompleteSet={() => {}}
        onSkipExercise={() => {}}
      />,
    );
    expect(screen.getByText("Push ups")).toBeInTheDocument();
    expect(screen.getByText("Exercice 2 / 4")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
  });

  it("renders one pastille per set, marking earlier ones done and the current one today", () => {
    render(
      <ExerciseView
        exercise={EXERCISE}
        exerciseIndex={0}
        totalExercises={1}
        setNumber={2}
        onCompleteSet={() => {}}
        onSkipExercise={() => {}}
      />,
    );
    expect(screen.getByRole("img", { name: "Fait" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Aujourd'hui" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "À venir" })).toBeInTheDocument();
  });

  it("opens the RepsSheet prefilled on the target and confirms through to onCompleteSet", async () => {
    const onCompleteSet = vi.fn();
    render(
      <ExerciseView
        exercise={EXERCISE}
        exerciseIndex={0}
        totalExercises={1}
        setNumber={1}
        onCompleteSet={onCompleteSet}
        onSkipExercise={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Série terminée" }));
    expect(screen.getByText("12")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onCompleteSet).toHaveBeenCalledWith(12);
  });

  it("calls onSkipExercise from the secondary action", async () => {
    const onSkipExercise = vi.fn();
    render(
      <ExerciseView
        exercise={EXERCISE}
        exerciseIndex={0}
        totalExercises={1}
        setNumber={1}
        onCompleteSet={() => {}}
        onSkipExercise={onSkipExercise}
      />,
    );
    await userEvent.click(screen.getByText("Passer l'exercice"));
    expect(onSkipExercise).toHaveBeenCalledOnce();
  });
});
