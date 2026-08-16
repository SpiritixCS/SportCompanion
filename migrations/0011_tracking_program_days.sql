-- Ordre : enfants avant parents (tracking_program_state et
-- tracking_program_rotation référencent tracking_templates par FK ; ce
-- projet exécute avec PRAGMA foreign_keys=ON, cf. migration 0010).
DROP TABLE tracking_program_state;
DROP TABLE tracking_program_rotation;
DROP TABLE tracking_template_exercises;
DROP TABLE tracking_templates;

CREATE TABLE tracking_program_days (
  day_of_week INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Lundi … 6=Dimanche
  is_rest INTEGER NOT NULL DEFAULT 1 CHECK (is_rest IN (0, 1))
);

INSERT INTO tracking_program_days (day_of_week, is_rest) VALUES
  (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1);

CREATE TABLE tracking_program_day_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_of_week INTEGER NOT NULL REFERENCES tracking_program_days(day_of_week),
  ordre INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('reps', 'seconds')),
  sets_count INTEGER NOT NULL,
  target_value INTEGER NOT NULL,
  UNIQUE (day_of_week, ordre)
);

CREATE TABLE tracking_program_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pointer_day_of_week INTEGER NOT NULL DEFAULT 0 REFERENCES tracking_program_days(day_of_week)
);
INSERT INTO tracking_program_state (id, pointer_day_of_week) VALUES (1, 0);

ALTER TABLE tracking_seances RENAME COLUMN template_id TO program_day_of_week;

-- Les anciennes valeurs de template_id (ids arbitraires du modèle "modèles + rotation")
-- n'ont aucun rapport avec un jour de semaine 0-6 : les préserver ferait planter ou
-- mal attribuer les séances actives. On les remet à NULL, ce qui fait suivre à ces
-- séances le chemin de secours "legacy/freeform" déjà géré par l'application.
UPDATE tracking_seances SET program_day_of_week = NULL;
