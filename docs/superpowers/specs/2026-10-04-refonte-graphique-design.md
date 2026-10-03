# Refonte graphique V1 « Agrès » — design

Refonte V1. Direction validée page par page avec Mathis les 3 et 4 octobre 2026, sur maquettes interactives.

## Références

| Page | Maquette (artifact) | Copie locale |
|---|---|---|
| Aujourd'hui | https://claude.ai/artifact/EZN7kUgJwtGvX8vV1dAjFu (mode « Sept traits ») | `design/v1/aujourdhui.html` |
| Programme | https://claude.ai/artifact/JyQowxe6WX72ghBK8MapFo | `design/v1/programme.html` |
| Séance | https://claude.ai/artifact/Gf8BGLRchh9aF38wCa7DyE | `design/v1/seance.html` |
| Trophées | https://claude.ai/artifact/KYPehWfqWBMCGKe5jD3RT3 | `design/v1/trophees.html` |
| Tracking | https://claude.ai/artifact/UTDpn4teBeKVaw7dRXU8uz | `design/v1/tracking.html` |

Les copies locales sont la **source de vérité visuelle** de la V1 et remplacent le prototype Claude Design (`design/Suivi Entrainement.dc.html`, conservé pour l'historique). En cas de doute sur un détail, relire la maquette avant d'improviser.

## Principes

- **Sobre.** Une couleur d'accent par module, une seule animation d'entrée par élément, aucun effet empilé (pas de particules, de lueur ni de rebond cumulés). Mathis a écarté toutes les variantes jugées « trop complexes ».
- **La couleur encode le module** : Programme = indigo, Tracking = jade, Trophées = or. Le reste est neutre.
- **Chiffres en grand.** Les nombres (jour, objectif, total, minuteur) sont les éléments les plus visibles de chaque écran.
- **Sept traits** remplacent les pastilles partout : un trait par jour (fait = plein, aujourd'hui = indigo pâle avec une flèche dessous, repos = trait fin gris, à venir = gris).
- **Pictos de famille** devant chaque exercice du Programme. Les exercices libres du Tracking affichent leur initiale.
- **Boutons uniques qui basculent** plutôt que des groupes de puces quand une option tourne en boucle (tri des Trophées).

## Tokens

Les noms de tokens existants sont conservés (valeurs changées) pour limiter le diff ; les couleurs gardent leur rôle.

| Token | Valeur | Rôle |
|---|---|---|
| `canvas` | `#EDEFF2` | fond d'écran (aluminium) |
| `paper` | `#FFFFFF` | cartes, feuilles |
| `ink` | `#0B0D12` | texte, nav, bouton principal neutre, fond du repos |
| `graphite` | `#626B78` | texte secondaire, étiquettes |
| `hairline` | `#D9DEE5` | filets, traits « à venir » |
| `cobalt` | `#2F2BFF` | Programme (indigo) |
| `cobalt-soft` | `#E6E5FF` | fond des pictos Programme, trait du jour |
| `sage` | `#0F9D74` | Tracking (jade) |
| `sage-soft` | `#DDF3EC` | fond des initiales, puces repos |
| `sage-ink` | `#0A5E47` | texte sur `sage-soft` |
| `brass` | `#C8961E` | Trophées / paliers (or) |
| `brass-soft` | `#F6EDD8` | fonds or légers |
| `alert` | `#B3402E` | uniquement destructif (inchangé) |
| `rest-surface` | `#1A1E28` | boutons et cartes sur l'écran de repos |
| `rest-line` | `#232733` | cercle de fond du minuteur |

Rayons : cartes 22–28 px (`--radius-card: 24px`, grandes cartes 28 px), champs 14 px, pilules 999 px. Pas d'ombre, sauf l'écran-téléphone des maquettes (hors app).

## Typographie

| Rôle | Police | Usage |
|---|---|---|
| Affichage | **Big Shoulders Display** 700/800 | titres en capitales, tous les chiffres (jour, objectif, totaux, minuteur, pourcentages) |
| Texte | **Instrument Sans** 400/500/600 | noms d'exercices, paragraphes, boutons |
| Étiquettes | **IBM Plex Mono** 400/500 | eyebrows en capitales espacées (0,14 em), méta (« 9 exercices · 54 min ») |

Chargées via `next/font/google` (remplacent Archivo et Inter Tight). Utilitaires Tailwind renommés : `font-display`, `font-body`, `font-mono` (remplacent `font-archivo` / `font-inter-tight`, ~145 occurrences, renommage mécanique). Chiffres en `tabular-nums` partout où ils changent en direct. Échelle étendue : 112 px (objectif, total Trophées), 120 px (minuteur de repos).

## Composants partagés

| Composant | Remplace | Comportement |
|---|---|---|
| `SeptTraits` | `Pastille`, `LigneNiveau` | 7 traits d'état ; variante grande (Aujourd'hui, sous « J5/7 ») et compacte (niveaux du Programme). Entrée : traits qui s'étirent de gauche à droite, décalés de 60 ms. |
| `FloatingNav` | `BottomNav` | pilule `ink` flottante (bas, 14 px des bords, au-dessus du safe-area) ; pastille blanche qui glisse vers l'onglet actif. ≥ 1024 px : même pilule en rail vertical à gauche. |
| `ExerciseGlyph` | `ExerciseFamilyIcon` | pastille `cobalt-soft` + picto de famille ; table d'overrides par id d'exercice pour les exercices de famille « other ». |
| `InitialTile` | — | pastille `sage-soft` + initiale en Big Shoulders (exercices libres du Tracking). |
| `FillButton` | `Button` primaire | au toucher, un fond d'accent balaie le bouton de gauche à droite (420 ms) puis l'action s'exécute. |
| `CycleButton` | groupes de puces de tri | un bouton qui passe à l'option suivante à chaque toucher, libellé qui glisse vers le haut. |
| `Sheet` | `Sheet` | poignée, coins 28 px, monte du bas (420 ms). |

## Pages

### Aujourd'hui
En-tête date + « SALUT <PRÉNOM>. » en capitales. Bandeau de reprise sombre avec point qui pulse. Carte Programme : « J5/7 » géant centré + `SeptTraits`, méta « 9 exercices · 54 min », liste d'exercices (picto, nom, dose + barrettes de séries qui se remplissent), « +N autres exercices », `FillButton` « Commencer la séance ». Carte Tracking en jade. **Pas** de particules (retirées à la demande de Mathis).

### Programme
Titre « PROGRAMME » + « Ta progression ne bouge pas quand tu consultes. ». Sélecteur de parcours à pastille glissante. Chaque niveau = carte : grand numéro (indigo pour le niveau en cours + étiquette « En cours »), `SeptTraits` compact, pourcentage en grand. Niveau en cours ouvert par défaut ; dépliage en hauteur animé. Jours : trait d'état, « Jour N », méta ou « Repos », étiquette « Aujourd'hui ». Fiche du jour en `Sheet` : exercices avec `ExerciseGlyph`, dose et barrettes.

### Séance
- **Exercice** : un trait par exercice de la séance (fait / en cours / à venir), durée active à droite, croix de sortie. Carte : grand picto, nom en capitales, objectif à 112 px (« 4 × 6 », « 4 × 60 s », « 4 × 12 / côté »), barrettes de séries (en cours = remplissage lent en boucle), « Série N / M » et « Puis <exercice suivant> ». `FillButton` « Série terminée » + « Passer l'exercice ». Transition entre exercices : glissement horizontal 240 ms.
- **Saisie** : `Sheet` « Reps faites » / « Secondes tenues », chiffre à 112 px, boutons − et + ronds de 64 px, « Valider ».
- **Repos** : plein écran `ink`. Minuteur 120 px au centre d'un cadran gradué (60 graduations) avec un cercle blanc qui se vide en continu ; les 3 dernières secondes, le chiffre bat. Carte « Ensuite » (picto, exercice, série et cible). Deux boutons : « +15 s » (`rest-surface`) et « Passer » (blanc). En-tête : « Repos » / « Repos entre exercices » et la progression.
- **Récap** : « SÉANCE TERMINÉE », trois tuiles (durée active, exercices, reps) qui comptent de 0, une ligne par exercice fait (picto, nom, « +N »), `FillButton` « Terminer » sur barre fixe.
- Les feuilles existantes (pause > 1 h, sortie, effacement) passent au nouveau style sans changer de logique.

### Trophées
Eyebrow or, total à 112 px compté de 0, « N séances · N jours d'activité ». Carte « Prochain palier » (exercice le plus proche de son palier suivant, « X / palier », « N restants », trait or). Ligne de contrôles : `CycleButton` de tri (Plus de reps → Récent → A → Z) + puces de filtre (Tous / Programme / Tracking). Grille 2 colonnes de tuiles : picto, total en grand, nom, « Vers <palier> » + pourcentage + trait or. **Fiche** : retour, grand picto, nom, total à 96 px, carte « Paliers » (6 traits 100 → 25 k : atteints pleins en or, en cours partiel), « N reps pour atteindre X », premier / dernier passage, section « Hors séance » et « Ajouter des reps » (chantier 5, restylé).

### Tracking
Eyebrow jade « Programme perso », titre « TRACKING ». Semaine en 7 cases (abréviation du jour, nombre d'exercices ou « repos ») ; case du pointeur en `ink` avec point jade. Programme vide : carte « Ta semaine est vide » + « Composer lundi ». Sinon carte « Prochaine séance » : jour en grand, exercices (`InitialTile`, nom, « Repos 1:30 », dose), « Commencer la séance » jade. Édition d'un jour en `Sheet` : interrupteur repos, exercices (↑ ↓ ×, puce « Repos m:ss » qui déplie un réglage − / +), formulaire d'ajout (nom avec suggestions, unité reps/secondes, séries, cible, repos). Historique « Tes séances » en bas.

### Écrans secondaires (pas de maquette dédiée)
Réglages, choix du point de départ, écran prénom, accès refusé, `LevelUpPrompt`, `ResumeBanner`, écran de séance Tracking libre (`/tracking/[seanceId]`) : mêmes tokens, typos, composants et rayons ; aucune nouvelle mise en page.

## Repos par exercice (Tracking) — changement fonctionnel

Demandé par Mathis pendant la revue de la maquette Tracking.

- Migration `0017_tracking_exercise_rest.sql` : `ALTER TABLE tracking_program_day_exercises ADD COLUMN rest_seconds INTEGER` (nullable). Les exercices existants (programme de Clément) gardent `NULL` = réglage global « Repos entre séries » : rien ne change pour eux.
- Nouvel exercice : 90 s par défaut, pas de 15 s, bornes 15 s → 600 s.
- `Exercise` (`src/lib/workout/types.ts`) gagne `restSeconds?: number` ; `dayAsTrainDay` le renseigne ; `PlayerScreen` utilise `exercise.restSeconds ?? restBetweenSetsSeconds` pour le repos entre séries. Le repos entre exercices reste le réglage global.

## Pictos

- Les 8 familles (`push`, `pull`, `dip`, `squat`, `core`, `handstand`, `lever`, `other`) sont redessinées dans le style des maquettes (trait 1,8, 24 × 24, coins et bouts arrondis).
- Les 15 exercices de famille « other » reçoivent chacun un picto dédié (override par id) : Biceps curls, Burpees, Calf raises, Dragon lifts, Hanging bent knees raises, Hanging knee raises, Hefesto curls, Icecream makers, Inverted deadlift, One leg dragon negatives, Pike walks, Side bar raises, Supported triceps extensions, Triceps extensions, Triceps extensions on ground.
- **Planche des pictos à valider par Mathis avant intégration** (artifact dédié). Exigence : fidélité au mouvement réel.

## Mouvement

Liste fermée ; tout respecte `prefers-reduced-motion` (état final immédiat).

1. Entrée des cartes : montée de 8–10 px + fondu, décalage 40–45 ms.
2. `SeptTraits` et barrettes : étirement gauche → droite.
3. Compteurs : 0 → valeur en 600 ms (totaux Trophées, récap).
4. `Sheet` : montée 420 ms ; dépliage des niveaux : hauteur 400 ms.
5. Nav et sélecteurs : pastille qui glisse (450–500 ms).
6. `FillButton` : balayage 420 ms.
7. Séance : glissement entre exercices 240 ms, remplissage en boucle de la série en cours, cercle du minuteur qui se vide en continu, battement des 3 dernières secondes.
8. Bandeau de reprise : point qui pulse.

## Hors périmètre

Mode sombre global (seul l'écran de repos est sombre), mode pyramide, refonte de la logique du Tracking (prévue à part), changement de contenu du programme.

## Documentation

`CLAUDE.md` §0 et §4 réécrits : référence visuelle = `design/v1/` + ce document ; tokens, typos, principes (sobre), liste de mouvements ci-dessus ; l'interdiction des anneaux et la limite « trois moments animés » disparaissent.

## Déroulé et validation

Une branche `feat/refonte-graphique`, une phase par page, chacune validée par Mathis en local (copie fraîche des DB de prod) avant la suivante :

0. Fondations : tokens, polices, `SeptTraits`, `FloatingNav`, `ExerciseGlyph`, `FillButton`, `CycleButton`, `Sheet`, pictos (après validation de la planche).
1. Aujourd'hui · 2. Programme · 3. Séance · 4. Trophées · 5. Tracking + repos par exercice · 6. Écrans secondaires + `CLAUDE.md`.

Tests : les tests existants restent verts (libellés et rôles accessibles conservés) ; tests ajoutés pour `SeptTraits` (états), `CycleButton` (ordre du cycle), `ExerciseGlyph` (override par id, repli famille), migration 0017 et repos par exercice dans le player (valeur de l'exercice, repli global).
