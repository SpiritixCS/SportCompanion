# CLAUDE.md — SportCompanion

Contexte permanent du projet. À lire au début de chaque session.

---

## 0. Priorités — non négociables

1. **Fidélité au design Claude Design (§4) : c'est un objectif à atteindre, pas une inspiration.** Les tokens, la typo, les espacements, la grille pastille signature, la navigation — tout doit correspondre au brief et au prototype `.dc.html`, pas une réinterprétation « dans l'esprit de ». En cas de doute sur un détail non couvert par le brief, aller relire le prototype avant d'improviser.
2. **Fidélité au programme (données exactes de `workout_curated.json` et `BackPainProgram.md`) et facilité d'usage.** Le contenu du programme ne se négocie pas ; l'UX doit rester simple d'une main, en séance.

---

## 1. Ce qu'est ce projet

Une web app personnelle de suivi d'entraînement, **utilisateur unique** (Mathis). Pas de produit, pas de multi-utilisateur, pas d'onboarding générique, pas d'abstraction « au cas où quelqu'un d'autre l'utiliserait ». Chaque décision est prise pour un seul usage réel.

Deux programmes déjà écrits et validés, que l'app **sert** sans les réinventer :

- **Programme (force)** — Caliathletics, trois parcours au poids du corps (Débutant / Intermédiaire / Advanced), récupérés depuis un site payant qui va fermer.
- **Dos (BackPain)** — protocole de rééducation lombaire 16 semaines, contexte clinique réel (lombalgie chronique, trouble du contrôle moteur). Logique complète dans `BackPainProgram.md`, à garder **telle quelle** — ne jamais modifier les valeurs du domaine sans que ça vienne explicitement de l'utilisateur.

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
| Base de données | SQLite (`better-sqlite3`), fichier unique | Volume minuscule (un utilisateur, quelques milliers de lignes). Postgres serait de la sur-ingénierie. Pattern repris de la v1. |
| Build de prod | `output: "standalone"` dans `next.config.ts` | Le service systemd pointe sur `.next/standalone/server.js` (voir `DEPLOYMENT.md`). |
| Hébergement | VM Oracle Cloud perso, systemd + tunnel Cloudflare existant | Détails complets, accès SSH, script de déploiement : `DEPLOYMENT.md`. Ne pas dupliquer cette info ici. |
| Auth | Aucune côté app — déléguée à Cloudflare Access en amont (Gmail perso) | App mono-utilisateur, pas de session à gérer côté Next.js. |
| Appareils cibles | iPhone 17 et MacBook Pro 16, **Chrome** sur les deux | Voir contrainte Chrome iOS ci-dessous. |
| Langue | Français partout — UI et code commenté en français si commentaire nécessaire | Cohérent avec `Objective.md` et `BackPainProgram.md`. |

### Contrainte Chrome iOS — importante, ne pas la perdre de vue

Chrome sur iOS est un wrapper WebKit : **pas d'installation PWA sur l'écran d'accueil, pas de notifications push background** via Chrome iOS (seul Safari a ce pouvoir sur iOS). Conséquences concrètes pour le player de séance :

- Le timer de repos doit tourner **tant que l'onglet reste actif** ; utiliser la Wake Lock API pour empêcher le verrouillage d'écran pendant une séance.
- Ne pas concevoir de fonctionnalité qui suppose une notification background (ex. rappel de fin de repos si l'app est en arrière-plan) — ça ne marchera pas dans ce contexte.
- Sur MacBook Pro (Chrome desktop), l'installation PWA fonctionne normalement, aucune restriction.

---

## 4. Design

Système visuel complet défini dans **Claude Design**, projet *BackPainDesign* (`https://claude.ai/design/p/26278c39-f837-45df-9871-0aba27003ad2`), fichier `uploads/claude.md` pour le brief complet et `Suivi Entrainement.dc.html` pour le prototype visuel (format canvas `sc-if`/`sc-for`, pas du code React directement réutilisable — à traduire en composants réels). Pour re-fetch : `mcp__claude-design__read_file` sur ce project_id.

### Direction artistique

**Light épuré, beaucoup de blanc, qualité d'objet** — référence Apple Fitness. Aucun mode sombre dans cette version. Pas d'ornement, pas de dégradé décoratif, pas de glassmorphism.

**La couleur encode le module** — c'est le principe structurant de toute l'app :

- Programme (force) → **Cobalt**
- Dos / BackPain (mobilité, restauration) → **Sauge**
- Trophées (accompli, cumulé) → **Laiton**
- Le reste de l'interface est neutre en toute circonstance. L'onglet actif dans la nav ne prend jamais la couleur d'accent.

### Tokens

```
--paper        #FFFFFF   surfaces, cartes
--canvas       #F6F7F4   fond d'écran
--ink          #111310   texte principal, chiffres
--graphite     #6E736B   texte secondaire, labels
--hairline     #E5E7E1   filets 1px, séparateurs
--cobalt       #1F3BE0   accent programme
--sage         #2E7D63   accent BackPain
--brass        #A9782C   accent trophées et paliers
--alert        #B3402E   uniquement destructif (réinitialiser, abandonner)
```

Interdits explicites : crème #F4F1EA, terracotta #D97757, vert acide sur fond noir, dégradés violets.

### Typographie

- **Archivo** (variable) — titres, chiffres, timers, compteurs, eyebrows. Chiffres tabulaires (`font-variant-numeric: tabular-nums`) partout où un chiffre change en direct. Grands nombres en Archivo Expanded 600.
- **Inter Tight** — corps de texte, listes, descriptions, boutons.
- Échelle : 44 / 32 / 24 / 18 / 15 / 13 / 11. Le timer de repos et le compteur de reps sortent de l'échelle, jusqu'à 96 px.

### Formes

Rayon 20px (cartes) / 14px (champs) / 999px (pastilles, boutons pilule). Pas d'ombre portée diffuse — les cartes se distinguent par contraste `--paper`/`--canvas` + filet `--hairline` 1px. Seule exception : la barre d'action fixe en bas de la vue séance. Grille d'espacement de 4. Cibles tactiles ≥ 44px (56px pour les actions primaires).

### L'élément signature : la grille de progression

Chaque niveau = **une ligne de 7 pastilles** (un jour = une pastille). États : à venir (contour hairline), aujourd'hui (contour plein 2px accent + halo), fait (rempli accent), sauté (rempli hairline), repos/marche (pastille creuse, point central). Jamais de heatmap façon GitHub, jamais de dégradé d'intensité — état binaire lisible.

### Navigation

Barre d'onglets fixe en bas, **4 entrées** : `Aujourd'hui` / `Programme` / `Dos` / `Trophées`. Réglages accessibles par icône dans l'en-tête d'Aujourd'hui, pas un 5ᵉ onglet. Le **mode séance est plein écran**, sans barre d'onglets — sortie par croix avec confirmation si séance entamée. Desktop (≥1024px) : colonne centrée 520px max, rail vertical à gauche au lieu de la barre du bas.

### Mouvement

Trois moments animés, pas un de plus : transition entre exercices (glissement horizontal 240ms), arc du timer de repos qui se vide, compteurs de trophées qui roulent de 0 à leur valeur à l'ouverture (600ms, décalé 40ms/carte). Respecter `prefers-reduced-motion` partout.

### Ton et écriture

Français, tutoiement, verbes actifs, zéro jargon technique. « Repos » pas « Rest », « Palier » pas « level », « Trophées » pas « Achievements », « 3 séries de 12 » à l'écrit / « 3 × 12 » en chiffres. **L'app constate, elle n'encourage pas** — pas de « Bravo champion », pas de coaching motivationnel, pas de points d'exclamation en cascade. La satisfaction vient des chiffres.

### Anti-patterns — ne pas produire

Cartes de métriques inventées (calories, VO2 max, « score de forme »), anneaux de progression concentriques, fil d'actualité / amis / classements / badges à partager, ombres portées diffuses, icônes multicolores dans les réglages, onboarding en plusieurs écrans, mode sombre non demandé, gamification culpabilisante (un jour manqué n'est pas un échec).

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

### Axe Dos (BackPain)

Logique complète et déjà figée dans `BackPainProgram.md` — **source de vérité du domaine, ne jamais la modifier sans demande explicite**. Résumé (voir le fichier pour le détail complet) :

- 16 semaines, 4 blocs de 4 semaines. RPE cible par bloc : 6, 7, 8, 8.
- Semaine 1 = calibrage (recherche du cran de départ par arbre). Semaines 4/8/12/16 = décharge (volume réduit, pas de test de montée).
- 10 arbres de progression (A à J), indépendants, chacun une échelle de crans.
- Règle de montée de cran soumise à plusieurs conditions strictes (voir `BackPainProgram.md` — notamment la **règle douleur : gêne > 3/10 bloque toute montée, jamais contournable**).

**Avertissement** — ce protocole vient de recommandations générales, pas d'un examen clinique. Outil de suivi personnel, jamais une source d'avis médical. Ne pas ajouter de diagnostic, d'interprétation de symptômes ou de conseil thérapeutique automatisé. Les critères d'alerte peuvent être affichés comme rappels, jamais évalués automatiquement.

### Trophées

Cumul all-time des répétitions par exercice (`countsInStats: true` uniquement), tous programmes confondus. Incrémenté à la validation de chaque séance. Paliers : 100 / 500 / 1000 / 5000 / 10000 / 25000 répétitions, marque laiton sobre au franchissement.

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

- **Git** : le repo n'est **pas encore initialisé** (`git init` à faire avant le premier commit). Une fois fait : commits atomiques, messages en français, à l'impératif. Branches de fonctionnalité, `main` toujours déployable.
- Les données de programme (`data.ts` généré, `BackPainProgram.md`) vivent dans un module dédié, séparées de la logique applicative — jamais dupliquées ailleurs dans le code.
- La logique de progression (montée de niveau, calcul de semaine/bloc BackPain, règle douleur) est **pure et testée unitairement** — c'est le cœur du produit, un bug ici fausse des mois de suivi.
- Test d'intégration obligatoire sur la persistance du player : enregistrer une série, naviguer ailleurs, revenir, vérifier que l'état est intact (cf. le bug de la v1, §2).
- Migrations de schéma SQL versionnées (voir pattern v1 : `migrations/0001_init.sql`, etc.), avec sauvegarde avant application.

---

## 8. Déploiement

Tout est dans **`DEPLOYMENT.md`** : accès VM, architecture Cloudflare Tunnel + Access, script `deploy/deploy.sh`, unité systemd `deploy/sportcompanion.service`. Ne pas dupliquer ce contenu ici — le consulter avant toute question d'infra ou de mise en prod.

---

## 9. Fichiers clés du repo

```
Objective.md                          objectif produit d'origine (source brute)
BackPainProgram.md                    domaine BackPain — source de vérité, ne pas modifier
DEPLOYMENT.md                         infra, accès VM, script de déploiement
deploy/                               deploy.sh + unité systemd
Caliathletics/
  caliathletics_backup/               HTML sauvegardé du site original (3 parcours)
  workout_raw.json                    extraction brute (Parser.py)
  workout_curated.json                données curées, prêtes à l'emploi
  workout_curation_review.csv         relecture humaine de la curation
  Parser.py / curate_workout.py       pipeline d'extraction (déjà tourné)
  generate_data_ts.py                 génère src/lib/workout/data.ts
  download_thumbnails.py              vignettes d'exercices → public/exercises/
```

Le code applicatif (Next.js) n'existe pas encore — ce repo contient à ce stade les données, le domaine et l'infra. Prochaine étape naturelle : scaffolder le projet Next.js (`output: "standalone"`, TypeScript) et lancer `generate_data_ts.py` / `download_thumbnails.py` une fois `src/` et `public/` en place.
