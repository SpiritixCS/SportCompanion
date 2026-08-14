# Tracking — programme personnel (modèles + rotation) — design

Évolution du module Tracking (voir `2026-08-13-multi-utilisateur-clement-design.md` et `2026-08-13-tracking-edition-unites-design.md` pour le contexte existant, déjà en prod). Aujourd'hui, Tracking n'offre qu'un journal libre : Clément tape un nom d'exercice à chaque série, sans mémoire d'une séance à l'autre. Objectif : lui permettre de pré-enregistrer des séances types (modèles), de les enchaîner dans un ordre fixe qu'il définit lui-même, et de les lancer depuis Aujourd'hui via un player guidé — sans perdre le journal libre existant.

## Périmètre

1. Modèles de séance (« Push », « Pull »…) : nom + liste ordonnée d'exercices, chacun avec unité (reps/secondes), nombre de séries, cible par série. CRUD complet.
2. Un programme personnel = une rotation ordonnée de modèles + un pointeur sur le modèle suivant. Une seule rotation active à la fois (pas de programmes multiples en parallèle). Le pointeur avance à la séance réellement validée, jamais au calendrier — même principe que l'axe Programme (CLAUDE.md §5).
3. Depuis Aujourd'hui, sous la carte Programme (ou en lieu et place de l'actuelle `TrackingCard` libre), une carte affiche le modèle du jour et lance un player plein écran guidé — même mécanique que le player Programme (CLAUDE.md §6) : valider une série → repos auto → série suivante → exercice suivant → récapitulatif → validation.
4. Possibilité de changer le modèle du jour sans casser la rotation (« Changer » → sheet de sélection dans la rotation) ; le pointeur se recale ensuite sur la position du modèle réellement fait.

Hors périmètre : plusieurs rotations/programmes actifs en parallèle, cible variable par série (une seule valeur cible par exercice, appliquée à toutes ses séries — pas de pyramidal), niveaux/paliers ou grille de pastilles pour le programme perso (carte simple, cohérent avec le fait qu'une rotation infinie n'a pas de notion de niveau), vignettes d'exercice (pas de `videoId`/thumbnail pour un exercice créé par Clément), calendrier à dates fixes ou jours de semaine récurrents.

## Schéma — migration `0010_tracking_program.sql`

Additive, aucune donnée existante affectée.

```sql
ALTER TABLE tracking_seances ADD COLUMN template_id INTEGER REFERENCES tracking_templates(id);

CREATE TABLE tracking_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE tracking_template_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES tracking_templates(id),
  ordre INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('reps', 'seconds')),
  sets_count INTEGER NOT NULL,
  target_value INTEGER NOT NULL,
  UNIQUE (template_id, ordre)
);

CREATE TABLE tracking_program_rotation (
  template_id INTEGER PRIMARY KEY REFERENCES tracking_templates(id),
  position INTEGER NOT NULL UNIQUE
);

CREATE TABLE tracking_program_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pointer_template_id INTEGER REFERENCES tracking_templates(id)
);

CREATE TABLE tracking_skipped_exercises (
  seance_id INTEGER NOT NULL REFERENCES tracking_seances(id),
  exercise_order INTEGER NOT NULL,
  skipped_at TEXT NOT NULL,
  PRIMARY KEY (seance_id, exercise_order)
);
```

`tracking_seances.template_id` (nullable) marque une séance comme issue d'un modèle plutôt que du journal libre — nécessaire pour la reprise : `getOrStartSeance` reprend la séance active telle quelle (l'app n'autorise qu'une séance active à la fois, invariant déjà existant), mais la page player doit savoir si elle correspond au modèle demandé ou à une autre séance (libre ou modèle différent) pour ne jamais mélanger les deux silencieusement — voir §Player guidé.

`tracking_program_state` est un singleton (`id = 1`, pattern déjà utilisé par `current_position` et `app_settings`). `pointer_template_id NULL` signifie « pas de rotation active » (aucun modèle dans `tracking_program_rotation`, ou rotation vidée).

Aucune contrainte `FOREIGN KEY` n'est appliquée à l'exécution dans ce projet (`PRAGMA foreign_keys` n'est jamais activé côté client DB — voir `src/lib/db/client.ts`) : les `REFERENCES` ci-dessus documentent l'intention mais ne suppriment rien automatiquement, comme c'est déjà le cas pour `tracking_sets_logged` → `tracking_seances`. Supprimer un modèle est donc une opération applicative qui nettoie explicitement `tracking_template_exercises`, sa ligne dans `tracking_program_rotation`, et recale le pointeur s'il pointait dessus (vers le premier modèle restant de la rotation, ou `NULL` si elle est vide) — même logique que `deleteSeance` qui nettoie déjà `tracking_sets_logged` à la main.

Les séries réellement loggées vivent dans `tracking_seances` / `tracking_sets_logged`, **inchangées** — voir §Player guidé.

## Modèles — CRUD

Nouveau fichier `src/lib/tracking/templates.ts` (miroir de `src/lib/tracking/db.ts`) :
- `createTemplate(db, nom, exercises: {name, unit, setsCount, targetValue}[])`
- `listTemplates(db)`
- `getTemplate(db, templateId)` → nom + exercices ordonnés
- `updateTemplate(db, templateId, nom, exercises)` (remplace la liste d'exercices en bloc — pas d'édition ligne à ligne côté DB, le formulaire renvoie l'état complet)
- `deleteTemplate(db, templateId)`

Écran (nouvelle route `/tracking/programme`, accessible depuis un bouton sur `TrackingScreen`) : liste des modèles existants (carte avec nom + nombre d'exercices), bouton « Nouveau modèle » → formulaire (nom, puis exercices ajoutés un à un : nom avec autocomplétion sur `listExercises` existant comme pour le journal libre, unité verrouillée si nom déjà connu — même règle que le journal libre, cf. `2026-08-13-tracking-edition-unites-design.md` §Saisie en lot —, nombre de séries, cible). Réorganisation par glisser ou boutons haut/bas, suppression d'un exercice, suppression du modèle entier (avec confirmation si le modèle est dans la rotation active).

## Rotation — gestion et pointeur

Même écran `/tracking/programme`, section « Ma rotation » : liste ordonnée des modèles inclus, ajout/retrait depuis la bibliothèque de modèles, réordonnancement. `src/lib/tracking/program.ts` :
- `getRotation(db)` → modèles ordonnés + pointeur courant
- `setRotation(db, templateIds: number[])` — remplace la rotation en bloc ; si le pointeur actuel n'est plus dans la nouvelle liste, il retombe sur le premier élément (ou `NULL` si liste vide)
- `advancePointer(db, completedTemplateId)` — appelée à la validation d'une séance programmée : retrouve la position de `completedTemplateId` dans la rotation, pose le pointeur sur `(position + 1) mod length`. Si la rotation a changé entre-temps et que le modèle complété n'y est plus, ne touche pas au pointeur.
- `getTodayTemplateId(db)` → le pointeur, ou `null` si pas de rotation

## Player guidé — réutilisation du player Programme

Aucun nouveau composant de player. `PlayerScreen` / `ExerciseView` / `RestView` / `SummaryView` sont réutilisés tels quels : ils ne connaissent que le type générique `TrainDay`/`Exercise` (`src/lib/workout/types.ts`), sans dépendance au domaine Caliathletics.

Nouvelle fonction `templateAsTrainDay(template): TrainDay` (`src/lib/tracking/templateAsTrainDay.ts`) : traduit un modèle en `TrainDay`, un exercice par ligne — `id` = \`tpl-${templateId}-${ordre}\` (stable, sert uniquement de clé image ; l'absence de fichier `/exercises/{id}.jpg` déclenche déjà le repli `imageFailed` existant dans `ExerciseView`, pas de vignette custom nécessaire), `movementFamily: "other"`, `videoId: null`, `countsInStats: true` (champ requis par le type, non lu par ce chemin — Trophées lit directement `tracking_sets_logged`, pas ce flag), `sets: setsCount`, `target: { unit, value: targetValue, maxEffort: false, eachSide: false }`.

Nouvelle route `/player/tracking?templateId=…`, miroir de `src/app/player/page.tsx` :
1. Charge le modèle, le convertit en `TrainDay`.
2. `getOrStartSeance(db, templateId)` (fonction **existante** de `src/lib/tracking/db.ts`, étendue d'un paramètre `templateId` optionnel — reprend la séance active telle quelle si elle existe, quel que soit son `template_id` : une seule séance active à la fois, invariant déjà en place). Si la séance active reprise ne correspond pas au `templateId` demandé (une autre séance, libre ou d'un autre modèle, est en cours), la page affiche un message explicite plutôt que de mélanger les deux silencieusement — cohérent avec CLAUDE.md §7 sur la persistance.
3. État du player dérivé avec `deriveState` (fonction **existante** de `src/lib/player/deriveState.ts` — générique sur `{exerciseOrder, setNumber}[]`, aucune dépendance au schéma Programme, réutilisable tel quel sur des lignes `tracking_sets_logged` qui portent déjà ces deux colonnes) + `tracking_skipped_exercises` pour les exercices passés.
4. `onLogSet` → nouvelle action `logTemplateSetAction`, qui appelle `logSetForExercise` avec un paramètre `exerciseOrder` optionnel ajouté à sa signature (`src/lib/tracking/db.ts`) : quand fourni, la ligne est insérée à cet ordre explicite (position du modèle) au lieu de le déduire de l'ordre d'apparition — nécessaire car un exercice sauté ne doit pas décaler l'ordre des suivants. Le journal libre existant continue d'appeler la fonction sans ce paramètre, comportement inchangé.
5. `onSeanceFinish` → `completeTrackingSeanceAction` (**existante**), puis `advancePointer(db, templateId)`.

Rien de nouveau à intégrer côté Trophées ou historique : la séance est une `tracking_seances` comme une autre, elle apparaît dans « Tes séances » (`TrackingScreen`) et alimente Trophées exactement comme le journal libre (CLAUDE.md §5, Axe Tracking — déjà vrai aujourd'hui).

## Aujourd'hui — intégration

`loadTrackingScreenState` gagne `todayTemplate: { templateId, nom, exercises } | null` (via `getTodayTemplateId` + `getTemplate`). `TrackingCard` (`src/components/today/TrackingCard.tsx`) :
- Rotation active (`todayTemplate` non nul) → affiche le nom du modèle + aperçu de la liste d'exercices, bouton « Commencer » vers `/player/tracking?templateId=…`, lien secondaire « Changer » ouvrant une `Sheet` listant les autres modèles de la rotation (choisir en démarre un directement, sans toucher au pointeur avant validation).
- Pas de rotation → comportement actuel inchangé (« Log ta séance du jour » / « Reprendre », journal libre).

Le bouton « Enregistrer une séance libre » reste accessible depuis l'onglet Tracking dans tous les cas (non déplacé, juste plus la seule option).

## Tests

- `templates.test.ts` : create/list/get/update/delete, unicité `(template_id, ordre)`, suppression retire les exercices en cascade.
- `program.test.ts` : `setRotation` recale le pointeur hors-liste, `advancePointer` avance sur la bonne position, tolère un modèle complété absent de la rotation courante.
- `templateAsTrainDay.test.ts` : mapping exercice → `Exercise`, cible unique appliquée à `sets`.
- `db.test.ts` (existant, étendu) : `logSetForExercise` avec `exerciseOrder` explicite n'affecte pas le chemin sans paramètre.
- Migration `0010` : tables créées, `pointer_template_id` nullable, cascade de suppression d'un modèle sur `tracking_program_rotation`/`tracking_template_exercises`.
- `TrackingCard.test.tsx` : rendu avec/sans `todayTemplate`, bouton Changer.
- Test d'intégration player : démarrer une séance modèle, quitter, revenir — état intact (règle CLAUDE.md §2/§7, même exigence que le player Programme).

## Suite

Périmètre large pour un seul plan — découpage en phases recommandé pour `writing-plans` : (1) schéma + CRUD modèles, (2) rotation + pointeur, (3) player guidé (route + `templateAsTrainDay` + action de log), (4) intégration Aujourd'hui (`TrackingCard` + sheet Changer). Chaque phase reste testable et livrable seule, dans cet ordre — pas de sous-projets séparés, une seule spec.
