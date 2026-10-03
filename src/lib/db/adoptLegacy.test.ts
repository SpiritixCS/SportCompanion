import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, readdirSync, copyFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { getDb } from "./client";
import { runMigrations } from "./migrate";
import { userDbPath } from "@/lib/auth/email";
import { getPrenom } from "@/lib/profile/db";
import { adoptLegacyDb, adoptLegacyDbs } from "./adoptLegacy";

let tmpDir: string;
const ORIGINAL = { ...process.env };

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-adopt-"));
  process.env.DATA_DIR = tmpDir;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  rmSync(tmpDir, { recursive: true, force: true });
});

const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");

// Base historique telle qu'en prod avant ce chantier : migrations 0001→0014.
function legacyDb(name: string): string {
  const all = path.join(process.cwd(), "migrations");
  const upTo14 = path.join(tmpDir, "migrations-0014");
  mkdirSync(upTo14, { recursive: true });
  for (const f of readdirSync(all).filter((f) => f.endsWith(".sql") && f < "0015")) copyFileSync(path.join(all, f), path.join(upTo14, f));
  const p = path.join(tmpDir, name);
  const db = getDb(p);
  runMigrations(db, upTo14);
  db.prepare(`INSERT INTO current_position (id, parcours, level, day_index, updated_at, cycle) VALUES (1, 'beginner', 2, 4, '2026-08-24T00:00:00.000Z', 0)`).run();
  const s = db.prepare(`INSERT INTO seances (parcours, level, day_index, started_at, completed_at) VALUES ('beginner', 2, 0, '2026-08-13T10:00:00.000Z', '2026-08-13T11:00:00.000Z')`).run();
  db.prepare(`INSERT INTO sets_logged (seance_id, exercise_order, set_number, reps_target, reps_actual, rest_seconds, completed_at) VALUES (?, 0, 1, '10', 9, 90, '2026-08-13T10:10:00.000Z')`).run(s.lastInsertRowid);
  db.close();
  return p;
}

describe("adoptLegacyDb", () => {
  it("copies the legacy file under the user's email with identical data, sets the prénom, never touches the original", async () => {
    const legacy = legacyDb("sportcompanion.db");
    const before = sha(legacy);

    expect(await adoptLegacyDb({ legacyPath: legacy, email: "Mathis@Gmail.com", prenom: "Mathis" })).toBe("adopted");

    const copy = new Database(userDbPath("mathis@gmail.com"), { readonly: true });
    expect(copy.prepare(`SELECT level, day_index FROM current_position`).get()).toEqual({ level: 2, day_index: 4 });
    expect(copy.prepare(`SELECT COUNT(*) n, SUM(reps_actual) s FROM sets_logged`).get()).toEqual({ n: 1, s: 9 });
    expect(getPrenom(copy)).toBe("Mathis");
    copy.close();
    expect(sha(legacy)).toBe(before);
  });

  it("never overwrites an already adopted copy (re-run at the next deploy)", async () => {
    const legacy = legacyDb("sportcompanion.db");
    await adoptLegacyDb({ legacyPath: legacy, email: "m@x.fr", prenom: "Mathis" });
    const copy = new Database(userDbPath("m@x.fr"));
    copy.prepare(`INSERT INTO seances (parcours, level, day_index, started_at) VALUES ('beginner', 2, 4, '2026-10-04T00:00:00.000Z')`).run();
    copy.close();

    expect(await adoptLegacyDb({ legacyPath: legacy, email: "m@x.fr", prenom: "Mathis" })).toBe("skipped");
    const again = new Database(userDbPath("m@x.fr"), { readonly: true });
    expect((again.prepare(`SELECT COUNT(*) n FROM seances`).get() as { n: number }).n).toBe(2);
    again.close();
  });

  it("skips when the legacy file is absent, whatever the email", async () => {
    expect(await adoptLegacyDb({ legacyPath: path.join(tmpDir, "absent.db"), email: undefined, prenom: "X" })).toBe("skipped");
    expect(existsSync(path.join(tmpDir, "users"))).toBe(false);
  });

  it("fails loudly when a legacy file exists but its email is missing or invalid (never an empty account)", async () => {
    const legacy = legacyDb("sportcompanion.db");
    await expect(adoptLegacyDb({ legacyPath: legacy, email: undefined, prenom: "X" })).rejects.toThrow();
    await expect(adoptLegacyDb({ legacyPath: legacy, email: "../evil", prenom: "X" })).rejects.toThrow();
    expect(existsSync(path.join(tmpDir, "users"))).toBe(false);
  });

  it("never leaves a target that looks adopted when the copy fails mid-way", async () => {
    const legacy = legacyDb("sportcompanion.db");
    // prénom invalide → setPrenom lève après la copie, avant le renommage
    await expect(adoptLegacyDb({ legacyPath: legacy, email: "m@x.fr", prenom: "" })).rejects.toThrow();
    expect(existsSync(userDbPath("m@x.fr"))).toBe(false);
    expect(await adoptLegacyDb({ legacyPath: legacy, email: "m@x.fr", prenom: "Mathis" })).toBe("adopted");
  });
});

describe("adoptLegacyDbs", () => {
  it("validates every entry before copying any (no half-adopted state)", async () => {
    const mathis = legacyDb("sportcompanion.db");
    const clement = legacyDb("sportcompanion.clement.db");
    await expect(
      adoptLegacyDbs([
        { legacyPath: mathis, email: "m@x.fr", prenom: "Mathis" },
        { legacyPath: clement, email: undefined, prenom: "Clément" },
      ]),
    ).rejects.toThrow();
    expect(existsSync(userDbPath("m@x.fr"))).toBe(false);
  });

  it("adopts every valid entry", async () => {
    const mathis = legacyDb("sportcompanion.db");
    const clement = legacyDb("sportcompanion.clement.db");
    expect(
      await adoptLegacyDbs([
        { legacyPath: mathis, email: "m@x.fr", prenom: "Mathis" },
        { legacyPath: clement, email: "c@x.fr", prenom: "Clément" },
      ]),
    ).toEqual(["adopted", "adopted"]);
  });
});
