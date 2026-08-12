CREATE TABLE dos_evaluations_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arbre TEXT NOT NULL CHECK (arbre IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J')),
  semaine INTEGER NOT NULL,
  cran_apres INTEGER NOT NULL,
  resultat TEXT NOT NULL CHECK (resultat IN ('montee', 'maintien', 'douleur', 'plafond', 'sommet', 'decharge', 'calibrage')),
  horodatage TEXT NOT NULL
);

INSERT INTO dos_evaluations_new SELECT * FROM dos_evaluations;

DROP TABLE dos_evaluations;

ALTER TABLE dos_evaluations_new RENAME TO dos_evaluations;
