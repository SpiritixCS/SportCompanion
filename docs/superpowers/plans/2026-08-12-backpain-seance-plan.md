# Dos — séance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compose the day's Dos session from the live arbre state (4a), play it through the existing player (phase 2), capture reps-in-reserve + gêne at the end, feed the progression engine, and build the real `/dos` screen and Aujourd'hui sauge card that replace phase 3's stub.

**Architecture:** New `src/lib/dos/` module, new migration for 3 Dos-only tables (date-anchored, not `parcours/level/day_index`-shaped). `buildDosDay` adapts fixed exercises + current-cran arbre exercises into a standard `TrainDay` — the player never knows it's rendering a Dos session. `PlayerScreen`/`SummaryView`/`ResumeBanner` gain small optional props (accent, rest durations, completion hook) with defaults that reproduce today's exact Programme behavior — no other player file changes. The post-summary "Bilan" (reps-in-reserve + gêne, then the progression evaluation) is a separate route the player hands off to via a Server Action redirect, not a change to the player's own phase machine.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, React 19, better-sqlite3, Vitest.

## Global Constraints

- **Calé sur le calendrier, sans rattrapage.** `getJourSemaine(date)` maps the real weekday to J1-J6 (lundi-samedi); dimanche has no session. No stored "position" — a missed day just means no `dos_evaluations` row for that day's arbres that week.
- **RPE jamais montré à l'écran.** The Bilan asks "combien de répétitions (ou secondes) en réserve ?" with 6 buttons — `0`/`1`/`2`/`3`/`4`/`5 ou +` — converted to RPE internally per `BackPainProgram.md` §2 (0→10, 1→9, 2→8, 3→7, 4→6, 5 ou +→5). Six buttons, not five: reserve 4 is a distinct RPE 6, separate from "5 ou +" (RPE ≤ 5) — collapsing them would break the comparison against a block-1 target of exactly RPE 6.
- **`geneLendemain` is out of scope.** Only `genePendant` (captured at séance completion) is collected this phase.
- **Player behavior is unchanged.** `PlayerScreen`, `SummaryView`, `ResumeBanner` gain optional props with defaults identical to their current hardcoded values — every existing Programme test must keep passing with zero test-file changes to its assertions on behavior, only to the explicit props/mocks each test now passes. `RestView` already accepts `accent` and is not touched. `ExerciseView` already accepts `accent` for its own elements but doesn't yet forward it to `RepsSheet` (the "Ajuster les reps" sheet), and `RepsSheet`'s Valider button hardcodes `accent="cobalt"` — both get a small, additive fix in Task 8 (new optional `accent` prop on `RepsSheet`, defaulting to `"cobalt"`; `ExerciseView` forwards its own `accent` prop down to it) so the reps sheet doesn't stay cobalt inside a sage Dos session. `Sheet` is not touched (generic modal, no accent-colored elements of its own).
- **New tables, not reused ones.** `dos_seances`/`dos_sets_logged`/`dos_skipped_exercises` are separate from phase 2's `seances`/`sets_logged`/`skipped_exercises` — different identity model (date-anchored vs. `parcours/level/day_index`).
- **Stable exercise ids disambiguate arbre vs. fixed.** Arbre-based: `${arbre}-${cranNumero}` (e.g. `"A-5"`, always matches `/^[A-J]-\d+$/`). Fixed: `${jourSemaine}-${slug}` (e.g. `"lundi-hip-hinge-echauffement"`) — the day prefix makes collision with the arbre pattern structurally impossible, so `bilan.ts` can dispatch on the id shape alone, no extra flag needed.
- **`src/lib/backpain/*` (4a) is not modified.** Consumed exactly as built: `ARBRES`, `computeWeek`, `computeBlock`, `isDechargeWeek`, `RPE_CIBLE`, `getCurrentCran`, `hasAlreadyRisenThisWeek`, `evaluateProgression`, `getStartDate`, `setStartDate`, `recordEvaluation`, `getEvaluations`.
- Package manager npm. Tests: Vitest, in-memory SQLite via `mkdtempSync`, same convention as every prior phase's `*.db.test.ts`.

---

## File Structure

```
migrations/
  0005_dos_seances.sql                NOUVEAU

src/lib/dos/
  exercicesFixes.ts / .test.ts        données fixes §5, transcrites à la main
  schedule.ts / .test.ts              getJourSemaine, getDosRestSeconds
  buildDosDay.ts / .test.ts           composition TrainDay (fixes + arbres)
  db.ts / .test.ts                    dos_seances / dos_sets_logged / dos_skipped_exercises
  bilan.ts / .test.ts                 réserve→RPE, seriesAuHaut, assemblage des évaluations
  actions.ts                          Server Actions
  loadDosPlayerState.ts / .test.ts    état player Dos (test d'intégration obligatoire ici)
  loadDosTodayState.ts / .test.ts     état pour Aujourd'hui (carte + bandeau reprise)
  loadDosScreenState.ts / .test.ts    état pour l'écran /dos (carte + semaine + paliers)

src/components/player/
  PlayerScreen.tsx / .test.tsx        MODIFIÉ — props accent/rest/onSeanceFinish
  SummaryView.tsx / .test.tsx         MODIFIÉ — prop accent

src/components/today/
  ResumeBanner.tsx / .test.tsx        MODIFIÉ — prop accent
  BackPainCard.tsx / .test.tsx        NOUVEAU
  AujourdhuiScreen.tsx / .test.tsx    MODIFIÉ — reçoit et affiche l'état Dos

src/components/dos/
  DosSetup.tsx / .test.tsx            NOUVEAU — écran vide (pas de start_date)
  BilanDos.tsx / .test.tsx            NOUVEAU — réserve + gêne + validation
  DosScreen.tsx / .test.tsx           NOUVEAU — écran /dos complet

src/app/player/dos/
  page.tsx                            NOUVEAU — route player Dos
  bilan/page.tsx                      NOUVEAU — route Bilan

src/app/(shell)/
  page.tsx                            MODIFIÉ — charge aussi l'état Dos
  dos/page.tsx                        MODIFIÉ — remplace le stub
```

---

### Task 1: Migration `0005_dos_seances.sql`

**Files:**
- Create: `migrations/0005_dos_seances.sql`
- Test: `migrations/0005_dos_seances.test.ts`

**Interfaces:**
- Produces: tables `dos_seances`, `dos_sets_logged`, `dos_skipped_exercises` — colonnes exactes consommées par `src/lib/dos/db.ts` (Task 5).

- [ ] **Step 1: Write the failing test**

```typescript
// migrations/0005_dos_seances.test.ts
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

describe("0005_dos_seances migration", () => {
  it("creates dos_seances, dos_sets_logged, dos_skipped_exercises with the expected columns", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0005_dos_seances.sql");

    const seances = (db.prepare("PRAGMA table_info(dos_seances)").all() as { name: string }[]).map((c) => c.name);
    expect(seances).toEqual(["id", "date", "jour_semaine", "semaine", "started_at", "completed_at", "gene_pendant"]);

    const sets = (db.prepare("PRAGMA table_info(dos_sets_logged)").all() as { name: string }[]).map((c) => c.name);
    expect(sets).toEqual([
      "id", "seance_id", "exercise_order", "set_number", "valeur_target", "valeur_actual", "rest_seconds", "completed_at",
    ]);

    const skipped = (db.prepare("PRAGMA table_info(dos_skipped_exercises)").all() as { name: string }[]).map((c) => c.name);
    expect(skipped).toEqual(["seance_id", "exercise_order", "skipped_at"]);
  });

  it("rejects a second dos_seances row for the same date", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));

    db.prepare(`INSERT INTO dos_seances (date, jour_semaine, semaine, started_at) VALUES (?, ?, ?, ?)`).run(
      "2026-08-17", "lundi", 1, "2026-08-17T09:00:00.000Z",
    );
    expect(() =>
      db.prepare(`INSERT INTO dos_seances (date, jour_semaine, semaine, started_at) VALUES (?, ?, ?, ?)`).run(
        "2026-08-17", "lundi", 1, "2026-08-17T09:05:00.000Z",
      ),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run migrations/0005_dos_seances.test.ts`
Expected: FAIL — `0005_dos_seances.sql` does not exist.

- [ ] **Step 3: Create `migrations/0005_dos_seances.sql`**

```sql
CREATE TABLE dos_seances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  jour_semaine TEXT NOT NULL,
  semaine INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  gene_pendant INTEGER
);

CREATE TABLE dos_sets_logged (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id INTEGER NOT NULL REFERENCES dos_seances(id),
  exercise_order INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  valeur_target TEXT NOT NULL,
  valeur_actual INTEGER NOT NULL,
  rest_seconds INTEGER NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE TABLE dos_skipped_exercises (
  seance_id INTEGER NOT NULL REFERENCES dos_seances(id),
  exercise_order INTEGER NOT NULL,
  skipped_at TEXT NOT NULL,
  PRIMARY KEY (seance_id, exercise_order)
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run migrations/0005_dos_seances.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Apply the migration to the dev DB**

Run: `npm run db:migrate`
Expected: `Applied 1 migration(s): 0005_dos_seances.sql`.

- [ ] **Step 6: Commit**

```bash
git add migrations/0005_dos_seances.sql migrations/0005_dos_seances.test.ts
git commit -m "feat(db): add dos_seances, dos_sets_logged, dos_skipped_exercises migration"
```

---

### Task 2: `exercicesFixes.ts` — fixed (non-progressing) exercises

**Files:**
- Create: `src/lib/dos/exercicesFixes.ts`
- Test: `src/lib/dos/exercicesFixes.test.ts`

**Interfaces:**
- Produces: `type ExerciceFixe = { id: string; nom: string; sets: number; target: ExerciseTarget }`, `EXERCICES_FIXES: Record<JourEntraine, ExerciceFixe[]>` where `JourEntraine = "lundi"|"mardi"|"mercredi"|"jeudi"|"vendredi"|"samedi"`. Consumed by `buildDosDay.ts` (Task 4).

Transcribed from `BackPainProgram.md` §5's "Exercices fixes" column, using `ExerciseTarget` (`src/lib/workout/types.ts`, phase 2 — `{ unit, value, maxEffort, eachSide }`) directly so `buildDosDay` can splice these straight into a `TrainDay`'s exercises with no extra mapping. Two resolved ambiguities, both using real numbers already present elsewhere in `BackPainProgram.md` rather than inventing values:

- §5's J3 "Mobilité 90/90 + couch stretch" and J6 "Mobilité épaules + thoracique" reference movements §8 ("Mobilité quotidienne") already prescribes with exact dosages — reused verbatim (90/90 hanches: 2×8 par côté; couch stretch: 2×45s par côté; open book thoracique: 2×8 par côté).
- §5's J2 "Butées" line has no explicit series count ("10 reps lentes à 90 % du pincement, chaque direction") — modeled as 1 set of 10, `eachSide: true` (the two directions), with the pacing/precision instruction kept in a display note is NOT part of `ExerciseTarget` — see `note` handling below: this data module has no `note` field (kept out of `ExerciseTarget`, which has none), the pacing instruction is dropped from structured data and is not required for `evaluateProgression` (fixed exercises never enter progression) or for the player (which just shows dose + name). If this instruction matters for display later, it's a 4b-polish addition, not a blocker for this task.

```typescript
// src/lib/dos/exercicesFixes.ts
import type { ExerciseTarget } from "@/lib/workout/types";

export type JourEntraine = "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi";

export type ExerciceFixe = {
  id: string;
  nom: string;
  sets: number;
  target: ExerciseTarget;
};

function target(unit: "reps" | "s", value: number | [number, number], eachSide = false): ExerciseTarget {
  return { unit, value, maxEffort: false, eachSide };
}

export const EXERCICES_FIXES: Record<JourEntraine, ExerciceFixe[]> = {
  lundi: [
    { id: "lundi-hip-hinge-echauffement", nom: "Hip hinge au bâton", sets: 2, target: target("reps", 10) },
  ],
  mardi: [
    { id: "mardi-bascules-quadrupedie", nom: "Bascules de bassin quadrupédie", sets: 3, target: target("reps", 10) },
    { id: "mardi-chat-chameau", nom: "Chat-chameau lent", sets: 3, target: target("reps", 10) },
    { id: "mardi-bird-dog", nom: "Bird dog", sets: 3, target: target("s", [6, 10]) },
    { id: "mardi-butees", nom: "Butées", sets: 1, target: target("reps", 10, true) },
  ],
  mercredi: [
    { id: "mercredi-90-90-hanches", nom: "90/90 hanches", sets: 2, target: target("reps", 8, true) },
    { id: "mercredi-couch-stretch", nom: "Couch stretch", sets: 2, target: target("s", 45, true) },
    { id: "mercredi-abduction-elastique", nom: "Abduction élastique", sets: 3, target: target("reps", [15, 20]) },
  ],
  jeudi: [
    { id: "jeudi-open-book-thoracique", nom: "Open book thoracique", sets: 2, target: target("reps", 8, true) },
    { id: "jeudi-face-pull-elastique", nom: "Face pull élastique", sets: 3, target: target("reps", 15) },
  ],
  vendredi: [
    { id: "vendredi-pont-fessier-echauffement", nom: "Pont fessier bilatéral", sets: 2, target: target("reps", 15) },
  ],
  samedi: [
    { id: "samedi-mobilite-epaules-thoracique", nom: "Open book thoracique", sets: 2, target: target("reps", 8, true) },
    { id: "samedi-curl-up-mcgill", nom: "Curl-up McGill", sets: 3, target: target("reps", 8) },
  ],
};
```

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dos/exercicesFixes.test.ts
import { describe, it, expect } from "vitest";
import { EXERCICES_FIXES } from "./exercicesFixes";

describe("EXERCICES_FIXES", () => {
  it("has all 6 training days, none empty", () => {
    const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;
    for (const jour of jours) {
      expect(EXERCICES_FIXES[jour].length).toBeGreaterThan(0);
    }
  });

  it("matches §5 exactly for mardi (4 items) and vendredi (1 item, échauffement)", () => {
    expect(EXERCICES_FIXES.mardi).toHaveLength(4);
    expect(EXERCICES_FIXES.mardi.map((e) => e.nom)).toEqual([
      "Bascules de bassin quadrupédie", "Chat-chameau lent", "Bird dog", "Butées",
    ]);
    expect(EXERCICES_FIXES.vendredi).toEqual([
      { id: "vendredi-pont-fessier-echauffement", nom: "Pont fessier bilatéral", sets: 2, target: { unit: "reps", value: 15, maxEffort: false, eachSide: false } },
    ]);
  });

  it("every id is day-prefixed, never matching the arbre id pattern", () => {
    for (const jour of Object.keys(EXERCICES_FIXES) as (keyof typeof EXERCICES_FIXES)[]) {
      for (const exercice of EXERCICES_FIXES[jour]) {
        expect(exercice.id.startsWith(`${jour}-`)).toBe(true);
        expect(exercice.id).not.toMatch(/^[A-J]-\d+$/);
      }
    }
  });

  it("bird dog uses a seconds range target, matching §5's '3 × 8 tenue 6-10 s'", () => {
    const birdDog = EXERCICES_FIXES.mardi.find((e) => e.nom === "Bird dog");
    expect(birdDog?.sets).toBe(3);
    expect(birdDog?.target).toEqual({ unit: "s", value: [6, 10], maxEffort: false, eachSide: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dos/exercicesFixes.test.ts`
Expected: FAIL — `exercicesFixes.ts` does not exist.

- [ ] **Step 3: Create `src/lib/dos/exercicesFixes.ts`**

(Full content above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dos/exercicesFixes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dos/exercicesFixes.ts src/lib/dos/exercicesFixes.test.ts
git commit -m "feat(dos): add fixed exercises data (§5)"
```

---

### Task 3: `schedule.ts` — weekday mapping and per-day rest

**Files:**
- Create: `src/lib/dos/schedule.ts`
- Test: `src/lib/dos/schedule.test.ts`

**Interfaces:**
- Consumes: `JourEntraine` (Task 2).
- Produces: `getJourSemaine(date: string): JourEntraine | "dimanche"`, `getDosRestSeconds(jour: JourEntraine): number`. Consumed by `buildDosDay.ts` (Task 4), `dos/actions.ts` (Task 7).

`getDosRestSeconds`: 60 on mardi (J2 — no "mouvement principal" that day per §4), 90 on lundi/mercredi/vendredi (J1/J3/J5, explicit in §4). Jeudi/samedi (J4/J6) have no explicit value in §4 — treated as 90 (same as the other "mouvement principal" days), a stated assumption, not a silent one.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dos/schedule.test.ts
import { describe, it, expect } from "vitest";
import { getJourSemaine, getDosRestSeconds } from "./schedule";

describe("getJourSemaine", () => {
  it("maps ISO dates to the right weekday, dimanche included", () => {
    // 2026-08-17 is a Monday.
    expect(getJourSemaine("2026-08-17")).toBe("lundi");
    expect(getJourSemaine("2026-08-18")).toBe("mardi");
    expect(getJourSemaine("2026-08-19")).toBe("mercredi");
    expect(getJourSemaine("2026-08-20")).toBe("jeudi");
    expect(getJourSemaine("2026-08-21")).toBe("vendredi");
    expect(getJourSemaine("2026-08-22")).toBe("samedi");
    expect(getJourSemaine("2026-08-23")).toBe("dimanche");
  });
});

describe("getDosRestSeconds", () => {
  it("is 60 on mardi, 90 on every other training day", () => {
    expect(getDosRestSeconds("mardi")).toBe(60);
    expect(getDosRestSeconds("lundi")).toBe(90);
    expect(getDosRestSeconds("mercredi")).toBe(90);
    expect(getDosRestSeconds("jeudi")).toBe(90);
    expect(getDosRestSeconds("vendredi")).toBe(90);
    expect(getDosRestSeconds("samedi")).toBe(90);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dos/schedule.test.ts`
Expected: FAIL — `schedule.ts` does not exist.

- [ ] **Step 3: Create `src/lib/dos/schedule.ts`**

```typescript
import type { JourEntraine } from "./exercicesFixes";

const WEEKDAYS: (JourEntraine | "dimanche")[] = [
  "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
];

export function getJourSemaine(date: string): JourEntraine | "dimanche" {
  const parsed = new Date(`${date}T00:00:00Z`);
  return WEEKDAYS[parsed.getUTCDay()]!;
}

export function getDosRestSeconds(jour: JourEntraine): number {
  return jour === "mardi" ? 60 : 90;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dos/schedule.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dos/schedule.ts src/lib/dos/schedule.test.ts
git commit -m "feat(dos): add weekday mapping and per-day rest duration"
```

---

### Task 4: `buildDosDay.ts` — session composition

**Files:**
- Create: `src/lib/dos/buildDosDay.ts`
- Test: `src/lib/dos/buildDosDay.test.ts`

**Interfaces:**
- Consumes: `EXERCICES_FIXES`, `JourEntraine` (Task 2), `ARBRES`, `ArbreId` (4a, `src/lib/backpain/arbres.ts`).
- Produces: `ARBRES_DU_JOUR: Record<JourEntraine, ArbreId[]>`, `buildDosDay(jour: JourEntraine, bloc: number, cranCourant: Record<ArbreId, number>): TrainDay`. Consumed by `loadDosPlayerState.ts` (Task 9), `dos/actions.ts` (Task 7), `bilan.ts` (Task 6).

Order is fixed exercises first, then arbre exercises, matching §5's own column order and the fact that fixed items are explicitly "échauffement" on lundi/vendredi. `ARBRES_DU_JOUR` is §3's schedule: lundi→A,B,C · mardi→J,H · mercredi→D,A · jeudi→E,F · vendredi→B,H,I · samedi→G,J.

```typescript
// src/lib/dos/buildDosDay.ts
import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { EXERCICES_FIXES, type JourEntraine } from "./exercicesFixes";
import type { TrainDay, Exercise } from "@/lib/workout/types";

export const ARBRES_DU_JOUR: Record<JourEntraine, ArbreId[]> = {
  lundi: ["A", "B", "C"],
  mardi: ["J", "H"],
  mercredi: ["D", "A"],
  jeudi: ["E", "F"],
  vendredi: ["B", "H", "I"],
  samedi: ["G", "J"],
};

export function buildDosDay(
  jour: JourEntraine,
  bloc: number,
  cranCourant: Record<ArbreId, number>,
): TrainDay {
  const fixes: Exercise[] = EXERCICES_FIXES[jour].map((e) => ({
    id: e.id,
    name: e.nom,
    movementFamily: "dos-fixe",
    countsInStats: false,
    videoId: null,
    sets: e.sets,
    target: e.target,
  }));

  const arbres: Exercise[] = ARBRES_DU_JOUR[jour].map((arbre) => {
    const cran = cranCourant[arbre];
    const arbreDef = ARBRES[arbre];
    const cranDef = arbreDef.crans[cran - 1]!;
    const prescription = arbreDef.prescriptions[bloc - 1]!;
    return {
      id: `${arbre}-${cran}`,
      name: cranDef.nom,
      movementFamily: `arbre-${arbre}`,
      countsInStats: true,
      videoId: null,
      sets: prescription.series,
      target: { unit: prescription.unite, value: [prescription.min, prescription.max], maxEffort: false, eachSide: false },
    };
  });

  return { kind: "train", label: jour, exercises: [...fixes, ...arbres] };
}
```

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dos/buildDosDay.test.ts
import { describe, it, expect } from "vitest";
import { buildDosDay, ARBRES_DU_JOUR } from "./buildDosDay";
import type { ArbreId } from "@/lib/backpain/arbres";

const ALL_CRAN_1: Record<ArbreId, number> = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 1, J: 1 };

describe("ARBRES_DU_JOUR", () => {
  it("matches §5's schedule exactly", () => {
    expect(ARBRES_DU_JOUR.lundi).toEqual(["A", "B", "C"]);
    expect(ARBRES_DU_JOUR.mardi).toEqual(["J", "H"]);
    expect(ARBRES_DU_JOUR.mercredi).toEqual(["D", "A"]);
    expect(ARBRES_DU_JOUR.jeudi).toEqual(["E", "F"]);
    expect(ARBRES_DU_JOUR.vendredi).toEqual(["B", "H", "I"]);
    expect(ARBRES_DU_JOUR.samedi).toEqual(["G", "J"]);
  });
});

describe("buildDosDay", () => {
  it("puts fixed exercises before arbre exercises, in order", () => {
    const day = buildDosDay("lundi", 1, ALL_CRAN_1);
    expect(day.kind).toBe("train");
    expect(day.exercises.map((e) => e.id)).toEqual(["lundi-hip-hinge-echauffement", "A-1", "B-1", "C-1"]);
  });

  it("resolves each arbre exercise to its current cran's name and the current block's prescription", () => {
    const day = buildDosDay("lundi", 3, { ...ALL_CRAN_1, A: 5 });
    const nordic = day.exercises.find((e) => e.id === "A-5");
    expect(nordic?.name).toBe("Nordic curl excentrique assisté");
    expect(nordic?.sets).toBe(4); // bloc 3, A: 4 × 6-8 reps
    expect(nordic?.target).toEqual({ unit: "reps", value: [6, 8], maxEffort: false, eachSide: false });
  });

  it("marks fixed exercises countsInStats:false and arbre exercises countsInStats:true", () => {
    const day = buildDosDay("mardi", 1, ALL_CRAN_1);
    const fixed = day.exercises.find((e) => e.id === "mardi-butees")!;
    const arbre = day.exercises.find((e) => e.id === "J-1")!;
    expect(fixed.countsInStats).toBe(false);
    expect(arbre.countsInStats).toBe(true);
  });

  it("resolves a twice-weekly tree (H) independently on its two days", () => {
    const mardi = buildDosDay("mardi", 1, { ...ALL_CRAN_1, H: 2 });
    const vendredi = buildDosDay("vendredi", 1, { ...ALL_CRAN_1, H: 2 });
    expect(mardi.exercises.find((e) => e.id === "H-2")?.name).toBe("Side plank pieds");
    expect(vendredi.exercises.find((e) => e.id === "H-2")?.name).toBe("Side plank pieds");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dos/buildDosDay.test.ts`
Expected: FAIL — `buildDosDay.ts` does not exist.

- [ ] **Step 3: Create `src/lib/dos/buildDosDay.ts`**

(Full content above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dos/buildDosDay.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dos/buildDosDay.ts src/lib/dos/buildDosDay.test.ts
git commit -m "feat(dos): add session composition (fixed + arbre exercises)"
```

---

### Task 5: `db.ts` — persistence for Dos séances

**Files:**
- Create: `src/lib/dos/db.ts`
- Test: `src/lib/dos/db.test.ts`

**Interfaces:**
- Consumes: `getDb` (`src/lib/db/client.ts`).
- Produces: `type DosSeance`, `type DosSetLoggedRecord`, `getDosSeanceByDate`, `getDosSeanceById`, `startDosSeance`, `getOrStartDosSeance`, `getSetsForDosSeance`, `logDosSet`, `skipDosExercise`, `getSkippedDosExercises`, `completeDosSeance`, `toPlayerSetsLogged`. Consumed by `loadDosPlayerState.ts` (Task 9), `dos/actions.ts` (Task 7), `bilan.ts` (Task 6), `/player/dos/page.tsx` (Task 10).

`toPlayerSetsLogged` renames `valeurTarget`/`valeurActual` → `repsTarget`/`repsActual` — the DB schema keeps domain-honest naming (Dos values aren't always reps), but `SummaryView` (phase 2, unmodified) expects the `repsActual`/`repsTarget` field names it already has. This mapping is the adapter boundary; it exists only where Dos setsLogged are handed to the player, never inside `src/lib/dos/*`'s own logic.

```typescript
// src/lib/dos/db.ts
import type Database from "better-sqlite3";
import type { SetLoggedRecord } from "@/lib/player/db";

export type DosSeance = {
  id: number;
  date: string;
  jourSemaine: string;
  semaine: number;
  startedAt: string;
  completedAt: string | null;
  genePendant: number | null;
};

export type DosSetLoggedRecord = {
  id: number;
  seanceId: number;
  exerciseOrder: number;
  setNumber: number;
  valeurTarget: string;
  valeurActual: number;
  restSeconds: number;
  completedAt: string;
};

function mapSeance(row: {
  id: number; date: string; jour_semaine: string; semaine: number;
  started_at: string; completed_at: string | null; gene_pendant: number | null;
}): DosSeance {
  return {
    id: row.id, date: row.date, jourSemaine: row.jour_semaine, semaine: row.semaine,
    startedAt: row.started_at, completedAt: row.completed_at, genePendant: row.gene_pendant,
  };
}

export function getDosSeanceByDate(db: Database.Database, date: string): DosSeance | null {
  const row = db.prepare(`SELECT * FROM dos_seances WHERE date = ?`).get(date) as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function getDosSeanceById(db: Database.Database, id: number): DosSeance | null {
  const row = db.prepare(`SELECT * FROM dos_seances WHERE id = ?`).get(id) as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function startDosSeance(
  db: Database.Database,
  date: string,
  jourSemaine: string,
  semaine: number,
): DosSeance {
  const startedAt = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO dos_seances (date, jour_semaine, semaine, started_at) VALUES (?, ?, ?, ?)`)
    .run(date, jourSemaine, semaine, startedAt);
  return {
    id: Number(result.lastInsertRowid), date, jourSemaine, semaine,
    startedAt, completedAt: null, genePendant: null,
  };
}

export function getOrStartDosSeance(
  db: Database.Database,
  date: string,
  jourSemaine: string,
  semaine: number,
): DosSeance {
  return getDosSeanceByDate(db, date) ?? startDosSeance(db, date, jourSemaine, semaine);
}

export function getSetsForDosSeance(db: Database.Database, seanceId: number): DosSetLoggedRecord[] {
  return db
    .prepare(
      `SELECT id, seance_id AS seanceId, exercise_order AS exerciseOrder, set_number AS setNumber,
              valeur_target AS valeurTarget, valeur_actual AS valeurActual, rest_seconds AS restSeconds,
              completed_at AS completedAt
       FROM dos_sets_logged WHERE seance_id = ? ORDER BY id ASC`,
    )
    .all(seanceId) as DosSetLoggedRecord[];
}

export function logDosSet(
  db: Database.Database,
  params: {
    seanceId: number;
    exerciseOrder: number;
    setNumber: number;
    valeurTarget: string;
    valeurActual: number;
    restSeconds: number;
  },
): DosSetLoggedRecord {
  const completedAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO dos_sets_logged (seance_id, exercise_order, set_number, valeur_target, valeur_actual, rest_seconds, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(params.seanceId, params.exerciseOrder, params.setNumber, params.valeurTarget, params.valeurActual, params.restSeconds, completedAt);
  return { ...params, id: Number(result.lastInsertRowid), completedAt };
}

export function skipDosExercise(db: Database.Database, seanceId: number, exerciseOrder: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO dos_skipped_exercises (seance_id, exercise_order, skipped_at) VALUES (?, ?, ?)`,
  ).run(seanceId, exerciseOrder, new Date().toISOString());
}

export function getSkippedDosExercises(db: Database.Database, seanceId: number): number[] {
  const rows = db
    .prepare(`SELECT exercise_order AS exerciseOrder FROM dos_skipped_exercises WHERE seance_id = ?`)
    .all(seanceId) as { exerciseOrder: number }[];
  return rows.map((r) => r.exerciseOrder);
}

export function completeDosSeance(db: Database.Database, seanceId: number, genePendant: number): void {
  db.prepare(`UPDATE dos_seances SET completed_at = ?, gene_pendant = ? WHERE id = ?`).run(
    new Date().toISOString(), genePendant, seanceId,
  );
}

export function toPlayerSetsLogged(rows: DosSetLoggedRecord[]): SetLoggedRecord[] {
  return rows.map((r) => ({
    id: r.id, seanceId: r.seanceId, exerciseOrder: r.exerciseOrder, setNumber: r.setNumber,
    repsTarget: r.valeurTarget, repsActual: r.valeurActual, restSeconds: r.restSeconds, completedAt: r.completedAt,
  }));
}
```

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dos/db.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import {
  getDosSeanceByDate, getOrStartDosSeance, getSetsForDosSeance, logDosSet,
  skipDosExercise, getSkippedDosExercises, completeDosSeance, toPlayerSetsLogged,
} from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-dos-db-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("dos_seances", () => {
  it("returns null before any seance exists for a date", () => {
    const db = setup();
    expect(getDosSeanceByDate(db, "2026-08-17")).toBeNull();
  });

  it("getOrStartDosSeance creates once, returns the same row on a second call", () => {
    const db = setup();
    const first = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    const second = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    expect(second.id).toBe(first.id);
    expect(first.semaine).toBe(1);
    expect(first.completedAt).toBeNull();
  });

  it("completeDosSeance writes completed_at and gene_pendant", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    completeDosSeance(db, seance.id, 2);
    const reloaded = getDosSeanceByDate(db, "2026-08-17")!;
    expect(reloaded.completedAt).not.toBeNull();
    expect(reloaded.genePendant).toBe(2);
  });
});

describe("dos_sets_logged / dos_skipped_exercises", () => {
  it("logs a set and reads it back in order", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 0, setNumber: 1, valeurTarget: "10", valeurActual: 10, restSeconds: 90 });
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 0, setNumber: 2, valeurTarget: "10", valeurActual: 9, restSeconds: 90 });
    const sets = getSetsForDosSeance(db, seance.id);
    expect(sets.map((s) => s.valeurActual)).toEqual([10, 9]);
  });

  it("skips an exercise and reads it back", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    skipDosExercise(db, seance.id, 2);
    expect(getSkippedDosExercises(db, seance.id)).toEqual([2]);
  });
});

describe("toPlayerSetsLogged", () => {
  it("renames valeurTarget/valeurActual to repsTarget/repsActual", () => {
    const mapped = toPlayerSetsLogged([
      { id: 1, seanceId: 1, exerciseOrder: 0, setNumber: 1, valeurTarget: "8-10", valeurActual: 9, restSeconds: 90, completedAt: "2026-08-17T09:00:00.000Z" },
    ]);
    expect(mapped).toEqual([
      { id: 1, seanceId: 1, exerciseOrder: 0, setNumber: 1, repsTarget: "8-10", repsActual: 9, restSeconds: 90, completedAt: "2026-08-17T09:00:00.000Z" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dos/db.test.ts`
Expected: FAIL — `db.ts` does not exist.

- [ ] **Step 3: Create `src/lib/dos/db.ts`**

(Full content above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dos/db.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dos/db.ts src/lib/dos/db.test.ts
git commit -m "feat(dos): add dos_seances persistence"
```

---

### Task 6: `bilan.ts` — reserve→RPE conversion and evaluation assembly

**Files:**
- Create: `src/lib/dos/bilan.ts`
- Test: `src/lib/dos/bilan.test.ts`

**Interfaces:**
- Consumes: `ARBRES`, `ArbreId` (4a `arbres.ts`), `computeBlock`, `RPE_CIBLE` (4a `periode.ts`), `getCurrentCran`, `hasAlreadyRisenThisWeek`, `type EvalRow` (4a `progression.ts`), `TrainDay` (`workout/types.ts`).
- Produces: `type Reserve = 0 | 1 | 2 | 3 | 4 | 5`, `reserveToRpe(reserve: Reserve): number`, `computeSeriesAuHaut(sets: { valeurActual: number }[], prescriptionMax: number): boolean`, `type ArbreEvaluationInput`, `buildArbreEvaluationInputs(params): ArbreEvaluationInput[]`. Consumed by `dos/actions.ts` (Task 7).

Pure logic, no DB — the whole point is testability without fixtures beyond plain objects.

```typescript
// src/lib/dos/bilan.ts
import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { computeBlock, RPE_CIBLE } from "@/lib/backpain/periode";
import { getCurrentCran, hasAlreadyRisenThisWeek, type EvalRow } from "@/lib/backpain/progression";
import type { TrainDay } from "@/lib/workout/types";

export type Reserve = 0 | 1 | 2 | 3 | 4 | 5;

const RESERVE_TO_RPE: Record<Reserve, number> = { 0: 10, 1: 9, 2: 8, 3: 7, 4: 6, 5: 5 };

export function reserveToRpe(reserve: Reserve): number {
  return RESERVE_TO_RPE[reserve];
}

export function computeSeriesAuHaut(sets: { valeurActual: number }[], prescriptionMax: number): boolean {
  if (sets.length === 0) return false;
  return sets.every((s) => s.valeurActual >= prescriptionMax);
}

export type ArbreEvaluationInput = {
  arbre: ArbreId;
  semaine: number;
  currentCran: number;
  seriesAuHaut: boolean;
  rpeAuCibleOuMoins: boolean;
  genePendant: number;
  dejaMonteeCetteSemaine: boolean;
};

const ARBRE_EXERCISE_ID = /^([A-J])-(\d+)$/;

export function buildArbreEvaluationInputs(params: {
  day: TrainDay;
  setsLoggedByExerciseOrder: Map<number, { valeurActual: number }[]>;
  skippedExerciseOrders: Set<number>;
  semaine: number;
  evaluations: EvalRow[];
  genePendant: number;
  reserves: Partial<Record<ArbreId, Reserve>>;
}): ArbreEvaluationInput[] {
  const bloc = computeBlock(params.semaine);
  const results: ArbreEvaluationInput[] = [];

  params.day.exercises.forEach((exercise, exerciseOrder) => {
    if (params.skippedExerciseOrders.has(exerciseOrder)) return;
    const match = exercise.id.match(ARBRE_EXERCISE_ID);
    if (!match) return;
    const arbre = match[1] as ArbreId;
    const reserve = params.reserves[arbre];
    if (reserve === undefined) return;

    const sets = params.setsLoggedByExerciseOrder.get(exerciseOrder) ?? [];
    const prescriptionMax = ARBRES[arbre].prescriptions[bloc - 1]!.max;
    const rpe = reserveToRpe(reserve);

    results.push({
      arbre,
      semaine: params.semaine,
      currentCran: getCurrentCran(params.evaluations, arbre),
      seriesAuHaut: computeSeriesAuHaut(sets, prescriptionMax),
      rpeAuCibleOuMoins: rpe <= RPE_CIBLE[bloc - 1]!,
      genePendant: params.genePendant,
      dejaMonteeCetteSemaine: hasAlreadyRisenThisWeek(params.evaluations, arbre, params.semaine),
    });
  });

  return results;
}
```

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dos/bilan.test.ts
import { describe, it, expect } from "vitest";
import { reserveToRpe, computeSeriesAuHaut, buildArbreEvaluationInputs } from "./bilan";
import type { TrainDay } from "@/lib/workout/types";
import type { EvalRow } from "@/lib/backpain/progression";

describe("reserveToRpe", () => {
  it("maps the full §2 table, reserve 4 distinct from 5", () => {
    expect(reserveToRpe(0)).toBe(10);
    expect(reserveToRpe(1)).toBe(9);
    expect(reserveToRpe(2)).toBe(8);
    expect(reserveToRpe(3)).toBe(7);
    expect(reserveToRpe(4)).toBe(6);
    expect(reserveToRpe(5)).toBe(5);
  });
});

describe("computeSeriesAuHaut", () => {
  it("is false with no logged sets", () => {
    expect(computeSeriesAuHaut([], 10)).toBe(false);
  });

  it("is true only when every set reaches the max", () => {
    expect(computeSeriesAuHaut([{ valeurActual: 10 }, { valeurActual: 10 }], 10)).toBe(true);
    expect(computeSeriesAuHaut([{ valeurActual: 10 }, { valeurActual: 9 }], 10)).toBe(false);
  });

  it("a set above the max still counts as reaching it", () => {
    expect(computeSeriesAuHaut([{ valeurActual: 12 }], 10)).toBe(true);
  });
});

describe("buildArbreEvaluationInputs", () => {
  const DAY: TrainDay = {
    kind: "train",
    label: "lundi",
    exercises: [
      { id: "lundi-hip-hinge-echauffement", name: "Hip hinge au bâton", movementFamily: "dos-fixe", countsInStats: false, videoId: null, sets: 2, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
      { id: "A-1", name: "Hip hinge au bâton", movementFamily: "arbre-A", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: [8, 10], maxEffort: false, eachSide: false } },
      { id: "B-1", name: "Pont fessier bilatéral", movementFamily: "arbre-B", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: [12, 15], maxEffort: false, eachSide: false } },
    ],
  };

  it("produces one input per non-skipped arbre exercise, ignores the fixed exercise", () => {
    const inputs = buildArbreEvaluationInputs({
      day: DAY,
      setsLoggedByExerciseOrder: new Map([
        [1, [{ valeurActual: 10 }, { valeurActual: 10 }, { valeurActual: 10 }]],
        [2, [{ valeurActual: 12 }, { valeurActual: 12 }, { valeurActual: 12 }]],
      ]),
      skippedExerciseOrders: new Set(),
      semaine: 5,
      evaluations: [],
      genePendant: 1,
      reserves: { A: 0, B: 3 },
    });
    expect(inputs.map((i) => i.arbre)).toEqual(["A", "B"]);
    expect(inputs[0]).toMatchObject({ arbre: "A", currentCran: 1, seriesAuHaut: true, rpeAuCibleOuMoins: true });
  });

  it("skips an exercise entirely when its order is in skippedExerciseOrders", () => {
    const inputs = buildArbreEvaluationInputs({
      day: DAY,
      setsLoggedByExerciseOrder: new Map(),
      skippedExerciseOrders: new Set([2]),
      semaine: 5,
      evaluations: [],
      genePendant: 0,
      reserves: { A: 0, B: 0 },
    });
    expect(inputs.map((i) => i.arbre)).toEqual(["A"]);
  });

  it("uses getCurrentCran/hasAlreadyRisenThisWeek from the evaluation history", () => {
    const evaluations: EvalRow[] = [
      { arbre: "A", semaine: 5, cranApres: 3, resultat: "montee", horodatage: "2026-08-10T09:00:00.000Z" },
    ];
    const inputs = buildArbreEvaluationInputs({
      day: DAY,
      setsLoggedByExerciseOrder: new Map([[1, [{ valeurActual: 10 }]]]),
      skippedExerciseOrders: new Set([2]),
      semaine: 5,
      evaluations,
      genePendant: 0,
      reserves: { A: 0 },
    });
    expect(inputs[0]).toMatchObject({ currentCran: 3, dejaMonteeCetteSemaine: true });
  });

  it("omits an arbre exercise when no reserve was answered for it", () => {
    const inputs = buildArbreEvaluationInputs({
      day: DAY,
      setsLoggedByExerciseOrder: new Map(),
      skippedExerciseOrders: new Set(),
      semaine: 5,
      evaluations: [],
      genePendant: 0,
      reserves: { A: 0 },
    });
    expect(inputs.map((i) => i.arbre)).toEqual(["A"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dos/bilan.test.ts`
Expected: FAIL — `bilan.ts` does not exist.

- [ ] **Step 3: Create `src/lib/dos/bilan.ts`**

(Full content above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dos/bilan.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dos/bilan.ts src/lib/dos/bilan.test.ts
git commit -m "feat(dos): add reserve-to-RPE conversion and evaluation assembly"
```

---

### Task 7: `dos/actions.ts` — Server Actions

**Files:**
- Create: `src/lib/dos/actions.ts`

**Interfaces:**
- Consumes: `getDb`, `setStartDate` (4a `db.ts`), `logDosSet`, `skipDosExercise`, `getSetsForDosSeance`, `getSkippedDosExercises`, `completeDosSeance`, `getDosSeanceById` (Task 5), `buildDosDay`, `ARBRES_DU_JOUR` (Task 4), `computeBlock`, `getStartDate`, `computeWeek`, `getEvaluations`, `recordEvaluation` (4a), `getCurrentCran` (4a `progression.ts`), `buildArbreEvaluationInputs` (Task 6), `evaluateProgression` (4a).
- Produces: `setStartDateAction(date: string): Promise<void>` (consumed by `DosSetup.tsx`, Task 16), `logDosSetAction(params: { seanceId; exerciseOrder; setNumber; repsTarget; repsActual; restSeconds }): Promise<void>` and `skipDosExerciseAction(seanceId: number, exerciseOrder: number): Promise<void>` (both consumed by `/player/dos/page.tsx`, Task 10, as `PlayerScreen`'s `onLogSet`/`onSkipExercise` props from Task 8 — `logDosSetAction`'s external signature deliberately matches `logSetAction`'s so both are interchangeable there), `startDosBilanAction(seanceId: number): Promise<never>` (consumed by `/player/dos/page.tsx`, Task 10, as `PlayerScreen`'s `onSeanceFinish` prop), `completeDosSeanceAction(seanceId: number, genePendant: number, reserves: Partial<Record<ArbreId, Reserve>>): Promise<{ arbre: ArbreId; nom: string; message: string }[]>` (consumed by `/player/dos/bilan/page.tsx` → `BilanDosClient.tsx`, Task 12).

`startDosBilanAction` calls `redirect()` (Next.js Server Action convention — works transparently when invoked from a Client Component), so its return type is `Promise<never>`. `completeDosSeanceAction` does **not** redirect — the design spec requires showing `evaluateProgression`'s message per arbre after validation ("le message retourné... tel quel, par arbre"), so it writes everything then returns the per-arbre results for `BilanDosClient` (Task 12) to render before the user navigates home.

No dedicated test file — same reasoning as `src/lib/player/actions.ts`/`src/lib/programme/actions.ts`: a thin `"use server"` wrapper with no branching of its own beyond what Tasks 5/6/4a already cover, plus `redirect()` (untestable in Vitest without mocking Next internals for no real gain).

- [ ] **Step 1: Create `src/lib/dos/actions.ts`**

```typescript
"use server";

import type Database from "better-sqlite3";
import path from "node:path";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { setStartDate, getEvaluations, recordEvaluation } from "@/lib/backpain/db";
import { computeWeek, computeBlock } from "@/lib/backpain/periode";
import { evaluateProgression, getCurrentCran } from "@/lib/backpain/progression";
import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { buildDosDay, ARBRES_DU_JOUR } from "./buildDosDay";
import {
  logDosSet,
  skipDosExercise,
  getSetsForDosSeance,
  getSkippedDosExercises,
  completeDosSeance,
  getDosSeanceById,
} from "./db";
import { buildArbreEvaluationInputs, type Reserve } from "./bilan";

let dbInstance: Database.Database | null = null;

function db(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
    dbInstance = getDb(dbPath);
  }
  return dbInstance;
}

export async function setStartDateAction(date: string): Promise<void> {
  setStartDate(db(), date);
}

// External signature matches src/lib/player/actions.ts's logSetAction exactly
// (repsTarget/repsActual, not valeurTarget/valeurActual) so PlayerScreen's
// onLogSet prop (Task 8) can take either action interchangeably — Next.js
// requires a Server Action passed across the Server->Client boundary to be
// the action itself, not a page-level wrapper closure. The DB layer
// (logDosSet, Task 5) keeps the domain-honest valeur_target/valeur_actual
// naming; this is the one place that renames at the boundary.
export async function logDosSetAction(params: {
  seanceId: number;
  exerciseOrder: number;
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
}): Promise<void> {
  logDosSet(db(), {
    seanceId: params.seanceId,
    exerciseOrder: params.exerciseOrder,
    setNumber: params.setNumber,
    valeurTarget: params.repsTarget,
    valeurActual: params.repsActual,
    restSeconds: params.restSeconds,
  });
}

export async function skipDosExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipDosExercise(db(), seanceId, exerciseOrder);
}

export async function startDosBilanAction(seanceId: number): Promise<never> {
  redirect(`/player/dos/bilan?seanceId=${seanceId}`);
}

export async function completeDosSeanceAction(
  seanceId: number,
  genePendant: number,
  reserves: Partial<Record<ArbreId, Reserve>>,
): Promise<{ arbre: ArbreId; nom: string; message: string }[]> {
  const database = db();
  const seance = getDosSeanceById(database, seanceId)!;
  const bloc = computeBlock(seance.semaine);

  const cranCourant = {} as Record<ArbreId, number>;
  const allEvaluations = getEvaluations(database);
  const jourArbres = ARBRES_DU_JOUR[seance.jourSemaine as keyof typeof ARBRES_DU_JOUR] ?? [];
  for (const arbre of jourArbres) {
    cranCourant[arbre] = getCurrentCran(allEvaluations, arbre);
  }

  const day = buildDosDay(seance.jourSemaine as keyof typeof ARBRES_DU_JOUR, bloc, cranCourant);
  const sets = getSetsForDosSeance(database, seanceId);
  const setsByExerciseOrder = new Map<number, { valeurActual: number }[]>();
  for (const set of sets) {
    const list = setsByExerciseOrder.get(set.exerciseOrder) ?? [];
    list.push({ valeurActual: set.valeurActual });
    setsByExerciseOrder.set(set.exerciseOrder, list);
  }
  const skipped = new Set(getSkippedDosExercises(database, seanceId));

  const inputs = buildArbreEvaluationInputs({
    day,
    setsLoggedByExerciseOrder: setsByExerciseOrder,
    skippedExerciseOrders: skipped,
    semaine: seance.semaine,
    evaluations: allEvaluations,
    genePendant,
    reserves,
  });

  const results: { arbre: ArbreId; nom: string; message: string }[] = [];
  for (const input of inputs) {
    const result = evaluateProgression(input);
    recordEvaluation(database, {
      arbre: input.arbre,
      semaine: input.semaine,
      cranApres: result.cranApres,
      resultat: result.resultat,
      horodatage: new Date().toISOString(),
    });
    results.push({ arbre: input.arbre, nom: ARBRES[input.arbre].nom, message: result.message });
  }

  completeDosSeance(database, seanceId, genePendant);
  return results;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dos/actions.ts
git commit -m "feat(dos): add Server Actions for setup, logging, and séance completion"
```

---

### Task 8: Parametrize `PlayerScreen`, `SummaryView`, `ResumeBanner`, `RepsSheet`/`ExerciseView` for reuse

**Files:**
- Modify: `src/components/player/PlayerScreen.tsx`, `src/components/player/PlayerScreen.test.tsx`
- Modify: `src/components/player/SummaryView.tsx`, `src/components/player/SummaryView.test.tsx`
- Modify: `src/components/player/RepsSheet.tsx`, `src/components/player/RepsSheet.test.tsx`
- Modify: `src/components/player/ExerciseView.tsx`
- Modify: `src/components/today/ResumeBanner.tsx`, `src/components/today/ResumeBanner.test.tsx`

**Interfaces:**
- Produces: `PlayerScreen` gains `accent?: Accent = "cobalt"`, `restBetweenSetsSeconds?: number = REST_BETWEEN_SETS_SECONDS`, `restBetweenExercisesSeconds?: number = REST_BETWEEN_EXERCISES_SECONDS`, and three **required** props replacing its previously-hardcoded `@/lib/player/actions` import: `onLogSet: (params: { seanceId; exerciseOrder; setNumber; repsTarget; repsActual; restSeconds }) => Promise<void>`, `onSkipExercise: (seanceId: number, exerciseOrder: number) => Promise<void>`, `onSeanceFinish: (seanceId: number) => Promise<void>`. `SummaryView` gains `accent?: Accent = "cobalt"`. `RepsSheet` gains `accent?: Accent = "cobalt"`, threaded to its Valider button. `ExerciseView` (already has `accent?: Accent = "cobalt"`) forwards it to `RepsSheet`. `ResumeBanner` gains `accent?: Accent = "cobalt"`. Consumed by `/player/page.tsx` (Step 10 below), `/player/dos/page.tsx` (Task 10), `AujourdhuiScreen.tsx` (Task 15).

**Why all three, not just completion:** the original `PlayerScreen` imported `logSetAction`/`skipExerciseAction` directly from `@/lib/player/actions` — the Programme-specific actions, which write to `sets_logged`/`seances` keyed by `parcours/level/day_index`. Left unparametrized, every set logged during a Dos session would silently target the wrong table with a `seanceId` from a completely different id space (`dos_seances`). Next.js Server Actions passed as Client Component props must themselves be Server Actions — an inline wrapper function defined in a page component (`(p) => logDosSetAction({...p, valeurActual: p.repsActual})`) is **not** serializable across that boundary, so the fix isn't "wrap it in the page," it's "give the Dos action the exact same external signature" (Task 7's `logDosSetAction` already does this — see its `repsTarget`/`repsActual` parameter names, distinct from the DB layer's `valeurTarget`/`valeurActual` columns).

`onLogSet`/`onSkipExercise`/`onSeanceFinish` are the breaking changes — every existing call site must now pass all three explicitly. `accent`/rest props are additive and backward-compatible.

- [ ] **Step 1: Update `src/components/player/PlayerScreen.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExerciseView } from "./ExerciseView";
import { RestView } from "./RestView";
import { SummaryView } from "./SummaryView";
import { Sheet } from "@/components/Sheet";
import { REST_BETWEEN_SETS_SECONDS, REST_BETWEEN_EXERCISES_SECONDS } from "@/lib/player/constants";
import type { Accent } from "@/components/Pastille";
import type { TrainDay } from "@/lib/workout/types";
import type { PlayerState } from "@/lib/player/loadPlayerState";
import type { SetLoggedRecord } from "@/lib/player/db";

type LogSetParams = {
  seanceId: number;
  exerciseOrder: number;
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
};

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

function elapsedSecondsSince(startedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
}

// Anchored on the seance's DB `startedAt`, never a client-only counter —
// a full reload still shows the real elapsed time (CLAUDE.md §2 lesson).
// Seeded at 0 (not computed from Date.now()) so SSR and hydration agree;
// the real value lands a tick later, client-side only, via the effect below.
function useElapsedSeconds(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    setElapsed(elapsedSecondsSince(startedAt));
    const id = setInterval(() => setElapsed(elapsedSecondsSince(startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

export function PlayerScreen({
  day,
  state,
  setsLogged,
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
  accent?: Accent;
  restBetweenSetsSeconds?: number;
  restBetweenExercisesSeconds?: number;
  onLogSet: (params: LogSetParams) => Promise<void>;
  onSkipExercise: (seanceId: number, exerciseOrder: number) => Promise<void>;
  onSeanceFinish: (seanceId: number) => Promise<void>;
}) {
  const router = useRouter();
  const [localPhase, setLocalPhase] = useState<LocalPhase>({ kind: "exercise" });
  const [quitOpen, setQuitOpen] = useState(false);
  const elapsedSeconds = useElapsedSeconds(state.phase !== "completed" ? state.startedAt : null);

  if (state.phase === "pending-validation") {
    return (
      <SummaryView
        exercises={day.exercises}
        setsLogged={setsLogged}
        durationSeconds={elapsedSeconds}
        accent={accent}
        onFinish={async () => {
          await onSeanceFinish(state.seanceId);
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
  const { skippedExerciseOrders, seanceId } = state;
  const exercise = day.exercises[exerciseOrder]!;

  async function handleCompleteSet(repsActual: number) {
    const restSeconds = isLastSetOfExercise ? restBetweenExercisesSeconds : restBetweenSetsSeconds;
    await onLogSet({
      seanceId,
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
        ? findNextLabel(day, exerciseOrder, skippedExerciseOrders)
        : exercise.name,
    });
  }

  async function handleSkipExercise() {
    await onSkipExercise(seanceId, exerciseOrder);
    router.refresh();
  }

  if (localPhase.kind === "rest") {
    return (
      <RestView
        durationSeconds={localPhase.durationSeconds}
        nextLabel={localPhase.nextLabel}
        variant={localPhase.variant}
        accent={accent}
        onComplete={() => {
          setLocalPhase({ kind: "exercise" });
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <ExerciseView
        exercise={exercise}
        exerciseIndex={exerciseOrder}
        totalExercises={day.exercises.length}
        setNumber={setNumber}
        elapsedSeconds={elapsedSeconds}
        accent={accent}
        onCompleteSet={handleCompleteSet}
        onSkipExercise={handleSkipExercise}
        onQuit={() => setQuitOpen(true)}
      />
      <Sheet open={quitOpen} onClose={() => setQuitOpen(false)} title="Quitter la séance ?">
        <p className="text-15 text-graphite leading-relaxed">
          Elle est enregistrée où tu t&apos;es arrêté. Tu pourras la reprendre depuis Aujourd&apos;hui.
        </p>
        <div className="flex flex-col gap-2.5 mt-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="h-14 rounded-pill border border-alert text-alert font-archivo text-15 font-semibold"
          >
            Quitter et reprendre plus tard
          </button>
          <button
            type="button"
            onClick={() => setQuitOpen(false)}
            className="h-14 rounded-pill bg-ink text-paper font-archivo text-15 font-semibold"
          >
            Continuer la séance
          </button>
        </div>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 2: Update `src/components/player/PlayerScreen.test.tsx`**

Every other assertion stays identical. `PlayerScreen` no longer imports `@/lib/player/actions` at all, so the module mock is replaced with three plain prop mocks (`onLogSet`, `onSkipExercise`, `onSeanceFinish`), passed to every `render(<PlayerScreen .../>)` call:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerScreen } from "./PlayerScreen";
import type { TrainDay } from "@/lib/workout/types";
import type { PlayerState } from "@/lib/player/loadPlayerState";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

const onLogSet = vi.fn().mockResolvedValue(undefined);
const onSkipExercise = vi.fn().mockResolvedValue(undefined);
const onSeanceFinish = vi.fn().mockResolvedValue(undefined);

const DAY: TrainDay = {
  kind: "train",
  label: "Day 1",
  exercises: [
    { id: "push-ups", name: "Push ups", movementFamily: "push", countsInStats: true, videoId: null, sets: 1, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
    { id: "squats", name: "Squats", movementFamily: "legs", countsInStats: true, videoId: null, sets: 1, target: { unit: "reps", value: 15, maxEffort: false, eachSide: false } },
  ],
};

const STARTED_AT = new Date(Date.now() - 65_000).toISOString();

function actionProps() {
  return { onLogSet, onSkipExercise, onSeanceFinish };
}

beforeEach(() => {
  refresh.mockClear();
  push.mockClear();
  onLogSet.mockClear();
  onSkipExercise.mockClear();
  onSeanceFinish.mockClear();
});

describe("PlayerScreen", () => {
  it("renders ExerciseView for an in-progress state, chronometer anchored on startedAt", () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);
    expect(screen.getByText("Push ups")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
  });

  it("logs the set then shows RestView with the default betweenExercises duration when it was the last set", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);

    await userEvent.click(screen.getByRole("button", { name: "Série terminée" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(onLogSet).toHaveBeenCalledWith(
      expect.objectContaining({ seanceId: 1, exerciseOrder: 0, setNumber: 1, repsActual: 10, restSeconds: 120 }),
    );
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText(/Squats/)).toBeInTheDocument();
  });

  it("uses custom rest durations when provided", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(
      <PlayerScreen
        day={DAY}
        state={state}
        setsLogged={[]}
        {...actionProps()}
        restBetweenSetsSeconds={60}
        restBetweenExercisesSeconds={60}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Série terminée" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(onLogSet).toHaveBeenCalledWith(expect.objectContaining({ restSeconds: 60 }));
    expect(screen.getByText("60")).toBeInTheDocument();
  });

  it("skips the exercise and refreshes", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);

    await userEvent.click(screen.getByText("Passer l'exercice"));

    expect(onSkipExercise).toHaveBeenCalledWith(1, 0);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("opens the quit sheet and navigates home on confirm", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);

    await userEvent.click(screen.getByRole("button", { name: "Quitter la séance" }));
    expect(screen.getByText("Quitter la séance ?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Quitter et reprendre plus tard" }));
    expect(push).toHaveBeenCalledWith("/");
  });

  it("closing the quit sheet via Continuer la séance keeps the player open", async () => {
    const state: PlayerState = {
      phase: "in-progress",
      seanceId: 1,
      startedAt: STARTED_AT,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
      skippedExerciseOrders: [],
    };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);

    await userEvent.click(screen.getByRole("button", { name: "Quitter la séance" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuer la séance" }));

    expect(screen.queryByText("Quitter la séance ?")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("renders SummaryView for pending-validation and calls onSeanceFinish on Terminer", async () => {
    const state: PlayerState = { phase: "pending-validation", seanceId: 1, startedAt: STARTED_AT };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);

    await userEvent.click(screen.getByRole("button", { name: "Terminer" }));

    expect(onSeanceFinish).toHaveBeenCalledWith(1);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows a simple message for an already-completed seance", () => {
    const state: PlayerState = { phase: "completed", seanceId: 1 };
    render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);
    expect(screen.getByText("Séance déjà validée.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Update `src/components/player/SummaryView.tsx`**

```tsx
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { formatClock } from "@/lib/player/formatClock";
import type { Accent } from "@/components/Pastille";
import type { Exercise } from "@/lib/workout/types";
import type { SetLoggedRecord } from "@/lib/player/db";

export function SummaryView({
  exercises,
  setsLogged,
  durationSeconds,
  accent = "cobalt",
  onFinish,
}: {
  exercises: Exercise[];
  setsLogged: SetLoggedRecord[];
  durationSeconds: number;
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

  return (
    <div className="min-h-dvh flex flex-col bg-canvas">
      <div className="flex-1 overflow-y-auto px-5 pt-10 pb-6">
        <h1 className="font-archivo text-44 font-semibold">Séance terminée</h1>

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
            .map((exercise, exerciseOrder) => ({ exercise, reps: repsByExercise.get(exerciseOrder) }))
            .filter((row): row is { exercise: Exercise; reps: number } => row.reps !== undefined)
            .map((row, i) => (
              <div
                key={row.exercise.id}
                className={`flex justify-between items-center gap-4 px-5 py-3.5 border-hairline ${i > 0 ? "border-t" : ""}`}
              >
                <span className="text-15">{row.exercise.name}</span>
                <span className="font-archivo text-18 font-semibold tabular-nums flex-none">+{row.reps} reps</span>
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

- [ ] **Step 4: Update `src/components/player/SummaryView.test.tsx`**

Only addition: one new test for the `accent` prop; all 3 existing tests unchanged.

```tsx
// Append to the existing describe block, after the 3 current tests:
  it("uses the sage accent on the Terminer button when accent='sage'", () => {
    render(
      <SummaryView exercises={EXERCISES} setsLogged={[]} durationSeconds={0} accent="sage" onFinish={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Terminer" })).toHaveClass("bg-sage");
  });
```

(Full existing file content stays, this test is appended before the closing `});`.)

- [ ] **Step 5: Update `src/components/today/ResumeBanner.tsx`**

```tsx
import Link from "next/link";
import { ACCENT_BORDER, type Accent } from "@/components/Pastille";

const ACCENT_TEXT: Record<Accent, string> = {
  cobalt: "text-cobalt",
  sage: "text-sage",
  brass: "text-brass",
};

export function ResumeBanner({
  exerciseName,
  href,
  accent = "cobalt",
}: {
  exerciseName: string;
  href: string;
  accent?: Accent;
}) {
  return (
    <Link
      href={href}
      className={`w-full text-left bg-paper border ${ACCENT_BORDER[accent]} rounded-card p-4 flex items-center justify-between gap-4`}
    >
      <span>
        <span className={`block font-archivo text-11 font-medium uppercase tracking-[0.08em] ${ACCENT_TEXT[accent]}`}>
          Séance interrompue
        </span>
        <span className="block text-15 mt-1.5">Reprendre à {exerciseName}</span>
      </span>
      <span className={`font-archivo text-24 ${ACCENT_TEXT[accent]} flex-none`}>→</span>
    </Link>
  );
}
```

- [ ] **Step 6: Update `src/components/today/ResumeBanner.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumeBanner } from "./ResumeBanner";

describe("ResumeBanner", () => {
  it("shows the resume label and links to the player at the given href", () => {
    render(<ResumeBanner exerciseName="Push ups" href="/player?parcours=beginner&level=0&day=0" />);
    expect(screen.getByText("Séance interrompue")).toBeInTheDocument();
    expect(screen.getByText("Reprendre à Push ups")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/player?parcours=beginner&level=0&day=0");
  });

  it("uses the sage accent border when accent='sage'", () => {
    render(<ResumeBanner exerciseName="Hip hinge" href="/player/dos" accent="sage" />);
    expect(screen.getByRole("link")).toHaveClass("border-sage");
  });
});
```

- [ ] **Step 7: Update `src/components/player/RepsSheet.tsx`**

```tsx
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
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  initialValue: number;
  accent?: Accent;
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
      <Button variant="primary" accent={accent} onClick={() => onConfirm(value)}>
        Valider
      </Button>
    </Sheet>
  );
}
```

- [ ] **Step 8: Add one test to `src/components/player/RepsSheet.test.tsx`**

Append, preserving the 4 existing tests unchanged:

```tsx
  it("uses the sage accent on the Valider button when accent='sage'", () => {
    render(<RepsSheet open onClose={() => {}} initialValue={12} accent="sage" onConfirm={() => {}} />);
    expect(screen.getByRole("button", { name: "Valider" })).toHaveClass("bg-sage");
  });
```

- [ ] **Step 9: Update `src/components/player/ExerciseView.tsx`** — forward `accent` to `RepsSheet`

Only the `<RepsSheet .../>` call at the bottom changes (add `accent={accent}`); everything else in the file is unchanged:

```tsx
      <RepsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialValue={targetDefaultReps(exercise)}
        accent={accent}
        onConfirm={(value) => {
          setSheetOpen(false);
          onCompleteSet(value);
        }}
      />
```

`ExerciseView.test.tsx` needs no change — none of its existing tests assert on `RepsSheet`'s button color, and the default (`accent="cobalt"`) keeps every current assertion passing.

- [ ] **Step 10: Update `src/app/player/page.tsx`** to pass the now-required `onLogSet`/`onSkipExercise`/`onSeanceFinish`

```tsx
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { loadPlayerState } from "@/lib/player/loadPlayerState";
import { getSetsForSeance } from "@/lib/player/db";
import { logSetAction, skipExerciseAction, completeSeanceAction } from "@/lib/player/actions";
import { beginner, intermediate, advanced } from "@/lib/workout/data";
import type { Program } from "@/lib/workout/types";
import { PlayerScreen } from "@/components/player/PlayerScreen";

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

  return (
    <PlayerScreen
      day={day}
      state={state}
      setsLogged={setsLogged}
      onLogSet={logSetAction}
      onSkipExercise={skipExerciseAction}
      onSeanceFinish={completeSeanceAction}
    />
  );
}
```

- [ ] **Step 11: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass, including the modified `PlayerScreen.test.tsx`/`SummaryView.test.tsx`/`RepsSheet.test.tsx`/`ResumeBanner.test.tsx`.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add src/components/player/PlayerScreen.tsx src/components/player/PlayerScreen.test.tsx \
        src/components/player/SummaryView.tsx src/components/player/SummaryView.test.tsx \
        src/components/player/RepsSheet.tsx src/components/player/RepsSheet.test.tsx \
        src/components/player/ExerciseView.tsx \
        src/components/today/ResumeBanner.tsx src/components/today/ResumeBanner.test.tsx \
        src/app/player/page.tsx
git commit -m "refactor(player): parametrize accent, rest durations, and completion hook for reuse"
```

---

### Task 9: `loadDosPlayerState.ts` (with the mandatory persistence integration test)

**Files:**
- Create: `src/lib/dos/loadDosPlayerState.ts`
- Test: `src/lib/dos/loadDosPlayerState.test.ts`

**Interfaces:**
- Consumes: `getOrStartDosSeance`, `getSetsForDosSeance`, `getSkippedDosExercises` (Task 5), `deriveState` (`src/lib/player/deriveState.ts`, phase 2 — reused unmodified, its `SetLoggedRow` shape (`{exerciseOrder, setNumber}`) is a strict subset of `DosSetLoggedRecord`, so it's called with Dos rows directly, no adapter needed here).
- Produces: `type DosPlayerState` — same shape as `PlayerState` (`src/lib/player/loadPlayerState.ts`) so it satisfies `PlayerScreen`'s `state` prop by structural typing, no import change needed there. `loadDosPlayerState(db, date, jourSemaine, semaine, day): DosPlayerState`. Consumed by `/player/dos/page.tsx` (Task 10).

This is the module CLAUDE.md §7 calls out — the test at Step 5 below is the mandatory "log → navigate away → come back → state intact" check for the Dos axis, same discipline as phase 2/3.

```typescript
// src/lib/dos/loadDosPlayerState.ts
import type Database from "better-sqlite3";
import type { TrainDay } from "@/lib/workout/types";
import { deriveState, type NextSet } from "@/lib/player/deriveState";
import { getOrStartDosSeance, getSetsForDosSeance, getSkippedDosExercises } from "./db";

export type DosPlayerState =
  | {
      phase: "in-progress";
      seanceId: number;
      startedAt: string;
      next: NextSet;
      skippedExerciseOrders: number[];
    }
  | { phase: "pending-validation"; seanceId: number; startedAt: string }
  | { phase: "completed"; seanceId: number };

export function loadDosPlayerState(
  db: Database.Database,
  date: string,
  jourSemaine: string,
  semaine: number,
  day: TrainDay,
): DosPlayerState {
  const seance = getOrStartDosSeance(db, date, jourSemaine, semaine);

  if (seance.completedAt) {
    return { phase: "completed", seanceId: seance.id };
  }

  const sets = getSetsForDosSeance(db, seance.id);
  const skippedExerciseOrders = getSkippedDosExercises(db, seance.id);
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

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dos/loadDosPlayerState.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { loadDosPlayerState } from "./loadDosPlayerState";
import { logDosSet, skipDosExercise, completeDosSeance, getOrStartDosSeance } from "./db";
import type { TrainDay } from "@/lib/workout/types";

const DAY: TrainDay = {
  kind: "train",
  label: "lundi",
  exercises: [
    { id: "lundi-hip-hinge-echauffement", name: "Hip hinge au bâton", movementFamily: "dos-fixe", countsInStats: false, videoId: null, sets: 1, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
    { id: "A-1", name: "Hip hinge au bâton", movementFamily: "arbre-A", countsInStats: true, videoId: null, sets: 1, target: { unit: "reps", value: [8, 10], maxEffort: false, eachSide: false } },
  ],
};

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-dos-player-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadDosPlayerState", () => {
  it("starts a seance and returns in-progress at the first exercise", () => {
    const db = setup();
    const state = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    expect(state.phase).toBe("in-progress");
    if (state.phase !== "in-progress") throw new Error("unreachable");
    expect(state.next).toEqual({ exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false });
  });

  it("reports pending-validation once every set is logged", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 0, setNumber: 1, valeurTarget: "10", valeurActual: 10, restSeconds: 90 });
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 1, setNumber: 1, valeurTarget: "8-10", valeurActual: 9, restSeconds: 90 });
    const state = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    expect(state.phase).toBe("pending-validation");
  });

  it("reports completed after completeDosSeance", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    completeDosSeance(db, seance.id, 1);
    const state = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    expect(state).toEqual({ phase: "completed", seanceId: seance.id });
  });

  it("skips a wholesale-skipped exercise when computing next", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    skipDosExercise(db, seance.id, 0);
    const state = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    if (state.phase !== "in-progress") throw new Error("unreachable");
    expect(state.next.exerciseOrder).toBe(1);
  });

  // Mandatory persistence check (CLAUDE.md §7): log a set, simulate
  // "navigate away and come back" by reading state fresh from the DB with a
  // brand new call — the state must be read, never reconstructed.
  it("survives a full reload: a logged set is reflected on a fresh loadDosPlayerState call", () => {
    const db = setup();
    const first = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    if (first.phase !== "in-progress") throw new Error("unreachable");

    logDosSet(db, {
      seanceId: first.seanceId, exerciseOrder: 0, setNumber: 1,
      valeurTarget: "10", valeurActual: 10, restSeconds: 90,
    });

    // Fresh call, no shared in-memory state — the only way this can see the
    // logged set is by reading it from the DB.
    const second = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    if (second.phase !== "in-progress") throw new Error("unreachable");
    expect(second.next.exerciseOrder).toBe(1);
    expect(second.seanceId).toBe(first.seanceId);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dos/loadDosPlayerState.test.ts`
Expected: FAIL — `loadDosPlayerState.ts` does not exist.

- [ ] **Step 3: Create `src/lib/dos/loadDosPlayerState.ts`**

(Full content above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dos/loadDosPlayerState.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dos/loadDosPlayerState.ts src/lib/dos/loadDosPlayerState.test.ts
git commit -m "feat(dos): add loadDosPlayerState with the mandatory persistence check"
```

---

### Task 10: `/player/dos/page.tsx` — Dos player route

**Files:**
- Create: `src/app/player/dos/page.tsx`

**Interfaces:**
- Consumes: `getJourSemaine`, `getDosRestSeconds` (Task 3), `buildDosDay`, `ARBRES_DU_JOUR` (Task 4), `getStartDate`, `computeWeek`, `computeBlock`, `getEvaluations`, `getCurrentCran` (4a), `loadDosPlayerState` (Task 9), `toPlayerSetsLogged`, `getSetsForDosSeance` (Task 5), `logDosSetAction`, `skipDosExerciseAction`, `startDosBilanAction` (Task 7), `PlayerScreen` (Task 8).
- Produces: route `/player/dos`, no query params (always "today").

No test file — this is a thin Server Component wiring existing tested pieces together, same convention as `/player/page.tsx` and `/app/(shell)/page.tsx` (neither has a dedicated test; their logic lives in the modules they call).

- [ ] **Step 1: Create `src/app/player/dos/page.tsx`**

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

  return (
    <PlayerScreen
      day={day}
      state={state}
      setsLogged={setsLogged}
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

- [ ] **Step 2: Verify it compiles and the route responds**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npm run db:migrate && npm run dev` (one terminal), then in another, after setting a start date via the DB directly for a manual smoke check (`sqlite3 data/sportcompanion.db "INSERT INTO dos_start_date (id, start_date, set_at) VALUES (1, '2026-08-10', datetime('now'))"` if not already set):
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/player/dos"
```
Expected: `200`. Stop the dev server after.

- [ ] **Step 3: Commit**

```bash
git add src/app/player/dos/page.tsx
git commit -m "feat(dos): wire the /player/dos route"
```

---

### Task 11: `BilanDos` component

**Files:**
- Create: `src/components/dos/BilanDos.tsx`
- Test: `src/components/dos/BilanDos.test.tsx`

**Interfaces:**
- Consumes: `Sheet` or plain full-screen layout (Fondations), `Button`, `type Reserve` (Task 6).
- Produces: `BilanDos` — props `{ arbres: { arbre: ArbreId; nom: string }[]; onValidate: (reserves: Partial<Record<ArbreId, Reserve>>, genePendant: number) => void }`. Consumed by `/player/dos/bilan/page.tsx` (Task 12).

One screen: a reserve-selector (6 buttons) per arbre worked, then a gêne selector (0-10, 11 buttons or a stepper — reusing the RepsSheet stepper pattern for the 0-10 range keeps it consistent with the existing player UI), then "Valider la séance".

```tsx
// src/components/dos/BilanDos.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import type { ArbreId } from "@/lib/backpain/arbres";
import type { Reserve } from "@/lib/dos/bilan";

const RESERVE_OPTIONS: { value: Reserve; label: string }[] = [
  { value: 0, label: "0" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5 ou +" },
];

export function BilanDos({
  arbres,
  onValidate,
}: {
  arbres: { arbre: ArbreId; nom: string }[];
  onValidate: (reserves: Partial<Record<ArbreId, Reserve>>, genePendant: number) => void;
}) {
  const [reserves, setReserves] = useState<Partial<Record<ArbreId, Reserve>>>({});
  const [genePendant, setGenePendant] = useState(0);

  const allAnswered = arbres.every((a) => reserves[a.arbre] !== undefined);

  return (
    <div className="min-h-dvh flex flex-col bg-canvas">
      <div className="flex-1 overflow-y-auto px-5 pt-10 pb-6">
        <h1 className="font-archivo text-32 font-semibold">Bilan de séance</h1>
        <p className="text-15 text-graphite mt-2">Combien de répétitions te restait-il en réserve, à la dernière série ?</p>

        <div className="flex flex-col gap-5 mt-6">
          {arbres.map((a) => (
            <Card key={a.arbre} className="p-4">
              <div className="text-15 font-medium">{a.nom}</div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {RESERVE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReserves((r) => ({ ...r, [a.arbre]: option.value }))}
                    className={`h-11 px-4 rounded-pill border font-archivo text-15 font-semibold ${
                      reserves[a.arbre] === option.value
                        ? "bg-sage text-paper border-sage"
                        : "bg-paper border-hairline text-ink"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <div className="text-15 font-medium">Gêne pendant la séance</div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <Button variant="secondary" onClick={() => setGenePendant((g) => Math.max(0, g - 1))}>
              −
            </Button>
            <span className="font-archivo text-44 font-semibold tabular-nums w-16 text-center">{genePendant}</span>
            <Button variant="secondary" onClick={() => setGenePendant((g) => Math.min(10, g + 1))}>
              +
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-none px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-paper border-t border-hairline shadow-[0_-12px_24px_rgba(17,19,16,0.04)]">
        <Button variant="primary" accent="sage" disabled={!allAnswered} onClick={() => onValidate(reserves, genePendant)}>
          Valider la séance
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/dos/BilanDos.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BilanDos } from "./BilanDos";

const ARBRES = [
  { arbre: "A" as const, nom: "Nordic curl excentrique assisté" },
  { arbre: "B" as const, nom: "Pont fessier bilatéral" },
];

describe("BilanDos", () => {
  it("disables Valider until every arbre has a reserve answer", async () => {
    const onValidate = vi.fn();
    render(<BilanDos arbres={ARBRES} onValidate={onValidate} />);
    expect(screen.getByRole("button", { name: "Valider la séance" })).toBeDisabled();

    await userEvent.click(screen.getAllByRole("button", { name: "0" })[0]!);
    expect(screen.getByRole("button", { name: "Valider la séance" })).toBeDisabled();

    await userEvent.click(screen.getAllByRole("button", { name: "3" })[1]!);
    expect(screen.getByRole("button", { name: "Valider la séance" })).not.toBeDisabled();
  });

  it("calls onValidate with the chosen reserves and gêne", async () => {
    const onValidate = vi.fn();
    render(<BilanDos arbres={ARBRES} onValidate={onValidate} />);

    const zeroButtons = screen.getAllByRole("button", { name: "0" });
    await userEvent.click(zeroButtons[0]!); // A → 0
    const fiveOrMoreButtons = screen.getAllByRole("button", { name: "5 ou +" });
    await userEvent.click(fiveOrMoreButtons[1]!); // B → 5

    const plusButtons = screen.getAllByRole("button", { name: "+" });
    await userEvent.click(plusButtons[0]!);
    await userEvent.click(plusButtons[0]!);

    await userEvent.click(screen.getByRole("button", { name: "Valider la séance" }));

    expect(onValidate).toHaveBeenCalledWith({ A: 0, B: 5 }, 2);
  });

  it("shows all 6 reserve options per arbre", () => {
    render(<BilanDos arbres={[ARBRES[0]!]} onValidate={() => {}} />);
    for (const label of ["0", "1", "2", "3", "4", "5 ou +"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/dos/BilanDos.test.tsx`
Expected: FAIL — `BilanDos.tsx` does not exist.

- [ ] **Step 3: Create `src/components/dos/BilanDos.tsx`**

(Full content above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/dos/BilanDos.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/dos/BilanDos.tsx src/components/dos/BilanDos.test.tsx
git commit -m "feat(dos): add BilanDos (reserve + gêne capture)"
```

---

### Task 12: `/player/dos/bilan/page.tsx` — Bilan route

**Files:**
- Create: `src/app/player/dos/bilan/page.tsx`

**Interfaces:**
- Consumes: `getDosSeanceById` (Task 5), `ARBRES`, `ARBRES_DU_JOUR` (Task 4), `getEvaluations`, `getCurrentCran` (4a), `completeDosSeanceAction` (Task 7), `BilanDosClient` (this task, Step 2).
- Produces: route `/player/dos/bilan?seanceId=`.

No test file — thin Server Component wiring, same convention as Task 10.

- [ ] **Step 1: Create `src/app/player/dos/bilan/page.tsx`**

```tsx
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { getEvaluations } from "@/lib/backpain/db";
import { getCurrentCran } from "@/lib/backpain/progression";
import { ARBRES } from "@/lib/backpain/arbres";
import { getDosSeanceById } from "@/lib/dos/db";
import { ARBRES_DU_JOUR } from "@/lib/dos/buildDosDay";
import { completeDosSeanceAction } from "@/lib/dos/actions";
import { BilanDosClient } from "@/components/dos/BilanDosClient";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default async function DosBilanPage({
  searchParams,
}: {
  searchParams: Promise<{ seanceId?: string }>;
}) {
  const params = await searchParams;
  const seanceId = Number(params.seanceId);
  const db = getDb(dbPath());
  const seance = getDosSeanceById(db, seanceId);

  if (!seance) {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Séance introuvable.</p>
      </main>
    );
  }

  const jourArbres = ARBRES_DU_JOUR[seance.jourSemaine as keyof typeof ARBRES_DU_JOUR] ?? [];
  const evaluations = getEvaluations(db);
  const arbres = jourArbres.map((arbre) => {
    const cran = getCurrentCran(evaluations, arbre);
    return { arbre, nom: ARBRES[arbre].crans[cran - 1]!.nom };
  });

  return <BilanDosClient seanceId={seanceId} arbres={arbres} completeAction={completeDosSeanceAction} />;
}
```

`completeDosSeanceAction` is a Server Action, which Next.js allows to be passed directly from a Server Component to a Client Component as a prop — a thin `BilanDosClient` wrapper is needed only because `BilanDos` itself is `"use client"` and needs to call the action with the extra `seanceId` bound in.

- [ ] **Step 2: Create `src/components/dos/BilanDosClient.tsx`**

**Files:**
- Create: `src/components/dos/BilanDosClient.tsx`
- Test: `src/components/dos/BilanDosClient.test.tsx`

```tsx
// src/components/dos/BilanDosClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BilanDos } from "./BilanDos";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { ArbreId } from "@/lib/backpain/arbres";
import type { Reserve } from "@/lib/dos/bilan";

type Result = { arbre: ArbreId; nom: string; message: string };

export function BilanDosClient({
  seanceId,
  arbres,
  completeAction,
}: {
  seanceId: number;
  arbres: { arbre: ArbreId; nom: string }[];
  completeAction: (
    seanceId: number,
    genePendant: number,
    reserves: Partial<Record<ArbreId, Reserve>>,
  ) => Promise<Result[]>;
}) {
  const router = useRouter();
  const [results, setResults] = useState<Result[] | null>(null);

  if (results) {
    return (
      <div className="min-h-dvh flex flex-col bg-canvas">
        <div className="flex-1 overflow-y-auto px-5 pt-10 pb-6">
          <h1 className="font-archivo text-32 font-semibold">Résultat</h1>
          <div className="flex flex-col gap-3 mt-6">
            {results.map((r) => (
              <Card key={r.arbre} className="p-4">
                <div className="text-15 font-medium">{r.nom}</div>
                <div className="text-15 text-graphite mt-1">{r.message}</div>
              </Card>
            ))}
          </div>
        </div>
        <div className="flex-none px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-paper border-t border-hairline shadow-[0_-12px_24px_rgba(17,19,16,0.04)]">
          <Button variant="primary" accent="sage" onClick={() => router.push("/")}>
            Terminer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <BilanDos
      arbres={arbres}
      onValidate={async (reserves, genePendant) => {
        const outcome = await completeAction(seanceId, genePendant, reserves);
        setResults(outcome);
      }}
    />
  );
}
```

- [ ] **Step 3: Write the failing test for `BilanDosClient`**

```tsx
// src/components/dos/BilanDosClient.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BilanDosClient } from "./BilanDosClient";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("BilanDosClient", () => {
  it("binds seanceId, forwards reserves/gêne to completeAction, then shows the results", async () => {
    const completeAction = vi.fn().mockResolvedValue([
      { arbre: "A", nom: "Charnière & ischios", message: "Cran suivant débloqué : Good morning élastique" },
    ]);
    render(
      <BilanDosClient
        seanceId={42}
        arbres={[{ arbre: "A", nom: "Hip hinge au bâton" }]}
        completeAction={completeAction}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "0" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider la séance" }));

    expect(completeAction).toHaveBeenCalledWith(42, 0, { A: 0 });
    expect(await screen.findByText("Cran suivant débloqué : Good morning élastique")).toBeInTheDocument();
  });

  it("navigates home when Terminer is pressed on the results view", async () => {
    const completeAction = vi.fn().mockResolvedValue([
      { arbre: "A", nom: "Charnière & ischios", message: "Rester à ce cran. Viser le haut de la fourchette au RPE cible." },
    ]);
    render(
      <BilanDosClient
        seanceId={42}
        arbres={[{ arbre: "A", nom: "Hip hinge au bâton" }]}
        completeAction={completeAction}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "0" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider la séance" }));
    await userEvent.click(await screen.findByRole("button", { name: "Terminer" }));

    expect(push).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 4: Run test to verify it fails, then passes**

Run: `npx vitest run src/components/dos/BilanDosClient.test.tsx`
Expected: FAIL, then PASS (2 tests) after Step 2's file is created.

- [ ] **Step 5: Verify the route compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/player/dos/bilan/page.tsx src/components/dos/BilanDosClient.tsx src/components/dos/BilanDosClient.test.tsx
git commit -m "feat(dos): wire the /player/dos/bilan route"
```

---

### Task 13: `loadDosTodayState.ts` — state for Aujourd'hui

**Files:**
- Create: `src/lib/dos/loadDosTodayState.ts`
- Test: `src/lib/dos/loadDosTodayState.test.ts`

**Interfaces:**
- Consumes: `getStartDate`, `computeWeek`, `computeBlock` (4a), `getJourSemaine` (Task 3), `buildDosDay`, `ARBRES_DU_JOUR` (Task 4), `getDosSeanceByDate`, `getSetsForDosSeance`, `getSkippedDosExercises` (Task 5), `deriveState` (phase 2), `getEvaluations`, `getCurrentCran` (4a).
- Produces: `type DosTodayState = { phase: "no-start-date" } | { phase: "rest" } | { phase: "normal"; jourLabel: string; intitule: string; exercisesPreview: { name: string; dose: string }[]; exercisesRestCount: number; done: boolean; doneReps: number | null; resume: { exerciseName: string } | null }`, `loadDosTodayState(db): DosTodayState`. Consumed by `AujourdhuiScreen.tsx` (Task 15).

`intitule` (§5's "Intitulé" column, e.g. "Charnière & chaîne postérieure") — a small lookup table, not derived.

```typescript
// src/lib/dos/loadDosTodayState.ts
import type Database from "better-sqlite3";
import { getStartDate, getEvaluations } from "@/lib/backpain/db";
import { computeWeek, computeBlock } from "@/lib/backpain/periode";
import { getCurrentCran } from "@/lib/backpain/progression";
import type { ArbreId } from "@/lib/backpain/arbres";
import { getJourSemaine } from "./schedule";
import { buildDosDay, ARBRES_DU_JOUR } from "./buildDosDay";
import { getDosSeanceByDate, getSetsForDosSeance, getSkippedDosExercises } from "./db";
import { deriveState } from "@/lib/player/deriveState";
import { formatTarget } from "@/lib/player/formatTarget";

const INTITULES: Record<keyof typeof ARBRES_DU_JOUR, string> = {
  lundi: "Charnière & chaîne postérieure",
  mardi: "Contrôle moteur & dissociation",
  mercredi: "Genou & unilatéral",
  jeudi: "Tirage",
  vendredi: "Fessiers, latéral & portés",
  samedi: "Poussée & core suspendu",
};

export type DosTodayState =
  | { phase: "no-start-date" }
  | { phase: "rest" }
  | {
      phase: "normal";
      jourLabel: string;
      intitule: string;
      exercisesPreview: { name: string; dose: string }[];
      exercisesRestCount: number;
      done: boolean;
      doneReps: number | null;
      resume: { exerciseName: string } | null;
    };

export function loadDosTodayState(db: Database.Database): DosTodayState {
  const startDate = getStartDate(db);
  if (!startDate) return { phase: "no-start-date" };

  const today = new Date().toISOString().slice(0, 10);
  const jourSemaine = getJourSemaine(today);
  if (jourSemaine === "dimanche") return { phase: "rest" };

  const semaine = computeWeek(startDate, today);
  const bloc = computeBlock(semaine);
  const evaluations = getEvaluations(db);
  const cranCourant = {} as Record<ArbreId, number>;
  for (const arbre of ARBRES_DU_JOUR[jourSemaine]) {
    cranCourant[arbre] = getCurrentCran(evaluations, arbre);
  }
  const day = buildDosDay(jourSemaine, bloc, cranCourant);

  const seance = getDosSeanceByDate(db, today);
  let done = false;
  let doneReps: number | null = null;
  let resume: { exerciseName: string } | null = null;

  if (seance) {
    const sets = getSetsForDosSeance(db, seance.id);
    const skipped = getSkippedDosExercises(db, seance.id);
    if (seance.completedAt) {
      done = true;
      doneReps = sets.reduce((sum, s) => sum + s.valeurActual, 0);
    } else {
      const progress = deriveState(day, sets, new Set(skipped));
      if (!progress.allSetsDone) {
        resume = { exerciseName: day.exercises[progress.next.exerciseOrder]!.name };
      }
    }
  }

  return {
    phase: "normal",
    jourLabel: jourSemaine[0]!.toUpperCase() + jourSemaine.slice(1),
    intitule: INTITULES[jourSemaine],
    exercisesPreview: day.exercises.slice(0, 3).map((e) => ({ name: e.name, dose: formatTarget(e.sets, e.target) })),
    exercisesRestCount: Math.max(0, day.exercises.length - 3),
    done,
    doneReps,
    resume,
  };
}
```

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dos/loadDosTodayState.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { loadDosTodayState } from "./loadDosTodayState";
import { setStartDate } from "@/lib/backpain/db";
import { getOrStartDosSeance, logDosSet, completeDosSeance } from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  vi.useRealTimers();
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-dos-today-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

function freezeToMonday() {
  // 2026-08-17 is a Monday.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-17T09:00:00.000Z"));
}

describe("loadDosTodayState", () => {
  it("reports no-start-date before setup", () => {
    const db = setup();
    expect(loadDosTodayState(db)).toEqual({ phase: "no-start-date" });
  });

  it("reports rest on Sunday", () => {
    const db = setup();
    setStartDate(db, "2026-08-10");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T09:00:00.000Z")); // Sunday
    expect(loadDosTodayState(db)).toEqual({ phase: "rest" });
  });

  it("reports normal with the right intitulé and a 3-exercise preview on Monday", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    freezeToMonday();
    const state = loadDosTodayState(db);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.jourLabel).toBe("Lundi");
    expect(state.intitule).toBe("Charnière & chaîne postérieure");
    expect(state.exercisesPreview).toHaveLength(3);
    expect(state.done).toBe(false);
    expect(state.resume).toBeNull();
  });

  it("surfaces a resume when a seance is in progress", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    freezeToMonday();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 0, setNumber: 1, valeurTarget: "10", valeurActual: 10, restSeconds: 90 });
    const state = loadDosTodayState(db);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.resume).not.toBeNull();
  });

  it("reports done with total reps once the seance is completed", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    freezeToMonday();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 0, setNumber: 1, valeurTarget: "10", valeurActual: 10, restSeconds: 90 });
    completeDosSeance(db, seance.id, 1);
    const state = loadDosTodayState(db);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.done).toBe(true);
    expect(state.doneReps).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dos/loadDosTodayState.test.ts`
Expected: FAIL — `loadDosTodayState.ts` does not exist.

- [ ] **Step 3: Create `src/lib/dos/loadDosTodayState.ts`**

(Full content above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dos/loadDosTodayState.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dos/loadDosTodayState.ts src/lib/dos/loadDosTodayState.test.ts
git commit -m "feat(dos): add loadDosTodayState"
```

---

### Task 14: `BackPainCard` component

**Files:**
- Create: `src/components/today/BackPainCard.tsx`
- Test: `src/components/today/BackPainCard.test.tsx`

**Interfaces:**
- Consumes: `Card` (Fondations), `IconCheck` (Fondations).
- Produces: `BackPainCard` — props `{ jourLabel: string; intitule: string; exercisesPreview: { name: string; dose: string }[]; exercisesRestCount: number; done: boolean; doneReps: number | null; href: string }`. Consumed by `AujourdhuiScreen.tsx` (Task 15).

Same structure as `ProgrammeCard` (Task 10, phase 3), sauge accent, no pastille row (that's `/dos`'s job per the design spec).

```tsx
// src/components/today/BackPainCard.tsx
import Link from "next/link";
import { Card } from "@/components/Card";
import { IconCheck } from "@/components/icons/IconCheck";

export function BackPainCard({
  jourLabel,
  intitule,
  exercisesPreview,
  exercisesRestCount,
  done,
  doneReps,
  href,
}: {
  jourLabel: string;
  intitule: string;
  exercisesPreview: { name: string; dose: string }[];
  exercisesRestCount: number;
  done: boolean;
  doneReps: number | null;
  href: string;
}) {
  return (
    <Card className="p-5">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>

      <div className="font-archivo text-24 font-semibold mt-3.5">
        {jourLabel} · {intitule}
      </div>

      {exercisesPreview.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-5">
          {exercisesPreview.map((e) => (
            <div key={e.name} className="flex items-baseline justify-between gap-4">
              <span className="text-15">{e.name}</span>
              <span className="font-archivo text-15 font-medium text-graphite tabular-nums whitespace-nowrap">
                {e.dose}
              </span>
            </div>
          ))}
          {exercisesRestCount > 0 && (
            <div className="text-13 text-graphite">
              {exercisesRestCount === 1 ? "et 1 autre" : `et ${exercisesRestCount} autres`}
            </div>
          )}
        </div>
      )}

      {done ? (
        <>
          <div className="flex items-center gap-4 mt-5 pt-5 border-t border-hairline">
            <span className="w-9 h-9 rounded-pill bg-sage text-paper flex items-center justify-center flex-none">
              <IconCheck size={16} />
            </span>
            <span>
              <span className="block font-archivo text-18 font-semibold tabular-nums">
                {doneReps ?? 0} répétitions
              </span>
              <span className="block text-13 text-graphite mt-0.5">Séance terminée</span>
            </span>
          </div>
          <Link
            href={href}
            className="mt-5 h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold"
          >
            Revoir la séance
          </Link>
        </>
      ) : (
        <Link
          href={href}
          className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Commencer
        </Link>
      )}
    </Card>
  );
}
```

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/today/BackPainCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackPainCard } from "./BackPainCard";

describe("BackPainCard", () => {
  it("shows the day, intitulé, and exercise preview", () => {
    render(
      <BackPainCard
        jourLabel="Lundi"
        intitule="Charnière & chaîne postérieure"
        exercisesPreview={[{ name: "Hip hinge au bâton", dose: "2 × 10" }]}
        exercisesRestCount={2}
        done={false}
        doneReps={null}
        href="/player/dos"
      />,
    );
    expect(screen.getByText("Lundi · Charnière & chaîne postérieure")).toBeInTheDocument();
    expect(screen.getByText("Hip hinge au bâton")).toBeInTheDocument();
    expect(screen.getByText("et 2 autres")).toBeInTheDocument();
    expect(screen.getByText("Commencer")).toBeInTheDocument();
  });

  it("shows the accomplished state with total reps and Revoir la séance", () => {
    render(
      <BackPainCard
        jourLabel="Lundi"
        intitule="Charnière & chaîne postérieure"
        exercisesPreview={[]}
        exercisesRestCount={0}
        done={true}
        doneReps={42}
        href="/player/dos"
      />,
    );
    expect(screen.getByText("42 répétitions")).toBeInTheDocument();
    expect(screen.getByText("Revoir la séance")).toBeInTheDocument();
    expect(screen.queryByText("Commencer")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/today/BackPainCard.test.tsx`
Expected: FAIL — `BackPainCard.tsx` does not exist.

- [ ] **Step 3: Create `src/components/today/BackPainCard.tsx`**

(Full content above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/today/BackPainCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/today/BackPainCard.tsx src/components/today/BackPainCard.test.tsx
git commit -m "feat(dos): add BackPainCard for Aujourd'hui"
```

---

### Task 15: Wire `AujourdhuiScreen` and `(shell)/page.tsx` for Dos

**Files:**
- Modify: `src/components/today/AujourdhuiScreen.tsx`, `src/components/today/AujourdhuiScreen.test.tsx`
- Modify: `src/app/(shell)/page.tsx`

**Interfaces:**
- Consumes: `DosTodayState` (Task 13), `BackPainCard` (Task 14), `ResumeBanner` with `accent` (Task 8).
- Produces: `AujourdhuiScreen` gains a `dosState: DosTodayState` prop, replaces the phase-3 stub card with real `BackPainCard`/rest/no-start-date states, and can show a second `ResumeBanner` (sage) if a Dos seance is interrupted while a Programme seance is not.

- [ ] **Step 1: Update `src/app/(shell)/page.tsx`**

```tsx
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { loadTodayState } from "@/lib/programme/loadTodayState";
import { loadDosTodayState } from "@/lib/dos/loadDosTodayState";
import { PARCOURS } from "@/lib/programme/parcours";
import { AujourdhuiScreen } from "@/components/today/AujourdhuiScreen";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default async function TodayPage() {
  const db = getDb(dbPath());
  const state = loadTodayState(db, PARCOURS);
  const dosState = loadDosTodayState(db);
  return <AujourdhuiScreen state={state} dosState={dosState} />;
}
```

- [ ] **Step 2: Update `src/components/today/AujourdhuiScreen.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { ResumeBanner } from "./ResumeBanner";
import { ProgrammeCard } from "./ProgrammeCard";
import { LevelUpPrompt } from "./LevelUpPrompt";
import { BackPainCard } from "./BackPainCard";
import { SetupFlow } from "@/components/setup/SetupFlow";
import type { TodayState } from "@/lib/programme/loadTodayState";
import type { DosTodayState } from "@/lib/dos/loadDosTodayState";

function playerHref(parcours: string, level: number, dayIndex: number): string {
  return `/player?parcours=${parcours}&level=${level}&day=${dayIndex}`;
}

function DosCard({ dosState }: { dosState: DosTodayState }) {
  if (dosState.phase === "no-start-date") {
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>
        <div className="font-archivo text-18 font-semibold mt-3">Définis ta date de départ pour commencer.</div>
        <a href="/dos" className="mt-4 h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold">
          Aller sur Dos
        </a>
      </Card>
    );
  }

  if (dosState.phase === "rest") {
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>
        <div className="font-archivo text-18 font-semibold mt-3">Repos</div>
      </Card>
    );
  }

  return (
    <BackPainCard
      jourLabel={dosState.jourLabel}
      intitule={dosState.intitule}
      exercisesPreview={dosState.exercisesPreview}
      exercisesRestCount={dosState.exercisesRestCount}
      done={dosState.done}
      doneReps={dosState.doneReps}
      href="/player/dos"
    />
  );
}

export function AujourdhuiScreen({ state, dosState }: { state: TodayState; dosState: DosTodayState }) {
  const router = useRouter();
  const [setupOpen, setSetupOpen] = useState(false);

  if (setupOpen) {
    return <SetupFlow onClose={() => setSetupOpen(false)} />;
  }

  if (state.phase === "empty") {
    return (
      <div className="p-5">
        <Card className="p-6">
          <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite">
            Premier jour
          </span>
          <div className="font-archivo text-24 font-semibold mt-3 leading-[1.15]">
            Choisis ton point de départ pour commencer à suivre le programme.
          </div>
          <div className="text-15 text-graphite mt-3">
            Parcours, niveau, jour. Trois choix, modifiables à tout moment.
          </div>
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="mt-6 w-full h-14 rounded-pill bg-cobalt text-paper font-archivo text-15 font-semibold"
          >
            Définir mon point de départ
          </button>
        </Card>
      </div>
    );
  }

  if (state.phase === "level-up") {
    return (
      <div className="p-5 flex flex-col gap-8">
        <LevelUpPrompt
          parcours={state.parcours}
          parcoursLabel={state.parcoursLabel}
          level={state.level}
          onResolved={() => router.refresh()}
        />
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-8">
      {state.resume && (
        <ResumeBanner
          exerciseName={state.resume.exerciseName}
          href={playerHref(state.parcours, state.level, state.dayIndex)}
        />
      )}
      {dosState.phase === "normal" && dosState.resume && (
        <ResumeBanner exerciseName={dosState.resume.exerciseName} href="/player/dos" accent="sage" />
      )}

      <ProgrammeCard
        parcoursLabel={state.parcoursLabel}
        level={state.level}
        dayTitle={state.dayTitle}
        pastilles={state.pastilles}
        exercisesPreview={state.exercisesPreview}
        exercisesRestCount={state.exercisesRestCount}
        durationEstimateMinutes={state.durationEstimateMinutes}
        done={state.done}
        doneReps={state.doneReps}
        href={playerHref(state.parcours, state.level, state.dayIndex)}
      />

      <DosCard dosState={dosState} />
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/components/today/AujourdhuiScreen.test.tsx`**

Every `render(<AujourdhuiScreen state={...} />)` call needs a `dosState` prop. The 3rd existing test's assertion `"Arrive en phase 4"` no longer applies — this task is exactly what removes that stub — replaced with an assertion on the real `BackPainCard` output. Two tests are added for the Dos card states.

```tsx
// src/components/today/AujourdhuiScreen.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AujourdhuiScreen } from "./AujourdhuiScreen";
import type { TodayState } from "@/lib/programme/loadTodayState";
import type { DosTodayState } from "@/lib/dos/loadDosTodayState";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/programme/actions", () => ({
  setCurrentPositionAction: vi.fn().mockResolvedValue(undefined),
  resolveLevelUpAction: vi.fn().mockResolvedValue(undefined),
}));

const DOS_NO_START_DATE: DosTodayState = { phase: "no-start-date" };
const DOS_NORMAL: DosTodayState = {
  phase: "normal",
  jourLabel: "Lundi",
  intitule: "Charnière & chaîne postérieure",
  exercisesPreview: [{ name: "Hip hinge au bâton", dose: "2 × 10" }],
  exercisesRestCount: 0,
  done: false,
  doneReps: null,
  resume: null,
};

describe("AujourdhuiScreen", () => {
  it("empty state shows the point de départ invite and opens SetupFlow on click", async () => {
    render(<AujourdhuiScreen state={{ phase: "empty" }} dosState={DOS_NO_START_DATE} />);
    expect(screen.getByText("Premier jour")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Définir mon point de départ" }));
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
  });

  it("level-up state renders the LevelUpPrompt", () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }}
        dosState={DOS_NO_START_DATE}
      />,
    );
    expect(screen.getByText("Débutant · Niveau 1 terminé")).toBeInTheDocument();
  });

  it("normal state renders the Programme card and the real BackPainCard", () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
    };
    render(<AujourdhuiScreen state={state} dosState={DOS_NORMAL} />);
    expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();
    expect(screen.getByText("Lundi · Charnière & chaîne postérieure")).toBeInTheDocument();
  });

  it("normal state with a Programme resume shows the cobalt ResumeBanner", () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null,
      resume: { exerciseName: "Push ups" },
    };
    render(<AujourdhuiScreen state={state} dosState={DOS_NO_START_DATE} />);
    expect(screen.getByText("Reprendre à Push ups")).toBeInTheDocument();
  });

  it("shows the no-start-date Dos card when Dos setup hasn't happened yet", () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
    };
    render(<AujourdhuiScreen state={state} dosState={DOS_NO_START_DATE} />);
    expect(screen.getByText("Définis ta date de départ pour commencer.")).toBeInTheDocument();
  });

  it("shows a sage ResumeBanner when the Dos seance is interrupted", () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
    };
    const dosResume: DosTodayState = { ...DOS_NORMAL, resume: { exerciseName: "Hip hinge au bâton" } };
    render(<AujourdhuiScreen state={state} dosState={dosResume} />);
    expect(screen.getByText("Reprendre à Hip hinge au bâton")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(shell\)/page.tsx src/components/today/AujourdhuiScreen.tsx src/components/today/AujourdhuiScreen.test.tsx
git commit -m "feat(dos): wire Dos state into Aujourd'hui"
```

---

### Task 16: `DosSetup` component

**Files:**
- Create: `src/components/dos/DosSetup.tsx`
- Test: `src/components/dos/DosSetup.test.tsx`

**Interfaces:**
- Consumes: `Card` (Fondations), `Button`, `setStartDateAction` (Task 7).
- Produces: `DosSetup` — props `{ onDone: () => void }`. Consumed by `DosScreen.tsx` (Task 18).

One screen, date field pre-filled to today, confirm writes via the action and calls `onDone` (caller refreshes).

```tsx
// src/components/dos/DosSetup.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { setStartDateAction } from "@/lib/dos/actions";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DosSetup({ onDone }: { onDone: () => void }) {
  const [date, setDate] = useState(today());

  return (
    <div className="p-5">
      <Card className="p-6">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>
        <div className="font-archivo text-24 font-semibold mt-3 leading-[1.15]">Tu démarres aujourd&apos;hui ?</div>
        <div className="text-15 text-graphite mt-3">
          La date de départ sert à calculer ta semaine et ton bloc — elle ne se modifie pas ensuite.
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-5 w-full h-14 rounded-field border border-hairline px-4 text-15"
        />
        <div className="mt-6">
          <Button
            variant="primary"
            accent="sage"
            onClick={async () => {
              await setStartDateAction(date);
              onDone();
            }}
          >
            C&apos;est parti
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/dos/DosSetup.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DosSetup } from "./DosSetup";

const setStartDateAction = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/dos/actions", () => ({
  setStartDateAction: (...args: unknown[]) => setStartDateAction(...args),
}));

describe("DosSetup", () => {
  it("pre-fills the date field to today", () => {
    render(<DosSetup onDone={() => {}} />);
    expect(screen.getByDisplayValue(new Date().toISOString().slice(0, 10))).toBeInTheDocument();
  });

  it("calls setStartDateAction with the chosen date then onDone", async () => {
    const onDone = vi.fn();
    render(<DosSetup onDone={onDone} />);
    const input = screen.getByDisplayValue(new Date().toISOString().slice(0, 10));
    fireEvent.change(input, { target: { value: "2026-08-10" } });
    await userEvent.click(screen.getByRole("button", { name: "C'est parti" }));
    expect(setStartDateAction).toHaveBeenCalledWith("2026-08-10");
    expect(onDone).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/dos/DosSetup.test.tsx`
Expected: FAIL — `DosSetup.tsx` does not exist.

- [ ] **Step 3: Create `src/components/dos/DosSetup.tsx`**

(Full content above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/dos/DosSetup.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/dos/DosSetup.tsx src/components/dos/DosSetup.test.tsx
git commit -m "feat(dos): add DosSetup (start-date entry)"
```

---

### Task 17: `loadDosScreenState.ts` — state for the full `/dos` screen

**Files:**
- Create: `src/lib/dos/loadDosScreenState.ts`
- Test: `src/lib/dos/loadDosScreenState.test.ts`

**Interfaces:**
- Consumes: `getStartDate`, `computeWeek`, `computeBlock`, `getEvaluations`, `getCurrentCran`, `ARBRES` (4a), `loadDosTodayState` (Task 13).
- Produces: `type ArbreProgressRow = { arbre: ArbreId; nom: string; cranCourant: number; cranNom: string; totalCrans: number }`, `type DosScreenState = { phase: "no-start-date" } | { phase: "ready"; semaine: number; bloc: number; today: DosTodayState; arbresProgress: ArbreProgressRow[]; weekPastilles: PastilleState[] }`, `loadDosScreenState(db): DosScreenState`. Consumed by `DosScreen.tsx` (Task 18).

`weekPastilles`: lundi→samedi from `dos_seances` completion for this calendar week's dates, dimanche→`restOrWalk`. Computing "this week's Monday" from today's date via native `Date` arithmetic.

```typescript
// src/lib/dos/loadDosScreenState.ts
import type Database from "better-sqlite3";
import { getStartDate, getEvaluations } from "@/lib/backpain/db";
import { computeWeek, computeBlock } from "@/lib/backpain/periode";
import { getCurrentCran } from "@/lib/backpain/progression";
import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { loadDosTodayState, type DosTodayState } from "./loadDosTodayState";
import { getDosSeanceByDate } from "./db";
import type { PastilleState } from "@/components/Pastille";

export type ArbreProgressRow = {
  arbre: ArbreId;
  nom: string;
  cranCourant: number;
  cranNom: string;
  totalCrans: number;
};

export type DosScreenState =
  | { phase: "no-start-date" }
  | {
      phase: "ready";
      semaine: number;
      bloc: number;
      today: DosTodayState;
      arbresProgress: ArbreProgressRow[];
      weekPastilles: PastilleState[];
    };

const ALL_ARBRES: ArbreId[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function mondayOf(date: Date): Date {
  const day = date.getUTCDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  return monday;
}

export function loadDosScreenState(db: Database.Database): DosScreenState {
  const startDate = getStartDate(db);
  if (!startDate) return { phase: "no-start-date" };

  const todayIso = new Date().toISOString().slice(0, 10);
  const semaine = computeWeek(startDate, todayIso);
  const bloc = computeBlock(semaine);
  const evaluations = getEvaluations(db);

  const arbresProgress: ArbreProgressRow[] = ALL_ARBRES.map((arbre) => {
    const cran = getCurrentCran(evaluations, arbre);
    const def = ARBRES[arbre];
    return { arbre, nom: def.nom, cranCourant: cran, cranNom: def.crans[cran - 1]!.nom, totalCrans: def.crans.length };
  });

  const monday = mondayOf(new Date(`${todayIso}T00:00:00Z`));
  const weekPastilles: PastilleState[] = Array.from({ length: 7 }, (_, i) => {
    if (i === 6) return "restOrWalk"; // dimanche
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + i);
    const dateIso = date.toISOString().slice(0, 10);
    const seance = getDosSeanceByDate(db, dateIso);
    if (seance?.completedAt) return "done";
    if (dateIso === todayIso) return "today";
    return "upcoming";
  });

  return { phase: "ready", semaine, bloc, today: loadDosTodayState(db), arbresProgress, weekPastilles };
}
```

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dos/loadDosScreenState.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { loadDosScreenState } from "./loadDosScreenState";
import { setStartDate } from "@/lib/backpain/db";
import { getOrStartDosSeance, completeDosSeance } from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  vi.useRealTimers();
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-dos-screen-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadDosScreenState", () => {
  it("reports no-start-date before setup", () => {
    const db = setup();
    expect(loadDosScreenState(db)).toEqual({ phase: "no-start-date" });
  });

  it("reports semaine/bloc and all 10 arbres at cran 1 with no history", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T09:00:00.000Z"));
    const state = loadDosScreenState(db);
    if (state.phase !== "ready") throw new Error("unreachable");
    expect(state.semaine).toBe(1);
    expect(state.bloc).toBe(1);
    expect(state.arbresProgress).toHaveLength(10);
    expect(state.arbresProgress.every((a) => a.cranCourant === 1)).toBe(true);
  });

  it("marks dimanche restOrWalk and today's date as today in the week pastille row", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T09:00:00.000Z")); // Wednesday
    const state = loadDosScreenState(db);
    if (state.phase !== "ready") throw new Error("unreachable");
    expect(state.weekPastilles[6]).toBe("restOrWalk"); // dimanche
    expect(state.weekPastilles[2]).toBe("today"); // mercredi
    expect(state.weekPastilles[0]).toBe("upcoming"); // lundi, not yet done
  });

  it("marks a completed day as done in the week pastille row", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T09:00:00.000Z")); // Monday
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    completeDosSeance(db, seance.id, 0);
    const state = loadDosScreenState(db);
    if (state.phase !== "ready") throw new Error("unreachable");
    expect(state.weekPastilles[0]).toBe("done");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dos/loadDosScreenState.test.ts`
Expected: FAIL — `loadDosScreenState.ts` does not exist.

- [ ] **Step 3: Create `src/lib/dos/loadDosScreenState.ts`**

(Full content above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dos/loadDosScreenState.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dos/loadDosScreenState.ts src/lib/dos/loadDosScreenState.test.ts
git commit -m "feat(dos): add loadDosScreenState (week row + arbre progress)"
```

---

### Task 18: `DosScreen` component

**Files:**
- Create: `src/components/dos/DosScreen.tsx`
- Test: `src/components/dos/DosScreen.test.tsx`

**Interfaces:**
- Consumes: `DosScreenState`, `ArbreProgressRow` (Task 17), `DosSetup` (Task 16), `BackPainCard` (Task 14), `Pastille` (Fondations), `Card` (Fondations).
- Produces: `DosScreen` — props `{ state: DosScreenState }`. Consumed by `(shell)/dos/page.tsx` (Task 19).

```tsx
// src/components/dos/DosScreen.tsx
"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Pastille } from "@/components/Pastille";
import { BackPainCard } from "@/components/today/BackPainCard";
import { DosSetup } from "./DosSetup";
import type { DosScreenState } from "@/lib/dos/loadDosScreenState";

export function DosScreen({ state }: { state: DosScreenState }) {
  const router = useRouter();

  if (state.phase === "no-start-date") {
    return <DosSetup onDone={() => router.refresh()} />;
  }

  return (
    <div className="p-5 flex flex-col gap-8">
      <div>
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>
        <div className="text-15 text-graphite mt-1">
          Semaine {state.semaine} · Bloc {state.bloc}
        </div>
      </div>

      {state.today.phase === "rest" ? (
        <Card className="p-5">
          <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>
          <div className="font-archivo text-18 font-semibold mt-3">Repos</div>
        </Card>
      ) : state.today.phase === "normal" ? (
        <BackPainCard
          jourLabel={state.today.jourLabel}
          intitule={state.today.intitule}
          exercisesPreview={state.today.exercisesPreview}
          exercisesRestCount={state.today.exercisesRestCount}
          done={state.today.done}
          doneReps={state.today.doneReps}
          href="/player/dos"
        />
      ) : null}

      <div>
        <div className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
          Semaine en cours
        </div>
        <div className="flex gap-2">
          {state.weekPastilles.map((pastilleState, i) => (
            <Pastille key={i} state={pastilleState} accent="sage" />
          ))}
        </div>
      </div>

      <div>
        <div className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
          Progression des arbres
        </div>
        <Card className="overflow-hidden">
          {state.arbresProgress.map((row, i) => (
            <div
              key={row.arbre}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 border-hairline ${i > 0 ? "border-t" : ""}`}
            >
              <div>
                <div className="text-15 font-medium">{row.nom}</div>
                <div className="text-13 text-graphite mt-0.5">{row.cranNom}</div>
              </div>
              <div className="flex gap-1 flex-none">
                {Array.from({ length: row.totalCrans }, (_, cranIndex) => (
                  <span
                    key={cranIndex}
                    className={`w-1.5 h-1.5 rounded-pill ${cranIndex < row.cranCourant ? "bg-sage" : "bg-hairline"}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/dos/DosScreen.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DosScreen } from "./DosScreen";
import type { DosScreenState } from "@/lib/dos/loadDosScreenState";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("DosScreen", () => {
  it("renders DosSetup when no start date is set", () => {
    render(<DosScreen state={{ phase: "no-start-date" }} />);
    expect(screen.getByText("Tu démarres aujourd'hui ?")).toBeInTheDocument();
  });

  it("renders semaine/bloc, today's card, week row, and arbre progress when ready", () => {
    const state: DosScreenState = {
      phase: "ready",
      semaine: 5,
      bloc: 2,
      today: {
        phase: "normal",
        jourLabel: "Lundi",
        intitule: "Charnière & chaîne postérieure",
        exercisesPreview: [{ name: "Hip hinge au bâton", dose: "2 × 10" }],
        exercisesRestCount: 0,
        done: false,
        doneReps: null,
        resume: null,
      },
      arbresProgress: [
        { arbre: "A", nom: "Charnière & ischios", cranCourant: 3, cranNom: "Leg curl serviette bilatéral", totalCrans: 8 },
      ],
      weekPastilles: ["today", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming", "restOrWalk"],
    };
    render(<DosScreen state={state} />);
    expect(screen.getByText("Semaine 5 · Bloc 2")).toBeInTheDocument();
    expect(screen.getByText("Lundi · Charnière & chaîne postérieure")).toBeInTheDocument();
    expect(screen.getByText("Charnière & ischios")).toBeInTheDocument();
    expect(screen.getByText("Leg curl serviette bilatéral")).toBeInTheDocument();
  });

  it("shows a Repos card when today is a rest day", () => {
    const state: DosScreenState = {
      phase: "ready",
      semaine: 5,
      bloc: 2,
      today: { phase: "rest" },
      arbresProgress: [],
      weekPastilles: ["done", "done", "done", "done", "done", "done", "restOrWalk"],
    };
    render(<DosScreen state={state} />);
    expect(screen.getByText("Repos")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/dos/DosScreen.test.tsx`
Expected: FAIL — `DosScreen.tsx` does not exist.

- [ ] **Step 3: Create `src/components/dos/DosScreen.tsx`**

(Full content above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/dos/DosScreen.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/dos/DosScreen.tsx src/components/dos/DosScreen.test.tsx
git commit -m "feat(dos): add DosScreen"
```

---

### Task 19: Wire `/dos` route to `DosScreen`

**Files:**
- Modify: `src/app/(shell)/dos/page.tsx`

**Interfaces:**
- Consumes: `loadDosScreenState` (Task 17), `DosScreen` (Task 18).
- Produces: real `/dos` route, replacing phase 3's stub.

- [ ] **Step 1: Update `src/app/(shell)/dos/page.tsx`**

```tsx
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { loadDosScreenState } from "@/lib/dos/loadDosScreenState";
import { DosScreen } from "@/components/dos/DosScreen";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default async function DosPage() {
  const db = getDb(dbPath());
  const state = loadDosScreenState(db);
  return <DosScreen state={state} />;
}
```

- [ ] **Step 2: Run the full suite and typecheck**

Run: `npx vitest run`
Expected: all tests pass.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

Run: `npm run db:migrate && npm run dev` (one terminal), then in another:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/dos"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/"
```
Expected: both `200`. Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(shell\)/dos/page.tsx
git commit -m "feat(dos): wire the real /dos screen, replacing the phase 3 stub"
```

---

## End of Plan

After Task 19, run `npx vitest run` and `npx tsc --noEmit` once more on the whole tree before moving to the final whole-branch review. Two known non-blocking gaps carried forward deliberately (stated in the design spec, not silent): `geneLendemain` collection and everything in `BackPainProgram.md` §8-§13 (mobilité quotidienne, marche, transitions, rappels bureau, métriques, charge cumulée) belong to 4c. No "programme terminé" screen past semaine 16 (§15) exists yet.
