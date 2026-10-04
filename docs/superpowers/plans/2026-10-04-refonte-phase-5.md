# Refonte « Agrès » — Phase 5 (Tracking + repos par exercice) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Une seule page Tracking selon `design/v1/tracking.html` (semaine, prochaine séance, édition en feuille, historique) et un repos entre séries propre à chaque exercice.

**Spec:** `docs/superpowers/specs/2026-10-04-refonte-graphique-design.md` § Tracking et § Repos par exercice · Maquette : `design/v1/tracking.html`

## Global Constraints

- Logique du Tracking inchangée (pointeur, séances, « Jour suivant »). Données de Clément intactes : `rest_seconds` NULL = réglage global.
- Nouvel exercice : 90 s par défaut, pas de 15 s, bornes 15 → 600 s.
- Passer en repos ne supprime pas les exercices du jour (comportement existant).
- `/tracking/programme` redirige vers `/tracking` (liens existants, favoris).
- Accent jade : aplats `sage`, petit texte `sage-strong`, initiales `InitialTile`.

## Review Focus

- Exercice existant (rest NULL) : la puce affiche le réglage global, pas 1:30.
- Jour en repos avec exercices conservés : la feuille s'ouvre interrupteur activé ; le désactiver retrouve les exercices.
- Programme vide : pas de case « pointeur », carte « Ta semaine est vide ».
- Séance active : bandeau de reprise en haut.

### Task 1: Repos par exercice
- [ ] Migration 0017, `DayExerciseInput.restSeconds`, `Exercise.restSeconds`, `dayAsTrainDay`, `PlayerScreen` (`exercise.restSeconds ?? restBetweenSetsSeconds`). Tests.

### Task 2: Page Tracking
- [ ] `saveDay(db, day, isRest, exercises)` transactionnel + `saveDayAction`.
- [ ] `DayEditor` (contenu de feuille) : interrupteur repos, liste ↑ ↓ ×, puce « Repos m:ss » qui déplie − / +, formulaire d'ajout (nom + suggestions, unité, séries, cible, repos), `FillButton` « Enregistrer ».
- [ ] `TrackingScreen` : eyebrow « Programme perso », « TRACKING », semaine 7 cases, carte vide / prochaine séance / repos / jour sans exercice, historique « Tes séances ».
- [ ] `TrackingCard` (Aujourd'hui) pointe vers `/tracking` ; suppression de `ProgrammeScreen` Tracking.

### Task 3: Vérification locale + relecture.
