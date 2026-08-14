# Tracking — programme personnel (modèles + rotation) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clément can pre-register workout templates (name + ordered exercises, each with a set count and a per-set target), chain them into a fixed rotation he defines, and launch the day's template from Aujourd'hui through the same guided, full-screen player Programme already uses — without duplicating any storage: logged sets land in the existing `tracking_seances`/`tracking_sets_logged` tables, so Trophées and the séance history pick them up for free.

**Architecture:** Additive migration adds a small template/rotation schema (`tracking_templates`, `tracking_template_exercises`, `tracking_program_rotation`, `tracking_program_state`, `tracking_skipped_exercises`) plus a nullable `tracking_seances.template_id`. A pure function (`templateAsTrainDay`) turns a stored template into the same `TrainDay` shape the Programme player already consumes, so `PlayerScreen`/`ExerciseView`/`RestView`/`SummaryView` and the existing `deriveState` progress-derivation logic are reused unmodified. The rotation is a simple ordered list with a pointer that advances to whichever template was actually completed — never to the calendar. Design rationale lives in `docs/superpowers/specs/2026-08-14-tracking-programme-perso-design.md`.

**Tech Stack:** Next.js 16 (App Router, TypeScript, Server Components/Actions), `better-sqlite3`, Vitest + Testing Library.

## Global Constraints

- Une seule séance active à la fois, tous contextes confondus (invariant déjà existant) — jamais deux séances « en cours » simultanées, ni pour le journal libre ni pour un modèle.
- **Correction (constatée pendant l'implémentation de Task 2) :** `better-sqlite3` active `PRAGMA foreign_keys` par défaut dans ce projet — les contraintes `REFERENCES` du schéma sont réellement appliquées à l'exécution (vérifié : `db.pragma('foreign_keys', {simple:true})` → `1`). Toute suppression doit donc retirer les lignes filles avant la ligne mère (modèle → ses exercices → sa place en rotation → le pointeur), sous peine d'un `FOREIGN KEY constraint failed` — ce n'est pas une habitude défensive, c'est requis. Seule exception : `tracking_seances.template_id` n'a délibérément pas de `REFERENCES`, pour qu'une séance déjà loggée garde son `template_id` même après suppression du modèle, sans jamais bloquer cette suppression.
- Cible unique par exercice de modèle, appliquée à toutes ses séries — pas de cible variable par série (pas de pyramidal).
- Une fonction passée d'un Server Component à `PlayerScreen` (Client Component) doit être une Server Action, jamais une closure inline — utiliser `.bind(null, …)` pour lui attacher un argument supplémentaire (ex. `templateId`).
- État toujours relu depuis la DB, jamais reconstruit côté client — CLAUDE.md §2/§7 ; une séance interrompue doit toujours pouvoir être reprise sans perte silencieuse.
- Accent `sage` partout dans le module Tracking (y compris le programme perso) — jamais de couleur en dur, toujours via la prop `accent` / les tokens existants.
- Cibles tactiles ≥ 44px (56px pour les actions primaires), rayons 20px cartes / 14px champs / 999px pastilles-boutons.
- Français partout, tutoiement, l'app constate — pas de coaching motivationnel.
- Accès aux routes `/tracking/*` et `/player/tracking` réservé à `user.slug === "clement"` (`redirect("/")` sinon), comme toutes les routes Tracking existantes.

---

### Task 1: Migration SQL — schéma programme personnel

**Files:**
- Create: `migrations/0010_tracking_program.sql`
- Create: `migrations/0010_tracking_program.test.ts`

**Interfaces:**
- Produces: `tracking_seances.template_id` (nullable), `tracking_templates`, `tracking_template_exercises`, `tracking_program_rotation`, `tracking_program_state`, `tracking_skipped_exercises` — consommées par toutes les tâches suivantes.

- [ ] **Step 1: Write the migration**

```sql
-- migrations/0010_tracking_program.sql
ALTER TABLE tracking_seances ADD COLUMN template_id INTEGER REFERENCES tracking_templates(id);

CREATE TABLE tracking_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE tracking_template_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES tracking_templates(id),
  ordre INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('reps', 'seconds')),
  sets_count INTEGER NOT NULL,
  target_value INTEGER NOT NULL,
  UNIQUE (template_id, ordre)
);

CREATE TABLE tracking_program_rotation (
  template_id INTEGER PRIMARY KEY REFERENCES tracking_templates(id),
  position INTEGER NOT NULL UNIQUE
);

CREATE TABLE tracking_program_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pointer_template_id INTEGER REFERENCES tracking_templates(id)
);

CREATE TABLE tracking_skipped_exercises (
  seance_id INTEGER NOT NULL REFERENCES tracking_seances(id),
  exercise_order INTEGER NOT NULL,
  skipped_at TEXT NOT NULL,
  PRIMARY KEY (seance_id, exercise_order)
);
```

- [ ] **Step 2: Write the test**

```ts
// migrations/0010_tracking_program.test.ts
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
```

- [ ] **Step 3: Run the tests, verify pass**

Run: `npx vitest run migrations/0010_tracking_program.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add migrations/0010_tracking_program.sql migrations/0010_tracking_program.test.ts
git commit -m "feat(db): ajoute le schéma programme personnel Tracking (modèles, rotation, pointeur)"
```

---

### Task 2: `src/lib/tracking/db.ts` — `template_id` de séance, ordre explicite, exercices sautés

**Files:**
- Modify: `src/lib/tracking/db.ts`
- Modify: `src/lib/tracking/db.test.ts`

**Interfaces:**
- Consumes: `tracking_seances.template_id`, `tracking_skipped_exercises` (Task 1).
- Produces: `TrackingSeance.templateId: number | null`; `startSeance(db, templateId?)`; `getOrStartSeance(db, templateId?)`; `logSetForExercise(db, seanceId, exerciseName, unit, valeurActual, count?, exerciseOrder?)` (new optional trailing param, backward-compatible); `skipExercise(db, seanceId, exerciseOrder)`; `getSkippedExercises(db, seanceId): number[]` — consumed by Task 5 (actions), Task 7 (loadTemplatePlayerState).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/tracking/db.test.ts` (add these imports to the existing import list: `skipExercise`, `getSkippedExercises`; the rest of the file is unchanged):

```ts
// add to the existing import block from "./db":
//   skipExercise,
//   getSkippedExercises,

describe("seance templateId", () => {
  it("defaults to null when no template is given", () => {
    const db = setup();
    expect(startSeance(db).templateId).toBeNull();
  });

  it("carries the template id through to getOrStartSeance and getActiveSeance", () => {
    const db = setup();
    startSeance(db, 5);
    expect(getActiveSeance(db)!.templateId).toBe(5);
    expect(getOrStartSeance(db, 5).templateId).toBe(5);
  });

  it("resumes whatever is active regardless of the templateId requested", () => {
    const db = setup();
    const started = startSeance(db, 5);
    const resumed = getOrStartSeance(db, 9);
    expect(resumed.id).toBe(started.id);
    expect(resumed.templateId).toBe(5);
  });
});

describe("logSetForExercise with an explicit exerciseOrder", () => {
  it("uses the given order instead of deriving it from insertion, numbering sets within that order", () => {
    const db = setup();
    const seance = startSeance(db);
    const [first] = logSetForExercise(db, seance.id, "Dips", "reps", 12, 1, 3);
    expect(first).toMatchObject({ exerciseOrder: 3, setNumber: 1 });
    const [second] = logSetForExercise(db, seance.id, "Dips", "reps", 10, 1, 3);
    expect(second).toMatchObject({ exerciseOrder: 3, setNumber: 2 });
  });

  it("keeps the auto-derived order unchanged when exerciseOrder is omitted", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    const [second] = logSetForExercise(db, seance.id, "Fentes", "reps", 10);
    expect(second).toMatchObject({ exerciseOrder: 1, setNumber: 1 });
  });
});

describe("skipExercise / getSkippedExercises", () => {
  it("records a skipped exercise order and lists it back", () => {
    const db = setup();
    const seance = startSeance(db);
    skipExercise(db, seance.id, 2);
    expect(getSkippedExercises(db, seance.id)).toEqual([2]);
  });

  it("ignores a duplicate skip of the same order", () => {
    const db = setup();
    const seance = startSeance(db);
    skipExercise(db, seance.id, 2);
    skipExercise(db, seance.id, 2);
    expect(getSkippedExercises(db, seance.id)).toEqual([2]);
  });

  it("scopes skipped exercises to their own seance", () => {
    const db = setup();
    const seanceA = startSeance(db);
    const seanceB = startSeance(db);
    skipExercise(db, seanceA.id, 1);
    expect(getSkippedExercises(db, seanceB.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/tracking/db.test.ts`
Expected: FAIL — `db.ts` doesn't export `skipExercise`/`getSkippedExercises` yet, `startSeance`/`getOrStartSeance` don't accept a `templateId`, `logSetForExercise` ignores a trailing `exerciseOrder`.

- [ ] **Step 3: Rewrite `db.ts`**

```ts
// src/lib/tracking/db.ts
import type Database from "better-sqlite3";

export type TrackingUnit = "reps" | "seconds";
export type TrackingExercise = { id: number; name: string; unit: TrackingUnit; createdAt: string };
export type TrackingSeance = { id: number; startedAt: string; completedAt: string | null; templateId: number | null };
export type TrackingSetWithExercise = {
  id: number;
  seanceId: number;
  exerciseId: number;
  exerciseName: string;
  exerciseUnit: TrackingUnit;
  exerciseOrder: number;
  setNumber: number;
  valeurActual: number;
  completedAt: string;
};
export type TrackingSeanceSummary = {
  id: number;
  startedAt: string;
  completedAt: string;
  totalReps: number;
  totalSeconds: number;
  exerciseCount: number;
};

export function findOrCreateExercise(db: Database.Database, name: string, unit: TrackingUnit = "reps"): TrackingExercise {
  const existing = db
    .prepare(`SELECT id, name, unit, created_at AS createdAt FROM tracking_exercises WHERE name = ?`)
    .get(name) as TrackingExercise | undefined;
  if (existing) return existing;

  const createdAt = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO tracking_exercises (name, unit, created_at) VALUES (?, ?, ?)`)
    .run(name, unit, createdAt);
  return { id: Number(result.lastInsertRowid), name, unit, createdAt };
}

export function listExercises(db: Database.Database): { name: string; unit: TrackingUnit }[] {
  return db.prepare(`SELECT name, unit FROM tracking_exercises ORDER BY name COLLATE NOCASE`).all() as {
    name: string;
    unit: TrackingUnit;
  }[];
}

function mapSeance(row: { id: number; started_at: string; completed_at: string | null; template_id: number | null }): TrackingSeance {
  return { id: row.id, startedAt: row.started_at, completedAt: row.completed_at, templateId: row.template_id };
}

export function getActiveSeance(db: Database.Database): TrackingSeance | null {
  const row = db
    .prepare(`SELECT * FROM tracking_seances WHERE completed_at IS NULL ORDER BY started_at DESC, id DESC LIMIT 1`)
    .get() as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function startSeance(db: Database.Database, templateId: number | null = null): TrackingSeance {
  const startedAt = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO tracking_seances (started_at, template_id) VALUES (?, ?)`)
    .run(startedAt, templateId);
  return { id: Number(result.lastInsertRowid), startedAt, completedAt: null, templateId };
}

// Resumes whatever seance is active, regardless of the templateId requested —
// only one seance is ever active at a time (product invariant). Callers that
// care whether the resumed seance actually matches their context must check
// its .templateId themselves (see loadTemplatePlayerState's "wrong-seance" phase).
export function getOrStartSeance(db: Database.Database, templateId: number | null = null): TrackingSeance {
  return getActiveSeance(db) ?? startSeance(db, templateId);
}

export function getSeanceById(db: Database.Database, id: number): TrackingSeance | null {
  const row = db.prepare(`SELECT * FROM tracking_seances WHERE id = ?`).get(id) as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function getSetsForSeance(db: Database.Database, seanceId: number): TrackingSetWithExercise[] {
  return db
    .prepare(
      `SELECT tsl.id, tsl.seance_id AS seanceId, tsl.exercise_id AS exerciseId, te.name AS exerciseName, te.unit AS exerciseUnit,
              tsl.exercise_order AS exerciseOrder, tsl.set_number AS setNumber, tsl.valeur_actual AS valeurActual,
              tsl.completed_at AS completedAt
       FROM tracking_sets_logged tsl JOIN tracking_exercises te ON tsl.exercise_id = te.id
       WHERE tsl.seance_id = ? ORDER BY tsl.id ASC`,
    )
    .all(seanceId) as TrackingSetWithExercise[];
}

export function logSetForExercise(
  db: Database.Database,
  seanceId: number,
  exerciseName: string,
  unit: TrackingUnit,
  valeurActual: number,
  count: number = 1,
  exerciseOrder?: number,
): TrackingSetWithExercise[] {
  const exercise = findOrCreateExercise(db, exerciseName, unit);
  const seanceSets = getSetsForSeance(db, seanceId);
  const existingForExercise = seanceSets.filter((s) => s.exerciseId === exercise.id);
  const resolvedOrder =
    exerciseOrder ??
    existingForExercise[0]?.exerciseOrder ??
    1 + seanceSets.reduce((max, s) => Math.max(max, s.exerciseOrder), -1);
  const existingAtOrder = seanceSets.filter((s) => s.exerciseOrder === resolvedOrder);

  const insert = db.prepare(
    `INSERT INTO tracking_sets_logged (seance_id, exercise_id, exercise_order, set_number, valeur_actual, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const created: TrackingSetWithExercise[] = [];
  let setNumber = existingAtOrder.length + 1;
  for (let i = 0; i < count; i++) {
    const completedAt = new Date().toISOString();
    const result = insert.run(seanceId, exercise.id, resolvedOrder, setNumber, valeurActual, completedAt);
    created.push({
      id: Number(result.lastInsertRowid),
      seanceId,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      exerciseUnit: exercise.unit,
      exerciseOrder: resolvedOrder,
      setNumber,
      valeurActual,
      completedAt,
    });
    setNumber++;
  }
  return created;
}

export function updateSet(db: Database.Database, setId: number, valeurActual: number): void {
  db.prepare(`UPDATE tracking_sets_logged SET valeur_actual = ? WHERE id = ?`).run(valeurActual, setId);
}

export function deleteSet(db: Database.Database, setId: number): void {
  db.prepare(`DELETE FROM tracking_sets_logged WHERE id = ?`).run(setId);
}

export function deleteSetsForExercise(db: Database.Database, seanceId: number, exerciseId: number): void {
  db.prepare(`DELETE FROM tracking_sets_logged WHERE seance_id = ? AND exercise_id = ?`).run(seanceId, exerciseId);
}

export function deleteSeance(db: Database.Database, seanceId: number): void {
  db.prepare(`DELETE FROM tracking_sets_logged WHERE seance_id = ?`).run(seanceId);
  db.prepare(`DELETE FROM tracking_seances WHERE id = ?`).run(seanceId);
}

export function completeSeance(db: Database.Database, seanceId: number): void {
  db.prepare(`UPDATE tracking_seances SET completed_at = ? WHERE id = ?`).run(new Date().toISOString(), seanceId);
}

export function listCompletedSeances(db: Database.Database): TrackingSeanceSummary[] {
  return db
    .prepare(
      `SELECT s.id, s.started_at AS startedAt, s.completed_at AS completedAt,
              COALESCE(SUM(CASE WHEN te.unit = 'reps' THEN sl.valeur_actual ELSE 0 END), 0) AS totalReps,
              COALESCE(SUM(CASE WHEN te.unit = 'seconds' THEN sl.valeur_actual ELSE 0 END), 0) AS totalSeconds,
              COUNT(DISTINCT sl.exercise_id) AS exerciseCount
       FROM tracking_seances s
       LEFT JOIN tracking_sets_logged sl ON sl.seance_id = s.id
       LEFT JOIN tracking_exercises te ON te.id = sl.exercise_id
       WHERE s.completed_at IS NOT NULL
       GROUP BY s.id
       ORDER BY s.completed_at DESC, s.id DESC`,
    )
    .all() as TrackingSeanceSummary[];
}

export function skipExercise(db: Database.Database, seanceId: number, exerciseOrder: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO tracking_skipped_exercises (seance_id, exercise_order, skipped_at) VALUES (?, ?, ?)`,
  ).run(seanceId, exerciseOrder, new Date().toISOString());
}

export function getSkippedExercises(db: Database.Database, seanceId: number): number[] {
  const rows = db
    .prepare(`SELECT exercise_order AS exerciseOrder FROM tracking_skipped_exercises WHERE seance_id = ?`)
    .all(seanceId) as { exerciseOrder: number }[];
  return rows.map((r) => r.exerciseOrder);
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/lib/tracking/db.test.ts`
Expected: all tests PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracking/db.ts src/lib/tracking/db.test.ts
git commit -m "feat(tracking): template_id de séance, ordre d'exercice explicite, exercices sautés"
```

---

### Task 3: `src/lib/tracking/templates.ts` — CRUD des modèles

**Files:**
- Create: `src/lib/tracking/templates.ts`
- Create: `src/lib/tracking/templates.test.ts`

**Interfaces:**
- Consumes: `tracking_templates`, `tracking_template_exercises`, `tracking_program_rotation`, `tracking_program_state` (Task 1).
- Produces: `TemplateExerciseInput = { name, unit, setsCount, targetValue }`; `TemplateExercise = TemplateExerciseInput & { ordre }`; `Template = { id, nom, createdAt, exercises }`; `createTemplate(db, nom, exercises): Template`; `listTemplates(db): Template[]`; `getTemplate(db, templateId): Template | null`; `updateTemplate(db, templateId, nom, exercises): Template`; `deleteTemplate(db, templateId): void` — consumed by Task 5 (actions), Task 6 (`templateAsTrainDay`), Task 9 (`loadTrackingScreenState`), Task 12 (`ProgrammeScreen`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/tracking/templates.test.ts
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
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/tracking/templates.test.ts`
Expected: FAIL — `./templates` doesn't exist yet.

- [ ] **Step 3: Write `templates.ts`**

```ts
// src/lib/tracking/templates.ts
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
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/lib/tracking/templates.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracking/templates.ts src/lib/tracking/templates.test.ts
git commit -m "feat(tracking): CRUD des modèles de séance"
```

---

### Task 4: `src/lib/tracking/program.ts` — rotation et pointeur

**Files:**
- Create: `src/lib/tracking/program.ts`
- Create: `src/lib/tracking/program.test.ts`

**Interfaces:**
- Consumes: `tracking_program_rotation`, `tracking_program_state` (Task 1); `createTemplate` (Task 3, test-only).
- Produces: `RotationEntry = { templateId, nom, position }`; `Rotation = { entries, pointerTemplateId }`; `getRotation(db): Rotation`; `setRotation(db, templateIds): Rotation`; `advancePointer(db, completedTemplateId): void`; `getTodayTemplateId(db): number | null` — consumed by Task 5 (actions), Task 8 (player page), Task 9 (`loadTrackingScreenState`), Task 12 (`ProgrammeScreen`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/tracking/program.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { createTemplate } from "./templates";
import { getRotation, setRotation, advancePointer, getTodayTemplateId } from "./program";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-program-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("getRotation", () => {
  it("returns an empty rotation and a null pointer initially", () => {
    const db = setup();
    expect(getRotation(db)).toEqual({ entries: [], pointerTemplateId: null });
  });
});

describe("setRotation", () => {
  it("orders entries as given and points to the first one when nothing was set before", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    const pull = createTemplate(db, "Pull", []);
    const rotation = setRotation(db, [push.id, pull.id]);
    expect(rotation.entries.map((e) => e.templateId)).toEqual([push.id, pull.id]);
    expect(rotation.pointerTemplateId).toBe(push.id);
  });

  it("keeps the current pointer when it's still in the new rotation", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    const pull = createTemplate(db, "Pull", []);
    setRotation(db, [push.id, pull.id]);
    advancePointer(db, push.id);

    const rotation = setRotation(db, [pull.id, push.id]);
    expect(rotation.pointerTemplateId).toBe(pull.id);
  });

  it("falls back to the first entry when the current pointer drops out of the rotation", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    const pull = createTemplate(db, "Pull", []);
    const legs = createTemplate(db, "Legs", []);
    setRotation(db, [push.id, pull.id]);

    const rotation = setRotation(db, [legs.id]);
    expect(rotation.pointerTemplateId).toBe(legs.id);
  });

  it("falls back to a null pointer for an empty rotation", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    setRotation(db, [push.id]);
    expect(setRotation(db, []).pointerTemplateId).toBeNull();
  });
});

describe("advancePointer", () => {
  it("moves to the next entry, wrapping around at the end", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    const pull = createTemplate(db, "Pull", []);
    setRotation(db, [push.id, pull.id]);

    advancePointer(db, push.id);
    expect(getTodayTemplateId(db)).toBe(pull.id);

    advancePointer(db, pull.id);
    expect(getTodayTemplateId(db)).toBe(push.id);
  });

  it("does nothing when the completed template is no longer in the rotation", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    const pull = createTemplate(db, "Pull", []);
    setRotation(db, [push.id, pull.id]);
    setRotation(db, [pull.id]);

    advancePointer(db, push.id);
    expect(getTodayTemplateId(db)).toBe(pull.id);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/tracking/program.test.ts`
Expected: FAIL — `./program` doesn't exist yet.

- [ ] **Step 3: Write `program.ts`**

```ts
// src/lib/tracking/program.ts
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
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/lib/tracking/program.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracking/program.ts src/lib/tracking/program.test.ts
git commit -m "feat(tracking): rotation et pointeur du programme personnel"
```

---

### Task 5: `src/lib/tracking/actions.ts` — actions serveur modèles, rotation, player

**Files:**
- Modify: `src/lib/tracking/actions.ts`

**Interfaces:**
- Consumes: `templates.ts` (Task 3), `program.ts` (Task 4), `db.ts`'s `skipExercise`/`logSetForExercise` with `exerciseOrder` (Task 2).
- Produces: `createTemplateAction(nom, exercises): Promise<Template>`; `updateTemplateAction(templateId, nom, exercises): Promise<Template>`; `deleteTemplateAction(templateId): Promise<void>`; `setRotationAction(templateIds): Promise<Rotation>`; `logTemplateSetAction(templateId, params): Promise<void>`; `skipTemplateExerciseAction(seanceId, exerciseOrder): Promise<void>`; `completeTemplateSeanceAction(templateId, seanceId): Promise<void>` — consumed by Task 8 (player page, via `.bind`) and Task 12 (`ProgrammeScreen`).

No dedicated test file — matches this file's existing convention (thin `"use server"` wrappers, exercised indirectly through the components/pages that call them, same as `player/actions.ts`/`dos/actions.ts`).

- [ ] **Step 1: Rewrite `actions.ts`**

```ts
// src/lib/tracking/actions.ts
"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import {
  getOrStartSeance,
  logSetForExercise,
  updateSet as updateSetDb,
  deleteSet as deleteSetDb,
  deleteSetsForExercise as deleteSetsForExerciseDb,
  deleteSeance as deleteSeanceDb,
  completeSeance as completeSeanceDb,
  skipExercise as skipExerciseDb,
  type TrackingSetWithExercise,
  type TrackingUnit,
} from "./db";
import {
  createTemplate as createTemplateDb,
  updateTemplate as updateTemplateDb,
  deleteTemplate as deleteTemplateDb,
  getTemplate as getTemplateDb,
  type Template,
  type TemplateExerciseInput,
} from "./templates";
import { setRotation as setRotationDb, advancePointer, type Rotation } from "./program";

async function db() {
  return getDbForUser(await currentUser());
}

export async function startTrackingSeanceAction(): Promise<number> {
  const seance = getOrStartSeance(await db());
  return seance.id;
}

export async function logTrackingSetAction(params: {
  seanceId: number;
  exerciseName: string;
  unit: TrackingUnit;
  valeurActual: number;
  count?: number;
}): Promise<TrackingSetWithExercise[]> {
  return logSetForExercise(await db(), params.seanceId, params.exerciseName, params.unit, params.valeurActual, params.count ?? 1);
}

export async function updateTrackingSetAction(setId: number, valeurActual: number): Promise<void> {
  updateSetDb(await db(), setId, valeurActual);
}

export async function deleteTrackingSetAction(setId: number): Promise<void> {
  deleteSetDb(await db(), setId);
}

export async function deleteTrackingExerciseAction(seanceId: number, exerciseId: number): Promise<void> {
  deleteSetsForExerciseDb(await db(), seanceId, exerciseId);
}

export async function deleteTrackingSeanceAction(seanceId: number): Promise<void> {
  deleteSeanceDb(await db(), seanceId);
}

export async function completeTrackingSeanceAction(seanceId: number): Promise<void> {
  completeSeanceDb(await db(), seanceId);
}

export async function createTemplateAction(nom: string, exercises: TemplateExerciseInput[]): Promise<Template> {
  return createTemplateDb(await db(), nom, exercises);
}

export async function updateTemplateAction(
  templateId: number,
  nom: string,
  exercises: TemplateExerciseInput[],
): Promise<Template> {
  return updateTemplateDb(await db(), templateId, nom, exercises);
}

export async function deleteTemplateAction(templateId: number): Promise<void> {
  deleteTemplateDb(await db(), templateId);
}

export async function setRotationAction(templateIds: number[]): Promise<Rotation> {
  return setRotationDb(await db(), templateIds);
}

// Bound with templateId via `.bind(null, templateId)` before being handed to
// PlayerScreen (a Client Component): a Server Component can only pass a
// Server Action reference across that boundary, never an inline closure —
// binding is how the player page attaches the template id to each callback.
export async function logTemplateSetAction(
  templateId: number,
  params: {
    seanceId: number;
    exerciseOrder: number;
    exerciseId: string;
    setNumber: number;
    repsTarget: string;
    repsActual: number;
    restSeconds: number;
  },
): Promise<void> {
  const database = await db();
  const template = getTemplateDb(database, templateId);
  const exercise = template?.exercises.find((e) => e.ordre === params.exerciseOrder);
  if (!exercise) throw new Error("Exercice introuvable pour ce modèle");
  logSetForExercise(database, params.seanceId, exercise.name, exercise.unit, params.repsActual, 1, params.exerciseOrder);
}

export async function skipTemplateExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipExerciseDb(await db(), seanceId, exerciseOrder);
}

export async function completeTemplateSeanceAction(templateId: number, seanceId: number): Promise<void> {
  const database = await db();
  completeSeanceDb(database, seanceId);
  advancePointer(database, templateId);
}
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: all tests up through Task 4 still PASS (this file has no dedicated test, but nothing else references its new exports yet).

- [ ] **Step 3: Commit**

```bash
git add src/lib/tracking/actions.ts
git commit -m "feat(tracking): actions serveur pour les modèles, la rotation et la séance guidée"
```

---

### Task 6: `src/lib/tracking/templateAsTrainDay.ts`

**Files:**
- Create: `src/lib/tracking/templateAsTrainDay.ts`
- Create: `src/lib/tracking/templateAsTrainDay.test.ts`

**Interfaces:**
- Consumes: `Template`/`TemplateExercise` (Task 3), `TrainDay`/`Exercise` (existing, `@/lib/workout/types`).
- Produces: `templateAsTrainDay(template: Template): TrainDay` — consumed by Task 8 (player page).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tracking/templateAsTrainDay.test.ts
import { describe, it, expect } from "vitest";
import { templateAsTrainDay } from "./templateAsTrainDay";
import type { Template } from "./templates";

const TEMPLATE: Template = {
  id: 3,
  nom: "Push",
  createdAt: "2026-08-14T00:00:00.000Z",
  exercises: [
    { ordre: 0, name: "Développé couché", unit: "reps", setsCount: 4, targetValue: 8 },
    { ordre: 1, name: "Planche", unit: "seconds", setsCount: 3, targetValue: 45 },
  ],
};

describe("templateAsTrainDay", () => {
  it("maps each template exercise to a TrainDay exercise with a single uniform target", () => {
    expect(templateAsTrainDay(TEMPLATE)).toEqual({
      kind: "train",
      label: "Push",
      exercises: [
        {
          id: "tpl-3-0",
          name: "Développé couché",
          movementFamily: "other",
          countsInStats: true,
          videoId: null,
          sets: 4,
          target: { unit: "reps", value: 8, maxEffort: false, eachSide: false },
        },
        {
          id: "tpl-3-1",
          name: "Planche",
          movementFamily: "other",
          countsInStats: true,
          videoId: null,
          sets: 3,
          target: { unit: "seconds", value: 45, maxEffort: false, eachSide: false },
        },
      ],
    });
  });

  it("maps a template with no exercises to a day with an empty exercise list", () => {
    expect(templateAsTrainDay({ ...TEMPLATE, exercises: [] }).exercises).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/lib/tracking/templateAsTrainDay.test.ts`
Expected: FAIL — `./templateAsTrainDay` doesn't exist yet.

- [ ] **Step 3: Write `templateAsTrainDay.ts`**

```ts
// src/lib/tracking/templateAsTrainDay.ts
import type { TrainDay } from "@/lib/workout/types";
import type { Template } from "./templates";

// A synthetic exercise id, e.g. "tpl-3-0" — only ever used as an image-src
// key by ExerciseView (`/exercises/{id}.jpg`); a missing file already falls
// back gracefully there (imageFailed), so no thumbnail is needed for a
// user-authored exercise.
export function templateAsTrainDay(template: Template): TrainDay {
  return {
    kind: "train",
    label: template.nom,
    exercises: template.exercises.map((exercise) => ({
      id: `tpl-${template.id}-${exercise.ordre}`,
      name: exercise.name,
      movementFamily: "other",
      countsInStats: true,
      videoId: null,
      sets: exercise.setsCount,
      target: { unit: exercise.unit, value: exercise.targetValue, maxEffort: false, eachSide: false },
    })),
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/lib/tracking/templateAsTrainDay.test.ts`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracking/templateAsTrainDay.ts src/lib/tracking/templateAsTrainDay.test.ts
git commit -m "feat(tracking): traduit un modèle en TrainDay pour le player guidé"
```

---

### Task 7: `src/lib/tracking/loadTemplatePlayerState.ts`

**Files:**
- Create: `src/lib/tracking/loadTemplatePlayerState.ts`
- Create: `src/lib/tracking/loadTemplatePlayerState.test.ts`

**Interfaces:**
- Consumes: `getOrStartSeance`, `getSetsForSeance`, `getSkippedExercises` (Task 2); `deriveState`, `NextSet` (existing, `@/lib/player/deriveState`, reused unmodified — generic over `{exerciseOrder, setNumber}[]`).
- Produces: `TemplatePlayerState` (`"in-progress" | "pending-validation" | "completed" | "wrong-seance"`); `loadTemplatePlayerState(db, templateId, day): TemplatePlayerState` — consumed by Task 8 (player page).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/tracking/loadTemplatePlayerState.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, completeSeance, logSetForExercise } from "./db";
import { loadTemplatePlayerState } from "./loadTemplatePlayerState";
import type { TrainDay } from "@/lib/workout/types";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-template-player-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

const DAY: TrainDay = {
  kind: "train",
  label: "Push",
  exercises: [
    {
      id: "tpl-1-0",
      name: "Développé couché",
      movementFamily: "other",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 8, maxEffort: false, eachSide: false },
    },
  ],
};

describe("loadTemplatePlayerState", () => {
  it("starts a fresh seance in-progress at the first set when nothing is active", () => {
    const db = setup();
    const state = loadTemplatePlayerState(db, 1, DAY);
    expect(state.phase).toBe("in-progress");
    if (state.phase === "in-progress") {
      expect(state.next).toEqual({ exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: true });
    }
  });

  it("reaches pending-validation once every set is logged", () => {
    const db = setup();
    const seance = startSeance(db, 1);
    logSetForExercise(db, seance.id, "Développé couché", "reps", 8, 2, 0);
    expect(loadTemplatePlayerState(db, 1, DAY).phase).toBe("pending-validation");
  });

  it("reports completed once the seance is validated", () => {
    const db = setup();
    const seance = startSeance(db, 1);
    completeSeance(db, seance.id);
    expect(loadTemplatePlayerState(db, 1, DAY)).toEqual({ phase: "completed", seanceId: seance.id });
  });

  it("flags wrong-seance when the active seance belongs to a different template", () => {
    const db = setup();
    startSeance(db, 2);
    expect(loadTemplatePlayerState(db, 1, DAY).phase).toBe("wrong-seance");
  });

  it("flags wrong-seance when the active seance is a freeform one (no template)", () => {
    const db = setup();
    startSeance(db, null);
    expect(loadTemplatePlayerState(db, 1, DAY).phase).toBe("wrong-seance");
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/tracking/loadTemplatePlayerState.test.ts`
Expected: FAIL — `./loadTemplatePlayerState` doesn't exist yet.

- [ ] **Step 3: Write `loadTemplatePlayerState.ts`**

```ts
// src/lib/tracking/loadTemplatePlayerState.ts
import type Database from "better-sqlite3";
import type { TrainDay } from "@/lib/workout/types";
import { deriveState, type NextSet } from "@/lib/player/deriveState";
import { getOrStartSeance, getSetsForSeance, getSkippedExercises } from "./db";

export type TemplatePlayerState =
  | { phase: "in-progress"; seanceId: number; startedAt: string; next: NextSet; skippedExerciseOrders: number[] }
  | { phase: "pending-validation"; seanceId: number; startedAt: string }
  | { phase: "completed"; seanceId: number }
  | { phase: "wrong-seance"; seanceId: number };

export function loadTemplatePlayerState(db: Database.Database, templateId: number, day: TrainDay): TemplatePlayerState {
  const seance = getOrStartSeance(db, templateId);

  if (seance.templateId !== templateId) {
    return { phase: "wrong-seance", seanceId: seance.id };
  }

  if (seance.completedAt) {
    return { phase: "completed", seanceId: seance.id };
  }

  const sets = getSetsForSeance(db, seance.id);
  const skippedExerciseOrders = getSkippedExercises(db, seance.id);
  const progress = deriveState(day, sets, new Set(skippedExerciseOrders));

  if (progress.allSetsDone) {
    return { phase: "pending-validation", seanceId: seance.id, startedAt: seance.startedAt };
  }

  return {
    phase: "in-progress",
    seanceId: seance.id,
    startedAt: seance.startedAt,
    next: progress.next,
    skippedExerciseOrders,
  };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/lib/tracking/loadTemplatePlayerState.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracking/loadTemplatePlayerState.ts src/lib/tracking/loadTemplatePlayerState.test.ts
git commit -m "feat(tracking): dérive l'état du player guidé pour une séance de modèle"
```

---

### Task 8: `/player/tracking` — page du player guidé

**Files:**
- Create: `src/app/player/tracking/page.tsx`

**Interfaces:**
- Consumes: `getTemplate` (Task 3), `templateAsTrainDay` (Task 6), `loadTemplatePlayerState` (Task 7), `logTemplateSetAction`/`skipTemplateExerciseAction`/`completeTemplateSeanceAction` (Task 5), `PlayerScreen` (existing, `@/components/player/PlayerScreen`, unmodified), `getSettings` (existing, `@/lib/settings/db`).
- Produces: the route `/player/tracking?templateId=…` — consumed by Task 10 (`TrackingCard`).

No dedicated test — this project doesn't unit-test Next.js Server Component page files (`/player/page.tsx` has none either); verified manually in Step 2 below.

- [ ] **Step 1: Write `page.tsx`**

```tsx
// src/app/player/tracking/page.tsx
import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSettings } from "@/lib/settings/db";
import { getTemplate } from "@/lib/tracking/templates";
import { templateAsTrainDay } from "@/lib/tracking/templateAsTrainDay";
import { loadTemplatePlayerState } from "@/lib/tracking/loadTemplatePlayerState";
import { getSetsForSeance } from "@/lib/tracking/db";
import { logTemplateSetAction, skipTemplateExerciseAction, completeTemplateSeanceAction } from "@/lib/tracking/actions";
import { PlayerScreen } from "@/components/player/PlayerScreen";

export default async function TrackingPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const user = await currentUser();
  if (user.slug !== "clement") redirect("/");

  const { templateId: templateIdParam } = await searchParams;
  const templateId = Number(templateIdParam);
  const db = getDbForUser(user);
  const template = getTemplate(db, templateId);

  if (!template || template.exercises.length === 0) {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Modèle introuvable.</p>
      </main>
    );
  }

  const day = templateAsTrainDay(template);
  const state = loadTemplatePlayerState(db, templateId, day);

  if (state.phase === "wrong-seance") {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">
          Une autre séance est déjà en cours. Termine-la ou quitte-la avant d&apos;en commencer une nouvelle.
        </p>
      </main>
    );
  }

  const settings = getSettings(db);
  const setsLogged = getSetsForSeance(db, state.seanceId).map((set) => ({
    id: set.id,
    seanceId: set.seanceId,
    exerciseOrder: set.exerciseOrder,
    setNumber: set.setNumber,
    repsTarget: String(day.exercises[set.exerciseOrder]?.target.value ?? ""),
    repsActual: set.valeurActual,
    restSeconds: settings.restBetweenSetsSeconds,
    completedAt: set.completedAt,
  }));

  return (
    <PlayerScreen
      day={day}
      state={state}
      setsLogged={setsLogged}
      accent="sage"
      restBetweenSetsSeconds={settings.restBetweenSetsSeconds}
      restBetweenExercisesSeconds={settings.restBetweenExercisesSeconds}
      keepScreenAwakeEnabled={settings.keepScreenAwakeEnabled}
      onLogSet={logTemplateSetAction.bind(null, templateId)}
      onSkipExercise={skipTemplateExerciseAction}
      onSeanceFinish={completeTemplateSeanceAction.bind(null, templateId)}
    />
  );
}
```

- [ ] **Step 2: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS, no type errors (`state` narrows correctly to `PlayerScreen`'s expected `state` shape after the `"wrong-seance"` early return).

- [ ] **Step 3: Commit**

```bash
git add src/app/player/tracking/page.tsx
git commit -m "feat(tracking): route /player/tracking, réutilise le player Programme pour un modèle"
```

---

### Task 9: `loadTrackingScreenState` — modèle du jour et rotation ; `TrackingScreen` suit le renommage

**Files:**
- Modify: `src/lib/tracking/loadTrackingScreenState.ts`
- Modify: `src/lib/tracking/loadTrackingScreenState.test.ts`
- Modify: `src/components/tracking/TrackingScreen.tsx`
- Modify: `src/components/tracking/TrackingScreen.test.tsx`

**Interfaces:**
- Consumes: `getRotation` (Task 4), `getTemplate` (Task 3).
- Produces: `TrackingScreenState = { activeSeance: {id, templateId} | null, seances, todayTemplate: {templateId, nom, exercises} | null, rotationTemplates: {templateId, nom}[] }` (breaking rename of `activeSeanceId` → `activeSeance`) — consumed by Task 10 (`TrackingCard`).

- [ ] **Step 1: Write the failing tests**

Replace `src/lib/tracking/loadTrackingScreenState.test.ts` in full:

```ts
// src/lib/tracking/loadTrackingScreenState.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSetForExercise, completeSeance } from "./db";
import { createTemplate } from "./templates";
import { setRotation } from "./program";
import { loadTrackingScreenState } from "./loadTrackingScreenState";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-tracking-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadTrackingScreenState", () => {
  it("reports no active seance, no history and no rotation when nothing was ever set up", () => {
    const db = setup();
    expect(loadTrackingScreenState(db)).toEqual({
      activeSeance: null,
      seances: [],
      todayTemplate: null,
      rotationTemplates: [],
    });
  });

  it("surfaces the active seance's id and template, separately from completed history", () => {
    const db = setup();
    const active = startSeance(db);
    const past = startSeance(db);
    logSetForExercise(db, past.id, "Squats", "reps", 10);
    completeSeance(db, past.id);

    const state = loadTrackingScreenState(db);
    expect(state.activeSeance).toEqual({ id: active.id, templateId: null });
    expect(state.seances).toHaveLength(1);
    expect(state.seances[0]!.id).toBe(past.id);
  });

  it("surfaces today's template and the full rotation when one is active", () => {
    const db = setup();
    const push = createTemplate(db, "Push", [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);
    const pull = createTemplate(db, "Pull", []);
    setRotation(db, [push.id, pull.id]);

    const state = loadTrackingScreenState(db);
    expect(state.todayTemplate).toMatchObject({ templateId: push.id, nom: "Push" });
    expect(state.rotationTemplates).toEqual([
      { templateId: push.id, nom: "Push" },
      { templateId: pull.id, nom: "Pull" },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/tracking/loadTrackingScreenState.test.ts`
Expected: FAIL — `loadTrackingScreenState` still returns the old `{ activeSeanceId, seances }` shape.

- [ ] **Step 3: Rewrite `loadTrackingScreenState.ts`**

```ts
// src/lib/tracking/loadTrackingScreenState.ts
import type Database from "better-sqlite3";
import { getActiveSeance, listCompletedSeances, type TrackingSeanceSummary } from "./db";
import { getTemplate, type TemplateExercise } from "./templates";
import { getRotation } from "./program";

export type TrackingScreenState = {
  activeSeance: { id: number; templateId: number | null } | null;
  seances: TrackingSeanceSummary[];
  todayTemplate: { templateId: number; nom: string; exercises: TemplateExercise[] } | null;
  rotationTemplates: { templateId: number; nom: string }[];
};

export function loadTrackingScreenState(db: Database.Database): TrackingScreenState {
  const active = getActiveSeance(db);
  const rotation = getRotation(db);
  const todayTemplate = rotation.pointerTemplateId !== null ? getTemplate(db, rotation.pointerTemplateId) : null;

  return {
    activeSeance: active ? { id: active.id, templateId: active.templateId } : null,
    seances: listCompletedSeances(db),
    todayTemplate: todayTemplate
      ? { templateId: todayTemplate.id, nom: todayTemplate.nom, exercises: todayTemplate.exercises }
      : null,
    rotationTemplates: rotation.entries.map((entry) => ({ templateId: entry.templateId, nom: entry.nom })),
  };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/lib/tracking/loadTrackingScreenState.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 5: Update `TrackingScreen.tsx`** — follow the `activeSeanceId` → `activeSeance` rename, clarify the freeform button's label

```tsx
// src/components/tracking/TrackingScreen.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { ResumeBanner } from "@/components/today/ResumeBanner";
import { IconClose } from "@/components/icons/IconClose";
import { startTrackingSeanceAction, deleteTrackingSeanceAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(iso));
}

export function TrackingScreen({ state }: { state: TrackingScreenState }) {
  const router = useRouter();
  const [error, setError] = useState(false);

  async function handleStart() {
    setError(false);
    try {
      const seanceId = await startTrackingSeanceAction();
      router.push(`/tracking/${seanceId}`);
    } catch {
      setError(true);
    }
  }

  async function handleDeleteSeance(seanceId: number) {
    setError(false);
    try {
      await deleteTrackingSeanceAction(seanceId);
      router.refresh();
    } catch {
      setError(true);
    }
  }

  return (
    <div className="p-5 flex flex-col gap-8">
      <div>
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-32 font-semibold leading-[1.05] mt-2">Tes séances</div>
      </div>

      {state.activeSeance !== null && (
        <ResumeBanner exerciseName="ta séance en cours" href={`/tracking/${state.activeSeance.id}`} accent="sage" />
      )}

      {error && (
        <div className="bg-paper border border-hairline rounded-card p-6">
          <p className="text-15 text-graphite">Une erreur est survenue. Réessaie.</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleStart}
        className="h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
      >
        Enregistrer une séance libre
      </button>

      {state.seances.length === 0 ? (
        <p className="text-15 text-graphite">Aucune séance enregistrée pour l&apos;instant.</p>
      ) : (
        <Card className="overflow-hidden">
          {state.seances.map((seance, i) => (
            <div
              key={seance.id}
              className={`flex items-center gap-2 px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}
            >
              <Link href={`/tracking/${seance.id}`} className="flex-1 flex items-center justify-between gap-4 min-w-0">
                <div>
                  <div className="text-15 font-medium">{formatDateFr(seance.completedAt)}</div>
                  <div className="text-13 text-graphite mt-0.5">
                    {seance.exerciseCount} exercice{seance.exerciseCount > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="text-right">
                  {seance.totalReps > 0 && (
                    <div className="font-archivo text-18 font-semibold tabular-nums">{seance.totalReps}</div>
                  )}
                  {seance.totalSeconds > 0 && (
                    <div
                      className={`font-archivo tabular-nums ${
                        seance.totalReps > 0 ? "text-13 text-graphite" : "text-18 font-semibold"
                      }`}
                    >
                      {seance.totalSeconds} s
                    </div>
                  )}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => handleDeleteSeance(seance.id)}
                aria-label="Supprimer la séance"
                className="text-graphite flex-none w-9 h-9 flex items-center justify-center"
              >
                <IconClose size={16} />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Update `TrackingScreen.test.tsx`** — replace every `activeSeanceId: null` with `activeSeance: null`, `activeSeanceId: 7` with `activeSeance: { id: 7, templateId: null }`, and the button-name assertion from `"Enregistrer une séance"` to `"Enregistrer une séance libre"` (7 occurrences in `state={{...}}` literals across the file, plus the two button-click tests)

Replace `src/components/tracking/TrackingScreen.test.tsx` in full:

```tsx
// src/components/tracking/TrackingScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingScreen } from "./TrackingScreen";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const startTrackingSeanceAction = vi.fn();
const deleteTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  startTrackingSeanceAction: (...args: unknown[]) => startTrackingSeanceAction(...args),
  deleteTrackingSeanceAction: (...args: unknown[]) => deleteTrackingSeanceAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TrackingScreen", () => {
  it("shows the empty state with no history", () => {
    render(<TrackingScreen state={{ activeSeance: null, seances: [], todayTemplate: null, rotationTemplates: [] }} />);
    expect(screen.getByText("Aucune séance enregistrée pour l'instant.")).toBeInTheDocument();
  });

  it("lists completed seances with their total reps", () => {
    render(
      <TrackingScreen
        state={{
          activeSeance: null,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
          todayTemplate: null,
          rotationTemplates: [],
        }}
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("3 exercices")).toBeInTheDocument();
  });

  it("shows a seconds total alongside the reps total when a seance has both", () => {
    render(
      <TrackingScreen
        state={{
          activeSeance: null,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 90, exerciseCount: 4 }],
          todayTemplate: null,
          rotationTemplates: [],
        }}
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("90 s")).toBeInTheDocument();
  });

  it("shows only the seconds total when a seance is seconds-only", () => {
    render(
      <TrackingScreen
        state={{
          activeSeance: null,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 0, totalSeconds: 60, exerciseCount: 1 }],
          todayTemplate: null,
          rotationTemplates: [],
        }}
      />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("60 s")).toBeInTheDocument();
  });

  it("links a history row to its séance detail", () => {
    render(
      <TrackingScreen
        state={{
          activeSeance: null,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
          todayTemplate: null,
          rotationTemplates: [],
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /42/ })).toHaveAttribute("href", "/tracking/5");
  });

  it("deletes a seance and refreshes the list on click", async () => {
    render(
      <TrackingScreen
        state={{
          activeSeance: null,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
          todayTemplate: null,
          rotationTemplates: [],
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Supprimer la séance" }));
    expect(deleteTrackingSeanceAction).toHaveBeenCalledWith(5);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows an error affordance when deleteTrackingSeanceAction fails", async () => {
    deleteTrackingSeanceAction.mockRejectedValueOnce(new Error("boom"));
    render(
      <TrackingScreen
        state={{
          activeSeance: null,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
          todayTemplate: null,
          rotationTemplates: [],
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Supprimer la séance" }));
    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a resume banner when a seance is already active", () => {
    render(
      <TrackingScreen state={{ activeSeance: { id: 7, templateId: null }, seances: [], todayTemplate: null, rotationTemplates: [] }} />,
    );
    expect(screen.getByText("Séance interrompue")).toBeInTheDocument();
  });

  it("starts a freeform seance and navigates to it on button click", async () => {
    startTrackingSeanceAction.mockResolvedValue(9);
    render(<TrackingScreen state={{ activeSeance: null, seances: [], todayTemplate: null, rotationTemplates: [] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer une séance libre" }));
    expect(startTrackingSeanceAction).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/tracking/9");
  });

  it("shows an error affordance instead of navigating when startTrackingSeanceAction fails", async () => {
    startTrackingSeanceAction.mockRejectedValueOnce(new Error("boom"));
    render(<TrackingScreen state={{ activeSeance: null, seances: [], todayTemplate: null, rotationTemplates: [] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer une séance libre" }));
    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all tests PASS. (`TrackingCard.tsx`/`TrackingCard.test.tsx` still reference the old `activeSeanceId` shape and will now fail to compile — expected, resolved in Task 10.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/tracking/loadTrackingScreenState.ts src/lib/tracking/loadTrackingScreenState.test.ts \
  src/components/tracking/TrackingScreen.tsx src/components/tracking/TrackingScreen.test.tsx
git commit -m "feat(tracking): l'état d'écran porte le modèle du jour et la rotation"
```

---

### Task 10: `TrackingCard` — séance active, modèle du jour, Changer

**Files:**
- Modify: `src/components/today/TrackingCard.tsx`
- Modify: `src/components/today/TrackingCard.test.tsx`

**Interfaces:**
- Consumes: `TrackingScreenState` (Task 9).
- Produces: the Aujourd'hui card for Clément, in all three states (séance active, modèle du jour proposé, aucune rotation).

- [ ] **Step 1: Write the failing tests**

Replace `src/components/today/TrackingCard.test.tsx` in full:

```tsx
// src/components/today/TrackingCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingCard } from "./TrackingCard";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const startTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  startTrackingSeanceAction: (...args: unknown[]) => startTrackingSeanceAction(...args),
}));

const EMPTY_STATE: TrackingScreenState = {
  activeSeance: null,
  seances: [],
  todayTemplate: null,
  rotationTemplates: [],
};

describe("TrackingCard", () => {
  it("shows Enregistrer une séance and starts a freeform one on click when nothing is active or planned", async () => {
    startTrackingSeanceAction.mockResolvedValue(9);
    render(<TrackingCard state={EMPTY_STATE} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer une séance" }));
    expect(startTrackingSeanceAction).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/tracking/9");
  });

  it("shows Reprendre linking to the freeform journal when the active seance has no template", () => {
    render(<TrackingCard state={{ ...EMPTY_STATE, activeSeance: { id: 7, templateId: null } }} />);
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/tracking/7");
  });

  it("shows Reprendre linking to the guided player when the active seance belongs to a template", () => {
    render(<TrackingCard state={{ ...EMPTY_STATE, activeSeance: { id: 7, templateId: 3 } }} />);
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/player/tracking?templateId=3");
  });

  it("shows today's template name, exercises and a Commencer link into the guided player", () => {
    render(
      <TrackingCard
        state={{
          ...EMPTY_STATE,
          todayTemplate: {
            templateId: 3,
            nom: "Push",
            exercises: [{ ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }],
          },
          rotationTemplates: [{ templateId: 3, nom: "Push" }],
        }}
      />,
    );
    expect(screen.getByText("Push")).toBeInTheDocument();
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Commencer" })).toHaveAttribute("href", "/player/tracking?templateId=3");
  });

  it("hides Changer when the rotation has no other template", () => {
    render(
      <TrackingCard
        state={{
          ...EMPTY_STATE,
          todayTemplate: { templateId: 3, nom: "Push", exercises: [] },
          rotationTemplates: [{ templateId: 3, nom: "Push" }],
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Changer" })).not.toBeInTheDocument();
  });

  it("opens a sheet listing the other rotation templates on Changer, each linking into the guided player", async () => {
    render(
      <TrackingCard
        state={{
          ...EMPTY_STATE,
          todayTemplate: { templateId: 3, nom: "Push", exercises: [] },
          rotationTemplates: [
            { templateId: 3, nom: "Push" },
            { templateId: 4, nom: "Pull" },
          ],
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Changer" }));
    expect(screen.getByRole("link", { name: "Pull" })).toHaveAttribute("href", "/player/tracking?templateId=4");
    expect(screen.queryByRole("link", { name: "Push" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/components/today/TrackingCard.test.tsx`
Expected: FAIL — current component only knows `activeSeanceId`, has no template/rotation rendering.

- [ ] **Step 3: Rewrite `TrackingCard.tsx`**

```tsx
// src/components/today/TrackingCard.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Sheet } from "@/components/Sheet";
import { startTrackingSeanceAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

function doseLabel(exercise: { setsCount: number; targetValue: number; unit: "reps" | "seconds" }): string {
  return `${exercise.setsCount} × ${exercise.targetValue}${exercise.unit === "seconds" ? " s" : ""}`;
}

export function TrackingCard({ state }: { state: TrackingScreenState }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [changerOpen, setChangerOpen] = useState(false);

  async function handleStartFreeform() {
    if (starting) return;
    setStarting(true);
    try {
      const seanceId = await startTrackingSeanceAction();
      router.push(`/tracking/${seanceId}`);
    } finally {
      setStarting(false);
    }
  }

  if (state.activeSeance !== null) {
    const href =
      state.activeSeance.templateId !== null
        ? `/player/tracking?templateId=${state.activeSeance.templateId}`
        : `/tracking/${state.activeSeance.id}`;
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-18 font-semibold mt-3">Séance en cours</div>
        <Link
          href={href}
          className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Reprendre
        </Link>
      </Card>
    );
  }

  if (state.todayTemplate !== null) {
    const template = state.todayTemplate;
    const alternatives = state.rotationTemplates.filter((t) => t.templateId !== template.templateId);
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-24 font-semibold mt-3.5">{template.nom}</div>

        {template.exercises.length > 0 && (
          <div className="flex flex-col gap-2.5 mt-5">
            {template.exercises.map((exercise) => (
              <div key={exercise.ordre} className="flex items-baseline justify-between gap-4">
                <span className="text-15">{exercise.name}</span>
                <span className="font-archivo text-15 font-medium text-graphite tabular-nums whitespace-nowrap">
                  {doseLabel(exercise)}
                </span>
              </div>
            ))}
          </div>
        )}

        <Link
          href={`/player/tracking?templateId=${template.templateId}`}
          className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Commencer
        </Link>

        {alternatives.length > 0 && (
          <button
            type="button"
            onClick={() => setChangerOpen(true)}
            className="mt-3 h-11 flex items-center justify-center w-full text-15 text-graphite"
          >
            Changer
          </button>
        )}

        <Sheet open={changerOpen} onClose={() => setChangerOpen(false)} title="Changer la séance du jour">
          <div className="flex flex-col gap-2.5">
            {alternatives.map((t) => (
              <Link
                key={t.templateId}
                href={`/player/tracking?templateId=${t.templateId}`}
                className="h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold"
              >
                {t.nom}
              </Link>
            ))}
          </div>
        </Sheet>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
      <div className="font-archivo text-18 font-semibold mt-3">Log ta séance du jour</div>
      <button
        type="button"
        onClick={handleStartFreeform}
        disabled={starting}
        className="mt-5 w-full h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold disabled:opacity-40"
      >
        Enregistrer une séance
      </button>
    </Card>
  );
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/components/today/TrackingCard.test.tsx`
Expected: all 6 tests PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/today/TrackingCard.tsx src/components/today/TrackingCard.test.tsx
git commit -m "feat(tracking): la carte Aujourd'hui propose le modèle du jour et permet de le changer"
```

---

### Task 11: `TemplateEditor` — formulaire de création/édition d'un modèle

**Files:**
- Create: `src/components/tracking/TemplateEditor.tsx`
- Create: `src/components/tracking/TemplateEditor.test.tsx`

**Interfaces:**
- Consumes: `TemplateExerciseInput`, `TrackingUnit` (existing types).
- Produces: `TemplateEditor` — a controlled form (draft state lives in the component; parent owns persistence) — consumed by Task 12 (`ProgrammeScreen`).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/tracking/TemplateEditor.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateEditor } from "./TemplateEditor";

describe("TemplateEditor", () => {
  it("prompts to add the first exercise when starting empty", () => {
    render(
      <TemplateEditor initialNom="" initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText("Ajoute ton premier exercice ci-dessous.")).toBeInTheDocument();
  });

  it("adds an exercise to the draft list from the form", async () => {
    render(
      <TemplateEditor initialNom="" initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={() => {}} />,
    );
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Dips");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("3 × 10")).toBeInTheDocument();
  });

  it("locks the unit to a known exercise's unit", async () => {
    render(
      <TemplateEditor
        initialNom=""
        initialExercises={[]}
        exerciseSuggestions={[{ name: "Planche", unit: "seconds" }]}
        saving={false}
        error={false}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Planche");
    expect(screen.getByText("Unité : secondes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    expect(screen.getByText("3 × 10 s")).toBeInTheDocument();
  });

  it("reorders exercises with the up/down controls", async () => {
    render(
      <TemplateEditor
        initialNom="Push"
        initialExercises={[
          { name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 },
          { name: "Pompes", unit: "reps", setsCount: 3, targetValue: 15 },
        ]}
        exerciseSuggestions={[]}
        saving={false}
        error={false}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Descendre Dips" }));
    const rows = screen.getAllByText(/Dips|Pompes/);
    expect(rows[0]).toHaveTextContent("Pompes");
    expect(rows[1]).toHaveTextContent("Dips");
  });

  it("removes an exercise from the draft", async () => {
    render(
      <TemplateEditor
        initialNom="Push"
        initialExercises={[{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]}
        exerciseSuggestions={[]}
        saving={false}
        error={false}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retirer Dips" }));
    expect(screen.queryByText("Dips")).not.toBeInTheDocument();
  });

  it("calls onSave with the name and the draft exercise list", async () => {
    const onSave = vi.fn();
    render(
      <TemplateEditor
        initialNom="Push"
        initialExercises={[{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]}
        exerciseSuggestions={[]}
        saving={false}
        error={false}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le modèle" }));
    expect(onSave).toHaveBeenCalledWith("Push", [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);
  });

  it("disables Enregistrer until a name and at least one exercise are present", () => {
    render(
      <TemplateEditor initialNom="" initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Enregistrer le modèle" })).toBeDisabled();
  });

  it("calls onCancel from the Annuler button", async () => {
    const onCancel = vi.fn();
    render(
      <TemplateEditor initialNom="" initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/components/tracking/TemplateEditor.test.tsx`
Expected: FAIL — `./TemplateEditor` doesn't exist yet.

- [ ] **Step 3: Write `TemplateEditor.tsx`**

```tsx
// src/components/tracking/TemplateEditor.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { IconClose } from "@/components/icons/IconClose";
import type { TrackingUnit } from "@/lib/tracking/db";
import type { TemplateExerciseInput } from "@/lib/tracking/templates";

function pillClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium ${active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"}`;
}

export function TemplateEditor({
  initialNom,
  initialExercises,
  exerciseSuggestions,
  saving,
  error,
  onSave,
  onCancel,
}: {
  initialNom: string;
  initialExercises: TemplateExerciseInput[];
  exerciseSuggestions: { name: string; unit: TrackingUnit }[];
  saving: boolean;
  error: boolean;
  onSave: (nom: string, exercises: TemplateExerciseInput[]) => void;
  onCancel: () => void;
}) {
  const [nom, setNom] = useState(initialNom);
  const [exercises, setExercises] = useState<TemplateExerciseInput[]>(initialExercises);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<TrackingUnit>("reps");
  const [setsCount, setSetsCount] = useState(3);
  const [targetValue, setTargetValue] = useState(10);

  const matchedExercise = exerciseSuggestions.find((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase());
  const effectiveUnit = matchedExercise?.unit ?? unit;

  function handleAddExercise() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setExercises((prev) => [...prev, { name: trimmed, unit: effectiveUnit, setsCount, targetValue }]);
    setName("");
    setSetsCount(3);
    setTargetValue(10);
  }

  function handleRemoveExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function handleMoveExercise(index: number, direction: -1 | 1) {
    setExercises((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <div className="p-5 flex flex-col gap-6">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Modèle</span>

      {error && (
        <div className="bg-paper border border-hairline rounded-card p-6">
          <p className="text-15 text-graphite">Une erreur est survenue. Réessaie.</p>
        </div>
      )}

      <input
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Nom du modèle"
        className="h-14 rounded-field border border-hairline px-4 text-15"
      />

      {exercises.length === 0 ? (
        <p className="text-15 text-graphite">Ajoute ton premier exercice ci-dessous.</p>
      ) : (
        <Card className="overflow-hidden">
          {exercises.map((exercise, i) => (
            <div key={i} className={`flex items-center gap-2 px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="text-15 font-medium">{exercise.name}</div>
                <div className="text-13 text-graphite mt-0.5">
                  {exercise.setsCount} × {exercise.targetValue}
                  {exercise.unit === "seconds" ? " s" : ""}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Monter ${exercise.name}`}
                onClick={() => handleMoveExercise(i, -1)}
                disabled={i === 0}
                className="w-9 h-9 flex items-center justify-center text-graphite disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Descendre ${exercise.name}`}
                onClick={() => handleMoveExercise(i, 1)}
                disabled={i === exercises.length - 1}
                className="w-9 h-9 flex items-center justify-center text-graphite disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Retirer ${exercise.name}`}
                onClick={() => handleRemoveExercise(i)}
                className="w-9 h-9 flex items-center justify-center text-graphite"
              >
                <IconClose size={16} />
              </button>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-5 flex flex-col gap-4">
        <input
          type="text"
          list="template-exercise-suggestions"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de l'exercice"
          className="h-14 rounded-field border border-hairline px-4 text-15"
        />
        <datalist id="template-exercise-suggestions">
          {exerciseSuggestions.map((e) => (
            <option key={e.name} value={e.name} />
          ))}
        </datalist>

        {matchedExercise ? (
          <div className="text-13 text-graphite">Unité : {matchedExercise.unit === "seconds" ? "secondes" : "reps"}</div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => setUnit("reps")} className={pillClass(unit === "reps")}>
              Reps
            </button>
            <button type="button" onClick={() => setUnit("seconds")} className={pillClass(unit === "seconds")}>
              Secondes
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-15 text-graphite">Séries</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Retirer une série"
              onClick={() => setSetsCount((v) => Math.max(1, v - 1))}
              className="w-9 h-9 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15"
            >
              −
            </button>
            <span className="font-archivo text-18 font-semibold tabular-nums w-6 text-center">{setsCount}</span>
            <button
              type="button"
              aria-label="Ajouter une série"
              onClick={() => setSetsCount((v) => v + 1)}
              className="w-9 h-9 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-15 text-graphite">Cible par série</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Diminuer la cible"
              onClick={() => setTargetValue((v) => Math.max(0, v - 1))}
              className="w-9 h-9 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15"
            >
              −
            </button>
            <span className="font-archivo text-18 font-semibold tabular-nums w-10 text-center">{targetValue}</span>
            <button
              type="button"
              aria-label="Augmenter la cible"
              onClick={() => setTargetValue((v) => v + 1)}
              className="w-9 h-9 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15"
            >
              +
            </button>
          </div>
        </div>

        <Button variant="primary" accent="sage" onClick={handleAddExercise} disabled={name.trim() === ""}>
          Ajouter l&apos;exercice
        </Button>
      </Card>

      <div className="flex flex-col gap-2.5">
        <Button
          variant="primary"
          accent="sage"
          onClick={() => onSave(nom, exercises)}
          disabled={saving || nom.trim() === "" || exercises.length === 0}
        >
          Enregistrer le modèle
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/components/tracking/TemplateEditor.test.tsx`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tracking/TemplateEditor.tsx src/components/tracking/TemplateEditor.test.tsx
git commit -m "feat(tracking): formulaire de création/édition d'un modèle de séance"
```

---

### Task 12: `ProgrammeScreen` + route `/tracking/programme`

**Files:**
- Create: `src/components/tracking/ProgrammeScreen.tsx`
- Create: `src/components/tracking/ProgrammeScreen.test.tsx`
- Create: `src/app/(shell)/tracking/programme/page.tsx`

**Interfaces:**
- Consumes: `TemplateEditor` (Task 11), `createTemplateAction`/`updateTemplateAction`/`deleteTemplateAction`/`setRotationAction` (Task 5), `listTemplates`/`Template` (Task 3), `getRotation`/`Rotation` (Task 4), `listExercises` (existing, `@/lib/tracking/db`).
- Produces: the route `/tracking/programme` — consumed by Task 13 (link from `TrackingScreen`).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/tracking/ProgrammeScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgrammeScreen } from "./ProgrammeScreen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const createTemplateAction = vi.fn();
const updateTemplateAction = vi.fn();
const deleteTemplateAction = vi.fn();
const setRotationAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  createTemplateAction: (...args: unknown[]) => createTemplateAction(...args),
  updateTemplateAction: (...args: unknown[]) => updateTemplateAction(...args),
  deleteTemplateAction: (...args: unknown[]) => deleteTemplateAction(...args),
  setRotationAction: (...args: unknown[]) => setRotationAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const PUSH = {
  id: 1,
  nom: "Push",
  createdAt: "2026-08-14T00:00:00.000Z",
  exercises: [{ ordre: 0, name: "Dips", unit: "reps" as const, setsCount: 3, targetValue: 12 }],
};
const PULL = { id: 2, nom: "Pull", createdAt: "2026-08-14T00:00:00.000Z", exercises: [] };

describe("ProgrammeScreen", () => {
  it("shows an empty state with no templates", () => {
    render(<ProgrammeScreen templates={[]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    expect(screen.getByText("Aucun modèle pour l'instant.")).toBeInTheDocument();
  });

  it("opens the editor on Nouveau modèle, creates a template and refreshes on save", async () => {
    createTemplateAction.mockResolvedValue(PUSH);
    render(<ProgrammeScreen templates={[]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Nouveau modèle" }));
    await userEvent.type(screen.getByPlaceholderText("Nom du modèle"), "Push");
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Dips");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le modèle" }));
    expect(createTemplateAction).toHaveBeenCalledWith("Push", [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 10 }]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("opens the editor prefilled with a template's data when clicked", async () => {
    render(<ProgrammeScreen templates={[PUSH]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByText("Push"));
    expect(screen.getByDisplayValue("Push")).toBeInTheDocument();
    expect(screen.getByText("Dips")).toBeInTheDocument();
  });

  it("deletes a template and refreshes", async () => {
    render(<ProgrammeScreen templates={[PUSH]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Supprimer Push" }));
    expect(deleteTemplateAction).toHaveBeenCalledWith(1);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("adds a template to the rotation", async () => {
    render(<ProgrammeScreen templates={[PUSH]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Ajouter à la rotation" }));
    expect(setRotationAction).toHaveBeenCalledWith([1]);
  });

  it("removes a template from the rotation", async () => {
    render(
      <ProgrammeScreen
        templates={[PUSH]}
        rotation={{ entries: [{ templateId: 1, nom: "Push", position: 0 }], pointerTemplateId: 1 }}
        exerciseSuggestions={[]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dans la rotation" }));
    expect(setRotationAction).toHaveBeenCalledWith([]);
  });

  it("swaps two templates' order via the reorder controls", async () => {
    render(
      <ProgrammeScreen
        templates={[PUSH, PULL]}
        rotation={{
          entries: [
            { templateId: 1, nom: "Push", position: 0 },
            { templateId: 2, nom: "Pull", position: 1 },
          ],
          pointerTemplateId: 1,
        }}
        exerciseSuggestions={[]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Descendre Push dans la rotation" }));
    expect(setRotationAction).toHaveBeenCalledWith([2, 1]);
  });

  it("shows an error affordance when an action fails", async () => {
    deleteTemplateAction.mockRejectedValueOnce(new Error("boom"));
    render(<ProgrammeScreen templates={[PUSH]} rotation={{ entries: [], pointerTemplateId: null }} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Supprimer Push" }));
    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/components/tracking/ProgrammeScreen.test.tsx`
Expected: FAIL — `./ProgrammeScreen` doesn't exist yet.

- [ ] **Step 3: Write `ProgrammeScreen.tsx`**

```tsx
// src/components/tracking/ProgrammeScreen.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { IconClose } from "@/components/icons/IconClose";
import { TemplateEditor } from "./TemplateEditor";
import { createTemplateAction, updateTemplateAction, deleteTemplateAction, setRotationAction } from "@/lib/tracking/actions";
import type { TemplateExerciseInput, Template } from "@/lib/tracking/templates";
import type { TrackingUnit } from "@/lib/tracking/db";
import type { Rotation } from "@/lib/tracking/program";

type EditorState = { mode: "create" } | { mode: "edit"; template: Template } | null;

function pillClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium ${active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"}`;
}

export function ProgrammeScreen({
  templates,
  rotation,
  exerciseSuggestions,
}: {
  templates: Template[];
  rotation: Rotation;
  exerciseSuggestions: { name: string; unit: TrackingUnit }[];
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorState>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave(nom: string, exercises: TemplateExerciseInput[]) {
    setSaving(true);
    setError(false);
    try {
      if (editor?.mode === "edit") {
        await updateTemplateAction(editor.template.id, nom, exercises);
      } else {
        await createTemplateAction(nom, exercises);
      }
      setEditor(null);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(templateId: number) {
    setError(false);
    try {
      await deleteTemplateAction(templateId);
      router.refresh();
    } catch {
      setError(true);
    }
  }

  async function handleToggleRotation(templateId: number) {
    setError(false);
    const currentIds = rotation.entries.map((e) => e.templateId);
    const nextIds = currentIds.includes(templateId)
      ? currentIds.filter((id) => id !== templateId)
      : [...currentIds, templateId];
    try {
      await setRotationAction(nextIds);
      router.refresh();
    } catch {
      setError(true);
    }
  }

  async function handleMoveRotation(templateId: number, direction: -1 | 1) {
    setError(false);
    const ids = rotation.entries.map((e) => e.templateId);
    const index = ids.indexOf(templateId);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await setRotationAction(ids);
      router.refresh();
    } catch {
      setError(true);
    }
  }

  if (editor) {
    return (
      <TemplateEditor
        initialNom={editor.mode === "edit" ? editor.template.nom : ""}
        initialExercises={editor.mode === "edit" ? editor.template.exercises : []}
        exerciseSuggestions={exerciseSuggestions}
        saving={saving}
        error={error}
        onSave={handleSave}
        onCancel={() => setEditor(null)}
      />
    );
  }

  const rotationIds = new Set(rotation.entries.map((e) => e.templateId));

  return (
    <div className="p-5 flex flex-col gap-8">
      <div>
        <Link href="/tracking" className="text-15 text-graphite">
          ← Retour
        </Link>
        <div className="font-archivo text-32 font-semibold leading-[1.05] mt-2">Mon programme</div>
      </div>

      {error && (
        <div className="bg-paper border border-hairline rounded-card p-6">
          <p className="text-15 text-graphite">Une erreur est survenue. Réessaie.</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setEditor({ mode: "create" })}
        className="h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
      >
        Nouveau modèle
      </button>

      {templates.length === 0 ? (
        <p className="text-15 text-graphite">Aucun modèle pour l&apos;instant.</p>
      ) : (
        <Card className="overflow-hidden">
          {templates.map((template, i) => {
            const inRotation = rotationIds.has(template.id);
            const rotationIndex = rotation.entries.findIndex((e) => e.templateId === template.id);
            return (
              <div key={template.id} className={`px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setEditor({ mode: "edit", template })} className="flex-1 text-left min-w-0">
                    <div className="text-15 font-medium">{template.nom}</div>
                    <div className="text-13 text-graphite mt-0.5">
                      {template.exercises.length} exercice{template.exercises.length > 1 ? "s" : ""}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(template.id)}
                    aria-label={`Supprimer ${template.nom}`}
                    className="text-graphite flex-none w-9 h-9 flex items-center justify-center"
                  >
                    <IconClose size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button type="button" onClick={() => handleToggleRotation(template.id)} className={pillClass(inRotation)}>
                    {inRotation ? "Dans la rotation" : "Ajouter à la rotation"}
                  </button>
                  {inRotation && (
                    <>
                      <button
                        type="button"
                        aria-label={`Monter ${template.nom} dans la rotation`}
                        onClick={() => handleMoveRotation(template.id, -1)}
                        disabled={rotationIndex === 0}
                        className="w-9 h-9 flex items-center justify-center text-graphite disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Descendre ${template.nom} dans la rotation`}
                        onClick={() => handleMoveRotation(template.id, 1)}
                        disabled={rotationIndex === rotation.entries.length - 1}
                        className="w-9 h-9 flex items-center justify-center text-graphite disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/components/tracking/ProgrammeScreen.test.tsx`
Expected: all 8 tests PASS.

- [ ] **Step 5: Write the route page**

```tsx
// src/app/(shell)/tracking/programme/page.tsx
import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { listTemplates } from "@/lib/tracking/templates";
import { getRotation } from "@/lib/tracking/program";
import { listExercises } from "@/lib/tracking/db";
import { ProgrammeScreen } from "@/components/tracking/ProgrammeScreen";

export const dynamic = "force-dynamic";

export default async function TrackingProgrammePage() {
  const user = await currentUser();
  if (user.slug !== "clement") redirect("/");
  const db = getDbForUser(user);
  return (
    <ProgrammeScreen
      templates={listTemplates(db)}
      rotation={getRotation(db)}
      exerciseSuggestions={listExercises(db)}
    />
  );
}
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/tracking/ProgrammeScreen.tsx src/components/tracking/ProgrammeScreen.test.tsx \
  "src/app/(shell)/tracking/programme/page.tsx"
git commit -m "feat(tracking): écran de gestion des modèles et de la rotation"
```

---

### Task 13: Lien « Mon programme » depuis `TrackingScreen`

**Files:**
- Modify: `src/components/tracking/TrackingScreen.tsx`
- Modify: `src/components/tracking/TrackingScreen.test.tsx`

**Interfaces:**
- Consumes: the `/tracking/programme` route (Task 12).

- [ ] **Step 1: Write the failing test**

Append to `src/components/tracking/TrackingScreen.test.tsx`, inside the `describe("TrackingScreen", ...)` block:

```tsx
  it("links to the templates/rotation management screen", () => {
    render(<TrackingScreen state={{ activeSeance: null, seances: [], todayTemplate: null, rotationTemplates: [] }} />);
    expect(screen.getByRole("link", { name: "Mon programme" })).toHaveAttribute("href", "/tracking/programme");
  });
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/components/tracking/TrackingScreen.test.tsx`
Expected: FAIL — no "Mon programme" link yet.

- [ ] **Step 3: Add the link**

In `src/components/tracking/TrackingScreen.tsx`, right after the `<button onClick={handleStart} ...>Enregistrer une séance libre</button>` block, add:

```tsx
      <Link
        href="/tracking/programme"
        className="h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold"
      >
        Mon programme
      </Link>
```

(`Link` from `next/link` is already imported at the top of this file — no new import needed.)

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/components/tracking/TrackingScreen.test.tsx`
Expected: all tests PASS.

- [ ] **Step 5: Run the full suite and typecheck one last time**

Run: `npm test && npx tsc --noEmit`
Expected: everything PASSes, no type errors anywhere in the project.

- [ ] **Step 6: Commit**

```bash
git add src/components/tracking/TrackingScreen.tsx src/components/tracking/TrackingScreen.test.tsx
git commit -m "feat(tracking): lien vers la gestion du programme personnel depuis l'onglet Tracking"
```

---

## Manual QA (after Task 13)

Automated tests don't cover the guided player route end-to-end (`/player/tracking`, a Server Component page, isn't unit-tested in this codebase — same as `/player/page.tsx`). Before considering this done, run `npm run dev`, log in as Clément, and walk through once:

1. `/tracking/programme` → create a template ("Push") with 2 exercises → add it to the rotation.
2. Aujourd'hui → the Tracking card shows "Push" with its exercises → tap Commencer.
3. Complete every set through the guided player (rest timers should run, "Série terminée" → repos → next set/exercise automatically) → validate the séance on the summary screen.
4. Back on Aujourd'hui → the card should now be empty-rotation state or show the next template if more than one is in the rotation (pointer advanced).
5. `/tracking` → the completed séance appears in "Tes séances", with correct totals; `/trophees` → the exercises logged show up there too.
6. Quit a séance mid-way (✕ on the player) → Aujourd'hui shows "Reprendre" → confirm it resumes at the exact same set, not from scratch (the CLAUDE.md §2 regression this whole app was rewritten to avoid).
