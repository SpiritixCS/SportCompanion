# DEPLOYMENT.md — Hébergement et déploiement

## État (2026-08-12)

L'ancienne app `backpain` (Next.js, thème sombre, ancienne implémentation) a été **décommissionnée** : service `backpain.service` arrêté/supprimé, dossier `/home/ubuntu/backpain/` supprimé (backup de sécurité conservé sur la VM dans `/home/ubuntu/backups/`, données considérées jetables — pas de séances réelles dedans). Le tunnel Cloudflare `cloudflared-backpain.service` a été **conservé tel quel** (pas d'API token pour le recréer proprement dans le dashboard) : il route toujours `workout.spiritix.fr` → `127.0.0.1:3001`. Le nouveau projet SportCompanion réutilise donc le même port 3001 et le même hostname, sans rien retoucher côté Cloudflare.

Nouveau dossier app : `/home/ubuntu/sportcompanion/`. Nouveau service : `sportcompanion.service` (voir `deploy/sportcompanion.service`). Déploiement via `deploy/deploy.sh` (rsync + build + restart systemd) depuis la racine du repo local.

## Prod actuelle


URL publique : **https://workout.spiritix.fr**, derrière Cloudflare Access (restreint au Gmail personnel de l'utilisateur — l'app elle-même n'a aucune authentification).

```
Internet
   │
   ▼
Cloudflare (DNS + Access + SSL/TLS)
   │
   ▼ tunnel chiffré
cloudflared-backpain.service (127.0.0.1, tunnel dédié)
   │
   ▼ HTTP local

```

VM Oracle Cloud partagée avec deux autres projets (Devis & Factures / PocketBase sur le port 8090, SelfPatrimoine sur le port 3000). SportCompanion vit dans son propre répertoire et ses propres services systemd, sans toucher aux deux autres.

---

## Accès à la VM

```bash
ssh -i ~/Desktop/Claude\ Code/ssh-key-2026-05-17.key ubuntu@158.178.213.227
```

| Paramètre | Valeur |
|---|---|
| IP publique | `158.178.213.227` |
| Utilisateur SSH | `ubuntu` |
| Clé SSH locale | `~/Desktop/Claude Code/ssh-key-2026-05-17.key` |
| Répertoire app | `/home/ubuntu/sportcompanion/` |
| Données | `/home/ubuntu/sportcompanion/data/sportcompanion.db` (SQLite, non écrasé par les déploiements) |

Aucun port applicatif n'est exposé publiquement (l'app écoute uniquement sur `127.0.0.1:3001`) : tout passe par le tunnel Cloudflare.

---


## Cloudflare Tunnel + Access

Créés manuellement dans le dashboard Cloudflare (Zero Trust → Networks → Tunnels), pas de token API disponible en local pour automatiser cette partie.

- Tunnel dédié (nom `backpain`), token embarqué dans `cloudflared-backpain.service` — même schéma que `cloudflared-selfpatrimoine.service` déjà en place pour l'autre projet.
- Public Hostname : `workout` / `spiritix.fr` → `http://localhost:3001`.
- Access Application (Zero Trust → Access → Applications) : domaine `workout.spiritix.fr`, policy Allow → Include → Email → Gmail personnel de l'utilisateur.

Toute modification future du nom d'hôte ou de la policy Access se fait dans le dashboard Cloudflare — pas d'automatisation possible sans token API. Le tunnel garde le nom `backpain` en interne (service `cloudflared-backpain.service`) : renommer casserait le routing sans gain, laissé tel quel volontairement.

---

## Multi-utilisateur

**Ajouter quelqu'un = l'autoriser dans Cloudflare Access**, rien d'autre : Zero Trust → Access → Applications → `workout.spiritix.fr` → policy Allow → ajouter son email. À son premier passage, l'app crée et migre son fichier `data/users/<email>.db` et lui demande son prénom.

Identité (`src/lib/auth/`) : email lu dans le jeton signé `Cf-Access-Jwt-Assertion`, vérifié (signature, audience, émetteur, expiration). Tant que les deux variables ci-dessous ne sont pas dans `.env`, repli sur le header `Cf-Access-Authenticated-User-Email` (avertissement dans les logs). Sans identité valide → page `/acces-refuse`.

`/home/ubuntu/sportcompanion/.env` (jamais touché par `deploy.sh`, `sudo systemctl restart sportcompanion` après toute modification) :

```
CF_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com
CF_ACCESS_AUD=<Application Audience (AUD) Tag de workout.spiritix.fr>
MATHIS_EMAIL=<gmail perso de Mathis>
CLEMENT_EMAIL=<email de Clément>
```

`MATHIS_EMAIL` / `CLEMENT_EMAIL` ne servent plus qu'à `npm run db:adopt-legacy` (lancé par `deploy.sh`) : reprise unique des bases v0.1 `data/sportcompanion.db` et `data/sportcompanion.clement.db` vers `data/users/<email>.db`. **Les deux fichiers v0.1 restent en place, jamais modifiés** — sauvegarde ; une copie déjà reprise n'est jamais écrasée.

Le service lit `DATA_DIR` (dossier `data/`) et `MIGRATIONS_DIR` (`.next/standalone/migrations`, copié par `deploy.sh`) : un nouvel utilisateur est migré à son premier accès sans redéploiement.

---

## Déployer

Depuis la racine du repo local :

```bash
./deploy/deploy.sh
```

Le script (`deploy/deploy.sh`) : rsync du code (hors `node_modules`, `.next`, `data`, `.git`) vers `/home/ubuntu/sportcompanion/`, `npm ci && npm run build` sur la VM, puis pousse `deploy/sportcompanion.service` et redémarre le service systemd. Le dossier `data/` (DB SQLite) n'est jamais touché par le sync — persistant entre déploiements.

Prérequis : `next.config.ts` doit avoir `output: "standalone"` (le service pointe sur `.next/standalone/server.js`).

---