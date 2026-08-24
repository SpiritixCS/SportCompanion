import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { loadProgrammeState } from "./loadProgrammeState";
import { startSeance, completeSeance } from "@/lib/player/db";
import type { ParcoursMeta } from "./parcours";
import type { Program } from "@/lib/workout/types";

const FAKE_PROGRAM: Program = [
  [
    { kind: "train", label: "Day 1", exercises: [{ id: "push-ups", name: "Push ups", movementFamily: "push", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: 12, maxEffort: false, eachSide: false } }] },
    { kind: "rest" },
    { kind: "train", label: "Day 3", exercises: [{ id: "squats", name: "Squats", movementFamily: "legs", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: 15, maxEffort: false, eachSide: false } }] },
    { kind: "rest" },
    { kind: "train", label: "Day 5", exercises: [] },
    { kind: "rest" },
    { kind: "rest" },
  ],
];

const PARCOURS_META: ParcoursMeta = { id: "beginner", label: "Débutant", program: FAKE_PROGRAM, levelCount: 1 };

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-programme-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadProgrammeState", () => {
  it("marks rest days as restOrWalk and unvalidated training days as upcoming", () => {
    const db = setup();
    const [level0] = loadProgrammeState(db, PARCOURS_META);
    expect(level0!.pastilles).toEqual(["upcoming", "restOrWalk", "upcoming", "restOrWalk", "upcoming", "restOrWalk", "restOrWalk"]);
    expect(level0!.percentDone).toBe(0);
  });

  it("computes percentDone over training days only, not all 7", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    completeSeance(db, seance.id);
    const [level0] = loadProgrammeState(db, PARCOURS_META);
    // 1 of 3 training days (0, 2, 4) validated → 33%, not 1/7.
    expect(level0!.percentDone).toBe(33);
    expect(level0!.pastilles[0]).toBe("done");
  });

  it("reaches 100% once every training day is validated, rest days notwithstanding", () => {
    const db = setup();
    for (const dayIndex of [0, 2, 4]) {
      const seance = startSeance(db, "beginner", 0, dayIndex);
      completeSeance(db, seance.id);
    }
    const [level0] = loadProgrammeState(db, PARCOURS_META);
    expect(level0!.percentDone).toBe(100);
  });

  it("only counts the latest cycle — redoing a level clears the grid back to upcoming", () => {
    const db = setup();
    for (const dayIndex of [0, 2, 4]) {
      const seance = startSeance(db, "beginner", 0, dayIndex, 0);
      completeSeance(db, seance.id);
    }
    // Redo: day 0 validated again in cycle 1, days 2 and 4 not yet.
    const redoSeance = startSeance(db, "beginner", 0, 0, 1);
    completeSeance(db, redoSeance.id);

    const [level0] = loadProgrammeState(db, PARCOURS_META);
    expect(level0!.pastilles[0]).toBe("done");
    expect(level0!.pastilles[2]).toBe("upcoming");
    expect(level0!.pastilles[4]).toBe("upcoming");
    expect(level0!.percentDone).toBe(33);
  });

  it("lists all 7 days with title, exercise count, and duration estimate", () => {
    const db = setup();
    const [level0] = loadProgrammeState(db, PARCOURS_META);
    expect(level0!.days[0]).toEqual({
      dayIndex: 0, title: "Jour 1", exerciseCount: 1, durationEstimateMinutes: 22, pastilleState: "upcoming",
    });
    expect(level0!.days[1]).toEqual({
      dayIndex: 1, title: "Jour 2", exerciseCount: 0, durationEstimateMinutes: 18, pastilleState: "restOrWalk",
    });
  });
});
