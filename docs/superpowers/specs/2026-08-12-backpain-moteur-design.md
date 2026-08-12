# Dos — moteur de progression — design

Sous-projet 4a/6 de SportCompanion (voir `CLAUDE.md` §5 pour le contexte produit, `BackPainProgram.md` pour la logique de domaine complète et figée — **source de vérité, jamais modifiée par ce document**). Périmètre : le moteur de progression de l'axe Dos — calcul semaine/bloc, règle de montée de cran (§6), règle douleur (§7) — en pur, testé unitairement, sans aucun écran. Découpage complet de la phase 4 :

- **4a (ce document) — Moteur.** Logique pure + persistance minimale de l'état des arbres. Aucune UI.
- **4b — Séance Dos.** Composition dynamique de la séance du jour depuis l'état vivant des arbres, intégration au player (phase 2, accent sauge, repos variable §4), écran `/dos` réel remplaçant le stub.
- **4c — Suivi quotidien.** Mobilité quotidienne, marche, transitions assis-debout, rappels bureau, métriques hebdomadaires, charge cumulée.

Ce document ne couvre que 4a. 4b et 4c seront brainstormés séparément une fois 4a implémenté.

## Objectif

Le moteur peut, pour n'importe quel arbre (A à J) et n'importe quel instant du protocole : dire à quelle semaine/bloc on se trouve depuis une date de départ, dire si la semaine est une semaine de décharge ou de calibrage, évaluer si un arbre monte de cran après une séance (avec le message expliquant pourquoi si non), et signaler une stagnation ou une escalade douleur — le tout sans dépendre d'un écran ou d'un schéma de séance qui n'existe pas encore (arrive en 4b).

## Portée de cette phase

- **Aucune UI, aucune route.** Pas d'écran `/dos` réel (le stub de phase 3 reste en place), pas de déclenchement de séance.
- **Pas de schéma de séance/sets.** La gêne (§2/§7) et les résultats de séries sont des paramètres d'entrée fournis par l'appelant — 4b possédera ce schéma et appellera le moteur avec les données qu'il aura déjà loggées.
- **Pas de composition dynamique de séance.** Choisir quels arbres travailler tel jour, construire la liste d'exercices de J1-J6 (§5) à partir du cran courant de chaque arbre : c'est 4b.
- **Pas de mobilité quotidienne, marche, transitions, rappels bureau, métriques hebdo, charge cumulée** (§8-§13 de `BackPainProgram.md`) : c'est 4c, sans dépendance sur ce moteur.

## Base de données

Nouvelle migration `migrations/0003_backpain.sql` :

```sql
CREATE TABLE dos_start_date (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  start_date TEXT NOT NULL,
  set_at TEXT NOT NULL
);

CREATE TABLE dos_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arbre TEXT NOT NULL,
  semaine INTEGER NOT NULL,
  cran_apres INTEGER NOT NULL,
  resultat TEXT NOT NULL,
  horodatage TEXT NOT NULL
);
```

`dos_start_date` : une seule ligne (`id = 1`), saisie explicite une fois — mono-utilisateur, cohérent avec `current_position` (phase 3). Jamais recalculée à partir d'un autre signal.

`dos_evaluations` : journal d'événements **append-only**, jamais d'`UPDATE`/`DELETE` exposé. `resultat` ∈ `'montee' | 'maintien' | 'douleur' | 'plafond' | 'sommet' | 'decharge' | 'calibrage'`. Une ligne par évaluation d'un arbre (à chaque séance loggée en 4b, ou à chaque ajustement manuel en semaine de calibrage).

**Pas de table pour le cran courant, "déjà monté cette semaine", ou un compteur de stagnation** — les trois se dérivent de `dos_evaluations` à la lecture, même principe que `current_position`/`seances` en phase 3 (pas de compteur mutable dupliqué qui peut se désynchroniser — c'est la classe de bug qui a motivé la réécriture, CLAUDE.md §2) :

- **Cran courant** = `cran_apres` de la dernière ligne pour cet arbre, `1` si aucune ligne.
- **Déjà monté cette semaine** = existe une ligne `(arbre, semaine = semaineCourante, resultat = 'montee')`.
- **Stagnation** (§6, "3 semaines de suite sans montée") = les 3 dernières lignes `maintien`/`montee` de l'arbre (en excluant `calibrage` et `decharge`, qui ne sont pas des tentatives de progression) sont toutes `maintien`.

## Données arbres

`src/lib/backpain/arbres.ts` — transcrit à la main depuis `BackPainProgram.md` §3-§4 (pas de pipeline d'extraction comme Caliathletics : le contenu est déjà en prose structurée dans le fichier source, pas de HTML à parser).

```ts
export type ArbreId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";

export type Prescription = { series: number; min: number; max: number; unite: "reps" | "s" | "m" };

export type Arbre = {
  id: ArbreId;
  nom: string;
  crans: { numero: number; nom: string }[];
  prescriptions: [Prescription, Prescription, Prescription, Prescription];
};

export const ARBRES: Record<ArbreId, Arbre>;
```

Les 10 arbres, leurs crans (noms + nombre exact : A=8, B=7, C=6, D=6, E=5, F=5, G=6, H=7, I=4, J=6) et leurs prescriptions par bloc sont copiés verbatim depuis `BackPainProgram.md` §3-§4 — aucune valeur inventée ou arrondie.

## Fonctions

`src/lib/backpain/periode.ts` — pur, aucune dépendance DB :

```ts
export function computeWeek(startDate: string, today: string): number;   // §1 — clampé 1-16
export function computeBlock(week: number): number;                       // §1 — clampé à 4
export function isDechargeWeek(week: number): boolean;                    // week % 4 === 0
export function isCalibrageWeek(week: number): boolean;                   // week === 1
```

`src/lib/backpain/progression.ts` — pur, moteur central §6 :

```ts
export type EvalRow = {
  arbre: ArbreId;
  semaine: number;
  cranApres: number;
  resultat: Resultat;
  horodatage: string;
};

export type Resultat = "montee" | "maintien" | "douleur" | "plafond" | "sommet" | "decharge" | "calibrage";

export function getCurrentCran(evaluations: EvalRow[], arbre: ArbreId): number;
export function hasAlreadyRisenThisWeek(evaluations: EvalRow[], arbre: ArbreId, semaine: number): boolean;
export function checkStagnation(evaluations: EvalRow[], arbre: ArbreId): boolean;

export function evaluateProgression(input: {
  arbre: ArbreId;
  semaine: number;
  currentCran: number;
  seriesAuHaut: boolean;
  rpeAuCibleOuMoins: boolean;
  gene: number;
  dejaMonteeCetteSemaine: boolean;
}): { resultat: Resultat; message: string; cranApres: number };
```

`evaluateProgression` applique l'ordre d'évaluation exact §6 : décharge → douleur (gêne > 3) → plafond (déjà monté cette semaine) → sommet (dernier cran) → maintien/montée (haut de fourchette + RPE cible). Le premier échec détermine le résultat. Semaine de calibrage (`isCalibrageWeek`) : le caller passe systématiquement `dejaMonteeCetteSemaine = false`, la condition 3 ne s'applique jamais cette semaine-là (§1, exception calibrage).

`src/lib/backpain/douleur.ts` — pur, §7, avisory uniquement (jamais appliqué automatiquement) :

```ts
export function checkPainEscalation(recentSeances: { genePendant: number; geneLendemain: number }[]):
  "normal" | "repeter_cran" | "redescendre_cran";
```

**Ne couvre que les 3 premiers paliers de §7, mécaniques et déterministes** (fonction pure d'entiers déjà saisis). Le 4ᵉ palier ("aggravation progressive sur 2 semaines → arrêt du bloc, consultation") est un jugement de tendance, pas une règle déterministe — CLAUDE.md §5 l'exclut explicitement de toute évaluation automatique ("les critères d'alerte peuvent être affichés comme rappels, jamais évalués automatiquement"). Il n'a pas de fonction dans 4a : la tendance de gêne brute (§12, déjà prévue en 4c) s'affiche pour que l'utilisateur juge lui-même, jamais un verdict calculé.

`recentSeances` : les séances Dos les plus récentes pour un arbre donné, **ordonnées chronologiquement (plus ancienne en premier)**, la dernière de la liste étant la séance qui vient d'être enregistrée. Une séance est "gênante" si `genePendant > 3` ou `geneLendemain > 3` (persistance au-delà de 24h, §7). `redescendre_cran` si les deux dernières séances de la liste sont toutes deux gênantes ; `repeter_cran` si seule la dernière l'est ; `normal` sinon.

`src/lib/backpain/db.ts` — persistance minimale :

```ts
export function getStartDate(db: Database): string | null;
export function setStartDate(db: Database, date: string): void;
export function recordEvaluation(db: Database, row: Omit<EvalRow, "id">): void;
export function getEvaluations(db: Database, arbre?: ArbreId): EvalRow[];
```

## Tests

Vitest, convention établie en phase 3 (`syncPosition.test.ts` etc.) — un fichier de test par fonction pure, fixtures in-memory, pas de mock DB pour la logique.

- `periode.test.ts` — table de cas semaine/bloc/décharge/calibrage, bornes exactes (jour du changement de semaine, semaine 16 clampée, semaine 17+ clampée à 16).
- `progression.test.ts` — un cas par ligne de la table §6, plus l'ordre d'évaluation exact (plusieurs conditions en échec simultané → le message correspond à la première dans l'ordre). Cas `sommet` sur un arbre court (I, 4 crans) et un long (A, 8 crans). Cas semaine 1 : plusieurs `calibrage` d'affilée autorisés, `dejaMonteeCetteSemaine` ignoré.
- `progression.test.ts` (dérivations) — `getCurrentCran` sans historique (défaut 1), dernière ligne `calibrage` vs `montee`. `checkStagnation` : `maintien,maintien,maintien` → vrai ; `maintien,montee,maintien` → faux (reset) ; `calibrage`/`decharge` intercalés ne comptent ni ne cassent la séquence.
- `douleur.test.ts` — les 3 paliers mécaniques de §7 : gêne ≤3 revenue <24h → normal ; gêne isolée >3 (pendant ou lendemain) → repeter_cran ; deux séances consécutives gênantes → redescendre_cran.
- `db.test.ts` — migration + persistance : round-trip write/read, `dos_start_date` singleton (`CHECK id=1`), `dos_evaluations` append-only.

Pas de test d'intégration "enregistrer → naviguer → revenir" cette sous-phase (pas de player/UI) — ce test arrive en 4b sur la vraie séance loggée.

## Gestion d'erreurs

Pas d'écran cette sous-phase → pas d'état erreur/vide/chargement à couvrir (arrive en 4b). Robustesse limitée aux fonctions pures et contraintes DB :

- `computeWeek`/`computeBlock` exigent une `start_date` non-nulle en signature — pas de valeur par défaut silencieuse (semaine=1) qui masquerait une vraie erreur de configuration. À l'appelant (4b) de vérifier `getStartDate` avant d'appeler.
- `evaluateProgression` avec `currentCran` hors bornes : non atteignable depuis `getCurrentCran` (toujours dérivé d'un `cranApres` valide écrit par ce même module) — pas de garde défensive ajoutée pour un scénario qui ne peut pas se produire (CLAUDE.md §0).
- `arbre` hors `'A'..'J'` : bloqué par le typage `ArbreId` à la compilation, pas de check runtime.
- `setStartDate` appelé une deuxième fois : `INSERT OR REPLACE` sur `id=1`, idempotent — aucun chemin produit ne déclenche cet appel deux fois (4b n'exposera le setter que tant que `getStartDate` est `null`), mais la fonction ne lève pas d'erreur arbitraire.
- Migration `0003_backpain.sql` : suit le runner existant — échec = arrêt net, pas d'application partielle, pas de rollback auto (cohérent avec `0001`/`0002`).

## Hors scope de cette phase

Tout ce qui touche à une séance réelle (composition dynamique J1-J6, saisie de sets, saisie de gêne, timer/repos variable, écran `/dos`) — 4b. Mobilité quotidienne, marche, transitions assis-debout, rappels bureau, métriques hebdomadaires, charge cumulée hors-programme (§8-§13) — 4c. Aucune modification du player (phase 2) ou de la navigation (phase 3).
