# Player de séance — design

Sous-projet 2/6 de SportCompanion (voir `CLAUDE.md` pour le contexte produit complet, notamment §6 pour le flux attendu et §4.4 du brief design pour la spec visuelle). Périmètre : le moteur de séance — vue exercice, vue repos, écran de fin, log en DB. C'est l'écran le plus important de l'app (le plus contraint, le plus utilisé), construit avant les écrans de navigation qui l'entourent.

## Objectif

Un utilisateur peut dérouler une séance du programme Caliathletics de bout en bout : lancer un exercice, valider des séries avec repos automatique entre chacune, passer à l'exercice suivant automatiquement, voir un récapitulatif, et valider la séance — le tout persisté de façon à ce que fermer l'app en cours de route ne perde rien et permette de reprendre exactement où on en était.

## Portée de cette phase

- **Axe Programme (Caliathletics) uniquement.** L'axe BackPain réutilisera ce même player en phase 4 (accent sauge, repos plus courts) — pas construit ici.
- **Pas de flux de navigation produit.** Le point de départ, l'écran Aujourd'hui, et la logique de progression/montée de niveau sont la phase 3. Cette phase expose le player via une route de développement : `/dev/player?parcours=&level=&day=` (indices 0-based), dans le même esprit que `/dev/design-system` de la phase Fondations — sera remplacée par le vrai déclenchement depuis Aujourd'hui en phase 3.
- **Valider une séance ne fait qu'écrire son propre enregistrement.** Aucune interaction avec une grille de progression, un compteur de jours validés, ou des totaux Trophées — ces lectures/écritures viennent des phases 3 et 5.

## Base de données

Nouvelle migration `migrations/0001_seances.sql` :

```sql
CREATE TABLE seances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parcours TEXT NOT NULL,
  level INTEGER NOT NULL,
  day_index INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE sets_logged (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id INTEGER NOT NULL REFERENCES seances(id),
  exercise_id TEXT NOT NULL,
  exercise_order INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  reps_target TEXT NOT NULL,
  reps_actual INTEGER NOT NULL,
  rest_seconds INTEGER NOT NULL,
  completed_at TEXT NOT NULL
);
```

- `parcours` : `"beginner" | "intermediate" | "advanced"`, valeur libre (pas de contrainte SQL — la validation vit dans le TypeScript, cohérent avec `Program`/`ProgramLevel` de `src/lib/workout/types.ts`).
- `seances.completed_at` : `NULL` tant que l'utilisateur n'a pas explicitement validé sur l'écran de fin. C'est la seule colonne de statut — l'état exact (où en est la séance) se dérive de `sets_logged`, jamais stocké séparément.
- `sets_logged.reps_target` : sérialisation JSON de `TargetValue` (`number | [number,number] | [number,number,number] | null`, déjà typé en Fondations) — capture la cible telle qu'affichée à l'instant T, indépendante d'une évolution future de `workout_curated.json`.
- Aucune contrainte d'unicité sur `(seance_id, exercise_order, set_number)` : une nouvelle tentative après un ajustement de reps ajoute une ligne plutôt que d'écraser — l'historique complet reste disponible, la dérivation d'état utilise la dernière ligne par `(exercise_order, set_number)`.

## Dérivation de l'état d'une séance

Pas de machine à états stockée. Reconstruite à chaque lecture depuis `seances` + `sets_logged` :

1. Total de séries prescrites pour le jour = somme des `sets` de chaque exercice (`ProgramDay` de `src/lib/workout/data.ts`).
2. Nombre de lignes dans `sets_logged` pour cette séance < total prescrit → reprendre à la prochaine série non loggée, dans l'ordre `exercise_order` puis `set_number`.
3. Nombre de lignes == total prescrit et `completed_at IS NULL` → toutes les séries sont faites mais la séance n'est pas validée : afficher l'écran de fin (récap), pas relancer l'exercice 1.
4. `completed_at` renseigné → séance terminée et validée.

Une séance active pour un `(parcours, level, day_index)` donné est celle avec `completed_at IS NULL` la plus récente (`ORDER BY started_at DESC LIMIT 1`) — un seul utilisateur, jamais deux séances actives en parallèle sur le même jour.

## Logique du player

- **Repos entre séries : 90s.** **Repos entre exercices : 120s.** Constantes nommées (`REST_BETWEEN_SETS_SECONDS`, `REST_BETWEEN_EXERCISES_SECONDS`) dans un seul module — codées en dur cette phase, mais isolées pour être branchées sur un réglage utilisateur en phase 6 sans toucher au reste du player.
- Valider une série (bouton **Série terminée**) → écrit immédiatement la ligne `sets_logged` → lance le repos entre séries → à la fin du repos, série suivante du même exercice si elle existe.
- Dernière série d'un exercice validée → repos entre exercices → exercice suivant.
- Dernier exercice du jour, dernière série validée → écran de fin. Aucune écriture de `completed_at` à ce stade.
- **Ajuster les reps** : feuille modale (`Sheet`, réutilisée telle quelle depuis Fondations) à molette numérique, préremplie sur la valeur cible (ou le bas de la fourchette si `TargetValue` est une plage). La valeur choisie devient `reps_actual`.
- **Passer l'exercice** : aucune ligne `sets_logged` écrite pour les séries restantes de cet exercice ; passage direct à l'exercice suivant (ou à l'écran de fin si c'était le dernier). L'exercice n'apparaît pas dans le récapitulatif.
- **Passer le repos** / **+15s** : actions locales sur le timer en cours, n'écrivent rien en DB — seule la validation de série écrit.

## Écrans

Toutes les primitives visuelles viennent de Fondations (`Card`, `Button`, `Sheet`, le jeu d'icônes) — accent `cobalt` partout dans cette phase. Détail visuel complet dans `CLAUDE.md` §4.4 ; ici, le comportement.

### Vue exercice

- Bandeau : croix de sortie (avec confirmation si la séance est entamée), `Exercice N / M`, chronomètre total de séance.
- Barre de progression segmentée (un segment par exercice du jour).
- Nom de l'exercice, cible en grand (Archivo Expanded 72px), sous-consigne (tempo/note si présente dans les données).
- Pastilles de séries (une par série prescrite, se remplissent au fur et à mesure).
- Bouton primaire **Série terminée** (56px, pleine largeur).
- Actions secondaires en texte : *Passer l'exercice*, *Ajuster les reps*.

### Vue repos

- Plein écran, remplace la vue exercice sans jamais s'y confondre visuellement.
- Arc qui se vide + décompte en Archivo Expanded 96px.
- *Ensuite → [nom du prochain élément]*.
- Boutons **+15s**, **Passer le repos**.
- Arc en accent `cobalt` pour le repos entre séries ; arc en `graphite` + mention explicite "Exercice suivant" pour le repos entre exercices — c'est la seule différence visuelle entre les deux, la durée les distingue déjà.

### Écran de fin

- Titre "Séance terminée".
- Trois chiffres en grand : durée totale, nombre d'exercices (ceux avec au moins une série loggée — un exercice passé n'est pas compté), répétitions totales.
- Liste des exercices avec `+X reps` chacun (uniquement ceux avec des séries loggées).
- Bouton **Terminer** → écrit `completed_at = now()` sur la séance, seul moment où la séance devient définitivement validée.

## États obligatoires

- **Chargement** : squelettes aux dimensions du contenu final (cohérent avec la règle Fondations/CLAUDE.md §5 — pas de spinner centré).
- **Erreur** : jour introuvable pour les paramètres `/dev/player` fournis (ex. `day_index` hors bornes) → message clair + retour, pas de crash.
- **Reprise** : décrite ci-dessus (§ Dérivation de l'état) — pas un état d'écran séparé, une conséquence directe de la lecture DB.

## Tests

Le plus important, motivé directement par le bug qui a tué la v1 (`CLAUDE.md` §2) : **enregistrer une série, simuler une sortie/navigation, revenir, vérifier que l'état affiché est identique** — lu depuis la DB, jamais reconstruit en mémoire. Test d'intégration obligatoire, pas seulement unitaire.

Autres tests :
- Dérivation d'état : séries manquantes → reprise au bon endroit ; toutes faites + non validées → récap ; validées → terminé.
- Timer de repos : durées exactes (90s / 120s), effet de +15s, effet de "passer le repos".
- Calcul des totaux du récap (durée, nombre d'exercices comptant, répétitions totales) sur un jeu de données avec au moins un exercice passé.
- Exercice passé : aucune ligne `sets_logged`, absent du récap.

## Hors scope de cette phase

Écran Aujourd'hui, point de départ, grille de progression, montée de niveau, axe BackPain, page Trophées, réglages utilisateur (repos configurable). Ces phases consomment `seances`/`sets_logged` en lecture plus tard, sans changement de schéma attendu.
