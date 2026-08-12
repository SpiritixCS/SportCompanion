# Dos — moteur de progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure progression engine for the Dos (BackPain) axis — week/block calculation, the cran-advancement gate (`BackPainProgram.md` §6), and the pain-escalation check (§7) — plus the minimal persistence it needs. No UI, no routes, no session schema.

**Architecture:** A single append-only event log (`dos_evaluations`) is the only mutable state besides a singleton start date. Current cran, "already risen this week", and stagnation are all derived from that log at read time — no duplicated mutable counters, same principle as `current_position`/`seances` in the Programme phase. Pain (`gene`) is never stored by this module — it's a parameter the caller (a future phase) supplies, already logged in a session schema that doesn't exist yet. Tree data (crans, prescriptions) is a hand-transcribed constant module, not a generated pipeline output (unlike Caliathletics — `BackPainProgram.md` is already structured prose, not HTML to parse).

**Tech Stack:** TypeScript, better-sqlite3, Vitest. No Next.js routes or React components this phase.

## Global Constraints

- **No UI, no routes, no session/sets schema.** This phase is `src/lib/backpain/` only. The real `/dos` screen, dynamic session composition, and set logging arrive in a later phase (4b) and are out of scope here.
- **`dos_evaluations` is append-only.** No `UPDATE`/`DELETE` is exposed by `db.ts` — every write is an `INSERT`. Current cran, weekly-rise state, and stagnation are computed by scanning this table, never stored as separate mutable fields.
- **`checkPainEscalation` returns only 3 states: `"normal" | "repeter_cran" | "redescendre_cran"`.** The 4th tier of `BackPainProgram.md` §7 ("aggravation progressive sur 2 semaines → arrêt du bloc, consultation") is a trend judgment, not a deterministic rule — CLAUDE.md §5 excludes it from automatic evaluation ("les critères d'alerte peuvent être affichés comme rappels, jamais évalués automatiquement"). Do not add a 4th return value or any logic that infers it.
- **Tree data (`ARBRES`) is transcribed verbatim from `BackPainProgram.md` §3-§4** — exact cran counts, exact cran names, exact prescriptions per block, exact units (note: tree I switches unit from `"s"` in block 1 to `"m"` in blocks 2-4 — this is correct, not a typo, see §4's table).
- **`evaluateProgression`'s evaluation order is fixed and exact:** décharge → douleur → plafond → sommet → maintien/montée (§6). The first failing condition determines the result — never reorder or short-circuit differently.
- **Stagnation is a signal only, never auto-applied** (§6: "Signalé à l'utilisateur, jamais appliqué automatiquement") — `checkStagnation` returns a boolean, nothing calls it to mutate state.
- Package manager npm. Tests: Vitest, in-memory SQLite fixtures via `mkdtempSync`, same convention as `src/lib/programme/*.test.ts`.

---

## File Structure

```
migrations/
  0003_backpain.sql               NOUVEAU — dos_start_date, dos_evaluations

src/lib/backpain/
  arbres.ts / .test.ts            données des 10 arbres (crans, prescriptions)
  periode.ts / .test.ts           computeWeek, computeBlock, isDechargeWeek, isCalibrageWeek
  progression.ts / .test.ts       getCurrentCran, hasAlreadyRisenThisWeek, checkStagnation, evaluateProgression
  douleur.ts / .test.ts           checkPainEscalation
  db.ts / .test.ts                dos_start_date + dos_evaluations persistence
```

---

### Task 1: Migration `0003_backpain.sql`

**Files:**
- Create: `migrations/0003_backpain.sql`
- Test: `migrations/0003_backpain.test.ts`

**Interfaces:**
- Produces: tables `dos_start_date`, `dos_evaluations` — exact columns consumed by `src/lib/backpain/db.ts` (Task 6).

- [ ] **Step 1: Write the failing test**

```typescript
// migrations/0003_backpain.test.ts
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

describe("0003_backpain migration", () => {
  it("creates dos_start_date and dos_evaluations with the expected columns", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0003_backpain.sql");

    const startDateCols = (db.prepare("PRAGMA table_info(dos_start_date)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(startDateCols).toEqual(["id", "start_date", "set_at"]);

    const evalCols = (db.prepare("PRAGMA table_info(dos_evaluations)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(evalCols).toEqual(["id", "arbre", "semaine", "cran_apres", "resultat", "horodatage"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run migrations/0003_backpain.test.ts`
Expected: FAIL — `0003_backpain.sql` does not exist.

- [ ] **Step 3: Create `migrations/0003_backpain.sql`**

```sql
CREATE TABLE dos_start_date (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  start_date TEXT NOT NULL,
  set_at TEXT NOT NULL
);

CREATE TABLE dos_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arbre TEXT NOT NULL,
  semaine INTEGER NOT NULL,
  cran_apres INTEGER NOT NULL,
  resultat TEXT NOT NULL,
  horodatage TEXT NOT NULL
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run migrations/0003_backpain.test.ts`
Expected: PASS.

- [ ] **Step 5: Apply the migration to the dev DB**

Run: `npm run db:migrate`
Expected: `Applied 1 migration(s): 0003_backpain.sql`.

- [ ] **Step 6: Commit**

```bash
git add migrations/0003_backpain.sql migrations/0003_backpain.test.ts
git commit -m "feat(db): add dos_start_date and dos_evaluations migration"
```

---

### Task 2: `arbres.ts` — tree data

**Files:**
- Create: `src/lib/backpain/arbres.ts`
- Test: `src/lib/backpain/arbres.test.ts`

**Interfaces:**
- Produces: `type ArbreId`, `type Prescription`, `type Arbre`, `ARBRES: Record<ArbreId, Arbre>`. Consumed by `progression.ts` (Task 4, to read `crans.length` as the top of each tree's ladder).

This is a transcription task — every value below is copied verbatim from `BackPainProgram.md` §3 (crans) and §4 (prescriptions table). No value is invented, rounded, or interpreted.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/backpain/arbres.test.ts
import { describe, it, expect } from "vitest";
import { ARBRES } from "./arbres";

describe("ARBRES", () => {
  it("has exactly 10 trees, A through J", () => {
    expect(Object.keys(ARBRES).sort()).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
  });

  it("has the exact cran count per tree from §3", () => {
    expect(ARBRES.A.crans).toHaveLength(8);
    expect(ARBRES.B.crans).toHaveLength(7);
    expect(ARBRES.C.crans).toHaveLength(6);
    expect(ARBRES.D.crans).toHaveLength(6);
    expect(ARBRES.E.crans).toHaveLength(5);
    expect(ARBRES.F.crans).toHaveLength(5);
    expect(ARBRES.G.crans).toHaveLength(6);
    expect(ARBRES.H.crans).toHaveLength(7);
    expect(ARBRES.I.crans).toHaveLength(4);
    expect(ARBRES.J.crans).toHaveLength(6);
  });

  it("names the first and last cran of tree A correctly", () => {
    expect(ARBRES.A.crans[0]).toEqual({ numero: 1, nom: "Hip hinge au bâton" });
    expect(ARBRES.A.crans[7]).toEqual({ numero: 8, nom: "Nordic curl + gilet lesté" });
  });

  it("has 4 prescriptions per tree, one per block", () => {
    for (const arbre of Object.values(ARBRES)) {
      expect(arbre.prescriptions).toHaveLength(4);
    }
  });

  it("matches tree A's exact prescriptions from §4", () => {
    expect(ARBRES.A.prescriptions).toEqual([
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
      { series: 4, min: 5, max: 6, unite: "reps" },
    ]);
  });

  it("switches tree I's unit from seconds (block 1) to meters (blocks 2-4)", () => {
    expect(ARBRES.I.prescriptions).toEqual([
      { series: 3, min: 15, max: 20, unite: "s" },
      { series: 3, min: 20, max: 25, unite: "m" },
      { series: 4, min: 25, max: 30, unite: "m" },
      { series: 4, min: 30, max: 40, unite: "m" },
    ]);
  });

  it("matches tree H's tenue-based prescriptions (unite s across all 4 blocks)", () => {
    expect(ARBRES.H.prescriptions).toEqual([
      { series: 3, min: 20, max: 25, unite: "s" },
      { series: 3, min: 30, max: 35, unite: "s" },
      { series: 3, min: 30, max: 40, unite: "s" },
      { series: 3, min: 45, max: 50, unite: "s" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/backpain/arbres.test.ts`
Expected: FAIL — `arbres.ts` does not exist.

- [ ] **Step 3: Create `src/lib/backpain/arbres.ts`**

```typescript
export type ArbreId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";

export type Prescription = { series: number; min: number; max: number; unite: "reps" | "s" | "m" };

export type Arbre = {
  id: ArbreId;
  nom: string;
  crans: { numero: number; nom: string }[];
  prescriptions: [Prescription, Prescription, Prescription, Prescription];
};

export const ARBRES: Record<ArbreId, Arbre> = {
  A: {
    id: "A",
    nom: "Charnière & ischios",
    crans: [
      { numero: 1, nom: "Hip hinge au bâton" },
      { numero: 2, nom: "Good morning élastique" },
      { numero: 3, nom: "Leg curl serviette bilatéral" },
      { numero: 4, nom: "Leg curl serviette unilatéral" },
      { numero: 5, nom: "Nordic curl excentrique assisté" },
      { numero: 6, nom: "Nordic curl excentrique complet (5 s)" },
      { numero: 7, nom: "Nordic curl remontée partielle" },
      { numero: 8, nom: "Nordic curl + gilet lesté" },
    ],
    prescriptions: [
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
      { series: 4, min: 5, max: 6, unite: "reps" },
    ],
  },
  B: {
    id: "B",
    nom: "Extension de hanche",
    crans: [
      { numero: 1, nom: "Pont fessier bilatéral" },
      { numero: 2, nom: "Pont fessier pieds surélevés" },
      { numero: 3, nom: "Pont fessier unilatéral" },
      { numero: 4, nom: "Hip thrust unilatéral, épaules surélevées" },
      { numero: 5, nom: "Hip thrust unilatéral, épaules + pied surélevés" },
      { numero: 6, nom: "Hip thrust unilatéral + charge sur le bassin" },
      { numero: 7, nom: "Hip thrust unilatéral chargé, tenue 3 s" },
    ],
    prescriptions: [
      { series: 3, min: 12, max: 15, unite: "reps" },
      { series: 4, min: 10, max: 12, unite: "reps" },
      { series: 4, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
    ],
  },
  C: {
    id: "C",
    nom: "Extenseurs lombaires",
    crans: [
      { numero: 1, nom: "Superman au sol, tenue 5 s" },
      { numero: 2, nom: "Reverse hyper au bord du lit" },
      { numero: 3, nom: "Reverse hyper, tenue 3 s en haut" },
      { numero: 4, nom: "Extension prone bras tendus" },
      { numero: 5, nom: "Biering-Sørensen, tenues" },
      { numero: 6, nom: "Biering-Sørensen + gilet lesté" },
    ],
    prescriptions: [
      { series: 3, min: 10, max: 12, unite: "reps" },
      { series: 3, min: 12, max: 15, unite: "reps" },
      { series: 3, min: 30, max: 45, unite: "s" },
      { series: 4, min: 45, max: 50, unite: "s" },
    ],
  },
  D: {
    id: "D",
    nom: "Genou / unilatéral",
    crans: [
      { numero: 1, nom: "Squat poids de corps, tempo 3-1-1" },
      { numero: 2, nom: "Split squat" },
      { numero: 3, nom: "Split squat bulgare" },
      { numero: 4, nom: "Split squat bulgare + gilet" },
      { numero: 5, nom: "Pistol assisté" },
      { numero: 6, nom: "Pistol complet" },
    ],
    prescriptions: [
      { series: 3, min: 10, max: 12, unite: "reps" },
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
    ],
  },
  E: {
    id: "E",
    nom: "Tirage vertical",
    crans: [
      { numero: 1, nom: "Traction négative (descente 5 s)" },
      { numero: 2, nom: "Traction assistée élastique" },
      { numero: 3, nom: "Traction stricte" },
      { numero: 4, nom: "Traction tempo 3-1-3" },
      { numero: 5, nom: "Traction lestée" },
    ],
    prescriptions: [
      { series: 3, min: 5, max: 8, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
      { series: 4, min: 5, max: 8, unite: "reps" },
      { series: 4, min: 4, max: 6, unite: "reps" },
    ],
  },
  F: {
    id: "F",
    nom: "Tirage horizontal",
    crans: [
      { numero: 1, nom: "Rowing inversé, corps peu incliné" },
      { numero: 2, nom: "Rowing inversé, corps plus horizontal" },
      { numero: 3, nom: "Rowing inversé, pieds surélevés" },
      { numero: 4, nom: "Rowing archer ou un bras assisté" },
      { numero: 5, nom: "Rowing inversé + gilet" },
    ],
    prescriptions: [
      { series: 3, min: 10, max: 12, unite: "reps" },
      { series: 4, min: 10, max: 12, unite: "reps" },
      { series: 4, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
    ],
  },
  G: {
    id: "G",
    nom: "Poussée",
    crans: [
      { numero: 1, nom: "Pompes inclinées" },
      { numero: 2, nom: "Pompes au sol" },
      { numero: 3, nom: "Pompes déclinées ou aux anneaux" },
      { numero: 4, nom: "Dips assistés élastique" },
      { numero: 5, nom: "Dips stricts" },
      { numero: 6, nom: "Dips lestés" },
    ],
    prescriptions: [
      { series: 3, min: 10, max: 12, unite: "reps" },
      { series: 4, min: 8, max: 12, unite: "reps" },
      { series: 4, min: 6, max: 10, unite: "reps" },
      { series: 4, min: 5, max: 8, unite: "reps" },
    ],
  },
  H: {
    id: "H",
    nom: "Chaîne latérale & abducteurs",
    crans: [
      { numero: 1, nom: "Side plank genoux" },
      { numero: 2, nom: "Side plank pieds" },
      { numero: 3, nom: "Side plank + abduction jambe haute" },
      { numero: 4, nom: "Side plank + gilet" },
      { numero: 5, nom: "Copenhagen genou fléchi" },
      { numero: 6, nom: "Copenhagen jambe tendue" },
      { numero: 7, nom: "Copenhagen lesté" },
    ],
    prescriptions: [
      { series: 3, min: 20, max: 25, unite: "s" },
      { series: 3, min: 30, max: 35, unite: "s" },
      { series: 3, min: 30, max: 40, unite: "s" },
      { series: 3, min: 45, max: 50, unite: "s" },
    ],
  },
  I: {
    id: "I",
    nom: "Anti-latéral & portés",
    crans: [
      { numero: 1, nom: "Suspension à un bras, tenues" },
      { numero: 2, nom: "Suitcase carry sac à dos" },
      { numero: 3, nom: "Suitcase carry kettlebell" },
      { numero: 4, nom: "Suitcase carry lourd" },
    ],
    prescriptions: [
      { series: 3, min: 15, max: 20, unite: "s" },
      { series: 3, min: 20, max: 25, unite: "m" },
      { series: 4, min: 25, max: 30, unite: "m" },
      { series: 4, min: 30, max: 40, unite: "m" },
    ],
  },
  J: {
    id: "J",
    nom: "Core anti-extension",
    crans: [
      { numero: 1, nom: "Dead bug" },
      { numero: 2, nom: "Hollow hold" },
      { numero: 3, nom: "Hollow hang à la barre" },
      { numero: 4, nom: "Relevés de genoux suspendus" },
      { numero: 5, nom: "Relevés de jambes tendues" },
      { numero: 6, nom: "L-sit aux barres à dips" },
    ],
    prescriptions: [
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 3, min: 8, max: 12, unite: "reps" },
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 3, min: 6, max: 10, unite: "reps" },
    ],
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/backpain/arbres.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/backpain/arbres.ts src/lib/backpain/arbres.test.ts
git commit -m "feat(backpain): add tree data (crans, prescriptions)"
```

---

### Task 3: `periode.ts` — week/block calculation

**Files:**
- Create: `src/lib/backpain/periode.ts`
- Test: `src/lib/backpain/periode.test.ts`

**Interfaces:**
- Produces: `computeWeek(startDate: string, today: string): number`, `computeBlock(week: number): number`, `isDechargeWeek(week: number): boolean`, `isCalibrageWeek(week: number): boolean`. Consumed by `db.ts` callers in a later phase (4b) — no consumer inside this phase's own tasks besides its own tests.

Dates are plain `"YYYY-MM-DD"` strings, no time component — required for the day-count subtraction in `computeWeek` to be correct regardless of local timezone.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/backpain/periode.test.ts
import { describe, it, expect } from "vitest";
import { computeWeek, computeBlock, isDechargeWeek, isCalibrageWeek } from "./periode";

describe("computeWeek", () => {
  it("is week 1 on the start date itself", () => {
    expect(computeWeek("2026-08-12", "2026-08-12")).toBe(1);
  });

  it("stays week 1 through day 6 (0-6 days elapsed)", () => {
    expect(computeWeek("2026-08-12", "2026-08-18")).toBe(1);
  });

  it("becomes week 2 on day 7 elapsed", () => {
    expect(computeWeek("2026-08-12", "2026-08-19")).toBe(2);
  });

  it("clamps at week 16 past the 16-week mark", () => {
    expect(computeWeek("2026-08-12", "2027-06-01")).toBe(16);
  });
});

describe("computeBlock", () => {
  it("maps weeks 1-4 to block 1, 5-8 to block 2, 9-12 to block 3, 13-16 to block 4", () => {
    expect(computeBlock(1)).toBe(1);
    expect(computeBlock(4)).toBe(1);
    expect(computeBlock(5)).toBe(2);
    expect(computeBlock(8)).toBe(2);
    expect(computeBlock(9)).toBe(3);
    expect(computeBlock(12)).toBe(3);
    expect(computeBlock(13)).toBe(4);
    expect(computeBlock(16)).toBe(4);
  });
});

describe("isDechargeWeek", () => {
  it("is true only for weeks 4, 8, 12, 16", () => {
    expect([4, 8, 12, 16].map(isDechargeWeek)).toEqual([true, true, true, true]);
    expect([1, 2, 3, 5, 9, 13, 15].map(isDechargeWeek)).toEqual([false, false, false, false, false, false, false]);
  });
});

describe("isCalibrageWeek", () => {
  it("is true only for week 1", () => {
    expect(isCalibrageWeek(1)).toBe(true);
    expect(isCalibrageWeek(2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/backpain/periode.test.ts`
Expected: FAIL — `periode.ts` does not exist.

- [ ] **Step 3: Create `src/lib/backpain/periode.ts`**

```typescript
const MS_PER_DAY = 86_400_000;

export function computeWeek(startDate: string, today: string): number {
  const daysElapsed = Math.floor((Date.parse(today) - Date.parse(startDate)) / MS_PER_DAY);
  const week = Math.floor(daysElapsed / 7) + 1;
  return Math.min(16, Math.max(1, week));
}

export function computeBlock(week: number): number {
  return Math.min(4, Math.ceil(week / 4));
}

export function isDechargeWeek(week: number): boolean {
  return week % 4 === 0;
}

export function isCalibrageWeek(week: number): boolean {
  return week === 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/backpain/periode.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/backpain/periode.ts src/lib/backpain/periode.test.ts
git commit -m "feat(backpain): add week/block period calculation"
```

---

### Task 4: `progression.ts` — the cran-advancement engine

**Files:**
- Create: `src/lib/backpain/progression.ts`
- Test: `src/lib/backpain/progression.test.ts`

**Interfaces:**
- Consumes: `ARBRES`, `ArbreId` (Task 2).
- Produces: `type Resultat`, `type EvalRow = { arbre: ArbreId; semaine: number; cranApres: number; resultat: Resultat; horodatage: string }`, `getCurrentCran(evaluations: EvalRow[], arbre: ArbreId): number`, `hasAlreadyRisenThisWeek(evaluations: EvalRow[], arbre: ArbreId, semaine: number): boolean`, `checkStagnation(evaluations: EvalRow[], arbre: ArbreId): boolean`, `evaluateProgression(input): { resultat: Resultat; message: string; cranApres: number }`. `EvalRow` is consumed by `db.ts` (Task 6) as its row shape. `evaluations` arrays passed to the derivation functions must be in chronological (ascending) order — the same order `getEvaluations` (Task 6) returns.

This is the module worth testing hardest — it is the sole source of "does the user progress" for 16 weeks across 10 independent trees. A bug here silently corrupts months of tracking (CLAUDE.md §7).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/backpain/progression.test.ts
import { describe, it, expect } from "vitest";
import { getCurrentCran, hasAlreadyRisenThisWeek, checkStagnation, evaluateProgression } from "./progression";
import type { EvalRow } from "./progression";

function row(overrides: Partial<EvalRow>): EvalRow {
  return {
    arbre: "A",
    semaine: 1,
    cranApres: 1,
    resultat: "maintien",
    horodatage: "2026-08-12T10:00:00.000Z",
    ...overrides,
  };
}

describe("getCurrentCran", () => {
  it("defaults to 1 when the tree has never been evaluated", () => {
    expect(getCurrentCran([], "A")).toBe(1);
  });

  it("returns the cranApres of the most recent row for that tree", () => {
    const evaluations = [row({ cranApres: 2, resultat: "montee" }), row({ cranApres: 2, resultat: "maintien" })];
    expect(getCurrentCran(evaluations, "A")).toBe(2);
  });

  it("ignores rows for other trees", () => {
    const evaluations = [row({ arbre: "B", cranApres: 5 }), row({ arbre: "A", cranApres: 1 })];
    expect(getCurrentCran(evaluations, "A")).toBe(1);
  });

  it("counts a calibrage row as authoritative for the current cran", () => {
    const evaluations = [row({ cranApres: 3, resultat: "calibrage" })];
    expect(getCurrentCran(evaluations, "A")).toBe(3);
  });
});

describe("hasAlreadyRisenThisWeek", () => {
  it("is false with no montee row this week", () => {
    const evaluations = [row({ semaine: 3, resultat: "maintien" })];
    expect(hasAlreadyRisenThisWeek(evaluations, "A", 3)).toBe(false);
  });

  it("is true once a montee is recorded this week", () => {
    const evaluations = [row({ semaine: 3, resultat: "montee" })];
    expect(hasAlreadyRisenThisWeek(evaluations, "A", 3)).toBe(true);
  });

  it("ignores a montee from a different week", () => {
    const evaluations = [row({ semaine: 2, resultat: "montee" })];
    expect(hasAlreadyRisenThisWeek(evaluations, "A", 3)).toBe(false);
  });
});

describe("checkStagnation", () => {
  it("is false with fewer than 3 eligible evaluations", () => {
    const evaluations = [row({ resultat: "maintien" }), row({ resultat: "maintien" })];
    expect(checkStagnation(evaluations, "A")).toBe(false);
  });

  it("is true when the last 3 eligible evaluations are all maintien", () => {
    const evaluations = [row({ resultat: "maintien" }), row({ resultat: "maintien" }), row({ resultat: "maintien" })];
    expect(checkStagnation(evaluations, "A")).toBe(true);
  });

  it("resets when a montee appears among the last 3", () => {
    const evaluations = [
      row({ resultat: "maintien" }),
      row({ resultat: "montee", cranApres: 2 }),
      row({ resultat: "maintien", cranApres: 2 }),
    ];
    expect(checkStagnation(evaluations, "A")).toBe(false);
  });

  it("does not count calibrage or decharge rows toward the window, and they don't break it", () => {
    const evaluations = [
      row({ resultat: "maintien" }),
      row({ resultat: "calibrage" }),
      row({ resultat: "decharge" }),
      row({ resultat: "maintien" }),
      row({ resultat: "maintien" }),
    ];
    expect(checkStagnation(evaluations, "A")).toBe(true);
  });
});

describe("evaluateProgression", () => {
  const base = {
    arbre: "A" as const,
    semaine: 5,
    currentCran: 3,
    seriesAuHaut: true,
    rpeAuCibleOuMoins: true,
    gene: 0,
    dejaMonteeCetteSemaine: false,
  };

  it("returns decharge on a decharge week, regardless of other inputs", () => {
    const result = evaluateProgression({ ...base, semaine: 8, gene: 9 });
    expect(result).toEqual({
      resultat: "decharge",
      message: "Semaine de décharge : pas de test de cran.",
      cranApres: 3,
    });
  });

  it("returns douleur when gene exceeds 3, before checking anything else", () => {
    const result = evaluateProgression({ ...base, gene: 4, dejaMonteeCetteSemaine: true });
    expect(result).toEqual({
      resultat: "douleur",
      message: "Gêne au-delà de 3/10 : répéter le même cran la prochaine fois.",
      cranApres: 3,
    });
  });

  it("returns plafond when already risen this week", () => {
    const result = evaluateProgression({ ...base, dejaMonteeCetteSemaine: true });
    expect(result).toEqual({
      resultat: "plafond",
      message: "Déjà monté cette semaine sur cette échelle. Une seule montée par semaine.",
      cranApres: 3,
    });
  });

  it("returns sommet at the top of a short tree (I, 4 crans)", () => {
    const result = evaluateProgression({ ...base, arbre: "I", currentCran: 4 });
    expect(result).toEqual({
      resultat: "sommet",
      message: "Sommet de l'échelle atteint.",
      cranApres: 4,
    });
  });

  it("returns sommet at the top of a long tree (A, 8 crans)", () => {
    const result = evaluateProgression({ ...base, currentCran: 8 });
    expect(result).toEqual({
      resultat: "sommet",
      message: "Sommet de l'échelle atteint.",
      cranApres: 8,
    });
  });

  it("returns maintien when series don't reach the top of the range", () => {
    const result = evaluateProgression({ ...base, seriesAuHaut: false });
    expect(result).toEqual({
      resultat: "maintien",
      message: "Rester à ce cran. Viser le haut de la fourchette au RPE cible.",
      cranApres: 3,
    });
  });

  it("returns maintien when RPE exceeds the block target", () => {
    const result = evaluateProgression({ ...base, rpeAuCibleOuMoins: false });
    expect(result.resultat).toBe("maintien");
    expect(result.cranApres).toBe(3);
  });

  it("returns montee with the next cran's name when every condition passes", () => {
    const result = evaluateProgression(base);
    expect(result).toEqual({
      resultat: "montee",
      message: "Cran suivant débloqué : Leg curl serviette unilatéral",
      cranApres: 4,
    });
  });

  it("evaluates decharge before douleur when both would fail", () => {
    const result = evaluateProgression({ ...base, semaine: 4, gene: 8 });
    expect(result.resultat).toBe("decharge");
  });

  it("evaluates douleur before plafond when both would fail", () => {
    const result = evaluateProgression({ ...base, gene: 5, dejaMonteeCetteSemaine: true });
    expect(result.resultat).toBe("douleur");
  });

  it("allows repeated calibrage in week 1 regardless of dejaMonteeCetteSemaine (caller always passes false)", () => {
    const result = evaluateProgression({ ...base, semaine: 1, dejaMonteeCetteSemaine: false });
    expect(result.resultat).toBe("montee");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/backpain/progression.test.ts`
Expected: FAIL — `progression.ts` does not exist.

- [ ] **Step 3: Create `src/lib/backpain/progression.ts`**

```typescript
import { ARBRES, type ArbreId } from "./arbres";

export type Resultat = "montee" | "maintien" | "douleur" | "plafond" | "sommet" | "decharge" | "calibrage";

export type EvalRow = {
  arbre: ArbreId;
  semaine: number;
  cranApres: number;
  resultat: Resultat;
  horodatage: string;
};

export function getCurrentCran(evaluations: EvalRow[], arbre: ArbreId): number {
  const rows = evaluations.filter((e) => e.arbre === arbre);
  return rows.length === 0 ? 1 : rows[rows.length - 1]!.cranApres;
}

export function hasAlreadyRisenThisWeek(evaluations: EvalRow[], arbre: ArbreId, semaine: number): boolean {
  return evaluations.some((e) => e.arbre === arbre && e.semaine === semaine && e.resultat === "montee");
}

export function checkStagnation(evaluations: EvalRow[], arbre: ArbreId): boolean {
  const eligible = evaluations.filter(
    (e) => e.arbre === arbre && e.resultat !== "calibrage" && e.resultat !== "decharge",
  );
  const lastThree = eligible.slice(-3);
  return lastThree.length === 3 && lastThree.every((e) => e.resultat === "maintien");
}

export function evaluateProgression(input: {
  arbre: ArbreId;
  semaine: number;
  currentCran: number;
  seriesAuHaut: boolean;
  rpeAuCibleOuMoins: boolean;
  gene: number;
  dejaMonteeCetteSemaine: boolean;
}): { resultat: Resultat; message: string; cranApres: number } {
  const { arbre, semaine, currentCran, seriesAuHaut, rpeAuCibleOuMoins, gene, dejaMonteeCetteSemaine } = input;

  if (semaine % 4 === 0) {
    return { resultat: "decharge", message: "Semaine de décharge : pas de test de cran.", cranApres: currentCran };
  }

  if (gene > 3) {
    return {
      resultat: "douleur",
      message: "Gêne au-delà de 3/10 : répéter le même cran la prochaine fois.",
      cranApres: currentCran,
    };
  }

  if (dejaMonteeCetteSemaine) {
    return {
      resultat: "plafond",
      message: "Déjà monté cette semaine sur cette échelle. Une seule montée par semaine.",
      cranApres: currentCran,
    };
  }

  const sommet = ARBRES[arbre].crans.length;
  if (currentCran >= sommet) {
    return { resultat: "sommet", message: "Sommet de l'échelle atteint.", cranApres: currentCran };
  }

  if (!seriesAuHaut || !rpeAuCibleOuMoins) {
    return {
      resultat: "maintien",
      message: "Rester à ce cran. Viser le haut de la fourchette au RPE cible.",
      cranApres: currentCran,
    };
  }

  const cranApres = currentCran + 1;
  const nomCranSuivant = ARBRES[arbre].crans[cranApres - 1]!.nom;
  return { resultat: "montee", message: `Cran suivant débloqué : ${nomCranSuivant}`, cranApres };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/backpain/progression.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/backpain/progression.ts src/lib/backpain/progression.test.ts
git commit -m "feat(backpain): add the cran-advancement progression engine"
```

---

### Task 5: `douleur.ts` — pain escalation check

**Files:**
- Create: `src/lib/backpain/douleur.ts`
- Test: `src/lib/backpain/douleur.test.ts`

**Interfaces:**
- Produces: `checkPainEscalation(recentSeances: { genePendant: number; geneLendemain: number }[]): "normal" | "repeter_cran" | "redescendre_cran"`.

Covers only the 3 mechanical tiers of §7 (see Global Constraints — the 4th tier is deliberately out of scope). `recentSeances` is chronological, oldest first, last entry = the séance that just triggered this check.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/backpain/douleur.test.ts
import { describe, it, expect } from "vitest";
import { checkPainEscalation } from "./douleur";

describe("checkPainEscalation", () => {
  it("returns normal for a single low-gene seance", () => {
    expect(checkPainEscalation([{ genePendant: 2, geneLendemain: 1 }])).toBe("normal");
  });

  it("returns normal with an empty history", () => {
    expect(checkPainEscalation([])).toBe("normal");
  });

  it("returns repeter_cran for a single seance with gene pendant above 3", () => {
    expect(checkPainEscalation([{ genePendant: 5, geneLendemain: 1 }])).toBe("repeter_cran");
  });

  it("returns repeter_cran for a single seance where only gene lendemain persists above 3", () => {
    expect(checkPainEscalation([{ genePendant: 2, geneLendemain: 4 }])).toBe("repeter_cran");
  });

  it("returns repeter_cran when the last seance is gênante but the one before it was not", () => {
    const history = [
      { genePendant: 1, geneLendemain: 1 },
      { genePendant: 5, geneLendemain: 2 },
    ];
    expect(checkPainEscalation(history)).toBe("repeter_cran");
  });

  it("returns redescendre_cran when the last two consecutive seances are both gênantes", () => {
    const history = [
      { genePendant: 4, geneLendemain: 2 },
      { genePendant: 5, geneLendemain: 3 },
    ];
    expect(checkPainEscalation(history)).toBe("redescendre_cran");
  });

  it("returns redescendre_cran even when an earlier normal seance precedes the two gênantes", () => {
    const history = [
      { genePendant: 1, geneLendemain: 1 },
      { genePendant: 4, geneLendemain: 1 },
      { genePendant: 4, geneLendemain: 1 },
    ];
    expect(checkPainEscalation(history)).toBe("redescendre_cran");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/backpain/douleur.test.ts`
Expected: FAIL — `douleur.ts` does not exist.

- [ ] **Step 3: Create `src/lib/backpain/douleur.ts`**

```typescript
function estGenante(seance: { genePendant: number; geneLendemain: number }): boolean {
  return seance.genePendant > 3 || seance.geneLendemain > 3;
}

export function checkPainEscalation(
  recentSeances: { genePendant: number; geneLendemain: number }[],
): "normal" | "repeter_cran" | "redescendre_cran" {
  const last = recentSeances[recentSeances.length - 1];
  if (!last || !estGenante(last)) return "normal";

  const secondToLast = recentSeances[recentSeances.length - 2];
  if (secondToLast && estGenante(secondToLast)) return "redescendre_cran";

  return "repeter_cran";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/backpain/douleur.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/backpain/douleur.ts src/lib/backpain/douleur.test.ts
git commit -m "feat(backpain): add pain escalation check"
```

---

### Task 6: `db.ts` — persistence

**Files:**
- Create: `src/lib/backpain/db.ts`
- Test: `src/lib/backpain/db.test.ts`

**Interfaces:**
- Consumes: `getDb` (`src/lib/db/client.ts`), `EvalRow`, `Resultat`, `ArbreId` (Task 4).
- Produces: `getStartDate(db): string | null`, `setStartDate(db, date: string): void`, `recordEvaluation(db, row: EvalRow): void`, `getEvaluations(db, arbre?: ArbreId): EvalRow[]` (ascending order, i.e. chronological — matches what Task 4's derivation functions expect).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/backpain/db.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { getStartDate, setStartDate, recordEvaluation, getEvaluations } from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-backpain-db-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("dos_start_date", () => {
  it("returns null before it is set", () => {
    const db = setup();
    expect(getStartDate(db)).toBeNull();
  });

  it("writes and reads back the start date", () => {
    const db = setup();
    setStartDate(db, "2026-08-12");
    expect(getStartDate(db)).toBe("2026-08-12");
  });

  it("overwrites the single row rather than creating a second one", () => {
    const db = setup();
    setStartDate(db, "2026-08-12");
    setStartDate(db, "2026-09-01");
    expect(getStartDate(db)).toBe("2026-09-01");
  });
});

describe("dos_evaluations", () => {
  it("returns an empty list before any evaluation is recorded", () => {
    const db = setup();
    expect(getEvaluations(db)).toEqual([]);
  });

  it("records and reads back an evaluation", () => {
    const db = setup();
    recordEvaluation(db, {
      arbre: "A",
      semaine: 3,
      cranApres: 2,
      resultat: "montee",
      horodatage: "2026-08-12T10:00:00.000Z",
    });
    expect(getEvaluations(db)).toEqual([
      { arbre: "A", semaine: 3, cranApres: 2, resultat: "montee", horodatage: "2026-08-12T10:00:00.000Z" },
    ]);
  });

  it("returns rows in ascending (chronological) order", () => {
    const db = setup();
    recordEvaluation(db, { arbre: "A", semaine: 1, cranApres: 1, resultat: "calibrage", horodatage: "2026-08-12T09:00:00.000Z" });
    recordEvaluation(db, { arbre: "A", semaine: 1, cranApres: 2, resultat: "calibrage", horodatage: "2026-08-12T09:05:00.000Z" });
    const rows = getEvaluations(db);
    expect(rows.map((r) => r.cranApres)).toEqual([1, 2]);
  });

  it("filters by arbre when given", () => {
    const db = setup();
    recordEvaluation(db, { arbre: "A", semaine: 1, cranApres: 1, resultat: "calibrage", horodatage: "2026-08-12T09:00:00.000Z" });
    recordEvaluation(db, { arbre: "B", semaine: 1, cranApres: 1, resultat: "calibrage", horodatage: "2026-08-12T09:01:00.000Z" });
    expect(getEvaluations(db, "A")).toHaveLength(1);
    expect(getEvaluations(db, "A")[0]!.arbre).toBe("A");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/backpain/db.test.ts`
Expected: FAIL — `db.ts` does not exist.

- [ ] **Step 3: Create `src/lib/backpain/db.ts`**

```typescript
import type Database from "better-sqlite3";
import type { EvalRow, Resultat } from "./progression";
import type { ArbreId } from "./arbres";

export function getStartDate(db: Database.Database): string | null {
  const row = db.prepare("SELECT start_date FROM dos_start_date WHERE id = 1").get() as
    | { start_date: string }
    | undefined;
  return row ? row.start_date : null;
}

export function setStartDate(db: Database.Database, date: string): void {
  db.prepare(
    `INSERT OR REPLACE INTO dos_start_date (id, start_date, set_at) VALUES (1, ?, ?)`,
  ).run(date, new Date().toISOString());
}

export function recordEvaluation(db: Database.Database, row: EvalRow): void {
  db.prepare(
    `INSERT INTO dos_evaluations (arbre, semaine, cran_apres, resultat, horodatage)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(row.arbre, row.semaine, row.cranApres, row.resultat, row.horodatage);
}

export function getEvaluations(db: Database.Database, arbre?: ArbreId): EvalRow[] {
  const rows = (
    arbre
      ? db
          .prepare(
            `SELECT arbre, semaine, cran_apres AS cranApres, resultat, horodatage
             FROM dos_evaluations WHERE arbre = ? ORDER BY id ASC`,
          )
          .all(arbre)
      : db
          .prepare(
            `SELECT arbre, semaine, cran_apres AS cranApres, resultat, horodatage
             FROM dos_evaluations ORDER BY id ASC`,
          )
          .all()
  ) as { arbre: ArbreId; semaine: number; cranApres: number; resultat: Resultat; horodatage: string }[];
  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/backpain/db.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/backpain/db.ts src/lib/backpain/db.test.ts
git commit -m "feat(backpain): add dos_start_date and dos_evaluations persistence"
```

---

## End of Plan

After Task 6, run the full suite once (`npx vitest run` and `npx tsc --noEmit`) before moving to `finishing-a-development-branch`. This plan produces no UI and touches no route — nothing to verify visually. The next phase (4b — Séance Dos) will consume `src/lib/backpain/*` to compose real sessions and wire the player.
