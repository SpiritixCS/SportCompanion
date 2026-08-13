import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { setStartDate } from "@/lib/backpain/db";
import { getSettings } from "./db";

let tmpDir: string;
let dbPath: string;

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-settings-actions-"));
  dbPath = path.join(tmpDir, "test.db");
  runMigrations(getDb(dbPath), path.join(process.cwd(), "migrations"));
  process.env.DB_PATH = dbPath;
});

afterAll(() => {
  delete process.env.DB_PATH;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("getReglagesStateAction", () => {
  it("bundles settings defaults, a null dos start date, and the app version", async () => {
    const { getReglagesStateAction } = await import("./actions");
    const state = await getReglagesStateAction();
    expect(state.restBetweenSetsSeconds).toBe(90);
    expect(state.dosStartDate).toBeNull();
    expect(state.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("reflects a dos start date once one is set", async () => {
    setStartDate(getDb(dbPath), "2026-08-10");
    const { getReglagesStateAction } = await import("./actions");
    const state = await getReglagesStateAction();
    expect(state.dosStartDate).toBe("2026-08-10");
  });
});

describe("updateSettingsAction", () => {
  it("writes the patch and returns the updated settings", async () => {
    const { updateSettingsAction } = await import("./actions");
    const result = await updateSettingsAction({ restBetweenExercisesSeconds: 75 });
    expect(result.restBetweenExercisesSeconds).toBe(75);
    expect(getSettings(getDb(dbPath)).restBetweenExercisesSeconds).toBe(75);
  });
});
