# Multi-utilisateur — Clément — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second user (Clément) to SportCompanion, isolated from Mathis's data, with a new "Tracking" module (freeform workout logger) replacing the Dos module in his nav.

**Architecture:** One SQLite file per user (`data/sportcompanion.db` for Mathis, unchanged; `data/sportcompanion.clement.db` for Clément), selected server-side per request by reading the `Cf-Access-Authenticated-User-Email` header Cloudflare Access injects. A new `getDbForUser()` cache in `src/lib/db/client.ts` replaces the ~8 duplicated per-file DB singletons. Nav, Aujourd'hui, and Trophées become user-aware (Dos hidden for Clément, Tracking hidden for Mathis). A new `src/lib/tracking/` module mirrors the existing `src/lib/dos/` module's shape but with no fixed program — free exercise names, saved incrementally, reps only.

**Tech Stack:** Next.js 16 (App Router, TypeScript, Server Components/Actions), `better-sqlite3`, Vitest + Testing Library.

## Global Constraints

- Français partout (UI et écriture), tutoiement, zéro jargon technique, l'app constate — jamais de coaching motivationnel (`CLAUDE.md` §4).
- Aucune couleur en dur dans un composant produit — toujours via la prop `accent`/le token existant. Tracking réutilise l'accent **Sauge** (même emplacement de nav que Dos), aucun nouveau token.
- `MATHIS_EMAIL` / `CLEMENT_EMAIL` ne sont **jamais commitées** — uniquement dans `.env.local` (dev, gitignored) ou `.env` sur la VM (prod, jamais synced). Aucun step de ce plan n'écrit une vraie adresse email dans un fichier suivi par git.
- Isolation des données : un fichier SQLite par utilisateur, pas de colonne `user_id`. Toute nouvelle table Tracking est créée par migration versionnée, appliquée aux deux fichiers DB.
- `headers()` (next/headers) est asynchrone (`await headers()`) et lève une erreur hors d'un contexte de requête (script, build, test non mocké) — `currentUser()` doit absorber ce cas et retomber sur Mathis, pas laisser l'erreur remonter.
- Cibles tactiles ≥ 44px (56px pour les actions primaires), rayons 20px (cartes) / 14px (champs) / 999px (pastilles).
- Chaque module suit l'état affiché doit toujours être lu depuis la source de vérité (DB), jamais reconstruit côté client (`CLAUDE.md` §2) — toute nouvelle interaction Tracking écrit en DB immédiatement, pas de brouillon client.

---

### Task 1: Identité utilisateur — `src/lib/auth/`

**Files:**
- Create: `src/lib/auth/users.ts`
- Create: `src/lib/auth/users.test.ts`
- Create: `src/lib/auth/currentUser.ts`
- Create: `src/lib/auth/currentUser.test.ts`

**Interfaces:**
- Produces: `export type UserSlug = "mathis" | "clement"`; `export type UserProfile = { slug: UserSlug; label: string; email: string | undefined; dbPath: string }`; `export function knownUsers(): UserProfile[]`; `export async function currentUser(): Promise<UserProfile>`. Every later task that needs the DB or the nav variant consumes `currentUser()`.

- [ ] **Step 1: Write `users.ts`**

```ts
// src/lib/auth/users.ts
import path from "node:path";

export type UserSlug = "mathis" | "clement";

export type UserProfile = {
  slug: UserSlug;
  label: string;
  email: string | undefined;
  dbPath: string;
};

function dataDir(): string {
  const dbPath = process.env.DB_PATH;
  return dbPath ? path.dirname(dbPath) : path.join(process.cwd(), "data");
}

export function knownUsers(): UserProfile[] {
  const dir = dataDir();
  const users: UserProfile[] = [
    {
      slug: "mathis",
      label: "Mathis",
      email: process.env.MATHIS_EMAIL,
      dbPath: process.env.DB_PATH ?? path.join(dir, "sportcompanion.db"),
    },
  ];
  if (process.env.CLEMENT_EMAIL) {
    users.push({
      slug: "clement",
      label: "Clément",
      email: process.env.CLEMENT_EMAIL,
      dbPath: path.join(dir, "sportcompanion.clement.db"),
    });
  }
  return users;
}
```

- [ ] **Step 2: Write `users.test.ts`**

```ts
// src/lib/auth/users.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { knownUsers } from "./users";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.DB_PATH;
  delete process.env.MATHIS_EMAIL;
  delete process.env.CLEMENT_EMAIL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("knownUsers", () => {
  it("returns only Mathis when CLEMENT_EMAIL is unset", () => {
    const users = knownUsers();
    expect(users.map((u) => u.slug)).toEqual(["mathis"]);
  });

  it("defaults Mathis's dbPath to data/sportcompanion.db under cwd", () => {
    const users = knownUsers();
    expect(users[0]!.dbPath).toBe(path.join(process.cwd(), "data", "sportcompanion.db"));
  });

  it("uses DB_PATH for Mathis and derives Clément's path as a sibling file", () => {
    process.env.DB_PATH = "/srv/app/data/sportcompanion.db";
    process.env.CLEMENT_EMAIL = "clement@example.com";
    const users = knownUsers();
    expect(users.find((u) => u.slug === "mathis")!.dbPath).toBe("/srv/app/data/sportcompanion.db");
    expect(users.find((u) => u.slug === "clement")!.dbPath).toBe("/srv/app/data/sportcompanion.clement.db");
  });

  it("includes Clément once CLEMENT_EMAIL is set, carrying the configured email", () => {
    process.env.CLEMENT_EMAIL = "clement@example.com";
    const users = knownUsers();
    const clement = users.find((u) => u.slug === "clement");
    expect(clement).toBeDefined();
    expect(clement!.email).toBe("clement@example.com");
    expect(clement!.label).toBe("Clément");
  });
});
```

- [ ] **Step 3: Run the tests, verify pass**

Run: `npx vitest run src/lib/auth/users.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 4: Write `currentUser.ts`**

```ts
// src/lib/auth/currentUser.ts
import { headers } from "next/headers";
import { knownUsers, type UserProfile } from "./users";

const HEADER_NAME = "cf-access-authenticated-user-email";

// Dev-only override so Mathis can preview Clément's screens locally: no
// Cloudflare Access sits in front of `next dev`, so the CF header this
// function reads never arrives outside of production. Never set this in
// deploy/sportcompanion.service.
function devForcedUser(): UserProfile | undefined {
  const slug = process.env.DEV_FORCE_USER_SLUG;
  if (!slug) return undefined;
  return knownUsers().find((u) => u.slug === slug);
}

export async function currentUser(): Promise<UserProfile> {
  const forced = devForcedUser();
  if (forced) return forced;

  const users = knownUsers();
  const mathis = users[0]!;

  let email: string | null = null;
  try {
    email = (await headers()).get(HEADER_NAME);
  } catch {
    // No active request scope (a script, a build, or a test that hasn't
    // mocked next/headers) — equivalent to Cloudflare Access not sitting
    // in front: fall back to Mathis, same as local dev today.
    email = null;
  }

  if (!email) return mathis;

  const match = users.find((u) => u.email === email);
  if (!match) throw new Error(`Accès non reconnu : ${email}`);
  return match;
}

export type { UserProfile as CurrentUser };
```

- [ ] **Step 5: Write `currentUser.test.ts`**

```ts
// src/lib/auth/currentUser.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({ headers: () => headersMock() }));

import { currentUser } from "./currentUser";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.MATHIS_EMAIL = "mathis@example.com";
  process.env.CLEMENT_EMAIL = "clement@example.com";
  delete process.env.DEV_FORCE_USER_SLUG;
  headersMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("currentUser", () => {
  it("resolves Mathis when the header matches MATHIS_EMAIL", async () => {
    headersMock.mockResolvedValue(new Headers({ [`cf-access-authenticated-user-email`]: "mathis@example.com" }));
    const user = await currentUser();
    expect(user.slug).toBe("mathis");
  });

  it("resolves Clément when the header matches CLEMENT_EMAIL", async () => {
    headersMock.mockResolvedValue(new Headers({ "cf-access-authenticated-user-email": "clement@example.com" }));
    const user = await currentUser();
    expect(user.slug).toBe("clement");
  });

  it("falls back to Mathis when the header is absent", async () => {
    headersMock.mockResolvedValue(new Headers());
    const user = await currentUser();
    expect(user.slug).toBe("mathis");
  });

  it("falls back to Mathis when headers() throws (no request scope)", async () => {
    headersMock.mockImplementation(() => {
      throw new Error("`headers` was called outside a request scope");
    });
    const user = await currentUser();
    expect(user.slug).toBe("mathis");
  });

  it("throws for a header email that matches no known user", async () => {
    headersMock.mockResolvedValue(new Headers({ "cf-access-authenticated-user-email": "intrus@example.com" }));
    await expect(currentUser()).rejects.toThrow("Accès non reconnu");
  });

  it("DEV_FORCE_USER_SLUG bypasses headers entirely", async () => {
    process.env.DEV_FORCE_USER_SLUG = "clement";
    const user = await currentUser();
    expect(user.slug).toBe("clement");
    expect(headersMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run the tests, verify pass**

Run: `npx vitest run src/lib/auth`
Expected: all 10 tests PASS (4 from `users.test.ts`, 6 from `currentUser.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth
git commit -m "feat(auth): ajoute la résolution de l'utilisateur courant via Cloudflare Access"
```

---

### Task 2: `getDbForUser()` + migration de tous les points d'appel existants + gardes de route Dos

This task has no new product behavior — it rewires every existing page/action to resolve its DB connection per-user instead of from a single `DB_PATH` env var, and adds a route guard so Clément can never reach `/dos` or `/player/dos*`. The full existing test suite is the safety net: it must stay green throughout.

**Files:**
- Modify: `src/lib/db/client.ts`
- Modify: `src/lib/db/client.test.ts`
- Modify: `src/app/(shell)/page.tsx`
- Modify: `src/app/(shell)/programme/page.tsx`
- Modify: `src/app/(shell)/dos/page.tsx`
- Modify: `src/app/(shell)/trophees/page.tsx`
- Modify: `src/app/(shell)/trophees/[exerciseId]/page.tsx`
- Modify: `src/app/player/page.tsx`
- Modify: `src/app/player/dos/page.tsx`
- Modify: `src/app/player/dos/bilan/page.tsx`
- Modify: `src/lib/programme/actions.ts`
- Modify: `src/lib/dos/actions.ts`
- Modify: `src/lib/player/actions.ts`
- Modify: `src/lib/settings/actions.ts`

**Interfaces:**
- Consumes: `currentUser(): Promise<UserProfile>` from Task 1 (`src/lib/auth/currentUser.ts`).
- Produces: `export function getDbForUser(user: { dbPath: string }): Database.Database` in `src/lib/db/client.ts`, cached by `dbPath` — every later task's pages/actions use this instead of `getDb(dbPath())`.

- [ ] **Step 1: Add `getDbForUser` to `client.ts`**

```ts
// src/lib/db/client.ts
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function getDb(dbPath: string): Database.Database {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

const dbByPath = new Map<string, Database.Database>();

export function getDbForUser(user: { dbPath: string }): Database.Database {
  let db = dbByPath.get(user.dbPath);
  if (!db) {
    db = getDb(user.dbPath);
    dbByPath.set(user.dbPath, db);
  }
  return db;
}
```

- [ ] **Step 2: Add tests to `client.test.ts`**

Append to the existing `describe("getDb", ...)` block a new block:

```ts
import { getDb, getDbForUser } from "./client";

describe("getDbForUser", () => {
  it("returns the same connection for the same dbPath", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-db-"));
    const dbPath = path.join(tmpDir, "test.db");
    const first = getDbForUser({ dbPath });
    const second = getDbForUser({ dbPath });
    expect(second).toBe(first);
  });

  it("returns distinct connections for distinct dbPaths", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-db-"));
    const a = getDbForUser({ dbPath: path.join(tmpDir, "a.db") });
    const b = getDbForUser({ dbPath: path.join(tmpDir, "b.db") });
    expect(a).not.toBe(b);
  });
});
```

(Keep the existing `import { getDb } from "./client"` — add `getDbForUser` to the same import line rather than duplicating it.)

- [ ] **Step 3: Run the tests, verify pass**

Run: `npx vitest run src/lib/db/client.test.ts`
Expected: original 2 tests + new 2 tests PASS (4 total).

- [ ] **Step 4: Migrate the 7 page files**

For each file below, remove the local `dbPath()` helper and its `path` import, replace the `getDb(dbPath())` call with `currentUser()` + `getDbForUser()`, and make the component `async` where it wasn't already.

`src/app/(shell)/page.tsx`:

```tsx
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTodayState } from "@/lib/programme/loadTodayState";
import { loadDosTodayState } from "@/lib/dos/loadDosTodayState";
import { PARCOURS } from "@/lib/programme/parcours";
import { AujourdhuiScreen } from "@/components/today/AujourdhuiScreen";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await currentUser();
  const db = getDbForUser(user);
  const state = loadTodayState(db, PARCOURS);
  const dosState = user.slug === "mathis" ? loadDosTodayState(db) : null;
  return <AujourdhuiScreen state={state} dosState={dosState} user={{ slug: user.slug, label: user.label }} />;
}
```

(`AujourdhuiScreen`'s new `dosState: DosTodayState | null` and `user` props are wired in Task 7 — this step only changes how the page resolves its DB and computes `dosState`/`user`.)

`src/app/(shell)/programme/page.tsx` (becomes `async`):

```tsx
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadProgrammeState } from "@/lib/programme/loadProgrammeState";
import { PARCOURS } from "@/lib/programme/parcours";
import { ProgrammeScreen } from "@/components/programme/ProgrammeScreen";

export const dynamic = "force-dynamic";

export default async function ProgrammePage() {
  const db = getDbForUser(await currentUser());
  const levelsByParcours = Object.fromEntries(
    PARCOURS.map((p) => [p.id, loadProgrammeState(db, p)]),
  );
  return <ProgrammeScreen initialParcours="beginner" levelsByParcours={levelsByParcours} />;
}
```

`src/app/(shell)/dos/page.tsx` (adds the route guard):

```tsx
import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadDosScreenState } from "@/lib/dos/loadDosScreenState";
import { DosScreen } from "@/components/dos/DosScreen";

export const dynamic = "force-dynamic";

export default async function DosPage() {
  const user = await currentUser();
  if (user.slug !== "mathis") redirect("/");
  const db = getDbForUser(user);
  const state = loadDosScreenState(db);
  return <DosScreen state={state} />;
}
```

`src/app/(shell)/trophees/page.tsx` (becomes `async`; `secondModule` wired in Task 8 — for now just resolve `db`):

```tsx
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";
import { TropheesScreen } from "@/components/trophies/TropheesScreen";

export const dynamic = "force-dynamic";

export default async function TropheesPage() {
  const db = getDbForUser(await currentUser());
  const state = loadTropheesScreenState(db);
  return <TropheesScreen state={state} />;
}
```

`src/app/(shell)/trophees/[exerciseId]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTrophyDetail } from "@/lib/trophies/loadTrophyDetail";
import { Card } from "@/components/Card";
import { IconClose } from "@/components/icons/IconClose";

export const dynamic = "force-dynamic";

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
  const db = getDbForUser(await currentUser());
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
                : `${detail.resteAParcourir} restants pour atteindre ${detail.prochainPalier}`}
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

`src/app/player/page.tsx` (only the `dbPath`/`getDb` lines change — rest of the file is unchanged, shown in full for clarity):

```tsx
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSettings } from "@/lib/settings/db";
import { loadPlayerState } from "@/lib/player/loadPlayerState";
import { getSetsForSeance } from "@/lib/player/db";
import { logSetAction, skipExerciseAction, completeSeanceAction } from "@/lib/player/actions";
import { beginner, intermediate, advanced } from "@/lib/workout/data";
import type { Program } from "@/lib/workout/types";
import { PlayerScreen } from "@/components/player/PlayerScreen";
import { computeTrophies, resolveTrophyCardId, isReplogEligible } from "@/lib/trophies/computeTrophies";

const PROGRAMS: Record<string, Program> = { beginner, intermediate, advanced };

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

  const db = getDbForUser(await currentUser());
  const settings = getSettings(db);
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
      restBetweenSetsSeconds={settings.restBetweenSetsSeconds}
      restBetweenExercisesSeconds={settings.restBetweenExercisesSeconds}
      keepScreenAwakeEnabled={settings.keepScreenAwakeEnabled}
      onLogSet={logSetAction}
      onSkipExercise={skipExerciseAction}
      onSeanceFinish={completeSeanceAction}
    />
  );
}
```

`src/app/player/dos/page.tsx` (adds the route guard; rest unchanged):

```tsx
import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSettings } from "@/lib/settings/db";
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

export default async function DosPlayerPage() {
  const user = await currentUser();
  if (user.slug !== "mathis") redirect("/");
  const db = getDbForUser(user);
  const settings = getSettings(db);
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
      keepScreenAwakeEnabled={settings.keepScreenAwakeEnabled}
      onLogSet={logDosSetAction}
      onSkipExercise={skipDosExerciseAction}
      onSeanceFinish={startDosBilanAction}
    />
  );
}
```

`src/app/player/dos/bilan/page.tsx` (adds the route guard; rest unchanged):

```tsx
import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getEvaluations } from "@/lib/backpain/db";
import { getCurrentCran } from "@/lib/backpain/progression";
import { computeBlock } from "@/lib/backpain/periode";
import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { getDosSeanceById, getSkippedDosExercises } from "@/lib/dos/db";
import { buildDosDay, ARBRES_DU_JOUR } from "@/lib/dos/buildDosDay";
import { completeDosSeanceAction } from "@/lib/dos/actions";
import { ARBRE_EXERCISE_ID } from "@/lib/dos/bilan";
import { BilanDosClient } from "@/components/dos/BilanDosClient";

export const dynamic = "force-dynamic";

export default async function DosBilanPage({
  searchParams,
}: {
  searchParams: Promise<{ seanceId?: string }>;
}) {
  const user = await currentUser();
  if (user.slug !== "mathis") redirect("/");

  const params = await searchParams;
  const seanceId = Number(params.seanceId);
  const db = getDbForUser(user);
  const seance = getDosSeanceById(db, seanceId);

  if (!seance) {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Séance introuvable.</p>
      </main>
    );
  }

  const jourSemaine = seance.jourSemaine as keyof typeof ARBRES_DU_JOUR;
  const jourArbres = ARBRES_DU_JOUR[jourSemaine] ?? [];
  const evaluations = getEvaluations(db);
  const cranCourant = {} as Record<ArbreId, number>;
  for (const arbre of jourArbres) {
    cranCourant[arbre] = getCurrentCran(evaluations, arbre);
  }

  const day = buildDosDay(jourSemaine, computeBlock(seance.semaine), cranCourant);
  const skipped = new Set(getSkippedDosExercises(db, seanceId));
  const skippedArbres = new Set(
    day.exercises
      .map((exercise, exerciseOrder) => ({ exercise, exerciseOrder }))
      .filter(({ exerciseOrder }) => skipped.has(exerciseOrder))
      .map(({ exercise }) => exercise.id.match(ARBRE_EXERCISE_ID)?.[1])
      .filter((arbre): arbre is ArbreId => arbre !== undefined),
  );

  const arbres = jourArbres
    .filter((arbre) => !skippedArbres.has(arbre))
    .map((arbre) => {
      const cran = cranCourant[arbre];
      return { arbre, nom: ARBRES[arbre].crans[cran - 1]!.nom };
    });

  return <BilanDosClient seanceId={seanceId} arbres={arbres} completeAction={completeDosSeanceAction} />;
}
```

- [ ] **Step 5: Migrate the 4 actions files**

Same transformation in each: replace the module-level `let dbInstance` + sync `db()` helper with an async `db()` that resolves the user first. Only the top of each file changes — the exported action bodies keep calling `db()`, now with `await`.

`src/lib/programme/actions.ts`:

```ts
"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { setCurrentPosition } from "./db";
import { getParcours } from "./parcours";

async function db() {
  return getDbForUser(await currentUser());
}

export async function setCurrentPositionAction(
  parcours: string,
  level: number,
  dayIndex: number,
): Promise<void> {
  setCurrentPosition(await db(), parcours, level, dayIndex);
}

export async function resolveLevelUpAction(
  choice: "advance" | "redo",
  parcours: string,
  level: number,
): Promise<void> {
  const levelCount = getParcours(parcours)?.levelCount ?? level + 1;
  const nextLevel = choice === "advance" ? Math.min(level + 1, levelCount - 1) : level;
  setCurrentPosition(await db(), parcours, nextLevel, 0);
}
```

`src/lib/dos/actions.ts` (only the top changes — every `db()` call site below becomes `await db()`, the rest of the file is unchanged):

```ts
"use server";

import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
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

async function db() {
  return getDbForUser(await currentUser());
}

export async function setStartDateAction(date: string): Promise<void> {
  setStartDate(await db(), date);
}

export async function logDosSetAction(params: {
  seanceId: number;
  exerciseOrder: number;
  exerciseId: string;
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
}): Promise<void> {
  logDosSet(await db(), {
    seanceId: params.seanceId,
    exerciseOrder: params.exerciseOrder,
    exerciseId: params.exerciseId,
    setNumber: params.setNumber,
    valeurTarget: params.repsTarget,
    valeurActual: params.repsActual,
    restSeconds: params.restSeconds,
  });
}

export async function skipDosExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipDosExercise(await db(), seanceId, exerciseOrder);
}

export async function startDosBilanAction(seanceId: number): Promise<never> {
  redirect(`/player/dos/bilan?seanceId=${seanceId}`);
}

export async function completeDosSeanceAction(
  seanceId: number,
  genePendant: number,
  reserves: Partial<Record<ArbreId, Reserve>>,
): Promise<{ arbre: ArbreId; nom: string; message: string }[]> {
  const database = await db();
  const seance = getDosSeanceById(database, seanceId)!;

  if (seance.completedAt) {
    return [];
  }

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

`src/lib/player/actions.ts`:

```ts
"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import {
  logSet as logSetDb,
  skipExercise as skipExerciseDb,
  completeSeance as completeSeanceDb,
} from "./db";

async function db() {
  return getDbForUser(await currentUser());
}

export async function logSetAction(params: {
  seanceId: number;
  exerciseOrder: number;
  exerciseId: string;
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
}): Promise<void> {
  const { exerciseId: _exerciseId, ...dbParams } = params;
  logSetDb(await db(), dbParams);
}

export async function skipExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipExerciseDb(await db(), seanceId, exerciseOrder);
}

export async function completeSeanceAction(seanceId: number): Promise<void> {
  completeSeanceDb(await db(), seanceId);
}
```

`src/lib/settings/actions.ts`:

```ts
"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getStartDate } from "@/lib/backpain/db";
import { getSettings, updateSettings, type AppSettings } from "./db";
import packageJson from "../../../package.json";

async function db() {
  return getDbForUser(await currentUser());
}

export type ReglagesState = AppSettings & {
  dosStartDate: string | null;
  version: string;
};

export async function getReglagesStateAction(): Promise<ReglagesState> {
  const database = await db();
  return {
    ...getSettings(database),
    dosStartDate: getStartDate(database),
    version: packageJson.version,
  };
}

export async function updateSettingsAction(patch: Partial<AppSettings>): Promise<AppSettings> {
  return updateSettings(await db(), patch);
}
```

- [ ] **Step 6: Run the full test suite, verify nothing broke**

Run: `npm test`
Expected: every existing test still PASSES. `currentUser()`'s try/catch around `headers()` (Task 1) is what keeps `programme/actions.test.ts` and any other test calling these actions directly working unmodified — outside a Next.js request scope, `headers()` throws, `currentUser()` catches it and falls back to Mathis, and Mathis's `dbPath` still comes from `process.env.DB_PATH` exactly as these tests already set it.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/client.ts src/lib/db/client.test.ts \
  "src/app/(shell)/page.tsx" "src/app/(shell)/programme/page.tsx" "src/app/(shell)/dos/page.tsx" \
  "src/app/(shell)/trophees/page.tsx" "src/app/(shell)/trophees/[exerciseId]/page.tsx" \
  src/app/player/page.tsx src/app/player/dos/page.tsx src/app/player/dos/bilan/page.tsx \
  src/lib/programme/actions.ts src/lib/dos/actions.ts src/lib/player/actions.ts src/lib/settings/actions.ts
git commit -m "refactor(db): résout la connexion DB par utilisateur, garde les routes Dos derrière Mathis"
```

---

### Task 3: Migration SQL Tracking

**Files:**
- Create: `migrations/0008_tracking.sql`
- Create: `migrations/0008_tracking.test.ts`

**Interfaces:**
- Produces: tables `tracking_exercises`, `tracking_seances`, `tracking_sets_logged` — consumed by Task 4's `src/lib/tracking/db.ts`.

- [ ] **Step 1: Write the migration**

```sql
-- migrations/0008_tracking.sql
CREATE TABLE tracking_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE tracking_seances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE tracking_sets_logged (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id INTEGER NOT NULL REFERENCES tracking_seances(id),
  exercise_id INTEGER NOT NULL REFERENCES tracking_exercises(id),
  exercise_order INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  reps_actual INTEGER NOT NULL,
  completed_at TEXT NOT NULL
);
```

- [ ] **Step 2: Write the migration test**

```ts
// migrations/0008_tracking.test.ts
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

describe("0008_tracking migration", () => {
  it("creates the three tracking tables, empty", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0008_tracking.sql");

    expect(db.prepare("SELECT COUNT(*) AS n FROM tracking_exercises").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM tracking_seances").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM tracking_sets_logged").get()).toEqual({ n: 0 });
  });

  it("rejects a duplicate exercise name", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));

    db.prepare("INSERT INTO tracking_exercises (name, created_at) VALUES (?, ?)").run("Squats", "2026-08-13T00:00:00.000Z");
    expect(() =>
      db.prepare("INSERT INTO tracking_exercises (name, created_at) VALUES (?, ?)").run("Squats", "2026-08-13T00:00:00.000Z"),
    ).toThrow();
  });
});
```

- [ ] **Step 3: Run the tests, verify pass**

Run: `npx vitest run migrations/0008_tracking.test.ts`
Expected: both tests PASS.

- [ ] **Step 4: Commit**

```bash
git add migrations/0008_tracking.sql migrations/0008_tracking.test.ts
git commit -m "feat(db): ajoute les tables du module Tracking"
```

---

### Task 4: Couche données + actions Tracking

**Files:**
- Create: `src/lib/tracking/db.ts`
- Create: `src/lib/tracking/db.test.ts`
- Create: `src/lib/tracking/actions.ts`

**Interfaces:**
- Consumes: `getDbForUser`, `currentUser` (Task 1/2), `tracking_*` tables (Task 3).
- Produces: `TrackingExercise`, `TrackingSeance`, `TrackingSetWithExercise`, `TrackingSeanceSummary` types; `findOrCreateExercise`, `listExerciseNames`, `getActiveSeance`, `startSeance`, `getOrStartSeance`, `getSeanceById`, `getSetsForSeance`, `logSetForExercise`, `completeSeance`, `listCompletedSeances` from `db.ts`; `startTrackingSeanceAction`, `logTrackingSetAction`, `completeTrackingSeanceAction`, `listTrackingExerciseNamesAction` from `actions.ts` — consumed by Task 5 (Trophées), Task 9 and Task 10 (screens).

- [ ] **Step 1: Write the failing tests for `db.ts`**

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
  listExerciseNames,
  getActiveSeance,
  startSeance,
  getOrStartSeance,
  getSeanceById,
  getSetsForSeance,
  logSetForExercise,
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
  it("creates a new exercise on first use", () => {
    const db = setup();
    const exercise = findOrCreateExercise(db, "Squats");
    expect(exercise.name).toBe("Squats");
  });

  it("returns the same row on a second call with the same name", () => {
    const db = setup();
    const first = findOrCreateExercise(db, "Squats");
    const second = findOrCreateExercise(db, "Squats");
    expect(second.id).toBe(first.id);
  });
});

describe("listExerciseNames", () => {
  it("lists distinct exercise names alphabetically", () => {
    const db = setup();
    findOrCreateExercise(db, "Squats");
    findOrCreateExercise(db, "Développé couché");
    expect(listExerciseNames(db)).toEqual(["Développé couché", "Squats"]);
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
});

describe("logSetForExercise", () => {
  it("logs a first set at exerciseOrder 0, setNumber 1", () => {
    const db = setup();
    const seance = startSeance(db);
    const set = logSetForExercise(db, seance.id, "Squats", 12);
    expect(set).toMatchObject({ seanceId: seance.id, exerciseName: "Squats", exerciseOrder: 0, setNumber: 1, repsActual: 12 });
  });

  it("increments setNumber for a second set of the same exercise, keeps exerciseOrder", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", 12);
    const second = logSetForExercise(db, seance.id, "Squats", 10);
    expect(second).toMatchObject({ exerciseOrder: 0, setNumber: 2 });
  });

  it("assigns the next exerciseOrder to a second distinct exercise in the same seance", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", 12);
    const secondExercise = logSetForExercise(db, seance.id, "Fentes", 10);
    expect(secondExercise).toMatchObject({ exerciseOrder: 1, setNumber: 1 });
  });

  it("reuses the same tracking_exercises row across seances", () => {
    const db = setup();
    const seanceA = startSeance(db);
    const setA = logSetForExercise(db, seanceA.id, "Squats", 12);
    completeSeance(db, seanceA.id);
    const seanceB = startSeance(db);
    const setB = logSetForExercise(db, seanceB.id, "Squats", 8);
    expect(setB.exerciseId).toBe(setA.exerciseId);
  });
});

describe("getSetsForSeance", () => {
  it("returns sets in insertion order, joined with the exercise name", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", 12);
    logSetForExercise(db, seance.id, "Squats", 10);
    const sets = getSetsForSeance(db, seance.id);
    expect(sets.map((s) => s.repsActual)).toEqual([12, 10]);
    expect(sets.every((s) => s.exerciseName === "Squats")).toBe(true);
  });
});

describe("listCompletedSeances", () => {
  it("excludes the active (uncompleted) seance", () => {
    const db = setup();
    startSeance(db);
    expect(listCompletedSeances(db)).toEqual([]);
  });

  it("summarizes total reps and exercise count, most recent first", () => {
    const db = setup();
    const seanceA = startSeance(db);
    logSetForExercise(db, seanceA.id, "Squats", 12);
    logSetForExercise(db, seanceA.id, "Fentes", 10);
    completeSeance(db, seanceA.id);

    const seanceB = startSeance(db);
    logSetForExercise(db, seanceB.id, "Squats", 8);
    completeSeance(db, seanceB.id);

    const summaries = listCompletedSeances(db);
    expect(summaries).toHaveLength(2);
    expect(summaries[0]!.id).toBe(seanceB.id);
    expect(summaries[1]).toMatchObject({ id: seanceA.id, totalReps: 22, exerciseCount: 2 });
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/tracking/db.test.ts`
Expected: FAIL — `./db` has no exported members (file doesn't exist yet).

- [ ] **Step 3: Write `db.ts`**

```ts
// src/lib/tracking/db.ts
import type Database from "better-sqlite3";

export type TrackingExercise = { id: number; name: string; createdAt: string };
export type TrackingSeance = { id: number; startedAt: string; completedAt: string | null };
export type TrackingSetWithExercise = {
  id: number;
  seanceId: number;
  exerciseId: number;
  exerciseName: string;
  exerciseOrder: number;
  setNumber: number;
  repsActual: number;
  completedAt: string;
};
export type TrackingSeanceSummary = {
  id: number;
  startedAt: string;
  completedAt: string;
  totalReps: number;
  exerciseCount: number;
};

export function findOrCreateExercise(db: Database.Database, name: string): TrackingExercise {
  const existing = db.prepare(`SELECT id, name, created_at AS createdAt FROM tracking_exercises WHERE name = ?`).get(name) as
    | TrackingExercise
    | undefined;
  if (existing) return existing;

  const createdAt = new Date().toISOString();
  const result = db.prepare(`INSERT INTO tracking_exercises (name, created_at) VALUES (?, ?)`).run(name, createdAt);
  return { id: Number(result.lastInsertRowid), name, createdAt };
}

export function listExerciseNames(db: Database.Database): string[] {
  const rows = db.prepare(`SELECT name FROM tracking_exercises ORDER BY name COLLATE NOCASE`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

function mapSeance(row: { id: number; started_at: string; completed_at: string | null }): TrackingSeance {
  return { id: row.id, startedAt: row.started_at, completedAt: row.completed_at };
}

export function getActiveSeance(db: Database.Database): TrackingSeance | null {
  const row = db
    .prepare(`SELECT * FROM tracking_seances WHERE completed_at IS NULL ORDER BY started_at DESC LIMIT 1`)
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
      `SELECT tsl.id, tsl.seance_id AS seanceId, tsl.exercise_id AS exerciseId, te.name AS exerciseName,
              tsl.exercise_order AS exerciseOrder, tsl.set_number AS setNumber, tsl.reps_actual AS repsActual,
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
  repsActual: number,
): TrackingSetWithExercise {
  const exercise = findOrCreateExercise(db, exerciseName);
  const seanceSets = getSetsForSeance(db, seanceId);
  const exerciseSets = seanceSets.filter((s) => s.exerciseId === exercise.id);
  const exerciseOrder =
    exerciseSets[0]?.exerciseOrder ?? 1 + seanceSets.reduce((max, s) => Math.max(max, s.exerciseOrder), -1);
  const setNumber = exerciseSets.length + 1;

  const completedAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO tracking_sets_logged (seance_id, exercise_id, exercise_order, set_number, reps_actual, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(seanceId, exercise.id, exerciseOrder, setNumber, repsActual, completedAt);

  return {
    id: Number(result.lastInsertRowid),
    seanceId,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    exerciseOrder,
    setNumber,
    repsActual,
    completedAt,
  };
}

export function completeSeance(db: Database.Database, seanceId: number): void {
  db.prepare(`UPDATE tracking_seances SET completed_at = ? WHERE id = ?`).run(new Date().toISOString(), seanceId);
}

export function listCompletedSeances(db: Database.Database): TrackingSeanceSummary[] {
  return db
    .prepare(
      `SELECT s.id, s.started_at AS startedAt, s.completed_at AS completedAt,
              COALESCE(SUM(sl.reps_actual), 0) AS totalReps,
              COUNT(DISTINCT sl.exercise_id) AS exerciseCount
       FROM tracking_seances s
       LEFT JOIN tracking_sets_logged sl ON sl.seance_id = s.id
       WHERE s.completed_at IS NOT NULL
       GROUP BY s.id
       ORDER BY s.completed_at DESC`,
    )
    .all() as TrackingSeanceSummary[];
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/lib/tracking/db.test.ts`
Expected: all 13 tests PASS.

- [ ] **Step 5: Write `actions.ts`** (thin wrapper — no dedicated test file, matching `src/lib/dos/actions.ts` / `src/lib/player/actions.ts`, which also have no `.test.ts`; the logic worth testing already lives in `db.ts` above)

```ts
// src/lib/tracking/actions.ts
"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import {
  getOrStartSeance,
  logSetForExercise,
  completeSeance as completeSeanceDb,
  listExerciseNames as listExerciseNamesDb,
  type TrackingSetWithExercise,
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
  repsActual: number;
}): Promise<TrackingSetWithExercise> {
  return logSetForExercise(await db(), params.seanceId, params.exerciseName, params.repsActual);
}

export async function completeTrackingSeanceAction(seanceId: number): Promise<void> {
  completeSeanceDb(await db(), seanceId);
}

export async function listTrackingExerciseNamesAction(): Promise<string[]> {
  return listExerciseNamesDb(await db());
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/tracking/db.ts src/lib/tracking/db.test.ts src/lib/tracking/actions.ts
git commit -m "feat(tracking): ajoute la couche données et les actions du module Tracking"
```

---

### Task 5: Trophées inclut Tracking

**Files:**
- Modify: `src/lib/trophies/computeTrophies.ts`
- Modify: `src/lib/trophies/computeTrophies.test.ts`
- Modify: `src/lib/trophies/loadTropheesScreenState.ts`

**Interfaces:**
- Consumes: `tracking_sets_logged`/`tracking_exercises` (Task 3).
- Produces: `TrophyCard.module` widened to `"programme" | "dos" | "tracking"` — consumed by Task 8 (`TropheesScreen`) and unchanged by `TrophyCard.tsx` (its `hasImage` check already only special-cases `"programme"`).

- [ ] **Step 1: Write the failing tests**

Add to `computeTrophies.test.ts` (after the existing `describe("computeTrophies — Dos", ...)` block):

```ts
import { logSetForExercise, startSeance as startTrackingSeance } from "@/lib/tracking/db";

describe("computeTrophies — Tracking", () => {
  it("creates one card per tracking exercise, cumulating reps across seances", () => {
    const db = setup();
    const seanceA = startTrackingSeance(db);
    logSetForExercise(db, seanceA.id, "Squats", 12);
    const seanceB = startTrackingSeance(db);
    logSetForExercise(db, seanceB.id, "Squats", 8);

    const cards = computeTrophies(db);
    const squats = cards.find((c) => c.name === "Squats" && c.module === "tracking");
    expect(squats).toMatchObject({ module: "tracking", name: "Squats", total: 20 });
  });

  it("keeps distinct tracking exercises as separate cards", () => {
    const db = setup();
    const seance = startTrackingSeance(db);
    logSetForExercise(db, seance.id, "Squats", 12);
    logSetForExercise(db, seance.id, "Fentes", 10);

    const cards = computeTrophies(db).filter((c) => c.module === "tracking");
    expect(cards).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/trophies/computeTrophies.test.ts`
Expected: FAIL — no card has `module: "tracking"` yet (tracking rows aren't queried).

- [ ] **Step 3: Extend `computeTrophies.ts`**

Widen the type and append the tracking source. Add this block right after the existing `dosRows` loop (before the `return [...acc.entries()]...` line), and widen `TrophyCard["module"]`:

```ts
export type TrophyCard = {
  id: string;
  module: "programme" | "dos" | "tracking";
  name: string;
  total: number;
  firstAt: string;
  lastAt: string;
  byCran?: { cran: number; nom: string; total: number }[];
};
```

```ts
  const trackingRows = db
    .prepare(
      `SELECT tsl.exercise_id AS exerciseId, te.name AS exerciseName, tsl.reps_actual AS repsActual, tsl.completed_at AS completedAt
       FROM tracking_sets_logged tsl JOIN tracking_exercises te ON tsl.exercise_id = te.id`,
    )
    .all() as { exerciseId: number; exerciseName: string; repsActual: number; completedAt: string }[];

  for (const row of trackingRows) {
    const id = `tracking-${row.exerciseId}`;
    let entry = acc.get(id);
    if (!entry) {
      entry = {
        module: "tracking",
        name: row.exerciseName,
        total: 0,
        firstAt: row.completedAt,
        lastAt: row.completedAt,
        byCran: new Map(),
      };
      acc.set(id, entry);
    }
    touch(entry, row.repsActual, row.completedAt);
  }
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/lib/trophies/computeTrophies.test.ts`
Expected: all tests PASS (original Programme/Dos tests + the 2 new Tracking tests).

- [ ] **Step 5: Extend `loadTropheesScreenState.ts`'s SQL to count Tracking séances**

```ts
  const seanceRow = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM seances WHERE completed_at IS NOT NULL) +
         (SELECT COUNT(*) FROM dos_seances WHERE completed_at IS NOT NULL) +
         (SELECT COUNT(*) FROM tracking_seances WHERE completed_at IS NOT NULL) AS seanceCount`,
    )
    .get() as { seanceCount: number };

  const joursRow = db
    .prepare(
      `SELECT COUNT(DISTINCT jour) AS joursActivite FROM (
         SELECT date(completed_at) AS jour FROM seances WHERE completed_at IS NOT NULL
         UNION
         SELECT date AS jour FROM dos_seances WHERE completed_at IS NOT NULL
         UNION
         SELECT date(completed_at) AS jour FROM tracking_seances WHERE completed_at IS NOT NULL
       )`,
    )
    .get() as { joursActivite: number };
```

(Replace the two existing `db.prepare(...)` blocks in `loadTropheesScreenState` with these — everything else in the file is unchanged.)

- [ ] **Step 6: Run the trophies test suite**

Run: `npx vitest run src/lib/trophies`
Expected: all tests PASS (no existing `loadTropheesScreenState.test.ts` assertion depends on the exact SQL text, only on counts — Mathis's tracking tables stay empty, so his counts are unaffected).

- [ ] **Step 7: Commit**

```bash
git add src/lib/trophies/computeTrophies.ts src/lib/trophies/computeTrophies.test.ts src/lib/trophies/loadTropheesScreenState.ts
git commit -m "feat(trophies): cumule aussi les répétitions loguées dans Tracking"
```

---

### Task 6: Nav + layout user-aware

**Files:**
- Create: `src/components/icons/IconTracking.tsx`
- Modify: `src/components/AppNav.tsx`
- Create: `src/components/AppNav.test.tsx`
- Modify: `src/app/(shell)/layout.tsx`

**Interfaces:**
- Consumes: `currentUser()` (Task 1), `UserSlug` (Task 1).
- Produces: `AppNav({ userSlug }: { userSlug: UserSlug })` — layout is the only caller.

- [ ] **Step 1: Write `IconTracking.tsx`**

```tsx
// src/components/icons/IconTracking.tsx
import { Icon } from "../Icon";

export function IconTracking({ active, size, className }: { active: boolean; size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" strokeWidth={active ? 3 : 1.5} />
      <path d="M9 9h6" strokeWidth={active ? 3 : 1.5} />
      <path d="M9 13h6" strokeWidth={active ? 3 : 1.5} />
      <path d="M9 17h3" strokeWidth={active ? 3 : 1.5} />
    </Icon>
  );
}
```

- [ ] **Step 2: Write the failing test for `AppNav`**

```tsx
// src/components/AppNav.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { AppNav } from "./AppNav";

describe("AppNav", () => {
  it("shows Dos, not Tracking, for Mathis", () => {
    render(<AppNav userSlug="mathis" />);
    expect(screen.getByRole("link", { name: "Dos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tracking" })).not.toBeInTheDocument();
  });

  it("shows Tracking, not Dos, for Clément", () => {
    render(<AppNav userSlug="clement" />);
    expect(screen.getByRole("link", { name: "Tracking" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dos" })).not.toBeInTheDocument();
  });

  it("both variants keep Aujourd'hui, Programme, Trophées", () => {
    render(<AppNav userSlug="clement" />);
    expect(screen.getByRole("link", { name: "Aujourd'hui" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Programme" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trophées" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `npx vitest run src/components/AppNav.test.tsx`
Expected: FAIL — `AppNav` doesn't accept a `userSlug` prop yet, still always renders "Dos".

- [ ] **Step 4: Update `AppNav.tsx`**

```tsx
// src/components/AppNav.tsx
"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { IconToday } from "@/components/icons/IconToday";
import { IconProgram } from "@/components/icons/IconProgram";
import { IconDos } from "@/components/icons/IconDos";
import { IconTracking } from "@/components/icons/IconTracking";
import { IconTrophy } from "@/components/icons/IconTrophy";
import type { UserSlug } from "@/lib/auth/users";

const MATHIS_ITEMS = [
  { label: "Aujourd'hui", href: "/", Icon: IconToday },
  { label: "Programme", href: "/programme", Icon: IconProgram },
  { label: "Dos", href: "/dos", Icon: IconDos },
  { label: "Trophées", href: "/trophees", Icon: IconTrophy },
];

const CLEMENT_ITEMS = [
  { label: "Aujourd'hui", href: "/", Icon: IconToday },
  { label: "Programme", href: "/programme", Icon: IconProgram },
  { label: "Tracking", href: "/tracking", Icon: IconTracking },
  { label: "Trophées", href: "/trophees", Icon: IconTrophy },
];

export function AppNav({ userSlug }: { userSlug: UserSlug }) {
  const pathname = usePathname();
  const items = userSlug === "clement" ? CLEMENT_ITEMS : MATHIS_ITEMS;
  return (
    <BottomNav
      items={items.map((item) => {
        const active = pathname === item.href;
        return { label: item.label, href: item.href, active, icon: <item.Icon active={active} /> };
      })}
    />
  );
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npx vitest run src/components/AppNav.test.tsx`
Expected: all 3 tests PASS.

- [ ] **Step 6: Update `layout.tsx`**

```tsx
// src/app/(shell)/layout.tsx
import { AppNav } from "@/components/AppNav";
import { currentUser } from "@/lib/auth/currentUser";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <div className="lg:flex lg:justify-center">
      <div className="lg:flex lg:w-full lg:max-w-[calc(520px+5rem)]">
        <AppNav userSlug={user.slug} />
        <main className="pb-24 lg:pb-0 lg:flex-1 lg:max-w-[520px]">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/icons/IconTracking.tsx src/components/AppNav.tsx src/components/AppNav.test.tsx "src/app/(shell)/layout.tsx"
git commit -m "feat(nav): la barre de navigation dépend de l'utilisateur connecté"
```

---

### Task 7: Aujourd'hui personnalisé (prénom, Dos masqué pour Clément, Réglages sans section BackPain)

**Files:**
- Modify: `src/components/today/AujourdhuiHeader.tsx`
- Modify: `src/components/today/AujourdhuiHeader.test.tsx`
- Modify: `src/components/today/AujourdhuiScreen.tsx`
- Modify: `src/components/today/AujourdhuiScreen.test.tsx`
- Modify: `src/components/settings/ReglagesScreen.tsx`
- Modify: `src/components/settings/ReglagesScreen.test.tsx`
- (`src/app/(shell)/page.tsx` already wired in Task 2, Step 4 — no further change here)

**Interfaces:**
- Consumes: `UserSlug` (Task 1), `DosTodayState | null` (existing type, now nullable at this boundary).
- Produces: `AujourdhuiHeader({ userLabel, onOpenReglages })`; `AujourdhuiScreen({ state, dosState, user })` where `user: { slug: UserSlug; label: string }`; `ReglagesScreen({ ..., userSlug })`.

- [ ] **Step 1: Update `AujourdhuiHeader.tsx`**

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

export function AujourdhuiHeader({
  userLabel,
  onOpenReglages,
}: {
  userLabel: string;
  onOpenReglages: () => void;
}) {
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    setDateLabel(formatTodayLabel());
  }, []);

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite">
          {dateLabel}
        </span>
        <div className="font-archivo text-32 font-semibold leading-[1.05] mt-2">Salut {userLabel}.</div>
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

- [ ] **Step 2: Update `AujourdhuiHeader.test.tsx`**

```tsx
// src/components/today/AujourdhuiHeader.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AujourdhuiHeader } from "./AujourdhuiHeader";

describe("AujourdhuiHeader", () => {
  it("shows the greeting with the given prénom and opens réglages on icon click", async () => {
    const onOpenReglages = vi.fn();
    render(<AujourdhuiHeader userLabel="Mathis" onOpenReglages={onOpenReglages} />);
    expect(screen.getByText("Salut Mathis.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    expect(onOpenReglages).toHaveBeenCalledOnce();
  });

  it("greets Clément by his own prénom", () => {
    render(<AujourdhuiHeader userLabel="Clément" onOpenReglages={() => {}} />);
    expect(screen.getByText("Salut Clément.")).toBeInTheDocument();
  });

  it("fills in the date label after mount", async () => {
    render(<AujourdhuiHeader userLabel="Mathis" onOpenReglages={() => {}} />);
    const raw = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(
      new Date(),
    );
    const expected = raw.charAt(0).toUpperCase() + raw.slice(1);
    await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
  });
});
```

- [ ] **Step 3: Run the test, verify it passes**

Run: `npx vitest run src/components/today/AujourdhuiHeader.test.tsx`
Expected: all 3 tests PASS.

- [ ] **Step 4: Update `AujourdhuiScreen.tsx`**

```tsx
// src/components/today/AujourdhuiScreen.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { ResumeBanner } from "./ResumeBanner";
import { ProgrammeCard } from "./ProgrammeCard";
import { LevelUpPrompt } from "./LevelUpPrompt";
import { BackPainCard } from "./BackPainCard";
import { SetupFlow } from "@/components/setup/SetupFlow";
import { AujourdhuiHeader } from "./AujourdhuiHeader";
import { ReglagesScreen } from "@/components/settings/ReglagesScreen";
import type { TodayState } from "@/lib/programme/loadTodayState";
import type { DosTodayState } from "@/lib/dos/loadDosTodayState";
import type { UserSlug } from "@/lib/auth/users";

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

export function AujourdhuiScreen({
  state,
  dosState,
  user,
}: {
  state: TodayState;
  dosState: DosTodayState | null;
  user: { slug: UserSlug; label: string };
}) {
  const router = useRouter();
  const [setupOpen, setSetupOpen] = useState(false);
  const [reglagesOpen, setReglagesOpen] = useState(false);

  if (setupOpen) {
    return <SetupFlow onClose={() => setSetupOpen(false)} />;
  }

  if (reglagesOpen) {
    return (
      <ReglagesScreen
        userSlug={user.slug}
        onClose={() => setReglagesOpen(false)}
        onChangePointDepart={() => {
          setReglagesOpen(false);
          setSetupOpen(true);
        }}
        programmePosition={
          state.phase === "normal"
            ? { parcoursLabel: state.parcoursLabel, level: state.level, dayIndex: state.dayIndex }
            : state.phase === "level-up"
              ? { parcoursLabel: state.parcoursLabel, level: state.level, dayIndex: null }
              : null
        }
      />
    );
  }

  if (state.phase === "empty") {
    return (
      <div className="p-5 flex flex-col gap-8">
        <AujourdhuiHeader userLabel={user.label} onOpenReglages={() => setReglagesOpen(true)} />
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
        <AujourdhuiHeader userLabel={user.label} onOpenReglages={() => setReglagesOpen(true)} />
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
      <AujourdhuiHeader userLabel={user.label} onOpenReglages={() => setReglagesOpen(true)} />
      {state.resume && (
        <ResumeBanner
          exerciseName={state.resume.exerciseName}
          href={playerHref(state.parcours, state.level, state.dayIndex)}
        />
      )}
      {dosState?.phase === "normal" && dosState.resume && (
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

      {dosState && <DosCard dosState={dosState} />}
    </div>
  );
}
```

- [ ] **Step 5: Update `AujourdhuiScreen.test.tsx`**

Replace the whole file — every existing render call gains `user={{ slug: "mathis", label: "Mathis" }}`, and one new test covers Clément's `dosState={null}`:

```tsx
// src/components/today/AujourdhuiScreen.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

const MATHIS = { slug: "mathis" as const, label: "Mathis" };
const CLEMENT = { slug: "clement" as const, label: "Clément" };

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

const NORMAL_PROGRAMME_STATE: TodayState = {
  phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
  dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
  durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
};

describe("AujourdhuiScreen", () => {
  it("empty state shows the point de départ invite and opens SetupFlow on click", async () => {
    render(<AujourdhuiScreen state={{ phase: "empty" }} dosState={DOS_NO_START_DATE} user={MATHIS} />);
    expect(screen.getByText("Premier jour")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Définir mon point de départ" }));
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
  });

  it("level-up state renders the LevelUpPrompt", () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }}
        dosState={DOS_NO_START_DATE}
        user={MATHIS}
      />,
    );
    expect(screen.getByText("Débutant · Niveau 1 terminé")).toBeInTheDocument();
  });

  it("level-up state still shows the active parcours in Réglages, not Non défini", async () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }}
        dosState={DOS_NO_START_DATE}
        user={MATHIS}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    await waitFor(() => expect(screen.getByText("Débutant")).toBeInTheDocument());
    expect(screen.getByText("Niveau 1")).toBeInTheDocument();
  });

  it("normal state renders the Programme card and the real BackPainCard", () => {
    render(<AujourdhuiScreen state={NORMAL_PROGRAMME_STATE} dosState={DOS_NORMAL} user={MATHIS} />);
    expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();
    expect(screen.getByText("Lundi · Charnière & chaîne postérieure")).toBeInTheDocument();
  });

  it("normal state with a Programme resume shows the cobalt ResumeBanner", () => {
    const state: TodayState = { ...NORMAL_PROGRAMME_STATE, resume: { exerciseName: "Push ups" } };
    render(<AujourdhuiScreen state={state} dosState={DOS_NO_START_DATE} user={MATHIS} />);
    expect(screen.getByText("Reprendre à Push ups")).toBeInTheDocument();
  });

  it("shows the no-start-date Dos card when Dos setup hasn't happened yet", () => {
    render(<AujourdhuiScreen state={NORMAL_PROGRAMME_STATE} dosState={DOS_NO_START_DATE} user={MATHIS} />);
    expect(screen.getByText("Définis ta date de départ pour commencer.")).toBeInTheDocument();
  });

  it("shows a sage ResumeBanner when the Dos seance is interrupted", () => {
    const dosResume: DosTodayState = { ...DOS_NORMAL, resume: { exerciseName: "Hip hinge au bâton" } };
    render(<AujourdhuiScreen state={NORMAL_PROGRAMME_STATE} dosState={dosResume} user={MATHIS} />);
    expect(screen.getByText("Reprendre à Hip hinge au bâton")).toBeInTheDocument();
  });

  it("opens Réglages from the header icon and closes it", async () => {
    render(<AujourdhuiScreen state={NORMAL_PROGRAMME_STATE} dosState={DOS_NORMAL} user={MATHIS} />);
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    expect(screen.getByText("Réglages")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();
  });

  it("Changer mon point de départ inside Réglages closes it and opens SetupFlow", async () => {
    render(<AujourdhuiScreen state={NORMAL_PROGRAMME_STATE} dosState={DOS_NORMAL} user={MATHIS} />);
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    await waitFor(() => expect(screen.getByText("Changer mon point de départ")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Changer mon point de départ" }));
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
  });

  it("greets Clément by name and never renders a Dos card when dosState is null", () => {
    render(<AujourdhuiScreen state={NORMAL_PROGRAMME_STATE} dosState={null} user={CLEMENT} />);
    expect(screen.getByText("Salut Clément.")).toBeInTheDocument();
    expect(screen.queryByText("Dos")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test, verify it passes**

Run: `npx vitest run src/components/today/AujourdhuiScreen.test.tsx`
Expected: all 10 tests PASS.

- [ ] **Step 7: Update `ReglagesScreen.tsx`** — add `userSlug` prop, gate the BackPain section

Add `userSlug: UserSlug` to the props destructuring (import `type { UserSlug } from "@/lib/auth/users"`), and wrap the existing BackPain `<section>` block:

```tsx
export function ReglagesScreen({
  userSlug,
  onClose,
  onChangePointDepart,
  programmePosition,
}: {
  userSlug: UserSlug;
  onClose: () => void;
  onChangePointDepart: () => void;
  programmePosition: { parcoursLabel: string; level: number; dayIndex: number | null } | null;
}) {
```

```tsx
            {userSlug === "mathis" && (
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
            )}
```

(Everything else in the file — imports, the loading/error states, the other four sections — is unchanged. Add `import type { UserSlug } from "@/lib/auth/users";` near the top with the other imports.)

- [ ] **Step 8: Update `ReglagesScreen.test.tsx`**

Add `userSlug="mathis"` to every existing `<ReglagesScreen ... />` render call in the file (all 12 of them), and add one new test:

```tsx
  it("hides the BackPain section for Clément", async () => {
    getReglagesStateAction.mockResolvedValue(BASE_STATE);
    render(
      <ReglagesScreen userSlug="clement" onClose={() => {}} onChangePointDepart={() => {}} programmePosition={null} />,
    );
    await waitFor(() => expect(screen.getByText("Programme")).toBeInTheDocument());
    expect(screen.queryByText("BackPain")).not.toBeInTheDocument();
  });
```

- [ ] **Step 9: Run the test, verify it passes**

Run: `npx vitest run src/components/settings/ReglagesScreen.test.tsx`
Expected: all 13 tests PASS.

- [ ] **Step 10: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src/components/today/AujourdhuiHeader.tsx src/components/today/AujourdhuiHeader.test.tsx \
  src/components/today/AujourdhuiScreen.tsx src/components/today/AujourdhuiScreen.test.tsx \
  src/components/settings/ReglagesScreen.tsx src/components/settings/ReglagesScreen.test.tsx
git commit -m "feat(today): personnalise Aujourd'hui et Réglages par utilisateur"
```

---

### Task 8: Trophées — filtre par utilisateur

**Files:**
- Modify: `src/components/trophies/TropheesScreen.tsx`
- Modify: `src/components/trophies/TropheesScreen.test.tsx`
- Modify: `src/app/(shell)/trophees/page.tsx`

**Interfaces:**
- Consumes: `currentUser()` (Task 1), `TrophyCard.module` widened (Task 5).
- Produces: `TropheesScreen({ state, secondModule })` where `secondModule: { value: "dos" | "tracking"; label: string }`.

- [ ] **Step 1: Run the existing test, confirm the baseline passes before touching anything**

Run: `npx vitest run src/components/trophies/TropheesScreen.test.tsx`
Expected: existing 5 tests PASS (this file has no `secondModule` prop yet — that's what this task adds).

- [ ] **Step 2: Update `TropheesScreen.tsx`**

```tsx
// src/components/trophies/TropheesScreen.tsx
"use client";

import { useState } from "react";
import { TrophyCard } from "./TrophyCard";
import { useCountUp } from "./useCountUp";
import type { TropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";

type Tri = "reps" | "recent" | "alpha";
type Filtre = "tous" | "programme" | "dos" | "tracking";

const TRI_OPTIONS: { value: Tri; label: string }[] = [
  { value: "reps", label: "Plus de reps" },
  { value: "recent", label: "Récent" },
  { value: "alpha", label: "Alphabétique" },
];

function toggleButtonClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium whitespace-nowrap ${
    active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"
  }`;
}

export function TropheesScreen({
  state,
  secondModule,
}: {
  state: TropheesScreenState;
  secondModule: { value: "dos" | "tracking"; label: string };
}) {
  const [tri, setTri] = useState<Tri>("reps");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const total = useCountUp(state.totalReps, 0);

  const filtreOptions: { value: Filtre; label: string }[] = [
    { value: "tous", label: "Tous" },
    { value: "programme", label: "Programme" },
    secondModule,
  ];

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
        {filtreOptions.map((opt) => (
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
          <div className="w-1/2 min-[720px]:w-1/3 rounded-card border border-dashed border-hairline bg-transparent overflow-hidden">
            <div className="aspect-square" />
            <div className="p-4">
              <div className="h-3.5 w-3/4 rounded-pill bg-hairline/60" />
              <div className="h-6 w-1/2 rounded-pill bg-hairline/60 mt-3" />
            </div>
          </div>
          <p className="text-15 text-graphite mt-5">
            Fais ta première séance pour commencer à cumuler.
          </p>
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

- [ ] **Step 3: Replace `TropheesScreen.test.tsx` in full** — every pre-existing render call gains `secondModule={DOS_MODULE}` (matching the current hardcoded "Dos" filter behavior), plus one new test for the Tracking variant

```tsx
// src/components/trophies/TropheesScreen.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TropheesScreen } from "./TropheesScreen";
import { __resetAnimateLatchForTests } from "./useCountUp";
import type { TropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockMatchMedia(true);
  // The animate-this-load decision is latched once per module load — reset
  // it so each test starts from a fresh, un-latched state.
  __resetAnimateLatchForTests();
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

const DOS_MODULE = { value: "dos" as const, label: "Dos" };

const STATE: TropheesScreenState = {
  totalReps: 420,
  seanceCount: 10,
  joursActivite: 9,
  cards: [
    { id: "squats", module: "programme", name: "Squats", total: 300, firstAt: "2026-01-01T10:00:00.000Z", lastAt: "2026-08-01T10:00:00.000Z" },
    { id: "A", module: "dos", name: "Charnière & ischios", total: 120, firstAt: "2026-02-01T10:00:00.000Z", lastAt: "2026-08-05T10:00:00.000Z", byCran: [{ cran: 1, nom: "Hip hinge au bâton", total: 120 }] },
  ],
};

describe("TropheesScreen", () => {
  it("shows the header total and activity summary", () => {
    render(<TropheesScreen state={STATE} secondModule={DOS_MODULE} />);
    expect(screen.getByText("420")).toBeInTheDocument();
    expect(screen.getByText(/10 séances/)).toBeInTheDocument();
    expect(screen.getByText(/9 jours/)).toBeInTheDocument();
  });

  it("shows every card by default", () => {
    render(<TropheesScreen state={STATE} secondModule={DOS_MODULE} />);
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("Charnière & ischios")).toBeInTheDocument();
  });

  it("filters to the Dos module only", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<TropheesScreen state={STATE} secondModule={DOS_MODULE} />);
    await user.click(screen.getByRole("button", { name: "Dos" }));
    vi.useFakeTimers();
    expect(screen.queryByText("Squats")).not.toBeInTheDocument();
    expect(screen.getByText("Charnière & ischios")).toBeInTheDocument();
  });

  it("shows the empty state when there are no cards", () => {
    render(
      <TropheesScreen state={{ totalReps: 0, seanceCount: 0, joursActivite: 0, cards: [] }} secondModule={DOS_MODULE} />,
    );
    expect(screen.getByText(/première séance/)).toBeInTheDocument();
  });

  it("animates the header total from 0 when reduced motion is off (regression: effect ordering race)", () => {
    mockMatchMedia(false);
    const { container } = render(<TropheesScreen state={STATE} secondModule={DOS_MODULE} />);
    const headerTotal = container.querySelector(".text-44");
    expect(headerTotal).toHaveTextContent("0");
    expect(headerTotal).not.toHaveTextContent("420");
  });

  it("shows a Tracking filter instead of Dos when secondModule is tracking", () => {
    render(
      <TropheesScreen
        state={{ cards: [], totalReps: 0, seanceCount: 0, joursActivite: 0 }}
        secondModule={{ value: "tracking", label: "Tracking" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Tracking" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dos" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/components/trophies/TropheesScreen.test.tsx`
Expected: all 6 tests PASS.

- [ ] **Step 5: Update `trophees/page.tsx`**

```tsx
// src/app/(shell)/trophees/page.tsx
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";
import { TropheesScreen } from "@/components/trophies/TropheesScreen";

export const dynamic = "force-dynamic";

export default async function TropheesPage() {
  const user = await currentUser();
  const db = getDbForUser(user);
  const state = loadTropheesScreenState(db);
  const secondModule =
    user.slug === "clement" ? { value: "tracking" as const, label: "Tracking" } : { value: "dos" as const, label: "Dos" };
  return <TropheesScreen state={state} secondModule={secondModule} />;
}
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/trophies/TropheesScreen.tsx src/components/trophies/TropheesScreen.test.tsx "src/app/(shell)/trophees/page.tsx"
git commit -m "feat(trophees): le filtre secondaire dépend de l'utilisateur (Dos ou Tracking)"
```

---

### Task 9: Écran Tracking — liste + démarrage de séance

**Files:**
- Create: `src/lib/tracking/loadTrackingScreenState.ts`
- Create: `src/lib/tracking/loadTrackingScreenState.test.ts`
- Create: `src/components/tracking/TrackingScreen.tsx`
- Create: `src/components/tracking/TrackingScreen.test.tsx`
- Create: `src/app/(shell)/tracking/page.tsx`

**Interfaces:**
- Consumes: `getActiveSeance`, `listCompletedSeances` (Task 4), `currentUser`/`getDbForUser` (Task 1/2), `startTrackingSeanceAction` (Task 4).
- Produces: `TrackingScreenState`, `loadTrackingScreenState(db)` — the route entry point Task 10's seance screen links back to.

- [ ] **Step 1: Write the failing test for `loadTrackingScreenState`**

```ts
// src/lib/tracking/loadTrackingScreenState.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSetForExercise, completeSeance } from "./db";
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
  it("reports no active seance and no history when nothing was ever logged", () => {
    const db = setup();
    const state = loadTrackingScreenState(db);
    expect(state).toEqual({ activeSeanceId: null, seances: [] });
  });

  it("surfaces the active seance id separately from completed history", () => {
    const db = setup();
    const active = startSeance(db);
    const past = startSeance(db);
    logSetForExercise(db, past.id, "Squats", 10);
    completeSeance(db, past.id);

    const state = loadTrackingScreenState(db);
    expect(state.activeSeanceId).toBe(active.id);
    expect(state.seances).toHaveLength(1);
    expect(state.seances[0]!.id).toBe(past.id);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/lib/tracking/loadTrackingScreenState.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write `loadTrackingScreenState.ts`**

```ts
// src/lib/tracking/loadTrackingScreenState.ts
import type Database from "better-sqlite3";
import { getActiveSeance, listCompletedSeances, type TrackingSeanceSummary } from "./db";

export type TrackingScreenState = {
  activeSeanceId: number | null;
  seances: TrackingSeanceSummary[];
};

export function loadTrackingScreenState(db: Database.Database): TrackingScreenState {
  const active = getActiveSeance(db);
  return {
    activeSeanceId: active ? active.id : null,
    seances: listCompletedSeances(db),
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/lib/tracking/loadTrackingScreenState.test.ts`
Expected: both tests PASS.

- [ ] **Step 5: Write the failing test for `TrackingScreen`**

```tsx
// src/components/tracking/TrackingScreen.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingScreen } from "./TrackingScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const startTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  startTrackingSeanceAction: (...args: unknown[]) => startTrackingSeanceAction(...args),
}));

describe("TrackingScreen", () => {
  it("shows the empty state with no history", () => {
    render(<TrackingScreen state={{ activeSeanceId: null, seances: [] }} />);
    expect(screen.getByText("Aucune séance enregistrée pour l'instant.")).toBeInTheDocument();
  });

  it("lists completed seances with their total reps", () => {
    render(
      <TrackingScreen
        state={{
          activeSeanceId: null,
          seances: [{ id: 1, startedAt: "2026-08-10T18:00:00.000Z", completedAt: "2026-08-10T18:40:00.000Z", totalReps: 42, exerciseCount: 3 }],
        }}
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("3 exercices")).toBeInTheDocument();
  });

  it("shows a resume banner when a seance is already active", () => {
    render(<TrackingScreen state={{ activeSeanceId: 7, seances: [] }} />);
    expect(screen.getByText("Séance interrompue")).toBeInTheDocument();
  });

  it("starts a seance and navigates to it on button click", async () => {
    startTrackingSeanceAction.mockResolvedValue(9);
    render(<TrackingScreen state={{ activeSeanceId: null, seances: [] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer une séance" }));
    expect(startTrackingSeanceAction).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/tracking/9");
  });
});
```

- [ ] **Step 6: Run the test, verify it fails**

Run: `npx vitest run src/components/tracking/TrackingScreen.test.tsx`
Expected: FAIL — `TrackingScreen` doesn't exist yet.

- [ ] **Step 7: Write `TrackingScreen.tsx`**

```tsx
// src/components/tracking/TrackingScreen.tsx
"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { ResumeBanner } from "@/components/today/ResumeBanner";
import { startTrackingSeanceAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(iso));
}

export function TrackingScreen({ state }: { state: TrackingScreenState }) {
  const router = useRouter();

  async function handleStart() {
    const seanceId = await startTrackingSeanceAction();
    router.push(`/tracking/${seanceId}`);
  }

  return (
    <div className="p-5 flex flex-col gap-8">
      <div>
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-32 font-semibold leading-[1.05] mt-2">Tes séances</div>
      </div>

      {state.activeSeanceId !== null && (
        <ResumeBanner exerciseName="ta séance en cours" href={`/tracking/${state.activeSeanceId}`} accent="sage" />
      )}

      <button
        type="button"
        onClick={handleStart}
        className="h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
      >
        Enregistrer une séance
      </button>

      {state.seances.length === 0 ? (
        <p className="text-15 text-graphite">Aucune séance enregistrée pour l&apos;instant.</p>
      ) : (
        <Card className="overflow-hidden">
          {state.seances.map((seance, i) => (
            <div
              key={seance.id}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}
            >
              <div>
                <div className="text-15 font-medium">{formatDateFr(seance.completedAt)}</div>
                <div className="text-13 text-graphite mt-0.5">
                  {seance.exerciseCount} exercice{seance.exerciseCount > 1 ? "s" : ""}
                </div>
              </div>
              <div className="font-archivo text-18 font-semibold tabular-nums">{seance.totalReps}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run the test, verify it passes**

Run: `npx vitest run src/components/tracking/TrackingScreen.test.tsx`
Expected: all 4 tests PASS.

- [ ] **Step 9: Write the route**

```tsx
// src/app/(shell)/tracking/page.tsx
import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";
import { TrackingScreen } from "@/components/tracking/TrackingScreen";

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  const user = await currentUser();
  if (user.slug !== "clement") redirect("/");
  const db = getDbForUser(user);
  const state = loadTrackingScreenState(db);
  return <TrackingScreen state={state} />;
}
```

- [ ] **Step 10: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src/lib/tracking/loadTrackingScreenState.ts src/lib/tracking/loadTrackingScreenState.test.ts \
  src/components/tracking/TrackingScreen.tsx src/components/tracking/TrackingScreen.test.tsx \
  "src/app/(shell)/tracking/page.tsx"
git commit -m "feat(tracking): écran de liste des séances et démarrage"
```

---

### Task 10: Écran Tracking — saisie de séance

**Files:**
- Create: `src/components/tracking/TrackingSeanceScreen.tsx`
- Create: `src/components/tracking/TrackingSeanceScreen.test.tsx`
- Create: `src/app/(shell)/tracking/[seanceId]/page.tsx`

**Interfaces:**
- Consumes: `TrackingSetWithExercise` (Task 4), `logTrackingSetAction`, `completeTrackingSeanceAction` (Task 4), `getSeanceById`, `getSetsForSeance`, `listExerciseNames` (Task 4).
- Produces: the full logging flow — this is the last piece of the Tracking module.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/tracking/TrackingSeanceScreen.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingSeanceScreen } from "./TrackingSeanceScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const logTrackingSetAction = vi.fn();
const completeTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  logTrackingSetAction: (...args: unknown[]) => logTrackingSetAction(...args),
  completeTrackingSeanceAction: (...args: unknown[]) => completeTrackingSeanceAction(...args),
}));

describe("TrackingSeanceScreen", () => {
  it("prompts to add the first exercise when the seance is empty", () => {
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);
    expect(screen.getByText("Ajoute ton premier exercice ci-dessous.")).toBeInTheDocument();
  });

  it("groups initial sets by exercise", () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[
          { id: 1, seanceId: 1, exerciseId: 10, exerciseName: "Squats", exerciseOrder: 0, setNumber: 1, repsActual: 12, completedAt: "2026-08-13T10:00:00.000Z" },
          { id: 2, seanceId: 1, exerciseId: 10, exerciseName: "Squats", exerciseOrder: 0, setNumber: 2, repsActual: 10, completedAt: "2026-08-13T10:01:00.000Z" },
        ]}
        exerciseSuggestions={["Squats"]}
      />,
    );
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("12 · 10")).toBeInTheDocument();
  });

  it("adds a set immediately on Ajouter la série, using the server's authoritative record", async () => {
    logTrackingSetAction.mockResolvedValue({
      id: 5, seanceId: 1, exerciseId: 20, exerciseName: "Fentes", exerciseOrder: 0, setNumber: 1, repsActual: 10, completedAt: "2026-08-13T10:02:00.000Z",
    });
    render(<TrackingSeanceScreen seanceId={1} completed={false} initialSets={[]} exerciseSuggestions={[]} />);

    await userEvent.type(screen.getByPlaceholderText("Nom de l'exercice"), "Fentes");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter la série" }));

    expect(logTrackingSetAction).toHaveBeenCalledWith({ seanceId: 1, exerciseName: "Fentes", repsActual: 10 });
    expect(await screen.findByText("Fentes")).toBeInTheDocument();
  });

  it("completes the seance and navigates back to the list", async () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed={false}
        initialSets={[
          { id: 1, seanceId: 1, exerciseId: 10, exerciseName: "Squats", exerciseOrder: 0, setNumber: 1, repsActual: 12, completedAt: "2026-08-13T10:00:00.000Z" },
        ]}
        exerciseSuggestions={["Squats"]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Terminer la séance" }));
    expect(completeTrackingSeanceAction).toHaveBeenCalledWith(1);
    expect(push).toHaveBeenCalledWith("/tracking");
  });

  it("hides the entry form and the finish button once the seance is completed", () => {
    render(
      <TrackingSeanceScreen
        seanceId={1}
        completed
        initialSets={[
          { id: 1, seanceId: 1, exerciseId: 10, exerciseName: "Squats", exerciseOrder: 0, setNumber: 1, repsActual: 12, completedAt: "2026-08-13T10:00:00.000Z" },
        ]}
        exerciseSuggestions={["Squats"]}
      />,
    );
    expect(screen.queryByPlaceholderText("Nom de l'exercice")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminer la séance" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/components/tracking/TrackingSeanceScreen.test.tsx`
Expected: FAIL — `TrackingSeanceScreen` doesn't exist yet.

- [ ] **Step 3: Write `TrackingSeanceScreen.tsx`**

```tsx
// src/components/tracking/TrackingSeanceScreen.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { logTrackingSetAction, completeTrackingSeanceAction } from "@/lib/tracking/actions";
import type { TrackingSetWithExercise } from "@/lib/tracking/db";

type ExerciseGroup = { exerciseOrder: number; exerciseName: string; sets: TrackingSetWithExercise[] };

function groupByExercise(sets: TrackingSetWithExercise[]): ExerciseGroup[] {
  const map = new Map<number, ExerciseGroup>();
  for (const set of sets) {
    let group = map.get(set.exerciseOrder);
    if (!group) {
      group = { exerciseOrder: set.exerciseOrder, exerciseName: set.exerciseName, sets: [] };
      map.set(set.exerciseOrder, group);
    }
    group.sets.push(set);
  }
  return [...map.values()].sort((a, b) => a.exerciseOrder - b.exerciseOrder);
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
  exerciseSuggestions: string[];
}) {
  const router = useRouter();
  const [sets, setSets] = useState(initialSets);
  const [exerciseName, setExerciseName] = useState("");
  const [reps, setReps] = useState(10);
  const [saving, setSaving] = useState(false);

  const groups = groupByExercise(sets);

  async function handleAddSet() {
    const name = exerciseName.trim();
    if (!name || saving) return;
    setSaving(true);
    const set = await logTrackingSetAction({ seanceId, exerciseName: name, repsActual: reps });
    setSets((prev) => [...prev, set]);
    setExerciseName("");
    setSaving(false);
  }

  async function handleFinish() {
    await completeTrackingSeanceAction(seanceId);
    router.push("/tracking");
  }

  return (
    <div className="p-5 flex flex-col gap-6">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>

      {groups.length === 0 ? (
        <p className="text-15 text-graphite">Ajoute ton premier exercice ci-dessous.</p>
      ) : (
        <Card className="overflow-hidden">
          {groups.map((group, i) => (
            <div key={group.exerciseOrder} className={`px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className="text-15 font-medium">{group.exerciseName}</div>
              <div className="text-13 text-graphite mt-1">{group.sets.map((s) => s.repsActual).join(" · ")}</div>
            </div>
          ))}
        </Card>
      )}

      {!completed && (
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
            {exerciseSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="flex items-center justify-center gap-6">
            <Button variant="secondary" onClick={() => setReps((v) => Math.max(0, v - 1))}>
              −
            </Button>
            <span className="font-archivo text-44 font-semibold tabular-nums w-16 text-center">{reps}</span>
            <Button variant="secondary" onClick={() => setReps((v) => v + 1)}>
              +
            </Button>
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
      )}

      {!completed && (
        <button
          type="button"
          onClick={handleFinish}
          className="h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Terminer la séance
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/components/tracking/TrackingSeanceScreen.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 5: Write the route**

```tsx
// src/app/(shell)/tracking/[seanceId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSeanceById, getSetsForSeance, listExerciseNames } from "@/lib/tracking/db";
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
  const exerciseSuggestions = listExerciseNames(db);

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

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 7: Manual smoke test in the browser**

Run: `npm run dev`, then in a browser open `http://localhost:3000` (no `CLEMENT_EMAIL`/`DEV_FORCE_USER_SLUG` set yet → still Mathis's app, unchanged). Then create `.env.local` at the repo root (gitignored — confirm with `git check-ignore .env.local`) with:

```
CLEMENT_EMAIL=<l'adresse email de Clément>
DEV_FORCE_USER_SLUG=clement
```

Restart `npm run dev`, reload the browser: the nav should now show Tracking instead of Dos, the greeting should say "Salut Clément.", Réglages should have no BackPain section. Click "Enregistrer une séance", add two exercises with a few sets each, reload the page mid-session (verify the sets are still there — read from DB, not lost), click "Terminer la séance", confirm it appears in the Tracking history list and its reps show up under Trophées.

Then verify the route guards from Task 2 and this task actually redirect (no automated test covers this — this codebase has no precedent for testing `page.tsx` redirect behavior in Vitest, every other page.tsx is untested and only its underlying `lib/` functions are): with `DEV_FORCE_USER_SLUG=clement` still set, navigate directly to `http://localhost:3000/dos` and to `http://localhost:3000/player/dos` — both must redirect to `/`. Then set `DEV_FORCE_USER_SLUG=mathis` (or remove it) and navigate directly to `http://localhost:3000/tracking` — it must also redirect to `/`.

Remove `DEV_FORCE_USER_SLUG` from `.env.local` (or the whole file) afterward to go back to testing as Mathis.

- [ ] **Step 8: Commit**

```bash
git add src/components/tracking/TrackingSeanceScreen.tsx src/components/tracking/TrackingSeanceScreen.test.tsx \
  "src/app/(shell)/tracking/[seanceId]/page.tsx"
git commit -m "feat(tracking): écran de saisie de séance (exercices, séries, terminer)"
```

---

### Task 11: Déploiement multi-utilisateur

**Files:**
- Modify: `scripts/db-migrate.ts`
- Modify: `deploy/sportcompanion.service`
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Consumes: `knownUsers()` (Task 1).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Update `db-migrate.ts` to loop over every known user**

```ts
// scripts/db-migrate.ts
import path from "node:path";
import { getDb } from "../src/lib/db/client";
import { runMigrations } from "../src/lib/db/migrate";
import { knownUsers } from "../src/lib/auth/users";

const migrationsDir = path.join(process.cwd(), "migrations");

for (const user of knownUsers()) {
  const db = getDb(user.dbPath);
  const { applied } = runMigrations(db, migrationsDir);
  db.close();

  if (applied.length === 0) {
    console.log(`[${user.slug}] No pending migrations.`);
  } else {
    console.log(`[${user.slug}] Applied ${applied.length} migration(s): ${applied.join(", ")}`);
  }
}
```

- [ ] **Step 2: Run it locally to confirm it still works with only Mathis configured**

Run: `npm run db:migrate`
Expected: `[mathis] No pending migrations.` (assuming Task 3's migration was already applied to the dev DB by the test suite's own tmp-dir runs — if not, it applies `0008_tracking.sql` and logs it). No `[clement]` line unless `CLEMENT_EMAIL` is set in the shell running this command.

- [ ] **Step 3: Update `deploy/sportcompanion.service`**

```
[Unit]
Description=SportCompanion
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/sportcompanion/.next/standalone
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=HOSTNAME=127.0.0.1
Environment=DB_PATH=/home/ubuntu/sportcompanion/data/sportcompanion.db
EnvironmentFile=-/home/ubuntu/sportcompanion/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

(Only the added `EnvironmentFile=-/home/ubuntu/sportcompanion/.env` line changes — the leading `-` makes the file optional, and `deploy.sh` already excludes `.env*` from its `rsync`, so this file is created once by hand on the VM and never overwritten by a deploy.)

- [ ] **Step 4: Update `DEPLOYMENT.md`**

Add a new section after "## Cloudflare Tunnel + Access" (before "## Déployer"):

```markdown
---

## Multi-utilisateur (Mathis + Clément)

L'app distingue les deux comptes via le header `Cf-Access-Authenticated-User-Email` que Cloudflare Access injecte (voir `src/lib/auth/currentUser.ts`). Deux étapes manuelles, à faire une fois, ni l'une ni l'autre automatisable depuis ce repo :

1. **Policy Access** : dans le dashboard Cloudflare (Zero Trust → Access → Applications → `workout.spiritix.fr`), ajouter l'email de Clément à la policy Allow existante (à côté du Gmail personnel de Mathis).
2. **Variables d'environnement sur la VM** : créer `/home/ubuntu/sportcompanion/.env` (n'existe pas encore, jamais touché par `deploy.sh` qui exclut `.env*` du `rsync`) avec :

   ```
   MATHIS_EMAIL=<gmail perso de Mathis>
   CLEMENT_EMAIL=<email de Clément>
   ```

   Sans ce fichier, tout le trafic authentifié par Access échoue avec « Accès non reconnu » — les emails du header ne correspondent à aucun utilisateur connu tant que ces deux variables ne sont pas posées.

Clément a son propre fichier SQLite, `data/sportcompanion.clement.db`, créé automatiquement au prochain `npm run db:migrate` (le script boucle maintenant sur tous les utilisateurs connus, voir `scripts/db-migrate.ts`). Le fichier de Mathis (`data/sportcompanion.db`) est inchangé.

---
```

- [ ] **Step 5: Commit**

```bash
git add scripts/db-migrate.ts deploy/sportcompanion.service DEPLOYMENT.md
git commit -m "chore(deploy): configure le déploiement pour deux utilisateurs"
```

- [ ] **Step 6: Deploy (only when the user explicitly asks to go to prod)**

Run: `./deploy/deploy.sh` — but confirm with the user first (this touches the shared production VM and restarts the live service). After deploying, SSH to the VM once to create `/home/ubuntu/sportcompanion/.env` per Step 4 (this file is never created by `deploy.sh` itself) and add Clément's email to the Cloudflare Access policy in the dashboard — both are manual, one-time steps outside this plan's automation.
