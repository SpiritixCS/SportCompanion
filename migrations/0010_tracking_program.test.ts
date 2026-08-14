import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("0010_tracking_program migration", () => {
  it("adds a nullable template_id to tracking_seances", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0010_tracking_program.sql");

    db.prepare(`INSERT INTO tracking_seances (started_at) VALUES (?)`).run("2026-08-14T00:00:00.000Z");
    const row = db.prepare(`SELECT template_id AS templateId FROM tracking_seances`).get() as { templateId: number | null };
    expect(row.templateId).toBeNull();
  });

  it("creates the template, rotation, program state and skipped-exercises tables", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));

    const createdAt = "2026-08-14T00:00:00.000Z";
    const template = db.prepare(`INSERT INTO tracking_templates (nom, created_at) VALUES (?, ?)`).run("Push", createdAt);
    const templateId = Number(template.lastInsertRowid);

    db.prepare(
      `INSERT INTO tracking_template_exercises (template_id, ordre, exercise_name, unit, sets_count, target_value) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(templateId, 0, "Dips", "reps", 3, 12);
    db.prepare(`INSERT INTO tracking_program_rotation (template_id, position) VALUES (?, 0)`).run(templateId);
    db.prepare(`INSERT INTO tracking_program_state (id, pointer_template_id) VALUES (1, ?)`).run(templateId);

    const seance = db.prepare(`INSERT INTO tracking_seances (started_at, template_id) VALUES (?, ?)`).run(createdAt, templateId);
    db.prepare(`INSERT INTO tracking_skipped_exercises (seance_id, exercise_order, skipped_at) VALUES (?, ?, ?)`).run(
      Number(seance.lastInsertRowid),
      0,
      createdAt,
    );

    expect(
      db.prepare(`SELECT sets_count AS setsCount FROM tracking_template_exercises WHERE template_id = ?`).get(templateId),
    ).toMatchObject({ setsCount: 3 });
    expect(db.prepare(`SELECT position FROM tracking_program_rotation WHERE template_id = ?`).get(templateId)).toMatchObject({
      position: 0,
    });
    expect(
      db.prepare(`SELECT pointer_template_id AS pointerTemplateId FROM tracking_program_state WHERE id = 1`).get(),
    ).toMatchObject({ pointerTemplateId: templateId });
    expect(
      db.prepare(`SELECT COUNT(*) AS n FROM tracking_skipped_exercises WHERE seance_id = ?`).get(Number(seance.lastInsertRowid)),
    ).toMatchObject({ n: 1 });
  });

  it("rejects a template exercise unit outside reps/seconds", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));
    const template = db.prepare(`INSERT INTO tracking_templates (nom, created_at) VALUES (?, ?)`).run("Push", "2026-08-14T00:00:00.000Z");
    expect(() =>
      db
        .prepare(
          `INSERT INTO tracking_template_exercises (template_id, ordre, exercise_name, unit, sets_count, target_value) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(Number(template.lastInsertRowid), 0, "X", "kg", 3, 10),
    ).toThrow();
  });

  it("rejects a duplicate (template_id, ordre) pair", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));
    const template = db.prepare(`INSERT INTO tracking_templates (nom, created_at) VALUES (?, ?)`).run("Push", "2026-08-14T00:00:00.000Z");
    const templateId = Number(template.lastInsertRowid);
    db.prepare(
      `INSERT INTO tracking_template_exercises (template_id, ordre, exercise_name, unit, sets_count, target_value) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(templateId, 0, "Dips", "reps", 3, 12);
    expect(() =>
      db
        .prepare(
          `INSERT INTO tracking_template_exercises (template_id, ordre, exercise_name, unit, sets_count, target_value) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(templateId, 0, "Pompes", "reps", 3, 15),
    ).toThrow();
  });
});
