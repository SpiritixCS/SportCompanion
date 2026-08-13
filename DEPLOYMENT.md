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

## Multi-utilisateur (Mathis + Clément)

L'app distingue les deux comptes via le header `Cf-Access-Authenticated-User-Email` que Cloudflare Access injecte (voir `src/lib/auth/currentUser.ts`). Deux étapes manuelles, à faire une fois, ni l'une ni l'autre automatisable depuis ce repo :

1. **Policy Access** : dans le dashboard Cloudflare (Zero Trust → Access → Applications → `workout.spiritix.fr`), ajouter l'email de Clément à la policy Allow existante (à côté du Gmail personnel de Mathis).
2. **Variables d'environnement sur la VM** : créer `/home/ubuntu/sportcompanion/.env` (n'existe pas encore, jamais touché par `deploy.sh` qui exclut `.env*` du `rsync`) avec :

   ```
   MATHIS_EMAIL=<gmail perso de Mathis>
   CLEMENT_EMAIL=<email de Clément>
   ```

   Sans ce fichier, tout le trafic authentifié par Access échoue avec « Accès non reconnu » — les emails du header ne correspondent à aucun utilisateur connu tant que ces deux variables ne sont pas posées.

Clément a son propre fichier SQLite, `data/sportcompanion.clement.db`, créé automatiquement au prochain `npm run db:migrate` (le script boucle maintenant sur tous les utilisateurs connus, voir `scripts/db-migrate.ts`). Le fichier de Mathis (`data/sportcompanion.db`) est inchangé.

---

## Déployer

Depuis la racine du repo local :

```bash
./deploy/deploy.sh
```

Le script (`deploy/deploy.sh`) : rsync du code (hors `node_modules`, `.next`, `data`, `.git`) vers `/home/ubuntu/sportcompanion/`, `npm ci && npm run build` sur la VM, puis pousse `deploy/sportcompanion.service` et redémarre le service systemd. Le dossier `data/` (DB SQLite) n'est jamais touché par le sync — persistant entre déploiements.

Prérequis : `next.config.ts` doit avoir `output: "standalone"` (le service pointe sur `.next/standalone/server.js`).

---