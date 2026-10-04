# CLAUDE.md — SportCompanion

Contexte permanent du projet. À lire au début de chaque session.

---

## 0. Priorités — non négociables

1. **Fidélité au design « Agrès » (§4) : c'est un objectif à atteindre, pas une inspiration.** Tokens, typo, rayons, sept traits, navigation : tout correspond aux maquettes `design/v1/*.html` et à la spec `docs/superpowers/specs/2026-10-04-refonte-graphique-design.md`. En cas de doute sur un détail, relire la maquette avant d'improviser. Mathis préfère le sobre : une animation par élément, pas d'effets empilés.
2. **Fidélité au programme (données exactes de `workout_curated.json`) et facilité d'usage.** Le contenu du programme ne se négocie pas ; l'UX doit rester simple d'une main, en séance.

---

## 1. Ce qu'est ce projet

Une web app personnelle de suivi d'entraînement, à l'origine pensée pour **utilisateur unique** (Mathis). Elle sert maintenant **quelques proches** : toute personne dont l'email est autorisé dans Cloudflare Access obtient son espace personnel au premier accès — un fichier SQLite par email (`data/users/<email>.db`), identité tirée du JWT Cloudflare Access, vérifié quand `CF_ACCESS_TEAM_DOMAIN` et `CF_ACCESS_AUD` sont posés, sinon lue dans l'en-tête email (voir `src/lib/auth/resolveEmail.ts` et `DEPLOYMENT.md`). Pas d'inscription, pas de compte à créer côté app, pas d'admin : la liste blanche, c'est Cloudflare Access. Chacun ne voit que ses données.

Deux modules, ouverts à chaque utilisateur :

- **Programme (force)** — Caliathletics, trois parcours au poids du corps (Débutant / Intermédiaire / Advanced), récupérés depuis un site payant qui va fermer. L'app **sert** ce programme sans le réinventer.
- **Tracking** — programme personnel sur 7 jours, composé par l'utilisateur.

Le module **Dos (BackPain)** de la v0.1 a été retiré le 2026-10-03 (refonte V1, aucune donnée réelle) ; récupérable via l'historique git si besoin.

Le liant entre les deux : une page **Trophées** qui cumule les répétitions all-time par exercice, tous programmes confondus.

---

## 2. Historique — pourquoi ce projet existe sous cette forme

- Mathis a payé un temps un abonnement Caliathletics. Le site ferme bientôt : il a sauvegardé toutes les pages HTML (`Caliathletics/caliathletics_backup/{beginner,intermediate,advanced}/`) et écrit des outils pour en extraire le programme (§7).
- Une **v1 existait déjà**, déployée en prod sur la VM Oracle sous le nom `backpain` : Next.js 16 / React 19 / SQLite, thème sombre, avec son propre CLAUDE.md, des migrations SQL, des tests. Elle couvrait déjà le protocole dos ET un onglet Workout Caliathletics.
- **Décommissionnée le 2026-08-12** à la demande explicite de Mathis : repartir de zéro avec le nouveau design (§4), l'ancienne base de données ne contenait pas de séances réelles (jetable). Détails de la décommission dans `DEPLOYMENT.md`.
- **Leçon à retenir de la v1**, explicitement identifiée comme *le* bug qui a motivé la réécriture : changer d'écran reconstruisait un état vierge au lieu de relire l'état enregistré — une séance déjà loggée réapparaissait comme non faite. **L'état affiché doit toujours être lu depuis la source de vérité (DB), jamais reconstruit côté client.** À tester explicitement (enregistrer → naviguer ailleurs → revenir → vérifier que l'état est intact).

---

## 3. Stack et décisions techniques

| Décision | Choix | Pourquoi |
|---|---|---|
| Type d'app | Web app (pas de natif) | Pas de compte Apple Developer payant → une app iOS native homemade expire tous les 7 jours sans rebuild. Une web app n'a aucune de ces contraintes. |
| Framework | Next.js (App Router), TypeScript, React | Full-stack en un seul projet, un seul process à déployer. Repris du pattern v1, déjà éprouvé sur cette même VM. |
| Base de données | SQLite (`better-sqlite3`), un fichier par utilisateur | Volume minuscule, cloisonnement physique des données. Postgres serait de la sur-ingénierie. Pattern repris de la v1. |
| Build de prod | `output: "standalone"` dans `next.config.ts` | Le service systemd pointe sur `.next/standalone/server.js` (voir `DEPLOYMENT.md`). |
| Hébergement | VM Oracle Cloud perso, systemd + tunnel Cloudflare existant | Détails complets, accès SSH, script de déploiement : `DEPLOYMENT.md`. Ne pas dupliquer cette info ici. |
| Auth | Déléguée à Cloudflare Access en amont ; l'app tire l'email du JWT Access (signature vérifiée si `CF_ACCESS_*` est configuré, sinon en-tête email) | Pas de session ni de mot de passe à gérer côté Next.js. |
| Appareils cibles | iPhone 17 et MacBook Pro 16, **Chrome** sur les deux | Voir contrainte Chrome iOS ci-dessous. |
| Langue | Français partout — UI et code commenté en français si commentaire nécessaire | Cohérent avec `Objective.md`. |

### Contrainte Chrome iOS — importante, ne pas la perdre de vue

Chrome sur iOS est un wrapper WebKit : **pas d'installation PWA sur l'écran d'accueil, pas de notifications push background** via Chrome iOS (seul Safari a ce pouvoir sur iOS). Conséquences concrètes pour le player de séance :

- Le timer de repos doit tourner **tant que l'onglet reste actif** ; utiliser la Wake Lock API pour empêcher le verrouillage d'écran pendant une séance.
- Ne pas concevoir de fonctionnalité qui suppose une notification background (ex. rappel de fin de repos si l'app est en arrière-plan) — ça ne marchera pas dans ce contexte.
- Sur MacBook Pro (Chrome desktop), l'installation PWA fonctionne normalement, aucune restriction.

---

## 4. Design

Système visuel « Agrès » (refonte V1). Sources de vérité :

- `design/v1/{aujourdhui,programme,seance,trophees,tracking,pictos}.html` — maquettes validées par Mathis, une par page.
- `docs/superpowers/specs/2026-10-04-refonte-graphique-design.md` — spec : tokens, composants partagés, mouvement, repos par exercice.

Le brief et le prototype Claude Design d'origine (`design/uploads/claude.md`, `design/Suivi Entrainement.dc.html`, `design/support.js`) restent pour l'historique ; ils ne font plus référence.

### Direction artistique

**Sobre, chiffres en grand.** Fond aluminium, cartes blanches, les nombres (jour, objectif, total, minuteur) sont l'élément le plus visible de chaque écran. Seul l'écran de repos est sombre, pour ne jamais se confondre avec l'exercice. Pas d'ornement, pas de dégradé décoratif, pas de glassmorphism.

**La couleur encode le module** — c'est le principe structurant de toute l'app :

- Programme (force) → **indigo** (`cobalt`)
- Tracking (programme personnel) → **jade** (`sage`)
- Trophées (accompli, cumulé) → **or** (`brass`), réservé aux paliers
- Le reste de l'interface est neutre en toute circonstance. L'onglet actif dans la nav ne prend jamais la couleur d'accent.

### Tokens

```
--canvas       #EDEFF2   fond d'écran (aluminium)
--paper        #FFFFFF   cartes, feuilles
--ink          #0B0D12   texte, nav, bouton principal neutre, fond du repos
--graphite     #626B78   texte secondaire, étiquettes
--hairline     #D9DEE5   filets, traits « à venir »
--cobalt       #2F2BFF   Programme (+ cobalt-soft #E6E5FF)
--sage         #0F9D74   Tracking (+ sage-soft #DDF3EC, sage-ink #0A5E47, sage-strong #08805F pour le petit texte)
--brass        #C8961E   Trophées, paliers (+ brass-soft #F6EDD8, brass-ink #8A6410 pour le petit texte)
--alert        #B3402E   uniquement destructif (réinitialiser, abandonner)
--rest-surface #1A1E28   boutons et cartes de l'écran de repos (+ rest-line #232733, mist #9AA2AE)
```

Valeurs dans `src/app/globals.css` (`@theme`) : c'est le fichier qui fait foi.

Interdits explicites : crème #F4F1EA, terracotta #D97757, vert acide sur fond noir, dégradés violets.

### Typographie

- **Big Shoulders** (`font-display`, 700/800) — titres en capitales et tous les chiffres.
- **Instrument Sans** (`font-body`) — noms d'exercices, paragraphes, boutons.
- **IBM Plex Mono** (`font-mono`) — eyebrows en capitales espacées (0,14 em), méta.
- Chiffres en `tabular-nums` partout où ils changent en direct. Échelle : 11 → 64 px, puis 112 px (objectif, total Trophées) et 120 px (minuteur de repos).

### Formes

Rayon 22–28 px (cartes, `--radius-card: 24px`) / 14px (champs) / 999px (pilules, nav). Pas d'ombre portée diffuse — les cartes se distinguent par contraste `--paper`/`--canvas` + filet `--hairline` 1px. Seule exception : la barre d'action fixe en bas de la vue séance. Grille d'espacement de 4. Cibles tactiles ≥ 44px (56px pour les actions primaires).

### L'élément signature : les sept traits

Chaque niveau = **sept traits** (`SeptTraits`, un trait par jour). États : fait (plein accent), aujourd'hui (accent pâle + flèche dessous), à venir (gris), sauté (gris), repos (trait fin gris). Jamais de heatmap façon GitHub, jamais de dégradé d'intensité — état binaire lisible.

### Navigation

Pilule `ink` flottante en bas, **4 entrées** : `Aujourd'hui` / `Programme` / `Tracking` / `Trophées`. Réglages accessibles par icône dans l'en-tête d'Aujourd'hui, pas un 5ᵉ onglet. Le **mode séance est plein écran**, sans barre d'onglets — sortie par croix avec confirmation si séance entamée. Desktop (≥1024px) : colonne centrée 520px max, même pilule en rail vertical à gauche.

### Mouvement

Liste fermée (détail dans la spec § Mouvement) : entrée des cartes, étirement des traits, compteurs 0 → valeur (600 ms), feuilles qui montent, pastille de nav qui glisse, bouton qui se remplit (420 ms), glissement entre exercices (240 ms), cercle du minuteur qui se vide, battement des 3 dernières secondes, point du bandeau de reprise. Une animation par élément ; `prefers-reduced-motion` respecté partout (état final immédiat).

### Ton et écriture

Français, tutoiement, verbes actifs, zéro jargon technique. « Repos » pas « Rest », « Palier » pas « level », « Trophées » pas « Achievements », « 3 séries de 12 » à l'écrit / « 3 × 12 » en chiffres. **L'app constate, elle n'encourage pas** — pas de « Bravo champion », pas de coaching motivationnel, pas de points d'exclamation en cascade. La satisfaction vient des chiffres.

### Anti-patterns — ne pas produire

Cartes de métriques inventées (calories, VO2 max, « score de forme »), fil d'actualité / amis / classements / badges à partager, ombres portées diffuses, icônes multicolores dans les réglages, onboarding en plusieurs écrans, mode sombre hors écran de repos, gamification culpabilisante (un jour manqué n'est pas un échec).

### États obligatoires

Pour chaque écran : normal, vide, chargement (squelettes aux dimensions exactes, jamais de spinner centré), erreur (ce qui s'est passé + bouton Réessayer). Séance interrompue → reprise proposée, jamais de perte silencieuse.

---

## 5. Modèle du domaine

### Axe Programme (Caliathletics)

Trois parcours indépendants :

| Parcours | Niveaux | Jours/niveau | Total |
|---|---|---|---|
| Débutant | 8 | 7 | 56 jours |
| Intermédiaire | 8 | 7 | 56 jours |
| Advanced | 4 | 7 | 28 jours |

**Source de données** : `Caliathletics/workout_curated.json`, structure `{ parcours: [ [jour, jour, ...×7]  ×N niveaux ] }`. Chaque jour : `{ kind: "train"|"rest", label, exercises: [{ id, name, movementFamily, countsInStats, videoId, sets, target: { unit, value, maxEffort, eachSide } }] }`. `countsInStats` détermine si l'exercice entre dans le cumul Trophées. Données déjà curées et vérifiées cohérentes avec le volume attendu (56/56/28).

**Pipeline de génération** (dans `Caliathletics/`, tourné une fois, pas à relancer sauf changement de source) :
1. `Parser.py` — extrait le programme brut depuis `caliathletics_backup/*.html` → `workout_raw.json`
2. `curate_workout.py` — normalise noms, classe famille de mouvement + `countsInStats`, parse les cibles → `workout_curated.json` (relecture humaine possible via `workout_curation_review.csv`)
3. `generate_data_ts.py` — génère `src/lib/workout/data.ts` depuis `workout_curated.json` (module de données versionné, séparé de la logique applicative — convention héritée de la v1, à conserver)
4. `download_thumbnails.py` — télécharge les vignettes d'exercices vers `public/exercises/{id}.jpg`

**Point de départ** : l'utilisateur choisit parcours + niveau + jour au premier lancement (flux 3 écrans, voir brief design §4.2). La progression avance **au rythme des séances validées par l'utilisateur, jamais au calendrier** — un jour non fait reste affiché tant qu'il n'est pas validé.

**Montée de niveau** : proposée seulement après **7 jours validés** du niveau courant (pas 7 jours écoulés). **Jamais d'avancement automatique** — l'app propose un choix explicite (monter au niveau suivant / refaire ce niveau une semaine de plus), l'utilisateur tranche. Refaire un niveau doit être aussi simple que monter : pas de friction, pas de sentiment d'échec (cohérent avec le ton §4 — l'app constate, elle n'encourage pas).

### Axe Tracking

Programme personnel sur 7 jours fixes (Lundi→Dimanche), ouvert à tous les utilisateurs. Chacun compose ses jours (exercices en saisie libre, autocomplétion depuis son historique, ou repos) et les joue dans le même player que le Programme — logique dans `src/lib/tracking/`. Ces séries alimentent le cumul Trophées au même titre que le reste.

### Trophées

Cumul all-time des répétitions par exercice (`countsInStats: true` uniquement pour l'axe Programme), tous programmes confondus, par utilisateur. Incrémenté à la validation de chaque séance. Paliers : 100 / 500 / 1000 / 5000 / 10000 / 25000 répétitions, marque laiton sobre au franchissement.

---

## 6. Le player de séance — l'écran le plus important

Décrit dans `Objective.md`, flux exact attendu :

1. Depuis Aujourd'hui, bouton **Commencer la séance** → lance l'exercice 1.
2. L'utilisateur valide le nombre de reps de la série → **timer de repos auto** (1min30 par défaut, réglable) se lance seul.
3. À la fin du repos → série suivante du même exercice s'ouvre automatiquement. Un exercice en 4×10 = 4 interactions de validation, avec repos entre chaque série.
4. Une fois toutes les séries de l'exercice faites → passage automatique à l'exercice suivant, avec repos cohérent entre exercices (temps distinct du repos inter-séries, voir brief design §4.4).
5. Séance terminée → écran récapitulatif : total par exercice (4×10 tractions → 40 tractions affiché), durée, nombre d'exercices.
6. Bouton pour **valider la séance** → séance loggée en DB (incrémente Trophées, marque le jour comme fait dans la grille de progression).

Reprise possible si la séance est quittée en cours (bandeau « Reprendre la séance » sur Aujourd'hui). Le mode repos ne doit jamais se confondre visuellement avec le mode exercice (voir §4 design).

---

## 7. Conventions de travail

- **Git** : commits atomiques, messages en français, à l'impératif. Branches de fonctionnalité, `main` toujours déployable.
- Les données de programme (`data.ts` généré) vivent dans un module dédié, séparées de la logique applicative — jamais dupliquées ailleurs dans le code.
- La logique de progression (montée de niveau, durée active de séance) est **pure et testée unitairement** — c'est le cœur du produit, un bug ici fausse des mois de suivi.
- Test d'intégration obligatoire sur la persistance du player : enregistrer une série, naviguer ailleurs, revenir, vérifier que l'état est intact (cf. le bug de la v1, §2).
- Migrations de schéma SQL versionnées (`migrations/NNNN_nom.sql`, une par changement, testée), avec sauvegarde avant application (faite par `deploy/deploy.sh`).

---

## 8. Déploiement

Tout est dans **`DEPLOYMENT.md`** : accès VM, architecture Cloudflare Tunnel + Access, script `deploy/deploy.sh`, unité systemd `deploy/sportcompanion.service`. Ne pas dupliquer ce contenu ici — le consulter avant toute question d'infra ou de mise en prod.

---

## 9. Fichiers clés du repo

```
Objective.md                          objectif produit d'origine (source brute)
DEPLOYMENT.md                         infra, accès VM, script de déploiement
deploy/                               deploy.sh + unité systemd
design/v1/                            maquettes « Agrès » validées (§4) — source de vérité visuelle
design/                               brief + prototype Claude Design d'origine (historique)
  uploads/claude.md                   brief complet
  Suivi Entrainement.dc.html          prototype visuel (canvas sc-if/sc-for)
  support.js                          runtime requis pour ouvrir le .dc.html
Caliathletics/
  caliathletics_backup/               HTML sauvegardé du site original (3 parcours)
  workout_raw.json                    extraction brute (Parser.py)
  workout_curated.json                données curées, prêtes à l'emploi
  workout_curation_review.csv         relecture humaine de la curation
  Parser.py / curate_workout.py       pipeline d'extraction (déjà tourné)
  generate_data_ts.py                 génère src/lib/workout/data.ts
  download_thumbnails.py              vignettes d'exercices → public/exercises/
```

Code applicatif : `src/app/` (routes Next.js), `src/components/` (écrans et composants partagés), `src/lib/` (domaine, DB, auth), `migrations/` (schéma SQL), `docs/superpowers/` (specs et plans).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
