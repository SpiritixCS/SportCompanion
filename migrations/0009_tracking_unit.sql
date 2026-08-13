ALTER TABLE tracking_exercises ADD COLUMN unit TEXT NOT NULL DEFAULT 'reps' CHECK (unit IN ('reps', 'seconds'));
ALTER TABLE tracking_sets_logged RENAME COLUMN reps_actual TO valeur_actual;
