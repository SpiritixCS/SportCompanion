import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { loadTodayState } from "./loadTodayState";
import { setCurrentPosition } from "./db";
import { startSeance, completeSeance, logSet, skipExercise } from "@/lib/player/db";
import type { ParcoursMeta } from "./parcours";
import type { Program } from "@/lib/workout/types";

const FAKE_PROGRAM: Program = [
  [
    {
      kind: "train",
      label: "Day 1",
      exercises: [
        { id: "push-ups", name: "Push ups", movementFamily: "push", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: 12, maxEffort: false, eachSide: false } },
        { id: "squats", name: "Squats", movementFamily: "legs", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: 15, maxEffort: false, eachSide: false } },
        { id: "dips", name: "Dips", movementFamily: "dip", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
        { id: "lunges", name: "Lunges", movementFamily: "legs", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
      ],
    },
    { kind: "rest" },
    {
      kind: "train",
      label: "Day 3",
      exercises: [
        { id: "pull-ups", name: "Pull ups", movementFamily: "pull", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: 8, maxEffort: false, eachSide: false } },
      ],
    },
    { kind: "rest" },
    {
      kind: "train",
      label: "Day 5",
      exercises: [
        { id: "plank", name: "Plank", movementFamily: "core", countsInStats: true, videoId: null, sets: 3, target: { unit: "seconds", value: [20, 40], maxEffort: false, eachSide: false } },
      ],
    },
    { kind: "rest" },
    { kind: "rest" },
  ],
];

const FAKE_PROGRAM_TRAIN_ON_LAST_DAY: Program = [
  [
    { kind: "rest" },
    { kind: "rest" },
    { kind: "rest" },
    { kind: "rest" },
    { kind: "rest" },
    { kind: "rest" },
    {
      kind: "train",
      label: "Day 7",
      exercises: [
        { id: "burpees", name: "Burpees", movementFamily: "full", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
      ],
    },
  ],
];

const ALL_PARCOURS: ParcoursMeta[] = [
  { id: "beginner", label: "Débutant", program: FAKE_PROGRAM, levelCount: 1 },
  { id: "train-on-last-day", label: "Train J7", program: FAKE_PROGRAM_TRAIN_ON_LAST_DAY, levelCount: 1 },
];

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-today-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadTodayState", () => {
  it("reports empty when no position has ever been set", () => {
    const db = setup();
    expect(loadTodayState(db, ALL_PARCOURS)).toEqual({ phase: "empty" });
  });

  it("reports normal with the full exercise list and duration estimate for an unvalidated day", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 0);
    const state = loadTodayState(db, ALL_PARCOURS);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.parcoursLabel).toBe("Débutant");
    expect(state.dayTitle).toBe("Jour 1");
    expect(state.totalExercises).toBe(4);
    expect(state.exercises).toEqual([
      { name: "Push ups", dose: "3 × 12" },
      { name: "Squats", dose: "3 × 15" },
      { name: "Dips", dose: "3 × 10" },
      { name: "Lunges", dose: "3 × 10" },
    ]);
    expect(state.durationEstimateMinutes).toBe(18 + 4 * 4);
    expect(state.done).toBe(false);
    expect(state.resume).toBeNull();
  });

  it("marks rest days with the restOrWalk pastille state in the 7-day row", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 0);
    const state = loadTodayState(db, ALL_PARCOURS);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.pastilles).toEqual([
      "today", "restOrWalk", "upcoming", "restOrWalk", "upcoming", "restOrWalk", "restOrWalk",
    ]);
  });

  it("reflects a validated earlier day as done in the pastille row after syncing forward", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 0);
    const seance = startSeance(db, "beginner", 0, 0);
    completeSeance(db, seance.id);

    const state = loadTodayState(db, ALL_PARCOURS);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.dayIndex).toBe(2); // synced past day 0 (done) and day 1 (rest)
    expect(state.pastilles[0]).toBe("done");
    expect(state.pastilles[1]).toBe("restOrWalk");
    expect(state.pastilles[2]).toBe("today");
  });

  it("surfaces a resume when an active seance exists for the current position", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 0);
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 0, setNumber: 1, repsTarget: "12", repsActual: 12, restSeconds: 90 });

    const state = loadTodayState(db, ALL_PARCOURS);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.resume).toEqual({ exerciseName: "Push ups" });
  });

  it("skips a wholesale-skipped exercise when computing the resume label", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 0);
    const seance = startSeance(db, "beginner", 0, 0);
    skipExercise(db, seance.id, 0);

    const state = loadTodayState(db, ALL_PARCOURS);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.resume).toEqual({ exerciseName: "Squats" });
  });

  it("reports level-up once the position reaches the terminal rest day", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 6);
    expect(loadTodayState(db, ALL_PARCOURS)).toEqual({
      phase: "level-up",
      parcours: "beginner",
      parcoursLabel: "Débutant",
      level: 0,
    });
  });

  it("serves the day-7 workout instead of level-up when the last slot is a train day not yet validated", () => {
    const db = setup();
    setCurrentPosition(db, "train-on-last-day", 0, 6);
    const state = loadTodayState(db, ALL_PARCOURS);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.dayTitle).toBe("Jour 7");
    expect(state.exercises).toEqual([{ name: "Burpees", dose: "3 × 10" }]);
    expect(state.done).toBe(false);
  });

  it("reports level-up only once the day-7 train day has been validated", () => {
    const db = setup();
    setCurrentPosition(db, "train-on-last-day", 0, 6);
    const seance = startSeance(db, "train-on-last-day", 0, 6);
    completeSeance(db, seance.id);

    expect(loadTodayState(db, ALL_PARCOURS)).toEqual({
      phase: "level-up",
      parcours: "train-on-last-day",
      parcoursLabel: "Train J7",
      level: 0,
    });
  });

  it("serves day 1 again after 'Refaire ce niveau' opens a new cycle, instead of bouncing back to level-up", () => {
    const db = setup();
    // Full first pass through the level (cycle 0), landing on level-up — mirrors
    // what resolveLevelUpAction("redo", ...) does: same level, day 0, cycle + 1.
    for (const dayIndex of [0, 2, 4]) {
      const seance = startSeance(db, "beginner", 0, dayIndex, 0);
      completeSeance(db, seance.id);
    }
    setCurrentPosition(db, "beginner", 0, 0, 1);

    const state = loadTodayState(db, ALL_PARCOURS);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.dayIndex).toBe(0);
    expect(state.done).toBe(false);
    expect(state.pastilles).toEqual([
      "today", "restOrWalk", "upcoming", "restOrWalk", "upcoming", "restOrWalk", "restOrWalk",
    ]);
  });
});
