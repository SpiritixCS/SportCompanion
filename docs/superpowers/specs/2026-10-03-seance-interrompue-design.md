# Séance interrompue, durée active, « Terminer la séance » — design

Chantier 2 de la refonte V1. Validé en conversation le 2026-10-03.

## Problème

- La durée de séance est `maintenant − started_at`, recalculée en direct côté client (`PlayerScreen.useElapsedSeconds`). Une séance lancée par erreur puis faite le lendemain affiche ~24 h.
- Aucun moyen de valider une séance à moitié faite : il faut finir toutes les séries ou quitter sans valider.
- Une séance oubliée n'est jamais remise en question : on la retrouve telle quelle, chrono absurde compris.

La durée n'est **jamais persistée** : rien à corriger dans l'historique.

## Périmètre

Programme (`/player`) et Tracking guidé (`/player/tracking`) — tous deux rendus par `PlayerScreen`. L'écran Tracking libre (`/tracking/[seanceId]`) n'affiche pas de durée : hors périmètre.

## Règles

### Durée active

`activeDurationSeconds(events, nowMs)` — fonction pure dans `src/lib/player/activeDuration.ts`.

- `events` = horodatages de la séance : `started_at`, `resumed_at` (si présent), `completed_at` de chaque série loggée. Triés, puis `nowMs` ajouté en dernier.
- Durée = somme des écarts entre événements consécutifs, **un écart > 1 h (`INACTIVITY_LIMIT_SECONDS = 3600`) compte 0**.
- Sert au chrono en direct (`ExerciseView`) et au récap (`SummaryView`).

Plafond assumé : seule la **dernière** reprise est stockée (`resumed_at` écrasé). Deux reprises successives après deux longues pauses → la première série après la première reprise peut perdre quelques minutes. Commentaire `ponytail:` dans le code.

### Inactivité > 1 h

Inactif = `nowMs − dernier événement > 1 h`, phase `in-progress` uniquement (le récap `pending-validation` n'est pas concerné : la durée exclut déjà le trou).

Vérifié côté client au montage du player **et** à chaque retour sur l'onglet (`visibilitychange` → `visible`). Si inactif → feuille « Séance en pause depuis longtemps » :

| Choix | Effet |
|---|---|
| Reprendre | `resumed_at = now` en DB, feuille fermée, ne revient pas au rechargement |
| Terminer avec ce qui est fait | Affiché seulement si ≥ 1 série loggée. Ouvre le récap (`SummaryView`), validation par son bouton Terminer |
| Effacer la séance | Bouton `--alert`. Confirmation : « Effacer N séries ? Elles sortent des Trophées. » → supprime séance + séries + exercices passés, retour à Aujourd'hui. Le jour reste à faire |

### Feuille de sortie (croix)

- ≥ 1 série loggée : « Terminer avec ce qui est fait » / « Quitter et reprendre plus tard » / « Continuer la séance ».
- 0 série : « Abandonner » (supprime la séance vide, retour à Aujourd'hui) / « Continuer la séance ».

### Séance partielle validée

Même chemin que la validation normale (`completeSeanceAction` / `completeDaySeanceAction`) : le jour compte comme fait (grille, 7 jours avant montée de niveau, pointeur Tracking avancé). Les exercices non faits sont absents du récap.

## Données

Migration `0013_seance_resumed_at.sql` :

```sql
ALTER TABLE seances ADD COLUMN resumed_at TEXT;
ALTER TABLE tracking_seances ADD COLUMN resumed_at TEXT;
```

Additive, nullable : aucune ligne existante modifiée. Données Programme de Mathis et Clément intactes.

Nouvelles fonctions DB :
- `player/db.ts` : `resumeSeance(db, id)`, `deleteSeance(db, id)` (sets_logged + skipped_exercises + seances).
- `tracking/db.ts` : `resumeSeance(db, id)` ; `deleteSeance` existe déjà.

Nouvelles actions serveur : `resumeSeanceAction`, `discardSeanceAction` (Programme) et `resumeDaySeanceAction`, `discardDaySeanceAction` (Tracking).

États de player : `PlayerState` et `DayPlayerState` portent `resumedAt: string | null` en phases `in-progress` et `pending-validation`.

## UI

`PlayerScreen` reçoit deux callbacks de plus (`onResume`, `onDiscard`) et gère une phase locale `summary` (récap anticipé). Textes en français, tutoiement, sans encouragement (brief §4).

## Tests

- `activeDuration.test.ts` : écarts courts additionnés ; écart > 1 h ignoré ; reprise ; aucune série.
- Migration 0013 : colonnes présentes, nulles par défaut, lignes existantes intactes.
- DB : `resumeSeance`, `deleteSeance` (Programme), suppression des reps du cumul Trophées.
- `PlayerScreen` : feuille d'inactivité affichée/non affichée ; options selon nombre de séries ; Terminer → récap ; Effacer → confirmation.
- Persistance (CLAUDE.md §2) : reprendre → recharger l'état depuis la DB → pas de feuille, durée cohérente.
