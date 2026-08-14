import type Database from "better-sqlite3";
import type { TrackingUnit } from "./db";

export type TemplateExerciseInput = { name: string; unit: TrackingUnit; setsCount: number; targetValue: number };
export type TemplateExercise = TemplateExerciseInput & { ordre: number };
export type Template = { id: number; nom: string; createdAt: string; exercises: TemplateExercise[] };

function getTemplateExercises(db: Database.Database, templateId: number): TemplateExercise[] {
  return db
    .prepare(
      `SELECT ordre, exercise_name AS name, unit, sets_count AS setsCount, target_value AS targetValue
       FROM tracking_template_exercises WHERE template_id = ? ORDER BY ordre ASC`,
    )
    .all(templateId) as TemplateExercise[];
}

function insertExercises(db: Database.Database, templateId: number, exercises: TemplateExerciseInput[]): void {
  const insert = db.prepare(
    `INSERT INTO tracking_template_exercises (template_id, ordre, exercise_name, unit, sets_count, target_value)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  exercises.forEach((exercise, ordre) =>
    insert.run(templateId, ordre, exercise.name, exercise.unit, exercise.setsCount, exercise.targetValue),
  );
}

export function createTemplate(db: Database.Database, nom: string, exercises: TemplateExerciseInput[]): Template {
  const createdAt = new Date().toISOString();
  const result = db.prepare(`INSERT INTO tracking_templates (nom, created_at) VALUES (?, ?)`).run(nom, createdAt);
  const templateId = Number(result.lastInsertRowid);
  insertExercises(db, templateId, exercises);
  return { id: templateId, nom, createdAt, exercises: getTemplateExercises(db, templateId) };
}

export function listTemplates(db: Database.Database): Template[] {
  const rows = db
    .prepare(`SELECT id, nom, created_at AS createdAt FROM tracking_templates ORDER BY nom COLLATE NOCASE`)
    .all() as { id: number; nom: string; createdAt: string }[];
  return rows.map((row) => ({ ...row, exercises: getTemplateExercises(db, row.id) }));
}

export function getTemplate(db: Database.Database, templateId: number): Template | null {
  const row = db
    .prepare(`SELECT id, nom, created_at AS createdAt FROM tracking_templates WHERE id = ?`)
    .get(templateId) as { id: number; nom: string; createdAt: string } | undefined;
  if (!row) return null;
  return { ...row, exercises: getTemplateExercises(db, templateId) };
}

export function updateTemplate(
  db: Database.Database,
  templateId: number,
  nom: string,
  exercises: TemplateExerciseInput[],
): Template {
  const apply = db.transaction(() => {
    db.prepare(`UPDATE tracking_templates SET nom = ? WHERE id = ?`).run(nom, templateId);
    db.prepare(`DELETE FROM tracking_template_exercises WHERE template_id = ?`).run(templateId);
    insertExercises(db, templateId, exercises);
  });
  apply();
  return getTemplate(db, templateId)!;
}

// FOREIGN KEY constraints ARE enforced in this project (better-sqlite3
// defaults PRAGMA foreign_keys to on) — child rows must be deleted before
// the template row itself, or this throws FOREIGN KEY constraint failed.
// tracking_seances.template_id has no REFERENCES (see migration 0010), so
// past séances are untouched here and keep their template_id after deletion.
export function deleteTemplate(db: Database.Database, templateId: number): void {
  const apply = db.transaction(() => {
    db.prepare(`DELETE FROM tracking_template_exercises WHERE template_id = ?`).run(templateId);
    db.prepare(`DELETE FROM tracking_program_rotation WHERE template_id = ?`).run(templateId);

    const state = db
      .prepare(`SELECT pointer_template_id AS pointerTemplateId FROM tracking_program_state WHERE id = 1`)
      .get() as { pointerTemplateId: number | null } | undefined;
    if (state?.pointerTemplateId === templateId) {
      const next = db
        .prepare(`SELECT template_id AS templateId FROM tracking_program_rotation ORDER BY position ASC LIMIT 1`)
        .get() as { templateId: number } | undefined;
      db.prepare(`INSERT OR REPLACE INTO tracking_program_state (id, pointer_template_id) VALUES (1, ?)`).run(
        next ? next.templateId : null,
      );
    }

    db.prepare(`DELETE FROM tracking_templates WHERE id = ?`).run(templateId);
  });
  apply();
}
