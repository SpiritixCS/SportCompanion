CREATE TABLE dos_seances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  jour_semaine TEXT NOT NULL,
  semaine INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  gene_pendant INTEGER
);

CREATE TABLE dos_sets_logged (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id INTEGER NOT NULL REFERENCES dos_seances(id),
  exercise_order INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  valeur_target TEXT NOT NULL,
  valeur_actual INTEGER NOT NULL,
  rest_seconds INTEGER NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE TABLE dos_skipped_exercises (
  seance_id INTEGER NOT NULL REFERENCES dos_seances(id),
  exercise_order INTEGER NOT NULL,
  skipped_at TEXT NOT NULL,
  PRIMARY KEY (seance_id, exercise_order)
);
