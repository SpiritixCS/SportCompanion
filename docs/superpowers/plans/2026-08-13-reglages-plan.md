# Réglages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Réglages screen (design brief §4.7) and its entry point (the Aujourd'hui header, currently missing entirely), making the Séance rest-duration/wake-screen settings real and persisted, while other groups (Programme, BackPain, Données, À propos) render read-only or inert per the approved spec.

**Architecture:** New single-row SQLite table `app_settings` (migration `0007_settings.sql`) backs a small `src/lib/settings/` module (db access + Server Actions). A new `ReglagesScreen` Client Component, opened as a local-state overlay from `AujourdhuiScreen` (same pattern as the existing `SetupFlow`), loads that state on mount and renders the five grouped sections from the brief. Two new small reusable components (`Toggle`, `DurationRow`) back the editable Séance rows. A `useWakeLock` hook — wired into `PlayerScreen` — closes the separately-flagged Wake Lock API gap using the new `keepScreenAwakeEnabled` setting.

**Tech Stack:** Next.js App Router, React 19 Client Components, better-sqlite3, Vitest + Testing Library (existing project conventions — no new dependencies).

## Global Constraints

- French UI copy, tutoiement, no exclamation points, no motivational tone ("l'app constate, elle n'encourage pas" — CLAUDE.md §4).
- Design tokens only: colors `--paper #FFFFFF`, `--canvas #F6F7F4`, `--ink #111310`, `--graphite #6E736B`, `--hairline #E5E7E1`, `--cobalt #1F3BE0`, `--sage #2E7D63`, `--brass #A9782C`, `--alert #B3402E`; radii `rounded-card` (20px) / `rounded-field` (14px) / `rounded-pill` (999px); type scale `text-11/13/15/18/24/32/44/72/96`; touch targets ≥44px (`h-11` = 44px), ≥56px (`h-14`) for primary actions.
- No dark mode. Réglages is neutral throughout — the active accent-per-module rule (CLAUDE.md §4) does not apply here; no cobalt/sage/brass fills on this screen except the existing `SetupFlow`'s own cobalt (unchanged).
- State displayed must be read from the DB, never reconstructed/cached client-side across the overlay's open/close cycle (CLAUDE.md §2 — the exact bug class that motivated this project's rewrite).
- Every non-trivial piece of logic (a branch, a loop, a persisted read/write) ships with a test in the same task that introduces it — this repo has 100% task-level test coverage today (325 passing tests) and the plan preserves that.
- Follow existing repo conventions exactly: singleton `db()` pattern in `"use server"` action files (see `src/lib/dos/actions.ts`), migration files auto-discovered by filename glob (no manual registration), Vitest + `@testing-library/react` + `@testing-library/user-event`, `vi.mock` for action modules in component tests.

---

## Task 1: `app_settings` migration

**Files:**
- Create: `migrations/0007_settings.sql`
- Test: `migrations/0007_settings.test.ts`

**Interfaces:**
- Produces: table `app_settings` with columns `id, rest_between_sets_seconds, rest_between_exercises_seconds, sound_countdown_enabled, start_countdown_enabled, keep_screen_awake_enabled`, one row (`id = 1`) with defaults `90, 120, 0, 0, 1`.

- [ ] **Step 1: Write the migration**

```sql
-- migrations/0007_settings.sql
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  rest_between_sets_seconds INTEGER NOT NULL DEFAULT 90,
  rest_between_exercises_seconds INTEGER NOT NULL DEFAULT 120,
  sound_countdown_enabled INTEGER NOT NULL DEFAULT 0,
  start_countdown_enabled INTEGER NOT NULL DEFAULT 0,
  keep_screen_awake_enabled INTEGER NOT NULL DEFAULT 1
);

INSERT INTO app_settings (id) VALUES (1);
```

- [ ] **Step 2: Write the failing test**

```ts
// migrations/0007_settings.test.ts
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

describe("0007_settings migration", () => {
  it("creates app_settings with one default row", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0007_settings.sql");

    const row = db.prepare("SELECT * FROM app_settings").get() as Record<string, number>;
    expect(row).toEqual({
      id: 1,
      rest_between_sets_seconds: 90,
      rest_between_exercises_seconds: 120,
      sound_countdown_enabled: 0,
      start_countdown_enabled: 0,
      keep_screen_awake_enabled: 1,
    });
  });

  it("rejects a second row (single-row table)", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));

    expect(() => db.prepare("INSERT INTO app_settings (id) VALUES (2)").run()).toThrow();
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run migrations/0007_settings.test.ts`
Expected: PASS (the SQL file already exists from Step 1 — this confirms it applies cleanly and the constraints hold).

- [ ] **Step 4: Commit**

```bash
git add migrations/0007_settings.sql migrations/0007_settings.test.ts
git commit -m "feat(settings): add app_settings migration"
```

---

## Task 2: `src/lib/settings/db.ts` — read/write layer

**Files:**
- Create: `src/lib/settings/db.ts`
- Test: `src/lib/settings/db.test.ts`

**Interfaces:**
- Consumes: `Database.Database` from `better-sqlite3`; the `app_settings` table from Task 1.
- Produces: `type AppSettings = { restBetweenSetsSeconds: number; restBetweenExercisesSeconds: number; soundCountdownEnabled: boolean; startCountdownEnabled: boolean; keepScreenAwakeEnabled: boolean }`, `getSettings(db): AppSettings`, `updateSettings(db, patch: Partial<AppSettings>): AppSettings`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/settings/db.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { getSettings, updateSettings } from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-settings-db-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("getSettings", () => {
  it("returns the migration defaults on a fresh database", () => {
    const db = setup();
    expect(getSettings(db)).toEqual({
      restBetweenSetsSeconds: 90,
      restBetweenExercisesSeconds: 120,
      soundCountdownEnabled: false,
      startCountdownEnabled: false,
      keepScreenAwakeEnabled: true,
    });
  });
});

describe("updateSettings", () => {
  it("updates only the given fields, leaving the rest untouched", () => {
    const db = setup();
    const result = updateSettings(db, { restBetweenSetsSeconds: 45 });
    expect(result.restBetweenSetsSeconds).toBe(45);
    expect(result.restBetweenExercisesSeconds).toBe(120);
  });

  it("round-trips a boolean toggle", () => {
    const db = setup();
    updateSettings(db, { keepScreenAwakeEnabled: false });
    expect(getSettings(db).keepScreenAwakeEnabled).toBe(false);
  });

  it("persists across separate reads (survives navigating away and back)", () => {
    const db = setup();
    updateSettings(db, { soundCountdownEnabled: true });
    expect(getSettings(db).soundCountdownEnabled).toBe(true);
    expect(getSettings(db).soundCountdownEnabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/settings/db.test.ts`
Expected: FAIL — `./db` has no exported member `getSettings`/`updateSettings` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/settings/db.ts
import type Database from "better-sqlite3";

export type AppSettings = {
  restBetweenSetsSeconds: number;
  restBetweenExercisesSeconds: number;
  soundCountdownEnabled: boolean;
  startCountdownEnabled: boolean;
  keepScreenAwakeEnabled: boolean;
};

type SettingsRow = {
  rest_between_sets_seconds: number;
  rest_between_exercises_seconds: number;
  sound_countdown_enabled: number;
  start_countdown_enabled: number;
  keep_screen_awake_enabled: number;
};

function toAppSettings(row: SettingsRow): AppSettings {
  return {
    restBetweenSetsSeconds: row.rest_between_sets_seconds,
    restBetweenExercisesSeconds: row.rest_between_exercises_seconds,
    soundCountdownEnabled: row.sound_countdown_enabled === 1,
    startCountdownEnabled: row.start_countdown_enabled === 1,
    keepScreenAwakeEnabled: row.keep_screen_awake_enabled === 1,
  };
}

export function getSettings(db: Database.Database): AppSettings {
  const row = db
    .prepare(
      `SELECT rest_between_sets_seconds, rest_between_exercises_seconds,
              sound_countdown_enabled, start_countdown_enabled, keep_screen_awake_enabled
       FROM app_settings WHERE id = 1`,
    )
    .get() as SettingsRow;
  return toAppSettings(row);
}

const COLUMN_BY_KEY: Record<keyof AppSettings, string> = {
  restBetweenSetsSeconds: "rest_between_sets_seconds",
  restBetweenExercisesSeconds: "rest_between_exercises_seconds",
  soundCountdownEnabled: "sound_countdown_enabled",
  startCountdownEnabled: "start_countdown_enabled",
  keepScreenAwakeEnabled: "keep_screen_awake_enabled",
};

export function updateSettings(db: Database.Database, patch: Partial<AppSettings>): AppSettings {
  const entries = Object.entries(patch) as [keyof AppSettings, number | boolean][];
  if (entries.length > 0) {
    const setClause = entries.map(([key]) => `${COLUMN_BY_KEY[key]} = ?`).join(", ");
    const values = entries.map(([, value]) => (typeof value === "boolean" ? (value ? 1 : 0) : value));
    db.prepare(`UPDATE app_settings SET ${setClause} WHERE id = 1`).run(...values);
  }
  return getSettings(db);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/settings/db.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings/db.ts src/lib/settings/db.test.ts
git commit -m "feat(settings): add getSettings/updateSettings"
```

---

## Task 3: `src/lib/settings/actions.ts` — Server Actions

**Files:**
- Create: `src/lib/settings/actions.ts`
- Test: `src/lib/settings/actions.test.ts`

**Interfaces:**
- Consumes: `getSettings`/`updateSettings`/`AppSettings` (Task 2); `getStartDate` from `src/lib/backpain/db.ts` (existing); `getDb` from `src/lib/db/client.ts` (existing); root `package.json`'s `version` field.
- Produces: `type ReglagesState = AppSettings & { dosStartDate: string | null; version: string }`, `getReglagesStateAction(): Promise<ReglagesState>`, `updateSettingsAction(patch: Partial<AppSettings>): Promise<AppSettings>`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/settings/actions.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { setStartDate } from "@/lib/backpain/db";
import { getSettings } from "./db";

let tmpDir: string;
let dbPath: string;

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-settings-actions-"));
  dbPath = path.join(tmpDir, "test.db");
  runMigrations(getDb(dbPath), path.join(process.cwd(), "migrations"));
  process.env.DB_PATH = dbPath;
});

afterAll(() => {
  delete process.env.DB_PATH;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("getReglagesStateAction", () => {
  it("bundles settings defaults, a null dos start date, and the app version", async () => {
    const { getReglagesStateAction } = await import("./actions");
    const state = await getReglagesStateAction();
    expect(state.restBetweenSetsSeconds).toBe(90);
    expect(state.dosStartDate).toBeNull();
    expect(state.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("reflects a dos start date once one is set", async () => {
    setStartDate(getDb(dbPath), "2026-08-10");
    const { getReglagesStateAction } = await import("./actions");
    const state = await getReglagesStateAction();
    expect(state.dosStartDate).toBe("2026-08-10");
  });
});

describe("updateSettingsAction", () => {
  it("writes the patch and returns the updated settings", async () => {
    const { updateSettingsAction } = await import("./actions");
    const result = await updateSettingsAction({ restBetweenExercisesSeconds: 75 });
    expect(result.restBetweenExercisesSeconds).toBe(75);
    expect(getSettings(getDb(dbPath)).restBetweenExercisesSeconds).toBe(75);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/settings/actions.test.ts`
Expected: FAIL — `./actions` module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/settings/actions.ts
"use server";

import type Database from "better-sqlite3";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { getStartDate } from "@/lib/backpain/db";
import { getSettings, updateSettings, type AppSettings } from "./db";
import packageJson from "../../../package.json";

let dbInstance: Database.Database | null = null;

function db(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
    dbInstance = getDb(dbPath);
  }
  return dbInstance;
}

export type ReglagesState = AppSettings & {
  dosStartDate: string | null;
  version: string;
};

export async function getReglagesStateAction(): Promise<ReglagesState> {
  const database = db();
  return {
    ...getSettings(database),
    dosStartDate: getStartDate(database),
    version: packageJson.version,
  };
}

export async function updateSettingsAction(patch: Partial<AppSettings>): Promise<AppSettings> {
  return updateSettings(db(), patch);
}
```

Note: `package.json`'s `version` is read via a direct JSON import (`resolveJsonModule` is already `true` in `tsconfig.json`), not `process.env.npm_package_version` — that env var is only populated when the process is launched through `npm run ...`, which is not how the systemd service starts the standalone build (`node .next/standalone/server.js` directly, per `DEPLOYMENT.md`) — it would silently read `undefined` in production.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/settings/actions.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings/actions.ts src/lib/settings/actions.test.ts
git commit -m "feat(settings): add getReglagesStateAction/updateSettingsAction"
```

---

## Task 4: `Toggle` component

**Files:**
- Create: `src/components/settings/Toggle.tsx`
- Test: `src/components/settings/Toggle.test.tsx`

**Interfaces:**
- Produces: `Toggle({ checked: boolean; onChange: (next: boolean) => void; label: string })` — a pill switch, `role="switch"`, `--ink` track when on, `--hairline` when off.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/settings/Toggle.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("reflects the checked state via aria-checked", () => {
    render(<Toggle checked={true} onChange={() => {}} label="Décompte sonore" />);
    expect(screen.getByRole("switch", { name: "Décompte sonore" })).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with the inverted value on click", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Décompte sonore" />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("shows the ink track when checked, hairline when not", () => {
    const { rerender } = render(<Toggle checked={true} onChange={() => {}} label="x" />);
    expect(screen.getByRole("switch")).toHaveClass("bg-ink");
    rerender(<Toggle checked={false} onChange={() => {}} label="x" />);
    expect(screen.getByRole("switch")).toHaveClass("bg-hairline");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/settings/Toggle.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/settings/Toggle.tsx
"use client";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-pill flex-none transition-colors ${checked ? "bg-ink" : "bg-hairline"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-paper transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/settings/Toggle.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/Toggle.tsx src/components/settings/Toggle.test.tsx
git commit -m "feat(settings): add Toggle"
```

---

## Task 5: `DurationRow` component

**Files:**
- Create: `src/components/settings/DurationRow.tsx`
- Test: `src/components/settings/DurationRow.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (`src/components/Sheet.tsx`), `Button` (`src/components/Button.tsx`) — both existing.
- Produces: `DurationRow({ label: string; valueSeconds: number; onConfirm: (nextSeconds: number) => void; divider?: boolean })` — a settings row that opens a stepper sheet (15s steps, 15s floor) on tap.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/settings/DurationRow.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DurationRow } from "./DurationRow";

describe("DurationRow", () => {
  it("shows the current value on the row", () => {
    render(<DurationRow label="Repos entre séries" valueSeconds={90} onConfirm={() => {}} />);
    expect(screen.getByText("90 s")).toBeInTheDocument();
  });

  it("opens a sheet prefilled with the current value on tap", async () => {
    render(<DurationRow label="Repos entre séries" valueSeconds={90} onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Repos entre séries" }));
    expect(screen.getByText("90")).toBeInTheDocument();
  });

  it("steps by 15s and never goes below the 15s floor", async () => {
    render(<DurationRow label="Repos entre séries" valueSeconds={15} onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Repos entre séries" }));
    await userEvent.click(screen.getByRole("button", { name: "−" }));
    expect(screen.getByText("15")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("confirms the draft value and closes the sheet", async () => {
    const onConfirm = vi.fn();
    render(<DurationRow label="Repos entre séries" valueSeconds={90} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Repos entre séries" }));
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onConfirm).toHaveBeenCalledWith(105);
    expect(screen.queryByRole("button", { name: "Valider" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/settings/DurationRow.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/settings/DurationRow.tsx
"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";

const STEP_SECONDS = 15;
const FLOOR_SECONDS = 15;

export function DurationRow({
  label,
  valueSeconds,
  onConfirm,
  divider = false,
}: {
  label: string;
  valueSeconds: number;
  onConfirm: (nextSeconds: number) => void;
  divider?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(valueSeconds);

  useEffect(() => {
    if (open) setDraft(valueSeconds);
  }, [open, valueSeconds]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full min-h-14 px-5 flex items-center justify-between gap-4 ${
          divider ? "border-t border-hairline" : ""
        }`}
      >
        <span className="text-15">{label}</span>
        <span className="font-archivo text-15 font-medium text-graphite tabular-nums">{valueSeconds} s</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className="flex flex-col items-center gap-1 py-4">
          <div className="flex items-center justify-center gap-6">
            <Button variant="secondary" onClick={() => setDraft((v) => Math.max(FLOOR_SECONDS, v - STEP_SECONDS))}>
              −
            </Button>
            <span className="font-archivo text-44 font-semibold tabular-nums w-24 text-center">{draft}</span>
            <Button variant="secondary" onClick={() => setDraft((v) => v + STEP_SECONDS)}>
              +
            </Button>
          </div>
          <span className="text-13 text-graphite">secondes</span>
        </div>
        <Button
          variant="primary"
          accent="cobalt"
          onClick={() => {
            onConfirm(draft);
            setOpen(false);
          }}
        >
          Valider
        </Button>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/settings/DurationRow.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/DurationRow.tsx src/components/settings/DurationRow.test.tsx
git commit -m "feat(settings): add DurationRow"
```

---

## Task 6: `ReglagesScreen`

**Files:**
- Create: `src/components/settings/ReglagesScreen.tsx`
- Test: `src/components/settings/ReglagesScreen.test.tsx`

**Interfaces:**
- Consumes: `getReglagesStateAction`, `updateSettingsAction`, `ReglagesState` (Task 3); `Toggle` (Task 4); `DurationRow` (Task 5); `IconClose` (`src/components/icons/IconClose.tsx`, existing); `IconChevronRight` (`src/components/icons/IconChevronRight.tsx`, existing).
- Produces: `ReglagesScreen({ onClose: () => void; onChangePointDepart: () => void; programmePosition: { parcoursLabel: string; level: number; dayIndex: number } | null })`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/settings/ReglagesScreen.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReglagesScreen } from "./ReglagesScreen";

const getReglagesStateAction = vi.fn();
const updateSettingsAction = vi.fn();
vi.mock("@/lib/settings/actions", () => ({
  getReglagesStateAction: (...args: unknown[]) => getReglagesStateAction(...args),
  updateSettingsAction: (...args: unknown[]) => updateSettingsAction(...args),
}));

const BASE_STATE = {
  restBetweenSetsSeconds: 90,
  restBetweenExercisesSeconds: 120,
  soundCountdownEnabled: false,
  startCountdownEnabled: false,
  keepScreenAwakeEnabled: true,
  dosStartDate: null,
  version: "0.1.0",
};

describe("ReglagesScreen", () => {
  it("loads settings on mount and renders all five groups", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    render(<ReglagesScreen onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("90 s")).toBeInTheDocument());
    expect(screen.getByText("Programme")).toBeInTheDocument();
    expect(screen.getByText("Séance")).toBeInTheDocument();
    expect(screen.getByText("BackPain")).toBeInTheDocument();
    expect(screen.getByText("Données")).toBeInTheDocument();
    expect(screen.getByText("À propos")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
  });

  it("shows programme position when provided, a placeholder otherwise", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    render(
      <ReglagesScreen
        onClose={() => {}}
        onChangePointDepart={() => {}}
        programmePosition={{ parcoursLabel: "Débutant", level: 2, dayIndex: 4 }}
      />,
    );
    await waitFor(() => expect(screen.getByText("Débutant")).toBeInTheDocument());
    expect(screen.getByText("Niveau 3 · Jour 5")).toBeInTheDocument();
  });

  it("calls onChangePointDepart when the row is tapped", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    const onChangePointDepart = vi.fn();
    render(<ReglagesScreen onClose={() => {}} onChangePointDepart={onChangePointDepart} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("Changer mon point de départ")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Changer mon point de départ" }));
    expect(onChangePointDepart).toHaveBeenCalledOnce();
  });

  it("edits a rest duration through the DurationRow sheet", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    updateSettingsAction.mockResolvedValue({ ...BASE_STATE, restBetweenSetsSeconds: 105 });
    render(<ReglagesScreen onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("90 s")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Repos entre séries" }));
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(updateSettingsAction).toHaveBeenCalledWith({ restBetweenSetsSeconds: 105 });
    await waitFor(() => expect(screen.getByText("105 s")).toBeInTheDocument());
  });

  it("toggles garder l'écran allumé", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    updateSettingsAction.mockResolvedValue({ ...BASE_STATE, keepScreenAwakeEnabled: false });
    render(<ReglagesScreen onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("Garder l'écran allumé")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("switch", { name: "Garder l'écran allumé" }));
    expect(updateSettingsAction).toHaveBeenCalledWith({ keepScreenAwakeEnabled: false });
  });

  it("renders the Données rows disabled with a Bientôt disponible sub-label", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    render(<ReglagesScreen onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getAllByText("Bientôt disponible")).toHaveLength(2));
  });

  it("shows an error state with a retry button when loading fails", async () => {
    getReglagesStateAction.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(BASE_STATE);
    render(<ReglagesScreen onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("Impossible de charger les réglages.")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(screen.getByText("90 s")).toBeInTheDocument());
  });

  it("calls onClose when the close button is tapped", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    const onClose = vi.fn();
    render(<ReglagesScreen onClose={onClose} onChangePointDepart={() => {}} programmePosition={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  // Mandatory persistence check (CLAUDE.md §2/§7): a value edited in one
  // mount must still be there after the overlay unmounts and remounts —
  // ReglagesScreen must re-read from the action on every mount, never
  // reuse whatever it had in memory before.
  it("survives an unmount/remount cycle after an edit (reads fresh, not from memory)", async () => {
    getReglagesStateAction.mockResolvedValueOnce(BASE_STATE).mockResolvedValueOnce({
      ...BASE_STATE,
      restBetweenSetsSeconds: 105,
    });
    updateSettingsAction.mockResolvedValue({ ...BASE_STATE, restBetweenSetsSeconds: 105 });

    const { unmount } = render(
      <ReglagesScreen onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />,
    );
    await waitFor(() => expect(screen.getByText("90 s")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Repos entre séries" }));
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    await waitFor(() => expect(screen.getByText("105 s")).toBeInTheDocument());
    unmount();

    render(<ReglagesScreen onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />);
    await waitFor(() => expect(screen.getByText("105 s")).toBeInTheDocument());
    expect(getReglagesStateAction).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/settings/ReglagesScreen.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/settings/ReglagesScreen.tsx
"use client";

import { useEffect, useState } from "react";
import { IconClose } from "@/components/icons/IconClose";
import { IconChevronRight } from "@/components/icons/IconChevronRight";
import { Toggle } from "./Toggle";
import { DurationRow } from "./DurationRow";
import { getReglagesStateAction, updateSettingsAction, type ReglagesState } from "@/lib/settings/actions";

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export function ReglagesScreen({
  onClose,
  onChangePointDepart,
  programmePosition,
}: {
  onClose: () => void;
  onChangePointDepart: () => void;
  programmePosition: { parcoursLabel: string; level: number; dayIndex: number } | null;
}) {
  const [state, setState] = useState<ReglagesState | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    getReglagesStateAction()
      .then(setState)
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patch(update: Partial<Omit<ReglagesState, "dosStartDate" | "version">>) {
    const next = await updateSettingsAction(update);
    setState((prev) => (prev ? { ...prev, ...next } : prev));
  }

  return (
    <div className="fixed inset-0 z-50 bg-canvas flex flex-col">
      <div className="flex-none p-5 flex items-center justify-between gap-4">
        <span className="font-archivo text-24 font-semibold">Réglages</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="w-11 h-11 rounded-pill border border-hairline bg-paper flex items-center justify-center"
        >
          <IconClose />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 flex flex-col gap-8">
        {error && (
          <div className="bg-paper border border-hairline rounded-card p-6">
            <p className="text-15 text-graphite">Impossible de charger les réglages.</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 h-11 px-5 rounded-pill bg-ink text-paper font-archivo text-15 font-semibold"
            >
              Réessayer
            </button>
          </div>
        )}

        {!error && !state && (
          <div className="flex flex-col gap-8">
            <div className="h-40 rounded-card bg-paper border border-hairline animate-pulse" />
            <div className="h-40 rounded-card bg-paper border border-hairline animate-pulse" />
          </div>
        )}

        {state && (
          <>
            <section>
              <h2 className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
                Programme
              </h2>
              <div className="bg-paper border border-hairline rounded-card overflow-hidden">
                <div className="min-h-14 px-5 flex items-center justify-between gap-4">
                  <span className="text-15">Parcours actif</span>
                  <span className="font-archivo text-15 font-medium text-graphite">
                    {programmePosition?.parcoursLabel ?? "Non défini"}
                  </span>
                </div>
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline">
                  <span className="text-15">Position</span>
                  <span className="font-archivo text-15 font-medium text-graphite tabular-nums">
                    {programmePosition
                      ? `Niveau ${programmePosition.level + 1} · Jour ${programmePosition.dayIndex + 1}`
                      : "—"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onChangePointDepart}
                  className="w-full min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline"
                >
                  <span className="text-15">Changer mon point de départ</span>
                  <IconChevronRight className="text-graphite flex-none" />
                </button>
              </div>
            </section>

            <section>
              <h2 className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
                Séance
              </h2>
              <div className="bg-paper border border-hairline rounded-card overflow-hidden">
                <DurationRow
                  label="Repos entre séries"
                  valueSeconds={state.restBetweenSetsSeconds}
                  onConfirm={(v) => patch({ restBetweenSetsSeconds: v })}
                />
                <DurationRow
                  label="Repos entre exercices"
                  valueSeconds={state.restBetweenExercisesSeconds}
                  onConfirm={(v) => patch({ restBetweenExercisesSeconds: v })}
                  divider
                />
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline">
                  <span className="text-15">Décompte sonore</span>
                  <Toggle
                    checked={state.soundCountdownEnabled}
                    onChange={(v) => patch({ soundCountdownEnabled: v })}
                    label="Décompte sonore"
                  />
                </div>
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline">
                  <span className="text-15">Compte à rebours</span>
                  <Toggle
                    checked={state.startCountdownEnabled}
                    onChange={(v) => patch({ startCountdownEnabled: v })}
                    label="Compte à rebours"
                  />
                </div>
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline">
                  <span className="text-15">Garder l&apos;écran allumé</span>
                  <Toggle
                    checked={state.keepScreenAwakeEnabled}
                    onChange={(v) => patch({ keepScreenAwakeEnabled: v })}
                    label="Garder l'écran allumé"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
                BackPain
              </h2>
              <div className="bg-paper border border-hairline rounded-card overflow-hidden">
                <div className="min-h-14 px-5 flex items-center justify-between gap-4">
                  <span className="text-15">Début de cycle</span>
                  <span className="font-archivo text-15 font-medium text-graphite">
                    {state.dosStartDate ? formatDateFr(state.dosStartDate) : "Non défini"}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
                Données
              </h2>
              <div className="bg-paper border border-hairline rounded-card overflow-hidden">
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 opacity-40">
                  <span className="text-15">
                    Exporter
                    <span className="block text-13 text-graphite mt-0.5">Bientôt disponible</span>
                  </span>
                </div>
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline opacity-40">
                  <span className="text-15 text-alert">
                    Réinitialiser la progression
                    <span className="block text-13 text-graphite mt-0.5">Bientôt disponible</span>
                  </span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
                À propos
              </h2>
              <div className="bg-paper border border-hairline rounded-card overflow-hidden">
                <div className="min-h-14 px-5 flex items-center justify-between gap-4">
                  <span className="text-15">Version</span>
                  <span className="font-archivo text-15 font-medium text-graphite tabular-nums">{state.version}</span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/settings/ReglagesScreen.test.tsx`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/ReglagesScreen.tsx src/components/settings/ReglagesScreen.test.tsx
git commit -m "feat(settings): add ReglagesScreen"
```

---

## Task 7: Aujourd'hui header + wiring Réglages into `AujourdhuiScreen`

**Files:**
- Create: `src/components/today/AujourdhuiHeader.tsx`
- Test: `src/components/today/AujourdhuiHeader.test.tsx`
- Modify: `src/components/today/AujourdhuiScreen.tsx`
- Modify: `src/components/today/AujourdhuiScreen.test.tsx`

**Interfaces:**
- Consumes: `IconSettings` (`src/components/icons/IconSettings.tsx`, existing, currently unused); `ReglagesScreen` (Task 6); `SetupFlow` (existing, `src/components/setup/SetupFlow.tsx`).
- Produces: `AujourdhuiHeader({ onOpenReglages: () => void })`. `AujourdhuiScreen` gains a `reglagesOpen` local state and renders the header at the top of every phase.

- [ ] **Step 1: Write the failing tests for `AujourdhuiHeader`**

```tsx
// src/components/today/AujourdhuiHeader.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AujourdhuiHeader } from "./AujourdhuiHeader";

describe("AujourdhuiHeader", () => {
  it("shows the greeting and opens réglages on icon click", async () => {
    const onOpenReglages = vi.fn();
    render(<AujourdhuiHeader onOpenReglages={onOpenReglages} />);
    expect(screen.getByText("Salut Mathis.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    expect(onOpenReglages).toHaveBeenCalledOnce();
  });

  it("fills in the date label after mount", async () => {
    render(<AujourdhuiHeader onOpenReglages={() => {}} />);
    const raw = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(
      new Date(),
    );
    const expected = raw.charAt(0).toUpperCase() + raw.slice(1);
    await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/today/AujourdhuiHeader.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write `AujourdhuiHeader`**

```tsx
// src/components/today/AujourdhuiHeader.tsx
"use client";

import { useEffect, useState } from "react";
import { IconSettings } from "@/components/icons/IconSettings";

function formatTodayLabel(): string {
  const raw = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(),
  );
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Filled in an effect, not at render time: the server render (VM, likely
// UTC) and the client hydration pass (browser, Europe/Paris) can disagree
// on "today" right around local midnight — same class of bug as the
// trophies UTC/local day mix noted in this project's migration history.
// Seeding blank and filling client-side avoids both the hydration
// mismatch and a wrong date.
export function AujourdhuiHeader({ onOpenReglages }: { onOpenReglages: () => void }) {
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    setDateLabel(formatTodayLabel());
  }, []);

  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite">
          {dateLabel}
        </span>
        <div className="font-archivo text-32 font-semibold leading-[1.05] mt-2">Salut Mathis.</div>
      </div>
      <button
        type="button"
        onClick={onOpenReglages}
        aria-label="Réglages"
        className="w-11 h-11 rounded-pill border border-hairline bg-paper flex items-center justify-center flex-none"
      >
        <IconSettings />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run `AujourdhuiHeader` tests to verify they pass**

Run: `npx vitest run src/components/today/AujourdhuiHeader.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Add the failing wiring tests to `AujourdhuiScreen.test.tsx`**

Add this mock near the top of the file, alongside the two existing `vi.mock` calls:

```ts
vi.mock("@/lib/settings/actions", () => ({
  getReglagesStateAction: vi.fn().mockResolvedValue({
    restBetweenSetsSeconds: 90,
    restBetweenExercisesSeconds: 120,
    soundCountdownEnabled: false,
    startCountdownEnabled: false,
    keepScreenAwakeEnabled: true,
    dosStartDate: null,
    version: "0.1.0",
  }),
  updateSettingsAction: vi.fn(),
}));
```

Add these two tests inside the existing `describe("AujourdhuiScreen", ...)` block:

```tsx
it("opens Réglages from the header icon and closes it", async () => {
  const state: TodayState = {
    phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
    dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
    durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
  };
  render(<AujourdhuiScreen state={state} dosState={DOS_NORMAL} />);
  await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
  expect(screen.getByText("Réglages")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
  expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();
});

it("Changer mon point de départ inside Réglages closes it and opens SetupFlow", async () => {
  const state: TodayState = {
    phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
    dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
    durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
  };
  render(<AujourdhuiScreen state={state} dosState={DOS_NORMAL} />);
  await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
  await waitFor(() => expect(screen.getByText("Changer mon point de départ")).toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: "Changer mon point de départ" }));
  expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
});
```

Add `waitFor` to the existing `import { render, screen } from "@testing-library/react";` line, making it `import { render, screen, waitFor } from "@testing-library/react";`.

- [ ] **Step 6: Run `AujourdhuiScreen` tests to verify the two new ones fail**

Run: `npx vitest run src/components/today/AujourdhuiScreen.test.tsx`
Expected: The two new tests FAIL (no "Réglages" button rendered yet); the pre-existing tests still PASS.

- [ ] **Step 7: Wire `ReglagesScreen` and the header into `AujourdhuiScreen`**

In `src/components/today/AujourdhuiScreen.tsx`, add imports:

```tsx
import { AujourdhuiHeader } from "./AujourdhuiHeader";
import { ReglagesScreen } from "@/components/settings/ReglagesScreen";
```

Add a second piece of state right after the existing `const [setupOpen, setSetupOpen] = useState(false);`:

```tsx
const [reglagesOpen, setReglagesOpen] = useState(false);
```

Add this branch immediately after the existing `if (setupOpen) { return <SetupFlow onClose={() => setSetupOpen(false)} />; }` block:

```tsx
if (reglagesOpen) {
  return (
    <ReglagesScreen
      onClose={() => setReglagesOpen(false)}
      onChangePointDepart={() => {
        setReglagesOpen(false);
        setSetupOpen(true);
      }}
      programmePosition={
        state.phase === "normal"
          ? { parcoursLabel: state.parcoursLabel, level: state.level, dayIndex: state.dayIndex }
          : null
      }
    />
  );
}
```

Then add `<AujourdhuiHeader onOpenReglages={() => setReglagesOpen(true)} />` as the first child inside each of the three remaining return blocks' wrapping `<div>` (the `phase === "empty"` block, the `phase === "level-up"` block, and the final `phase === "normal"` return) — immediately after the opening `<div className="p-5" ...>` (or `<div className="p-5 flex flex-col gap-8">`) tag in each.

- [ ] **Step 8: Run all `AujourdhuiScreen` and `AujourdhuiHeader` tests to verify they pass**

Run: `npx vitest run src/components/today/AujourdhuiScreen.test.tsx src/components/today/AujourdhuiHeader.test.tsx`
Expected: PASS (all pre-existing tests still pass, the 2 new wiring tests pass, the 2 `AujourdhuiHeader` tests pass)

- [ ] **Step 9: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS (all tests, including everything from before this plan)

- [ ] **Step 10: Commit**

```bash
git add src/components/today/AujourdhuiHeader.tsx src/components/today/AujourdhuiHeader.test.tsx src/components/today/AujourdhuiScreen.tsx src/components/today/AujourdhuiScreen.test.tsx
git commit -m "feat(today): add header and wire Réglages into Aujourd'hui"
```

---

## Task 8: `useWakeLock` hook

**Files:**
- Create: `src/lib/player/useWakeLock.ts`
- Test: `src/lib/player/useWakeLock.test.ts`

**Interfaces:**
- Produces: `useWakeLock(enabled: boolean): void` — requests `navigator.wakeLock` while `enabled` is true and the tab is visible; releases on unmount, on `enabled` going false, and re-acquires on the tab returning to foreground; no-ops (no throw) when `navigator.wakeLock` is unsupported.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/player/useWakeLock.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWakeLock } from "./useWakeLock";

const requestMock = vi.fn();

beforeEach(() => {
  requestMock.mockReset();
});

afterEach(() => {
  // @ts-expect-error test-only cleanup of a property this test suite adds
  delete navigator.wakeLock;
});

describe("useWakeLock", () => {
  it("requests a screen wake lock when enabled and supported", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    requestMock.mockResolvedValue({ release });
    Object.defineProperty(navigator, "wakeLock", { value: { request: requestMock }, configurable: true });

    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalledWith("screen"));
  });

  it("releases the lock on unmount", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    requestMock.mockResolvedValue({ release });
    Object.defineProperty(navigator, "wakeLock", { value: { request: requestMock }, configurable: true });

    const { unmount } = renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalled());
    unmount();
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
  });

  it("does not request a lock when disabled", () => {
    Object.defineProperty(navigator, "wakeLock", { value: { request: requestMock }, configurable: true });
    renderHook(() => useWakeLock(false));
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("does not throw when navigator.wakeLock is unsupported", () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
    expect(requestMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/player/useWakeLock.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/player/useWakeLock.ts
"use client";

import { useEffect } from "react";

type WakeLockSentinel = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // Request can be rejected (e.g. document not visible yet) — the
        // player still works without the lock, this is a comfort feature.
      }
    }

    acquire();

    function handleVisibilityChange() {
      // The browser releases the lock automatically when the tab goes to
      // background — notably on Chrome iOS (CLAUDE.md §3). Re-request on
      // return to foreground, or the screen can silently re-lock.
      if (document.visibilityState === "visible" && !sentinel) {
        acquire();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sentinel?.release();
      sentinel = null;
    };
  }, [enabled]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/player/useWakeLock.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/useWakeLock.ts src/lib/player/useWakeLock.test.ts
git commit -m "feat(player): add useWakeLock"
```

---

## Task 9: Wire settings into `PlayerScreen` and both player pages

**Files:**
- Modify: `src/components/player/PlayerScreen.tsx`
- Modify: `src/components/player/PlayerScreen.test.tsx`
- Modify: `src/app/player/page.tsx`
- Modify: `src/app/player/dos/page.tsx`

**Interfaces:**
- Consumes: `useWakeLock` (Task 8); `getSettings` (Task 2).
- Produces: `PlayerScreen` gains an optional `keepScreenAwakeEnabled?: boolean` prop (default `true`, matching the migration default).

- [ ] **Step 1: Add the failing test to `PlayerScreen.test.tsx`**

Add this test inside the existing `describe("PlayerScreen", ...)` block (reuses the `DAY`/`STARTED_AT`/`actionProps` fixtures already defined at the top of the file):

```tsx
it("requests a wake lock by default, and not at all when keepScreenAwakeEnabled=false", async () => {
  const requestMock = vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) });
  Object.defineProperty(navigator, "wakeLock", { value: { request: requestMock }, configurable: true });

  const state: PlayerState = {
    phase: "in-progress",
    seanceId: 1,
    startedAt: STARTED_AT,
    next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false },
    skippedExerciseOrders: [],
  };
  const { unmount } = render(<PlayerScreen day={DAY} state={state} setsLogged={[]} {...actionProps()} />);
  await vi.waitFor(() => expect(requestMock).toHaveBeenCalledWith("screen"));
  unmount();

  requestMock.mockClear();
  render(
    <PlayerScreen day={DAY} state={state} setsLogged={[]} keepScreenAwakeEnabled={false} {...actionProps()} />,
  );
  expect(requestMock).not.toHaveBeenCalled();

  // @ts-expect-error test-only cleanup of a property this test adds
  delete navigator.wakeLock;
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/player/PlayerScreen.test.tsx`
Expected: FAIL — `keepScreenAwakeEnabled` prop doesn't exist / no wake lock request happens yet.

- [ ] **Step 3: Wire `useWakeLock` into `PlayerScreen`**

In `src/components/player/PlayerScreen.tsx`, add the import:

```tsx
import { useWakeLock } from "@/lib/player/useWakeLock";
```

Add `keepScreenAwakeEnabled = true` to the destructured props and its type:

```tsx
export function PlayerScreen({
  day,
  state,
  setsLogged,
  allTimeTotals = [],
  accent = "cobalt",
  restBetweenSetsSeconds = REST_BETWEEN_SETS_SECONDS,
  restBetweenExercisesSeconds = REST_BETWEEN_EXERCISES_SECONDS,
  keepScreenAwakeEnabled = true,
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
  keepScreenAwakeEnabled?: boolean;
  onLogSet: (params: LogSetParams) => Promise<void>;
  onSkipExercise: (seanceId: number, exerciseOrder: number) => Promise<void>;
  onSeanceFinish: (seanceId: number) => Promise<void>;
}) {
  const router = useRouter();
  useWakeLock(keepScreenAwakeEnabled);
  const [localPhase, setLocalPhase] = useState<LocalPhase>({ kind: "exercise" });
```

(Only the `keepScreenAwakeEnabled` prop/type lines and the `useWakeLock(keepScreenAwakeEnabled);` line are new — everything else in that block is existing code shown for placement context.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/player/PlayerScreen.test.tsx`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 5: Wire settings into `src/app/player/page.tsx`**

Add the import:

```tsx
import { getSettings } from "@/lib/settings/db";
```

After `const db = getDb(dbPath());`, add:

```tsx
const settings = getSettings(db);
```

Add three props to the `<PlayerScreen ... />` call:

```tsx
<PlayerScreen
  day={day}
  state={state}
  setsLogged={setsLogged}
  allTimeTotals={allTimeTotals}
  restBetweenSetsSeconds={settings.restBetweenSetsSeconds}
  restBetweenExercisesSeconds={settings.restBetweenExercisesSeconds}
  keepScreenAwakeEnabled={settings.keepScreenAwakeEnabled}
  onLogSet={logSetAction}
  onSkipExercise={skipExerciseAction}
  onSeanceFinish={completeSeanceAction}
/>
```

- [ ] **Step 6: Wire `keepScreenAwakeEnabled` into `src/app/player/dos/page.tsx`**

Dos keeps its own domain-specific `restSeconds` (from `getDosRestSeconds`, unchanged) — only the wake-screen setting is shared. Add the import:

```tsx
import { getSettings } from "@/lib/settings/db";
```

After `const db = getDb(dbPath());`, add:

```tsx
const settings = getSettings(db);
```

Add `keepScreenAwakeEnabled={settings.keepScreenAwakeEnabled}` to the `<PlayerScreen ... />` call:

```tsx
<PlayerScreen
  day={day}
  state={state}
  setsLogged={setsLogged}
  allTimeTotals={allTimeTotals}
  accent="sage"
  restBetweenSetsSeconds={restSeconds}
  restBetweenExercisesSeconds={restSeconds}
  keepScreenAwakeEnabled={settings.keepScreenAwakeEnabled}
  onLogSet={logDosSetAction}
  onSkipExercise={skipDosExerciseAction}
  onSeanceFinish={startDosBilanAction}
/>
```

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — every test in the repo, old and new.

- [ ] **Step 8: Manual check (Wake Lock has no headless test coverage for the real browser API)**

Run: `npm run dev`, open `/player?parcours=beginner&level=0&day=0` in Chrome, open DevTools → More tools → Sensors is not needed; instead confirm no console errors and that `navigator.wakeLock` is requested by checking DevTools → Application → Background Services, or simply trust the unit-tested hook — this is a smoke check, not a new automated test.

- [ ] **Step 9: Commit**

```bash
git add src/components/player/PlayerScreen.tsx src/components/player/PlayerScreen.test.tsx src/app/player/page.tsx src/app/player/dos/page.tsx
git commit -m "feat(player): wire settings-backed rest durations and wake lock"
```

---

## Final check

- [ ] Run `npx vitest run` once more — full green.
- [ ] Run `npx tsc --noEmit` — no type errors (the `packageJson` import in Task 3 and the new component props are the main new surface area to check).
- [ ] Start `npm run dev`, open Aujourd'hui, confirm: header shows today's date + "Salut Mathis." + réglages icon; tapping it opens Réglages with all five groups; editing "Repos entre séries" changes the value in a player session started afterward; toggling "Garder l'écran allumé" off and starting a séance does not request a wake lock (no console error either way); "Changer mon point de départ" closes Réglages and opens the existing 3-step setup flow.
