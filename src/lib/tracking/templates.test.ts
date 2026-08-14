import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { createTemplate, listTemplates, getTemplate, updateTemplate, deleteTemplate } from "./templates";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-templates-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

const PUSH_EXERCISES = [
  { name: "Développé couché", unit: "reps" as const, setsCount: 4, targetValue: 8 },
  { name: "Dips", unit: "reps" as const, setsCount: 3, targetValue: 12 },
];

describe("createTemplate", () => {
  it("creates a template with its exercises in order", () => {
    const db = setup();
    const template = createTemplate(db, "Push", PUSH_EXERCISES);
    expect(template.nom).toBe("Push");
    expect(template.exercises).toEqual([
      { ordre: 0, name: "Développé couché", unit: "reps", setsCount: 4, targetValue: 8 },
      { ordre: 1, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 },
    ]);
  });

  it("creates a template with no exercises", () => {
    const db = setup();
    expect(createTemplate(db, "Vide", []).exercises).toEqual([]);
  });
});

describe("listTemplates / getTemplate", () => {
  it("lists templates alphabetically, each with its exercises", () => {
    const db = setup();
    createTemplate(db, "Pull", []);
    createTemplate(db, "Legs", []);
    expect(listTemplates(db).map((t) => t.nom)).toEqual(["Legs", "Pull"]);
  });

  it("returns null for an unknown id", () => {
    const db = setup();
    expect(getTemplate(db, 999)).toBeNull();
  });
});

describe("updateTemplate", () => {
  it("replaces the name and the exercise list in block", () => {
    const db = setup();
    const template = createTemplate(db, "Push", PUSH_EXERCISES);
    const updated = updateTemplate(db, template.id, "Push (v2)", [
      { name: "Pompes", unit: "reps", setsCount: 3, targetValue: 15 },
    ]);
    expect(updated.nom).toBe("Push (v2)");
    expect(updated.exercises).toEqual([{ ordre: 0, name: "Pompes", unit: "reps", setsCount: 3, targetValue: 15 }]);
  });
});

describe("deleteTemplate", () => {
  it("removes the template and its exercises", () => {
    const db = setup();
    const template = createTemplate(db, "Push", PUSH_EXERCISES);
    deleteTemplate(db, template.id);
    expect(getTemplate(db, template.id)).toBeNull();
  });

  it("removes it from the rotation and re-points to the next entry when it was the pointer", () => {
    const db = setup();
    const a = createTemplate(db, "Push", []);
    const b = createTemplate(db, "Pull", []);
    const db2 = db; // same handle, kept for readability at call sites below
    db2.prepare(`INSERT INTO tracking_program_rotation (template_id, position) VALUES (?, 0), (?, 1)`).run(a.id, b.id);
    db2.prepare(`INSERT INTO tracking_program_state (id, pointer_template_id) VALUES (1, ?)`).run(a.id);

    deleteTemplate(db, a.id);

    const rotation = db.prepare(`SELECT template_id AS templateId FROM tracking_program_rotation`).all() as {
      templateId: number;
    }[];
    expect(rotation).toEqual([{ templateId: b.id }]);
    const state = db
      .prepare(`SELECT pointer_template_id AS pointerTemplateId FROM tracking_program_state WHERE id = 1`)
      .get() as { pointerTemplateId: number };
    expect(state.pointerTemplateId).toBe(b.id);
  });

  it("falls back to a null pointer when deleting the last rotation entry", () => {
    const db = setup();
    const a = createTemplate(db, "Push", []);
    db.prepare(`INSERT INTO tracking_program_rotation (template_id, position) VALUES (?, 0)`).run(a.id);
    db.prepare(`INSERT INTO tracking_program_state (id, pointer_template_id) VALUES (1, ?)`).run(a.id);

    deleteTemplate(db, a.id);

    const state = db
      .prepare(`SELECT pointer_template_id AS pointerTemplateId FROM tracking_program_state WHERE id = 1`)
      .get() as { pointerTemplateId: number | null };
    expect(state.pointerTemplateId).toBeNull();
  });
});
