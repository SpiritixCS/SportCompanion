# Séance interrompue, durée active, « Terminer la séance » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La durée de séance ne compte plus les trous > 1 h, une séance inactive > 1 h propose Reprendre / Terminer / Effacer, et la croix permet de valider une séance partielle.

**Architecture:** Fonction pure `activeDurationSeconds` sur la liste des horodatages de la séance (début, reprise, séries). Colonne `resumed_at` additive sur `seances` et `tracking_seances`. `PlayerScreen` (partagé Programme / Tracking / Dos) gagne une feuille d'inactivité, une feuille de sortie à options variables et une phase locale `summary`.

**Tech Stack:** Next.js App Router (server actions), React client components, better-sqlite3, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-03-seance-interrompue-design.md`

## Global Constraints

- Seuil d'inactivité : `INACTIVITY_LIMIT_SECONDS = 3600`.
- Migration additive uniquement — aucune ligne existante modifiée (données Programme de Mathis et Clément intactes).
- Textes UI en français, tutoiement, aucun encouragement ni point d'exclamation (CLAUDE.md §4).
- Bouton destructif = couleur `alert` (`border-alert text-alert`), seul usage autorisé de cette couleur.
- État affiché toujours relu depuis la DB, jamais reconstruit côté client (CLAUDE.md §2).
- Commandes : `npx vitest run <fichier>` ; typecheck `npx tsc --noEmit`.

## Review Focus

- Onglet laissé ouvert toute la nuit (pas de rechargement) puis réactivé → la feuille d'inactivité doit apparaître (test `visibilitychange` en Task 4).
- Reprendre puis recharger la page → la feuille ne doit pas revenir (test DB `resumedAt` relu en Task 2 + test UI « pas de feuille si resumedAt récent » en Task 4).
- Effacer une séance → ses reps disparaissent du cumul Trophées (test Task 2).
- Séance avec 0 série + croix → pas d'option « Terminer avec ce qui est fait » (test Task 4).
- Séance `pending-validation` ouverte le lendemain → récap direct, pas de feuille, durée sans le trou (test Task 4).

---

### Task 1: Durée active et détection d'inactivité (pur)

**Files:**
- Create: `src/lib/player/activeDuration.ts`
- Test: `src/lib/player/activeDuration.test.ts`

**Interfaces:**
- Produces: `INACTIVITY_LIMIT_SECONDS: number`, `activeDurationSeconds(events: (string | null | undefined)[], nowMs: number): number`, `isInactive(events: (string | null | undefined)[], nowMs: number): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { activeDurationSeconds, isInactive, INACTIVITY_LIMIT_SECONDS } from "./activeDuration";

const T0 = Date.parse("2026-10-03T10:00:00.000Z");
const at = (s: number) => new Date(T0 + s * 1000).toISOString();

describe("activeDurationSeconds", () => {
  it("sums short gaps up to now", () => {
    expect(activeDurationSeconds([at(0), at(60), at(150)], T0 + 200_000)).toBe(200);
  });

  it("ignores a gap longer than one hour", () => {
    // début, oubli d'une nuit, série 10 min plus tard
    expect(activeDurationSeconds([at(0), at(30_000)], T0 + 30_600_000)).toBe(600);
  });

  it("counts from the resume event after a long pause", () => {
    expect(activeDurationSeconds([at(0), at(120), at(40_000)], T0 + 40_300_000)).toBe(120 + 300);
  });

  it("ignores null/undefined and unordered events", () => {
    expect(activeDurationSeconds([at(60), null, at(0), undefined], T0 + 90_000)).toBe(90);
  });

  it("returns 0 with no events", () => {
    expect(activeDurationSeconds([], T0)).toBe(0);
  });

  it("counts a gap of exactly one hour", () => {
    expect(activeDurationSeconds([at(0)], T0 + INACTIVITY_LIMIT_SECONDS * 1000)).toBe(INACTIVITY_LIMIT_SECONDS);
  });
});

describe("isInactive", () => {
  it("is false within the hour after the last event", () => {
    expect(isInactive([at(0), at(1000)], T0 + 1000_000 + 3_000_000)).toBe(false);
  });

  it("is true more than an hour after the last event", () => {
    expect(isInactive([at(0), at(1000)], T0 + 1000_000 + 3_601_000)).toBe(true);
  });

  it("is false with no events", () => {
    expect(isInactive([], T0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/player/activeDuration.test.ts`
Expected: FAIL — cannot resolve `./activeDuration`.

- [ ] **Step 3: Write minimal implementation**

```ts
// Au-delà de ce trou entre deux événements, la séance est considérée en pause :
// le trou ne compte pas dans la durée et le player propose Reprendre/Terminer/Effacer.
export const INACTIVITY_LIMIT_SECONDS = 3600;

function sortedMs(events: (string | null | undefined)[]): number[] {
  return events
    .filter((e): e is string => typeof e === "string")
    .map((e) => Date.parse(e))
    .sort((a, b) => a - b);
}

export function activeDurationSeconds(events: (string | null | undefined)[], nowMs: number): number {
  const times = sortedMs(events);
  if (times.length === 0) return 0;
  times.push(nowMs);
  let total = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = (times[i]! - times[i - 1]!) / 1000;
    if (gap > 0 && gap <= INACTIVITY_LIMIT_SECONDS) total += gap;
  }
  return Math.floor(total);
}

export function isInactive(events: (string | null | undefined)[], nowMs: number): boolean {
  const times = sortedMs(events);
  if (times.length === 0) return false;
  return (nowMs - times[times.length - 1]!) / 1000 > INACTIVITY_LIMIT_SECONDS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/player/activeDuration.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/activeDuration.ts src/lib/player/activeDuration.test.ts
git commit -m "feat(player): calcule la durée active d'une séance en ignorant les trous de plus d'1 h"
```

---

### Task 2: Migration `resumed_at` + fonctions DB + états de player

**Files:**
- Create: `migrations/0013_seance_resumed_at.sql`, `migrations/0013_seance_resumed_at.test.ts`
- Modify: `src/lib/player/db.ts` (type `Seance`, `getActiveSeance`, + `resumeSeance`, `deleteSeance`)
- Modify: `src/lib/tracking/db.ts` (type `TrackingSeance`, `mapSeance`, + `resumeSeance`)
- Modify: `src/lib/player/loadPlayerState.ts`, `src/lib/tracking/loadDayPlayerState.ts` (exposer `resumedAt`)
- Test: `src/lib/player/db.test.ts`, `src/lib/tracking/db.test.ts`, `src/lib/player/loadPlayerState.test.ts`

**Interfaces:**
- Produces:
  - `Seance.resumedAt: string | null` ; `TrackingSeance.resumedAt: string | null`
  - `player/db.ts` : `resumeSeance(db, seanceId: number): void`, `deleteSeance(db, seanceId: number): void`
  - `tracking/db.ts` : `resumeSeance(db, seanceId: number): void` (`deleteSeance` existe déjà)
  - `PlayerState` / `DayPlayerState` phases `in-progress` et `pending-validation` : `resumedAt?: string | null`
    (optionnel : `loadDosPlayerState` produit aussi un `PlayerState` et disparaît au chantier 3)

- [ ] **Step 1: Write the failing migration test** — `migrations/0013_seance_resumed_at.test.ts`

```ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-0013-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("0013_seance_resumed_at migration", () => {
  it("adds a nullable resumed_at to seances", () => {
    const db = setup();
    db.prepare(`INSERT INTO seances (parcours, level, day_index, started_at) VALUES ('beginner', 0, 0, '2026-10-03T00:00:00.000Z')`).run();
    expect((db.prepare(`SELECT resumed_at FROM seances`).get() as { resumed_at: string | null }).resumed_at).toBeNull();
  });

  it("adds a nullable resumed_at to tracking_seances", () => {
    const db = setup();
    db.prepare(`INSERT INTO tracking_seances (started_at) VALUES ('2026-10-03T00:00:00.000Z')`).run();
    expect((db.prepare(`SELECT resumed_at FROM tracking_seances`).get() as { resumed_at: string | null }).resumed_at).toBeNull();
  });

  it("keeps rows that existed before the migration", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-0013-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    const all = path.join(process.cwd(), "migrations");
    const before = path.join(tmpDir, "before");
    // rejoue toutes les migrations sauf 0013, insère, puis applique 0013
    mkdirSync(before);
    for (const f of readdirSync(all).filter((f) => f.endsWith(".sql") && !f.startsWith("0013"))) {
      copyFileSync(path.join(all, f), path.join(before, f));
    }
    runMigrations(db, before);
    db.prepare(`INSERT INTO seances (parcours, level, day_index, started_at, completed_at) VALUES ('beginner', 2, 3, '2026-09-01T10:00:00.000Z', '2026-09-01T10:40:00.000Z')`).run();
    runMigrations(db, all);
    expect(db.prepare(`SELECT parcours, level, day_index, completed_at FROM seances`).get()).toEqual({
      parcours: "beginner", level: 2, day_index: 3, completed_at: "2026-09-01T10:40:00.000Z",
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run migrations/0013_seance_resumed_at.test.ts`
Expected: FAIL — `no such column: resumed_at`.

- [ ] **Step 3: Write the migration** — `migrations/0013_seance_resumed_at.sql`

```sql
-- Dernière reprise après une pause > 1 h (feuille « Séance en pause depuis
-- longtemps » → Reprendre). Sert d'événement pour la durée active et empêche
-- la feuille de revenir au rechargement. Nullable, additive : aucune ligne
-- existante n'est modifiée.
ALTER TABLE seances ADD COLUMN resumed_at TEXT;
ALTER TABLE tracking_seances ADD COLUMN resumed_at TEXT;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run migrations/0013_seance_resumed_at.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write failing DB tests** — append to `src/lib/player/db.test.ts` (add `resumeSeance, deleteSeance` to the existing import from `./db`, and `import { computeTrophies } from "@/lib/trophies/computeTrophies";`)

```ts
describe("resume and delete", () => {
  it("records resumedAt and reads it back on the active seance", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    expect(getActiveSeance(db, "beginner", 0, 0)!.resumedAt).toBeNull();
    resumeSeance(db, seance.id);
    expect(typeof getActiveSeance(db, "beginner", 0, 0)!.resumedAt).toBe("string");
  });

  it("deletes the seance, its sets and its skipped exercises, removing reps from Trophées", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 0, setNumber: 1, repsTarget: "10", repsActual: 10, restSeconds: 90 });
    skipExercise(db, seance.id, 1);
    const before = computeTrophies(db).reduce((sum, c) => sum + c.total, 0);
    expect(before).toBeGreaterThan(0);

    deleteSeance(db, seance.id);

    expect(getActiveSeance(db, "beginner", 0, 0)).toBeNull();
    expect(getSetsForSeance(db, seance.id)).toEqual([]);
    expect(getSkippedExercises(db, seance.id)).toEqual([]);
    expect(computeTrophies(db).reduce((sum, c) => sum + c.total, 0)).toBe(0);
  });
});
```

Append to `src/lib/tracking/db.test.ts` (add `resumeSeance` to its import from `./db`):

```ts
describe("resumeSeance", () => {
  it("records resumedAt on the active tracking seance", () => {
    const db = setup();
    const seance = startSeance(db, 0);
    expect(getActiveSeance(db)!.resumedAt).toBeNull();
    resumeSeance(db, seance.id);
    expect(typeof getActiveSeance(db)!.resumedAt).toBe("string");
  });
});
```

(If `src/lib/tracking/db.test.ts` names its fixture differently than `setup`, use the existing helper of that file.)

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/lib/player/db.test.ts src/lib/tracking/db.test.ts`
Expected: FAIL — `resumeSeance` / `deleteSeance` not exported.

- [ ] **Step 7: Implement in `src/lib/player/db.ts`**

Add `resumedAt: string | null;` to `type Seance` after `startedAt`. In `getActiveSeance`'s SELECT, add `resumed_at AS resumedAt` after `started_at AS startedAt`. In `startSeance`'s return object, add `resumedAt: null,`. Append:

```ts
export function resumeSeance(db: Database.Database, seanceId: number): void {
  db.prepare(`UPDATE seances SET resumed_at = ? WHERE id = ?`).run(new Date().toISOString(), seanceId);
}

// « Effacer » / « Abandonner » : la séance et ses séries disparaissent, leurs
// reps sortent des Trophées, le jour reste à faire.
export function deleteSeance(db: Database.Database, seanceId: number): void {
  db.transaction(() => {
    db.prepare(`DELETE FROM sets_logged WHERE seance_id = ?`).run(seanceId);
    db.prepare(`DELETE FROM skipped_exercises WHERE seance_id = ?`).run(seanceId);
    db.prepare(`DELETE FROM seances WHERE id = ?`).run(seanceId);
  })();
}
```

- [ ] **Step 8: Implement in `src/lib/tracking/db.ts`**

Change `TrackingSeance` to `{ id: number; startedAt: string; resumedAt: string | null; completedAt: string | null; dayOfWeek: number | null }`. Change `mapSeance`:

```ts
function mapSeance(row: { id: number; started_at: string; resumed_at: string | null; completed_at: string | null; program_day_of_week: number | null }): TrackingSeance {
  return { id: row.id, startedAt: row.started_at, resumedAt: row.resumed_at, completedAt: row.completed_at, dayOfWeek: row.program_day_of_week };
}
```

In `startSeance`'s return, add `resumedAt: null`. Append:

```ts
export function resumeSeance(db: Database.Database, seanceId: number): void {
  db.prepare(`UPDATE tracking_seances SET resumed_at = ? WHERE id = ?`).run(new Date().toISOString(), seanceId);
}
```

- [ ] **Step 9: Expose `resumedAt` in the player states**

`src/lib/player/loadPlayerState.ts` — type:

```ts
export type PlayerState =
  | {
      phase: "in-progress";
      seanceId: number;
      startedAt: string;
      // ponytail: optionnel tant que loadDosPlayerState produit aussi ce type ; rendre obligatoire au chantier 3 (retrait du Dos)
      resumedAt?: string | null;
      next: NextSet;
      skippedExerciseOrders: number[];
    }
  | { phase: "pending-validation"; seanceId: number; startedAt: string; resumedAt?: string | null }
  | { phase: "completed"; seanceId: number };
```

and in the two returns add `resumedAt: seance.resumedAt,`.

`src/lib/tracking/loadDayPlayerState.ts` — add `resumedAt: string | null` to its `in-progress` and `pending-validation` variants and `resumedAt: seance.resumedAt,` to both returns.

Append to `src/lib/player/loadPlayerState.test.ts` (reuse its existing fixtures — `setup()` and the `TrainDay` constant it already uses; import `resumeSeance` from `./db`):

```ts
it("reads resumedAt back from the DB after a resume (survives a reload)", () => {
  const db = setup();
  const first = loadPlayerState(db, "beginner", 0, 0, DAY);
  expect(first.phase === "in-progress" && first.resumedAt).toBeNull();
  resumeSeance(db, first.seanceId);
  const reloaded = loadPlayerState(db, "beginner", 0, 0, DAY);
  expect(reloaded.phase === "in-progress" && typeof reloaded.resumedAt).toBe("string");
});
```

(Replace `DAY` with the TrainDay constant name used in that file.)

- [ ] **Step 10: Run tests + typecheck**

Run: `npx vitest run src/lib/player src/lib/tracking migrations && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 11: Commit**

```bash
git add migrations/0013_seance_resumed_at.* src/lib/player src/lib/tracking
git commit -m "feat(player): enregistre la reprise d'une séance et permet de l'effacer"
```

---

### Task 3: Actions serveur et câblage des pages

**Files:**
- Modify: `src/lib/player/actions.ts`, `src/lib/tracking/actions.ts`
- Modify: `src/app/player/page.tsx`, `src/app/player/tracking/page.tsx`

**Interfaces:**
- Consumes: `resumeSeance`, `deleteSeance` (Task 2)
- Produces: `resumeSeanceAction(seanceId: number): Promise<void>`, `discardSeanceAction(seanceId: number): Promise<void>` (Programme) ; `resumeDaySeanceAction(seanceId: number): Promise<void>`, `discardDaySeanceAction(seanceId: number): Promise<void>` (Tracking). Props `onResume` / `onDiscard` passées à `PlayerScreen` (défini en Task 4).

- [ ] **Step 1: Programme actions** — `src/lib/player/actions.ts`: extend the import from `./db` with `resumeSeance as resumeSeanceDb, deleteSeance as deleteSeanceDb`, then append:

```ts
export async function resumeSeanceAction(seanceId: number): Promise<void> {
  resumeSeanceDb(await db(), seanceId);
}

export async function discardSeanceAction(seanceId: number): Promise<void> {
  deleteSeanceDb(await db(), seanceId);
}
```

- [ ] **Step 2: Tracking actions** — `src/lib/tracking/actions.ts`: add `resumeSeance as resumeSeanceDb` to the import from `./db`, then append:

```ts
export async function resumeDaySeanceAction(seanceId: number): Promise<void> {
  resumeSeanceDb(await db(), seanceId);
}

// N'avance pas le pointeur : le jour reste à faire.
export async function discardDaySeanceAction(seanceId: number): Promise<void> {
  deleteSeanceDb(await db(), seanceId);
}
```

- [ ] **Step 3: Wire pages**

`src/app/player/page.tsx`: import `resumeSeanceAction, discardSeanceAction` alongside the existing actions and add to `<PlayerScreen …>`:

```tsx
      onResume={resumeSeanceAction}
      onDiscard={discardSeanceAction}
```

`src/app/player/tracking/page.tsx`: import `resumeDaySeanceAction, discardDaySeanceAction` and add:

```tsx
      onResume={resumeDaySeanceAction}
      onDiscard={discardDaySeanceAction}
```

(These props are added to `PlayerScreen` in Task 4 — do Task 4 Step 3 before typechecking this task, or run the typecheck at the end of Task 4.)

- [ ] **Step 4: Commit** (with Task 4, once typecheck passes)

---

### Task 4: `PlayerScreen` — durée active, feuille d'inactivité, sortie, récap anticipé

**Files:**
- Modify: `src/components/player/PlayerScreen.tsx`
- Test: `src/components/player/PlayerScreen.test.tsx`

**Interfaces:**
- Consumes: `activeDurationSeconds`, `isInactive`, `INACTIVITY_LIMIT_SECONDS` (Task 1) ; `PlayerState.resumedAt` (Task 2)
- Produces: props `onResume?: (seanceId: number) => Promise<void>`, `onDiscard?: (seanceId: number) => Promise<void>`

- [ ] **Step 1: Write failing tests** — in `PlayerScreen.test.tsx`, add `const onResume = vi.fn().mockResolvedValue(undefined); const onDiscard = vi.fn().mockResolvedValue(undefined);`, include them in `actionProps()` and in `beforeEach` clears, add a helper and tests:

```tsx
const HOUR = 3600_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

function inProgress(overrides: Partial<Extract<PlayerState, { phase: "in-progress" }>> = {}): PlayerState {
  return {
    phase: "in-progress",
    seanceId: 1,
    startedAt: STARTED_AT,
    resumedAt: null,
    next: { exerciseOrder: 1, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: true },
    skippedExerciseOrders: [],
    ...overrides,
  };
}

function loggedSet(completedAt: string) {
  return { id: 1, seanceId: 1, exerciseOrder: 0, setNumber: 1, repsTarget: "10", repsActual: 10, restSeconds: 90, completedAt };
}

describe("PlayerScreen — séance interrompue", () => {
  it("excludes a gap longer than one hour from the chronometer", () => {
    // début il y a 25 h, une série il y a 25 h - 2 min, rien depuis → 2:00 + rien
    render(
      <PlayerScreen day={DAY} state={inProgress({ startedAt: iso(25 * HOUR) })} setsLogged={[loggedSet(iso(25 * HOUR - 120_000))]} {...actionProps()} />,
    );
    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  it("shows the pause sheet on open when the last event is more than an hour old", () => {
    render(<PlayerScreen day={DAY} state={inProgress({ startedAt: iso(25 * HOUR) })} setsLogged={[loggedSet(iso(25 * HOUR))]} {...actionProps()} />);
    expect(screen.getByText("Séance en pause depuis longtemps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reprendre" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminer avec ce qui est fait" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Effacer la séance" })).toBeInTheDocument();
  });

  it("does not show the pause sheet when a recent resume is stored (reload after Reprendre)", () => {
    render(
      <PlayerScreen day={DAY} state={inProgress({ startedAt: iso(25 * HOUR), resumedAt: iso(60_000) })} setsLogged={[loggedSet(iso(25 * HOUR))]} {...actionProps()} />,
    );
    expect(screen.queryByText("Séance en pause depuis longtemps")).not.toBeInTheDocument();
  });

  it("Reprendre calls onResume and closes the sheet", async () => {
    render(<PlayerScreen day={DAY} state={inProgress({ startedAt: iso(25 * HOUR) })} setsLogged={[loggedSet(iso(25 * HOUR))]} {...actionProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Reprendre" }));
    expect(onResume).toHaveBeenCalledWith(1);
    expect(screen.queryByText("Séance en pause depuis longtemps")).not.toBeInTheDocument();
  });

  it("shows the pause sheet when the tab becomes visible again after an hour", () => {
    const realNow = Date.now();
    render(<PlayerScreen day={DAY} state={inProgress({ startedAt: iso(60_000) })} setsLogged={[]} {...actionProps()} />);
    expect(screen.queryByText("Séance en pause depuis longtemps")).not.toBeInTheDocument();

    const spy = vi.spyOn(Date, "now").mockReturnValue(realNow + 2 * HOUR);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByText("Séance en pause depuis longtemps")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("Effacer asks for confirmation, then discards and goes home", async () => {
    render(<PlayerScreen day={DAY} state={inProgress({ startedAt: iso(25 * HOUR) })} setsLogged={[loggedSet(iso(25 * HOUR))]} {...actionProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Effacer la séance" }));
    expect(screen.getByText("Effacer 1 série ? Elle sort des Trophées.")).toBeInTheDocument();
    expect(onDiscard).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Effacer" }));
    expect(onDiscard).toHaveBeenCalledWith(1);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("quit sheet offers Terminer avec ce qui est fait when at least one set is logged, leading to the summary", async () => {
    render(<PlayerScreen day={DAY} state={inProgress()} setsLogged={[loggedSet(iso(30_000))]} {...actionProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Quitter la séance" }));
    await userEvent.click(screen.getByRole("button", { name: "Terminer avec ce qui est fait" }));
    expect(screen.getByText("Séance terminée")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(onSeanceFinish).toHaveBeenCalledWith(1);
  });

  it("quit sheet with no set logged offers Abandonner instead, which discards", async () => {
    render(<PlayerScreen day={DAY} state={inProgress({ next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false } })} setsLogged={[]} {...actionProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Quitter la séance" }));
    expect(screen.queryByRole("button", { name: "Terminer avec ce qui est fait" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitter et reprendre plus tard" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Abandonner" }));
    expect(onDiscard).toHaveBeenCalledWith(1);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("pending-validation opened the next day shows the summary without the pause sheet", () => {
    render(
      <PlayerScreen day={DAY} state={{ phase: "pending-validation", seanceId: 1, startedAt: iso(25 * HOUR), resumedAt: null }} setsLogged={[loggedSet(iso(25 * HOUR - 120_000))]} {...actionProps()} />,
    );
    expect(screen.getByText("Séance terminée")).toBeInTheDocument();
    expect(screen.queryByText("Séance en pause depuis longtemps")).not.toBeInTheDocument();
  });
});
```

Add `act` to the `@testing-library/react` import. The existing test "opens the quit sheet and navigates home on confirm" uses `setsLogged={[]}` — change it to `setsLogged={[loggedSet(iso(30_000))]}` (with 0 set, « Quitter et reprendre plus tard » no longer exists). Move the `HOUR`/`iso`/`loggedSet` helpers above the first `describe` so that test can use them.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/player/PlayerScreen.test.tsx`
Expected: FAIL — pause sheet text not found, etc.

- [ ] **Step 3: Implement in `PlayerScreen.tsx`**

Imports: add `import { activeDurationSeconds, isInactive } from "@/lib/player/activeDuration";`. Remove `elapsedSecondsSince` and `useElapsedSeconds`, replace with:

```tsx
// Ancré sur les horodatages DB (début, reprise, séries) — jamais un compteur
// client seul (CLAUDE.md §2). Démarre à 0 pour que SSR et hydratation
// concordent ; la vraie valeur arrive au premier tick côté client.
function useActiveSeconds(events: (string | null | undefined)[]): number {
  const [seconds, setSeconds] = useState(0);
  const key = events.join("|");
  useEffect(() => {
    if (events.length === 0) return;
    setSeconds(activeDurationSeconds(events, Date.now()));
    const id = setInterval(() => setSeconds(activeDurationSeconds(events, Date.now())), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return seconds;
}
```

Extend `LocalPhase` with `| { kind: "summary" }`. Add props `onResume?: (seanceId: number) => Promise<void>; onDiscard?: (seanceId: number) => Promise<void>;` with a comment `// ponytail: optionnels tant que le player Dos existe ; obligatoires au chantier 3`.

Inside the component, replace the `elapsedSeconds` line with:

```tsx
  // Séries loggées depuis le dernier refresh serveur + reprise locale : le
  // chrono et la détection d'inactivité les voient sans attendre la DB.
  const [localSetEvents, setLocalSetEvents] = useState<string[]>([]);
  const [localResumeAt, setLocalResumeAt] = useState<string | null>(null);
  const events =
    state.phase === "completed"
      ? []
      : [state.startedAt, state.resumedAt, localResumeAt, ...setsLogged.map((s) => s.completedAt), ...localSetEvents];
  const elapsedSeconds = useActiveSeconds(events);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const setsDoneCount = setsLogged.length + localSetEvents.length;

  useEffect(() => {
    if (state.phase !== "in-progress") return;
    function check() {
      if (document.visibilityState === "visible" && isInactive(events, Date.now())) setPauseOpen(true);
    }
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, events.join("|")]);

  async function handleResume() {
    if (state.phase === "completed") return;
    await onResume?.(state.seanceId);
    setLocalResumeAt(new Date().toISOString());
    setPauseOpen(false);
  }

  async function handleDiscard() {
    if (state.phase === "completed") return;
    await onDiscard?.(state.seanceId);
    router.push("/");
  }

  function handleFinishEarly() {
    setPauseOpen(false);
    setQuitOpen(false);
    setLocalPhase({ kind: "summary" });
  }
```

In `handleCompleteSet`, after `await onLogSet(...)`, add `setLocalSetEvents((prev) => [...prev, new Date().toISOString()]);`. In the RestView `onComplete`, after `router.refresh()`, reset with `setLocalSetEvents([])` — the refreshed `setsLogged` now carries them.

Caveat on the reset: `router.refresh()` is async; resetting immediately can briefly drop the last set from `events` (chronometer may tick a few seconds low for one render). Acceptable — the next server render restores it.

Summary early phase — before the `pending-validation` branch, add:

```tsx
  if (localPhase.kind === "summary" && state.phase === "in-progress") {
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

Replace the quit `<Sheet>` body and add the pause and confirm sheets (inside the fragment returned for the exercise view):

```tsx
      <Sheet open={quitOpen} onClose={() => setQuitOpen(false)} title="Quitter la séance ?">
        <p className="text-15 text-graphite leading-relaxed">
          {setsDoneCount > 0
            ? "Tu peux la valider avec ce qui est fait, ou la reprendre plus tard depuis Aujourd'hui."
            : "Aucune série n'est enregistrée."}
        </p>
        <div className="flex flex-col gap-2.5 mt-6">
          {setsDoneCount > 0 ? (
            <>
              <button type="button" onClick={handleFinishEarly} className="h-14 rounded-pill border border-hairline text-ink font-archivo text-15 font-semibold">
                Terminer avec ce qui est fait
              </button>
              <button type="button" onClick={() => router.push("/")} className="h-14 rounded-pill border border-hairline text-ink font-archivo text-15 font-semibold">
                Quitter et reprendre plus tard
              </button>
            </>
          ) : (
            <button type="button" onClick={handleDiscard} className="h-14 rounded-pill border border-alert text-alert font-archivo text-15 font-semibold">
              Abandonner
            </button>
          )}
          <button type="button" onClick={() => setQuitOpen(false)} className="h-14 rounded-pill bg-ink text-paper font-archivo text-15 font-semibold">
            Continuer la séance
          </button>
        </div>
      </Sheet>
      <Sheet open={pauseOpen && !discardConfirmOpen} onClose={handleResume} title="Séance en pause depuis longtemps">
        <p className="text-15 text-graphite leading-relaxed">
          Le temps de pause ne compte pas dans la durée.
        </p>
        <div className="flex flex-col gap-2.5 mt-6">
          <button type="button" onClick={handleResume} className="h-14 rounded-pill bg-ink text-paper font-archivo text-15 font-semibold">
            Reprendre
          </button>
          {setsDoneCount > 0 && (
            <button type="button" onClick={handleFinishEarly} className="h-14 rounded-pill border border-hairline text-ink font-archivo text-15 font-semibold">
              Terminer avec ce qui est fait
            </button>
          )}
          <button type="button" onClick={() => setDiscardConfirmOpen(true)} className="h-14 rounded-pill border border-alert text-alert font-archivo text-15 font-semibold">
            Effacer la séance
          </button>
        </div>
      </Sheet>
      <Sheet open={discardConfirmOpen} onClose={() => setDiscardConfirmOpen(false)} title="Effacer la séance ?">
        <p className="text-15 text-graphite leading-relaxed">
          {setsDoneCount === 1
            ? "Effacer 1 série ? Elle sort des Trophées."
            : `Effacer ${setsDoneCount} séries ? Elles sortent des Trophées.`}
        </p>
        <div className="flex flex-col gap-2.5 mt-6">
          <button type="button" onClick={handleDiscard} className="h-14 rounded-pill border border-alert text-alert font-archivo text-15 font-semibold">
            Effacer
          </button>
          <button type="button" onClick={() => setDiscardConfirmOpen(false)} className="h-14 rounded-pill bg-ink text-paper font-archivo text-15 font-semibold">
            Annuler
          </button>
        </div>
      </Sheet>
```

When `setsDoneCount === 0` the confirmation reads « Effacer 0 séries ? … » — acceptable edge (pause sheet with zero sets means a seance opened and forgotten); keep as is.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/components/player && npx tsc --noEmit`
Expected: PASS, no type errors (Task 3 page props now resolve).

- [ ] **Step 5: Full suite**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 6: Commit Task 3 + Task 4**

```bash
git add src/lib/player/actions.ts src/lib/tracking/actions.ts src/app/player/page.tsx src/app/player/tracking/page.tsx src/components/player/PlayerScreen.tsx src/components/player/PlayerScreen.test.tsx
git commit -m "feat(player): propose Reprendre/Terminer/Effacer après 1 h d'inactivité et permet de terminer une séance partielle"
```

---

### Task 5: Vérification locale

- [ ] **Step 1:** Copier les DB de prod en local (lecture seule côté VM) pour tester sur données réelles : `scp -i "$HOME/Desktop/Claude Code/ssh-key-2026-05-17.key" ubuntu@158.178.213.227:/home/ubuntu/sportcompanion/data/*.db <scratchpad>/prod-db/` puis lancer `DB_PATH=<scratchpad>/prod-db/sportcompanion.db npx next dev -H 0.0.0.0 -p 3100` (migration 0013 appliquée sur la copie via `npm run db:migrate` avec le même `DB_PATH`).
- [ ] **Step 2:** Vérifier que la position Programme et les Trophées de la copie sont identiques avant/après migration.
- [ ] **Step 3:** Scénarios : séance avec 1 série puis croix → Terminer avec ce qui est fait → récap → Terminer → jour fait ; séance vieillie (`UPDATE seances SET started_at = datetime('now','-1 day')` sur la copie) → feuille au chargement → Reprendre → recharger → pas de feuille ; Effacer → confirmation → Aujourd'hui, jour toujours à faire.
- [ ] **Step 4:** Donner l'URL Mac + iPhone et la checklist à Mathis.
