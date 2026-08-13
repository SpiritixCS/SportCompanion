CREATE TABLE tracking_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE tracking_seances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE tracking_sets_logged (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id INTEGER NOT NULL REFERENCES tracking_seances(id),
  exercise_id INTEGER NOT NULL REFERENCES tracking_exercises(id),
  exercise_order INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  reps_actual INTEGER NOT NULL,
  completed_at TEXT NOT NULL
);
