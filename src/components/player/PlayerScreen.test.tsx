import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerScreen } from "./PlayerScreen";
import type { TrainDay } from "@/lib/workout/types";
import type { PlayerState } from "@/lib/player/loadPlayerState";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

const onLogSet = vi.fn().mockResolvedValue(undefined);
const onSkipExercise = vi.fn().mockResolvedValue(undefined);
const onSeanceFinish = vi.fn().mockResolvedValue(undefined);

const DAY: TrainDay = {
  kind: "train",
  label: "Day 1",
  exercises: [
    { id: "push-ups", name: "Push ups", movementFamily: "push", countsInStats: true, videoId: null, sets: 1, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
    { id: "squats", name: "Squats", movementFamily: "legs", countsInStats: true, videoId: null, sets: 1, target: { unit: "reps", value: 15, maxEffort: false, eachSide: false } },
  ],
};

const STARTED_AT = new Date(Date.now() - 65_000).toISOString();

function actionProps() {
  return { onLogSet, onSkipExercise, onSeanceFinish };
}

beforeEach(() => {
  refresh.mockClear();
  push.mockClear();
  onLogSet.mockClear();
  onSkipExercise.mockClear();
  onSeanceFinish.mockClear();
});

describe("PlayerScreen", () => {
  it("renders ExerciseView for an in-progress state, chronometer anchored on startedAt", () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);
    expect(screen.getByText("Push ups")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
  });

  it("logs the set then shows RestView with the default betweenExercises duration when it was the last set", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);

    await userEvent.click(screen.getByRole("button", { name: "Série terminée" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(onLogSet).toHaveBeenCalledWith(
      expect.objectContaining({ seanceId: 1, exerciseOrder: 0, exerciseId: "push-ups", setNumber: 1, repsActual: 10, restSeconds: 120 }),
    );
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText(/Squats/)).toBeInTheDocument();
  });

  it("uses custom rest durations when provided", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(
      <PlayerScreen
        day={DAY}
        state={state}
        setsLogged={[]}
        {...actionProps()}
        restBetweenSetsSeconds={60}
        restBetweenExercisesSeconds={60}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Série terminée" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(onLogSet).toHaveBeenCalledWith(expect.objectContaining({ restSeconds: 60 }));
    expect(screen.getByText("60")).toBeInTheDocument();
  });

  it("skips the exercise and refreshes", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);

    await userEvent.click(screen.getByText("Passer l'exercice"));

    expect(onSkipExercise).toHaveBeenCalledWith(1, 0);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("opens the quit sheet and navigates home on confirm", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);

    await userEvent.click(screen.getByRole("button", { name: "Quitter la séance" }));
    expect(screen.getByText("Quitter la séance ?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Quitter et reprendre plus tard" }));
    expect(push).toHaveBeenCalledWith("/");
  });

  it("closing the quit sheet via Continuer la séance keeps the player open", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);

    await userEvent.click(screen.getByRole("button", { name: "Quitter la séance" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuer la séance" }));

    expect(screen.queryByText("Quitter la séance ?")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("renders SummaryView for pending-validation and calls onSeanceFinish on Terminer", async () => {
    const state: PlayerState = { phase: "pending-validation", seanceId: 1, startedAt: STARTED_AT };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);

    await userEvent.click(screen.getByRole("button", { name: "Terminer" }));

    expect(onSeanceFinish).toHaveBeenCalledWith(1);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows a simple message for an already-completed seance", () => {
    const state: PlayerState = { phase: "completed", seanceId: 1 };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);
    expect(screen.getByText("Séance déjà validée.")).toBeInTheDocument();
  });

  it("requests a wake lock by default, and not at all when keepScreenAwakeEnabled=false", async () => {
    const requestMock = vi
      .fn()
      .mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn() });
    Object.defineProperty(navigator, "wakeLock", { value: { request: requestMock }, configurable: true });

    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    const { unmount } = render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalledWith("screen"));
    unmount();

    requestMock.mockClear();
    render(
      <PlayerScreen day={DAY} state={state} setsLogged={[]} keepScreenAwakeEnabled={false} {...actionProps()} />,
    );
    expect(requestMock).not.toHaveBeenCalled();

    // @ts-expect-error test-only cleanup of a property this test adds
    delete navigator.wakeLock;
  });
});
