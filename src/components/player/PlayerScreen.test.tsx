import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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
const onResume = vi.fn().mockResolvedValue(undefined);
const onDiscard = vi.fn().mockResolvedValue(undefined);

const DAY: TrainDay = {
  kind: "train",
  label: "Day 1",
  exercises: [
    { id: "push-ups", name: "Push ups", movementFamily: "push", countsInStats: true, videoId: null, sets: 1, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
    { id: "squats", name: "Squats", movementFamily: "legs", countsInStats: true, videoId: null, sets: 1, target: { unit: "reps", value: 15, maxEffort: false, eachSide: false } },
  ],
};

const STARTED_AT = new Date(Date.now() - 65_000).toISOString();

const HOUR = 3600_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

function loggedSet(completedAt: string) {
  return { id: 1, seanceId: 1, exerciseOrder: 0, setNumber: 1, repsTarget: "10", repsActual: 10, restSeconds: 90, completedAt };
}

function actionProps() {
  return { onLogSet, onSkipExercise, onSeanceFinish, onResume, onDiscard };
}

beforeEach(() => {
  refresh.mockClear();
  push.mockClear();
  onLogSet.mockClear();
  onSkipExercise.mockClear();
  onSeanceFinish.mockClear();
  onResume.mockClear();
  onDiscard.mockClear();
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
    render(<PlayerScreen day={DAY} state={state} setsLogged={[loggedSet(iso(30_000))]} {...actionProps()} />);

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
    // Retour à Aujourd'hui : recharger le player relançait aussitôt une séance
    // vide sur le cycle suivant (séances orphelines vues en prod).
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).not.toHaveBeenCalled();
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

function inProgress(overrides: Partial<Extract<PlayerState, { phase: "in-progress" }>> = {}): PlayerState {
  return {
    phase: "in-progress",
    seanceId: 1,
    startedAt: STARTED_AT,
    resumedAt: null,
    next: { exerciseOrder: 1, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: true },
    skippedExerciseOrders: [],
    ...overrides,
  };
}

describe("PlayerScreen — séance interrompue", () => {
  it("excludes a gap longer than one hour from the chronometer", () => {
    // début il y a 25 h, une série 2 min après, rien depuis → 2:00
    render(
      <PlayerScreen day={DAY} state={inProgress({ startedAt: iso(25 * HOUR) })} setsLogged={[loggedSet(iso(25 * HOUR - 120_000))]} {...actionProps()} />,
    );
    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  it("shows the pause sheet on open when the last event is more than an hour old", () => {
    render(<PlayerScreen day={DAY} state={inProgress({ startedAt: iso(25 * HOUR) })} setsLogged={[loggedSet(iso(25 * HOUR))]} {...actionProps()} />);
    expect(screen.getByText("Séance en pause depuis longtemps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reprendre" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminer avec ce qui est fait" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Effacer la séance" })).toBeInTheDocument();
  });

  it("does not show the pause sheet when a recent resume is stored (reload after Reprendre)", () => {
    render(
      <PlayerScreen day={DAY} state={inProgress({ startedAt: iso(25 * HOUR), resumedAt: iso(60_000) })} setsLogged={[loggedSet(iso(25 * HOUR))]} {...actionProps()} />,
    );
    expect(screen.queryByText("Séance en pause depuis longtemps")).not.toBeInTheDocument();
  });

  it("Reprendre calls onResume and closes the sheet", async () => {
    render(<PlayerScreen day={DAY} state={inProgress({ startedAt: iso(25 * HOUR) })} setsLogged={[loggedSet(iso(25 * HOUR))]} {...actionProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Reprendre" }));
    expect(onResume).toHaveBeenCalledWith(1);
    expect(screen.queryByText("Séance en pause depuis longtemps")).not.toBeInTheDocument();
  });

  it("shows the pause sheet when the tab becomes visible again after an hour", () => {
    const realNow = Date.now();
    render(<PlayerScreen day={DAY} state={inProgress({ startedAt: iso(60_000) })} setsLogged={[]} {...actionProps()} />);
    expect(screen.queryByText("Séance en pause depuis longtemps")).not.toBeInTheDocument();

    const spy = vi.spyOn(Date, "now").mockReturnValue(realNow + 2 * HOUR);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByText("Séance en pause depuis longtemps")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("Effacer asks for confirmation, then discards and goes home", async () => {
    render(<PlayerScreen day={DAY} state={inProgress({ startedAt: iso(25 * HOUR) })} setsLogged={[loggedSet(iso(25 * HOUR))]} {...actionProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Effacer la séance" }));
    expect(screen.getByText("Effacer 1 série ? Elle sort des Trophées.")).toBeInTheDocument();
    expect(onDiscard).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Effacer" }));
    expect(onDiscard).toHaveBeenCalledWith(1);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("quit sheet offers Terminer avec ce qui est fait when at least one set is logged, leading to the summary", async () => {
    render(<PlayerScreen day={DAY} state={inProgress()} setsLogged={[loggedSet(iso(30_000))]} {...actionProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Quitter la séance" }));
    await userEvent.click(screen.getByRole("button", { name: "Terminer avec ce qui est fait" }));
    expect(screen.getByText("Séance terminée")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(onSeanceFinish).toHaveBeenCalledWith(1);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("quit sheet with no set logged offers Abandonner instead, which discards", async () => {
    render(<PlayerScreen day={DAY} state={inProgress({ next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false } })} setsLogged={[]} {...actionProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Quitter la séance" }));
    expect(screen.queryByRole("button", { name: "Terminer avec ce qui est fait" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitter et reprendre plus tard" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Abandonner" }));
    expect(onDiscard).toHaveBeenCalledWith(1);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("pending-validation opened the next day shows the summary without the pause sheet", () => {
    render(
      <PlayerScreen day={DAY} state={{ phase: "pending-validation", seanceId: 1, startedAt: iso(25 * HOUR), resumedAt: null }} setsLogged={[loggedSet(iso(25 * HOUR - 120_000))]} {...actionProps()} />,
    );
    expect(screen.getByText("Séance terminée")).toBeInTheDocument();
    expect(screen.queryByText("Séance en pause depuis longtemps")).not.toBeInTheDocument();
  });
});
