# Refonte « Agrès » — Phase 3 (Séance) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Refaire le mode séance (exercice, saisie, repos, récap) selon `design/v1/seance.html`, sans changer la logique du player (chantier 2 inclus).

**Spec:** `docs/superpowers/specs/2026-10-04-refonte-graphique-design.md` § Séance · Maquette : `design/v1/seance.html`

## Global Constraints

- Logique inchangée : `PlayerScreen` (durée active, feuilles pause / sortie / effacement), `RestView` (fin calculée sur `endAt`, +15 s, passer).
- Libellés accessibles conservés : « Quitter la séance », « Série terminée », « Passer l'exercice », « Valider », « +15 s », « Passer le repos » (nom accessible ; texte visible « Passer »), « Terminer », « Continuer la séance », « Repos entre séries » / « Exercice suivant », « Exercice N / M · Série s / t », « Exercice N / M terminé ».
- Programme : picto (`ExerciseGlyph` lg) à la place de la photo. Tracking (accent `sage`, famille « other ») : initiale dans une pastille jade.
- Repos : plein écran `ink`, cadran gradué, cercle blanc qui se vide, chiffre 120 px qui bat sur les 3 dernières secondes, carte « Ensuite », boutons `rest-surface` / blanc.
- Boutons primaires : `FillButton` base `ink`, balayage d'accent.

## Review Focus

- Objectif long (« 4 × 12 / côté », « 3 × max ») : tient en largeur à 375 px sans déborder.
- Repos qui atteint 0 pendant que l'onglet est en arrière-plan : `onComplete` une seule fois.
- Tracking dans le player : initiale jade, pas de picto « autre » générique.
- `prefers-reduced-motion` : pas de battement, pas de glissement.

### Task 1: Exercice + saisie
- [ ] `ExerciseView` : en-tête (croix, « Exercice N / M », durée), un trait par exercice (fait / en cours à 35 % / à venir), carte `paper` 28 px : picto lg (ou initiale jade), nom `font-display` 44 px capitales, objectif `font-display` (112 px, réduit automatiquement pour les objectifs longs), barrettes de séries (en cours = remplissage lent en boucle), « Série s / t » + « Puis <exercice suivant> » ; `FillButton` « Série terminée », « Passer l'exercice ». Glissement 240 ms à chaque nouvel exercice. Suppression du bouton « Ajuster les reps » (même action que « Série terminée »).
- [ ] `RepsSheet` : titre « Reps faites » / « Secondes tenues » (passé par `ExerciseView`), chiffre 112 px, boutons ronds 64 px (noms « + » / « − »), `FillButton` « Valider », « Supprimer la série » en `alert`.
- [ ] Prop `nextExerciseName` passée par `PlayerScreen`.

### Task 2: Repos
- [ ] `RestView` restylé (voir contraintes) ; nouvelle prop optionnelle `next: { exerciseId, family, name, setNumber, totalSets, target }` pour la carte « Ensuite » (repli sur `nextLabel`).

### Task 3: Récap
- [ ] `SummaryView` : « SÉANCE TERMINÉE » 64 px, tuiles Durée / Exercices / Répétitions comptées de 0 (`useCountUp`), lignes picto + nom + « +N reps » (+ « N au total »), palier en `brass-ink`, `FillButton` « Terminer », « Continuer la séance ».

### Task 4: Vérification locale + relecture.
