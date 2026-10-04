# Mode pyramide — design

Inspiration : vidéo « Le CHEAT CODE pour passer de 0 à 30 tractions d'affilée » (Bryan.transformation, https://www.youtube.com/watch?v=qKwIBdRSiTY). Décisions prises avec Mathis le 2026-10-04, question par question.

## La méthode, telle que l'app la sert

- Une pyramide monte marche par marche jusqu'à un **sommet** puis redescend : sommet 3 → 1, 2, 3, 2, 1. Total = sommet × sommet.
- On reste presque toujours sous son maximum : volume propre sans aller à l'échec ; les premières marches servent d'échauffement.
- Le repos grandit avec la hauteur de la marche (court en bas, long au sommet), symétrique à la descente.
- Progression : monter le sommet, ou garder le sommet et raccourcir les repos. L'app ne suggère rien (historique simple, choix de Mathis) : elle préremplit le dernier sommet utilisé pour l'exercice.

## Périmètre

Deux entrées, un seul moteur :

1. **Pyramide libre** : lancée depuis la page Tracking.
2. **Exercice pyramide dans un jour Tracking** : un exercice du programme perso sur 7 jours peut être « en pyramide » au lieu de « séries × cible ».

Formes : **Classique** (1 → N → 1) et **Inversée** (N → 1 → N). Unité : reps uniquement. Accent : jade (module Tracking).

Hors périmètre : demi-pyramides, lest, suggestion automatique de sommet, pyramide sur un exercice du programme Caliathletics pendant une séance Programme, pyramide en secondes.

## Le moteur (logique pure, testée)

`src/lib/pyramide/pyramid.ts` :

- `type PyramidShape = "classic" | "inverted"`.
- `pyramidSteps(shape, peak): number[]`
  - classic, peak 4 → `[1, 2, 3, 4, 3, 2, 1]` ; inverted, peak 4 → `[4, 3, 2, 1, 2, 3, 4]`.
  - Longueur `2 × peak − 1` ; somme `peak²` en classique, `peak² + peak − 1` en inversée (sommet 4 → 16 et 19).
  - Bornes du sommet : 2 → 30 (un sommet 1 n'est pas une pyramide ; 30 = 900 reps, au-delà personne).
- `pyramidTotal(shape, peak): number` = somme des marches.
- `pyramidRestSeconds(reps, peak): number` — repos **avant la marche suivante**, selon la hauteur de la marche qui vient d'être faite :
  `arrondi au multiple de 15 le plus proche de 15 + 105 × (reps / peak)^1,5`, borné à [15, 120].
  Sommet 15 : marche 1 → 15 s, 5 → 30 s, 10 → 75 s, 15 → 120 s (la vidéo : 15–30 s / 45 s–1 min / 1 min 30–2 min). Sommet 5 : 1 → 30 s, 3 → 60 s, 5 → 120 s.
- Le repos après la dernière marche d'un exercice pyramide dans un jour Tracking reste le réglage global « Repos entre exercices ».

## Branchement dans le player

Le player sert déjà des exercices `{ sets, target }` avec une cible identique à chaque série. Une pyramide est un exercice dont chaque série a sa propre cible :

- `Exercise` (`src/lib/workout/types.ts`) gagne `pyramid?: { shape: PyramidShape; peak: number }`. Quand il est présent : `sets = pyramidSteps(...).length`, la cible de la série `s` est `steps[s − 1]`, et `target` reste `{ unit: "reps", value: peak, maxEffort: false, eachSide: false }` pour les écrans qui l'affichent globalement.
- `deriveState` ne change pas (il compte des séries).
- `PlayerScreen` : cible de la série courante et repos entre séries via le moteur quand `exercise.pyramid` existe (`pyramidRestSeconds(steps[s − 1], peak)` ; prioritaire sur `restSeconds` et sur le réglage global).
- `ExerciseView` (exercice pyramide) :
  - eyebrow « Marche s / M » au lieu de « Série s / t » ;
  - objectif en grand = la cible de la marche (« 4 ») ;
  - à la place des barrettes de séries : **une rangée de barres verticales dont la hauteur suit la marche** (la silhouette de la pyramide), faites = jade plein, en cours = jade pâle qui se remplit, à venir = hairline ;
  - « Marche terminée » (au lieu de « Série terminée ») ouvre la saisie préremplie avec la cible ; le réel est enregistré, la pyramide continue quoi qu'il arrive.
- `RestView` : carte « Ensuite » = « Marche s+1 · N reps ».
- `SummaryView` : la ligne de l'exercice pyramide affiche « Pyramide 1→N→1 · total reps » (ou « N→1→N »).

## Pyramide libre

### Lancement (page Tracking)

Carte « Pyramide » sous « Prochaine séance » : eyebrow jade « Pyramide », une phrase (« Monte jusqu'au sommet, redescends. »), bouton « Lancer une pyramide ». Il ouvre une `Sheet` :

- **Exercice** : champ avec suggestions = exercices du catalogue (exercices Caliathletics en reps qui comptent dans les Trophées, dédoublonnés par id, avec leur picto) + exercices Tracking déjà connus. Un nom qui correspond exactement (casse ignorée) à un exercice du catalogue est **lié** à lui ; sinon c'est un exercice libre (initiale jade).
- **Forme** : `CycleButton` Classique / Inversée.
- **Sommet** : − / + (2 → 30), prérempli avec le dernier sommet utilisé pour cet exercice (sinon 5), total affiché en direct (« 25 reps · 9 marches »).
- `FillButton` jade « Lancer ».

Si une séance Tracking est déjà en cours (jour ou pyramide), « Lancer » est remplacé par « Reprendre ta séance en cours » : une seule séance Tracking active à la fois (règle existante de `getActiveSeance`).

### Données

Une pyramide libre est une séance Tracking (`tracking_seances`) avec `program_day_of_week` NULL et une ligne de configuration :

```sql
CREATE TABLE tracking_pyramids (
  seance_id INTEGER PRIMARY KEY REFERENCES tracking_seances(id),
  exercise_name TEXT NOT NULL,
  shape TEXT NOT NULL CHECK (shape IN ('classic', 'inverted')),
  peak INTEGER NOT NULL CHECK (peak BETWEEN 2 AND 30)
);
```

Les marches sont des `tracking_sets_logged` ordinaires (`exercise_order` 0, `set_number` = numéro de marche) : rejouables, reprises et supprimées comme toute séance Tracking. Les séances libres héritées (sans jour ni pyramide) gardent leur chemin actuel (`/tracking/[seanceId]`).

Route : `/player/pyramide` sert la séance pyramide active (création à « Lancer » via une action serveur, puis navigation). Bandeau de reprise sur Aujourd'hui et Tracking : une séance active qui a une ligne `tracking_pyramids` pointe vers `/player/pyramide`.

## Exercice pyramide dans un jour Tracking

- Migration : `tracking_program_day_exercises` gagne `pyramid_shape TEXT NULL CHECK (pyramid_shape IN ('classic','inverted'))` et `pyramid_peak INTEGER NULL`. NULL = exercice en séries (tous les exercices existants, dont celui de Clément : rien ne change).
- Pour un exercice pyramide : `unit = 'reps'`, `sets_count = 2 × peak − 1`, `target_value = peak`, `rest_seconds` NULL (le moteur décide).
- `DayEditor` : au-dessus des réglages du formulaire d'ajout, bascule **Séries / Pyramide**. En Pyramide : forme (Classique / Inversée) et sommet (− / +) remplacent unité, séries, cible et repos ; la ligne de l'exercice affiche « Pyramide 1→N→1 » au lieu de « 3 × 10 » et n'a pas de puce Repos.
- `TrackingScreen` (« Prochaine séance ») et `TrackingCard` (Aujourd'hui) : même libellé « Pyramide 1→N→1 ».
- `dayAsTrainDay` renseigne `pyramid` à partir des deux colonnes.
- Le nom d'un exercice pyramide dans un jour suit la même règle de liaison au catalogue que la pyramide libre.

## Liaison au catalogue et Trophées

- Migration : `tracking_exercises` gagne `catalog_id TEXT NULL` (id d'un exercice Caliathletics, ex. `pull-ups`). Index unique partiel sur `catalog_id` non NULL.
- À l'enregistrement d'une marche liée au catalogue : on cherche l'exercice Tracking par `catalog_id` ; à défaut, la ligne libre du même nom si elle existe (on lui pose `catalog_id`) ; à défaut, on la crée (nom = nom du catalogue, unité reps).
  - Conséquence assumée : si un exercice Tracking libre porte exactement le nom d'un exercice du catalogue, ses reps passées rejoignent la carte Trophées du catalogue la première fois qu'une pyramide liée l'utilise. Aucun total n'est perdu, il change de carte. (Aujourd'hui en prod : aucun cas — Clément a « Good moraine », Mathis n'a pas d'exercice Tracking.)
- `computeTrophies` : une série Tracking dont l'exercice a un `catalog_id` crédite la carte `catalog_id` (module Programme, picto, famille du catalogue) — créée si l'exercice n'a encore aucune série Programme. Sinon, carte `tracking-<id>` comme aujourd'hui.
- Les reps hors séance (`extra_reps`) suivent l'id de carte : inchangé.

## Historique

`listCompletedSeances` expose la configuration pyramide quand elle existe. Dans « Tes séances », une pyramide s'affiche : date, « Pyramide · Pull ups », « 1→7→1 · 49 reps », durée. Le détail (`/tracking/[seanceId]`) reste l'écran de séance libre existant (marches listées comme séries, éditables).

Dernier sommet utilisé (préremplissage) : la séance pyramide terminée la plus récente pour ce nom d'exercice (casse ignorée), toutes formes confondues.

## États et cas limites

- Pyramide interrompue : reprise par le bandeau ; « Terminer la séance » pendant une pyramide valide ce qui est fait (comportement du chantier 2).
- Sortie par la croix sans aucune marche faite : la séance est effacée (comportement existant `discard`).
- Nom vide : « Lancer » désactivé. Sommet hors bornes : impossible via − / + ; l'action serveur borne aussi (2 → 30).
- Une séance de jour Tracking active empêche de lancer une pyramide libre, et inversement (une seule séance Tracking active).
- `prefers-reduced-motion` : la silhouette de la pyramide ne s'anime pas.

## Tests

Moteur (marches, totaux, repos, bornes) ; migration (colonnes NULL, données existantes intactes) ; liaison catalogue (création, réutilisation, ligne libre du même nom) ; `computeTrophies` (série liée → carte catalogue, carte créée sans série Programme) ; player (cible par marche, repos par marche, dernière marche → repos entre exercices) ; `DayEditor` (bascule Pyramide, sauvegarde) ; lancement (préremplissage, séance déjà active) ; persistance (enregistrer une marche, quitter, revenir → reprise à la bonne marche).

## Déroulé

Une branche `feat/mode-pyramide`, maquette du lancement et de l'écran de marche validée par Mathis avant d'intégrer, validation locale (copie fraîche des DB de prod), puis une mise en prod.
