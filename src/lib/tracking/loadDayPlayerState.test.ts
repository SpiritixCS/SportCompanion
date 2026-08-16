import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, completeSeance, logSetForExercise } from "./db";
import { loadDayPlayerState } from "./loadDayPlayerState";
import type { TrainDay } from "@/lib/workout/types";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-day-player-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

const DAY: TrainDay = {
  kind: "train",
  label: "Lundi",
  exercises: [
    {
      id: "day-0-0",
      name: "Développé couché",
      movementFamily: "other",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 8, maxEffort: false, eachSide: false },
    },
  ],
};

describe("loadDayPlayerState", () => {
  it("starts a fresh seance in-progress at the first set when nothing is active", () => {
    const db = setup();
    const state = loadDayPlayerState(db, 0, DAY);
    expect(state.phase).toBe("in-progress");
    if (state.phase === "in-progress") {
      expect(state.next).toEqual({ exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: true });
    }
  });

  it("reaches pending-validation once every set is logged", () => {
    const db = setup();
    const seance = startSeance(db, 0);
    logSetForExercise(db, seance.id, "Développé couché", "reps", 8, 2, 0);
    expect(loadDayPlayerState(db, 0, DAY).phase).toBe("pending-validation");
  });

  it("starts a fresh seance once the previous one is validated (a day stays redoable)", () => {
    const db = setup();
    const seance = startSeance(db, 0);
    completeSeance(db, seance.id);

    const state = loadDayPlayerState(db, 0, DAY);
    expect(state.phase).toBe("in-progress");
    if (state.phase === "in-progress") {
      expect(state.seanceId).not.toBe(seance.id);
      expect(state.next).toEqual({ exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: true });
    }
  });

  it("stays playable across repeated complete/replay cycles", () => {
    const db = setup();

    const first = startSeance(db, 0);
    logSetForExercise(db, first.id, "Développé couché", "reps", 8, 2, 0);
    completeSeance(db, first.id);

    const second = loadDayPlayerState(db, 0, DAY);
    expect(second.phase).toBe("in-progress");
    expect(second.seanceId).not.toBe(first.id);

    logSetForExercise(db, second.seanceId, "Développé couché", "reps", 8, 2, 0);
    completeSeance(db, second.seanceId);

    const third = loadDayPlayerState(db, 0, DAY);
    expect(third.phase).toBe("in-progress");
    expect(third.seanceId).not.toBe(first.id);
    expect(third.seanceId).not.toBe(second.seanceId);
  });

  it("flags wrong-seance when the active seance belongs to a different day", () => {
    const db = setup();
    startSeance(db, 1);
    expect(loadDayPlayerState(db, 0, DAY).phase).toBe("wrong-seance");
  });

  it("flags wrong-seance when the active seance has no day (legacy freeform)", () => {
    const db = setup();
    startSeance(db, null);
    expect(loadDayPlayerState(db, 0, DAY).phase).toBe("wrong-seance");
  });
});
