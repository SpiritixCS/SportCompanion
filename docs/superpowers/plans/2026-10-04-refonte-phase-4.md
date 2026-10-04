# Refonte « Agrès » — Phase 4 (Trophées) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Refaire la liste et la fiche Trophées selon `design/v1/trophees.html`, sans changer le calcul des totaux.

**Spec:** `docs/superpowers/specs/2026-10-04-refonte-graphique-design.md` § Trophées · Maquette : `design/v1/trophees.html`

## Global Constraints

- Calcul inchangé (`computeTrophies`, `loadTrophyDetail`, reps hors séance du chantier 5).
- Or = paliers uniquement : traits `brass`, petit texte `brass-ink`.
- Exercices du Programme : `ExerciseGlyph` ; exercices du Tracking : `InitialTile` (pastille `sage-soft`, initiale Big Shoulders), nouveau composant partagé réutilisé par la phase 5 et le player.
- Unité secondes : jamais de palier (ni trait, ni « Vers », ni carte Paliers).
- Libellés accessibles conservés : filtres « Tous / Programme / Tracking », « Retour aux trophées », « Ajouter des reps / secondes ».

## Review Focus

- Total ≥ 25 000 (tous paliers atteints) : tuile « Tous atteints », trait plein, fiche « Tous les paliers atteints. ».
- Filtre sans résultat alors que l'utilisateur a des trophées : message du filtre, pas « Fais ta première séance ».
- Aucun exercice en reps (que des secondes) : pas de carte « Prochain palier ».
- Nom long (« Supported triceps extensions ») dans une tuile de 2 colonnes à 375 px.

### Task 1: Paliers purs
- [ ] `paliers.ts` : `palierProgress(total) → { next, prev, fraction } | null` (null au-delà de 25 000) et `closestPalier(cards)` (carte en reps la plus proche de son palier suivant, ou null). Tests.

### Task 2: Liste
- [ ] `InitialTile` (md 36 px / lg 84 px).
- [ ] `TropheesScreen` : eyebrow or, total `font-display` 112 px compté de 0 + « reps », « N séances · N jours d'activité », carte « Prochain palier », `CycleButton` (Plus de reps → Récent → A → Z) + puces filtre `aria-pressed`, grille de tuiles ; état vide ; filtre vide.
- [ ] `TrophyCard` : tuile `paper` 22 px, picto/initiale, total 44 px compté, nom, « Vers X » + % + trait or. Suppression du pont `ExerciseFamilyIcon` et des photos.
- [ ] `loading.tsx` aux nouvelles dimensions.

### Task 3: Fiche
- [ ] Retour chevron, grand picto/initiale, nom 44 px capitales, total 96 px, « reps au total », carte « Paliers » (6 traits, atteints pleins, en cours partiel ; « N reps pour atteindre X. »), faits premier/dernier passage, `ExtraRepsSection` restylée (carte 22 px, `FillButton` « Ajouter »).

### Task 4: Vérification locale + relecture.
