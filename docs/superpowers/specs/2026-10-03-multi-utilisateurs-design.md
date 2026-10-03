# Multi-utilisateurs générique — design

Chantier 4 de la refonte V1. Validé en conversation le 2026-10-03.

## Objectif

Toute personne dont l'email est autorisé dans Cloudflare Access a son espace personnel, créé à son premier accès. Plus aucun utilisateur codé en dur. Les données Programme de Mathis et Clément sont conservées à l'identique.

## Décisions

| Sujet | Décision |
|---|---|
| Liste blanche | Cloudflare Access uniquement. Rien à configurer côté app pour ajouter quelqu'un. |
| Stockage | Un fichier SQLite par email : `<DATA_DIR>/users/<email>.db`. Code métier inchangé. |
| Identité en prod | Email lu dans le JWT `Cf-Access-Jwt-Assertion`, vérifié (signature, `aud`, `iss`, `exp`) via `jose`, clés publiques `https://<team>/cdn-cgi/access/certs` mises en cache. |
| Déploiement progressif | Si `CF_ACCESS_TEAM_DOMAIN` ou `CF_ACCESS_AUD` absent en prod : repli sur le header `Cf-Access-Authenticated-User-Email` (comportement actuel), avec un avertissement unique dans les logs. |
| Pas d'identité valide | Redirection vers `/acces-refuse` (page statique, hors auth). Fin du repli « pas de header = Mathis ». |
| Dev local | `DEV_FORCE_USER_EMAIL` (hors production uniquement) remplace `DEV_FORCE_USER_SLUG`. |
| Prénom | Table `user_profile` (migration 0015). Sans prénom → écran plein « Comment tu t'appelles ? » avant tout écran du shell. Modifiable dans Réglages. Mathis et Clément pré-remplis, ne voient pas l'écran. |
| Admin | Aucun. |

## Identité — `src/lib/auth/`

- `normalizeEmail(raw: string): string | null` — trim + minuscules ; accepte uniquement `^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$` ; sinon `null`. Garantit qu'un email ne peut produire ni `/`, ni `..`, ni caractère de contrôle dans un nom de fichier.
- `userDbPath(email: string): string` → `path.join(dataDir(), "users", email + ".db")` ; `dataDir()` = `process.env.DATA_DIR ?? path.join(process.cwd(), "data")`.
- `verifyAccessJwt(token, { teamDomain, aud }): Promise<string | null>` — renvoie l'email normalisé ou `null` (signature invalide, mauvaise audience/émetteur, expiré, pas de claim `email`).
- `resolveEmail(headers, env): Promise<string | null>` — logique pure de choix de la source (dev forcé / JWT / header), testable sans Next.
- `currentUser(): Promise<{ email: string; dbPath: string }>` — appelle `resolveEmail` ; `null` → `redirect("/acces-refuse")`.

## Stockage — `src/lib/db/client.ts`

`getDbForUser(user)` : ouvre (crée si besoin) le fichier, et **au premier accès de ce fichier par le process** applique `runMigrations(db, migrationsDir())`. `migrationsDir()` = `process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "migrations")`. Cache par chemin comme aujourd'hui.

`scripts/db-migrate.ts` : migre tous les `*.db` de `<DATA_DIR>/users/`.

## Reprise des données existantes — `scripts/adopt-legacy-dbs.ts`

Exécuté par `deploy.sh` avant `db:migrate`, idempotent. Pour chaque couple (fichier historique, variable d'email, prénom) :

| Fichier historique | Email | Prénom |
|---|---|---|
| `data/sportcompanion.db` | `MATHIS_EMAIL` | Mathis |
| `data/sportcompanion.clement.db` | `CLEMENT_EMAIL` | Clément |

1. Si l'email n'est pas défini ou le fichier historique absent → ignoré.
2. Si `users/<email>.db` existe déjà → ignoré (déjà repris).
3. Copie via l'API `backup` de better-sqlite3 (cohérente même en WAL) vers `users/<email>.db`. **L'original n'est ni déplacé ni modifié** : il reste comme sauvegarde.
4. Migrations appliquées sur la copie, prénom posé.
5. Vérification : `current_position`, nombre de `seances`, nombre et somme des `sets_logged`, nombre de `tracking_sets_logged` identiques entre original et copie ; sinon la copie est supprimée et le script échoue (le déploiement s'arrête).

## Prénom

- Migration `0015_user_profile.sql` : `user_profile (id INTEGER PRIMARY KEY CHECK (id = 1), prenom TEXT)` + ligne `id = 1, prenom NULL`.
- `src/lib/profile/db.ts` : `getPrenom(db): string | null`, `setPrenom(db, prenom): void` (trim, 1 à 40 caractères, sinon erreur).
- `src/lib/profile/actions.ts` : `setPrenomAction(prenom)`.
- `(shell)/layout.tsx` : lit le prénom ; `null` → rend `PrenomScreen` à la place de la nav et du contenu.
- `PrenomScreen` : champ texte, bouton « Continuer » (désactivé si vide), puis `router.refresh()`.
- Réglages : ligne « Prénom » éditable dans un groupe « Profil ».
- En-tête d'Aujourd'hui : « Salut <prénom>. ».

## Infra

- `deploy/deploy.sh` : copie `migrations/` dans `.next/standalone/migrations` ; lance `scripts/adopt-legacy-dbs.ts` avant `db:migrate`.
- `deploy/sportcompanion.service` : `DATA_DIR=/home/ubuntu/sportcompanion/data` remplace `DB_PATH`.
- `.env` VM : `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` à ajouter ; `MATHIS_EMAIL`/`CLEMENT_EMAIL` ne servent plus qu'au script de reprise.
- `DEPLOYMENT.md` et `CLAUDE.md` mis à jour : ajouter quelqu'un = l'autoriser dans Cloudflare Access.

## Suppressions

`UserSlug`, `knownUsers`, `UserProfile.label`/`slug`, `DEV_FORCE_USER_SLUG`, usage de `DB_PATH` dans l'app.

## Tests

- `normalizeEmail` : casse, espaces, refus de `../x@y.z`, `a/b@c.d`, chaîne vide, sans `@`.
- `verifyAccessJwt` avec une paire de clés générée dans le test (JWKS local) : valide → email ; mauvaise `aud` ; expiré ; signé par une autre clé ; sans `email` → `null`.
- `resolveEmail` : dev forcé ignoré en production ; JWT exigé quand les 2 variables sont posées (header seul refusé) ; repli header sinon ; rien → `null`.
- `getDbForUser` : un email jamais vu → fichier créé et migré (table `user_profile` présente).
- `adopt-legacy-dbs` : copie identique, original intact (même empreinte avant/après), deuxième exécution sans effet, email absent ignoré.
- Prénom : `setPrenom` refuse vide / > 40 ; `PrenomScreen` enregistre ; layout n'affiche plus l'écran une fois le prénom posé (relu depuis la DB).
