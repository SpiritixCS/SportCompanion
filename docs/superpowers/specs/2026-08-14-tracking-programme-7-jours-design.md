# Tracking — programme personnel calé sur 7 jours — design

Remplace le modèle « bibliothèque de modèles + rotation ordonnée » livré par
`2026-08-14-tracking-programme-perso-design.md` par un vrai programme
hebdomadaire : 7 cases fixes, Lundi → Dimanche, chacune soit repos soit une
liste d'exercices à réaliser. Le pointeur avance toujours à la séance
validée, jamais au calendrier (inchangé) — mais chaque case porte désormais
un nom de jour, et une case peut être marquée repos.

Décidé en session (voir échange de brainstorming) :
- Pas de couche « modèle nommé réutilisable » : chaque jour a directement sa
  propre liste d'exercices, saisie une fois pour toutes.
- Le pointeur avance uniquement par validation (comportement actuel gardé),
  attaché à un intitulé de jour de semaine pour l'affichage — pas de logique
  calendaire réelle.
- Un jour repos affiche un bouton explicite « Jour suivant » pour avancer
  (jamais d'avancement automatique, cohérent avec CLAUDE.md §5).
- Les tables `tracking_templates` / `tracking_template_exercises` /
  `tracking_program_rotation` sont supprimées ; Clément resaisit son
  programme à la main dans la nouvelle UI. L'historique des séances
  (Trophées, `/tracking`) n'est pas affecté : il lit `tracking_sets_logged`,
  indépendant de ces tables.
- Le mode « séance libre » (saisie manuelle sans plan) est retiré : Clément
  ne peut plus que suivre le jour du programme en cours. L'écran de revue
  d'une séance passée (`/tracking/[seanceId]`) reste inchangé — il sert
  toujours à consulter/corriger l'historique, y compris les séances libres
  déjà loggées avant ce changement.
- Pas de nom personnalisé par jour : juste « Lundi », « Mardi »… (calculé en
  code, jamais stocké).

## Périmètre

1. 7 jours fixes (Lundi=0 … Dimanche=6), chacun `repos` ou `séance`.
2. Un jour `séance` a une liste ordonnée d'exercices (nom, unité reps/s,
   nombre de séries, cible par série) — même forme que les exercices de
   modèle actuels, éditée directement sur le jour.
3. Le pointeur (`tracking_program_state.pointer_day_of_week`) avance de 1
   (mod 7) uniquement à la validation d'une séance, ou via le bouton « Jour
   suivant » sur un jour repos. Jamais de saut automatique.
4. Depuis Aujourd'hui, la carte Tracking affiche le jour pointé : repos
   (bouton Jour suivant), séance à faire (liste + Commencer), ou séance en
   cours (détail du jour + Reprendre) — réutilise le player guidé existant.
5. Écran `/tracking/programme` : 7 lignes fixes, toggle repos/séance,
   éditeur d'exercices par jour.

Hors périmètre : logique calendaire réelle (le jour affiché ne dépend jamais
de la date système), plusieurs programmes en parallèle, rattrapage d'un jour
manqué, mode libre, migration automatique des modèles/rotation existants.

## Schéma — migration `0011_tracking_program_days.sql`

Destructive sur les tables programme (pas sur l'historique de séances) :

```sql
-- Ordre : enfants avant parents (tracking_program_state et
-- tracking_program_rotation référencent tracking_templates par FK ; ce
-- projet exécute avec PRAGMA foreign_keys=ON, cf. migration 0010).
DROP TABLE tracking_program_state;
DROP TABLE tracking_program_rotation;
DROP TABLE tracking_template_exercises;
DROP TABLE tracking_templates;

CREATE TABLE tracking_program_days (
  day_of_week INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Lundi … 6=Dimanche
  is_rest INTEGER NOT NULL DEFAULT 1 CHECK (is_rest IN (0, 1))
);

INSERT INTO tracking_program_days (day_of_week, is_rest) VALUES
  (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1);

CREATE TABLE tracking_program_day_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_of_week INTEGER NOT NULL REFERENCES tracking_program_days(day_of_week),
  ordre INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('reps', 'seconds')),
  sets_count INTEGER NOT NULL,
  target_value INTEGER NOT NULL,
  UNIQUE (day_of_week, ordre)
);

CREATE TABLE tracking_program_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pointer_day_of_week INTEGER NOT NULL DEFAULT 0 REFERENCES tracking_program_days(day_of_week)
);
INSERT INTO tracking_program_state (id, pointer_day_of_week) VALUES (1, 0);

ALTER TABLE tracking_seances RENAME COLUMN template_id TO program_day_of_week;
```

Les 7 lignes de `tracking_program_days` existent toujours (seedées repos par
défaut) — pas de ligne à créer/supprimer, seulement `is_rest` et les
exercices liés à faire évoluer. `tracking_program_day_exercises` a bien une
`REFERENCES` (contrairement à l'ancien `tracking_seances.template_id`) : les
7 jours ne sont jamais supprimés, donc pas de risque de casser une
suppression en cascade.

`tracking_seances.program_day_of_week` garde le même statut que
`template_id` avant lui : pas de `REFERENCES`, une séance loggée garde sa
valeur même si la config du jour change ensuite — utile pour l'historique,
jamais bloquant.

## Programme — lecture/écriture

`src/lib/tracking/program.ts` remplace entièrement `templates.ts` (supprimé)
et son propre contenu actuel :

- `getProgramDays(db)` → les 7 jours dans l'ordre, chacun
  `{ dayOfWeek, label, isRest, exercises: DayExercise[] }` — `label` calculé
  depuis une constante `["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi",
  "Samedi", "Dimanche"]`, jamais stocké.
- `setDayRest(db, dayOfWeek, isRest)` — bascule repos/séance. Passer à repos
  ne supprime pas les exercices existants (ils réapparaissent si on repasse
  en séance) — évite une resaisie punitive pour un simple aller-retour.
- `setDayExercises(db, dayOfWeek, exercises)` — remplace la liste en bloc
  (delete + insert), même pattern que l'actuel `updateTemplate`.
- `getPointer(db)` → `dayOfWeek` courant (0-6).
- `advancePointer(db)` → `pointer = (pointer + 1) % 7`. Ne prend plus de
  paramètre (le cycle est fixe, plus besoin de retrouver une position dans
  une liste variable — c'était la seule raison de l'ancien paramètre
  `completedTemplateId`).

## Player guidé — reclé sur le jour de semaine

Même mécanique que l'existant (`PlayerScreen`/`deriveState` génériques,
aucun changement), seule la clé change de `templateId` à `dayOfWeek` :

- `src/lib/tracking/templateAsTrainDay.ts` → renommé
  `dayAsTrainDay.ts` : prend un `ProgramDay` (label + exercises) au lieu
  d'un `Template`, même mapping vers `TrainDay`. `id` synthétique devient
  `day-${dayOfWeek}-${ordre}`.
- `src/lib/tracking/loadTemplatePlayerState.ts` → renommé
  `loadDayPlayerState.ts` : `getOrStartSeance(db, dayOfWeek)` (même fonction
  `db.ts`, le paramètre est un entier opaque, aucun changement de
  signature), reste de la logique identique (phases in-progress /
  pending-validation / completed / wrong-seance).
- Route `/player/tracking?templateId=…` → `?day=0..6`. Si le jour est
  `repos` ou n'a aucun exercice, message d'erreur + retour Aujourd'hui (même
  traitement que l'actuel « modèle introuvable »).
- Actions (`src/lib/tracking/actions.ts`) :
  - `logTemplateSetAction` → `logDaySetAction(dayOfWeek, params)`, cherche
    l'exercice par `ordre` dans `getProgramDays` au lieu de `getTemplate`.
  - `completeTemplateSeanceAction` → `completeDaySeanceAction(seanceId)` :
    valide la séance puis `advancePointer(db)` (plus de paramètre à passer).
  - Nouvelle `advanceProgramDayAction()` : avance le pointeur seul, sans
    séance — appelée par le bouton « Jour suivant » sur un jour repos.
  - `skipTemplateExerciseAction` → renommé `skipDayExerciseAction`, logique
    inchangée.
  - Supprimées : `startTrackingSeanceAction`, `createTemplateAction`,
    `updateTemplateAction`, `deleteTemplateAction`, `setRotationAction`.
  - Gardées telles quelles (servent à la revue d'historique) :
    `logTrackingSetAction`, `updateTrackingSetAction`,
    `deleteTrackingSetAction`, `deleteTrackingExerciseAction`,
    `deleteTrackingSeanceAction`, `completeTrackingSeanceAction`.

## Aujourd'hui — `TrackingCard`

`loadTrackingScreenState` remplace `todayTemplate`/`rotationTemplates` par :

```ts
programDay: { dayOfWeek: number; label: string; isRest: boolean; exercises: DayExercise[] }
activeSeance: { id, dayOfWeek: number | null, dayLabel: string | null, templateExercises: DayExercise[] | null, loggedExercises: ActiveSeanceExercise[] } | null
```

`TrackingCard` (3 états, plus de branche libre) :
- `activeSeance !== null` → détail du jour (liste d'exercices planifiés du
  jour concerné, comme aujourd'hui) + bouton **Reprendre** vers
  `/player/tracking?day=…`. Si l'`activeSeance` n'a pas de `dayOfWeek`
  (séance libre historique encore active depuis avant ce changement), repli
  sur `/tracking/${id}` pour pouvoir la terminer ou la supprimer — garde-fou
  pour ne pas bloquer une séance réelle en cours au moment du déploiement.
- `programDay.isRest` → « Repos » + bouton **Jour suivant** →
  `advanceProgramDayAction()` puis `router.refresh()`.
- Sinon → nom du jour + liste d'exercices planifiés + bouton **Commencer**
  vers `/player/tracking?day=…`.

Plus de bouton « Changer » (le cycle est fixe, pas de swap manuel) ni
« Enregistrer une séance » (mode libre retiré).

## `/tracking/programme`

Remplace la liste de modèles + section rotation par 7 lignes fixes
Lundi → Dimanche : toggle Repos/Séance par ligne (pill, même style que
l'actuel bouton rotation), et si Séance, nombre d'exercices affiché +
« Modifier » ouvre l'éditeur d'exercices du jour (`src/components/tracking/
TemplateEditor.tsx` renommé `DayEditor.tsx`, même formulaire — nom
d'exercice avec autocomplétion, unité, séries, cible — moins le champ nom
de modèle, plus utile ici).

## `/tracking` (historique)

`TrackingScreen` perd le bouton « Enregistrer une séance libre ». Le
bandeau de reprise et la liste d'historique sont inchangés — la bande de
reprise pointe vers `/player/tracking?day=…` si `activeSeance.dayOfWeek`
est renseigné, sinon vers `/tracking/${id}` (même repli que `TrackingCard`).

## Tests

- `program.test.ts` (remplace `templates.test.ts` + l'actuel
  `program.test.ts`) : `getProgramDays` renvoie toujours 7 entrées dans
  l'ordre, `setDayRest` préserve les exercices existants, `setDayExercises`
  remplace en bloc, `advancePointer` boucle `6 → 0`.
- `dayAsTrainDay.test.ts` : mapping jour → `TrainDay`.
- Migration `0011` : les 7 jours sont seedés repos, `program_day_of_week`
  existe sur `tracking_seances` avec les valeurs de l'ancien `template_id`
  préservées, anciennes tables absentes.
- `TrackingCard.test.tsx` : les 3 états (repos, séance à faire, séance en
  cours), plus plus aucune assertion sur le mode libre.
- `ProgrammeScreen.test.tsx` (remplace le test actuel) : toggle repos/séance
  par jour, éditeur d'exercices.
- Test d'intégration player : démarrer une séance depuis un jour, quitter,
  revenir — état intact (règle CLAUDE.md §2/§7).

## Suite

Découpage en phases pour `writing-plans` : (1) migration + `program.ts`
réécrit, (2) player reclé sur `dayOfWeek` (routes + actions), (3)
`TrackingCard` + `TrackingScreen` (retrait du mode libre), (4)
`/tracking/programme` (éditeur 7 jours). Chaque phase testable seule, dans
cet ordre.
