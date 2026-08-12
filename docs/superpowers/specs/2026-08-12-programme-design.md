# Programme — design

Sous-projet 3/6 de SportCompanion (voir `CLAUDE.md` pour le contexte produit complet, `design/uploads/claude.md` §4.1–4.3 et `design/Suivi Entrainement.dc.html` pour la spec visuelle exacte). Périmètre : le flux de navigation autour du player — Aujourd'hui, point de départ, Programme en lecture libre, et la logique de progression qui les relie. Le player lui-même (phase 2) n'est pas retouché, seulement branché.

## Objectif

Un utilisateur peut, au lancement de l'app : définir son point de départ (parcours/niveau/jour), voir sur Aujourd'hui la séance qui l'attend et la lancer, valider une séance et voir la position avancer d'elle-même au jour suivant, être invité à choisir explicitement quand un niveau est terminé, et consulter librement n'importe quel autre jour du programme sans perturber sa progression.

## Portée de cette phase

- **Axe Programme (Caliathletics) uniquement.** BackPain, Trophées et Réglages n'ont pas d'écran réel cette phase — ils existent comme onglets/entrées de navigation avec un contenu de substitution (« stub »), pour que la coquille de nav soit complète et testable dès maintenant plutôt que reconstruite trois fois. Le contenu réel arrive phase par phase sans retoucher la navigation.
- **Le player (phase 2) n'est pas modifié.** `/dev/player` reste disponible tel quel pour le développement. Cette phase ajoute le vrai déclenchement (Aujourd'hui, fiche jour) qui route vers le même player.
- **Pas de sauter un jour entier.** Le brief ne décrit aucune action « sauter le jour » au niveau du programme (à distinguer de « passer l'exercice », qui existe déjà dans le player). La position n'avance que par séance validée ou par choix explicite (point de départ, « Reprendre ici », montée de niveau).

## Base de données

Nouvelle migration `migrations/0002_progression.sql` :

```sql
CREATE TABLE current_position (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  parcours TEXT NOT NULL,
  level INTEGER NOT NULL,
  day_index INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
```

Une seule ligne (`id = 1`), cohérent avec l'app mono-utilisateur — un upsert (`INSERT ... ON CONFLICT (id) DO UPDATE`) à chaque écriture.

Pas de table pour « quels jours sont validés » : c'est déjà répondu par `seances` (phase 2) — `EXISTS (SELECT 1 FROM seances WHERE parcours=? AND level=? AND day_index=? AND completed_at IS NOT NULL)`. Dupliquer cette information dans une deuxième table créerait un risque de désynchronisation pour aucun bénéfice ; la grille de pastilles et les lignes de niveau lisent `seances` directement à chaque rendu.

`day_index` est stocké explicitement (pas dérivé d'un comptage de jours validés) : le point de départ permet de démarrer au milieu d'un niveau (ex. « Intermédiaire · Niveau 3 · Jour 5 ») sans avoir joué les jours 1 à 4 — un calcul du type « premier jour non validé » désignerait alors à tort le jour 1.

## Logique de progression

`current_position` n'est écrit que par une action utilisateur explicite : confirmation du point de départ, « Reprendre ici » depuis la fiche jour, ou décision de montée de niveau. Elle n'est jamais mutée directement par le player (`src/lib/player/actions.ts`, phase 2, reste inchangé).

**Avancement au jour suivant — synchronisation à la lecture.** `syncPosition(db)`, appelée en tête du chargement d'Aujourd'hui : si le jour de la position courante est validé (`completed_at` non nul pour ce `(parcours, level, day_index)`) et `day_index < 7`, avancer à `day_index + 1`, boucler (rattrapage). Cette fonction est le seul endroit qui touche `current_position` en dehors des actions explicites ci-dessus — elle vit dans `src/lib/programme/`, pas dans `src/lib/player/`, pour ne pas coupler les deux phases.

**Jour 7 — montée de niveau.** `syncPosition` n'avance jamais au-delà du jour 7 (il n'y a pas de jour 8). Quand `day_index === 7` et que ce jour est validé, la position reste telle quelle : c'est la condition, entièrement dérivée, qui déclenche l'invite de montée de niveau sur Aujourd'hui (pas de flag « déjà proposé » à stocker — dès que l'utilisateur choisit, `current_position` change et la condition cesse d'être vraie).

- **Passer au niveau suivant** → `current_position = (parcours, level + 1, day_index: 1)`.
- **Refaire ce niveau** → `current_position = (parcours, level, day_index: 1)`.

**Démarrer ce jour vs Reprendre ici** (fiche jour, Programme en lecture) : les deux lancent une séance sur le player existant. « Démarrer ce jour » ne touche jamais `current_position` — `syncPosition` n'avance que si la séance validée correspond exactement à la position courante, donc une séance exploratoire hors-position est sans effet sur le pointeur. « Reprendre ici » écrit `current_position` sur ce jour avant de lancer le player, avec une confirmation (« Ta progression repart de là »).

## Écrans

Primitives visuelles : `Card`, `Button`, `Sheet`, `Pastille`, `BottomNav`, l'icônerie — toutes de Fondations, non modifiées. Accent `cobalt` pour tout ce qui est axe Programme.

### Aujourd'hui (`/`)

États, dans cet ordre de priorité :

1. **Vide** (`current_position` absente) : une seule carte, « Choisis ton point de départ pour commencer à suivre le programme. » → bouton **Définir mon point de départ** → ouvre le flux point de départ.
2. **Montée de niveau** (jour 7 validé, position non avancée) : la carte Programme est remplacée par l'invite de décision (voir Logique de progression) — deux boutons, aucune friction, cohérent avec le ton CLAUDE.md §4 (« refaire un niveau doit être aussi simple que monter »).
3. **Normal** :
   - Bandeau **Reprendre la séance** si une séance est en cours pour la position actuelle (réutilise la détection déjà existante côté player — une séance active sans `completed_at`).
   - Carte Programme (accent cobalt) : position (« Intermédiaire · Niveau 3 · Jour 5 »), grille de 7 pastilles du niveau en cours, aperçu des 3 premiers exercices + « et N autres », durée estimée (`18 + nombre d'exercices × 4` minutes — formule reprise telle quelle du prototype, pas de donnée de durée réelle dans le domaine), bouton **Commencer la séance**.
   - **Avancement immédiat, pas d'état « accompli » qui persiste** : `syncPosition` avance la position dès qu'un jour est validé (voir Logique de progression) — revenir sur Aujourd'hui après une séance montre directement le jour suivant, jamais une carte « déjà fait » à part. Le moment de satisfaction (chiffres, répétitions) est déjà celui de l'écran de fin de séance du player (phase 2), pas dupliqué ici. L'état « accompli, bouton Revoir la séance » reste néanmoins possible en théorie — si l'utilisateur atterrit sur un jour déjà validé via « Reprendre ici » (Programme en lecture) — et doit être géré proprement plutôt que planté, mais ce n'est pas le chemin normal.
   - Carte BackPain (accent sauge) — **stub cette phase** : « Arrive en phase 4 », pas de bouton actif.
   - Bandeau série en cours (jours consécutifs), discret, Archivo tabulaire.
4. **Chargement** : squelettes aux dimensions exactes des cartes finales (jamais de spinner centré). **Erreur** : message + bouton **Réessayer**.

Icône réglages dans l'en-tête : présente, ouvre un stub minimal (« Arrive en phase 6 ») — même traitement que les autres modules non construits, pas un onglet à part entière (cohérent avec le brief §3).

### Point de départ (overlay plein écran, 4 étapes)

Barre de progression fine en haut, bouton retour contextuel.

1. **Parcours** : trois cartes (Débutant / Intermédiaire / Advanced), nombre de niveaux + durée totale.
2. **Niveau** : la grille signature en entier pour le parcours choisi (8 lignes, ou 4 pour Advanced), chaque ligne cliquable.
3. **Jour** : les 7 pastilles du niveau choisi, titre de la séance de chaque jour.
4. **Confirmation** : « Tu démarres à [Parcours] · Niveau [N] · Jour [J] », rappel qu'on peut changer plus tard, bouton **C'est parti** → écrit `current_position`, ferme l'overlay, retour à Aujourd'hui.

### Programme (`/programme`)

- Segmented control 3 positions (parcours), indépendant de la progression réelle — pure consultation.
- Grille signature complète du parcours sélectionné : niveau + titre + taux d'avancement (`round(jours validés / 7 × 100)%`, dérivé de `seances`) à droite. Toucher une ligne déplie les 7 jours (chacun avec sa durée estimée, même formule que sur Aujourd'hui).
- Toucher un jour ouvre la **fiche jour** (bottom sheet) : liste des exercices (séries × répétitions, repos), boutons **Démarrer ce jour** et **Reprendre ici** (ce dernier avec confirmation).

### Dos / Trophées (`/dos`, `/trophees`)

Stubs : eyebrow accentué (sauge / laiton), « Arrive en phase 4 » / « Arrive en phase 5 », aucun contenu interactif. Remplacés intégralement (pas de retouche du shell attendue) quand leurs phases arrivent.

### Navigation

`BottomNav` (déjà construit, Fondations) branché dans `RootLayout` : 4 entrées actives, colonne centrée 520px max sur desktop (rail vertical), cohérent avec le brief §3. Le composant lui-même n'est pas modifié.

## États obligatoires

- **Chargement** : squelettes aux dimensions exactes (Aujourd'hui, Programme).
- **Vide** : Aujourd'hui sans point de départ (voir ci-dessus) ; Programme n'a pas d'état vide (le contenu est toujours le programme complet, indépendant de la progression).
- **Erreur** : échec de lecture DB → message + **Réessayer**, jamais de crash silencieux.
- **Séance interrompue** : bandeau **Reprendre la séance**, jamais de perte silencieuse (répété du player, cohérent avec CLAUDE.md §4).

## Tests

- `syncPosition` : jour validé + `day_index < 7` → avance d'un ; jour 7 validé → n'avance pas (condition montée de niveau) ; jour non validé → ne bouge pas ; rattrapage multi-jours (plusieurs séances validées d'affilée sans passage par Aujourd'hui entre-temps).
- Montée de niveau : « Passer au niveau suivant » et « Refaire ce niveau » écrivent la position attendue, et la condition de montée de niveau redevient fausse immédiatement après.
- Démarrer ce jour vs Reprendre ici : une séance validée hors-position ne bouge pas `current_position` ; une séance validée après « Reprendre ici » avance bien depuis la nouvelle position.
- Point de départ : les 4 étapes écrivent la position finale attendue, pas d'écriture intermédiaire avant confirmation.
- Aujourd'hui : les 4 états (vide / normal / montée de niveau / séance interrompue) s'affichent pour les données correspondantes — pas de test visuel, test de présence des éléments clés par état.

## Hors scope de cette phase

- Contenu réel Dos, Trophées, Réglages (phases 4, 5, 6) — stubs uniquement.
- Réglage utilisateur du temps de repos par défaut (mentionné en Réglages, phase 6) — les constantes du player restent celles de la phase 2.
- Export de données, réinitialisation de la progression (Réglages, phase 6).
- Sauter un jour entier du programme — non prévu par le brief, seule l'exercice individuel se saute (déjà dans le player).
