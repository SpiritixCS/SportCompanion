# Trophées — sous-projet 6/6

## Objectif

Page Trophées : cumul all-time des répétitions par exercice, tous programmes confondus (Programme + Dos), avec paliers laiton et fiche détail par exercice. Dernier sous-projet du roadmap CLAUDE.md §1 — le liant entre les deux axes (Programme, Dos).

Référence brief : `design/uploads/claude.md` §4.6 (Trophées), §4.4 (écran de fin de séance, "le moment trophées").

## Écarts assumés au brief

Deux endroits où le brief, écrit avant que le modèle de données Dos existe, ne colle plus exactement à ce qui a été construit en 4a/4b. Décisions validées avec l'utilisateur :

1. **Granularité des cartes Dos.** Les exercices d'arbre ont un `id` qui change de cran en cran (`A-3` → `A-4` en montant de niveau) — voir `src/lib/dos/buildDosDay.ts`. Une carte Trophées par cran ferait "disparaître" la progression à chaque montée. **Décision : une carte par arbre** (`ArbreId`, ex. `"A"`), cumul across tous les crans jamais faits sous ce nom.

2. **Exercices d'arbre chronométrés.** Certains arbres (H, I, et partiellement C) prescrivent des secondes/minutes, pas des reps — `unite: "s" | "m"` dans `src/lib/backpain/arbres.ts`. Une "répétition cumulée" n'a pas de sens pour ces séries. **Décision : seules les séries en `unite: "reps"` comptent dans le total.** L'arbre C mélange les deux selon le bloc (`prescriptions[bloc-1].unite`) — le filtre s'applique **par série loggée**, pas par arbre.

3. **"Répartition par module" (fiche exercice, brief §4.6).** Structurellement impossible : un `id` Programme (slug `data.ts`) et un `id` Dos (`ArbreId`) ne se recouvrent jamais, donc chaque carte est déjà 100% un seul module. **Décision : remplacé par une répartition par cran, cartes Dos uniquement.** Les cartes Programme n'ont pas de répartition.

## Architecture

Calcul à la lecture, pas de table dédiée. `computeTrophies(db)` réagrège `sets_logged`/`dos_sets_logged` à chaque chargement — le total ne peut jamais diverger du vrai historique loggé (même logique que la leçon CLAUDE.md §2 : l'état affiché vient de la source de vérité, jamais reconstruit/maintenu à côté). Volume minuscule (un utilisateur), donc pas de coût de performance à amortir.

### Fichiers nouveaux

- `src/lib/trophies/computeTrophies.ts` — agrégation pure, retourne `TrophyCard[]`.
- `src/lib/trophies/paliers.ts` — `PALIERS`, `palierAtteint`, `prochainPalier`.
- `src/lib/trophies/loadTropheesScreenState.ts` — appelle `computeTrophies`, calcule l'en-tête.
- `src/lib/trophies/loadTrophyDetail.ts` — détail d'une carte par `id`.
- `src/components/trophies/TropheesScreen.tsx` — en-tête, toolbar, grille.
- `src/components/trophies/TrophyCard.tsx` — carte individuelle.
- `src/components/trophies/useCountUp.ts` — hook d'animation compteur.
- `src/app/(shell)/trophees/page.tsx` — remplace le stub "Arrive en phase 5".
- `src/app/(shell)/trophees/loading.tsx` — squelette de la grille.
- `src/app/(shell)/trophees/error.tsx` — écran d'erreur + Réessayer.
- `src/app/(shell)/trophees/[exerciseId]/page.tsx` — fiche exercice.

### Fichiers modifiés

- `src/components/player/SummaryView.tsx` — total all-time par exercice + bandeau de franchissement de palier.
- Point d'appel de `SummaryView` (Programme et Dos) — doit fournir à `computeTrophies` un accès DB déjà disponible à ce niveau (Server Component/Server Action).

## Modèle de données

```ts
type TrophyCard = {
  id: string;               // exercise.id (Programme) ou ArbreId (Dos)
  module: "programme" | "dos";
  name: string;              // exercise.name ou ARBRES[arbre].nom
  movementFamily: string;
  videoId: string | null;    // Dos: toujours null
  total: number;
  firstAt: string;
  lastAt: string;
  seanceCount: number;
  byCran?: { cran: number; nom: string; total: number }[]; // Dos only
};
```

### `computeTrophies(db): TrophyCard[]`

**Côté Programme :**

```sql
SELECT sl.*, s.parcours, s.level, s.day_index
FROM sets_logged sl
JOIN seances s ON sl.seance_id = s.id
```

Pas de `GROUP BY` SQL — résolution et agrégation en JS, car un même `exercise.id` peut apparaître sous plusieurs `(parcours, level, day_index, exercise_order)` et une agrégation SQL par `exercise_order` ne fusionnerait pas ces occurrences.

Pour chaque ligne : `getParcours(parcours).program[level-1][day_index]` (garde si `kind === "train"`) → `.exercises[exercise_order]`. Si `exercise.countsInStats === false`, ignorer la ligne. Sinon accumuler dans `Map<string, Accumulator>` par `exercise.id` : `total += reps_actual`, `firstAt = min(completed_at)`, `lastAt = max(completed_at)`, `seanceIds.add(seance_id)`.

**Côté Dos :**

```sql
SELECT dsl.*, ds.semaine
FROM dos_sets_logged dsl
JOIN dos_seances ds ON dsl.seance_id = ds.id
```

Pour chaque ligne : `exercise_id.match(ARBRE_EXERCISE_ID)` (regex exportée par `src/lib/dos/bilan.ts`) → `arbre`, `cran`. `bloc = computeBlock(semaine)` (`src/lib/backpain/periode.ts`). Si `ARBRES[arbre].prescriptions[bloc-1].unite !== "reps"`, ignorer la ligne. Sinon accumuler dans `Map<ArbreId, Accumulator & {byCran: Map<number, number>}>` par `arbre` : `total += valeur_actual`, `byCran[cran] += valeur_actual`, plus `firstAt`/`lastAt`/`seanceIds`.

**Fusion :** transformer chaque accumulateur Programme en `TrophyCard` (`module: "programme"`, résoudre `name`/`movementFamily`/`videoId` depuis l'exercice résolu, `seanceCount = seanceIds.size`, pas de `byCran`). Transformer chaque accumulateur Dos en `TrophyCard` (`module: "dos"`, `name = ARBRES[arbre].nom`, `movementFamily = "arbre-" + arbre`, `videoId: null`, `byCran` trié par `cran` avec `nom` résolu via `ARBRES[arbre].crans[cran-1].nom`). Concaténer.

### `paliers.ts`

```ts
export const PALIERS = [100, 500, 1000, 5000, 10000, 25000] as const;

export function palierAtteint(total: number): number | null {
  const atteints = PALIERS.filter((p) => total >= p);
  return atteints.length > 0 ? atteints[atteints.length - 1] : null;
}

export function prochainPalier(total: number): number | null {
  return PALIERS.find((p) => p > total) ?? null;
}
```

### `loadTropheesScreenState(db)`

```ts
type TropheesScreenState = {
  cards: TrophyCard[];
  totalReps: number;           // sum(cards.total)
  seanceCount: number;         // distinct completed_at non-null, seances + dos_seances
  joursActivite: number;       // distinct date(completed_at), seances + dos_seances
};
```

### `loadTrophyDetail(db, id): TrophyDetail | null`

Recherche la carte correspondant à `id` dans `computeTrophies(db)`. Si absente, `null` (→ `notFound()` côté route). Ajoute `prochainPalier(total)` et `resteAParcourir = prochainPalier - total` (undefined si déjà au-delà de 25000).

## Composants

### `page.tsx` (`/trophees`)

Server Component, `export const dynamic = "force-dynamic"` (cohérent avec `/dos`, `/programme` — évite le bug de pré-rendu statique déjà rencontré et corrigé en 4b). Appelle `loadTropheesScreenState`, passe à `TropheesScreen`.

### `TropheesScreen` (Client Component)

- En-tête : total all-time (Archivo Expanded 44px, tabular-nums, `useCountUp`), sous-ligne "N séances · M jours d'activité".
- Toolbar sticky : tri (plus de reps / récent / alphabétique) et filtre (tous / programme / dos) — `useState` local sur la liste déjà chargée, pas de refetch.
- Grille de `TrophyCard`, 2 colonnes mobile / 3 à partir de 720px.
- État vide (`cards.length === 0`) : une carte fantôme + "Fais ta première séance pour commencer à cumuler."

### `TrophyCard`

- Image : thumbnail `public/exercises/{id}.jpg` si Programme et disponible ; sinon pas d'image (pas de placeholder décoratif — anti-pattern brief), juste le nom en plus grand.
- Nom, compteur all-time (`useCountUp`, délai `40ms × index`).
- Si `palierAtteint(total) !== null` : liseré laiton discret sous le compteur + libellé "Palier {valeur}".

### `useCountUp(target: number, delayMs: number)`

Anime 0→`target` sur 600ms depuis `delayMs`. Si `prefers-reduced-motion: reduce`, affiche directement `target`, aucune animation. Après la première ouverture de la page dans la session (`sessionStorage` flag), affichage direct sans animation (brief §4.6 : "après la première visite de la session, ils s'affichent directement").

L'animation ne se déclenche qu'au montage initial de la grille, pas à chaque changement de tri/filtre : `TrophyCard` est keyée par `id` (stable), donc trier/filtrer réordonne le DOM sans démonter/remonter les cartes visibles — `useCountUp` ne se relance pas pour elles. Une carte qui (r)apparaît suite à un changement de filtre est un nouveau montage et anime normalement.

### `[exerciseId]/page.tsx`

Server Component. `loadTrophyDetail(db, params.exerciseId)`. `notFound()` si `null`. Affiche : image (si dispo), total, 1er/dernier passage (formatés en français), prochain palier avec reste à parcourir, répartition par cran (Dos uniquement, sinon section absente).

### `loading.tsx`

Squelette aux dimensions exactes de l'en-tête + grille (largeurs/hauteurs fixes, pas de spinner centré — premier `loading.tsx` du projet, le brief l'exige mais rien ne le couvrait encore ailleurs).

### `error.tsx`

Message ("Impossible de charger les trophées") + bouton Réessayer, même registre que les autres écrans du projet.

## Retrofit SummaryView

`computeTrophies` tourne côté serveur avant l'affichage de l'écran de fin — les séries de la séance en cours sont déjà en DB à ce stade (loggées au fur et à mesure), donc `computeTrophies` reflète déjà le total incluant cette séance. Pas de requête "avant/après" séparée :

- Ligne par exercice : `+X reps` (existant) devient `+X reps · Y au total`, `Y` = total all-time actuel — uniquement pour les exercices `countsInStats: true` (Programme) ou dont l'arbre a contribué en `reps` (Dos). Pour les autres, la ligne reste `+X reps` sans total (pas de valeur trompeuse).
- Franchissement : `totalAvant = totalActuel - repsDeCetteSeance` (repsDeCetteSeance déjà connu via `setsLogged`, prop existante). Si `palierAtteint(totalAvant) !== palierAtteint(totalActuel)`, bandeau discret au-dessus des trois chiffres : "Palier franchi · {valeur} répétitions · {nom exercice}". Zéro exclamation, zéro félicitation (ton §4 CLAUDE.md — l'app constate).

## Tests

Tests unitaires purs, fixture SQLite en mémoire (pattern existant du projet — voir `src/lib/dos/loadDosPlayerState.test.ts` pour le style) :

- `paliers.test.ts` : bornes exactes (99/100/101, 24999/25000/25001, au-delà de 25000 → `prochainPalier` = `null`).
- `computeTrophies.test.ts` :
  - Un exercice loggé sous plusieurs `(parcours, level, day_index)` différents fusionne en une seule carte.
  - Un exercice `countsInStats: false` n'apparaît dans aucune carte.
  - Arbre avec bloc 100% `reps` : toutes les séries comptent.
  - Arbre C (mixte) : une série loggée pendant un bloc où `unite === "s"` ne contribue pas au total, une série loggée pendant un bloc `reps` contribue — même arbre, deux blocs différents dans le jeu de test.
  - `byCran` correct : deux crans différents du même arbre, reps sommées séparément puis regroupées sous la même carte.
- Retrofit SummaryView : franchissement signalé seulement quand `totalAvant`/`totalActuel` traversent réellement un seuil (séance qui ne fait que progresser à l'intérieur d'un même palier → pas de bandeau).

Pas de test d'intégration de persistance (type "enregistrer → naviguer → revenir") : `computeTrophies` ne maintient aucun état mutable, donc pas de risque de la régression décrite en CLAUDE.md §2 — c'est la raison du choix d'architecture (calcul à la lecture plutôt que compteur incrémenté).

## Gestion d'erreurs

`computeTrophies` lève si un `exercise_id` Dos ne matche pas `ARBRE_EXERCISE_ID` (donnée corrompue) — remonte jusqu'à `error.tsx`, pas de valeur par défaut silencieuse qui fausserait un total affiché.
