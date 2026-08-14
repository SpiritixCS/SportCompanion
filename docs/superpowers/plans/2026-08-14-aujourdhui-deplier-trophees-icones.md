# Aujourd'hui — déplier les exercices, Trophées — icônes de famille Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur Aujourd'hui/Dos, « et N autres » devient dépliable sur place ; sur Trophées, chaque carte sans photo affiche une icône de famille de mouvement au lieu d'un carré vide.

**Architecture:** Les loaders (`loadTodayState`, `loadDosTodayState`) exposent désormais la liste complète des exercices du jour au lieu d'un preview pré-tronqué ; les cartes (`ProgrammeCard`, `BackPainCard`) font elles-mêmes le slice-à-3 + toggle d'expansion en état local. Côté Trophées, `computeTrophies` porte un champ `movementFamily` (déjà connu pour Programme, mappé à la main pour Dos, toujours `other` pour Tracking), consommé par un nouveau composant `ExerciseFamilyIcon` qui choisit parmi 8 icônes SVG.

**Tech Stack:** Next.js App Router, React 19 (client components pour l'état d'expansion), TypeScript, Vitest + Testing Library.

## Global Constraints

- UI en français, tutoiement, zéro jargon (spec §Ton, CLAUDE.md §4).
- Icônes : trait 1.5px uniforme, `currentColor`, pas de couleur propre à la famille, pas d'icône multicolore (CLAUDE.md §4, brief `design/uploads/claude.md:279`).
- Couleur : le reste de l'interface hors accent de module reste neutre (`--graphite`/`--ink`) — les icônes de famille ne prennent pas de couleur par famille.
- Pas de nouvelle taxonomie : réutiliser les 8 familles déjà curées côté Programme (`core`, `dip`, `handstand`, `lever`, `other`, `pull`, `push`, `squat`), jamais dupliquer/modifier `workout_curated.json` ou `BackPainProgram.md`.
- Cibles tactiles ≥ 44px pour tout élément tappable (le bouton « et N autres »/« Voir moins »).
- Tests : TDD, un test par comportement observable, pas de mock de la DB pour les tests d'intégration loader (SQLite temp file, pattern déjà en place dans `loadTodayState.test.ts`).

---

## Task 1: Loaders — exposer la liste complète des exercices

**Files:**
- Modify: `src/lib/programme/loadTodayState.ts:11-29` (type `TodayState`), `:92-93` (body)
- Modify: `src/lib/dos/loadDosTodayState.ts:21-33` (type `DosTodayState`), `:75-76` (body)
- Test: `src/lib/programme/loadTodayState.test.ts:69-86`
- Test: `src/lib/dos/loadDosTodayState.test.ts:45-56`

**Interfaces:**
- Produces: `TodayState` (phase `"normal"`) gagne `exercises: { name: string; dose: string }[]`, perd `exercisesPreview`/`exercisesRestCount`. Même changement pour `DosTodayState`. Ces deux types sont consommés par les Tasks 2 et 3.

- [ ] **Step 1: Modifier le test `loadTodayState.test.ts` pour attendre la liste complète**

Dans `src/lib/programme/loadTodayState.test.ts`, remplacer le bloc d'assertions (lignes 77-82) :

```ts
    expect(state.exercisesPreview).toEqual([
      { name: "Push ups", dose: "3 × 12" },
      { name: "Squats", dose: "3 × 15" },
      { name: "Dips", dose: "3 × 10" },
    ]);
    expect(state.exercisesRestCount).toBe(1);
```

par :

```ts
    expect(state.exercises).toEqual([
      { name: "Push ups", dose: "3 × 12" },
      { name: "Squats", dose: "3 × 15" },
      { name: "Dips", dose: "3 × 10" },
      { name: "Lunges", dose: "3 × 10" },
    ]);
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run src/lib/programme/loadTodayState.test.ts`
Expected: FAIL — `state.exercises` est `undefined` (le champ n'existe pas encore).

- [ ] **Step 3: Modifier `loadTodayState.ts`**

Remplacer dans le type (lignes 21-22) :

```ts
      exercisesPreview: { name: string; dose: string }[];
      exercisesRestCount: number;
```

par :

```ts
      exercises: { name: string; dose: string }[];
```

Remplacer dans le corps (lignes 92-93) :

```ts
    exercisesPreview: day.exercises.slice(0, 3).map((e) => ({ name: e.name, dose: formatTarget(e.sets, e.target) })),
    exercisesRestCount: Math.max(0, day.exercises.length - 3),
```

par :

```ts
    exercises: day.exercises.map((e) => ({ name: e.name, dose: formatTarget(e.sets, e.target) })),
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run src/lib/programme/loadTodayState.test.ts`
Expected: PASS

- [ ] **Step 5: Modifier le test `loadDosTodayState.test.ts` pour attendre la liste complète**

Dans `src/lib/dos/loadDosTodayState.test.ts`, remplacer (ligne 53) :

```ts
    expect(state.exercisesPreview).toHaveLength(3);
```

par :

```ts
    expect(state.exercises).toHaveLength(4); // 1 fixe (lundi) + arbres A, B, C
```

- [ ] **Step 6: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run src/lib/dos/loadDosTodayState.test.ts`
Expected: FAIL — `state.exercises` est `undefined`.

- [ ] **Step 7: Modifier `loadDosTodayState.ts`**

Remplacer dans le type (lignes 28-29) :

```ts
      exercisesPreview: { name: string; dose: string }[];
      exercisesRestCount: number;
```

par :

```ts
      exercises: { name: string; dose: string }[];
```

Remplacer dans le corps (lignes 75-76) :

```ts
    exercisesPreview: day.exercises.slice(0, 3).map((e) => ({ name: e.name, dose: formatTarget(e.sets, e.target) })),
    exercisesRestCount: Math.max(0, day.exercises.length - 3),
```

par :

```ts
    exercises: day.exercises.map((e) => ({ name: e.name, dose: formatTarget(e.sets, e.target) })),
```

- [ ] **Step 8: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run src/lib/dos/loadDosTodayState.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/programme/loadTodayState.ts src/lib/programme/loadTodayState.test.ts src/lib/dos/loadDosTodayState.ts src/lib/dos/loadDosTodayState.test.ts
git commit -m "feat(today): expose la liste complète des exercices du jour depuis les loaders"
```

---

## Task 2: ProgrammeCard — déplier « et N autres »

**Files:**
- Modify: `src/components/today/ProgrammeCard.tsx` (fichier entier, 97 lignes)
- Modify: `src/components/today/AujourdhuiScreen.tsx:152-163` (appel à `ProgrammeCard`)
- Test: `src/components/today/ProgrammeCard.test.tsx` (fichier entier)
- Test: `src/components/today/AujourdhuiScreen.test.tsx:44-47` (fixture `NORMAL_PROGRAMME_STATE`)

**Interfaces:**
- Consumes: `TodayState` (Task 1) — `state.exercises: { name: string; dose: string }[]`.
- Produces: `ProgrammeCard` prend désormais `exercises` au lieu de `exercisesPreview`+`exercisesRestCount`. Aucun autre composant ne consomme `ProgrammeCard` directement.

- [ ] **Step 1: Réécrire `ProgrammeCard.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgrammeCard } from "./ProgrammeCard";
import type { PastilleState } from "@/components/Pastille";

const PASTILLES: PastilleState[] = ["done", "restOrWalk", "today", "upcoming", "restOrWalk", "upcoming", "upcoming"];

const FIVE_EXERCISES = [
  { name: "Push ups", dose: "3 × 12" },
  { name: "Squats", dose: "3 × 15" },
  { name: "Dips", dose: "3 × 10" },
  { name: "Pull ups", dose: "3 × 8" },
  { name: "Plank", dose: "3 × 20-40" },
];

describe("ProgrammeCard", () => {
  it("shows position, the first 3 exercises, and a rest-count toggle beyond that", () => {
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire"
        level={2}
        dayTitle="Jour 5"
        pastilles={PASTILLES}
        exercises={FIVE_EXERCISES}
        durationEstimateMinutes={26}
        done={false}
        doneReps={null}
        href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    expect(screen.getByText("Intermédiaire · Niveau 3 · Jour 5")).toBeInTheDocument();
    expect(screen.getByText("Push ups")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
    expect(screen.queryByText("Pull ups")).not.toBeInTheDocument();
    expect(screen.getByText("26 min")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "et 2 autres" })).toBeInTheDocument();
  });

  it("expands to show every exercise on click, then collapses back on a second click", async () => {
    const user = userEvent.setup();
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire" level={2} dayTitle="Jour 5" pastilles={PASTILLES}
        exercises={FIVE_EXERCISES} durationEstimateMinutes={26}
        done={false} doneReps={null} href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    await user.click(screen.getByRole("button", { name: "et 2 autres" }));
    expect(screen.getByText("Pull ups")).toBeInTheDocument();
    expect(screen.getByText("Plank")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voir moins" }));
    expect(screen.queryByText("Pull ups")).not.toBeInTheDocument();
  });

  it("shows Commencer la séance and no accomplished block when not done", () => {
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire" level={2} dayTitle="Jour 5" pastilles={PASTILLES}
        exercises={[]} durationEstimateMinutes={18}
        done={false} doneReps={null} href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    expect(screen.getByRole("link", { name: "Commencer la séance" })).toHaveAttribute(
      "href", "/player?parcours=intermediate&level=2&day=4",
    );
    expect(screen.queryByText("Revoir la séance")).not.toBeInTheDocument();
  });

  it("shows the accomplished block and Revoir la séance when done", () => {
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire" level={2} dayTitle="Jour 5" pastilles={PASTILLES}
        exercises={[]} durationEstimateMinutes={18}
        done doneReps={42} href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    expect(screen.getByText("42 répétitions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revoir la séance" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Commencer la séance" })).not.toBeInTheDocument();
  });

  it("omits the toggle when there's nothing left beyond the first 3", () => {
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire" level={2} dayTitle="Jour 5" pastilles={PASTILLES}
        exercises={[{ name: "Plank", dose: "3 × 20-40" }]} durationEstimateMinutes={18}
        done={false} doneReps={null} href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    expect(screen.queryByRole("button", { name: /^et .* autres?$/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run src/components/today/ProgrammeCard.test.tsx`
Expected: FAIL — le composant attend encore `exercisesPreview`/`exercisesRestCount`.

- [ ] **Step 3: Réécrire `ProgrammeCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Pastille, type PastilleState } from "@/components/Pastille";
import { IconCheck } from "@/components/icons/IconCheck";

const PREVIEW_COUNT = 3;

export function ProgrammeCard({
  parcoursLabel,
  level,
  dayTitle,
  pastilles,
  exercises,
  durationEstimateMinutes,
  done,
  doneReps,
  href,
}: {
  parcoursLabel: string;
  level: number;
  dayTitle: string;
  pastilles: PastilleState[];
  exercises: { name: string; dose: string }[];
  durationEstimateMinutes: number;
  done: boolean;
  doneReps: number | null;
  href: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const restCount = Math.max(0, exercises.length - PREVIEW_COUNT);
  const visibleExercises = expanded ? exercises : exercises.slice(0, PREVIEW_COUNT);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-cobalt">Programme</span>
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite tabular-nums">
          {durationEstimateMinutes} min
        </span>
      </div>

      <div className="font-archivo text-24 font-semibold mt-3.5">
        {parcoursLabel} · Niveau {level + 1} · {dayTitle}
      </div>

      <div className="flex gap-2 mt-5">
        {pastilles.map((state, i) => (
          <Pastille key={i} state={state} accent="cobalt" />
        ))}
      </div>

      {exercises.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-5">
          {visibleExercises.map((e) => (
            <div key={e.name} className="flex items-baseline justify-between gap-4">
              <span className="text-15">{e.name}</span>
              <span className="font-archivo text-15 font-medium text-graphite tabular-nums whitespace-nowrap">
                {e.dose}
              </span>
            </div>
          ))}
          {restCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="min-h-11 flex items-center text-13 text-graphite text-left"
            >
              {expanded ? "Voir moins" : restCount === 1 ? "et 1 autre" : `et ${restCount} autres`}
            </button>
          )}
        </div>
      )}

      {done ? (
        <>
          <div className="flex items-center gap-4 mt-5 pt-5 border-t border-hairline">
            <span className="w-9 h-9 rounded-pill bg-cobalt text-paper flex items-center justify-center flex-none">
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
          className="mt-5 h-14 rounded-pill bg-cobalt text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Commencer la séance
        </Link>
      )}
    </Card>
  );
}
```

Note : `min-h-11` (44px, échelle Tailwind par défaut) satisfait la contrainte de cible tactile ≥44px des Global Constraints — le texte reste visuellement `text-13`, seule la zone cliquable grandit, cohérent avec le pattern déjà utilisé pour une ligne texte tappable ailleurs dans l'app (`src/components/programme/ProgrammeScreen.tsx:73`, `min-h-11 ... text-left`).

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run src/components/today/ProgrammeCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Mettre à jour l'appelant `AujourdhuiScreen.tsx`**

Remplacer (lignes 157-158) :

```tsx
        exercisesPreview={state.exercisesPreview}
        exercisesRestCount={state.exercisesRestCount}
```

par :

```tsx
        exercises={state.exercises}
```

- [ ] **Step 6: Mettre à jour la fixture `AujourdhuiScreen.test.tsx`**

Remplacer (ligne 46) :

```ts
  dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
```

par :

```ts
  dayTitle: "Jour 1", exercises: [], totalExercises: 0,
```

- [ ] **Step 7: Lancer toute la suite `today`, vérifier qu'elle passe**

Run: `npx vitest run src/components/today`
Expected: PASS (tous les fichiers du dossier, y compris `AujourdhuiScreen.test.tsx`)

- [ ] **Step 8: Commit**

```bash
git add src/components/today/ProgrammeCard.tsx src/components/today/ProgrammeCard.test.tsx src/components/today/AujourdhuiScreen.tsx src/components/today/AujourdhuiScreen.test.tsx
git commit -m "feat(today): la carte Programme déplie et replie ses exercices sur place"
```

---

## Task 3: BackPainCard — déplier « et N autres »

**Files:**
- Modify: `src/components/today/BackPainCard.tsx` (fichier entier, 79 lignes)
- Modify: `src/components/today/AujourdhuiScreen.tsx:23-56` (fonction `DosCard`)
- Modify: `src/components/dos/DosScreen.tsx:31-41` (appel à `BackPainCard`)
- Test: `src/components/today/BackPainCard.test.tsx` (fichier entier)
- Test: `src/components/today/AujourdhuiScreen.test.tsx:33-42` (fixture `DOS_NORMAL`)
- Test: `src/components/dos/DosScreen.test.tsx:22-31` (fixture `state.today`)

**Interfaces:**
- Consumes: `DosTodayState` (Task 1) — `.exercises: { name: string; dose: string }[]`.
- Produces: `BackPainCard` prend `exercises` au lieu de `exercisesPreview`+`exercisesRestCount`. Deux appelants : `AujourdhuiScreen` (via `DosCard`) et `DosScreen`.

- [ ] **Step 1: Réécrire `BackPainCard.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackPainCard } from "./BackPainCard";

const FOUR_EXERCISES = [
  { name: "Hip hinge au bâton", dose: "2 × 10" },
  { name: "Pont fessier bilatéral", dose: "3 × 12" },
  { name: "Superman au sol", dose: "3 × 8" },
  { name: "Gainage latéral", dose: "3 × 20" },
];

describe("BackPainCard", () => {
  it("shows the day, intitulé, the first 3 exercises, and a rest-count toggle", () => {
    render(
      <BackPainCard
        jourLabel="Lundi"
        intitule="Charnière & chaîne postérieure"
        exercises={FOUR_EXERCISES}
        done={false}
        doneReps={null}
        href="/player/dos"
      />,
    );
    expect(screen.getByText("Lundi · Charnière & chaîne postérieure")).toBeInTheDocument();
    expect(screen.getByText("Hip hinge au bâton")).toBeInTheDocument();
    expect(screen.queryByText("Gainage latéral")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "et 1 autre" })).toBeInTheDocument();
    expect(screen.getByText("Commencer")).toBeInTheDocument();
  });

  it("expands to show every exercise on click, then collapses back on a second click", async () => {
    const user = userEvent.setup();
    render(
      <BackPainCard
        jourLabel="Lundi" intitule="Charnière & chaîne postérieure"
        exercises={FOUR_EXERCISES} done={false} doneReps={null} href="/player/dos"
      />,
    );
    await user.click(screen.getByRole("button", { name: "et 1 autre" }));
    expect(screen.getByText("Gainage latéral")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voir moins" }));
    expect(screen.queryByText("Gainage latéral")).not.toBeInTheDocument();
  });

  it("shows the accomplished state with total reps and Revoir la séance", () => {
    render(
      <BackPainCard
        jourLabel="Lundi"
        intitule="Charnière & chaîne postérieure"
        exercises={[]}
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

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run src/components/today/BackPainCard.test.tsx`
Expected: FAIL — le composant attend encore `exercisesPreview`/`exercisesRestCount`.

- [ ] **Step 3: Réécrire `BackPainCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { IconCheck } from "@/components/icons/IconCheck";

const PREVIEW_COUNT = 3;

export function BackPainCard({
  jourLabel,
  intitule,
  exercises,
  done,
  doneReps,
  href,
}: {
  jourLabel: string;
  intitule: string;
  exercises: { name: string; dose: string }[];
  done: boolean;
  doneReps: number | null;
  href: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const restCount = Math.max(0, exercises.length - PREVIEW_COUNT);
  const visibleExercises = expanded ? exercises : exercises.slice(0, PREVIEW_COUNT);

  return (
    <Card className="p-5">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>

      <div className="font-archivo text-24 font-semibold mt-3.5">
        {jourLabel} · {intitule}
      </div>

      {exercises.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-5">
          {visibleExercises.map((e) => (
            <div key={e.name} className="flex items-baseline justify-between gap-4">
              <span className="text-15">{e.name}</span>
              <span className="font-archivo text-15 font-medium text-graphite tabular-nums whitespace-nowrap">
                {e.dose}
              </span>
            </div>
          ))}
          {restCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="min-h-11 flex items-center text-13 text-graphite text-left"
            >
              {expanded ? "Voir moins" : restCount === 1 ? "et 1 autre" : `et ${restCount} autres`}
            </button>
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

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run src/components/today/BackPainCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Mettre à jour `DosCard` dans `AujourdhuiScreen.tsx`**

Remplacer (lignes 49-50) :

```tsx
      exercisesPreview={dosState.exercisesPreview}
      exercisesRestCount={dosState.exercisesRestCount}
```

par :

```tsx
      exercises={dosState.exercises}
```

- [ ] **Step 6: Mettre à jour la fixture `DOS_NORMAL` dans `AujourdhuiScreen.test.tsx`**

Remplacer (lignes 37-38) :

```ts
  exercisesPreview: [{ name: "Hip hinge au bâton", dose: "2 × 10" }],
  exercisesRestCount: 0,
```

par :

```ts
  exercises: [{ name: "Hip hinge au bâton", dose: "2 × 10" }],
```

- [ ] **Step 7: Mettre à jour l'appel à `BackPainCard` dans `DosScreen.tsx`**

Remplacer (lignes 35-36) :

```tsx
          exercisesPreview={state.today.exercisesPreview}
          exercisesRestCount={state.today.exercisesRestCount}
```

par :

```tsx
          exercises={state.today.exercises}
```

- [ ] **Step 8: Mettre à jour la fixture `state.today` dans `DosScreen.test.tsx`**

Remplacer (lignes 26-27) :

```ts
        exercisesPreview: [{ name: "Hip hinge au bâton", dose: "2 × 10" }],
        exercisesRestCount: 0,
```

par :

```ts
        exercises: [{ name: "Hip hinge au bâton", dose: "2 × 10" }],
```

- [ ] **Step 9: Lancer toute la suite `today` + `dos`, vérifier qu'elle passe**

Run: `npx vitest run src/components/today src/components/dos`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/components/today/BackPainCard.tsx src/components/today/BackPainCard.test.tsx src/components/today/AujourdhuiScreen.tsx src/components/today/AujourdhuiScreen.test.tsx src/components/dos/DosScreen.tsx src/components/dos/DosScreen.test.tsx
git commit -m "feat(dos): la carte Dos déplie et replie ses exercices sur place"
```

---

## Task 4: computeTrophies — champ movementFamily

**Files:**
- Create: `src/lib/trophies/movementFamily.ts`
- Modify: `src/lib/trophies/computeTrophies.ts` (fichier entier, 172 lignes)
- Test: `src/lib/trophies/computeTrophies.test.ts` (ajout d'un describe)

**Interfaces:**
- Produces: `MovementFamily = "core" | "dip" | "handstand" | "lever" | "other" | "pull" | "push" | "squat"` et `DOS_ARBRE_MOVEMENT_FAMILY: Record<ArbreId, MovementFamily>`, exportés de `src/lib/trophies/movementFamily.ts`. `TrophyCard.movementFamily: MovementFamily` (champ requis, toujours peuplé) — consommé par Task 6 (`TrophyCard.tsx`) et Task 5 (`ExerciseFamilyIcon`, qui importe le type `MovementFamily`).

- [ ] **Step 1: Créer `src/lib/trophies/movementFamily.ts`**

```ts
import type { ArbreId } from "@/lib/backpain/arbres";

export type MovementFamily = "core" | "dip" | "handstand" | "lever" | "other" | "pull" | "push" | "squat";

// Mapping figé à la main — les 10 arbres BackPain n'ont pas de movementFamily
// propre (BackPainProgram.md ne classe pas par famille de mouvement), donc on
// les rattache au meilleur candidat parmi les 8 familles déjà curées côté
// Programme, uniquement pour le choix d'icône en Trophées.
export const DOS_ARBRE_MOVEMENT_FAMILY: Record<ArbreId, MovementFamily> = {
  A: "squat",
  B: "squat",
  C: "core",
  D: "squat",
  E: "pull",
  F: "pull",
  G: "push",
  H: "core",
  I: "core",
  J: "core",
};
```

- [ ] **Step 2: Ajouter le describe `movementFamily` dans `computeTrophies.test.ts`**

Ajouter à la fin du fichier, avant la dernière accolade fermante :

```ts

describe("computeTrophies — movementFamily", () => {
  it("carries the exercise's movementFamily for a Programme card", () => {
    const db = setup();
    // beginner[0][0] exerciseOrder 6 = "Squats", movementFamily "squat"
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 15, restSeconds: 90 });

    const cards = computeTrophies(db);
    expect(cards.find((c) => c.id === "squats")?.movementFamily).toBe("squat");
  });

  it("maps a Dos arbre to its fixed movementFamily", () => {
    const db = setup();
    const seance = startDosSeance(db, "2026-01-05", "lundi", 1);
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 0, exerciseId: "A-1", setNumber: 1, valeurTarget: "8-10", valeurActual: 8, restSeconds: 60 });

    const cards = computeTrophies(db);
    expect(cards.find((c) => c.id === "A")?.movementFamily).toBe("squat");
  });

  it("always tags a Tracking card as other", () => {
    const db = setup();
    const seance = startTrackingSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);

    const cards = computeTrophies(db).filter((c) => c.module === "tracking");
    expect(cards[0]?.movementFamily).toBe("other");
  });
});
```

- [ ] **Step 3: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run src/lib/trophies/computeTrophies.test.ts`
Expected: FAIL — `movementFamily` est `undefined` sur chaque carte.

- [ ] **Step 4: Modifier `computeTrophies.ts`**

Ajouter l'import (après la ligne 5, `import { ARBRE_EXERCISE_ID } from "@/lib/dos/bilan";`) :

```ts
import { DOS_ARBRE_MOVEMENT_FAMILY, type MovementFamily } from "./movementFamily";
```

Ajouter le champ au type `TrophyCard` (après `unit: "reps" | "seconds";`, ligne 11) :

```ts
  movementFamily: MovementFamily;
```

Ajouter le champ au type `Accumulator` (après `unit: "reps" | "seconds";`, ligne 37) :

```ts
  movementFamily: MovementFamily;
```

Dans la boucle Programme, ajouter au literal de création d'entrée (après `unit: "reps",`, ligne 83) :

```ts
        movementFamily: exercise.movementFamily as MovementFamily,
```

Dans la boucle Dos, ajouter au literal de création d'entrée (après `unit: "reps",`, ligne 119) :

```ts
        movementFamily: DOS_ARBRE_MOVEMENT_FAMILY[arbre],
```

Dans la boucle Tracking, ajouter au literal de création d'entrée (après `unit: row.unit,`, ligne 145) :

```ts
        movementFamily: "other",
```

Dans le `return` final (le `.map` sur `acc.entries()`), ajouter au literal retourné (après `unit: entry.unit,`, ligne 160) :

```ts
    movementFamily: entry.movementFamily,
```

- [ ] **Step 5: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run src/lib/trophies/computeTrophies.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/trophies/movementFamily.ts src/lib/trophies/computeTrophies.ts src/lib/trophies/computeTrophies.test.ts
git commit -m "feat(trophies): computeTrophies porte la famille de mouvement de chaque carte"
```

---

## Task 5: Icônes de famille de mouvement

**Files:**
- Create: `src/components/icons/IconFamilyPush.tsx`
- Create: `src/components/icons/IconFamilyPull.tsx`
- Create: `src/components/icons/IconFamilySquat.tsx`
- Create: `src/components/icons/IconFamilyCore.tsx`
- Create: `src/components/icons/IconFamilyDip.tsx`
- Create: `src/components/icons/IconFamilyHandstand.tsx`
- Create: `src/components/icons/IconFamilyLever.tsx`
- Create: `src/components/icons/IconFamilyOther.tsx`
- Create: `src/components/trophies/ExerciseFamilyIcon.tsx`

**Interfaces:**
- Consumes: `MovementFamily` (Task 4, `src/lib/trophies/movementFamily.ts`).
- Produces: `ExerciseFamilyIcon({ family, size, className }: { family: MovementFamily; size?: number; className?: string })`, consommé par Task 6 (`TrophyCard.tsx`).

Pas de test dédié — icônes purement visuelles (aucun autre composant du dossier `src/components/icons/` n'a de test), validées via les tests de `TrophyCard` (Task 6) qui vérifient la présence de l'icône rendue.

- [ ] **Step 1: Créer `src/components/icons/IconFamilyPush.tsx`**

```tsx
import { Icon } from "../Icon";

export function IconFamilyPush({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M12 20V7" />
      <path d="M7 12l5-5 5 5" />
      <path d="M5 20h14" />
    </Icon>
  );
}
```

- [ ] **Step 2: Créer `src/components/icons/IconFamilyPull.tsx`**

```tsx
import { Icon } from "../Icon";

export function IconFamilyPull({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M12 4v13" />
      <path d="M17 12l-5 5-5-5" />
      <path d="M5 4h14" />
    </Icon>
  );
}
```

- [ ] **Step 3: Créer `src/components/icons/IconFamilySquat.tsx`**

```tsx
import { Icon } from "../Icon";

export function IconFamilySquat({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M5 7v5l7 6 7-6V7" />
    </Icon>
  );
}
```

- [ ] **Step 4: Créer `src/components/icons/IconFamilyCore.tsx`**

```tsx
import { Icon } from "../Icon";

export function IconFamilyCore({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="12" r="7" />
      <path d="M7.5 12h9" />
    </Icon>
  );
}
```

- [ ] **Step 5: Créer `src/components/icons/IconFamilyDip.tsx`**

```tsx
import { Icon } from "../Icon";

export function IconFamilyDip({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M5 6v12" />
      <path d="M19 6v12" />
      <path d="M5 12h14" />
    </Icon>
  );
}
```

- [ ] **Step 6: Créer `src/components/icons/IconFamilyHandstand.tsx`**

```tsx
import { Icon } from "../Icon";

export function IconFamilyHandstand({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="6" r="2" />
      <path d="M12 8v9" />
      <path d="M6 20h12" />
    </Icon>
  );
}
```

- [ ] **Step 7: Créer `src/components/icons/IconFamilyLever.tsx`**

```tsx
import { Icon } from "../Icon";

export function IconFamilyLever({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <circle cx="6" cy="16" r="2" />
      <path d="M6 16L19 6" />
    </Icon>
  );
}
```

- [ ] **Step 8: Créer `src/components/icons/IconFamilyOther.tsx`**

```tsx
import { Icon } from "../Icon";

export function IconFamilyOther({ size, className }: { size?: number; className?: string }) {
  return (
    <Icon size={size} className={className}>
      <path d="M4 9v6" />
      <path d="M7 7v10" />
      <path d="M17 7v10" />
      <path d="M20 9v6" />
      <path d="M7 12h10" />
    </Icon>
  );
}
```

- [ ] **Step 9: Créer `src/components/trophies/ExerciseFamilyIcon.tsx`**

```tsx
import type { ComponentType } from "react";
import { IconFamilyPush } from "@/components/icons/IconFamilyPush";
import { IconFamilyPull } from "@/components/icons/IconFamilyPull";
import { IconFamilySquat } from "@/components/icons/IconFamilySquat";
import { IconFamilyCore } from "@/components/icons/IconFamilyCore";
import { IconFamilyDip } from "@/components/icons/IconFamilyDip";
import { IconFamilyHandstand } from "@/components/icons/IconFamilyHandstand";
import { IconFamilyLever } from "@/components/icons/IconFamilyLever";
import { IconFamilyOther } from "@/components/icons/IconFamilyOther";
import type { MovementFamily } from "@/lib/trophies/movementFamily";

type FamilyIconProps = { size?: number; className?: string };

const ICONS_BY_FAMILY: Record<MovementFamily, ComponentType<FamilyIconProps>> = {
  core: IconFamilyCore,
  dip: IconFamilyDip,
  handstand: IconFamilyHandstand,
  lever: IconFamilyLever,
  other: IconFamilyOther,
  pull: IconFamilyPull,
  push: IconFamilyPush,
  squat: IconFamilySquat,
};

export function ExerciseFamilyIcon({ family, size, className }: { family: MovementFamily } & FamilyIconProps) {
  const IconComponent = ICONS_BY_FAMILY[family];
  return <IconComponent size={size} className={className} />;
}
```

- [ ] **Step 10: Vérifier que les nouveaux fichiers compilent**

Run: `npx tsc --noEmit -p tsconfig.json --pretty`, puis chercher `IconFamily` et `ExerciseFamilyIcon` dans la sortie.
Expected: aucune erreur sur ces fichiers. Une erreur sur `TrophyCard.test.tsx` (fixtures sans `movementFamily`) peut apparaître à ce stade — attendue, corrigée par la Task 6, pas un problème introduit ici.

- [ ] **Step 11: Commit**

```bash
git add src/components/icons/IconFamily*.tsx src/components/trophies/ExerciseFamilyIcon.tsx
git commit -m "feat(trophies): ajoute le jeu d'icônes par famille de mouvement"
```

---

## Task 6: TrophyCard — icône en remplacement du carré vide

**Files:**
- Modify: `src/components/trophies/TrophyCard.tsx` (fichier entier, 48 lignes)
- Test: `src/components/trophies/TrophyCard.test.tsx` (fichier entier)
- Test: `src/components/trophies/TropheesScreen.test.tsx:36-37` (deux fixtures `TrophyCard` littérales)

**Interfaces:**
- Consumes: `ExerciseFamilyIcon` (Task 5), `TrophyCard.movementFamily` (Task 4).

- [ ] **Step 0: Compléter les fixtures de `TropheesScreen.test.tsx` (champ requis depuis la Task 4)**

`TrophyCard.movementFamily` est un champ requis depuis la Task 4. `TropheesScreen.test.tsx` construit deux littéraux `TrophyCard` (lignes 36-37) qui ne le portent pas encore — `npx tsc --noEmit` échoue dessus tant que ce n'est pas fait. Ce n'est pas visible en exécutant seulement `vitest` (pas de vérification de type à l'exécution), d'où l'oubli initial du plan — mais `tsc --noEmit` fait partie de la Validation finale, donc à corriger ici.

Remplacer (ligne 36) :

```ts
    { id: "squats", module: "programme", name: "Squats", unit: "reps", total: 300, firstAt: "2026-01-01T10:00:00.000Z", lastAt: "2026-08-01T10:00:00.000Z" },
```

par :

```ts
    { id: "squats", module: "programme", name: "Squats", unit: "reps", total: 300, firstAt: "2026-01-01T10:00:00.000Z", lastAt: "2026-08-01T10:00:00.000Z", movementFamily: "squat" },
```

Remplacer (ligne 37) :

```ts
    { id: "A", module: "dos", name: "Charnière & ischios", unit: "reps", total: 120, firstAt: "2026-02-01T10:00:00.000Z", lastAt: "2026-08-05T10:00:00.000Z", byCran: [{ cran: 1, nom: "Hip hinge au bâton", total: 120 }] },
```

par :

```ts
    { id: "A", module: "dos", name: "Charnière & ischios", unit: "reps", total: 120, firstAt: "2026-02-01T10:00:00.000Z", lastAt: "2026-08-05T10:00:00.000Z", byCran: [{ cran: 1, nom: "Hip hinge au bâton", total: 120 }], movementFamily: "squat" },
```

Run: `npx tsc --noEmit 2>&1 | grep TropheesScreen`
Expected: aucune sortie (plus d'erreur sur ce fichier).

- [ ] **Step 1: Mettre à jour `TrophyCard.test.tsx`**

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  unit: "reps",
  total: 340,
  firstAt: "2026-01-01T10:00:00.000Z",
  lastAt: "2026-08-01T10:00:00.000Z",
  movementFamily: "squat",
};

const DOS_CARD: TrophyCardData = {
  id: "A",
  module: "dos",
  name: "Charnière & ischios",
  unit: "reps",
  total: 80,
  firstAt: "2026-01-01T10:00:00.000Z",
  lastAt: "2026-08-01T10:00:00.000Z",
  byCran: [{ cran: 1, nom: "Hip hinge au bâton", total: 80 }],
  movementFamily: "squat",
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

  it("shows a family icon in place of a photo for a Dos card", () => {
    render(<TrophyCard card={DOS_CARD} index={0} />);
    expect(screen.getByTestId("exercise-family-icon")).toBeInTheDocument();
  });

  it("shows no family icon while the Programme photo is displayed", () => {
    render(<TrophyCard card={PROGRAMME_CARD} index={0} />);
    expect(screen.queryByTestId("exercise-family-icon")).not.toBeInTheDocument();
  });

  it("falls back to the family icon when the Programme photo fails to load", () => {
    render(<TrophyCard card={PROGRAMME_CARD} index={0} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByTestId("exercise-family-icon")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows no palier and an 's' suffix for a seconds card, regardless of total", () => {
    render(<TrophyCard card={{ ...PROGRAMME_CARD, id: "tracking-1", module: "tracking", unit: "seconds", total: 900, movementFamily: "other" }} index={0} />);
    expect(screen.getByText("s")).toBeInTheDocument();
    expect(screen.queryByText(/Palier/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run src/components/trophies/TrophyCard.test.tsx`
Expected: FAIL — pas de `data-testid="exercise-family-icon"` dans le rendu actuel, et `TrophyCardData` n'a pas encore `movementFamily` requis côté type (mais Task 4 l'a déjà ajouté — l'échec ici porte sur l'absence de rendu de l'icône, pas sur le typage).

- [ ] **Step 3: Modifier `TrophyCard.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/Card";
import { useCountUp } from "./useCountUp";
import { ExerciseFamilyIcon } from "./ExerciseFamilyIcon";
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
        {hasImage ? (
          <div className="aspect-square bg-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/exercises/${card.id}.jpg`}
              alt={card.name}
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        ) : (
          <div
            data-testid="exercise-family-icon"
            className="aspect-square bg-canvas flex items-center justify-center text-graphite"
          >
            <ExerciseFamilyIcon family={card.movementFamily} size={40} />
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

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run src/components/trophies/TrophyCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Lancer toute la suite Trophées**

Run: `npx vitest run src/lib/trophies src/components/trophies`
Expected: PASS (y compris `TropheesScreen.test.tsx`, `loadTropheesScreenState.test.ts`, `loadTrophyDetail.test.ts`, non modifiés mais dépendants du type `TrophyCard`)

- [ ] **Step 6: Commit**

```bash
git add src/components/trophies/TrophyCard.tsx src/components/trophies/TrophyCard.test.tsx
git commit -m "feat(trophies): affiche l'icône de famille à la place du carré vide"
```

---

## Validation finale

- [ ] **Run: `npx vitest run`** — suite complète verte.
- [ ] **Run: `npx tsc --noEmit`** — aucune erreur de type.
- [ ] Vérification manuelle (`npm run dev`) : sur Aujourd'hui, taper « et N autres » sur la carte Programme et la carte Dos déplie la liste sur place, retaper (« Voir moins ») la replie ; sur Trophées, une carte Dos et une carte Tracking affichent une icône cohérente avec leur famille, une carte Programme affiche toujours sa photo quand elle existe.
