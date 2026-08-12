import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SummaryView } from "./SummaryView";
import type { Exercise } from "@/lib/workout/types";
import type { SetLoggedRecord } from "@/lib/player/db";

const EXERCISES: Exercise[] = [
  { id: "push-ups", name: "Push ups", movementFamily: "push", countsInStats: true, videoId: null, sets: 4, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
  { id: "squats", name: "Squats", movementFamily: "legs", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: 15, maxEffort: false, eachSide: false } },
];

function set(overrides: Partial<SetLoggedRecord>): SetLoggedRecord {
  return {
    id: 1,
    seanceId: 1,
    exerciseOrder: 0,
    setNumber: 1,
    repsTarget: "10",
    repsActual: 10,
    restSeconds: 90,
    completedAt: "2026-08-12T10:00:00.000Z",
    ...overrides,
  };
}

describe("SummaryView", () => {
  it("shows duration in minutes, exercise count, and total reps", () => {
    const setsLogged = [
      set({ exerciseOrder: 0, setNumber: 1, repsActual: 10 }),
      set({ exerciseOrder: 0, setNumber: 2, repsActual: 10 }),
      set({ exerciseOrder: 1, setNumber: 1, repsActual: 15 }),
    ];
    render(
      <SummaryView exercises={EXERCISES} setsLogged={setsLogged} durationSeconds={600} onFinish={() => {}} />,
    );
    expect(screen.getByText("10")).toBeInTheDocument(); // minutes
    expect(screen.getByText("2")).toBeInTheDocument(); // exercices
    expect(screen.getByText("35")).toBeInTheDocument(); // reps
  });

  it("lists only exercises with at least one logged set, each with its summed reps", () => {
    const setsLogged = [set({ exerciseOrder: 1, setNumber: 1, repsActual: 15 })];
    render(
      <SummaryView exercises={EXERCISES} setsLogged={setsLogged} durationSeconds={300} onFinish={() => {}} />,
    );
    expect(screen.queryByText("Push ups")).not.toBeInTheDocument();
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("+15 reps")).toBeInTheDocument();
  });

  it("calls onFinish when Terminer is clicked", async () => {
    const onFinish = vi.fn();
    render(
      <SummaryView exercises={EXERCISES} setsLogged={[]} durationSeconds={0} onFinish={onFinish} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
