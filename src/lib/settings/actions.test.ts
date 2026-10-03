import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { userDbPath } from "@/lib/auth/email";
import { runMigrations } from "@/lib/db/migrate";
import { getSettings } from "./db";

let tmpDir: string;
let dbPath: string;

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-settings-actions-"));
  process.env.DATA_DIR = tmpDir;
  process.env.DEV_FORCE_USER_EMAIL = "test@example.com";
  dbPath = userDbPath("test@example.com");
  runMigrations(getDb(dbPath), path.join(process.cwd(), "migrations"));
});

afterAll(() => {
  delete process.env.DATA_DIR;
  delete process.env.DEV_FORCE_USER_EMAIL;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("getReglagesStateAction", () => {
  it("bundles settings defaults and the app version", async () => {
    const { getReglagesStateAction } = await import("./actions");
    const state = await getReglagesStateAction();
    expect(state.restBetweenSetsSeconds).toBe(90);
    expect(state.version).toMatch(/^\d+\.\d+\.\d+$/);
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
