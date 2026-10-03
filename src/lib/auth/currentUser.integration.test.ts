// Composition : currentUser() + getDbForUser() routent deux emails vers deux
// fichiers distincts — l'isolation des données entre utilisateurs est réelle.
import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
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
  it("routes two emails to two distinct database files, data never shared", async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-user-isolation-"));
    process.env.DATA_DIR = tmpDir;
    delete process.env.DEV_FORCE_USER_EMAIL;
    delete process.env.CF_ACCESS_TEAM_DOMAIN;
    delete process.env.CF_ACCESS_AUD;

    headersMock.mockResolvedValue(new Headers({ "cf-access-authenticated-user-email": "a@exemple.fr" }));
    const a = await currentUser();
    headersMock.mockResolvedValue(new Headers({ "cf-access-authenticated-user-email": "b@exemple.fr" }));
    const b = await currentUser();

    const dbA = getDbForUser(a);
    const dbB = getDbForUser(b);
    expect(dbA.name).not.toBe(dbB.name);
    expect(dbA.name).toBe(path.join(tmpDir, "users", "a@exemple.fr.db"));

    const before = (dbB.prepare(`SELECT COUNT(*) n FROM seances`).get() as { n: number }).n;
    dbA.prepare(`INSERT INTO seances (parcours, level, day_index, started_at) VALUES ('beginner', 0, 0, '2026-10-03T00:00:00.000Z')`).run();
    expect((dbB.prepare(`SELECT COUNT(*) n FROM seances`).get() as { n: number }).n).toBe(before);
    dbA.close();
    dbB.close();
  });
});
