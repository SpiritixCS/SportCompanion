import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { userDbPath } from "@/lib/auth/email";
import { runMigrations } from "@/lib/db/migrate";
import { getCurrentPosition } from "./db";
import { startSeance, completeSeance } from "@/lib/player/db";
import { PARCOURS } from "./parcours";

let tmpDir: string;
let dbPath: string;

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-actions-"));
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

  it("redo opens a new cycle so a fully-validated level doesn't get instantly re-skipped to level-up", async () => {
    const db = getDb(dbPath);
    const seance = startSeance(db, "beginner", 0, 0, 0);
    completeSeance(db, seance.id);

    const { resolveLevelUpAction } = await import("./actions");
    await resolveLevelUpAction("redo", "beginner", 0);

    const position = getCurrentPosition(getDb(dbPath));
    expect(position).toMatchObject({ parcours: "beginner", level: 0, dayIndex: 0, cycle: 1 });
  });
});

describe("setCurrentPositionAction", () => {
  it("opens a new cycle when jumping to a day already validated in the latest cycle (resuming an already-finished level)", async () => {
    const db = getDb(dbPath);
    const seance = startSeance(db, "beginner", 1, 3, 0);
    completeSeance(db, seance.id);

    const { setCurrentPositionAction } = await import("./actions");
    await setCurrentPositionAction("beginner", 1, 3);

    const position = getCurrentPosition(getDb(dbPath));
    expect(position).toMatchObject({ parcours: "beginner", level: 1, dayIndex: 3, cycle: 1 });
  });
});
