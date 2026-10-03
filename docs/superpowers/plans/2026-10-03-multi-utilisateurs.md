# Multi-utilisateurs générique — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tout email autorisé par Cloudflare Access obtient son propre fichier SQLite au premier accès, identifié par le JWT Cloudflare vérifié ; prénom demandé une fois ; données de Mathis et Clément reprises à l'identique.

**Architecture:** `src/lib/auth/` résout un email (dev forcé / JWT / header) puis un chemin `<DATA_DIR>/users/<email>.db` ; `getDbForUser` migre un fichier au premier accès. Un script idempotent copie les deux bases historiques vers leur nouveau nom. Une table `user_profile` porte le prénom, exigé par le layout du shell.

**Tech Stack:** Next.js App Router, better-sqlite3, `jose` (nouvelle dépendance), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-03-multi-utilisateurs-design.md`

## Global Constraints

- Regex email acceptée : `^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$` après trim + minuscules.
- Variables : `DATA_DIR`, `MIGRATIONS_DIR`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `DEV_FORCE_USER_EMAIL` (hors production seulement).
- JWT : `iss = https://<CF_ACCESS_TEAM_DOMAIN>`, `aud = CF_ACCESS_AUD`, JWKS `https://<CF_ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`.
- Prénom : trim, 1 à 40 caractères.
- Les fichiers historiques `data/sportcompanion.db` et `data/sportcompanion.clement.db` ne sont jamais modifiés ni déplacés.
- Textes UI : français, tutoiement, pas d'encouragement.

## Review Focus

- Email avec `../` ou `/` dans l'en-tête → jamais de chemin hors `users/` (test Task 1).
- Prod avec variables CF posées mais requête portant seulement le header email (forgé) → refus (test Task 3).
- Nouvel utilisateur en prod standalone → fichier migré au premier accès (dépend de `MIGRATIONS_DIR` / copie dans deploy.sh, Task 4 + Task 7).
- Script de reprise rejoué au déploiement suivant → aucun écrasement de la copie déjà utilisée (test Task 6).
- Prénom enregistré puis rechargement → l'écran ne revient pas, relu en DB (test Task 5).

---

### Task 1: Email normalisé et chemin de fichier

**Files:** Create `src/lib/auth/email.ts`, `src/lib/auth/email.test.ts`

**Produces:** `normalizeEmail(raw: string | null | undefined): string | null`, `dataDir(): string`, `userDbPath(email: string): string`

- [ ] Test :

```ts
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { normalizeEmail, userDbPath } from "./email";

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; });

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Mathis.F+x@Gmail.COM ")).toBe("mathis.f+x@gmail.com");
  });
  it.each(["", "abc", "../x@y.zz", "a/b@c.dd", "a@b", "a@b.c", "a b@c.dd", "a@b.dd\n"])("rejects %j", (raw) => {
    expect(normalizeEmail(raw)).toBeNull();
  });
  it("rejects null and undefined", () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe("userDbPath", () => {
  it("places the file under <DATA_DIR>/users", () => {
    process.env.DATA_DIR = "/srv/data";
    expect(userDbPath("a@b.fr")).toBe(path.join("/srv/data", "users", "a@b.fr.db"));
  });
  it("defaults DATA_DIR to <cwd>/data", () => {
    delete process.env.DATA_DIR;
    expect(userDbPath("a@b.fr")).toBe(path.join(process.cwd(), "data", "users", "a@b.fr.db"));
  });
});
```

Note : `"a@b.dd\n"` — `trim()` retire le `\n` ; remplacer ce cas par `"a@b.dd\u0000"` si le test passe pour cette raison.

- [ ] Implémentation :

```ts
import path from "node:path";

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

// Un email devient un nom de fichier : la regex exclut « / », « \ » et tout
// caractère de contrôle, et « .. » ne peut pas former un segment de chemin
// puisque le nom contient toujours « @ ».
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

export function dataDir(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

export function userDbPath(email: string): string {
  return path.join(dataDir(), "users", `${email}.db`);
}
```

- [ ] `npx vitest run src/lib/auth/email.test.ts` → PASS. Commit `feat(auth): normalise l'email et dérive le fichier SQLite de l'utilisateur`.

---

### Task 2: Vérification du JWT Cloudflare Access

**Files:** `npm install jose` ; Create `src/lib/auth/accessJwt.ts`, `src/lib/auth/accessJwt.test.ts`

**Produces:** `verifyAccessJwt(token: string, opts: { teamDomain: string; aud: string; jwks?: JWTVerifyGetKey }): Promise<string | null>`

- [ ] Test (clé générée localement, JWKS injecté) :

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet, type JWTVerifyGetKey } from "jose";
import { verifyAccessJwt } from "./accessJwt";

const TEAM = "team.cloudflareaccess.com";
const AUD = "aud-tag";
let priv: CryptoKey;
let otherPriv: CryptoKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  priv = pair.privateKey;
  otherPriv = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

function sign(claims: Record<string, unknown>, key = priv, exp = "5m") {
  return new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(`https://${TEAM}`)
    .setAudience(AUD).setIssuedAt().setExpirationTime(exp).sign(key);
}

describe("verifyAccessJwt", () => {
  it("returns the normalized email of a valid token", async () => {
    expect(await verifyAccessJwt(await sign({ email: "Mathis@Gmail.com" }), { teamDomain: TEAM, aud: AUD, jwks })).toBe("mathis@gmail.com");
  });
  it("rejects a wrong audience", async () => {
    expect(await verifyAccessJwt(await sign({ email: "a@b.fr" }), { teamDomain: TEAM, aud: "other", jwks })).toBeNull();
  });
  it("rejects an expired token", async () => {
    const t = await new SignJWT({ email: "a@b.fr" }).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(`https://${TEAM}`)
      .setAudience(AUD).setIssuedAt(Math.floor(Date.now() / 1000) - 3600).setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(priv);
    expect(await verifyAccessJwt(t, { teamDomain: TEAM, aud: AUD, jwks })).toBeNull();
  });
  it("rejects a token signed by another key", async () => {
    expect(await verifyAccessJwt(await sign({ email: "a@b.fr" }, otherPriv), { teamDomain: TEAM, aud: AUD, jwks })).toBeNull();
  });
  it("rejects a token without email", async () => {
    expect(await verifyAccessJwt(await sign({}), { teamDomain: TEAM, aud: AUD, jwks })).toBeNull();
  });
  it("rejects garbage", async () => {
    expect(await verifyAccessJwt("not.a.jwt", { teamDomain: TEAM, aud: AUD, jwks })).toBeNull();
  });
});
```

- [ ] Implémentation :

```ts
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { normalizeEmail } from "./email";

const remoteSets = new Map<string, JWTVerifyGetKey>();

function remoteJwks(teamDomain: string): JWTVerifyGetKey {
  let set = remoteSets.get(teamDomain);
  if (!set) {
    // jose met les clés en cache et les recharge à la rotation (kid inconnu).
    set = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    remoteSets.set(teamDomain, set);
  }
  return set;
}

export async function verifyAccessJwt(
  token: string,
  opts: { teamDomain: string; aud: string; jwks?: JWTVerifyGetKey },
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, opts.jwks ?? remoteJwks(opts.teamDomain), {
      issuer: `https://${opts.teamDomain}`,
      audience: opts.aud,
    });
    return normalizeEmail(typeof payload.email === "string" ? payload.email : null);
  } catch {
    return null;
  }
}
```

- [ ] `npx vitest run src/lib/auth/accessJwt.test.ts` → PASS (6). Commit `feat(auth): vérifie le jeton signé Cloudflare Access`.

---

### Task 3: `resolveEmail`, `currentUser`, page d'accès refusé

**Files:** Create `src/lib/auth/resolveEmail.ts` + test, `src/app/acces-refuse/page.tsx` ; Rewrite `src/lib/auth/currentUser.ts`, `currentUser.test.ts`, `currentUser.integration.test.ts` ; Delete `src/lib/auth/users.ts`, `users.test.ts` ; Modify `src/lib/settings/actions.test.ts`, `src/lib/programme/actions.test.ts`

**Consumes:** Task 1, Task 2. **Produces:** `resolveEmail(h: Headers | null, env: NodeJS.ProcessEnv, verify?: typeof verifyAccessJwt): Promise<string | null>` ; `currentUser(): Promise<{ email: string; dbPath: string }>`

- [ ] Test `resolveEmail.test.ts` (verify injecté, pas de réseau) :

```ts
import { describe, it, expect, vi } from "vitest";
import { resolveEmail } from "./resolveEmail";

const H = (o: Record<string, string>) => new Headers(o);
const verifyOk = vi.fn(async () => "jwt@user.fr");
const verifyKo = vi.fn(async () => null);
const CF = { CF_ACCESS_TEAM_DOMAIN: "t.cloudflareaccess.com", CF_ACCESS_AUD: "aud" };

describe("resolveEmail", () => {
  it("uses DEV_FORCE_USER_EMAIL outside production", async () => {
    expect(await resolveEmail(null, { NODE_ENV: "development", DEV_FORCE_USER_EMAIL: "Dev@X.fr" }, verifyKo)).toBe("dev@x.fr");
  });
  it("ignores DEV_FORCE_USER_EMAIL in production", async () => {
    expect(await resolveEmail(null, { NODE_ENV: "production", DEV_FORCE_USER_EMAIL: "dev@x.fr" }, verifyKo)).toBeNull();
  });
  it("requires a valid JWT when CF variables are set, ignoring a bare email header", async () => {
    const h = H({ "cf-access-authenticated-user-email": "forged@x.fr" });
    expect(await resolveEmail(h, { NODE_ENV: "production", ...CF }, verifyKo)).toBeNull();
  });
  it("returns the JWT email when valid", async () => {
    const h = H({ "cf-access-jwt-assertion": "tok" });
    expect(await resolveEmail(h, { NODE_ENV: "production", ...CF }, verifyOk)).toBe("jwt@user.fr");
    expect(verifyOk).toHaveBeenCalledWith("tok", { teamDomain: CF.CF_ACCESS_TEAM_DOMAIN, aud: CF.CF_ACCESS_AUD });
  });
  it("falls back to the email header when CF variables are missing", async () => {
    const h = H({ "cf-access-authenticated-user-email": "Mathis@Gmail.com" });
    expect(await resolveEmail(h, { NODE_ENV: "production" }, verifyKo)).toBe("mathis@gmail.com");
  });
  it("returns null with no identity at all", async () => {
    expect(await resolveEmail(H({}), { NODE_ENV: "production" }, verifyKo)).toBeNull();
    expect(await resolveEmail(null, { NODE_ENV: "development" }, verifyKo)).toBeNull();
  });
});
```

- [ ] Implémentation `resolveEmail.ts` :

```ts
import { normalizeEmail } from "./email";
import { verifyAccessJwt } from "./accessJwt";

let warnedNoJwt = false;

export async function resolveEmail(
  h: Headers | null,
  env: NodeJS.ProcessEnv,
  verify: typeof verifyAccessJwt = verifyAccessJwt,
): Promise<string | null> {
  if (env.NODE_ENV !== "production") {
    const forced = normalizeEmail(env.DEV_FORCE_USER_EMAIL);
    if (forced) return forced;
  }
  if (!h) return null;

  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN;
  const aud = env.CF_ACCESS_AUD;
  if (teamDomain && aud) {
    const token = h.get("cf-access-jwt-assertion");
    return token ? verify(token, { teamDomain, aud }) : null;
  }

  // Déploiement progressif : sans configuration JWT, on garde le header email
  // (l'app n'écoute que sur 127.0.0.1, seul le tunnel Cloudflare l'atteint).
  if (!warnedNoJwt && env.NODE_ENV === "production") {
    warnedNoJwt = true;
    console.warn("[auth] CF_ACCESS_TEAM_DOMAIN/CF_ACCESS_AUD absents : identité lue dans le header email, sans vérification de signature.");
  }
  return normalizeEmail(h.get("cf-access-authenticated-user-email"));
}
```

- [ ] `currentUser.ts` :

```ts
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveEmail } from "./resolveEmail";
import { userDbPath } from "./email";

export type CurrentUser = { email: string; dbPath: string };

export async function currentUser(): Promise<CurrentUser> {
  let h: Headers | null = null;
  try {
    h = await headers();
  } catch {
    // Hors requête (script, test sans mock) : seule l'identité forcée de dev s'applique.
    h = null;
  }
  const email = await resolveEmail(h, process.env);
  if (!email) redirect("/acces-refuse");
  return { email, dbPath: userDbPath(email) };
}
```

- [ ] `currentUser.test.ts` remplacé : mock `next/headers` et `next/navigation` (`redirect` lève une erreur `"REDIRECT:/acces-refuse"`) ; cas : header email (sans CF) → `{ email, dbPath }` sous `DATA_DIR/users` ; aucune identité → rejette avec `REDIRECT:/acces-refuse` ; `DEV_FORCE_USER_EMAIL` → cet utilisateur.
- [ ] `currentUser.integration.test.ts` remplacé : deux emails différents (header) → `getDbForUser` renvoie deux fichiers distincts sous `DATA_DIR/users`, une écriture dans l'un n'apparaît pas dans l'autre.
- [ ] `settings/actions.test.ts` et `programme/actions.test.ts` : remplacer `process.env.DB_PATH = dbPath` par `process.env.DATA_DIR = tmpDir; process.env.DEV_FORCE_USER_EMAIL = "test@example.com";` et `dbPath` par `userDbPath("test@example.com")` ; nettoyer ces deux variables dans l'`afterAll`.
- [ ] Supprimer `users.ts`, `users.test.ts` ; `grep -rn "knownUsers\|UserSlug\|DEV_FORCE_USER_SLUG\|\.label\b" src scripts` → corriger chaque usage (page Aujourd'hui : passer le prénom, Task 5 ; d'ici là `user.email`).
- [ ] `src/app/acces-refuse/page.tsx` (hors shell, sans auth) :

```tsx
export default function AccesRefusePage() {
  return (
    <main className="min-h-dvh flex flex-col justify-center p-5 max-w-[520px] mx-auto">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite">Accès</span>
      <h1 className="font-archivo text-32 font-semibold mt-3">Accès non autorisé</h1>
      <p className="text-15 text-graphite mt-3">
        Ton compte n&apos;a pas pu être identifié. Demande à Mathis d&apos;autoriser ton email, puis recharge la page.
      </p>
    </main>
  );
}
```

- [ ] `npx vitest run src/lib && npx tsc --noEmit` → PASS. Commit `feat(auth): identifie l'utilisateur par email, sans liste codée en dur`.

---

### Task 4: Fichier créé et migré au premier accès

**Files:** Modify `src/lib/db/client.ts`, `src/lib/db/client.test.ts`, `scripts/db-migrate.ts`

**Produces:** `migrationsDir(): string` ; `getDbForUser` migre au premier accès.

- [ ] Test (ajout `client.test.ts`) : `DATA_DIR` = tmp ; `getDbForUser({ email: "new@x.fr", dbPath: userDbPath("new@x.fr") })` → fichier existe, `SELECT name FROM sqlite_master WHERE name = 'seances'` trouvé ; second appel renvoie la même instance.
- [ ] Implémentation :

```ts
export function migrationsDir(): string {
  return process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "migrations");
}

export function getDbForUser(user: { dbPath: string }): Database.Database {
  let db = dbByPath.get(user.dbPath);
  if (!db) {
    db = getDb(user.dbPath);
    // Premier accès de ce fichier par le process : crée le schéma d'un nouvel
    // utilisateur, ou rattrape une migration déployée depuis.
    runMigrations(db, migrationsDir());
    dbByPath.set(user.dbPath, db);
  }
  return db;
}
```

- [ ] `scripts/db-migrate.ts` : boucle sur `readdirSync(path.join(dataDir(), "users")).filter(f => f.endsWith(".db"))` (dossier absent → aucun fichier), log `[<fichier>] …`.
- [ ] `npx vitest run src/lib/db` → PASS. Commit `feat(db): crée et migre le fichier d'un utilisateur à son premier accès`.

---

### Task 5: Prénom

**Files:** Create `migrations/0015_user_profile.sql` + test, `src/lib/profile/db.ts` + test, `src/lib/profile/actions.ts`, `src/components/profile/PrenomScreen.tsx` + test ; Modify `src/app/(shell)/layout.tsx`, `src/app/(shell)/page.tsx`, `src/components/settings/ReglagesScreen.tsx` + test, `src/lib/settings/actions.ts`

**Produces:** `getPrenom(db): string | null`, `setPrenom(db, prenom: string): void`, `setPrenomAction(prenom: string): Promise<void>`, `ReglagesState.prenom: string | null`

- [ ] Migration + test (table présente, ligne `id = 1`, `prenom` NULL) :

```sql
CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  prenom TEXT
);
INSERT INTO user_profile (id) VALUES (1);
```

- [ ] `profile/db.ts` + tests (null par défaut ; enregistre trimé ; refuse `""`, `"   "`, 41 caractères) :

```ts
export function getPrenom(db: Database.Database): string | null {
  const row = db.prepare(`SELECT prenom FROM user_profile WHERE id = 1`).get() as { prenom: string | null } | undefined;
  return row?.prenom ?? null;
}

export function setPrenom(db: Database.Database, prenom: string): void {
  const value = prenom.trim();
  if (value.length < 1 || value.length > 40) throw new Error("Prénom : 1 à 40 caractères.");
  db.prepare(`UPDATE user_profile SET prenom = ? WHERE id = 1`).run(value);
}
```

- [ ] `profile/actions.ts` : `"use server"`, `setPrenomAction(prenom)` → `setPrenom(getDbForUser(await currentUser()), prenom)`.
- [ ] `PrenomScreen` (client) + test : titre « Comment tu t'appelles ? », champ « Prénom », bouton « Continuer » désactivé si vide ; submit → `setPrenomAction(valeur)` puis `router.refresh()` ; erreur → « Impossible d'enregistrer. Réessaie. ».
- [ ] `(shell)/layout.tsx` redevient async : `const prenom = getPrenom(getDbForUser(await currentUser()));` ; `prenom === null` → `return <PrenomScreen />;` sinon rendu actuel.
- [ ] `(shell)/page.tsx` : `user={{ label: getPrenom(db) ?? "" }}`.
- [ ] Réglages : `ReglagesState.prenom` (via `getPrenom`) ; groupe « Profil » en tête avec ligne « Prénom » ; tap → `Sheet` avec champ + « Valider » → `setPrenomAction` puis relecture `getReglagesStateAction()`. Test : la ligne affiche le prénom ; édition appelle l'action.
- [ ] Test de persistance (CLAUDE.md §2) dans `profile/db.test.ts` : `setPrenom` puis nouvelle connexion au même fichier → `getPrenom` relu.
- [ ] `npx vitest run && npx tsc --noEmit` → PASS. Commit `feat(profil): demande le prénom au premier accès et le rend modifiable`.

---

### Task 6: Reprise des bases historiques

**Files:** Create `scripts/adopt-legacy-dbs.ts`, `src/lib/db/adoptLegacy.ts` + test ; Modify `package.json` (script `db:adopt-legacy`: `tsx scripts/adopt-legacy-dbs.ts`)

**Produces:** `adoptLegacyDb(opts: { legacyPath: string; email: string | undefined; prenom: string }): Promise<"adopted" | "skipped">`

- [ ] Tests (tmp `DATA_DIR`, base historique fabriquée via migrations 0001→0014 + données Programme + Tracking) :
  - copie → `users/<email>.db` existe, prénom posé, `current_position`, compte `seances`, compte/somme `sets_logged`, compte `tracking_sets_logged` identiques ;
  - original intact : sha256 du fichier identique avant/après ;
  - deuxième appel → `"skipped"`, la copie (modifiée entre-temps) n'est pas écrasée ;
  - email `undefined` ou invalide → `"skipped"` ; fichier historique absent → `"skipped"`.
- [ ] Implémentation :

```ts
import Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { normalizeEmail, userDbPath } from "@/lib/auth/email";
import { runMigrations } from "./migrate";
import { migrationsDir } from "./client";
import { setPrenom } from "@/lib/profile/db";

function fingerprint(db: Database.Database): string {
  const q = (sql: string) => JSON.stringify(db.prepare(sql).all());
  return [
    q(`SELECT parcours, level, day_index, cycle FROM current_position`),
    q(`SELECT COUNT(*) n FROM seances`),
    q(`SELECT COUNT(*) n, COALESCE(SUM(reps_actual), 0) s FROM sets_logged`),
    q(`SELECT COUNT(*) n FROM tracking_sets_logged`),
  ].join("|");
}

export async function adoptLegacyDb(opts: { legacyPath: string; email: string | undefined; prenom: string }): Promise<"adopted" | "skipped"> {
  const email = normalizeEmail(opts.email);
  if (!email || !existsSync(opts.legacyPath)) return "skipped";
  const target = userDbPath(email);
  if (existsSync(target)) return "skipped";

  mkdirSync(path.dirname(target), { recursive: true });
  const legacy = new Database(opts.legacyPath, { readonly: true });
  try {
    await legacy.backup(target);
    const copy = new Database(target);
    try {
      runMigrations(copy, migrationsDir());
      setPrenom(copy, opts.prenom);
      if (fingerprint(copy) !== fingerprint(legacy)) throw new Error(`Reprise de ${opts.legacyPath} : données différentes après copie.`);
    } finally {
      copy.close();
    }
  } catch (err) {
    rmSync(target, { force: true });
    throw err;
  } finally {
    legacy.close();
  }
  return "adopted";
}
```

Note : la base historique est déjà à jour des migrations ≤ 0014 en prod ; si elle ne l'était pas, `fingerprint` reste comparable car il ne lit que des tables existant depuis 0002/0010.

- [ ] `scripts/adopt-legacy-dbs.ts` : pour `[["sportcompanion.db", MATHIS_EMAIL, "Mathis"], ["sportcompanion.clement.db", CLEMENT_EMAIL, "Clément"]]` sous `dataDir()`, appelle `adoptLegacyDb`, log le résultat ; toute erreur → `process.exit(1)`.
- [ ] `npx vitest run src/lib/db` → PASS. Commit `feat(db): reprend les bases de Mathis et Clément sous leur email`.

---

### Task 7: Infra et documentation

**Files:** Modify `deploy/deploy.sh`, `deploy/sportcompanion.service`, `DEPLOYMENT.md`, `CLAUDE.md`, `.env.local` (non versionné)

- [ ] `deploy.sh` : avant `npm run db:migrate`, `npm run db:adopt-legacy` ; la boucle de sauvegarde couvre aussi `data/users/*.db` ; après le build, `cp -r migrations .next/standalone/migrations`.
- [ ] Service : remplacer `Environment=DB_PATH=...` par `Environment=DATA_DIR=/home/ubuntu/sportcompanion/data` et ajouter `Environment=MIGRATIONS_DIR=/home/ubuntu/sportcompanion/.next/standalone/migrations`.
- [ ] `DEPLOYMENT.md` : section multi-utilisateur réécrite (ajouter quelqu'un = Cloudflare Access ; `.env` : `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `MATHIS_EMAIL`/`CLEMENT_EMAIL` pour la reprise uniquement ; fichiers `data/users/<email>.db` ; originaux conservés).
- [ ] `CLAUDE.md` §1/§3 : utilisateurs autorisés via Cloudflare, un fichier par email, plus de « deux utilisateurs nommés ».
- [ ] `.env.local` : `DEV_FORCE_USER_SLUG=clement` → `DEV_FORCE_USER_EMAIL=<CLEMENT_EMAIL de ce fichier>`.
- [ ] Commit `docs: documente l'ajout d'utilisateurs via Cloudflare Access` (+ `chore(deploy): …` pour les scripts).

---

### Task 8: Vérification locale

- [ ] Copie fraîche des DB prod dans le scratchpad (`DATA_DIR` = ce dossier) ; `MATHIS_EMAIL=… CLEMENT_EMAIL=… npm run db:adopt-legacy` puis `npm run db:migrate` ; empreintes identiques ; originaux inchangés (sha256).
- [ ] `DEV_FORCE_USER_EMAIL=<email Mathis>` → Aujourd'hui « Salut Mathis. », progression intacte.
- [ ] `DEV_FORCE_USER_EMAIL=nouveau@exemple.fr` → écran prénom → Aujourd'hui « Premier jour » ; fichier `users/nouveau@exemple.fr.db` créé.
- [ ] Sans `DEV_FORCE_USER_EMAIL` → `/acces-refuse`.
- [ ] URL + checklist à Mathis.
