import type Database from "better-sqlite3";

export type RotationEntry = { templateId: number; nom: string; position: number };
export type Rotation = { entries: RotationEntry[]; pointerTemplateId: number | null };

export function getRotation(db: Database.Database): Rotation {
  const entries = db
    .prepare(
      `SELECT r.template_id AS templateId, t.nom AS nom, r.position AS position
       FROM tracking_program_rotation r JOIN tracking_templates t ON t.id = r.template_id
       ORDER BY r.position ASC`,
    )
    .all() as RotationEntry[];
  const state = db
    .prepare(`SELECT pointer_template_id AS pointerTemplateId FROM tracking_program_state WHERE id = 1`)
    .get() as { pointerTemplateId: number | null } | undefined;
  return { entries, pointerTemplateId: state?.pointerTemplateId ?? null };
}

export function setRotation(db: Database.Database, templateIds: number[]): Rotation {
  const apply = db.transaction(() => {
    db.prepare(`DELETE FROM tracking_program_rotation`).run();
    const insert = db.prepare(`INSERT INTO tracking_program_rotation (template_id, position) VALUES (?, ?)`);
    templateIds.forEach((templateId, position) => insert.run(templateId, position));

    const current = db
      .prepare(`SELECT pointer_template_id AS pointerTemplateId FROM tracking_program_state WHERE id = 1`)
      .get() as { pointerTemplateId: number | null } | undefined;
    const pointerStillValid = current?.pointerTemplateId != null && templateIds.includes(current.pointerTemplateId);
    const nextPointer = pointerStillValid ? current!.pointerTemplateId : (templateIds[0] ?? null);
    db.prepare(`INSERT OR REPLACE INTO tracking_program_state (id, pointer_template_id) VALUES (1, ?)`).run(nextPointer);
  });
  apply();
  return getRotation(db);
}

// Advances by array position within the current rotation, never by raw
// `position` column values — those can have gaps once a template has been
// removed and re-added, but the array order read back from getRotation is
// always contiguous.
export function advancePointer(db: Database.Database, completedTemplateId: number): void {
  const { entries } = getRotation(db);
  const index = entries.findIndex((e) => e.templateId === completedTemplateId);
  if (index === -1) return;
  const next = entries[(index + 1) % entries.length]!;
  db.prepare(`INSERT OR REPLACE INTO tracking_program_state (id, pointer_template_id) VALUES (1, ?)`).run(next.templateId);
}

export function getTodayTemplateId(db: Database.Database): number | null {
  return getRotation(db).pointerTemplateId;
}
