# Réglages

## Objectif

Écran Réglages, accessible depuis l'icône d'en-tête d'Aujourd'hui (§3 CLAUDE.md — pas un 5ᵉ onglet). Referme une lacune identifiée en revue de projet : l'écran n'existe pas du tout aujourd'hui, ni son point d'entrée (Aujourd'hui n'a même pas d'en-tête). Referme aussi la lacune Wake Lock API (CLAUDE.md §3, contrainte Chrome iOS) au passage, puisque le réglage "garder l'écran allumé" en dépend directement.

Référence brief : `design/uploads/claude.md` §4.7 (Réglages), §4.1 (en-tête Aujourd'hui). Référence prototype : `design/Suivi Entrainement.dc.html` lignes 29-40 (en-tête), 366-398 (overlay réglages), 955-967 (data des groupes).

## Écarts assumés au brief

Décisions validées avec l'utilisateur — le brief liste 5 groupes complets et fonctionnels ; plusieurs rows n'ont aucune infra existante pour les rendre réelles sans élargir fortement le scope. Découpage retenu :

1. **Séance — repos entre séries/exercices, garder l'écran allumé : réels.** Ce sont les réglages les plus liés à l'usage quotidien (§ CLAUDE.md priorité 2, facilité d'usage). Remplacent les constantes actuellement figées dans `src/lib/player/constants.ts`.
2. **Séance — décompte sonore, compte à rebours 3s : persistés, pas encore câblés.** Les deux supposent des mécaniques qui n'existent pas du tout (aucun son dans l'app, aucun écran de décompte avant démarrage). Construire ces mécaniques est un chantier à part — ici les deux rows existent, se sauvegardent (booléens), mais ne changent encore aucun comportement du player.
3. **BackPain — jour de début de cycle : lecture seule.** La date de départ Dos est immuable une fois posée (`DosSetup.tsx` : "elle ne se modifie pas ensuite"), décision déjà prise ailleurs dans le code. Réglages l'affiche pour référence, pas d'action d'édition.
4. **BackPain — rappel de marche du dimanche : abandonné.** Notification background, impossible sur Chrome iOS (CLAUDE.md §3). Pas de substitut in-app proposé — un rappel qui ne rappelle qu'à l'ouverture manuelle de l'app n'a pas de valeur.
5. **Données — Exporter / Réinitialiser : affichés, inertes.** Aucune logique d'export ni de reset n'existe. Rows visibles (forme du design respectée), désactivées, sous-libellé "Bientôt disponible". Un bouton destructeur qui ne fait rien serait pire que son absence si on le rendait cliquable — d'où l'état désactivé explicite plutôt qu'actif.

## Architecture

### Entrée : en-tête Aujourd'hui (nouveau)

`AujourdhuiScreen.tsx` n'a aucun en-tête aujourd'hui. Ajout en tête de chaque branche de rendu (empty / level-up / normal — le brief §4.1 place l'en-tête au-dessus de tout état) :

- Eyebrow : date en toutes lettres, ex. "Mardi 11 août" — `new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())`, première lettre capitalisée (fr-FR renvoie tout en minuscules).
- Titre : "Salut Mathis." (Archivo 32/600) — app mono-utilisateur, prénom en dur, cohérent avec CLAUDE.md §1 (pas d'abstraction multi-utilisateur).
- Bouton réglages : cercle 44px, fond `--paper`, contour `--hairline`, icône `IconSettings` (déjà existante, jamais utilisée) — `onClick` ouvre l'overlay.

### Overlay Réglages — pas une route

Même pattern que `SetupFlow` (déjà dans le codebase, ouvert via `useState` local à `AujourdhuiScreen`) plutôt qu'une route Next.js : cohérent avec la manière dont "changer mon point de départ" est déjà géré, évite une navigation complète pour un panneau qui se referme en un tap.

`AujourdhuiScreen` gère `const [reglagesOpen, setReglagesOpen] = useState(false)`. Quand `true`, rend `<ReglagesScreen onClose={...} />` à la place de l'arbre normal (comme `SetupFlow` aujourd'hui). `ReglagesScreen` est un Client Component qui charge son état via une Server Action au montage (pas de props passées depuis le Server Component parent — l'overlay peut s'ouvrir/fermer plusieurs fois dans une session, doit relire l'état à chaque ouverture, cf. CLAUDE.md §2 : l'état affiché vient de la source de vérité, jamais d'un cache client reconstruit).

Structure visuelle (fidèle au prototype lignes 368-397) :
- `fixed inset-0 bg-canvas z-50 flex flex-col`
- En-tête : "Réglages" (Archivo 24/600) + bouton × (même style que les × existants du player/sheets) → `onClose`.
- Corps scrollable, `flex flex-col gap-8 p-5` : une section par groupe, chacune un eyebrow (11px, uppercase, graphite) + une carte blanche `rounded-20 border border-hairline` contenant les rows séparées par des filets `hairline`.
- Chaque row : `min-h-14 px-5 flex items-center gap-4`, label à gauche (+ sous-label optionnel 13px graphite), valeur/contrôle à droite.

### Fichiers nouveaux

- `migrations/0007_settings.sql` + `.test.ts`
- `src/lib/settings/db.ts` — `getSettings(db)`, `updateSettings(db, patch)`.
- `src/lib/settings/actions.ts` — Server Actions (`"use server"`), même pattern singleton `db()` que `src/lib/dos/actions.ts`.
- `src/lib/settings/db.test.ts`, `src/lib/settings/actions.test.ts`
- `src/components/settings/ReglagesScreen.tsx` (+ `.test.tsx`) — orchestrateur, charge l'état, rend les groupes.
- `src/components/settings/DurationRow.tsx` (+ `.test.tsx`) — row "Repos entre X", ouvre un `Sheet` + stepper au tap.
- `src/components/settings/Toggle.tsx` (+ `.test.tsx`) — pill switch réutilisable, `--ink` actif.
- `src/lib/player/useWakeLock.ts` (+ `.test.ts`) — hook `navigator.wakeLock`.

### Fichiers modifiés

- `src/components/today/AujourdhuiScreen.tsx` — en-tête + état `reglagesOpen`.
- `src/lib/player/loadPlayerState.ts` (ou le point où `REST_BETWEEN_SETS_SECONDS`/`REST_BETWEEN_EXERCISES_SECONDS` sont actuellement importés en dur) — lit `getSettings(db)` à la place des constantes ; les constantes de `src/lib/player/constants.ts` deviennent les valeurs `DEFAULT` insérées par la migration, pas des valeurs lues au runtime.
- `src/components/player/PlayerScreen.tsx` — branche `useWakeLock(keepScreenAwakeEnabled)`, actif uniquement pendant que l'écran player est monté.
- `src/app/(shell)/page.tsx` — inchangé en surface, mais `AujourdhuiScreen` a maintenant besoin implicitement de rien de plus côté Server Component (les réglages se chargent depuis le Client Component à l'ouverture).

## Modèle de données

Table à une seule ligne, colonnes typées — l'ensemble des réglages est fixe et connu (pas de clé/valeur générique, inutile pour un jeu de réglages qui ne grandira pas de façon imprévisible) :

```sql
-- migrations/0007_settings.sql
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  rest_between_sets_seconds INTEGER NOT NULL DEFAULT 90,
  rest_between_exercises_seconds INTEGER NOT NULL DEFAULT 120,
  sound_countdown_enabled INTEGER NOT NULL DEFAULT 0,
  start_countdown_enabled INTEGER NOT NULL DEFAULT 0,
  keep_screen_awake_enabled INTEGER NOT NULL DEFAULT 1
);

INSERT INTO app_settings (id) VALUES (1);
```

Défauts identiques aux constantes actuelles (`REST_BETWEEN_SETS_SECONDS = 90`, `REST_BETWEEN_EXERCISES_SECONDS = 120`) : aucun changement de comportement tant que l'utilisateur ne touche à rien dans Réglages.

```ts
// src/lib/settings/db.ts
type AppSettings = {
  restBetweenSetsSeconds: number;
  restBetweenExercisesSeconds: number;
  soundCountdownEnabled: boolean;
  startCountdownEnabled: boolean;
  keepScreenAwakeEnabled: boolean;
};

function getSettings(db: Database.Database): AppSettings;
function updateSettings(db: Database.Database, patch: Partial<AppSettings>): AppSettings;
```

`updateSettings` fait un `UPDATE app_settings SET ... WHERE id = 1` sur les seules colonnes présentes dans `patch`, puis relit et retourne l'état complet.

## Contenu des groupes

### Programme

- **Parcours actif** — texte lecture seule, `state.parcoursLabel` (déjà chargé ailleurs pour Aujourd'hui/Programme, réutilisé ici).
- **Position** — texte lecture seule, `"N{level} · J{dayIndex + 1}"`.
- **Changer mon point de départ** — row navigationnelle (chevron), `onClick` ferme l'overlay Réglages et ouvre `SetupFlow` (état déjà géré dans `AujourdhuiScreen` : fermer `reglagesOpen`, ouvrir le `setupOpen` existant).

### Séance

- **Repos entre séries** — valeur affichée `"{n} s"`, tap ouvre un `Sheet` (réutilise le pattern stepper de `RepsSheet`, pas des reps mais des secondes, pas de 15s, plancher 15s) → `updateSettingsAction({ restBetweenSetsSeconds })`.
- **Repos entre exercices** — même mécanique, autre champ.
- **Décompte sonore** — `Toggle`, `soundCountdownEnabled`. Persisté uniquement, aucun son ne joue encore nulle part dans l'app.
- **Compte à rebours** — `Toggle`, `startCountdownEnabled`. Persisté uniquement, aucun écran de décompte avant démarrage n'existe encore (le brief l'affiche comme une valeur "3 s" fixe ; tant que la mécanique n'existe pas, un simple booléen "activé/désactivé" suffit à capturer l'intention sans inventer une durée réglable qui n'a rien à régler pour l'instant).
- **Garder l'écran allumé** — `Toggle`, `keepScreenAwakeEnabled`. Persisté **et** consommé par `PlayerScreen` via `useWakeLock`.

### BackPain

- **Début de cycle** — texte lecture seule : date formatée si `getStartDate(db)` renvoie une valeur, sinon "Non défini". Pas de `onClick` (pas d'action d'édition, cf. écart assumé §3).

### Données

- **Exporter** — row visible, `disabled`, sous-label "Bientôt disponible".
- **Réinitialiser la progression** — row visible, `disabled`, label en `--alert` (cohérent avec le traitement "destructif" du brief même si l'action n'existe pas encore), sous-label "Bientôt disponible".

### À propos

- **Version** — texte lecture seule, `process.env.npm_package_version` (disponible côté Server Action sans dépendance supplémentaire) ou fallback `"—"` si absent.

## `useWakeLock`

```ts
// src/lib/player/useWakeLock.ts
function useWakeLock(enabled: boolean): void
```

- `enabled === true` : demande `navigator.wakeLock.request("screen")` au montage / à chaque passage de `enabled` à `true`.
- Relâche le verrou (`sentinel.release()`) au démontage, quand `enabled` repasse à `false`, et sur `visibilitychange` si le document redevient visible (le verrou est automatiquement libéré par le navigateur quand l'onglet passe en arrière-plan — sur Chrome iOS en particulier, cf. CLAUDE.md §3 — il faut re-demander au retour au premier plan, sinon l'écran peut se reverrouiller sans que l'utilisateur s'en aperçoive).
- `navigator.wakeLock` absent (navigateur non supporté) : no-op silencieux, pas d'erreur affichée — c'est un confort, pas une fonctionnalité bloquante.

Branché dans `PlayerScreen` : `useWakeLock(keepScreenAwakeEnabled)`, où `keepScreenAwakeEnabled` vient de `getSettings` (chargé au même endroit que `REST_BETWEEN_*_SECONDS` désormais).

## Tests

Pattern existant du projet (fixture SQLite en mémoire, voir `src/lib/dos/db.test.ts`) :

- `migrations/0007_settings.test.ts` — `runMigrations` crée la table, une ligne par défaut avec les bonnes valeurs, `CHECK (id = 1)` rejette une deuxième ligne.
- `src/lib/settings/db.test.ts` — `getSettings` renvoie les défauts sur une DB neuve ; `updateSettings` avec un patch partiel ne touche que les colonnes fournies, round-trip complet (écrire → relire → valeurs identiques).
- `src/lib/settings/actions.test.ts` — l'action appelle bien `updateSettings` sur l'instance singleton.
- `src/components/settings/ReglagesScreen.test.tsx` — rend les 5 groupes ; éditer un repos (Sheet + stepper + confirmer) appelle l'action avec la bonne valeur ; toggler "garder l'écran allumé"/"décompte sonore"/"compte à rebours" appelle l'action ; rows Données rendues `disabled`.
- `src/components/settings/Toggle.test.tsx` — état visuel on/off, `onClick` inverse.
- `src/lib/player/useWakeLock.test.ts` — mock `navigator.wakeLock.request`, vérifie l'appel quand `enabled=true`, `release()` au démontage et quand `enabled` repasse à `false`, pas d'appel/erreur quand `navigator.wakeLock` est `undefined`.
- **Test de persistance obligatoire (CLAUDE.md §7)** : dans `ReglagesScreen.test.tsx` ou un test d'intégration dédié — changer le repos entre séries, fermer l'overlay (démonter), rouvrir (remonter), la valeur affichée reflète bien ce qui a été écrit en DB et non une valeur par défaut reconstruite côté client.
- Vérifier côté player (test existant à étendre, `PlayerScreen.test.tsx` ou `loadPlayerState.test.ts`) : une valeur de repos personnalisée en DB est bien celle utilisée par `RestView`, pas la constante `90`/`120` figée.

## Gestion d'erreurs

`getSettings` ne peut pas échouer silencieusement vers des valeurs par défaut divergentes : si la ligne `id = 1` est absente (DB corrompue/migration non appliquée), l'erreur SQL remonte telle quelle — pas de fallback en mémoire qui masquerait un problème de migration. `ReglagesScreen` affiche l'état d'erreur générique déjà utilisé ailleurs dans l'app (message + Réessayer) si le chargement initial échoue.
