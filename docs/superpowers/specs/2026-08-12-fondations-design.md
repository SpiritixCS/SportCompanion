# Fondations — design

Sous-projet 1/6 de SportCompanion (voir `CLAUDE.md` pour le contexte produit complet). Périmètre : scaffold Next.js, design system en code, socle base de données, pipeline data. Zéro écran produit, zéro logique métier.

## Objectif

Poser une base sur laquelle les 5 phases suivantes (Player, Programme, Dos, Trophées, Réglages) peuvent construire sans revenir sur l'architecture. Priorité #1 du projet (voir `CLAUDE.md` §0) : fidélité exacte au design Claude Design — cette phase doit produire des primitives qui rendent cette fidélité *possible et facile à vérifier* à chaque phase suivante, pas juste poser un scaffold générique.

## Approche retenue

Tailwind v4 (config CSS-first via `@theme`), composants de base faits main (pas de lib UI générique), SQLite via `better-sqlite3` avec un runner de migrations maison. Alternative envisagée et écartée : CSS Modules + CSS vars (plus proche du vocabulaire du brief mais plus verbeux à itérer) ; vanilla-extract/styled-components (overkill pour un projet solo, friction avec RSC).

## Structure du projet

```
src/
  app/                     App Router. Layout racine + route /dev/design-system
  components/              Card, Pastille, LigneNiveau, Button, BottomNav, Sheet, icônes
  lib/
    workout/data.ts        généré par generate_data_ts.py (Caliathletics)
    db/                    client better-sqlite3 + runner de migrations
  styles/globals.css       tokens Tailwind v4 (@theme) + reset
public/exercises/          vignettes générées par download_thumbnails.py
migrations/                SQL versionné (vide dans cette phase)
```

`create-next-app` : App Router, TypeScript strict, `output: "standalone"` dans `next.config.ts` (requis par `deploy/sportcompanion.service`, voir `DEPLOYMENT.md`). Fonts via `next/font/google` : Archivo (variable, axes wght+wdth) + Inter Tight.

## Design system → code

Tokens déclarés une seule fois comme CSS vars dans `globals.css` via `@theme`, consommables à la fois en `var(--cobalt)` et en classes utilitaires (`bg-cobalt`, `rounded-card`). Valeurs exactes : voir `CLAUDE.md` §4 (tokens couleur, échelle typo, rayons).

Composants de base à construire dans cette phase, parce que toutes les phases suivantes en dépendent :

| Composant | Rôle |
|---|---|
| `Card` | Surface `paper`/`hairline`, rayon 20px |
| `Pastille` | 5 états : à venir / aujourd'hui / fait / sauté / repos-marche |
| `LigneNiveau` | 7 pastilles + numéro de niveau — la grille signature de l'app |
| `Button` | Primaire (pilule 56px, accent plein) / secondaire (outline) |
| `BottomNav` | Barre fixe mobile, rail vertical desktop ≥1024px |
| `Sheet` | Feuille modale à molette (ex. ajuster les reps) |
| Icônes | SVG maison, trait 1.5px uniforme — pas de lib générique |

Chaque composant prend une prop `accent: "cobalt" | "sage" | "brass"` ; aucune couleur en dur dans un composant produit.

**Vérification visuelle** : route `/dev/design-system` affichant tous les composants et tous leurs états côte à côte. Sert de comparaison rapide au prototype `Suivi Entrainement.dc.html` (Claude Design, project `26278c39-f837-45df-9871-0aba27003ad2`) à chaque phase suivante — pas de Storybook, overkill pour un projet solo.

## Base de données

`better-sqlite3`. Runner de migrations maison (pas de framework type Prisma/Drizzle — trop pour un fichier SQLite mono-utilisateur) : applique dans l'ordre les `.sql` non appliqués d'un dossier `migrations/`, table `_migrations` pour le suivi de ce qui a été appliqué. Chemin de la DB piloté par la variable d'environnement `DB_PATH` (déjà réglée dans `deploy/sportcompanion.service`) ; fallback `./data/sportcompanion.db` en dev, dossier `data/` gitignored.

**Aucune table métier dans cette phase.** Le livrable est le runner + la connexion + `PRAGMA journal_mode=WAL`. Les tables (séances, progression programme, arbres BackPain, trophées) sont créées par les migrations des phases qui en ont besoin — pas de schéma spéculatif écrit à l'avance.

## Pipeline data (one-shot)

Une fois `src/lib/workout/` et `public/` en place : lancer `Caliathletics/generate_data_ts.py` (produit `src/lib/workout/data.ts` depuis `workout_curated.json`) puis `Caliathletics/download_thumbnails.py` (vignettes vers `public/exercises/`). Scripts déjà écrits, tournés une fois, pas de ré-exécution automatique / pas de CI dessus tant que `workout_curated.json` ne change pas.

## Tests

Vitest (cohérent avec la v1 décommissionnée, voir `CLAUDE.md` §2). Dans cette phase : smoke tests des composants de base (rendent sans crasher, accent correctement appliqué) + test du runner de migrations (applique dans l'ordre, idempotent — relancer ne réapplique rien).

## Erreurs / cas limites

- Migration qui échoue en cours d'application : le runner doit s'arrêter (pas d'application partielle silencieuse) et signaler clairement laquelle a échoué. Pas de rollback automatique à ce stade (une seule migration, pas de table créée) — sera revisité si une phase ultérieure a besoin de transactions multi-étapes.
- `DB_PATH` absent en dev : fallback documenté, pas d'erreur.

## Hors scope de cette phase

Aucun écran produit (Aujourd'hui, Programme, Dos, Trophées, Réglages), aucune logique métier (progression, player, règle douleur). Le premier vrai déploiement (`deploy/deploy.sh`) est testé en fin de phase avec un "hello world" pour valider le pipeline VM avant de construire dessus — pas un objectif produit de cette phase, un garde-fou infra.

## Suite

Phase 2 (Player de séance) part de cette base : composants, DB skeleton, données Caliathletics chargées.
