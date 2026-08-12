CREATE TABLE dos_start_date (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  start_date TEXT NOT NULL,
  set_at TEXT NOT NULL
);

CREATE TABLE dos_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arbre TEXT NOT NULL,
  semaine INTEGER NOT NULL,
  cran_apres INTEGER NOT NULL,
  resultat TEXT NOT NULL,
  horodatage TEXT NOT NULL
);
