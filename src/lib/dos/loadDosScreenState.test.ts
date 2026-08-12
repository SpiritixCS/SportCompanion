import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { loadDosScreenState } from "./loadDosScreenState";
import { setStartDate } from "@/lib/backpain/db";
import { getOrStartDosSeance, completeDosSeance } from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  vi.useRealTimers();
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-dos-screen-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadDosScreenState", () => {
  it("reports no-start-date before setup", () => {
    const db = setup();
    expect(loadDosScreenState(db)).toEqual({ phase: "no-start-date" });
  });

  it("reports semaine/bloc and all 10 arbres at cran 1 with no history", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T09:00:00.000Z"));
    const state = loadDosScreenState(db);
    if (state.phase !== "ready") throw new Error("unreachable");
    expect(state.semaine).toBe(1);
    expect(state.bloc).toBe(1);
    expect(state.arbresProgress).toHaveLength(10);
    expect(state.arbresProgress.every((a) => a.cranCourant === 1)).toBe(true);
  });

  it("marks dimanche restOrWalk and today's date as today in the week pastille row", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T09:00:00.000Z")); // Wednesday
    const state = loadDosScreenState(db);
    if (state.phase !== "ready") throw new Error("unreachable");
    expect(state.weekPastilles[6]).toBe("restOrWalk"); // dimanche
    expect(state.weekPastilles[2]).toBe("today"); // mercredi
    expect(state.weekPastilles[0]).toBe("upcoming"); // lundi, not yet done
  });

  it("marks a completed day as done in the week pastille row", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T09:00:00.000Z")); // Monday
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    completeDosSeance(db, seance.id, 0);
    const state = loadDosScreenState(db);
    if (state.phase !== "ready") throw new Error("unreachable");
    expect(state.weekPastilles[0]).toBe("done");
  });
});
