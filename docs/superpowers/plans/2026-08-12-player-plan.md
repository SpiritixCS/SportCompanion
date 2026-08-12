# Player de séance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the session player — vue exercice, vue repos, écran de fin — for the Caliathletics (Programme) axis, persisted so a set logged is never lost and a resumed session reads its exact state from the database, never from client memory.

**Architecture:** Next.js Server Component (`/dev/player`) reads the current session state fresh from SQLite on every request via a pure derivation function (`deriveState`) layered over a thin DB-access module. A Client Component (`PlayerScreen`) owns only ephemeral UI state (which local phase — exercise vs. rest — and the rest countdown); every state-changing action (log a set, skip an exercise, validate the session) goes through a Server Action and is followed by `router.refresh()`, so the source of truth after every mutation is always a fresh server read, never a client-side merge.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, React 19, better-sqlite3, Vitest.

## Global Constraints

- Axe Programme (Caliathletics) uniquement cette phase — pas de BackPain, pas de flux Aujourd'hui/point de départ (phase 3).
- Entrée via `/dev/player?parcours=&level=&day=` (indices 0-based), remplacée par le vrai déclenchement en phase 3.
- Repos entre séries : **90s**. Repos entre exercices : **120s**. Constantes nommées, jamais un nombre en dur dans un composant.
- L'état d'une séance (où on en est) se **dérive** de `sets_logged`/`skipped_exercises` à chaque lecture — jamais stocké comme un statut séparé, jamais reconstruit en mémoire côté client sans re-vérification serveur. C'est la leçon v1 (`CLAUDE.md` §2) : le test qui vérifie ça est non négociable.
- Valider une série écrit immédiatement en DB (pas d'attente de fin de séance). `seances.completed_at` n'est posé qu'au clic explicite sur **Terminer** de l'écran de fin.
- Toute classe Tailwind pilotée par un accent doit passer par une map de chaînes littérales (`ACCENT_BORDER`/`ACCENT_BG`/`ACCENT_RING` dans `src/components/Pastille.tsx`) — jamais `` `bg-${accent}` `` en interpolation directe (le scanner Tailwind lit le texte source, n'exécute jamais le JS).
- Composants visuels réutilisés tels quels depuis la phase Fondations : `Card`, `Button`, `Sheet`, `Pastille`, l'icônerie — ne pas les modifier dans ce plan sauf le point ci-dessous.
- Package manager npm. Tests : Vitest.

---

## File Structure

```
migrations/
  0001_seances.sql               NOUVEAU — seances, sets_logged, skipped_exercises

src/app/globals.css               MODIFIÉ — ajoute --text-72 (gap trouvé vs le brief design d'origine)
src/app/globals.test.ts           MODIFIÉ — étend le test d'échelle typo

src/lib/player/
  constants.ts                    REST_BETWEEN_SETS_SECONDS, REST_BETWEEN_EXERCISES_SECONDS
  deriveState.ts / .test.ts       dérivation pure de progression (le module le plus testé du plan)
  db.ts / .test.ts                accès SQLite: séances, sets_logged, skipped_exercises
  loadPlayerState.ts / .test.ts   combine db.ts + deriveState — LE test de résilience critique vit ici
  formatTarget.ts / .test.ts      "3 × 12" / "3 × 8-12" / "3 × max" / suffixe "/ côté"
  actions.ts                      Server Actions: logSetAction, skipExerciseAction, completeSeanceAction

src/components/player/
  RepsSheet.tsx / .test.tsx       feuille modale d'ajustement (stepper — voir Task 7)
  ExerciseView.tsx / .test.tsx
  RestView.tsx / .test.tsx
  SummaryView.tsx / .test.tsx
  PlayerScreen.tsx / .test.tsx    orchestrateur client

src/app/dev/player/
  page.tsx                        Server Component, parse les searchParams, charge l'état, rend PlayerScreen
```

---

### Task 1: Migration `0001_seances.sql`

**Files:**
- Create: `migrations/0001_seances.sql`
- Test: `migrations/0001_seances.test.ts`

**Interfaces:**
- Produces: tables `seances`, `sets_logged`, `skipped_exercises` — colonnes exactes consommées par `src/lib/player/db.ts` (Task 4).

- [ ] **Step 1: Write the failing test**

```typescript
// migrations/0001_seances.test.ts
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

describe("0001_seances migration", () => {
  it("creates seances, sets_logged, and skipped_exercises with the expected columns", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0001_seances.sql");

    const seancesCols = (db.prepare("PRAGMA table_info(seances)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(seancesCols).toEqual([
      "id",
      "parcours",
      "level",
      "day_index",
      "started_at",
      "completed_at",
    ]);

    const setsCols = (db.prepare("PRAGMA table_info(sets_logged)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(setsCols).toEqual([
      "id",
      "seance_id",
      "exercise_order",
      "set_number",
      "reps_target",
      "reps_actual",
      "rest_seconds",
      "completed_at",
    ]);

    const skippedCols = (
      db.prepare("PRAGMA table_info(skipped_exercises)").all() as { name: string }[]
    ).map((c) => c.name);
    expect(skippedCols).toEqual(["seance_id", "exercise_order", "skipped_at"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run migrations/0001_seances.test.ts`
Expected: FAIL — `0001_seances.sql` does not exist, `applied` is empty.

- [ ] **Step 3: Create `migrations/0001_seances.sql`**

```sql
CREATE TABLE seances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parcours TEXT NOT NULL,
  level INTEGER NOT NULL,
  day_index INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE sets_logged (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id INTEGER NOT NULL REFERENCES seances(id),
  exercise_order INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  reps_target TEXT NOT NULL,
  reps_actual INTEGER NOT NULL,
  rest_seconds INTEGER NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE TABLE skipped_exercises (
  seance_id INTEGER NOT NULL REFERENCES seances(id),
  exercise_order INTEGER NOT NULL,
  skipped_at TEXT NOT NULL,
  PRIMARY KEY (seance_id, exercise_order)
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run migrations/0001_seances.test.ts`
Expected: PASS.

- [ ] **Step 5: Apply the migration to the dev DB**

Run: `npm run db:migrate`
Expected: `Applied 1 migration(s): 0001_seances.sql`.

- [ ] **Step 6: Commit**

```bash
git add migrations/0001_seances.sql migrations/0001_seances.test.ts
git commit -m "feat(db): add seances, sets_logged, skipped_exercises migration"
```

---

### Task 2: Design token gap — add `--text-72`

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/globals.test.ts`

**Interfaces:**
- Produces: Tailwind utility `text-72`, consumed by `ExerciseView` (Task 8) for the target display ("3 × 12" in Archivo Expanded 72px).

The original Claude Design brief (`uploads/claude.md`, §4.4) specifies the exercise target ("consigne") at **72px**, distinct from the rest-timer/rep-counter at 96px. `CLAUDE.md`'s summary (§4) compressed both into one sentence and only Fondations registered 96px — 72px was never added as a token. This task fixes that gap before any component needs it.

- [ ] **Step 1: Write the failing test** — extend the existing type-scale table

In `src/app/globals.test.ts`, change line 30 from:
```typescript
  it.each([11, 13, 15, 18, 24, 32, 44, 96])(
```
to:
```typescript
  it.each([11, 13, 15, 18, 24, 32, 44, 72, 96])(
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/globals.test.ts`
Expected: FAIL on the new `--text-72` case.

- [ ] **Step 3: Add the token** — in `src/app/globals.css`, change line 24-25 from:
```css
  --text-44: 44px;
  --text-96: 96px;
```
to:
```css
  --text-44: 44px;
  --text-72: 72px;
  --text-96: 96px;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/globals.test.ts`
Expected: PASS (9 cases).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/globals.test.ts
git commit -m "fix(design): add missing --text-72 token (exercise target display)"
```

---

### Task 3: Constants + pure state derivation

**Files:**
- Create: `src/lib/player/constants.ts`
- Create: `src/lib/player/deriveState.ts`
- Test: `src/lib/player/deriveState.test.ts`

**Interfaces:**
- Consumes: `TrainDay`, `Exercise` from `src/lib/workout/types.ts` (already exists).
- Produces: `REST_BETWEEN_SETS_SECONDS`, `REST_BETWEEN_EXERCISES_SECONDS` (numbers). `deriveState(day, setsLogged, skippedExerciseOrders?): DerivedProgress`, `type SetLoggedRow = { exerciseOrder: number; setNumber: number }`, `type NextSet = { exerciseOrder: number; setNumber: number; isLastSetOfExercise: boolean; isLastExerciseOfDay: boolean }`, `type DerivedProgress = { allSetsDone: false; next: NextSet } | { allSetsDone: true; next: null }`. Consumed by `loadPlayerState.ts` (Task 5) and `PlayerScreen.tsx` (Task 12).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/player/deriveState.test.ts
import { describe, it, expect } from "vitest";
import { deriveState } from "./deriveState";
import type { TrainDay } from "@/lib/workout/types";

const DAY: TrainDay = {
  kind: "train",
  label: "Day 1",
  exercises: [
    {
      id: "push-ups",
      name: "Push ups",
      movementFamily: "push",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 10, maxEffort: false, eachSide: false },
    },
    {
      id: "squats",
      name: "Squats",
      movementFamily: "legs",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 15, maxEffort: false, eachSide: false },
    },
  ],
};

describe("deriveState", () => {
  it("points to the first set of the first exercise when nothing is logged", () => {
    const result = deriveState(DAY, []);
    expect(result).toEqual({
      allSetsDone: false,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: false },
    });
  });

  it("points to the next unlogged set within the same exercise", () => {
    const result = deriveState(DAY, [{ exerciseOrder: 0, setNumber: 1 }]);
    expect(result).toEqual({
      allSetsDone: false,
      next: { exerciseOrder: 0, setNumber: 2, isLastSetOfExercise: true, isLastExerciseOfDay: false },
    });
  });

  it("moves to the next exercise once the current one's sets are all logged", () => {
    const result = deriveState(DAY, [
      { exerciseOrder: 0, setNumber: 1 },
      { exerciseOrder: 0, setNumber: 2 },
    ]);
    expect(result).toEqual({
      allSetsDone: false,
      next: { exerciseOrder: 1, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: true },
    });
  });

  it("reports allSetsDone once every set of every exercise is logged", () => {
    const result = deriveState(DAY, [
      { exerciseOrder: 0, setNumber: 1 },
      { exerciseOrder: 0, setNumber: 2 },
      { exerciseOrder: 1, setNumber: 1 },
      { exerciseOrder: 1, setNumber: 2 },
    ]);
    expect(result).toEqual({ allSetsDone: true, next: null });
  });

  it("skips over a wholesale-skipped exercise when computing next", () => {
    const result = deriveState(DAY, [], new Set([0]));
    expect(result).toEqual({
      allSetsDone: false,
      next: { exerciseOrder: 1, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: true },
    });
  });

  it("reports allSetsDone when the only remaining exercise is skipped", () => {
    const result = deriveState(
      DAY,
      [{ exerciseOrder: 0, setNumber: 1 }, { exerciseOrder: 0, setNumber: 2 }],
      new Set([1]),
    );
    expect(result).toEqual({ allSetsDone: true, next: null });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/player/deriveState.test.ts`
Expected: FAIL — `deriveState.ts` does not exist.

- [ ] **Step 3: Create `src/lib/player/constants.ts`**

```typescript
export const REST_BETWEEN_SETS_SECONDS = 90;
export const REST_BETWEEN_EXERCISES_SECONDS = 120;
```

- [ ] **Step 4: Create `src/lib/player/deriveState.ts`**

```typescript
import type { TrainDay } from "@/lib/workout/types";

export type SetLoggedRow = {
  exerciseOrder: number;
  setNumber: number;
};

export type NextSet = {
  exerciseOrder: number;
  setNumber: number;
  isLastSetOfExercise: boolean;
  isLastExerciseOfDay: boolean;
};

export type DerivedProgress =
  | { allSetsDone: false; next: NextSet }
  | { allSetsDone: true; next: null };

function remainingAfterAreAllSkipped(
  day: TrainDay,
  exerciseOrder: number,
  skipped: Set<number>,
): boolean {
  for (let i = exerciseOrder + 1; i < day.exercises.length; i++) {
    if (!skipped.has(i)) return false;
  }
  return true;
}

export function deriveState(
  day: TrainDay,
  setsLogged: SetLoggedRow[],
  skippedExerciseOrders: Set<number> = new Set(),
): DerivedProgress {
  const logged = new Set(setsLogged.map((s) => `${s.exerciseOrder}:${s.setNumber}`));

  for (let exerciseOrder = 0; exerciseOrder < day.exercises.length; exerciseOrder++) {
    if (skippedExerciseOrders.has(exerciseOrder)) continue;

    const exercise = day.exercises[exerciseOrder]!;
    for (let setNumber = 1; setNumber <= exercise.sets; setNumber++) {
      if (!logged.has(`${exerciseOrder}:${setNumber}`)) {
        return {
          allSetsDone: false,
          next: {
            exerciseOrder,
            setNumber,
            isLastSetOfExercise: setNumber === exercise.sets,
            isLastExerciseOfDay: remainingAfterAreAllSkipped(day, exerciseOrder, skippedExerciseOrders),
          },
        };
      }
    }
  }

  return { allSetsDone: true, next: null };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/player/deriveState.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/player/constants.ts src/lib/player/deriveState.ts src/lib/player/deriveState.test.ts
git commit -m "feat(player): add rest constants and pure session-state derivation"
```

---

### Task 4: DB access layer

**Files:**
- Create: `src/lib/player/db.ts`
- Test: `src/lib/player/db.test.ts`

**Interfaces:**
- Consumes: `getDb` from `src/lib/db/client.ts` (Fondations).
- Produces: `type Seance = { id: number; parcours: string; level: number; dayIndex: number; startedAt: string; completedAt: string | null }`, `type SetLoggedRecord = { id: number; seanceId: number; exerciseOrder: number; setNumber: number; repsTarget: string; repsActual: number; restSeconds: number; completedAt: string }`. Functions: `getActiveSeance(db, parcours, level, dayIndex): Seance | null`, `startSeance(db, parcours, level, dayIndex): Seance`, `getOrStartSeance(db, parcours, level, dayIndex): Seance`, `getSetsForSeance(db, seanceId): SetLoggedRecord[]`, `logSet(db, params): SetLoggedRecord`, `skipExercise(db, seanceId, exerciseOrder): void`, `getSkippedExercises(db, seanceId): number[]`, `completeSeance(db, seanceId): void`. Consumed by `loadPlayerState.ts` (Task 5) and `actions.ts` (Task 11).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/player/db.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import {
  getActiveSeance,
  startSeance,
  getOrStartSeance,
  getSetsForSeance,
  logSet,
  skipExercise,
  getSkippedExercises,
  completeSeance,
} from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-player-db-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("seance lifecycle", () => {
  it("returns null when no active seance exists", () => {
    const db = setup();
    expect(getActiveSeance(db, "beginner", 0, 0)).toBeNull();
  });

  it("creates a seance with completedAt null", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    expect(seance.parcours).toBe("beginner");
    expect(seance.level).toBe(0);
    expect(seance.dayIndex).toBe(0);
    expect(seance.completedAt).toBeNull();
    expect(getActiveSeance(db, "beginner", 0, 0)).toEqual(seance);
  });

  it("getOrStartSeance reuses the existing active seance instead of creating a second one", () => {
    const db = setup();
    const first = getOrStartSeance(db, "beginner", 0, 0);
    const second = getOrStartSeance(db, "beginner", 0, 0);
    expect(second.id).toBe(first.id);
  });

  it("completeSeance sets completedAt, after which getActiveSeance no longer returns it", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    completeSeance(db, seance.id);
    expect(getActiveSeance(db, "beginner", 0, 0)).toBeNull();
  });
});

describe("sets_logged", () => {
  it("logs a set and returns it with an id and completedAt", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    const set = logSet(db, {
      seanceId: seance.id,
      exerciseOrder: 0,
      setNumber: 1,
      repsTarget: "10",
      repsActual: 9,
      restSeconds: 90,
    });
    expect(set.id).toBeGreaterThan(0);
    expect(set.repsActual).toBe(9);
    expect(set.completedAt).toBeTruthy();
  });

  it("getSetsForSeance returns only rows for that seance, in insertion order", () => {
    const db = setup();
    const seanceA = startSeance(db, "beginner", 0, 0);
    const seanceB = startSeance(db, "beginner", 0, 1);
    logSet(db, { seanceId: seanceA.id, exerciseOrder: 0, setNumber: 1, repsTarget: "10", repsActual: 10, restSeconds: 90 });
    logSet(db, { seanceId: seanceB.id, exerciseOrder: 0, setNumber: 1, repsTarget: "10", repsActual: 10, restSeconds: 90 });
    logSet(db, { seanceId: seanceA.id, exerciseOrder: 0, setNumber: 2, repsTarget: "10", repsActual: 8, restSeconds: 90 });

    const rows = getSetsForSeance(db, seanceA.id);
    expect(rows.map((r) => r.setNumber)).toEqual([1, 2]);
    expect(rows.every((r) => r.seanceId === seanceA.id)).toBe(true);
  });
});

describe("skipped_exercises", () => {
  it("records a skip and getSkippedExercises returns it", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    skipExercise(db, seance.id, 1);
    expect(getSkippedExercises(db, seance.id)).toEqual([1]);
  });

  it("is idempotent — skipping the same exercise twice does not duplicate or throw", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    skipExercise(db, seance.id, 1);
    skipExercise(db, seance.id, 1);
    expect(getSkippedExercises(db, seance.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/player/db.test.ts`
Expected: FAIL — `db.ts` does not exist.

- [ ] **Step 3: Create `src/lib/player/db.ts`**

```typescript
import type Database from "better-sqlite3";

export type Seance = {
  id: number;
  parcours: string;
  level: number;
  dayIndex: number;
  startedAt: string;
  completedAt: string | null;
};

export type SetLoggedRecord = {
  id: number;
  seanceId: number;
  exerciseOrder: number;
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
  completedAt: string;
};

export function getActiveSeance(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
): Seance | null {
  const row = db
    .prepare(
      `SELECT id, parcours, level, day_index AS dayIndex, started_at AS startedAt, completed_at AS completedAt
       FROM seances
       WHERE parcours = ? AND level = ? AND day_index = ? AND completed_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
    )
    .get(parcours, level, dayIndex) as Seance | undefined;
  return row ?? null;
}

export function startSeance(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
): Seance {
  const startedAt = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO seances (parcours, level, day_index, started_at) VALUES (?, ?, ?, ?)`)
    .run(parcours, level, dayIndex, startedAt);
  return {
    id: Number(result.lastInsertRowid),
    parcours,
    level,
    dayIndex,
    startedAt,
    completedAt: null,
  };
}

export function getOrStartSeance(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
): Seance {
  return getActiveSeance(db, parcours, level, dayIndex) ?? startSeance(db, parcours, level, dayIndex);
}

export function getSetsForSeance(db: Database.Database, seanceId: number): SetLoggedRecord[] {
  return db
    .prepare(
      `SELECT id, seance_id AS seanceId, exercise_order AS exerciseOrder, set_number AS setNumber,
              reps_target AS repsTarget, reps_actual AS repsActual, rest_seconds AS restSeconds,
              completed_at AS completedAt
       FROM sets_logged WHERE seance_id = ? ORDER BY id ASC`,
    )
    .all(seanceId) as SetLoggedRecord[];
}

export function logSet(
  db: Database.Database,
  params: {
    seanceId: number;
    exerciseOrder: number;
    setNumber: number;
    repsTarget: string;
    repsActual: number;
    restSeconds: number;
  },
): SetLoggedRecord {
  const completedAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO sets_logged (seance_id, exercise_order, set_number, reps_target, reps_actual, rest_seconds, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.seanceId,
      params.exerciseOrder,
      params.setNumber,
      params.repsTarget,
      params.repsActual,
      params.restSeconds,
      completedAt,
    );
  return { ...params, id: Number(result.lastInsertRowid), completedAt };
}

export function skipExercise(db: Database.Database, seanceId: number, exerciseOrder: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO skipped_exercises (seance_id, exercise_order, skipped_at) VALUES (?, ?, ?)`,
  ).run(seanceId, exerciseOrder, new Date().toISOString());
}

export function getSkippedExercises(db: Database.Database, seanceId: number): number[] {
  const rows = db
    .prepare(`SELECT exercise_order AS exerciseOrder FROM skipped_exercises WHERE seance_id = ?`)
    .all(seanceId) as { exerciseOrder: number }[];
  return rows.map((r) => r.exerciseOrder);
}

export function completeSeance(db: Database.Database, seanceId: number): void {
  db.prepare(`UPDATE seances SET completed_at = ? WHERE id = ?`).run(new Date().toISOString(), seanceId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/player/db.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/db.ts src/lib/player/db.test.ts
git commit -m "feat(player): add DB access layer for seances/sets_logged/skipped_exercises"
```

---

### Task 5: `loadPlayerState` — the critical resilience module

**Files:**
- Create: `src/lib/player/loadPlayerState.ts`
- Test: `src/lib/player/loadPlayerState.test.ts`

**Interfaces:**
- Consumes: `deriveState` (Task 3), `getOrStartSeance`/`getSetsForSeance`/`getSkippedExercises`/`skipExercise` (Task 4).
- Produces: `type PlayerState = { phase: "in-progress"; seanceId: number; next: NextSet; skippedExerciseOrders: number[] } | { phase: "pending-validation"; seanceId: number } | { phase: "completed"; seanceId: number }`. `loadPlayerState(db, parcours, level, dayIndex, day): PlayerState`. Consumed by `src/app/dev/player/page.tsx` (Task 12) and `PlayerScreen.tsx` (Task 12).

This module is what `page.tsx` calls on **every request** — it is the single place that proves the "state always read from DB" constraint. The test in this task simulates leaving and returning to the player by calling this function twice, with a direct DB write (mimicking what a Server Action does) in between, with no shared in-memory state carried across the two calls.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/player/loadPlayerState.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { loadPlayerState } from "./loadPlayerState";
import { logSet, skipExercise } from "./db";
import type { TrainDay } from "@/lib/workout/types";

const DAY: TrainDay = {
  kind: "train",
  label: "Day 1",
  exercises: [
    {
      id: "push-ups",
      name: "Push ups",
      movementFamily: "push",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 10, maxEffort: false, eachSide: false },
    },
    {
      id: "squats",
      name: "Squats",
      movementFamily: "legs",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 15, maxEffort: false, eachSide: false },
    },
  ],
};

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-player-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadPlayerState — reload resilience (CLAUDE.md §2 lesson)", () => {
  it("reflects a logged set on a fresh call, reusing the same seance, with no in-memory carryover", () => {
    const db = setup();

    const first = loadPlayerState(db, "beginner", 0, 0, DAY);
    expect(first.phase).toBe("in-progress");
    if (first.phase !== "in-progress") throw new Error("unreachable");
    expect(first.next).toEqual({
      exerciseOrder: 0,
      setNumber: 1,
      isLastSetOfExercise: false,
      isLastExerciseOfDay: false,
    });

    // Simulate exactly what a Server Action does: write directly to the
    // DB. Nothing here shares memory with the `first` call above.
    logSet(db, {
      seanceId: first.seanceId,
      exerciseOrder: 0,
      setNumber: 1,
      repsTarget: "10",
      repsActual: 10,
      restSeconds: 90,
    });

    // Simulate "navigate away and come back": a brand new call, as if it
    // were a fresh HTTP request hitting a fresh Server Component render.
    const second = loadPlayerState(db, "beginner", 0, 0, DAY);
    expect(second.phase).toBe("in-progress");
    if (second.phase !== "in-progress") throw new Error("unreachable");
    expect(second.next).toEqual({
      exerciseOrder: 0,
      setNumber: 2,
      isLastSetOfExercise: true,
      isLastExerciseOfDay: false,
    });
    expect(second.seanceId).toBe(first.seanceId);
  });

  it("shows pending-validation once every set is logged, without requiring completeSeance", () => {
    const db = setup();
    const state = loadPlayerState(db, "beginner", 0, 0, DAY);
    if (state.phase !== "in-progress") throw new Error("unreachable");

    for (const [exerciseOrder, setNumber] of [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ] as const) {
      logSet(db, {
        seanceId: state.seanceId,
        exerciseOrder,
        setNumber,
        repsTarget: "10",
        repsActual: 10,
        restSeconds: 90,
      });
    }

    const after = loadPlayerState(db, "beginner", 0, 0, DAY);
    expect(after.phase).toBe("pending-validation");
  });

  it("respects a skipped exercise on reload — resumes past it, not inside it", () => {
    const db = setup();
    const state = loadPlayerState(db, "beginner", 0, 0, DAY);
    if (state.phase !== "in-progress") throw new Error("unreachable");

    skipExercise(db, state.seanceId, 0);

    const after = loadPlayerState(db, "beginner", 0, 0, DAY);
    expect(after.phase).toBe("in-progress");
    if (after.phase !== "in-progress") throw new Error("unreachable");
    expect(after.next.exerciseOrder).toBe(1);
    expect(after.skippedExerciseOrders).toEqual([0]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/player/loadPlayerState.test.ts`
Expected: FAIL — `loadPlayerState.ts` does not exist.

- [ ] **Step 3: Create `src/lib/player/loadPlayerState.ts`**

```typescript
import type Database from "better-sqlite3";
import type { TrainDay } from "@/lib/workout/types";
import { deriveState, type NextSet } from "./deriveState";
import { getOrStartSeance, getSetsForSeance, getSkippedExercises } from "./db";

export type PlayerState =
  | { phase: "in-progress"; seanceId: number; next: NextSet; skippedExerciseOrders: number[] }
  | { phase: "pending-validation"; seanceId: number }
  | { phase: "completed"; seanceId: number };

export function loadPlayerState(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
  day: TrainDay,
): PlayerState {
  const seance = getOrStartSeance(db, parcours, level, dayIndex);

  if (seance.completedAt) {
    return { phase: "completed", seanceId: seance.id };
  }

  const sets = getSetsForSeance(db, seance.id);
  const skippedExerciseOrders = getSkippedExercises(db, seance.id);
  const progress = deriveState(day, sets, new Set(skippedExerciseOrders));

  if (progress.allSetsDone) {
    return { phase: "pending-validation", seanceId: seance.id };
  }

  return { phase: "in-progress", seanceId: seance.id, next: progress.next, skippedExerciseOrders };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/player/loadPlayerState.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/loadPlayerState.ts src/lib/player/loadPlayerState.test.ts
git commit -m "feat(player): add loadPlayerState with the reload-resilience test"
```

---

### Task 6: `formatTarget` helper

**Files:**
- Create: `src/lib/player/formatTarget.ts`
- Test: `src/lib/player/formatTarget.test.ts`

**Interfaces:**
- Consumes: `ExerciseTarget`, `TargetValue` from `src/lib/workout/types.ts`.
- Produces: `formatTarget(sets: number, target: ExerciseTarget): string`. Consumed by `ExerciseView.tsx` (Task 8).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/player/formatTarget.test.ts
import { describe, it, expect } from "vitest";
import { formatTarget } from "./formatTarget";
import type { ExerciseTarget } from "@/lib/workout/types";

function target(overrides: Partial<ExerciseTarget>): ExerciseTarget {
  return { unit: "reps", value: 12, maxEffort: false, eachSide: false, ...overrides };
}

describe("formatTarget", () => {
  it("formats a scalar value", () => {
    expect(formatTarget(3, target({ value: 12 }))).toBe("3 × 12");
  });

  it("formats a range value", () => {
    expect(formatTarget(4, target({ value: [8, 12] }))).toBe("4 × 8-12");
  });

  it("formats maxEffort as max", () => {
    expect(formatTarget(2, target({ value: null, maxEffort: true }))).toBe("2 × max");
  });

  it("formats a null value that isn't flagged maxEffort as max too", () => {
    expect(formatTarget(2, target({ value: null, maxEffort: false }))).toBe("2 × max");
  });

  it("appends a per-side suffix", () => {
    expect(formatTarget(3, target({ value: 10, eachSide: true }))).toBe("3 × 10 / côté");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/player/formatTarget.test.ts`
Expected: FAIL — `formatTarget.ts` does not exist.

- [ ] **Step 3: Create `src/lib/player/formatTarget.ts`**

```typescript
import type { ExerciseTarget } from "@/lib/workout/types";

export function formatTarget(sets: number, target: ExerciseTarget): string {
  let valueLabel: string;
  if (target.maxEffort || target.value === null) {
    valueLabel = "max";
  } else if (Array.isArray(target.value)) {
    valueLabel = target.value.join("-");
  } else {
    valueLabel = String(target.value);
  }
  const suffix = target.eachSide ? " / côté" : "";
  return `${sets} × ${valueLabel}${suffix}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/player/formatTarget.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/formatTarget.ts src/lib/player/formatTarget.test.ts
git commit -m "feat(player): add formatTarget display helper"
```

---

### Task 7: `RepsSheet` component

**Files:**
- Create: `src/components/player/RepsSheet.tsx`
- Test: `src/components/player/RepsSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (`src/components/Sheet.tsx`), `Button` (`src/components/Button.tsx`) — both from Fondations, unmodified.
- Produces: `RepsSheet` — props `{ open: boolean; onClose: () => void; initialValue: number; onConfirm: (value: number) => void }`. Consumed by `ExerciseView.tsx` (Task 8).

The design brief calls this a "feuille modale à molette" (scroll-wheel picker). A real drag/snap/momentum wheel is a meaningfully bigger interaction-engineering task than the rest of this component; this task implements it as a large stepper (−/value/+) instead — same modal container, same confirm flow, same default-prefilled-on-target behavior, cheaper to build and just as usable one-handed mid-session. Marked inline so it's easy to find and upgrade later.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/player/RepsSheet.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepsSheet } from "./RepsSheet";

describe("RepsSheet", () => {
  it("prefills the value on the target when opened", () => {
    render(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={() => {}} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("increments and decrements with the stepper buttons", async () => {
    render(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    expect(screen.getByText("13")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "−" }));
    await userEvent.click(screen.getByRole("button", { name: "−" }));
    expect(screen.getByText("11")).toBeInTheDocument();
  });

  it("never decrements below 0", async () => {
    render(<RepsSheet open onClose={() => {}} initialValue={0} onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "−" }));
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("confirms the current stepper value, not the initial one", async () => {
    const onConfirm = vi.fn();
    render(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onConfirm).toHaveBeenCalledWith(13);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/player/RepsSheet.test.tsx`
Expected: FAIL — `RepsSheet.tsx` does not exist.

- [ ] **Step 3: Create `src/components/player/RepsSheet.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";

// ponytail: stepper (−/valeur/+) au lieu d'une vraie molette à
// glisser/snap — le brief design l'appelle "feuille à molette", une
// vraie molette est beaucoup plus d'ingénierie d'interaction pour un
// gain marginal ici. Upgrade si ça se sent comme une friction réelle en
// séance.
export function RepsSheet({
  open,
  onClose,
  initialValue,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  initialValue: number;
  onConfirm: (value: number) => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  return (
    <Sheet open={open} onClose={onClose} title="Ajuster les reps">
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
      <Button variant="primary" accent="cobalt" onClick={() => onConfirm(value)}>
        Valider
      </Button>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/player/RepsSheet.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/player/RepsSheet.tsx src/components/player/RepsSheet.test.tsx
git commit -m "feat(player): add RepsSheet (stepper) for rep adjustment"
```

---

### Task 8: `ExerciseView` component

**Files:**
- Create: `src/components/player/ExerciseView.tsx`
- Test: `src/components/player/ExerciseView.test.tsx`

**Interfaces:**
- Consumes: `Card`, `Button`, `Pastille` (Fondations), `RepsSheet` (Task 7), `formatTarget` (Task 6), `Exercise` type (`src/lib/workout/types.ts`).
- Produces: `ExerciseView` — props `{ exercise: Exercise; exerciseIndex: number; totalExercises: number; setNumber: number; onCompleteSet: (repsActual: number) => void; onSkipExercise: () => void }`. Consumed by `PlayerScreen.tsx` (Task 12).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/player/ExerciseView.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseView } from "./ExerciseView";
import type { Exercise } from "@/lib/workout/types";

const EXERCISE: Exercise = {
  id: "push-ups",
  name: "Push ups",
  movementFamily: "push",
  countsInStats: true,
  videoId: null,
  sets: 3,
  target: { unit: "reps", value: 12, maxEffort: false, eachSide: false },
};

describe("ExerciseView", () => {
  it("shows the exercise name, progress, and formatted target", () => {
    render(
      <ExerciseView
        exercise={EXERCISE}
        exerciseIndex={1}
        totalExercises={4}
        setNumber={2}
        onCompleteSet={() => {}}
        onSkipExercise={() => {}}
      />,
    );
    expect(screen.getByText("Push ups")).toBeInTheDocument();
    expect(screen.getByText("Exercice 2 / 4")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
  });

  it("renders one pastille per set, marking earlier ones done and the current one today", () => {
    render(
      <ExerciseView
        exercise={EXERCISE}
        exerciseIndex={0}
        totalExercises={1}
        setNumber={2}
        onCompleteSet={() => {}}
        onSkipExercise={() => {}}
      />,
    );
    expect(screen.getByRole("img", { name: "Fait" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Aujourd'hui" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "À venir" })).toBeInTheDocument();
  });

  it("opens the RepsSheet prefilled on the target and confirms through to onCompleteSet", async () => {
    const onCompleteSet = vi.fn();
    render(
      <ExerciseView
        exercise={EXERCISE}
        exerciseIndex={0}
        totalExercises={1}
        setNumber={1}
        onCompleteSet={onCompleteSet}
        onSkipExercise={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Série terminée" }));
    expect(screen.getByText("12")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onCompleteSet).toHaveBeenCalledWith(12);
  });

  it("calls onSkipExercise from the secondary action", async () => {
    const onSkipExercise = vi.fn();
    render(
      <ExerciseView
        exercise={EXERCISE}
        exerciseIndex={0}
        totalExercises={1}
        setNumber={1}
        onCompleteSet={() => {}}
        onSkipExercise={onSkipExercise}
      />,
    );
    await userEvent.click(screen.getByText("Passer l'exercice"));
    expect(onSkipExercise).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/player/ExerciseView.test.tsx`
Expected: FAIL — `ExerciseView.tsx` does not exist.

- [ ] **Step 3: Create `src/components/player/ExerciseView.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Pastille, type PastilleState } from "@/components/Pastille";
import { RepsSheet } from "./RepsSheet";
import { formatTarget } from "@/lib/player/formatTarget";
import type { Exercise } from "@/lib/workout/types";

function targetDefaultReps(exercise: Exercise): number {
  const { target } = exercise;
  if (target.maxEffort || target.value === null) return 0;
  return Array.isArray(target.value) ? target.value[0] : target.value;
}

export function ExerciseView({
  exercise,
  exerciseIndex,
  totalExercises,
  setNumber,
  onCompleteSet,
  onSkipExercise,
}: {
  exercise: Exercise;
  exerciseIndex: number;
  totalExercises: number;
  setNumber: number;
  onCompleteSet: (repsActual: number) => void;
  onSkipExercise: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="p-5 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <span className="text-13 text-graphite">
          Exercice {exerciseIndex + 1} / {totalExercises}
        </span>
      </div>

      <Card className="p-5 flex flex-col gap-4">
        <h1 className="font-archivo text-32 font-semibold">{exercise.name}</h1>
        <div className="font-archivo text-72 font-semibold tabular-nums">
          {formatTarget(exercise.sets, exercise.target)}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: exercise.sets }, (_, i) => {
            const state: PastilleState = i + 1 < setNumber ? "done" : i + 1 === setNumber ? "today" : "upcoming";
            return <Pastille key={i} state={state} accent="cobalt" />;
          })}
        </div>
      </Card>

      <Button variant="primary" accent="cobalt" onClick={() => setSheetOpen(true)}>
        Série terminée
      </Button>

      <div className="flex justify-between text-13">
        <button type="button" onClick={onSkipExercise} className="text-graphite">
          Passer l'exercice
        </button>
        <button type="button" onClick={() => setSheetOpen(true)} className="text-graphite">
          Ajuster les reps
        </button>
      </div>

      <RepsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialValue={targetDefaultReps(exercise)}
        onConfirm={(value) => {
          setSheetOpen(false);
          onCompleteSet(value);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/player/ExerciseView.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/player/ExerciseView.tsx src/components/player/ExerciseView.test.tsx
git commit -m "feat(player): add ExerciseView"
```

---

### Task 9: `RestView` component

**Files:**
- Create: `src/components/player/RestView.tsx`
- Test: `src/components/player/RestView.test.tsx`

**Interfaces:**
- Consumes: `Button` (Fondations).
- Produces: `RestView` — props `{ durationSeconds: number; nextLabel: string; variant: "betweenSets" | "betweenExercises"; onComplete: () => void }`. Consumed by `PlayerScreen.tsx` (Task 12).

- [ ] **Step 1: Write the failing tests** — uses Vitest fake timers, since real countdown durations (90s/120s) can't run in real time in a test

```tsx
// src/components/player/RestView.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RestView } from "./RestView";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RestView", () => {
  it("counts down from the given duration and shows the next label", () => {
    render(
      <RestView durationSeconds={90} nextLabel="Push ups" variant="betweenSets" onComplete={() => {}} />,
    );
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText(/Push ups/)).toBeInTheDocument();
  });

  it("calls onComplete once the countdown reaches 0", () => {
    const onComplete = vi.fn();
    render(
      <RestView durationSeconds={2} nextLabel="Push ups" variant="betweenSets" onComplete={onComplete} />,
    );
    vi.advanceTimersByTime(2100);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("+15s extends the countdown without completing", () => {
    const onComplete = vi.fn();
    render(
      <RestView durationSeconds={5} nextLabel="Push ups" variant="betweenSets" onComplete={onComplete} />,
    );
    vi.advanceTimersByTime(1000);
    screen.getByRole("button", { name: "+15s" }).click();
    vi.advanceTimersByTime(5100);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("Passer le repos completes immediately", async () => {
    vi.useRealTimers();
    const onComplete = vi.fn();
    render(
      <RestView durationSeconds={90} nextLabel="Push ups" variant="betweenSets" onComplete={onComplete} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Passer le repos" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shows 'Exercice suivant' only for the betweenExercises variant", () => {
    const { rerender } = render(
      <RestView durationSeconds={90} nextLabel="Squats" variant="betweenSets" onComplete={() => {}} />,
    );
    expect(screen.queryByText("Exercice suivant")).not.toBeInTheDocument();

    rerender(
      <RestView durationSeconds={120} nextLabel="Squats" variant="betweenExercises" onComplete={() => {}} />,
    );
    expect(screen.getByText("Exercice suivant")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/player/RestView.test.tsx`
Expected: FAIL — `RestView.tsx` does not exist.

- [ ] **Step 3: Create `src/components/player/RestView.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";

export function RestView({
  durationSeconds,
  nextLabel,
  variant,
  onComplete,
}: {
  durationSeconds: number;
  nextLabel: string;
  variant: "betweenSets" | "betweenExercises";
  onComplete: () => void;
}) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const endAtRef = useRef(Date.now() + durationSeconds * 1000);

  useEffect(() => {
    const id = setInterval(() => {
      const secondsLeft = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRemaining(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(id);
        onComplete();
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleExtend() {
    endAtRef.current += 15_000;
    setRemaining((r) => r + 15);
  }

  function handleSkip() {
    endAtRef.current = Date.now();
    setRemaining(0);
    onComplete();
  }

  const digitColorClass = variant === "betweenSets" ? "text-cobalt" : "text-graphite";

  return (
    <div className="fixed inset-0 z-40 bg-paper flex flex-col items-center justify-center gap-6 p-5">
      <div className={`font-archivo text-96 font-semibold tabular-nums ${digitColorClass}`}>
        {remaining}
      </div>
      <div className="text-15 text-graphite text-center">
        {variant === "betweenExercises" && (
          <span className="block text-13 uppercase tracking-wide mb-1">Exercice suivant</span>
        )}
        Ensuite → {nextLabel}
      </div>
      <div className="flex gap-4">
        <Button variant="secondary" onClick={handleExtend}>
          +15s
        </Button>
        <Button variant="secondary" onClick={handleSkip}>
          Passer le repos
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/player/RestView.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/player/RestView.tsx src/components/player/RestView.test.tsx
git commit -m "feat(player): add RestView countdown"
```

---

### Task 10: `SummaryView` component

**Files:**
- Create: `src/components/player/SummaryView.tsx`
- Test: `src/components/player/SummaryView.test.tsx`

**Interfaces:**
- Consumes: `Card`, `Button` (Fondations), `Exercise` type, `SetLoggedRecord` type (Task 4).
- Produces: `SummaryView` — props `{ exercises: Exercise[]; setsLogged: SetLoggedRecord[]; durationSeconds: number; onFinish: () => void }`. Consumed by `PlayerScreen.tsx` (Task 12).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/player/SummaryView.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SummaryView } from "./SummaryView";
import type { Exercise } from "@/lib/workout/types";
import type { SetLoggedRecord } from "@/lib/player/db";

const EXERCISES: Exercise[] = [
  { id: "push-ups", name: "Push ups", movementFamily: "push", countsInStats: true, videoId: null, sets: 4, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
  { id: "squats", name: "Squats", movementFamily: "legs", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: 15, maxEffort: false, eachSide: false } },
];

function set(overrides: Partial<SetLoggedRecord>): SetLoggedRecord {
  return {
    id: 1,
    seanceId: 1,
    exerciseOrder: 0,
    setNumber: 1,
    repsTarget: "10",
    repsActual: 10,
    restSeconds: 90,
    completedAt: "2026-08-12T10:00:00.000Z",
    ...overrides,
  };
}

describe("SummaryView", () => {
  it("shows duration in minutes, exercise count, and total reps", () => {
    const setsLogged = [
      set({ exerciseOrder: 0, setNumber: 1, repsActual: 10 }),
      set({ exerciseOrder: 0, setNumber: 2, repsActual: 10 }),
      set({ exerciseOrder: 1, setNumber: 1, repsActual: 15 }),
    ];
    render(
      <SummaryView exercises={EXERCISES} setsLogged={setsLogged} durationSeconds={600} onFinish={() => {}} />,
    );
    expect(screen.getByText("10")).toBeInTheDocument(); // minutes
    expect(screen.getByText("2")).toBeInTheDocument(); // exercices
    expect(screen.getByText("35")).toBeInTheDocument(); // reps
  });

  it("lists only exercises with at least one logged set, each with its summed reps", () => {
    const setsLogged = [set({ exerciseOrder: 1, setNumber: 1, repsActual: 15 })];
    render(
      <SummaryView exercises={EXERCISES} setsLogged={setsLogged} durationSeconds={300} onFinish={() => {}} />,
    );
    expect(screen.queryByText("Push ups")).not.toBeInTheDocument();
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("+15 reps")).toBeInTheDocument();
  });

  it("calls onFinish when Terminer is clicked", async () => {
    const onFinish = vi.fn();
    render(
      <SummaryView exercises={EXERCISES} setsLogged={[]} durationSeconds={0} onFinish={onFinish} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/player/SummaryView.test.tsx`
Expected: FAIL — `SummaryView.tsx` does not exist.

- [ ] **Step 3: Create `src/components/player/SummaryView.tsx`**

```tsx
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import type { Exercise } from "@/lib/workout/types";
import type { SetLoggedRecord } from "@/lib/player/db";

export function SummaryView({
  exercises,
  setsLogged,
  durationSeconds,
  onFinish,
}: {
  exercises: Exercise[];
  setsLogged: SetLoggedRecord[];
  durationSeconds: number;
  onFinish: () => void;
}) {
  const repsByExercise = new Map<number, number>();
  for (const set of setsLogged) {
    repsByExercise.set(set.exerciseOrder, (repsByExercise.get(set.exerciseOrder) ?? 0) + set.repsActual);
  }
  const exercisesWorked = repsByExercise.size;
  const totalReps = [...repsByExercise.values()].reduce((sum, reps) => sum + reps, 0);
  const minutes = Math.round(durationSeconds / 60);

  return (
    <div className="p-5 flex flex-col gap-8">
      <h1 className="font-archivo text-32 font-semibold">Séance terminée</h1>

      <div className="flex justify-between">
        <div>
          <div className="font-archivo text-44 font-semibold tabular-nums">{minutes}</div>
          <div className="text-13 text-graphite">minutes</div>
        </div>
        <div>
          <div className="font-archivo text-44 font-semibold tabular-nums">{exercisesWorked}</div>
          <div className="text-13 text-graphite">exercices</div>
        </div>
        <div>
          <div className="font-archivo text-44 font-semibold tabular-nums">{totalReps}</div>
          <div className="text-13 text-graphite">répétitions</div>
        </div>
      </div>

      <Card className="p-5 flex flex-col gap-3">
        {exercises.map((exercise, exerciseOrder) => {
          const reps = repsByExercise.get(exerciseOrder);
          if (reps === undefined) return null;
          return (
            <div key={exercise.id} className="flex justify-between text-15">
              <span>{exercise.name}</span>
              <span className="font-archivo tabular-nums">+{reps} reps</span>
            </div>
          );
        })}
      </Card>

      <Button variant="primary" accent="cobalt" onClick={onFinish}>
        Terminer
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/player/SummaryView.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/player/SummaryView.tsx src/components/player/SummaryView.test.tsx
git commit -m "feat(player): add SummaryView"
```

---

### Task 11: Server Actions

**Files:**
- Create: `src/lib/player/actions.ts`

**Interfaces:**
- Consumes: `getDb` (`src/lib/db/client.ts`), `logSet`/`skipExercise`/`completeSeance` (Task 4).
- Produces: `logSetAction(params): Promise<void>`, `skipExerciseAction(seanceId, exerciseOrder): Promise<void>`, `completeSeanceAction(seanceId): Promise<void>`. Consumed by `PlayerScreen.tsx` (Task 12).

No dedicated test file: this module is a thin `"use server"` wrapper with no branching logic of its own — every code path it has is already covered by Task 4's `db.test.ts` (the functions it calls) and exercised end-to-end once `PlayerScreen` is wired up in Task 12. A test here would just re-mock what Task 4 already tests directly against a real DB.

- [ ] **Step 1: Create `src/lib/player/actions.ts`**

```typescript
"use server";

import type Database from "better-sqlite3";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import {
  logSet as logSetDb,
  skipExercise as skipExerciseDb,
  completeSeance as completeSeanceDb,
} from "./db";

let dbInstance: Database.Database | null = null;

function db(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
    dbInstance = getDb(dbPath);
  }
  return dbInstance;
}

export async function logSetAction(params: {
  seanceId: number;
  exerciseOrder: number;
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
}): Promise<void> {
  logSetDb(db(), params);
}

export async function skipExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipExerciseDb(db(), seanceId, exerciseOrder);
}

export async function completeSeanceAction(seanceId: number): Promise<void> {
  completeSeanceDb(db(), seanceId);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/player/actions.ts
git commit -m "feat(player): add Server Actions for logging sets, skips, and completion"
```

---

### Task 12: `PlayerScreen` orchestrator + `/dev/player` route

**Files:**
- Create: `src/components/player/PlayerScreen.tsx`
- Test: `src/components/player/PlayerScreen.test.tsx`
- Create: `src/app/dev/player/page.tsx`

**Interfaces:**
- Consumes: `ExerciseView` (Task 8), `RestView` (Task 9), `SummaryView` (Task 10), `logSetAction`/`skipExerciseAction`/`completeSeanceAction` (Task 11), `REST_BETWEEN_SETS_SECONDS`/`REST_BETWEEN_EXERCISES_SECONDS` (Task 3), `PlayerState` (Task 5), `loadPlayerState` (Task 5), `getSetsForSeance` (Task 4), `beginner`/`intermediate`/`advanced` (`src/lib/workout/data.ts`), `getDb` (`src/lib/db/client.ts`).
- Produces: the working `/dev/player?parcours=&level=&day=` route.

- [ ] **Step 1: Write the failing tests for `PlayerScreen`** — mock the Server Actions (they're thin DB wrappers already tested in Task 4) and `next/navigation`'s `useRouter`, focus on orchestration logic

```tsx
// src/components/player/PlayerScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerScreen } from "./PlayerScreen";
import type { TrainDay } from "@/lib/workout/types";
import type { PlayerState } from "@/lib/player/loadPlayerState";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const logSetAction = vi.fn().mockResolvedValue(undefined);
const skipExerciseAction = vi.fn().mockResolvedValue(undefined);
const completeSeanceAction = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/player/actions", () => ({
  logSetAction: (...args: unknown[]) => logSetAction(...args),
  skipExerciseAction: (...args: unknown[]) => skipExerciseAction(...args),
  completeSeanceAction: (...args: unknown[]) => completeSeanceAction(...args),
}));

const DAY: TrainDay = {
  kind: "train",
  label: "Day 1",
  exercises: [
    { id: "push-ups", name: "Push ups", movementFamily: "push", countsInStats: true, videoId: null, sets: 1, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
    { id: "squats", name: "Squats", movementFamily: "legs", countsInStats: true, videoId: null, sets: 1, target: { unit: "reps", value: 15, maxEffort: false, eachSide: false } },
  ],
};

beforeEach(() => {
  refresh.mockClear();
  logSetAction.mockClear();
  skipExerciseAction.mockClear();
  completeSeanceAction.mockClear();
});

describe("PlayerScreen", () => {
  it("renders ExerciseView for an in-progress state", () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} />);
    expect(screen.getByText("Push ups")).toBeInTheDocument();
  });

  it("logs the set then shows RestView with the betweenExercises variant when it was the last set", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} />);

    await userEvent.click(screen.getByRole("button", { name: "Série terminée" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(logSetAction).toHaveBeenCalledWith(
      expect.objectContaining({ seanceId: 1, exerciseOrder: 0, setNumber: 1, repsActual: 10, restSeconds: 120 }),
    );
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText(/Squats/)).toBeInTheDocument();
  });

  it("skips the exercise and refreshes", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} />);

    await userEvent.click(screen.getByText("Passer l'exercice"));

    expect(skipExerciseAction).toHaveBeenCalledWith(1, 0);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("renders SummaryView for pending-validation and completes on Terminer", async () => {
    const state: PlayerState = { phase: "pending-validation", seanceId: 1 };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} />);

    await userEvent.click(screen.getByRole("button", { name: "Terminer" }));

    expect(completeSeanceAction).toHaveBeenCalledWith(1);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows a simple message for an already-completed seance", () => {
    const state: PlayerState = { phase: "completed", seanceId: 1 };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} />);
    expect(screen.getByText("Séance déjà validée.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/player/PlayerScreen.test.tsx`
Expected: FAIL — `PlayerScreen.tsx` does not exist.

- [ ] **Step 3: Create `src/components/player/PlayerScreen.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExerciseView } from "./ExerciseView";
import { RestView } from "./RestView";
import { SummaryView } from "./SummaryView";
import { logSetAction, skipExerciseAction, completeSeanceAction } from "@/lib/player/actions";
import { REST_BETWEEN_SETS_SECONDS, REST_BETWEEN_EXERCISES_SECONDS } from "@/lib/player/constants";
import type { TrainDay } from "@/lib/workout/types";
import type { PlayerState } from "@/lib/player/loadPlayerState";
import type { SetLoggedRecord } from "@/lib/player/db";

type LocalPhase =
  | { kind: "exercise" }
  | {
      kind: "rest";
      variant: "betweenSets" | "betweenExercises";
      durationSeconds: number;
      nextLabel: string;
    };

function findNextLabel(day: TrainDay, fromExerciseOrder: number, skippedExerciseOrders: number[]): string {
  const skipped = new Set(skippedExerciseOrders);
  for (let i = fromExerciseOrder + 1; i < day.exercises.length; i++) {
    if (!skipped.has(i)) return day.exercises[i]!.name;
  }
  return "Fin de séance";
}

export function PlayerScreen({
  day,
  state,
  setsLogged,
}: {
  day: TrainDay;
  state: PlayerState;
  setsLogged: SetLoggedRecord[];
}) {
  const router = useRouter();
  const [localPhase, setLocalPhase] = useState<LocalPhase>({ kind: "exercise" });

  if (state.phase === "pending-validation") {
    return (
      <SummaryView
        exercises={day.exercises}
        setsLogged={setsLogged}
        durationSeconds={0}
        onFinish={async () => {
          await completeSeanceAction(state.seanceId);
          router.refresh();
        }}
      />
    );
  }

  if (state.phase === "completed") {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Séance déjà validée.</p>
      </main>
    );
  }

  const { exerciseOrder, setNumber, isLastSetOfExercise } = state.next;
  const exercise = day.exercises[exerciseOrder]!;

  async function handleCompleteSet(repsActual: number) {
    const restSeconds = isLastSetOfExercise ? REST_BETWEEN_EXERCISES_SECONDS : REST_BETWEEN_SETS_SECONDS;
    await logSetAction({
      seanceId: state.seanceId,
      exerciseOrder,
      setNumber,
      repsTarget: JSON.stringify(exercise.target.value),
      repsActual,
      restSeconds,
    });
    setLocalPhase({
      kind: "rest",
      variant: isLastSetOfExercise ? "betweenExercises" : "betweenSets",
      durationSeconds: restSeconds,
      nextLabel: isLastSetOfExercise
        ? findNextLabel(day, exerciseOrder, state.skippedExerciseOrders)
        : exercise.name,
    });
  }

  async function handleSkipExercise() {
    await skipExerciseAction(state.seanceId, exerciseOrder);
    router.refresh();
  }

  if (localPhase.kind === "rest") {
    return (
      <RestView
        durationSeconds={localPhase.durationSeconds}
        nextLabel={localPhase.nextLabel}
        variant={localPhase.variant}
        onComplete={() => {
          setLocalPhase({ kind: "exercise" });
          router.refresh();
        }}
      />
    );
  }

  return (
    <ExerciseView
      exercise={exercise}
      exerciseIndex={exerciseOrder}
      totalExercises={day.exercises.length}
      setNumber={setNumber}
      onCompleteSet={handleCompleteSet}
      onSkipExercise={handleSkipExercise}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/player/PlayerScreen.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Create `src/app/dev/player/page.tsx`**

```tsx
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { loadPlayerState } from "@/lib/player/loadPlayerState";
import { getSetsForSeance } from "@/lib/player/db";
import { beginner, intermediate, advanced } from "@/lib/workout/data";
import type { Program } from "@/lib/workout/types";
import { PlayerScreen } from "@/components/player/PlayerScreen";

const PROGRAMS: Record<string, Program> = { beginner, intermediate, advanced };

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default async function DevPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ parcours?: string; level?: string; day?: string }>;
}) {
  const params = await searchParams;
  const parcours = params.parcours ?? "";
  const level = Number(params.level);
  const dayIndex = Number(params.day);

  const program = PROGRAMS[parcours];
  const programLevel = program?.[level];
  const day = programLevel?.[dayIndex];

  if (!program || !programLevel || !day || day.kind !== "train") {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">
          Jour introuvable pour ces paramètres. Essaie
          /dev/player?parcours=beginner&level=0&day=0
        </p>
      </main>
    );
  }

  const db = getDb(dbPath());
  const state = loadPlayerState(db, parcours, level, dayIndex, day);
  const setsLogged = getSetsForSeance(db, state.seanceId);

  return <PlayerScreen day={day} state={state} setsLogged={setsLogged} />;
}
```

- [ ] **Step 6: Verify manually**

Run: `npm run db:migrate` (picks up `0001_seances.sql` if not already applied), then `npm run dev`, open `http://localhost:3000/dev/player?parcours=beginner&level=0&day=0`.
Expected: exercise view renders for beginner level 1 day 1, "Série terminée" logs a set and transitions to rest, timer counts down and auto-advances, last exercise's last set leads to the récap, "Terminer" validates and shows "Séance déjà validée." on a subsequent load with the same URL.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass, zero type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/player/PlayerScreen.tsx src/components/player/PlayerScreen.test.tsx src/app/dev/player/page.tsx
git commit -m "feat(player): wire PlayerScreen into /dev/player route"
```

---

## Self-Review Notes

- **Spec coverage:** migration ✓ (Task 1), design token gap fixed ✓ (Task 2), rest constants + state derivation ✓ (Task 3), DB layer including the skip mechanism the spec under-specified ✓ (Task 4), the critical reload-resilience test ✓ (Task 5, directly implements the spec's "Tests" section), target formatting ✓ (Task 6), RepsSheet/ExerciseView/RestView/SummaryView ✓ (Tasks 7-10, each matching the spec's per-screen behavior list), Server Actions ✓ (Task 11), route + orchestration + manual end-to-end walkthrough ✓ (Task 12).
- **Placeholder scan:** none found — every step has literal code or literal commands.
- **Type consistency:** `NextSet`/`DerivedProgress` (Task 3) flow unchanged into `PlayerState` (Task 5) into `PlayerScreen` (Task 12) — no redefinition. `Seance`/`SetLoggedRecord` (Task 4) are the same shapes consumed by `loadPlayerState.ts`, `actions.ts`, and `SummaryView.tsx`.
- **Design gap resolved during planning:** the approved spec said skipping an exercise writes no `sets_logged` rows, which is correct for the récap, but on its own gives `deriveState` no way to know a whole exercise was skipped versus not yet reached — it would incorrectly resume the user back inside a skipped exercise. Resolved by adding `skipped_exercises` (Task 1) as its own tiny table, threaded through `deriveState` (Task 3), `db.ts` (Task 4), and `loadPlayerState` (Task 5) — the outcome the spec described (no `sets_logged` rows, absent from récap) is unchanged; only the resumability mechanism was added.
- **Design token gap resolved during planning:** the original Claude Design brief specifies the exercise target display at 72px, distinct from the 96px rest-timer/rep-counter size — Fondations' token set only registered 96px because `CLAUDE.md`'s summary compressed both into one sentence. Task 2 fixes this before any Player component needs it, consistent with priority #1 (design fidelity to the original brief, not to a paraphrase of it).
