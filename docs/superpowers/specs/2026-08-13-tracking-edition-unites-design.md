# Tracking — édition, unités, carte Aujourd'hui — design

Évolution du module Tracking (voir `2026-08-13-multi-utilisateur-clement-design.md` pour le contexte d'origine, déjà en prod). Trois lacunes identifiées après premier usage réel par Clément.

## Périmètre

1. Séance Tracking éditable après validation (ajouter/modifier/supprimer une série), plus saisie en lot (« 4 séries de 10 »).
2. Unité par exercice (reps ou secondes), avec reflet correct dans Trophées.
3. Carte « Enregistrer une séance » sur Aujourd'hui pour Clément, à l'emplacement où Mathis voit sa carte Dos.

Hors périmètre : plus de deux unités (reps/secondes suffisent — pas de minutes/mètres/kg pour l'instant), édition du nom d'un exercice ou changement d'unité après création, annulation d'une séance déjà « Terminée » (le statut reste un aller simple, seule l'édition des séries devient toujours possible).

## Schéma

Migration `0009_tracking_unit.sql`, additive, aucune donnée réelle à préserver (le module vient d'être livré, aucune vraie séance Clément en prod) :

```sql
ALTER TABLE tracking_exercises ADD COLUMN unit TEXT NOT NULL DEFAULT 'reps' CHECK (unit IN ('reps', 'seconds'));
ALTER TABLE tracking_sets_logged RENAME COLUMN reps_actual TO valeur_actual;
```

Le renommage suit la convention déjà en place côté Dos (`dos_sets_logged.valeur_actual`) : le nombre stocké n'est plus toujours des reps, son unité vient de l'exercice auquel la série appartient (jointure sur `tracking_exercises.unit`). Toute la chaîne applicative (`TrackingSetWithExercise.repsActual` → `.valeurActual`, `logSetForExercise`, `logTrackingSetAction`, `TrackingSeanceScreen`, `computeTrophies`) se renomme en cohérence — pas de compatibilité à préserver, pas de code consommateur externe à ce module.

`findOrCreateExercise` prend un paramètre `unit` supplémentaire, utilisé uniquement à la création (un nom déjà connu ignore l'unité passée et garde la sienne — pas de re-choix possible après coup, cohérent avec le hors-périmètre ci-dessus).

## Saisie en lot

Le formulaire d'ajout de série (`TrackingSeanceScreen`) gagne un champ « nombre de séries » (stepper, défaut 1, même langage visuel que le stepper de valeur existant). Au clic sur « Ajouter », crée N lignes séparées en base — pas de nouveau concept de « série groupée » : chaque ligne reste une `tracking_sets_logged` individuelle, éditable et supprimable seule. Un nouveau paramètre `count` sur l'action serveur (`logTrackingSetAction`) boucle côté serveur pour éviter N allers-retours réseau ; elle retourne le tableau des séries créées.

Quand l'utilisateur tape un nom d'exercice qui matche un exercice déjà connu, son unité s'affiche verrouillée (lecture seule) — le sélecteur reps/secondes n'apparaît, actif, que pour un nom inédit. Cela suppose que la liste d'autocomplete porte désormais `{ name, unit }[]` et non plus seulement des noms.

## Édition après validation

Le formulaire d'ajout et un contrôle éditer/supprimer par série restent disponibles quel que soit `completed_at` — la gate `!completed` qui masque tout aujourd'hui disparaît. « Terminer la séance » reste un simple horodatage : ce qui fait apparaître la séance dans l'historique (`listCompletedSeances`) plutôt que comme séance active, sans plus rien verrouiller. Éditer une série ouvre la même feuille à molette que `RepsSheet` (composant déjà existant, réutilisé tel quel) pour ajuster sa valeur ; supprimer retire la ligne sans renuméroter les autres séries de l'exercice (`set_number` reste l'ordre d'ajout d'origine, jamais recalculé après coup — un trou dans la numérotation après suppression est correct, pas un bug).

Nouvelles fonctions `src/lib/tracking/db.ts` : `updateSet(db, setId, valeurActual)`, `deleteSet(db, setId)`. Actions correspondantes `updateTrackingSetAction`, `deleteTrackingSetAction`.

## Trophées — cartes en secondes

`computeTrophies` groupe désormais les lignes Tracking par `(exerciseId, unit)` plutôt que par seul `exerciseId` — en pratique un exercice ne change jamais d'unité (figée à la création), donc c'est le même regroupement qu'aujourd'hui avec l'unité portée en plus sur la carte. `TrophyCard` gagne un champ `unit: "reps" | "seconds"` (`"reps"` implicite pour Programme/Dos, explicite pour Tracking).

`loadTropheesScreenState`'s `totalReps` (le gros chiffre en tête d'écran) ne somme que les cartes `unit === "reps"` — une carte en secondes reste visible dans la grille avec son propre total (ex. « 180 » pour 3×60s de planche cumulées) mais n'entre pas dans ce total-là, cohérent avec le fait que les paliers 100/500/1000/5000/10000/25000 sont calibrés en répétitions. `TrophyCard.tsx` n'affiche pas de palier laiton sur une carte en secondes (`palierAtteint` non appelé pour `unit === "seconds"`).

## Aujourd'hui — carte Tracking (Clément)

Nouveau composant `TrackingCard`, même famille visuelle que `BackPainCard` (accent sauge, même structure de carte), à l'emplacement où `DosCard` s'affiche pour Mathis. `(shell)/page.tsx` charge `loadTrackingScreenState` pour Clément (symétrique du chargement conditionnel de `dosState` pour Mathis) et le passe à `AujourdhuiScreen`. Le rendu conditionnel devient : carte Dos si `dosState`, sinon carte Tracking si `trackingState`, sinon rien.

Bouton de la carte : « Enregistrer une séance » s'il n'y a pas de séance active (démarre via `startTrackingSeanceAction`, puis navigue vers `/tracking/{id}` — comportement client, comme le bouton déjà existant sur l'écran `/tracking`) ; « Reprendre » vers `/tracking/{activeSeanceId}` s'il y en a déjà une (lien direct, l'id est déjà connu côté serveur).

## Tests

- `db.test.ts` : `updateSet`/`deleteSet`, création d'exercice avec unité, réutilisation d'unité sur exercice existant, `logSetForExercise` avec `count > 1`.
- Migration `0009` : colonne `unit` présente avec défaut `'reps'`, `valeur_actual` accessible sous son nouveau nom, ancien nom absent.
- `computeTrophies.test.ts` : carte séparée par unité, `totalReps` exclut les cartes secondes.
- `TrackingSeanceScreen.test.tsx` : édition/suppression d'une série sur séance `completed`, saisie avec `count`, unité verrouillée sur exercice connu.
- `AujourdhuiScreen.test.tsx` : carte Tracking affichée pour Clément (`dosState: null`, `trackingState` renseigné), bouton démarre/reprend correctement.

## Suite

Périmètre contenu (un module déjà existant, pas de nouvel axe produit) — un seul plan d'implémentation suffit, pas de découpage en sous-projets.
