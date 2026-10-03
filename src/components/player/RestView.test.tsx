import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RestView } from "./RestView";
import type { Exercise } from "@/lib/workout/types";

const PUSH_UPS: Exercise = {
  id: "push-ups", name: "Push ups", movementFamily: "push", countsInStats: true, videoId: null, sets: 4,
  target: { unit: "reps", value: 6, maxEffort: false, eachSide: false },
};

const PROGRESS = { exerciseIndex: 1, totalExercises: 5, setNumber: 2, totalSets: 4 };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RestView", () => {
  it("counts down from the given duration and shows the next label", () => {
    render(
      <RestView durationSeconds={90} nextLabel="Push ups" variant="betweenSets" {...PROGRESS} onComplete={() => {}} />,
    );
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText(/Push ups/)).toBeInTheDocument();
  });

  it("calls onComplete once the countdown reaches 0", () => {
    const onComplete = vi.fn();
    render(
      <RestView durationSeconds={2} nextLabel="Push ups" variant="betweenSets" {...PROGRESS} onComplete={onComplete} />,
    );
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("+15 s extends the countdown without completing", () => {
    const onComplete = vi.fn();
    render(
      <RestView durationSeconds={5} nextLabel="Push ups" variant="betweenSets" {...PROGRESS} onComplete={onComplete} />,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      screen.getByRole("button", { name: "+15 s" }).click();
    });
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("Passer le repos completes immediately", async () => {
    vi.useRealTimers();
    const onComplete = vi.fn();
    render(
      <RestView durationSeconds={90} nextLabel="Push ups" variant="betweenSets" {...PROGRESS} onComplete={onComplete} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Passer le repos" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shows 'Exercice suivant' only for the betweenExercises variant", () => {
    const { rerender } = render(
      <RestView durationSeconds={90} nextLabel="Squats" variant="betweenSets" {...PROGRESS} onComplete={() => {}} />,
    );
    expect(screen.queryByText("Exercice suivant")).not.toBeInTheDocument();
    expect(screen.getByText("Repos entre séries")).toBeInTheDocument();

    rerender(
      <RestView durationSeconds={120} nextLabel="Squats" variant="betweenExercises" {...PROGRESS} onComplete={() => {}} />,
    );
    expect(screen.getByText("Exercice suivant")).toBeInTheDocument();
  });

  it("shows exercise/set progress for the betweenSets variant", () => {
    render(
      <RestView durationSeconds={90} nextLabel="Squats" variant="betweenSets" {...PROGRESS} onComplete={() => {}} />,
    );
    expect(screen.getByText("Exercice 2 / 5 · Série 2 / 4")).toBeInTheDocument();
  });

  it("shows the exercise as done for the betweenExercises variant", () => {
    render(
      <RestView durationSeconds={90} nextLabel="Squats" variant="betweenExercises" {...PROGRESS} onComplete={() => {}} />,
    );
    expect(screen.getByText("Exercice 2 / 5 terminé")).toBeInTheDocument();
  });

  it("is a dark full screen with an Ensuite card for the next set", () => {
    render(
      <RestView durationSeconds={90} nextLabel="Push ups" next={{ exercise: PUSH_UPS, setNumber: 3 }} variant="betweenSets" {...PROGRESS} onComplete={() => {}} />,
    );
    expect(screen.getByTestId("rest-screen")).toHaveClass("bg-ink");
    expect(screen.getByText("Ensuite")).toBeInTheDocument();
    expect(screen.getByText("Série 3 / 4 · 6 reps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Passer le repos" })).toHaveTextContent("Passer");
  });

  it("beats during the last 3 seconds only", () => {
    render(<RestView durationSeconds={5} nextLabel="Push ups" variant="betweenSets" {...PROGRESS} onComplete={() => {}} />);
    expect(screen.getByText("5")).not.toHaveClass("beat");
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByText("3")).toHaveClass("beat");
  });
});
