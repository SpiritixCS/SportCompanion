# Multi-utilisateur — Clément — design

Ajout d'un second utilisateur (Clément) à SportCompanion, jusqu'ici mono-utilisateur (Mathis). Voir `CLAUDE.md` pour le contexte produit complet ; ce document ne le duplique pas.

## Objectif

Clément doit pouvoir utiliser l'app avec sa propre progression, isolée de celle de Mathis, sans qu'aucun des deux comptes n'affecte l'autre. Il a accès à tout sauf le module Dos (contexte clinique personnel à Mathis, sans sens pour lui) ; à la place, un module **Tracking** : un carnet de séance libre où il logue lui-même ses exercices, séries et reps.

## Périmètre

- Identification des deux comptes et isolation complète des données.
- Nouveau module Tracking pour Clément (nav, écrans, données, Trophées).
- Nav adaptée par utilisateur (Dos caché pour Clément, Tracking caché pour Mathis).
- Mise à jour du pipeline de déploiement et de `DEPLOYMENT.md` pour le second compte.

Hors périmètre : poids/charges dans Tracking (bodyweight only, confirmé), UI d'administration des utilisateurs (deux comptes fixes, connus à l'avance, pas de gestion dynamique), édition/suppression rétroactive d'une série déjà loguée (aucun module de l'app ne le permet aujourd'hui).

## Identification utilisateur

L'app reste sans authentification propre — la distinction des comptes se fait entièrement via Cloudflare Access, comme documenté dans `DEPLOYMENT.md`. Access injecte un header `Cf-Access-Authenticated-User-Email` sur chaque requête une fois l'utilisateur authentifié par son Gmail.

Nouveau module `src/lib/auth/currentUser.ts` :

- Lit le header via `headers()` (Next.js, App Router, code serveur uniquement).
- Compare à deux variables d'environnement, `MATHIS_EMAIL` et `CLEMENT_EMAIL` — jamais commitées. En dev : `.env.local` (déjà gitignored). En prod : fichier `.env` créé une fois à la main sur la VM (voir section Déploiement).
- Retourne `{ slug: "mathis" | "clement", label: "Mathis" | "Clément", dbFileName: string }`.
- Header absent (dev local, pas de Cloudflare devant) → fallback Mathis. Comportement actuel inchangé pour le développement quotidien.
- Header présent mais email non reconnu → écran d'erreur explicite (« Accès non reconnu »), jamais de fallback silencieux vers un compte par défaut. C'est une frontière de confiance réelle (Cloudflare Access est la seule barrière d'auth de toute l'app) : une erreur de config ne doit jamais faire atterrir quelqu'un sur les données de quelqu'un d'autre.

## Isolation des données

Un fichier SQLite par utilisateur plutôt qu'une colonne `user_id` partagée. Raison : plusieurs tables existantes portent des lignes singleton contraintes (`current_position`, `dos_start_date`, `app_settings` — toutes `CHECK (id = 1)`), et une contrainte `UNIQUE` sur `dos_seances.date`. Faire cohabiter deux utilisateurs dans ces tables demanderait de retoucher le schéma et toutes les requêtes existantes ; pour deux comptes fixes connus à l'avance, c'est de la sur-ingénierie. Un fichier par utilisateur isole tout sans toucher une seule table ou requête existante.

- Mathis : `data/sportcompanion.db`, chemin inchangé (zéro migration de données existantes).
- Clément : `data/sportcompanion.clement.db`, créé au premier `db:migrate`, mêmes migrations que Mathis appliquées dessus. Les tables `dos_*` existent dans son fichier mais restent vides (jamais écrites, jamais lues — routes Dos inaccessibles côté nav et côté route, voir plus bas). Symétriquement les tables `tracking_*` existent dans le fichier de Mathis mais restent vides.

### Refactor du client DB

Aujourd'hui, ~8 fichiers (`src/app/(shell)/*/page.tsx`, `src/app/player/**/page.tsx`, `src/lib/*/actions.ts`) dupliquent chacun la même fonction `dbPath()` (lecture de `process.env.DB_PATH`) et mettent en cache un singleton `dbInstance` au niveau module. Cette duplication existait déjà avant ce chantier ; elle devient bloquante dès qu'un même process Node sert deux utilisateurs, puisqu'un singleton par module ne peut mémoriser qu'une seule connexion.

Consolidation dans `src/lib/db/client.ts` :

```ts
export function getDbForUser(user: CurrentUser): Database.Database
```

Cache interne `Map<dbFileName, Database.Database>` (une entrée par fichier, donc par utilisateur), remplace les singletons dispersés. Tous les appelants (`page.tsx` et `actions.ts` listés ci-dessus) passent de `getDb(dbPath())` à `getDbForUser(await currentUser())`.

## Nav par utilisateur

`src/app/(shell)/layout.tsx` résout `currentUser()` côté serveur et construit la nav en conséquence :

- Mathis : Aujourd'hui / Programme / Dos / Trophées — inchangé.
- Clément : Aujourd'hui / Programme / Tracking / Trophées. Tracking occupe l'emplacement de Dos dans la grille de nav, reprend l'accent **Sauge** tel quel (aucun nouveau token couleur — cohérent avec « la couleur encode le module », Tracking devient le 3ᵉ module pour ce compte).
- Garde de route : `/dos` et `/player/dos*` redirigent vers `/` pour Clément ; `/tracking*` redirige vers `/` pour Mathis. Vérifié côté serveur (layout ou route handler), pas seulement caché dans la nav — un accès direct par URL doit être bloqué, pas juste invisible.

Indicateur de compte : prénom (« Mathis » / « Clément ») affiché discrètement dans l'en-tête Aujourd'hui, à côté de l'icône Réglages — évite toute confusion entre les deux comptes qui partagent le même domaine et le même design.

## Module Tracking

Carnet de séance libre, saisie a posteriori (pas de timer, pas de flux plein écran type player). Bibliothèque d'exercices personnelle : texte libre la première fois, mémorisée et proposée en autocomplete ensuite — aucune saisie manuelle de catalogue par Clément ou par nous.

### Données

Nouvelles tables, migration versionnée comme les précédentes, appliquée aux deux fichiers DB :

```sql
CREATE TABLE tracking_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE tracking_seances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE tracking_sets_logged (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id INTEGER NOT NULL REFERENCES tracking_seances(id),
  exercise_id INTEGER NOT NULL REFERENCES tracking_exercises(id),
  exercise_order INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  reps_actual INTEGER NOT NULL,
  completed_at TEXT NOT NULL
);
```

Reps seulement — pas de champ poids/charge (bodyweight only, confirmé). Même granularité que `sets_logged` (Programme) et `dos_sets_logged`.

### Flux

1. Écran Tracking : liste des séances passées + bouton « Enregistrer une séance ».
2. Tap → crée immédiatement une ligne `tracking_seances` (`started_at`), écran de saisie.
3. Ajoute un exercice : champ texte avec autocomplete sur `tracking_exercises.name` ; nom inconnu → nouvelle ligne créée à la volée.
4. Ajoute des séries à cet exercice une à une (reps). Chaque série est écrite en DB immédiatement via server action — pas de brouillon côté client. Cohérent avec le principe déjà appliqué au player Programme/Dos (« l'état affiché doit toujours être lu depuis la source de vérité, jamais reconstruit côté client » — voir `CLAUDE.md` §2) et avec l'isolation incrémentale déjà en place ailleurs.
5. « Terminer la séance » pose `completed_at`.
6. Séance quittée avant complétion → reprise proposée au retour sur Tracking (même bandeau de reprise que Programme/Dos), jamais de perte silencieuse.

### États

Normal (liste de séances), vide (aucune séance encore loguée), chargement (squelettes), erreur (message + Réessayer) — mêmes standards que le reste de l'app (`CLAUDE.md` §4, États obligatoires).

## Trophées

`computeTrophies` (actuellement deux sources : `sets_logged`/`seances` pour Programme, `dos_sets_logged`/`dos_seances` pour Dos) gagne une troisième requête sur `tracking_sets_logged` jointe à `tracking_exercises`, `module: "tracking"`. Le total par exercice cumule les reps exactement comme les deux autres sources. Chez Mathis ces tables sont vides en permanence : aucun changement visible sur ses Trophées actuels. `TrophyCard.module` s'étend à `"programme" | "dos" | "tracking"`.

## Déploiement

- `scripts/db-migrate.ts` : boucle sur la liste des fichiers DB configurés (dérivés de `MATHIS_EMAIL`/`CLEMENT_EMAIL` ou d'une liste statique de slugs) au lieu d'un chemin unique, applique les migrations sur chacun.
- `deploy/sportcompanion.service` : remplace `Environment=DB_PATH=...` en dur par `EnvironmentFile=-/home/ubuntu/sportcompanion/.env` (le `-` en préfixe rend le fichier optionnel). Ce fichier est créé une seule fois à la main sur la VM (`MATHIS_EMAIL=...`, `CLEMENT_EMAIL=...`) — jamais synchronisé par `deploy.sh`, qui exclut déjà `.env*` du `rsync`.
- Étape manuelle unique, hors automatisation possible (pas de token API Cloudflare, déjà documenté dans `DEPLOYMENT.md`) : ajouter l'email de Clément à la policy Access de `workout.spiritix.fr` dans le dashboard Cloudflare Zero Trust.
- `DEPLOYMENT.md` mis à jour pour documenter le fichier `.env` sur la VM et l'ajout de la policy Access — pas de duplication du détail ici.

## Tests

- `currentUser()` : header absent (fallback Mathis), header reconnu (Mathis, Clément), header inconnu (erreur).
- `getDbForUser()` : deux appels avec des utilisateurs différents retournent deux connexions distinctes vers deux fichiers distincts ; deux appels avec le même utilisateur retournent la même connexion en cache (pas de réouverture).
- Runner de migrations : déjà testé idempotent (`migrations/*.test.ts`) — vérifier qu'il s'applique correctement sur un second fichier DB vierge.
- `computeTrophies` : cas avec des lignes `tracking_sets_logged`, vérifie le cumul et l'absence d'effet sur les totaux Programme/Dos existants.
- Actions Tracking : ajout d'exercice (nouveau vs existant, autocomplete), ajout de série (écriture incrémentale immédiate), reprise d'une séance non terminée.
- Garde de route : accès direct à `/dos` en tant que Clément et à `/tracking` en tant que Mathis → redirection.

## Suite

Ce sous-projet touche à la fois la couche données (nouvelles tables, refactor du client DB), la nav (garde de route par utilisateur) et un nouvel écran produit (Tracking) — assez contenu pour un seul plan d'implémentation, pas de découpage supplémentaire nécessaire.
