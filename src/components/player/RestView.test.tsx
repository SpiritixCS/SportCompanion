import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RestView } from "./RestView";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RestView", () => {
  it("counts down from the given duration and shows the next label", () => {
    render(
      <RestView durationSeconds={90} nextLabel="Push ups" variant="betweenSets" onComplete={() => {}} />,
    );
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText(/Push ups/)).toBeInTheDocument();
  });

  it("calls onComplete once the countdown reaches 0", () => {
    const onComplete = vi.fn();
    render(
      <RestView durationSeconds={2} nextLabel="Push ups" variant="betweenSets" onComplete={onComplete} />,
    );
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("+15s extends the countdown without completing", () => {
    const onComplete = vi.fn();
    render(
      <RestView durationSeconds={5} nextLabel="Push ups" variant="betweenSets" onComplete={onComplete} />,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      screen.getByRole("button", { name: "+15s" }).click();
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
      <RestView durationSeconds={90} nextLabel="Push ups" variant="betweenSets" onComplete={onComplete} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Passer le repos" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shows 'Exercice suivant' only for the betweenExercises variant", () => {
    const { rerender } = render(
      <RestView durationSeconds={90} nextLabel="Squats" variant="betweenSets" onComplete={() => {}} />,
    );
    expect(screen.queryByText("Exercice suivant")).not.toBeInTheDocument();

    rerender(
      <RestView durationSeconds={120} nextLabel="Squats" variant="betweenExercises" onComplete={() => {}} />,
    );
    expect(screen.getByText("Exercice suivant")).toBeInTheDocument();
  });
});
