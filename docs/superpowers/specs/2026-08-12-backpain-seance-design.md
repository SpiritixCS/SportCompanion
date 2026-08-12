# Dos — séance — design

Sous-projet 4b/6 de SportCompanion (voir `CLAUDE.md` §5 pour le contexte produit, `BackPainProgram.md` pour la logique de domaine — source de vérité, jamais modifiée par ce document — et `design/uploads/claude.md` §4.5 pour la grammaire visuelle BackPain). Périmètre : composer la séance du jour depuis l'état vivant des arbres (4a), la faire jouer par le player existant (phase 2, inchangé), capturer gêne et effort en fin de séance, et construire l'écran `/dos` réel qui remplace le stub de phase 3.

Découpage complet de la phase 4 : 4a (moteur, fait) → **4b (ce document) — Séance** → 4c (suivi quotidien : mobilité, marche, transitions, rappels bureau, métriques hebdo, charge cumulée).

## Objectif

Un utilisateur peut, chaque jour de la semaine (lundi à samedi) : voir sur Aujourd'hui et sur `/dos` la séance Dos du jour, composée automatiquement depuis les exercices fixes et le cran courant de chaque arbre concerné, la lancer dans le même player que le Programme, l'enregistrer avec son ressenti (répétitions en réserve, gêne), et voir chaque arbre concerné avancer, rester, ou être bloqué selon la règle de progression — sans jamais avoir à connaître le mot RPE.

## Décisions actées en amont (brainstorm)

- **Calé sur le calendrier, sans rattrapage.** Le jour de la semaine réel détermine la composition du jour (J1=lundi … J6=samedi, dimanche=repos) — jamais un compteur de séances validées. Un lundi manqué n'ouvre pas J1 le mardi : le mardi affiche J2 normalement, et les arbres de J1 n'ont simplement aucune évaluation cette semaine-là. Cohérent avec le calcul semaine/bloc de 4a, qui est déjà ancré sur des jours calendaires écoulés, pas sur un compteur de séances.
- **`geneLendemain` (§7) reporté en 4c.** Cette phase capture uniquement `genePendant`, saisie à l'enregistrement de la séance — nécessaire immédiatement pour `evaluateProgression`. La gêne du lendemain est un check-in du jour suivant, même famille que les métriques hebdomadaires de 4c ; pas de nouveau mécanisme de bandeau inter-jours ajouté ici.
- **RPE jamais montré à l'écran.** `BackPainProgram.md` §2 définit déjà la RPE comme équivalente à un compte de répétitions en réserve (10→0, 9→1, 8→2, 7→3, 6→4, 5→5 ou plus). L'UI pose la question dans ces termes-là (« combien de répétitions en réserve ? ») et convertit en interne — ce n'est pas une réinterprétation du domaine, c'est le choix de la formulation déjà présente dans la source plutôt que le jargon RPE.

## Portée de cette phase

- **Composition de séance + player + Bilan + écran `/dos` réel.** Le player (phase 2, `src/lib/player/*`, `src/components/player/*`) n'est **pas modifié dans son comportement** — consommé via un adaptateur qui produit un `TrainDay` standard. `ExerciseView`/`RestView` acceptent déjà un prop `accent` (phase 2 l'avait anticipé, valeur par défaut `cobalt`). Deux endroits restent câblés en dur et doivent devenir des props avec valeur par défaut identique au comportement actuel — exactement ce que la phase 2 avait explicitement isolé pour ça (« codées en dur cette phase, mais isolées pour être branchées... sans toucher au reste du player ») : `PlayerScreen` (accent non transmis à ses enfants, constantes de repos importées en dur, `completeSeanceAction` importé en dur au lieu d'un callback injectable) et `SummaryView` (accent du bouton en dur). Aucun autre fichier du player n'est touché ; le comportement Programme reste identique bit-à-bit via les valeurs par défaut.
- **Pas de `geneLendemain`, pas de mobilité quotidienne, pas de marche, pas de transitions assis-debout, pas de rappels bureau, pas de métriques hebdomadaires, pas de charge cumulée** (§7 second volet, §8-§13 de `BackPainProgram.md`) — tout ça est 4c.
- **Pas d'écran « programme terminé »** au-delà de la semaine 16 (§15, entretien). `computeWeek` reste borné à 16 indéfiniment ; aucun écran dédié cette phase.
- **Aucune modification de `src/lib/backpain/*`** (4a) — consommé tel quel.

## Base de données

Nouvelle migration `migrations/0005_dos_seances.sql` :

```sql
CREATE TABLE dos_seances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  jour_semaine TEXT NOT NULL,
  semaine INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  gene_pendant INTEGER
);

CREATE TABLE dos_sets_logged (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id INTEGER NOT NULL REFERENCES dos_seances(id),
  exercise_order INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  valeur_target TEXT NOT NULL,
  valeur_actual INTEGER NOT NULL,
  rest_seconds INTEGER NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE TABLE dos_skipped_exercises (
  seance_id INTEGER NOT NULL REFERENCES dos_seances(id),
  exercise_order INTEGER NOT NULL,
  skipped_at TEXT NOT NULL,
  PRIMARY KEY (seance_id, exercise_order)
);
```

Tables neuves, pas une réutilisation de `seances`/`sets_logged` (phase 2) : celles-ci sont indexées par `(parcours, level, day_index)`, un modèle qui ne correspond pas à l'identité de Dos (une séance par date calendaire). Même raisonnement que `current_position` en phase 3 : une table neuve plutôt que surcharger une table existante avec une sémantique différente. `date` est `UNIQUE` — une seule séance Dos par jour calendaire, `getOrStartDosSeance` retourne la ligne existante si déjà appelée ce jour-là.

`gene_pendant` reste `NULL` jusqu'au Bilan de fin de séance (voir plus bas) ; `completed_at` aussi.

## Données arbres fixes

`src/lib/dos/exercicesFixes.ts` — transcrit à la main depuis `BackPainProgram.md` §5, colonne « Exercices fixes », un tableau par jour (J1-J6) :

```ts
export type ExerciceFixe = {
  id: string;
  nom: string;
  series: number;
  target: { unit: "reps" | "s" | "m"; value: number | [number, number] };
  note?: string;
};

export const EXERCICES_FIXES: Record<"lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi", ExerciceFixe[]>;
```

Ces exercices ne progressent jamais (volume constant sur les 16 semaines, §5) — `countsInStats: false` à la composition (même traitement que les exercices exclus des stats côté Caliathletics).

## Composition de séance

`src/lib/dos/buildDosDay.ts` :

```ts
export function getJourSemaine(date: string): "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi" | "dimanche";

export function getDosRestSeconds(jour: JourEntraine): number;
// 60 sur mardi (J2, pas de "mouvement principal" ce jour-là).
// 90 sur lundi/mercredi/vendredi (J1/J3/J5, explicite §4).
// 90 sur jeudi/samedi (J4/J6) — §4 ne donne pas de valeur explicite pour ces deux
// jours ; traité comme les autres jours à "mouvement principal", à défaut d'une
// valeur documentée. Hypothèse posée ici, pas silencieuse.

export function buildDosDay(
  jour: JourEntraine,
  arbreStates: Record<ArbreId, number>, // cran courant par arbre, depuis getCurrentCran
): TrainDay;
```

`buildDosDay` fusionne `EXERCICES_FIXES[jour]` **puis** les arbres du jour, dans cet ordre (échauffement/fixes d'abord, cohérent avec leur rôle dans la colonne « Intitulé » de §5 et avec le fait qu'ils sont explicitement marqués « échauffement » sur J1/J5) (§5 : lundi→A,B,C · mardi→J,H · mercredi→D,A · jeudi→E,F · vendredi→B,H,I · samedi→G,J), chacun résolu à son cran courant via `ARBRES[arbre].crans[cranCourant - 1]` et sa prescription du bloc courant (`ARBRES[arbre].prescriptions[bloc - 1]`). Un arbre travaillé deux fois par semaine (A, B, H, J) doit utiliser **une variante différente entre les deux séances** (§3) — si le cran courant est identique aux deux passages de la semaine, ce n'est pas un bug : c'est la même variante par construction tant qu'aucune montée n'a eu lieu entre les deux ; rien à forcer côté composition, `evaluateProgression` gère la limite d'une montée par semaine indépendamment.

Identifiant stable par exercice arbre : `${arbre}-${cranNumero}` (ex. `"A-5"`) — chaque cran est un mouvement nommé différent, donc une identité Trophées différente, cohérent avec le modèle Caliathletics existant. `countsInStats: true`.

Dimanche : `buildDosDay` n'est pas appelé, pas de `TrainDay`, pas de lancement du player.

## Bilan de fin de séance

Nouveau composant, affiché après `SummaryView` du player (phase 2, non modifié) et avant l'action « Valider la séance ». N'entre pas dans le player lui-même.

Pour chaque arbre travaillé ce jour : **« Il te restait combien de répétitions en réserve après la dernière série ? »** (ou « combien de secondes » pour les arbres à tenue), boutons `0` / `1` / `2` / `3` / `4 ou +`. Converti en RPE selon §2 avant l'appel au moteur (0→10, 1→9, 2→8, 3→7, 4 ou +→6) — jamais affiché à l'utilisateur.

Puis une question de gêne pendant la séance pour l'ensemble (0-10) → `genePendant`.

« Valider la séance » (`completeDosSeanceAction`) :
1. Écrit `dos_seances.completed_at` et `gene_pendant`.
2. Pour chaque arbre travaillé (non sauté), calcule `seriesAuHaut` (toutes les séries loguées ont atteint le haut de la fourchette de la prescription du bloc courant) et appelle `evaluateProgression` (4a) avec `semaine`, `currentCran`, `seriesAuHaut`, le RPE converti, `genePendant`, `dejaMonteeCetteSemaine` (depuis `hasAlreadyRisenThisWeek`).
3. Écrit une ligne `dos_evaluations` par arbre via `recordEvaluation` (4a).
4. Affiche le message retourné par `evaluateProgression` tel quel, par arbre — aucun texte inventé, réutilisation exacte des chaînes françaises de 4a.

Un arbre sauté entièrement (`dos_skipped_exercises`) : aucune ligne `dos_evaluations` écrite pour lui cette semaine — il n'avance ni ne recule, comme un jour manqué.

## Écran `/dos`

- **En-tête** : eyebrow « Dos » (sauge), sous-ligne « Semaine {n} · Bloc {b} » (`computeWeek`/`computeBlock`).
- **Carte du jour** : jour + intitulé de la séance (§5, colonne « Intitulé »), 2-3 exercices annoncés, bouton **Commencer** / **Reprendre** / état accompli — même grammaire que `ProgrammeCard` (phase 3), accent sauge. Dimanche : carte « Repos », aucun bouton (pas désactivé — absent).
- **Semaine en cours** : 7 pastilles lundi→dimanche *de la semaine calendaire en cours* — roule chaque lundi, contrairement à la grille Programme qui est statique par niveau. Dimanche = `restOrWalk` (état existant du composant `Pastille`, pas de nouvel état).
- **Progression des arbres** : 10 lignes (A→J), nom de l'arbre, nom du cran courant, petite échelle de points (remplis jusqu'au cran courant / total) — pas de pourcentage (brief §4.5). La ligne « dernière évolution » du brief est retirée cette phase (calcul dérivé supplémentaire, aucun autre consommateur, YAGNI).

**Carte BackPain sur Aujourd'hui** : version condensée, même structure que `ProgrammeCard`, accent sauge, sans la ligne de 7 pastilles (réservée à `/dos`).

**États** : vide inédit — pas de `start_date` (4a) → écran de réglage à une étape (pas l'assistant 3 écrans du Programme, qui n'a pas d'équivalent parcours/niveau ici) : « Tu démarres aujourd'hui ? », champ date pré-rempli à aujourd'hui, bouton de confirmation → `setStartDateAction`. Chargement/erreur : mêmes conventions que Programme (squelettes aux dimensions exactes, bouton Réessayer).

## Tests

- `exercicesFixes.test.ts` — transcription vérifiée contre `BackPainProgram.md` §5 (revue indépendante à la review, pas seulement contre ce document).
- `getJourSemaine.test.ts` — mapping date → jour, dimanche distinct (pas un J7 avec liste vide).
- `getDosRestSeconds.test.ts` — table des 6 jours.
- `buildDosDay.test.ts` — fusion fixes + arbres, ordre, `id`/`countsInStats` corrects par source, deux arbres bihebdomadaires (A, B, H, J) résolus correctement les deux jours de la semaine où ils apparaissent.
- `src/lib/dos/db.ts` — CRUD sur les 3 tables, même fixture (`mkdtempSync`, migrations lancées d'abord) que `player/db.test.ts`.
- Bilan — table de conversion réserve→RPE, `seriesAuHaut` dérivé correctement des sets logués vs. le maximum de la prescription, appel `evaluateProgression` correct par arbre.
- **Test d'intégration obligatoire** (CLAUDE.md §7) : loguer une série Dos, naviguer ailleurs, revenir, vérifier l'état intact.
- Écran `/dos` + carte Aujourd'hui sauge : états vide (pas de `start_date`), normal, accompli.

## Gestion d'erreurs

- Pas de `start_date` → l'écran de réglage à une étape, pas un état vide générique.
- Dimanche → pas de `TrainDay`, pas de lancement du player ; carte « Repos », bouton absent.
- Arbre sauté → aucune ligne `dos_evaluations` cette semaine pour lui, il n'avance ni ne recule.
- `getOrStartDosSeance` appelé deux fois le même jour → retourne la ligne existante (`UNIQUE(date)`), même idempotence que le player Programme.
- Semaine 17+ (post-protocole) : `computeWeek` reste bloqué à 16 indéfiniment, aucun écran « terminé »/entretien (§15) construit cette phase — omission délibérée, actée ici plutôt que découverte en silence.
- Le Bilan affiche le message retourné par `evaluateProgression` tel quel — pas de nouveau texte inventé pour un cas d'échec.

## Hors scope de cette phase

`geneLendemain`, mobilité quotidienne, marche, transitions assis-debout, rappels bureau, métriques hebdomadaires, charge cumulée (4c). Écran de fin de protocole / entretien post-semaine-16 (§15). Toute modification de `src/lib/backpain/*` (4a). Toute modification du **comportement** Programme du player — seule sa surface (props avec défauts identiques) s'ouvre, `ExerciseView`/`RestView`/`Sheet`/`RepsSheet` restent inchangés.
