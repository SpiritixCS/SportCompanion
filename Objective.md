
Contexte : 
J'ai payé il y'a longtemps un programme de sport mais le site va bientot ne plus être accessible.
J'ai téléchargé la totalité des pages html du site. tu les trouves réparties en 3 niveaux dans caliathletics_backup. 

dans caliathletics  j'ai tout le contenu html du site avec le programme. 

il y'a également des outil d'extraction du programme et de parsing, afin de récupérer le programme en détial

Objectif final : 

Avoir un onlget Workout dans l'app avec : 

Les 3 programmes intégrés. lorsque je vais débuter pour la première fois mon training : Je veux pouvoir définir un niveau précis de départ, par exmeple : débutant, level 2. 

En faisant ça, la progression se lance. Chaque jours prévu, quand je vais dans l'onglet Workout : J'ai ma séance en détail avec la totalité des exerices prévus. 
J'ai un bouton pour lancer la séance. Au lancemenr, l'exercice 1 se lance. Quand je valide le nombre de rep, un timer de 1mn30 de repos se lance seul. Puis s'ouvre la page des prochaines rep. Si j'ai 4x10 tractions, je dois avoir 4x l'intéraction. 

Une fois le nombre de rep exécuté x le nombre de séries, ça passe auto à l'exercice suivant. 
Il doit y avoir une cohérence avec du repos entre chaque série et entre chaque exericie. 

Une fois la séance finie, j'ai un écran récapitulatif avec le nombre total / exercice. Donc si 4x10 tractions j'aurai 40 tractions. 

Un bouton permet ainsi de valider la séance. Une fois validée la séance est loggée. 

L'objectif est donc, d'avoir un suivi global mais aussi un vrai outil pour réaliser ma séance direct dans l'app. 

Une fois les 7 jours du niveau effectué (donc 7 jours validé par l'user et non pas juste 7 jours écoulés), l'app doit me propose de monter de niveau ou de refaire le niveau déjà fait. En effet il est possible que j'ai besoin de maintenir un palier + que 1 semaine. 

Annexe : Travaille a une page statistiques qui gamifie le tout. La page devra notamment comprendre la totalité de reps sur les principaux exos : total de tractione ever, total de pompes, total de dips, total de squats etc. 

J'ai déjà un design UI que je souhaite suivre et respecter, tu le récupères via le mcp claude design : https://claude.ai/design/p/26278c39-f837-45df-9871-0aba27003ad2?file=Suivi+Entrainement.dc.html&via=share : BackPainDesign

Pause toutes les question clarificatrices nécessaires. 

Dans un second temps, tu découvriras que ce design prévois également une partie dos : J'ai déjà toute la logique du programme dans BackPainProgram.md. Je souhaite garder ce programme tel quel, en suivant l'ui qu'on a créé via claude design