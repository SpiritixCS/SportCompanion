# Mode pyramide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pyramides (classique 1→N→1, inversée N→1→N) jouées dans le player, en séance libre depuis la page Tracking ou comme exercice d'un jour Tracking, avec repos automatique par marche, liaison au catalogue pour les Trophées et historique.

**Architecture:** Un moteur pur (`src/lib/pyramide/pyramid.ts`) calcule marches, totaux et repos. Le player existant sert la pyramide comme un exercice dont chaque série a sa cible (`Exercise.pyramid`). Une pyramide libre est une séance Tracking avec une ligne `tracking_pyramids` ; un exercice pyramide de jour est une ligne `tracking_program_day_exercises` avec `pyramid_shape`/`pyramid_peak`. Les exercices Tracking liés au catalogue (`catalog_id`) créditent la carte Trophées de l'exercice Caliathletics.

**Tech Stack:** Next.js 16 App Router, better-sqlite3, Vitest + Testing Library, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-04-mode-pyramide-design.md`

## Global Constraints

- Données existantes intactes : toutes les nouvelles colonnes sont NULL pour les lignes existantes ; aucune ligne existante modifiée par la migration.
- Sommet borné 2 → 30, côté client (− / +) et côté serveur (actions).
- Repos par marche : `round15(15 + 105 × (reps / peak)^1.5)` borné [15, 120] ; dernière marche d'un exercice de jour → réglage global « Repos entre exercices ».
- Une seule séance Tracking active à la fois (`getActiveSeance`).
- Unité reps uniquement ; accent jade ; libellés « Marche s / M », « Marche terminée », « Pyramide 1→N→1 » / « Pyramide N→1→N ».
- Composants Agrès existants : `Sheet`, `CycleButton`, `FillButton`, `InitialTile`, `ExerciseGlyph`.

## Review Focus

- Reprise d'une pyramide interrompue à la bonne marche, avec la bonne cible (persistance, bug v1 de CLAUDE.md §2).
- Exercice libre du même nom qu'un exercice du catalogue : rattaché sans perdre de reps (le total change de carte).
- Séance de jour active + « Lancer une pyramide » (et l'inverse) : jamais deux séances actives.
- Inversée : total `peak² + peak − 1`, repos le plus long en début et en fin.
- Séries Tracking existantes (catalog_id NULL) : Trophées strictement inchangés.

## File Structure

- Create `src/lib/pyramide/pyramid.ts` (+ test) — moteur pur.
- Create `src/lib/pyramide/catalog.ts` (+ test) — exercices du catalogue éligibles, recherche par nom.
- Create `migrations/0018_pyramide.sql` (+ test).
- Modify `src/lib/tracking/db.ts` — exercice lié au catalogue, pyramides (création, lecture, dernier sommet), séances actives/terminées avec config pyramide.
- Modify `src/lib/tracking/program.ts`, `dayAsTrainDay.ts` — colonnes pyramide des jours.
- Modify `src/lib/trophies/computeTrophies.ts` — séries liées → carte catalogue.
- Modify `src/lib/workout/types.ts`, `src/components/player/{PlayerScreen,ExerciseView,RestView,SummaryView}.tsx`.
- Create `src/components/player/PyramidBars.tsx` — silhouette.
- Modify `src/components/tracking/{DayEditor,TrackingScreen}.tsx`, `src/components/today/TrackingCard.tsx`.
- Create `src/components/tracking/PyramidLauncher.tsx` (+ test), `src/app/player/pyramide/page.tsx`.
- Modify `src/lib/tracking/actions.ts`, `src/lib/tracking/loadTrackingScreenState.ts`.

---

### Task 1: Moteur pyramide

**Files:** Create `src/lib/pyramide/pyramid.ts`, `src/lib/pyramide/pyramid.test.ts`

**Interfaces — Produces:**
```ts
export type PyramidShape = "classic" | "inverted";
export const PEAK_MIN = 2, PEAK_MAX = 30;
export function clampPeak(peak: number): number;
export function pyramidSteps(shape: PyramidShape, peak: number): number[];
export function pyramidTotal(shape: PyramidShape, peak: number): number;
export function pyramidRestSeconds(reps: number, peak: number): number;
export function pyramidLabel(shape: PyramidShape, peak: number): string; // "Pyramide 1→7→1" / "Pyramide 7→1→7"
```

- [ ] **Step 1: tests (RED)**
```ts
expect(pyramidSteps("classic", 4)).toEqual([1, 2, 3, 4, 3, 2, 1]);
expect(pyramidSteps("inverted", 4)).toEqual([4, 3, 2, 1, 2, 3, 4]);
expect(pyramidTotal("classic", 7)).toBe(49);
expect(pyramidTotal("inverted", 4)).toBe(19);
expect([1, 5, 10, 15].map((r) => pyramidRestSeconds(r, 15))).toEqual([15, 30, 75, 120]);
expect([1, 3, 5].map((r) => pyramidRestSeconds(r, 5))).toEqual([30, 60, 120]);
expect(clampPeak(1)).toBe(2); expect(clampPeak(99)).toBe(30); expect(clampPeak(7.6)).toBe(8);
expect(pyramidLabel("classic", 7)).toBe("Pyramide 1→7→1");
expect(pyramidLabel("inverted", 7)).toBe("Pyramide 7→1→7");
```
- [ ] **Step 2:** `npx vitest run src/lib/pyramide` → FAIL (module absent).
- [ ] **Step 3: implémentation**
```ts
export function pyramidSteps(shape: PyramidShape, peak: number): number[] {
  const p = clampPeak(peak);
  const up = Array.from({ length: p }, (_, i) => i + 1);
  const classic = [...up, ...up.slice(0, -1).reverse()];
  return shape === "classic" ? classic : classic.map((r) => p + 1 - r);
}
export function pyramidRestSeconds(reps: number, peak: number): number {
  const raw = 15 + 105 * Math.pow(Math.min(1, reps / peak), 1.5);
  return Math.min(120, Math.max(15, Math.round(raw / 15) * 15));
}
```
- [ ] **Step 4:** tests → PASS. Commit `feat(pyramide): moteur des marches, totaux et repos`.

### Task 2: Migration 0018 et couche données

**Files:** Create `migrations/0018_pyramide.sql`, `migrations/0018_pyramide.test.ts`, `src/lib/pyramide/catalog.ts` (+ test). Modify `src/lib/tracking/db.ts`, `program.ts`, `dayAsTrainDay.ts` (+ tests).

**Migration:**
```sql
-- Mode pyramide. Additive : colonnes NULL pour toutes les lignes existantes.
ALTER TABLE tracking_exercises ADD COLUMN catalog_id TEXT;
CREATE UNIQUE INDEX tracking_exercises_catalog ON tracking_exercises (catalog_id) WHERE catalog_id IS NOT NULL;
ALTER TABLE tracking_program_day_exercises ADD COLUMN pyramid_shape TEXT CHECK (pyramid_shape IN ('classic', 'inverted'));
ALTER TABLE tracking_program_day_exercises ADD COLUMN pyramid_peak INTEGER CHECK (pyramid_peak BETWEEN 2 AND 30);
CREATE TABLE tracking_pyramids (
  seance_id INTEGER PRIMARY KEY REFERENCES tracking_seances(id),
  exercise_name TEXT NOT NULL,
  shape TEXT NOT NULL CHECK (shape IN ('classic', 'inverted')),
  peak INTEGER NOT NULL CHECK (peak BETWEEN 2 AND 30)
);
```

**Interfaces — Produces:**
```ts
// catalog.ts
export type CatalogExercise = { id: string; name: string; movementFamily: MovementFamily };
export function catalogExercises(): CatalogExercise[]; // countsInStats && unit reps, dédoublonnés par id, triés par nom
export function findCatalogByName(name: string): CatalogExercise | null; // casse et espaces ignorés
// db.ts
export function findOrCreateLinkedExercise(db, catalog: CatalogExercise): TrackingExercise;
logSetForExercise(db, seanceId, name, unit, valeur, count, exerciseOrder, catalog?: CatalogExercise) // avec `catalog` : l'exercice est résolu par findOrCreateLinkedExercise ; sans : comportement actuel (par nom)
export type PyramidConfig = { exerciseName: string; shape: PyramidShape; peak: number };
export function startPyramidSeance(db, config: PyramidConfig): TrackingSeance; // throw si une séance active existe
export function getPyramid(db, seanceId: number): PyramidConfig | null;
export function lastPeakFor(db, exerciseName: string): number | null; // pyramide terminée la plus récente, casse ignorée
// TrackingSeance gagne `pyramid: PyramidConfig | null` (getActiveSeance, getSeanceById)
// TrackingSeanceSummary gagne `pyramid: PyramidConfig | null` (listCompletedSeances)
// program.ts : DayExerciseInput gagne `pyramid?: { shape: PyramidShape; peak: number } | null`
```

- [ ] **Step 1: tests (RED)**
  - migration : tables/colonnes présentes ; une ligne `tracking_program_day_exercises` et une ligne `tracking_exercises` créées avant 0018 gardent `pyramid_shape`/`pyramid_peak`/`catalog_id` NULL.
  - `catalogExercises()` contient `pull-ups` une seule fois, aucun exercice `countsInStats: false` ni en secondes ; `findCatalogByName(" pull UPS ")?.id === "pull-ups"`.
  - `findOrCreateLinkedExercise` : crée `{ name: "Pull ups", catalog_id: "pull-ups" }` ; rappel → même id ; ligne libre préexistante « Pull ups » (catalog NULL) → reçoit `catalog_id`, même id, ses séries conservées.
  - `startPyramidSeance` crée séance + config ; seconde création alors qu'une séance (jour ou pyramide) est active → throw `"Une séance Tracking est déjà en cours"`.
  - `lastPeakFor` : deux pyramides terminées « Dips » (sommets 5 puis 7) → 7 ; « dips » → 7 ; séance non terminée ignorée ; inconnu → null.
  - `listCompletedSeances` : pyramide terminée → `pyramid` renseigné ; séance de jour → `pyramid: null`.
  - `setDayExercises` avec `pyramid: { shape: "inverted", peak: 6 }` → `sets_count` 11, `target_value` 6, `unit` reps, `rest_seconds` NULL ; relecture → `pyramid` restitué ; exercice sans pyramide → `pyramid: null`.
  - `dayAsTrainDay` : exercice pyramide → `{ sets: 11, pyramid: { shape: "inverted", peak: 6 } }` ; id lié au catalogue quand le nom correspond (`id: "pull-ups"`, famille du catalogue), sinon `day-<d>-<o>`.
- [ ] **Step 2:** `npx vitest run migrations src/lib/pyramide src/lib/tracking` → FAIL.
- [ ] **Step 3:** implémentation (migration, catalog, db, program, dayAsTrainDay). `catalogExercises` parcourt `PARCOURS[].program[][]` ; fixtures existantes : ajouter `pyramid: null` aux objets `DayExercise` comme pour `restSeconds`.
- [ ] **Step 4:** tests → PASS ; suite complète verte. Commit `feat(pyramide): migration 0018, pyramides et liaison au catalogue`.

### Task 3: Trophées

**Files:** Modify `src/lib/trophies/computeTrophies.ts` (+ test).

- [ ] **Step 1: tests (RED)**
  - série Tracking d'un exercice `catalog_id = "pull-ups"` + séries Programme de pull-ups → une seule carte `pull-ups`, total = somme, `module: "programme"`.
  - série liée sans aucune série Programme → carte `pull-ups` créée (nom et famille du catalogue).
  - série Tracking non liée → carte `tracking-<id>` inchangée.
- [ ] **Step 2:** FAIL. **Step 3:** sélectionner `te.catalog_id` dans la requête Tracking ; si non NULL, `id = catalog_id`, métadonnées via `catalogExercises()`. **Step 4:** PASS. Commit `feat(trophees): reps des pyramides liées sur la carte du catalogue`.

### Task 4: Maquette (validation Mathis)

- [ ] Artifact « Pyramide » : feuille de lancement (exercice, forme, sommet, total en direct) et écran de marche (silhouette, « Marche s / M », cible), dans le style `design/v1/`. Publier, puis copie locale `design/v1/pyramide.html`.
- [ ] **Stop : attendre la validation de Mathis** avant les tâches 5 à 7.

### Task 5: Player

**Files:** Modify `src/lib/workout/types.ts`, `PlayerScreen.tsx`, `ExerciseView.tsx`, `RestView.tsx`, `SummaryView.tsx` (+ tests). Create `PyramidBars.tsx`.

**Interfaces:** `Exercise.pyramid?: { shape: PyramidShape; peak: number }` ; helper `setTarget(exercise, setNumber): number | null` dans `src/lib/pyramide/pyramid.ts` (cible de la marche, null hors pyramide).

- [ ] **Step 1: tests (RED)** (`PlayerScreen.test.tsx`, `ExerciseView.test.tsx`)
  - exercice pyramide classique sommet 3, série 2 : « Marche 2 / 5 », objectif « 2 », bouton « Marche terminée », 5 barres `data-testid="pyramid-bar"` : marche 1 `done`, marche 2 `current`, marches 3–5 `upcoming`.
  - valider la marche 2 (non dernière) → `onLogSet` avec `restSeconds = pyramidRestSeconds(2, 3)` et RestView affiche cette durée ; la saisie est préremplie avec 2.
  - dernière marche d'un exercice suivi d'un autre → repos = `restBetweenExercisesSeconds`.
  - carte « Ensuite » : « Marche 3 / 5 · 3 reps ».
  - récap : « Pyramide 1→3→1 » sur la ligne de l'exercice.
- [ ] **Step 2:** FAIL. **Step 3:** implémentation ; `PyramidBars` = rangée de barres de hauteur ∝ marche, `data-state` done/current/upcoming, `set-pulse` sur la courante. **Step 4:** PASS. Commit `feat(pyramide): marches dans le player`.

### Task 6: Exercice pyramide dans un jour Tracking

**Files:** Modify `DayEditor.tsx`, `TrackingScreen.tsx`, `TrackingCard.tsx` (+ tests), `actions.ts` (`logDaySetAction` lie au catalogue pour un exercice pyramide).

- [ ] **Step 1: tests (RED)**
  - `DayEditor` : bascule « Pyramide » → forme (CycleButton « Forme : Classique ») + sommet (− / + « Sommet moins » / « Sommet plus ») ; « Ajouter l'exercice » → ligne « Pyramide 1→5→1 », pas de puce Repos ; `onSave` reçoit `{ name, unit: "reps", setsCount: 9, targetValue: 5, restSeconds: null, pyramid: { shape: "classic", peak: 5 } }`.
  - `TrackingScreen` / `TrackingCard` : dose « Pyramide 1→5→1 » au lieu de « 9 × 5 ».
- [ ] **Step 2:** FAIL. **Step 3:** implémentation. **Step 4:** PASS. Commit `feat(pyramide): exercice pyramide dans les jours Tracking`.

### Task 7: Pyramide libre

**Files:** Create `PyramidLauncher.tsx` (+ test), `src/app/player/pyramide/page.tsx`. Modify `TrackingScreen.tsx`, `TrackingCard.tsx`, `loadTrackingScreenState.ts`, `actions.ts` (+ tests).

**Interfaces:**
```ts
// actions.ts
export async function startPyramidAction(input: { exerciseName: string; shape: PyramidShape; peak: number }): Promise<void>; // nom requis, peak borné, refus si séance active
export async function lastPeakAction(exerciseName: string): Promise<number | null>;
export async function logPyramidSetAction(params: LogSetParams): Promise<void>; // série liée au catalogue si le nom correspond
export async function completePyramidAction(seanceId: number): Promise<void>; // n'avance PAS le pointeur
// loadTrackingScreenState : activeSeance gagne `pyramid: PyramidConfig | null`
export function activeSeanceHref(active: { id: number; dayOfWeek: number | null; pyramid: PyramidConfig | null }): string;
// pyramide → "/player/pyramide" ; jour → "/player/tracking?day=N" ; sinon "/tracking/<id>"
```

- [ ] **Step 1: tests (RED)**
  - `PyramidLauncher` : suggestions (catalogue + exercices connus) ; sommet prérempli par `lastPeak` ; total « 25 reps · 9 marches » qui suit sommet et forme ; « Lancer » désactivé nom vide ; appelle `startPyramidAction({ exerciseName: "Pull ups", shape: "classic", peak: 5 })` puis navigue vers `/player/pyramide` ; séance active → bouton « Reprendre ta séance en cours » vers `activeSeanceHref`.
  - `activeSeanceHref` : les trois cas.
  - `TrackingScreen` : carte « Pyramide » présente ; historique « Pyramide · Pull ups » + « 1→7→1 · 49 reps ».
  - `startPyramidAction` côté db : refus si séance active (déjà couvert Task 2), peak 99 → 30.
  - persistance : marche 3 enregistrée, rechargement de l'état → reprise à la marche 4 (`loadDayPlayerState`-like pour la pyramide : `loadPyramidPlayerState`).
- [ ] **Step 2:** FAIL. **Step 3:** implémentation ; page `/player/pyramide` : séance active avec config pyramide, sinon redirect `/tracking` ; `TrainDay` à un exercice `{ id: catalog?.id ?? "pyramide-<seanceId>", name, movementFamily: catalog?.movementFamily ?? "other", pyramid }` ; accent sage ; exercice lié au catalogue → `ExerciseGlyph` accent sage au lieu de l'initiale. **Step 4:** PASS. Commit `feat(pyramide): pyramide libre depuis la page Tracking`.

### Task 8: Vérification locale + relecture

- [ ] Suite complète, `tsc`, build ; serveur de dev sur copie fraîche des DB de prod ; parcours complet (lancer, interrompre, reprendre, terminer ; jour Tracking avec pyramide) ; relecture finale Opus ; checklist à Mathis ; mise en prod après son « ok ».
