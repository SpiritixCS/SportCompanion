# claude.md — Brief UI : application de suivi d'entraînement

## 0. Ce qu'on te demande

Tu conçois **uniquement l'interface** d'une application de suivi d'entraînement personnelle. La logique métier, la progression et les données existent déjà côté propriétaire : tu produis les écrans, les composants et les états, alimentés par des **données factices réalistes** en dur (aucun backend, aucun appel réseau, aucune persistance à inventer).

Livrable : **web app mobile-first en React + Tailwind**, un fichier par écran/composant, canvas de référence 390 × 844, dégradation propre jusqu'à 1280 px.

L'app n'a **qu'un seul utilisateur** : son propriétaire. Pas de page marketing, pas d'inscription, pas de partage social, pas de communauté. C'est un outil privé, ouvert tous les jours, souvent en sueur, souvent au sol, souvent d'une seule main.

---

## 1. Le produit en une phrase

Un compagnon d'entraînement qui déroule un programme déjà écrit, jour par jour, et qui garde la trace de tout ce qui a été accompli.

### Les deux axes

**Axe 1 — Le programme (force).** Trois parcours indépendants :

| Parcours | Niveaux | Jours par niveau | Total |
|---|---|---|---|
| Débutant | 8 | 7 | 56 jours |
| Intermédiaire | 8 | 7 | 56 jours |
| Advanced | 4 | 7 | 28 jours |

L'utilisateur peut **lire** le programme librement (n'importe quel niveau, n'importe quel jour) et **définir un point de départ** (parcours + niveau + jour) à partir duquel il suit le programme au jour le jour.

**Axe 2 — BackPain.** Un cycle glissant de 7 jours dédié au dos : une séance par jour du lundi au samedi, et le dimanche un exercice de marche. Le programme s'auto-améliore : chaque exercice a un palier courant qui monte au fil des cycles. Peu d'exercices par jour, séances courtes.

**Le liant — Les trophées.** Une page statistiques qui totalise les répétitions cumulées par exercice depuis toujours, sous forme de cartes (nom, image, compteur). Incrémentée automatiquement à la fin de chaque séance. C'est la salle des trophées : la preuve visuelle de tout ce qui a été fait.

---

## 2. Direction artistique

**Light épuré, beaucoup de blanc, qualité d'objet.** La référence est Apple Fitness : de l'air, une hiérarchie typographique nette, des surfaces calmes, et une seule zone de couleur forte par écran. Le luxe ici vient de la précision de l'espacement et du traitement des chiffres — pas d'ornement, pas de dégradé décoratif, pas de glassmorphism.

### Le principe structurant : la couleur encode le module

L'app a trois territoires, et chacun porte son accent. C'est le seul endroit où la couleur est autorisée à être forte. Un coup d'œil suffit pour savoir où on est.

- **Programme (force)** → Cobalt
- **BackPain (mobilité, restauration)** → Sauge
- **Trophées (accompli, cumulé)** → Laiton

Le reste de l'interface est neutre en toute circonstance.

### Tokens couleur

```
--paper        #FFFFFF   surfaces, cartes
--canvas       #F6F7F4   fond d'écran (blanc légèrement désaturé, jamais crème)
--ink          #111310   texte principal, chiffres
--graphite     #6E736B   texte secondaire, labels
--hairline     #E5E7E1   filets 1px, séparateurs, contours de pastilles
--cobalt       #1F3BE0   accent programme
--sage         #2E7D63   accent BackPain
--brass        #A9782C   accent trophées et paliers
--alert        #B3402E   uniquement destructif (réinitialiser, abandonner)
```

Interdits explicites : le crème #F4F1EA, le terracotta #D97757, le vert acide sur fond noir, les dégradés violets. Aucun mode sombre dans cette version.

### Typographie

Deux familles, trois rôles.

- **Archivo** (variable, axes de graisse et de largeur) — titres, chiffres, timers, compteurs, eyebrows. C'est la voix de l'app. Les grands nombres se posent en Archivo Expanded 600, chiffres tabulaires activés (`font-variant-numeric: tabular-nums`) partout où un chiffre change en direct.
- **Inter Tight** — corps de texte, listes, descriptions d'exercices, boutons.
- Eyebrows et métadonnées : Archivo 500, 11 px, majuscules, interlettrage +0.08em, en `--graphite`.

Échelle : 44 / 32 / 24 / 18 / 15 / 13 / 11. Interligne serré sur les titres (1.05), confortable sur le corps (1.5). Le timer de repos et le compteur de reps sortent de l'échelle : ils peuvent monter à 96 px.

### Formes et matière

- Rayon : 20 px sur les cartes, 14 px sur les champs et petits blocs, 999 px sur les pastilles et boutons pilules.
- Élévation : pas d'ombre portée diffuse. Les cartes se distinguent par le contraste `--paper` sur `--canvas` et un filet `--hairline` à 1 px. Une seule exception : la barre d'action fixe en bas d'écran porte une ombre très haute et très légère (`0 -1px 0 --hairline` + `0 -12px 24px rgba(17,19,16,0.04)`).
- Espacement : grille de 4. Gouttière d'écran 20 px. Respiration verticale généreuse entre les blocs (32–40 px), serrée à l'intérieur d'un bloc (8–12 px).
- Cibles tactiles : 44 px minimum, 56 px pour les actions primaires.

### L'élément signature : la grille de progression

Chaque niveau se représente par **une ligne de 7 pastilles** (un jour = une pastille). Empilées, les 8 lignes du parcours débutant forment une grille 8 × 7 qui montre l'intégralité du programme d'un seul coup d'œil : ce qui est fait, où on en est, ce qui reste. C'est le motif identitaire de l'app — il apparaît en grand sur l'écran Programme, en réduction sur la carte du jour, et en miniature dans les réglages.

États d'une pastille : à venir (contour `--hairline`), aujourd'hui (contour plein 2 px en accent + halo léger), fait (rempli en accent), sauté (rempli `--hairline`), repos/marche (pastille creuse avec un point central).

Ne pas transformer cette grille en heatmap façon GitHub, ne pas la coloriser par intensité. C'est un état binaire lisible, pas un dégradé.

### Mouvement

Discret et fonctionnel. Trois moments animés, pas un de plus :

1. **Le passage d'un exercice au suivant** en séance : glissement horizontal 240 ms, courbe `cubic-bezier(0.2, 0, 0, 1)`.
2. **Le timer de repos** : un arc fin qui se vide, plus le décompte numérique. Pas de pulsation, pas de couleur qui vire au rouge.
3. **Les compteurs de trophées** : à l'ouverture de la page, les chiffres roulent de 0 vers leur valeur en 600 ms, décalés de 40 ms par carte. Après la première visite de la session, ils s'affichent directement.

Respecter `prefers-reduced-motion` : tout devient instantané, les compteurs affichent leur valeur finale.

---

## 3. Navigation

**Barre d'onglets fixe en bas, 4 entrées**, plus les réglages accessibles par une icône dans l'en-tête d'Aujourd'hui.

```
[ Aujourd'hui ]  [ Programme ]  [ Dos ]  [ Trophées ]
```

Cinq onglets tiendraient à l'écran mais écraseraient les libellés et diluent la hiérarchie : les réglages ne sont pas une destination quotidienne. Si tu préfères les exposer, mets-les en cinquième position seulement après avoir vérifié que les libellés restent lisibles à 390 px sans troncature.

Onglet actif : icône pleine + libellé en `--ink`. Inactif : icône linéaire + libellé en `--graphite`. **L'onglet actif ne prend pas la couleur d'accent** — l'accent est réservé au contenu, sinon toute l'app clignote de couleur.

Le **mode séance est plein écran**, sans barre d'onglets. On y entre depuis Aujourd'hui, on en sort par une croix qui demande confirmation si la séance est entamée.

Desktop (≥ 1024 px) : colonne de contenu centrée à 520 px max sur `--canvas`, barre d'onglets transformée en rail vertical à gauche. Ne pas inventer un tableau de bord large : l'app reste une colonne.

---

## 4. Écrans à produire

### 4.1 Aujourd'hui

Le premier écran ouvert chaque jour. Il répond à une seule question : *qu'est-ce que je fais maintenant ?*

- En-tête : date en toutes lettres, salutation courte, icône réglages à droite.
- **Carte séance du programme** (accent cobalt) : parcours + niveau + jour (« Intermédiaire · Niveau 3 · Jour 5 »), la ligne de 7 pastilles du niveau en cours, la liste condensée des exercices du jour (3 premiers + « et 2 autres »), durée estimée, bouton primaire pleine largeur **Commencer la séance**.
- **Carte BackPain** (accent sauge) : jour du cycle, nom de la séance ou « Marche » le dimanche, 2–3 exercices annoncés, bouton secondaire **Commencer**.
- **Bandeau série en cours** : nombre de jours consécutifs, discret, en Archivo tabulaire, sans flamme ni badge criard.
- État « déjà fait aujourd'hui » : la carte passe en version accomplie (coche, reps totalisées, bouton devient **Revoir la séance**). C'est un état à part entière, à designer, pas une variante grisée.
- État « point de départ non défini » : une seule carte d'accueil qui invite à choisir son point de départ. Rien d'autre à l'écran.

### 4.2 Définir le point de départ

Flux en 3 étapes, une décision par écran, barre de progression fine en haut.

1. **Parcours** : trois cartes empilées (Débutant / Intermédiaire / Advanced) avec le nombre de niveaux et la durée totale. La carte sélectionnée prend le contour cobalt.
2. **Niveau** : la grille signature en entier, chaque ligne cliquable, le numéro de niveau en Archivo Expanded à gauche.
3. **Jour** : les 7 pastilles du niveau choisi, en grand, avec le titre de la séance de chaque jour.

Écran de confirmation : « Tu démarres à Intermédiaire · Niveau 3 · Jour 1 », rappel qu'on peut changer à tout moment dans les réglages, bouton **C'est parti**.

### 4.3 Programme (lecture)

Consultation libre, indépendante de la progression.

- Sélecteur de parcours en haut (segmented control 3 positions).
- La **grille signature en entier** : 8 lignes (ou 4 pour Advanced) de 7 pastilles, numéro de niveau et titre à gauche, taux d'avancement à droite.
- Toucher une ligne déplie le niveau : les 7 jours en liste, chacun avec son titre et son nombre d'exercices.
- Toucher un jour ouvre la **fiche jour en lecture** : liste des exercices avec séries × répétitions, temps de repos, note éventuelle. Deux actions en bas : **Démarrer ce jour** (lance le player sur ce jour sans toucher à la progression) et **Reprendre ici** (déplace le point de départ, avec confirmation).

La lecture doit être agréable au calme, sur le canapé : typographie de lecture confortable, pas de compression de l'information.

### 4.4 Mode séance (le player) — l'écran le plus important

Plein écran, une seule chose à faire à la fois, lisible à un mètre, utilisable d'une main en position instable.

**Vue exercice**
- Bandeau haut : croix de sortie à gauche, progression « Exercice 3 / 6 » au centre, chronomètre total de séance à droite en petit.
- Barre de progression segmentée sous le bandeau : un segment par exercice.
- Illustration ou photo de l'exercice, cadre 4:3, coins arrondis, sur `--paper`.
- Nom de l'exercice en Archivo 32 px.
- **La consigne du bloc en très grand** : « 3 × 12 » en Archivo Expanded 72 px, chiffres tabulaires.
- Sous-consigne : tempo, charge ou note du programme, en `--graphite`.
- Compteur de séries : pastilles horizontales (une par série), celles faites se remplissent.
- Action primaire fixe en bas, 56 px : **Série terminée**.
- Actions secondaires discrètes, en texte : *Passer l'exercice*, *Ajuster les reps* (feuille modale à molette, valeur pré-remplie sur la consigne).

**Vue repos** — prend tout l'écran, ne se confond jamais avec la vue exercice.
- Fond `--paper`, arc fin qui se vide, décompte en Archivo Expanded 96 px.
- Sous le timer : *Ensuite → nom de l'exercice ou de la série suivante*.
- Boutons : **+15 s**, **Passer le repos**.
- Distinguer visuellement le repos entre séries (arc en accent) du repos entre exercices (arc en `--graphite`, mention « Exercice suivant »).

**Écran de fin de séance**
- Titre : « Séance terminée ».
- Trois chiffres en grand : durée, exercices, répétitions totales.
- **Le moment trophées** : la liste des exercices avec `+X reps` qui s'ajoutent, et le nouveau total all-time de chacun. C'est la récompense — soigne-la, c'est ce qui donne envie de recommencer.
- Signalement d'un palier franchi s'il y a lieu (voir 4.6).
- Bouton **Terminer** qui ramène à Aujourd'hui, carte du jour en état accompli.

**Reprise** : si une séance a été quittée en cours, Aujourd'hui affiche en haut un bandeau **Reprendre la séance** avec l'exercice où elle s'est arrêtée.

### 4.5 BackPain

Même grammaire visuelle, accent sauge, mais un ton nettement plus calme : moins de chiffres, plus d'air, séances courtes annoncées comme telles.

- Carte du jour en haut : jour du cycle (1 à 7), nom de la séance, durée, bouton **Commencer**.
- **Le cycle en 7 jours** : une ligne de 7 pastilles, la septième typée « marche » (pastille creuse à point central). Le dimanche, la carte du jour affiche l'objectif de marche et un bouton **Marche effectuée** qui bascule en état accompli, sans lancer le player.
- **Progression des exercices** : liste des exercices récurrents du module, chacun avec son palier courant et sa dernière évolution (« Palier 4 · +1 depuis le cycle précédent »). Représenter le palier par une petite échelle de niveaux, pas par un pourcentage.
- Les séances BackPain utilisent **le même player** que le programme, avec l'accent sauge et des temps de repos plus courts.

### 4.6 Trophées

La salle des trophées. Elle doit donner envie de descendre la page.

- En-tête : total de répétitions toutes disciplines confondues, en Archivo Expanded 44 px, chiffres tabulaires, avec l'effet compteur qui roule à l'ouverture. Sous-ligne : nombre de séances et jours d'activité.
- **Grille de cartes exercice**, 2 colonnes sur mobile, 3 à partir de 720 px. Chaque carte : image de l'exercice en haut (carré ou 4:3, coins arrondis), nom sur une ou deux lignes, **compteur all-time en gros**, et le palier atteint sous forme d'un liseré laiton discret.
- **Paliers** : 100 / 500 / 1 000 / 5 000 / 10 000 / 25 000 répétitions. Une carte ayant franchi un palier porte une marque laiton sobre (un chevron, un chiffre romain, un filet — choisis un traitement et tiens-le). Pas de médaille en 3D, pas d'emoji.
- Barre d'outils collante : tri (plus de reps / récent / alphabétique) et filtre (tous / programme / dos).
- Toucher une carte ouvre une **fiche exercice** : image en grand, total, répartition par module, date du premier et du dernier passage, prochain palier avec le reste à parcourir.
- État vide : une seule carte fantôme et une phrase qui invite à faire la première séance.

### 4.7 Réglages

Liste sobre, groupée, sans icônes colorées.

- **Programme** : parcours actif, position actuelle, *Changer mon point de départ*.
- **Séance** : repos par défaut entre séries et entre exercices, décompte sonore, garder l'écran allumé, compte à rebours de 3 s avant démarrage.
- **BackPain** : jour de début de cycle, rappel de marche du dimanche.
- **Données** : exporter, réinitialiser la progression (destructif, `--alert`, double confirmation avec saisie).
- **À propos** : version.

---

## 5. États obligatoires

Pour chaque écran, produire : **normal, vide, chargement, erreur**. Ils font partie du livrable, pas d'un second temps.

- **Chargement** : squelettes aux dimensions exactes du contenu final, jamais de spinner centré.
- **Vide** : une phrase qui dit quoi faire et un bouton. Jamais d'illustration décorative sans fonction.
- **Erreur** : ce qui s'est passé, comment le régler, un bouton **Réessayer**. Pas d'excuses, pas de ton mignon.
- **Séance interrompue** : reprise proposée, jamais de perte silencieuse.

---

## 6. Ton et écriture

Français, **tutoiement**, casse de phrase, verbes actifs, zéro jargon technique. Le vocabulaire d'une action reste identique du bouton jusqu'au retour : **Commencer la séance** → *Séance commencée*.

À écrire : « 3 séries de 12 » plutôt que « 3x12 reps » dans les textes, mais « 3 × 12 » en affichage chiffré. « Repos » et pas « Rest ». « Palier » et pas « level ». « Trophées » et pas « Achievements ».

À bannir : « Continuez comme ça ! », « Bravo champion », « Boostez vos perfs », les points d'exclamation en cascade, le coaching motivationnel. L'app constate, elle n'encourage pas. La satisfaction vient des chiffres, pas des compliments.

---

## 7. Données factices à utiliser

Fournir un module `mockData` unique, réaliste et cohérent :

- **~20 exercices** avec `id`, `nom`, `image` (placeholder 1:1), `module` (`programme` | `dos`), `totalReps`. Utiliser de vrais noms d'exercices au poids du corps : pompes, tractions, dips, squats, fentes, gainage, superman, bird dog, dead bug, chat-chameau, pont fessier, extensions lombaires…
- **Structure programme complète** en volume mais partiellement remplie en détail : 3 parcours, tous les niveaux et jours présents, contenu réel d'exercices sur au moins un niveau entier par parcours, contenu généré pour le reste.
- **Progression réaliste** : parcours intermédiaire actif, niveau 3, jour 5, niveaux 1 et 2 complets, un jour sauté quelque part.
- **Cycle BackPain** au jour 4, paliers d'exercices entre 2 et 6.
- **Totaux all-time** hétérogènes et crédibles : de 84 à 12 400 répétitions selon l'exercice, plusieurs paliers déjà franchis, un exercice à 3 reps du palier suivant (bon cas de test pour la fiche exercice).

Chaque écran doit être visualisable dans tous ses états sans manipuler la donnée à la main : prévoir un moyen simple de basculer les états en développement.

---

## 8. Quality floor

- Responsive de 320 px à 1440 px sans casse ni scroll horizontal.
- Focus clavier visible sur tout élément interactif, contour 2 px en `--ink` avec 2 px de décalage.
- Contraste AA minimum sur tout texte ; les accents ne portent jamais de texte sous 4.5:1.
- `prefers-reduced-motion` respecté.
- Zone sûre iOS respectée : la barre d'onglets et l'action primaire du player ne passent pas sous l'indicateur d'accueil.
- Aucun texte tronqué à 390 px, y compris avec les noms d'exercices longs.

---

## 9. Anti-patterns

Ne pas produire :

- une carte de statistiques par métrique inventée (calories, VO2 max, « score de forme ») — l'app ne mesure que des répétitions et des séances ;
- des anneaux de progression concentriques (c'est Apple, pas cette app) ;
- un fil d'actualité, des amis, des classements, des badges à partager ;
- des cartes à ombre portée diffuse sur fond gris ;
- des icônes multicolores dans les réglages ;
- un onboarding en 6 écrans qui explique le produit — le point de départ suffit ;
- des libellés en anglais mélangés au français ;
- un mode sombre non demandé.

---

## 10. Méthode attendue

1. Poser d'abord le système : tokens, échelle typographique, jeu d'icônes (trait 1.5 px, style uniforme), et les composants de base — carte, pastille, ligne de niveau, bouton, feuille modale, barre d'onglets.
2. Construire **le player en premier** : c'est l'écran qui valide le système, celui qui a le plus de contraintes et le plus d'usage.
3. Puis Aujourd'hui, Trophées, Programme, BackPain, Réglages, flux de point de départ.
4. Relire l'ensemble : si un écran pourrait appartenir à n'importe quelle app de fitness, retravailler la typographie et la grille de progression jusqu'à ce que ce ne soit plus le cas. Retirer un élément décoratif par écran.
