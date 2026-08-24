import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { syncPosition, type DayKindLookup } from "./syncPosition";
import { setCurrentPosition } from "./db";
import { startSeance, completeSeance } from "@/lib/player/db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-sync-position-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

// train/rest/train/rest/train/rest/rest — mirrors the real curated data's
// weekly shape (rest days aren't only at the end, see plan Global Constraints).
const KIND_PATTERN: ("train" | "rest")[] = ["train", "rest", "train", "rest", "train", "rest", "rest"];
const getDayKind: DayKindLookup = (_parcours, _level, dayIndex) => KIND_PATTERN[dayIndex];

function validate(db: ReturnType<typeof getDb>, parcours: string, level: number, dayIndex: number, cycle = 0) {
  const seance = startSeance(db, parcours, level, dayIndex, cycle);
  completeSeance(db, seance.id);
}

describe("syncPosition", () => {
  it("returns null when no position is set", () => {
    const db = setup();
    expect(syncPosition(db, getDayKind)).toBeNull();
  });

  it("does not move a position sitting on an unvalidated training day", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 0);
    const result = syncPosition(db, getDayKind);
    expect(result).toMatchObject({ parcours: "beginner", level: 0, dayIndex: 0 });
  });

  it("advances past a validated training day to the next day", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 0);
    validate(db, "beginner", 0, 0);
    const result = syncPosition(db, getDayKind);
    expect(result).toMatchObject({ dayIndex: 2 });
  });

  it("skips a rest day even though nothing was validated for it", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 0);
    validate(db, "beginner", 0, 0); // day 0 (train) done
    // day 1 is rest — syncPosition should walk through it without requiring
    // a validated seance, landing on day 2 (train, unvalidated).
    const result = syncPosition(db, getDayKind);
    expect(result).toMatchObject({ dayIndex: 2 });
  });

  it("chains multiple rest/validated days in one call (catch-up)", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 0);
    validate(db, "beginner", 0, 0); // train, done
    // day 1 rest, day 2 train (not validated) — should stop at day 2.
    validate(db, "beginner", 0, 2); // now also validate day 2
    // day 3 rest, day 4 train (not validated) — should stop at day 4.
    const result = syncPosition(db, getDayKind);
    expect(result).toMatchObject({ dayIndex: 4 });
  });

  it("stops at the last day of the level (day 6) without requiring it to be validated", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 5); // day 5 = rest per pattern
    const result = syncPosition(db, getDayKind);
    // day 5 is rest, would normally skip to day 6 — but day 6 is the last
    // index, the loop must not advance past it.
    expect(result).toMatchObject({ dayIndex: 6 });
  });

  it("preserves the cycle while advancing across days", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 0, 2);
    validate(db, "beginner", 0, 0, 2);
    const result = syncPosition(db, getDayKind);
    expect(result).toMatchObject({ dayIndex: 2, cycle: 2 });
  });

  it("does not treat a day validated in a different cycle as skippable (redo doesn't get instantly re-skipped)", () => {
    const db = setup();
    validate(db, "beginner", 0, 0, 0); // cycle 0's day 0 already done
    setCurrentPosition(db, "beginner", 0, 0, 1); // now on a fresh cycle 1
    const result = syncPosition(db, getDayKind);
    expect(result).toMatchObject({ dayIndex: 0, cycle: 1 });
  });
});
