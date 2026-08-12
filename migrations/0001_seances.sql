CREATE TABLE seances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parcours TEXT NOT NULL,
  level INTEGER NOT NULL,
  day_index INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE sets_logged (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id INTEGER NOT NULL REFERENCES seances(id),
  exercise_order INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  reps_target TEXT NOT NULL,
  reps_actual INTEGER NOT NULL,
  rest_seconds INTEGER NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE TABLE skipped_exercises (
  seance_id INTEGER NOT NULL REFERENCES seances(id),
  exercise_order INTEGER NOT NULL,
  skipped_at TEXT NOT NULL,
  PRIMARY KEY (seance_id, exercise_order)
);
