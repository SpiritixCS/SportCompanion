# BackPain.md — Logique du programme

Spécification fonctionnelle complète. Aucune implémentation, aucune décision technique. Ce document est la **source de vérité du domaine** : toute donnée du programme dans le code en dérive et ne le contredit jamais.

---

## 1. Périodisation

Durée totale : **16 semaines**, découpées en **4 blocs de 4 semaines**.

| Bloc | Semaines | Objectif | RPE cible |
|---|---|---|---|
| 1 | 1-4 | Réapprentissage — contrôle moteur, amplitude, technique | 6 |
| 2 | 5-8 | Accumulation — volume, montée dans les arbres | 7 |
| 3 | 9-12 | Intensification — variantes dures, unilatéral, premiers lestages | 8 |
| 4 | 13-16 | Consolidation — force et transfert | 8 |

**Calcul de la semaine courante** : nombre de jours écoulés depuis la date de départ, divisé par 7, arrondi à l'inférieur, plus 1. Borné entre 1 et 16.

**Calcul du bloc** : semaine divisée par 4, arrondie au supérieur. Borné à 4.

### Semaine 1 — calibrage

Semaine de recherche du point d'entrée dans chaque arbre, pas d'entraînement.

- L'utilisateur fait une série d'essai par arbre, en démarrant au cran 1.
- S'il dépasse largement le haut de la fourchette au RPE cible, il monte d'un cran et reteste, **dans la même séance**, autant de fois que nécessaire.
- Le cran de départ retenu est celui où il tombe **dans** la fourchette au RPE cible du bloc 1.
- Si le cran 1 est déjà trop dur, il ne change pas d'arbre : il régresse dans l'exécution (amplitude partielle, tempo réduit, aide manuelle) et construit vers le cran 1 complet.

**C'est la seule semaine où le plafond d'une montée par semaine ne s'applique pas.**

Deux exceptions à la procédure de test :

- **Arbre A** — se calibre normalement sur les crans 1 à 4. Mais la **première séance où le cran 5 est atteint**, quelle que soit la semaine, est limitée à **2 séries de 3**, sans exception. Les courbatures du Nordic curl arrivent à J+2 et ne sont pas anticipables pendant la séance.
- **Arbre I** — démarre au cran 1 et y reste **deux semaines minimum**, même si c'est facile.

### Semaine 4 de chaque bloc — décharge

Semaines 4, 8, 12 et 16. Condition : numéro de semaine divisible par 4.

**Ce qui change** — le volume uniquement :

| Prescrit | En décharge |
|---|---|
| 4 séries | 2 séries |
| 3 séries | 2 séries |
| Séance à 4 exercices | Retirer le dernier accessoire |

**Ce qui ne change pas** : le cran, les répétitions, le tempo, l'unité.

**Ce qui ne change jamais** : mobilité quotidienne, marche, transitions assis-debout, rappels bureau.

**Aucun test de cran n'est effectué pendant une semaine de décharge.** Toute progression reprend en semaine 1 du bloc suivant.

Un relevé qualitatif spécifique est demandé en fin de semaine de décharge, à trois valeurs : *nettement mieux* / *pareil* / *moins bien*. Interprétation destinée à l'utilisateur :

- Nettement mieux → charge trop élevée, redescendre légèrement au bloc suivant
- Pareil → charge bien calibrée
- Moins bien → le mouvement est bénéfique, ne pas réduire davantage

---

## 2. Rappel RPE

Échelle de perception de l'effort, exprimée en répétitions gardées en réserve.

| RPE | Répétitions encore possibles |
|---|---|
| 10 | 0 — échec |
| 9 | 1 |
| 8 | 2 |
| 7 | 3 |
| 6 | 4 |
| 5 | 5 ou plus |

Pour les tenues, même logique en secondes. **L'échec n'est jamais atteint dans ce programme.**

---

## 3. Les dix arbres de progression

Dix familles de mouvement, désignées par une lettre. Chaque arbre est une échelle ordonnée de variantes appelées **crans**. Les arbres progressent **indépendamment** les uns des autres.

Quatre arbres sont travaillés deux fois par semaine — **A, B, H, J** — avec obligation d'utiliser une variante différente entre les deux séances.

---

### A — Charnière & ischios · 8 crans

**Cran 1 — Hip hinge au bâton**
Bâton en contact permanent avec la tête, les dorsales et le sacrum. Reculer les hanches, genoux à peine fléchis.
*Erreur : plier les genoux comme un squat, ou perdre le contact au sacrum.*

**Cran 2 — Good morning élastique**
Élastique sous les pieds et autour de la nuque. Même charnière que le cran 1.
*Erreur : arrondir le dos quand l'élastique tire.*

**Cran 3 — Leg curl serviette bilatéral**
Allongé, talons sur les patins, bassin décollé. Glisser les talons loin puis les ramener en tirant.
*Erreur : laisser le bassin retomber pendant la glisse.*

**Cran 4 — Leg curl serviette unilatéral**
Idem, une seule jambe. L'autre reste fléchie en l'air.
*Erreur : bassin qui s'affaisse du côté libre.*

**Cran 5 — Nordic curl excentrique assisté**
À genoux, chevilles bloquées, corps aligné des genoux aux épaules. Descendre le plus lentement possible, les mains freinent l'arrivée au sol.
*Erreur : casser à la hanche au lieu de garder le corps droit.*

**Cran 6 — Nordic curl excentrique complet (5 s)**
Même chose, descente contrôlée sur 5 s pleines.
*Erreur : lâcher d'un coup à mi-course.*

**Cran 7 — Nordic curl remontée partielle**
Poussée légère sur les mains pour amorcer la remontée, puis les ischios prennent le relais.
*Erreur : remonter uniquement à la force des bras.*

**Cran 8 — Nordic curl + gilet lesté**
Gilet lesté, descente contrôlée.

---

### B — Extension de hanche · 7 crans

**Cran 1 — Pont fessier bilatéral**
Pieds à plat, talons près des fesses. Pousser par les talons et verrouiller les fessiers en haut.
*Erreur : cambrer le bas du dos au lieu de serrer les fessiers.*

**Cran 2 — Pont fessier pieds surélevés**
Talons sur un support bas. Même verrouillage en haut.
*Erreur : chercher la hauteur plutôt que la contraction.*

**Cran 3 — Pont fessier unilatéral**
Une jambe tendue ou genou ramené vers la poitrine. Le bassin reste horizontal.
*Erreur : bassin qui bascule du côté de la jambe libre.*

**Cran 4 — Hip thrust unilatéral, épaules surélevées**
Épaules sur le canapé, menton rentré, côtes basses. Extension complète de hanche en haut.
*Erreur : compenser en hyperextension lombaire.*

**Cran 5 — Hip thrust unilatéral, épaules + pied surélevés**
Épaules sur le canapé et pied d'appui surélevé. Amplitude maximale.

**Cran 6 — Hip thrust unilatéral + charge sur le bassin**
Charge posée sur le bassin, avec un coussin ou une serviette pliée dessous.
*Erreur : charge trop haute sur le ventre.*

**Cran 7 — Hip thrust unilatéral chargé, tenue 3 s**
Tenue de 3 s en verrouillage complet à chaque répétition.

---

### C — Extenseurs lombaires · 6 crans

**Cran 1 — Superman au sol, tenue 5 s**
À plat ventre, bras et jambes décollés, regard vers le sol.
*Erreur : lever la tête et casser la nuque.*

**Cran 2 — Reverse hyper au bord du lit**
Buste sur le lit, jambes dans le vide. Monter jusqu'à l'horizontale, pas au-delà.
*Erreur : aller chercher l'hyperextension lombaire.*

**Cran 3 — Reverse hyper, tenue 3 s en haut**
Même mouvement avec 3 s de tenue en position haute.

**Cran 4 — Extension prone bras tendus**
Bras tendus vers l'avant : le levier plus long augmente la difficulté.
*Erreur : raccourcir les bras dès que ça brûle.*

**Cran 5 — Biering-Sørensen, tenues**
Buste dans le vide, pieds bloqués, corps aligné à l'horizontale. Tenir.
*Erreur : monter au-dessus de l'horizontale.*

**Cran 6 — Biering-Sørensen + gilet lesté**
Gilet lesté, même tenue.

---

### D — Genou / unilatéral · 6 crans

**Cran 1 — Squat poids de corps, tempo 3-1-1**
Descente 3 s, pause 1 s en bas, remontée 1 s. Talons au sol tout du long.
*Erreur : décoller les talons en bas.*

**Cran 2 — Split squat**
Un pas en avant, genou arrière vers le sol, buste vertical.
*Erreur : buste penché en avant.*

**Cran 3 — Split squat bulgare**
Pied arrière sur un support à hauteur de genou. Le poids reste sur la jambe avant.
*Erreur : support trop haut, qui force le bassin en rotation.*

**Cran 4 — Split squat bulgare + gilet**
Gilet lesté, même exécution.

**Cran 5 — Pistol assisté**
Une jambe, l'autre tendue devant. Élastique ou anneaux pour l'équilibre uniquement.
*Erreur : se tracter sur les anneaux au lieu de s'équilibrer.*

**Cran 6 — Pistol complet**
Sans aide.

---

### E — Tirage vertical · 5 crans

**Cran 1 — Traction négative (descente 5 s)**
Se hisser en sautant, puis descendre en 5 s contrôlées.
*Erreur : descendre en chute libre.*

**Cran 2 — Traction assistée élastique**
Un pied dans la boucle de l'élastique. Omoplates d'abord, puis les bras.
*Erreur : se balancer pour lancer le mouvement.*

**Cran 3 — Traction stricte**
Départ bras tendus, épaules basses. Menton au-dessus de la barre.
*Erreur : épaules qui montent vers les oreilles.*

**Cran 4 — Traction tempo 3-1-3**
Montée 3 s, tenue 1 s, descente 3 s.

**Cran 5 — Traction lestée**
Gilet lesté ou charge à la ceinture.

---

### F — Tirage horizontal · 5 crans

**Cran 1 — Rowing inversé, corps peu incliné**
Anneaux hauts, corps peu incliné, gainé de la tête aux talons. Tirer la poitrine vers les anneaux.
*Erreur : bassin qui s'affaisse.*

**Cran 2 — Rowing inversé, corps plus horizontal**
Anneaux plus bas, corps plus proche de l'horizontale.

**Cran 3 — Rowing inversé, pieds surélevés**
Pieds sur une chaise, corps horizontal.

**Cran 4 — Rowing archer ou un bras assisté**
Un bras tire, l'autre reste tendu en soutien.
*Erreur : rotation du buste.*

**Cran 5 — Rowing inversé + gilet**
Gilet lesté.

---

### G — Poussée · 6 crans

**Cran 1 — Pompes inclinées**
Mains sur un support haut, corps aligné, coudes à 45° du buste.
*Erreur : tête qui plonge en avant.*

**Cran 2 — Pompes au sol**
Au sol, même alignement.
*Erreur : bassin qui s'affaisse ou qui monte.*

**Cran 3 — Pompes déclinées ou aux anneaux**
Pieds surélevés, ou aux anneaux pour l'instabilité.

**Cran 4 — Dips assistés élastique**
Un pied dans l'élastique. Buste légèrement penché, descente jusqu'aux bras parallèles au sol.
*Erreur : descendre trop bas, épaules en avant.*

**Cran 5 — Dips stricts**
Sans assistance, même amplitude.

**Cran 6 — Dips lestés**
Gilet lesté.

---

### H — Chaîne latérale & abducteurs · 7 crans

**Cran 1 — Side plank genoux**
Sur le côté, appui coude et genoux. Épaule à l'aplomb du coude, hanche haute, corps aligné.
*Erreur : hanche qui redescend en cours de tenue.*

**Cran 2 — Side plank pieds**
Même chose en appui sur les pieds.

**Cran 3 — Side plank + abduction jambe haute**
En position, lever et redescendre lentement la jambe du dessus.
*Erreur : se laisser tomber sur le côté.*

**Cran 4 — Side plank + gilet**
Gilet lesté ou charge posée sur la hanche.

**Cran 5 — Copenhagen genou fléchi**
Jambe du dessus posée sur un support, genou du dessous fléchi au sol. Monter le bassin.
*Erreur : support trop haut au départ.*

**Cran 6 — Copenhagen jambe tendue**
Jambe du dessus sur le support par le pied, jambe du dessous tendue dans le vide.
*Erreur : passer trop vite au cran 6 — c'est un gros saut.*

**Cran 7 — Copenhagen lesté**
Charge légère à la cheville ou au bassin.

---

### I — Anti-latéral & portés · 4 crans

**Cran 1 — Suspension à un bras, tenues**
Suspendu à un bras, épaule active — ne pas se laisser pendre passivement.
*Erreur : épaule relâchée dans l'articulation.*

**Cran 2 — Suitcase carry sac à dos**
Sac à dos chargé porté à une main. Marcher épaules à niveau.
*Erreur : s'incliner du côté opposé pour compenser.*

**Cran 3 — Suitcase carry kettlebell**
Kettlebell à une main, même consigne.
*Erreur : buste qui se penche.*

**Cran 4 — Suitcase carry lourd**
Charge plus lourde, distance plus longue.

---

### J — Core anti-extension · 6 crans

**Cran 1 — Dead bug**
Sur le dos, bas du dos plaqué au sol en permanence. Descendre bras et jambe opposés.
*Erreur : le bas du dos qui décolle — arrêter l'amplitude avant ça.*

**Cran 2 — Hollow hold**
Lombaires au sol, épaules et jambes décollées, bras le long du corps ou tendus.
*Erreur : cambrer pour tenir plus longtemps.*

**Cran 3 — Hollow hang à la barre**
Suspendu à la barre, côtes basses, léger engagement du bassin en rétroversion.
*Erreur : se laisser pendre en cambrure.*

**Cran 4 — Relevés de genoux suspendus**
Genoux vers la poitrine, sans élan. **S'arrêter avant le point de pincement.**
*Erreur : aller jusqu'en butée de flexion lombaire.*

**Cran 5 — Relevés de jambes tendues**
Jambes tendues, même limite d'amplitude.

**Cran 6 — L-sit aux barres à dips**
Bras tendus sur les barres, jambes à l'horizontale.

---

## 4. Prescriptions par arbre et par bloc

Format : séries × fourchette de répétitions, avec l'unité.

| Arbre | Bloc 1 | Bloc 2 | Bloc 3 | Bloc 4 |
|---|---|---|---|---|
| A | 3 × 8-10 reps | 3 × 8-10 reps | 4 × 6-8 reps | 4 × 5-6 reps |
| B | 3 × 12-15 reps | 4 × 10-12 reps | 4 × 8-10 reps | 4 × 6-8 reps |
| C | 3 × 10-12 reps | 3 × 12-15 reps | 3 × 30-45 s | 4 × 45-50 s |
| D | 3 × 10-12 reps | 3 × 8-10 reps | 4 × 8-10 reps | 4 × 6-8 reps |
| E | 3 × 5-8 reps | 4 × 6-8 reps | 4 × 5-8 reps | 4 × 4-6 reps |
| F | 3 × 10-12 reps | 4 × 10-12 reps | 4 × 8-10 reps | 4 × 6-8 reps |
| G | 3 × 10-12 reps | 4 × 8-12 reps | 4 × 6-10 reps | 4 × 5-8 reps |
| H | 3 × 20-25 s | 3 × 30-35 s | 3 × 30-40 s | 3 × 45-50 s |
| I | 3 × 15-20 s | 3 × 20-25 m | 4 × 25-30 m | 4 × 30-40 m |
| J | 3 × 8-10 reps | 3 × 8-12 reps | 3 × 8-10 reps | 3 × 6-10 reps |

**Unités** : `reps` (répétitions), `s` (secondes de tenue), `m` (mètres parcourus).

**Incrément de saisie** : 1 pour les répétitions, 5 pour les secondes et les mètres.

**Repos** : 60 s sur J2, 90 à 120 s sur les mouvements principaux des J1, J3 et J5.

---

## 5. Composition des séances

Six séances de musculation, du lundi au samedi. Le dimanche ne comporte pas de musculation.

| Jour | Intitulé | Exercices fixes | Arbres |
|---|---|---|---|
| J1 · Lundi | Charnière & chaîne postérieure | Hip hinge au bâton 2 × 10 (échauffement) | A, B, C |
| J2 · Mardi | Contrôle moteur & dissociation | Bascules quadrupédie 3 × 10 · Chat-chameau 3 × 10 · Bird dog 3 × 8 tenue 6-10 s · Butées 10 reps lentes à 90 % du pincement, chaque direction | J, H |
| J3 · Mercredi | Genou & unilatéral | Mobilité 90/90 + couch stretch · Abduction élastique 3 × 15-20 | D, A |
| J4 · Jeudi | Tirage | Open book + extension thoracique · Face pull élastique 3 × 15 | E, F |
| J5 · Vendredi | Fessiers, latéral & portés | Pont fessier bilatéral 2 × 15 (échauffement) | B, H, I |
| J6 · Samedi | Poussée & core suspendu | Mobilité épaules + thoracique · Curl-up McGill 3 × 8 tenue 10 s | G, J |
| J7 · Dimanche | — | — | — |

Les exercices fixes ne sont pas soumis à la logique de progression : volume constant sur les 16 semaines.

---

## 6. Règle de progression

Évaluée à l'enregistrement d'une séance, **arbre par arbre**.

La montée d'un cran est accordée si et seulement si **toutes** ces conditions sont réunies :

1. La semaine n'est pas une semaine de décharge
2. La gêne déclarée pour la séance est **≤ 3/10**
3. Aucune montée n'a déjà été enregistrée cette semaine sur cet arbre
4. Le cran courant n'est pas le dernier de l'arbre
5. **Toutes** les séries atteignent le **haut** de la fourchette de répétitions
6. **Toutes** les séries sont au RPE cible du bloc **ou en dessous**

À l'échec d'une condition, un message distinct est retourné. L'utilisateur doit toujours comprendre pourquoi il ne monte pas.

| Résultat | Condition en échec | Message |
|---|---|---|
| `decharge` | 1 | Semaine de décharge : pas de test de cran. |
| `douleur` | 2 | Gêne au-delà de 3/10 : répéter le même cran la prochaine fois. |
| `plafond` | 3 | Déjà monté cette semaine sur cette échelle. Une seule montée par semaine. |
| `sommet` | 4 | Sommet de l'échelle atteint. |
| `maintien` | 5 ou 6 | Rester à ce cran. Viser le haut de la fourchette au RPE cible. |
| `montee` | aucune | Cran suivant débloqué, avec son intitulé. |

**Ordre d'évaluation** : les conditions sont testées dans l'ordre ci-dessus, le premier échec détermine le résultat.

**Exception calibrage** : en semaine 1, la condition 3 ne s'applique pas et l'utilisateur peut en outre régler ses crans manuellement, plusieurs fois, sans limite.

### Règle en cas de stagnation

Un arbre qui ne progresse pas **3 semaines de suite** appelle un changement de variante ou un passage à un schéma de répétitions plus bas. Signalé à l'utilisateur, jamais appliqué automatiquement.

---

## 7. Règle douleur — prioritaire sur toute autre logique

| Situation | Conduite |
|---|---|
| Gêne ≤ 3/10 pendant, revenue à la normale sous 24 h | Normal. Progression possible. |
| Gêne > 3/10 **ou** persistante au-delà de 24 h | Répéter le même cran à la séance suivante. |
| Deux séances consécutives dans ce cas | Redescendre d'un cran, remonter après 2 semaines propres. |
| Aggravation progressive sur 2 semaines | Arrêt du bloc, consultation. |

Deux gênes sont relevées : **pendant la séance** (0-10, saisie à l'enregistrement) et **le lendemain** (0-10, saisie le jour suivant). Seule la première conditionne la progression ; la seconde alimente le suivi.

---

## 8. Mobilité quotidienne

Routine fixe, **tous les jours**, y compris jours sans séance et semaines de décharge. Environ 8 minutes. Aucune variation : la répétition à l'identique est le mécanisme actif.

**1 — Bascules de bassin quadrupédie · 2 × 10**
À quatre pattes, mains sous les épaules, genoux sous les hanches. Basculer le bassin seul, en avant puis en arrière. Le reste du dos et les épaules ne bougent pas.
*Erreur : bouger tout le tronc — c'est justement la dissociation qu'on réapprend.*

**2 — Chat-chameau lent · 2 × 10**
Même position. Arrondir puis creuser le dos, lentement, sur toute la colonne. S'arrêter juste avant le point de pincement, dans les deux directions.
*Erreur : aller chercher la fin de course. Seul exercice soumis à la règle des 90 %.*

**3 — Couch stretch · 2 × 45 s par côté**
Genou arrière au sol contre un mur ou un canapé, tibia à la verticale, pied vers le haut. Serrer le fessier du côté étiré et redresser le buste.
*Erreur : cambrer le bas du dos au lieu de serrer le fessier.*

**4 — 90/90 hanches · 2 × 8 par côté**
Assis au sol, une jambe devant à 90°, l'autre sur le côté à 90°. Pivoter les deux genoux d'un côté à l'autre en gardant le buste droit.
*Erreur : s'aider des mains pour forcer la rotation.*

**5 — Open book thoracique · 2 × 8 par côté**
Allongé sur le côté, genoux fléchis empilés, bras tendus devant. Ouvrir le bras du dessus vers l'arrière en suivant la main du regard. Les genoux restent collés au sol.
*Erreur : laisser le bassin partir avec le bras.*

### Distinction bascules / chat-chameau

Le mouvement du bassin est identique ; **la différence est le reste du dos**.

- **Bascules** : segment isolé. Seul le bassin bouge, le rachis et les épaules restent immobiles. Petite amplitude. Objectif : commander le bassin indépendamment du rachis.
- **Chat-chameau** : segment coordonné. Toute la colonne participe en vague continue. Grande amplitude. Objectif : répartir le mouvement sur tous les étages.

Ordre imposé : bascules d'abord, chat-chameau ensuite.

### Règle des 90 %

Applicable au seul chat-chameau. L'utilisateur repère le point exact où le pincement apparaît, dans chaque direction, et travaille à **90 % de ce point**. Jamais dedans. Le point est **réévalué toutes les deux semaines** et recule normalement au fil du programme.

---

## 9. Marche

**Deux fois par semaine : mercredi et dimanche.** Jours configurables.

- Point de départ : **70 % du seuil déclencheur initial** (durée de marche au-delà de laquelle la gêne se réveille).
- Progression : **+10 % par semaine**, sans exception, y compris les bonnes semaines et les semaines de décharge.
- La cible est calculée et affichée ; l'utilisateur saisit la durée réellement effectuée.
- Si la marche reste irritante au départ, substitution par vélo ou natation les 3 premières semaines, puis réintroduction.

---

## 10. Transitions assis-debout

Séquence à appliquer après **plus de 20-30 minutes assis** — restaurant, voiture, cinéma, bureau.

1. Encore assis : 3 bascules lentes du bassin en antéversion, amplitude moyenne
2. Se lever en charnière de hanche, buste incliné — pas en redressant le rachis lombaire
3. 30 à 60 s de marche ou de petits mouvements en amplitude moyenne
4. Puis seulement, redressement complet

**Justification** : après une immobilité prolongée, les tissus postérieurs sont flués et la proprioception dégradée. Se redresser d'un coup revient à chercher la fin de course au moment où les freins passifs sont temporairement lâches. C'est le pic de risque quotidien.

**Prévention** : appui lombaire dans les sièges sans soutien (veste ou serviette roulée), qui supprime le fluage à la source.

---

## 11. Rappels bureau

Quotidiens, indépendants du reste.

- Minuteur toutes les **30 minutes** → debout 1 à 2 minutes
- Toutes les **2 heures** → 2 × 10 extensions lombaires debout

---

## 12. Métriques hebdomadaires

Relevées une fois par semaine.

| Métrique | Type | Valeur par défaut |
|---|---|---|
| **Tolérance assise avant symptôme** | minutes, pas de 5 | 60 |
| Marche sans réveil de la gêne | minutes, pas de 5 | 30 |
| Pincement en antéversion | *recule* / *identique* / *plus tôt* | — |
| Pincement en rétroversion | *recule* / *identique* / *plus tôt* | — |
| Ressenti de décharge *(semaines 4, 8, 12, 16 uniquement)* | *nettement mieux* / *pareil* / *moins bien* | — |

**La tolérance assise est la métrique principale du programme.** Elle bouge avant la douleur et constitue le meilleur indicateur d'efficacité. Elle doit être mise en évidence et représentée dans le temps.

---

## 13. Charge cumulée

Les épisodes symptomatiques suivent le **cumul de charge sur 3 à 4 jours**, pas un événement isolé. Toute activité physique hors programme (sport, randonnée, vélo, journée debout inhabituelle) est donc enregistrée avec durée et intensité ressentie, et le cumul glissant doit être rendu visible.

C'est la corrélation charge cumulée → symptôme qui fait la valeur du suivi, davantage que chaque relevé pris isolément.

---

## 14. Jalons attendus

| Échéance | Signal de bonne trajectoire |
|---|---|
| Semaine 4 | Technique propre partout. Arbre A au cran 4 minimum. Douleur souvent inchangée — normal. Premier signe attendu : le point de pincement qui recule. |
| Semaine 8 | Blocages nettement plus rares. Tolérance assise au-delà de 60 min même en fin de journée chargée. Marche revenue au seuil initial sans réveil. |
| Semaine 12 | Arbre B au cran 4 minimum, arbre H au cran 6. Gêne de fond réduite de moitié ou plus. Transitions assis-debout non-événementielles. |
| Semaine 16 | Une nuit hors du lit habituel, une longue journée de marche ou un repas assis prolongé ne déclenchent plus d'épisode. |

**Absence totale d'amélioration à la semaine 8 malgré une exécution correcte** → réexamen clinique justifié. Ce n'est pas une raison d'interrompre l'entraînement.

---

## 15. Entretien après la semaine 16

3 séances par semaine suffisent au maintien, plus la mobilité quotidienne et les rappels bureau. À conserver en priorité : **arbre A (ischios), arbre B (fessiers), arbre H (chaîne latérale)** — les trois qui adressent directement le pattern.

---

## 16. Limite

Ce protocole repose sur des recommandations générales et sur la littérature, non sur un examen clinique. Il n'est pas un avis médical. Aucune interprétation de symptôme ni aucun conseil thérapeutique ne doit être dérivé automatiquement de ces règles : les critères d'alerte s'affichent, ils ne s'évaluent pas à la place de l'utilisateur.
