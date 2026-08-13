# Tracking — édition, unités, carte Aujourd'hui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tracking séances stay editable after validation, exercises carry a unit (reps or seconds) with bulk series entry, Trophées reflects units correctly, and Clément's Aujourd'hui gets a Tracking card mirroring Mathis's Dos card.

**Architecture:** Additive migration (`unit` column + column rename) on the existing Tracking tables. `unit` lives on `tracking_exercises`, fixed at creation, joined into every set read. `logSetForExercise` becomes bulk-capable (returns an array). New `updateSet`/`deleteSet` remove the `completed`-gates-editing behavior in the UI. Trophées groups by exercise as today but carries `unit` on every card; reps and seconds never sum into the same total.

**Tech Stack:** Next.js 16 (App Router, TypeScript, Server Components/Actions), `better-sqlite3`, Vitest + Testing Library.

## Global Constraints

- Reps et secondes ne se mélangent jamais dans un même total ou une même carte — Trophées `totalReps`, une carte Trophée, et le récap d'historique Tracking gardent les deux chiffres séparés.
- Unité choisie une seule fois, à la création de l'exercice — jamais modifiable après coup, pas de re-choix dans l'UI pour un exercice déjà connu.
- Édition (ajout, modification, suppression de série) toujours disponible, y compris sur une séance déjà « Terminée » — seule l'action « Terminer la séance » elle-même redevient masquée une fois déjà déclenchée.
- Aucune donnée réelle Tracking en prod à ce jour — migrations additives/renommage acceptées sans étape de backfill.
- Aucune couleur en dur — tout accent passe par la prop `accent` / les tokens existants (sage pour Tracking).
- Cibles tactiles ≥ 44px (56px actions primaires), rayons 20px cartes / 14px champs / 999px pastilles-boutons.

---

### Task 1: Migration SQL — unité + renommage

**Files:**
- Create: `migrations/0009_tracking_unit.sql`
- Create: `migrations/0009_tracking_unit.test.ts`

**Interfaces:**
- Produces: `tracking_exercises.unit` (`'reps' | 'seconds'`, défaut `'reps'`), `tracking_sets_logged.valeur_actual` (remplace `reps_actual`) — consommés par la Task 2.

- [ ] **Step 1: Write the migration**

```sql
-- migrations/0009_tracking_unit.sql
ALTER TABLE tracking_exercises ADD COLUMN unit TEXT NOT NULL DEFAULT 'reps' CHECK (unit IN ('reps', 'seconds'));
ALTER TABLE tracking_sets_logged RENAME COLUMN reps_actual TO valeur_actual;
```

- [ ] **Step 2: Write the test**

```ts
// migrations/0009_tracking_unit.test.ts
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

describe("0009_tracking_unit migration", () => {
  it("adds unit with a default of 'reps' and renames reps_actual to valeur_actual", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0009_tracking_unit.sql");

    db.prepare("INSERT INTO tracking_exercises (name, created_at) VALUES (?, ?)").run("Squats", "2026-08-13T00:00:00.000Z");
    const row = db.prepare("SELECT unit FROM tracking_exercises WHERE name = ?").get("Squats") as { unit: string };
    expect(row.unit).toBe("reps");

    expect(() => db.prepare("SELECT valeur_actual FROM tracking_sets_logged").all()).not.toThrow();
    expect(() => db.prepare("SELECT reps_actual FROM tracking_sets_logged").all()).toThrow();
  });

  it("rejects a unit outside reps/seconds", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));

    expect(() =>
      db.prepare("INSERT INTO tracking_exercises (name, unit, created_at) VALUES (?, ?, ?)").run("X", "kg", "2026-08-13T00:00:00.000Z"),
    ).toThrow();
  });
});
```

- [ ] **Step 3: Run the tests, verify pass**

Run: `npx vitest run migrations/0009_tracking_unit.test.ts`
Expected: both tests PASS.

- [ ] **Step 4: Commit**

```bash
git add migrations/0009_tracking_unit.sql migrations/0009_tracking_unit.test.ts
git commit -m "feat(db): ajoute l'unité par exercice Tracking et renomme reps_actual"
```

---

### Task 2: `src/lib/tracking/db.ts` — unité, séries en lot, édition, suppression

**Files:**
- Modify: `src/lib/tracking/db.ts`
- Modify: `src/lib/tracking/db.test.ts`

**Interfaces:**
- Consumes: `unit`/`valeur_actual` columns (Task 1).
- Produces: `TrackingExercise.unit`, `TrackingSetWithExercise.exerciseUnit`/`.valeurActual` (renamed from `.repsActual`), `TrackingSeanceSummary.totalReps`/`.totalSeconds`; `findOrCreateExercise(db, name, unit?)`; `listExercises(db): {name, unit}[]` (replaces `listExerciseNames`); `logSetForExercise(db, seanceId, exerciseName, unit, valeurActual, count?): TrackingSetWithExercise[]` (now returns an array, was a single record); `updateSet(db, setId, valeurActual): void`; `deleteSet(db, setId): void` — all consumed by Task 3 (actions) and Task 6 (screen).

- [ ] **Step 1: Write the failing tests**

Replace `src/lib/tracking/db.test.ts` in full:

```ts
// src/lib/tracking/db.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import {
  findOrCreateExercise,
  listExercises,
  getActiveSeance,
  startSeance,
  getOrStartSeance,
  getSeanceById,
  getSetsForSeance,
  logSetForExercise,
  updateSet,
  deleteSet,
  completeSeance,
  listCompletedSeances,
} from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-tracking-db-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("findOrCreateExercise", () => {
  it("creates a new exercise with the given unit", () => {
    const db = setup();
    const exercise = findOrCreateExercise(db, "Planche", "seconds");
    expect(exercise).toMatchObject({ name: "Planche", unit: "seconds" });
  });

  it("defaults to reps when no unit is passed", () => {
    const db = setup();
    expect(findOrCreateExercise(db, "Squats").unit).toBe("reps");
  });

  it("returns the same row on a second call, ignoring a different unit passed the second time", () => {
    const db = setup();
    const first = findOrCreateExercise(db, "Squats", "reps");
    const second = findOrCreateExercise(db, "Squats", "seconds");
    expect(second.id).toBe(first.id);
    expect(second.unit).toBe("reps");
  });
});

describe("listExercises", () => {
  it("lists name and unit, alphabetically", () => {
    const db = setup();
    findOrCreateExercise(db, "Squats", "reps");
    findOrCreateExercise(db, "Planche", "seconds");
    expect(listExercises(db)).toEqual([
      { name: "Planche", unit: "seconds" },
      { name: "Squats", unit: "reps" },
    ]);
  });
});

describe("seances", () => {
  it("returns null before any seance exists", () => {
    const db = setup();
    expect(getActiveSeance(db)).toBeNull();
  });

  it("getOrStartSeance creates once, returns the same active row on a second call", () => {
    const db = setup();
    const first = getOrStartSeance(db);
    const second = getOrStartSeance(db);
    expect(second.id).toBe(first.id);
    expect(first.completedAt).toBeNull();
  });

  it("completeSeance stops it from being returned as active", () => {
    const db = setup();
    const seance = startSeance(db);
    completeSeance(db, seance.id);
    expect(getActiveSeance(db)).toBeNull();
    expect(getSeanceById(db, seance.id)!.completedAt).not.toBeNull();
  });

  it("breaks a started_at tie by id, returning the most recently inserted active seance", () => {
    const db = setup();
    const sameInstant = "2026-08-13T10:00:00.000Z";
    db.prepare(`INSERT INTO tracking_seances (started_at) VALUES (?)`).run(sameInstant);
    const second = db.prepare(`INSERT INTO tracking_seances (started_at) VALUES (?)`).run(sameInstant);
    expect(getActiveSeance(db)!.id).toBe(Number(second.lastInsertRowid));
  });
});

describe("logSetForExercise", () => {
  it("logs a single set at exerciseOrder 0, setNumber 1, carrying the exercise's unit", () => {
    const db = setup();
    const seance = startSeance(db);
    const [set] = logSetForExercise(db, seance.id, "Squats", "reps", 12);
    expect(set).toMatchObject({ seanceId: seance.id, exerciseName: "Squats", exerciseUnit: "reps", exerciseOrder: 0, setNumber: 1, valeurActual: 12 });
  });

  it("creates count separate sets with incrementing setNumber, same exerciseOrder", () => {
    const db = setup();
    const seance = startSeance(db);
    const sets = logSetForExercise(db, seance.id, "Pompes", "reps", 10, 4);
    expect(sets).toHaveLength(4);
    expect(sets.map((s) => s.setNumber)).toEqual([1, 2, 3, 4]);
    expect(sets.every((s) => s.exerciseOrder === 0 && s.valeurActual === 10)).toBe(true);
  });

  it("increments setNumber for a further call on the same exercise, keeps exerciseOrder", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    const [second] = logSetForExercise(db, seance.id, "Squats", "reps", 10);
    expect(second).toMatchObject({ exerciseOrder: 0, setNumber: 2 });
  });

  it("assigns the next exerciseOrder to a second distinct exercise in the same seance", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    const [secondExercise] = logSetForExercise(db, seance.id, "Fentes", "reps", 10);
    expect(secondExercise).toMatchObject({ exerciseOrder: 1, setNumber: 1 });
  });

  it("reuses the same tracking_exercises row and its original unit across seances", () => {
    const db = setup();
    const seanceA = startSeance(db);
    const [setA] = logSetForExercise(db, seanceA.id, "Planche", "seconds", 30);
    completeSeance(db, seanceA.id);
    const seanceB = startSeance(db);
    const [setB] = logSetForExercise(db, seanceB.id, "Planche", "reps", 45);
    expect(setB.exerciseId).toBe(setA.exerciseId);
    expect(setB.exerciseUnit).toBe("seconds");
  });
});

describe("getSetsForSeance", () => {
  it("returns sets in insertion order, joined with the exercise name and unit", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Planche", "seconds", 30);
    logSetForExercise(db, seance.id, "Planche", "seconds", 45);
    const sets = getSetsForSeance(db, seance.id);
    expect(sets.map((s) => s.valeurActual)).toEqual([30, 45]);
    expect(sets.every((s) => s.exerciseName === "Planche" && s.exerciseUnit === "seconds")).toBe(true);
  });
});

describe("updateSet / deleteSet", () => {
  it("updates a set's value in place", () => {
    const db = setup();
    const seance = startSeance(db);
    const [set] = logSetForExercise(db, seance.id, "Squats", "reps", 10);
    updateSet(db, set.id, 12);
    const [reloaded] = getSetsForSeance(db, seance.id);
    expect(reloaded!.valeurActual).toBe(12);
  });

  it("deletes a set without touching sibling sets", () => {
    const db = setup();
    const seance = startSeance(db);
    const [first] = logSetForExercise(db, seance.id, "Squats", "reps", 10);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    deleteSet(db, first.id);
    const remaining = getSetsForSeance(db, seance.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.valeurActual).toBe(12);
  });

  it("update/delete work on a set belonging to an already-completed seance", () => {
    const db = setup();
    const seance = startSeance(db);
    const [set] = logSetForExercise(db, seance.id, "Squats", "reps", 10);
    completeSeance(db, seance.id);
    updateSet(db, set.id, 15);
    expect(getSetsForSeance(db, seance.id)[0]!.valeurActual).toBe(15);
    deleteSet(db, set.id);
    expect(getSetsForSeance(db, seance.id)).toHaveLength(0);
  });
});

describe("listCompletedSeances", () => {
  it("excludes the active (uncompleted) seance", () => {
    const db = setup();
    startSeance(db);
    expect(listCompletedSeances(db)).toEqual([]);
  });

  it("separates reps and seconds totals, never summed together", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    logSetForExercise(db, seance.id, "Squats", "reps", 10);
    logSetForExercise(db, seance.id, "Planche", "seconds", 30);
    completeSeance(db, seance.id);

    const [summary] = listCompletedSeances(db);
    expect(summary).toMatchObject({ totalReps: 22, totalSeconds: 30, exerciseCount: 2 });
  });

  it("orders most recent first", () => {
    const db = setup();
    const seanceA = startSeance(db);
    logSetForExercise(db, seanceA.id, "Squats", "reps", 12);
    completeSeance(db, seanceA.id);

    const seanceB = startSeance(db);
    logSetForExercise(db, seanceB.id, "Squats", "reps", 8);
    completeSeance(db, seanceB.id);

    const summaries = listCompletedSeances(db);
    expect(summaries).toHaveLength(2);
    expect(summaries[0]!.id).toBe(seanceB.id);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/tracking/db.test.ts`
Expected: FAIL — `db.ts` still exports the old shape (`listExerciseNames`, single-record `logSetForExercise`, no `updateSet`/`deleteSet`, `repsActual` field).

- [ ] **Step 3: Rewrite `db.ts`**

```ts
// src/lib/tracking/db.ts
import type Database from "better-sqlite3";

export type TrackingUnit = "reps" | "seconds";
export type TrackingExercise = { id: number; name: string; unit: TrackingUnit; createdAt: string };
export type TrackingSeance = { id: number; startedAt: string; completedAt: string | null };
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

function mapSeance(row: { id: number; started_at: string; completed_at: string | null }): TrackingSeance {
  return { id: row.id, startedAt: row.started_at, completedAt: row.completed_at };
}

export function getActiveSeance(db: Database.Database): TrackingSeance | null {
  const row = db
    .prepare(`SELECT * FROM tracking_seances WHERE completed_at IS NULL ORDER BY started_at DESC, id DESC LIMIT 1`)
    .get() as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function startSeance(db: Database.Database): TrackingSeance {
  const startedAt = new Date().toISOString();
  const result = db.prepare(`INSERT INTO tracking_seances (started_at) VALUES (?)`).run(startedAt);
  return { id: Number(result.lastInsertRowid), startedAt, completedAt: null };
}

export function getOrStartSeance(db: Database.Database): TrackingSeance {
  return getActiveSeance(db) ?? startSeance(db);
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
): TrackingSetWithExercise[] {
  const exercise = findOrCreateExercise(db, exerciseName, unit);
  const seanceSets = getSetsForSeance(db, seanceId);
  const exerciseSets = seanceSets.filter((s) => s.exerciseId === exercise.id);
  const exerciseOrder =
    exerciseSets[0]?.exerciseOrder ?? 1 + seanceSets.reduce((max, s) => Math.max(max, s.exerciseOrder), -1);

  const insert = db.prepare(
    `INSERT INTO tracking_sets_logged (seance_id, exercise_id, exercise_order, set_number, valeur_actual, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const created: TrackingSetWithExercise[] = [];
  let setNumber = exerciseSets.length + 1;
  for (let i = 0; i < count; i++) {
    const completedAt = new Date().toISOString();
    const result = insert.run(seanceId, exercise.id, exerciseOrder, setNumber, valeurActual, completedAt);
    created.push({
      id: Number(result.lastInsertRowid),
      seanceId,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      exerciseUnit: exercise.unit,
      exerciseOrder,
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
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/lib/tracking/db.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracking/db.ts src/lib/tracking/db.test.ts
git commit -m "feat(tracking): unité par exercice, séries en lot, édition et suppression"
```

---

### Task 3: `src/lib/tracking/actions.ts` + route de séance

**Files:**
- Modify: `src/lib/tracking/actions.ts`
- Modify: `src/app/(shell)/tracking/[seanceId]/page.tsx`

**Interfaces:**
- Consumes: `db.ts`'s new signatures (Task 2).
- Produces: `logTrackingSetAction({ seanceId, exerciseName, unit, valeurActual, count? }): Promise<TrackingSetWithExercise[]>`, `updateTrackingSetAction(setId, valeurActual): Promise<void>`, `deleteTrackingSetAction(setId): Promise<void>`, `listTrackingExercisesAction(): Promise<{name, unit}[]>` — consumed by Task 6.

- [ ] **Step 1: Rewrite `actions.ts`** (thin wrapper, no dedicated test file — matches `src/lib/dos/actions.ts`/`src/lib/player/actions.ts` convention)

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
  completeSeance as completeSeanceDb,
  listExercises as listExercisesDb,
  type TrackingSetWithExercise,
  type TrackingUnit,
} from "./db";

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

export async function completeTrackingSeanceAction(seanceId: number): Promise<void> {
  completeSeanceDb(await db(), seanceId);
}

export async function listTrackingExercisesAction(): Promise<{ name: string; unit: TrackingUnit }[]> {
  return listExercisesDb(await db());
}
```

- [ ] **Step 2: Update `tracking/[seanceId]/page.tsx`** — swap `listExerciseNames` for `listExercises`

```tsx
// src/app/(shell)/tracking/[seanceId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSeanceById, getSetsForSeance, listExercises } from "@/lib/tracking/db";
import { TrackingSeanceScreen } from "@/components/tracking/TrackingSeanceScreen";

export const dynamic = "force-dynamic";

export default async function TrackingSeancePage({
  params,
}: {
  params: Promise<{ seanceId: string }>;
}) {
  const user = await currentUser();
  if (user.slug !== "clement") redirect("/");

  const { seanceId: seanceIdParam } = await params;
  const seanceId = Number(seanceIdParam);
  const db = getDbForUser(user);
  const seance = getSeanceById(db, seanceId);
  if (!seance) notFound();

  const sets = getSetsForSeance(db, seanceId);
  const exerciseSuggestions = listExercises(db);

  return (
    <TrackingSeanceScreen
      seanceId={seance.id}
      completed={seance.completedAt !== null}
      initialSets={sets}
      exerciseSuggestions={exerciseSuggestions}
    />
  );
}
```

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: everything up through Task 2 still passes; `TrackingSeanceScreen`/its test will now fail to compile against the new prop shapes until Task 6 — that's expected and resolved there (mirrors how Task 2 of the original multi-user plan left a deliberate transient gap for a later task to close).

- [ ] **Step 4: Commit**

```bash
git add src/lib/tracking/actions.ts "src/app/(shell)/tracking/[seanceId]/page.tsx"
git commit -m "feat(tracking): actions pour unité, édition et suppression de série"
```

---

### Task 4: Trophées — unité par carte

**Files:**
- Modify: `src/lib/trophies/computeTrophies.ts`
- Modify: `src/lib/trophies/computeTrophies.test.ts`
- Modify: `src/lib/trophies/loadTropheesScreenState.ts`
- Modify: `src/lib/trophies/loadTrophyDetail.ts`
- Modify: `src/lib/trophies/loadTrophyDetail.test.ts`
- Modify: `src/components/trophies/TrophyCard.tsx`
- Modify: `src/components/trophies/TrophyCard.test.tsx`
- Modify: `src/components/trophies/TropheesScreen.test.tsx`
- Modify: `src/app/(shell)/trophees/[exerciseId]/page.tsx`

**Interfaces:**
- Consumes: `tracking_exercises.unit` (Task 1).
- Produces: `TrophyCard.unit: "reps" | "seconds"` — consumed by every downstream Trophées screen.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/trophies/computeTrophies.test.ts`, inside the existing `describe("computeTrophies — Tracking", ...)` block:

```ts
  it("carries the exercise's unit onto its card, and keeps a seconds card out of any reps grouping", () => {
    const db = setup();
    const seance = startTrackingSeance(db);
    logSetForExercise(db, seance.id, "Planche", "seconds", 30);
    logSetForExercise(db, seance.id, "Planche", "seconds", 45);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);

    const cards = computeTrophies(db).filter((c) => c.module === "tracking");
    const planche = cards.find((c) => c.name === "Planche");
    const squats = cards.find((c) => c.name === "Squats");
    expect(planche).toMatchObject({ unit: "seconds", total: 75 });
    expect(squats).toMatchObject({ unit: "reps", total: 12 });
  });
```

(Import note: `startTrackingSeance` and `logSetForExercise` are already imported at the top of this file from Task 5's earlier work — `logSetForExercise` now takes a `unit` argument per Task 2, so this call already matches the current signature.)

Also add, at the end of the same file:

```ts
describe("computeTrophies — Programme and Dos cards are always unit: reps", () => {
  it("tags every Programme and Dos card as unit reps", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 15, restSeconds: 90 });
    const dosSeance = startDosSeance(db, "2026-01-05", "lundi", 1);
    logDosSet(db, { seanceId: dosSeance.id, exerciseOrder: 0, exerciseId: "A-1", setNumber: 1, valeurTarget: "8-10", valeurActual: 8, restSeconds: 60 });

    const cards = computeTrophies(db);
    expect(cards.every((c) => c.unit === "reps")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/trophies/computeTrophies.test.ts`
Expected: FAIL — `TrophyCard`/`Accumulator` don't carry `unit` yet.

- [ ] **Step 3: Update `computeTrophies.ts`**

Widen the type, tag Programme/Dos entries as `"reps"` at creation, join `te.unit` into the Tracking query:

```ts
export type TrophyCard = {
  id: string;
  module: "programme" | "dos" | "tracking";
  name: string;
  unit: "reps" | "seconds";
  total: number;
  firstAt: string;
  lastAt: string;
  byCran?: { cran: number; nom: string; total: number }[];
};
```

```ts
type Accumulator = {
  module: "programme" | "dos" | "tracking";
  name: string;
  unit: "reps" | "seconds";
  total: number;
  firstAt: string;
  lastAt: string;
  byCran: Map<number, number>;
};
```

In the Programme loop's `entry = { ... }` literal, add `unit: "reps",`. Same in the Dos loop's `entry = { ... }` literal, add `unit: "reps",`.

Replace the `trackingRows` query and loop:

```ts
  const trackingRows = db
    .prepare(
      `SELECT tsl.exercise_id AS exerciseId, te.name AS exerciseName, te.unit AS unit,
              tsl.valeur_actual AS valeurActual, tsl.completed_at AS completedAt
       FROM tracking_sets_logged tsl JOIN tracking_exercises te ON tsl.exercise_id = te.id`,
    )
    .all() as { exerciseId: number; exerciseName: string; unit: "reps" | "seconds"; valeurActual: number; completedAt: string }[];

  for (const row of trackingRows) {
    const id = `tracking-${row.exerciseId}`;
    let entry = acc.get(id);
    if (!entry) {
      entry = {
        module: "tracking",
        name: row.exerciseName,
        unit: row.unit,
        total: 0,
        firstAt: row.completedAt,
        lastAt: row.completedAt,
        byCran: new Map(),
      };
      acc.set(id, entry);
    }
    touch(entry, row.valeurActual, row.completedAt);
  }
```

Add `unit: entry.unit,` to the final `return [...acc.entries()].map(...)` object literal.

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/lib/trophies/computeTrophies.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Update `loadTropheesScreenState.ts`** — `totalReps` excludes seconds cards

```ts
  const totalReps = cards.filter((c) => c.unit === "reps").reduce((sum, c) => sum + c.total, 0);
```

(Replaces the current `cards.reduce(...)` line — everything else in the file is unchanged. `loadTropheesScreenState.test.ts` needs no change: its fixtures are Programme/Dos only, always `unit: "reps"`, so the filter is a no-op for those tests.)

- [ ] **Step 6: Write the failing test for `loadTrophyDetail.ts`**

Append to `loadTrophyDetail.test.ts`:

```ts
import { startSeance as startTrackingSeance, logSetForExercise } from "@/lib/tracking/db";

  it("skips palier computation entirely for a seconds-unit card", () => {
    const db = setup();
    const seance = startTrackingSeance(db);
    logSetForExercise(db, seance.id, "Planche", "seconds", 45);

    const detail = loadTrophyDetail(db, "tracking-1");
    expect(detail).toMatchObject({ unit: "seconds", prochainPalier: null, resteAParcourir: null });
  });
```

- [ ] **Step 7: Run the test, verify it fails**

Run: `npx vitest run src/lib/trophies/loadTrophyDetail.test.ts`
Expected: FAIL — palier is still computed for a seconds card.

- [ ] **Step 8: Update `loadTrophyDetail.ts`**

```ts
// src/lib/trophies/loadTrophyDetail.ts
import type Database from "better-sqlite3";
import { computeTrophies, type TrophyCard } from "./computeTrophies";
import { prochainPalier } from "./paliers";

export type TrophyDetail = TrophyCard & {
  prochainPalier: number | null;
  resteAParcourir: number | null;
};

export function loadTrophyDetail(db: Database.Database, id: string): TrophyDetail | null {
  const card = computeTrophies(db).find((c) => c.id === id);
  if (!card) return null;

  const next = card.unit === "seconds" ? null : prochainPalier(card.total);
  return {
    ...card,
    prochainPalier: next,
    resteAParcourir: next === null ? null : next - card.total,
  };
}
```

- [ ] **Step 9: Run the test, verify it passes**

Run: `npx vitest run src/lib/trophies/loadTrophyDetail.test.ts`
Expected: all tests PASS.

- [ ] **Step 10: Update `TrophyCard.tsx`** — no palier for seconds cards, "s" suffix on the total

```tsx
// src/components/trophies/TrophyCard.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/Card";
import { useCountUp } from "./useCountUp";
import { palierAtteint } from "@/lib/trophies/paliers";
import type { TrophyCard as TrophyCardData } from "@/lib/trophies/computeTrophies";

export function TrophyCard({ card, index }: { card: TrophyCardData; index: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const total = useCountUp(card.total, index * 40);
  const palier = card.unit === "seconds" ? null : palierAtteint(card.total);
  const hasImage = card.module === "programme" && !imageFailed;

  return (
    <Link href={`/trophees/${card.id}`} className="block">
      <Card className="overflow-hidden h-full">
        {hasImage && (
          <div className="aspect-square bg-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/exercises/${card.id}.jpg`}
              alt={card.name}
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
        <div className="p-4">
          <div className="text-15">{card.name}</div>
          <div className="font-archivo text-24 font-semibold tabular-nums mt-2">
            {total}
            {card.unit === "seconds" && <span className="text-15 font-medium"> s</span>}
          </div>
          {palier !== null && (
            <div className="mt-2 pt-2 border-t border-brass/30">
              <span className="font-archivo text-11 font-medium text-brass">
                Palier {palier.toLocaleString("fr-FR")}
              </span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 11: Update `TrophyCard.test.tsx`** — add `unit: "reps"` to the two existing fixtures, add one new test

Add `unit: "reps",` to both `PROGRAMME_CARD` and `DOS_CARD` literals. Then append:

```tsx
  it("shows no palier and an 's' suffix for a seconds card, regardless of total", () => {
    render(<TrophyCard card={{ ...PROGRAMME_CARD, id: "tracking-1", module: "tracking", unit: "seconds", total: 900 }} index={0} />);
    expect(screen.getByText("s")).toBeInTheDocument();
    expect(screen.queryByText(/Palier/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 12: Update `TropheesScreen.test.tsx`** — add `unit: "reps"` to the two `STATE.cards` literals (no behavior change; `TropheesScreen` filters by `module`, never by `unit`)

- [ ] **Step 13: Update `trophees/[exerciseId]/page.tsx`** — hide the "Prochain palier" row for a seconds card, append "s" to the big total

```tsx
        <h1 className="font-archivo text-32 font-semibold">{detail.name}</h1>
        <div className="font-archivo text-44 font-semibold tabular-nums mt-3">
          {detail.total}
          {detail.unit === "seconds" && <span className="text-24 font-medium"> s</span>}
        </div>

        <Card className="mt-6 p-4">
          <div className="flex justify-between py-2">
            <span className="text-15 text-graphite">Premier passage</span>
            <span className="text-15 tabular-nums">{formatDateFr(detail.firstAt)}</span>
          </div>
          <div className="flex justify-between py-2 border-t border-hairline">
            <span className="text-15 text-graphite">Dernier passage</span>
            <span className="text-15 tabular-nums">{formatDateFr(detail.lastAt)}</span>
          </div>
          {detail.unit === "reps" && (
            <div className="flex justify-between py-2 border-t border-hairline">
              <span className="text-15 text-graphite">Prochain palier</span>
              <span className="text-15 tabular-nums">
                {detail.prochainPalier === null
                  ? "Tous les paliers atteints"
                  : `${detail.resteAParcourir} restants pour atteindre ${detail.prochainPalier}`}
              </span>
            </div>
          )}
        </Card>
```

(Replaces the existing `<h1>`/total `<div>`/`Card` block — the rest of the file, including the image guard and the `byCran` block below, is unchanged.)

- [ ] **Step 14: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 15: Commit**

```bash
git add src/lib/trophies/computeTrophies.ts src/lib/trophies/computeTrophies.test.ts \
  src/lib/trophies/loadTropheesScreenState.ts src/lib/trophies/loadTrophyDetail.ts src/lib/trophies/loadTrophyDetail.test.ts \
  src/components/trophies/TrophyCard.tsx src/components/trophies/TrophyCard.test.tsx src/components/trophies/TropheesScreen.test.tsx \
  "src/app/(shell)/trophees/[exerciseId]/page.tsx"
git commit -m "feat(trophies): les cartes Tracking portent leur unité, secondes exclues du total reps"
```

---

### Task 5: `RepsSheet` — titre personnalisable, suppression optionnelle

**Files:**
- Modify: `src/components/player/RepsSheet.tsx`
- Modify: `src/components/player/RepsSheet.test.tsx`

**Interfaces:**
- Produces: `RepsSheet`'s new optional `title?: string` (default `"Ajuster les reps"`, unchanged) and `onDelete?: () => void` props — consumed by Task 6, reused as-is by every existing Player call site (no call site changes needed — both new props are optional, default behavior identical).

- [ ] **Step 1: Write the failing tests**

Append to `RepsSheet.test.tsx`:

```tsx
  it("uses a custom title when provided, defaults to Ajuster les reps otherwise", () => {
    const { rerender } = render(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={() => {}} />);
    expect(screen.getByText("Ajuster les reps")).toBeInTheDocument();

    rerender(<RepsSheet open onClose={() => {}} initialValue={12} title="Ajuster la durée (s)" onConfirm={() => {}} />);
    expect(screen.getByText("Ajuster la durée (s)")).toBeInTheDocument();
  });

  it("shows no delete affordance by default, shows one and calls onDelete when provided", async () => {
    const onDelete = vi.fn();
    const { rerender } = render(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={() => {}} />);
    expect(screen.queryByRole("button", { name: "Supprimer la série" })).not.toBeInTheDocument();

    rerender(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={() => {}} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: "Supprimer la série" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/components/player/RepsSheet.test.tsx`
Expected: FAIL — no `title`/`onDelete` props yet, title is hardcoded.

- [ ] **Step 3: Update `RepsSheet.tsx`**

```tsx
// src/components/player/RepsSheet.tsx
"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import type { Accent } from "@/components/Pastille";

// ponytail: stepper (−/valeur/+) au lieu d'une vraie molette à
// glisser/snap — le brief design l'appelle "feuille à molette", une
// vraie molette est beaucoup plus d'ingénierie d'interaction pour un
// gain marginal ici. Upgrade si ça se sent comme une friction réelle en
// séance.
export function RepsSheet({
  open,
  onClose,
  initialValue,
  accent = "cobalt",
  title = "Ajuster les reps",
  onConfirm,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  initialValue: number;
  accent?: Accent;
  title?: string;
  onConfirm: (value: number) => void;
  onDelete?: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex items-center justify-center gap-6 py-4">
        <Button variant="secondary" onClick={() => setValue((v) => Math.max(0, v - 1))}>
          −
        </Button>
        <span className="font-archivo text-44 font-semibold tabular-nums w-16 text-center">
          {value}
        </span>
        <Button variant="secondary" onClick={() => setValue((v) => v + 1)}>
          +
        </Button>
      </div>
      <Button variant="primary" accent={accent} onClick={() => onConfirm(value)}>
        Valider
      </Button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 w-full h-11 flex items-center justify-center font-archivo text-15 font-medium text-alert"
        >
          Supprimer la série
        </button>
      )}
    </Sheet>
  );
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/components/player/RepsSheet.test.tsx`
Expected: all tests PASS (5 original + 2 new).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests PASS (existing Player call sites of `RepsSheet` pass neither `title` nor `onDelete` — unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/components/player/RepsSheet.tsx src/components/player/RepsSheet.test.tsx
git commit -m "feat(reps-sheet): titre personnalisable et suppression optionnelle"
```

---

### Task 6: `TrackingSeanceScreen` — unité, lot, édition, suppression

**Files:**
- Modify: `src/components/tracking/TrackingSeanceScreen.tsx`
- Modify: `src/components/tracking/TrackingSeanceScreen.test.tsx`

**Interfaces:**
- Consumes: `logTrackingSetAction`, `updateTrackingSetAction`, `deleteTrackingSetAction` (Task 3), `TrackingSetWithExercise`/`TrackingUnit` (Task 2), `RepsSheet`'s `title`/`onDelete` (Task 5).
- Produces: the full rewritten screen — last piece of this plan's UI work besides Task 7/8.

- [ ] **Step 1: Write the failing tests**

Replace `TrackingSeanceScreen.test.tsx` in full:

```tsx
// src/components/tracking/TrackingSeanceScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingSeanceScreen } from "./TrackingSeanceScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const logTrackingSetAction = vi.fn();
const updateTrackingSetAction = vi.fn();
const deleteTrackingSetAction = vi.fn();
const completeTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  logTrackingSetAction: (...args: unknown[]) => logTrackingSetAction(...args),
  updateTrackingSetAction: (...args: unknown[]) => updateTrackingSetAction(...args),
  deleteTrackingSetAction: (...args: unknown[]) => deleteTrackingSetAction(...args),
  completeTrackingSeanceAction: (...args: unknown[]) => completeTrackingSeanceAction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const SQUATS_SET = {
  id: 1, seanceId: 1, exerciseId: 10, exerciseName: "Squats", exerciseUnit: "reps" as const,
  exerciseOrder: 0, setNumber: 1, valeurActual: 12, completedAt: "2026-08-13T10:00:00.000Z",
};

describe("TrackingSeanceScreen", () => {
  it("prompts to add the first exercise when the seance is empty", () => {
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);
    expect(screen.getByText("Ajoute ton premier exercice ci-dessous.")).toBeInTheDocument();
  });

  it("groups initial sets by exercise, showing each value as its own tap target", () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[SQUATS_SET, { ...SQUATS_SET, id: 2, setNumber: 2, valeurActual: 10 }]}
        exerciseSuggestions={[{ name: "Squats", unit: "reps" }]}
      />,
    );
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
  });

  it("shows a seconds suffix on a seconds exercise's set values", () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[{ ...SQUATS_SET, id: 3, exerciseName: "Planche", exerciseUnit: "seconds", valeurActual: 30 }]}
        exerciseSuggestions={[{ name: "Planche", unit: "seconds" }]}
      />,
    );
    expect(screen.getByRole("button", { name: "30 s" })).toBeInTheDocument();
  });

  it("locks the unit picker to a known exercise's unit and hides the reps/seconds toggle", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[]}
        exerciseSuggestions={[{ name: "Planche", unit: "seconds" }]}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Planche");
    expect(screen.getByText("Unité : secondes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reps" })).not.toBeInTheDocument();
  });

  it("shows the reps/seconds toggle, defaulting to reps, for an unknown exercise name", async () => {
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);
    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Fentes bulgares");
    expect(screen.getByRole("button", { name: "Reps" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Secondes" })).toBeInTheDocument();
  });

  it("adds count separate sets in one call, using the server's authoritative records", async () => {
    logTrackingSetAction.mockResolvedValue([
      { ...SQUATS_SET, id: 21, exerciseName: "Fentes", setNumber: 1 },
      { ...SQUATS_SET, id: 22, exerciseName: "Fentes", setNumber: 2 },
    ]);
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);

    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Fentes");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter une série au lot" }));
    await userEvent.click(screen.getByRole("button", { name: "Ajouter la série" }));

    expect(logTrackingSetAction).toHaveBeenCalledWith({ seanceId: 1, exerciseName: "Fentes", unit: "reps", valeurActual: 10, count: 2 });
    expect(await screen.findAllByText("Fentes")).toHaveLength(1);
  });

  it("edits a set's value through the reuse sheet, calling updateTrackingSetAction", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[SQUATS_SET]}
        exerciseSuggestions={[{ name: "Squats", unit: "reps" }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "12" }));
    expect(screen.getByText("Ajuster les reps")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(updateTrackingSetAction).toHaveBeenCalledWith(1, 13);
    expect(await screen.findByRole("button", { name: "13" })).toBeInTheDocument();
  });

  it("deletes a set through the sheet, calling deleteTrackingSetAction", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[SQUATS_SET]}
        exerciseSuggestions={[{ name: "Squats", unit: "reps" }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "12" }));
    await userEvent.click(screen.getByRole("button", { name: "Supprimer la série" }));
    expect(deleteTrackingSetAction).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("button", { name: "12" })).not.toBeInTheDocument();
  });

  it("keeps the entry form and edit/delete available on an already-completed seance", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed
        initialSets={[SQUATS_SET]}
        exerciseSuggestions={[{ name: "Squats", unit: "reps" }]}
      />,
    );
    expect(screen.getByPlaceholderText("Nom de l'exercice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminer la séance" })).not.toBeInTheDocument();
  });

  it("completes the seance and navigates back to the list", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[SQUATS_SET]}
        exerciseSuggestions={[{ name: "Squats", unit: "reps" }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Terminer la séance" }));
    expect(completeTrackingSeanceAction).toHaveBeenCalledWith(1);
    expect(push).toHaveBeenCalledWith("/tracking");
  });

  it("re-enables Ajouter la série and shows an error affordance when logTrackingSetAction fails", async () => {
    logTrackingSetAction.mockRejectedValueOnce(new Error("boom"));
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);

    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Fentes");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter la série" }));

    expect(await screen.findByText("Une erreur est survenue. Réessaie.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter la série" })).not.toBeDisabled();
  });
});
```

Note: the count stepper's `+`/`−` buttons in the component below carry an explicit `aria-label` (`"Ajouter une série au lot"` / `"Retirer une série du lot"`), distinct from the value stepper's bare `+`/`−` `Button`s — this is what lets the bulk-count test above target the right button unambiguously via `getByRole("button", { name: "Ajouter une série au lot" })`.

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/components/tracking/TrackingSeanceScreen.test.tsx`
Expected: FAIL — current component doesn't accept the new prop shapes, has no unit picker, count stepper, or edit/delete sheet.

- [ ] **Step 3: Rewrite `TrackingSeanceScreen.tsx`**

```tsx
// src/components/tracking/TrackingSeanceScreen.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { RepsSheet } from "@/components/player/RepsSheet";
import {
  logTrackingSetAction,
  updateTrackingSetAction,
  deleteTrackingSetAction,
  completeTrackingSeanceAction,
} from "@/lib/tracking/actions";
import type { TrackingSetWithExercise, TrackingUnit } from "@/lib/tracking/db";

type ExerciseGroup = { exerciseOrder: number; exerciseName: string; unit: TrackingUnit; sets: TrackingSetWithExercise[] };

function groupByExercise(sets: TrackingSetWithExercise[]): ExerciseGroup[] {
  const map = new Map<number, ExerciseGroup>();
  for (const set of sets) {
    let group = map.get(set.exerciseOrder);
    if (!group) {
      group = { exerciseOrder: set.exerciseOrder, exerciseName: set.exerciseName, unit: set.exerciseUnit, sets: [] };
      map.set(set.exerciseOrder, group);
    }
    group.sets.push(set);
  }
  return [...map.values()].sort((a, b) => a.exerciseOrder - b.exerciseOrder);
}

function pillClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium ${active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"}`;
}

export function TrackingSeanceScreen({
  seanceId,
  completed,
  initialSets,
  exerciseSuggestions,
}: {
  seanceId: number;
  completed: boolean;
  initialSets: TrackingSetWithExercise[];
  exerciseSuggestions: { name: string; unit: TrackingUnit }[];
}) {
  const router = useRouter();
  const [sets, setSets] = useState(initialSets);
  const [exerciseName, setExerciseName] = useState("");
  const [unit, setUnit] = useState<TrackingUnit>("reps");
  const [valeur, setValeur] = useState(10);
  const [count, setCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [editingSet, setEditingSet] = useState<TrackingSetWithExercise | null>(null);

  const groups = groupByExercise(sets);
  const matchedExercise = exerciseSuggestions.find(
    (e) => e.name.trim().toLowerCase() === exerciseName.trim().toLowerCase(),
  );
  const effectiveUnit = matchedExercise?.unit ?? unit;

  async function handleAddSet() {
    const name = exerciseName.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(false);
    try {
      const newSets = await logTrackingSetAction({ seanceId, exerciseName: name, unit: effectiveUnit, valeurActual: valeur, count });
      setSets((prev) => [...prev, ...newSets]);
      setExerciseName("");
      setCount(1);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSet(newValue: number) {
    if (!editingSet) return;
    const id = editingSet.id;
    try {
      await updateTrackingSetAction(id, newValue);
      setSets((prev) => prev.map((s) => (s.id === id ? { ...s, valeurActual: newValue } : s)));
      setEditingSet(null);
    } catch {
      setError(true);
    }
  }

  async function handleDeleteSet() {
    if (!editingSet) return;
    const id = editingSet.id;
    try {
      await deleteTrackingSetAction(id);
      setSets((prev) => prev.filter((s) => s.id !== id));
      setEditingSet(null);
    } catch {
      setError(true);
    }
  }

  async function handleFinish() {
    setError(false);
    try {
      await completeTrackingSeanceAction(seanceId);
      router.push("/tracking");
    } catch {
      setError(true);
    }
  }

  return (
    <div className="p-5 flex flex-col gap-6">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>

      {error && (
        <div className="bg-paper border border-hairline rounded-card p-6">
          <p className="text-15 text-graphite">Une erreur est survenue. Réessaie.</p>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-15 text-graphite">Ajoute ton premier exercice ci-dessous.</p>
      ) : (
        <Card className="overflow-hidden">
          {groups.map((group, i) => (
            <div key={group.exerciseOrder} className={`px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className="text-15 font-medium">{group.exerciseName}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {group.sets.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setEditingSet(s)}
                    className="h-7 px-2.5 rounded-pill bg-canvas text-13 tabular-nums"
                  >
                    {s.valeurActual}
                    {group.unit === "seconds" ? " s" : ""}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-5 flex flex-col gap-4">
        <input
          type="text"
          list="tracking-exercise-suggestions"
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          placeholder="Nom de l'exercice"
          className="h-14 rounded-field border border-hairline px-4 text-15"
        />
        <datalist id="tracking-exercise-suggestions">
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

        <div className="flex items-center justify-center gap-6">
          <Button variant="secondary" onClick={() => setValeur((v) => Math.max(0, v - 1))}>
            −
          </Button>
          <span className="font-archivo text-44 font-semibold tabular-nums w-16 text-center">{valeur}</span>
          <Button variant="secondary" onClick={() => setValeur((v) => v + 1)}>
            +
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-15 text-graphite">Nombre de séries</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Retirer une série du lot"
              onClick={() => setCount((v) => Math.max(1, v - 1))}
              className="w-9 h-9 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15"
            >
              −
            </button>
            <span className="font-archivo text-18 font-semibold tabular-nums w-6 text-center">{count}</span>
            <button
              type="button"
              aria-label="Ajouter une série au lot"
              onClick={() => setCount((v) => v + 1)}
              className="w-9 h-9 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15"
            >
              +
            </button>
          </div>
        </div>

        <Button
          variant="primary"
          accent="sage"
          onClick={handleAddSet}
          disabled={saving || exerciseName.trim() === ""}
        >
          Ajouter la série
        </Button>
      </Card>

      {!completed && (
        <button
          type="button"
          onClick={handleFinish}
          className="h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Terminer la séance
        </button>
      )}

      <RepsSheet
        open={editingSet !== null}
        onClose={() => setEditingSet(null)}
        initialValue={editingSet?.valeurActual ?? 0}
        accent="sage"
        title={editingSet?.exerciseUnit === "seconds" ? "Ajuster la durée (s)" : "Ajuster les reps"}
        onConfirm={handleUpdateSet}
        onDelete={handleDeleteSet}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/components/tracking/TrackingSeanceScreen.test.tsx`
Expected: all tests PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/tracking/TrackingSeanceScreen.tsx src/components/tracking/TrackingSeanceScreen.test.tsx
git commit -m "feat(tracking): unité, séries en lot, édition et suppression sur l'écran de séance"
```

---

### Task 7: `TrackingScreen` — historique en reps et secondes

**Files:**
- Modify: `src/components/tracking/TrackingScreen.tsx`
- Modify: `src/components/tracking/TrackingScreen.test.tsx`

**Interfaces:**
- Consumes: `TrackingSeanceSummary.totalReps`/`.totalSeconds` (Task 2).

- [ ] **Step 1: Write the failing test**

Update the existing `"lists completed seances with their total reps"` test in `TrackingScreen.test.tsx` to include `totalSeconds: 0` in its fixture (required by the type now), and append a new test:

```tsx
  it("lists completed seances with their total reps", () => {
    render(
      <TrackingScreen
        state={{
          activeSeanceId: null,
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
          activeSeanceId: null,
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
          activeSeanceId: null,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 0, totalSeconds: 60, exerciseCount: 1 }],
        }}
      />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("60 s")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/components/tracking/TrackingScreen.test.tsx`
Expected: FAIL — component only renders `totalReps`, and the type doesn't require `totalSeconds` yet so the new fixtures won't even compile against the current component's expectations at runtime (the number won't render).

- [ ] **Step 3: Update the history row in `TrackingScreen.tsx`**

Replace this block:

```tsx
              <div className="font-archivo text-18 font-semibold tabular-nums">{seance.totalReps}</div>
```

with:

```tsx
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
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/components/tracking/TrackingScreen.test.tsx`
Expected: all tests PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/tracking/TrackingScreen.tsx src/components/tracking/TrackingScreen.test.tsx
git commit -m "feat(tracking): l'historique distingue les totaux reps et secondes"
```

---

### Task 8: Carte Tracking sur Aujourd'hui (Clément)

**Files:**
- Create: `src/components/today/TrackingCard.tsx`
- Create: `src/components/today/TrackingCard.test.tsx`
- Modify: `src/components/today/AujourdhuiScreen.tsx`
- Modify: `src/components/today/AujourdhuiScreen.test.tsx`
- Modify: `src/app/(shell)/page.tsx`

**Interfaces:**
- Consumes: `startTrackingSeanceAction` (Task 3), `TrackingScreenState`, `loadTrackingScreenState` (already exist, unchanged by this plan).
- Produces: `TrackingCard({ state: TrackingScreenState })`; `AujourdhuiScreen`'s new `trackingState: TrackingScreenState | null` prop.

- [ ] **Step 1: Write the failing tests for `TrackingCard`**

```tsx
// src/components/today/TrackingCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingCard } from "./TrackingCard";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const startTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  startTrackingSeanceAction: (...args: unknown[]) => startTrackingSeanceAction(...args),
}));

describe("TrackingCard", () => {
  it("shows Enregistrer une séance and starts one on click when nothing is active", async () => {
    startTrackingSeanceAction.mockResolvedValue(9);
    render(<TrackingCard state={{ activeSeanceId: null, seances: [] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer une séance" }));
    expect(startTrackingSeanceAction).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/tracking/9");
  });

  it("shows Reprendre linking directly to the active seance", () => {
    render(<TrackingCard state={{ activeSeanceId: 7, seances: [] }} />);
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/tracking/7");
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/components/today/TrackingCard.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Write `TrackingCard.tsx`**

```tsx
// src/components/today/TrackingCard.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { startTrackingSeanceAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

export function TrackingCard({ state }: { state: TrackingScreenState }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    try {
      const seanceId = await startTrackingSeanceAction();
      router.push(`/tracking/${seanceId}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <Card className="p-5">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
      <div className="font-archivo text-18 font-semibold mt-3">
        {state.activeSeanceId !== null ? "Séance en cours" : "Log ta séance du jour"}
      </div>
      {state.activeSeanceId !== null ? (
        <Link
          href={`/tracking/${state.activeSeanceId}`}
          className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Reprendre
        </Link>
      ) : (
        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="mt-5 w-full h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold disabled:opacity-40"
        >
          Enregistrer une séance
        </button>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/components/today/TrackingCard.test.tsx`
Expected: both tests PASS.

- [ ] **Step 5: Wire `TrackingCard` into `AujourdhuiScreen.tsx`**

Add the import and the `trackingState` prop, and render it in place of a missing `DosCard`:

```tsx
import { TrackingCard } from "./TrackingCard";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";
```

```tsx
export function AujourdhuiScreen({
  state,
  dosState,
  trackingState,
  user,
}: {
  state: TodayState;
  dosState: DosTodayState | null;
  trackingState: TrackingScreenState | null;
  user: { slug: UserSlug; label: string };
}) {
```

Replace the final line of the "normal" phase return block:

```tsx
      {dosState ? <DosCard dosState={dosState} /> : trackingState ? <TrackingCard state={trackingState} /> : null}
```

(Everything else in the file — the `empty` and `level-up` phase branches, `ReglagesScreen` wiring — is unchanged.)

- [ ] **Step 6: Update `AujourdhuiScreen.test.tsx`**

Add `trackingState={null}` to every existing render call (all 10), and add `vi.mock("@/lib/tracking/actions", () => ({ startTrackingSeanceAction: vi.fn() }));` near the top alongside the other mocks. Add one new test:

```tsx
  it("shows the Tracking card for Clément when trackingState is provided", () => {
    render(
      <AujourdhuiScreen
        state={NORMAL_PROGRAMME_STATE}
        dosState={null}
        trackingState={{ activeSeanceId: null, seances: [] }}
        user={CLEMENT}
      />,
    );
    expect(screen.getByRole("button", { name: "Enregistrer une séance" })).toBeInTheDocument();
  });
```

(The pre-existing `"greets Clément by name and never renders a Dos card when dosState is null"` test also needs `trackingState={null}` added to its render call, keeping its assertion — it's specifically testing the Dos-card-absence case, not Tracking.)

- [ ] **Step 7: Run the test, verify it passes**

Run: `npx vitest run src/components/today/AujourdhuiScreen.test.tsx`
Expected: all 11 tests PASS.

- [ ] **Step 8: Update `(shell)/page.tsx`**

```tsx
// src/app/(shell)/page.tsx
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTodayState } from "@/lib/programme/loadTodayState";
import { loadDosTodayState } from "@/lib/dos/loadDosTodayState";
import { loadTrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";
import { PARCOURS } from "@/lib/programme/parcours";
import { AujourdhuiScreen } from "@/components/today/AujourdhuiScreen";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await currentUser();
  const db = getDbForUser(user);
  const state = loadTodayState(db, PARCOURS);
  const dosState = user.slug === "mathis" ? loadDosTodayState(db) : null;
  const trackingState = user.slug === "clement" ? loadTrackingScreenState(db) : null;
  return (
    <AujourdhuiScreen
      state={state}
      dosState={dosState}
      trackingState={trackingState}
      user={{ slug: user.slug, label: user.label }}
    />
  );
}
```

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 10: Manual smoke test**

With `.env.local` still set to `CLEMENT_EMAIL=...` / `DEV_FORCE_USER_SLUG=clement` (from the previous session), run `npm run db:migrate` once (applies `0009_tracking_unit.sql` to both DB files), then `npm run dev` and check: Aujourd'hui shows the Tracking card with "Enregistrer une séance"; clicking it starts a séance and navigates there; add a reps exercise and a seconds exercise (unit toggle only appears for the unknown name, locks for a repeat); use the "Nombre de séries" stepper to add 3 sets at once; tap a logged value to edit it via the sheet, then delete one via the sheet's "Supprimer la série"; click "Terminer la séance"; reopen the completed séance from `/tracking` and confirm the entry form and edit/delete are still available and "Terminer la séance" is gone; check Trophées shows the seconds exercise as a separate card with no palier and an "s" suffix, and that the reps total at the top of Trophées didn't include it.

- [ ] **Step 11: Commit**

```bash
git add src/components/today/TrackingCard.tsx src/components/today/TrackingCard.test.tsx \
  src/components/today/AujourdhuiScreen.tsx src/components/today/AujourdhuiScreen.test.tsx \
  "src/app/(shell)/page.tsx"
git commit -m "feat(today): ajoute la carte Tracking sur Aujourd'hui pour Clément"
```
