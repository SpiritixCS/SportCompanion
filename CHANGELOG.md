# Journal des changements — SportCompanion

Ce qui change pour l'utilisateur, le plus récent en haut. Détail technique : `git log`.

---

## V1 — 3 et 4 octobre 2026

### Accueil des nouveaux (4 oct.)
- Nouvel écran prénom au premier accès : prénom en haut, présentation des trois modules (Programme, Tracking, Trophées) en dessous, le tout sans scroll sur iPhone.

### Mode pyramide (4 oct.)
- Pyramide libre lancée depuis Aujourd'hui (carte « UP, DOWN », 2ᵉ position) ou depuis Tracking.
- N'importe quel exercice : liste filtrée dès les premières lettres, exercices du programme reconnus par leur nom.
- Deux formes : classique (1 → N → 1) et inversée (N → 1 → N), sommet de 2 à 30, dernier sommet prérempli.
- Repos automatique selon la hauteur de la marche (15 s en bas, 2 min au sommet).
- On saisit les reps réellement faites, la pyramide continue.
- Un exercice d'un jour Tracking peut être « en pyramide » au lieu de « séries × reps ».
- Reprise d'une pyramide interrompue, historique dans « Tes séances ».
- Reps d'une pyramide sur un exercice du programme comptées sur la carte Trophées de cet exercice.
- Champs texte en 16 px : plus de zoom automatique sur iPhone.

### Refonte graphique « Agrès » (4 oct.)
- Nouveau système visuel partout : fond aluminium, cartes blanches, chiffres en grand, typo Big Shoulders / Instrument Sans / IBM Plex Mono.
- La couleur encode le module : indigo Programme, jade Tracking, or Trophées.
- Les sept traits remplacent les pastilles de progression.
- Pictos d'exercices dessinés, navigation en pilule flottante à 4 onglets.
- Aujourd'hui, Programme, séance (exercice, saisie, repos sombre, récap), Trophées (prochain palier, tri, échelle des paliers), Tracking et écrans secondaires refaits.
- Tracking : page unique (semaine, prochaine séance, historique), édition du jour dans une feuille, **repos réglable par exercice**.

### Comptes et séances (3 oct.)
- Plusieurs utilisateurs : chaque email autorisé dans Cloudflare Access a son propre espace, créé au premier accès, prénom demandé une fois.
- Données de Mathis et Clément reprises sous leur email, sans perte.
- Reps hors séance ajoutables depuis la fiche Trophées d'un exercice.
- Séances : durée active (les pauses de plus d'1 h ne comptent pas), après 1 h d'inactivité choix Reprendre / Terminer / Effacer, bouton « Terminer la séance » (une séance partielle valide le jour).
- Module Dos retiré ; Tracking ouvert à tous.
- Barre de navigation qui ne cache plus la grille des jours.

---

## v0.1 — 12 au 24 août 2026

- Première version : Aujourd'hui, Programme Caliathletics (3 parcours, choix du point de départ, montée de niveau proposée après 7 jours validés), player de séance (séries, repos automatique, récap, reprise), Trophées (cumul all-time, paliers), Réglages (durées de repos, écran maintenu allumé).
- Module Dos (protocole BackPain) — retiré en V1.
- Tracking pour Clément : séances libres, puis programme personnel sur 7 jours fixes joué dans le player.
- Progression exercice / série affichée sur l'écran de repos (24 août).
