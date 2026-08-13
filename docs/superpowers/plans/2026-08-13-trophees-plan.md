# Trophées Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Trophées page — all-time reps cumulated per exercise across both Programme and Dos axes, with paliers, a card grid with tri/filtre, a per-exercise detail view, and the SummaryView retrofit that surfaces the new total and palier-crossing at the end of every séance.

**Architecture:** No new table — `computeTrophies(db)` re-aggregates `sets_logged`/`dos_sets_logged` on every read (same principle as the CLAUDE.md §2 lesson: state comes from the source of truth, never a maintained-alongside counter). Card identity: Programme exercise `id` (slug from `data.ts`), Dos `ArbreId` (one card per arbre, spanning every cran ever done under it — never per-cran, which would reset on level-up). A per-set eligibility rule (`isReplogEligible`) replaces the static Programme `countsInStats` check for Dos, since a single arbre (C) prescribes reps in some blocs and seconds in others.

**Tech Stack:** Next.js App Router (Server Components + one Client Component for interactive tri/filtre), better-sqlite3, Vitest + Testing Library (existing project stack, no new dependencies).

## Global Constraints

- `PALIERS = [100, 500, 1000, 5000, 10000, 25000]` (brief §4.6) — exact values, no others.
- `--brass` (`#A9782C`) is the only accent used across every Trophées component — hardcoded literal Tailwind classes (`text-brass`, `bg-brass`, `border-brass`), never parameterized via an `accent` prop (matches the existing DosScreen/ProgrammeScreen convention — accent is baked in per module, not passed down).
- Français partout, tutoiement, zéro jargon, zéro point d'exclamation en cascade — "l'app constate, elle n'encourage pas" (CLAUDE.md §4). "Palier" jamais "level". "Répétitions" jamais "reps" dans le texte narratif (mais "reps" reste correct dans les compteurs hérités du player, ex. `+15 reps`, déjà en place — ne pas y toucher).
- Chiffres tabulaires (`tabular-nums`) partout où un chiffre affiché peut changer.
- `prefers-reduced-motion: reduce` doit désactiver l'animation de compteur — jamais d'exception.
- Toute nouvelle route sous `(shell)` ou `player` prend `export const dynamic = "force-dynamic"` (bug de pré-rendu statique déjà rencontré et corrigé en 4b — ne pas le réintroduire).
- **`seances.level` et `Program` sont indexés 0-based** — `program[level][dayIndex]`, jamais `program[level - 1]`. Vérifié dans `src/lib/programme/loadProgrammeState.ts:23-26` et `src/app/player/page.tsx` (`program?.[level]`). Une erreur ici décale silencieusement tous les totaux Programme d'un niveau.
- `ARBRE_EXERCISE_ID` (regex `/^([A-J])-(\d+)$/`) vit dans `src/lib/dos/bilan.ts` — importer, ne jamais redéclarer (convention déjà établie en 4b pour éviter une régression de deux regex qui divergent).
- Tests unitaires purs = fixture SQLite en mémoire via `getDb` + `runMigrations` (voir `src/lib/dos/loadDosPlayerState.test.ts` pour le pattern exact). Composants animés/temporisés = `vi.useFakeTimers()` + `act(() => vi.advanceTimersByTime(...))` (voir `src/components/player/RestView.test.tsx`).

---

### Task 1: `paliers.ts` — seuils et calculs purs

**Files:**
- Create: `src/lib/trophies/paliers.ts`
- Test: `src/lib/trophies/paliers.test.ts`

**Interfaces:**
- Produces: `PALIERS: readonly [100, 500, 1000, 5000, 10000, 25000]`, `palierAtteint(total: number): number | null`, `prochainPalier(total: number): number | null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/trophies/paliers.test.ts
import { describe, it, expect } from "vitest";
import { PALIERS, palierAtteint, prochainPalier } from "./paliers";

describe("PALIERS", () => {
  it("is the exact brief sequence", () => {
    expect(PALIERS).toEqual([100, 500, 1000, 5000, 10000, 25000]);
  });
});

describe("palierAtteint", () => {
  it("returns null below the first threshold", () => {
    expect(palierAtteint(0)).toBeNull();
    expect(palierAtteint(99)).toBeNull();
  });

  it("returns the threshold exactly at the boundary", () => {
    expect(palierAtteint(100)).toBe(100);
  });

  it("returns the highest threshold reached, not the nearest", () => {
    expect(palierAtteint(101)).toBe(100);
    expect(palierAtteint(999)).toBe(500);
    expect(palierAtteint(24999)).toBe(10000);
  });

  it("returns the last threshold beyond the top of the scale", () => {
    expect(palierAtteint(25000)).toBe(25000);
    expect(palierAtteint(25001)).toBe(25000);
    expect(palierAtteint(1_000_000)).toBe(25000);
  });
});

describe("prochainPalier", () => {
  it("returns the first threshold above the total", () => {
    expect(prochainPalier(0)).toBe(100);
    expect(prochainPalier(99)).toBe(100);
    expect(prochainPalier(100)).toBe(500);
    expect(prochainPalier(24999)).toBe(25000);
  });

  it("returns null once every threshold is passed", () => {
    expect(prochainPalier(25000)).toBeNull();
    expect(prochainPalier(30000)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/trophies/paliers.test.ts`
Expected: FAIL — `Cannot find module './paliers'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/trophies/paliers.ts
export const PALIERS = [100, 500, 1000, 5000, 10000, 25000] as const;

export function palierAtteint(total: number): number | null {
  const atteints = PALIERS.filter((p) => total >= p);
  return atteints.length > 0 ? atteints[atteints.length - 1]! : null;
}

export function prochainPalier(total: number): number | null {
  return PALIERS.find((p) => p > total) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/trophies/paliers.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/trophies/paliers.ts src/lib/trophies/paliers.test.ts
git commit -m "feat(trophies): add paliers thresholds and lookup"
```

---

### Task 2: `computeTrophies` — agrégation Programme + Dos

**Files:**
- Create: `src/lib/trophies/computeTrophies.ts`
- Test: `src/lib/trophies/computeTrophies.test.ts`

**Interfaces:**
- Consumes: `getParcours(id: string)` from `@/lib/programme/parcours` (returns `{ program: Program, ... } | undefined`, `Program = ProgramDay[][]`, 0-based). `computeBlock(week: number): number` from `@/lib/backpain/periode`. `ARBRES: Record<ArbreId, Arbre>` from `@/lib/backpain/arbres` (each `Arbre` has `nom: string`, `crans: {numero,nom}[]`, `prescriptions: [Prescription,Prescription,Prescription,Prescription]` with `Prescription.unite: "reps"|"s"|"m"`). `ARBRE_EXERCISE_ID` regex from `@/lib/dos/bilan`.
- Produces: `TrophyCard` type, `resolveTrophyCardId(exerciseId: string): string`, `isReplogEligible(exerciseId: string, countsInStats: boolean, semaine?: number): boolean`, `computeTrophies(db: Database.Database): TrophyCard[]`. Consumed by Task 3, 4, and Task 10 (SummaryView retrofit).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/trophies/computeTrophies.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSet } from "@/lib/player/db";
import { startDosSeance, logDosSet } from "@/lib/dos/db";
import { computeTrophies, resolveTrophyCardId, isReplogEligible } from "./computeTrophies";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-trophies-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("resolveTrophyCardId", () => {
  it("returns the arbre letter for an arbre exercise id", () => {
    expect(resolveTrophyCardId("A-3")).toBe("A");
    expect(resolveTrophyCardId("C-1")).toBe("C");
  });

  it("returns the id unchanged for a non-arbre id", () => {
    expect(resolveTrophyCardId("squats")).toBe("squats");
    expect(resolveTrophyCardId("lundi-hip-hinge-echauffement")).toBe("lundi-hip-hinge-echauffement");
  });
});

describe("isReplogEligible", () => {
  it("falls back to countsInStats for a non-arbre id", () => {
    expect(isReplogEligible("squats", true)).toBe(true);
    expect(isReplogEligible("plank", false)).toBe(false);
  });

  it("checks the arbre's unite for the given bloc, ignoring countsInStats", () => {
    // Arbre A is "reps" in every bloc.
    expect(isReplogEligible("A-1", true, 1)).toBe(true);
    // Arbre C is "reps" in blocs 1-2, "s" in blocs 3-4 (weeks 9-16).
    expect(isReplogEligible("C-1", true, 1)).toBe(true);
    expect(isReplogEligible("C-1", true, 9)).toBe(false);
  });
});

describe("computeTrophies — Programme", () => {
  it("merges the same exercise id logged across different days into one card", () => {
    const db = setup();
    // beginner[0][0] (Day 1) exerciseOrder 6 = "squats", countsInStats: true
    const seanceA = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seanceA.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 15, restSeconds: 90 });
    // beginner[0][4] (Day 5) exerciseOrder 6 = "squats" too
    const seanceB = startSeance(db, "beginner", 0, 4);
    logSet(db, { seanceId: seanceB.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 12, restSeconds: 90 });

    const cards = computeTrophies(db);
    const squats = cards.find((c) => c.id === "squats");
    expect(squats).toMatchObject({ module: "programme", name: "Squats", total: 27, seanceCount: 2 });
  });

  it("excludes an exercise with countsInStats: false", () => {
    const db = setup();
    // beginner[0][0] exerciseOrder 0 = "push-ups-on-knees-negatives", countsInStats: false
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 0, setNumber: 1, repsTarget: "6", repsActual: 6, restSeconds: 90 });

    const cards = computeTrophies(db);
    expect(cards.find((c) => c.id === "push-ups-on-knees-negatives")).toBeUndefined();
  });
});

describe("computeTrophies — Dos", () => {
  it("counts a reps-bloc set and excludes a seconds-bloc set for the same arbre, grouping crans under one card", () => {
    const db = setup();
    // Arbre C: bloc 1 (weeks 1-4) = reps, bloc 3 (weeks 9-12) = "s".
    const seanceReps1 = startDosSeance(db, "2026-01-05", "lundi", 1);
    logDosSet(db, { seanceId: seanceReps1.id, exerciseOrder: 0, exerciseId: "C-1", setNumber: 1, valeurTarget: "10-12", valeurActual: 10, restSeconds: 60 });
    const seanceReps2 = startDosSeance(db, "2026-01-12", "lundi", 2);
    logDosSet(db, { seanceId: seanceReps2.id, exerciseOrder: 0, exerciseId: "C-2", setNumber: 1, valeurTarget: "12-15", valeurActual: 12, restSeconds: 60 });
    const seanceSeconds = startDosSeance(db, "2026-03-02", "lundi", 9);
    logDosSet(db, { seanceId: seanceSeconds.id, exerciseOrder: 0, exerciseId: "C-1", setNumber: 1, valeurTarget: "30-45", valeurActual: 40, restSeconds: 60 });

    const cards = computeTrophies(db);
    const arbreC = cards.find((c) => c.id === "C");
    expect(arbreC).toMatchObject({ module: "dos", name: "Extenseurs lombaires", total: 22, seanceCount: 2 });
    expect(arbreC?.byCran).toEqual([
      { cran: 1, nom: "Superman au sol, tenue 5 s", total: 10 },
      { cran: 2, nom: "Reverse hyper au bord du lit", total: 12 },
    ]);
  });

  it("never creates a card for a fixed (non-arbre) Dos exercise id", () => {
    const db = setup();
    const seance = startDosSeance(db, "2026-01-05", "lundi", 1);
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 1, exerciseId: "lundi-hip-hinge-echauffement", setNumber: 1, valeurTarget: "10", valeurActual: 10, restSeconds: 60 });

    const cards = computeTrophies(db);
    expect(cards.find((c) => c.id === "lundi-hip-hinge-echauffement")).toBeUndefined();
    expect(cards).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/trophies/computeTrophies.test.ts`
Expected: FAIL — `Cannot find module './computeTrophies'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/trophies/computeTrophies.ts
import type Database from "better-sqlite3";
import { getParcours } from "@/lib/programme/parcours";
import { computeBlock } from "@/lib/backpain/periode";
import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { ARBRE_EXERCISE_ID } from "@/lib/dos/bilan";

export type TrophyCard = {
  id: string;
  module: "programme" | "dos";
  name: string;
  movementFamily: string;
  videoId: string | null;
  total: number;
  firstAt: string;
  lastAt: string;
  seanceCount: number;
  byCran?: { cran: number; nom: string; total: number }[];
};

export function resolveTrophyCardId(exerciseId: string): string {
  const match = exerciseId.match(ARBRE_EXERCISE_ID);
  return match ? match[1]! : exerciseId;
}

export function isReplogEligible(exerciseId: string, countsInStats: boolean, semaine?: number): boolean {
  const match = exerciseId.match(ARBRE_EXERCISE_ID);
  if (!match) return countsInStats;
  const arbre = match[1] as ArbreId;
  const bloc = computeBlock(semaine!);
  return ARBRES[arbre].prescriptions[bloc - 1]!.unite === "reps";
}

type Accumulator = {
  module: "programme" | "dos";
  name: string;
  movementFamily: string;
  videoId: string | null;
  total: number;
  firstAt: string;
  lastAt: string;
  seanceIds: Set<number>;
  byCran: Map<number, number>;
};

function touch(acc: Accumulator, amount: number, completedAt: string, seanceId: number, cran?: number): void {
  acc.total += amount;
  if (completedAt < acc.firstAt) acc.firstAt = completedAt;
  if (completedAt > acc.lastAt) acc.lastAt = completedAt;
  acc.seanceIds.add(seanceId);
  if (cran !== undefined) acc.byCran.set(cran, (acc.byCran.get(cran) ?? 0) + amount);
}

export function computeTrophies(db: Database.Database): TrophyCard[] {
  const acc = new Map<string, Accumulator>();

  const programmeRows = db
    .prepare(
      `SELECT sl.exercise_order AS exerciseOrder, sl.reps_actual AS repsActual, sl.completed_at AS completedAt,
              sl.seance_id AS seanceId, s.parcours, s.level, s.day_index AS dayIndex
       FROM sets_logged sl JOIN seances s ON sl.seance_id = s.id`,
    )
    .all() as {
    exerciseOrder: number;
    repsActual: number;
    completedAt: string;
    seanceId: number;
    parcours: string;
    level: number;
    dayIndex: number;
  }[];

  for (const row of programmeRows) {
    const parcoursMeta = getParcours(row.parcours);
    const day = parcoursMeta?.program[row.level]?.[row.dayIndex];
    if (!day || day.kind !== "train") continue;
    const exercise = day.exercises[row.exerciseOrder];
    if (!exercise) continue;
    if (!isReplogEligible(exercise.id, exercise.countsInStats)) continue;

    const id = resolveTrophyCardId(exercise.id);
    let entry = acc.get(id);
    if (!entry) {
      entry = {
        module: "programme",
        name: exercise.name,
        movementFamily: exercise.movementFamily,
        videoId: exercise.videoId,
        total: 0,
        firstAt: row.completedAt,
        lastAt: row.completedAt,
        seanceIds: new Set(),
        byCran: new Map(),
      };
      acc.set(id, entry);
    }
    touch(entry, row.repsActual, row.completedAt, row.seanceId);
  }

  const dosRows = db
    .prepare(
      `SELECT dsl.exercise_id AS exerciseId, dsl.valeur_actual AS valeurActual, dsl.completed_at AS completedAt,
              dsl.seance_id AS seanceId, ds.semaine
       FROM dos_sets_logged dsl JOIN dos_seances ds ON dsl.seance_id = ds.id`,
    )
    .all() as {
    exerciseId: string;
    valeurActual: number;
    completedAt: string;
    seanceId: number;
    semaine: number;
  }[];

  for (const row of dosRows) {
    const match = row.exerciseId.match(ARBRE_EXERCISE_ID);
    if (!match) continue; // exercice fixe, jamais compté
    const arbre = match[1] as ArbreId;
    const cran = Number(match[2]);
    if (!isReplogEligible(row.exerciseId, true, row.semaine)) continue;

    let entry = acc.get(arbre);
    if (!entry) {
      entry = {
        module: "dos",
        name: ARBRES[arbre].nom,
        movementFamily: `arbre-${arbre}`,
        videoId: null,
        total: 0,
        firstAt: row.completedAt,
        lastAt: row.completedAt,
        seanceIds: new Set(),
        byCran: new Map(),
      };
      acc.set(arbre, entry);
    }
    touch(entry, row.valeurActual, row.completedAt, row.seanceId, cran);
  }

  return [...acc.entries()].map(([id, entry]) => ({
    id,
    module: entry.module,
    name: entry.name,
    movementFamily: entry.movementFamily,
    videoId: entry.videoId,
    total: entry.total,
    firstAt: entry.firstAt,
    lastAt: entry.lastAt,
    seanceCount: entry.seanceIds.size,
    byCran:
      entry.module === "dos"
        ? [...entry.byCran.entries()]
            .sort(([a], [b]) => a - b)
            .map(([cran, total]) => ({ cran, nom: ARBRES[id as ArbreId].crans[cran - 1]!.nom, total }))
        : undefined,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/trophies/computeTrophies.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/trophies/computeTrophies.ts src/lib/trophies/computeTrophies.test.ts
git commit -m "feat(trophies): add computeTrophies aggregation across Programme and Dos"
```

---

### Task 3: `loadTropheesScreenState` — en-tête de la page

**Files:**
- Create: `src/lib/trophies/loadTropheesScreenState.ts`
- Test: `src/lib/trophies/loadTropheesScreenState.test.ts`

**Interfaces:**
- Consumes: `computeTrophies(db)`, `TrophyCard` from Task 2.
- Produces: `TropheesScreenState` type, `loadTropheesScreenState(db): TropheesScreenState`. Consumed by Task 8 (`page.tsx`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/trophies/loadTropheesScreenState.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSet, completeSeance } from "@/lib/player/db";
import { startDosSeance, logDosSet, completeDosSeance } from "@/lib/dos/db";
import { loadTropheesScreenState } from "./loadTropheesScreenState";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-trophees-screen-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadTropheesScreenState", () => {
  it("returns zeroed state with no cards when nothing has been logged", () => {
    const db = setup();
    const state = loadTropheesScreenState(db);
    expect(state).toEqual({ cards: [], totalReps: 0, seanceCount: 0, joursActivite: 0 });
  });

  it("sums totalReps across cards and counts completed séances and distinct days across both axes", () => {
    const db = setup();
    // beginner[0][0] exerciseOrder 6 = "squats", countsInStats: true
    const seanceA = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seanceA.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 15, restSeconds: 90 });
    completeSeance(db, seanceA.id);

    const dosSeance = startDosSeance(db, "2026-01-05", "lundi", 1);
    logDosSet(db, { seanceId: dosSeance.id, exerciseOrder: 0, exerciseId: "A-1", setNumber: 1, valeurTarget: "8-10", valeurActual: 8, restSeconds: 60 });
    completeDosSeance(db, dosSeance.id, 1);

    const state = loadTropheesScreenState(db);
    expect(state.totalReps).toBe(23);
    expect(state.seanceCount).toBe(2);
    expect(state.joursActivite).toBe(2);
    expect(state.cards).toHaveLength(2);
  });

  it("does not count a started-but-not-completed séance in seanceCount", () => {
    const db = setup();
    startSeance(db, "beginner", 0, 0);
    const state = loadTropheesScreenState(db);
    expect(state.seanceCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/trophies/loadTropheesScreenState.test.ts`
Expected: FAIL — `Cannot find module './loadTropheesScreenState'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/trophies/loadTropheesScreenState.ts
import type Database from "better-sqlite3";
import { computeTrophies, type TrophyCard } from "./computeTrophies";

export type TropheesScreenState = {
  cards: TrophyCard[];
  totalReps: number;
  seanceCount: number;
  joursActivite: number;
};

export function loadTropheesScreenState(db: Database.Database): TropheesScreenState {
  const cards = computeTrophies(db);
  const totalReps = cards.reduce((sum, c) => sum + c.total, 0);

  const seanceRow = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM seances WHERE completed_at IS NOT NULL) +
         (SELECT COUNT(*) FROM dos_seances WHERE completed_at IS NOT NULL) AS seanceCount`,
    )
    .get() as { seanceCount: number };

  const joursRow = db
    .prepare(
      `SELECT COUNT(DISTINCT jour) AS joursActivite FROM (
         SELECT date(completed_at) AS jour FROM seances WHERE completed_at IS NOT NULL
         UNION
         SELECT date(completed_at) AS jour FROM dos_seances WHERE completed_at IS NOT NULL
       )`,
    )
    .get() as { joursActivite: number };

  return {
    cards,
    totalReps,
    seanceCount: seanceRow.seanceCount,
    joursActivite: joursRow.joursActivite,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/trophies/loadTropheesScreenState.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/trophies/loadTropheesScreenState.ts src/lib/trophies/loadTropheesScreenState.test.ts
git commit -m "feat(trophies): add loadTropheesScreenState header aggregation"
```

---

### Task 4: `loadTrophyDetail` — fiche exercice

**Files:**
- Create: `src/lib/trophies/loadTrophyDetail.ts`
- Test: `src/lib/trophies/loadTrophyDetail.test.ts`

**Interfaces:**
- Consumes: `computeTrophies(db)` from Task 2, `prochainPalier` from Task 1.
- Produces: `TrophyDetail` type, `loadTrophyDetail(db, id): TrophyDetail | null`. Consumed by Task 9 (`[exerciseId]/page.tsx`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/trophies/loadTrophyDetail.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSet } from "@/lib/player/db";
import { loadTrophyDetail } from "./loadTrophyDetail";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-trophy-detail-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadTrophyDetail", () => {
  it("returns null for an id with no logged sets", () => {
    const db = setup();
    expect(loadTrophyDetail(db, "squats")).toBeNull();
  });

  it("returns the card plus prochainPalier and resteAParcourir", () => {
    const db = setup();
    // beginner[0][0] exerciseOrder 6 = "squats", countsInStats: true
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 90, restSeconds: 90 });

    const detail = loadTrophyDetail(db, "squats");
    expect(detail).toMatchObject({ id: "squats", total: 90, prochainPalier: 100, resteAParcourir: 10 });
  });

  it("returns null resteAParcourir once every palier is passed", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 30_000, restSeconds: 90 });

    const detail = loadTrophyDetail(db, "squats");
    expect(detail).toMatchObject({ prochainPalier: null, resteAParcourir: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/trophies/loadTrophyDetail.test.ts`
Expected: FAIL — `Cannot find module './loadTrophyDetail'`

- [ ] **Step 3: Write minimal implementation**

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

  const next = prochainPalier(card.total);
  return {
    ...card,
    prochainPalier: next,
    resteAParcourir: next === null ? null : next - card.total,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/trophies/loadTrophyDetail.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/trophies/loadTrophyDetail.ts src/lib/trophies/loadTrophyDetail.test.ts
git commit -m "feat(trophies): add loadTrophyDetail for the per-exercise sheet"
```

---

### Task 5: `useCountUp` — hook d'animation compteur

**Files:**
- Create: `src/components/trophies/useCountUp.ts`
- Test: `src/components/trophies/useCountUp.test.ts`

**Interfaces:**
- Produces: `useCountUp(target: number, delayMs: number): number`. Consumed by Task 6 (`TrophyCard`) and Task 7 (`TropheesScreen` header).

- [ ] **Step 1: Write the failing test**

```ts
// src/components/trophies/useCountUp.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountUp } from "./useCountUp";

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("useCountUp", () => {
  it("starts at 0 and reaches the target after its duration", () => {
    const { result } = renderHook(() => useCountUp(100, 0));
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(100);
  });

  it("stays at 0 until the delay has elapsed", () => {
    const { result } = renderHook(() => useCountUp(100, 200));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(100);
  });

  it("shows the target immediately when prefers-reduced-motion is set", () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useCountUp(100, 0));
    expect(result.current).toBe(100);
  });

  it("shows the target immediately after the first animation in the session", () => {
    sessionStorage.setItem("trophees-counters-animated", "1");
    const { result } = renderHook(() => useCountUp(100, 0));
    expect(result.current).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/trophies/useCountUp.test.ts`
Expected: FAIL — `Cannot find module './useCountUp'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/trophies/useCountUp.ts
"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 600;
const TICK_MS = 20;
const SESSION_KEY = "trophees-counters-animated";

// Seeded at 0 (not the target) so SSR and hydration agree — same pattern
// as PlayerScreen's useElapsedSeconds. The real value lands a tick later,
// client-side only, via the effect below.
export function useCountUp(target: number, delayMs: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      setValue(target);
      return;
    }
    sessionStorage.setItem(SESSION_KEY, "1");

    const startAt = Date.now() + delayMs;
    const endAt = startAt + DURATION_MS;

    const id = setInterval(() => {
      const now = Date.now();
      if (now < startAt) return;
      const progress = Math.min(1, (now - startAt) / DURATION_MS);
      setValue(Math.round(target * progress));
      if (now >= endAt) clearInterval(id);
    }, TICK_MS);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/trophies/useCountUp.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/trophies/useCountUp.ts src/components/trophies/useCountUp.test.ts
git commit -m "feat(trophies): add useCountUp roll-up animation hook"
```

---

### Task 6: `TrophyCard` — carte individuelle

**Files:**
- Create: `src/components/trophies/TrophyCard.tsx`
- Test: `src/components/trophies/TrophyCard.test.tsx`

**Interfaces:**
- Consumes: `TrophyCard` type from `@/lib/trophies/computeTrophies`, `palierAtteint` from `@/lib/trophies/paliers`, `useCountUp` from Task 5, `Card` from `@/components/Card`.
- Produces: `TrophyCard({ card, index }): JSX.Element`, default-exported nowhere (named export), consumed by Task 7 (`TropheesScreen`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/trophies/TrophyCard.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrophyCard } from "./TrophyCard";
import type { TrophyCard as TrophyCardData } from "@/lib/trophies/computeTrophies";

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true, // reduced motion: skip animation timing in these tests
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

const PROGRAMME_CARD: TrophyCardData = {
  id: "squats",
  module: "programme",
  name: "Squats",
  movementFamily: "squat",
  videoId: "404727865",
  total: 340,
  firstAt: "2026-01-01T10:00:00.000Z",
  lastAt: "2026-08-01T10:00:00.000Z",
  seanceCount: 12,
};

const DOS_CARD: TrophyCardData = {
  id: "A",
  module: "dos",
  name: "Charnière & ischios",
  movementFamily: "arbre-A",
  videoId: null,
  total: 80,
  firstAt: "2026-01-01T10:00:00.000Z",
  lastAt: "2026-08-01T10:00:00.000Z",
  seanceCount: 8,
  byCran: [{ cran: 1, nom: "Hip hinge au bâton", total: 80 }],
};

describe("TrophyCard", () => {
  it("shows the name, the all-time total, and links to the detail page", () => {
    render(<TrophyCard card={PROGRAMME_CARD} index={0} />);
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/trophees/squats");
  });

  it("shows a palier mark when a threshold has been reached", () => {
    render(<TrophyCard card={PROGRAMME_CARD} index={0} />);
    expect(screen.getByText(/Palier 100/)).toBeInTheDocument();
  });

  it("shows no palier mark below the first threshold", () => {
    render(<TrophyCard card={{ ...PROGRAMME_CARD, total: 42 }} index={0} />);
    expect(screen.queryByText(/Palier/)).not.toBeInTheDocument();
  });

  it("renders no image for a Dos card", () => {
    render(<TrophyCard card={DOS_CARD} index={0} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/trophies/TrophyCard.test.tsx`
Expected: FAIL — `Cannot find module './TrophyCard'`

- [ ] **Step 3: Write minimal implementation**

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
  const palier = palierAtteint(card.total);
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
          <div className="font-archivo text-24 font-semibold tabular-nums mt-2">{total}</div>
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/trophies/TrophyCard.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/trophies/TrophyCard.tsx src/components/trophies/TrophyCard.test.tsx
git commit -m "feat(trophies): add TrophyCard"
```

---

### Task 7: `TropheesScreen` — en-tête, toolbar, grille, état vide

**Files:**
- Create: `src/components/trophies/TropheesScreen.tsx`
- Test: `src/components/trophies/TropheesScreen.test.tsx`

**Interfaces:**
- Consumes: `TropheesScreenState` from `@/lib/trophies/loadTropheesScreenState`, `TrophyCard` component from Task 6, `useCountUp` from Task 5, `Card` from `@/components/Card`.
- Produces: `TropheesScreen({ state }): JSX.Element`. Consumed by Task 8 (`page.tsx`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/trophies/TropheesScreen.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TropheesScreen } from "./TropheesScreen";
import type { TropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

const STATE: TropheesScreenState = {
  totalReps: 420,
  seanceCount: 10,
  joursActivite: 9,
  cards: [
    { id: "squats", module: "programme", name: "Squats", movementFamily: "squat", videoId: null, total: 300, firstAt: "2026-01-01T10:00:00.000Z", lastAt: "2026-08-01T10:00:00.000Z", seanceCount: 8 },
    { id: "A", module: "dos", name: "Charnière & ischios", movementFamily: "arbre-A", videoId: null, total: 120, firstAt: "2026-02-01T10:00:00.000Z", lastAt: "2026-08-05T10:00:00.000Z", seanceCount: 2, byCran: [{ cran: 1, nom: "Hip hinge au bâton", total: 120 }] },
  ],
};

describe("TropheesScreen", () => {
  it("shows the header total and activity summary", async () => {
    render(<TropheesScreen state={STATE} />);
    expect(await screen.findByText("420")).toBeInTheDocument();
    expect(screen.getByText(/10 séances/)).toBeInTheDocument();
    expect(screen.getByText(/9 jours/)).toBeInTheDocument();
  });

  it("shows every card by default", () => {
    render(<TropheesScreen state={STATE} />);
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("Charnière & ischios")).toBeInTheDocument();
  });

  it("filters to the Dos module only", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TropheesScreen state={STATE} />);
    await user.click(screen.getByRole("button", { name: "Dos" }));
    expect(screen.queryByText("Squats")).not.toBeInTheDocument();
    expect(screen.getByText("Charnière & ischios")).toBeInTheDocument();
  });

  it("shows the empty state when there are no cards", () => {
    render(<TropheesScreen state={{ totalReps: 0, seanceCount: 0, joursActivite: 0, cards: [] }} />);
    expect(screen.getByText(/première séance/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/trophies/TropheesScreen.test.tsx`
Expected: FAIL — `Cannot find module './TropheesScreen'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/trophies/TropheesScreen.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { TrophyCard } from "./TrophyCard";
import { useCountUp } from "./useCountUp";
import type { TropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";

type Tri = "reps" | "recent" | "alpha";
type Filtre = "tous" | "programme" | "dos";

const TRI_OPTIONS: { value: Tri; label: string }[] = [
  { value: "reps", label: "Plus de reps" },
  { value: "recent", label: "Récent" },
  { value: "alpha", label: "Alphabétique" },
];

const FILTRE_OPTIONS: { value: Filtre; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "programme", label: "Programme" },
  { value: "dos", label: "Dos" },
];

function toggleButtonClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium whitespace-nowrap ${
    active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"
  }`;
}

export function TropheesScreen({ state }: { state: TropheesScreenState }) {
  const [tri, setTri] = useState<Tri>("reps");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const total = useCountUp(state.totalReps, 0);

  const cards = state.cards
    .filter((c) => filtre === "tous" || c.module === filtre)
    .sort((a, b) => {
      if (tri === "reps") return b.total - a.total;
      if (tri === "recent") return b.lastAt.localeCompare(a.lastAt);
      return a.name.localeCompare(b.name, "fr");
    });

  return (
    <div className="pb-10">
      <div className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-brass">
          Trophées
        </span>
        <div className="font-archivo text-44 font-semibold tabular-nums mt-3">{total}</div>
        <p className="text-15 text-graphite mt-1.5">
          {state.seanceCount} séance{state.seanceCount > 1 ? "s" : ""} · {state.joursActivite} jour
          {state.joursActivite > 1 ? "s" : ""} d&apos;activité
        </p>
      </div>

      <div className="sticky top-0 bg-canvas z-10 px-5 py-3 flex gap-2 overflow-x-auto border-b border-hairline">
        {TRI_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTri(opt.value)}
            className={toggleButtonClass(tri === opt.value)}
          >
            {opt.label}
          </button>
        ))}
        <span className="w-px bg-hairline mx-1" />
        {FILTRE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFiltre(opt.value)}
            className={toggleButtonClass(filtre === opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {cards.length === 0 ? (
        <div className="px-5 pt-6">
          <Card className="p-6 text-center">
            <p className="text-15 text-graphite">Fais ta première séance pour commencer à cumuler.</p>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 min-[720px]:grid-cols-3 gap-3 px-5 pt-5">
          {cards.map((card, index) => (
            <TrophyCard key={card.id} card={card} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/trophies/TropheesScreen.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/trophies/TropheesScreen.tsx src/components/trophies/TropheesScreen.test.tsx
git commit -m "feat(trophies): add TropheesScreen with tri/filtre and empty state"
```

---

### Task 8: Route `/trophees` — page, chargement, erreur

**Files:**
- Modify: `src/app/(shell)/trophees/page.tsx` (replace the "Arrive en phase 5" stub)
- Create: `src/app/(shell)/trophees/loading.tsx`
- Create: `src/app/(shell)/trophees/error.tsx`

**Interfaces:**
- Consumes: `getDb` from `@/lib/db/client`, `loadTropheesScreenState` from Task 3, `TropheesScreen` from Task 7.

No unit test for this task — matches the existing convention for other route `page.tsx` files in this codebase (`src/app/(shell)/dos/page.tsx`, `src/app/(shell)/programme/page.tsx`): thin composition, all real logic already tested in the `lib/` layer.

- [ ] **Step 1: Replace the page stub**

```tsx
// src/app/(shell)/trophees/page.tsx
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { loadTropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";
import { TropheesScreen } from "@/components/trophies/TropheesScreen";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default function TropheesPage() {
  const db = getDb(dbPath());
  const state = loadTropheesScreenState(db);
  return <TropheesScreen state={state} />;
}
```

- [ ] **Step 2: Add the loading skeleton**

```tsx
// src/app/(shell)/trophees/loading.tsx
export default function TropheesLoading() {
  return (
    <div className="pb-10 animate-pulse">
      <div className="p-5">
        <div className="h-[11px] w-20 bg-hairline rounded" />
        <div className="h-11 w-40 bg-hairline rounded mt-3" />
        <div className="h-[15px] w-48 bg-hairline rounded mt-3" />
      </div>
      <div className="px-5 py-3 flex gap-2 border-b border-hairline">
        <div className="h-9 w-24 bg-hairline rounded-pill" />
        <div className="h-9 w-20 bg-hairline rounded-pill" />
        <div className="h-9 w-16 bg-hairline rounded-pill" />
      </div>
      <div className="grid grid-cols-2 min-[720px]:grid-cols-3 gap-3 px-5 pt-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-square rounded-card bg-hairline" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the error screen**

```tsx
// src/app/(shell)/trophees/error.tsx
"use client";

export default function TropheesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-5">
      <p className="text-15 text-graphite">Impossible de charger les trophées.</p>
      <button
        type="button"
        onClick={reset}
        className="h-11 px-4 rounded-pill bg-ink text-paper font-archivo text-15 font-semibold mt-4"
      >
        Réessayer
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the full suite to confirm nothing broke**

Run: `npx vitest run`
Expected: PASS (same count as before this task, plus 21 new tests from Tasks 1-7)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(shell)/trophees/page.tsx" "src/app/(shell)/trophees/loading.tsx" "src/app/(shell)/trophees/error.tsx"
git commit -m "feat(trophees): wire the real /trophees screen, replacing the phase 5 stub"
```

---

### Task 9: Route `/trophees/[exerciseId]` — fiche exercice

**Files:**
- Create: `src/app/(shell)/trophees/[exerciseId]/page.tsx`

**Interfaces:**
- Consumes: `getDb` from `@/lib/db/client`, `loadTrophyDetail` from Task 4, `Card` from `@/components/Card`, `IconClose` from `@/components/icons/IconClose`, `notFound` from `next/navigation`.

No unit test for this task, same rationale as Task 8 — `loadTrophyDetail` already covers every branch.

- [ ] **Step 1: Write the detail page**

```tsx
// src/app/(shell)/trophees/[exerciseId]/page.tsx
import Link from "next/link";
import path from "node:path";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { loadTrophyDetail } from "@/lib/trophies/loadTrophyDetail";
import { Card } from "@/components/Card";
import { IconClose } from "@/components/icons/IconClose";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso),
  );
}

export default async function TrophyDetailPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  const db = getDb(dbPath());
  const detail = loadTrophyDetail(db, exerciseId);

  if (!detail) notFound();

  return (
    <div className="pb-10">
      <div className="p-5">
        <Link
          href="/trophees"
          aria-label="Retour aux trophées"
          className="w-11 h-11 rounded-pill border border-hairline bg-paper flex items-center justify-center text-ink"
        >
          <IconClose size={18} />
        </Link>
      </div>

      <div className="px-5">
        {detail.module === "programme" && (
          <div className="aspect-[4/3] rounded-card border border-hairline bg-paper overflow-hidden mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/exercises/${detail.id}.jpg`}
              alt={detail.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <h1 className="font-archivo text-32 font-semibold">{detail.name}</h1>
        <div className="font-archivo text-44 font-semibold tabular-nums mt-3">{detail.total}</div>

        <Card className="mt-6 p-4">
          <div className="flex justify-between py-2">
            <span className="text-15 text-graphite">Premier passage</span>
            <span className="text-15 tabular-nums">{formatDateFr(detail.firstAt)}</span>
          </div>
          <div className="flex justify-between py-2 border-t border-hairline">
            <span className="text-15 text-graphite">Dernier passage</span>
            <span className="text-15 tabular-nums">{formatDateFr(detail.lastAt)}</span>
          </div>
          <div className="flex justify-between py-2 border-t border-hairline">
            <span className="text-15 text-graphite">Prochain palier</span>
            <span className="text-15 tabular-nums">
              {detail.prochainPalier === null
                ? "Tous les paliers atteints"
                : `${detail.resteAParcourir} restants`}
            </span>
          </div>
        </Card>

        {detail.byCran && detail.byCran.length > 0 && (
          <Card className="mt-4 overflow-hidden">
            {detail.byCran.map((row, i) => (
              <div
                key={row.cran}
                className={`flex justify-between items-center gap-4 px-4 py-3 ${
                  i > 0 ? "border-t border-hairline" : ""
                }`}
              >
                <span className="text-15">{row.nom}</span>
                <span className="font-archivo text-15 font-semibold tabular-nums flex-none">{row.total}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full suite to confirm nothing broke**

Run: `npx vitest run`
Expected: PASS (unchanged from Task 8 — no test files touched)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shell)/trophees/[exerciseId]/page.tsx"
git commit -m "feat(trophies): add the per-exercise fiche exercice detail page"
```

---

### Task 10: Retrofit SummaryView — total all-time et franchissement de palier

**Files:**
- Modify: `src/components/player/SummaryView.tsx`
- Modify: `src/components/player/SummaryView.test.tsx`
- Modify: `src/components/player/PlayerScreen.tsx`
- Modify: `src/app/player/page.tsx`
- Modify: `src/app/player/dos/page.tsx`

**Interfaces:**
- Consumes: `computeTrophies`, `resolveTrophyCardId`, `isReplogEligible` from Task 2, `palierAtteint` from Task 1.

- [ ] **Step 1: Write the failing tests (extend the existing SummaryView test file)**

Replace the full contents of `src/components/player/SummaryView.test.tsx`:

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
  it("shows duration as m:ss, exercise count, and total reps", () => {
    const setsLogged = [
      set({ exerciseOrder: 0, setNumber: 1, repsActual: 10 }),
      set({ exerciseOrder: 0, setNumber: 2, repsActual: 10 }),
      set({ exerciseOrder: 1, setNumber: 1, repsActual: 15 }),
    ];
    render(
      <SummaryView exercises={EXERCISES} setsLogged={setsLogged} durationSeconds={630} allTimeTotals={[]} onFinish={() => {}} />,
    );
    expect(screen.getByText("10:30")).toBeInTheDocument(); // durée
    expect(screen.getByText("2")).toBeInTheDocument(); // exercices
    expect(screen.getByText("35")).toBeInTheDocument(); // reps
    expect(screen.getByText("Durée")).toBeInTheDocument();
    expect(screen.getByText("Exercices")).toBeInTheDocument();
    expect(screen.getByText("Répétitions")).toBeInTheDocument();
  });

  it("lists only exercises with at least one logged set, each with its summed reps", () => {
    const setsLogged = [set({ exerciseOrder: 1, setNumber: 1, repsActual: 15 })];
    render(
      <SummaryView exercises={EXERCISES} setsLogged={setsLogged} durationSeconds={300} allTimeTotals={[]} onFinish={() => {}} />,
    );
    expect(screen.queryByText("Push ups")).not.toBeInTheDocument();
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("+15 reps")).toBeInTheDocument();
  });

  it("calls onFinish when Terminer is clicked", async () => {
    const onFinish = vi.fn();
    render(
      <SummaryView exercises={EXERCISES} setsLogged={[]} durationSeconds={0} allTimeTotals={[]} onFinish={onFinish} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("uses the sage accent on the Terminer button when accent='sage'", () => {
    render(
      <SummaryView exercises={EXERCISES} setsLogged={[]} durationSeconds={0} allTimeTotals={[]} accent="sage" onFinish={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Terminer" })).toHaveClass("bg-sage");
  });

  it("shows the new all-time total next to the reps done this séance", () => {
    const setsLogged = [set({ exerciseOrder: 1, setNumber: 1, repsActual: 15 })];
    render(
      <SummaryView exercises={EXERCISES} setsLogged={setsLogged} durationSeconds={300} allTimeTotals={[undefined, 40]} onFinish={() => {}} />,
    );
    expect(screen.getByText("+15 reps · 40 au total")).toBeInTheDocument();
  });

  it("shows a palier franchi banner when a threshold is crossed this séance", () => {
    const setsLogged = [set({ exerciseOrder: 1, setNumber: 1, repsActual: 15 })];
    render(
      <SummaryView exercises={EXERCISES} setsLogged={setsLogged} durationSeconds={300} allTimeTotals={[undefined, 100]} onFinish={() => {}} />,
    );
    expect(screen.getByText("Palier franchi · 100 répétitions · Squats")).toBeInTheDocument();
  });

  it("shows no banner when the séance stays within the same palier", () => {
    const setsLogged = [set({ exerciseOrder: 1, setNumber: 1, repsActual: 15 })];
    render(
      <SummaryView exercises={EXERCISES} setsLogged={setsLogged} durationSeconds={300} allTimeTotals={[undefined, 60]} onFinish={() => {}} />,
    );
    expect(screen.queryByText(/Palier franchi/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify the new assertions fail**

Run: `npx vitest run src/components/player/SummaryView.test.tsx`
Expected: FAIL — `allTimeTotals` is missing from the props type; the 3 new tests fail on missing text.

- [ ] **Step 3: Update SummaryView.tsx**

Replace the full contents of `src/components/player/SummaryView.tsx`:

```tsx
// src/components/player/SummaryView.tsx
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { formatClock } from "@/lib/player/formatClock";
import { palierAtteint } from "@/lib/trophies/paliers";
import type { Accent } from "@/components/Pastille";
import type { Exercise } from "@/lib/workout/types";
import type { SetLoggedRecord } from "@/lib/player/db";

export function SummaryView({
  exercises,
  setsLogged,
  durationSeconds,
  allTimeTotals,
  accent = "cobalt",
  onFinish,
}: {
  exercises: Exercise[];
  setsLogged: SetLoggedRecord[];
  durationSeconds: number;
  allTimeTotals: (number | undefined)[];
  accent?: Accent;
  onFinish: () => void;
}) {
  const repsByExercise = new Map<number, number>();
  for (const set of setsLogged) {
    repsByExercise.set(set.exerciseOrder, (repsByExercise.get(set.exerciseOrder) ?? 0) + set.repsActual);
  }
  const exercisesWorked = repsByExercise.size;
  const totalReps = [...repsByExercise.values()].reduce((sum, reps) => sum + reps, 0);

  const stats = [
    { key: "Durée", value: formatClock(durationSeconds) },
    { key: "Exercices", value: String(exercisesWorked) },
    { key: "Répétitions", value: String(totalReps) },
  ];

  const palierFranchi = exercises
    .map((exercise, exerciseOrder) => {
      const reps = repsByExercise.get(exerciseOrder);
      const totalApres = allTimeTotals[exerciseOrder];
      if (reps === undefined || totalApres === undefined) return null;
      const totalAvant = totalApres - reps;
      const palierApres = palierAtteint(totalApres);
      if (palierApres === null || palierAtteint(totalAvant) === palierApres) return null;
      return { exercise, palier: palierApres };
    })
    .filter((row): row is { exercise: Exercise; palier: number } => row !== null);

  return (
    <div className="min-h-dvh flex flex-col bg-canvas">
      <div className="flex-1 overflow-y-auto px-5 pt-10 pb-6">
        <h1 className="font-archivo text-44 font-semibold">Séance terminée</h1>

        {palierFranchi.map(({ exercise, palier }) => (
          <p key={exercise.id} className="text-13 text-brass mt-3">
            Palier franchi · {palier.toLocaleString("fr-FR")} répétitions · {exercise.name}
          </p>
        ))}

        <div className="flex gap-3 mt-8">
          {stats.map((stat) => (
            <Card key={stat.key} className="flex-1 p-4">
              <div className="font-archivo text-32 font-semibold tabular-nums">{stat.value}</div>
              <div className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mt-2.5">
                {stat.key}
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-8 overflow-hidden">
          {exercises
            .map((exercise, exerciseOrder) => ({
              exercise,
              reps: repsByExercise.get(exerciseOrder),
              allTime: allTimeTotals[exerciseOrder],
            }))
            .filter(
              (row): row is { exercise: Exercise; reps: number; allTime: number | undefined } =>
                row.reps !== undefined,
            )
            .map((row, i) => (
              <div
                key={row.exercise.id}
                className={`flex justify-between items-center gap-4 px-5 py-3.5 border-hairline ${i > 0 ? "border-t" : ""}`}
              >
                <span className="text-15">{row.exercise.name}</span>
                <span className="font-archivo text-18 font-semibold tabular-nums flex-none">
                  +{row.reps} reps{row.allTime !== undefined ? ` · ${row.allTime} au total` : ""}
                </span>
              </div>
            ))}
        </Card>
      </div>

      <div className="flex-none px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-paper border-t border-hairline shadow-[0_-12px_24px_rgba(17,19,16,0.04)]">
        <Button variant="primary" accent={accent} onClick={onFinish}>
          Terminer
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify SummaryView tests pass**

Run: `npx vitest run src/components/player/SummaryView.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Add the optional `allTimeTotals` prop to PlayerScreen and forward it**

In `src/components/player/PlayerScreen.tsx`, update the props destructuring and type (around lines 63-83):

```tsx
export function PlayerScreen({
  day,
  state,
  setsLogged,
  allTimeTotals = [],
  accent = "cobalt",
  restBetweenSetsSeconds = REST_BETWEEN_SETS_SECONDS,
  restBetweenExercisesSeconds = REST_BETWEEN_EXERCISES_SECONDS,
  onLogSet,
  onSkipExercise,
  onSeanceFinish,
}: {
  day: TrainDay;
  state: PlayerState;
  setsLogged: SetLoggedRecord[];
  allTimeTotals?: (number | undefined)[];
  accent?: Accent;
  restBetweenSetsSeconds?: number;
  restBetweenExercisesSeconds?: number;
  onLogSet: (params: LogSetParams) => Promise<void>;
  onSkipExercise: (seanceId: number, exerciseOrder: number) => Promise<void>;
  onSeanceFinish: (seanceId: number) => Promise<void>;
}) {
```

And update the `SummaryView` call in the `pending-validation` branch:

```tsx
  if (state.phase === "pending-validation") {
    return (
      <SummaryView
        exercises={day.exercises}
        setsLogged={setsLogged}
        durationSeconds={elapsedSeconds}
        allTimeTotals={allTimeTotals}
        accent={accent}
        onFinish={async () => {
          await onSeanceFinish(state.seanceId);
          router.refresh();
        }}
      />
    );
  }
```

- [ ] **Step 6: Run the PlayerScreen suite to confirm the optional prop breaks nothing**

Run: `npx vitest run src/components/player/PlayerScreen.test.tsx`
Expected: PASS (unchanged — every existing render call omits `allTimeTotals` and gets the `[]` default)

- [ ] **Step 7: Wire `allTimeTotals` into the Programme player page**

In `src/app/player/page.tsx`, add the import and computation, then pass the prop:

```tsx
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { loadPlayerState } from "@/lib/player/loadPlayerState";
import { getSetsForSeance } from "@/lib/player/db";
import { logSetAction, skipExerciseAction, completeSeanceAction } from "@/lib/player/actions";
import { beginner, intermediate, advanced } from "@/lib/workout/data";
import type { Program } from "@/lib/workout/types";
import { PlayerScreen } from "@/components/player/PlayerScreen";
import { computeTrophies, resolveTrophyCardId, isReplogEligible } from "@/lib/trophies/computeTrophies";

const PROGRAMS: Record<string, Program> = { beginner, intermediate, advanced };

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default async function PlayerPage({
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
          /player?parcours=beginner&level=0&day=0
        </p>
      </main>
    );
  }

  const db = getDb(dbPath());
  const state = loadPlayerState(db, parcours, level, dayIndex, day);
  const setsLogged = getSetsForSeance(db, state.seanceId);

  const cardTotals = new Map(computeTrophies(db).map((c) => [c.id, c.total]));
  const allTimeTotals = day.exercises.map((exercise) =>
    isReplogEligible(exercise.id, exercise.countsInStats) ? cardTotals.get(resolveTrophyCardId(exercise.id)) : undefined,
  );

  return (
    <PlayerScreen
      day={day}
      state={state}
      setsLogged={setsLogged}
      allTimeTotals={allTimeTotals}
      onLogSet={logSetAction}
      onSkipExercise={skipExerciseAction}
      onSeanceFinish={completeSeanceAction}
    />
  );
}
```

- [ ] **Step 8: Wire `allTimeTotals` into the Dos player page**

In `src/app/player/dos/page.tsx`, add the import and computation (the `semaine` value is already computed on the existing line `const semaine = computeWeek(startDate, today);` — reuse it), then pass the prop:

```tsx
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { getStartDate, getEvaluations } from "@/lib/backpain/db";
import { computeWeek, computeBlock } from "@/lib/backpain/periode";
import { getCurrentCran } from "@/lib/backpain/progression";
import type { ArbreId } from "@/lib/backpain/arbres";
import { getJourSemaine, getDosRestSeconds } from "@/lib/dos/schedule";
import { buildDosDay, ARBRES_DU_JOUR } from "@/lib/dos/buildDosDay";
import { loadDosPlayerState } from "@/lib/dos/loadDosPlayerState";
import { getSetsForDosSeance, toPlayerSetsLogged } from "@/lib/dos/db";
import { logDosSetAction, skipDosExerciseAction, startDosBilanAction } from "@/lib/dos/actions";
import { PlayerScreen } from "@/components/player/PlayerScreen";
import { computeTrophies, resolveTrophyCardId, isReplogEligible } from "@/lib/trophies/computeTrophies";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default async function DosPlayerPage() {
  const db = getDb(dbPath());
  const startDate = getStartDate(db);

  if (!startDate) {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Définis d&apos;abord ta date de départ depuis l&apos;écran Dos.</p>
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const jourSemaine = getJourSemaine(today);

  if (jourSemaine === "dimanche") {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Repos aujourd&apos;hui — pas de séance Dos le dimanche.</p>
      </main>
    );
  }

  const semaine = computeWeek(startDate, today);
  const bloc = computeBlock(semaine);
  const evaluations = getEvaluations(db);
  const cranCourant = {} as Record<ArbreId, number>;
  for (const arbre of ARBRES_DU_JOUR[jourSemaine]) {
    cranCourant[arbre] = getCurrentCran(evaluations, arbre);
  }

  const day = buildDosDay(jourSemaine, bloc, cranCourant);
  const state = loadDosPlayerState(db, today, jourSemaine, semaine, day);
  const setsLogged = toPlayerSetsLogged(getSetsForDosSeance(db, state.seanceId));
  const restSeconds = getDosRestSeconds(jourSemaine);

  const cardTotals = new Map(computeTrophies(db).map((c) => [c.id, c.total]));
  const allTimeTotals = day.exercises.map((exercise) =>
    isReplogEligible(exercise.id, exercise.countsInStats, semaine)
      ? cardTotals.get(resolveTrophyCardId(exercise.id))
      : undefined,
  );

  return (
    <PlayerScreen
      day={day}
      state={state}
      setsLogged={setsLogged}
      allTimeTotals={allTimeTotals}
      accent="sage"
      restBetweenSetsSeconds={restSeconds}
      restBetweenExercisesSeconds={restSeconds}
      onLogSet={logDosSetAction}
      onSkipExercise={skipDosExerciseAction}
      onSeanceFinish={startDosBilanAction}
    />
  );
}
```

- [ ] **Step 9: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, 0 type errors

- [ ] **Step 10: Commit**

```bash
git add src/components/player/SummaryView.tsx src/components/player/SummaryView.test.tsx \
        src/components/player/PlayerScreen.tsx src/app/player/page.tsx src/app/player/dos/page.tsx
git commit -m "feat(trophies): retrofit SummaryView with all-time totals and palier franchi"
```

---

## Self-Review

**Spec coverage:**
- Écarts assumés (carte par arbre, reps-only, byCran au lieu de "par module") → Task 2 (`computeTrophies`), tests dédiés.
- Architecture calcul-à-la-lecture, pas de table → Task 2, aucune migration ajoutée.
- Modèle `TrophyCard`/`TropheesScreenState`/`TrophyDetail` → Tasks 2-4.
- Composants (en-tête, toolbar, grille, carte, fiche détail) → Tasks 6-9.
- `useCountUp` avec délai, `prefers-reduced-motion`, une seule animation par session → Task 5.
- Retrofit SummaryView (total all-time + bandeau palier) → Task 10.
- États obligatoires (vide, chargement, erreur) → Task 7 (vide), Task 8 (chargement, erreur).
- Tests unitaires listés dans la spec → couverts un à un dans Tasks 1-2 et Task 10.

**Placeholder scan:** aucun "TBD"/"TODO" — chaque step contient du code exécutable réel, chaque test contient de vraies assertions sur des fixtures réelles.

**Type consistency:** `TrophyCard` (Task 2) est réutilisé identique dans `TropheesScreenState.cards` (Task 3), `TrophyDetail extends TrophyCard` (Task 4), et les props de `TrophyCard` composant (Task 6) et `TropheesScreen` (Task 7) — un seul type source, jamais redéfini. `isReplogEligible`/`resolveTrophyCardId` ont la même signature partout où ils sont appelés (Task 2's tests, Task 10's page wiring). `allTimeTotals: (number | undefined)[]` a le même type dans `SummaryView`, `PlayerScreen`, et les deux `page.tsx`.

Plan complete and saved to `docs/superpowers/plans/2026-08-13-trophees-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
