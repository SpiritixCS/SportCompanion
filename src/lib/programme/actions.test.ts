import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { getCurrentPosition } from "./db";
import { PARCOURS } from "./parcours";

let tmpDir: string;
let dbPath: string;

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-actions-"));
  dbPath = path.join(tmpDir, "test.db");
  runMigrations(getDb(dbPath), path.join(process.cwd(), "migrations"));
  process.env.DB_PATH = dbPath;
});

afterAll(() => {
  delete process.env.DB_PATH;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveLevelUpAction", () => {
  it("advances to the next level when not at the last one", async () => {
    const { resolveLevelUpAction } = await import("./actions");
    await resolveLevelUpAction("advance", "advanced", 1);
    expect(getCurrentPosition(getDb(dbPath))?.level).toBe(2);
  });

  it("never writes a level past levelCount - 1 (out-of-bounds finding #3)", async () => {
    const { resolveLevelUpAction } = await import("./actions");
    const lastLevel = PARCOURS.find((p) => p.id === "advanced")!.levelCount - 1;
    await resolveLevelUpAction("advance", "advanced", lastLevel);
    expect(getCurrentPosition(getDb(dbPath))?.level).toBe(lastLevel);
  });
});
