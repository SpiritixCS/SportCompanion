ALTER TABLE tracking_seances ADD COLUMN template_id INTEGER;

CREATE TABLE tracking_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE tracking_template_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES tracking_templates(id),
  ordre INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('reps', 'seconds')),
  sets_count INTEGER NOT NULL,
  target_value INTEGER NOT NULL,
  UNIQUE (template_id, ordre)
);

CREATE TABLE tracking_program_rotation (
  template_id INTEGER PRIMARY KEY REFERENCES tracking_templates(id),
  position INTEGER NOT NULL UNIQUE
);

CREATE TABLE tracking_program_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pointer_template_id INTEGER REFERENCES tracking_templates(id)
);

CREATE TABLE tracking_skipped_exercises (
  seance_id INTEGER NOT NULL REFERENCES tracking_seances(id),
  exercise_order INTEGER NOT NULL,
  skipped_at TEXT NOT NULL,
  PRIMARY KEY (seance_id, exercise_order)
);
