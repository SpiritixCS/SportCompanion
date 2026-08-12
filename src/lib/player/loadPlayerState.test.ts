import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { loadPlayerState } from "./loadPlayerState";
import { logSet, skipExercise } from "./db";
import type { TrainDay } from "@/lib/workout/types";

const DAY: TrainDay = {
  kind: "train",
  label: "Day 1",
  exercises: [
    {
      id: "push-ups",
      name: "Push ups",
      movementFamily: "push",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 10, maxEffort: false, eachSide: false },
    },
    {
      id: "squats",
      name: "Squats",
      movementFamily: "legs",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 15, maxEffort: false, eachSide: false },
    },
  ],
};

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-player-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadPlayerState — reload resilience (CLAUDE.md §2 lesson)", () => {
  it("reflects a logged set on a fresh call, reusing the same seance, with no in-memory carryover", () => {
    const db = setup();

    const first = loadPlayerState(db, "beginner", 0, 0, DAY);
    expect(first.phase).toBe("in-progress");
    if (first.phase !== "in-progress") throw new Error("unreachable");
    expect(typeof first.startedAt).toBe("string");
    expect(first.next).toEqual({
      exerciseOrder: 0,
      setNumber: 1,
      isLastSetOfExercise: false,
      isLastExerciseOfDay: false,
    });

    // Simulate exactly what a Server Action does: write directly to the
    // DB. Nothing here shares memory with the `first` call above.
    logSet(db, {
      seanceId: first.seanceId,
      exerciseOrder: 0,
      setNumber: 1,
      repsTarget: "10",
      repsActual: 10,
      restSeconds: 90,
    });

    // Simulate "navigate away and come back": a brand new call, as if it
    // were a fresh HTTP request hitting a fresh Server Component render.
    const second = loadPlayerState(db, "beginner", 0, 0, DAY);
    expect(second.phase).toBe("in-progress");
    if (second.phase !== "in-progress") throw new Error("unreachable");
    expect(second.next).toEqual({
      exerciseOrder: 0,
      setNumber: 2,
      isLastSetOfExercise: true,
      isLastExerciseOfDay: false,
    });
    expect(second.seanceId).toBe(first.seanceId);
    expect(second.startedAt).toBe(first.startedAt);
  });

  it("shows pending-validation once every set is logged, without requiring completeSeance", () => {
    const db = setup();
    const state = loadPlayerState(db, "beginner", 0, 0, DAY);
    if (state.phase !== "in-progress") throw new Error("unreachable");

    for (const [exerciseOrder, setNumber] of [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ] as const) {
      logSet(db, {
        seanceId: state.seanceId,
        exerciseOrder,
        setNumber,
        repsTarget: "10",
        repsActual: 10,
        restSeconds: 90,
      });
    }

    const after = loadPlayerState(db, "beginner", 0, 0, DAY);
    expect(after.phase).toBe("pending-validation");
  });

  it("respects a skipped exercise on reload — resumes past it, not inside it", () => {
    const db = setup();
    const state = loadPlayerState(db, "beginner", 0, 0, DAY);
    if (state.phase !== "in-progress") throw new Error("unreachable");

    skipExercise(db, state.seanceId, 0);

    const after = loadPlayerState(db, "beginner", 0, 0, DAY);
    expect(after.phase).toBe("in-progress");
    if (after.phase !== "in-progress") throw new Error("unreachable");
    expect(after.next.exerciseOrder).toBe(1);
    expect(after.skippedExerciseOrders).toEqual([0]);
  });
});
