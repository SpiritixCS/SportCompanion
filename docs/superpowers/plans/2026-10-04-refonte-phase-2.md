# Refonte « Agrès » — Phase 2 (Programme) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Refaire la page Programme et la fiche du jour selon `design/v1/programme.html`.

**Architecture:** La page lit la position courante (lecture seule, `getCurrentPosition`) et la passe à `ProgrammeScreen`, qui ouvre ce parcours et ce niveau par défaut, marque le niveau « En cours » et le jour « Aujourd'hui ». Rendu : composants de la phase 0 (`SeptTraits` sm, `ExerciseGlyph`, `FillLink`, `Sheet`).

**Spec:** `docs/superpowers/specs/2026-10-04-refonte-graphique-design.md` § Programme · Maquette : `design/v1/programme.html`

## Global Constraints

- Consultation libre : la page ne modifie jamais la position (pas de `syncPosition`).
- Fiche du jour : garder « Démarrer ce jour » (lien direct player) et « Reprendre ici » avec confirmation (fonctions existantes absentes de la maquette).
- Petit texte jade/or : `sage-strong` / `brass-ink` ; aplats : `cobalt`, `cobalt-soft`.

## Review Focus

- Utilisateur sans position (premier accès) → page Débutant, aucun niveau ouvert, pas d'étiquette « En cours ».
- Position sur un autre parcours que celui affiché → pas d'étiquette sur le parcours affiché.
- Jour courant déjà validé (pastille `done`) → reste « fait », étiquette « Aujourd'hui » quand même.

### Task 1: Position courante dans l'écran
- [ ] Tests `ProgrammeScreen` : avec `current = { parcours: "intermediate", level: 2, dayIndex: 4 }` → onglet Intermédiaire actif, niveau 3 ouvert avec « En cours », « Jour 5 » porte « Aujourd'hui », son trait est `today` (si non fait) ; sans `current` → Débutant, rien d'ouvert.
- [ ] `page.tsx` : `const current = getCurrentPosition(db)` → `<ProgrammeScreen current={current && { parcours, level, dayIndex }} … />` ; `initialParcours` dérivé.
- [ ] Commit `feat(programme): ouvre le parcours et le niveau en cours`.

### Task 2: Rendu de la liste
- [ ] Titre « PROGRAMME » (`font-display` 56 px capitales) + eyebrow « Consultation libre » + « Ta progression ne bouge pas quand tu consultes. ».
- [ ] Sélecteur de parcours : pilule blanche, pastille `ink` qui glisse (même technique que la nav).
- [ ] Niveau = carte `paper` 22 px : numéro `font-display` 40 px (indigo si en cours), « Niveau N » + étiquette, `SeptTraits` sm, pourcentage « 67 % » en grand ; dépliage par `grid-template-rows` animé ; jours : marqueur trait, « Jour N », méta mono, « Aujourd'hui » ou chevron.
- [ ] Tests existants adaptés (« 33 % » au lieu de « 33% » si le format change).
- [ ] Commit `feat(programme): liste des niveaux Agrès`.

### Task 3: Fiche du jour
- [ ] `DaySheet` : eyebrow « Débutant · Niveau N », titre « JOUR N », méta « N exercices · M min » ; lignes `ExerciseGlyph` + nom + dose `font-display` + barrettes ; `FillLink` « Démarrer ce jour » ; « Reprendre ici » inchangé (confirmation).
- [ ] Le titre complet reste accessible (titre du `Sheet`) pour les tests.
- [ ] Commit `feat(programme): fiche du jour Agrès`.

### Task 4: Vérification locale + relecture.
