-- Mode pyramide. Additive : toutes les lignes existantes gardent des colonnes NULL.
-- catalog_id : exercice Caliathletics auquel un exercice Tracking est lié
-- (ses séries créditent alors la carte Trophées du catalogue).
ALTER TABLE tracking_exercises ADD COLUMN catalog_id TEXT;
CREATE UNIQUE INDEX tracking_exercises_catalog ON tracking_exercises (catalog_id) WHERE catalog_id IS NOT NULL;

-- Exercice d'un jour Tracking joué en pyramide (NULL = en séries).
ALTER TABLE tracking_program_day_exercises ADD COLUMN pyramid_shape TEXT CHECK (pyramid_shape IN ('classic', 'inverted'));
ALTER TABLE tracking_program_day_exercises ADD COLUMN pyramid_peak INTEGER CHECK (pyramid_peak BETWEEN 2 AND 30);

-- Pyramide libre : une séance Tracking et sa configuration.
CREATE TABLE tracking_pyramids (
  seance_id INTEGER PRIMARY KEY REFERENCES tracking_seances(id),
  exercise_name TEXT NOT NULL,
  shape TEXT NOT NULL CHECK (shape IN ('classic', 'inverted')),
  peak INTEGER NOT NULL CHECK (peak BETWEEN 2 AND 30)
);
