# Refonte « Agrès » — Phases 0 (fondations) et 1 (Aujourd'hui) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser le système visuel Agrès (tokens, polices, composants partagés, pictos validés) puis refaire l'écran Aujourd'hui selon `design/v1/aujourdhui.html` (mode « Sept traits »).

**Architecture:** Les noms de tokens Tailwind sont gardés (valeurs changées) ; les polices passent par `next/font` avec des variables `--nf-*` exposées en utilitaires `font-display` / `font-body` / `font-mono`. Nouveaux composants : `SeptTraits`, `ExerciseGlyph` (+ table de pictos), `FloatingNav` (remplace le rendu de `BottomNav`), `FillButton`/`FillLink`, `CycleButton`. Les écrans des phases 2–6 gardent `Pastille` jusqu'à leur propre phase.

**Tech Stack:** Next.js App Router, Tailwind v4 (`@theme`), React client components, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-04-refonte-graphique-design.md` · Maquettes : `design/v1/aujourdhui.html`, `design/v1/pictos.html`

## Global Constraints

- Tokens (valeurs exactes de la spec) : canvas `#EDEFF2`, paper `#FFFFFF`, ink `#0B0D12`, graphite `#626B78`, hairline `#D9DEE5`, cobalt `#2F2BFF`, cobalt-soft `#E6E5FF`, sage `#0F9D74`, sage-soft `#DDF3EC`, sage-ink `#0A5E47`, brass `#C8961E`, brass-soft `#F6EDD8`, alert `#B3402E`, rest-surface `#1A1E28`, rest-line `#232733`.
- Polices : Big Shoulders Display 700/800 (`font-display`), Instrument Sans 400/500/600 (`font-body`), IBM Plex Mono 400/500 (`font-mono`).
- Pictos : chemins SVG **exactement** ceux de `design/v1/pictos.html` (validés par Mathis), viewBox 24, trait 1,8, bouts et jointures arrondis.
- Toute animation respecte `prefers-reduced-motion` (état final immédiat). Liste fermée : spec § Mouvement.
- Libellés et rôles accessibles existants conservés quand l'élément existe encore (les tests s'y appuient).
- Pas de déploiement : la refonte part en prod à la fin des 6 phases.

## Review Focus

- `prefers-reduced-motion` : aucune animation ne doit bloquer un état (barrettes, traits, bouton qui se remplit) → test FillButton exécute l'action même sans animation.
- Exercice dont l'id n'a pas d'override et dont la famille est inconnue → picto de repli « other », jamais d'erreur (test ExerciseGlyph).
- Navigation desktop ≥ 1024 px → rail vertical toujours utilisable (test de classes `lg:`).
- Jour de repos / séance faite sur Aujourd'hui → la carte Programme garde ses états « Séance terminée » et « Revoir la séance » (tests existants ProgrammeCard).
- Polices : aucune occurrence restante de `font-archivo` / `--font-inter-tight` (grep dans la tâche 1).

---

### Task 1: Tokens et polices

**Files:** Modify `src/app/globals.css`, `src/lib/fonts.ts`, `src/app/layout.tsx`, `src/app/globals.test.ts`, `src/lib/fonts.test.ts` ; rename across `src/**/*.tsx`.

- [ ] Mettre à jour `globals.test.ts` / `fonts.test.ts` d'abord (nouvelles valeurs de tokens, nouvelles familles exportées `display`, `body`, `mono`) → RED.
- [ ] `fonts.ts` :

```ts
import { Big_Shoulders_Display, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";

export const display = Big_Shoulders_Display({ subsets: ["latin"], weight: ["700", "800"], variable: "--nf-display", display: "swap" });
export const body = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--nf-body", display: "swap" });
export const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--nf-mono", display: "swap" });
```

- [ ] `globals.css` `@theme` : nouvelles valeurs de couleurs + `--color-cobalt-soft`, `--color-sage-soft`, `--color-sage-ink`, `--color-brass-soft`, `--color-rest-surface`, `--color-rest-line` ; `--radius-card: 24px` ; `--text-112: 112px; --text-120: 120px;` ; `--font-display: var(--nf-display), "Arial Narrow", Impact, sans-serif; --font-body: var(--nf-body), -apple-system, "Segoe UI", sans-serif; --font-mono: var(--nf-mono), ui-monospace, Menlo, monospace;` ; retirer `--font-archivo` / `--font-inter-tight`. `:focus-visible` garde `ink`.
- [ ] `layout.tsx` : `className={`${display.variable} ${body.variable} ${mono.variable}`}` sur `<html>`, `className="font-body"` sur `<body>`.
- [ ] Renommage mécanique : `font-archivo` → `font-display` dans `src/**/*.tsx` ; `font-[family-name:var(--font-inter-tight)]` → `font-body`. Vérif : `grep -rn "font-archivo\|font-inter-tight" src` → vide.
- [ ] `npx vitest run && npx tsc --noEmit` → vert. Commit `style: tokens et polices Agrès`.

### Task 2: `SeptTraits`

**Files:** Create `src/components/SeptTraits.tsx` + test.

**Produces:** `SeptTraits({ states: PastilleState[]; accent?: Accent; size?: "lg" | "sm"; showNumbers?: boolean; todayCaret?: boolean })`. Réutilise le type `PastilleState` (`upcoming | today | done | skipped | restOrWalk`).

- [ ] Tests : 7 éléments `role="img"` avec `aria-label` « Jour N : Fait / Aujourd'hui / À venir / Sauté / Repos » ; classe pleine accent pour `done`, accent à 35 % pour `today`, trait fin pour `restOrWalk` ; flèche `aria-hidden` sous le jour `today` quand `todayCaret` ; numéros affichés si `showNumbers`, numéro du jour courant en accent.
- [ ] Implémentation : flex de 7 traits (`lg` : 32 × 6 px, gap 8 ; `sm` : 22 × 4 px, gap 4), animation CSS `trait-grow` (scaleX 0 → 1, 400 ms, décalage `i × 60 ms`) déclarée dans `globals.css` avec garde `prefers-reduced-motion`.
- [ ] Commit `feat(ui): composant SeptTraits`.

### Task 3: Pictos et `ExerciseGlyph`

**Files:** Create `src/components/glyphs/glyphPaths.ts`, `src/components/glyphs/ExerciseGlyph.tsx` + test ; Modify les 8 `src/components/icons/IconFamily*.tsx` (nouveaux chemins), `ExerciseFamilyIcon.tsx` (délègue).

**Produces:** `FAMILY_GLYPHS: Record<MovementFamily, string>` et `EXERCISE_GLYPHS: Record<string, string>` (chaînes SVG internes, copiées de `design/v1/pictos.html`, 15 ids : biceps-curls, burpees, calf-raises, dragon-lifts, hanging-bent-knees-raises, hanging-knee-raises, hefesto-curls, icecream-makers, inverted-deadlift, one-leg-dragon-negatives, pike-walks, side-bar-raises, supported-triceps-extensions, triceps-extensions, triceps-extensions-on-ground) ; `glyphFor(exerciseId: string | null, family: MovementFamily | null): string` ; `ExerciseGlyph({ exerciseId?, family?, accent?: "cobalt" | "sage", size?: "md" | "lg" })` (md = pastille 36 px / picto 20 ; lg = 84 px / 48).

- [ ] Tests : override par id prioritaire sur la famille ; famille sans override → picto de famille ; famille inconnue / null → picto « other » ; rendu `aria-hidden` ; pastille `bg-cobalt-soft text-cobalt` par défaut, `bg-sage-soft text-sage-ink` pour `sage`.
- [ ] Chemins rendus via `dangerouslySetInnerHTML` sur un `<svg>` (chaînes constantes du dépôt, jamais de donnée utilisateur) ; `strokeWidth 1.8`.
- [ ] Les `IconFamily*` reprennent les chemins de `FAMILY_GLYPHS` (Trophées continue de fonctionner jusqu'à la phase 4).
- [ ] Commit `feat(ui): pictos d'exercices validés et ExerciseGlyph`.

### Task 4: `FloatingNav`

**Files:** Modify `src/components/BottomNav.tsx` + test (garde son API `items`) ; `src/app/(shell)/layout.tsx` (marges).

- [ ] Tests : 4 liens conservés ; actif = `aria-current="page"` + `text-ink` ; pastille blanche décalée de `index × 100 %` ; classes `lg:` de rail vertical présentes ; `z-30` conservé.
- [ ] Rendu : pilule `bg-ink/92` + `backdrop-blur`, `fixed left-3.5 right-3.5 bottom-[calc(18px+env(safe-area-inset-bottom))] h-[66px] rounded-pill grid grid-cols-4 p-1.5` ; pastille `absolute` blanche, `transition-transform duration-500` ; libellés `font-mono text-[10px] uppercase tracking-[0.06em]`. ≥ 1024 : `lg:static lg:flex-col lg:w-20 lg:h-auto lg:rounded-[40px]`, pastille en translateY.
- [ ] `main` : `pb-28` (nav flottante plus haute).
- [ ] Commit `feat(ui): barre de navigation flottante`.

### Task 5: `FillButton`, `FillLink`, `CycleButton`, `Sheet`

**Files:** Create `src/components/FillButton.tsx` + test, `src/components/CycleButton.tsx` + test ; Modify `src/components/Sheet.tsx` (+ test si nécessaire).

**Produces:** `FillButton({ children, onClick, accent?, disabled?, ariaLabel? })` ; `FillLink({ href, children, accent? })` (anime puis `router.push(href)`) ; `CycleButton<T>({ options: { value: T; label: string }[]; value: T; onChange(v: T); ariaLabelPrefix: string })`.

- [ ] Tests FillButton : clic → `onClick` appelé (après ≤ 420 ms, timers simulés) ; avec `prefers-reduced-motion` → appelé immédiatement ; `disabled` → jamais appelé. FillLink : clic → `push(href)`.
- [ ] Tests CycleButton : chaque clic passe à l'option suivante et boucle ; `aria-label` = `${prefix} : ${label}`.
- [ ] Sheet : poignée, `rounded-t-[28px]`, transition de montée ; API inchangée (tests existants verts).
- [ ] Commit `feat(ui): boutons qui se remplissent, bouton cyclique, feuille restylée`.

### Task 6: Données d'Aujourd'hui

**Files:** Modify `src/lib/programme/loadTodayState.ts` + test.

- [ ] Test : chaque exercice de `state.exercises` porte `id`, `family` (movementFamily) et `sets` en plus de `name` / `dose`.
- [ ] Implémentation : ajouter les trois champs depuis le `TrainDay`.
- [ ] Commit `feat(today): expose id, famille et séries des exercices`.

### Task 7: Écran Aujourd'hui

**Files:** Modify `AujourdhuiHeader.tsx`, `ProgrammeCard.tsx`, `ResumeBanner.tsx`, `TrackingCard.tsx`, `AujourdhuiScreen.tsx` + leurs tests.

- [ ] En-tête : date en `font-mono` 11 px capitales ; « SALUT <PRÉNOM>. » en `font-display` 800, 44 px, capitales, sur deux lignes ; bouton Réglages rond 44 px.
- [ ] `ResumeBanner` : fond `ink`, point accent qui pulse (`animate-ping` borné), libellé mono « Séance interrompue », « Reprendre à <b>exercice</b> », flèche.
- [ ] `ProgrammeCard` : carte `paper` 28 px ; eyebrow « Programme · <parcours> » / « Niveau N » ; « J<n><sup>/7</sup> » en `font-display` 96 px centré ; `SeptTraits` lg avec numéros et flèche ; méta « <n> exercices · <m> min » ; lignes exercice = `ExerciseGlyph` md + nom + dose `font-display` 20 px + barrettes (une par série, `sets`) ; « +N autres exercices » (dépliable, comme avant) ; `FillLink` « Commencer la séance » (ou état « Séance terminée » + « Revoir la séance » inchangé).
- [ ] `TrackingCard` : accent jade, mêmes états qu'avant (vide → « Composer mon programme », repos, jour, séance en cours).
- [ ] Tests : libellés existants conservés ; nouveau test « affiche J<n>/7 et 7 traits » ; « une barrette par série ».
- [ ] Commit `feat(today): écran Aujourd'hui Agrès`.

### Task 8: Vérification locale

- [ ] `npx vitest run && npx tsc --noEmit`.
- [ ] Copie fraîche des DB prod, `next dev -H 0.0.0.0 -p 3100` connecté comme Mathis ; comparer à `design/v1/aujourdhui.html` (mode Sept traits) sur iPhone et Mac ; checklist à Mathis.
