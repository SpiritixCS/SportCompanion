// Composition test: nothing in the per-task test suites proves that
// currentUser() and getDbForUser() actually route Mathis and Clément to two
// DIFFERENT SQLite files. Each task tested its own slice in isolation
// (knownUsers() derives paths, getDbForUser caches by path, currentUser()
// resolves a slug from a header) — this is the one test that chains all
// three the way a real request does, proving user data isolation is real.
import { describe, it, expect, vi, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDbForUser } from "@/lib/db/client";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({ headers: () => headersMock() }));

import { currentUser } from "./currentUser";

const ORIGINAL_ENV = { ...process.env };
let tmpDir: string;

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("currentUser() + getDbForUser() composition", () => {
  it("routes Mathis and Clément to two distinct database files", async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-user-isolation-"));
    const dbPath = path.join(tmpDir, "sportcompanion.db");
    process.env.DB_PATH = dbPath;
    process.env.MATHIS_EMAIL = "mathis@example.com";
    process.env.CLEMENT_EMAIL = "clement@example.com";
    delete process.env.DEV_FORCE_USER_SLUG;

    headersMock.mockResolvedValue(new Headers({ "cf-access-authenticated-user-email": "mathis@example.com" }));
    const mathis = await currentUser();
    const mathisDb = getDbForUser(mathis);

    headersMock.mockResolvedValue(new Headers({ "cf-access-authenticated-user-email": "clement@example.com" }));
    const clement = await currentUser();
    const clementDb = getDbForUser(clement);

    expect(mathis.slug).toBe("mathis");
    expect(clement.slug).toBe("clement");
    expect(mathisDb.name).not.toBe(clementDb.name);
    expect(mathisDb.name).toBe(mathis.dbPath);
    expect(clementDb.name).toBe(clement.dbPath);
    expect(existsSync(mathisDb.name)).toBe(true);
    expect(existsSync(clementDb.name)).toBe(true);
    mathisDb.close();
    clementDb.close();
  });

  it("routes the no-header (fallback) request to the same file as an explicit Mathis header", async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-user-isolation-"));
    const dbPath = path.join(tmpDir, "sportcompanion.db");
    process.env.DB_PATH = dbPath;
    process.env.MATHIS_EMAIL = "mathis@example.com";
    process.env.CLEMENT_EMAIL = "clement@example.com";
    delete process.env.DEV_FORCE_USER_SLUG;

    headersMock.mockResolvedValue(new Headers());
    const fallback = await currentUser();
    const fallbackDb = getDbForUser(fallback);

    expect(fallback.slug).toBe("mathis");
    expect(fallbackDb.name).toBe(dbPath);
    fallbackDb.close();
  });
});
