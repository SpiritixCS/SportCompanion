# Aujourd'hui — déplier les exercices, Trophées — icônes de famille — design

Deux améliorations indépendantes, remontées après premier usage réel par les deux utilisateurs.

## Périmètre

1. Sur Aujourd'hui (carte Programme et carte Dos) et sur l'écran Dos, le texte « et N autres » devient tappable et déplie la liste complète des exercices restants, sur place.
2. Sur Trophées, chaque carte d'exercice sans photo (module `dos`, `tracking`, ou photo `programme` en échec) affiche une icône de famille de mouvement au lieu d'un carré blanc vide.

Hors périmètre : navigation vers un écran dédié pour la liste dépliée (reste sur place) ; nouvelle taxonomie de familles pour Dos/Tracking (réutilise les 8 familles déjà curées côté Programme) ; icône par exercice individuel (la granularité reste la famille, pas l'exercice).

## Déplier les exercices

`loadTodayState.ts` et `loadDosTodayState.ts` exposent désormais la liste complète `exercises: { name: string; dose: string }[]` — plus de pré-slice `exercisesPreview`/`exercisesRestCount` côté loader. La liste vient de `workout_curated.json`/`BackPainProgram.md`, contenu statique déjà chargé côté serveur : l'exposer en entier au client ne viole pas la règle « état lu depuis la source de vérité » (§2 CLAUDE.md), il n'y a pas d'état DB à reconstruire ici, juste du contenu déjà présent qu'on masque ou non.

`ProgrammeCard.tsx` et `BackPainCard.tsx` passent en composant client (`"use client"`), gagnent un `useState(false)` local `expanded` :
- Repliée (défaut) : 3 premiers exercices, puis bouton texte `et N autres` / `et 1 autre` si `exercises.length > 3`.
- Dépliée : liste complète, bouton devient `Voir moins` en dernière ligne.
- Aucun exercice au-delà de 3 : pas de bouton, comportement inchangé.

`AujourdhuiScreen.tsx` et `DosScreen.tsx` (deux call-sites de `BackPainCard`, un de `ProgrammeCard` sur Aujourd'hui) passent `exercises` au lieu de `exercisesPreview`+`exercisesRestCount` — simple renommage de prop, aucune logique de tri/slice à leur niveau.

## Trophées — icônes de famille

`TrophyCard` (type, `src/lib/trophies/computeTrophies.ts`) gagne un champ `movementFamily?: MovementFamily` (`"core" | "dip" | "handstand" | "lever" | "other" | "pull" | "push" | "squat"`, type déjà implicite dans `src/lib/workout/types.ts`).

Peuplement dans `computeTrophies()` :
- **Programme** : `exercise.movementFamily` directement (déjà sur la donnée curée).
- **Dos** (10 arbres fixes, mapping figé à la main, pas de calcul) :

  | Arbre | `movementFamily` |
  |---|---|
  | A Charnière & ischios | `squat` |
  | B Extension de hanche | `squat` |
  | C Extenseurs lombaires | `core` |
  | D Genou / unilatéral | `squat` |
  | E Tirage vertical | `pull` |
  | F Tirage horizontal | `pull` |
  | G Poussée | `push` |
  | H Chaîne latérale & abducteurs | `core` |
  | I Anti-latéral & portés | `core` |
  | J Core anti-extension | `core` |

- **Tracking** (texte libre Clément) : toujours `other` — pas de matching par mots-clés sur le nom saisi (YAGNI, la liste d'exercices Clément est trop hétérogène pour un mapping fiable).

8 nouvelles icônes `src/components/icons/IconFamily{Push,Pull,Squat,Core,Dip,Handstand,Lever,Other}.tsx`, même patron que les icônes existantes (`Icon.tsx` : `viewBox 24x24`, `stroke="currentColor"`, trait abstrait géométrique — cf. `IconDos.tsx`, pas de pictogramme figuratif ni de couleur propre à la famille).

`TrophyCard.tsx` : le slot `aspect-square bg-canvas` (actuellement vide si `!hasImage`) affiche l'icône de famille centrée, couleur `--graphite`, quand `!hasImage` — c'est-à-dire module `dos`/`tracking` systématiquement, ou module `programme` si la photo 404 (`imageFailed`). La photo reste prioritaire quand disponible ; l'icône ne remplace jamais une photo qui charge correctement. Si `movementFamily` est absent (ne devrait pas arriver vu le mapping ci-dessus, mais robustesse), aucun slot n'est rendu — comportement actuel inchangé.

## Tests

- `ProgrammeCard.test.tsx` / `BackPainCard.test.tsx` : prop renommée en `exercises`, toggle déplier/replier (clic sur « et N autres » révèle le reste, clic sur « Voir moins » replie), pas de bouton si ≤ 3 exercices.
- `loadTodayState.test.ts` / loader Dos correspondant : `exercises` contient la liste complète, plus de `exercisesRestCount`.
- `computeTrophies.test.ts` : `movementFamily` correct par module (programme depuis la donnée, dos depuis le mapping figé, tracking toujours `other`).
- `TrophyCard.test.tsx` : icône affichée quand `!hasImage`, absente si photo programme charge, absente si `movementFamily` manquant.

## Suite

Deux sous-parties indépendantes mais petites, un seul plan d'implémentation suffit — pas de découpage en sous-projets.
