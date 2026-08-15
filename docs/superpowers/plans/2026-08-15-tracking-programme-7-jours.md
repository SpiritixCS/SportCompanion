# Tracking — programme personnel calé sur 7 jours — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la bibliothèque de modèles + rotation de Tracking (Clément) par un programme fixe à 7 jours (Lundi→Dimanche), chaque jour repos ou séance avec sa propre liste d'exercices, et retirer le mode séance libre.

**Architecture:** Migration SQL qui supprime les tables modèles/rotation et crée `tracking_program_days` (7 lignes fixes) + `tracking_program_day_exercises` + `tracking_program_state` (pointeur 0-6). `src/lib/tracking/program.ts` réécrit comme unique point d'accès au programme (remplace `templates.ts` + l'ancien `program.ts`). Le player guidé existant (`PlayerScreen`/`deriveState`, génériques) est reclé sur `dayOfWeek` au lieu de `templateId`. `TrackingCard`/`TrackingScreen`/`ProgrammeScreen` perdent le mode libre et le concept de rotation variable.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), better-sqlite3, Vitest + Testing Library.

## Global Constraints

- Français partout — UI et code commenté en français si commentaire nécessaire.
- Le pointeur avance uniquement à la validation (séance ou bouton Jour suivant), jamais au calendrier.
- Pas de nom personnalisé par jour — juste l'intitulé de semaine (Lundi…Dimanche), calculé en code, jamais stocké.
- Migrations SQL versionnées, jamais éditées après coup — un nouveau fichier numéroté pour tout changement de schéma.
- `tracking_seances.program_day_of_week` n'a pas de `REFERENCES` (une séance loggée garde sa valeur même si la config du jour change ensuite) — cohérent avec l'ancien `template_id`.
- Test d'intégration obligatoire sur la persistance du player (démarrer, quitter, revenir — état intact).

---

## Task 1: Migration 0011 — schéma programme à 7 jours

**Files:**
- Create: `migrations/0011_tracking_program_days.sql`
- Create: `migrations/0011_tracking_program_days.test.ts`
- Modify: `migrations/0010_tracking_program.test.ts` (les tables qu'il vérifiait sont supprimées par 0011 — seule `tracking_skipped_exercises` survit)

**Interfaces:**
- Produces: colonnes/tables `tracking_program_days(day_of_week, is_rest)`, `tracking_program_day_exercises(id, day_of_week, ordre, exercise_name, unit, sets_count, target_value)`, `tracking_program_state(id, pointer_day_of_week)`, `tracking_seances.program_day_of_week` (renommée depuis `template_id`) — toutes les tâches suivantes lisent/écrivent ce schéma.

- [ ] **Step 1: Écrire la migration**

Créer `migrations/0011_tracking_program_days.sql` :

```sql
-- Ordre : enfants avant parents (tracking_program_state et
-- tracking_program_rotation référencent tracking_templates par FK ; ce
-- projet exécute avec PRAGMA foreign_keys=ON, cf. migration 0010).
DROP TABLE tracking_program_state;
DROP TABLE tracking_program_rotation;
DROP TABLE tracking_template_exercises;
DROP TABLE tracking_templates;

CREATE TABLE tracking_program_days (
  day_of_week INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Lundi … 6=Dimanche
  is_rest INTEGER NOT NULL DEFAULT 1 CHECK (is_rest IN (0, 1))
);

INSERT INTO tracking_program_days (day_of_week, is_rest) VALUES
  (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1);

CREATE TABLE tracking_program_day_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_of_week INTEGER NOT NULL REFERENCES tracking_program_days(day_of_week),
  ordre INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('reps', 'seconds')),
  sets_count INTEGER NOT NULL,
  target_value INTEGER NOT NULL,
  UNIQUE (day_of_week, ordre)
);

CREATE TABLE tracking_program_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pointer_day_of_week INTEGER NOT NULL DEFAULT 0 REFERENCES tracking_program_days(day_of_week)
);
INSERT INTO tracking_program_state (id, pointer_day_of_week) VALUES (1, 0);

ALTER TABLE tracking_seances RENAME COLUMN template_id TO program_day_of_week;
```

- [ ] **Step 2: Écrire le test de migration**

Créer `migrations/0011_tracking_program_days.test.ts` :

```ts
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

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-0011-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("0011_tracking_program_days migration", () => {
  it("applies and seeds the 7 program days as rest by default", () => {
    const db = setup();
    const rows = db
      .prepare(`SELECT day_of_week AS dayOfWeek, is_rest AS isRest FROM tracking_program_days ORDER BY day_of_week`)
      .all();
    expect(rows).toEqual([
      { dayOfWeek: 0, isRest: 1 },
      { dayOfWeek: 1, isRest: 1 },
      { dayOfWeek: 2, isRest: 1 },
      { dayOfWeek: 3, isRest: 1 },
      { dayOfWeek: 4, isRest: 1 },
      { dayOfWeek: 5, isRest: 1 },
      { dayOfWeek: 6, isRest: 1 },
    ]);
  });

  it("initializes the pointer at day 0", () => {
    const db = setup();
    const state = db
      .prepare(`SELECT pointer_day_of_week AS pointerDayOfWeek FROM tracking_program_state WHERE id = 1`)
      .get();
    expect(state).toEqual({ pointerDayOfWeek: 0 });
  });

  it("stores day exercises with a unique (day_of_week, ordre) pair", () => {
    const db = setup();
    db.prepare(
      `INSERT INTO tracking_program_day_exercises (day_of_week, ordre, exercise_name, unit, sets_count, target_value) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(0, 0, "Dips", "reps", 3, 12);
    expect(() =>
      db
        .prepare(
          `INSERT INTO tracking_program_day_exercises (day_of_week, ordre, exercise_name, unit, sets_count, target_value) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(0, 0, "Pompes", "reps", 3, 15),
    ).toThrow();
  });

  it("rejects a day exercise unit outside reps/seconds", () => {
    const db = setup();
    expect(() =>
      db
        .prepare(
          `INSERT INTO tracking_program_day_exercises (day_of_week, ordre, exercise_name, unit, sets_count, target_value) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(0, 0, "X", "kg", 3, 10),
    ).toThrow();
  });

  it("renames tracking_seances.template_id to program_day_of_week, nullable", () => {
    const db = setup();
    db.prepare(`INSERT INTO tracking_seances (started_at) VALUES (?)`).run("2026-08-15T00:00:00.000Z");
    const row = db.prepare(`SELECT program_day_of_week AS programDayOfWeek FROM tracking_seances`).get();
    expect(row).toEqual({ programDayOfWeek: null });
  });

  it("drops the old template/rotation tables", () => {
    const db = setup();
    expect(() => db.prepare(`SELECT 1 FROM tracking_templates`).get()).toThrow();
    expect(() => db.prepare(`SELECT 1 FROM tracking_program_rotation`).get()).toThrow();
    expect(() => db.prepare(`SELECT 1 FROM tracking_template_exercises`).get()).toThrow();
  });
});
```

- [ ] **Step 3: Run pour vérifier que le nouveau test passe**

Run: `npx vitest run migrations/0011_tracking_program_days.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 4: Corriger `migrations/0010_tracking_program.test.ts`**

Migration 0011 supprime les tables que ce test vérifiait (`tracking_templates`, `tracking_template_exercises`, `tracking_program_rotation`, `tracking_program_state`) et renomme la colonne qu'il testait (`template_id`). Le test tourne sur la chaîne complète de migrations (`runMigrations` applique tout jusqu'à la dernière) — il faut donc le réduire à ce qui survit réellement : `tracking_skipped_exercises`, créée par 0010 et jamais touchée par 0011.

Remplacer tout le contenu de `migrations/0010_tracking_program.test.ts` par :

```ts
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

// Les tables modèles/rotation/état créées par cette migration ont depuis été
// supprimées par 0011_tracking_program_days.sql (programme réécrit sur 7
// jours fixes) — seule tracking_skipped_exercises, introduite ici, survit
// inchangée et reste vérifiée.
describe("0010_tracking_program migration", () => {
  it("creates the tracking_skipped_exercises table", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0010_tracking_program.sql");

    const createdAt = "2026-08-15T00:00:00.000Z";
    const seance = db.prepare(`INSERT INTO tracking_seances (started_at) VALUES (?)`).run(createdAt);
    const seanceId = Number(seance.lastInsertRowid);
    db.prepare(`INSERT INTO tracking_skipped_exercises (seance_id, exercise_order, skipped_at) VALUES (?, ?, ?)`).run(
      seanceId,
      0,
      createdAt,
    );

    expect(
      db.prepare(`SELECT COUNT(*) AS n FROM tracking_skipped_exercises WHERE seance_id = ?`).get(seanceId),
    ).toMatchObject({ n: 1 });
  });
});
```

- [ ] **Step 5: Run toute la suite migrations**

Run: `npx vitest run migrations/`
Expected: PASS (tous les fichiers, y compris 0001…0011)

- [ ] **Step 6: Commit**

```bash
git add migrations/0011_tracking_program_days.sql migrations/0011_tracking_program_days.test.ts migrations/0010_tracking_program.test.ts
git commit -m "$(cat <<'EOF'
feat(tracking): migre le schéma programme vers 7 jours fixes (Lundi→Dimanche)

Supprime les tables modèles/rotation, crée tracking_program_days (7
lignes seedées) + tracking_program_day_exercises + un pointeur 0-6.
tracking_seances.template_id devient program_day_of_week.
EOF
)"
```

---

## Task 2: `db.ts` — renommer `templateId` en `dayOfWeek`

**Files:**
- Modify: `src/lib/tracking/db.ts:5,46-47,50-55,57-71`
- Test: `src/lib/tracking/db.test.ts:287-307`

**Interfaces:**
- Consumes: colonne `tracking_seances.program_day_of_week` (Task 1).
- Produces: `TrackingSeance = { id, startedAt, completedAt, dayOfWeek: number | null }`, `startSeance(db, dayOfWeek?)`, `getOrStartSeance(db, dayOfWeek?)` — toutes les tâches suivantes (program.ts, actions.ts, loadDayPlayerState, loadTrackingScreenState) lisent `.dayOfWeek` et appellent ces fonctions avec un `dayOfWeek`.

- [ ] **Step 1: Modifier le test en premier (TDD)**

Dans `src/lib/tracking/db.test.ts`, remplacer le bloc `describe("seance templateId", ...)` (lignes 287-307) par :

```ts
describe("seance dayOfWeek", () => {
  it("defaults to null when no day is given", () => {
    const db = setup();
    expect(startSeance(db).dayOfWeek).toBeNull();
  });

  it("carries the day of week through to getOrStartSeance and getActiveSeance", () => {
    const db = setup();
    startSeance(db, 5);
    expect(getActiveSeance(db)!.dayOfWeek).toBe(5);
    expect(getOrStartSeance(db, 5).dayOfWeek).toBe(5);
  });

  it("resumes whatever is active regardless of the dayOfWeek requested", () => {
    const db = setup();
    const started = startSeance(db, 5);
    const resumed = getOrStartSeance(db, 9);
    expect(resumed.id).toBe(started.id);
    expect(resumed.dayOfWeek).toBe(5);
  });
});
```

- [ ] **Step 2: Run pour vérifier que ça échoue**

Run: `npx vitest run src/lib/tracking/db.test.ts`
Expected: FAIL (`.dayOfWeek` est `undefined`, la colonne SQL s'appelle encore `template_id` côté code)

- [ ] **Step 3: Modifier `db.ts`**

Ligne 5, remplacer :
```ts
export type TrackingSeance = { id: number; startedAt: string; completedAt: string | null; templateId: number | null };
```
par :
```ts
export type TrackingSeance = { id: number; startedAt: string; completedAt: string | null; dayOfWeek: number | null };
```

Lignes 46-48, remplacer :
```ts
function mapSeance(row: { id: number; started_at: string; completed_at: string | null; template_id: number | null }): TrackingSeance {
  return { id: row.id, startedAt: row.started_at, completedAt: row.completed_at, templateId: row.template_id };
}
```
par :
```ts
function mapSeance(row: { id: number; started_at: string; completed_at: string | null; program_day_of_week: number | null }): TrackingSeance {
  return { id: row.id, startedAt: row.started_at, completedAt: row.completed_at, dayOfWeek: row.program_day_of_week };
}
```

Lignes 57-63, remplacer :
```ts
export function startSeance(db: Database.Database, templateId: number | null = null): TrackingSeance {
  const startedAt = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO tracking_seances (started_at, template_id) VALUES (?, ?)`)
    .run(startedAt, templateId);
  return { id: Number(result.lastInsertRowid), startedAt, completedAt: null, templateId };
}
```
par :
```ts
export function startSeance(db: Database.Database, dayOfWeek: number | null = null): TrackingSeance {
  const startedAt = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO tracking_seances (started_at, program_day_of_week) VALUES (?, ?)`)
    .run(startedAt, dayOfWeek);
  return { id: Number(result.lastInsertRowid), startedAt, completedAt: null, dayOfWeek };
}
```

Lignes 65-71 (commentaire + fonction), remplacer :
```ts
// Resumes whatever seance is active, regardless of the templateId requested —
// only one seance is ever active at a time (product invariant). Callers that
// care whether the resumed seance actually matches their context must check
// its .templateId themselves (see loadTemplatePlayerState's "wrong-seance" phase).
export function getOrStartSeance(db: Database.Database, templateId: number | null = null): TrackingSeance {
  return getActiveSeance(db) ?? startSeance(db, templateId);
}
```
par :
```ts
// Resumes whatever seance is active, regardless of the dayOfWeek requested —
// only one seance is ever active at a time (product invariant). Callers that
// care whether the resumed seance actually matches their context must check
// its .dayOfWeek themselves (see loadDayPlayerState's "wrong-seance" phase).
export function getOrStartSeance(db: Database.Database, dayOfWeek: number | null = null): TrackingSeance {
  return getActiveSeance(db) ?? startSeance(db, dayOfWeek);
}
```

- [ ] **Step 4: Run pour vérifier que tout passe**

Run: `npx vitest run src/lib/tracking/db.test.ts`
Expected: PASS (tous les tests du fichier, pas seulement le nouveau bloc)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracking/db.ts src/lib/tracking/db.test.ts
git commit -m "$(cat <<'EOF'
refactor(tracking): renomme templateId en dayOfWeek dans TrackingSeance

Suit le renommage de colonne de la migration 0011 — une séance
Tracking est désormais rattachée à un jour de semaine, plus à un modèle.
EOF
)"
```

---

## Task 3: `program.ts` réécrit — programme 7 jours + pointeur

**Files:**
- Delete: `src/lib/tracking/templates.ts`
- Delete: `src/lib/tracking/templates.test.ts`
- Modify (réécriture complète): `src/lib/tracking/program.ts`
- Modify (réécriture complète): `src/lib/tracking/program.test.ts`

**Interfaces:**
- Consumes: schéma `tracking_program_days` / `tracking_program_day_exercises` / `tracking_program_state` (Task 1).
- Produces:
  - `type DayExerciseInput = { name: string; unit: TrackingUnit; setsCount: number; targetValue: number }`
  - `type DayExercise = DayExerciseInput & { ordre: number }`
  - `type TrackingProgramDay = { dayOfWeek: number; label: string; isRest: boolean; exercises: DayExercise[] }`
  - `WEEKDAY_LABELS: readonly string[]` (index 0 = Lundi … 6 = Dimanche)
  - `getProgramDays(db): TrackingProgramDay[]` (toujours 7, dans l'ordre)
  - `getProgramDay(db, dayOfWeek): TrackingProgramDay`
  - `setDayRest(db, dayOfWeek, isRest): TrackingProgramDay`
  - `setDayExercises(db, dayOfWeek, exercises: DayExerciseInput[]): TrackingProgramDay`
  - `getPointer(db): number`
  - `advancePointer(db): number` (retourne le nouveau pointeur)

  Consommé par : Task 4 (`dayAsTrainDay`), Task 6 (`actions.ts`), Task 8 (`loadTrackingScreenState`), Task 12/13 (`ProgrammeScreen`, page programme).

- [ ] **Step 1: Supprimer `templates.ts` et son test**

```bash
git rm src/lib/tracking/templates.ts src/lib/tracking/templates.test.ts
```

- [ ] **Step 2: Écrire le test complet en premier (TDD)**

Remplacer tout le contenu de `src/lib/tracking/program.test.ts` par :

```ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { getProgramDays, getProgramDay, setDayRest, setDayExercises, getPointer, advancePointer, WEEKDAY_LABELS } from "./program";

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

describe("getProgramDays", () => {
  it("returns all 7 days in order, resting with no exercises", () => {
    const db = setup();
    const days = getProgramDays(db);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(days.map((d) => d.label)).toEqual([...WEEKDAY_LABELS]);
    expect(days.every((d) => d.isRest)).toBe(true);
    expect(days.every((d) => d.exercises.length === 0)).toBe(true);
  });
});

describe("getProgramDay", () => {
  it("returns a single day by index", () => {
    const db = setup();
    expect(getProgramDay(db, 2)).toEqual({ dayOfWeek: 2, label: "Mercredi", isRest: true, exercises: [] });
  });
});

describe("setDayRest", () => {
  it("toggles a day to séance and back to repos", () => {
    const db = setup();
    expect(setDayRest(db, 1, false).isRest).toBe(false);
    expect(getProgramDay(db, 1).isRest).toBe(false);
    expect(setDayRest(db, 1, true).isRest).toBe(true);
  });

  it("preserves exercises when toggling back to repos then séance", () => {
    const db = setup();
    setDayRest(db, 0, false);
    setDayExercises(db, 0, [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);
    setDayRest(db, 0, true);
    const day = setDayRest(db, 0, false);
    expect(day.exercises).toEqual([{ ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);
  });
});

describe("setDayExercises", () => {
  it("replaces the exercise list in block, in order", () => {
    const db = setup();
    setDayExercises(db, 0, [
      { name: "Développé couché", unit: "reps", setsCount: 4, targetValue: 8 },
      { name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 },
    ]);
    const updated = setDayExercises(db, 0, [{ name: "Pompes", unit: "reps", setsCount: 3, targetValue: 15 }]);
    expect(updated.exercises).toEqual([{ ordre: 0, name: "Pompes", unit: "reps", setsCount: 3, targetValue: 15 }]);
  });

  it("rejects an unknown dayOfWeek", () => {
    const db = setup();
    expect(() => setDayExercises(db, 9, [])).toThrow();
  });
});

describe("pointer", () => {
  it("starts at day 0", () => {
    const db = setup();
    expect(getPointer(db)).toBe(0);
  });

  it("advances by 1 and wraps around after day 6", () => {
    const db = setup();
    for (let expected = 1; expected <= 6; expected++) {
      expect(advancePointer(db)).toBe(expected);
    }
    expect(advancePointer(db)).toBe(0);
  });
});
```

- [ ] **Step 3: Run pour vérifier que ça échoue**

Run: `npx vitest run src/lib/tracking/program.test.ts`
Expected: FAIL (module `./program` n'exporte encore aucune de ces fonctions)

- [ ] **Step 4: Réécrire `program.ts`**

Remplacer tout le contenu de `src/lib/tracking/program.ts` par :

```ts
// src/lib/tracking/program.ts
import type Database from "better-sqlite3";
import type { TrackingUnit } from "./db";

export const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

export type DayExerciseInput = { name: string; unit: TrackingUnit; setsCount: number; targetValue: number };
export type DayExercise = DayExerciseInput & { ordre: number };
export type TrackingProgramDay = { dayOfWeek: number; label: string; isRest: boolean; exercises: DayExercise[] };

function getDayExercises(db: Database.Database, dayOfWeek: number): DayExercise[] {
  return db
    .prepare(
      `SELECT ordre, exercise_name AS name, unit, sets_count AS setsCount, target_value AS targetValue
       FROM tracking_program_day_exercises WHERE day_of_week = ? ORDER BY ordre ASC`,
    )
    .all(dayOfWeek) as DayExercise[];
}

export function getProgramDay(db: Database.Database, dayOfWeek: number): TrackingProgramDay {
  const row = db.prepare(`SELECT is_rest AS isRest FROM tracking_program_days WHERE day_of_week = ?`).get(dayOfWeek) as
    | { isRest: number }
    | undefined;
  if (!row) throw new Error(`Jour de semaine inconnu : ${dayOfWeek}`);
  return {
    dayOfWeek,
    label: WEEKDAY_LABELS[dayOfWeek]!,
    isRest: row.isRest === 1,
    exercises: getDayExercises(db, dayOfWeek),
  };
}

export function getProgramDays(db: Database.Database): TrackingProgramDay[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => getProgramDay(db, dayOfWeek));
}

export function setDayRest(db: Database.Database, dayOfWeek: number, isRest: boolean): TrackingProgramDay {
  db.prepare(`UPDATE tracking_program_days SET is_rest = ? WHERE day_of_week = ?`).run(isRest ? 1 : 0, dayOfWeek);
  return getProgramDay(db, dayOfWeek);
}

export function setDayExercises(db: Database.Database, dayOfWeek: number, exercises: DayExerciseInput[]): TrackingProgramDay {
  const apply = db.transaction(() => {
    db.prepare(`DELETE FROM tracking_program_day_exercises WHERE day_of_week = ?`).run(dayOfWeek);
    const insert = db.prepare(
      `INSERT INTO tracking_program_day_exercises (day_of_week, ordre, exercise_name, unit, sets_count, target_value)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    exercises.forEach((exercise, ordre) =>
      insert.run(dayOfWeek, ordre, exercise.name, exercise.unit, exercise.setsCount, exercise.targetValue),
    );
  });
  apply();
  return getProgramDay(db, dayOfWeek);
}

export function getPointer(db: Database.Database): number {
  const row = db.prepare(`SELECT pointer_day_of_week AS pointerDayOfWeek FROM tracking_program_state WHERE id = 1`).get() as {
    pointerDayOfWeek: number;
  };
  return row.pointerDayOfWeek;
}

export function advancePointer(db: Database.Database): number {
  const next = (getPointer(db) + 1) % 7;
  db.prepare(`UPDATE tracking_program_state SET pointer_day_of_week = ? WHERE id = 1`).run(next);
  return next;
}
```

- [ ] **Step 5: Run pour vérifier que tout passe**

Run: `npx vitest run src/lib/tracking/program.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 6: tsc pour repérer les imports cassés ailleurs (attendu — traités dans les tâches suivantes)**

Run: `npx tsc --noEmit`
Expected: FAIL — erreurs dans `actions.ts`, `loadTrackingScreenState.ts`, `templateAsTrainDay.ts`, `loadTemplatePlayerState.ts`, `ProgrammeScreen.tsx`, `TemplateEditor.tsx`, les pages `player/tracking` et `tracking/programme`, et leurs tests. Normal à ce stade — chaque fichier est corrigé dans une tâche dédiée ci-dessous. Ne pas continuer à corriger ici.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tracking/program.ts src/lib/tracking/program.test.ts
git rm src/lib/tracking/templates.ts src/lib/tracking/templates.test.ts
git commit -m "$(cat <<'EOF'
feat(tracking): réécrit program.ts pour le programme 7 jours

Remplace templates.ts + l'ancienne rotation par un accès direct aux
7 jours fixes (repos/séance, exercices, pointeur 0-6 qui boucle).
EOF
)"
```

---

## Task 4: `dayAsTrainDay.ts` (remplace `templateAsTrainDay.ts`)

**Files:**
- Delete: `src/lib/tracking/templateAsTrainDay.ts`
- Delete: `src/lib/tracking/templateAsTrainDay.test.ts`
- Create: `src/lib/tracking/dayAsTrainDay.ts`
- Create: `src/lib/tracking/dayAsTrainDay.test.ts`

**Interfaces:**
- Consumes: `TrackingProgramDay` (Task 3).
- Produces: `dayAsTrainDay(day: TrackingProgramDay): TrainDay` — consommé par Task 7 (route player).

- [ ] **Step 1: Supprimer les anciens fichiers**

```bash
git rm src/lib/tracking/templateAsTrainDay.ts src/lib/tracking/templateAsTrainDay.test.ts
```

- [ ] **Step 2: Écrire le test en premier (TDD)**

Créer `src/lib/tracking/dayAsTrainDay.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { dayAsTrainDay } from "./dayAsTrainDay";
import type { TrackingProgramDay } from "./program";

const DAY: TrackingProgramDay = {
  dayOfWeek: 0,
  label: "Lundi",
  isRest: false,
  exercises: [
    { ordre: 0, name: "Développé couché", unit: "reps", setsCount: 4, targetValue: 8 },
    { ordre: 1, name: "Planche", unit: "seconds", setsCount: 3, targetValue: 45 },
  ],
};

describe("dayAsTrainDay", () => {
  it("maps each day exercise to a TrainDay exercise with a single uniform target", () => {
    expect(dayAsTrainDay(DAY)).toEqual({
      kind: "train",
      label: "Lundi",
      exercises: [
        {
          id: "day-0-0",
          name: "Développé couché",
          movementFamily: "other",
          countsInStats: true,
          videoId: null,
          sets: 4,
          target: { unit: "reps", value: 8, maxEffort: false, eachSide: false },
        },
        {
          id: "day-0-1",
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

  it("maps a day with no exercises to an empty exercise list", () => {
    expect(dayAsTrainDay({ ...DAY, exercises: [] }).exercises).toEqual([]);
  });
});
```

- [ ] **Step 3: Run pour vérifier que ça échoue**

Run: `npx vitest run src/lib/tracking/dayAsTrainDay.test.ts`
Expected: FAIL (`Cannot find module './dayAsTrainDay'`)

- [ ] **Step 4: Écrire `dayAsTrainDay.ts`**

```ts
// src/lib/tracking/dayAsTrainDay.ts
import type { TrainDay } from "@/lib/workout/types";
import type { TrackingProgramDay } from "./program";

// A synthetic exercise id, e.g. "day-0-0" — only ever used as an image-src
// key by ExerciseView (`/exercises/{id}.jpg`); a missing file already falls
// back gracefully there (imageFailed), so no thumbnail is needed for a
// user-authored exercise.
export function dayAsTrainDay(day: TrackingProgramDay): TrainDay {
  return {
    kind: "train",
    label: day.label,
    exercises: day.exercises.map((exercise) => ({
      id: `day-${day.dayOfWeek}-${exercise.ordre}`,
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

- [ ] **Step 5: Run pour vérifier que ça passe**

Run: `npx vitest run src/lib/tracking/dayAsTrainDay.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/tracking/dayAsTrainDay.ts src/lib/tracking/dayAsTrainDay.test.ts
git rm src/lib/tracking/templateAsTrainDay.ts src/lib/tracking/templateAsTrainDay.test.ts
git commit -m "feat(tracking): dayAsTrainDay remplace templateAsTrainDay"
```

---

## Task 5: `loadDayPlayerState.ts` (remplace `loadTemplatePlayerState.ts`)

**Files:**
- Delete: `src/lib/tracking/loadTemplatePlayerState.ts`
- Delete: `src/lib/tracking/loadTemplatePlayerState.test.ts`
- Create: `src/lib/tracking/loadDayPlayerState.ts`
- Create: `src/lib/tracking/loadDayPlayerState.test.ts`

**Interfaces:**
- Consumes: `getOrStartSeance(db, dayOfWeek)` avec `.dayOfWeek` (Task 2), `deriveState` (`src/lib/player/deriveState.ts`, inchangé), `getSetsForSeance`/`getSkippedExercises` (`db.ts`, inchangés).
- Produces: `type DayPlayerState = { phase: "in-progress" | "pending-validation" | "completed" | "wrong-seance"; ... }`, `loadDayPlayerState(db, dayOfWeek, day: TrainDay): DayPlayerState` — consommé par Task 7 (route player).

- [ ] **Step 1: Supprimer les anciens fichiers**

```bash
git rm src/lib/tracking/loadTemplatePlayerState.ts src/lib/tracking/loadTemplatePlayerState.test.ts
```

- [ ] **Step 2: Écrire le test en premier (TDD)**

Créer `src/lib/tracking/loadDayPlayerState.test.ts` :

```ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, completeSeance, logSetForExercise } from "./db";
import { loadDayPlayerState } from "./loadDayPlayerState";
import type { TrainDay } from "@/lib/workout/types";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-day-player-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

const DAY: TrainDay = {
  kind: "train",
  label: "Lundi",
  exercises: [
    {
      id: "day-0-0",
      name: "Développé couché",
      movementFamily: "other",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 8, maxEffort: false, eachSide: false },
    },
  ],
};

describe("loadDayPlayerState", () => {
  it("starts a fresh seance in-progress at the first set when nothing is active", () => {
    const db = setup();
    const state = loadDayPlayerState(db, 0, DAY);
    expect(state.phase).toBe("in-progress");
    if (state.phase === "in-progress") {
      expect(state.next).toEqual({ exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: true });
    }
  });

  it("reaches pending-validation once every set is logged", () => {
    const db = setup();
    const seance = startSeance(db, 0);
    logSetForExercise(db, seance.id, "Développé couché", "reps", 8, 2, 0);
    expect(loadDayPlayerState(db, 0, DAY).phase).toBe("pending-validation");
  });

  it("starts a fresh seance once the previous one is validated (a day stays redoable)", () => {
    const db = setup();
    const seance = startSeance(db, 0);
    completeSeance(db, seance.id);

    const state = loadDayPlayerState(db, 0, DAY);
    expect(state.phase).toBe("in-progress");
    if (state.phase === "in-progress") {
      expect(state.seanceId).not.toBe(seance.id);
      expect(state.next).toEqual({ exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: true });
    }
  });

  it("stays playable across repeated complete/replay cycles", () => {
    const db = setup();

    const first = startSeance(db, 0);
    logSetForExercise(db, first.id, "Développé couché", "reps", 8, 2, 0);
    completeSeance(db, first.id);

    const second = loadDayPlayerState(db, 0, DAY);
    expect(second.phase).toBe("in-progress");
    expect(second.seanceId).not.toBe(first.id);

    logSetForExercise(db, second.seanceId, "Développé couché", "reps", 8, 2, 0);
    completeSeance(db, second.seanceId);

    const third = loadDayPlayerState(db, 0, DAY);
    expect(third.phase).toBe("in-progress");
    expect(third.seanceId).not.toBe(first.id);
    expect(third.seanceId).not.toBe(second.seanceId);
  });

  it("flags wrong-seance when the active seance belongs to a different day", () => {
    const db = setup();
    startSeance(db, 1);
    expect(loadDayPlayerState(db, 0, DAY).phase).toBe("wrong-seance");
  });

  it("flags wrong-seance when the active seance has no day (legacy freeform)", () => {
    const db = setup();
    startSeance(db, null);
    expect(loadDayPlayerState(db, 0, DAY).phase).toBe("wrong-seance");
  });
});
```

- [ ] **Step 3: Run pour vérifier que ça échoue**

Run: `npx vitest run src/lib/tracking/loadDayPlayerState.test.ts`
Expected: FAIL (`Cannot find module './loadDayPlayerState'`)

- [ ] **Step 4: Écrire `loadDayPlayerState.ts`**

```ts
// src/lib/tracking/loadDayPlayerState.ts
import type Database from "better-sqlite3";
import type { TrainDay } from "@/lib/workout/types";
import { deriveState, type NextSet } from "@/lib/player/deriveState";
import { getOrStartSeance, getSetsForSeance, getSkippedExercises } from "./db";

export type DayPlayerState =
  | { phase: "in-progress"; seanceId: number; startedAt: string; next: NextSet; skippedExerciseOrders: number[] }
  | { phase: "pending-validation"; seanceId: number; startedAt: string }
  | { phase: "completed"; seanceId: number }
  | { phase: "wrong-seance"; seanceId: number };

export function loadDayPlayerState(db: Database.Database, dayOfWeek: number, day: TrainDay): DayPlayerState {
  const seance = getOrStartSeance(db, dayOfWeek);

  if (seance.dayOfWeek !== dayOfWeek) {
    return { phase: "wrong-seance", seanceId: seance.id };
  }

  // seance.completedAt est toujours null ici — getOrStartSeance ne renvoie que
  // la séance active (non validée) ou une séance fraîchement démarrée — donc un
  // jour reste rejouable indéfiniment, exactement comme un jour de Programme
  // (CLAUDE.md §5, « refaire un niveau »). Cette branche reste inatteignable,
  // gardée pour la parité de type avec loadPlayerState.ts.
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

- [ ] **Step 5: Run pour vérifier que ça passe**

Run: `npx vitest run src/lib/tracking/loadDayPlayerState.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/tracking/loadDayPlayerState.ts src/lib/tracking/loadDayPlayerState.test.ts
git rm src/lib/tracking/loadTemplatePlayerState.ts src/lib/tracking/loadTemplatePlayerState.test.ts
git commit -m "feat(tracking): loadDayPlayerState remplace loadTemplatePlayerState"
```

---

## Task 6: `actions.ts` — actions du programme 7 jours

**Files:**
- Modify (réécriture complète): `src/lib/tracking/actions.ts`

**Interfaces:**
- Consumes: `getProgramDay`, `setDayRest`, `setDayExercises`, `advancePointer`, `DayExerciseInput`, `TrackingProgramDay` (Task 3) ; `logSetForExercise`, `skipExercise`, `completeSeance` (`db.ts`, inchangés).
- Produces (server actions, consommées par les composants client des tâches suivantes) :
  - `setDayRestAction(dayOfWeek, isRest): Promise<TrackingProgramDay>`
  - `setDayExercisesAction(dayOfWeek, exercises): Promise<TrackingProgramDay>`
  - `advanceProgramDayAction(): Promise<number>`
  - `logDaySetAction(dayOfWeek, params): Promise<void>`
  - `skipDayExerciseAction(seanceId, exerciseOrder): Promise<void>`
  - `completeDaySeanceAction(seanceId): Promise<void>`
  - Conservées inchangées : `logTrackingSetAction`, `updateTrackingSetAction`, `deleteTrackingSetAction`, `deleteTrackingExerciseAction`, `deleteTrackingSeanceAction`, `completeTrackingSeanceAction` (revue d'historique, Task inchangée).
  - Supprimées : `startTrackingSeanceAction`, `createTemplateAction`, `updateTemplateAction`, `deleteTemplateAction`, `setRotationAction`.

Pas de test dédié : ce fichier n'a pas de suite directe dans le repo (convention existante — les server actions sont de fines enveloppes, exercées via les tests des composants qui les consomment, Tasks 9/10/12).

- [ ] **Step 1: Réécrire `actions.ts`**

Remplacer tout le contenu de `src/lib/tracking/actions.ts` par :

```ts
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
  getProgramDay,
  setDayRest as setDayRestDb,
  setDayExercises as setDayExercisesDb,
  advancePointer,
  type TrackingProgramDay,
  type DayExerciseInput,
} from "./program";

async function db() {
  return getDbForUser(await currentUser());
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

export async function setDayRestAction(dayOfWeek: number, isRest: boolean): Promise<TrackingProgramDay> {
  return setDayRestDb(await db(), dayOfWeek, isRest);
}

export async function setDayExercisesAction(dayOfWeek: number, exercises: DayExerciseInput[]): Promise<TrackingProgramDay> {
  return setDayExercisesDb(await db(), dayOfWeek, exercises);
}

// Avance le pointeur sans passer par une séance — utilisée par le bouton
// « Jour suivant » sur un jour repos, qui n'a rien à valider.
export async function advanceProgramDayAction(): Promise<number> {
  return advancePointer(await db());
}

// Bound with dayOfWeek via `.bind(null, dayOfWeek)` before being handed to
// PlayerScreen (a Client Component): a Server Component can only pass a
// Server Action reference across that boundary, never an inline closure —
// binding is how the player page attaches the day of week to each callback.
export async function logDaySetAction(
  dayOfWeek: number,
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
  const day = getProgramDay(database, dayOfWeek);
  const exercise = day.exercises.find((e) => e.ordre === params.exerciseOrder);
  if (!exercise) throw new Error("Exercice introuvable pour ce jour");
  logSetForExercise(database, params.seanceId, exercise.name, exercise.unit, params.repsActual, 1, params.exerciseOrder);
}

export async function skipDayExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipExerciseDb(await db(), seanceId, exerciseOrder);
}

export async function completeDaySeanceAction(seanceId: number): Promise<void> {
  const database = await db();
  completeSeanceDb(database, seanceId);
  advancePointer(database);
}
```

- [ ] **Step 2: tsc ciblé sur ce fichier**

Run: `npx tsc --noEmit`
Expected: les erreurs concernant `actions.ts` ont disparu ; celles des fichiers non encore migrés (pages, `ProgrammeScreen`, `TemplateEditor`, `loadTrackingScreenState`) persistent — normal, traitées dans les tâches suivantes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tracking/actions.ts
git commit -m "$(cat <<'EOF'
feat(tracking): actions du programme 7 jours, retire le mode libre

setDayRestAction/setDayExercisesAction/advanceProgramDayAction
remplacent la gestion de modèles/rotation. logDaySetAction,
skipDayExerciseAction, completeDaySeanceAction remplacent les
actions template. startTrackingSeanceAction et le CRUD modèles
supprimés (mode libre retiré).
EOF
)"
```

---

## Task 7: Route `/player/tracking` reclée sur `dayOfWeek`

**Files:**
- Modify (réécriture complète): `src/app/player/tracking/page.tsx`

**Interfaces:**
- Consumes: `getProgramDay` (Task 3), `dayAsTrainDay` (Task 4), `loadDayPlayerState` (Task 5), `logDaySetAction`/`skipDayExerciseAction`/`completeDaySeanceAction` (Task 6), `getSetsForSeance` (`db.ts`), `getSettings` (`@/lib/settings/db`, inchangé), `PlayerScreen` (`@/components/player/PlayerScreen`, inchangé — `onSeanceFinish: (seanceId: number) => Promise<void>` matche directement `completeDaySeanceAction`, plus besoin de `.bind`).
- Produces: page `/player/tracking?day=0..6` — consommée par les liens de Task 9 (`TrackingCard`) et Task 10 (`TrackingScreen`).

Pas de test dédié (page Server Component non testée unitairement dans ce repo, comme l'était `player/tracking/page.tsx` avant elle — vérifié par le test d'intégration de `loadDayPlayerState`, Task 5, et par la vérification manuelle en Task 14).

- [ ] **Step 1: Réécrire la page**

Remplacer tout le contenu de `src/app/player/tracking/page.tsx` par :

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSettings } from "@/lib/settings/db";
import { getProgramDay } from "@/lib/tracking/program";
import { dayAsTrainDay } from "@/lib/tracking/dayAsTrainDay";
import { loadDayPlayerState } from "@/lib/tracking/loadDayPlayerState";
import { getSetsForSeance } from "@/lib/tracking/db";
import { logDaySetAction, skipDayExerciseAction, completeDaySeanceAction } from "@/lib/tracking/actions";
import { PlayerScreen } from "@/components/player/PlayerScreen";

export default async function TrackingPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const user = await currentUser();
  if (user.slug !== "clement") redirect("/");

  const { day: dayParam } = await searchParams;
  const dayOfWeek = Number(dayParam);
  const db = getDbForUser(user);
  const programDay = getProgramDay(db, dayOfWeek);

  if (programDay.isRest || programDay.exercises.length === 0) {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Jour introuvable.</p>
        <Link href="/" className="text-15 text-graphite underline mt-4 inline-block">
          Retour à Aujourd&apos;hui
        </Link>
      </main>
    );
  }

  const day = dayAsTrainDay(programDay);
  const state = loadDayPlayerState(db, dayOfWeek, day);

  if (state.phase === "wrong-seance") {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">
          Une autre séance est déjà en cours. Termine-la ou quitte-la avant d&apos;en commencer une nouvelle.
        </p>
        <Link href="/" className="text-15 text-graphite underline mt-4 inline-block">
          Retour à Aujourd&apos;hui
        </Link>
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
      onLogSet={logDaySetAction.bind(null, dayOfWeek)}
      onSkipExercise={skipDayExerciseAction}
      onSeanceFinish={completeDaySeanceAction}
    />
  );
}
```

- [ ] **Step 2: tsc ciblé**

Run: `npx tsc --noEmit`
Expected: plus d'erreur sur `src/app/player/tracking/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/player/tracking/page.tsx
git commit -m "feat(tracking): route /player/tracking reclée sur ?day= au lieu de ?templateId="
```

---

## Task 8: `loadTrackingScreenState.ts` réécrit

**Files:**
- Modify (réécriture complète): `src/lib/tracking/loadTrackingScreenState.ts`
- Modify (réécriture complète): `src/lib/tracking/loadTrackingScreenState.test.ts`

**Interfaces:**
- Consumes: `getActiveSeance`/`getSetsForSeance`/`listCompletedSeances` (`db.ts`, `.dayOfWeek` depuis Task 2), `getPointer`/`getProgramDay` (Task 3).
- Produces: `TrackingScreenState = { programDay: TrackingProgramDay; activeSeance: { id, dayOfWeek, dayLabel, plannedExercises, loggedExercises } | null; seances: TrackingSeanceSummary[] }` — consommé par Task 9 (`TrackingCard`) et Task 10 (`TrackingScreen`).

- [ ] **Step 1: Écrire le test en premier (TDD)**

Remplacer tout le contenu de `src/lib/tracking/loadTrackingScreenState.test.ts` par :

```ts
// src/lib/tracking/loadTrackingScreenState.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSetForExercise, completeSeance } from "./db";
import { setDayRest, setDayExercises, advancePointer } from "./program";
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
  it("reports the day at the pointer (Lundi, repos par défaut), no active seance, no history initially", () => {
    const db = setup();
    expect(loadTrackingScreenState(db)).toEqual({
      programDay: { dayOfWeek: 0, label: "Lundi", isRest: true, exercises: [] },
      activeSeance: null,
      seances: [],
    });
  });

  it("reports the séance day at the pointer with its planned exercises", () => {
    const db = setup();
    setDayRest(db, 0, false);
    setDayExercises(db, 0, [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);

    const state = loadTrackingScreenState(db);
    expect(state.programDay).toEqual({
      dayOfWeek: 0,
      label: "Lundi",
      isRest: false,
      exercises: [{ ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }],
    });
  });

  it("surfaces the active seance's day, planned exercises and exercises logged so far, separately from completed history", () => {
    const db = setup();
    setDayRest(db, 0, false);
    setDayExercises(db, 0, [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);
    const active = startSeance(db, 0);
    logSetForExercise(db, active.id, "Dips", "reps", 12, 2);
    const past = startSeance(db);
    logSetForExercise(db, past.id, "Squats", "reps", 10);
    completeSeance(db, past.id);

    const state = loadTrackingScreenState(db);
    expect(state.activeSeance).toEqual({
      id: active.id,
      dayOfWeek: 0,
      dayLabel: "Lundi",
      plannedExercises: [{ ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }],
      loggedExercises: [{ name: "Dips", unit: "reps", setsCount: 2, totalValue: 24 }],
    });
    expect(state.seances).toHaveLength(1);
    expect(state.seances[0]!.id).toBe(past.id);
  });

  it("surfaces exercises logged so far, and no planned exercises, for a legacy seance with no day (freeform)", () => {
    const db = setup();
    const active = startSeance(db);
    logSetForExercise(db, active.id, "Squats", "reps", 10, 3);

    const state = loadTrackingScreenState(db);
    expect(state.activeSeance).toEqual({
      id: active.id,
      dayOfWeek: null,
      dayLabel: null,
      plannedExercises: null,
      loggedExercises: [{ name: "Squats", unit: "reps", setsCount: 3, totalValue: 30 }],
    });
  });

  it("reflects the pointer after it has advanced", () => {
    const db = setup();
    advancePointer(db);
    expect(loadTrackingScreenState(db).programDay.dayOfWeek).toBe(1);
    expect(loadTrackingScreenState(db).programDay.label).toBe("Mardi");
  });
});
```

- [ ] **Step 2: Run pour vérifier que ça échoue**

Run: `npx vitest run src/lib/tracking/loadTrackingScreenState.test.ts`
Expected: FAIL (le module importe encore `./templates`, inexistant)

- [ ] **Step 3: Réécrire `loadTrackingScreenState.ts`**

Remplacer tout le contenu de `src/lib/tracking/loadTrackingScreenState.ts` par :

```ts
// src/lib/tracking/loadTrackingScreenState.ts
import type Database from "better-sqlite3";
import { getActiveSeance, getSetsForSeance, listCompletedSeances, type TrackingSeanceSummary, type TrackingSetWithExercise, type TrackingUnit } from "./db";
import { getPointer, getProgramDay, type DayExercise, type TrackingProgramDay } from "./program";

type ActiveSeanceExercise = { name: string; unit: TrackingUnit; setsCount: number; totalValue: number };

export type TrackingScreenState = {
  programDay: TrackingProgramDay;
  activeSeance: {
    id: number;
    dayOfWeek: number | null;
    dayLabel: string | null;
    plannedExercises: DayExercise[] | null;
    loggedExercises: ActiveSeanceExercise[];
  } | null;
  seances: TrackingSeanceSummary[];
};

function summarizeActiveSets(sets: TrackingSetWithExercise[]): ActiveSeanceExercise[] {
  const byExercise = new Map<number, ActiveSeanceExercise & { order: number }>();
  for (const set of sets) {
    const entry = byExercise.get(set.exerciseId) ?? {
      name: set.exerciseName,
      unit: set.exerciseUnit,
      setsCount: 0,
      totalValue: 0,
      order: set.exerciseOrder,
    };
    entry.setsCount += 1;
    entry.totalValue += set.valeurActual;
    byExercise.set(set.exerciseId, entry);
  }
  return [...byExercise.values()].sort((a, b) => a.order - b.order).map(({ order, ...rest }) => rest);
}

export function loadTrackingScreenState(db: Database.Database): TrackingScreenState {
  const active = getActiveSeance(db);
  const programDay = getProgramDay(db, getPointer(db));
  const activeDay = active && active.dayOfWeek !== null ? getProgramDay(db, active.dayOfWeek) : null;

  return {
    programDay,
    activeSeance: active
      ? {
          id: active.id,
          dayOfWeek: active.dayOfWeek,
          dayLabel: activeDay?.label ?? null,
          plannedExercises: activeDay?.exercises ?? null,
          loggedExercises: summarizeActiveSets(getSetsForSeance(db, active.id)),
        }
      : null,
    seances: listCompletedSeances(db),
  };
}
```

- [ ] **Step 4: Run pour vérifier que ça passe**

Run: `npx vitest run src/lib/tracking/loadTrackingScreenState.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracking/loadTrackingScreenState.ts src/lib/tracking/loadTrackingScreenState.test.ts
git commit -m "feat(tracking): loadTrackingScreenState expose le jour du pointeur au lieu de todayTemplate/rotationTemplates"
```

---

## Task 9: `TrackingCard.tsx` — 3 états, retrait du mode libre

**Files:**
- Modify (réécriture complète): `src/components/today/TrackingCard.tsx`
- Modify (réécriture complète): `src/components/today/TrackingCard.test.tsx`
- Modify: `src/components/today/AujourdhuiScreen.test.tsx:192-193` (forme de `activeSeance` dans l'état passé au test « level-up »)

**Interfaces:**
- Consumes: `TrackingScreenState` (Task 8), `advanceProgramDayAction` (Task 6).
- Produces: composant `TrackingCard({ state })` — consommé par `AujourdhuiScreen.tsx` (inchangé, prop `state` conserve le même type).

- [ ] **Step 1: Écrire le test en premier (TDD)**

Remplacer tout le contenu de `src/components/today/TrackingCard.test.tsx` par :

```ts
// src/components/today/TrackingCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingCard } from "./TrackingCard";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const advanceProgramDayAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  advanceProgramDayAction: (...args: unknown[]) => advanceProgramDayAction(...args),
}));

const REST_STATE: TrackingScreenState = {
  programDay: { dayOfWeek: 0, label: "Lundi", isRest: true, exercises: [] },
  activeSeance: null,
  seances: [],
};

describe("TrackingCard", () => {
  it("shows Repos and advances the pointer on Jour suivant when today is a rest day", async () => {
    advanceProgramDayAction.mockResolvedValue(1);
    render(<TrackingCard state={REST_STATE} />);
    expect(screen.getByText("Lundi · Repos")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Jour suivant" }));
    expect(advanceProgramDayAction).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the day's name, exercises and a Commencer link into the guided player on a séance day", () => {
    render(
      <TrackingCard
        state={{
          ...REST_STATE,
          programDay: {
            dayOfWeek: 0,
            label: "Lundi",
            isRest: false,
            exercises: [{ ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }],
          },
        }}
      />,
    );
    expect(screen.getByText("Lundi")).toBeInTheDocument();
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Commencer" })).toHaveAttribute("href", "/player/tracking?day=0");
  });

  it("shows Reprendre linking to the guided player when a seance is active for a day", () => {
    render(
      <TrackingCard
        state={{
          ...REST_STATE,
          activeSeance: { id: 7, dayOfWeek: 3, dayLabel: "Jeudi", plannedExercises: [], loggedExercises: [] },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/player/tracking?day=3");
  });

  it("shows Reprendre linking to the freeform journal for a legacy active seance with no day", () => {
    render(
      <TrackingCard
        state={{
          ...REST_STATE,
          activeSeance: { id: 7, dayOfWeek: null, dayLabel: null, plannedExercises: null, loggedExercises: [] },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/tracking/7");
  });

  it("shows the day's planned exercises for an active seance", () => {
    render(
      <TrackingCard
        state={{
          ...REST_STATE,
          activeSeance: {
            id: 7,
            dayOfWeek: 0,
            dayLabel: "Lundi",
            plannedExercises: [
              { ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 },
              { ordre: 1, name: "Gainage", unit: "seconds", setsCount: 2, targetValue: 45 },
            ],
            loggedExercises: [{ name: "Dips", unit: "reps", setsCount: 2, totalValue: 24 }],
          },
        }}
      />,
    );
    expect(screen.getByText("Lundi")).toBeInTheDocument();
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
    expect(screen.getByText("Gainage")).toBeInTheDocument();
    expect(screen.getByText("2 × 45 s")).toBeInTheDocument();
  });

  it("shows exercises logged so far for a legacy active freeform seance (no day)", () => {
    render(
      <TrackingCard
        state={{
          ...REST_STATE,
          activeSeance: {
            id: 7,
            dayOfWeek: null,
            dayLabel: null,
            plannedExercises: null,
            loggedExercises: [
              { name: "Dips", unit: "reps", setsCount: 2, totalValue: 24 },
              { name: "Gainage", unit: "seconds", setsCount: 1, totalValue: 45 },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("45 s")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run pour vérifier que ça échoue**

Run: `npx vitest run src/components/today/TrackingCard.test.tsx`
Expected: FAIL (composant importe encore `startTrackingSeanceAction`, forme de state obsolète)

- [ ] **Step 3: Réécrire `TrackingCard.tsx`**

Remplacer tout le contenu de `src/components/today/TrackingCard.tsx` par :

```tsx
// src/components/today/TrackingCard.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { advanceProgramDayAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

function doseLabel(exercise: { setsCount: number; targetValue: number; unit: "reps" | "seconds" }): string {
  return `${exercise.setsCount} × ${exercise.targetValue}${exercise.unit === "seconds" ? " s" : ""}`;
}

export function TrackingCard({ state }: { state: TrackingScreenState }) {
  const router = useRouter();
  const [advancing, setAdvancing] = useState(false);

  async function handleAdvance() {
    if (advancing) return;
    setAdvancing(true);
    try {
      await advanceProgramDayAction();
      router.refresh();
    } finally {
      setAdvancing(false);
    }
  }

  if (state.activeSeance !== null) {
    const { activeSeance } = state;
    const href =
      activeSeance.dayOfWeek !== null ? `/player/tracking?day=${activeSeance.dayOfWeek}` : `/tracking/${activeSeance.id}`;
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-18 font-semibold mt-3">{activeSeance.dayLabel ?? "Séance en cours"}</div>

        {activeSeance.plannedExercises !== null ? (
          activeSeance.plannedExercises.length > 0 && (
            <div className="flex flex-col gap-2.5 mt-5">
              {activeSeance.plannedExercises.map((exercise) => (
                <div key={exercise.ordre} className="flex items-baseline justify-between gap-4">
                  <span className="text-15">{exercise.name}</span>
                  <span className="font-archivo text-15 font-medium text-graphite tabular-nums whitespace-nowrap">
                    {doseLabel(exercise)}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          activeSeance.loggedExercises.length > 0 && (
            <div className="flex flex-col gap-2.5 mt-5">
              {activeSeance.loggedExercises.map((exercise) => (
                <div key={exercise.name} className="flex items-baseline justify-between gap-4">
                  <span className="text-15">{exercise.name}</span>
                  <span className="font-archivo text-15 font-medium text-graphite tabular-nums whitespace-nowrap">
                    {exercise.totalValue}
                    {exercise.unit === "seconds" ? " s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        <Link
          href={href}
          className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Reprendre
        </Link>
      </Card>
    );
  }

  const { programDay } = state;

  if (programDay.isRest) {
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-18 font-semibold mt-3">{programDay.label} · Repos</div>
        <button
          type="button"
          onClick={handleAdvance}
          disabled={advancing}
          className="mt-5 w-full h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold disabled:opacity-40"
        >
          Jour suivant
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
      <div className="font-archivo text-24 font-semibold mt-3.5">{programDay.label}</div>

      {programDay.exercises.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-5">
          {programDay.exercises.map((exercise) => (
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
        href={`/player/tracking?day=${programDay.dayOfWeek}`}
        className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
      >
        Commencer
      </Link>
    </Card>
  );
}
```

- [ ] **Step 4: Run pour vérifier que ça passe**

Run: `npx vitest run src/components/today/TrackingCard.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Corriger `AujourdhuiScreen.test.tsx`**

Ligne 192-193, remplacer :
```ts
        trackingState={{
          activeSeance: { id: 3, templateId: null, templateNom: null, templateExercises: null, loggedExercises: [] },
          seances: [],
          todayTemplate: null,
          rotationTemplates: [],
        }}
```
par :
```ts
        trackingState={{
          programDay: { dayOfWeek: 0, label: "Lundi", isRest: true, exercises: [] },
          activeSeance: { id: 3, dayOfWeek: null, dayLabel: null, plannedExercises: null, loggedExercises: [] },
          seances: [],
        }}
```

- [ ] **Step 6: Run la suite `today`**

Run: `npx vitest run src/components/today/`
Expected: PASS (tous les fichiers du dossier)

- [ ] **Step 7: Commit**

```bash
git add src/components/today/TrackingCard.tsx src/components/today/TrackingCard.test.tsx src/components/today/AujourdhuiScreen.test.tsx
git commit -m "$(cat <<'EOF'
feat(tracking): TrackingCard affiche le jour du programme (repos/séance/en cours)

Retire le mode libre et le bouton Changer — le cycle des 7 jours est
fixe, plus de rotation variable à réordonner depuis Aujourd'hui.
EOF
)"
```

---

## Task 10: `TrackingScreen.tsx` — retrait du mode libre

**Files:**
- Modify: `src/components/tracking/TrackingScreen.tsx`
- Modify (réécriture complète): `src/components/tracking/TrackingScreen.test.tsx`

**Interfaces:**
- Consumes: `TrackingScreenState` (Task 8, sans `todayTemplate`/`rotationTemplates`), `deleteTrackingSeanceAction` (`actions.ts`, inchangée).
- Produces: composant `TrackingScreen({ state })`, inchangé pour son appelant `src/app/(shell)/tracking/page.tsx` (aucune modification requise sur cette page — elle transmet déjà `state` tel quel).

- [ ] **Step 1: Écrire le test en premier (TDD)**

Remplacer tout le contenu de `src/components/tracking/TrackingScreen.test.tsx` par :

```ts
// src/components/tracking/TrackingScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingScreen } from "./TrackingScreen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const deleteTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  deleteTrackingSeanceAction: (...args: unknown[]) => deleteTrackingSeanceAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const REST_DAY = { dayOfWeek: 0, label: "Lundi", isRest: true, exercises: [] };
const EMPTY_STATE = { programDay: REST_DAY, activeSeance: null, seances: [] };

describe("TrackingScreen", () => {
  it("shows the empty state with no history", () => {
    render(<TrackingScreen state={EMPTY_STATE} />);
    expect(screen.getByText("Aucune séance enregistrée pour l'instant.")).toBeInTheDocument();
  });

  it("lists completed seances with their total reps", () => {
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
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
          ...EMPTY_STATE,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 90, exerciseCount: 4 }],
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
          ...EMPTY_STATE,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 0, totalSeconds: 60, exerciseCount: 1 }],
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
          ...EMPTY_STATE,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /42/ })).toHaveAttribute("href", "/tracking/5");
  });

  it("deletes a seance and refreshes the list on click", async () => {
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
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
          ...EMPTY_STATE,
          seances: [{ id: 5, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, totalSeconds: 0, exerciseCount: 3 }],
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Supprimer la séance" }));
    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a resume banner pointing at the guided player when a seance is active for a day", () => {
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          activeSeance: { id: 7, dayOfWeek: 3, dayLabel: "Jeudi", plannedExercises: [], loggedExercises: [] },
        }}
      />,
    );
    expect(screen.getByText("Séance interrompue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Reprendre/ })).toHaveAttribute("href", "/player/tracking?day=3");
  });

  it("shows a resume banner pointing at the freeform journal for a legacy active seance with no day", () => {
    render(
      <TrackingScreen
        state={{
          ...EMPTY_STATE,
          activeSeance: { id: 7, dayOfWeek: null, dayLabel: null, plannedExercises: null, loggedExercises: [] },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /Reprendre/ })).toHaveAttribute("href", "/tracking/7");
  });

  it("links to the programme management screen", () => {
    render(<TrackingScreen state={EMPTY_STATE} />);
    expect(screen.getByRole("link", { name: "Mon programme" })).toHaveAttribute("href", "/tracking/programme");
  });

  it("has no freeform séance button", () => {
    render(<TrackingScreen state={EMPTY_STATE} />);
    expect(screen.queryByRole("button", { name: "Enregistrer une séance libre" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run pour vérifier que ça échoue**

Run: `npx vitest run src/components/tracking/TrackingScreen.test.tsx`
Expected: FAIL (bouton libre encore présent, `startTrackingSeanceAction` non mocké)

- [ ] **Step 3: Modifier `TrackingScreen.tsx`**

Retirer l'import et l'usage de `startTrackingSeanceAction`, le state `error`/`handleStart` lié au libre, et le bouton « Enregistrer une séance libre ». Remplacer tout le contenu de `src/components/tracking/TrackingScreen.tsx` par :

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { ResumeBanner } from "@/components/today/ResumeBanner";
import { IconClose } from "@/components/icons/IconClose";
import { deleteTrackingSeanceAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(iso));
}

export function TrackingScreen({ state }: { state: TrackingScreenState }) {
  const router = useRouter();
  const [error, setError] = useState(false);

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
        <ResumeBanner
          exerciseName="ta séance en cours"
          href={
            state.activeSeance.dayOfWeek !== null
              ? `/player/tracking?day=${state.activeSeance.dayOfWeek}`
              : `/tracking/${state.activeSeance.id}`
          }
          accent="sage"
        />
      )}

      {error && (
        <div className="bg-paper border border-hairline rounded-card p-6">
          <p className="text-15 text-graphite">Une erreur est survenue. Réessaie.</p>
        </div>
      )}

      <Link
        href="/tracking/programme"
        className="h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold"
      >
        Mon programme
      </Link>

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

- [ ] **Step 4: Run pour vérifier que ça passe**

Run: `npx vitest run src/components/tracking/TrackingScreen.test.tsx`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/tracking/TrackingScreen.tsx src/components/tracking/TrackingScreen.test.tsx
git commit -m "feat(tracking): TrackingScreen retire le bouton séance libre"
```

---

## Task 11: `DayEditor.tsx` (remplace `TemplateEditor.tsx`)

**Files:**
- Delete: `src/components/tracking/TemplateEditor.tsx`
- Delete: `src/components/tracking/TemplateEditor.test.tsx`
- Create: `src/components/tracking/DayEditor.tsx`
- Create: `src/components/tracking/DayEditor.test.tsx`

**Interfaces:**
- Consumes: `DayExerciseInput`, `TrackingUnit` (Task 3 / `db.ts`).
- Produces: `DayEditor({ initialExercises, exerciseSuggestions, saving, error, onSave: (exercises) => void, onCancel: () => void })` — consommé par Task 12 (`ProgrammeScreen`).

- [ ] **Step 1: Supprimer les anciens fichiers**

```bash
git rm src/components/tracking/TemplateEditor.tsx src/components/tracking/TemplateEditor.test.tsx
```

- [ ] **Step 2: Écrire le test en premier (TDD)**

Créer `src/components/tracking/DayEditor.test.tsx` :

```ts
// src/components/tracking/DayEditor.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayEditor } from "./DayEditor";

describe("DayEditor", () => {
  it("prompts to add the first exercise when starting empty", () => {
    render(<DayEditor initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("Ajoute ton premier exercice ci-dessous.")).toBeInTheDocument();
  });

  it("adds an exercise to the draft list from the form", async () => {
    render(<DayEditor initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Dips");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("3 × 10")).toBeInTheDocument();
  });

  it("locks the unit to a known exercise's unit", async () => {
    render(
      <DayEditor
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
      <DayEditor
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
      <DayEditor
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

  it("calls onSave with the draft exercise list", async () => {
    const onSave = vi.fn();
    render(
      <DayEditor
        initialExercises={[{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]}
        exerciseSuggestions={[]}
        saving={false}
        error={false}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).toHaveBeenCalledWith([{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);
  });

  it("disables Enregistrer with no exercise yet", () => {
    render(<DayEditor initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });

  it("calls onCancel from the Annuler button", async () => {
    const onCancel = vi.fn();
    render(<DayEditor initialExercises={[]} exerciseSuggestions={[]} saving={false} error={false} onSave={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run pour vérifier que ça échoue**

Run: `npx vitest run src/components/tracking/DayEditor.test.tsx`
Expected: FAIL (`Cannot find module './DayEditor'`)

- [ ] **Step 4: Écrire `DayEditor.tsx`**

Repris de `TemplateEditor.tsx`, moins le champ nom (le jour s'identifie par son intitulé de semaine, affiché par l'écran parent) :

```tsx
// src/components/tracking/DayEditor.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { IconClose } from "@/components/icons/IconClose";
import type { TrackingUnit } from "@/lib/tracking/db";
import type { DayExerciseInput } from "@/lib/tracking/program";

function pillClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium ${active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"}`;
}

export function DayEditor({
  initialExercises,
  exerciseSuggestions,
  saving,
  error,
  onSave,
  onCancel,
}: {
  initialExercises: DayExerciseInput[];
  exerciseSuggestions: { name: string; unit: TrackingUnit }[];
  saving: boolean;
  error: boolean;
  onSave: (exercises: DayExerciseInput[]) => void;
  onCancel: () => void;
}) {
  const [exercises, setExercises] = useState<DayExerciseInput[]>(initialExercises);
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
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Jour</span>

      {error && (
        <div className="bg-paper border border-hairline rounded-card p-6">
          <p className="text-15 text-graphite">Une erreur est survenue. Réessaie.</p>
        </div>
      )}

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
          list="day-exercise-suggestions"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de l'exercice"
          className="h-14 rounded-field border border-hairline px-4 text-15"
        />
        <datalist id="day-exercise-suggestions">
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
        <Button variant="primary" accent="sage" onClick={() => onSave(exercises)} disabled={saving || exercises.length === 0}>
          Enregistrer
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

- [ ] **Step 5: Run pour vérifier que ça passe**

Run: `npx vitest run src/components/tracking/DayEditor.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/tracking/DayEditor.tsx src/components/tracking/DayEditor.test.tsx
git rm src/components/tracking/TemplateEditor.tsx src/components/tracking/TemplateEditor.test.tsx
git commit -m "feat(tracking): DayEditor remplace TemplateEditor (sans champ nom)"
```

---

## Task 12: `ProgrammeScreen.tsx` réécrit — 7 lignes fixes

**Files:**
- Modify (réécriture complète): `src/components/tracking/ProgrammeScreen.tsx`
- Modify (réécriture complète): `src/components/tracking/ProgrammeScreen.test.tsx`

**Interfaces:**
- Consumes: `TrackingProgramDay` (Task 3), `DayEditor` (Task 11), `setDayRestAction`/`setDayExercisesAction` (Task 6).
- Produces: `ProgrammeScreen({ days, exerciseSuggestions })` — consommé par Task 13 (page `/tracking/programme`).

- [ ] **Step 1: Écrire le test en premier (TDD)**

Remplacer tout le contenu de `src/components/tracking/ProgrammeScreen.test.tsx` par :

```ts
// src/components/tracking/ProgrammeScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgrammeScreen } from "./ProgrammeScreen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const setDayRestAction = vi.fn();
const setDayExercisesAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  setDayRestAction: (...args: unknown[]) => setDayRestAction(...args),
  setDayExercisesAction: (...args: unknown[]) => setDayExercisesAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const REST_DAYS = WEEKDAY_LABELS.map((label, dayOfWeek) => ({ dayOfWeek, label, isRest: true, exercises: [] }));

describe("ProgrammeScreen", () => {
  it("lists all 7 weekdays as rest by default", () => {
    render(<ProgrammeScreen days={REST_DAYS} exerciseSuggestions={[]} />);
    for (const label of WEEKDAY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("switches a day to séance and back to repos", async () => {
    setDayRestAction.mockResolvedValue({ dayOfWeek: 0, label: "Lundi", isRest: false, exercises: [] });
    render(<ProgrammeScreen days={REST_DAYS} exerciseSuggestions={[]} />);
    const seanceButtons = screen.getAllByRole("button", { name: "Séance" });
    await userEvent.click(seanceButtons[0]!);
    expect(setDayRestAction).toHaveBeenCalledWith(0, false);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the exercise count and a Modifier button for a séance day", () => {
    const days = REST_DAYS.map((d, i) =>
      i === 0 ? { ...d, isRest: false, exercises: [{ ordre: 0, name: "Dips", unit: "reps" as const, setsCount: 3, targetValue: 12 }] } : d,
    );
    render(<ProgrammeScreen days={days} exerciseSuggestions={[]} />);
    expect(screen.getByText("1 exercice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modifier" })).toBeInTheDocument();
  });

  it("opens the day editor prefilled with its exercises on Modifier", async () => {
    const days = REST_DAYS.map((d, i) =>
      i === 0 ? { ...d, isRest: false, exercises: [{ ordre: 0, name: "Dips", unit: "reps" as const, setsCount: 3, targetValue: 12 }] } : d,
    );
    render(<ProgrammeScreen days={days} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Modifier" }));
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
  });

  it("saves the edited exercise list for the right day and refreshes", async () => {
    setDayExercisesAction.mockResolvedValue({ dayOfWeek: 2, label: "Mercredi", isRest: false, exercises: [] });
    const days = REST_DAYS.map((d, i) => (i === 2 ? { ...d, isRest: false, exercises: [] } : d));
    render(<ProgrammeScreen days={days} exerciseSuggestions={[]} />);
    const modifierButtons = screen.getAllByRole("button", { name: "Modifier" });
    await userEvent.click(modifierButtons[0]!);
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Dips");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter l'exercice" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(setDayExercisesAction).toHaveBeenCalledWith(2, [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 10 }]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows an error affordance when toggling a day fails", async () => {
    setDayRestAction.mockRejectedValueOnce(new Error("boom"));
    render(<ProgrammeScreen days={REST_DAYS} exerciseSuggestions={[]} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Séance" })[0]!);
    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run pour vérifier que ça échoue**

Run: `npx vitest run src/components/tracking/ProgrammeScreen.test.tsx`
Expected: FAIL (le composant importe encore les actions modèles/rotation supprimées)

- [ ] **Step 3: Réécrire `ProgrammeScreen.tsx`**

Remplacer tout le contenu de `src/components/tracking/ProgrammeScreen.tsx` par :

```tsx
// src/components/tracking/ProgrammeScreen.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { DayEditor } from "./DayEditor";
import { setDayRestAction, setDayExercisesAction } from "@/lib/tracking/actions";
import type { DayExerciseInput, TrackingProgramDay } from "@/lib/tracking/program";
import type { TrackingUnit } from "@/lib/tracking/db";

function pillClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium ${active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"}`;
}

export function ProgrammeScreen({
  days,
  exerciseSuggestions,
}: {
  days: TrackingProgramDay[];
  exerciseSuggestions: { name: string; unit: TrackingUnit }[];
}) {
  const router = useRouter();
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function handleToggleRest(dayOfWeek: number, isRest: boolean) {
    setError(false);
    try {
      await setDayRestAction(dayOfWeek, isRest);
      router.refresh();
    } catch {
      setError(true);
    }
  }

  async function handleSaveExercises(dayOfWeek: number, exercises: DayExerciseInput[]) {
    setSaving(true);
    setError(false);
    try {
      await setDayExercisesAction(dayOfWeek, exercises);
      setEditingDay(null);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (editingDay !== null) {
    const day = days.find((d) => d.dayOfWeek === editingDay)!;
    return (
      <DayEditor
        initialExercises={day.exercises}
        exerciseSuggestions={exerciseSuggestions}
        saving={saving}
        error={error}
        onSave={(exercises) => handleSaveExercises(editingDay, exercises)}
        onCancel={() => setEditingDay(null)}
      />
    );
  }

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

      <Card className="overflow-hidden">
        {days.map((day, i) => (
          <div key={day.dayOfWeek} className={`px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-15 font-medium">{day.label}</div>
                {!day.isRest && (
                  <div className="text-13 text-graphite mt-0.5">
                    {day.exercises.length} exercice{day.exercises.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
              {!day.isRest && (
                <button
                  type="button"
                  onClick={() => setEditingDay(day.dayOfWeek)}
                  className="h-9 px-3 rounded-pill border border-hairline text-13 font-medium text-ink"
                >
                  Modifier
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button type="button" onClick={() => handleToggleRest(day.dayOfWeek, false)} className={pillClass(!day.isRest)}>
                Séance
              </button>
              <button type="button" onClick={() => handleToggleRest(day.dayOfWeek, true)} className={pillClass(day.isRest)}>
                Repos
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run pour vérifier que ça passe**

Run: `npx vitest run src/components/tracking/ProgrammeScreen.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/tracking/ProgrammeScreen.tsx src/components/tracking/ProgrammeScreen.test.tsx
git commit -m "$(cat <<'EOF'
feat(tracking): ProgrammeScreen affiche les 7 jours fixes au lieu de modèles/rotation

Toggle Repos/Séance par jour, DayEditor pour la liste d'exercices —
plus de CRUD de modèles ni de réordonnancement de rotation.
EOF
)"
```

---

## Task 13: Page `/tracking/programme` — branchement final

**Files:**
- Modify: `src/app/(shell)/tracking/programme/page.tsx`

**Interfaces:**
- Consumes: `getProgramDays` (Task 3), `ProgrammeScreen` (Task 12).

Pas de test dédié (page Server Component, même convention que Task 7).

- [ ] **Step 1: Réécrire la page**

Remplacer tout le contenu de `src/app/(shell)/tracking/programme/page.tsx` par :

```tsx
import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getProgramDays } from "@/lib/tracking/program";
import { listExercises } from "@/lib/tracking/db";
import { ProgrammeScreen } from "@/components/tracking/ProgrammeScreen";

export const dynamic = "force-dynamic";

export default async function TrackingProgrammePage() {
  const user = await currentUser();
  if (user.slug !== "clement") redirect("/");
  const db = getDbForUser(user);
  return <ProgrammeScreen days={getProgramDays(db)} exerciseSuggestions={listExercises(db)} />;
}
```

- [ ] **Step 2: tsc complet**

Run: `npx tsc --noEmit`
Expected: PASS, aucune erreur dans tout le projet.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(shell\)/tracking/programme/page.tsx
git commit -m "feat(tracking): page programme branchée sur getProgramDays"
```

---

## Task 14: Vérification finale

**Files:** aucun changement de code — vérification uniquement.

- [ ] **Step 1: Suite de tests complète**

Run: `npx vitest run`
Expected: PASS, tous les fichiers (aucune régression sur BackPain/Programme/Trophées, non touchés par ce plan).

- [ ] **Step 2: Typecheck complet**

Run: `npx tsc --noEmit`
Expected: PASS, aucune erreur.

- [ ] **Step 3: Vérification manuelle en navigateur (Clément)**

Démarrer le serveur de dev, se connecter en tant que Clément, et vérifier à la main (CLAUDE.md exige un test navigateur pour tout changement UI) :
1. `/tracking/programme` : les 7 jours (Lundi…Dimanche) s'affichent, tous repos par défaut.
2. Passer un jour en Séance, cliquer Modifier, ajouter 1-2 exercices, Enregistrer — revient à la liste, le jour affiche le bon nombre d'exercices.
3. Aujourd'hui : si le pointeur est sur un jour repos → carte « Repos » + bouton Jour suivant qui avance au jour configuré.
4. Sur le jour configuré → carte affiche son nom + exercices + bouton Commencer → lance le player guidé.
5. Valider une série, quitter en cours de séance (croix), revenir sur Aujourd'hui → bandeau/carte « Reprendre » avec le bon détail (test de persistance CLAUDE.md §2).
6. Terminer la séance → récapitulatif → valider → pointeur avance, `/tracking` liste bien la séance dans l'historique.
7. Vérifier qu'aucun bouton « séance libre » n'apparaît nulle part.

Consigner ici tout écart trouvé et le corriger avant de considérer la tâche terminée.

- [ ] **Step 4: Commit final (si des ajustements ont été faits en Step 3)**

```bash
git add -A
git status
# committer uniquement si Step 3 a nécessité des corrections
```
